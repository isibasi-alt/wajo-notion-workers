import assert from "node:assert/strict";
import { processLandEvaluationForTest } from "./index";
import { evaluateLandTreasure } from "./land-treasure-engine";

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

function multiSelectProp(...values: string[]) {
	return { type: "multi_select", multi_select: values.map((name) => ({ name })) };
}

function dateProp() {
	return { type: "date", date: null };
}

function relationProp(ids: string[] = []) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function patchText(value: unknown): string {
	if (!value || typeof value !== "object") return String(value ?? "");
	const prop = value as Record<string, unknown>;
	const richText = prop.rich_text;
	if (Array.isArray(richText)) {
		return richText
			.map((item) => {
				if (!item || typeof item !== "object") return "";
				const record = item as Record<string, unknown>;
				const text = record.text;
				if (text && typeof text === "object") {
					const content = (text as Record<string, unknown>).content;
					if (typeof content === "string") return content;
				}
				const plainText = record.plain_text;
				return typeof plainText === "string" ? plainText : "";
			})
			.join("");
	}
	return JSON.stringify(value);
}

function patchPropertiesText(value: unknown): string {
	if (!value || typeof value !== "object") return String(value ?? "");
	return [
		...Object.values(value as Record<string, unknown>).map((property) => patchText(property)),
		JSON.stringify(value),
	].join("\n");
}

function highValueLandPage() {
	return {
		id: "land-treasure-1",
		properties: {
			土地名称: titleProp("【TDD】中部・変電所近接 6000坪"),
			所在地: richTextProp("岐阜県土岐市 土岐津町 テスト用地"),
			"面積（坪）": numberProp(6000),
			緯度: numberProp(35.3556),
			経度: numberProp(137.1801),
			対象一意性: richTextProp("正本ページ確定"),
			営業対象区分: selectProp("本番候補"),
			正本ページ: richTextProp("正本ページ確定"),
			電力会社エリア: selectProp("中部電力"),
			用途地域: richTextProp("準工業地域"),
			接道状況: richTextProp("南側6m公道に接道。大型車進入可。"),
			農地転用可否: selectProp("不要"),
			登記確認状況: selectProp("確認済み"),
			入力根拠区分: richTextProp("原本"),
			"変電所距離（km）": numberProp(0.1),
			"近隣住宅距離（m）": numberProp(120),
			近隣住宅確認: selectProp("30m以上"),
			送電線の有無: selectProp("近接あり"),
			処理ステータス: selectProp("未処理"),
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
		資料回収状態: selectProp("未依頼"),
		資料回収の状況: multiSelectProp(),
		資料回収依頼: richTextProp(""),
		AI更新日時: dateProp(),
			Webhook引き継ぎステータス: selectProp("待機"),
			Webhook引き継ぎメモ: richTextProp(""),
			設計上の弱点: richTextProp(""),
			Aゾーン配点バージョン: richTextProp(""),
			Aゾーン内部スコア100: numberProp(0),
			Aゾーン内部スコア60: numberProp(0),
			Aゾーン内部採点内訳: richTextProp(""),
			Aゾーン取得元サマリー: richTextProp(""),
			Aゾーン人間回収項目: richTextProp(""),
				AI学習ログ: relationProp(),
			},
	};
}

function highValueLandPageWithoutExactCoordinates() {
	const page = highValueLandPage();
	const properties = { ...page.properties };
	delete properties.緯度;
	delete properties.経度;
	delete properties["変電所距離（km）"];
	return {
		...page,
		id: "land-gsi-candidate-must-review-1",
		properties: {
			...properties,
			土地名称: titleProp("【TDD】GSI候補座標は完了扱いしない"),
			所在地: richTextProp("岐阜県土岐市土岐津町"),
		},
	};
}

function highValueLandPageWithoutExactCoordinatesButWithDistance() {
	const page = highValueLandPage();
	const properties = { ...page.properties };
	delete properties.緯度;
	delete properties.経度;
	return {
		...page,
		id: "land-gsi-candidate-with-distance-1",
		properties: {
			...properties,
			土地名称: titleProp("【TDD】距離入力済みでもGSI候補は取得する"),
			所在地: richTextProp("岐阜県土岐市土岐津町"),
		},
	};
}

function linkedCaseLandPage() {
	const page = highValueLandPage();
	return {
		...page,
		id: "land-linked-case-1",
		properties: {
			...page.properties,
			土地名称: titleProp("【TDD】案件化済み土地は詳細評価で戻さない"),
			関連案件: relationProp(["project-linked-1"]),
		},
	};
}

function nearSubstationButBlockedPage() {
	return {
		id: "land-blocked-1",
		properties: {
			土地名称: titleProp("【TDD】近いだけで危ない土地"),
			所在地: richTextProp("岐阜県土岐市 土岐津町 テスト用地"),
			"面積（坪）": numberProp(6000),
			緯度: numberProp(35.3556),
			経度: numberProp(137.1801),
			電力会社エリア: selectProp("中部電力"),
			用途地域: selectProp("市街化調整区域"),
			接道状況: richTextProp("未接道。大型車進入不可。"),
			農地転用可否: selectProp("不可"),
			登記確認状況: selectProp("所有者不明"),
			"変電所距離（km）": numberProp(0.1),
			"近隣住宅距離（m）": numberProp(10),
			近隣住宅確認: selectProp("30m未満"),
			送電線の有無: selectProp("近接あり"),
			処理ステータス: selectProp("未処理"),
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
			AI更新日時: dateProp(),
			Webhook引き継ぎステータス: selectProp("待機"),
			Webhook引き継ぎメモ: richTextProp(""),
			設計上の弱点: richTextProp(""),
			Aゾーン配点バージョン: richTextProp(""),
			Aゾーン内部スコア100: numberProp(0),
			Aゾーン内部スコア60: numberProp(0),
			Aゾーン内部採点内訳: richTextProp(""),
			Aゾーン取得元サマリー: richTextProp(""),
			Aゾーン人間回収項目: richTextProp(""),
			AI学習ログ: relationProp(),
			},
	};
}

function secondaryEvidenceHighValuePage() {
	const page = highValueLandPage();
	return {
		...page,
		id: "land-secondary-evidence-1",
		properties: {
			...page.properties,
			土地名称: titleProp("【TDD】二次資料だけでは原本待ち"),
			入力根拠区分: richTextProp("二次資料"),
		},
	};
}

function officialEvidenceHighValuePage() {
	const page = highValueLandPage();
	return {
		...page,
		id: "land-official-evidence-1",
		properties: {
			...page.properties,
			土地名称: titleProp("【TDD】行政正式書面で評価を継続"),
			入力根拠区分: richTextProp("行政正式書面"),
		},
	};
}

function duplicateTargetLandPage() {
	const page = highValueLandPage();
	return {
		...page,
		id: "land-duplicate-target-1",
		properties: {
			...page.properties,
			土地名称: titleProp("【TDD】対象土地が複数候補"),
			対象一意性: richTextProp("候補複数。13,000坪 / 12,000坪 / 3,800坪が未分離"),
		},
	};
}

function testDraftLandPage() {
	const page = highValueLandPage();
	return {
		...page,
		id: "land-test-draft-target-1",
		properties: {
			...page.properties,
			土地名称: titleProp("【TDD】テスト表示は本番候補にしない"),
			営業対象区分: selectProp("テスト"),
			処理ステータス: selectProp("下書き"),
		},
	};
}

