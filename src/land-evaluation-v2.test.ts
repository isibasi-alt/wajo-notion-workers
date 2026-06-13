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

function baseLandPage(overrides: Record<string, unknown> = {}) {
	return {
		id: String(overrides.id ?? "land-v2"),
		properties: {
			土地名称: titleProp("土地評価v2テスト"),
			所在地: richTextProp("三重県鈴鹿市国分町池ノ谷"),
			地番: richTextProp("101-1"),
			"面積（坪）": numberProp(1800),
			電力会社エリア: selectProp("中部電力"),
			用途地域: richTextProp("非線引き"),
			農地種別: richTextProp("地目=田 / 農振法区分=農用地区域外 / 農地区分=第2種農地想定 / 所管農業委員会=鈴鹿市農業委員会"),
			農地転用可否: richTextProp("許可済"),
			接道状況: richTextProp("南側市道 / 幅員6m / 大型車進入 可"),
			登記確認状況: richTextProp("確認済み / 権利リスクなし"),
			近隣住宅距離: richTextProp("120m"),
			変電所距離: richTextProp("2.4km"),
			処理ステータス: selectProp("未処理"),
			案件化状態: selectProp("未案件化"),
			AIアクションバケット: selectProp("継続監視"),
			総合評価: selectProp("C"),
			AI総合スコア: numberProp(0),
			AI案件種別: selectProp("未判定"),
			土地評価: selectProp("△"),
			"電力評価（仮説）": selectProp("△"),
			電力評価: selectProp("△"),
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
			...overrides,
		},
	};
}

function plainTextFromProperty(property: unknown): string {
	const record = property as Record<string, unknown>;
	const rich = record?.rich_text as Array<{ plain_text?: string; text?: { content?: string } }> | undefined;
	if (Array.isArray(rich)) {
		return rich.map((item) => item.plain_text ?? item.text?.content ?? "").join("");
	}
	const title = record?.title as Array<{ plain_text?: string; text?: { content?: string } }> | undefined;
	if (Array.isArray(title)) {
		return title.map((item) => item.plain_text ?? item.text?.content ?? "").join("");
	}
	return "";
}

async function evaluate(page: ReturnType<typeof baseLandPage>) {
	const updates: Array<Record<string, unknown>> = [];
	const createdPages: Array<Record<string, unknown>> = [];
	const notion = {
		pages: {
			retrieve: async () => page,
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
			create: async (args: Record<string, unknown>) => {
				createdPages.push(args);
				return { id: "learning-log-v2" };
			},
		},
	};
	const result = await processLandEvaluationForTest(
		{ pageId: page.id, dryRun: false },
		notion as never,
	);
	const mergedProperties = Object.assign({}, ...updates.map((update) => update.properties ?? {}));
	return { result, updates, createdPages, mergedProperties };
}

async function main() {
	const strong = await evaluate(baseLandPage());
	assert.equal(strong.result.action, "evaluated");
	assert.equal(strong.result.overallGrade, "S");
	assert.match(strong.result.bucket, /S: 即アタック/);
	const strongMemo = plainTextFromProperty(strong.mergedProperties.案件化メモ);
	const strongNext = plainTextFromProperty(strong.mergedProperties.次アクション);
	assert.match(strongMemo, /判定バージョン: land-evaluation-v2/);
	assert.match(strongMemo, /細分化分岐: S/);
	assert.match(strongMemo, /分岐材料/);
	assert.match(strongMemo, /農地・農転/);
	assert.match(strongMemo, /接道/);
	assert.match(strongMemo, /WAJOナレッジ/);
	assert.match(strongMemo, /営業部データ未回収/);
	assert.match(strongNext, /所有者/);
	assert.match(strongNext, /系統/);
	assert.match(strongNext, /再判定/);

	const numericGridDistance = await evaluate(baseLandPage({
		id: "land-s-number-distance",
		用途地域: selectProp("その他"),
		農地種別: selectProp("第2種農地"),
		農地転用可否: selectProp("可能"),
		登記確認状況: selectProp("取得済"),
		変電所距離: richTextProp(""),
		"変電所距離（km）": numberProp(2.4),
	}));
	assert.equal(numericGridDistance.result.overallGrade, "S");
	assert.match(numericGridDistance.result.bucket, /S: 即アタック/);
	const numericGridMemo = plainTextFromProperty(numericGridDistance.mergedProperties.案件化メモ);
	assert.match(numericGridMemo, /変電所距離=2.4km/);

	const parallel = await evaluate(baseLandPage({
		id: "land-a",
		"面積（坪）": numberProp(800),
	}));
	assert.equal(parallel.result.overallGrade, "A");
	assert.match(parallel.result.bucket, /A: 並行調査/);
	const parallelNext = plainTextFromProperty(parallel.mergedProperties.次アクション);
	assert.match(parallelNext, /並行調査/);

	const missing = await evaluate(baseLandPage({
		id: "land-b",
		地番: richTextProp(""),
		農地種別: richTextProp("未確認"),
		農地転用可否: richTextProp("未確認"),
		接道状況: richTextProp("Google Mapsのみ / 幅員未確認"),
		登記確認状況: richTextProp("未確認"),
		変電所距離: richTextProp("未確認"),
	}));
	assert.equal(missing.result.overallGrade, "B");
	assert.match(missing.result.bucket, /B: 追加資料/);
	const missingNext = plainTextFromProperty(missing.mergedProperties.次アクション);
	assert.match(missingNext, /土地DB「所在地」/);
	assert.match(missingNext, /土地DB「農地種別」/);
	assert.match(missingNext, /土地DB「接道状況」/);
	assert.match(missingNext, /期限/);

	const managerReview = await evaluate(baseLandPage({
		id: "land-c",
		農地種別: richTextProp("地目=田 / 農振法区分=農用地区域 / 農地区分=未確認"),
		農地転用可否: richTextProp("未申請"),
	}));
	assert.equal(managerReview.result.overallGrade, "C");
	assert.match(managerReview.result.bucket, /C: 責任者判断/);
	const managerReviewNext = plainTextFromProperty(managerReview.mergedProperties.次アクション);
	assert.match(managerReviewNext, /責任者判断/);

	const blocked = await evaluate(baseLandPage({
		id: "land-d",
		接道状況: richTextProp("無接道 / 第三者地を通らないと入れない"),
		登記確認状況: richTextProp("共有あり / 通行権未確認"),
		農地種別: richTextProp("地目=田 / 農振法区分=農用地区域 / 農地区分=未確認"),
		農地転用可否: richTextProp("未申請"),
	}));
	assert.equal(blocked.result.overallGrade, "D");
	assert.match(blocked.result.bucket, /D: 原則停止/);
	const blockedNext = plainTextFromProperty(blocked.mergedProperties.次アクション);
	assert.match(blockedNext, /現地訪問や追加費用を原則止める/);

	const impossible = await evaluate(baseLandPage({
		id: "land-x",
		所在地: richTextProp("入力不一致: 住所と座標が別地域"),
	}));
	assert.equal(impossible.result.overallGrade, "X");
	assert.match(impossible.result.bucket, /X: 入力不一致/);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
