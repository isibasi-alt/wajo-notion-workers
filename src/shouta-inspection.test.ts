import assert from "node:assert/strict";
import { parseInspectionVerdict as parse } from "./shouta-brief";

// 検品AI(4体目=門番)の判定パースの契約:
// - 合格/不合格と指摘リストをJSONから取り出す
// - 前後に説明文が混ざっても{...}部分を拾う
// - 壊れた応答は「未検品」として正直に返す(勝手に合格にしない)
async function main() {
	// 合格
	{
		const v = parse('{"合格": true, "指摘": []}');
		assert.equal(v.pass, true);
		assert.equal(v.inspected, true);
		assert.deepEqual(v.problems, []);
	}

	// 不合格＋指摘
	{
		const v = parse('{"合格": false, "指摘": ["つかみに材料に無い受賞歴がある"]}');
		assert.equal(v.pass, false);
		assert.equal(v.inspected, true);
		assert.deepEqual(v.problems, ["つかみに材料に無い受賞歴がある"]);
	}

	// 前後に説明文が混ざるケース(LLMがJSONだけ返さない時)
	{
		const v = parse('審査結果です。\n{"合格": false, "指摘": ["誇張あり"]}\n以上');
		assert.equal(v.pass, false);
		assert.deepEqual(v.problems, ["誇張あり"]);
	}

	// 壊れたJSON → 未検品(inspected=false)・勝手に合格にしない
	{
		const v = parse("{合格: たぶん}");
		assert.equal(v.inspected, false);
		assert.equal(v.pass, false);
	}

	// JSON無し/空 → 未検品
	{
		assert.equal(parse("わかりません").inspected, false);
		assert.equal(parse("").inspected, false);
	}

	// 合格がtrue以外(文字列"true"等)は合格扱いしない(安全側)
	{
		const v = parse('{"合格": "true", "指摘": []}');
		assert.equal(v.pass, false);
		assert.equal(v.inspected, true);
	}

	console.log("OK shouta-inspection");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
