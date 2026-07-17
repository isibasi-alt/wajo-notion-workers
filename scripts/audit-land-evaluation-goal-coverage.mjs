import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { auditLandEvaluationEnvKeys, parseDotEnvKeys } from "./verify-land-evaluation-env.mjs";

const requirements = [
	{
		id: "address-coordinate-area",
		label: "住所正規化・座標・住所面積整合",
		sourceNeedles: ["住所・面積整合", "住所正規化・座標", "Google Geocoding API", "Google Maps"],
		testNeedles: ["住所・面積整合", "Google Geocoding API"],
		runtimeGroups: ["Google Maps Platform"],
	},
	{
		id: "parcel-boundary",
		label: "地番・筆界候補・公図系データ",
		sourceNeedles: ["登記所備付地図データ接続", "地番候補", "筆界候補"],
		testNeedles: ["登記所備付地図データ接続", "地番候補", "筆界候補"],
		runtimeGroups: ["法務省 登記所備付地図データ"],
	},
	{
		id: "registry-rights",
		label: "登記・所有権・地目・地積・権利リスク",
		sourceNeedles: ["登記・所有権・地目・地積・権利リスク", "登記情報提供サービス"],
		testNeedles: ["登記・所有権・地目・地積・権利リスク"],
		runtimeGroups: [],
	},
	{
		id: "farmland",
		label: "農地ナビ・農振・農地区分・農転",
		sourceNeedles: ["WAGRI農地API", "ID付与済み筆ポリゴン取得API v3"],
		testNeedles: ["WAGRI農地API", "ID付与済み筆ポリゴン取得API v3"],
		runtimeGroups: ["WAGRI / eMAFF農地ナビ"],
	},
	{
		id: "zoning",
		label: "用途地域・都市計画・建蔽率・容積率",
		sourceNeedles: ["用途地域・都市計画・建蔽率・容積率", "用途地域", "建蔽率", "容積率"],
		testNeedles: ["用途地域: 準工業地域", "建蔽率: 60%", "容積率: 200%"],
		runtimeGroups: ["国土交通省 不動産情報ライブラリ"],
	},
	{
		id: "land-price-transaction",
		label: "地価公示・都道府県地価・取引事例",
		sourceNeedles: ["地価公示・都道府県地価・取引事例", "地価公示・地価調査", "同一市区町村の取引事例候補"],
		testNeedles: ["地価公示・地価調査", "同一市区町村の取引事例候補"],
		runtimeGroups: ["国土交通省 不動産情報ライブラリ"],
	},
	{
		id: "road",
		label: "道路種別・幅員・接道・大型車進入経路",
		sourceNeedles: ["国土地理院道路候補", "Google Roads", "道路台帳"],
		testNeedles: ["国土地理院道路候補", "道路台帳"],
		runtimeGroups: ["Google Maps Platform"],
	},
	{
		id: "grid-substation",
		label: "変電所・送電線・系統空容量・接続制約",
		sourceNeedles: ["系統・変電所", "系統空き確認", "OCCTO", "資源エネルギー庁", "変電所候補3件", "今日やること", "営業トーク", "見送り理由候補"],
		testNeedles: ["系統空き確認", "OCCTO", "土岐津変電所", "今日やること", "営業トーク"],
		runtimeGroups: ["系統空容量 公表値JSON"],
	},
	{
		id: "hazards",
		label: "洪水・津波・高潮・土砂災害・液状化等",
		sourceNeedles: ["洪水・津波・高潮・土砂災害・液状化", "防災一次確認"],
		testNeedles: ["洪水浸水想定区域", "津波・高潮・液状化"],
		runtimeGroups: ["国土交通省 不動産情報ライブラリ"],
	},
	{
		id: "terrain",
		label: "標高・傾斜・造成難易度",
		sourceNeedles: ["標高・傾斜・造成難易度", "国土地理院 標高取得プログラム"],
		testNeedles: ["標高・造成一次確認", "傾斜・造成難易度"],
		runtimeGroups: [],
	},
	{
		id: "surroundings",
		label: "近隣住宅・学校・病院・駅・集落密度",
		sourceNeedles: ["近隣住宅・学校・病院・駅・集落密度", "Google Places API"],
		testNeedles: ["Google Places API", "学校候補", "病院候補", "駅候補"],
		runtimeGroups: ["Google Maps Platform"],
	},
	{
		id: "protected-rules",
		label: "森林・保安林・自然公園・文化財・景観・自治体条例",
		sourceNeedles: ["森林・保安林・自然公園・文化財・景観・自治体条例"],
		testNeedles: ["森林・保安林・自然公園・文化財・景観・自治体条例"],
		runtimeGroups: [],
	},
	{
		id: "price-feasibility",
		label: "土地価格・希望価格・事業採算",
		sourceNeedles: ["土地価格・希望価格・事業採算", "希望価格・粗利・CAPEX"],
		testNeedles: ["希望価格・粗利・CAPEX"],
		runtimeGroups: [],
	},
	{
		id: "metadata-negative",
		label: "取得元・取得日時・証拠区分・負例",
		sourceNeedles: ["取得メタデータ・証拠区分・負例", "取得失敗・対象外・未接続"],
		testNeedles: ["取得メタデータ・証拠区分・負例", "証拠区分=未確認"],
		runtimeGroups: [],
	},
	{
		id: "human-handoff",
		label: "A→B人間回収6要素",
		sourceNeedles: ["Bゾーン引き渡し", "担当=", "回収物=", "取得先=", "Notion戻し先=", "証拠区分=", "完了条件="],
		testNeedles: ["担当=", "回収物=", "取得先=", "Notion戻し先=", "証拠区分=", "完了条件="],
		runtimeGroups: [],
	},
];

