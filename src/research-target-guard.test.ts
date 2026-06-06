import assert from "node:assert/strict";
import { validateResearchTargetForTest } from "./index";

async function main() {
	// 自社(和上)＝論理矛盾 → NG
	assert.equal(validateResearchTargetForTest("和上ホールディングス").ok, false);
	assert.equal(validateResearchTargetForTest("WAJO Holdings").ok, false);

	// 各国政府 → NG
	assert.equal(validateResearchTargetForTest("アメリカ合衆国政府").ok, false);
	assert.equal(validateResearchTargetForTest("イラン政府").ok, false);

	// 著名巨大企業・公人(例示) → NG
	assert.equal(validateResearchTargetForTest("NTT東日本").ok, false);
	assert.equal(validateResearchTargetForTest("ドナルド・トランプ").ok, false);
	assert.equal(validateResearchTargetForTest("Trump Organization").ok, false);

	// 空 → NG
	assert.equal(validateResearchTargetForTest("").ok, false);
	assert.equal(validateResearchTargetForTest("   ").ok, false);

	// 通常の中小企業 → OK
	const ok = validateResearchTargetForTest("株式会社サンプル食品");
	assert.equal(ok.ok, true);
	assert.equal(ok.reason, "");
	// 「省エネ」社名で誤爆しない(省庁キーワードは"省"単独でない)
	assert.equal(validateResearchTargetForTest("株式会社省エネ設備").ok, true);

	console.log("OK validateResearchTarget");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
