import assert from "node:assert/strict";
import {
	parseFinanceSummaryAIResponseForTest as parseFinanceSummaryAIResponse,
	isFinanceSummaryEmptyForTest as isFinanceSummaryEmpty,
} from "./index";

// 1. 正常系: AIが返した正しいJSONを、全フィールド取り出せる
{
	const raw = JSON.stringify({
		headline: "買い：実質利回り9.5%・DSCR1.44で返済に余裕",
		keyPoints: [
			"表面利回り9.5%（年間手残り285万／販売3,000万）",
			"DSCR1.44（借入3,000万・金利1%）",
			"残存FIT13年でトータル手残り3,705万",
		],
		conclusion: "IRR5.96%・NPV176万で、価格に対し収益が見合う案件です。",
		buyTimingReason: "残存FIT13年が確保でき、金利1%の今が取得の好機です。",
		salesTalk: "自己資金を抑えても年285万残る、堅めの一基です。",
		balanceSheetNote: "DSCR1.44で返済安全域。減価償却の節税も効きます。",
	});
	const parsed = parseFinanceSummaryAIResponse(raw);
	assert.equal(parsed.headline.includes("買い"), true);
	assert.equal(parsed.keyPoints.length, 3);
	assert.equal(parsed.conclusion.includes("IRR5.96%"), true);
	assert.equal(parsed.buyTimingReason.includes("残存FIT"), true);
	assert.equal(parsed.salesTalk.length > 0, true);
	assert.equal(parsed.balanceSheetNote.includes("DSCR"), true);
	assert.equal(isFinanceSummaryEmpty(parsed), false);
}

// 2. 壊れたJSON（API不調・非JSON応答）→ 空へフォールバック。呼び出し側が定型文へ戻せる
{
	const parsed = parseFinanceSummaryAIResponse("これはJSONではありません");
	assert.equal(parsed.headline, "");
	assert.equal(parsed.keyPoints.length, 0);
	assert.equal(parsed.conclusion, "");
	assert.equal(isFinanceSummaryEmpty(parsed), true);
}

// 3. 一部フィールド欠落・型不正 → あるものは残し、無いものは空で安全に埋める
{
	const raw = JSON.stringify({
		headline: "様子見：DSCRが基準を下回る",
		keyPoints: "配列でない不正値",
		conclusion: 12345,
	});
	const parsed = parseFinanceSummaryAIResponse(raw);
	assert.equal(parsed.headline.includes("様子見"), true);
	assert.equal(Array.isArray(parsed.keyPoints), true);
	assert.equal(parsed.keyPoints.length, 0);
	assert.equal(parsed.conclusion, "");
	assert.equal(parsed.salesTalk, "");
	// headlineが入っているので空扱いにはしない
	assert.equal(isFinanceSummaryEmpty(parsed), false);
}

console.log("finance-summary.test.ts: 全アサーション通過");
