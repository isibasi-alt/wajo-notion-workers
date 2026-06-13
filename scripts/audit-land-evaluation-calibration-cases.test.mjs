import assert from "node:assert/strict";
import { auditCalibrationCases } from "./audit-land-evaluation-calibration-cases.mjs";

const uncertainCases = [
	{
		caseId: "uncertain-1",
		evidenceSource: "mail-thread-a",
		location: "三重県テスト市",
		area: "1,000㎡",
		farmlandResult: "未確定",
		caseResult: "未追跡",
		evidence: ["概要書"],
	},
	{
		caseId: "uncertain-2",
		evidenceSource: "mail-thread-b",
		location: "広島県テスト町",
		area: "2,000㎡",
		farmlandResult: "未確定",
		caseResult: "案件化",
		evidence: ["契約書案"],
	},
	{
		caseId: "uncertain-3",
		evidenceSource: "mail-thread-c",
		location: "山口県テスト市",
		area: "3,000㎡",
		farmlandResult: "許可",
		caseResult: "未追跡",
		evidence: ["物件資料"],
	},
];

const uncertain = auditCalibrationCases(uncertainCases, { minReadyCases: 3 });
assert.equal(uncertain.checked, 3);
assert.equal(uncertain.readyCount, 0);
assert.equal(uncertain.followUpCount, 3);
assert.equal(uncertain.meetsInitialCalibrationGate, false);

const currentCases = [
	{
		caseId: "suzuka-high-voltage",
		evidenceSource: "Gmail thread 182800363c35cbea / 2022-07-27物件情報PDF",
		location: "三重県鈴鹿市国分町池ノ谷",
		area: "敷地面積5,555㎡ / 有効面積1,680坪",
		farmlandResult: "許可",
		caseResult: "買付証明",
		evidence: ["農転許可記載", "買付証明記載", "物件情報PDF"],
	},
	{
		caseId: "sera-ajtc",
		evidenceSource: "Gmail thread 16f1d01af330bbf9 / 土地賃貸借契約書",
		location: "広島県世羅郡世羅町大字長田字明見山 10169-5",
		area: "1,657㎡",
		farmlandResult: "未確定",
		caseResult: "案件化",
		evidence: ["土地賃貸借契約書", "停止条件に農転許可・農振除外許可"],
	},
	{
		caseId: "ise-futami-high-voltage",
		evidenceSource: "Gmail message 1622855522a64fee / 三重県伊勢市高圧.pdf",
		location: "三重県伊勢市二見町三津1201-1 他13筆",
		area: "24,649.98㎡",
		farmlandResult: "未確定",
		caseResult: "案件化",
		evidence: ["概要書", "農地転用欄は―"],
	},
];

const current = auditCalibrationCases(currentCases, { minReadyCases: 3 });
assert.equal(current.checked, 3);
assert.equal(current.readyCount, 1);
assert.equal(current.followUpCount, 2);
assert.equal(current.meetsInitialCalibrationGate, false);
assert.deepEqual(current.readyCases.map((item) => item.caseId), ["suzuka-high-voltage"]);
assert.deepEqual(current.followUpCases.map((item) => item.caseId), [
	"sera-ajtc",
	"ise-futami-high-voltage",
]);
