import assert from "node:assert/strict";
import { processProjectDealStartForTest } from "./index";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function selectProp(value: string) {
	return { type: "select", select: { name: value } };
}

function relationProp(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function peopleProp(ids: string[]) {
	return { type: "people", people: ids.map((id) => ({ id })) };
}

function projectPage() {
	return {
		id: "project-1",
		url: "https://www.notion.so/project-1",
		properties: {
			案件名: titleProp("湖南市250kW 太陽光案件"),
			関連企業: relationProp(["company-1"]),
			担当営業ユーザー: peopleProp(["user-1"]),
			資料作成メモ: richTextProp(""),
		},
	};
}

function dealPage(id: string, status: string) {
	return {
		id,
		url: `https://www.notion.so/${id}`,
		properties: {
			商談名: titleProp(`既存商談 ${id}`),
			商談ステータス: selectProp(status),
			関連案件: relationProp(["project-1"]),
		},
	};
}

function makeNotion(existingDeals: Array<Record<string, unknown>> = []) {
	const creates: Array<Record<string, unknown>> = [];
	const comments: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];
	const notion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return { results: existingDeals };
			},
		},
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "company-1") {
					return {
						id: "company-1",
						properties: { 企業名: titleProp("株式会社テスト商事") },
					};
				}
				assert.equal(page_id, "project-1");
				return projectPage();
			},
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return {
					id: "deal-created",
					url: "https://www.notion.so/deal-created",
					properties: {},
				};
			},
			update: async () => {
				throw new Error("project page should not be updated");
			},
		},
		comments: {
			create: async (args: Record<string, unknown>) => {
				comments.push(args);
				return {};
			},
		},
	};
	return { notion, creates, comments, queries };
}

