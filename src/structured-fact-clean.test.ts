import assert from "node:assert/strict";
import { cleanStructuredFactForTest as clean } from "./index";

// 短い事実列(代表者/資本金/設立年月/売上規模/従業員規模/業種)を「営業がそのまま読める
// ベタ値」にする。出典番号[1][3]と末尾の丁寧語「です。」を落とす。
// 文章列(3C/サマリー/直近ニュース等)には使わない=出典を残す。
async function main() {
	// 出典番号(連結)＋末尾「です。」を除去
	assert.equal(
		clean("木下 公貴（代表取締役 社長執行役員）です。[1][3][7]"),
		"木下 公貴（代表取締役 社長執行役員）",
	);
	assert.equal(clean("1,541百万円です。[1]"), "1,541百万円");
	assert.equal(clean("2004年10月5日です。[1][3]"), "2004年10月5日");

	// 姓名間の半角スペースは保持(潰さない)
	assert.equal(clean("木下 公貴"), "木下 公貴");

	// 出典なし・丁寧語なしはそのまま
	assert.equal(clean("太陽光発電・再生可能エネルギー"), "太陽光発電・再生可能エネルギー");
	assert.equal(clean("406名"), "406名");

	// 末尾以外の「です」は消さない(文章の途中)。末尾の出典と句点だけ落とす
	assert.equal(
		clean("406名です（2026年6月1日時点）。[1][3]"),
		"406名です（2026年6月1日時点）",
	);

	// 「確認できませんでした。」は丁寧語"です"でないので本体を壊さず末尾句点だけ落とす
	assert.equal(clean("公開情報では確認できませんでした。"), "公開情報では確認できませんでした");

	// 全角の出典【1】／［１］も除去
	assert.equal(clean("資本金1億円【1】"), "資本金1億円");
	assert.equal(clean("代表者 山田［２］"), "代表者 山田");

	// 空・空白のみ
	assert.equal(clean(""), "");
	assert.equal(clean("   "), "");

	console.log("OK structured-fact-clean");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
