import assert from "node:assert/strict";
import {
	approveProjectLostRequestForTest,
	processInquiryLostForTest,
	processProjectLostRequestForTest,
	rejectProjectLostRequestForTest,
} from "./index";

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

function inquiryPage() {
	return {
		id: "inquiry-1",
		properties: {
			件名: titleProp("問-260531-001｜売却相談｜太陽光"),
			ステータス: selectProp("対応中"),
			"問い合わせフェーズ（推奨）": selectProp("追客中"),
			失注理由: multiSelectProp([]),
			失注理由メモ: richTextProp(),
			失注日: dateProp(),
			失注処理者: peopleProp([]),
			失注前フェーズ: richTextProp(),
			失注ログ: richTextProp(),
			最終アクション日: dateProp(),
		},
	};
}

function projectPage(status = "📋 提案中", lostRequestStatus: string | null = null) {
	return {
		id: "project-1",
		properties: {
			案件名: titleProp("滋賀県250kW太陽光発電所"),
			ステータス: selectProp(status),
			"推奨フェーズ（活動ログ）": selectProp("提案中"),
			失注理由: multiSelectProp([]),
			失注理由メモ: richTextProp(),
			失注日: dateProp(),
			失注処理者: peopleProp([]),
			失注前フェーズ: richTextProp(),
			失注申請状態: selectProp(lostRequestStatus),
			失注申請メモ: richTextProp(),
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
		const { notion, updates, comments } = createNotionStub(inquiryPage());
		const result = await processInquiryLostForTest(
			"inquiry-1",
			notion as never,
			{ reason: "", memo: "", triggerUserId: "user-1" },
		);

		assert.equal(result.action, "needs-lost-reason");
		assert.equal(updates.length, 0, "理由なしでは問い合わせステータスを変えない");
		assert.equal(comments.length, 1, "理由なしでも本人が分かるようにコメントは残す");
	}

	{
		const { notion, updates, comments } = createNotionStub(inquiryPage());
		const result = await processInquiryLostForTest(
			"inquiry-1",
			notion as never,
			{
				reason: "対象外案件",
				memo: "営業対象外の問い合わせだったため。",
				triggerUserId: "user-1",
			},
		);

		assert.equal(result.action, "lost");
		assert.equal(
			((updates[0]!.properties as Record<string, unknown>).ステータス as { select: { name: string } }).select.name,
			"失注",
		);
		assert.deepEqual(
			((updates[0]!.properties as Record<string, unknown>).失注理由 as { multi_select: Array<{ name: string }> })
				.multi_select.map((item) => item.name),
			["対象外案件"],
		);
		assert.equal(comments.length, 1, "問い合わせ失注は監査通知を残す");
	}

	{
		const { notion, updates, comments } = createNotionStub(projectPage());
		const result = await processProjectLostRequestForTest(
			"project-1",
			notion as never,
			{
				reason: "価格条件が合わない",
				memo: "売主希望額と買主条件が合わないため。",
				triggerUserId: "user-1",
			},
		);

		assert.equal(result.action, "requested");
		assert.equal(
			((updates[0]!.properties as Record<string, unknown>).ステータス as { select: { name: string } }).select.name,
			"失注申請中",
		);
		assert.equal(
			((updates[0]!.properties as Record<string, unknown>).失注申請状態 as { select: { name: string } }).select.name,
			"申請中",
		);
		assert.notEqual(
			((updates[0]!.properties as Record<string, unknown>).ステータス as { select: { name: string } }).select.name,
			"❌ 失注",
		);
		assert.equal(comments.length, 1, "案件失注申請は全員通知のコメントを残す");
	}

	{
		const { notion, updates, comments } = createNotionStub(
			projectPage("失注申請中", "申請中"),
		);
		const result = await approveProjectLostRequestForTest(
			"project-1",
			notion as never,
			{ memo: "マネージャー確認済み。", triggerUserId: "manager-1" },
		);

		assert.equal(result.action, "approved");
		assert.equal(
			((updates[0]!.properties as Record<string, unknown>).ステータス as { select: { name: string } }).select.name,
			"❌ 失注",
		);
		assert.equal(
			((updates[0]!.properties as Record<string, unknown>).失注申請状態 as { select: { name: string } }).select.name,
			"承認済",
		);
		assert.equal(comments.length, 1, "案件失注承認は全員通知のコメントを残す");
	}

	{
		const { notion, updates, comments } = createNotionStub(
			projectPage("失注申請中", "申請中"),
		);
		const result = await rejectProjectLostRequestForTest(
			"project-1",
			notion as never,
			{ memo: "再提案余地あり。", triggerUserId: "manager-1" },
		);

		assert.equal(result.action, "rejected");
		assert.equal(
			((updates[0]!.properties as Record<string, unknown>).ステータス as { select: { name: string } }).select.name,
			"⏳ 確認待ち",
		);
		assert.equal(
			((updates[0]!.properties as Record<string, unknown>).失注申請状態 as { select: { name: string } }).select.name,
			"差し戻し",
		);
		assert.equal(comments.length, 1, "案件失注差し戻しは全員通知のコメントを残す");
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
