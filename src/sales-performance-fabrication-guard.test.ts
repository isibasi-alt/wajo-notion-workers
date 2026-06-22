import assert from "node:assert/strict";
import {
	applySalesPerformanceQualitativeGuardForTest,
	buildSalesPerformanceRelatedSourceWithStatsForTest,
	buildSalesPerformanceReviewPromptsForTest,
	SALES_PERFORMANCE_QUALITATIVE_MISSING_TEXT_FOR_TEST,
	SALES_PERFORMANCE_QUALITATIVE_MISSING_PERSON_COMMENT_FOR_TEST,
	SALES_PERFORMANCE_QUALITATIVE_MISSING_IMPROVEMENT_FOR_TEST,
	SALES_PERFORMANCE_QUALITATIVE_MISSING_MANAGER_ITEM_FOR_TEST,
	SALES_PERFORMANCE_QUANTITATIVE_ONLY_CONCLUSION_PREFIX_FOR_TEST,
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

function checkbox(value: boolean) {
	return { type: "checkbox", checkbox: value };
}

const retrievedPages: Record<string, Record<string, unknown>> = {
	// 定性ソースあり: 評価対象 + 関連発言1件 + 関連顧客接点ログ1件
	"activity-with-logs": {
		活動タイトル: title("初回提案後の追客活動"),
		活動種別: select("顧客接点"),
		評価対象: checkbox(true),
		AIサマリ: richText("顧客の温度感を確認した。"),
		関連発言: relation(["speech-1"]),
		関連顧客接点ログ: relation(["contact-1"]),
	},
	// 定性ソースなし: 評価対象だが対象3ログ（発言/接点/貢献）が空
	"activity-empty": {
		活動タイトル: title("中身のない活動ログ"),
		評価対象: checkbox(true),
	},
	"speech-1": {
		名前: title("価格条件の説明"),
		発言内容: richText("価格条件を丁寧に説明した。"),
	},
	"contact-1": {
		名前: title("顧客接点メモ"),
		活動内容: richText("現地調査の日程を調整した。"),
	},
};

const notion = {
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => ({
			id: page_id,
			url: `https://notion.so/${page_id}`,
			properties: retrievedPages[page_id] ?? {
				名前: title(`missing-${page_id}`),
			},
		}),
	},
};

const sampleReview = {
	conclusion: "結論テキスト",
	resultExplanation:
		"定量の説明\n【勝ちパターン化（営業貢献ログ）25点】ここに混ざったらコード側で切る",
	actionGuidance: "捏造された定性評価コメント",
	contributionView: "捏造された貢献の見え方",
	evidence: ["成約件数: 1"],
	personComment: "本人コメント",
	managerConfirmationItems: ["確認事項"],
	nextMonthImprovements: ["改善1"],
	riskNotes: [],
	recommendedStatus: "処理済" as const,
};

