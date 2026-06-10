import assert from "node:assert/strict";
import { processInquiryEmailIntakeForTest } from "./index";

async function main() {
	const creates: Array<Record<string, unknown>> = [];
	const appends: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];

	const notion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return { results: [] };
			},
		},
		pages: {
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return { id: "inquiry-created", properties: {} };
			},
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				properties: {
					確認待ち内容: { type: "rich_text", rich_text: [] },
				},
			}),
			update: async () => ({}),
		},
		blocks: {
			children: {
				append: async (args: Record<string, unknown>) => {
					appends.push(args);
					return {};
				},
			},
		},
	};

	const result = await processInquiryEmailIntakeForTest(
		{
			subject: "太陽光発電所の売却査定について",
			from: "山田太郎 <taro@example.com>",
			to: "sales@example.jp",
			body:
				"お名前: 山田太郎\nメールアドレス: taro@example.com\n所在地: 大阪府\n販売価格: 3000万円\nFIT: 18円\n現場写真: あり",
			receivedAt: "2026-06-01T09:00:00+09:00",
			gmailMessageId: "gmail-message-1",
			messageId: "abc@example.com",
			threadId: "thread-1",
			labels: "問い合わせ",
			sourceUrl: "https://mail.google.com/mail/u/0/#inbox/thread-1",
			dryRun: false,
			linkCompany: false,
		},
		notion as never,
	);

	assert.equal(result.action, "created-inquiry");
	assert.equal(result.inquiryPageId, "inquiry-created");
	assert.equal(creates.length, 1);
	assert.ok(queries.length >= 1);
	assert.deepEqual(creates[0]!.parent, {
		data_source_id: "0a7b4703-e62b-4e0d-9376-83cd370e69cd",
	});
	assert.deepEqual(creates[0]!.template, {
		type: "template_id",
		template_id: "cda2757f-fc36-4ec8-9de6-53478196c7c5",
		timezone: "Asia/Tokyo",
	});
	assert.equal("children" in creates[0]!, false);
	assert.equal(appends.length, 1);

	console.log("gmail inquiry intake tests passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
