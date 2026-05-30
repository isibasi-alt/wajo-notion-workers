import assert from "node:assert/strict";
import { cancelClosingReportForTest } from "./index";

const updates: Array<Record<string, unknown>> = [];
const queries: Array<Record<string, unknown>> = [];

const notion = {
	dataSources: {
		query: async (args: Record<string, unknown>) => {
			queries.push(args);
			return {
				results: [{
					id: "quota-1",
					properties: {
						関連成約: {
							type: "relation",
							relation: [{ id: "closing-1" }, { id: "closing-other" }],
						},
					},
				}],
			};
		},
	},
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => ({
			id: page_id,
			properties:
				page_id === "closing-fixed"
					? {
							承認ステータス: { type: "select", select: { name: "成約" } },
							歩合確定額: { type: "number", number: 1000 },
							関連案件: { type: "relation", relation: [{ id: "project-1" }] },
						}
					: page_id === "project-1"
						? {
								ステータス: { type: "select", select: { name: "🏆 成約" } },
								成約日: { type: "date", date: { start: "2026-05-25" } },
								管理アクション状態: { type: "select", select: null },
								管理アクション日: { type: "date", date: null },
								管理アクションメモ: { type: "rich_text", rich_text: [] },
								最終アクション日: { type: "date", date: null },
							}
						: {
								承認ステータス: { type: "select", select: { name: "成約" } },
								歩合確定額: { type: "number", number: 0 },
								関連案件: { type: "relation", relation: [{ id: "project-1" }] },
								管理メモ: { type: "rich_text", rich_text: [] },
							},
		}),
		update: async (args: Record<string, unknown>) => {
			updates.push(args);
			return { id: args.page_id };
		},
	},
	comments: {
		create: async () => ({}),
	},
};

async function main() {
	const result = await cancelClosingReportForTest("closing-1", notion as never);

	assert.equal(result.action, "cancelled");
	assert.equal(updates.length, 3);
	assert.equal(
		((updates[0]!.properties as Record<string, unknown>).承認ステータス as { select: { name: string } }).select.name,
		"取り消し",
	);
	assert.equal(
		((updates[1]!.properties as Record<string, unknown>).ステータス as { select: { name: string } }).select.name,
		"📋 提案中",
	);
	assert.deepEqual(
		(updates[2]!.properties as Record<string, unknown>).関連成約,
		{ relation: [{ id: "closing-other" }] },
	);
	assert.equal(queries.length, 1);
	assert.equal(
		queries[0]!.data_source_id,
		"e67ec5d5-90d3-4118-9788-976a6f5c94a1",
	);

	updates.length = 0;
	queries.length = 0;
	const blocked = await cancelClosingReportForTest("closing-fixed", notion as never);

	assert.equal(blocked.action, "blocked");
	assert.equal(updates.length, 0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
