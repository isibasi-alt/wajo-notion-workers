import assert from "node:assert/strict";
import { processClosingReportForTest } from "./index";

const updates: Array<Record<string, unknown>> = [];
const creates: Array<Record<string, unknown>> = [];
const comments: Array<Record<string, unknown>> = [];

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
					title: [{ plain_text: "粗利未入力テスト案件" }],
				},
				売買区分: { type: "select", select: { name: "売却案件" } },
				対象物種別: { type: "select", select: { name: "土地" } },
				実績粗利額: { type: "number", number: null },
				予定粗利額: { type: "number", number: null },
				担当営業ユーザー: { type: "people", people: [{ id: "existing-sales" }] },
				仕入れ担当: { type: "people", people: [] },
				関連企業: { type: "relation", relation: [{ id: "company-1" }] },
				ステータス: { type: "select", select: { name: "📋 提案中" } },
				成約日: { type: "date", date: null },
			},
		}),
		update: async (args: Record<string, unknown>) => {
			updates.push(args);
			return { id: args.page_id };
		},
		create: async (args: Record<string, unknown>) => {
			creates.push(args);
			return { id: "closing-1" };
		},
	},
	comments: {
		create: async (args: Record<string, unknown>) => {
			comments.push(args);
			return {};
		},
	},
};

async function main() {
	const result = await processClosingReportForTest(
		"project-1",
		notion as never,
		"trigger-user",
	);

	assert.equal(result.action, "needs-gross-profit");
	assert.equal(result.closingPageId, null);
	assert.match(result.message, /予定粗利額|実績粗利額/);
	assert.equal(updates.length, 0, "案件ステータスを成約に変えてはいけない");
	assert.equal(creates.length, 0, "粗利なしで成約報告DBを作ってはいけない");
	assert.equal(comments.length, 1);
	assert.match(JSON.stringify(comments[0]), /成約報告の準備はできています/);
	assert.match(JSON.stringify(comments[0]), /予定粗利額/);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
