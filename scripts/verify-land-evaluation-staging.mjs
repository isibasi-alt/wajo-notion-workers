import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const criticalFiles = [
	"WAJO_WORKER_RUNBOOK.md",
	"package.json",
	"scripts/audit-land-evaluation-goal-coverage.mjs",
	"scripts/audit-land-evaluation-goal-coverage.test.mjs",
	"scripts/audit-land-evaluation-readiness.mjs",
	"scripts/verify-farmland-navi-connection.mjs",
	"scripts/verify-farmland-navi-connection.test.mjs",
	"scripts/verify-land-evaluation-env.mjs",
	"scripts/verify-land-evaluation-env.test.mjs",
	"scripts/verify-land-evaluation-release.mjs",
	"scripts/verify-land-evaluation-remote.mjs",
	"scripts/verify-land-evaluation-staging.mjs",
	"scripts/verify-land-evaluation-staging.test.mjs",
	"src/index.ts",
	"src/land-substations.ts",
	"src/land-treasure-engine.test.ts",
	"src/land-treasure-engine.ts",
];

export function auditReleaseCriticalStaging(input) {
	const staged = new Set(input.stagedFiles || []);
	const unstaged = new Set(input.unstagedFiles || []);
	const critical = new Set(input.criticalFiles || criticalFiles);
	const unstagedCriticalFiles = [...unstaged]
		.filter((file) => critical.has(file))
		.sort();
	const stagedCriticalFiles = [...staged]
		.filter((file) => critical.has(file))
		.sort();
	return {
		ok: unstagedCriticalFiles.length === 0,
		stagedCriticalFiles,
		unstagedCriticalFiles,
		printedSecretValues: false,
	};
}

function gitNameOnly(args) {
	const output = execFileSync("git", args, { encoding: "utf8" });
	return output.split(/\n/).map((line) => line.trim()).filter(Boolean);
}

function finish(code, payload) {
	console.log(JSON.stringify(payload, null, 2));
	process.exit(code);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	try {
		const stagedFiles = gitNameOnly(["diff", "--cached", "--name-only", "--", ...criticalFiles]);
		const unstagedFiles = gitNameOnly(["diff", "--name-only", "--", ...criticalFiles]);
		const audit = auditReleaseCriticalStaging({ stagedFiles, unstagedFiles });
		finish(audit.ok ? 0 : 1, {
			ok: audit.ok,
			stagedCriticalFiles: audit.stagedCriticalFiles,
			unstagedCriticalFiles: audit.unstagedCriticalFiles,
			message: audit.ok
				? "No unstaged release-critical land v2 files."
				: "Release-critical land v2 files still have unstaged changes. Stage only the intended hunks or keep release blocked.",
			printedSecretValues: false,
		});
	} catch (error) {
		finish(1, {
			ok: false,
			message: String(error?.message || error),
			printedSecretValues: false,
		});
	}
}
