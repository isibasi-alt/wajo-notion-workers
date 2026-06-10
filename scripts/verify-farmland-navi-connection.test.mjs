import assert from "node:assert/strict";

import { verifyFarmlandNaviConnection } from "./verify-farmland-navi-connection.mjs";

const calls = [];
const fakeFetch = async (input, init = {}) => {
	const url = String(input);
	calls.push({ url, headers: init.headers || {} });
	if (url.includes("/farmland/AgriculturalLand/SearchByLongitudeLatitude")) {
		return new Response(
			JSON.stringify([
				{
					Address: "岐阜県土岐市土岐津町字テスト123",
					LandCategory: "田",
					Area: 6100,
					AgriculturalVibrationMethodClassification: "農業振興地域内・農用地区域内",
					CityPlanningActClassification: "市街化調整区域",
					JurisdictionAgricultureCommitteeName: "土岐市農業委員会",
				},
			]),
			{ status: 200, headers: { "content-type": "application/json" } },
		);
	}
	if (url.includes("/farmland/FieldPolygonID3/Get")) {
		return new Response(
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						type: "Feature",
						geometry: { type: "Polygon", coordinates: [] },
						properties: { FieldPolygonId: "WAGRI-FP-123", Area: 6120 },
					},
				],
			}),
			{ status: 200, headers: { "content-type": "application/json" } },
		);
	}
	return new Response("{}", { status: 404 });
};

const result = await verifyFarmlandNaviConnection({
	token: "test-token",
	latitude: 35.3556,
	longitude: 137.1801,
	fetchImpl: fakeFetch,
	timeoutMs: 1000,
});

assert.equal(result.ok, true);
assert.equal(result.status, "connected");
assert.equal(result.tokenPrinted, false);
assert.equal(result.pin.count, 1);
assert.equal(result.fieldPolygon.count, 1);
assert.match(result.pin.source, /AgriculturalLand SearchByLongitudeLatitude/);
assert.match(result.fieldPolygon.source, /FieldPolygonID3 Get/);
assert.equal(calls.length, 2);
assert.ok(
	calls.some(
		(call) =>
			call.url.startsWith("https://api.wagri2.net/basic/farmland/AgriculturalLand/SearchByLongitudeLatitude?") &&
			call.url.includes("minLatitude=") &&
			call.url.includes("maxLatitude=") &&
			call.url.includes("minLongitude=") &&
			call.url.includes("maxLongitude="),
	),
);
assert.ok(
	calls.some(
		(call) =>
			call.url.startsWith("https://api.wagri2.net/basic/farmland/FieldPolygonID3/Get?") &&
			call.url.includes("lat=35.3556") &&
			call.url.includes("lng=137.1801") &&
			call.url.includes("cmp=1"),
	),
);
assert.deepEqual(
	calls.map((call) => call.headers["X-Authorization"]),
	["test-token", "test-token"],
);

const noToken = await verifyFarmlandNaviConnection({
	token: "",
	latitude: 35.3556,
	longitude: 137.1801,
	fetchImpl: fakeFetch,
	timeoutMs: 1000,
});
assert.equal(noToken.ok, false);
assert.equal(noToken.status, "no-token");
assert.equal(noToken.tokenPrinted, false);

const badPolygon = await verifyFarmlandNaviConnection({
	token: "test-token",
	latitude: 35.3556,
	longitude: 137.1801,
	fetchImpl: async (input, init = {}) => {
		const url = String(input);
		if (url.includes("/farmland/AgriculturalLand/SearchByLongitudeLatitude")) {
			return fakeFetch(input, init);
		}
		return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
	},
	timeoutMs: 1000,
});
assert.equal(badPolygon.ok, false);
assert.equal(badPolygon.status, "http-error");
assert.equal(badPolygon.endpoint, "field-polygon");
