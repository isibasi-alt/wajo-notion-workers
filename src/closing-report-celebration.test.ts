import assert from "node:assert/strict";
import { processClosingReportForTest } from "./index";

const creates: Array<Record<string, unknown>> = [];

const notion = {
	dataSources: {
		query: async () => ({ results: [] }),
	},
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => ({
			id: page_id,
			properties: {
				案件名: {
					type: "title",
					title: [{ plain_text: "祝砲テスト案件" }],
				},
				売買区分: { type: "select", select: { name: "売却案件" } },
				対象物種別: { type: "select", select: { name: "土地" } },
				実績粗利額: { type: "number", number: 1230000 },
				担当営業ユーザー: { type: "people", people: [{ id: "existing-sales" }] },
				仕入れ担当: { type: "people", people: [] },
				関連企業: { type: "relation", relation: [{ id: "company-1" }] },
				ステータス: { type: "select", select: { name: "📋 提案中" } },
				成約日: { type: "date", date: null },
			},
		}),
		update: async (args: Record<string, unknown>) => ({ id: args.page_id }),
		create: async (args: Record<string, unknown>) => {
			creates.push(args);
			return { id: "closing-1", url: "https://notion.so/closing-1" };
		},
	},
	comments: {
		create: async () => ({}),
	},
};

async function main() {
	const result = await processClosingReportForTest(
		"project-1",
		notion as never,
		"trigger-user",
	);

	assert.equal(result.action, "created");
	const closingCreate = creates.find((args) =>
		(args.parent as { data_source_id?: string }).data_source_id === "8d5a506b-59b8-4e50-bc77-d5412774048d"
	);
	assert.ok(closingCreate);
	const createJson = JSON.stringify(closingCreate);
	assert.match(createJson, /成約速報/);
	assert.match(createJson, /月次成績/);
	assert.match(createJson, /1,230,000/);
	assert.match(createJson, /49,200/);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
