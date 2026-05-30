import assert from "node:assert/strict";
import { processInquiryAssignOwnerForTest } from "./index";

function inquiryPage(assignedUserIds: string[] = []) {
	return {
		id: "inquiry-1",
		properties: {
			件名: {
				type: "title",
				title: [{ plain_text: "木村正明さん 太陽光発電所 売却相談" }],
			},
			担当営業ユーザー: {
				type: "people",
				people: assignedUserIds.map((id) => ({ id })),
			},
			ステータス: { type: "select", select: { name: "未対応" } },
			進捗フェーズ: { type: "select", select: { name: "未対応" } },
			最終アクション日: { type: "date", date: null },
		},
	};
}

async function main() {
	const updates: Array<Record<string, unknown>> = [];
	const comments: Array<Record<string, unknown>> = [];
	const notion = {
		pages: {
			retrieve: async () => inquiryPage(),
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

	const assigned = await processInquiryAssignOwnerForTest(
		"inquiry-1",
		"trigger-user",
		notion as never,
	);

	assert.equal(assigned.action, "assigned");
	assert.equal(updates.length, 1);
	assert.deepEqual(
		((updates[0]!.properties as Record<string, unknown>).担当営業ユーザー as { people: Array<{ id: string }> })
			.people.map((user) => user.id),
		["trigger-user"],
	);
	assert.equal(
		((updates[0]!.properties as Record<string, unknown>).ステータス as { select: { name: string } }).select.name,
		"担当確定",
	);
	assert.equal(comments.length, 1);

	updates.length = 0;
	comments.length = 0;
	const occupiedNotion = {
		...notion,
		pages: {
			...notion.pages,
			retrieve: async () => inquiryPage(["existing-owner"]),
		},
	};

	const blocked = await processInquiryAssignOwnerForTest(
		"inquiry-1",
		"trigger-user",
		occupiedNotion as never,
	);

	assert.equal(blocked.action, "already-assigned");
	assert.equal(updates.length, 0);
	assert.equal(comments.length, 1);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
