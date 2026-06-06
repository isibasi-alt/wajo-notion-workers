import assert from "node:assert/strict";
import { buildResearchQueriesForTest } from "./index";

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
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
