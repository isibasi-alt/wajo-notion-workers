import { execFileSync } from "node:child_process";

const cases = [
	{
		name: "primary",
		pageId: process.env.LAND_EVAL_HIGH_PAGE_ID || "3784d017-81e7-81c3-b484-c18128975ce0",
		expectedRequiresInvestigation: true,
	},
	{
		name: "blocked",
		pageId: process.env.LAND_EVAL_BLOCKED_PAGE_ID || "3784d017-81e7-81b1-be81-c6e81b4cd982",
		expectedBucket: "要確認",
		expectedRequiresInvestigation: true,
	},
	{
		name: "missing-input",
		pageId: process.env.LAND_EVAL_MISSING_INPUT_PAGE_ID || "3774d017-81e7-81c6-b400-ee86cdc94eca",
		expectedBucket: "要確認",
		expectedRequiresInvestigation: true,
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
		aZoneDecision: result.aZoneDecision,
		aZoneScoreVersion: result.aZoneScore?.version,
		aZoneScoreTotal100: result.aZoneScore?.total100,
		requiresInvestigation: result.requiresInvestigation,
		investigationGaps: result.investigationGaps,
		sourceSummaryHasEvidenceState: /証拠区分=/.test(result.sourceSummary || ""),
		humanCollectionItemsPresent: Boolean(result.humanCollectionItems),
		bZoneHandoffPresent: Boolean(result.bZoneHandoff),
		cZoneReady: result.cZoneReady,
		cZoneReadiness: result.cZoneReadiness,
		message: result.message,
	});
	if (result.action !== "dry-run") {
		failures.push(`${testCase.name}: expected dry-run action, got ${result.action}`);
	}
	if (testCase.expectedGrade && result.overallGrade !== testCase.expectedGrade) {
		failures.push(`${testCase.name}: expected grade ${testCase.expectedGrade}, got ${result.overallGrade}`);
	}
	if (typeof testCase.expectedScore === "number" && result.score !== testCase.expectedScore) {
		failures.push(`${testCase.name}: expected score ${testCase.expectedScore}, got ${result.score}`);
	}
	if (testCase.expectedBucket && result.bucket !== testCase.expectedBucket) {
		failures.push(`${testCase.name}: expected bucket ${testCase.expectedBucket}, got ${result.bucket}`);
	}
	if (
		typeof testCase.expectedRequiresInvestigation === "boolean" &&
		result.requiresInvestigation !== testCase.expectedRequiresInvestigation
	) {
		failures.push(
			`${testCase.name}: expected requiresInvestigation ${testCase.expectedRequiresInvestigation}, got ${result.requiresInvestigation}`,
		);
	}
	if (!/Aゾーン取得元サマリー/.test(result.sourceSummary || "")) {
		failures.push(`${testCase.name}: expected sourceSummary in dry-run result`);
	}
	if (!/証拠区分=/.test(result.sourceSummary || "")) {
		failures.push(`${testCase.name}: expected evidence state in sourceSummary`);
	}
	if (!result.humanCollectionItems) {
		failures.push(`${testCase.name}: expected humanCollectionItems in dry-run result`);
	}
	if (!result.bZoneHandoff) {
		failures.push(`${testCase.name}: expected bZoneHandoff in dry-run result`);
	}
	if (!result.cZoneReadiness) {
		failures.push(`${testCase.name}: expected cZoneReadiness in dry-run result`);
	}
	if (result.aZoneScore?.version !== "v0") {
		failures.push(`${testCase.name}: expected aZoneScore version v0`);
	}
	if (result.requiresInvestigation === true) {
		if (result.overallGrade === "未評価") {
			failures.push(`${testCase.name}: requiresInvestigation must keep an A-zone速報 grade, got 未評価`);
		}
		if (typeof result.score !== "number") {
			failures.push(`${testCase.name}: requiresInvestigation must keep an A-zone速報 score number, got ${result.score}`);
		}
		if (!["行く", "行かない"].includes(result.aZoneDecision)) {
			failures.push(`${testCase.name}: requiresInvestigation must return aZoneDecision 行く/行かない, got ${result.aZoneDecision}`);
		}
		if (!/Aゾーン速報判断=/.test(result.message || "")) {
			failures.push(`${testCase.name}: requiresInvestigation message must state Aゾーン速報判断`);
		}
		if (result.cZoneReady !== false) {
			failures.push(`${testCase.name}: requiresInvestigation must return cZoneReady=false`);
		}
		if (!/Cゾーン再評価: 不可/.test(result.cZoneReadiness || "")) {
			failures.push(`${testCase.name}: requiresInvestigation must return Cゾーン再評価: 不可`);
		}
		if (!/Bゾーン引き渡し/.test(result.bZoneHandoff || "")) {
			failures.push(`${testCase.name}: requiresInvestigation must include Bゾーン引き渡し`);
		}
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
