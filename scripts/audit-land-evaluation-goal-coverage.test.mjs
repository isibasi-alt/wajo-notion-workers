import assert from "node:assert/strict";

import { auditLandEvaluationGoalCoverage } from "./audit-land-evaluation-goal-coverage.mjs";

const sourceText = [
	"Google Geocoding API",
	"Google Maps",
	"住所・面積整合",
	"住所正規化・座標",
	"変電所候補3件",
	"不動産情報ライブラリ接続",
	"地価公示・地価調査",
	"地価公示・都道府県地価・取引事例",
	"同一市区町村の取引事例候補",
	"用途地域",
	"用途地域・都市計画・建蔽率・容積率",
	"建蔽率",
	"容積率",
	"防災一次確認",
	"洪水・津波・高潮・土砂災害・液状化",
	"Google Places API",
	"近隣住宅・学校・病院・駅・集落密度",
	"WAGRI農地API",
	"ID付与済み筆ポリゴン取得API v3",
	"登記所備付地図データ接続",
	"地番候補",
	"筆界候補",
	"登記・所有権・地目・地積・権利リスク",
	"登記情報提供サービス",
	"国土地理院道路候補",
	"Google Roads",
	"道路台帳",
	"系統・変電所",
	"系統空き確認",
	"OCCTO",
	"資源エネルギー庁",
	"標高・傾斜・造成難易度",
	"国土地理院 標高取得プログラム",
	"森林・保安林・自然公園・文化財・景観・自治体条例",
	"土地価格・希望価格・事業採算",
	"希望価格・粗利・CAPEX",
	"取得メタデータ・証拠区分・負例",
	"取得失敗・対象外・未接続",
	"Bゾーン引き渡し",
	"担当=",
	"回収物=",
	"取得先=",
	"Notion戻し先=",
	"証拠区分=",
	"完了条件=",
	"今日やること",
	"営業トーク",
	"見送り理由候補",
].join("\n");

const testText = [
	"assert.match(addressOnlyMemo, /Google Geocoding API/)",
	"assert.match(sourceSummary, /住所・面積整合/)",
	"assert.match(addressOnlyMemo, /変電所候補3件/)",
	"assert.match(addressOnlyMemo, /不動産情報ライブラリ接続/)",
	"assert.match(addressOnlyMemo, /用途地域: 準工業地域/)",
	"assert.match(addressOnlyMemo, /洪水浸水想定区域/)",
	"assert.match(addressOnlyMemo, /津波・高潮・液状化/)",
	"assert.match(addressOnlyMemo, /Google Places API/)",
	"assert.match(addressOnlyMemo, /学校候補/)",
	"assert.match(addressOnlyMemo, /病院候補/)",
	"assert.match(addressOnlyMemo, /駅候補/)",
	"assert.match(addressOnlyMemo, /WAGRI農地API/)",
	"assert.match(addressOnlyMemo, /ID付与済み筆ポリゴン取得API v3/)",
	"assert.match(addressOnlyMemo, /登記所備付地図データ接続/)",
	"assert.match(addressOnlyMemo, /地番候補/)",
	"assert.match(addressOnlyMemo, /筆界候補/)",
	"assert.match(sourceSummary, /登記・所有権・地目・地積・権利リスク/)",
	"assert.match(addressOnlyMemo, /国土地理院道路候補/)",
	"assert.match(addressOnlyMemo, /道路台帳/)",
	"assert.match(addressOnlyMemo, /地価公示・地価調査/)",
	"assert.match(addressOnlyMemo, /建蔽率: 60%/)",
	"assert.match(addressOnlyMemo, /容積率: 200%/)",
	"assert.match(addressOnlyMemo, /同一市区町村の取引事例候補/)",
	"assert.match(addressOnlyMemo, /系統空き確認/)",
	"assert.match(addressOnlyMemo, /OCCTO/)",
	"assert.match(addressOnlyMemo, /土岐津変電所/)",
	"assert.match(addressOnlyMemo, /標高・造成一次確認/)",
	"assert.match(addressOnlyMemo, /傾斜・造成難易度/)",
	"assert.match(sourceSummary, /森林・保安林・自然公園・文化財・景観・自治体条例/)",
	"assert.match(addressOnlyMemo, /希望価格・粗利・CAPEX/)",
	"assert.match(sourceSummary, /取得メタデータ・証拠区分・負例/)",
	"assert.match(sourceSummary, /証拠区分=未確認/)",
	"assert.match(humanCollectionItems, /担当=/)",
	"assert.match(humanCollectionItems, /回収物=/)",
	"assert.match(humanCollectionItems, /取得先=/)",
	"assert.match(humanCollectionItems, /Notion戻し先=/)",
	"assert.match(humanCollectionItems, /証拠区分=/)",
	"assert.match(humanCollectionItems, /完了条件=/)",
	"assert.match(addressOnlyMemo, /今日やること/)",
	"assert.match(addressOnlyMemo, /営業トーク/)",
].join("\n");

const connected = auditLandEvaluationGoalCoverage({
	sourceText,
	testText,
	envKeys: new Set([
		"GOOGLE_MAPS_API_KEY",
		"WAGRI_ACCESS_TOKEN",
		"REINFOLIB_API_KEY",
		"MOJ_CHIZU_GEOJSON_URLS",
		"GRID_CAPACITY_PUBLIC_JSON_URLS",
	]),
	remoteVerified: true,
});

assert.equal(connected.localImplemented, true);
assert.equal(connected.runtimeConnected, true);
assert.equal(connected.remoteVerified, true);
assert.equal(connected.ok, true);
assert.equal(connected.requirements.length, 15);
assert.ok(connected.requirements.every((requirement) => requirement.localImplemented));
assert.equal(connected.missingRuntimeGroups.length, 0);

const missingRuntime = auditLandEvaluationGoalCoverage({
	sourceText,
	testText,
	envKeys: new Set(["GOOGLE_MAPS_API_KEY"]),
	remoteVerified: false,
});

assert.equal(missingRuntime.localImplemented, true);
assert.equal(missingRuntime.runtimeConnected, false);
assert.equal(missingRuntime.remoteVerified, false);
assert.equal(missingRuntime.ok, false);
assert.deepEqual(
	missingRuntime.missingRuntimeGroups.map((group) => group.label),
	[
		"WAGRI / eMAFF農地ナビ",
		"国土交通省 不動産情報ライブラリ",
		"法務省 登記所備付地図データ（公開データ配置）",
		"系統空容量 公表値JSON（公開データ配置）",
	],
);
assert.equal(
	missingRuntime.missingRuntimeGroups.find((group) => group.label.includes("法務省"))?.inputType,
	"public-data-url",
);
assert.equal(
	missingRuntime.missingRuntimeGroups.find((group) => group.label.includes("系統空容量"))?.inputType,
	"public-data-json",
);

const missingLocal = auditLandEvaluationGoalCoverage({
	sourceText: sourceText.replace("WAGRI農地API", ""),
	testText: testText.replace("WAGRI農地API", ""),
	envKeys: new Set([
		"GOOGLE_MAPS_API_KEY",
		"WAGRI_ACCESS_TOKEN",
		"REINFOLIB_API_KEY",
		"MOJ_CHIZU_GEOJSON_URLS",
		"GRID_CAPACITY_PUBLIC_JSON_URLS",
	]),
	remoteVerified: true,
});

assert.equal(missingLocal.localImplemented, false);
assert.equal(missingLocal.ok, false);
assert.equal(
	missingLocal.requirements.find((requirement) => requirement.id === "farmland")?.localImplemented,
	false,
);
