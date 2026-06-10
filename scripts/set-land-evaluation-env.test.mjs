import assert from "node:assert/strict";
import {
	buildNtnEnvSetArgs,
	landEvaluationEnvTemplate,
	landEvaluationEnvAssignments,
	parseDotEnvEntries,
	redactedAssignmentSummary,
} from "./set-land-evaluation-env.mjs";

const entries = parseDotEnvEntries([
	"# local secrets",
	"GOOGLE_MAPS_API_KEY=google-secret",
	"WAGRI_ACCESS_TOKEN=\"wagri-secret\"",
	"REINFOLIB_API_KEY='reinfolib-secret'",
	"MOJ_CHIZU_GEOJSON_URLS=https://example.invalid/moj.geojson",
	"GRID_CAPACITY_PUBLIC_JSON_URLS=https://example.invalid/grid.json",
	"UNRELATED_SECRET=must-not-be-used",
].join("\n"));

assert.equal(entries.get("GOOGLE_MAPS_API_KEY"), "google-secret");
assert.equal(entries.get("WAGRI_ACCESS_TOKEN"), "wagri-secret");
assert.equal(entries.get("REINFOLIB_API_KEY"), "reinfolib-secret");

const assignments = landEvaluationEnvAssignments(entries);
assert.deepEqual(assignments.map((assignment) => assignment.key), [
	"GOOGLE_MAPS_API_KEY",
	"WAGRI_ACCESS_TOKEN",
	"REINFOLIB_API_KEY",
	"MOJ_CHIZU_GEOJSON_URLS",
	"GRID_CAPACITY_PUBLIC_JSON_URLS",
]);

const summary = redactedAssignmentSummary(assignments);
assert.deepEqual(summary.keysToSet, [
	"GOOGLE_MAPS_API_KEY",
	"WAGRI_ACCESS_TOKEN",
	"REINFOLIB_API_KEY",
	"MOJ_CHIZU_GEOJSON_URLS",
	"GRID_CAPACITY_PUBLIC_JSON_URLS",
]);
assert.equal(summary.printedSecretValues, false);
assert.equal(JSON.stringify(summary).includes("google-secret"), false);

const args = buildNtnEnvSetArgs(assignments);
assert.deepEqual(args.slice(0, 4), ["ntn", "workers", "env", "set"]);
assert.equal(args.includes("UNRELATED_SECRET=must-not-be-used"), false);

const fallbackEntries = parseDotEnvEntries([
	"GOOGLE_API_KEY=google-fallback",
	"WAGRI_API_TOKEN=wagri-fallback",
	"MLIT_REINFOLIB_API_KEY=mlit-fallback",
	"MOJ_CHIZU_GEOJSON_URL=https://example.invalid/moj.geojson",
	"GRID_CAPACITY_PUBLIC_JSON=https://example.invalid/grid.json",
].join("\n"));

assert.deepEqual(landEvaluationEnvAssignments(fallbackEntries).map((assignment) => assignment.key), [
	"GOOGLE_API_KEY",
	"WAGRI_API_TOKEN",
	"MLIT_REINFOLIB_API_KEY",
	"MOJ_CHIZU_GEOJSON_URL",
	"GRID_CAPACITY_PUBLIC_JSON",
]);

const template = landEvaluationEnvTemplate();

assert.match(template, /GOOGLE_MAPS_API_KEY=/);
assert.match(template, /WAGRI_ACCESS_TOKEN=/);
assert.match(template, /REINFOLIB_API_KEY=/);
assert.match(template, /MOJ_CHIZU_GEOJSON_URLS=/);
assert.match(template, /GRID_CAPACITY_PUBLIC_JSON_URLS=/);
assert.equal(/secret|token-value|AIza|sk-/.test(template), false);
