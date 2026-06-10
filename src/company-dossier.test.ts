import assert from "node:assert/strict";
import {
	buildDossierBlocksForTest,
	dossierBlockIdsToReplaceForTest as idsToReplace,
	fallbackDeepResearchForTest,
	shoutaBriefToBlocksForTest as briefBlocks,
} from "./index";

async function main() {
	// ── ドシエ紙面ビルダー(コールアウト/表/区切り/折りたたみ) ──
	const r = fallbackDeepResearchForTest("株式会社サンプル食品");
	r.recentNews = "2026-01 新工場稼働";
	r.capital = "1,000百万円";
	r.citations = ["https://news.example/1", "https://corp.example/about"];
	const blocks = buildDossierBlocksForTest("株式会社サンプル食品", r, {
		信頼度: "高",
		提案可否: "提案可能",
		根拠: "TDB評点65",
	});
	const json = JSON.stringify(blocks);
	const types = blocks.map((b) => (b as { type: string }).type);

	// 先頭は置き換え検出の鍵=「…商談ドシエ」heading_1(変えたら旧ドシエ掃除が壊れる)
	assert.equal(types[0], "heading_1");
	assert.ok(json.includes("株式会社サンプル食品 商談ドシエ"));
	// 与信判定は色付きコールアウト(信頼度高=緑)
	assert.equal(types[1], "callout");
	assert.ok(json.includes("green_background"));
	assert.ok(json.includes("提案可能"));
	// 基本情報は表組み(資本金の行)
	assert.ok(types.includes("table"));
	assert.ok(json.includes("資本金"));
	// 紙面の区切り線
	assert.ok(types.includes("divider"));
	// ニュース反映
	assert.ok(json.includes("2026-01 新工場稼働"));
	// 出典は折りたたみ(中に箇条書き)
	assert.ok(types.includes("toggle"));
	assert.ok(json.includes("https://news.example/1"));
	// 信頼度低=赤コールアウト
	const lowJson = JSON.stringify(
		buildDossierBlocksForTest("株式会社サンプル食品", r, {
			信頼度: "低",
			提案可否: "提案不可",
			根拠: "TDB評点30",
		}),
	);
	assert.ok(lowJson.includes("red_background"));

	// ── 商太ブリーフの紙面化 ──
	const bb = briefBlocks(
		[
			"⚠️ 検品AIの指摘が残っています: 誇張1件",
			"先輩、株式会社サンプル食品いきましょう。🌞",
			"▼ ここが急所",
			"新工場が2026-01に稼働(出典あり)。",
			"▼ つかみの一言",
			"「新工場の電気代、月いくら増えました？」",
			"▼ 次の一手",
			"電気代の実額を聞く。",
		].join("\n"),
	);
	const bbTypes = bb.map((b) => (b as { type: string }).type);
	const bbJson = JSON.stringify(bb);
	assert.equal(bbTypes[0], "callout"); // 検品判定はコールアウト
	assert.ok(bbJson.includes("yellow_background"));
	assert.ok(bbTypes.includes("heading_3")); // ▼は見出し
	assert.ok(bbTypes.includes("quote")); // つかみの台詞は引用
	assert.ok(bbJson.includes("月いくら増えました"));
	// つかみセクションを抜けたら段落に戻る
	const lastBlock = bb[bb.length - 1] as { type: string };
	assert.equal(lastBlock.type, "paragraph");

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
