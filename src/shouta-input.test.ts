import assert from "node:assert/strict";
import { buildShoutaInputForTest as build } from "./index";

// 商太への入力組み立ての契約:
// - Aの実データ(直近ニュース/再エネ接点シグナル/サマリー等)を弾・透視・ドシエに振り分ける
// - 和上側の手がかり(成約へのポイント/問い合わせ要約/売買区分)は knowledge へ
// - 空の物は渡さない(商太の「無い事は創作しない」を入力側でも守る)
const rt = (s: string) => ({ type: "rich_text", rich_text: [{ plain_text: s }] });
const sel = (s: string) => ({ type: "select", select: { name: s } });

async function main() {
	// 1) フル入力 → 各フィールドへ正しく振り分け
	{
		const i = build("株式会社サンプル食品", {
			直近ニュース: rt("2026-01 新工場稼働"),
			経営陣: rt("山田太郎(代表)"),
			再エネ接点シグナル: rt("FIT保有なし×製造業=自家消費の青地"),
			企業サマリー: rt("食品製造の会社"),
			営業切り口: rt("電気代の削減から入る"),
			和上解決策適合: rt("自家消費太陽光が刺さる"),
			成約へのポイント: rt("社長は数字で動く"),
			問い合わせ要約: rt("蓄電池の見積依頼"),
			売買区分: sel("買い"),
			"面談相手（名前・役職）": rt("山田太郎 社長"),
		});
		assert.equal(i.companyName, "株式会社サンプル食品");
		assert.equal(i.contact, "山田太郎 社長");
		assert.equal(i.hits?.length, 2);
		assert.ok(i.hits?.[0]?.includes("新工場稼働"));
		assert.ok(i.renewableXray?.includes("青地"));
		assert.ok(i.dossier?.includes("電気代の削減"));
		assert.ok(i.knowledge?.includes("社長は数字で動く"));
		assert.ok(i.knowledge?.includes("売買区分: 買い"));
	}

	// 2) 空ページ → 空の物は渡さない(undefined/空配列)
	{
		const i = build("株式会社カラッポ", {});
		assert.equal(i.contact, undefined);
		assert.deepEqual(i.hits, []);
		assert.equal(i.renewableXray, undefined);
		assert.equal(i.dossier, undefined);
		assert.equal(i.knowledge, undefined);
	}

	// 3) 売買区分「不明」はノイズなので knowledge に入れない
	{
		const i = build("株式会社フメイ", { 売買区分: sel("不明") });
		assert.equal(i.knowledge, undefined);
	}

	// 4) 面談相手が無ければ問い合わせ担当者名にフォールバック
	{
		const i = build("株式会社レンラク", { 問い合わせ担当者名: rt("佐藤 次郎") });
		assert.equal(i.contact, "佐藤 次郎");
	}

	console.log("OK shouta-input");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
