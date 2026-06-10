import assert from "node:assert/strict";
import {
	buildProductionProjectCreatePropertiesForTest,
	mapProductionPriorityToProjectPriorityForTest,
} from "./index";

async function main() {
	assert.equal(mapProductionPriorityToProjectPriorityForTest("今すぐ反映"), "高");
	assert.equal(mapProductionPriorityToProjectPriorityForTest("次回更新時"), "中");
	assert.equal(mapProductionPriorityToProjectPriorityForTest("検討中"), "低");
	assert.equal(mapProductionPriorityToProjectPriorityForTest(""), "低");

	const properties = buildProductionProjectCreatePropertiesForTest({
		titleValue: "LPのFAQ改善",
		projectType: "改修",
		projectPriority: "高",
		fingerprint: "voice:page:123",
		voiceId: "voice-page-1",
		assigneeIds: ["member-1"],
	}) as Record<string, unknown>;

	assert.deepEqual(properties["案件種別"], { select: { name: "改修" } });
	assert.deepEqual(properties["起票元"], { select: { name: "現場ボイス自動生成" } });
	assert.deepEqual(properties["優先度"], { select: { name: "高" } });
	assert.deepEqual(properties["関連現場ボイス"], { relation: [{ id: "voice-page-1" }] });
	assert.deepEqual(properties["担当者"], { relation: [{ id: "member-1" }] });
	assert.deepEqual(properties["ステータス"], { select: { name: "未着手" } });
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
