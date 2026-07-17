import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const requiredGroups = [
	{
		label: "Google Maps Platform",
		purpose: "住所の座標化、Google Roads、Google Places API (New)",
		inputType: "api-key",
		anyOf: ["GOOGLE_MAPS_API_KEY", "GOOGLE_API_KEY"],
	},
	{
		label: "WAGRI / eMAFF農地ナビ",
		purpose: "農地ピン、農地筆ポリゴン候補",
		inputType: "api-token",
		anyOf: ["WAGRI_ACCESS_TOKEN", "WAGRI_API_TOKEN", "WAGRI_TOKEN"],
	},
	{
		label: "国土交通省 不動産情報ライブラリ",
		purpose: "地価、用途地域、都市計画、防災、取引事例候補",
		inputType: "api-key",
		anyOf: ["REINFOLIB_API_KEY", "MLIT_REINFOLIB_API_KEY", "LAND_REINFOLIB_API_KEY"],
	},
	{
		label: "法務省 登記所備付地図データ（公開データ配置）",
		purpose: "G空間情報センター公開データを取得・変換したGeoJSON URL。APIキーではない",
		inputType: "public-data-url",
		anyOf: ["MOJ_CHIZU_GEOJSON_URLS", "MOJ_CHIZU_GEOJSON_URL"],
	},
	{
		label: "系統空容量 公表値JSON（公開データ配置）",
		purpose: "資源エネルギー庁、OCCTO、各送配電会社の公開情報を正規化したJSON URLまたはJSON。APIキーではない",
		inputType: "public-data-json",
		anyOf: ["GRID_CAPACITY_PUBLIC_JSON_URLS", "GRID_CAPACITY_PUBLIC_JSON_URL", "GRID_CAPACITY_PUBLIC_JSON"],
	},
];

export function parseNtnEnvList(output) {
	const keys = new Set();
	for (const line of String(output || "").split(/\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const key = trimmed.split(/\s+/)[0]?.trim();
		if (key && /^[A-Z0-9_]+$/.test(key)) keys.add(key);
	}
	return keys;
}

export function parseDotEnvKeys(content) {
	const keys = new Set();
	for (const line of String(content || "").split(/\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = trimmed.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=(.*)$/);
		if (!match?.[1]) continue;
		const value = match[2].trim();
		if (value) keys.add(match[1]);
	}
	return keys;
}

export function auditLandEvaluationEnvKeys(keys) {
	const keySet = keys instanceof Set ? keys : new Set(keys);
	const groups = requiredGroups.map((group) => {
		const present = group.anyOf.filter((key) => keySet.has(key));
		return {
			label: group.label,
			purpose: group.purpose,
			inputType: group.inputType,
			anyOf: group.anyOf,
			present,
			ok: present.length > 0,
		};
	});
	const missingGroups = groups.filter((group) => !group.ok);
	return {
		ok: missingGroups.length === 0,
		groups,
		missingGroups,
		printedSecretValues: false,
	};
}

function finish(code, payload) {
	console.log(JSON.stringify(payload, null, 2));
	process.exit(code);
}

export function remoteEnvKeys() {
	const output = execFileSync("npx", ["ntn", "workers", "env", "list"], {
		encoding: "utf8",
		env: { ...process.env, NOTION_KEYRING: "0" },
		stdio: ["ignore", "pipe", "pipe"],
	});
	return parseNtnEnvList(output);
}

export function localEnvKeys(file) {
	const content = readFileSync(file, "utf8");
	return parseDotEnvKeys(content);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	let source = "ntn workers env list";
	try {
		const fileFlag = process.argv.find((arg) => arg.startsWith("--file="));
		const file = fileFlag ? fileFlag.slice("--file=".length) : "";
		const local = process.argv.includes("--local") || Boolean(file);
		source = local ? file || ".env.land.local" : "ntn workers env list";
		const keys = local ? localEnvKeys(file || ".env.land.local") : remoteEnvKeys();
		const audit = auditLandEvaluationEnvKeys(keys);
		finish(audit.ok ? 0 : 1, {
			ok: audit.ok,
			source,
			presentRelevantKeys: audit.groups.flatMap((group) => group.present).sort(),
			missingGroups: audit.missingGroups.map((group) => ({
				label: group.label,
				purpose: group.purpose,
				inputType: group.inputType,
				acceptedEnvNames: group.anyOf,
			})),
			printedSecretValues: false,
		});
	} catch (error) {
		finish(1, {
			ok: false,
			source,
			message: String(error?.message || error),
			printedSecretValues: false,
		});
	}
}
