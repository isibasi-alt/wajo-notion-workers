import assert from "node:assert/strict";
import { auditLandEvaluationEnvKeys, parseDotEnvKeys, parseNtnEnvList } from "./verify-land-evaluation-env.mjs";

const completeKeys = parseNtnEnvList([
	"GOOGLE_MAPS_API_KEY\t2026-06-09T00:00:00.000Z",
	"WAGRI_ACCESS_TOKEN\t2026-06-09T00:00:00.000Z",
	"REINFOLIB_API_KEY\t2026-06-09T00:00:00.000Z",
	"MOJ_CHIZU_GEOJSON_URLS\t2026-06-09T00:00:00.000Z",
	"GRID_CAPACITY_PUBLIC_JSON_URLS\t2026-06-09T00:00:00.000Z",
].join("\n"));

assert.deepEqual([...completeKeys].sort(), [
	"GOOGLE_MAPS_API_KEY",
	"GRID_CAPACITY_PUBLIC_JSON_URLS",
	"MOJ_CHIZU_GEOJSON_URLS",
	"REINFOLIB_API_KEY",
	"WAGRI_ACCESS_TOKEN",
]);

assert.equal(auditLandEvaluationEnvKeys(completeKeys).ok, true);

const googleFallbackKeys = new Set([
	"GOOGLE_API_KEY",
	"WAGRI_API_TOKEN",
	"REINFOLIB_API_KEY",
	"MOJ_CHIZU_GEOJSON_INLINE_BASE64",
	"GRID_CAPACITY_PUBLIC_JSON_URLS",
]);

assert.equal(auditLandEvaluationEnvKeys(googleFallbackKeys).ok, true);

const missingKeys = new Set(["GOOGLE_CLIENT_ID", "OPENAI_API_KEY"]);
const missingAudit = auditLandEvaluationEnvKeys(missingKeys);

assert.equal(missingAudit.ok, false);
assert.deepEqual(missingAudit.missingGroups.map((group) => group.label), [
	"Google Maps Platform",
	"WAGRI / eMAFF農地ナビ",
	"国土交通省 不動産情報ライブラリ",
	"法務省 登記所備付地図データ（公開データ配置）",
	"系統空容量 公表値JSON（公開データ配置）",
]);
assert.equal(missingAudit.printedSecretValues, false);
assert.equal(
	missingAudit.missingGroups.find((group) => group.label.includes("法務省"))?.inputType,
	"public-data-url",
);
assert.equal(
	missingAudit.missingGroups.find((group) => group.label.includes("系統空容量"))?.inputType,
	"public-data-json",
);

const localEnvKeys = parseDotEnvKeys([
	"# values must never be printed",
	"GOOGLE_MAPS_API_KEY=secret-google-value",
	"WAGRI_ACCESS_TOKEN=\"secret-wagri-value\"",
	"REINFOLIB_API_KEY='secret-reinfolib-value'",
	"MOJ_CHIZU_GEOJSON_INLINE_BASE64=eyJ0eXBlIjoiRmVhdHVyZUNvbGxlY3Rpb24ifQ==",
	"GRID_CAPACITY_PUBLIC_JSON_URLS=https://example.invalid/grid.json",
].join("\n"));

assert.equal(auditLandEvaluationEnvKeys(localEnvKeys).ok, true);
assert.equal([...localEnvKeys].includes("secret-google-value"), false);

const emptyTemplateKeys = parseDotEnvKeys([
	"GOOGLE_MAPS_API_KEY=",
	"WAGRI_ACCESS_TOKEN=",
	"REINFOLIB_API_KEY=",
	"MOJ_CHIZU_GEOJSON_URLS=",
	"GRID_CAPACITY_PUBLIC_JSON_URLS=",
].join("\n"));

assert.equal(auditLandEvaluationEnvKeys(emptyTemplateKeys).ok, false);
