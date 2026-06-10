import assert from "node:assert/strict";
import {
	processDailyReportAutoTitleForTest,
	normalizeDateValueForDailyReportTitleForTest,
	buildDailyReportAutoTitleTextForTest,
	resolveDailyReportAssigneeNameForTest,
} from "./index";

function createDailyReportMock(options: {
	pageId: string;
	title?: string;
	date?: string;
	assigneeNames?: string[];
	assigneePeople?: Array<{ id: string; name?: string }>;
}) {
	return {
		id: options.pageId,
		url: `https://www.notion.so/${options.pageId}`,
		properties: {
			報告タイトル: {
				type: "title" as const,
				title: [{ plain_text: options.title ?? "2026-01-01" }],
			},
			担当者: {
				type: "people" as const,
				people: options.assigneePeople ?? [
					{ id: "user-1", name: options.assigneeNames?.[0] ?? "" },
				],
			},
			報告日: { type: "date" as const, date: { start: options.date ?? "2026-06-02" } },
		},
	};
}

async function main() {
	const updates: Array<Record<string, unknown>> = [];
	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => createDailyReportMock({
				pageId: page_id,
			title: "五十嵐 2026-06-01",
			date: "2026-06-02",
			assigneePeople: [{ id: "user-1", name: "緒方" }],
		}),
			update: async (args: { page_id: string; properties: Record<string, unknown> }) => {
				updates.push(args);
				return { id: args.page_id };
			},
		},
		dataSources: { query: async () => ({ results: [] }) },
	};

	const result = await processDailyReportAutoTitleForTest(
		{ dailyReportPageId: "daily-report-1", dryRun: false },
		notion as never,
	);
	assert.equal(result.action, "updated-title");
	assert.equal(result.title, "緒方_2026-06-02");
	assert.equal(updates.length, 1);
	const properties = updates[0]!.properties as Record<string, unknown>;
	assert.deepEqual(properties.報告タイトル, { title: [{ text: { content: "緒方_2026-06-02" } }] });

	const dryRunUpdates: Array<Record<string, unknown>> = [];
	const dryRunNotion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => createDailyReportMock({
				pageId: page_id,
			title: "五十嵐 2026-06-01",
			assigneePeople: [{ id: "user-1", name: "緒方" }],
		}),
			update: async (args: { page_id: string; properties: Record<string, unknown> }) => {
				dryRunUpdates.push(args);
				return { id: args.page_id };
			},
		},
		dataSources: { query: async () => ({ results: [] }) },
	};

	const dryRunResult = await processDailyReportAutoTitleForTest(
		{ dailyReportPageId: "daily-report-1", dryRun: true },
		dryRunNotion as never,
	);
	assert.equal(dryRunResult.action, "dry-run");
	assert.equal(dryRunResult.title, "緒方_2026-06-02");
	assert.equal(dryRunUpdates.length, 0);

	const already = await processDailyReportAutoTitleForTest(
		{ dailyReportPageId: "daily-report-1", dryRun: false },
		{
			pages: {
				retrieve: async () => createDailyReportMock({
					pageId: "daily-report-1",
					title: "緒方_2026-06-02",
					assigneePeople: [{ id: "user-1", name: "緒方" }],
				}),
				update: async () => ({ id: "daily-report-1" }),
			},
			dataSources: { query: async () => ({ results: [] }) },
		} as never,
	);
	assert.equal(already.action, "already-correct");

	const needsReview = await processDailyReportAutoTitleForTest(
		{ dailyReportPageId: "daily-report-2", dryRun: false },
		{
			pages: {
				retrieve: async () =>
					createDailyReportMock({
						pageId: "daily-report-2",
						date: "2026-06-02",
						title: "tmp",
						assigneePeople: [],
					}),
				update: async () => ({ id: "daily-report-2" }),
			},
			dataSources: { query: async () => ({ results: [] }) },
		} as never,
	);
	assert.equal(needsReview.action, "needs-review");

	const relationUpdates: Array<Record<string, unknown>> = [];
	const relationResult = await processDailyReportAutoTitleForTest(
		{ dailyReportPageId: "daily-report-3", dryRun: false },
		{
			pages: {
				retrieve: async ({ page_id }: { page_id: string }) => {
					if (page_id === "member-1") {
						return {
							id: "member-1",
							properties: {
								氏名: {
									type: "title" as const,
									title: [{ plain_text: "緒方裕一" }],
								},
							},
						};
					}
					return {
						id: "daily-report-3",
						properties: {
							報告タイトル: {
								type: "title" as const,
								title: [{ plain_text: "tmp" }],
							},
							担当者: {
								type: "relation" as const,
								relation: [{ id: "member-1" }],
							},
							報告日: {
								type: "date" as const,
								date: { start: "2026-06-03" },
							},
						},
					};
				},
				update: async (args: { page_id: string; properties: Record<string, unknown> }) => {
					relationUpdates.push(args);
					return { id: args.page_id };
				},
			},
			dataSources: { query: async () => ({ results: [] }) },
		} as never,
	);
	assert.equal(relationResult.action, "updated-title");
	assert.equal(relationResult.title, "緒方裕一_2026-06-03");
	assert.equal(relationUpdates.length, 1);

	assert.equal(
		normalizeDateValueForDailyReportTitleForTest("2026/6/2"),
		"2026-06-02",
	);
	assert.equal(buildDailyReportAutoTitleTextForTest("緒方", "2026-06-02"), "緒方_2026-06-02");
	assert.equal(
		resolveDailyReportAssigneeNameForTest([], {
			"担当者": { type: "people", people: [{ id: "user-1", name: "三好" }] },
		}),
		"三好",
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
