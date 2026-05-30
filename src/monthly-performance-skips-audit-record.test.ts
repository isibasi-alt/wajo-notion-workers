import assert from "node:assert/strict";
import { linkClosingToMonthlyPerformanceRecordForTest } from "./index";

const queries: Array<Record<string, unknown>> = [];
const updates: Array<Record<string, unknown>> = [];
const creates: Array<Record<string, unknown>> = [];

const auditPerformance = {
	id: "performance-audit",
	properties: {
		評価名: {
			type: "title",
			title: [{ plain_text: "2026年5月 石橋大右" }],
		},
		監査区分: { type: "select", select: { name: "監査除外" } },
		上司確認事項: {
			type: "rich_text",
			rich_text: [{ plain_text: "本番成約・本番評価の根拠ではないため、監査除外扱い。" }],
		},
		関連成約: {
			type: "relation",
			relation: [{ id: "closing-test" }],
		},
	},
};

const productionPerformance = {
	id: "performance-production",
	properties: {
		評価名: {
			type: "title",
			title: [{ plain_text: "2026年5月 石橋大右｜本番" }],
		},
		監査区分: { type: "select", select: { name: "通常監査" } },
		関連成約: {
			type: "relation",
			relation: [{ id: "closing-existing" }],
		},
	},
};

const notion = {
	dataSources: {
		query: async (args: Record<string, unknown>) => {
			queries.push(args);
			const pageSize = Number(args.page_size ?? 0);
			return {
				results: pageSize > 1
					? [auditPerformance, productionPerformance]
					: [auditPerformance],
			};
		},
	},
	pages: {
		update: async (args: Record<string, unknown>) => {
			updates.push(args);
			return { id: args.page_id };
		},
		retrieve: async () => ({ id: "unused" }),
		create: async (args: Record<string, unknown>) => {
			creates.push(args);
			return { id: "unexpected-create" };
		},
	},
	blocks: {
		children: {
			list: async () => ({ results: [] }),
			append: async () => ({}),
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

	assert.ok(
		queries.some((query) => Number(query.page_size ?? 0) > 1),
		"監査除外レコードを避けるため複数候補を取得する",
	);
	assert.equal(creates.length, 0, "本番用月次成績があれば新規作成しない");
	assert.deepEqual(updates, [{
		page_id: "performance-production",
		properties: {
			関連成約: {
				relation: [{ id: "closing-existing" }, { id: "closing-new" }],
			},
		},
	}]);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
