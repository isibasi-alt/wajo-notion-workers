import assert from "node:assert/strict";
import {
	mergeDeepResearchForTest,
	isDeepResearchCompleteForTest,
	fallbackDeepResearchForTest,
} from "./index";

async function main() {
	const research = fallbackDeepResearchForTest("株式会社サンプル");
	research.summary = "AI生成サマリー";
	research.representative = "AI山田";
	// 既存に手入力がある項目は壊さない
	const merged = mergeDeepResearchForTest(
		{ summary: "手入力サマリー", representative: "" },
		research,
	);
	assert.equal(merged.summary, "手入力サマリー"); // 既存優先
	assert.equal(merged.representative, "AI山田"); // 既存空→AI採用

	// 完了判定: 9コア項目が揃えば true
	assert.equal(isDeepResearchCompleteForTest(research), true);
	const empty = fallbackDeepResearchForTest("X");
	empty.source = "";
	assert.equal(isDeepResearchCompleteForTest(empty), false);
	console.log("OK merge/complete");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
