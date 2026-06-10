import assert from "node:assert/strict";
import { processClosingReportForTest } from "./index";

function currentYearMonthJST() {
	const parts = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "numeric",
	}).formatToParts(new Date());
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	if (!year || !month) throw new Error("JST year/month could not be resolved");
	return { year, month };
}

const queries: Array<Record<string, unknown>> = [];
const creates: Array<Record<string, unknown>> = [];
const updates: Array<Record<string, unknown>> = [];
const appends: Array<Record<string, unknown>> = [];

const notion = {
	dataSources: {
		query: async (args: Record<string, unknown>) => {
			queries.push(args);
			if (queries.length === 1) return { results: [] };
			return { results: [] };
		},
	},
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => ({
			id: page_id,
			properties: {
				案件名: {
					type: "title",
					title: [{ plain_text: "月次自動作成テスト案件" }],
				},
				売買区分: { type: "select", select: { name: "購入希望" } },
				対象物種別: { type: "select", select: { name: "太陽光発電所" } },
				実績粗利額: { type: "number", number: 2000000 },
				担当営業ユーザー: { type: "people", people: [{ id: "project-sales-user" }] },
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
			if ((args.parent as { data_source_id?: string }).data_source_id === "8d5a506b-59b8-4e50-bc77-d5412774048d") {
				return { id: "closing-1", url: "https://notion.so/closing-1" };
			}
			return { id: "performance-created", url: "https://notion.so/performance-created" };
		},
	},
	blocks: {
		children: {
			list: async () => ({ results: [] }),
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

async function main() {
	const result = await processClosingReportForTest(
		"project-1",
		notion as never,
		"button-click-user",
	);

	assert.equal(result.action, "created");
	assert.equal(result.closingPageId, "closing-1");

	const closingCreate = creates.find((args) =>
		(args.parent as { data_source_id?: string }).data_source_id === "8d5a506b-59b8-4e50-bc77-d5412774048d"
	) as { properties: Record<string, unknown> };
	assert.ok(closingCreate, "成約報告DBの作成が必要");
	assert.deepEqual(closingCreate.properties.担当営業ユーザー, {
		people: [{ id: "project-sales-user" }],
	});
	assert.deepEqual(closingCreate.properties.売買区分, { select: { name: "購入成約" } });

	const performanceCreate = creates.find((args) =>
		(args.parent as { data_source_id?: string }).data_source_id === "e67ec5d5-90d3-4118-9788-976a6f5c94a1"
	) as { properties: Record<string, unknown> };
	assert.ok(performanceCreate, "月次成績レコードがなければ自動作成する");
	assert.deepEqual(performanceCreate.properties.期間種別, { select: { name: "月次" } });
	assert.deepEqual(performanceCreate.properties.対象営業ユーザー, {
		people: [{ id: "project-sales-user" }],
	});
	assert.deepEqual(performanceCreate.properties.関連成約, {
		relation: [{ id: "closing-1" }],
	});
	const { year, month } = currentYearMonthJST();
	assert.match(
		JSON.stringify(performanceCreate.properties),
		new RegExp(`${year}/${month}|${year}年${month}月`),
	);
	assert.equal(appends.length, 1, "成約報告ページに月次成績反映メモを追記する");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
