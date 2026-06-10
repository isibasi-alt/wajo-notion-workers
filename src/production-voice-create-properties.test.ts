import assert from "node:assert/strict";
import { buildProductionVoiceCreatePropertiesForTest } from "./index";

async function main() {
	const props = buildProductionVoiceCreatePropertiesForTest({
		title: "FAQ導線改善要望",
		sourceType: "会議",
		sourcePageId: "3734d017-81e7-81fe-a3d8-dfce8f07f2ee",
		sourcePageUrl: "https://www.notion.so/test-source",
		summary: "FAQ導線を今すぐ直したい",
		type: "改善要望",
		channels: ["HP", "Instagram", "note"],
		priority: "今すぐ反映",
		fingerprint: "会議:test:123",
		assigneeIds: [],
	});

	assert.deepEqual(props["制作タスク化"], { checkbox: true });
	assert.deepEqual(props["処理状態"], { select: { name: "未処理" } });
	assert.deepEqual(props["ボイスタイトル"], {
		title: [{ text: { content: "FAQ導線改善要望" } }],
	});
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
