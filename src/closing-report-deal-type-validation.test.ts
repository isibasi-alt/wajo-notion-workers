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
					title: [{ plain_text: "売買区分未確定テスト案件" }],
				},
				売買区分: { type: "select", select: { name: "不明" } },
				対象物種別: { type: "select", select: { name: "土地" } },
				実績粗利額: { type: "number", number: 1000000 },
				担当営業ユーザー: { type: "people", people: [{ id: "sales-user" }] },
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
		"button-click-user",
	);

	assert.equal(result.action, "needs-deal-type");
	assert.equal(result.closingPageId, null);
	assert.match(result.message, /売買区分/);
	assert.equal(updates.length, 0, "売買区分未確定のまま成約へ進めてはいけない");
	assert.equal(creates.length, 0, "売買区分未確定のまま成約報告を作ってはいけない");
	assert.equal(comments.length, 1);
	assert.match(JSON.stringify(comments[0]), /売却案件|購入希望|売買両方/);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
