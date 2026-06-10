import assert from "node:assert/strict";
import { syncProjectClosingStatusToPerformanceForTest } from "./index";

const CLOSING_REPORT_DATA_SOURCE_ID = "8d5a506b-59b8-4e50-bc77-d5412774048d";
const DEAL_DATA_SOURCE_ID = "7838db8a-907a-4c61-b062-109f8278b2c9";
const SALES_PERFORMANCE_DATA_SOURCE_ID = "e67ec5d5-90d3-4118-9788-976a6f5c94a1";

function title(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function select(value: string) {
	return { type: "select", select: { name: value } };
}

function number(value: number) {
	return { type: "number", number: value };
}

function people(ids: string[]) {
	return { type: "people", people: ids.map((id) => ({ id })) };
}

function relation(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

async function main() {
	const queries: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const creates: Array<Record<string, unknown>> = [];
	const appends: Array<Record<string, unknown>> = [];

	const notion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				if (args.data_source_id === CLOSING_REPORT_DATA_SOURCE_ID) return { results: [] };
				if (args.data_source_id === DEAL_DATA_SOURCE_ID) {
					return {
						results: [{
							id: "deal-1",
							properties: {
								商談名: title("成約同期対象商談"),
								商談ステータス: select("フォロー中"),
								商談結果: select("提案中"),
								関連成約: relation([]),
								関連案件: relation(["project-closed"]),
								"🔥 案件リスト": relation(["project-closed"]),
							},
						}],
					};
				}
				return {
					results: [{
						id: "performance-1",
						properties: {
							評価名: title("2026年6月 営業A｜本番"),
							監査区分: select("通常監査"),
							関連成約: relation([]),
						},
					}],
				};
			},
		},
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "deal-1") {
					return {
						id: page_id,
						properties: {
							商談名: title("成約同期対象商談"),
							商談ステータス: select("フォロー中"),
							商談結果: select("提案中"),
							関連成約: relation([]),
							関連案件: relation(["project-closed"]),
							"🔥 案件リスト": relation(["project-closed"]),
						},
					};
				}
				return {
					id: page_id,
					properties: {
						案件名: title("ステータス同期テスト案件"),
						売買区分: select("売却案件"),
						対象物種別: select("土地"),
						実績売上額: number(12_000_000),
						実績粗利額: number(3_000_000),
						担当営業ユーザー: people(["sales-user-1"]),
						仕入れ担当: people([]),
						関連企業: relation(["company-1"]),
						" 商談管理DB": relation(["deal-1"]),
						ステータス: select(
							page_id === "project-closed"
								? "🏆 成約"
								: page_id === "project-pending-close"
									? "📤 成約申請中"
									: "📋 提案中",
						),
					},
				};
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return { id: "closing-created", url: "https://notion.so/closing-created" };
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

	const synced = await syncProjectClosingStatusToPerformanceForTest(
		"project-closed",
		notion as never,
		"automation-user",
	);
	assert.equal(synced.action, "created");
	assert.equal(synced.closingPageId, "closing-created");

	const closingCreate = creates.find((args) =>
		(args.parent as { data_source_id?: string }).data_source_id === "8d5a506b-59b8-4e50-bc77-d5412774048d"
	) as { properties: Record<string, unknown> };
	assert.ok(closingCreate, "ステータス成約同期で成約報告DBに作成する");
	assert.deepEqual(closingCreate.properties.担当営業ユーザー, {
		people: [{ id: "sales-user-1" }],
	});
	assert.deepEqual(closingCreate.properties.売上額, {
		number: 12_000_000,
	});

	const performanceUpdate = updates.find((args) =>
		Boolean((args.properties as Record<string, unknown> | undefined)?.関連成約)
	) as {
		properties: Record<string, unknown>;
	};
	assert.ok(performanceUpdate, "営業パフォーマンスDBの月次ページへ関連成約を張る");
	assert.deepEqual(performanceUpdate.properties.関連成約, {
		relation: [{ id: "closing-created" }],
	});
	const dealUpdate = updates.find((args) => args.page_id === "deal-1") as {
		properties: Record<string, unknown>;
	};
	assert.ok(dealUpdate, "関連商談を成約ステータスへ同期する");
	assert.deepEqual(dealUpdate.properties.商談ステータス, { select: { name: "成約" } });
	assert.deepEqual(dealUpdate.properties.商談結果, { select: { name: "成約" } });
	assert.deepEqual(dealUpdate.properties.関連成約, {
		relation: [{ id: "closing-created" }],
	});

	const writesBeforeSkip = updates.length + creates.length + appends.length;
	const skipped = await syncProjectClosingStatusToPerformanceForTest(
		"project-open",
		notion as never,
		"automation-user",
	);
	assert.equal(skipped.action, "skipped-not-closed");
	assert.equal(updates.length + creates.length + appends.length, writesBeforeSkip);

	const writesBeforePendingSkip = updates.length + creates.length + appends.length;
	const pending = await syncProjectClosingStatusToPerformanceForTest(
		"project-pending-close",
		notion as never,
		"automation-user",
	);
	assert.equal(pending.action, "skipped-not-closed");
	assert.equal(updates.length + creates.length + appends.length, writesBeforePendingSkip);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
