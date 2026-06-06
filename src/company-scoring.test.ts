import assert from "node:assert/strict";
import { scoreCompanyForTest, tdbToPatchesForTest } from "./index";

async function main() {
	// TDB評点が高い → 提案可能・信頼度高
	const high = scoreCompanyForTest({
		企業評点: 65, 倒産確率Pct: 1, 年商: "80億", 資本金: "1億", 従業員数: "300",
		設立: "1990", 業種: "食品", 代表者: "山田", 法人番号: "123",
		調査年月日: "2026-06-07", raw: "",
	});
	assert.equal(high.信頼度, "高");
	assert.equal(high.提案可否, "提案可能");

	// 倒産確率が高い → タイミング待ちに抑制
	const risky = scoreCompanyForTest({
		企業評点: 60, 倒産確率Pct: 15, 年商: "", 資本金: "", 従業員数: "",
		設立: "", 業種: "", 代表者: "", 法人番号: "", 調査年月日: "", raw: "",
	});
	assert.equal(risky.提案可否, "タイミング待ち");

	// 評点が低い → 提案不可
	const low = scoreCompanyForTest({
		企業評点: 30, 倒産確率Pct: null, 年商: "", 資本金: "", 従業員数: "",
		設立: "", 業種: "", 代表者: "", 法人番号: "", 調査年月日: "", raw: "",
	});
	assert.equal(low.提案可否, "提案不可");
	assert.equal(low.信頼度, "低");

	// TDB未取得(null) → 暫定: 信頼度中・タイミング待ち・根拠に未取得と明記
	const noTdb = scoreCompanyForTest(null);
	assert.equal(noTdb.信頼度, "中");
	assert.equal(noTdb.提案可否, "タイミング待ち");
	assert.ok(noTdb.根拠.includes("TDB"));

	// TDBプロファイル → Notion列パッチ
	const patches = tdbToPatchesForTest({
		企業評点: 65, 倒産確率Pct: 1, 年商: "80億", 資本金: "1億円", 従業員数: "300名",
		設立: "1990-04", 業種: "食品製造", 代表者: "山田太郎", 法人番号: "1234567890123",
		調査年月日: "2026-06-07", raw: "帳票",
	});
	assert.equal(patches["資本金"].kind, "text");
	assert.equal((patches["資本金"] as { value: string }).value, "1億円");
	assert.equal((patches["代表者"] as { value: string }).value, "山田太郎");
	assert.equal(patches["TDB調査年月日"].kind, "date");
	// 空値の項目はパッチに入れない
	const sparse = tdbToPatchesForTest({
		企業評点: null, 倒産確率Pct: null, 年商: "", 資本金: "", 従業員数: "",
		設立: "", 業種: "", 代表者: "", 法人番号: "", 調査年月日: "", raw: "",
	});
	assert.equal(Object.keys(sparse).length, 0);
	console.log("OK scoreCompany");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
