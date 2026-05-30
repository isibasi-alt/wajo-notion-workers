import assert from "node:assert/strict";
import { cancelProjectForTest, dismissProjectForTest } from "./index";

const updates: Array<Record<string, unknown>> = [];

const notion = {
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => ({
			id: page_id,
			properties: {
				案件名: {
					type: "title",
					title: [{ plain_text: "滋賀県250kW太陽光発電所" }],
				},
				ステータス: { type: "select", select: { name: "🏆 成約" } },
				成約日: { type: "date", date: { start: "2026-05-25" } },
				確認待ち内容: { type: "rich_text", rich_text: [] },
				失注理由: { type: "multi_select", multi_select: [] },
				管理アクション状態: { type: "select", select: null },
				管理アクション日: { type: "date", date: null },
				管理アクションメモ: { type: "rich_text", rich_text: [] },
				最終アクション日: { type: "date", date: null },
			},
		}),
		update: async (args: Record<string, unknown>) => {
			updates.push(args);
			return { id: args.page_id };
		},
		create: async () => ({ id: "unused" }),
	},
	dataSources: {
		query: async () => ({ results: [] }),
	},
	comments: {
		create: async () => ({}),
	},
};

async function main() {
	const dismissed = await dismissProjectForTest("project-1", notion as never, "条件再確認");
	assert.equal(dismissed.action, "dismissed");
	assert.equal(
		((updates[0]!.properties as Record<string, unknown>).ステータス as { select: { name: string } }).select.name,
		"⏳ 確認待ち",
	);
	assert.equal(
		((updates[0]!.properties as Record<string, unknown>).管理アクション状態 as { select: { name: string } }).select.name,
		"差し戻し",
	);

	updates.length = 0;
	const cancelled = await cancelProjectForTest("project-1", notion as never, "案件取り消し");
	assert.equal(cancelled.action, "cancelled");
	assert.equal(
		((updates[0]!.properties as Record<string, unknown>).ステータス as { select: { name: string } }).select.name,
		"❌ 失注",
	);
	assert.equal(
		((updates[0]!.properties as Record<string, unknown>).管理アクション状態 as { select: { name: string } }).select.name,
		"取り消し",
	);
	assert.deepEqual(
		(updates[0]!.properties as Record<string, unknown>).成約日,
		{ date: null },
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
