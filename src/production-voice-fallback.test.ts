import assert from "node:assert/strict";
import { inferProductionExtractionFallbackForTest } from "./index";

async function main() {
	const explicitRequest = inferProductionExtractionFallbackForTest(
		"制作チームへの改善要望です。HPのFAQリンクが見つからないので、LP上部にFAQ導線を今すぐ追加したいです。FAQの説明もわかりにくいため内容を増やして修正したいです。Instagramとnoteから来た人向けに、競合サイトのような事例ページをもっと増やしてほしい、という顧客の反応がありました。",
		"会議",
	);
	assert.equal(explicitRequest.found, true);
	assert.equal(explicitRequest.type, "改善要望");
	assert.equal(explicitRequest.priority, "今すぐ反映");
	assert.deepEqual(explicitRequest.channels.sort(), ["HP", "Instagram", "note"].sort());
	assert.match(explicitRequest.title, /FAQ|導線|改善/);

	const unrelated = inferProductionExtractionFallbackForTest(
		"土地の接道と変電所距離を確認し、紹介元へ価格調整を依頼する。",
		"会議",
	);
	assert.equal(unrelated.found, false);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
