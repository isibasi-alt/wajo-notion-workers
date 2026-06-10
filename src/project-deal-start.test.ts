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
	assert.equal(createCase.queries.length, 1);
	assert.equal(createCase.creates.length, 1);
	const createdProps = createCase.creates[0]!.properties as Record<string, unknown>;
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

	const existingCase = makeNotion([dealPage("deal-existing", "フォロー中")]);

	const existing = await processProjectDealStartForTest(
		{ projectPageId: "project-1", dryRun: false },
		existingCase.notion as never,
	);

	assert.equal(existing.action, "existing");
	assert.equal(existing.dealPageId, "deal-existing");
	assert.equal(existingCase.creates.length, 0);
	assert.equal(existingCase.comments.length, 1);

	const completedOnlyCase = makeNotion([dealPage("deal-closed", "成約")]);

	const createdAfterClosed = await processProjectDealStartForTest(
		{ projectPageId: "project-1", dryRun: false },
		completedOnlyCase.notion as never,
	);

	assert.equal(createdAfterClosed.action, "created");
	assert.equal(createdAfterClosed.dealPageId, "deal-created");
	assert.equal(completedOnlyCase.creates.length, 1);

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
