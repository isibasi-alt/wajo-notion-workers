import assert from "node:assert/strict";

import { auditLandEvaluationGoalCoverage } from "./audit-land-evaluation-goal-coverage.mjs";

const sourceText = [
	"Google Geocoding API",
	"Google Maps",
	"変電所候補3件",
	"不動産情報ライブラリ接続",
	"地価公示・地価調査",
	"用途地域",
	"防災一次確認",
	"Google Places API",
	"WAGRI農地API",
	"ID付与済み筆ポリゴン取得API v3",
	"登記所備付地図データ接続",
	"地番候補",
	"国土地理院道路候補",
	"Google Roads",
	"道路台帳",
	"系統空き確認",
	"OCCTO",
	"資源エネルギー庁",
	"今日やること",
	"営業トーク",
	"見送り理由候補",
].join("\n");

const testText = [
	"assert.match(addressOnlyMemo, /Google Geocoding API/)",
	"assert.match(addressOnlyMemo, /変電所候補3件/)",
	"assert.match(addressOnlyMemo, /不動産情報ライブラリ接続/)",
	"assert.match(addressOnlyMemo, /用途地域: 準工業地域/)",
	"assert.match(addressOnlyMemo, /洪水浸水想定区域/)",
	"assert.match(addressOnlyMemo, /Google Places API/)",
	"assert.match(addressOnlyMemo, /WAGRI農地API/)",
	"assert.match(addressOnlyMemo, /ID付与済み筆ポリゴン取得API v3/)",
	"assert.match(addressOnlyMemo, /登記所備付地図データ接続/)",
	"assert.match(addressOnlyMemo, /地番候補/)",
	"assert.match(addressOnlyMemo, /国土地理院道路候補/)",
	"assert.match(addressOnlyMemo, /道路台帳/)",
	"assert.match(addressOnlyMemo, /系統空き確認/)",
	"assert.match(addressOnlyMemo, /OCCTO/)",
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
assert.equal(connected.requirements.length, 9);
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