async function main() {
	// --- 1. 定性ログ件数の集計（WithStats） ---

	// 1-a. 定性ソース0件（活動ログ自体が無い）
	const noActivity = await buildSalesPerformanceRelatedSourceWithStatsForTest(
		notion as never,
		{},
	);
	assert.equal(noActivity.qualitativeLogCounts.speechLogs, 0);
	assert.equal(noActivity.qualitativeLogCounts.customerContactLogs, 0);
	assert.equal(noActivity.qualitativeLogCounts.contributionLogs, 0);
	assert.match(noActivity.source, /活動ログ未接続/);

	// 1-b. 活動ログはあるが対象3ログが空 → 件数0
	const emptyActivity = await buildSalesPerformanceRelatedSourceWithStatsForTest(
		notion as never,
		{ 関連活動ログ: relation(["activity-empty"]) },
	);
	assert.equal(emptyActivity.qualitativeLogCounts.speechLogs, 0);
	assert.equal(emptyActivity.qualitativeLogCounts.customerContactLogs, 0);
	assert.equal(emptyActivity.qualitativeLogCounts.contributionLogs, 0);

	// 1-c. 定性ソースあり → 件数が実数で乗る
	const withLogs = await buildSalesPerformanceRelatedSourceWithStatsForTest(
		notion as never,
		{ 関連活動ログ: relation(["activity-with-logs"]) },
	);
	assert.equal(withLogs.qualitativeLogCounts.speechLogs, 1);
	assert.equal(withLogs.qualitativeLogCounts.customerContactLogs, 1);
	assert.equal(withLogs.qualitativeLogCounts.contributionLogs, 0);
	assert.match(withLogs.source, /初回提案後の追客活動/);

	// --- 2. 定性0件 → プロンプトに定性評価セクションの生成要求が含まれない ---
	const zeroCounts = {
		speechLogs: 0,
		customerContactLogs: 0,
		contributionLogs: 0,
	};
	const zeroPrompts = buildSalesPerformanceReviewPromptsForTest({
		title: "2026年6月 テスト",
		auditStatus: "",
		targetPeriod: "2026-06",
		source: "成約件数: 1\n実績売上額: 30000000",
		missing: [],
		auditOrTest: false,
		qualitativeLogCounts: zeroCounts,
	});
	assert.doesNotMatch(
		zeroPrompts.systemPrompt,
		/勝ちパターン化は活動ログDBに集約された営業貢献ログだけを見る/,
	);
	assert.doesNotMatch(
		zeroPrompts.systemPrompt,
		/定性評価25点は行動ログから見る/,
	);
	assert.match(zeroPrompts.systemPrompt, /勝ちパターン化・定性評価を行わない/);
	assert.match(zeroPrompts.systemPrompt, /データ不足のため評価不可/);

	// 0件時は本人コメント/次月改善ポイント系の生成指示行も除去される
	assert.doesNotMatch(zeroPrompts.systemPrompt, /次月改善ポイントは3件以内で具体化する/);
	assert.doesNotMatch(
		zeroPrompts.systemPrompt,
		/本人に返す言葉は厳しさと成長支援を両立させる/,
	);
	assert.match(
		zeroPrompts.systemPrompt,
		/personComment、nextMonthImprovements、managerConfirmationItems にも定性評価に基づく内容を書かない/,
	);

	// 捏造禁止の明文（0件でも1件以上でも常に入る）
	assert.match(
		zeroPrompts.systemPrompt,
		/入力の評価材料に存在しないログ・活動・発言・数値を引用や推測で創作しない/,
	);

	// 件数明示行
	assert.match(
		zeroPrompts.userPrompt,
		/50\/25\/25対象ログ件数: 勝ちパターン化=営業貢献ログ 0件 \/ 定性=顧客接点ログ 0件・発言ログ 0件/,
	);

	// テスト/監査素通り（auditOrTest=true）でも0件なら同じく定性生成禁止になる
	const auditZeroPrompts = buildSalesPerformanceReviewPromptsForTest({
		title: "AIテスト 2026年6月",
		auditStatus: "監査除外",
		targetPeriod: "2026-06",
		source: "成約件数: 1",
		missing: [],
		auditOrTest: true,
		qualitativeLogCounts: zeroCounts,
	});
	assert.match(auditZeroPrompts.systemPrompt, /勝ちパターン化・定性評価を行わない/);
	assert.doesNotMatch(
		auditZeroPrompts.systemPrompt,
		/勝ちパターン化は活動ログDBに集約された営業貢献ログだけを見る/,
	);

	// --- 3. 定性1件以上 → 従来の二軸プロンプト ---
	const someCounts = {
		speechLogs: 1,
		customerContactLogs: 0,
		contributionLogs: 0,
	};
	const normalPrompts = buildSalesPerformanceReviewPromptsForTest({
		title: "2026年6月 通常",
		auditStatus: "",
		targetPeriod: "2026-06",
		source: "成約件数: 1",
		missing: [],
		auditOrTest: false,
		qualitativeLogCounts: someCounts,
	});
	assert.match(
		normalPrompts.systemPrompt,
		/評価は三軸で見る。定量評価（実績）50点はWorker計算済み、勝ちパターン化25点は営業貢献ログ、定性評価25点は行動ログから見る/,
	);
	assert.match(
		normalPrompts.systemPrompt,
		/提示された定量内訳をそのまま使い、AIが点を付け直さない/,
	);
	assert.match(
		normalPrompts.systemPrompt,
		/定性評価は活動ログDBに集約された顧客接点ログ、発言ログだけを見る/,
	);
	assert.doesNotMatch(normalPrompts.systemPrompt, /勝ちパターン化・定性評価を行わない/);
	// 1件以上なら本人コメント/次月改善ポイントの生成指示行は従来どおり残る
	assert.match(normalPrompts.systemPrompt, /次月改善ポイントは3件以内で具体化する/);
	assert.match(
		normalPrompts.systemPrompt,
		/本人に返す言葉は厳しさと成長支援を両立させる/,
	);
	// 捏造禁止の明文は従来動作側にも入る
	assert.match(
		normalPrompts.systemPrompt,
		/入力の評価材料に存在しないログ・活動・発言・数値を引用や推測で創作しない/,
	);
	assert.match(
		normalPrompts.userPrompt,
		/50\/25\/25対象ログ件数: 勝ちパターン化=営業貢献ログ 0件 \/ 定性=顧客接点ログ 0件・発言ログ 1件/,
	);

	// --- 4. コード側ガード: 0件ならLLMが何を返しても固定文に差し替える ---
	const guarded = applySalesPerformanceQualitativeGuardForTest(
		sampleReview,
		zeroCounts,
	);
	assert.equal(
		guarded.actionGuidance,
		SALES_PERFORMANCE_QUALITATIVE_MISSING_TEXT_FOR_TEST,
	);
	assert.match(
		guarded.actionGuidance,
		/勝ちパターン化・定性評価: 対象期間の営業貢献ログ・顧客接点ログ・発言ログが未入力のため評価できません（データ不足）/,
	);
	assert.match(guarded.contributionView, /営業貢献ログが未入力のため評価できません/);
	// 拡張分: 本人コメント（成長ポイント）も固定文に差し替え
	assert.equal(
		guarded.personComment,
		SALES_PERFORMANCE_QUALITATIVE_MISSING_PERSON_COMMENT_FOR_TEST,
	);
	assert.match(guarded.personComment, /勝ちパターン化\/定性コメントなし（データ不足）/);
	// 拡張分: 次月改善ポイント（次月テーマ）はデータ整備を促す1項目のみ
	assert.deepEqual(guarded.nextMonthImprovements, [
		SALES_PERFORMANCE_QUALITATIVE_MISSING_IMPROVEMENT_FOR_TEST,
	]);
	assert.match(
		guarded.nextMonthImprovements[0],
		/活動ログの入力から始めてください（現状データ不足のため改善点を特定できません）/,
	);
	// 拡張分: 上司確認事項はデータ整備確認の1項目のみ
	assert.deepEqual(guarded.managerConfirmationItems, [
		SALES_PERFORMANCE_QUALITATIVE_MISSING_MANAGER_ITEM_FOR_TEST,
	]);
	assert.match(
		guarded.managerConfirmationItems[0],
		/営業貢献ログ・顧客接点ログ・発言ログが未入力のためデータ整備を確認してください/,
	);
	// 拡張分: 結論は定量実績のみに基づくことを明示する接頭辞付き（元の結論は残す）
	assert.equal(
		guarded.conclusion,
		`${SALES_PERFORMANCE_QUANTITATIVE_ONLY_CONCLUSION_PREFIX_FOR_TEST}結論テキスト`,
	);
	assert.match(guarded.conclusion, /定量実績のみに基づく結論（定性データ不足）/);
	// 接頭辞は二重に付かない（再適用しても冪等）
	const reGuarded = applySalesPerformanceQualitativeGuardForTest(
		guarded,
		zeroCounts,
	);
	assert.equal(reGuarded.conclusion, guarded.conclusion);
	// 定量部分は従来どおり残り、LLMが紛れ込ませた別セクションは切る
	assert.equal(guarded.resultExplanation, "定量の説明");
	assert.deepEqual(guarded.evidence, ["成約件数: 1"]);

	// --- 5. コード側ガード: 発言/接点ログだけある場合、勝ちパターン化だけ固定文にする ---
	const contributionMissing = applySalesPerformanceQualitativeGuardForTest(
		sampleReview,
		someCounts,
	);
	assert.equal(contributionMissing.resultExplanation, "定量の説明");
	assert.equal(contributionMissing.actionGuidance, sampleReview.actionGuidance);
	assert.match(
		contributionMissing.contributionView,
		/営業貢献ログが未入力のため評価できません/,
	);
	assert.match(
		contributionMissing.managerConfirmationItems.join("\n"),
		/勝ちパターン化25点の評価根拠を確認/,
	);

	// --- 6. コード側ガード: 営業貢献ログもある場合はセクション正規化だけ行う ---
	const fullCounts = {
		speechLogs: 1,
		customerContactLogs: 0,
		contributionLogs: 1,
	};
	const untouched = applySalesPerformanceQualitativeGuardForTest(sampleReview, fullCounts);
	assert.notDeepEqual(untouched, sampleReview);
	assert.equal(untouched.resultExplanation, "定量の説明");
	assert.equal(untouched.contributionView, sampleReview.contributionView);
	assert.equal(untouched.actionGuidance, sampleReview.actionGuidance);

	console.log("sales-performance-fabrication-guard: all assertions passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
