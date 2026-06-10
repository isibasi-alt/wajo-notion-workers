import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const requiredFiles = [
	"src/land-treasure-engine.ts",
	"src/land-substations.ts",
	"src/land-treasure-engine.test.ts",
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
	"scripts/set-land-evaluation-env.mjs",
	"scripts/set-land-evaluation-env.test.mjs",
	"dist/index.js",
	"dist/land-treasure-engine.js",
	"dist/land-substations.js",
];

const requiredGitManagedFiles = [
	"src/land-treasure-engine.ts",
	"src/land-substations.ts",
	"src/land-treasure-engine.test.ts",
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
	"scripts/set-land-evaluation-env.mjs",
	"scripts/set-land-evaluation-env.test.mjs",
];

const requiredPackageScripts = [
	"test:land-evaluation-v2",
	"test:land-ai-learning-log",
	"test:land-evaluation-env",
	"test:farmland-navi-connection",
	"test:land-evaluation-goal-coverage",
	"test:land-evaluation-staging",
	"test:set-land-evaluation-env",
	"audit:land-evaluation-goal-coverage",
	"set:land-evaluation-env",
	"set:land-evaluation-env:apply",
	"set:land-evaluation-env:template",
	"verify:land-evaluation-env",
	"verify:land-evaluation-local-env",
	"verify:land-evaluation-staging",
	"deploy:land-evaluation-v2",
	"verify:land-evaluation-v2-remote",
];

const requiredSentinels = [
	{
		file: "dist/index.js",
		values: [
			"land-evaluation-v2-sabc-2ai",
			"evaluateLandTreasure",
		],
	},
	{
		file: "dist/land-treasure-engine.js",
		values: [
			"変電所だけではS評価にしない",
			"AI-1 物理・系統評価",
			"AI-2 営業・案件化評価",
		],
	},
	{
		file: "dist/land-substations.js",
		values: ["土岐津変電所"],
	},
];

const failures = [];

for (const file of requiredFiles) {
	if (!existsSync(file)) {
		failures.push(`missing required file: ${file}`);
	}
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const scriptName of requiredPackageScripts) {
	if (!pkg.scripts?.[scriptName]) {
		failures.push(`missing package script: ${scriptName}`);
	}
}

if (!pkg.scripts?.["deploy:land-evaluation-v2"]?.includes("--local-build --no-git")) {
	failures.push("deploy:land-evaluation-v2 must use --local-build --no-git");
}

for (const { file, values } of requiredSentinels) {
	if (!existsSync(file)) continue;
	const content = readFileSync(file, "utf8");
	for (const value of values) {
		if (!content.includes(value)) {
			failures.push(`missing sentinel in ${file}: ${value}`);
		}
	}
}

let untracked = [];
try {
	const output = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", ...requiredGitManagedFiles], {
		encoding: "utf8",
	});
	untracked = output.trim().split(/\n/).filter(Boolean);
} catch (error) {
	failures.push(`git untracked check failed: ${error.message}`);
}

const result = {
	ok: failures.length === 0,
	requiredFiles,
	requiredPackageScripts,
	untrackedRequiredFiles: untracked,
	note:
		untracked.length > 0
			? "Required v2 source or verifier files are still untracked. Add them to git before any release workflow."
			: "Required v2 source and verifier files are tracked or staged enough for git-based workflows.",
	failures,
};

if (untracked.length > 0) {
	failures.push(
		`required v2 source or verifier files are untracked and can be missed by release workflows: ${untracked.join(", ")}`,
	);
	result.ok = false;
	result.failures = failures;
}

console.log(JSON.stringify(result, null, 2));

if (failures.length > 0) {
	process.exit(1);
}
