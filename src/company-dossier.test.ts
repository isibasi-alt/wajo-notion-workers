import assert from "node:assert/strict";
import {
	buildDossierMarkdownForTest,
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
	console.log("OK dossier");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
