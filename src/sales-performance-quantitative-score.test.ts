import assert from "node:assert/strict";
import {
	buildSalesPerformanceReviewSourceForTest,
	computeSalesPerformanceQuantitativeScoreForTest,
} from "./index";

// 2026-06-23 確定配点（定量65）+ 保留方式のテスト。
// 定量65 = 粗利30 / 案件化率10 / 成約率10 / ノルマ申請計画妥当性15。
// 保留＝採点軸の分子・分母の両方から除外。0点化しない。
// 総合 = round(採点軸の獲得合計 ÷ 採点軸の満点合計 × 100)。

function number(value: number) {
	return { type: "number", number: value };
}

function rollupNumber(value: number) {
	return { type: "rollup", rollup: { type: "number", number: value } };
}

function formulaNumber(value: number) {
	return { type: "formula", formula: { type: "number", number: value } };
}

// --- 1. 粗利・成約率が満点。案件化率とノルマ申請計画妥当性は常に保留 ---
const full = computeSalesPerformanceQuantitativeScoreForTest({
	"月次粗利達成率（申請連動）": formulaNumber(1),
	"月次成約達成率（申請連動）": formulaNumber(1),
});
assert.equal(full.details.粗利.score, 30);
assert.equal(full.details.成約率.score, 10);
// 案件化率は分母が実機DBに無いので常に保留（採点対象外）
assert.equal(full.details.案件化率.held, true);
assert.equal(full.details.案件化率.score, null);
// ノルマ申請計画妥当性は採点列未確認なので常に保留
assert.equal(full.details.ノルマ申請計画妥当性.held, true);
assert.equal(full.details.ノルマ申請計画妥当性.score, null);
// 採点軸は粗利30+成約率10=40点満点、獲得40点 → 総合100
assert.equal(full.earned, 40);
assert.equal(full.maxOfScored, 40);
assert.equal(full.overall, 100);
assert.deepEqual(full.heldKeys, ["案件化率", "ノルマ申請計画妥当性"]);
assert.equal(full.details.粗利.achievementRate, 1);
assert.equal(full.details.粗利.rateSource, "月次粗利達成率（申請連動）");

// --- 2. 達成率半分。総合は採点軸（粗利30+成約率10）の獲得÷満点×100 ---
const half = computeSalesPerformanceQuantitativeScoreForTest({
	"月次粗利達成率（申請連動）": formulaNumber(0.5),
	"月次成約達成率（申請連動）": formulaNumber(0.5),
});
assert.equal(half.details.粗利.score, 15);
assert.equal(half.details.成約率.score, 5);
assert.equal(half.earned, 20);
assert.equal(half.maxOfScored, 40);
assert.equal(half.overall, 50); // round(20/40*100)

// --- 3. ★欠損軸を0点化しない（Reject級バグの回帰テスト）---
// 粗利・成約率のロールアップ源が空 → 保留（score null）であって0点ではない。
const missingRollups = computeSalesPerformanceQuantitativeScoreForTest({});
assert.equal(missingRollups.details.粗利.held, true);
assert.equal(missingRollups.details.粗利.score, null);
assert.notEqual(missingRollups.details.粗利.score, 0); // 0点化していないこと
assert.equal(missingRollups.details.成約率.held, true);
assert.equal(missingRollups.details.成約率.score, null);
// 採点軸が全て保留 → 満点合計0 → 総合は null（採点不可）。0や50ではない。
assert.equal(missingRollups.maxOfScored, 0);
assert.equal(missingRollups.earned, 0);
assert.equal(missingRollups.overall, null);
assert.equal(missingRollups.heldKeys.length, 4);

// --- 4. 粗利だけ取れて成約率が空 → 成約率は保留され分母から除外 ---
// 粗利達成率0.5（=15点）だけが採点軸。成約率は保留。総合=round(15/30*100)=50。
const grossOnly = computeSalesPerformanceQuantitativeScoreForTest({
	"実績粗利額（自動）": rollupNumber(5_000_000),
	"粗利目標（申請DB）": rollupNumber(10_000_000),
});
assert.equal(grossOnly.details.粗利.score, 15);
assert.equal(grossOnly.details.粗利.achievementRate, 0.5);
assert.equal(grossOnly.details.粗利.rateSource, "実績粗利額（自動） / 粗利目標（申請DB）");
assert.equal(grossOnly.details.成約率.held, true);
assert.equal(grossOnly.earned, 15);
assert.equal(grossOnly.maxOfScored, 30); // 成約率10は分母から除外
assert.equal(grossOnly.overall, 50);

// --- 5. クリップ: 達成率が1超でも軸満点まで。総合は100で頭打ち ---
const over = computeSalesPerformanceQuantitativeScoreForTest({
	"月次粗利達成率（申請連動）": formulaNumber(1.4),
	"月次成約達成率（申請連動）": formulaNumber(1.2),
});
assert.equal(over.details.粗利.score, 30);
assert.equal(over.details.粗利.clippedAchievementRate, 1);
assert.equal(over.details.成約率.score, 10);
assert.equal(over.overall, 100);

// --- 6. ★案件化率はmemo/本人コメントの数値を分母にしない＝常に保留 ---
// 案件化件数があっても、問い合わせ数(分母)はDBに無いので保留のまま。
const projectConversionActualOnly = computeSalesPerformanceQuantitativeScoreForTest({
	"案件化件数": number(10),
	// 本人コメントに「問い合わせ100件」と書いてあっても採点ソースにしない（プロパティ化しない）
	"本人コメント": { type: "rich_text", rich_text: [{ plain_text: "問い合わせ100件" }] },
});
assert.equal(projectConversionActualOnly.details.案件化率.held, true);
assert.equal(projectConversionActualOnly.details.案件化率.score, null);
assert.match(projectConversionActualOnly.details.案件化率.heldReason, /問い合わせ数/);

// --- 7. ノルマ申請計画妥当性は数値があっても常に保留（採点列未確認・捏造禁止）---
const quotaValidity = computeSalesPerformanceQuantitativeScoreForTest({
	"ノルマ申請計画妥当性": number(15),
});
assert.equal(quotaValidity.details.ノルマ申請計画妥当性.held, true);
assert.equal(quotaValidity.details.ノルマ申請計画妥当性.score, null);
assert.match(quotaValidity.details.ノルマ申請計画妥当性.heldReason, /未確認|保留/);

// --- 8. 評価材料テキスト: 65点見出し・総合行・保留併記。旧50点表記は消えている ---
const source = buildSalesPerformanceReviewSourceForTest({
	"月次粗利達成率（申請連動）": formulaNumber(1),
	"月次成約達成率（申請連動）": formulaNumber(1),
});
assert.match(source, /定量評価（実績）｜65点/);
assert.match(source, /総合: 100点/);
assert.match(source, /（保留：案件化率・ノルマ申請計画妥当性）/);
assert.match(source, /粗利: 30\/30点/);
assert.match(source, /案件化率: 保留\/10点満点/);
assert.match(source, /AIは定量点を付け直さない/);
// 旧50点系の語が残っていないこと
assert.doesNotMatch(source, /｜50点/);
assert.doesNotMatch(source, /\/50点/);
assert.doesNotMatch(source, /定量50点/);

// --- 9. 全軸保留なら総合は採点不可と明示 ---
const allHeldSource = buildSalesPerformanceReviewSourceForTest({});
assert.match(allHeldSource, /総合: 採点不可（採点軸が全て保留）/);

console.log("sales-performance-quantitative-score: all assertions passed");
