import assert from "node:assert/strict";
import { addStructuredFactPatchForTest as patch } from "./index";

// addStructuredFactPatch の契約:
// - 空欄 → 新値をクリーニングして書く
// - 既存値が汚れている(出典番号/末尾「です。」=旧コードの書き残し) → ノイズだけ落として修復
// - きれいな既存値(手入力含む) → 触らない
// - 新値も既存値も空 → 何も書かない
const rt = (s: string) => ({ type: "rich_text", rich_text: [{ plain_text: s }] });

async function main() {
	// 1) 空欄 → 新値(クリーニング済)が入る
	{
		const patches: Record<string, { kind: string; value: string }> = {};
		patch(patches, { 代表者: rt("") }, "代表者", "木下 公貴です。[1][3]");
		assert.deepEqual(patches["代表者"], { kind: "text", value: "木下 公貴" });
	}

	// 2) 既存が汚れている → 修復(既存の事実を保ち、ノイズだけ除去)。新値は使わない
	{
		const patches: Record<string, { kind: string; value: string }> = {};
		patch(
			patches,
			{ 設立年月: rt("2004年10月5日です。[1][3]") },
			"設立年月",
			"1999年1月1日",
		);
		assert.deepEqual(patches["設立年月"], { kind: "text", value: "2004年10月5日" });
	}

	// 3) きれいな既存値 → 上書きしない(非破壊)
	{
		const patches: Record<string, { kind: string; value: string }> = {};
		patch(patches, { 資本金: rt("1,541百万円") }, "資本金", "9,999百万円です。[9]");
		assert.equal(patches["資本金"], undefined);
	}

	// 4) 既存も新値も空 → 書かない
	{
		const patches: Record<string, { kind: string; value: string }> = {};
		patch(patches, { 業種: rt("") }, "業種", "");
		assert.equal(patches["業種"], undefined);
	}

	// 5) プロパティ自体が無い(列が未作成) → 新値で埋める(addPatchIfBlank互換の挙動)
	{
		const patches: Record<string, { kind: string; value: string }> = {};
		patch(patches, {}, "従業員規模", "406名です（2026年6月1日時点）。[1][3]");
		assert.deepEqual(patches["従業員規模"], {
			kind: "text",
			value: "406名です（2026年6月1日時点）",
		});
	}

	console.log("OK structured-fact-repair");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
