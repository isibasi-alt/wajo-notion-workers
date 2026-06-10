import assert from "node:assert/strict";
import { auditReleaseCriticalStaging } from "./verify-land-evaluation-staging.mjs";

const cleanAudit = auditReleaseCriticalStaging({
	stagedFiles: [
		"package.json",
		"src/index.ts",
		"src/land-treasure-engine.ts",
		"scripts/verify-land-evaluation-release.mjs",
	],
	unstagedFiles: ["src/unrelated.test.ts"],
});

assert.equal(cleanAudit.ok, true);
assert.deepEqual(cleanAudit.unstagedCriticalFiles, []);

const dirtyAudit = auditReleaseCriticalStaging({
	stagedFiles: ["src/land-treasure-engine.ts"],
	unstagedFiles: ["src/index.ts", "package.json", "WAJO_WORKER_RUNBOOK.md"],
});

assert.equal(dirtyAudit.ok, false);
assert.deepEqual(dirtyAudit.unstagedCriticalFiles, [
	"WAJO_WORKER_RUNBOOK.md",
	"package.json",
	"src/index.ts",
]);
assert.equal(dirtyAudit.printedSecretValues, false);
