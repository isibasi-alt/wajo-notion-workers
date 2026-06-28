import assert from "node:assert/strict";
import {
	dailyReportWeekdayCharForTest,
	buildDailyReportCanonicalTitleForTest,
	isWeekendDailyReportForTest,
	resolveDailyReportAssigneeNameForTest,
	enforceDailyReportDisciplineForTest,
	enforceDailyReportPageForTest,
} from "./index";

type MockPage = {
	id: string;
	archived?: boolean;
	properties: Record<string, unknown>;
};

function titleProp(value: string): Record<string, unknown> {
	return { type: "title", title: [{ plain_text: value }] };
}

function dateProp(value: string): Record<string, unknown> {
	return { type: "date", date: { start: value } };
}

function peopleProp(items: Array<{ id: string; name?: string }>): Record<string, unknown> {
	return {
		type: "people",
		people: items.map((item) => ({ object: "user", id: item.id, name: item.name })),
	};
}

function createDailyReportPage(options: {
	id: string;
	title: string;
	date?: string;
	people?: Array<{ id: string; name?: string }>;
	archived?: boolean;
}): MockPage {
	const properties: Record<string, unknown> = {
		タイトル: titleProp(options.title),
	};
	if (options.date) properties["日付"] = dateProp(options.date);
	if (options.people) properties["担当営業ユーザー"] = peopleProp(options.people);
	return { id: options.id, archived: options.archived, properties };
}

/** Notion クライアントのモック。update/retrieve の呼び出しを記録する。 */
function createNotionMock(options: {
	queryPages?: MockPage[];
	retrievePage?: MockPage;
	users?: Record<string, { name?: string }>;
}) {
	const updateCalls: Array<Record<string, unknown>> = [];
	const userRetrieveCalls: string[] = [];
	const notion = {
		dataSources: {
			query: async (_args: Record<string, unknown>) => ({
				results: options.queryPages ?? [],
			}),
		},
		pages: {
			retrieve: async (_args: Record<string, unknown>) =>
				options.retrievePage ?? { id: "missing", properties: {} },
			update: async (args: Record<string, unknown>) => {
				updateCalls.push(args);
				return { id: String(args.page_id ?? "x") };
			},
			create: async () => ({ id: "created" }),
		},
		users: {
			retrieve: async (args: Record<string, unknown>) => {
				const id = String(args.user_id ?? "");
				userRetrieveCalls.push(id);
				return { id, name: options.users?.[id]?.name };
			},
		},
	};
	return { notion, updateCalls, userRetrieveCalls };
}