async function main() {
	const createCase = makeNotion();

	const created = await processProjectDealStartForTest(
		{ projectPageId: "project-1", dryRun: false },
		createCase.notion as never,
	);

	assert.equal(created.action, "created");
	assert.equal(created.dealPageId, "deal-created");
	assert.equal(createCase.queries.length, 0);
	assert.equal(createCase.creates.length, 1);
	const createdProps = createCase.creates[0]!.properties as Record<string, unknown>;
	// 商談名＝「案件名｜YYYY-MM-DD 相手名」（相手情報は関連企業名フォールバック）
	const createdDealName = (
		(createdProps.商談名 as { title: Array<{ text: { content: string } }> }).title[0]!
	).text.content;
	assert.match(
		createdDealName,
		/^湖南市250kW 太陽光案件｜\d{4}-\d{2}-\d{2} 株式会社テスト商事$/,
	);
	assert.deepEqual(
		(createdProps.関連案件 as { relation: Array<{ id: string }> }).relation,
		[{ id: "project-1" }],
	);
	assert.deepEqual(
		(createdProps.関連企業 as { relation: Array<{ id: string }> }).relation,
		[{ id: "company-1" }],
	);
	assert.deepEqual(
		(createdProps.担当営業ユーザー as { people: Array<{ id: string }> }).people,
		[{ id: "user-1" }],
	);
	assert.equal(
		(createdProps.商談ステータス as { select: { name: string } }).select.name,
		"準備中",
	);
	assert.equal(createCase.comments.length, 1);

	// ワンショット仕様：進行中の商談があっても、押すたびに毎回新規の商談を作成する。
	const existingCase = makeNotion([dealPage("deal-existing", "フォロー中")]);

	const existing = await processProjectDealStartForTest(
		{ projectPageId: "project-1", dryRun: false },
		existingCase.notion as never,
	);

	assert.equal(existing.action, "created");
	assert.equal(existing.dealPageId, "deal-created");
	assert.equal(existingCase.creates.length, 1);
	assert.equal(existingCase.comments.length, 1);

	const completedOnlyCase = makeNotion([dealPage("deal-closed", "成約")]);

	const createdAfterClosed = await processProjectDealStartForTest(
		{ projectPageId: "project-1", dryRun: false },
		completedOnlyCase.notion as never,
	);

	assert.equal(createdAfterClosed.action, "created");
	assert.equal(createdAfterClosed.dealPageId, "deal-created");
	assert.equal(completedOnlyCase.creates.length, 1);

	// 案件名昇格：暫定名（問-…）の案件は、商談ボタン実行時に案件名＝会社名へ昇格する。
	const promoUpdates: Array<Record<string, unknown>> = [];
	const promoCreates: Array<Record<string, unknown>> = [];
	const promoNotion = {
		dataSources: { query: async () => ({ results: [] }) },
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "company-1") {
					return {
						id: "company-1",
						properties: { 企業名: titleProp("株式会社テスト商事") },
					};
				}
				const page = projectPage();
				(page.properties as Record<string, unknown>).案件名 = titleProp("問-260514-001");
				return page;
			},
			create: async (args: Record<string, unknown>) => {
				promoCreates.push(args);
				return { id: "deal-created", url: "https://www.notion.so/deal-created", properties: {} };
			},
			update: async (args: Record<string, unknown>) => {
				promoUpdates.push(args);
				return {};
			},
		},
		comments: { create: async () => ({}) },
	};
	const promoted = await processProjectDealStartForTest(
		{ projectPageId: "project-1", dryRun: false },
		promoNotion as never,
	);
	assert.equal(promoted.action, "created");
	assert.equal(promoUpdates.length, 1);
	assert.ok(JSON.stringify(promoUpdates[0]).includes("株式会社テスト商事"));
	const promoDealName = (
		((promoCreates[0]!.properties as Record<string, unknown>).商談名 as {
			title: Array<{ text: { content: string } }>;
		}).title[0]!
	).text.content;
	assert.match(promoDealName, /^株式会社テスト商事｜\d{4}-\d{2}-\d{2}$/);

	// ステータス自動前進：商談作成で「🔴 情報収集中」→「📋 提案中」へ自動更新（2026-07-17 大ちゃん決定）。
	function statusNotion(status: string) {
		const updates: Array<Record<string, unknown>> = [];
		const notion = {
			dataSources: { query: async () => ({ results: [] }) },
			pages: {
				retrieve: async ({ page_id }: { page_id: string }) => {
					if (page_id === "company-1") {
						return {
							id: "company-1",
							properties: { 企業名: titleProp("株式会社テスト商事") },
						};
					}
					const page = projectPage();
					(page.properties as Record<string, unknown>).ステータス = selectProp(status);
					return page;
				},
				create: async () => ({
					id: "deal-created",
					url: "https://www.notion.so/deal-created",
					properties: {},
				}),
				update: async (args: Record<string, unknown>) => {
					updates.push(args);
					return {};
				},
			},
			comments: { create: async () => ({}) },
		};
		return { notion, updates };
	}

	const advanceCase = statusNotion("🔴 情報収集中");
	const advanced = await processProjectDealStartForTest(
		{ projectPageId: "project-1", dryRun: false },
		advanceCase.notion as never,
	);
	assert.equal(advanced.action, "created");
	assert.equal(advanceCase.updates.length, 1);
	assert.deepEqual(
		(advanceCase.updates[0]!.properties as Record<string, unknown>).ステータス,
		{ select: { name: "📋 提案中" } },
	);
	assert.match(advanced.message, /提案中/);

	// 成約・失注の案件は商談を作っても格下げしない。
	const closedCase = statusNotion("🏆 成約");
	const closed = await processProjectDealStartForTest(
		{ projectPageId: "project-1", dryRun: false },
		closedCase.notion as never,
	);
	assert.equal(closed.action, "created");
	assert.equal(closedCase.updates.length, 0);
	assert.doesNotMatch(closed.message, /提案中/);

	const dryRunCase = makeNotion();

	const dryRun = await processProjectDealStartForTest(
		{ projectPageId: "project-1", dryRun: true },
		dryRunCase.notion as never,
	);

	assert.equal(dryRun.action, "dry-run");
	assert.equal(dryRun.dealPageId, null);
	assert.equal(dryRunCase.creates.length, 0);
	assert.equal(dryRunCase.comments.length, 0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
