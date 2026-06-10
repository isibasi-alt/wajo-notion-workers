import assert from "node:assert/strict";
import {
	buildDealQuickStartCreateArgsForTest,
	buildMeetingQuickStartCreateArgsForTest,
	processDealQuickStartForTest,
	processMeetingDealLinkForTest,
	processMeetingQuickStartForTest,
} from "./index";

const MEETING_DATA_SOURCE_ID = "c22e58f6-42c9-4a2f-b24d-e65e889d59e9";
const DEAL_DATA_SOURCE_ID = "7838db8a-907a-4c61-b062-109f8278b2c9";

function selectName(property: unknown): string {
	return (property as { select: { name: string } }).select.name;
}

function titleText(property: unknown): string {
	const title = (property as {
		title: Array<{ text?: { content?: string }; plain_text?: string }>;
	}).title;
	return title.map((item) => item.plain_text ?? item.text?.content ?? "").join("");
}

function multiSelectNames(property: unknown): string[] {
	return (property as { multi_select: Array<{ name: string }> }).multi_select.map(
		(item) => item.name,
	);
}

function makeNotion(options: { templateMarkdown?: string } = {}) {
	const creates: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const markdownUpdates: Array<Record<string, unknown>> = [];
	const appends: Array<Record<string, unknown>> = [];
	const notion = {
		pages: {
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return {
					id: "created-page",
					url: "https://www.notion.so/created-page",
					properties: {},
				};
			},
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				url: `https://www.notion.so/${page_id}`,
				properties: {
					商談名: { type: "title", title: [] },
					商談ステータス: { type: "select", select: null },
					商談概要: { type: "rich_text", rich_text: [] },
					商談日: { type: "date", date: null },
					関連企業: { type: "relation", relation: [] },
				},
			}),
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return {};
			},
			updateMarkdown: async (args: Record<string, unknown>) => {
				markdownUpdates.push(args);
				return {};
			},
			retrieveMarkdown: async () => ({
				markdown: options.templateMarkdown ?? "",
			}),
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
	return { notion, creates, updates, markdownUpdates, appends };
}

async function main() {
	const now = new Date("2026-06-09T01:30:00.000Z");

	const meetingArgs = buildMeetingQuickStartCreateArgsForTest({
		meetingType: "ミーティング",
		now,
		tags: [],
	});
	assert.deepEqual(meetingArgs.parent, { data_source_id: MEETING_DATA_SOURCE_ID });
	assert.deepEqual(meetingArgs.template, {
		type: "template_id",
		template_id: "22adce6c-9249-4806-8f91-14fec2753fb1",
		timezone: "Asia/Tokyo",
	});
	const meetingProps = meetingArgs.properties as Record<string, unknown>;
	assert.equal(selectName(meetingProps.ミーティング種別), "ミーティング");
	assert.equal("ステータス" in meetingProps, false);
	assert.equal(titleText(meetingProps.ミーティング名).startsWith("ミーティング｜"), true);

	const legacyCase = makeNotion();
	const legacy = await processMeetingQuickStartForTest(
		{ meetingType: "営業会議", dryRun: false, now },
		legacyCase.notion as never,
	);
	assert.equal(legacy.action, "created-meeting");
	assert.equal(legacy.meetingType, "ミーティング");
	const legacyProps = legacyCase.creates[0]!.properties as Record<string, unknown>;
	assert.equal(selectName(legacyProps.ミーティング種別), "ミーティング");
	assert.deepEqual(multiSelectNames(legacyProps.タグ), ["営業"]);
	assert.equal(legacyCase.appends.length, 1);

	const meetingTemplateCase = makeNotion({
		templateMarkdown:
			"<meeting-notes>\n\tミーティング\n\t<notes>\n\t</notes>\n</meeting-notes>\n## 決定事項\n-",
	});
	const meetingWithTemplate = await processMeetingQuickStartForTest(
		{ meetingType: "ミーティング", dryRun: false, now },
		meetingTemplateCase.notion as never,
	);
	assert.equal(meetingWithTemplate.action, "created-meeting");
	assert.equal(meetingTemplateCase.markdownUpdates.length, 1);
	assert.equal(meetingTemplateCase.appends.length, 0);
	assert.match(
		JSON.stringify(meetingTemplateCase.markdownUpdates[0]),
		/meeting-notes/,
	);
	assert.doesNotMatch(
		JSON.stringify(meetingTemplateCase.markdownUpdates[0]),
		/ミーティング情報/,
	);

	const misroutedDealCase = makeNotion();
	const misroutedDeal = await processMeetingQuickStartForTest(
		{ meetingType: "商談", dryRun: false, now },
		misroutedDealCase.notion as never,
	);
	assert.equal(misroutedDeal.action, "use-deal-quick-start");
	assert.equal(misroutedDeal.meetingPageId, null);
	assert.equal(misroutedDealCase.creates.length, 0);
	assert.equal(misroutedDealCase.appends.length, 0);

	const dealArgs = buildDealQuickStartCreateArgsForTest({ now });
	assert.deepEqual(dealArgs.parent, { data_source_id: DEAL_DATA_SOURCE_ID });
	assert.equal("template" in dealArgs, false);
	const dealProps = dealArgs.properties as Record<string, unknown>;
	assert.equal(titleText(dealProps.商談名).startsWith("商談｜"), true);

	const dealCase = makeNotion();
	const deal = await processDealQuickStartForTest(
		{ dryRun: false, now },
		dealCase.notion as never,
	);
	assert.equal(deal.action, "created-deal");
	assert.equal(deal.dealPageId, "created-page");
	assert.equal(dealCase.creates.length, 1);
	assert.equal(dealCase.updates.length, 1);
	assert.equal(dealCase.markdownUpdates.length, 1);
	assert.equal(dealCase.appends.length, 0);
	assert.deepEqual(dealCase.creates[0]!.parent, { data_source_id: DEAL_DATA_SOURCE_ID });
	const markdownUpdate = dealCase.markdownUpdates[0]!;
	assert.equal(markdownUpdate.type, "replace_content");
	assert.match(JSON.stringify(markdownUpdate), /meeting-notes/);
	assert.match(JSON.stringify(markdownUpdate), /商談の定義/);
	const updateProps = dealCase.updates[0]!.properties as Record<string, unknown>;
	assert.equal(selectName(updateProps.商談ステータス), "要確認");
	assert.match(JSON.stringify(updateProps.商談概要), /関連企業未設定/);

	const targetOutUpdates: Array<Record<string, unknown>> = [];
	const targetOutNotion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				properties: {
					ミーティング名: {
						type: "title",
						title: [{ plain_text: "営業会議｜商談連携対象外" }],
					},
					ミーティング種別: {
						type: "select",
						select: { name: "営業会議" },
					},
					関連商談: { type: "relation", relation: [] },
					関連企業: { type: "relation", relation: [] },
					商談連携状態: { type: "select", select: null },
					担当営業ユーザー: { type: "people", people: [] },
				},
			}),
			update: async (args: Record<string, unknown>) => {
				targetOutUpdates.push(args);
				return {};
			},
		},
	};
	const targetOut = await processMeetingDealLinkForTest(
		{ meetingPageId: "meeting-sales", dryRun: false },
		targetOutNotion as never,
	);
	assert.equal(targetOut.action, "target-out");
	assert.equal(targetOutUpdates.length, 1);
	const targetOutProps = targetOutUpdates[0]!.properties as Record<string, unknown>;
	assert.equal(selectName(targetOutProps.商談連携状態), "未処理");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
