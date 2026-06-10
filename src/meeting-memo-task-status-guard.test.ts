import assert from "node:assert/strict";
import { processMeetingMemoFormatForTest } from "./index";

function selectName(property: unknown): string {
	return (property as { select: { name: string } }).select.name;
}

async function main() {
	const originalFetch = globalThis.fetch;
	const originalOpenAiKey = process.env.OPENAI_API_KEY;
	const updates: Array<Record<string, unknown>> = [];

	process.env.OPENAI_API_KEY = "test-key";
	globalThis.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								text: "整形済み本文",
								summary: "要約",
								minutes: "議事内容",
								decisions: "決定事項",
								actionItems: "新しいアクション",
								taskStatus: "未処理",
								formatStatus: "整形済",
								memo: "",
							}),
						},
					},
				],
			}),
		}) as Response;

	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				properties: {
					ミーティング名: {
						type: "title",
						title: [{ plain_text: "関連タスクあり会議" }],
					},
					ミーティング種別: { type: "select", select: { name: "営業会議" } },
					要約: { type: "rich_text", rich_text: [{ plain_text: "既存要約".repeat(20) }] },
					議事内容: { type: "rich_text", rich_text: [{ plain_text: "既存議事内容" }] },
					決定事項: { type: "rich_text", rich_text: [{ plain_text: "既存決定事項" }] },
					アクション項目: {
						type: "rich_text",
						rich_text: [{ plain_text: "既存アクション" }],
					},
					タスク化ステータス: { type: "select", select: { name: "作成済" } },
					関連チームタスク: { type: "relation", relation: [{ id: "task-1" }] },
					メモ整形ステータス: { type: "select", select: null },
					メモ整形メモ: { type: "rich_text", rich_text: [] },
				},
			}),
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return {};
			},
		},
		blocks: {
			children: {
				list: async () => ({ results: [], has_more: false, next_cursor: null }),
			},
		},
	};

	try {
		const result = await processMeetingMemoFormatForTest(
			{ meetingPageId: "meeting-1", dryRun: false },
			notion as never,
		);
		assert.equal(result.action, "formatted");
		assert.equal(result.message.includes("タスク化ステータス: 作成済"), true);
		assert.equal(updates.length, 1);
		const props = updates[0]!.properties as Record<string, unknown>;
		assert.equal(selectName(props.タスク化ステータス), "作成済");
		assert.match(JSON.stringify(props.メモ整形メモ), /タスク化ステータス: 作成済/);
	} finally {
		globalThis.fetch = originalFetch;
		if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
		else process.env.OPENAI_API_KEY = originalOpenAiKey;
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
