import assert from "node:assert/strict";
import { processInquiryProjectCreationForTest } from "./index";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function selectProp(value: string) {
	return { type: "select", select: value ? { name: value } : null };
}

function dateProp(value: string | null = null) {
	return { type: "date", date: value ? { start: value } : null };
}

function relationProp(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function peopleProp(ids: string[]) {
	return { type: "people", people: ids.map((id) => ({ id })) };
}

function numberProp(value: number | null = null) {
	return { type: "number", number: value };
}

function inquiryPage(projectIds: string[] = []) {
	return {
		id: "inquiry-1",
		properties: {
			件名: titleProp("問-260526-001｜④ 高圧｜木村正明｜売却"),
			担当営業ユーザー: peopleProp(["assigned-user"]),
			関連企業: relationProp(["company-1"]),
			顧客接点ログ: relationProp(["log-1"]),
			予定粗利額: numberProp(3000000),
			売買区分: selectProp("売却相談"),
			紐づき案件: relationProp(projectIds),
			ステータス: selectProp("担当確定"),
			進捗フェーズ: selectProp("担当確定"),
			案件化状態: selectProp("未案件化"),
			案件化日: dateProp(),
			案件化メモ: richTextProp(""),
			最終アクション日: dateProp(),
		},
	};
}

function projectPage(id: string) {
	return {
		id,
		properties: {
			案件名: titleProp(""),
			担当営業ユーザー: peopleProp([]),
			関連企業: relationProp([]),
			元問い合わせ: relationProp([]),
			ステータス: selectProp(""),
			獲得ソース: selectProp(""),
			顧客接点ログ: relationProp([]),
			予定粗利額: numberProp(),
			売買区分: selectProp(""),
			作成日: dateProp(),
			最終アクション日: dateProp(),
			案件詳細: richTextProp(""),
			情報ソース: richTextProp(""),
			確認待ち内容: richTextProp(""),
		},
	};
}

async function main() {
	const updates: Array<Record<string, unknown>> = [];
	const creates: Array<Record<string, unknown>> = [];
	const comments: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];

	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "inquiry-1") return inquiryPage();
				return projectPage(page_id);
			},
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return { id: "project-created", properties: {} };
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
		},
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return { results: [] };
			},
		},
		comments: {
			create: async (args: Record<string, unknown>) => {
				comments.push(args);
				return {};
			},
		},
	};

	const created = await processInquiryProjectCreationForTest(
		"inquiry-1",
		notion as never,
		"click-user",
	);

	assert.equal(created.action, "created-project");
	assert.equal(created.projectId, "project-created");
	assert.equal(creates.length, 1);
	assert.ok(queries.length >= 1);

	const projectUpdate = updates.find((update) => update.page_id === "project-created");
	assert.ok(projectUpdate);
	const projectProperties = projectUpdate.properties as Record<string, unknown>;
	assert.deepEqual(
		(projectProperties.元問い合わせ as { relation: Array<{ id: string }> }).relation.map(
			(page) => page.id,
		),
		["inquiry-1"],
	);
	assert.deepEqual(
		(projectProperties.担当営業ユーザー as { people: Array<{ id: string }> }).people.map(
			(user) => user.id,
		),
		["assigned-user"],
	);
	assert.deepEqual(
		(projectProperties.関連企業 as { relation: Array<{ id: string }> }).relation.map(
			(page) => page.id,
		),
		["company-1"],
	);
	assert.equal((projectProperties.予定粗利額 as { number: number }).number, 3000000);
	assert.equal(
		(projectProperties.売買区分 as { select: { name: string } }).select.name,
		"売却案件",
	);

	const inquiryUpdate = updates.find((update) => update.page_id === "inquiry-1");
	assert.ok(inquiryUpdate);
	const inquiryProperties = inquiryUpdate.properties as Record<string, unknown>;
	assert.deepEqual(
		(inquiryProperties.紐づき案件 as { relation: Array<{ id: string }> }).relation.map(
			(page) => page.id,
		),
		["project-created"],
	);
	assert.equal(
		(inquiryProperties.ステータス as { select: { name: string } }).select.name,
		"案件化",
	);
	assert.equal(comments.length, 1);

	updates.length = 0;
	creates.length = 0;
	comments.length = 0;
	queries.length = 0;

	const existingNotion = {
		...notion,
		pages: {
			...notion.pages,
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "inquiry-1") return inquiryPage(["project-existing"]);
				return projectPage(page_id);
			},
		},
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return { results: [projectPage("project-existing")] };
			},
		},
	};

	const skipped = await processInquiryProjectCreationForTest(
		"inquiry-1",
		existingNotion as never,
		"click-user",
	);

	assert.equal(skipped.action, "skipped-existing");
	assert.equal(skipped.projectId, "project-existing");
	assert.equal(creates.length, 0);
	const existingInquiryUpdate = updates.find((update) => update.page_id === "inquiry-1");
	assert.ok(existingInquiryUpdate);
	assert.equal(comments.length, 1);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
