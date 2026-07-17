import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { processLandEvaluationForTest } from "./index";

const realZipPath = "/Users/isibasidaisuke/Downloads/30428-1704-2025/30428-1704-55.zip";
const realGeoJsonPath =
	"/Users/isibasidaisuke/WAJO Sales OS/data/land/moj-chizu/2026-07-17/30428-1704-2025/converted/30428-1704-55-lot626.geojson";
const proofPath =
	"/Users/isibasidaisuke/WAJO Sales OS/data/land/moj-chizu/2026-07-17/30428-1704-2025/evidence/land-moj-real-data-usage-proof.json";
const realZipSha256 = "760b4404edc470a4da787988dd399cc75121238a1e54d4192453b7f7be041c65";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: [{ plain_text: value }] };
}

function numberProp(value: number) {
	return { type: "number", number: value };
}

function selectProp(value: string) {
	return { type: "select", select: { name: value } };
}

function multiSelectProp(...values: string[]) {
	return { type: "multi_select", multi_select: values.map((name) => ({ name })) };
}

function dateProp() {
	return { type: "date", date: null };
}

function patchText(value: unknown): string {
	if (!value || typeof value !== "object") return String(value ?? "");
	const prop = value as Record<string, unknown>;
	const richText = prop.rich_text;
	if (Array.isArray(richText)) {
		return richText
			.map((item) => {
				if (!item || typeof item !== "object") return "";
				const record = item as Record<string, unknown>;
				const text = record.text;
				if (text && typeof text === "object") {
					const content = (text as Record<string, unknown>).content;
					if (typeof content === "string") return content;
				}
				const plainText = record.plain_text;
				return typeof plainText === "string" ? plainText : "";
			})
			.join("");
	}
	return JSON.stringify(value);
}

function testLandPage() {
	return {
		id: "moj-real-data-land-1",
		properties: {
			土地名称: titleProp("【実データ検証】串本町二色626 13,000坪"),
			所在地: richTextProp("和歌山県東牟婁郡串本町二色626"),
			"面積（坪）": numberProp(13000),
			緯度: numberProp(33.474),
			経度: numberProp(135.768),
			電力会社エリア: selectProp("関西電力"),
			入力根拠区分: richTextProp("二次資料"),
			対象一意性: richTextProp("候補複数。正本ページ未確定"),
			営業対象区分: selectProp("本番候補"),
			正本ページ: richTextProp("未確認"),
			処理ステータス: selectProp("未処理"),
			AIアクションバケット: selectProp("継続監視"),
			総合評価: selectProp("C"),
			AI総合スコア: numberProp(0),
			Aゾーン判断: selectProp("行かない"),
			Aゾーン判断理由: richTextProp(""),
			Aゾーン配点バージョン: richTextProp(""),
			Aゾーン内部スコア100: numberProp(0),
			Aゾーン内部スコア60: numberProp(0),
			Aゾーン内部採点内訳: richTextProp(""),
			Aゾーン取得元サマリー: richTextProp(""),
			Aゾーン人間回収項目: richTextProp(""),
			土地評価: selectProp("△"),
			"電力評価（仮説）": selectProp("△"),
			電力評価: selectProp("△"),
			AI案件種別: selectProp("未判定"),
			AI接道評価: selectProp("要確認"),
			AI補助金評価: selectProp("要確認"),
			需要評価: selectProp("不明"),
			案件化メモ: richTextProp(""),
			一次AI受付メモ: richTextProp(""),
			次アクション: richTextProp(""),
			資料回収状態: selectProp("未依頼"),
			資料回収の状況: multiSelectProp(),
			資料回収依頼: richTextProp(""),
			AI更新日時: dateProp(),
			Webhook引き継ぎステータス: selectProp("待機"),
			Webhook引き継ぎメモ: richTextProp(""),
			設計上の弱点: richTextProp(""),
		},
	};
}

