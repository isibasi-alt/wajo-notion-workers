import assert from "node:assert/strict";
import { processLandCaseCreationForTest } from "./index";

function titleProp(value: string) {
	return { type: "title", title: value ? [{ plain_text: value }] : [] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function selectProp(value: string) {
	return { type: "select", select: value ? { name: value } : null };
}

function numberProp(value: number | null = null) {
	return { type: "number", number: value };
}

function multiSelectProp(values: string[]) {
	return { type: "multi_select", multi_select: values.map((name) => ({ name })) };
}

function relationProp(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function landPage() {
	return {
		id: "land-1",
		properties: {
			土地名称: titleProp("姫路南土地"),
			所在地: richTextProp("兵庫県姫路市南町1-1"),
			"面積（坪）": numberProp(480),
			電力会社エリア: selectProp("関西電力"),
			接道状況: richTextProp("南側4m"),
			用途地域: selectProp("市街化調整区域"),
			所有者情報: richTextProp("未入力"),
			売り先候補: relationProp([]),
			対象用途: selectProp("未定"),
			案件化根拠: multiSelectProp([]),
			関連案件: relationProp([]),
			案件化メモ: richTextProp(""),
		},
	};
}

async function main() {
	const updates: Array<Record<string, unknown>> = [];
	const creates: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];

	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				assert.equal(page_id, "land-1");
				return landPage();
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return { id: "project-created", properties: {} };
			},
		},
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return { results: [] };
			},
		},
		comments: {
			create: async () => ({}),
		},
		blocks: {
			children: {
				append: async () => ({}),
				list: async () => ({ results: [] }),
			},
		},
	};

	const result = await processLandCaseCreationForTest(
		{ landPageId: "land-1", dryRun: false },
		notion as never,
	);

	assert.equal(result.action, "needs-review");
	assert.equal(result.projectId, null);
	assert.equal(creates.length, 0, "必須不足なら案件を新規作成しない");
	assert.ok(queries.length >= 1, "既存関連案件確認までは行う");

	const update = updates.find((entry) => entry.page_id === "land-1");
	assert.ok(update, "土地ページへ案件化メモを書き戻す");
	const properties = update!.properties as Record<string, unknown>;
	const memo = JSON.stringify(properties["案件化メモ"]);
	assert.match(memo, /売り先候補/);
	assert.match(memo, /対象用途/);
	assert.match(memo, /案件化根拠/);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
