import assert from "node:assert/strict";
import {
	buildActivityLogFromSalesContributionLogForTest,
	buildActivityLogFromSpeechLogForTest,
	createMeetingEvaluationLogsFromExtractionForTest,
	buildMeetingEvaluationLogCreatePlansForTest,
	buildSalesPerformanceRelatedSourceWithStatsForTest,
	filterMeetingEvaluationLogExtractionForTest,
	parseMeetingMemoAIResponseForTest,
} from "./index";

function title(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richText(value: string) {
	return { type: "rich_text", rich_text: [{ plain_text: value }] };
}

function select(value: string) {
	return { type: "select", select: { name: value } };
}

function relation(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function relationPayload(ids: string[]) {
	return { relation: ids.map((id) => ({ id })) };
}

function checkbox(value: boolean) {
	return { type: "checkbox", checkbox: value };
}

function people(ids: string[]) {
	return { type: "people", people: ids.map((id) => ({ id })) };
}

function date(value: string) {
	return { type: "date", date: { start: value } };
}

function asRetrievedProperties(properties: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(properties).map(([key, value]) => [key, asRetrievedProperty(value)]),
	);
}

function asRetrievedProperty(value: unknown): unknown {
	if (!value || typeof value !== "object") return value;
	const prop = value as Record<string, unknown>;
	if (Array.isArray(prop.title)) {
		return {
			type: "title",
			title: prop.title.map(asRetrievedRichText),
		};
	}
	if (Array.isArray(prop.rich_text)) {
		return {
			type: "rich_text",
			rich_text: prop.rich_text.map(asRetrievedRichText),
		};
	}
	if (prop.select) return { type: "select", select: prop.select };
	if (prop.date) return { type: "date", date: prop.date };
	if (Array.isArray(prop.relation)) return { type: "relation", relation: prop.relation };
	if (Array.isArray(prop.people)) return { type: "people", people: prop.people };
	if (typeof prop.checkbox === "boolean") return { type: "checkbox", checkbox: prop.checkbox };
	return value;
}

function asRetrievedRichText(value: unknown): unknown {
	if (!value || typeof value !== "object") return value;
	const rich = value as Record<string, unknown>;
	const textValue = rich.text as Record<string, unknown> | undefined;
	if (typeof textValue?.content === "string") {
		return { ...rich, plain_text: textValue.content };
	}
	return rich;
}

async function main() {
	const shortSource = "1on1をしました。";
	const shortFiltered = filterMeetingEvaluationLogExtractionForTest(
		{
			speechLogCandidates: [
				{
					title: "短文メモ",
					content: "短文メモ",
					category: "報告",
					speaker: "石橋",
					evidenceQuote: "1on1をしました。",
					confidence: "高",
				},
			],
			salesContributionCandidates: [
				{
					title: "短文貢献",
					type: "チーム支援",
					category: "チーム支援",
					impact: "中",
					comment: "短文からは根拠不足。",
					evidenceQuote: "1on1をしました。",
					confidence: "高",
				},
			],
		},
		shortSource,
	);
	assert.equal(shortFiltered.speechLogCandidates.length, 0);
	assert.equal(shortFiltered.salesContributionCandidates.length, 0);
	assert.equal(shortFiltered.skipped.length, 2);

	const source = [
		"営業会議 2026-06-15",
		"石橋: ABC蓄電池株式会社には今週中に見積条件を出します。価格は2500万円ではなく、粗利を残す条件で再提案します。",
		"佐藤: 先週の失注理由を共有します。見積の前提条件を先にそろえるチェックリストを全員で使うべきです。",
	].join("\n");
	const filtered = filterMeetingEvaluationLogExtractionForTest(
		{
			speechLogCandidates: [
				{
					title: "見積条件の再提案",
					content: "ABC蓄電池株式会社に今週中に見積条件を出し、2500万円ではなく粗利を残す条件で再提案すると発言した。",
					category: "商談",
					speaker: "石橋",
					evidenceQuote: "ABC蓄電池株式会社には今週中に見積条件を出します。価格は2500万円ではなく、粗利を残す条件で再提案します。",
					confidence: "高",
				},
				{
					title: "山田太郎の架空発言",
					content: "山田太郎が9000万円の案件を約束した。",
					category: "商談",
					speaker: "山田太郎",
					evidenceQuote: "山田太郎が9000万円の案件を約束した。",
					confidence: "高",
				},
			],
			salesContributionCandidates: [
				{
					title: "失注理由チェックリスト共有",
					type: "成約・失注の学び",
					category: "成約・失注の学び",
					impact: "中",
					comment: "佐藤が先週の失注理由を共有し、見積前提条件チェックリストを全員で使う提案をした。",
					evidenceQuote: "先週の失注理由を共有します。見積の前提条件を先にそろえるチェックリストを全員で使うべきです。",
					confidence: "高",
				},
				{
					title: "架空紹介",
					type: "紹介",
					category: "紹介",
					impact: "高",
					comment: "田中商事から9000万円の紹介を受けた。",
					evidenceQuote: "田中商事から9000万円の紹介を受けた。",
					confidence: "高",
				},
			],
		},
		source,
	);
	assert.equal(filtered.speechLogCandidates.length, 1);
	assert.equal(filtered.salesContributionCandidates.length, 1);
	assert.match(filtered.skipped.join("\n"), /山田太郎/);
	assert.match(filtered.skipped.join("\n"), /9000万円/);

	const meetingPage = {
		id: "meeting-1",
		created_time: "2026-06-15T01:00:00.000Z",
		properties: {
			会議名: title("営業会議 2026-06-15"),
			会議日時: date("2026-06-15"),
			担当営業ユーザー: people(["sales-1"]),
			関連企業: relation(["company-1"]),
			関連商談: relation(["deal-1"]),
		},
	};
	const plans = buildMeetingEvaluationLogCreatePlansForTest({
		meetingPage,
		extraction: filtered,
		source,
	});
	assert.equal(plans.speechLogCreates.length, 1);
	assert.equal(plans.salesContributionCreates.length, 1);
	const speechProps = plans.speechLogCreates[0].properties as Record<string, unknown>;
	assert.deepEqual(speechProps.関連会議, relationPayload(["meeting-1"]));
	assert.deepEqual(speechProps.関連企業, relationPayload(["company-1"]));
	assert.match(JSON.stringify(speechProps.発言者), /sales-1/);
	const contributionProps = plans.salesContributionCreates[0].properties as Record<string, unknown>;
	assert.deepEqual(contributionProps.関連商談, relationPayload(["deal-1"]));
	assert.match(JSON.stringify(contributionProps.対象営業ユーザー), /sales-1/);
	assert.match(JSON.stringify(contributionProps.評価反映状態), /反映候補/);
	assert.equal(contributionProps.承認ステータス, undefined);

	const speechActivity = buildActivityLogFromSpeechLogForTest(
		{
			id: "speech-created",
			url: "https://notion.so/speech-created",
			created_time: "2026-06-15T01:00:00.000Z",
			created_by: { id: "worker" },
			properties: asRetrievedProperties(speechProps),
		},
		"meeting-eval-test",
	);
	assert.ok(speechActivity);
	const speechActivityProps = speechActivity.properties as Record<string, unknown>;
	assert.deepEqual(speechActivityProps.関連発言, relationPayload(["speech-created"]));
	assert.deepEqual(speechActivityProps.評価対象, { checkbox: true });

	const contributionActivity = buildActivityLogFromSalesContributionLogForTest(
		{
			id: "contribution-created",
			url: "https://notion.so/contribution-created",
			created_time: "2026-06-15T01:00:00.000Z",
			created_by: { id: "worker" },
			properties: asRetrievedProperties(contributionProps),
		},
		"meeting-eval-test",
	);
	assert.ok(contributionActivity);
	const contributionActivityProps = contributionActivity.properties as Record<string, unknown>;
	assert.deepEqual(
		contributionActivityProps.関連営業貢献ログ,
		relationPayload(["contribution-created"]),
	);
	assert.deepEqual(contributionActivityProps.評価対象, { checkbox: true });

	const retrievedPages: Record<string, Record<string, unknown>> = {
		"activity-speech": asRetrievedProperties(speechActivityProps),
		"activity-contribution": asRetrievedProperties(contributionActivityProps),
		"speech-created": asRetrievedProperties(speechProps),
		"contribution-created": asRetrievedProperties(contributionProps),
	};
	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				url: `https://notion.so/${page_id}`,
				properties: retrievedPages[page_id] ?? {},
			}),
		},
	};
	const relatedSource = await buildSalesPerformanceRelatedSourceWithStatsForTest(
		notion as never,
		{ 関連活動ログ: relation(["activity-speech", "activity-contribution"]) },
	);
	assert.equal(relatedSource.qualitativeLogCounts.speechLogs, 1);
	assert.equal(relatedSource.qualitativeLogCounts.contributionLogs, 1);
	assert.match(relatedSource.source, /見積条件の再提案/);
	assert.match(relatedSource.source, /失注理由チェックリスト共有/);

	const parsed = parseMeetingMemoAIResponseForTest(
		JSON.stringify({
			text: source,
			summary: "要約",
			minutes: "議事",
			decisions: "",
			actionItems: "",
			taskStatus: "対象外",
			formatStatus: "整形済",
			memo: "",
			speechLogCandidates: filtered.speechLogCandidates,
			salesContributionCandidates: filtered.salesContributionCandidates,
		}),
	);
	assert.equal(parsed.speechLogCandidates.length, 1);
	assert.equal(parsed.salesContributionCandidates.length, 1);

	const dryRunCreates: Array<Record<string, unknown>> = [];
	const dryRunResult = await createMeetingEvaluationLogsFromExtractionForTest(
		{
			meetingPage,
			extraction: filtered,
			source,
			dryRun: true,
		},
		{
			pages: {
				create: async (args: Record<string, unknown>) => {
					dryRunCreates.push(args);
					return { id: "unexpected-create" };
				},
			},
		} as never,
	);
	assert.deepEqual(dryRunResult, {
		speechCreated: 1,
		salesContributionCreated: 1,
		skipped: 0,
		errors: 0,
		messages: [],
	});
	assert.equal(dryRunCreates.length, 0);

	const duplicateCreates: Array<Record<string, unknown>> = [];
	const duplicateQueries: Array<Record<string, unknown>> = [];
	const duplicateResult = await createMeetingEvaluationLogsFromExtractionForTest(
		{
			meetingPage,
			extraction: filtered,
			source,
			dryRun: false,
		},
		{
			dataSources: {
				query: async (args: Record<string, unknown>) => {
					duplicateQueries.push(args);
					if (args.data_source_id === "86f5693c-db36-4356-aec1-210495f6032a") {
						return { results: [{ id: "existing-speech" }] };
					}
					if (args.data_source_id === "f88056da-3052-418e-8cf4-e9b4197cd7ba") {
						return { results: [{ id: "existing-contribution" }] };
					}
					return { results: [] };
				},
			},
			pages: {
				create: async (args: Record<string, unknown>) => {
					duplicateCreates.push(args);
					return { id: "unexpected-create" };
				},
			},
		} as never,
	);
	assert.equal(duplicateResult.speechCreated, 0);
	assert.equal(duplicateResult.salesContributionCreated, 0);
	assert.equal(duplicateResult.skipped, 2);
	assert.equal(duplicateResult.errors, 0);
	assert.equal(duplicateCreates.length, 0);
	assert.equal(duplicateQueries.length, 2);
	assert.match(duplicateResult.messages.join("\n"), /重複/);

	console.log("meeting-evaluation-log-extraction: all assertions passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