function missingRequiredInputPage() {
	return {
		id: "land-missing-required-input-1",
		properties: {
			土地名称: titleProp("【TDD】所在地と面積が未入力"),
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
			AI更新日時: dateProp(),
			Webhook引き継ぎステータス: selectProp("待機"),
			Webhook引き継ぎメモ: richTextProp(""),
			設計上の弱点: richTextProp(""),
			Aゾーン配点バージョン: richTextProp(""),
			Aゾーン内部スコア100: numberProp(0),
			Aゾーン内部スコア60: numberProp(0),
			Aゾーン内部採点内訳: richTextProp(""),
			Aゾーン取得元サマリー: richTextProp(""),
			Aゾーン人間回収項目: richTextProp(""),
			AI学習ログ: relationProp(),
		},
	};
}

function addressOnlyPage() {
	return {
		id: "land-address-only-1",
		properties: {
			土地名称: titleProp("【TDD】住所だけの土地"),
			所在地: richTextProp("岐阜県土岐市土岐津町"),
			"面積（坪）": numberProp(6000),
			処理ステータス: selectProp("未処理"),
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
			AI更新日時: dateProp(),
			Webhook引き継ぎステータス: selectProp("待機"),
			Webhook引き継ぎメモ: richTextProp(""),
			設計上の弱点: richTextProp(""),
			Aゾーン配点バージョン: richTextProp(""),
			Aゾーン内部スコア100: numberProp(0),
			Aゾーン内部スコア60: numberProp(0),
			Aゾーン内部採点内訳: richTextProp(""),
			Aゾーン取得元サマリー: richTextProp(""),
			Aゾーン人間回収項目: richTextProp(""),
			AI学習ログ: relationProp(),
		},
	};
}

