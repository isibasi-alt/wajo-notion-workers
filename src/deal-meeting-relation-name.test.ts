import assert from "node:assert/strict";
import {
	processMeetingDealLinkForTest,
	readDealForTest,
} from "./index";

// 商談管理DB（7838db8a）の実プロパティ名は「関連ミーティング」。
// 旧名「関連会議」しか持たない過去レコードでも読めること（フォールバック）を検証する。

function relation(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function dealPageFixture(
	id: string,
	meetingRelation: Record<string, unknown>,
	relationName: string,
) {
	return {
		id,
		url: `https://www.notion.so/${id}`,
		properties: {
			商談名: { type: "title", title: [{ plain_text: "テスト商談" }] },
			商談ステータス: { type: "select", select: { name: "実施済" } },
			商談概要: { type: "rich_text", rich_text: [] },
			商談日: { type: "date", date: null },
			関連企業: { type: "relation", relation: [] },
			[relationName]: meetingRelation,
		},
	};
}

function meetingPageFixture(id: string, relatedDealIds: string[]) {
	return {
		id,
		url: `https://www.notion.so/${id}`,
		properties: {
			ミーティング名: {
				type: "title",
				title: [{ plain_text: "商談会議｜テスト企業" }],
			},
			ミーティング種別: { type: "select", select: { name: "商談" } },
			関連商談: relation(relatedDealIds),
			関連企業: { type: "relation", relation: [] },
			商談連携状態: { type: "select", select: null },
			担当営業ユーザー: { type: "people", people: [] },
		},
	};
}

function makeNotion(options: {
	dealPage: Record<string, unknown>;
	meetingPage: Record<string, unknown>;
	queryResults?: Array<Record<string, unknown>>;
}) {
	const updates: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];
	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === options.meetingPage.id) return options.meetingPage;
				return options.dealPage;
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return {};
			},
		},
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return { results: options.queryResults ?? [] };
			},
		},
	};
	return { notion, updates, queries };
}

function dealUpdateFor(
	updates: Array<Record<string, unknown>>,
	dealId: string,
): Record<string, unknown> {
	const found = updates.find((item) => item.page_id === dealId);
	assert.ok(found, `商談ページ ${dealId} への update が見つかりません`);
	return found.properties as Record<string, unknown>;
}

async function main() {
	// 1. readDeal: 新名「関連ミーティング」のrelationを読めること
	const dealNew = readDealForTest(
		dealPageFixture("deal-new", relation(["meeting-1"]), "関連ミーティング") as never,
	);
	assert.equal(dealNew.relatedMeetingId, "meeting-1");

	// 2. readDeal: 旧名「関連会議」しか無い過去レコードでも読めること（フォールバック）
	const dealOld = readDealForTest(
		dealPageFixture("deal-old", relation(["meeting-2"]), "関連会議") as never,
	);
	assert.equal(dealOld.relatedMeetingId, "meeting-2");

	// 3. findDealsByMeeting: 商談DBクエリのfilterが実名「関連ミーティング」であること
	const filterCase = makeNotion({
		dealPage: dealPageFixture("deal-1", relation([]), "関連ミーティング"),
		meetingPage: meetingPageFixture("meeting-1", ["deal-1"]),
	});
	await processMeetingDealLinkForTest(
		{ meetingPageId: "meeting-1", dryRun: false },
		filterCase.notion as never,
	);
	assert.equal(filterCase.queries.length, 1);
	const filter = filterCase.queries[0]!.filter as { property: string };
	assert.equal(filter.property, "関連ミーティング");

	// 4. linkMeetingAndDeal: 新名スキーマの商談へ既存関連を保持したままマージ書き込みできること
	const linkNew = makeNotion({
		dealPage: dealPageFixture("deal-1", relation(["meeting-old"]), "関連ミーティング"),
		meetingPage: meetingPageFixture("meeting-1", ["deal-1"]),
	});
	const outNew = await processMeetingDealLinkForTest(
		{ meetingPageId: "meeting-1", dryRun: false },
		linkNew.notion as never,
	);
	assert.equal(outNew.action, "linked-existing");
	const newProps = dealUpdateFor(linkNew.updates, "deal-1");
	assert.deepEqual(newProps.関連ミーティング, {
		relation: [{ id: "meeting-old" }, { id: "meeting-1" }],
	});
	// 実在しない旧名「関連会議」はsafeUpdateでスキップされ書き込まれないこと
	assert.equal(newProps.関連会議, undefined);

	// 5. linkMeetingAndDeal: 旧名スキーマの商談でも既存関連を読み取り旧名へ書き込めること
	const linkOld = makeNotion({
		dealPage: dealPageFixture("deal-1", relation(["meeting-old"]), "関連会議"),
		meetingPage: meetingPageFixture("meeting-1", ["deal-1"]),
	});
	const outOld = await processMeetingDealLinkForTest(
		{ meetingPageId: "meeting-1", dryRun: false },
		linkOld.notion as never,
	);
	assert.equal(outOld.action, "linked-existing");
	const oldProps = dealUpdateFor(linkOld.updates, "deal-1");
	assert.deepEqual(oldProps.関連会議, {
		relation: [{ id: "meeting-old" }, { id: "meeting-1" }],
	});
	assert.equal(oldProps.関連ミーティング, undefined);

	console.log("deal-meeting-relation-name tests passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
