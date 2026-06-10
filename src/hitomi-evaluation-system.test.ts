import assert from "node:assert/strict";
import {
	buildActivityLogFromAiConsultationForTest,
	buildActivityLogFromContactLogForTest,
	buildActivityLogFromHitomiMemoForTest,
	buildActivityLogFromSalesContributionLogForTest,
	buildActivityLogFromSpeechLogForTest,
	buildActivityLogFromWaniPoMemoryForTest,
	buildSalesPerformanceEvaluationSourceForTest,
	buildSalesPerformanceDryRunPreviewForTest,
	buildSalesPerformanceQuotaSourceForTest,
	buildSalesPerformanceRelatedSourceForTest,
	buildSalesPerformanceReviewPatchesForTest,
	buildSalesPerformanceReviewSourceForTest,
	isHitomiMemoEvaluationEvidenceForTest,
	isAuditOrTestPerformanceForTest,
	isWaniPoMemoryEvaluationEvidenceForTest,
	linkActivityLogsToSalesPerformanceForTest,
	reflectCustomerContactLogsToActivityLogsForTest,
	reflectHitomiMemosToActivityLogsForTest,
	reflectAiConsultationsToActivityLogsForTest,
	reflectSalesContributionLogsToActivityLogsForTest,
	reflectSpeechLogsToActivityLogsForTest,
	reflectWaniPoMemoriesToActivityLogsForTest,
	resolveWajoOpenAiConfigForTest,
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

function status(value: string) {
	return { type: "status", status: { name: value } };
}

function relation(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function relationPayload(ids: string[]) {
	return { relation: ids.map((id) => ({ id })) };
}

function number(value: number) {
	return { type: "number", number: value };
}

function date(value: string) {
	return { type: "date", date: { start: value } };
}

function checkbox(value: boolean) {
	return { type: "checkbox", checkbox: value };
}

function people(ids: string[]) {
	return { type: "people", people: ids.map((id) => ({ id })) };
}

function rollupNumber(value: number) {
	return { type: "rollup", rollup: { type: "number", number: value } };
}

const retrievedPages: Record<string, Record<string, unknown>> = {
	"activity-1": {
		活動タイトル: title("初回提案後の追客活動"),
		活動種別: select("顧客接点"),
		活動処理状態: select("完了"),
		評価対象: checkbox(true),
		AIサマリ: richText("顧客の温度感を確認し、次回提案条件を整理した。"),
		関連発言: relation(["speech-1"]),
		関連ワニポメモリー: relation(["wanipo-private"]),
	},
	"activity-support": {
		活動タイトル: title("ワニポメモリー補助ログ"),
		活動種別: select("その他"),
		活動処理状態: select("完了"),
		評価対象: checkbox(false),
		活動ログ: richText("AI活用ポイント: 2。本人のぼやき支援メモ。"),
		関連ワニポメモリー: relation(["wanipo-private"]),
	},
	"activity-generic": {
		活動タイトル: title("汎用活動ログ"),
		活動種別: select("その他"),
		活動処理状態: select("完了"),
		評価対象: checkbox(true),
		AIサマリ: richText("評価対象チェックだけが入った汎用メモ。"),
	},
	"activity-ai-consultation": {
		活動タイトル: title("AI相談補助ログ"),
		活動種別: select("その他"),
		活動処理状態: select("完了"),
		評価対象: checkbox(false),
		活動ログ: richText("商談準備の壁打ちにAIを使った。"),
	},
	...Object.fromEntries(
		Array.from({ length: 9 }, (_, index) => [
			`activity-many-${index + 1}`,
			{
				活動タイトル: title(`追客活動${index + 1}`),
				活動種別: select("顧客接点"),
				活動処理状態: select("完了"),
				評価対象: checkbox(true),
				関連顧客接点ログ: relation([`contact-many-${index + 1}`]),
			},
		]),
	),
	"speech-1": {
		発言タイトル: title("価格条件の説明"),
		発言カテゴリ: select("商談"),
		発言内容: richText("粗利を残すための条件説明ができている。"),
	},
	...Object.fromEntries(
		Array.from({ length: 9 }, (_, index) => [
			`contact-many-${index + 1}`,
			{
				接点タイトル: title(`顧客接点${index + 1}`),
				活動種別: select("電話"),
				活動内容: richText(`追客内容${index + 1}`),
			},
		]),
	),
	"contribution-1": {
		貢献タイトル: title("蓄電池ナレッジ共有"),
		貢献カテゴリ: select("ナレッジ共有"),
		AIコメント: richText("他メンバーの提案準備に寄与した。"),
	},
	"quota-draft": {
		申請名: title("2026年5月ノルマ申請"),
		申請ステータス: select("下書き"),
		評価タイプ: select("両方"),
		粗利目標: number(8_000_000),
	},
	"quota-approved": {
		申請名: title("2026年5月ノルマ申請"),
		申請ステータス: select("承認済み"),
		評価タイプ: select("両方"),
		粗利目標: number(8_000_000),
	},
	"quota-approved-late": {
		申請名: title("2026年5月ノルマ申請"),
		申請ステータス: select("承認済み"),
		評価タイプ: select("両方"),
		粗利目標: number(8_000_000),
	},
};

const retrievedPageMeta: Record<string, Record<string, unknown>> = {
	"quota-approved": {
		last_edited_time: "2026-04-30T23:30:00.000Z",
	},
	"quota-approved-late": {
		last_edited_time: "2026-05-01T00:30:00.000Z",
	},
};

const notion = {
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => ({
			id: page_id,
			url: `https://notion.so/${page_id}`,
			...(retrievedPageMeta[page_id] ?? {}),
			properties: retrievedPages[page_id] ?? {
				名前: title(`missing-${page_id}`),
			},
		}),
	},
};

async function main() {
	const monthlySource = buildSalesPerformanceReviewSourceForTest({
		評価名: title("2026年5月 石橋大右｜本番"),
		"実績粗利額（自動）": rollupNumber(1_500_000),
		"成約件数（自動）": rollupNumber(3),
		"総合スコア（自動）": rollupNumber(82),
		結果スコア: number(78),
		"AI活用ポイント（月次）": number(2),
		AI活用ポイントメモ: richText("商談前の提案整理にAIを活用。"),
		AI活用ポイント上限: number(3),
	});
	assert.match(monthlySource, /実績粗利額.*1500000/);
	assert.match(monthlySource, /成約件数.*3/);
	assert.match(monthlySource, /定量評価（実績）｜65点/);
	assert.match(monthlySource, /定量評価不足警告/);
	assert.match(monthlySource, /仕入れ件数: 未入力/);
	assert.match(monthlySource, /仕入れ金額: 未入力/);
	assert.doesNotMatch(monthlySource, /月次数字・月次報告/);
	assert.doesNotMatch(monthlySource, /結果スコア/);
	assert.doesNotMatch(monthlySource, /AI活用ポイント/);
	assert.doesNotMatch(monthlySource, /本人コメント|マネージャーコメント|AI評価メモ/);

	const draftQuotaSource = await buildSalesPerformanceQuotaSourceForTest(
		notion as never,
		{ 関連ノルマ申請: relation(["quota-draft"]) },
	);
	assert.match(draftQuotaSource.source, /ノルマ申請（月初ゲート）/);
	assert.match(draftQuotaSource.source, /申請ステータス: 下書き/);
	assert.deepEqual(draftQuotaSource.warnings, ["ノルマ申請未承認:下書き"]);

	const approvedQuotaSource = await buildSalesPerformanceQuotaSourceForTest(
		notion as never,
		{ 関連ノルマ申請: relation(["quota-approved"]), 開始日: date("2026-05-01") },
	);
	assert.match(approvedQuotaSource.source, /申請ステータス: 承認済み/);
	assert.deepEqual(approvedQuotaSource.warnings, []);

	const lateApprovedQuotaSource = await buildSalesPerformanceQuotaSourceForTest(
		notion as never,
		{ 関連ノルマ申請: relation(["quota-approved-late"]), 開始日: date("2026-05-01") },
	);
	assert.match(lateApprovedQuotaSource.source, /承認期限: 2026-05-01 09:00 JST/);
	assert.deepEqual(lateApprovedQuotaSource.warnings, ["ノルマ承認期限超過:2026-05-01T00:30:00.000Z"]);

	const relatedSource = await buildSalesPerformanceRelatedSourceForTest(
		notion as never,
		{
			関連活動ログ: relation(["activity-1"]),
			関連発言ログ: relation(["speech-1"]),
			関連貢献ログ: relation(["contribution-1"]),
		},
	);
	assert.match(relatedSource, /定性評価（活動ログ）｜35点/);
	assert.match(relatedSource, /初回提案後の追客活動/);
	assert.match(relatedSource, /関連発言/);
	assert.match(relatedSource, /価格条件の説明/);
	assert.match(relatedSource, /補助確認事項（採点対象外）/);
	assert.match(relatedSource, /関連ワニポメモリー/);
	assert.doesNotMatch(relatedSource, /旧直接ログ/);
	assert.doesNotMatch(relatedSource, /蓄電池ナレッジ共有/);
	assert.doesNotMatch(relatedSource, /wanipo-private/);

	const manyActivityRelatedSource = await buildSalesPerformanceRelatedSourceForTest(
		notion as never,
		{
			関連活動ログ: relation(
				Array.from({ length: 9 }, (_, index) => `activity-many-${index + 1}`),
			),
		},
	);
	assert.match(manyActivityRelatedSource, /活動ログ件数超過/);
	assert.match(manyActivityRelatedSource, /9件中8件のみ/);
	const manyActivityPreview = buildSalesPerformanceDryRunPreviewForTest(manyActivityRelatedSource);
	assert.ok(manyActivityPreview.some((line) => line.includes("活動ログ件数超過")));

	const supportRelatedSource = await buildSalesPerformanceRelatedSourceForTest(
		notion as never,
		{ 関連活動ログ: relation(["activity-support"]) },
	);
	assert.match(supportRelatedSource, /定性評価（活動ログ）｜35点/);
	assert.match(supportRelatedSource, /評価対象外/);
	assert.match(supportRelatedSource, /補助確認事項（採点対象外）/);
	assert.match(supportRelatedSource, /ワニポメモリー補助ログ/);
	assert.match(supportRelatedSource, /関連ワニポメモリー/);
	assert.doesNotMatch(supportRelatedSource, /AI活用ポイント|本人のぼやき|wanipo-private/);

	const aiConsultationSupportSource = await buildSalesPerformanceRelatedSourceForTest(
		notion as never,
		{ 関連活動ログ: relation(["activity-ai-consultation"]) },
	);
	assert.match(aiConsultationSupportSource, /定性評価（活動ログ）｜35点/);
	assert.match(aiConsultationSupportSource, /評価対象外/);
	assert.match(aiConsultationSupportSource, /補助確認事項（採点対象外）/);
	assert.match(aiConsultationSupportSource, /AI相談補助ログ/);
	assert.doesNotMatch(aiConsultationSupportSource, /商談準備の壁打ち/);

	const genericActivitySource = await buildSalesPerformanceRelatedSourceForTest(
		notion as never,
		{ 関連活動ログ: relation(["activity-generic"]) },
	);
	assert.match(genericActivitySource, /定性評価（活動ログ）｜35点/);
	assert.match(genericActivitySource, /対象3ログ外/);
	assert.doesNotMatch(genericActivitySource, /汎用活動ログ|評価対象チェックだけ/);

	const evaluationSource = buildSalesPerformanceEvaluationSourceForTest({
		quotaSource: draftQuotaSource.source,
		propertySource: monthlySource,
		relatedSource,
		pageText: "月次ページ本文に書かれた主観メモ。採点根拠に混ぜない。",
	});
	assert.ok(evaluationSource.indexOf("ノルマ申請（月初ゲート）") < evaluationSource.indexOf("定量評価（実績）｜65点"));
	assert.match(evaluationSource, /定量評価（実績）｜65点/);
	assert.match(evaluationSource, /定性評価（活動ログ）｜35点/);
	assert.doesNotMatch(evaluationSource, /月次ページ本文|主観メモ|補足本文/);

	const noHubSource = await buildSalesPerformanceRelatedSourceForTest(
		notion as never,
		{ 関連発言ログ: relation(["speech-1"]) },
	);
	assert.match(noHubSource, /定性評価（活動ログ）｜35点/);
	assert.match(noHubSource, /活動ログ未接続/);
	assert.match(noHubSource, /活動ログ未集約/);
	assert.doesNotMatch(noHubSource, /価格条件の説明/);

	const legacyContributionOnlySource = await buildSalesPerformanceRelatedSourceForTest(
		notion as never,
		{
			関連貢献ログ: relation(["contribution-1"]),
			関連商談: relation(["deal-1"]),
			関連成約: relation(["closing-1"]),
		},
	);
	assert.match(legacyContributionOnlySource, /定性評価（活動ログ）｜35点/);
	assert.match(legacyContributionOnlySource, /活動ログ未接続/);
	assert.match(legacyContributionOnlySource, /活動ログ未集約/);
	assert.doesNotMatch(legacyContributionOnlySource, /蓄電池ナレッジ共有|deal-1|closing-1/);

	const dryRunPreview = buildSalesPerformanceDryRunPreviewForTest([
		lateApprovedQuotaSource.source,
		monthlySource,
		relatedSource,
	].join("\n\n"));
	assert.ok(dryRunPreview.some((line) => line.includes("承認期限: 2026-05-01 09:00 JST")));
	assert.ok(dryRunPreview.some((line) => line.includes("承認日時: 2026-05-01T00:30:00.000Z")));
	assert.ok(dryRunPreview.some((line) => line.includes("定量評価（実績）｜65点")));
	assert.ok(dryRunPreview.some((line) => line.includes("定性評価（活動ログ）｜35点")));
	assert.ok(dryRunPreview.some((line) => line.includes("補助確認事項（採点対象外）")));
	assert.ok(dryRunPreview.some((line) => line.includes("https://notion.so/activity-1")));
	assert.ok(dryRunPreview.length <= 20);

	assert.deepEqual(
		resolveWajoOpenAiConfigForTest({
			WAJO_OPENAI_API_KEY: "wajo-key",
			OPENAI_API_KEY: "legacy-key",
			WAJO_OPENAI_MODEL: "wajo-model",
			OPENAI_MODEL: "legacy-model",
		}),
		{
			apiKey: "wajo-key",
			model: "wajo-model",
		},
	);
	assert.deepEqual(
		resolveWajoOpenAiConfigForTest({
			OPENAI_API_KEY: "legacy-key",
			OPENAI_MODEL: "legacy-model",
		}),
		{
			apiKey: "legacy-key",
			model: "legacy-model",
		},
	);
	assert.deepEqual(resolveWajoOpenAiConfigForTest({}), {
		apiKey: "",
		model: "gpt-4o-mini",
	});

	assert.equal(
		isAuditOrTestPerformanceForTest(
			{
				監査区分: select("通常監査"),
				AI評価メモ: richText("過去のWorker出力: 監査除外/テストデータとして確認。"),
				上司確認事項: richText("過去の確認事項: 本番評価には反映しない。"),
			},
			"2026年5月 石橋大右｜本番",
		),
		false,
		"通常監査の本番ページは、古いAI出力欄だけで監査/テスト扱いにしない",
	);
	assert.equal(
		isAuditOrTestPerformanceForTest(
			{
				監査区分: select("監査除外"),
				AI評価メモ: richText(""),
				上司確認事項: richText(""),
			},
			"2026年5月 石橋大右｜本番",
		),
		true,
		"監査除外は引き続き監査/テスト扱いにする",
	);

	const cleanupReviewPatches = buildSalesPerformanceReviewPatchesForTest(
		{
			AI評価メモ: richText("既存メモ"),
			上司確認事項: richText(
				[
					"【上司確認事項（要確認）】",
					"4) 本番データ条件（監査除外/テスト/ダミー除外）に該当する要素はないか？",
					"人見さん営業評価Worker要確認: OpenAI API error 429: quota",
					"OpenAI API利用不可のため要確認で停止。AI評価メモ、点数、ランク、評価ステータス確定は変更していません。",
					"人見さん営業評価Worker要確認: OPENAI_API_KEY が未設定です",
					"OpenAI API利用不可のため要確認で停止。AI評価メモ、点数、ランク、評価ステータス確定は変更していません。",
				].join("\n"),
			),
		},
		{
			conclusion: "監査対象外データの確認。",
			resultExplanation: "評価対象外。",
			actionGuidance: "確認のみ。",
			contributionView: "",
			evidence: [],
			personComment: "確認中。",
			managerConfirmationItems: ["確認事項"],
			nextMonthImprovements: [],
			riskNotes: [],
			recommendedStatus: "要確認",
		},
		[],
		true,
	);
	assert.doesNotMatch(cleanupReviewPatches.AI評価メモ.value, /監査除外/);
	assert.doesNotMatch(cleanupReviewPatches.上司確認事項.value, /監査除外|OpenAI API error|OPENAI_API_KEY|OpenAI API利用不可/);
	assert.match(cleanupReviewPatches.上司確認事項.value, /監査対象外/);

	const reviewPatches = buildSalesPerformanceReviewPatchesForTest(
		{
			AI評価メモ: richText(""),
			上司確認事項: richText(""),
			次月改善ポイント: richText(""),
			改善ポイント: richText(""),
			成長ポイント: richText(""),
			次月テーマ: richText(""),
			総合スコア: number(88),
			結果スコア: number(77),
			評価ランク: select("A"),
			評価ステータス: select("レビュー中"),
		},
		{
			conclusion: "数字は強いが、行動ログの継続確認が必要。",
			resultExplanation: "粗利と成約件数は高い。",
			actionGuidance: "活動ログを継続して残す。",
			contributionView: "共有活動は次回確認。",
			evidence: ["粗利実績: 1500000", "活動ログURL: https://notion.so/activity-1"],
			personComment: "次月も事前準備を継続してください。",
			managerConfirmationItems: ["営業貢献ログの未反映を確認する"],
			nextMonthImprovements: ["追客ログを週次で残す"],
			riskNotes: ["活動ログ未集約の古いrelationがある"],
			recommendedStatus: "処理済",
		},
		[],
		false,
	);
	assert.deepEqual(reviewPatches.AI処理状態, { kind: "select", value: "処理済" });
	assert.ok(reviewPatches.AI評価メモ);
	assert.ok(reviewPatches.上司確認事項);
	assert.match(
		String(reviewPatches.AI評価メモ.value),
		/【根拠リンク・材料】/,
	);
	assert.match(
		String(reviewPatches.AI評価メモ.value),
		/https:\/\/notion\.so\/activity-1/,
	);
	assert.match(
		String(reviewPatches.AI評価メモ.value),
		/粗利実績/,
	);
	assert.match(
		String(reviewPatches.AI評価メモ.value),
		/【定量評価（実績）65点】/,
	);
	assert.match(
		String(reviewPatches.AI評価メモ.value),
		/【定性評価（活動ログ）35点】/,
	);
	assert.match(
		String(reviewPatches.AI評価メモ.value),
		/【補助確認事項（採点対象外）】/,
	);
	assert.deepEqual(reviewPatches.次月改善ポイント, {
		kind: "text",
		value: "・追客ログを週次で残す",
	});
	const existingFieldReviewPatches = buildSalesPerformanceReviewPatchesForTest(
		{
			AI評価メモ: richText(""),
			上司確認事項: richText(""),
			次月改善ポイント: richText("既存の次月改善"),
			改善ポイント: richText("既存の改善"),
			成長ポイント: richText("既存の成長"),
			次月テーマ: richText("既存のテーマ"),
		},
		{
			conclusion: "既存欄があっても今回の評価を残す。",
			resultExplanation: "粗利は目標超過。",
			actionGuidance: "接点ログの薄さを補う。",
			contributionView: "共有活動は少ない。",
			evidence: ["粗利実績: 31000000"],
			personComment: "次月は活動ログの密度を上げる。",
			managerConfirmationItems: ["活動ログの薄さを面談で確認する"],
			nextMonthImprovements: ["週次で追客ログを残す", "商談前準備を標準化する"],
			riskNotes: ["活動ログが薄い"],
			recommendedStatus: "処理済",
		},
		[],
		false,
	);
	for (const [propertyName, expected] of [
		["次月改善ポイント", "週次で追客ログを残す"],
		["改善ポイント", "接点ログの薄さを補う"],
		["成長ポイント", "次月は活動ログの密度を上げる"],
		["次月テーマ", "週次で追客ログを残す"],
	] as const) {
		assert.match(
			String(existingFieldReviewPatches[propertyName]?.value),
			/人見さんWorker今回追記:/,
		);
		assert.match(String(existingFieldReviewPatches[propertyName]?.value), /既存/);
		assert.match(String(existingFieldReviewPatches[propertyName]?.value), new RegExp(expected));
	}

	const duplicatedCurrentMemo = [
		"前回の人見さん返却",
		"人見さんWorker一次評価案: 2026-01-01T00:00:00.000Z",
		"旧メモの本文",
		"",
		"人見さん確認事項: 2026-01-01T00:00:00.000Z",
		"旧の面談論点",
		"",
		"人見さんWorker一次評価案: 2025-12-31T00:00:00.000Z",
		"さらに古いメモ",
	].join("\n");
	const duplicateBlockPatches = buildSalesPerformanceReviewPatchesForTest(
		{
			AI評価メモ: richText(duplicatedCurrentMemo),
			上司確認事項: richText("前回の面談論点\n人見さん確認事項: 古い論点"),
			次月改善ポイント: richText(""),
			改善ポイント: richText(""),
			成長ポイント: richText(""),
			次月テーマ: richText(""),
		},
		{
			conclusion: "重複履歴が残るケースでも最新を1回だけ残す。",
			resultExplanation: "重複補正を確認する。",
			actionGuidance: "重複した旧評価文言を確認しつつ更新する。",
			contributionView: "対象行動を再集計する。",
			evidence: ["定量実績: 12000000"],
			personComment: "今回のコメントを残す。",
			managerConfirmationItems: ["重複があっても最終1回分を確認する。"],
			nextMonthImprovements: ["重複監査フローを整える。"],
			riskNotes: ["重複履歴を確認。"],
			recommendedStatus: "要確認",
		},
		[],
		false,
	);
	const duplicateMemoText = String(duplicateBlockPatches.AI評価メモ.value);
	assert.equal(
		(duplicateMemoText.match(/人見さんWorker一次評価案:/g) || []).length,
		1,
		"AI評価メモは直近1回分の人見さんWorker見出しだけを残す",
	);
	assert.match(duplicateMemoText, /前回の人見さん返却/);
	assert.match(duplicateMemoText, /重複履歴を確認/);

	const longExistingMemo = "既存メモ".repeat(400);
	const longMemoReviewPatches = buildSalesPerformanceReviewPatchesForTest(
		{
			AI評価メモ: richText(longExistingMemo),
			上司確認事項: richText(longExistingMemo),
			次月改善ポイント: richText(""),
			改善ポイント: richText(""),
			成長ポイント: richText(""),
			次月テーマ: richText(""),
		},
		{
			conclusion: "長文既存メモでも今回の評価案を残す。",
			resultExplanation: "定量評価は目標を超過。",
			actionGuidance: "定性評価は活動ログを継続。",
			contributionView: "営業貢献ログも確認済み。",
			evidence: ["活動ログURL: https://notion.so/activity-1"],
			personComment: "今回のコメントを必ず残す。",
			managerConfirmationItems: ["今回の面談論点を必ず残す"],
			nextMonthImprovements: ["次月テーマを残す"],
			riskNotes: [],
			recommendedStatus: "処理済",
		},
		[],
		false,
	);
	assert.match(
		String(longMemoReviewPatches.AI評価メモ.value),
		/人見さんWorker一次評価案:/,
	);
	assert.match(String(longMemoReviewPatches.AI評価メモ.value), /定量評価（実績）65点/);
	assert.match(String(longMemoReviewPatches.AI評価メモ.value), /今回のコメントを必ず残す/);
	assert.match(
		String(longMemoReviewPatches.上司確認事項.value),
		/人見さん確認事項:/,
	);
	assert.match(
		String(longMemoReviewPatches.上司確認事項.value),
		/今回の面談論点を必ず残す/,
	);
	for (const forbidden of [
		"総合スコア",
		"総合スコア（自動）",
		"結果スコア",
		"評価ランク",
		"評価ステータス",
		"評価点",
		"確定評価",
		"給与",
		"報酬",
		"昇格予定",
		"処遇",
	]) {
		assert.equal(
			Object.hasOwn(reviewPatches, forbidden),
			false,
			`人見さん本実行patchが${forbidden}を変更してはいけない`,
		);
	}

	assert.equal(
		isHitomiMemoEvaluationEvidenceForTest({
			評価材料化状態: select("月次評価で確認"),
			月次評価反映状態: select("未反映"),
		}),
		true,
	);
	assert.equal(
		isWaniPoMemoryEvaluationEvidenceForTest({
			評価利用可否: select("評価には使わない"),
			月次評価反映状態: select("反映候補"),
			公開範囲: select("本人共有済み"),
		}),
		false,
	);
	assert.equal(
		isWaniPoMemoryEvaluationEvidenceForTest({
			評価利用可否: select("本人共有済み"),
			月次評価反映状態: select("反映候補"),
			公開範囲: select("本人のみ"),
		}),
		false,
	);
	assert.equal(
		isWaniPoMemoryEvaluationEvidenceForTest({
			評価利用可否: select("本人共有済み"),
			月次評価反映状態: select("反映候補"),
			公開範囲: select("チーム共有"),
		}),
		true,
	);

	const activityCreateArgs = buildActivityLogFromContactLogForTest(
		{
			id: "contact-1",
			url: "https://notion.so/contact-1",
			properties: {
				接点タイトル: title("2026-06-09｜電話｜初回追客"),
				活動種別: select("電話"),
				活動内容: richText("初回追客を実施し、提案条件を確認した。"),
				次回アクション: richText("見積書を送付する。"),
				接点日時: date("2026-06-09"),
				担当営業ユーザー: people(["sales-1"]),
				関連企業: relation(["company-1"]),
				関連商談: relation(["deal-1"]),
			},
		},
		"hitomi-test-run",
	);
	assert.ok(activityCreateArgs);
	assert.deepEqual(activityCreateArgs.parent, {
		data_source_id: "a58a107d-92e3-43f3-887d-5e3acf72e9ec",
	});
	const activityProps = activityCreateArgs.properties as Record<string, unknown>;
	assert.match(JSON.stringify(activityProps.活動タイトル), /2026-06-09｜電話｜初回追客/);
	assert.match(JSON.stringify(activityProps.活動ログ), /初回追客を実施/);
	assert.match(JSON.stringify(activityProps.AIサマリ), /初回追客を実施/);
	assert.deepEqual(activityProps.評価対象, { checkbox: true });
	assert.match(JSON.stringify(activityProps.Worker処理ID), /hitomi-test-run/);
	assert.deepEqual(activityProps.関連顧客接点ログ, relationPayload(["contact-1"]));
	assert.deepEqual(activityProps.関連企業, relationPayload(["company-1"]));
	assert.deepEqual(activityProps.関連商談, relationPayload(["deal-1"]));

	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-empty",
				properties: {
					接点タイトル: title(""),
					活動内容: richText(""),
					次回アクション: richText(""),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-title-only",
				properties: {
					接点タイトル: title("問-260606-001｜売｜安田聡｜蓄電池｜バ｜⚠"),
					活動内容: richText(""),
					次回アクション: richText(""),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-audit",
				properties: {
					接点タイトル: title("【リリース確認｜削除可】活動buttonクリック確認"),
					活動内容: richText("クリック確認だけの検証ログ"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-english-test",
				properties: {
					接点タイトル: title("問-260515-006｜② 購入相談｜荒木 昭博｜相談"),
					活動内容: richText("Test this."),
					活動種別: select("資料送付"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-gibberish",
				properties: {
					接点タイトル: title("問-260511-002｜① 売却査定｜井芹将斗｜売却｜太陽光発電所"),
					活動内容: richText("wmふぁえwsfhれい"),
					活動種別: select("オンライン商談"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-short-gibberish",
				properties: {
					接点タイトル: title("問-260514-001｜⑤ 蓄電池｜増"),
					活動内容: richText("、lkっjhv"),
					活動種別: select("現地調査"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-too-short",
				properties: {
					接点タイトル: title("問-260522-004｜⑤ 蓄電池｜井上正明｜売却"),
					活動内容: richText("給"),
					活動種別: select("社内確認"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-too-vague-online",
				properties: {
					接点タイトル: title("問-260521-001｜① 売却査定｜藤川 亮｜売却｜太陽光発電所"),
					活動内容: richText("オンラインしました？"),
					活動種別: select("オンライン商談"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-too-vague-used",
				properties: {
					接点タイトル: title("問-260514-003｜⑦ その他｜川野 宏一"),
					活動内容: richText("即利用しました。"),
					活動種別: select("測量"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-yes-noise",
				properties: {
					接点タイトル: title("問-260516-001｜⑦ その他｜野崎隆之"),
					活動内容: richText("YES、YES、YESの、3回、4回、5回のYES！"),
					次回アクション: richText("次回アクションは、石橋大右の件です。"),
					活動種別: select("オンライン商談"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-food-noise",
				properties: {
					接点タイトル: title("問-260516-001｜⑦ その他｜野崎隆之"),
					活動内容: richText("食料行って帰り、YES!"),
					活動種別: select("測量"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-system-design-note",
				properties: {
					接点タイトル: title("問-260521-003｜① 売却査定｜手銭充｜売却｜太陽光発電所"),
					活動内容: richText(
						"これ、見せてもらった案件でちょっと頭がややこしくなっていたんですけど。会社の場合、問い合わせの内容は「売る」とか「買う」とかじゃなく、もう「売りたい」だけに絞った方がいいと思うんですけど、どうでしょうか？",
					),
					活動種別: select("オンライン商談"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-transcribed-noise",
				properties: {
					接点タイトル: title("2026-05-26｜資料送付｜Transcribed text."),
					活動内容: richText("Transcribed text."),
					活動種別: select("資料送付"),
					活動表示: richText("2026-05-26｜資料送付｜Transcribed text."),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-forward-noise",
				properties: {
					接点タイトル: title("2026-05-26｜活動｜Fw: 和上ホールディングス【ゼロカーボン総合支援】"),
					活動表示: richText("2026-05-26｜活動｜Fw: 和上ホールディングス【ゼロカーボン総合支援】"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-display-only-noise",
				properties: {
					接点タイトル: title("2026-05-26｜活動｜とくとくファーム【太陽光発電所のかんたん査定】"),
					活動ログ: richText("2026-05-26｜活動｜とくとくファーム【太陽光発電所のかんたん査定】"),
					活動表示: richText("2026-05-26｜活動｜とくとくファーム【太陽光発電所のかんたん査定】"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-inquiry-title-only-with-kind",
				properties: {
					接点タイトル: title("2026-05-25｜電話｜とくとくファーム【お問い合わせ】"),
					活動種別: select("電話"),
					活動ログ: richText("2026-05-25｜電話｜とくとくファーム【お問い合わせ】"),
					活動表示: richText("2026-05-25｜電話｜とくとくファーム【お問い合わせ】"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-chinese-test-noise",
				properties: {
					接点タイトル: title("2026-05-26｜Zoom｜測試 24"),
					活動内容: richText("測試 24"),
					活動種別: select("Zoom"),
					活動表示: richText("2026-05-26｜Zoom｜測試 24"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-unsure-switch-noise",
				properties: {
					接点タイトル: title("2026-05-26｜Zoom｜まだわからんけどな。"),
					活動内容: richText("まだわからんけどな。どうなるかわからんし、一致するか分からんな。"),
					次回アクション: richText("次回のアクションはSwitchです。"),
					活動種別: select("Zoom"),
					活動表示: richText("2026-05-26｜Zoom｜まだわからんけどな。どうなるかわからんし、一致するか分からんな。"),
				},
			},
			"hitomi-test-run",
		),
		null,
	);
	const validNegotiationArgs = buildActivityLogFromContactLogForTest(
		{
			id: "contact-valid-negotiation",
			properties: {
				接点タイトル: title("2026-05-26｜メール｜資料をいただく交渉と、値段の交渉"),
				活動内容: richText("資料をいただく交渉と、値段の交渉"),
				次回アクション: richText("¡Ah, sí, Hormón!"),
				活動種別: select("メール"),
				活動表示: richText("2026-05-26｜メール｜資料をいただく交渉と、値段の交渉"),
			},
		},
		"hitomi-test-run",
	);
	assert.ok(validNegotiationArgs);
	assert.match(JSON.stringify(validNegotiationArgs.properties), /資料をいただく交渉/);
	assert.doesNotMatch(JSON.stringify(validNegotiationArgs.properties), /Hormón/);
	assert.ok(
		buildActivityLogFromContactLogForTest(
			{
				id: "contact-valid-exclusive",
				properties: {
					接点タイトル: title("2026-05-26｜対面商談｜専売交渉成功 資料以下の通り"),
					活動内容: richText("専売交渉成功　資料以下の通り"),
					活動種別: select("対面商談"),
					活動表示: richText("2026-05-26｜対面商談｜専売交渉成功 資料以下の通り"),
				},
			},
			"hitomi-test-run",
		),
	);

	const creates: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const reflectionNotion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				assert.equal(args.data_source_id, "b65c13b4-1a72-4c58-8d2d-305c3e04a561");
				assert.match(JSON.stringify(args.filter), /活動ログ反映状態/);
				return {
					results: [
						{
							id: "contact-1",
							properties: {
								接点タイトル: title("2026-06-09｜電話｜初回追客"),
								活動種別: select("電話"),
								活動内容: richText("初回追客を実施し、提案条件を確認した。"),
								次回アクション: richText("見積書を送付する。"),
								接点日時: date("2026-06-09"),
								担当営業ユーザー: people(["sales-1"]),
								関連企業: relation(["company-1"]),
								関連商談: relation(["deal-1"]),
							},
						},
						{
							id: "contact-empty",
							properties: {
								接点タイトル: title(""),
								活動内容: richText(""),
								次回アクション: richText(""),
							},
						},
					],
				};
			},
		},
		pages: {
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return { id: "activity-created-1", properties: {} };
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id, properties: {} };
			},
			retrieve: async () => ({ id: "unused", properties: {} }),
		},
	};

	const reflection = await reflectCustomerContactLogsToActivityLogsForTest(
		{ limit: 10, workerRunId: "hitomi-test-run" },
		reflectionNotion as never,
	);
	assert.deepEqual(reflection, {
		scanned: 2,
		created: 1,
		skipped: 1,
		errors: 0,
	});
	assert.equal(creates.length, 1);
	assert.ok(
		updates.some((update) => {
			const props = update.properties as Record<string, unknown>;
			return update.page_id === "contact-1" && JSON.stringify(props).includes("反映済み");
		}),
	);
	assert.ok(
		updates.some((update) => {
			const props = update.properties as Record<string, unknown>;
			return update.page_id === "contact-empty" && JSON.stringify(props).includes("対象外");
		}),
	);

	const speechCreateArgs = buildActivityLogFromSpeechLogForTest(
		{
			id: "speech-good",
			url: "https://notion.so/speech-good",
			created_time: "2026-05-22T02:57:00.000Z",
			created_by: { id: "sales-1" },
			properties: {
				発言タイトル: title("クレーム対応記録"),
				発言カテゴリ: select("報告"),
				発言内容: richText("連絡がつきにくい状況をなくすため、全営業マンの連絡徹底を進言した。"),
				発言日時: date("2026-05-22"),
				発言者: people(["sales-1"]),
				関連企業: relation(["company-1"]),
				関連会議: relation(["meeting-1"]),
			},
		},
		"speech-run",
	);
	assert.ok(speechCreateArgs);
	const speechProps = speechCreateArgs.properties as Record<string, unknown>;
	assert.deepEqual(speechProps.関連発言, relationPayload(["speech-good"]));
	assert.deepEqual(speechProps.関連企業, relationPayload(["company-1"]));
	assert.deepEqual(speechProps.関連ミーティング, relationPayload(["meeting-1"]));
	assert.match(JSON.stringify(speechProps.活動者), /sales-1/);
	assert.match(JSON.stringify(speechProps.Worker処理ID), /speech-run/);
	assert.equal(
		buildActivityLogFromSpeechLogForTest(
			{
				id: "speech-empty",
				properties: {
					発言タイトル: title(""),
					発言内容: richText(""),
				},
			},
			"speech-run",
		),
		null,
	);
	assert.equal(
		buildActivityLogFromSpeechLogForTest(
			{
				id: "speech-audit",
				properties: {
					発言タイトル: title("【AIテスト】発言ログ連携確認"),
					発言内容: richText("検証用の発言です。"),
				},
			},
			"speech-run",
		),
		null,
	);

	const contributionCreateArgs = buildActivityLogFromSalesContributionLogForTest(
		{
			id: "contribution-good",
			url: "https://notion.so/contribution-good",
			created_time: "2026-06-02T19:08:00.000Z",
			created_by: { id: "sales-1" },
			properties: {
				貢献タイトル: title("蓄電池ナレッジ共有"),
				種別: select("ナレッジ採用"),
				貢献カテゴリ: select("ナレッジ共有"),
				貢献インパクト: select("中"),
				AIコメント: richText("他メンバーの提案準備に寄与した。"),
				承認ステータス: select("承認"),
				評価反映状態: select("未反映"),
				ポイント: rollupNumber(5),
				日付: date("2026-06-02"),
				対象営業ユーザー: people(["sales-1"]),
				関連商談: relation(["deal-1"]),
			},
		},
		"contribution-run",
	);
	assert.ok(contributionCreateArgs);
	const contributionProps = contributionCreateArgs.properties as Record<string, unknown>;
	assert.deepEqual(contributionProps.関連営業貢献ログ, relationPayload(["contribution-good"]));
	assert.deepEqual(contributionProps.関連商談, relationPayload(["deal-1"]));
	assert.match(JSON.stringify(contributionProps.活動者), /sales-1/);
	assert.match(JSON.stringify(contributionProps.活動ログ), /ポイント/);
	assert.equal(
		buildActivityLogFromSalesContributionLogForTest(
			{
				id: "contribution-audit",
				properties: {
					貢献タイトル: title("【AI本流】問い合わせストレステスト"),
					AIコメント: richText("検証用です。"),
				},
			},
			"contribution-run",
		),
		null,
	);

	const hitomiMemoCreateArgs = buildActivityLogFromHitomiMemoForTest(
		{
			id: "hitomi-memo-good",
			url: "https://notion.so/hitomi-memo-good",
			created_time: "2026-06-05T09:00:00.000Z",
			created_by: { id: "manager-1" },
			properties: {
				メモ名: title("初動改善の評価メモ"),
				ひとこと原文: richText("初回提案前にAIで論点を整理してから商談に入れていた。"),
				人見さん整理メモ: richText("事前準備の型化として評価材料になる。"),
				メモ種別: select("ポジティブ評価"),
				評価材料化状態: select("月次評価で確認"),
				月次評価反映状態: select("未反映"),
				AI活用カテゴリ: select("相談・壁打ち"),
				AI活用ポイント: number(2),
				AI活用ポイント状態: select("加点候補"),
				AI活用ポイント理由: richText("AIを商談準備の質向上に使えている。"),
				次アクション: richText("次月も商談前の論点整理を継続する。"),
				報告日: date("2026-06-05"),
				対象スタッフ: people(["sales-1"]),
			},
		},
		"hitomi-memo-run",
	);
	assert.ok(hitomiMemoCreateArgs);
	const hitomiMemoProps = hitomiMemoCreateArgs.properties as Record<string, unknown>;
	assert.deepEqual(hitomiMemoProps.関連人見さんメモ, relationPayload(["hitomi-memo-good"]));
	assert.deepEqual(hitomiMemoProps.評価対象, { checkbox: false });
	assert.match(JSON.stringify(hitomiMemoProps.活動者), /sales-1/);
	assert.match(JSON.stringify(hitomiMemoProps.活動ログ), /AI活用ポイント/);
	assert.match(JSON.stringify(hitomiMemoProps.Worker処理ID), /hitomi-memo-run/);
	assert.equal(
		buildActivityLogFromHitomiMemoForTest(
			{
				id: "hitomi-memo-no-evidence",
				properties: {
					メモ名: title("雑談メモ"),
					ひとこと原文: richText("支援文脈だけのメモ。"),
					評価材料化状態: select("未確認"),
					月次評価反映状態: select("未反映"),
				},
			},
			"hitomi-memo-run",
		),
		null,
	);

	const waniPoCreateArgs = buildActivityLogFromWaniPoMemoryForTest(
		{
			id: "wanipo-good",
			url: "https://notion.so/wanipo-good",
			created_time: "2026-06-06T09:00:00.000Z",
			created_by: { id: "sales-1" },
			properties: {
				メモ名: title("提案前の違和感メモ"),
				原文メモ: richText("提案条件が弱い気がしたのでAIに相談して整理した。"),
				ワニポ整理メモ: richText("違和感を言語化し、次の確認事項に変換できている。"),
				メモ種別: select("気づき"),
				公開範囲: select("本人と石橋"),
				評価利用可否: select("本人共有済み"),
				月次評価反映状態: select("反映候補"),
				AI活用カテゴリ: select("ぼやき・違和感を言語化"),
				AI活用ポイント: number(1),
				AI活用ポイント状態: select("加点候補"),
				AI活用ポイント理由: richText("AIを使って違和感を行動に変えた。"),
				次の声かけ: richText("この違和感の出し方を継続する。"),
				記録日: date("2026-06-06"),
				対象スタッフ: people(["sales-1"]),
			},
		},
		"wanipo-run",
	);
	assert.ok(waniPoCreateArgs);
	const waniPoProps = waniPoCreateArgs.properties as Record<string, unknown>;
	assert.deepEqual(waniPoProps.関連ワニポメモリー, relationPayload(["wanipo-good"]));
	assert.deepEqual(waniPoProps.評価対象, { checkbox: false });
	assert.match(JSON.stringify(waniPoProps.活動者), /sales-1/);
	assert.match(JSON.stringify(waniPoProps.活動ログ), /本人共有済み/);
	assert.equal(
		buildActivityLogFromWaniPoMemoryForTest(
			{
				id: "wanipo-private",
				properties: {
					メモ名: title("本人だけのぼやき"),
					原文メモ: richText("本人のみの支援メモ。"),
					公開範囲: select("本人のみ"),
					評価利用可否: select("本人共有済み"),
					月次評価反映状態: select("反映候補"),
				},
			},
			"wanipo-run",
		),
		null,
	);

	const aiConsultationCreateArgs = buildActivityLogFromAiConsultationForTest(
		{
			id: "ai-consultation-good",
			url: "https://notion.so/ai-consultation-good",
			created_time: "2026-06-07T09:00:00.000Z",
			created_by: { id: "sales-1" },
			properties: {
				"相談内容 1": title("商談前の論点整理"),
				相談先エージェント: select("人見さん"),
				処理状態: status("完了"),
				AI回答: richText("提案前に確認すべき条件と次アクションを整理した。"),
				相談者: people(["sales-1"]),
			},
		},
		"ai-consultation-run",
	);
	assert.ok(aiConsultationCreateArgs);
	const aiConsultationProps = aiConsultationCreateArgs.properties as Record<string, unknown>;
	assert.deepEqual(aiConsultationProps.評価対象, { checkbox: false });
	assert.equal(aiConsultationProps.関連AI活用ログ, undefined);
	assert.match(JSON.stringify(aiConsultationProps.活動者), /sales-1/);
	assert.match(JSON.stringify(aiConsultationProps.活動ログ), /AI相談受付/);
	assert.match(JSON.stringify(aiConsultationProps.Worker処理ID), /ai-consultation-run/);
	assert.equal(
		buildActivityLogFromAiConsultationForTest(
			{
				id: "ai-consultation-unfinished",
				properties: {
					"相談内容 1": title("未完了相談"),
					処理状態: status("処理中"),
					AI回答: richText("まだ処理中です。"),
				},
			},
			"ai-consultation-run",
		),
		null,
	);

	const speechCreates: Array<Record<string, unknown>> = [];
	const speechUpdates: Array<Record<string, unknown>> = [];
	const speechNotion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				assert.equal(args.data_source_id, "86f5693c-db36-4356-aec1-210495f6032a");
				assert.match(JSON.stringify(args.filter), /関連活動/);
				return {
					results: [
						{
							id: "speech-good",
							created_time: "2026-05-22T02:57:00.000Z",
							created_by: { id: "sales-1" },
							properties: {
								発言タイトル: title("クレーム対応記録"),
								発言内容: richText("対応遅延をなくすための改善提案を残した。"),
								発言者: people(["sales-1"]),
							},
						},
						{
							id: "speech-empty",
							properties: {
								発言タイトル: title(""),
								発言内容: richText(""),
							},
						},
					],
				};
			},
		},
		pages: {
			create: async (args: Record<string, unknown>) => {
				speechCreates.push(args);
				return { id: "activity-speech-created", properties: {} };
			},
			update: async (args: Record<string, unknown>) => {
				speechUpdates.push(args);
				return { id: args.page_id, properties: args.properties ?? {} };
			},
		},
	};
	const speechReflection = await reflectSpeechLogsToActivityLogsForTest(
		{ limit: 10 },
		speechNotion as never,
	);
	assert.deepEqual(speechReflection, {
		scanned: 2,
		created: 1,
		skipped: 1,
		errors: 0,
	});
	assert.equal(speechCreates.length, 1);
	assert.ok(
		speechUpdates.some((update) => {
			const props = update.properties as Record<string, unknown>;
			return update.page_id === "speech-good" && JSON.stringify(props).includes("speech-log-speech-good");
		}),
	);

	const contributionCreates: Array<Record<string, unknown>> = [];
	const contributionUpdates: Array<Record<string, unknown>> = [];
	const contributionNotion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				assert.equal(args.data_source_id, "f88056da-3052-418e-8cf4-e9b4197cd7ba");
				assert.match(JSON.stringify(args.filter), /評価反映状態/);
				assert.match(JSON.stringify(args.filter), /承認ステータス/);
				return {
					results: [
						{
							id: "contribution-good",
							created_time: "2026-06-02T19:08:00.000Z",
							created_by: { id: "sales-1" },
							properties: {
								貢献タイトル: title("蓄電池ナレッジ共有"),
								AIコメント: richText("他メンバーの提案準備に寄与した。"),
								承認ステータス: select("承認"),
								評価反映状態: select("未反映"),
								日付: date("2026-06-02"),
								対象営業ユーザー: people(["sales-1"]),
							},
						},
						{
							id: "contribution-audit",
							properties: {
								貢献タイトル: title("【AI本流】問い合わせストレステスト"),
								AIコメント: richText("検証用です。"),
							},
						},
					],
				};
			},
		},
		pages: {
			create: async (args: Record<string, unknown>) => {
				contributionCreates.push(args);
				return { id: "activity-contribution-created", properties: {} };
			},
			update: async (args: Record<string, unknown>) => {
				contributionUpdates.push(args);
				return { id: args.page_id, properties: args.properties ?? {} };
			},
		},
	};
	const contributionReflection = await reflectSalesContributionLogsToActivityLogsForTest(
		{ limit: 10 },
		contributionNotion as never,
	);
	assert.deepEqual(contributionReflection, {
		scanned: 2,
		created: 1,
		skipped: 1,
		errors: 0,
	});
	assert.equal(contributionCreates.length, 1);
	assert.ok(
		contributionUpdates.some((update) => {
			const props = update.properties as Record<string, unknown>;
			return update.page_id === "contribution-good" && JSON.stringify(props).includes("反映済み");
		}),
	);
	assert.ok(
		contributionUpdates.some((update) => {
			const props = update.properties as Record<string, unknown>;
			return update.page_id === "contribution-audit" && JSON.stringify(props).includes("対象外");
		}),
	);

	const hitomiMemoCreates: Array<Record<string, unknown>> = [];
	const hitomiMemoUpdates: Array<Record<string, unknown>> = [];
	const hitomiMemoNotion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				assert.equal(args.data_source_id, "a1118ded-21b2-4636-94fb-a868aefb5168");
				assert.match(JSON.stringify(args.filter), /評価材料化状態/);
				assert.match(JSON.stringify(args.filter), /月次評価反映状態/);
				return {
					results: [
						{
							id: "hitomi-memo-good",
							created_time: "2026-06-05T09:00:00.000Z",
							properties: {
								メモ名: title("初動改善の評価メモ"),
								ひとこと原文: richText("初回提案前にAIで論点を整理した。"),
								評価材料化状態: select("月次評価で確認"),
								月次評価反映状態: select("未反映"),
								報告日: date("2026-06-05"),
								対象スタッフ: people(["sales-1"]),
							},
						},
						{
							id: "hitomi-memo-empty",
							properties: {
								メモ名: title(""),
								評価材料化状態: select("月次評価で確認"),
								月次評価反映状態: select("未反映"),
							},
						},
					],
				};
			},
		},
		pages: {
			create: async (args: Record<string, unknown>) => {
				hitomiMemoCreates.push(args);
				return { id: "activity-hitomi-memo-created", properties: {} };
			},
			update: async (args: Record<string, unknown>) => {
				hitomiMemoUpdates.push(args);
				return { id: args.page_id, properties: args.properties ?? {} };
			},
		},
	};
	const hitomiMemoReflection = await reflectHitomiMemosToActivityLogsForTest(
		{ limit: 10 },
		hitomiMemoNotion as never,
	);
	assert.deepEqual(hitomiMemoReflection, {
		scanned: 2,
		created: 1,
		skipped: 1,
		errors: 0,
	});
	assert.equal(hitomiMemoCreates.length, 1);
	assert.ok(
		hitomiMemoUpdates.some((update) => {
			const props = update.properties as Record<string, unknown>;
			return update.page_id === "hitomi-memo-good" && JSON.stringify(props).includes("反映済み");
		}),
	);

	const waniPoCreates: Array<Record<string, unknown>> = [];
	const waniPoUpdates: Array<Record<string, unknown>> = [];
	const waniPoNotion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				assert.equal(args.data_source_id, "b8b06036-4f7e-4efe-a242-2df47ff29b1e");
				assert.match(JSON.stringify(args.filter), /評価利用可否/);
				assert.match(JSON.stringify(args.filter), /本人のみ/);
				return {
					results: [
						{
							id: "wanipo-good",
							created_time: "2026-06-06T09:00:00.000Z",
							properties: {
								メモ名: title("提案前の違和感メモ"),
								原文メモ: richText("提案条件が弱い気がしたのでAIに相談した。"),
								公開範囲: select("本人と石橋"),
								評価利用可否: select("本人共有済み"),
								月次評価反映状態: select("反映候補"),
								記録日: date("2026-06-06"),
								対象スタッフ: people(["sales-1"]),
							},
						},
						{
							id: "wanipo-empty",
							properties: {
								メモ名: title(""),
								公開範囲: select("本人と石橋"),
								評価利用可否: select("本人共有済み"),
								月次評価反映状態: select("反映候補"),
							},
						},
					],
				};
			},
		},
		pages: {
			create: async (args: Record<string, unknown>) => {
				waniPoCreates.push(args);
				return { id: "activity-wanipo-created", properties: {} };
			},
			update: async (args: Record<string, unknown>) => {
				waniPoUpdates.push(args);
				return { id: args.page_id, properties: args.properties ?? {} };
			},
		},
	};
	const waniPoReflection = await reflectWaniPoMemoriesToActivityLogsForTest(
		{ limit: 10 },
		waniPoNotion as never,
	);
	assert.deepEqual(waniPoReflection, {
		scanned: 2,
		created: 1,
		skipped: 1,
		errors: 0,
	});
	assert.equal(waniPoCreates.length, 1);
	assert.ok(
		waniPoUpdates.some((update) => {
			const props = update.properties as Record<string, unknown>;
			return update.page_id === "wanipo-good" && JSON.stringify(props).includes("反映済み");
		}),
	);

	const aiConsultationCreates: Array<Record<string, unknown>> = [];
	let aiConsultationQueryCount = 0;
	const aiConsultationNotion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				aiConsultationQueryCount += 1;
				if (aiConsultationQueryCount === 1) {
					assert.equal(args.data_source_id, "28c78664-8b8c-419d-9488-ef991d60ab98");
					assert.match(JSON.stringify(args.filter), /処理状態/);
					return {
						results: [
							{
								id: "ai-consultation-good",
								url: "https://notion.so/ai-consultation-good",
								created_time: "2026-06-07T09:00:00.000Z",
								created_by: { id: "sales-1" },
								properties: {
									"相談内容 1": title("商談前の論点整理"),
									相談先エージェント: select("人見さん"),
									処理状態: status("完了"),
									AI回答: richText("提案前に確認すべき条件と次アクションを整理した。"),
									相談者: people(["sales-1"]),
								},
							},
						],
					};
				}
				assert.equal(args.data_source_id, "a58a107d-92e3-43f3-887d-5e3acf72e9ec");
				assert.match(JSON.stringify(args.filter), /Worker処理ID/);
				return { results: [] };
			},
		},
		pages: {
			create: async (args: Record<string, unknown>) => {
				aiConsultationCreates.push(args);
				return { id: "activity-ai-consultation-created", properties: {} };
			},
		},
	};
	const aiConsultationReflection = await reflectAiConsultationsToActivityLogsForTest(
		{ limit: 10 },
		aiConsultationNotion as never,
	);
	assert.deepEqual(aiConsultationReflection, {
		scanned: 1,
		created: 1,
		skipped: 0,
		errors: 0,
	});
	assert.equal(aiConsultationCreates.length, 1);
	assert.equal(
		(aiConsultationCreates[0].properties as Record<string, unknown>).関連AI活用ログ,
		undefined,
	);

	const linkUpdates: Array<Record<string, unknown>> = [];
	const linkNotion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				if (args.data_source_id === "a58a107d-92e3-43f3-887d-5e3acf72e9ec") {
					assert.match(JSON.stringify(args.filter), /関連営業パフォーマンス/);
					return {
						results: [
							{
								id: "activity-link-1",
								properties: {
									活動タイトル: title("2026-06-09｜電話｜初回追客"),
									活動日時: date("2026-06-09"),
									活動者: people(["sales-1"]),
									関連営業パフォーマンス: relation([]),
								},
							},
						],
					};
				}
				assert.equal(args.data_source_id, "e67ec5d5-90d3-4118-9788-976a6f5c94a1");
				assert.match(JSON.stringify(args.filter), /対象営業ユーザー/);
				assert.match(JSON.stringify(args.filter), /開始日/);
				assert.match(JSON.stringify(args.filter), /終了日/);
				return {
					results: [
						{
							id: "performance-2026-06",
							properties: {
								評価名: title("2026年6月 営業A"),
								対象営業ユーザー: people(["sales-1"]),
								開始日: date("2026-06-01"),
								終了日: date("2026-06-30"),
								関連活動ログ: relation([]),
							},
						},
					],
				};
			},
		},
		pages: {
			update: async (args: Record<string, unknown>) => {
				linkUpdates.push(args);
				return { id: args.page_id, properties: args.properties ?? {} };
			},
		},
	};
	const linkResult = await linkActivityLogsToSalesPerformanceForTest(
		{ limit: 5 },
		linkNotion as never,
	);
	assert.deepEqual(linkResult, {
		scanned: 1,
		linked: 1,
		skipped: 0,
		errors: 0,
	});
	assert.ok(
		linkUpdates.some((update) => {
			const props = update.properties as Record<string, unknown>;
			return update.page_id === "activity-link-1" && JSON.stringify(props).includes("performance-2026-06");
		}),
	);
	assert.ok(
		linkUpdates.some((update) => {
			const props = update.properties as Record<string, unknown>;
			return update.page_id === "performance-2026-06" && JSON.stringify(props).includes("activity-link-1");
		}),
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