export function auditLandEvaluationGoalCoverage({
	sourceText,
	testText,
	envKeys = new Set(),
	remoteVerified = false,
} = {}) {
	const envAudit = auditLandEvaluationEnvKeys(envKeys);
	const groupsByLabel = new Map(envAudit.groups.map((group) => [group.label, group]));
	const checkedRequirements = requirements.map((requirement) => {
		const missingSourceNeedles = requirement.sourceNeedles.filter((needle) => !sourceText?.includes(needle));
		const missingTestNeedles = requirement.testNeedles.filter((needle) => !testText?.includes(needle));
		const missingRuntimeGroups = requirement.runtimeGroups
			.map((label) => groupsByLabel.get(label))
			.filter((group) => group && !group.ok)
			.map((group) => ({
				label: group.label,
				purpose: group.purpose,
				inputType: group.inputType,
				acceptedEnvNames: group.anyOf,
			}));
		return {
			id: requirement.id,
			label: requirement.label,
			localImplemented: missingSourceNeedles.length === 0 && missingTestNeedles.length === 0,
			runtimeConnected: missingRuntimeGroups.length === 0,
			missingSourceNeedles,
			missingTestNeedles,
			missingRuntimeGroups,
		};
	});
	const missingRuntimeGroups = envAudit.missingGroups.map((group) => ({
		label: group.label,
		purpose: group.purpose,
		inputType: group.inputType,
		acceptedEnvNames: group.anyOf,
	}));
	const localImplemented = checkedRequirements.every((requirement) => requirement.localImplemented);
	const runtimeConnected = missingRuntimeGroups.length === 0;
	return {
		ok: localImplemented && runtimeConnected && remoteVerified,
		localImplemented,
		runtimeConnected,
		remoteVerified,
		requirements: checkedRequirements,
		missingRuntimeGroups,
		printedSecretValues: false,
	};
}

function finish(code, payload) {
	console.log(JSON.stringify(payload, null, 2));
	process.exit(code);
}

function readLocalEnvKeys() {
	try {
		return parseDotEnvKeys(readFileSync(".env.land.local", "utf8"));
	} catch {
		return new Set();
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const sourceText = [
		readFileSync("src/index.ts", "utf8"),
		readFileSync("src/land-treasure-engine.ts", "utf8"),
	].join("\n");
	const testText = [
		readFileSync("src/land-treasure-engine.test.ts", "utf8"),
		readFileSync("scripts/verify-farmland-navi-connection.test.mjs", "utf8"),
	].join("\n");
	const remoteVerified = process.argv.includes("--remote-verified");
	const result = auditLandEvaluationGoalCoverage({
		sourceText,
		testText,
		envKeys: readLocalEnvKeys(),
		remoteVerified,
	});
	finish(result.ok ? 0 : 1, result);
}
