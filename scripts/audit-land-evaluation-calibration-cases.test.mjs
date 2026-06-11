import assert from "node:assert/strict";

import { auditLandEvaluationCalibrationCases } from "./audit-land-evaluation-calibration-cases.mjs";

const suzukaCandidateBeforeAttachment = {
	caseId: "gmail-2022-09-suzuka-high-rights",
	evidenceSource: "Gmail thread 182800363c35cbea",
	address: "三重県鈴鹿市国分町池ノ谷",
	projectSizeKw: 395.2,
	farmlandResult: "許可",
	projectOutcome: "買付証明",
	evidenceItems: [
		"2022-09-22: 農地転用の許可が降りました",
		"2022-09-26: 買付証明書（鈴鹿高圧土地権利）",
	],
};

const suzukaBeforeAttachmentResult = auditLandEvaluationCalibrationCases([
	suzukaCandidateBeforeAttachment,
], {
	minReadyCases: 1,
});

assert.equal(suzukaBeforeAttachmentResult.checked, 1);
assert.equal(suzukaBeforeAttachmentResult.readyCount, 0);
assert.equal(suzukaBeforeAttachmentResult.meetsInitialCalibrationGate, false);
assert.equal(suzukaBeforeAttachmentResult.cases[0].status, "needs-human-followup");
assert.deepEqual(suzukaBeforeAttachmentResult.cases[0].missingRequiredFields, [
	"areaTsuboOrSquareMeter",
]);
assert.deepEqual(suzukaBeforeAttachmentResult.cases[0].missingRecommendedFields, [
	"parcel",
	"landCategory",
	"farmlandClass",
	"roadStatus",
	"registryStatus",
	"purchaseOrOfferPriceMemo",
	"outcomeReason",
]);

const suzukaReadyCandidate = {
	...suzukaCandidateBeforeAttachment,
	evidenceSource: "Gmail thread 182800363c35cbea + attachment 2022-07-27",
	areaSquareMeter: 5555,
	areaTsubo: 1680,
	purchaseOrOfferPriceMemo: "買付金額あり（具体額は原本参照）",
	outcomeReason: "農転許可後に買付証明へ進行",
	evidenceItems: [
		"2022-07-27 物件情報PDF: 敷地面積5555㎡ / 有効面積1680坪",
		"2022-09-22 Gmail: 農地転用許可",
		"2022-09-26 Gmail: 買付証明書",
	],
};

const suzukaReadyResult = auditLandEvaluationCalibrationCases([suzukaReadyCandidate], {
	minReadyCases: 1,
});

assert.equal(suzukaReadyResult.checked, 1);
assert.equal(suzukaReadyResult.readyCount, 1);
assert.equal(suzukaReadyResult.meetsInitialCalibrationGate, true);
assert.equal(suzukaReadyResult.cases[0].status, "ready-for-initial-calibration");
assert.deepEqual(suzukaReadyResult.cases[0].missingRequiredFields, []);
assert.deepEqual(suzukaReadyResult.cases[0].missingRecommendedFields, [
	"parcel",
	"landCategory",
	"farmlandClass",
	"roadStatus",
	"registryStatus",
]);

const allFieldsReadyCase = {
	...suzukaReadyCandidate,
	parcel: "地番確認済み",
	landCategory: "田",
	farmlandClass: "第2種農地想定",
	roadStatus: "幅員4m以上 / 大型車進入: 要確認",
	registryStatus: "所有者確認済み",
};

const allFieldsReadyResult = auditLandEvaluationCalibrationCases([allFieldsReadyCase], {
	minReadyCases: 1,
});

assert.equal(allFieldsReadyResult.checked, 1);
assert.equal(allFieldsReadyResult.readyCount, 1);
assert.equal(allFieldsReadyResult.meetsInitialCalibrationGate, true);
assert.equal(allFieldsReadyResult.cases[0].status, "ready-for-initial-calibration");
assert.deepEqual(allFieldsReadyResult.cases[0].missingRequiredFields, []);
assert.deepEqual(allFieldsReadyResult.cases[0].missingRecommendedFields, []);

const defaultGateResult = auditLandEvaluationCalibrationCases([suzukaReadyCandidate]);
assert.equal(defaultGateResult.minReadyCases, 3);
assert.equal(defaultGateResult.meetsInitialCalibrationGate, false);
