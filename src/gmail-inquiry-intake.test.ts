import assert from "node:assert/strict";
import {
	processGmailInquiryInboxForTest,
	processInquiryEmailIntakeForTest,
} from "./index";

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

	const duplicateContactQueries: Array<Record<string, unknown>> = [];
	const duplicateContactCreates: Array<Record<string, unknown>> = [];
	const duplicateContactNotion = {
		...notion,
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				duplicateContactQueries.push(args);
				const filter = args.filter as Record<string, unknown> | undefined;
				const serialized = JSON.stringify(filter ?? {});
				if (
					serialized.includes("メールアドレス") &&
					serialized.includes("yeti4180@gmail.com")
				) {
					return {
						results: [
							{
								id: "existing-kamata",
								properties: {
									件名: {
										type: "title",
										title: [{ plain_text: "問-260612-002｜売｜鎌田慎司｜蓄電池｜バ｜⚠" }],
									},
									メールアドレス: { type: "email", email: "yeti4180@gmail.com" },
									電話番号: { type: "phone_number", phone_number: "08080773584" },
									お名前: {
										type: "rich_text",
										rich_text: [{ plain_text: "鎌田慎司" }],
									},
									受信日時: {
										type: "date",
										date: { start: "2026-06-12T05:05:00.000Z" },
									},
								},
							},
						],
					};
				}
				return { results: [] };
			},
		},
		pages: {
			...notion.pages,
			create: async (args: Record<string, unknown>) => {
				duplicateContactCreates.push(args);
				return { id: "should-not-create", properties: {} };
			},
		},
	};
	const duplicateContactResult = await processInquiryEmailIntakeForTest(
		{
			subject: "Re: お問い合わせありがとうございます",
			from: "イエティシンジ <yeti4180@gmail.com>",
			to: "farm@wajo-holdings.jp",
			body:
				"電話の前に、こちらの条件で簡易査定をお願いできますでしょうか？\nお名前: 鎌田慎司\nメールアドレス: yeti4180@gmail.com\n電話番号: 08080773584",
			receivedAt: "2026-06-12T14:08:00+09:00",
			gmailMessageId: "gmail-reply-different-id",
			messageId: "reply-different-message-id@example.com",
			threadId: "different-thread",
			labels: "問い合わせ",
			sourceUrl: "https://mail.google.com/mail/u/0/#inbox/gmail-reply-different-id",
			dryRun: false,
			linkCompany: false,
		},
		duplicateContactNotion as never,
	);

	assert.equal(duplicateContactResult.action, "skipped-existing");
	assert.equal(duplicateContactResult.inquiryPageId, "existing-kamata");
	assert.equal(duplicateContactCreates.length, 0);
	assert.ok(
		duplicateContactQueries.some((args) =>
			JSON.stringify(args.filter ?? {}).includes("メールアドレス"),
		),
	);

	const gmailCreates: Array<Record<string, unknown>> = [];
	const modifications: Array<Record<string, unknown>> = [];
	const gmailNotion = {
		...notion,
		pages: {
			...notion.pages,
			create: async (args: Record<string, unknown>) => {
				gmailCreates.push(args);
				return { id: "gmail-inquiry-created", properties: {} };
			},
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				properties: {
					確認待ち内容: { type: "rich_text", rich_text: [] },
				},
			}),
		},
	};
	const gmail = {
		listLabels: async () => [
			{ id: "label-source", name: "問い合わせ" },
			{ id: "label-done", name: "INQUIRY_DONE" },
		],
		createLabel: async (name: string) => ({ id: `label-${name}`, name }),
		listMessages: async (query: string, limit: number) => {
			assert.equal(query, "label:問い合わせ newer_than:7d -label:INQUIRY_DONE");
			assert.equal(limit, 10);
			return [{ id: "gmail-direct-1" }];
		},
		getMessage: async () => ({
			id: "gmail-direct-1",
			threadId: "thread-direct-1",
			internalDate: String(Date.parse("2026-06-01T10:00:00+09:00")),
			labelIds: ["label-source"],
			payload: {
				headers: [
					{ name: "Subject", value: "太陽光発電所の売却査定について" },
					{ name: "From", value: "山田太郎 <taro2@example.com>" },
					{ name: "To", value: "sales@example.jp" },
					{ name: "Message-ID", value: "<direct@example.com>" },
				],
				body: {
					data: Buffer.from(
						"お名前: 山田太郎\nメールアドレス: taro2@example.com\n所在地: 大阪府\n販売価格: 3000万円\nFIT: 18円\n現場写真: あり",
						"utf8",
					).toString("base64url"),
				},
			},
		}),
		modifyMessage: async (id: string, input: Record<string, unknown>) => {
			modifications.push({ id, input });
		},
	};

	const gmailResult = await processGmailInquiryInboxForTest(
		{
			dryRun: false,
			limit: 10,
			query: "",
			sourceLabelName: "",
			doneLabelName: "",
			removeSourceLabel: true,
			linkCompany: false,
		},
		gmailNotion as never,
		gmail,
	);

	assert.equal(gmailResult.action, "processed");
	assert.equal(gmailResult.checked, 1);
	assert.equal(gmailResult.created, 1);
	assert.equal(gmailResult.labelled, 1);
	assert.equal(gmailCreates.length, 1);
	assert.deepEqual(modifications, [
		{
			id: "gmail-direct-1",
			input: {
				addLabelIds: ["label-done"],
				removeLabelIds: ["label-source"],
			},
		},
	]);

	console.log("gmail inquiry intake tests passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
