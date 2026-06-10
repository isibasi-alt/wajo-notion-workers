import assert from "node:assert/strict";
import {
	buildDossierMarkdownForTest,
	dossierBlockIdsToReplaceForTest as idsToReplace,
	fallbackDeepResearchForTest,
} from "./index";

async function main() {
	const r = fallbackDeepResearchForTest("株式会社サンプル食品");
	r.recentNews = "2026-01 新工場稼働";
	r.citations = ["https://news.example/1", "https://corp.example/about"];
	const md = buildDossierMarkdownForTest("株式会社サンプル食品", r, {
		信頼度: "高",
		提案可否: "提案可能",
		根拠: "TDB評点65",
	});
	assert.ok(md.includes("株式会社サンプル食品"));
	assert.ok(md.includes("提案可能")); // スコア反映
	assert.ok(md.includes("2026-01 新工場稼働")); // ニュース反映
	assert.ok(md.includes("https://news.example/1")); // 出典反映
	assert.ok(md.includes("出典"));

	// ── 旧ドシエ置き換えロジック(再実行で本文が複製しない) ──
	const h1 = (id: string, text: string) => ({ id, type: "heading_1", text });
	const para = (id: string, text: string) => ({ id, type: "paragraph", text });

	// ドシエが無いページ → 何も消さない
	assert.deepEqual(idsToReplace([para("a", "営業メモ")]), []);

	// ユーザーコンテンツ＋ドシエ1本 → ドシエ見出し以降だけ(前のコンテンツは守る)
	assert.deepEqual(
		idsToReplace([
			para("memo1", "手書きの営業メモ"),
			h1("d1", "株式会社サンプル食品 商談ドシエ"),
			para("d2", "与信判定: 高"),
		]),
		["d1", "d2"],
	);

	// ドシエ2本(過去の重複) → 最初の見出しから末尾まで全部置き換え対象
	assert.deepEqual(
		idsToReplace([
			h1("d1", "株式会社サンプル食品 商談ドシエ"),
			para("d2", "古い本文"),
			h1("d3", "株式会社サンプル食品 商談ドシエ"),
			para("d4", "新しい本文"),
		]),
		["d1", "d2", "d3", "d4"],
	);

	// 「商談ドシエ」で終わらないheading_1は対象外(他用途の見出しを誤爆しない)
	assert.deepEqual(idsToReplace([h1("x", "会議メモ"), para("y", "本文")]), []);

	console.log("OK dossier");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
