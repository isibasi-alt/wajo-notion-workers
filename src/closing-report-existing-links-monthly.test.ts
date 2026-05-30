import assert from "node:assert/strict";
import { processClosingReportForTest } from "./index";

const queries: Array<Record<string, unknown>> = [];
const updates: Array<Record<string, unknown>> = [];
const creates: Array<Record<string, unknown>> = [];

const notion = {
	dataSources: {
		query: async (args: Record<string, unknown>) => {
			queries.push(args);
			if (queries.length === 1) {
				return {
					results: [{
						id: "closing-existing",
						properties: {
							承認ステータス: { type: "select", select: { name: "成約" } },
						},
					}],
				};
			}
			return {
				results: [{
					id: "performance-1",
					properties: {
						関連成約: {
							type: "relation",
							relation: [],
						},
					},
				}],
			};
		},
	},
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => ({
			id: page_id,
			properties: {
				案件名: {
					type: "title",
					title: [{ plain_text: "既存成約リンク修復テスト案件" }],
				},
				売買区分: { type: "select", select: { name: "売却案件" } },
				対象物種別: { type: "select", select: { name: "土地" } },
				実績粗利額: { type: "number", number: 1500000 },
				担当営業ユーザー: { type: "people", people: [{ id: "project-sales-user" }] },
				仕入れ担当: { type: "people", people: [] },
				関連企業: { type: "relation", relation: [{ id: "company-1" }] },
				ステータス: { type: "select", select: { name: "🏆 成約" } },
			},
		}),
		update: async (args: Record<string, unknown>) => {
			updates.push(args);
			return { id: args.page_id };
		},
		create: async (args: Record<string, unknown>) => {
			creates.push(args);
			return { id: "unexpected-create" };
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
		"button-click-user",
	);

	assert.equal(result.action, "already-exists-linked");
	assert.equal(result.closingPageId, "closing-existing");
	assert.equal(creates.length, 0, "既存成約がある場合は成約報告を重複作成しない");
	assert.deepEqual(updates[0], {
		page_id: "performance-1",
		properties: {
			関連成約: {
				relation: [{ id: "closing-existing" }],
			},
		},
	});
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
