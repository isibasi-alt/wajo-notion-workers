import assert from "node:assert/strict";
import { processProjectLostForTest } from "./index";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value = "") {
	return value
		? { type: "rich_text", rich_text: [{ plain_text: value }] }
		: { type: "rich_text", rich_text: [] };
}

function selectProp(value: string | null) {
	return { type: "select", select: value ? { name: value } : null };
}

function multiSelectProp(values: string[]) {
	return { type: "multi_select", multi_select: values.map((name) => ({ name })) };
}

function peopleProp(ids: string[]) {
	return { type: "people", people: ids.map((id) => ({ id })) };
}

function dateProp(value: string | null = null) {
	return { type: "date", date: value ? { start: value } : null };
}

function projectPage() {
	return {
		id: "project-1",
		properties: {
			案件名: titleProp("滋賀県250kW太陽光発電所"),
			ステータス: selectProp("📋 提案中"),
			"推奨フェーズ（活動ログ）": selectProp("提案中"),
			失注理由: multiSelectProp([]),
			失注理由メモ: richTextProp(),
			失注日: dateProp(),
			失注処理者: peopleProp([]),
			失注前フェーズ: richTextProp(),
			"退役｜失注申請状態（使用禁止）": selectProp("申請中"),
			"退役｜失注申請メモ（使用禁止）": richTextProp("old request"),
			管理アクション状態: selectProp(null),
			管理アクション日: dateProp(),
			管理アクションメモ: richTextProp(),
			最終アクション日: dateProp(),
			成約日: dateProp(),
		},
	};
}

function createNotionStub(page: Record<string, unknown>) {
	const updates: Array<Record<string, unknown>> = [];
	const comments: Array<Record<string, unknown>> = [];
	const notion = {
		pages: {
			retrieve: async () => page,
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
			create: async () => ({ id: "unused" }),
		},
		dataSources: {
			query: async () => ({ results: [] }),
		},
		comments: {
			create: async (args: Record<string, unknown>) => {
				comments.push(args);
				return {};
			},
		},
	};
	return { notion, updates, comments };
}

async function main() {
	{
		const { notion, updates, comments } = createNotionStub(projectPage());
		const result = await processProjectLostForTest(
			"project-1",
			notion as never,
			{ reason: "", memo: "", triggerUserId: "sales-1" },
		);

		assert.equal(result.action, "needs-lost-reason");
		assert.equal(updates.length, 0, "理由なしでは案件ステータスを変えない");
		assert.equal(comments.length, 1, "理由なしでも本人が分かるようにコメントは残す");
	}

	{
		const { notion, updates, comments } = createNotionStub(projectPage());
		const result = await processProjectLostForTest(
			"project-1",
			notion as never,
			{
				reason: "価格条件が合わない",
				memo: "売主希望額と買主条件が合わないため。",
				triggerUserId: "sales-1",
			},
		);

		assert.equal(result.action, "lost");
		const props = updates[0]!.properties as Record<string, unknown>;
		assert.equal(
			(props.ステータス as { select: { name: string } }).select.name,
			"❌ 失注",
		);
		assert.deepEqual(props["退役｜失注申請状態（使用禁止）"], { select: null });
		assert.deepEqual(props["退役｜失注申請メモ（使用禁止）"], { rich_text: [] });
		assert.equal("管理アクション状態" in props, false);
		assert.equal("管理アクションメモ" in props, false);
		assert.equal(comments.length, 1, "案件失注は公開通知のコメントを残す");
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
