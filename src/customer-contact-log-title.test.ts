import assert from "node:assert/strict";
import {
	buildActivityLogFromContactLogForTest,
	createCustomerContactLogForTest,
} from "./index";

const creates: Array<Record<string, unknown>> = [];

const notion = {
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => ({
			id: page_id,
			url: `https://notion.so/${page_id}`,
			properties: {
				成約名: {
					type: "title",
					title: [{ plain_text: "滋賀県250kW太陽光発電所｜成約報告" }],
				},
				担当営業ユーザー: {
					type: "people",
					people: [{ id: "sales-1", name: "石橋大右" }],
				},
				関連案件: { type: "relation", relation: [{ id: "project-1" }] },
				関連企業: { type: "relation", relation: [{ id: "company-1" }] },
			},
		}),
		create: async (args: Record<string, unknown>) => {
			creates.push(args);
			return { id: "contact-log-1" };
		},
		update: async () => ({ id: "unused" }),
	},
	dataSources: {
		query: async () => ({ results: [] }),
	},
};

async function main() {
	const result = await createCustomerContactLogForTest(
		{
			sourcePageId: "closing-1",
			sourceType: "成約",
			activityType: "電話",
			activityContent: "確定条件を共有",
			nextAction: "請求書の確認",
			occurredAt: "2026-05-26",
		},
		notion as never,
	);

	assert.equal(result.action, "created-log");
	const properties = creates[0]!.properties as Record<string, unknown>;
	const expectedTitle = "2026-05-26｜電話｜確定条件を共有";

	assert.equal(
		((properties.接点タイトル as { title: Array<{ text: { content: string } }> }).title[0]!.text.content),
		expectedTitle,
	);
	assert.equal(
		((properties.活動ログ as { rich_text: Array<{ text: { content: string } }> }).rich_text[0]!.text.content),
		expectedTitle,
	);
	assert.equal(
		((properties.活動表示 as { rich_text: Array<{ text: { content: string } }> }).rich_text[0]!.text.content),
		expectedTitle,
	);
	assert.equal(properties.活動種別, undefined, "顧客接点ログDBに存在しない 活動種別 select は書かない");
	assert.deepEqual(
		((properties["主権者と活動種別"] as { multi_select: Array<{ name: string }> }).multi_select).map(
			(option) => option.name,
		),
		["電話"],
	);
	assert.deepEqual(
		((properties.担当営業ユーザー as { people: Array<{ id: string }> }).people).map((user) => user.id),
		["sales-1"],
	);
	assert.deepEqual(
		((properties.関連成約 as { relation: Array<{ id: string }> }).relation).map((page) => page.id),
		["closing-1"],
	);
	assert.deepEqual(
		((properties.関連案件 as { relation: Array<{ id: string }> }).relation).map((page) => page.id),
		["project-1"],
	);
	assert.deepEqual(
		((properties.関連企業 as { relation: Array<{ id: string }> }).relation).map((page) => page.id),
		["company-1"],
	);

	const updates: Array<Record<string, unknown>> = [];
	const inquiryNotion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				url: `https://notion.so/${page_id}`,
				properties: {
					件名: {
						type: "title",
						title: [{ plain_text: "問-260530-001｜太陽光｜売却" }],
					},
					ステータス: { type: "select", select: { name: "未対応" } },
					担当営業ユーザー: { type: "people", people: [{ id: "sales-1" }] },
					"📅 最終連絡日": { type: "date", date: null },
				},
			}),
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return { id: "contact-log-2" };
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
		},
		dataSources: {
			query: async () => ({ results: [] }),
		},
	};

	await createCustomerContactLogForTest(
		{
			sourcePageId: "inquiry-1",
			sourceType: "問い合わせ",
			activityType: "電話",
			activityContent: "初回連絡を実施",
			nextAction: "資料依頼",
			occurredAt: "2026-05-30",
		},
		inquiryNotion as never,
	);

	assert.ok(
		updates.some((update) => {
			const properties = update.properties as Record<string, { select?: { name: string } }>;
			return properties?.ステータス?.select?.name === "対応中";
		}),
		"未対応の問い合わせで活動を残したらステータスを対応中へ進める",
	);

	const activityLogArgs = buildActivityLogFromContactLogForTest({
		id: "contact-log-3",
		url: "https://notion.so/contact-log-3",
		properties: {
			接点タイトル: {
				type: "title",
				title: [{ plain_text: "2026-05-30｜電話｜初回連絡を実施" }],
			},
			活動内容: { type: "rich_text", rich_text: [] },
			次回アクション: { type: "rich_text", rich_text: [] },
			活動ログ: {
				type: "rich_text",
				rich_text: [{ plain_text: "電話で初回連絡を実施し、資料依頼を受領" }],
			},
			活動表示: { type: "rich_text", rich_text: [] },
			"主権者と活動種別": {
				type: "multi_select",
				multi_select: [{ name: "電話" }],
			},
		},
	} as never);

	assert.notEqual(activityLogArgs, null, "主権者と活動種別 multi_select から活動種別を読んで反映候補にする");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