async function main() {
	const scaleDistanceGateInput = {
		name: "【TDD】D規模距離ゲート",
		address: "岐阜県土岐市 土岐津町 テスト用地",
		areaTsubo: 6000,
		powerArea: "中部電力",
		landUse: "準工業地域",
		road: "南側6m公道に接道。大型車進入可。",
		farmland: "不要",
		farmlandType: "",
		registry: "確認済み",
		nearbyResidentialDistanceM: 10,
		nearbyResidentialCheck: "30m未満",
		transmissionLine: "近接あり",
		latitude: 35.3556,
		longitude: 137.1801,
		substationDistanceKm: null,
	};
	const scaleDistancePass = evaluateLandTreasure(scaleDistanceGateInput);
	assert.equal(scaleDistancePass.scaleDistanceGate, "通過候補");
	assert.equal(scaleDistancePass.scaleDistanceEvidenceState, "根拠未確認");
	assert.equal(scaleDistancePass.scaleDistanceSource, "変電所DB座標再計算");
	assert.equal(scaleDistancePass.quickDecision, "行く");
	assert.match(scaleDistancePass.nextAction, /この土地は速報では「行く」/);
	assert.match(scaleDistancePass.nextAction, /70点判定に上げるため、\d{4}-\d{2}-\d{2} 18:00まで/);
	assert.match(scaleDistancePass.nextAction, /1\. 地番/);
	assert.match(scaleDistancePass.nextAction, /5\. 現地感メモ/);
	assert.match(scaleDistancePass.missingDataRequest, /【今AIが欲しいデータ】/);
	assert.match(scaleDistancePass.missingDataRequest, /誰が取るか/);
	assert.match(scaleDistancePass.missingDataRequest, /大ちゃんに即出すタスク/);
	assert.match(scaleDistancePass.missingDataRequest, /取れたら何が分かるか/);
	assert.match(scaleDistancePass.missingDataRequest, /系統公開情報/);
	assert.match(scaleDistancePass.missingDataRequest, /OCCTO\/送配電会社系統情報/);
	assert.match(scaleDistancePass.missingDataRequest, /費用発生、申請、電話/);
	assert.match(scaleDistancePass.missingDataRequest, /WAGRI\/eMAFF農地情報/);
	assert.match(scaleDistancePass.missingDataRequest, /WAJO過去結果/);
	assert.match(scaleDistancePass.nextAction, /不足のまま出す速報/);
	assert.match(scaleDistancePass.reviewMemo, /D規模・距離ゲート=通過候補.*根拠未確認/);
	assert.equal(
		evaluateLandTreasure({ ...scaleDistanceGateInput, inputEvidenceState: "原本" }).scaleDistanceEvidenceState,
		"根拠確認済み",
	);
	assert.match(scaleDistancePass.reviewMemo, /近隣住宅注意/);
	assert.doesNotMatch(scaleDistancePass.reviewMemo, /主な阻害要因:.*近隣住宅/);
	const scaleDistanceSmall = evaluateLandTreasure({ ...scaleDistanceGateInput, areaTsubo: 2999 });
	assert.equal(scaleDistanceSmall.scaleDistanceGate, "面積不足");
	assert.match(scaleDistanceSmall.nextAction, /面積3,000坪/);
	const scaleDistanceTiny = evaluateLandTreasure({ ...scaleDistanceGateInput, areaTsubo: 200 });
	assert.equal(scaleDistanceTiny.quickDecision, "行かない");
	assert.match(scaleDistanceTiny.nextAction, /例外的に追う場合/);
	const scaleDistanceFar = evaluateLandTreasure({
			...scaleDistanceGateInput,
			latitude: null,
			longitude: null,
			substationDistanceKm: 2.1,
		});
	assert.equal(scaleDistanceFar.scaleDistanceGate, "距離超過");
	assert.equal(scaleDistanceFar.scaleDistanceSource, "土地DB手入力距離");
	assert.match(scaleDistanceFar.nextAction, /直線距離2km/);

	const updates: Array<Record<string, unknown>> = [];
	const createdPages: Array<Record<string, unknown>> = [];
	let activePage = highValueLandPage();
	const originalFetch = globalThis.fetch;
	const originalGoogleKey = process.env.GOOGLE_MAPS_API_KEY;
	const originalGoogleApiKey = process.env.GOOGLE_API_KEY;
	const originalWagriToken = process.env.WAGRI_ACCESS_TOKEN;
	const originalReinfolibKey = process.env.REINFOLIB_API_KEY;
	const originalMojChizuGeoJsonUrls = process.env.MOJ_CHIZU_GEOJSON_URLS;
	const originalMojChizuGeoJsonUrl = process.env.MOJ_CHIZU_GEOJSON_URL;
	const originalGsiRoadTileEnabled = process.env.GSI_ROAD_TILE_ENABLED;
	const originalGridCapacityPublicUrls = process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
	const originalGridCapacityPublicUrl = process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
	process.env.GSI_ROAD_TILE_ENABLED = "0";
	const notion = {
		pages: {
			retrieve: async () => activePage,
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
		{ pageId: "land-treasure-1", dryRun: false },
		notion as never,
	);

	assert.equal(result.action, "evaluated");
	assert.equal(result.overallGrade, "S");
	assert.equal(result.bucket, "即アタック");
	assert.equal(result.scaleDistanceGate, "通過候補");
	assert.equal(result.scaleDistanceEvidenceState, "根拠確認済み");
	assert.ok(result.score >= 90);
	assert.equal(result.cZoneReady, true);
	assert.match(result.cZoneReadiness, /Cゾーン再評価: 可/);
	assert.match(result.cZoneReadiness, /原本採用可否=可/);
	assert.match(result.bZoneHandoff, /追加の人間回収なし/);

	const finalUpdate = updates.at(-1)?.properties as Record<string, unknown>;
	assert.deepEqual(finalUpdate.総合評価, { select: { name: "S" } });
	assert.deepEqual(finalUpdate.AI総合スコア, { number: result.score });

	const memo = patchText(finalUpdate.案件化メモ);
	const finalAZoneScore100 = (finalUpdate.Aゾーン内部スコア100 as { number?: number } | undefined)?.number ?? 0;
	const finalAZoneScore60 = (finalUpdate.Aゾーン内部スコア60 as { number?: number } | undefined)?.number ?? 0;
	assert.ok(finalAZoneScore100 > 0);
	assert.ok(finalAZoneScore60 > 0);
	assert.notEqual(finalAZoneScore100, result.score);
	assert.match(JSON.stringify(finalUpdate.Aゾーン配点バージョン ?? {}), /v0/);
	assert.match(JSON.stringify(finalUpdate.Aゾーン内部採点内訳 ?? {}), /配点バージョン=v0/);
	assert.match(JSON.stringify(finalUpdate.Aゾーン内部採点内訳 ?? {}), /100点換算=/);
	assert.match(JSON.stringify(finalUpdate.Aゾーン内部採点内訳 ?? {}), /60点換算=/);
	assert.match(JSON.stringify(finalUpdate.一次AI受付メモ ?? {}), /配点バージョン=v0/);
	assert.match(memo, /最寄り変電所/);
	assert.match(memo, /変電所候補3件/);
	assert.match(memo, /1\..*変電所.*km/);
	assert.match(memo, /2\..*変電所.*km/);
	assert.match(memo, /3\..*変電所.*km/);
	assert.match(memo, /確認リンク/);
	assert.match(memo, /google\.com\/maps\/search/);
	assert.match(memo, /土岐津変電所/);
	assert.match(memo, /2AI/);
	assert.match(memo, /接道/);
	assert.match(memo, /顧客に提示できる価値/);
	assert.match(memo, /鳥の目/);
	assert.match(memo, /農転事前判定/);
	assert.match(memo, /見込みランク: 高/);
	assert.match(memo, /正式確認状態: 回答済み/);
	assert.match(memo, /営業担当への入力案内/);
	assert.match(memo, /この土地は速報では「行く」/);
	assert.match(memo, /【今AIが欲しいデータ】/);
	assert.match(memo, /誰が取るか/);
	assert.match(memo, /大ちゃんに即出すタスク/);
	assert.match(memo, /取れたら何が分かるか/);
	assert.match(memo, /系統公開情報/);
	assert.match(memo, /OCCTO\/送配電会社系統情報/);
	assert.match(memo, /WAGRI\/eMAFF農地情報/);
	assert.match(memo, /WAJO過去結果/);
	assert.match(memo, /D規模・距離ゲート=通過候補/);
	assert.match(JSON.stringify(finalUpdate.次アクション ?? {}), /70点判定に上げるため/);
	assert.match(JSON.stringify(finalUpdate.次アクション ?? {}), /Cゾーン再評価: 可/);

	assert.equal(createdPages.length, 1);
	const learningLog = createdPages[0]!.properties as Record<string, unknown>;
	assert.match(JSON.stringify(learningLog.判定根拠), /2AI/);
	assert.match(JSON.stringify(learningLog.判定根拠), /SABC/);
	assert.match(JSON.stringify(learningLog.判定根拠), /Aゾーン内部採点/);
	assert.match(JSON.stringify(learningLog.判定根拠), /配点バージョン=v0/);
	assert.match(JSON.stringify(learningLog.判定バージョン), /a-zone-score-v0/);

	activePage = highValueLandPage();
	const dryRunResult = await processLandEvaluationForTest(
		{ pageId: "land-treasure-dry-run-1", dryRun: true },
		notion as never,
	);
	assert.equal(dryRunResult.action, "dry-run");
	assert.match(dryRunResult.sourceSummary ?? "", /証拠区分=原本/);
	assert.match(dryRunResult.sourceSummary ?? "", /証拠区分=AI注記/);
	assert.match(dryRunResult.humanCollectionItems ?? "", /作業指示|営業担当への入力案内/);
	assert.match(dryRunResult.bZoneHandoff ?? "", /追加の人間回収なし/);
	assert.equal(dryRunResult.cZoneReady, true);
	assert.match(dryRunResult.cZoneReadiness ?? "", /Cゾーン再評価: 可/);
	assert.equal(dryRunResult.aZoneScore?.version, "v0");

	activePage = secondaryEvidenceHighValuePage();
	const secondaryEvidenceResult = await processLandEvaluationForTest(
		{ pageId: "land-secondary-evidence-1", dryRun: false },
		notion as never,
	);
	assert.equal(secondaryEvidenceResult.action, "needs-review");
	assert.equal(secondaryEvidenceResult.bucket, "要確認");
	assert.equal(secondaryEvidenceResult.overallGrade, "未評価");
	assert.equal(secondaryEvidenceResult.score, null);
	assert.equal(secondaryEvidenceResult.aZoneDecision, "未確認");
	assert.equal(secondaryEvidenceResult.aZoneScore?.total100, 0);
	assert.equal(secondaryEvidenceResult.cZoneReady, false);
	assert.match(secondaryEvidenceResult.cZoneReadiness ?? "", /Cゾーン再評価: 不可/);
	assert.match(secondaryEvidenceResult.cZoneReadiness ?? "", /入力根拠区分=二次資料/);
	assert.match(secondaryEvidenceResult.bZoneHandoff ?? "", /担当=営業担当/);
	assert.match(secondaryEvidenceResult.bZoneHandoff ?? "", /戻し先=土地DB/);
	const secondaryEvidenceUpdate = updates.at(-1)?.properties as Record<string, unknown>;
	const secondaryAZoneScore100 = (secondaryEvidenceUpdate.Aゾーン内部スコア100 as { number?: number } | undefined)?.number ?? 0;
	assert.equal(secondaryAZoneScore100, 0);
	assert.ok(secondaryAZoneScore100 < finalAZoneScore100);
	assert.match(
		JSON.stringify(secondaryEvidenceUpdate ?? {}),
		/二次資料|原本待ち/,
	);
	assert.deepEqual(secondaryEvidenceUpdate.総合評価, { select: null });
	assert.deepEqual(secondaryEvidenceUpdate.AI総合スコア, { number: null });
	assert.match(JSON.stringify(secondaryEvidenceUpdate.案件化メモ ?? {}), /Aゾーン判断: 未確認/);
	assert.doesNotMatch(JSON.stringify(secondaryEvidenceUpdate.案件化メモ ?? {}), /Aゾーン判断: 行く/);
	assert.match(JSON.stringify(secondaryEvidenceUpdate.Webhook引き継ぎメモ ?? {}), /Cゾーン再評価: 不可/);

	activePage = duplicateTargetLandPage();
	const duplicateTargetResult = await processLandEvaluationForTest(
		{ pageId: "land-duplicate-target-1", dryRun: false },
		notion as never,
	);
	assert.equal(duplicateTargetResult.action, "needs-review");
	assert.equal(duplicateTargetResult.overallGrade, "未評価");
	assert.equal(duplicateTargetResult.score, null);
	assert.equal(duplicateTargetResult.aZoneDecision, "未確認");
	assert.equal(duplicateTargetResult.cZoneReady, false);
	assert.match(duplicateTargetResult.cZoneReadiness ?? "", /対象土地一意性/);
	assert.ok(duplicateTargetResult.investigationGaps.includes("対象土地一意性"));
	const duplicateTargetMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(duplicateTargetMemo, /対象土地一意性/);
	assert.match(duplicateTargetMemo, /本番候補\/旧データ\/テスト/);
	assert.deepEqual((updates.at(-1)?.properties as Record<string, unknown>).総合評価, { select: null });
	assert.deepEqual((updates.at(-1)?.properties as Record<string, unknown>).AI総合スコア, { number: null });

	activePage = testDraftLandPage();
	const testDraftResult = await processLandEvaluationForTest(
		{ pageId: "land-test-draft-target-1", dryRun: false },
		notion as never,
	);
	assert.equal(testDraftResult.action, "needs-review");
	assert.equal(testDraftResult.overallGrade, "未評価");
	assert.equal(testDraftResult.score, null);
	assert.equal(testDraftResult.aZoneDecision, "未確認");
	assert.equal(testDraftResult.cZoneReady, false);
	assert.match(testDraftResult.cZoneReadiness ?? "", /テスト\/下書き/);

	activePage = linkedCaseLandPage();
	const linkedCaseUpdateStart = updates.length;
	const linkedCaseResult = await processLandEvaluationForTest(
		{ pageId: "land-linked-case-1", dryRun: false },
		notion as never,
	);
	assert.equal(linkedCaseResult.action, "evaluated");
	const linkedCaseUpdates = updates.slice(linkedCaseUpdateStart);
	assert.ok(linkedCaseUpdates.length >= 2);
	for (const update of linkedCaseUpdates) {
		const properties = update.properties as Record<string, unknown>;
		assert.equal(
			"案件化状態" in properties,
			false,
			"関連案件ありの土地は詳細評価で旧案件化列を書き戻さない",
		);
	}
	assert.deepEqual(
		(linkedCaseUpdates.at(-1)?.properties as Record<string, unknown>).処理ステータス,
		{ select: { name: "完了" } },
	);

	activePage = secondaryEvidenceHighValuePage();
	const secondaryEvidenceResult2 = await processLandEvaluationForTest(
		{ pageId: "land-secondary-evidence-1", dryRun: false },
		notion as never,
	);
	assert.equal(secondaryEvidenceResult2.action, "needs-review");
	assert.equal(secondaryEvidenceResult2.bucket, "要確認");
	assert.match(
		JSON.stringify(updates.at(-1)?.properties ?? {}),
		/二次資料|原本待ち/,
	);
	assert.match(
		JSON.stringify(updates.at(-1)?.properties ?? {}),
		/営業資料回収依頼/,
	);
	assert.match(
		JSON.stringify(updates.at(-1)?.properties ?? {}),
		/根拠区分を「原本」または「行政正式書面」/,
	);
	assert.deepEqual(
		(updates.at(-1)?.properties as Record<string, unknown>).資料回収の状況,
		{ multi_select: [{ name: "要回収" }] },
	);

	activePage = officialEvidenceHighValuePage();
	const officialEvidenceResult = await processLandEvaluationForTest(
		{ pageId: "land-official-evidence-1", dryRun: false },
		notion as never,
	);
	assert.equal(officialEvidenceResult.action, "evaluated");
	assert.equal(officialEvidenceResult.bucket, "即アタック");
	assert.doesNotMatch(JSON.stringify(updates.at(-1)?.properties ?? {}), /原本待ち/);

	activePage = nearSubstationButBlockedPage();
	const blockedResult = await processLandEvaluationForTest(
		{ pageId: "land-blocked-1", dryRun: false },
		notion as never,
	);
	assert.equal(blockedResult.overallGrade, "未評価");
	assert.equal(blockedResult.score, null);
	assert.equal(blockedResult.aZoneDecision, "未確認");
	assert.notEqual(blockedResult.bucket, "即アタック");
	const blockedMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(blockedMemo, /変電所だけでは/);
	assert.match(blockedMemo, /未接道/);
	assert.match(blockedMemo, /農転|農地/);
	assert.match(blockedMemo, /近隣住宅/);
	assert.match(blockedMemo, /農転事前判定/);
	assert.match(blockedMemo, /見込みランク: 低/);
	assert.match(blockedMemo, /停止・責任者判断/);

	process.env.GOOGLE_MAPS_API_KEY = "test-google-key";
	process.env.WAGRI_ACCESS_TOKEN = "test-wagri-token";
	process.env.REINFOLIB_API_KEY = "test-reinfolib-key";
	process.env.REINFOLIB_LAND_PRICE_YEAR = "2025";
	process.env.REINFOLIB_TRANSACTION_YEAR = "2025";
	process.env.MOJ_CHIZU_GEOJSON_URLS = "https://mock.local/moj-chizu-toki.geojson";
	process.env.GSI_ROAD_TILE_ENABLED = "1";
	process.env.GRID_CAPACITY_PUBLIC_JSON_URLS = "https://mock.local/grid-capacity-chubu.json";
	const fetchedUrls: string[] = [];
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = String(input);
		fetchedUrls.push(url);
		if (url.includes("/geocode/")) {
			return new Response(
				JSON.stringify({
					results: [
						{
							geometry: {
								location: { lat: 35.3556, lng: 137.1801 },
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("msearch.gsi.go.jp/address-search/AddressSearch")) {
			return new Response(
				JSON.stringify([
					{
						geometry: {
							type: "Point",
							coordinates: [137.19249, 35.353012],
						},
						properties: {
							title: "岐阜県土岐市土岐津町高山",
						},
					},
				]),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/nearestRoads")) {
			return new Response(
				JSON.stringify({ snappedPoints: [{ placeId: "mock-road-place-1" }] }),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("places.googleapis.com/v1/places:searchNearby")) {
			return new Response(
				JSON.stringify({
					places: [
						{
							displayName: { text: "土岐市立テスト小学校" },
							primaryType: "school",
							formattedAddress: "岐阜県土岐市土岐津町テスト1",
							location: { latitude: 35.356, longitude: 137.1806 },
							googleMapsUri: "https://maps.google.com/?cid=school",
						},
						{
							displayName: { text: "土岐テスト病院" },
							primaryType: "hospital",
							formattedAddress: "岐阜県土岐市土岐津町テスト2",
							location: { latitude: 35.3548, longitude: 137.1794 },
							googleMapsUri: "https://maps.google.com/?cid=hospital",
						},
						{
							displayName: { text: "土岐市駅" },
							primaryType: "train_station",
							formattedAddress: "岐阜県土岐市泉町",
							location: { latitude: 35.359, longitude: 137.182 },
							googleMapsUri: "https://maps.google.com/?cid=station",
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/experimental_rdcl/")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "LineString",
								coordinates: [
									[137.1799, 35.3553],
									[137.1804, 35.3558],
								],
							},
							properties: {
								name: "市道テスト線",
								rdCtg: "市町村道等",
								rnkWidth: "5.5m以上13m未満",
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/farmland/AgriculturalLand/SearchByLongitudeLatitude")) {
			return new Response(
				JSON.stringify([
					{
						CityCode: "212121",
						Latitude: 35.35561,
						Longitude: 137.18009,
						Address: "岐阜県土岐市土岐津町字テスト123",
						LandCategory: "田",
						Area: 6100,
						AgriculturalVibrationMethodClassification: "農業振興地域内・農用地区域内",
						CityPlanningActClassification: "市街化調整区域",
						IntentionOwnerAgriculturalLand: "非公表",
						RightClassification: "賃借権等の設定がない",
						IsIdleAgriculturalLand: "調査中",
						JurisdictionAgricultureCommitteeName: "土岐市農業委員会",
					},
				]),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/farmland/FieldPolygonID3/Get")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "Polygon",
								coordinates: [
									[
										[137.1797, 35.3552],
										[137.1805, 35.3552],
										[137.1805, 35.356],
										[137.1797, 35.356],
										[137.1797, 35.3552],
									],
								],
							},
							properties: {
								FieldPolygonId: "WAGRI-FP-123",
								CityCode: "21212",
								Area: 6120,
								LandCategory: "田",
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/XPT002")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: { type: "Point", coordinates: [137.1802, 35.3555] },
							properties: {
								city_code: "21212",
								target_year_name_ja: "令和7年1月1日",
								use_category_name_ja: "工業地",
								location_number_ja: "岐阜県土岐市土岐津町テスト123",
								u_current_years_price_ja: "32,000(円/㎡)",
								year_on_year_change_rate: "1.2",
								front_road_name_ja: "市道",
								front_road_width: 600,
								area_division_name_ja: "市街化区域",
								regulations_use_category_name_ja: "準工業地域",
								u_regulations_building_coverage_ratio_ja: "60(%)",
								u_regulations_floor_area_ratio_ja: "200(%)",
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/XKT002")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "Polygon",
								coordinates: [
									[
										[137.179, 35.354],
										[137.182, 35.354],
										[137.182, 35.357],
										[137.179, 35.357],
										[137.179, 35.354],
									],
								],
							},
							properties: {
								city_code: "21212",
								city_name: "土岐市",
								use_area_ja: "準工業地域",
								u_building_coverage_ratio_ja: "60%",
								u_floor_area_ratio_ja: "200%",
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/XKT026")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "Polygon",
								coordinates: [
									[
										[137.179, 35.354],
										[137.182, 35.354],
										[137.182, 35.357],
										[137.179, 35.357],
										[137.179, 35.354],
									],
								],
							},
							properties: {
								A31a_202: "庄内川水系テスト川",
								A31a_205: 1,
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/XKT016") || url.includes("/XKT029")) {
			return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
		if (url.includes("/XIT001")) {
			return new Response(
				JSON.stringify({
					data: [
						{
							Type: "宅地(土地)",
							MunicipalityCode: "21212",
							Municipality: "土岐市",
							DistrictName: "土岐津町",
							TradePrice: "58000000",
							Area: "1700",
							UnitPrice: "34100",
							CityPlanning: "準工業地域",
							Breadth: "6",
							Period: "2025年第1四半期",
							PriceCategory: "不動産取引価格情報",
						},
						{
							Type: "宅地(土地)",
							MunicipalityCode: "21212",
							Municipality: "土岐市",
							DistrictName: "泉町",
							TradePrice: "36000000",
							Area: "1200",
							UnitPrice: "30000",
							CityPlanning: "工業地域",
							Breadth: "5",
							Period: "2025年第1四半期",
							PriceCategory: "不動産取引価格情報",
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("moj-chizu-toki.geojson")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "Polygon",
								coordinates: [
									[
										[137.179, 35.354],
										[137.182, 35.354],
										[137.182, 35.357],
										[137.179, 35.357],
										[137.179, 35.354],
									],
								],
							},
							properties: {
								市区町村名: "土岐市",
								大字: "土岐津町",
								小字: "テスト",
								地番: "123",
								地図種類: "14条地図",
								精度区分: "高精度",
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("grid-capacity-chubu.json")) {
			return new Response(
				JSON.stringify({
					data: [
						{
							powerArea: "中部電力",
							operator: "中部電力パワーグリッド",
							facilityName: "土岐津変電所",
							voltageKv: 77,
							availableCapacityMw: 12.5,
							status: "空容量候補あり",
							nMinusOne: "N-1電制は接続検討で確認",
							updatedAt: "2026-06-01",
							sourceUrl: "https://powergrid.chuden.co.jp/goannai/hatsuden_kouri/takuso_kyokyu/rule/map/",
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		return new Response("{}", { status: 404 });
	}) as typeof fetch;
	activePage = addressOnlyPage();
	const addressOnlyResult = await processLandEvaluationForTest(
		{ pageId: "land-address-only-1", dryRun: false },
		notion as never,
	);
	assert.equal(addressOnlyResult.overallGrade, "未評価");
	assert.notEqual(addressOnlyResult.bucket, "即アタック");
	assert.equal(addressOnlyResult.score, null);
	assert.equal(addressOnlyResult.aZoneDecision, "未確認");
	const addressOnlyMemo = patchPropertiesText(updates.at(-1)?.properties);
	assert.match(addressOnlyMemo, /Google Geocoding API/);
	assert.match(addressOnlyMemo, /Google Roads/);
	assert.match(addressOnlyMemo, /Google Maps/);
	assert.match(addressOnlyMemo, /Google Places API/);
	assert.match(addressOnlyMemo, /周辺施設候補/);
	assert.match(addressOnlyMemo, /学校候補/);
	assert.match(addressOnlyMemo, /病院候補/);
	assert.match(addressOnlyMemo, /駅候補/);
	assert.match(addressOnlyMemo, /近隣説明リスク/);
	assert.match(addressOnlyMemo, /住宅密集判定ではない/);
	assert.match(addressOnlyMemo, /現地確認/);
	assert.match(addressOnlyMemo, /国土地理院道路候補/);
	assert.match(addressOnlyMemo, /道路中心線/);
	assert.match(addressOnlyMemo, /市道テスト線/);
	assert.match(addressOnlyMemo, /5\.5m以上13m未満/);
	assert.match(addressOnlyMemo, /幅員推定/);
	assert.match(addressOnlyMemo, /道路台帳で確認/);
	assert.match(addressOnlyMemo, /道路台帳確認先/);
	assert.match(addressOnlyMemo, /土岐市.*道路管理課|土岐市.*建築指導課|土岐市.*土木事務所/);
	assert.match(addressOnlyMemo, /建築基準法道路/);
	assert.match(addressOnlyMemo, /google\.com\/search/);
	assert.match(addressOnlyMemo, /不動産情報ライブラリ接続/);
	assert.match(addressOnlyMemo, /地価公示・地価調査/);
	assert.match(addressOnlyMemo, /32,000円\/㎡/);
	assert.match(addressOnlyMemo, /参考価格レンジ/);
	assert.match(addressOnlyMemo, /売買価格確定ではない/);
	assert.match(addressOnlyMemo, /用途地域: 準工業地域/);
	assert.match(addressOnlyMemo, /建蔽率: 60%/);
	assert.match(addressOnlyMemo, /容積率: 200%/);
	assert.match(addressOnlyMemo, /洪水浸水想定区域/);
	assert.match(addressOnlyMemo, /同一市区町村の取引事例候補/);
	assert.match(addressOnlyMemo, /登記所備付地図データ接続/);
	assert.match(addressOnlyMemo, /地番候補/);
	assert.match(addressOnlyMemo, /土岐市/);
	assert.match(addressOnlyMemo, /土岐津町/);
	assert.match(addressOnlyMemo, /123/);
	assert.match(addressOnlyMemo, /筆界候補/);
	assert.match(addressOnlyMemo, /登記確認済みではない/);
	assert.match(addressOnlyMemo, /農地ナビ接続/);
	assert.match(addressOnlyMemo, /WAGRI農地API/);
	assert.match(addressOnlyMemo, /ID付与済み筆ポリゴン取得API v3/);
	assert.match(addressOnlyMemo, /農地筆ポリゴン候補/);
	assert.match(addressOnlyMemo, /WAGRI-FP-123/);
	assert.match(addressOnlyMemo, /農地区画形状候補/);
	assert.match(addressOnlyMemo, /地目: 田/);
	assert.match(addressOnlyMemo, /農振法区分: 農業振興地域内・農用地区域内/);
	assert.match(addressOnlyMemo, /都市計画法区分: 市街化調整区域/);
	assert.match(addressOnlyMemo, /所管農業委員会: 土岐市農業委員会/);
	assert.ok(
		fetchedUrls.some(
			(url) =>
				url.startsWith("https://api.wagri2.net/basic/farmland/AgriculturalLand/SearchByLongitudeLatitude?") &&
				url.includes("minLatitude=") &&
				url.includes("maxLatitude=") &&
				url.includes("minLongitude=") &&
				url.includes("maxLongitude="),
		),
	);
	assert.match(addressOnlyMemo, /系統空き確認/);
	assert.match(addressOnlyMemo, /資源エネルギー庁/);
	assert.match(addressOnlyMemo, /OCCTO|電力広域的運営推進機関/);
	assert.match(addressOnlyMemo, /中部電力パワーグリッド/);
	assert.match(addressOnlyMemo, /系統空容量・予想潮流マッピング/);
	assert.match(addressOnlyMemo, /公表値候補/);
	assert.match(addressOnlyMemo, /土岐津変電所/);
	assert.match(addressOnlyMemo, /12\.5MW/);
	assert.match(addressOnlyMemo, /接続可否確定ではない/);
	assert.match(addressOnlyMemo, /接続検討/);
	assert.match(addressOnlyMemo, /農転事前判定/);
	assert.match(addressOnlyMemo, /見込みスコア/);
	assert.match(addressOnlyMemo, /正式確認状態: 照会準備中/);
	assert.match(addressOnlyMemo, /営業担当への入力案内/);
	assert.match(addressOnlyMemo, /入力場所: 土地DB/);
	assert.match(addressOnlyMemo, /土地DB「所在地」/);
	assert.match(addressOnlyMemo, /土地DB「面積（坪）」/);
	assert.match(addressOnlyMemo, /土地DB「農地種別」/);
	assert.match(addressOnlyMemo, /農振法区分=/);
	assert.match(addressOnlyMemo, /都市計画法区分=/);
	assert.match(addressOnlyMemo, /土地DB「農地転用可否」/);
	assert.match(addressOnlyMemo, /土地DB「接道状況」/);
	assert.match(addressOnlyMemo, /土地DB「登記確認状況」/);
	assert.match(addressOnlyMemo, /入力例: 土地DB「接道状況」=/);
	assert.match(addressOnlyMemo, /迷ったら「未確認」/);
	assert.match(addressOnlyMemo, /再判定時期/);
	assert.match(addressOnlyMemo, /接道幅員|大型車進入/);
	assert.doesNotMatch(addressOnlyMemo, /農転確認が未入力/);
	assert.match(addressOnlyMemo, /登記確認が未入力/);
	assert.match(addressOnlyMemo, /土地スカウト|一次評価|本評価不可/);
	assert.match(addressOnlyMemo, /【今AIが欲しいデータ】/);
	assert.match(addressOnlyMemo, /誰が取るか/);
	assert.match(addressOnlyMemo, /大ちゃんに即出すタスク/);
	assert.match(addressOnlyMemo, /取れたら何が分かるか/);
	assert.match(addressOnlyMemo, /系統公開情報/);
	assert.match(addressOnlyMemo, /OCCTO\/送配電会社系統情報|OCCTO系統情報サービス/);
	assert.match(addressOnlyMemo, /WAGRI\/eMAFF農地情報/);
	assert.match(addressOnlyMemo, /WAJO過去結果/);
	assert.match(addressOnlyMemo, /今日やること/);
	assert.match(addressOnlyMemo, /地番/);
	assert.match(addressOnlyMemo, /登記情報提供サービス/);
	assert.match(addressOnlyMemo, /農業委員会/);
	assert.match(addressOnlyMemo, /道路台帳/);
	assert.match(addressOnlyMemo, /送配電会社|空き容量/);
	assert.match(addressOnlyMemo, /見送り理由候補/);
	assert.match(addressOnlyMemo, /近隣説明リスク/);
	assert.match(addressOnlyMemo, /営業トーク/);
	assert.match(addressOnlyMemo, /確認先/);
	assert.match(addressOnlyMemo, /不動産情報ライブラリ/);
	assert.match(addressOnlyMemo, /eMAFF農地ナビ/);
	assert.match(addressOnlyMemo, /登記情報提供サービス/);
	assert.match(addressOnlyMemo, /登記所備付地図/);
	assert.match(addressOnlyMemo, /OCCTO|電力広域的運営推進機関/);

	const addressOnlyFinalUpdate = updates.at(-1)?.properties as Record<string, unknown>;
	assert.deepEqual(addressOnlyFinalUpdate.処理ステータス, { select: { name: "要確認" } });
	assert.equal("案件化状態" in addressOnlyFinalUpdate, false);
	assert.deepEqual(addressOnlyFinalUpdate.総合評価, { select: null });
	assert.deepEqual(addressOnlyFinalUpdate.AI総合スコア, { number: null });
	assert.match(JSON.stringify(addressOnlyFinalUpdate.Aゾーン内部採点内訳 ?? {}), /配点バージョン=v0/);
	const sourceSummary = JSON.stringify(addressOnlyFinalUpdate.Aゾーン取得元サマリー ?? {});
	assert.match(sourceSummary, /Aゾーン取得元サマリー/);
	assert.match(sourceSummary, /証拠区分=原本/);
	assert.match(sourceSummary, /証拠区分=二次資料/);
	assert.match(sourceSummary, /証拠区分=AI注記/);
	assert.match(sourceSummary, /証拠区分=未確認/);
	assert.match(sourceSummary, /Notion反映先/);
	assert.match(sourceSummary, /不動産情報ライブラリ/);
	assert.match(sourceSummary, /WAGRI農地API|eMAFF/);
	assert.match(sourceSummary, /資源エネルギー庁|OCCTO/);
	assert.match(sourceSummary, /人間に渡す確認/);
	const humanCollectionItems = JSON.stringify(addressOnlyFinalUpdate.Aゾーン人間回収項目 ?? {});
	assert.match(humanCollectionItems, /Bゾーンで人間回収|作業指示/);
	assert.match(humanCollectionItems, /登記|農地|接道|系統/);
	assert.equal(((addressOnlyFinalUpdate.Aゾーン内部スコア100 as { number?: number } | undefined)?.number ?? 0), 0);
	assert.match(JSON.stringify(addressOnlyFinalUpdate.Aゾーン内部採点内訳 ?? {}), /採点保留/);
	assert.doesNotMatch(addressOnlyMemo, /この土地、?1億|判定が全部出た|即アタック|農転不可|危険|接道OK(?!確定にはしない)/);

	const mojUrlsForPublicDataGap = process.env.MOJ_CHIZU_GEOJSON_URLS;
	const mojUrlForPublicDataGap = process.env.MOJ_CHIZU_GEOJSON_URL;
	const gridUrlsForPublicDataGap = process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
	const gridUrlForPublicDataGap = process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
	const gridJsonForPublicDataGap = process.env.GRID_CAPACITY_PUBLIC_JSON;
	delete process.env.MOJ_CHIZU_GEOJSON_URLS;
	delete process.env.MOJ_CHIZU_GEOJSON_URL;
	delete process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
	delete process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
	delete process.env.GRID_CAPACITY_PUBLIC_JSON;
	activePage = addressOnlyPage();
	const publicDataGapResult = await processLandEvaluationForTest(
		{ pageId: "land-public-data-gap-1", dryRun: false },
		notion as never,
	);
	assert.equal(publicDataGapResult.action, "needs-review");
	const publicDataGapMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(publicDataGapMemo, /登記所備付地図データ接続: 公開データ未配置/);
	assert.match(publicDataGapMemo, /APIキー不要/);
	assert.match(publicDataGapMemo, /G空間情報センターの公開データを取得・変換/);
	assert.match(publicDataGapMemo, /MOJ_CHIZU_GEOJSON_URLS/);
	assert.match(publicDataGapMemo, /https:\/\/front\.geospatial\.jp\//);
	assert.match(publicDataGapMemo, /地図証明書・図面証明書・登記事項証明書の代替ではない/);
	assert.match(publicDataGapMemo, /系統空き確認: 公開データ未配置/);
	assert.match(publicDataGapMemo, /公開情報を取得・正規化/);
	assert.match(publicDataGapMemo, /GRID_CAPACITY_PUBLIC_JSON_URLS/);
	assert.match(publicDataGapMemo, /設備名・電圧・空容量・N-1電制・更新日・元URL/);
	if (mojUrlsForPublicDataGap === undefined) delete process.env.MOJ_CHIZU_GEOJSON_URLS;
	else process.env.MOJ_CHIZU_GEOJSON_URLS = mojUrlsForPublicDataGap;
	if (mojUrlForPublicDataGap === undefined) delete process.env.MOJ_CHIZU_GEOJSON_URL;
	else process.env.MOJ_CHIZU_GEOJSON_URL = mojUrlForPublicDataGap;
	if (gridUrlsForPublicDataGap === undefined) delete process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
	else process.env.GRID_CAPACITY_PUBLIC_JSON_URLS = gridUrlsForPublicDataGap;
	if (gridUrlForPublicDataGap === undefined) delete process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
	else process.env.GRID_CAPACITY_PUBLIC_JSON_URL = gridUrlForPublicDataGap;
	if (gridJsonForPublicDataGap === undefined) delete process.env.GRID_CAPACITY_PUBLIC_JSON;
	else process.env.GRID_CAPACITY_PUBLIC_JSON = gridJsonForPublicDataGap;

	const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
	const googleApiKey = process.env.GOOGLE_API_KEY;
	delete process.env.GOOGLE_MAPS_API_KEY;
	delete process.env.GOOGLE_API_KEY;
	activePage = addressOnlyPage();
	const gsiGeocodeResult = await processLandEvaluationForTest(
		{ pageId: "land-gsi-geocode-1", dryRun: false },
		notion as never,
	);
	assert.equal(gsiGeocodeResult.action, "needs-review");
	const gsiGeocodeMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(gsiGeocodeMemo, /国土地理院住所検索/);
	assert.match(gsiGeocodeMemo, /住所候補: 岐阜県土岐市土岐津町高山/);
	assert.match(gsiGeocodeMemo, /国土地理院道路候補/);
	assert.ok(
		fetchedUrls.some((url) =>
			url.startsWith("https://msearch.gsi.go.jp/address-search/AddressSearch?"),
		),
	);
	if (googleMapsApiKey) process.env.GOOGLE_MAPS_API_KEY = googleMapsApiKey;
	if (googleApiKey) process.env.GOOGLE_API_KEY = googleApiKey;

	const googleMapsApiKeyForCandidate = process.env.GOOGLE_MAPS_API_KEY;
	const googleApiKeyForCandidate = process.env.GOOGLE_API_KEY;
	delete process.env.GOOGLE_MAPS_API_KEY;
	delete process.env.GOOGLE_API_KEY;
	activePage = highValueLandPageWithoutExactCoordinates();
	const gsiCandidateResult = await processLandEvaluationForTest(
		{ pageId: "land-gsi-candidate-must-review-1", dryRun: false },
		notion as never,
	);
	assert.equal(gsiCandidateResult.action, "needs-review");
	assert.equal(gsiCandidateResult.overallGrade, "未評価");
	assert.equal(gsiCandidateResult.score, null);
	assert.equal(gsiCandidateResult.aZoneDecision, "未確認");
	const gsiCandidateMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(gsiCandidateMemo, /国土地理院住所検索/);
	assert.match(gsiCandidateMemo, /正式住所・地番の確定結果ではない/);
	assert.match(gsiCandidateMemo, /所在地・地番確認/);
	if (googleMapsApiKeyForCandidate) {
		process.env.GOOGLE_MAPS_API_KEY = googleMapsApiKeyForCandidate;
	}
	if (googleApiKeyForCandidate) process.env.GOOGLE_API_KEY = googleApiKeyForCandidate;

	const googleMapsApiKeyForDistanceCandidate = process.env.GOOGLE_MAPS_API_KEY;
	const googleApiKeyForDistanceCandidate = process.env.GOOGLE_API_KEY;
	delete process.env.GOOGLE_MAPS_API_KEY;
	delete process.env.GOOGLE_API_KEY;
	const gsiCallCountBeforeDistanceCandidate = fetchedUrls.filter((url) =>
		url.startsWith("https://msearch.gsi.go.jp/address-search/AddressSearch?"),
	).length;
	activePage = highValueLandPageWithoutExactCoordinatesButWithDistance();
	const gsiDistanceCandidateResult = await processLandEvaluationForTest(
		{ pageId: "land-gsi-candidate-with-distance-1", dryRun: false },
		notion as never,
	);
	assert.equal(gsiDistanceCandidateResult.action, "needs-review");
	assert.equal(gsiDistanceCandidateResult.overallGrade, "未評価");
	assert.equal(gsiDistanceCandidateResult.score, null);
	assert.equal(gsiDistanceCandidateResult.aZoneDecision, "未確認");
	const gsiCallCountAfterDistanceCandidate = fetchedUrls.filter((url) =>
		url.startsWith("https://msearch.gsi.go.jp/address-search/AddressSearch?"),
	).length;
	assert.equal(gsiCallCountAfterDistanceCandidate, gsiCallCountBeforeDistanceCandidate + 1);
	const gsiDistanceCandidateMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(gsiDistanceCandidateMemo, /国土地理院住所検索/);
	assert.match(gsiDistanceCandidateMemo, /正式住所・地番の確定結果ではない/);
	assert.match(gsiDistanceCandidateMemo, /所在地・地番確認/);
	const gsiDistanceCandidateUpdate = updates.at(-1)?.properties as Record<string, unknown>;
	assert.equal(
		Object.hasOwn(gsiDistanceCandidateUpdate, "変電所距離（km）"),
		false,
		"GSI候補座標では手入力済みの変電所距離を上書きしない",
	);
	if (googleMapsApiKeyForDistanceCandidate) {
		process.env.GOOGLE_MAPS_API_KEY = googleMapsApiKeyForDistanceCandidate;
	}
	if (googleApiKeyForDistanceCandidate) {
		process.env.GOOGLE_API_KEY = googleApiKeyForDistanceCandidate;
	}

	activePage = {
		...highValueLandPage(),
		id: "land-missing-official-evidence-1",
		properties: {
			...highValueLandPage().properties,
			土地名称: titleProp("【TDD】系統近接だが公的確認なし"),
			農地転用可否: selectProp("未確認"),
			農地種別: richTextProp(""),
			登記確認状況: selectProp("未確認"),
			接道状況: richTextProp("近接道路候補あり。幅員は道路台帳で確認。"),
		},
	};
	const missingOfficialResult = await processLandEvaluationForTest(
		{ pageId: "land-missing-official-evidence-1", dryRun: false },
		notion as never,
	);
	assert.equal(missingOfficialResult.action, "needs-review");
	assert.equal(missingOfficialResult.overallGrade, "未評価");
	assert.notEqual(missingOfficialResult.bucket, "即アタック");
	assert.equal(missingOfficialResult.score, null);
	assert.equal(missingOfficialResult.aZoneDecision, "未確認");
	assert.equal(missingOfficialResult.aZoneScore?.total100, 0);
	const missingOfficialMemo = patchPropertiesText(updates.at(-1)?.properties);
	assert.match(missingOfficialMemo, /本評価不可|公的確認|調査指示/);
	assert.match(missingOfficialMemo, /農地・農転/);
	assert.match(missingOfficialMemo, /登記/);
	assert.match(missingOfficialMemo, /道路台帳|接道/);
	assert.match(missingOfficialMemo, /確認先/);
	assert.match(missingOfficialMemo, /不動産情報ライブラリ/);
	assert.match(missingOfficialMemo, /証拠区分=未確認|証拠区分=二次資料|証拠区分=AI注記|証拠区分=原本/);
	assert.match(missingOfficialMemo, /eMAFF農地ナビ/);
	assert.match(missingOfficialMemo, /登記情報提供サービス/);
	assert.match(missingOfficialMemo, /OCCTO|電力広域的運営推進機関/);
	assert.match(missingOfficialMemo, /農転事前判定/);
	assert.match(missingOfficialMemo, /見込みランク: 中|見込みランク: 低/);
	assert.match(missingOfficialMemo, /営業担当への入力案内/);
	assert.match(missingOfficialMemo, /【今AIが欲しいデータ】/);
	assert.match(missingOfficialMemo, /誰が取るか/);
	assert.match(missingOfficialMemo, /大ちゃんに即出すタスク/);
	assert.match(missingOfficialMemo, /取れたら何が分かるか/);
	assert.match(missingOfficialMemo, /担当: 営業担当/);
	assert.match(missingOfficialMemo, /土地DB「農地種別」/);
	assert.match(missingOfficialMemo, /土地DB「農地転用可否」/);
	assert.match(missingOfficialMemo, /土地DB「接道状況」/);
	assert.match(missingOfficialMemo, /正式許可ではなく「未確認」または相談状況/);
	assert.doesNotMatch(missingOfficialMemo, /農転不可|危険|1億|判定が全部出た/);

	activePage = missingRequiredInputPage();
	const missingRequiredInputResult = await processLandEvaluationForTest(
		{ pageId: "land-missing-required-input-1", dryRun: false },
		notion as never,
	);
	assert.equal(missingRequiredInputResult.action, "needs-review");
	assert.equal(missingRequiredInputResult.overallGrade, "未評価");
	assert.equal(missingRequiredInputResult.score, null);
	assert.equal(missingRequiredInputResult.aZoneDecision, "未確認");
	assert.equal(missingRequiredInputResult.cZoneReady, false);
	assert.match(missingRequiredInputResult.bZoneHandoff ?? "", /所在地/);
	assert.match(missingRequiredInputResult.bZoneHandoff ?? "", /面積/);
	assert.match(missingRequiredInputResult.bZoneHandoff ?? "", /戻し先=土地DB「所在地」「面積（坪）」「入力根拠区分」/);
	assert.match(missingRequiredInputResult.cZoneReadiness ?? "", /必須入力不足=所在地/);
	assert.match(missingRequiredInputResult.cZoneReadiness ?? "", /必須入力不足=面積/);

	globalThis.fetch = originalFetch;
	if (originalGoogleKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
	else process.env.GOOGLE_MAPS_API_KEY = originalGoogleKey;
	if (originalGoogleApiKey === undefined) delete process.env.GOOGLE_API_KEY;
	else process.env.GOOGLE_API_KEY = originalGoogleApiKey;
	if (originalWagriToken === undefined) delete process.env.WAGRI_ACCESS_TOKEN;
	else process.env.WAGRI_ACCESS_TOKEN = originalWagriToken;
	if (originalReinfolibKey === undefined) delete process.env.REINFOLIB_API_KEY;
	else process.env.REINFOLIB_API_KEY = originalReinfolibKey;
	delete process.env.REINFOLIB_LAND_PRICE_YEAR;
	delete process.env.REINFOLIB_TRANSACTION_YEAR;
	if (originalMojChizuGeoJsonUrls === undefined) delete process.env.MOJ_CHIZU_GEOJSON_URLS;
	else process.env.MOJ_CHIZU_GEOJSON_URLS = originalMojChizuGeoJsonUrls;
	if (originalMojChizuGeoJsonUrl === undefined) delete process.env.MOJ_CHIZU_GEOJSON_URL;
	else process.env.MOJ_CHIZU_GEOJSON_URL = originalMojChizuGeoJsonUrl;
	if (originalGsiRoadTileEnabled === undefined) delete process.env.GSI_ROAD_TILE_ENABLED;
	else process.env.GSI_ROAD_TILE_ENABLED = originalGsiRoadTileEnabled;
	if (originalGridCapacityPublicUrls === undefined) delete process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
	else process.env.GRID_CAPACITY_PUBLIC_JSON_URLS = originalGridCapacityPublicUrls;
	if (originalGridCapacityPublicUrl === undefined) delete process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
	else process.env.GRID_CAPACITY_PUBLIC_JSON_URL = originalGridCapacityPublicUrl;
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
