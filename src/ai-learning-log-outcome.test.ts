import assert from "node:assert/strict";
import { markAiLearningLogsOutcomeForTest } from "./index";

function selectProp(value: string) {
	return { type: "select", select: { name: value } };
}

function numberProp(value: number) {
	return { type: "number", number: value };
}

async function main() {
	const queries: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const notion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return {
					results: [
						{
							id: "learning-high",
							properties: {
								判定種別: selectProp("成約予測"),
								判定スコア: numberProp(85),
							},
						},
						{
							id: "learning-low",
							properties: {
								判定種別: selectProp("成約予測"),
								判定スコア: numberProp(40),
							},
						},
					],
				};
			},
		},
		pages: {
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
		},
	};

	await markAiLearningLogsOutcomeForTest(notion as never, {
		relationProperty: "関連案件",
		pageId: "project-1",
		outcome: "成約",
		outcomeDate: "2026-05-26",
		scoreThreshold: 80,
		note: "成約報告Workerが実結果を反映。",
	});

	assert.equal(queries.length, 1);
	assert.equal(updates.length, 2);
	const firstPatch = updates[0]!.properties as Record<string, unknown>;
	const secondPatch = updates[1]!.properties as Record<string, unknown>;
	assert.equal((firstPatch.実結果 as { select: { name: string } }).select.name, "成約");
	assert.equal((firstPatch["予測との差"] as { select: { name: string } }).select.name, "的中");
	assert.equal((firstPatch.ルール化判断 as { select: { name: string } }).select.name, "未判断");
	assert.equal((firstPatch.ルール化優先度 as { select: { name: string } }).select.name, "P3｜記録のみ");
	assert.equal((firstPatch.再検証状態 as { select: { name: string } }).select.name, "未検証");
	assert.equal((secondPatch["予測との差"] as { select: { name: string } }).select.name, "過小評価");
	assert.equal((secondPatch.学習反映状態 as { select: { name: string } }).select.name, "学習候補");
	assert.equal((secondPatch.ルール化優先度 as { select: { name: string } }).select.name, "P1｜今週直す");
	assert.deepEqual(
		(secondPatch.外れ原因カテゴリ as { multi_select: Array<{ name: string }> }).multi_select.map((item) => item.name),
		["配点が弱い"],
	);
	assert.deepEqual(
		(secondPatch.反映先 as { multi_select: Array<{ name: string }> }).multi_select.map((item) => item.name),
		["Worker配点", "AIプロンプト"],
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
