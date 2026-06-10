import { pathToFileURL } from "node:url";

const DEFAULT_LATITUDE = 35.3556;
const DEFAULT_LONGITUDE = 137.1801;

function finish(code, payload) {
	console.log(JSON.stringify(payload, null, 2));
	process.exit(code);
}

export async function verifyFarmlandNaviConnection({
	token,
	latitude,
	longitude,
	fetchImpl = fetch,
	timeoutMs = 12000,
} = {}) {
	if (!token) {
		return {
			ok: false,
			status: "no-token",
			message: "WAGRI_ACCESS_TOKEN is not set. Farmland Navi/WAGRI is not connected yet.",
			requiredEnv: "WAGRI_ACCESS_TOKEN",
			tokenPrinted: false,
		};
	}

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return {
			ok: false,
			status: "bad-coordinate",
			message: "Latitude/longitude must be numeric.",
			tokenPrinted: false,
		};
	}

	const pin = await requestFarmlandPin({ token, latitude, longitude, fetchImpl, timeoutMs });
	if (!pin.ok) return pin;
	const fieldPolygon = await requestFieldPolygon({ token, latitude, longitude, fetchImpl, timeoutMs });
	if (!fieldPolygon.ok) return fieldPolygon;

	return {
		ok: true,
		status: "connected",
		source: "WAGRI farmland APIs",
		coordinate: { latitude, longitude },
		pin,
		fieldPolygon,
		tokenPrinted: false,
	};
}

async function requestFarmlandPin({ token, latitude, longitude, fetchImpl, timeoutMs }) {
	const delta = 0.0025;
	const url = new URL("https://api.wagri2.net/basic/farmland/AgriculturalLand/SearchByLongitudeLatitude");
	url.searchParams.set("minLatitude", String(latitude - delta));
	url.searchParams.set("maxLatitude", String(latitude + delta));
	url.searchParams.set("minLongitude", String(longitude - delta));
	url.searchParams.set("maxLongitude", String(longitude + delta));

	const responseResult = await fetchJson(url, token, fetchImpl, timeoutMs);
	if (!responseResult.ok) return { ...responseResult, endpoint: "farmland-pin" };
	if (!Array.isArray(responseResult.body)) {
		return {
			ok: false,
			status: "unexpected-response",
			endpoint: "farmland-pin",
			message: "WAGRI farmland pin API response was not an array.",
			tokenPrinted: false,
		};
	}

	const first = responseResult.body.find((item) => item && typeof item === "object") || null;
	return {
		ok: true,
		status: "connected",
		endpoint: "farmland-pin",
		source: "WAGRI AgriculturalLand SearchByLongitudeLatitude",
		count: responseResult.body.length,
		firstRecordSummary: first
			? {
					address: first.Address || "",
					landCategory: first.LandCategory || "",
					area: typeof first.Area === "number" ? first.Area : null,
					agriculturalClassification: first.AgriculturalVibrationMethodClassification || "",
					cityPlanningClassification: first.CityPlanningActClassification || "",
					jurisdictionAgricultureCommitteeName: first.JurisdictionAgricultureCommitteeName || "",
				}
			: null,
		tokenPrinted: false,
	};
}

async function requestFieldPolygon({ token, latitude, longitude, fetchImpl, timeoutMs }) {
	const url = new URL("https://api.wagri2.net/basic/farmland/FieldPolygonID3/Get");
	url.searchParams.set("lat", String(latitude));
	url.searchParams.set("lng", String(longitude));
	url.searchParams.set("cmp", "1");

	const responseResult = await fetchJson(url, token, fetchImpl, timeoutMs);
	if (!responseResult.ok) return { ...responseResult, endpoint: "field-polygon" };

	const count = countFieldPolygonFeatures(responseResult.body);
	if (count === null) {
		return {
			ok: false,
			status: "unexpected-response",
			endpoint: "field-polygon",
			message: "WAGRI field polygon API response was not parseable.",
			tokenPrinted: false,
		};
	}

	return {
		ok: true,
		status: "connected",
		endpoint: "field-polygon",
		source: "WAGRI FieldPolygonID3 Get",
		count,
		tokenPrinted: false,
	};
}

async function fetchJson(url, token, fetchImpl, timeoutMs) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchImpl(url, {
			headers: { "X-Authorization": token },
			signal: controller.signal,
		});
		const text = await response.text();
		let body = null;
		try {
			body = text ? JSON.parse(text) : null;
		} catch {
			return {
				ok: false,
				status: "unexpected-response",
				message: "WAGRI API response was not JSON.",
				tokenPrinted: false,
			};
		}

		if (!response.ok) {
			return {
				ok: false,
				status: "http-error",
				httpStatus: response.status,
				message: "WAGRI farmland API returned an error.",
				tokenPrinted: false,
			};
		}

		return { ok: true, body };
	} catch (error) {
		return {
			ok: false,
			status: "request-failed",
			message: String(error?.message || error),
			tokenPrinted: false,
		};
	} finally {
		clearTimeout(timeout);
	}
}

function countFieldPolygonFeatures(body) {
	if (Array.isArray(body)) return body.length;
	if (!body || typeof body !== "object") return null;
	if (Array.isArray(body.features)) return body.features.length;
	if (Array.isArray(body.Features)) return body.Features.length;
	if (body.type === "Feature" || body.Type === "Feature") return 1;
	return 0;
}

async function main() {
	const token = process.env.WAGRI_ACCESS_TOKEN || process.env.WAGRI_API_TOKEN || process.env.WAGRI_TOKEN || "";
	const latitude = Number(process.env.LATITUDE || process.argv[2] || String(DEFAULT_LATITUDE));
	const longitude = Number(process.env.LONGITUDE || process.argv[3] || String(DEFAULT_LONGITUDE));
	const result = await verifyFarmlandNaviConnection({
		token,
		latitude,
		longitude,
	});
	const exitCode = result.ok ? 0 : result.status === "no-token" || result.status === "bad-coordinate" ? 2 : 1;
	finish(exitCode, result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
