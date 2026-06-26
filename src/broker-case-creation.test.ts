import assert from "node:assert/strict";
import {
	processBrokerCaseCreationForTest,
	processBrokerCustodyRegisterForTest,
} from "./index";

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

function multiSelectProp(values: string[] = []) {
	return { type: "multi_select", multi_select: values.map((name) => ({ name })) };
}

function brokerPage(overrides: Record<string, unknown> = {}) {
	return {
		id: "advisor-1",
		properties: {
			顧問名: titleProp("Codex検証用 ブローカー"),
			担当営業ユーザー: peopleProp(["sales-user-1"]),
			預かりステータス: selectProp("資料待ち"),
			預かり開始日: dateProp(),
			預かり最終アクション日: dateProp(),
			預かりメモ: richTextProp("現地写真待ち"),
			...overrides,
		},
	};
}

function projectPage(id: string) {
	return {
		id,
		properties: {
			案件名: titleProp("既存紹介案件"),
			紹介ブローカー: relationProp(["advisor-1"]),
			作成日: dateProp("2026-06-27"),
		},
	};
}

function taskPage(id: string) {
	return {
		id,
		properties: {
			タスク名: titleProp(""),
			概要: richTextProp(""),
			"説明⚠️まず入力": richTextProp(""),
			ステータス: selectProp(""),
			優先順位: selectProp(""),
			タスクタイプ: multiSelectProp(),
			期限: dateProp(),
			タスク担当者: peopleProp([]),
			担当者: peopleProp([]),
		},
	};
}

async function main() {
	const updates: Array<Record<string, unknown>> = [];
	const creates: Array<Record<string, unknown>> = [];
	const comments: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];
	const retrieved: string[] = [];
	let existingProjects: Array<Record<string, unknown>> = [];

	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				retrieved.push(page_id);
				if (page_id === "advisor-1") return brokerPage();
				if (page_id === "task-created") return taskPage("task-created");
				return projectPage(page_id);
			},
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				const parent = args.parent as { data_source_id?: string } | undefined;
				if (parent?.data_source_id === "3b44d017-81e7-82c9-9f2d-87004c53d722") {
					return { id: "task-created", properties: {} };
				}
				return { id: "project-created", properties: {} };
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id, properties: {} };
			},
		},
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return { results: existingProjects };
			},
		},
		comments: {
			create: async (args: Record<string, unknown>) => {
				comments.push(args);
				return {};
			},
		},
	};

	const dryCustody = await processBrokerCustodyRegisterForTest(
		"advisor-1",
		notion as never,
		{ dryRun: true, status: "資料待ち", memo: "現地写真依頼中" },
	);
	assert.equal(dryCustody.action, "dry-run");
	assert.equal(creates.length, 0);
	assert.equal(updates.length, 0);

	const registered = await processBrokerCustodyRegisterForTest(
		"advisor-1",
		notion as never,
		{ status: "連絡待ち", memo: "月曜に電話確認", triggerUserId: "click-user" },
	);
	assert.equal(registered.action, "registered");
	assert.equal(registered.taskPageId, "task-created");
	assert.equal(creates.length, 1, "預かり登録では追跡タスクだけ作成する");
	assert.equal(
		((creates[0]!.properties as Record<string, unknown>).タスク名 as { title: Array<unknown> }).title.length,
		1,
	);
	const advisorUpdate = updates.find((update) => update.page_id === "advisor-1");
	assert.ok(advisorUpdate);
	assert.match(JSON.stringify(advisorUpdate.properties), /連絡待ち/);
	assert.match(JSON.stringify(advisorUpdate.properties), /月曜に電話確認/);
	const taskUpdate = updates.find((update) => update.page_id === "task-created");
	assert.ok(taskUpdate);
	assert.match(JSON.stringify(taskUpdate.properties), /確認・調査/);
	assert.match(JSON.stringify(taskUpdate.properties), /click-user/);

	updates.length = 0;
	creates.length = 0;
	comments.length = 0;
	queries.length = 0;
	existingProjects = [];

	const dryCase = await processBrokerCaseCreationForTest("advisor-1", notion as never, {
		dryRun: true,
	});
	assert.equal(dryCase.action, "dry-run");
	assert.equal(creates.length, 0);
	assert.equal(updates.length, 0);
	assert.equal(queries.length, 1, "dry-runでも重複候補は確認する");

	const createdCase = await processBrokerCaseCreationForTest("advisor-1", notion as never, {
		caseMemo: "高圧発電所の売却相談",
		triggerUserId: "click-user",
	});
	assert.equal(createdCase.action, "created-project");
	assert.equal(createdCase.projectId, "project-created");
	assert.equal(creates.length, 1);
	const projectCreate = creates[0]!;
	assert.equal((projectCreate.parent as { data_source_id: string }).data_source_id, "54e869d7-ba3e-49e1-b760-af46e23499cb");
	const projectProps = projectCreate.properties as Record<string, unknown>;
	assert.match(JSON.stringify(projectProps.案件名), /\[紹介\] Codex検証用 ブローカー 起点案件/);
	assert.match(JSON.stringify(projectProps.紹介ブローカー), /advisor-1/);
	assert.match(JSON.stringify(projectProps.仕入れ元区分), /ブローカー/);
	assert.match(JSON.stringify(projectProps.獲得ソース), /紹介/);
	assert.match(JSON.stringify(projectProps.案件詳細), /高圧発電所の売却相談/);
	const brokerClearUpdate = updates.find((update) => update.page_id === "advisor-1");
	assert.ok(brokerClearUpdate);
	assert.match(JSON.stringify(brokerClearUpdate.properties), /待機なし/);
	assert.ok(comments.length >= 1);

	updates.length = 0;
	creates.length = 0;
	comments.length = 0;
	queries.length = 0;
	existingProjects = [projectPage("project-existing")];

	const duplicate = await processBrokerCaseCreationForTest("advisor-1", notion as never);
	assert.equal(duplicate.action, "skipped-existing");
	assert.equal(duplicate.projectId, "project-existing");
	assert.equal(creates.length, 0, "同日同ブローカー案件があれば新規作成しない");
	assert.ok(comments.length >= 1);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
