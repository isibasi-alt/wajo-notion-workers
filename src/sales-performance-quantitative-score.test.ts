import assert from "node:assert/strict";
import {
	buildSalesPerformanceReviewSourceForTest,
	computeSalesPerformanceQuantitativeScoreForTest,
} from "./index";

function number(value: number) {
	return { type: "number", number: value };
}

function rollupNumber(value: number) {
	return { type: "rollup", rollup: { type: "number", number: value } };
}

function formulaNumber(value: number) {
	return { type: "formula", formula: { type: "number", number: value } };
}

function fullRateProperties() {
	return {
		"月次粗利達成率（申請連動）": formulaNumber(1),
		"月次成約達成率（申請連動）": formulaNumber(1),
		"月次仕入れ件数達成率（申請連動）": formulaNumber(1),
		"月次商談達成率（申請連動）": formulaNumber(1),
		"案件化件数": number(10),
		"問い合わせ数": number(10),
		"月次専売許可達成率（申請連動）": formulaNumber(1),
	};
}

const full = computeSalesPerformanceQuantitativeScoreForTest(fullRateProperties());
assert.equal(full.粗利, 25);
assert.equal(full.成約, 12);
assert.equal(full.仕入れ, 10);
assert.equal(full.商談, 8);
assert.equal(full.案件化, 6);
assert.equal(full.専売, 4);
assert.equal(full.合計, 65);
assert.equal(full.details.粗利.achievementRate, 1);
assert.equal(full.details.粗利.rateSource, "月次粗利達成率（申請連動）");

const half = computeSalesPerformanceQuantitativeScoreForTest({
	"月次粗利達成率（申請連動）": formulaNumber(0.5),
	"月次成約達成率（申請連動）": formulaNumber(0.5),
	"月次仕入れ件数達成率（申請連動）": formulaNumber(0.5),
	"月次商談達成率（申請連動）": formulaNumber(0.5),
	"案件化件数": number(3),
	"問い合わせ数": number(6),
	"月次専売許可達成率（申請連動）": formulaNumber(0.5),
});
assert.deepEqual(
	{
		粗利: half.粗利,
		成約: half.成約,
		仕入れ: half.仕入れ,
		商談: half.商談,
		案件化: half.案件化,
		専売: half.専売,
		合計: half.合計,
	},
	{ 粗利: 13, 成約: 6, 仕入れ: 5, 商談: 4, 案件化: 3, 専売: 2, 合計: 33 },
);

const zero = computeSalesPerformanceQuantitativeScoreForTest({
	"月次粗利達成率（申請連動）": formulaNumber(0),
	"月次成約達成率（申請連動）": formulaNumber(0),
	"月次仕入れ件数達成率（申請連動）": formulaNumber(0),
	"月次商談達成率（申請連動）": formulaNumber(0),
	"案件化件数": number(0),
	"問い合わせ数": number(1),
	"月次専売許可達成率（申請連動）": formulaNumber(0),
});
assert.equal(zero.合計, 0);

const over = computeSalesPerformanceQuantitativeScoreForTest({
	"月次粗利達成率（申請連動）": formulaNumber(1.4),
	"月次成約達成率（申請連動）": formulaNumber(1.2),
	"月次仕入れ件数達成率（申請連動）": formulaNumber(2),
	"月次商談達成率（申請連動）": formulaNumber(1.01),
	"案件化件数": number(15),
	"問い合わせ数": number(10),
	"月次専売許可達成率（申請連動）": formulaNumber(3),
});
assert.equal(over.合計, 65);
assert.equal(over.details.専売.clippedAchievementRate, 1);

const missing = computeSalesPerformanceQuantitativeScoreForTest({});
assert.equal(missing.合計, 0);
assert.match(missing.details.粗利.detail, /未取得/);
assert.match(missing.details.案件化.detail, /未取得/);

const projectConversionTargetFormulaOnly = computeSalesPerformanceQuantitativeScoreForTest({
	"月次案件化達成率（申請連動）": formulaNumber(1),
});
assert.equal(projectConversionTargetFormulaOnly.案件化, 0);
assert.match(projectConversionTargetFormulaOnly.details.案件化.detail, /未取得/);

const fallback = computeSalesPerformanceQuantitativeScoreForTest({
	"実績粗利額（自動）": rollupNumber(5_000_000),
	"粗利目標（申請DB）": rollupNumber(10_000_000),
	"案件化件数": number(3),
	"問い合わせ数": number(6),
});
assert.equal(fallback.粗利, 13);
assert.equal(fallback.details.粗利.achievementRate, 0.5);
assert.equal(fallback.details.粗利.rateSource, "実績粗利額（自動） / 粗利目標（申請DB）");
assert.equal(fallback.案件化, 3);
assert.equal(fallback.details.案件化.rateSource, "案件化件数 / 問い合わせ数");
assert.equal(fallback.details.案件化.actual, 3);
assert.equal(fallback.details.案件化.target, 6);

const source = buildSalesPerformanceReviewSourceForTest({
	...fullRateProperties(),
	"実績粗利額（自動）": rollupNumber(12_000_000),
	"粗利目標（申請DB）": rollupNumber(10_000_000),
	"成約件数（自動）": rollupNumber(4),
	"成約件数目標（申請DB）": rollupNumber(4),
	"商談件数（自動）": rollupNumber(10),
	"商談件数目標（申請DB）": rollupNumber(10),
});
assert.match(source, /定量評価（実績）｜65点/);
assert.match(source, /合計: 65\/65点/);
assert.match(source, /粗利: 25\/25点/);
assert.match(source, /AIは定量65点を付け直さない/);

console.log("sales-performance-quantitative-score: all assertions passed");
