import assert from "node:assert/strict";
import { linkClosingToMonthlyPerformanceRecordForTest } from "./index";

const queries: Array<Record<string, unknown>> = [];
const updates: Array<Record<string, unknown>> = [];
const appends: Array<Record<string, unknown>> = [];

const notion = {
	dataSources: {
		query: async (args: Record<string, unknown>) => {
			queries.push(args);
			return {
				results: [{
					id: "performance-1",
					properties: {
						"実績粗利額（自動）": {
							type: "rollup",
							rollup: { type: "number", number: 500000 },
						},
						粗利目標: { type: "number", number: 1000000 },
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
		update: async (args: Record<string, unknown>) => {
			updates.push(args);
			return { id: args.page_id };
		},
		retrieve: async () => ({ id: "unused" }),
		create: async () => ({ id: "unused" }),
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
};

async function main() {
	await linkClosingToMonthlyPerformanceRecordForTest(
		"closing-new",
		["sales-user-1"],
		notion as never,
		new Date("2026-05-25T00:00:00+09:00"),
		{ grossProfit: 600000, commissionAmount: 24000 },
	);

	assert.equal(queries.length, 1);
	assert.equal(
		queries[0]!.data_source_id,
		"e67ec5d5-90d3-4118-9788-976a6f5c94a1",
	);

	const filterJson = JSON.stringify(queries[0]!.filter);
	assert.match(filterJson, /対象営業ユーザー/);
	assert.match(filterJson, /sales-user-1/);
	assert.match(filterJson, /期間種別/);
	assert.match(filterJson, /月次/);
	assert.match(filterJson, /開始日/);
	assert.match(filterJson, /2026-05-01/);
	assert.match(filterJson, /2026-06-01/);

	assert.equal(updates.length, 1);
	assert.deepEqual(updates[0], {
		page_id: "performance-1",
		properties: {
			関連成約: {
				relation: [{ id: "closing-existing" }, { id: "closing-new" }],
			},
		},
	});
	assert.equal(appends.length, 1);
	const appendJson = JSON.stringify(appends[0]);
	assert.match(appendJson, /月次成績反映メモ/);
	assert.match(appendJson, /50%/);
	assert.match(appendJson, /110%/);
	assert.match(appendJson, /600,000/);
	assert.match(appendJson, /24,000/);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
