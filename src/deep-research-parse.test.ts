import assert from "node:assert/strict";
import {
	buildResearchQueriesForTest,
	extractCitationsForTest,
	fallbackDeepResearchForTest,
	normalizeDeepResearchForTest,
} from "./index";

async function main() {
	const queries = buildResearchQueriesForTest({
		companyName: "株式会社サンプル食品",
		domain: "sample-foods.co.jp",
		address: "滋賀県大津市1-2-3",
	});
	// 6観点ある
	assert.equal(queries.length, 6);
	// 各クエリに会社名が含まれる
	for (const q of queries) {
		assert.ok(q.prompt.includes("株式会社サンプル食品"), `会社名欠落: ${q.aspect}`);
		assert.ok(q.aspect.length > 0);
	}
	// 役員SNS観点と再エネ接点観点が含まれる
	const aspects = queries.map((q) => q.aspect);
	assert.ok(aspects.includes("executiveSns"));
	assert.ok(aspects.includes("renewableSignals"));
	console.log("OK buildResearchQueries");

	// 出典抽出: Perplexityレスポンスの citations を吸い出す
	const cites = extractCitationsForTest({
		citations: ["https://a.example/x", "https://b.example/y"],
	});
	assert.deepEqual(cites, ["https://a.example/x", "https://b.example/y"]);
	assert.deepEqual(extractCitationsForTest({}), []);

	// fallback: 空入力でも全フィールドが埋まる
	const fb = fallbackDeepResearchForTest("株式会社サンプル食品");
	assert.ok(fb.summary.includes("推測"));
	assert.equal(fb.citations.length, 0);

	// 正規化: 部分入力は fallback で穴埋め、citations は配列化
	const norm = normalizeDeepResearchForTest(
		{
			summary: "食品製造業",
			representative: "山田太郎",
			citations: ["https://src.example/1"],
		},
		"株式会社サンプル食品",
	);
	assert.equal(norm.summary, "食品製造業");
	assert.equal(norm.representative, "山田太郎");
	assert.equal(norm.currentIssue.length > 0, true); // fallbackで補完
	assert.deepEqual(norm.citations, ["https://src.example/1"]);
	console.log("OK parse/normalize/citations");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
