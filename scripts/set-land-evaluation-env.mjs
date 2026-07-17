import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { auditLandEvaluationEnvKeys } from "./verify-land-evaluation-env.mjs";

const recognizedGroups = [
	["GOOGLE_MAPS_API_KEY", "GOOGLE_API_KEY"],
	["WAGRI_ACCESS_TOKEN", "WAGRI_API_TOKEN", "WAGRI_TOKEN"],
	["REINFOLIB_API_KEY", "MLIT_REINFOLIB_API_KEY", "LAND_REINFOLIB_API_KEY"],
	[
		"MOJ_CHIZU_GEOJSON_URLS",
		"MOJ_CHIZU_GEOJSON_URL",
		"MOJ_CHIZU_GEOJSON_INLINE_BASE64",
		"MOJ_CHIZU_GEOJSON_INLINE_JSON",
	],
	["GRID_CAPACITY_PUBLIC_JSON_URLS", "GRID_CAPACITY_PUBLIC_JSON_URL", "GRID_CAPACITY_PUBLIC_JSON"],
];

export function parseDotEnvEntries(content) {
	const entries = new Map();
	for (const line of String(content || "").split(/\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = trimmed.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=(.*)$/);
		if (!match) continue;
		const key = match[1];
		let value = match[2].trim();
		const quote = value[0];
		if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
			value = value.slice(1, -1);
		}
		if (value) entries.set(key, value);
	}
	return entries;
}

export function landEvaluationEnvAssignments(entries) {
	const assignments = [];
	for (const group of recognizedGroups) {
		const key = group.find((candidate) => entries.has(candidate));
		if (!key) continue;
		assignments.push({ key, value: entries.get(key) });
	}
	return assignments;
}

export function redactedAssignmentSummary(assignments) {
	return {
		keysToSet: assignments.map((assignment) => assignment.key),
		count: assignments.length,
		printedSecretValues: false,
	};
}

export function buildNtnEnvSetArgs(assignments) {
	return [
		"ntn",
		"workers",
		"env",
		"set",
		...assignments.map((assignment) => `${assignment.key}=${assignment.value}`),
	];
}

export function landEvaluationEnvTemplate() {
	return [
		"# WAJO Sales OS land evaluation API keys and public data inputs",
		"# Fill the values locally. This file is ignored by git via .env.*.",
		"# Do not paste these values into chat or tracked files.",
		"",
		"# Google Maps Platform: Geocoding, Roads, Places API (New)",
		"GOOGLE_MAPS_API_KEY=",
		"",
		"# WAGRI / eMAFF farmland API",
		"WAGRI_ACCESS_TOKEN=",
		"",
		"# MLIT Real Estate Information Library",
		"REINFOLIB_API_KEY=",
		"",
		"# Pre-hosted MOJ cadastral GeoJSON URLs. Comma-separated if multiple. Public data input, not an API key.",
		"MOJ_CHIZU_GEOJSON_URLS=",
		"# Or, for small generated GeoJSON fixtures, base64-encoded inline GeoJSON.",
		"MOJ_CHIZU_GEOJSON_INLINE_BASE64=",
		"",
		"# Pre-hosted grid capacity public JSON URLs. Comma-separated if multiple. Public data input, not an API key.",
		"GRID_CAPACITY_PUBLIC_JSON_URLS=",
		"",
	].join("\n");
}

function finish(code, payload) {
	console.log(JSON.stringify(payload, null, 2));
	process.exit(code);
}

function argValue(name, fallback) {
	const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
	return exact ? exact.slice(name.length + 1) : fallback;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const file = argValue("--file", ".env.land.local");
	const apply = process.argv.includes("--apply");
	const printTemplate = process.argv.includes("--print-template");
	const writeTemplate = process.argv.includes("--write-template");
	try {
		if (printTemplate || writeTemplate) {
			const template = landEvaluationEnvTemplate();
			if (writeTemplate) {
				if (existsSync(file) && !process.argv.includes("--force")) {
					finish(1, {
						ok: false,
						mode: "write-template",
						source: file,
						message: "Template file already exists. Use --force to overwrite.",
						printedSecretValues: false,
					});
				}
				writeFileSync(file, template, { encoding: "utf8", mode: 0o600 });
			}
			finish(0, {
				ok: true,
				mode: writeTemplate ? "write-template" : "print-template",
				source: file,
				template: printTemplate ? template : undefined,
				keysToFill: recognizedGroups.map((group) => group[0]),
				printedSecretValues: false,
			});
		}
		const entries = parseDotEnvEntries(readFileSync(file, "utf8"));
		const assignments = landEvaluationEnvAssignments(entries);
		const audit = auditLandEvaluationEnvKeys(new Set(assignments.map((assignment) => assignment.key)));
		if (!audit.ok) {
			finish(1, {
				ok: false,
				mode: apply ? "apply" : "dry-run",
				source: file,
				keysToSet: assignments.map((assignment) => assignment.key),
				missingGroups: audit.missingGroups.map((group) => ({
					label: group.label,
					acceptedEnvNames: group.anyOf,
				})),
				printedSecretValues: false,
			});
		}
		if (apply) {
			execFileSync("npx", buildNtnEnvSetArgs(assignments), {
				env: { ...process.env, NOTION_KEYRING: "0" },
				stdio: ["ignore", "pipe", "pipe"],
			});
		}
		finish(0, {
			ok: true,
			mode: apply ? "apply" : "dry-run",
			source: file,
			...redactedAssignmentSummary(assignments),
			notice: apply
				? "Worker environment variables were submitted via ntn. Secret values were not printed."
				: "Dry-run only. Use --apply to submit these keys to the Worker.",
		});
	} catch (error) {
		finish(1, {
			ok: false,
			mode: apply ? "apply" : "dry-run",
			source: file,
			message: String(error?.message || error),
			printedSecretValues: false,
		});
	}
}
