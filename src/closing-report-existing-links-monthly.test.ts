import assert from "node:assert/strict";
import { processClosingReportForTest } from "./index";

const queries: Array<Record<string, unknown>> = [];
const updates: Array<Record<string, unknown>> = [];
const creates: Array<Record<string, unknown>> = [];
const appends: Array<Record<string, unknown>> = [];
const comments: Array<Record<string, unknown>> = [];

const CLOSING_REPORT_DATA_SOURCE_ID = "8d5a506b-59b8-4e50-bc77-d5412774048d";
const DEAL_DATA_SOURCE_ID = "7838db8a-907a-4c61-b062-109f8278b2c9";
const SALES_PERFORMANCE_DATA_SOURCE_ID = "e67ec5d5-90d3-4118-9788-976a6f5c94a1";

const notion = {
	dataSources: {
		query: async (args: Record<string, unknown>) => {
			queries.push(args);
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
			if (args.data_source_id === DEAL_DATA_SOURCE_ID) {
				return {
					results: [{
						id: "deal-1",
						properties: {
							商談ステータス: { type: "select", select: { name: "商談中" } },
						},
					}],
				};
			}
			if (args.data_source_id === SALES_PERFORMANCE_DATA_SOURCE_ID) {
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
			}
			return {
				results: [],
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
				成約日: { type: "date", date: null },
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
		create: async (args: Record<string, unknown>) => {
			comments.push(args);
			return {};
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
	const projectStatusUpdate = updates.find((update) => update.page_id === "project-1");
	assert.ok(projectStatusUpdate, "既存成約報告がある場合でも案件ステータスは成約へ補修する");
	assert.equal(
		((projectStatusUpdate.properties as { ステータス: { select: { name: string } } }).ステータス.select.name),
		"🏆 成約",
	);
	assert.equal(
		((projectStatusUpdate.properties as { 成約日: { date: { start: string } } }).成約日.date.start).length,
		10,
	);
	const dealStatusUpdate = updates.find((update) => update.page_id === "deal-1");
	assert.deepEqual(dealStatusUpdate, {
		page_id: "deal-1",
		properties: {
			商談ステータス: { select: { name: "成約" } },
		},
	});
	const monthlyLinkUpdate = updates.find((update) => update.page_id === "performance-1");
	assert.deepEqual(monthlyLinkUpdate, {
		page_id: "performance-1",
		properties: {
			関連成約: {
				relation: [{ id: "closing-existing" }],
			},
		},
	});
	const fanfareAppend = appends.find((append) => {
		if (append.block_id !== "closing-existing") return false;
		return JSON.stringify(append).includes("成約ファンファーレ");
	});
	assert.ok(fanfareAppend, "既存成約報告ページにも成約ファンファーレcalloutを追記する");
	const celebrationComment = comments.find((comment) =>
		JSON.stringify(comment).includes("クラッカー画面を開く")
	);
	assert.ok(celebrationComment, "案件ページにクラッカー画面リンクコメントを投稿する");
	assert.match(JSON.stringify(celebrationComment), /add=1500000/);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