async function main() {
	assert.equal(existsSync(realZipPath), true, `real ZIP not found: ${realZipPath}`);
	assert.equal(existsSync(realGeoJsonPath), true, `converted GeoJSON not found: ${realGeoJsonPath}`);
	const geoJsonText = readFileSync(realGeoJsonPath, "utf8");
	const geoJson = JSON.parse(geoJsonText) as {
		metadata?: Record<string, unknown>;
		features?: Array<{ properties?: Record<string, unknown> }>;
	};
	assert.equal(geoJson.metadata?.sourceZip, realZipPath);
	assert.equal(geoJson.metadata?.sourceZipSha256, realZipSha256);
	assert.equal(geoJson.metadata?.sourceXml, "30428-1704-55.xml");
	assert.match(String(geoJson.metadata?.sourceXmlSha256 ?? ""), /^[a-f0-9]{64}$/);
	assert.match(String(geoJson.metadata?.convertedAt ?? ""), /^20\d\d-\d\d-\d\dT/);
	assert.equal(geoJson.metadata?.featureCount, 13);
	const lots = (geoJson.features ?? []).map((feature) => String(feature.properties?.lotNumber ?? ""));
	assert.ok(lots.includes("626-1"));
	assert.ok(lots.includes("626-2"));
	assert.ok(lots.includes("626-14"));

	const updates: Array<Record<string, unknown>> = [];
	const page = testLandPage();
	const notion = {
		pages: {
			retrieve: async () => page,
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
		},
	};

	const originalEnv = {
		MOJ_CHIZU_GEOJSON_INLINE_JSON: process.env.MOJ_CHIZU_GEOJSON_INLINE_JSON,
		MOJ_CHIZU_GEOJSON_INLINE_BASE64: process.env.MOJ_CHIZU_GEOJSON_INLINE_BASE64,
		MOJ_CHIZU_GEOJSON_URL: process.env.MOJ_CHIZU_GEOJSON_URL,
		MOJ_CHIZU_GEOJSON_URLS: process.env.MOJ_CHIZU_GEOJSON_URLS,
		GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
		GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
		WAGRI_ACCESS_TOKEN: process.env.WAGRI_ACCESS_TOKEN,
		WAGRI_API_TOKEN: process.env.WAGRI_API_TOKEN,
		WAGRI_TOKEN: process.env.WAGRI_TOKEN,
		REINFOLIB_API_KEY: process.env.REINFOLIB_API_KEY,
		GSI_ROAD_TILE_ENABLED: process.env.GSI_ROAD_TILE_ENABLED,
		GRID_CAPACITY_PUBLIC_JSON_URL: process.env.GRID_CAPACITY_PUBLIC_JSON_URL,
		GRID_CAPACITY_PUBLIC_JSON_URLS: process.env.GRID_CAPACITY_PUBLIC_JSON_URLS,
	};
	const originalFetch = globalThis.fetch;
	try {
		process.env.MOJ_CHIZU_GEOJSON_INLINE_JSON = geoJsonText;
		delete process.env.MOJ_CHIZU_GEOJSON_INLINE_BASE64;
		delete process.env.MOJ_CHIZU_GEOJSON_URL;
		delete process.env.MOJ_CHIZU_GEOJSON_URLS;
		delete process.env.GOOGLE_MAPS_API_KEY;
		delete process.env.GOOGLE_API_KEY;
		delete process.env.WAGRI_ACCESS_TOKEN;
		delete process.env.WAGRI_API_TOKEN;
		delete process.env.WAGRI_TOKEN;
		delete process.env.REINFOLIB_API_KEY;
		process.env.GSI_ROAD_TILE_ENABLED = "0";
		delete process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
		delete process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
		globalThis.fetch = async () =>
			new Response(JSON.stringify({ elevation: 22.4, hsrc: "DEM" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});

		const result = await processLandEvaluationForTest(
			{ pageId: page.id, dryRun: false },
			notion as never,
		);
		assert.equal(result.aZoneDecision, "行く");
		assert.match(result.aZoneReason, /^GO理由:/);
		assert.equal(result.requiresInvestigation, true);

		const finalUpdate = updates.at(-1)?.properties as Record<string, unknown>;
		const memo = patchText(finalUpdate.案件化メモ);
		const sourceSummary = patchText(finalUpdate.Aゾーン取得元サマリー);
		const handoff = patchText(finalUpdate.Aゾーン人間回収項目);
		const bridge = patchText(finalUpdate.Webhook引き継ぎメモ);
		const combined = [memo, sourceSummary, handoff, bridge, result.aZoneReason].join("\n");
		assert.match(combined, /【Aが取得した事実】/);
		assert.match(combined, /法務省地図/);
		assert.match(combined, /実データ由来の地番・筆界候補/);
		assert.match(combined, /東牟婁郡串本町二色 626-1/);
		assert.match(combined, /東牟婁郡串本町二色 626-2/);
		assert.match(combined, /変換元ZIP=\/Users\/isibasidaisuke\/Downloads\/30428-1704-2025\/30428-1704-55\.zip/);
		assert.match(combined, /内包XML=30428-1704-55\.xml/);
		assert.match(combined, new RegExp(`ZIP_SHA256=${realZipSha256}`));
		assert.match(combined, /XML_SHA256=[a-f0-9]{64}/);
		assert.match(combined, /変換日時=20\d\d-\d\d-\d\dT/);
		assert.match(combined, /Worker取得日時=20\d\d-\d\d-\d\dT/);
		assert.match(combined, /証拠区分=二次資料/);
		assert.match(combined, /Bゾーン回収依頼/);

		const proof = {
			ok: true,
			verifiedAt: new Date().toISOString(),
			sourceZip: realZipPath,
			sourceZipSha256: realZipSha256,
			sourceXml: geoJson.metadata?.sourceXml,
			sourceXmlSha256: geoJson.metadata?.sourceXmlSha256,
			convertedAt: geoJson.metadata?.convertedAt,
			convertedGeoJson: realGeoJsonPath,
			featureCount: geoJson.metadata?.featureCount,
			lotCandidates: lots,
			worker: {
				pageId: page.id,
				action: result.action,
				aZoneDecision: result.aZoneDecision,
				requiresInvestigation: result.requiresInvestigation,
				investigationGaps: result.investigationGaps,
			},
			output: {
				aZoneReason: result.aZoneReason,
				sourceSummary,
				bZoneInstruction: handoff,
				webhookBridgeMemo: bridge,
				caseMemo: memo,
			},
		};
		mkdirSync(proofPath.replace(/\/[^/]+$/, ""), { recursive: true });
		writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
		console.log(JSON.stringify({
			ok: true,
			proofPath,
			sourceZip: realZipPath,
			sourceZipSha256: realZipSha256,
			sourceXml: geoJson.metadata?.sourceXml,
			sourceXmlSha256: geoJson.metadata?.sourceXmlSha256,
			convertedAt: geoJson.metadata?.convertedAt,
			featureCount: geoJson.metadata?.featureCount,
			lotCandidates: lots,
			aZoneDecision: result.aZoneDecision,
			action: result.action,
			requiresInvestigation: result.requiresInvestigation,
		}, null, 2));
	} finally {
		globalThis.fetch = originalFetch;
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
