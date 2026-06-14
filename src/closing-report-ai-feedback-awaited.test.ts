import assert from "node:assert/strict";
import { processClosingReportForTest } from "./index";

const updates: Array<Record<string, unknown>> = [];
const creates: Array<Record<string, unknown>> = [];

const notion = {
	dataSources: {
		query: async () => ({ results: [] }),
	},
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => {
			if (page_id === "closing-1") {
				return {
					id: "closing-1",
					properties: {
						勝因: { type: "rich_text", rich_text: [] },
						反省点: { type: "rich_text", rich_text: [] },
						次に活かす学び: { type: "rich_text", rich_text: [] },
						AI処理状態: { type: "select", select: { name: "処理中" } },
						ナレッジ化候補: { type: "select", select: null },
						ナレッジ化メモ: { type: "rich_text", rich_text: [] },
					},
				};
			}
			return {
				id: page_id,
				properties: {
					案件名: {
						type: "title",
						title: [{ plain_text: "AI待機テスト案件" }],
					},
					売買区分: { type: "select", select: { name: "売却案件" } },
					対象物種別: { type: "select", select: { name: "土地" } },
					実績粗利額: { type: "number", number: 1230000 },
					担当営業ユーザー: { type: "people", people: [{ id: "sales-user" }] },
					仕入れ担当: { type: "people", people: [] },
					関連企業: { type: "relation", relation: [] },
					ステータス: { type: "select", select: { name: "📋 提案中" } },
					成約日: { type: "date", date: null },
					案件詳細: { type: "rich_text", rich_text: [{ plain_text: "紹介経由で条件調整が早かった。" }] },
					確認待ち内容: { type: "rich_text", rich_text: [] },
				},
			};
		},
		update: async (args: Record<string, unknown>) => {
			updates.push(args);
			return { id: args.page_id };
		},
		create: async (args: Record<string, unknown>) => {
			creates.push(args);
			return {
				id: "closing-1",
				url: "https://notion.so/closing-1",
				properties: {
					勝因: { type: "rich_text", rich_text: [] },
					反省点: { type: "rich_text", rich_text: [] },
					次に活かす学び: { type: "rich_text", rich_text: [] },
					AI処理状態: { type: "select", select: { name: "処理中" } },
					ナレッジ化候補: { type: "select", select: null },
					ナレッジ化メモ: { type: "rich_text", rich_text: [] },
				},
			};
		},
	},
	comments: {
		create: async () => ({}),
	},
};

async function main() {
	const originalFetch = globalThis.fetch;
	const originalApiKey = process.env.OPENAI_API_KEY;
	process.env.OPENAI_API_KEY = "test-key";
	globalThis.fetch = (async () => {
		await new Promise((resolve) => setTimeout(resolve, 20));
		return {
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								勝因: "初動が早く条件整理が明確だった。",
								反省点: "関連企業の入力を先に揃えるべきだった。",
								"次に活かす学び": "成約前に根拠情報を案件側へ集約する。",
								ナレッジ化候補: "候補",
								ナレッジ化メモ: "初動整理が有効な事例",
							}),
						},
					},
				],
			}),
		} as Response;
	}) as typeof fetch;

	try {
		const result = await processClosingReportForTest(
			"project-1",
			notion as never,
			"trigger-user",
		);

		assert.equal(result.action, "created");
		assert.equal(result.closingPageId, "closing-1");
		assert.ok(creates.length > 0, "成約報告が作成されている必要がある");

		const feedbackUpdate = updates.find((update) => {
			if (update.page_id !== "closing-1") return false;
			const properties = update.properties as Record<string, unknown>;
			return properties.AI処理状態 !== undefined && properties.勝因 !== undefined;
		}) as { properties: Record<string, unknown> } | undefined;

		assert.ok(feedbackUpdate, "成約報告の戻り前にAIフィードバック更新が完了している必要がある");
		assert.deepEqual(feedbackUpdate.properties.AI処理状態, {
			select: { name: "処理済" },
		});
		assert.match(JSON.stringify(feedbackUpdate.properties), /初動が早く条件整理が明確だった/);
		assert.match(JSON.stringify(feedbackUpdate.properties), /初動整理が有効な事例/);
	} finally {
		if (originalApiKey === undefined) {
			delete process.env.OPENAI_API_KEY;
		} else {
			process.env.OPENAI_API_KEY = originalApiKey;
		}
		globalThis.fetch = originalFetch;
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
