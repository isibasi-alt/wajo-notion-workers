import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
	evaluateInvestmentConditionPdfReadinessForTest,
	processInvestmentConditionPdfForTest,
} from "./index";

function numberProp(value: number | null) {
	return { type: "number", number: value };
}

function textProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function titleProp(value: string) {
	return { type: "title", title: value ? [{ plain_text: value }] : [] };
}

function selectProp(value: string) {
	return { type: "select", select: value ? { name: value } : null };
}

function relationProp(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function dateProp(value: string) {
	return { type: "date", date: value ? { start: value } : null };
}

function filesProp() {
	return { type: "files", files: [{ type: "file", file: { url: "https://example.test/site.jpg" } }] };
}

async function main() {
	const empty = evaluateInvestmentConditionPdfReadinessForTest({});
	assert.equal(empty.missingField, "土地代");
	assert.deepEqual(empty.nextRequiredFields, [
		"システム本体価格",
		"権利代",
		"借入額",
		"金利",
		"返済期間",
	]);

	const partial = evaluateInvestmentConditionPdfReadinessForTest({
		土地代: numberProp(0),
		システム本体価格: numberProp(18_000_000),
		権利代: numberProp(2_000_000),
		借入額: numberProp(16_000_000),
		金利: numberProp(1),
	});
	assert.equal(partial.missingField, "返済期間");

	const complete = evaluateInvestmentConditionPdfReadinessForTest({
		土地代: numberProp(0),
		システム本体価格: numberProp(18_000_000),
		権利代: numberProp(2_000_000),
		借入額: numberProp(16_000_000),
		金利: numberProp(1),
		返済期間: numberProp(15),
	});
	assert.equal(complete.missingField, null);
	assert.deepEqual(complete.nextRequiredFields, []);

	const financePage = {
		id: "finance-1",
		properties: {
			Name: titleProp("投資条件テスト"),
			関連案件: relationProp(["project-1"]),
			関連提案シミュレーション: relationProp(["proposal-1"]),
			土地代: numberProp(0),
			システム本体価格: numberProp(18_000_000),
			権利代: numberProp(2_000_000),
			借入額: numberProp(16_000_000),
			金利: numberProp(1),
			返済期間: numberProp(15),
			実効税率: numberProp(30),
			投資条件シミュレーションPDF: { type: "files", files: [] },
		},
	};
	const proposalPage = {
		id: "proposal-1",
		properties: {
			案件名: titleProp("投資条件テスト案件"),
			関連案件: relationProp(["project-1"]),
			関連設備詳細: relationProp(["equipment-1"]),
			提案タイプ: selectProp("法人オーナー"),
			販売価格: numberProp(null),
			仕入れ価格: numberProp(17_000_000),
			年間売電収入: numberProp(3_000_000),
			"年間維持費（ランニングコスト）": numberProp(500_000),
			発電所名: textProp("テスト発電所"),
			所在地: textProp("兵庫県神戸市"),
			電力会社エリア: selectProp("関西電力"),
			"低圧/高圧区分": selectProp("高圧"),
			パネルメーカー: textProp("Jinko Solar"),
			パネル型式: textProp("JKM-550"),
			パネル枚数: numberProp(456),
			"DC容量（パネル側kW）": numberProp(250.8),
			パワコンメーカー: textProp("Huawei"),
			パワコン型式: textProp("SUN2000"),
			"PCS容量（パワコン側kW）": numberProp(250),
			"FIT/FIP区分": selectProp("FIT"),
			売電単価: numberProp(12),
			残存売電期間: numberProp(10),
			連系開始日: dateProp("2020-04-01"),
			現場写真: filesProp(),
		},
	};
	const projectPage = {
		id: "project-1",
		properties: {
			Name: titleProp("投資条件テスト案件"),
			販売価格: numberProp(20_000_000),
		},
	};
	const updates: Array<Record<string, unknown>> = [];
	const blockUpdates: Array<Record<string, unknown>> = [];
	const appends: Array<Record<string, unknown>> = [];
	const comments: Array<Record<string, unknown>> = [];
	const uploads: Array<Record<string, unknown>> = [];
	let generatedPdf: Blob | null = null;
	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "finance-1") return financePage;
				if (page_id === "proposal-1") return proposalPage;
				if (page_id === "project-1") return projectPage;
				if (page_id === "equipment-1") return { id: "equipment-1", properties: {} };
				throw new Error(`unknown page ${page_id}`);
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
			create: async () => {
				throw new Error("not expected");
			},
		},
		dataSources: {
			query: async () => ({ results: [financePage] }),
		},
		fileUploads: {
			create: async () => ({ id: "upload-new" }),
			send: async (args: Record<string, unknown>) => {
				uploads.push(args);
				const file = args.file as { data?: unknown };
				generatedPdf = file.data instanceof Blob ? file.data : null;
				return {};
			},
		},
		blocks: {
			children: {
				list: async () => ({
					results: [
						{ id: "heading-existing", type: "heading_3", heading_3: { rich_text: [{ plain_text: "投資条件シミュレーションPDF" }] } },
						{ id: "pdf-existing", type: "pdf", pdf: {} },
					],
				}),
				append: async (args: Record<string, unknown>) => {
					appends.push(args);
					return {};
				},
			},
			update: async (args: Record<string, unknown>) => {
				blockUpdates.push(args);
				return {};
			},
		},
		comments: {
			create: async (args: Record<string, unknown>) => {
				comments.push(args);
				return {};
			},
		},
	};
	const output = await processInvestmentConditionPdfForTest(
		{ financePageId: "finance-1", dryRun: false },
		notion as never,
	);
	assert.equal(output.action, "prepared");
	assert.equal(uploads.length, 1);
	assert.equal(blockUpdates.length, 1, "既存PDFは追加せず置換する");
	assert.equal(appends.length, 0, "既存PDFがある場合は本文ブロックを重複させない");
	assert.ok(updates.some((update) => update.page_id === "finance-1"));
	assert.equal(comments.length, 1);
	if (process.env.INVESTMENT_PDF_TEST_OUTPUT && generatedPdf) {
		await writeFile(
			process.env.INVESTMENT_PDF_TEST_OUTPUT,
			Buffer.from(await generatedPdf.arrayBuffer()),
		);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
