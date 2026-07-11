import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { auditLandEvaluationEnvKeys, parseDotEnvKeys } from "./verify-land-evaluation-env.mjs";

const requirements = [
	{
		id: "geocode",
		label: "座標化",
		sourceNeedles: ["Google Geocoding API", "Google Maps"],
		testNeedles: ["Google Geocoding API"],
		runtimeGroups: ["Google Maps Platform"],
	},
	{
		id: "substations",
		label: "変電所候補",
		sourceNeedles: ["変電所候補3件"],
		testNeedles: ["変電所候補3件"],
		runtimeGroups: [],
	},
	{
		id: "land-price",
		label: "地価",
		sourceNeedles: ["不動産情報ライブラリ接続", "地価公示・地価調査"],
		testNeedles: ["不動産情報ライブラリ接続"],
		runtimeGroups: ["国土交通省 不動産情報ライブラリ"],
	},
	{
		id: "zoning-hazard",
		label: "用途地域・防災",
		sourceNeedles: ["用途地域", "防災一次確認"],
		testNeedles: ["用途地域", "洪水浸水想定区域"],
		runtimeGroups: ["国土交通省 不動産情報ライブラリ"],
	},
	{
		id: "surroundings",
		label: "周辺条件",
		sourceNeedles: ["Google Places API"],
		testNeedles: ["Google Places API"],
		runtimeGroups: ["Google Maps Platform"],
	},
	{
		id: "farmland",
		label: "農地候補",
		sourceNeedles: ["WAGRI農地API", "ID付与済み筆ポリゴン取得API v3"],
		testNeedles: ["WAGRI農地API", "ID付与済み筆ポリゴン取得API v3"],
		runtimeGroups: ["WAGRI / eMAFF農地ナビ"],
	},
	{
		id: "parcel",
		label: "地番候補",
		sourceNeedles: ["登記所備付地図データ接続", "地番候補"],
		testNeedles: ["登記所備付地図データ接続", "地番候補"],
		runtimeGroups: ["法務省 登記所備付地図データ（公開データ配置）"],
	},
	{
		id: "road",
		label: "接道・道路候補",
		sourceNeedles: ["国土地理院道路候補", "Google Roads", "道路台帳"],
		testNeedles: ["国土地理院道路候補", "道路台帳"],
		runtimeGroups: ["Google Maps Platform"],
	},
	{
		id: "grid-action",
		label: "系統空き確認先・営業アクション",
		sourceNeedles: ["系統空き確認", "OCCTO", "資源エネルギー庁", "今日やること", "営業トーク", "見送り理由候補"],
		testNeedles: ["系統空き確認", "OCCTO", "今日やること", "営業トーク"],
		runtimeGroups: ["系統空容量 公表値JSON（公開データ配置）"],
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
