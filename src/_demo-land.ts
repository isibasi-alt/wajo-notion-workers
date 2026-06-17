import { evaluateLandTreasure } from "./land-treasure-engine.js";

// ※サンプル入力（大阪・堺あたりの架空の遊休地）。エンジンの素の計算を見るためのデモ。
const result = evaluateLandTreasure({
  name: "サンプル遊休地（堺市）",
  address: "大阪府堺市美原区",
  areaTsubo: 1200,
  powerArea: "関西",
  landUse: "市街化調整区域",
  road: "幅員6m公道に接道",
  farmland: "農地ではない",
  farmlandType: "",
  registry: "雑種地",
  nearbyResidentialDistanceM: 180,
  nearbyResidentialCheck: "離隔OK",
  transmissionLine: "近くに高圧線あり",
  latitude: 34.5333,
  longitude: 135.5500,
  substationDistanceKm: null,
});

console.log("==== 土地お宝エンジン 生出力 ====");
console.log("総合グレード:", result.overallGrade, " / スコア:", result.score);
console.log("案件タイプ:", result.projectType, " / 電力エリア:", result.powerArea);
console.log("最寄変電所:", result.nearestSubstationName,
  "（", result.nearestSubstationDistanceKm, "km /", result.nearestSubstationOperator,
  "/ 系統:", result.nearestSubstationGridStatus, "）");
console.log("物理AIスコア:", result.physicalAiScore, " / 営業AIスコア:", result.salesAiScore);
console.log("ブロッカー:", result.blockers);
console.log("次アクション:", result.nextAction);
console.log("S/A/B/C理由:", result.sabcReason);
