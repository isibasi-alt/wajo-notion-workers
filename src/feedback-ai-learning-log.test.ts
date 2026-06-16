import assert from "node:assert/strict";
import {
	createDealFeedbackLearningLogForTest,
	createMeetingFeedbackLearningLogForTest,
} from "./index";

async function main() {
	const queries: Array<Record<string, unknown>> = [];
	const creates: Array<Record<string, unknown>> = [];
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
				return { id: `created-${creates.length}`, properties: {} };
			},
		},
	};

	await createDealFeedbackLearningLogForTest(notion as never, {
		dealPageId: "deal-1",
		meetingPageId: "meeting-1",
		dealName: "エコスタイル 商談",
		score: 78,
		salesFeedback: "温度感は良いが、決裁条件の確認が浅い。",
		improvementPoints: ["決裁者を確認する", "価格条件を整理する"],
		nextTalkImage: "次回は決裁者と予算枠を先に確認する。",
		followMailHint: "本日の確認事項と次回宿題を送る。",
		closingHint: "現地案内と価格条件の合意を急ぐ。",
		nowIso: "2026-05-26T10:00:00+09:00",
	});

	await createMeetingFeedbackLearningLogForTest(notion as never, {
		meetingPageId: "meeting-2",
		meetingTitle: "営業会議",
		meetingType: "営業会議",
		status: "返却済",
		directFeedback: "議論は前進したが、決定事項の責任者が曖昧。",
		goodPoints: ["論点が整理された"],
		improvementPoints: ["担当者と期限を必ず決める"],
		nextQuestions: ["次回までに誰が何を完了するか"],
		nextAction: "チームトラッカーへ期限付きで登録する。",
		nowIso: "2026-05-26T10:05:00+09:00",
	});

	assert.equal(queries.length, 2);
	assert.equal(creates.length, 2);
	const dealQueryFilter = queries[0]!.filter as { and: Array<{ property: string }> };
	assert.equal(dealQueryFilter.and[0]!.property, "関連商談");
	const meetingQueryFilter = queries[1]!.filter as { and: Array<{ property: string }> };
	assert.equal(meetingQueryFilter.and[0]!.property, "関連ミーティング");

	const dealProps = creates[0]!.properties as Record<string, unknown>;
	assert.equal((dealProps.判定種別 as { select: { name: string } }).select.name, "商談フィードバック");
	assert.equal((dealProps.対象領域 as { select: { name: string } }).select.name, "商談");
	assert.equal((dealProps.判定スコア as { number: number }).number, 78);
	assert.deepEqual((dealProps.関連商談 as { relation: Array<{ id: string }> }).relation, [{ id: "deal-1" }]);
	assert.deepEqual((dealProps.関連ミーティング as { relation: Array<{ id: string }> }).relation, [{ id: "meeting-1" }]);
	assert.equal(dealProps.関連会議, undefined);

	const meetingProps = creates[1]!.properties as Record<string, unknown>;
	assert.equal((meetingProps.判定種別 as { select: { name: string } }).select.name, "会議フィードバック");
	assert.equal((meetingProps.対象領域 as { select: { name: string } }).select.name, "会議");
	assert.deepEqual((meetingProps.関連ミーティング as { relation: Array<{ id: string }> }).relation, [{ id: "meeting-2" }]);
	assert.equal(meetingProps.関連会議, undefined);
	assert.equal((meetingProps.学習反映状態 as { select: { name: string } }).select.name, "未確認");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
