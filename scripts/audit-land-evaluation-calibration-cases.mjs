import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const FINAL_FARMLAND_RESULTS = new Set(["許可", "許可済", "不許可", "条件付き", "取下げ", "不要"]);
const NON_FINAL_CASE_RESULTS = new Set(["", "未追跡", "未確定", "不明"]);

function text(value) {
	return typeof value === "string" ? value.trim() : "";
}

function hasEvidence(value) {
	return Array.isArray(value) && value.some((item) => text(item));
}

function requiredMissing(item) {
	const missing = [];
	if (!text(item.caseId)) missing.push("caseId");
	if (!text(item.evidenceSource)) missing.push("evidenceSource");
	if (!text(item.location)) missing.push("location");
	if (!text(item.area)) missing.push("area");
	if (!text(item.farmlandResult)) missing.push("farmlandResult");
	if (!text(item.caseResult)) missing.push("caseResult");
	if (!hasEvidence(item.evidence)) missing.push("evidence");
	return missing;
}

function readiness(item) {
	const missingRequired = requiredMissing(item);
	const farmlandResult = text(item.farmlandResult);
	const caseResult = text(item.caseResult);
	const reasons = [];
	if (missingRequired.length > 0) reasons.push(`必須欠損: ${missingRequired.join(", ")}`);
	if (!FINAL_FARMLAND_RESULTS.has(farmlandResult)) {
		reasons.push(`農転結果が未確定: ${farmlandResult || "未入力"}`);
	}
	if (NON_FINAL_CASE_RESULTS.has(caseResult)) {
		reasons.push(`案件結果が未確定: ${caseResult || "未入力"}`);
	}
	return {
		caseId: text(item.caseId) || "(missing caseId)",
		ready: missingRequired.length === 0 &&
			FINAL_FARMLAND_RESULTS.has(farmlandResult) &&
			!NON_FINAL_CASE_RESULTS.has(caseResult),
		missingRequired,
		reasons,
	};
}

export function auditCalibrationCases(cases, options = {}) {
	const minReadyCases = Number(options.minReadyCases ?? 3);
	const checkedCases = Array.isArray(cases) ? cases : [];
	const audited = checkedCases.map((item) => readiness(item));
	const readyCases = audited.filter((item) => item.ready);
	const followUpCases = audited.filter((item) => !item.ready);
	return {
		ok: true,
		checked: checkedCases.length,
		minReadyCases,
		readyCount: readyCases.length,
		followUpCount: followUpCases.length,
		meetsInitialCalibrationGate: readyCases.length >= minReadyCases,
		readyCases,
		followUpCases,
	};
}

function parseArgs(argv) {
	const inputPath = argv[2];
	const minIndex = argv.indexOf("--min-ready-cases");
	const inlineMin = argv.find((arg) => arg.startsWith("--min-ready-cases="));
	const minReadyCases =
		minIndex >= 0 ? Number(argv[minIndex + 1]) :
		inlineMin ? Number(inlineMin.split("=")[1]) :
		3;
	return { inputPath, minReadyCases };
}

async function main() {
	const { inputPath, minReadyCases } = parseArgs(process.argv);
	if (!inputPath) {
		console.error("Usage: node scripts/audit-land-evaluation-calibration-cases.mjs <cases.json> [--min-ready-cases=3]");
		process.exit(2);
	}
	const raw = await readFile(inputPath, "utf8");
	const cases = JSON.parse(raw);
	const result = auditCalibrationCases(cases, { minReadyCases });
	console.log(JSON.stringify(result, null, 2));
	process.exit(result.meetsInitialCalibrationGate ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error);
		process.exit(2);
	});
}
