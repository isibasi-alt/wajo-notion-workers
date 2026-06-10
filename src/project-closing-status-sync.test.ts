import assert from "node:assert/strict";
import { syncProjectClosingStatusToPerformanceForTest } from "./index";

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
				if (queries.length === 1) return { results: [] };
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
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				properties: {
					案件名: title("ステータス同期テスト案件"),
					売買区分: select("売却案件"),
					対象物種別: select("土地"),
					実績粗利額: number(3_000_000),
					担当営業ユーザー: people(["sales-user-1"]),
					仕入れ担当: people([]),
					関連企業: relation(["company-1"]),
					ステータス: select(page_id === "project-closed" ? "🏆 成約" : "📋 提案中"),
				},
			}),
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

	const performanceUpdate = updates.find((args) =>
		Boolean((args.properties as Record<string, unknown> | undefined)?.関連成約)
	) as {
		properties: Record<string, unknown>;
	};
	assert.ok(performanceUpdate, "営業パフォーマンスDBの月次ページへ関連成約を張る");
	assert.deepEqual(performanceUpdate.properties.関連成約, {
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
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
