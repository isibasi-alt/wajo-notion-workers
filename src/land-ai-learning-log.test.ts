import assert from "node:assert/strict";
import { processLandEvaluationForTest } from "./index";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: [{ plain_text: value }] };
}

function numberProp(value: number) {
	return { type: "number", number: value };
}

function selectProp(value: string) {
	return { type: "select", select: { name: value } };
}

function emptyDateProp() {
	return { type: "date", date: null };
}

function emptyRelationProp() {
	return { type: "relation", relation: [] };
}

function landPage() {
	return {
		id: "land-1",
		properties: {
			土地名称: titleProp("橋本BESS候補地A"),
			所在地: richTextProp("和歌山県橋本市"),
			"面積（坪）": numberProp(5200),
			緯度: numberProp(34.316),
			経度: numberProp(135.6),
			電力会社エリア: selectProp("関西電力"),
			用途地域: richTextProp("市街化調整区域"),
			接道: richTextProp("4m道路に接道"),
			農地転用可否: selectProp("不要"),
			登記確認状況: selectProp("確認済み"),
			"近隣住宅距離（m）": numberProp(80),
			近隣住宅確認: selectProp("30m以上"),
			変電所距離: richTextProp("3.2km"),
			処理ステータス: selectProp("未処理"),
			案件化状態: selectProp("未案件化"),
			AIアクションバケット: selectProp("継続監視"),
			総合評価: selectProp("C"),
			AI総合スコア: numberProp(0),
			AI案件種別: selectProp("未判定"),
			土地評価: selectProp("△"),
			"電力評価（仮説）": selectProp("△"),
			AI接道評価: selectProp("要確認"),
			AI補助金評価: selectProp("要確認"),
			需要評価: selectProp("不明"),
			案件化メモ: richTextProp(""),
			一次AI受付メモ: richTextProp(""),
			次アクション: richTextProp(""),
			AI更新日時: emptyDateProp(),
			Webhook引き継ぎステータス: selectProp("待機"),
			Webhook引き継ぎメモ: richTextProp(""),
			設計上の弱点: richTextProp(""),
			AI学習ログ: emptyRelationProp(),
		},
	};
}

async function main() {
	const createdPages: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const notion = {
		pages: {
			retrieve: async () => landPage(),
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
			create: async (args: Record<string, unknown>) => {
				createdPages.push(args);
				return { id: "learning-log-1" };
			},
		},
	};

	const result = await processLandEvaluationForTest(
		{ pageId: "land-1", dryRun: false },
		notion as never,
	);

	assert.equal(result.action, "evaluated");
	assert.equal(createdPages.length, 1);
	const created = createdPages[0]!;
	assert.deepEqual(created.parent, {
		data_source_id: "0577bcac-f09d-42f6-98e4-84062956abba",
	});
	const properties = created.properties as Record<string, unknown>;
	assert.ok(properties.判定名);
	assert.ok(properties.関連土地);
	assert.ok(properties.変電所距離km);
	assert.ok(properties["土地面積（坪）"]);
	assert.ok(properties.判定根拠);
	assert.equal(updates.some((update) => update.page_id === "land-1"), true);
	const update = updates.findLast((item) => item.page_id === "land-1");
	assert.ok(update, "土地ページ更新が発生する");
	const updateProperties = update.properties as Record<string, unknown>;
	assert.deepEqual(updateProperties.農地転用可否 as { select: { name: string } }, {
		select: { name: "不要" },
	});
	assert.deepEqual(updateProperties.登記確認状況 as { select: { name: string } }, {
		select: { name: "確認済み" },
	});
	assert.deepEqual(updateProperties.近隣住宅確認 as { select: { name: string } }, {
		select: { name: "30m以上" },
	});
	const nearbyDistance = updateProperties["近隣住宅距離（m）"] as { number: number };
	assert.equal(nearbyDistance.number, 80);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