async function main() {
	// ⑥ 曜日変換
	assert.equal(dailyReportWeekdayCharForTest("2026-06-28"), "日", "2026-06-28 は日曜");
	assert.equal(dailyReportWeekdayCharForTest("2026-06-29"), "月", "2026-06-29 は月曜");
	assert.equal(dailyReportWeekdayCharForTest("2026-06-26"), "金", "2026-06-26 は金曜");
	assert.equal(dailyReportWeekdayCharForTest("2026-06-27"), "土", "2026-06-27 は土曜");
	// ISO日時付きでも日付部分のみで計算(TZずれ無し)
	assert.equal(
		dailyReportWeekdayCharForTest("2026-06-29T09:00:00+09:00"),
		"月",
		"日時付きでも日付のみで計算",
	);

	// 土日判定
	assert.equal(isWeekendDailyReportForTest("2026-06-28"), true, "日曜は週末");
	assert.equal(isWeekendDailyReportForTest("2026-06-27"), true, "土曜は週末");
	assert.equal(isWeekendDailyReportForTest("2026-06-29"), false, "月曜は平日");

	// canonical 題名(先頭ゼロなし・名前あり/なし)
	assert.equal(
		buildDailyReportCanonicalTitleForTest("2026-06-29", "佐伯亮太"),
		"6/29（月）佐伯亮太 日報",
	);
	assert.equal(
		buildDailyReportCanonicalTitleForTest("2026-06-01", "佐伯亮太"),
		"6/1（月）佐伯亮太 日報",
		"月日は先頭ゼロなし",
	);
	assert.equal(
		buildDailyReportCanonicalTitleForTest("2026-06-29", ""),
		"6/29（月）日報",
		"名前空なら名前部を省く",
	);

	// ⑤ 平日で名前解決 → canonical 一致(people[0].name 優先)
	{
		const page = createDailyReportPage({
			id: "p-weekday",
			title: "なにか",
			date: "2026-06-29",
			people: [{ id: "u1", name: "佐伯亮太" }],
		});
		const { notion } = createNotionMock({});
		const name = await resolveDailyReportAssigneeNameForTest(page as never, notion as never);
		assert.equal(name, "佐伯亮太", "people[0].name から解決");
		assert.equal(
			buildDailyReportCanonicalTitleForTest("2026-06-29", name),
			"6/29（月）佐伯亮太 日報",
		);
	}

	// 名前が無く ID のみ → users.retrieve で補完
	{
		const page = createDailyReportPage({
			id: "p-id-only",
			title: "なにか",
			date: "2026-06-29",
			people: [{ id: "u2" }],
		});
		const { notion, userRetrieveCalls } = createNotionMock({
			users: { u2: { name: "田中花子" } },
		});
		const name = await resolveDailyReportAssigneeNameForTest(page as never, notion as never);
		assert.equal(name, "田中花子", "users.retrieve で補完");
		assert.deepEqual(userRetrieveCalls, ["u2"]);
	}

	// ① 汚い題名(平日) → updated-title で上書き、update が呼ばれる
	{
		const page = createDailyReportPage({
			id: "p-dirty",
			title: "6/29（月）佐伯亮太 日報（ワニポ出力・Discover材料から）",
			date: "2026-06-29",
			people: [{ id: "u1", name: "佐伯亮太" }],
		});
		const { notion, updateCalls } = createNotionMock({});
		const sample = await enforceDailyReportPageForTest(page as never, notion as never, false);
		assert.equal(sample.action, "updated-title");
		assert.equal(sample.after, "6/29（月）佐伯亮太 日報");
		assert.equal(updateCalls.length, 1, "update が1回呼ばれる");
		assert.equal(updateCalls[0].page_id, "p-dirty");
		const props = updateCalls[0].properties as Record<string, unknown>;
		assert.ok(props["タイトル"], "タイトルプロパティを更新");
	}

	// ② 既に規定形 → already-correct・update 呼ばれない
	{
		const page = createDailyReportPage({
			id: "p-correct",
			title: "6/29（月）佐伯亮太 日報",
			date: "2026-06-29",
			people: [{ id: "u1", name: "佐伯亮太" }],
		});
		const { notion, updateCalls } = createNotionMock({});
		const sample = await enforceDailyReportPageForTest(page as never, notion as never, false);
		assert.equal(sample.action, "already-correct");
		assert.equal(updateCalls.length, 0, "規定形なら update 呼ばれない");
	}

	// ③ 土日 + dryRun=false → pages.update({archived:true}) 呼ばれ archived
	{
		const page = createDailyReportPage({
			id: "p-weekend",
			title: "6/28（日）佐伯亮太 日報",
			date: "2026-06-28",
			people: [{ id: "u1", name: "佐伯亮太" }],
		});
		const { notion, updateCalls } = createNotionMock({});
		const sample = await enforceDailyReportPageForTest(page as never, notion as never, false);
		assert.equal(sample.action, "archived");
		assert.equal(updateCalls.length, 1, "archive で update 1回");
		assert.equal(updateCalls[0].page_id, "p-weekend");
		assert.equal(updateCalls[0].archived, true, "archived:true で送る");
	}

	// ④ 土日 + dryRun=true → update 呼ばれず samples に載る
	{
		const page = createDailyReportPage({
			id: "p-weekend-dry",
			title: "6/28（日）佐伯亮太 日報",
			date: "2026-06-28",
			people: [{ id: "u1", name: "佐伯亮太" }],
		});
		const { notion, updateCalls } = createNotionMock({ queryPages: [page] });
		const sample = await enforceDailyReportPageForTest(page as never, notion as never, true);
		assert.equal(sample.action, "archived");
		assert.equal(updateCalls.length, 0, "dryRun では update 呼ばれない");

		// バルクの dryRun でも update 無し・samples に載る
		const { notion: bulkNotion, updateCalls: bulkUpdates } = createNotionMock({
			queryPages: [page],
		});
		const result = await enforceDailyReportDisciplineForTest(
			{ dryRun: true },
			bulkNotion as never,
		);
		assert.equal(result.dryRun, true);
		assert.equal(result.checked, 1);
		assert.equal(result.archived, 1);
		assert.equal(bulkUpdates.length, 0, "バルク dryRun でも書き込まない");
		assert.equal(result.samples.length, 1);
		assert.equal(result.samples[0].pageId, "p-weekend-dry");
	}

	// 既にアーカイブ済みの土日 → already-archived・update 呼ばれない
	{
		const page = createDailyReportPage({
			id: "p-already",
			title: "6/28（日）佐伯亮太 日報",
			date: "2026-06-28",
			archived: true,
		});
		const { notion, updateCalls } = createNotionMock({});
		const sample = await enforceDailyReportPageForTest(page as never, notion as never, false);
		assert.equal(sample.action, "already-archived");
		assert.equal(updateCalls.length, 0);
	}

	// 日付なし → skipped
	{
		const page = createDailyReportPage({ id: "p-nodate", title: "なにか" });
		const { notion, updateCalls } = createNotionMock({});
		const sample = await enforceDailyReportPageForTest(page as never, notion as never, false);
		assert.equal(sample.action, "skipped");
		assert.equal(updateCalls.length, 0);
	}

	// テスト題名 → skipped
	{
		const page = createDailyReportPage({
			id: "p-test",
			title: "テスト日報",
			date: "2026-06-29",
		});
		const { notion, updateCalls } = createNotionMock({});
		const sample = await enforceDailyReportPageForTest(page as never, notion as never, false);
		assert.equal(sample.action, "skipped");
		assert.equal(updateCalls.length, 0);
	}

	console.log("daily-report-discipline.test.ts: all assertions passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
