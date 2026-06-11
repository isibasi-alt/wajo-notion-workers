import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REQUIRED_FIELDS = [
	"caseId",
	"evidenceSource",
	"address",
	"areaTsuboOrSquareMeter",
	"farmlandResult",
	"projectOutcome",
	"evidenceItems",
];

const RECOMMENDED_FIELDS = [
	"parcel",
	"landCategory",
	"farmlandClass",
	"roadStatus",
	"registryStatus",
	"purchaseOrOfferPriceMemo",
	"outcomeReason",
];

const ALLOWED_FARMLAND_RESULTS = new Set([
	"許可",
	"不許可",
	"条件付き",
	"取下げ",
	"未確定",
]);

const ALLOWED_PROJECT_OUTCOMES = new Set([
	"案件化",
	"成約",
	"買付証明",
	"見送り",
	"失注",
	"未追跡",
]);

function hasText(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function hasPositiveNumber(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasArea(item) {
	return hasPositiveNumber(item.areaTsubo) || hasPositiveNumber(item.areaSquareMeter);
}

function hasEvidenceItems(item) {
	return Array.isArray(item.evidenceItems) && item.evidenceItems.some(hasText);
}

function hasAllowedValue(value, allowedValues) {
	return hasText(value) && allowedValues.has(value.trim());
}

function isPresent(item, field) {
	if (field === "areaTsuboOrSquareMeter") return hasArea(item);
	if (field === "evidenceItems") return hasEvidenceItems(item);
	if (field === "farmlandResult") return hasAllowedValue(item.farmlandResult, ALLOWED_FARMLAND_RESULTS);
	if (field === "projectOutcome") return hasAllowedValue(item.projectOutcome, ALLOWED_PROJECT_OUTCOMES);
	return hasText(item[field]);
}

function summarizeCase(item) {
	const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !isPresent(item, field));
	const missingRecommendedFields = RECOMMENDED_FIELDS.filter((field) => !isPresent(item, field));
	return {
		caseId: hasText(item.caseId) ? item.caseId : "(missing caseId)",
		status:
			missingRequiredFields.length === 0
				? "ready-for-initial-calibration"
				: "needs-human-followup",
		evidenceSource: hasText(item.evidenceSource) ? item.evidenceSource : "",
		address: hasText(item.address) ? item.address : "",
		farmlandResult: hasText(item.farmlandResult) ? item.farmlandResult : "",
		projectOutcome: hasText(item.projectOutcome) ? item.projectOutcome : "",
		missingRequiredFields,
		missingRecommendedFields,
	};
}

export function auditLandEvaluationCalibrationCases(cases, options = {}) {
	const minReadyCases = Number.isInteger(options.minReadyCases) ? options.minReadyCases : 3;
	const normalizedCases = Array.isArray(cases) ? cases : [];
	const summarizedCases = normalizedCases.map(summarizeCase);
	const readyCases = summarizedCases.filter(
		(item) => item.status === "ready-for-initial-calibration",
	);
	return {
		ok: readyCases.length >= minReadyCases,
		checked: summarizedCases.length,
		minReadyCases,
		readyCount: readyCases.length,
		followUpCount: summarizedCases.length - readyCases.length,
		meetsInitialCalibrationGate: readyCases.length >= minReadyCases,
		readyCaseIds: readyCases.map((item) => item.caseId),
		cases: summarizedCases,
		note:
			"Calibration cases are ready only when required fields are present. Recommended fields should still be collected before production confidence claims.",
	};
}

function readCasesFromStdin() {
	const raw = readFileSync(0, "utf8").trim();
	if (!raw) return [];
	const parsed = JSON.parse(raw);
	return Array.isArray(parsed) ? parsed : parsed.cases;
}

function finish(code, payload) {
	console.log(JSON.stringify(payload, null, 2));
	process.exit(code);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const minReadyCases = Number.parseInt(process.env.LAND_CALIBRATION_MIN_READY || "3", 10);
	const result = auditLandEvaluationCalibrationCases(readCasesFromStdin(), {
		minReadyCases: Number.isFinite(minReadyCases) ? minReadyCases : 3,
	});
	finish(result.ok ? 0 : 1, result);
}
