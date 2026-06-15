import assert from "node:assert/strict";
import {
	buildActivityLogFromSalesContributionLogForTest,
	buildActivityLogFromSpeechLogForTest,
	createMeetingEvaluationLogsFromExtractionForTest,
	buildMeetingEvaluationLogCreatePlansForTest,
	buildSalesPerformanceRelatedSourceWithStatsForTest,
	filterMeetingEvaluationLogExtractionForTest,
	parseMeetingMemoAIResponseForTest,
	processMeetingMemoFormatForTest,
	reflectSalesContributionLogsToActivityLogsForTest,
	reflectSpeechLogsToActivityLogsForTest,
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
					category: "提案",
					speaker: "石橋",
					evidenceQuote: "ABC蓄電池株式会社には今週中に見積条件を出します。価格は2500万円ではなく、粗利を残す条件で再提案します。",
					confidence: "高",
				},
				{
					title: "山田太郎の架空発言",
					content: "山田太郎が9000万円の案件を約束した。",
					category: "約束",
					speaker: "山田太郎",
					evidenceQuote: "山田太郎が9000万円の案件を約束した。",
					confidence: "高",
				},
			],
			salesContributionCandidates: [
				{
					title: "失注理由チェックリスト共有",
					type: "ナレッジ採用",
					category: "ナレッジ共有",
					impact: "中",
					comment: "佐藤が先週の失注理由を共有し、見積前提条件チェックリストを全員で使う提案をした。",
					evidenceQuote: "先週の失注理由を共有します。見積の前提条件を先にそろえるチェックリストを全員で使うべきです。",
					confidence: "高",
				},
				{
					title: "架空紹介",
					type: "社外顧問紹介",
					category: "会議貢献",
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
	assert.match(JSON.stringify(contributionProps.評価反映状態), /未反映/);
	assert.equal(contributionProps.承認ステータス, undefined);
	assert.deepEqual(speechProps.評価対象, { checkbox: false });

	const speechActivity = buildActivityLogFromSpeechLogForTest(
		{
			id: "speech-created",
			url: "https://notion.so/speech-created",
			created_time: "2026-06-15T01:00:00.000Z",
			created_by: { id: "worker" },
			properties: asRetrievedProperties({
				...speechProps,
				評価対象: checkbox(true),
			}),
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
			properties: asRetrievedProperties({
				...contributionProps,
				承認ステータス: select("承認"),
			}),
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

	const invalidOptionFiltered = filterMeetingEvaluationLogExtractionForTest(
		{
			speechLogCandidates: [
				{
					title: "旧カテゴリ商談",
					content: "石橋が提案条件を確認した。",
					category: "商談",
					speaker: "石橋",
					evidenceQuote: "石橋が提案条件を確認した。",
					confidence: "高",
				},
			],
			salesContributionCandidates: [
				{
					title: "会議外の日報いいね",
					type: "日報いいね",
					category: "上司FB",
					impact: "特大",
					comment: "石橋が提案条件を確認した。",
					evidenceQuote: "石橋が提案条件を確認した。",
					confidence: "高",
				},
			],
		},
		"石橋が提案条件を確認した。会議では次回の条件整理だけを話した。".repeat(4),
	);
	assert.equal(invalidOptionFiltered.speechLogCandidates.length, 0);
	assert.equal(invalidOptionFiltered.salesContributionCandidates.length, 0);
	assert.match(invalidOptionFiltered.skipped.join("\n"), /集合外|select/);

	const salesGateQueries: Array<Record<string, unknown>> = [];
	const salesGateCreates: Array<Record<string, unknown>> = [];
	const salesGateResult = await reflectSalesContributionLogsToActivityLogsForTest(
		{ limit: 10 },
		{
			dataSources: {
				query: async (args: Record<string, unknown>) => {
					salesGateQueries.push(args);
					return {
						results: [
							{
								id: "unapproved-contribution",
								created_time: "2026-06-15T01:00:00.000Z",
								created_by: { id: "sales-1" },
								properties: {
									貢献タイトル: title("未承認の会議貢献"),
									AIコメント: richText("承認前の会議貢献候補。"),
									評価反映状態: select("未反映"),
								},
							},
							{
								id: "approved-contribution",
								created_time: "2026-06-15T01:00:00.000Z",
								created_by: { id: "sales-1" },
								properties: {
									貢献タイトル: title("承認済み会議貢献"),
									AIコメント: richText("承認済みの会議貢献候補。"),
									承認ステータス: select("承認"),
									評価反映状態: select("未反映"),
								},
							},
						],
					};
				},
			},
			pages: {
				create: async (args: Record<string, unknown>) => {
					salesGateCreates.push(args);
					return { id: "activity-approved" };
				},
				update: async () => ({}),
			},
		} as never,
	);
	assert.equal(salesGateResult.created, 1);
	assert.equal(salesGateResult.skipped, 1);
	assert.equal(salesGateCreates.length, 1);
	assert.doesNotMatch(JSON.stringify(salesGateQueries[0]!.filter), /反映候補/);
	assert.match(JSON.stringify(salesGateQueries[0]!.filter), /承認ステータス/);

	const speechState: Record<string, unknown> = {
		発言タイトル: title("改善提案"),
		発言内容: richText("対応遅延をなくす改善提案をした。"),
		発言者: people(["sales-1"]),
		発言日時: date("2026-06-15"),
		関連活動: relation([]),
		評価対象: checkbox(true),
	};
	const speechReflectCreates: Array<Record<string, unknown>> = [];
	const speechReflectResult1 = await reflectSpeechLogsToActivityLogsForTest(
		{ limit: 10 },
		{
			dataSources: {
				query: async () => ({
					results: relationIdsFromState(speechState).length === 0
						? [
							{
								id: "speech-once",
								created_time: "2026-06-15T01:00:00.000Z",
								created_by: { id: "sales-1" },
								properties: speechState,
							},
						]
						: [],
				}),
			},
			pages: {
				create: async (args: Record<string, unknown>) => {
					speechReflectCreates.push(args);
					return { id: "activity-from-speech" };
				},
				update: async (args: Record<string, unknown>) => {
					Object.assign(speechState, args.properties);
					return {};
				},
			},
		} as never,
	);
	const speechReflectResult2 = await reflectSpeechLogsToActivityLogsForTest(
		{ limit: 10 },
		{
			dataSources: {
				query: async () => ({
					results: relationIdsFromState(speechState).length === 0
						? [
							{
								id: "speech-once",
								created_time: "2026-06-15T01:00:00.000Z",
								created_by: { id: "sales-1" },
								properties: speechState,
							},
						]
						: [],
				}),
			},
			pages: {
				create: async (args: Record<string, unknown>) => {
					speechReflectCreates.push(args);
					return { id: "activity-from-speech-2" };
				},
				update: async (args: Record<string, unknown>) => {
					Object.assign(speechState, args.properties);
					return {};
				},
			},
		} as never,
	);
	assert.equal(speechReflectResult1.created, 1);
	assert.equal(speechReflectResult2.created, 0);
	assert.equal(speechReflectCreates.length, 1);

	const hashDuplicateCreates: Array<Record<string, unknown>> = [];
	const hashDuplicateQueries: Array<Record<string, unknown>> = [];
	const hashDuplicateResult = await createMeetingEvaluationLogsFromExtractionForTest(
		{
			meetingPage,
			extraction: {
				speechLogCandidates: [
					{
						...filtered.speechLogCandidates[0]!,
						title: "  見積 条件 の 再提案  ",
					},
				],
				salesContributionCandidates: [
					{
						...filtered.salesContributionCandidates[0]!,
						title: "  失注 理由 チェックリスト 共有  ",
					},
				],
			},
			source,
			dryRun: false,
		},
		{
			dataSources: {
				query: async (args: Record<string, unknown>) => {
					hashDuplicateQueries.push(args);
					return JSON.stringify(args.filter).includes("抽出ハッシュ:")
						? { results: [{ id: "existing-by-hash" }] }
						: { results: [] };
				},
			},
			pages: {
				create: async (args: Record<string, unknown>) => {
					hashDuplicateCreates.push(args);
					return { id: "unexpected-hash-create" };
				},
			},
		} as never,
	);
	assert.equal(hashDuplicateResult.speechCreated, 0);
	assert.equal(hashDuplicateResult.salesContributionCreated, 0);
	assert.equal(hashDuplicateResult.skipped, 2);
	assert.equal(hashDuplicateCreates.length, 0);
	assert.equal(hashDuplicateQueries.length, 2);

	await assertMeetingFormatDoesNotCreateEvaluationLogsByDefault();

	console.log("meeting-evaluation-log-extraction: all assertions passed");
}

function relationIdsFromState(properties: Record<string, unknown>): string[] {
	const relationValue = properties.関連活動 as { relation?: Array<{ id?: string }> } | undefined;
	return (relationValue?.relation ?? [])
		.map((item) => item.id)
		.filter((id): id is string => Boolean(id));
}

async function assertMeetingFormatDoesNotCreateEvaluationLogsByDefault() {
	const originalFetch = globalThis.fetch;
	const originalOpenAiKey = process.env.OPENAI_API_KEY;
	process.env.OPENAI_API_KEY = "test-key";
	const evaluationCreates: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const longSource = [
		"営業会議 2026-06-15",
		"石橋: ABC蓄電池株式会社には今週中に見積条件を出します。価格は2500万円ではなく、粗利を残す条件で再提案します。",
		"佐藤: 先週の失注理由を共有します。見積の前提条件を先にそろえるチェックリストを全員で使うべきです。",
	].join("\n");
	globalThis.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								text: longSource,
								summary: "要約",
								minutes: "議事",
								decisions: "",
								actionItems: "",
								taskStatus: "対象外",
								formatStatus: "整形済",
								memo: "",
								speechLogCandidates: [
									{
										title: "見積条件の再提案",
										content: "ABC蓄電池株式会社に今週中に見積条件を出し、2500万円ではなく粗利を残す条件で再提案すると発言した。",
										category: "提案",
										speaker: "石橋",
										evidenceQuote: "ABC蓄電池株式会社には今週中に見積条件を出します。価格は2500万円ではなく、粗利を残す条件で再提案します。",
										confidence: "高",
									},
								],
								salesContributionCandidates: [
									{
										title: "失注理由チェックリスト共有",
										type: "ナレッジ採用",
										category: "ナレッジ共有",
										impact: "中",
										comment: "佐藤が先週の失注理由を共有し、見積前提条件チェックリストを全員で使う提案をした。",
										evidenceQuote: "先週の失注理由を共有します。見積の前提条件を先にそろえるチェックリストを全員で使うべきです。",
										confidence: "高",
									},
								],
							}),
						},
					},
				],
			}),
		}) as Response;

	const makeNotion = () => ({
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				created_time: "2026-06-15T01:00:00.000Z",
				properties: {
					ミーティング名: title("営業会議 2026-06-15"),
					ミーティング種別: select("営業会議"),
					テキスト: richText(""),
					要約: richText(""),
					議事内容: richText(""),
					決定事項: richText(""),
					アクション項目: richText(""),
					タスク化ステータス: select("未処理"),
					メモ整形ステータス: select("未処理"),
					メモ整形メモ: richText(""),
					担当営業ユーザー: people(["sales-1"]),
					関連企業: relation(["company-1"]),
					関連商談: relation(["deal-1"]),
				},
			}),
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return {};
			},
			create: async (args: Record<string, unknown>) => {
				evaluationCreates.push(args);
				return { id: `created-${evaluationCreates.length}` };
			},
		},
		blocks: {
			children: {
				list: async () => ({ results: [{ type: "paragraph", paragraph: { rich_text: [{ plain_text: longSource }] } }], has_more: false, next_cursor: null }),
			},
		},
		dataSources: {
			query: async () => ({ results: [] }),
		},
	});

	try {
		const defaultResult = await processMeetingMemoFormatForTest(
			{ meetingPageId: "meeting-format", dryRun: false },
			makeNotion() as never,
		);
		assert.equal(defaultResult.action, "formatted");
		assert.match(defaultResult.message, /プレビュー/);
		assert.equal(evaluationCreates.length, 0);

		const explicitResult = await processMeetingMemoFormatForTest(
			{ meetingPageId: "meeting-format", dryRun: false, generateEvaluationLogs: true } as never,
			makeNotion() as never,
		);
		assert.equal(explicitResult.action, "formatted");
		assert.match(explicitResult.message, /発言ログ作成: 1件/);
		assert.match(explicitResult.message, /営業貢献ログ作成: 1件/);
		assert.equal(evaluationCreates.length, 2);
		assert.equal(updates.length, 2);
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
