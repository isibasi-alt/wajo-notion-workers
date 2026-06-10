import assert from "node:assert/strict";
import { processClosingReportForTest } from "./index";

const CLOSING_REPORT_DATA_SOURCE_ID = "8d5a506b-59b8-4e50-bc77-d5412774048d";
const DEAL_DATA_SOURCE_ID = "7838db8a-907a-4c61-b062-109f8278b2c9";
const SALES_PERFORMANCE_DATA_SOURCE_ID = "e67ec5d5-90d3-4118-9788-976a6f5c94a1";

async function main() {
	const updates: Array<Record<string, unknown>> = [];
	const appends: Array<Record<string, unknown>> = [];

	const notion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				if (args.data_source_id === CLOSING_REPORT_DATA_SOURCE_ID) {
					return {
						results: [{
							id: "closing-existing",
							properties: {
								承認ステータス: { type: "select", select: { name: "成約" } },
							},
						}],
					};
				}
				if (args.data_source_id === DEAL_DATA_SOURCE_ID) return { results: [] };
				if (args.data_source_id !== SALES_PERFORMANCE_DATA_SOURCE_ID) return { results: [] };
				return {
					results: [{
						id: "performance-1",
						properties: {
							監査区分: { type: "select", select: { name: "通常監査" } },
							関連成約: {
								type: "relation",
								relation: [{ id: "closing-existing" }],
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
						title: [{ plain_text: "既存成約callout重複抑止テスト案件" }],
					},
					売買区分: { type: "select", select: { name: "売却案件" } },
					実績粗利額: { type: "number", number: 1500000 },
					担当営業ユーザー: { type: "people", people: [{ id: "sales-user-1" }] },
					仕入れ担当: { type: "people", people: [] },
				},
			}),
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
		},
		blocks: {
			children: {
				append: async (args: Record<string, unknown>) => {
					appends.push(args);
					return {};
				},
			},
		},
		comments: {
			create: async () => ({}),
		},
	};

	const result = await processClosingReportForTest(
		"project-1",
		notion as never,
		"button-click-user",
	);

	assert.equal(result.action, "already-exists-linked");
	assert.equal(updates.length, 0, "既に月次成績へ紐付け済みなら関連成約を更新しない");
	assert.equal(appends.length, 0, "既に月次成績へ紐付け済みなら📊calloutを重複追記しない");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
