import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
	buildFinanceSimulationForTest,
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

function checkboxProp(value: boolean) {
	return { type: "checkbox", checkbox: value };
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
	assert.equal(partial.missingField, "土地代ゼロ確認");

	const zeroUnconfirmed = evaluateInvestmentConditionPdfReadinessForTest({
		土地代: numberProp(0),
		システム本体価格: numberProp(18_000_000),
		権利代: numberProp(0),
		借入額: numberProp(16_000_000),
		金利: numberProp(1),
		返済期間: numberProp(15),
	});
	assert.equal(zeroUnconfirmed.missingField, "土地代ゼロ確認");
	assert.deepEqual(zeroUnconfirmed.nextRequiredFields, ["権利代ゼロ確認"]);

	const complete = evaluateInvestmentConditionPdfReadinessForTest({
		土地代: numberProp(0),
		土地代ゼロ確認: checkboxProp(true),
		システム本体価格: numberProp(18_000_000),
		権利代: numberProp(2_000_000),
		借入額: numberProp(16_000_000),
		金利: numberProp(1),
		返済期間: numberProp(15),
	});
	assert.equal(complete.missingField, null);
	assert.deepEqual(complete.nextRequiredFields, []);

	const financeWithExit = buildFinanceSimulationForTest({
		properties: {
			土地代: numberProp(0),
			土地代ゼロ確認: checkboxProp(true),
			システム本体価格: numberProp(18_000_000),
			権利代: numberProp(2_000_000),
			借入額: numberProp(16_000_000),
			金利: numberProp(1),
			返済期間: numberProp(15),
			実効税率: numberProp(30),
			今期利益見込: numberProp(8_000_000),
			流動比率: numberProp(210),
			利益剰余金: numberProp(120_000_000),
			自己資本比率: numberProp(55),
			出口想定年数: numberProp(3),
			出口想定売却価格: numberProp(17_000_000),
			出口費用率: numberProp(5),
			出口時税金見込: numberProp(400_000),
			和上買取コミット段階: selectProp("和上コミット承認"),
			和上買取コミット価格: numberProp(17_500_000),
		},
		salePrice: 20_000_000,
		annualNetIncome: 2_500_000,
		paybackYears: 8,
		fitRemainingYears: 10,
	});
	assert.equal(financeWithExit.composition.verificationStatus, "確認済み");
	assert.equal(financeWithExit.exitScenario.missingItems.length, 0);
	assert.equal(financeWithExit.exitScenario.exitYears, 3);
	assert.equal(financeWithExit.exitScenario.priceSource, "和上買取コミット");
	assert.equal(financeWithExit.exitScenario.commitmentStatus, "和上コミット承認");
	assert.equal(financeWithExit.exitScenario.exitSalePrice, 17_500_000);
	assert.ok((financeWithExit.exitScenario.loanBalanceAtExit ?? 0) > 0);
	assert.ok((financeWithExit.exitScenario.netExitProceeds ?? 0) > 0);
	assert.ok((financeWithExit.exitScenario.cumulativeOperatingCashflow ?? 0) > 0);
	assert.ok((financeWithExit.exitScenario.totalCashReceived ?? 0) > 0);
	assert.notEqual(financeWithExit.exitScenario.netInvestmentGain, null);
	assert.notEqual(financeWithExit.exitScenario.equityIrr, null);

	const financePage = {
		id: "finance-1",
		properties: {
			Name: titleProp("投資条件テスト"),
			関連案件: relationProp(["project-1"]),
			関連提案シミュレーション: relationProp(["proposal-1"]),
			土地代: numberProp(0),
			土地代ゼロ確認: checkboxProp(true),
			システム本体価格: numberProp(18_000_000),
			権利代: numberProp(2_000_000),
			借入額: numberProp(16_000_000),
			金利: numberProp(1),
			返済期間: numberProp(15),
			実効税率: numberProp(30),
			今期利益見込: numberProp(8_000_000),
			流動比率: numberProp(210),
			利益剰余金: numberProp(120_000_000),
			自己資本比率: numberProp(55),
			出口想定年数: numberProp(3),
			出口想定売却価格: numberProp(17_000_000),
			出口費用率: numberProp(5),
			出口時税金見込: numberProp(400_000),
			和上買取コミット段階: selectProp("和上コミット承認"),
			和上買取コミット価格: numberProp(17_500_000),
			投資条件シミュレーションHTML: { type: "files", files: [] },
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
	let generatedHtml: Blob | null = null;
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
				generatedHtml = file.data instanceof Blob ? file.data : null;
				return {};
			},
		},
		blocks: {
			children: {
				list: async () => ({
					results: [
						{ id: "heading-existing", type: "heading_3", heading_3: { rich_text: [{ plain_text: "投資条件シミュレーションHTML" }] } },
						{ id: "file-existing", type: "file", file: {} },
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
	assert.equal(output.action, "prepared", output.message);
	assert.equal(uploads.length, 1);
	assert.equal(blockUpdates.length, 1, "既存HTMLリンクは追加せず置換する");
	assert.equal(
		blockUpdates[0]!.type,
		"file",
		"Notion Blocks APIでHTMLファイルブロックを更新するときはtype: fileを明示する",
	);
	assert.equal(appends.length, 0, "既存HTMLリンクがある場合は本文ブロックを重複させない");
	assert.ok(updates.some((update) => update.page_id === "finance-1"));
	assert.equal(comments.length, 1);
	assert.ok(generatedHtml, "投資条件HTMLが生成される");
	assert.match(generatedHtml.type, /^text\/html; ?charset=utf-8$/);
	const html = await generatedHtml.text();
	assert.match(html, /WAJO Sales OS/);
	assert.match(html, /Finance Simulation/);
	assert.match(html, /最終提案判定/);
	assert.match(html, /S \/ 優先提案/);
	assert.match(html, /投資対象条件/);
	assert.match(html, /与信/);
	assert.match(html, /財務提案の結論/);
	assert.match(html, /税引き後キャッシュ/);
	assert.match(html, /3年出口/);
	assert.match(html, /和上買取コミット/);
	assert.match(html, /銀行相談/);
	assert.match(html, /表面利回りだけではなく/);
	assert.match(html, /提案の進め方/);
	assert.match(html, /出口価格・融資条件・税務処理の順で、提案条件を最終確認します。/);
	assert.doesNotMatch(html, /次に固める条件[^<]*最上位判定です/);
	assert.doesNotMatch(html, /次の確認[^<]*最上位判定です/);
	assert.match(html, /3年出口IRR[\s\S]*40\.22%/);
	assert.match(html, /3年出口手取り[\s\S]*¥3,236,859/);
	assert.match(html, /DSCR[\s\S]*2\.17/);
	assert.match(html, /NPV \/ IRR[\s\S]*¥2,683,731 \/ 7\.68%/);
	assert.match(html, /税効果後CF[\s\S]*¥1,783,667/);
	assert.match(html, /税効果[\s\S]*入力値由来/);
	assert.match(html, /実効税率 30%（入力値）/);
	assert.match(html, /今期利益見込 ¥8,000,000（入力値）/);
	assert.doesNotMatch(html, /参考試算（仮置き前提）/);
	assert.doesNotMatch(html, /営業マン/);
	assert.doesNotMatch(html, /社内用/);
	assert.doesNotMatch(html, /ゲート/);

	const financePendingBsPage = {
		...financePage,
		id: "finance-pending-bs",
		properties: {
			...financePage.properties,
			流動比率: numberProp(null),
			利益剰余金: numberProp(null),
			自己資本比率: numberProp(null),
		},
	};
	const pendingBsUpdates: Array<Record<string, unknown>> = [];
	let pendingBsHtml: Blob | null = null;
	const pendingBsOutput = await processInvestmentConditionPdfForTest(
		{ financePageId: "finance-pending-bs", dryRun: false },
		{
			pages: {
				retrieve: async ({ page_id }: { page_id: string }) => {
					if (page_id === "finance-pending-bs") return financePendingBsPage;
					if (page_id === "proposal-1") return proposalPage;
					if (page_id === "project-1") return projectPage;
					if (page_id === "equipment-1") return { id: "equipment-1", properties: {} };
					throw new Error(`unknown pending bs page ${page_id}`);
				},
				update: async (args: Record<string, unknown>) => {
					pendingBsUpdates.push(args);
					return { id: args.page_id };
				},
				create: async () => {
					throw new Error("not expected");
				},
			},
			dataSources: {
				query: async () => ({ results: [financePendingBsPage] }),
			},
			fileUploads: {
				create: async () => ({ id: "upload-pending-bs" }),
				send: async (args: Record<string, unknown>) => {
					const file = args.file as { data?: unknown };
					pendingBsHtml = file.data instanceof Blob ? file.data : null;
					return {};
				},
			},
			blocks: {
				children: {
					list: async () => ({ results: [] }),
					append: async () => ({}),
				},
			},
			comments: { create: async () => ({}) },
		} as never,
	);
	assert.equal(pendingBsOutput.action, "prepared", pendingBsOutput.message);
	assert.ok(pendingBsHtml, "B/S未入力でも保留HTMLは生成される");
	const htmlPendingBs = await pendingBsHtml.text();
	assert.match(htmlPendingBs, /最終提案判定[\s\S]*最終判定保留/);
	assert.match(htmlPendingBs, /財務情報確認中 \/ 最終判定保留/);
	assert.match(htmlPendingBs, /流動比率・利益剰余金・自己資本比率を入力後/);
	assert.doesNotMatch(htmlPendingBs, /本資料の結論は「S \/ 優先提案」/);
	assert.doesNotMatch(htmlPendingBs, /顧客財務込みの最終提案判定[\s\S]*S \/ 優先提案/);
	const pendingBsFinanceUpdate = pendingBsUpdates.find((update) => update.page_id === "finance-pending-bs");
	assert.ok(pendingBsFinanceUpdate);
	assert.equal(
		(pendingBsFinanceUpdate!.properties as Record<string, { select?: { name?: string } }>).ファイナンス状態.select?.name,
		"要確認",
	);
	assert.equal(
		(pendingBsFinanceUpdate!.properties as Record<string, unknown>).購入タイミング判定,
		undefined,
	);
	if (process.env.INVESTMENT_PDF_PENDING_TEST_OUTPUT && pendingBsHtml) {
		await writeFile(
			process.env.INVESTMENT_PDF_PENDING_TEST_OUTPUT,
			Buffer.from(await pendingBsHtml.arrayBuffer()),
		);
	}

	const financeTaxProvisionalPage = {
		...financePage,
		id: "finance-tax-provisional",
		properties: {
			...financePage.properties,
			実効税率: numberProp(null),
			今期利益見込: numberProp(null),
		},
	};
	const taxProvisionalUpdates: Array<Record<string, unknown>> = [];
	let taxProvisionalHtml: Blob | null = null;
	const taxProvisionalOutput = await processInvestmentConditionPdfForTest(
		{ financePageId: "finance-tax-provisional", dryRun: false },
		{
			pages: {
				retrieve: async ({ page_id }: { page_id: string }) => {
					if (page_id === "finance-tax-provisional") return financeTaxProvisionalPage;
					if (page_id === "proposal-1") return proposalPage;
					if (page_id === "project-1") return projectPage;
					if (page_id === "equipment-1") return { id: "equipment-1", properties: {} };
					throw new Error(`unknown tax provisional page ${page_id}`);
				},
				update: async (args: Record<string, unknown>) => {
					taxProvisionalUpdates.push(args);
					return { id: args.page_id };
				},
				create: async () => {
					throw new Error("not expected");
				},
			},
			dataSources: {
				query: async () => ({ results: [financeTaxProvisionalPage] }),
			},
			fileUploads: {
				create: async () => ({ id: "upload-tax-provisional" }),
				send: async (args: Record<string, unknown>) => {
					const file = args.file as { data?: unknown };
					taxProvisionalHtml = file.data instanceof Blob ? file.data : null;
					return {};
				},
			},
			blocks: {
				children: {
					list: async () => ({ results: [] }),
					append: async () => ({}),
				},
			},
			comments: { create: async () => ({}) },
		} as never,
	);
	assert.equal(taxProvisionalOutput.action, "prepared", taxProvisionalOutput.message);
	assert.ok(taxProvisionalHtml, "税率未入力でも仮置きHTMLは生成される");
	const htmlTaxProvisional = await taxProvisionalHtml.text();
	assert.match(htmlTaxProvisional, /S（投資対象条件の評価） \/ 参考試算（仮置き前提）/);
	assert.match(htmlTaxProvisional, /税務前提を確認中のため、投資対象条件の評価は参考試算です/);
	assert.match(htmlTaxProvisional, /実効税率と今期利益見込を入力すると、税引き後キャッシュと出口条件を確定評価します/);
	assert.match(htmlTaxProvisional, /3年出口の手取りは参考試算（仮置き前提）です/);
	assert.doesNotMatch(htmlTaxProvisional, /今の条件で前向きに進めてよい上位案件/);
	assert.doesNotMatch(htmlTaxProvisional, /償却税効果が強い/);
	assert.doesNotMatch(htmlTaxProvisional, /今買う理由が明確/);
	assert.doesNotMatch(htmlTaxProvisional, /税引き後キャッシュを確認できる状態/);
	assert.doesNotMatch(htmlTaxProvisional, /出口手取り .*まで確認済み/);
	assert.match(htmlTaxProvisional, /最終提案判定[\s\S]*最終判定保留/);
	assert.match(htmlTaxProvisional, /税務前提確認中 \/ 最終判定保留/);
	assert.match(htmlTaxProvisional, /実効税率・今期利益見込を入力後/);
	assert.doesNotMatch(htmlTaxProvisional, /本資料の結論は「S \/ 優先提案」/);
	assert.doesNotMatch(htmlTaxProvisional, /顧客財務込みの最終提案判定[\s\S]*S \/ 優先提案/);
	assert.match(htmlTaxProvisional, /税効果[\s\S]*参考試算（仮置き前提）/);
	assert.match(htmlTaxProvisional, /実効税率 30%（標準仮置き）/);
	assert.match(htmlTaxProvisional, /今期利益見込 未入力（償却上限未確認）/);
	assert.match(htmlTaxProvisional, /NPV \/ IRR[\s\S]*参考試算（仮置き前提）/);
	assert.match(htmlTaxProvisional, /税効果後CF[\s\S]*参考試算（仮置き前提）/);
	assert.match(htmlTaxProvisional, /3年出口IRR[\s\S]*参考試算（仮置き前提）/);
	assert.match(htmlTaxProvisional, /3年出口手取り[\s\S]*参考試算（仮置き前提）/);
	assert.match(htmlTaxProvisional, /保有中手取り[\s\S]*参考試算（仮置き前提）/);
	const taxProvisionalFinanceUpdate = taxProvisionalUpdates.find((update) => update.page_id === "finance-tax-provisional");
	assert.ok(taxProvisionalFinanceUpdate);
	const taxProvisionalProps = taxProvisionalFinanceUpdate!.properties as Record<string, { select?: { name?: string } } | unknown>;
	assert.equal((taxProvisionalProps.ファイナンス状態 as { select?: { name?: string } }).select?.name, "要確認");
	assert.equal(taxProvisionalProps.購入タイミング判定, undefined);
	assert.equal(taxProvisionalProps.実効税率, undefined);
	assert.equal(taxProvisionalProps.税効果, undefined);
	assert.equal(taxProvisionalProps.税引後キャッシュフロー, undefined);
	assert.equal(taxProvisionalProps.NPV, undefined);
	assert.equal(taxProvisionalProps.IRR, undefined);
	assert.equal(taxProvisionalProps.経済メリット, undefined);
	assert.equal(taxProvisionalProps.出口手取り, undefined);
	assert.equal(taxProvisionalProps.出口エクイティNPV, undefined);
	assert.equal(taxProvisionalProps.出口エクイティIRR, undefined);
	if (process.env.INVESTMENT_PDF_TAX_PROVISIONAL_TEST_OUTPUT && taxProvisionalHtml) {
		await writeFile(
			process.env.INVESTMENT_PDF_TAX_PROVISIONAL_TEST_OUTPUT,
			Buffer.from(await taxProvisionalHtml.arrayBuffer()),
		);
	}

	const financePageVariant = {
		id: "finance-variant",
		properties: {
			Name: titleProp("投資条件テスト2"),
			関連案件: relationProp(["project-variant"]),
			関連提案シミュレーション: relationProp(["proposal-variant"]),
			土地代: numberProp(1_500_000),
			システム本体価格: numberProp(21_000_000),
			権利代: numberProp(2_500_000),
			借入額: numberProp(18_000_000),
			金利: numberProp(1.4),
			返済期間: numberProp(12),
			実効税率: numberProp(28),
			今期利益見込: numberProp(9_000_000),
			流動比率: numberProp(185),
			利益剰余金: numberProp(90_000_000),
			自己資本比率: numberProp(48),
			出口想定年数: numberProp(4),
			出口想定売却価格: numberProp(19_000_000),
			出口費用率: numberProp(4),
			出口時税金見込: numberProp(350_000),
			和上買取コミット段階: selectProp("出口想定"),
			割引率: numberProp(4.5),
		},
	};
	const financePageForeign = {
		id: "finance-foreign",
		properties: {
			Name: titleProp("混入禁止ファイナンス"),
			関連案件: relationProp(["project-foreign"]),
			関連提案シミュレーション: relationProp(["proposal-foreign"]),
			土地代: numberProp(9_999_999),
			システム本体価格: numberProp(88_888_888),
			権利代: numberProp(7_777_777),
			借入額: numberProp(66_666_666),
			金利: numberProp(9.9),
			返済期間: numberProp(30),
		},
	};
	const proposalPageVariant = {
		id: "proposal-variant",
		properties: {
			案件名: titleProp("投資条件テスト案件2"),
			関連案件: relationProp(["project-variant"]),
			関連設備詳細: relationProp(["equipment-variant"]),
			提案タイプ: selectProp("法人オーナー"),
			販売価格: numberProp(null),
			仕入れ価格: numberProp(21_000_000),
			年間売電収入: numberProp(3_400_000),
			"年間維持費（ランニングコスト）": numberProp(600_000),
			発電所名: textProp("バリアント発電所"),
			所在地: textProp("滋賀県湖南市"),
			電力会社エリア: selectProp("関西電力"),
			"低圧/高圧区分": selectProp("高圧"),
			パネルメーカー: textProp("Canadian Solar"),
			パネル型式: textProp("CS7N"),
			パネル枚数: numberProp(500),
			"DC容量（パネル側kW）": numberProp(300),
			パワコンメーカー: textProp("Sungrow"),
			パワコン型式: textProp("SG250HX"),
			"PCS容量（パワコン側kW）": numberProp(250),
			"FIT/FIP区分": selectProp("FIT"),
			売電単価: numberProp(12),
			残存売電期間: numberProp(11),
			連系開始日: dateProp("2021-04-01"),
			現場写真: filesProp(),
		},
	};
	const proposalPageForeign = {
		id: "proposal-foreign",
		properties: {
			案件名: titleProp("混入禁止提案"),
			関連案件: relationProp(["project-foreign"]),
			販売価格: numberProp(99_999_999),
			年間売電収入: numberProp(9_999_999),
		},
	};
	const projectPageVariant = {
		id: "project-variant",
		properties: {
			Name: titleProp("投資条件テスト案件2"),
			販売価格: numberProp(26_000_000),
		},
	};
	const projectPageForeign = {
		id: "project-foreign",
		properties: {
			Name: titleProp("対象外案件名"),
			販売価格: numberProp(99_999_999),
		},
	};
	const variantUpdates: Array<Record<string, unknown>> = [];
	const variantAppends: Array<Record<string, unknown>> = [];
	const variantComments: Array<Record<string, unknown>> = [];
	const variantUploads: Array<Record<string, unknown>> = [];
	const variantCreates: Array<Record<string, unknown>> = [];
	let variantHtml: Blob | null = null;
	const notionVariant = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "finance-variant") return financePageVariant;
				if (page_id === "finance-foreign") return financePageForeign;
				if (page_id === "proposal-variant") return proposalPageVariant;
				if (page_id === "proposal-foreign") return proposalPageForeign;
				if (page_id === "project-variant") return projectPageVariant;
				if (page_id === "project-foreign") return projectPageForeign;
				if (page_id === "equipment-variant") return { id: "equipment-variant", properties: {} };
				throw new Error(`unknown variant page ${page_id}`);
			},
			update: async (args: Record<string, unknown>) => {
				variantUpdates.push(args);
				return { id: args.page_id };
			},
			create: async (args: Record<string, unknown>) => {
				variantCreates.push(args);
				throw new Error("investment condition html must not create case document records");
			},
		},
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				const serialized = JSON.stringify(args);
				if (serialized.includes("proposal-variant")) return { results: [financePageVariant] };
				if (serialized.includes("project-variant")) return { results: [financePageVariant, financePageForeign] };
				if (serialized.includes("proposal-foreign") || serialized.includes("project-foreign")) {
					return { results: [financePageForeign] };
				}
				return { results: [] };
			},
		},
		fileUploads: {
			create: async () => ({ id: "upload-variant" }),
			send: async (args: Record<string, unknown>) => {
				variantUploads.push(args);
				const file = args.file as { data?: unknown };
				variantHtml = file.data instanceof Blob ? file.data : null;
				return {};
			},
		},
		blocks: {
			children: {
				list: async () => ({ results: [] }),
				append: async (args: Record<string, unknown>) => {
					variantAppends.push(args);
					return {};
				},
			},
		},
		comments: {
			create: async (args: Record<string, unknown>) => {
				variantComments.push(args);
				return {};
			},
		},
	};
	const variantOutput = await processInvestmentConditionPdfForTest(
		{ financePageId: "finance-variant", dryRun: false },
		notionVariant as never,
	);
	assert.equal(variantOutput.action, "prepared", variantOutput.message);
	assert.equal(variantUploads.length, 1);
	assert.equal(variantAppends.length, 1, "HTML files型プロパティが無い場合はFinance本文へfallbackする");
	assert.equal(variantAppends[0]!.block_id, "finance-variant");
	assert.equal(variantCreates.length, 0, "投資条件HTMLは案件資料DBへ誤保存しない");
	assert.ok(variantUpdates.length > 0);
	assert.ok(
		variantUpdates.every((update) => update.page_id === "finance-variant"),
		"対象外Finance/提案/案件ページは更新しない",
	);
	assert.equal(variantComments.length, 1);
	assert.equal(variantComments[0]!.parent?.page_id, "finance-variant");
	assert.ok(variantHtml, "2例目の投資条件HTMLが生成される");
	const htmlVariant = await variantHtml.text();
	assert.match(htmlVariant, /投資条件テスト案件2/);
	assert.match(htmlVariant, /4年出口IRR[\s\S]*14\.41%/);
	assert.match(htmlVariant, /4年出口手取り[\s\S]*¥5,559,594/);
	assert.match(htmlVariant, /DSCR[\s\S]*1\.71/);
	assert.match(htmlVariant, /NPV \/ IRR[\s\S]*¥2,025,015 \/ 5\.94%/);
	assert.match(htmlVariant, /税効果後CF[\s\S]*¥1,645,904/);
	assert.doesNotMatch(htmlVariant, /40\.22%/);
	assert.doesNotMatch(htmlVariant, /¥3,236,859/);
	assert.doesNotMatch(htmlVariant, /対象外案件名/);
	assert.doesNotMatch(htmlVariant, /混入禁止/);

	const multiProjectFinancePage = {
		...financePage,
		id: "finance-multi-project",
		properties: {
			...financePage.properties,
			関連案件: relationProp(["project-1", "project-foreign"]),
		},
	};
	const multiProjectOutput = await processInvestmentConditionPdfForTest(
		{ financePageId: "finance-multi-project", dryRun: false },
		{
			pages: {
				retrieve: async ({ page_id }: { page_id: string }) => {
					if (page_id === "finance-multi-project") return multiProjectFinancePage;
					throw new Error(`multi-project should stop before retrieving ${page_id}`);
				},
				update: async () => {
					throw new Error("multi-project should not update pages");
				},
				create: async () => {
					throw new Error("multi-project should not create pages");
				},
			},
			dataSources: {
				query: async () => {
					throw new Error("multi-project should not query data sources");
				},
			},
			fileUploads: {
				create: async () => {
					throw new Error("multi-project should not upload files");
				},
				send: async () => {
					throw new Error("multi-project should not upload files");
				},
			},
		} as never,
	);
		assert.equal(multiProjectOutput.action, "needs-input");
		assert.equal(multiProjectOutput.missingField, "関連案件");
		assert.match(multiProjectOutput.message, /関連案件が1件だけ/);

		const proposalMultiProjectPage = {
			...proposalPage,
			id: "proposal-multi-project",
			properties: {
				...proposalPage.properties,
				関連案件: relationProp(["project-1", "project-foreign"]),
			},
		};
		const financeForProposalMulti = {
			...financePage,
			id: "finance-proposal-multi-project",
			properties: {
				...financePage.properties,
				関連案件: relationProp(["project-1"]),
				関連提案シミュレーション: relationProp(["proposal-multi-project"]),
			},
		};
		const proposalMultiOutput = await processInvestmentConditionPdfForTest(
			{ financePageId: "finance-proposal-multi-project", dryRun: false },
			{
				pages: {
					retrieve: async ({ page_id }: { page_id: string }) => {
						if (page_id === "finance-proposal-multi-project") return financeForProposalMulti;
						if (page_id === "proposal-multi-project") return proposalMultiProjectPage;
						throw new Error(`proposal multi-project should stop before retrieving ${page_id}`);
					},
					update: async () => {
						throw new Error("proposal multi-project should not update pages");
					},
					create: async () => {
						throw new Error("proposal multi-project should not create pages");
					},
				},
				dataSources: {
					query: async () => {
						throw new Error("proposal multi-project should not query data sources");
					},
				},
				fileUploads: {
					create: async () => {
						throw new Error("proposal multi-project should not upload files");
					},
					send: async () => {
						throw new Error("proposal multi-project should not upload files");
					},
				},
			} as never,
		);
		assert.equal(proposalMultiOutput.action, "needs-input");
		assert.equal(proposalMultiOutput.missingField, "関連案件");
		assert.match(proposalMultiOutput.message, /提案シミュレーションの関連案件を1件/);

		const proposalMismatchedProjectPage = {
			...proposalPage,
			id: "proposal-mismatched-project",
			properties: {
				...proposalPage.properties,
				関連案件: relationProp(["project-foreign"]),
			},
		};
		const financeForProjectMismatch = {
			...financePage,
			id: "finance-project-mismatch",
			properties: {
				...financePage.properties,
				関連案件: relationProp(["project-1"]),
				関連提案シミュレーション: relationProp(["proposal-mismatched-project"]),
			},
		};
		const mismatchOutput = await processInvestmentConditionPdfForTest(
			{ financePageId: "finance-project-mismatch", dryRun: false },
			{
				pages: {
					retrieve: async ({ page_id }: { page_id: string }) => {
						if (page_id === "finance-project-mismatch") return financeForProjectMismatch;
						if (page_id === "proposal-mismatched-project") return proposalMismatchedProjectPage;
						throw new Error(`project mismatch should stop before retrieving ${page_id}`);
					},
					update: async () => {
						throw new Error("project mismatch should not update pages");
					},
					create: async () => {
						throw new Error("project mismatch should not create pages");
					},
				},
				dataSources: {
					query: async () => {
						throw new Error("project mismatch should not query data sources");
					},
				},
				fileUploads: {
					create: async () => {
						throw new Error("project mismatch should not upload files");
					},
					send: async () => {
						throw new Error("project mismatch should not upload files");
					},
				},
			} as never,
		);
		assert.equal(mismatchOutput.action, "needs-input");
		assert.equal(mismatchOutput.missingField, "関連案件");
		assert.match(mismatchOutput.message, /関連案件が一致していません/);
		if (process.env.INVESTMENT_PDF_TEST_OUTPUT && generatedHtml) {
			await writeFile(
			process.env.INVESTMENT_PDF_TEST_OUTPUT,
			Buffer.from(await generatedHtml.arrayBuffer()),
		);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
