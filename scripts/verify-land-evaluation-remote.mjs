import { execFileSync } from "node:child_process";

const cases = [
	{
		name: "high-value",
		pageId: process.env.LAND_EVAL_HIGH_PAGE_ID || "3784d017-81e7-81c3-b484-c18128975ce0",
		expectedGrade: "S",
		expectedScore: 100,
		expectedBucket: "即アタック",
	},
	{
		name: "blocked",
		pageId: process.env.LAND_EVAL_BLOCKED_PAGE_ID || "3784d017-81e7-81b1-be81-c6e81b4cd982",
		expectedGrade: "C",
		maxScore: 45,
		expectedBucket: "要確認",
	},
];

function parseJsonOutput(output) {
	const start = output.indexOf("{");
	const end = output.lastIndexOf("}");
	if (start === -1 || end === -1 || end < start) {
		throw new Error(`No JSON object found in worker output: ${output}`);
	}
	return JSON.parse(output.slice(start, end + 1));
}

const results = [];
const failures = [];

for (const testCase of cases) {
	const payload = JSON.stringify({ pageId: testCase.pageId, dryRun: true });
	const output = execFileSync(
		"npx",
		["ntn", "workers", "exec", "processLandEvaluationById", "-d", payload],
		{
			encoding: "utf8",
			env: { ...process.env, NOTION_KEYRING: "0" },
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const result = parseJsonOutput(output);
	results.push({
		name: testCase.name,
		pageId: testCase.pageId,
		action: result.action,
		bucket: result.bucket,
		overallGrade: result.overallGrade,
		score: result.score,
		message: result.message,
	});
	if (result.action !== "dry-run") {
		failures.push(`${testCase.name}: expected dry-run action, got ${result.action}`);
	}
	if (result.overallGrade !== testCase.expectedGrade) {
		failures.push(`${testCase.name}: expected grade ${testCase.expectedGrade}, got ${result.overallGrade}`);
	}
	if (typeof testCase.expectedScore === "number" && result.score !== testCase.expectedScore) {
		failures.push(`${testCase.name}: expected score ${testCase.expectedScore}, got ${result.score}`);
	}
	if (typeof testCase.maxScore === "number" && result.score > testCase.maxScore) {
		failures.push(`${testCase.name}: expected score <= ${testCase.maxScore}, got ${result.score}`);
	}
	if (result.bucket !== testCase.expectedBucket) {
		failures.push(`${testCase.name}: expected bucket ${testCase.expectedBucket}, got ${result.bucket}`);
	}
}

console.log(
	JSON.stringify(
		{
			ok: failures.length === 0,
			results,
			failures,
		},
		null,
		2,
	),
);

if (failures.length > 0) {
	process.exit(1);
}
