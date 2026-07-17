import { execFileSync } from "node:child_process";

const dataSourceId =
	process.env.LAND_DATA_SOURCE_ID || "3dbe3c77-2e50-4639-92aa-c0741904974b";
const maxPages = Number.parseInt(process.env.LAND_AUDIT_LIMIT || "100", 10);

function parseJsonOutput(output) {
	const start = output.indexOf("{");
	const end = output.lastIndexOf("}");
	if (start === -1 || end === -1 || end < start) {
		throw new Error(`No JSON object found in query output: ${output.slice(0, 500)}`);
	}
	return JSON.parse(output.slice(start, end + 1));
}

function queryPage(startCursor) {
	const args = ["ntn", "datasources", "query", dataSourceId, "--limit", "100", "--json"];
	if (startCursor) {
		args.push("--start-cursor", startCursor);
	}
	const output = execFileSync("npx", args, {
		encoding: "utf8",
		env: { ...process.env, NOTION_KEYRING: "0" },
		stdio: ["ignore", "pipe", "pipe"],
		maxBuffer: 50 * 1024 * 1024,
	});
	return parseJsonOutput(output);
}

function text(prop) {
	if (!prop) return "";
	if (prop.type === "title") return prop.title?.map((t) => t.plain_text || "").join("") || "";
	if (prop.type === "rich_text") return prop.rich_text?.map((t) => t.plain_text || "").join("") || "";
	if (prop.type === "select") return prop.select?.name || "";
	if (prop.type === "formula") {
		const formula = prop.formula;
		return String(formula?.string ?? formula?.number ?? formula?.boolean ?? "");
	}
	if (prop.type === "number") return prop.number === null || prop.number === undefined ? "" : String(prop.number);
	if (prop.type === "place") {
		return [prop.place?.name, prop.place?.address].filter(Boolean).join(" ");
	}
	return "";
}

function number(prop) {
	if (!prop) return null;
	if (prop.type === "number") return typeof prop.number === "number" ? prop.number : null;
	const parsed = Number.parseFloat(text(prop).replace(/,/g, ""));
	return Number.isFinite(parsed) ? parsed : null;
}

function coordinate(props, axis) {
	const gps = props["GPS情報"]?.place;
	const gpsValue = axis === "lat" ? gps?.lat : gps?.lon;
	if (typeof gpsValue === "number") return gpsValue;
	const candidates =
		axis === "lat"
			? [props["緯度"], props["latitude"], props["Latitude"]]
			: [props["経度"], props["longitude"], props["Longitude"]];
	for (const candidate of candidates) {
		const value = number(candidate);
		if (value !== null) return value;
	}
	return null;
}

function title(props) {
	return text(props["土地名称"]) || text(props.Name) || "(no title)";
}

const pages = [];
let cursor = undefined;
while (pages.length < maxPages) {
	const response = queryPage(cursor);
	pages.push(...response.results);
	if (!response.has_more || !response.next_cursor) break;
	cursor = response.next_cursor;
}

const sampled = pages.slice(0, maxPages);
const risks = [];
const summary = {
	dataSourceId,
	checked: sampled.length,
	hasMoreBeyondLimit: pages.length >= maxPages,
	withAddress: 0,
	withCoordinates: 0,
	withSubstationDistance: 0,
	withRoadText: 0,
	withFarmlandDecision: 0,
	withRegistryStatus: 0,
	withNearbyResidentialSignal: 0,
	withSabcMemo: 0,
	needsCoordinateOrGoogleKey: 0,
	missingRoadText: 0,
	missingFarmlandOrRegistry: 0,
};

for (const page of sampled) {
	const props = page.properties || {};
	const name = title(props);
	const address = text(props["所在地"]);
	const lat = coordinate(props, "lat");
	const lon = coordinate(props, "lon");
	const substationDistance = number(props["変電所距離（km）"]);
	const road = text(props["接道"]) || text(props["接道状況"]) || text(props["道路状況"]);
	const farmland = text(props["農地転用可否"]) || text(props["農地種別"]);
	const registry = text(props["登記確認状況"]);
	const nearby = number(props["近隣住宅距離（m）"]) ?? text(props["近隣住宅確認"]);
	const memo = [text(props["一次AI受付メモ"]), text(props["案件化メモ"])].join(" ");

	if (address) summary.withAddress += 1;
	if (lat !== null && lon !== null) summary.withCoordinates += 1;
	if (substationDistance !== null) summary.withSubstationDistance += 1;
	if (road) summary.withRoadText += 1;
	if (farmland) summary.withFarmlandDecision += 1;
	if (registry) summary.withRegistryStatus += 1;
	if (nearby !== null && nearby !== "") summary.withNearbyResidentialSignal += 1;
	if (/SABC|2AI|AI-1 物理|AI-2 営業/.test(memo)) summary.withSabcMemo += 1;

	const pageRisks = [];
	if (lat === null && lon === null && substationDistance === null) {
		summary.needsCoordinateOrGoogleKey += 1;
		pageRisks.push("GPS/緯度経度/変電所距離なし");
	}
	if (!road) {
		summary.missingRoadText += 1;
		pageRisks.push("接道情報なし");
	}
	if (!farmland || !registry) {
		summary.missingFarmlandOrRegistry += 1;
		pageRisks.push("農転または登記確認が不足");
	}
	if (pageRisks.length > 0 && risks.length < 20) {
		risks.push({ pageId: page.id, title: name, risks: pageRisks });
	}
}

console.log(
	JSON.stringify(
		{
			ok: true,
			summary,
			representativeRisks: risks,
			note:
				"This is a read-only readiness audit. It does not prove all land records are release-ready; it identifies fields that affect bird-eye evaluation quality.",
		},
		null,
		2,
	),
);
