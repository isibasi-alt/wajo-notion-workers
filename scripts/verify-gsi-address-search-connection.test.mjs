import assert from "node:assert/strict";

import { verifyGsiAddressSearchConnection } from "./verify-gsi-address-search-connection.mjs";

const calls = [];
const connected = await verifyGsiAddressSearchConnection({
	address: "岐阜県土岐市土岐津町",
	fetchImpl: async (input) => {
		calls.push(String(input));
		return new Response(
			JSON.stringify([
				{
					type: "Feature",
					geometry: { type: "Point", coordinates: [137.19249, 35.353012] },
					properties: { title: "岐阜県土岐市土岐津町高山" },
				},
			]),
			{ status: 200, headers: { "content-type": "application/json" } },
		);
	},
	timeoutMs: 1000,
});

assert.equal(connected.ok, true);
assert.equal(connected.status, "connected");
assert.equal(connected.source, "国土地理院住所検索");
assert.equal(connected.isCandidate, true);
assert.equal(connected.candidate.title, "岐阜県土岐市土岐津町高山");
assert.equal(connected.candidate.latitude, 35.353012);
assert.equal(connected.candidate.longitude, 137.19249);
assert.equal(calls.length, 1);
assert.match(calls[0], /^https:\/\/msearch\.gsi\.go\.jp\/address-search\/AddressSearch\?/);
assert.match(calls[0], /q=/);

const noResult = await verifyGsiAddressSearchConnection({
	address: "存在しない住所候補",
	fetchImpl: async () =>
		new Response(JSON.stringify([]), {
			status: 200,
			headers: { "content-type": "application/json" },
		}),
	timeoutMs: 1000,
});
assert.equal(noResult.ok, false);
assert.equal(noResult.status, "no-result");

const httpError = await verifyGsiAddressSearchConnection({
	address: "岐阜県土岐市土岐津町",
	fetchImpl: async () =>
		new Response(JSON.stringify({ error: "temporary" }), {
			status: 503,
			headers: { "content-type": "application/json" },
		}),
	timeoutMs: 1000,
});
assert.equal(httpError.ok, false);
assert.equal(httpError.status, "http-error");

const requestFailed = await verifyGsiAddressSearchConnection({
	address: "岐阜県土岐市土岐津町",
	fetchImpl: async () => {
		throw new Error("network down");
	},
	timeoutMs: 1000,
});
assert.equal(requestFailed.ok, false);
assert.equal(requestFailed.status, "request-failed");

const badAddress = await verifyGsiAddressSearchConnection({
	address: "",
	fetchImpl: async () => {
		throw new Error("must not fetch");
	},
	timeoutMs: 1000,
});
assert.equal(badAddress.ok, false);
assert.equal(badAddress.status, "bad-address");
