import { pathToFileURL } from "node:url";

const DEFAULT_ADDRESS = "岐阜県土岐市土岐津町";
const ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch";

function finish(code, payload) {
	console.log(JSON.stringify(payload, null, 2));
	process.exit(code);
}

export async function verifyGsiAddressSearchConnection({
	address,
	fetchImpl = fetch,
	timeoutMs = 12000,
} = {}) {
	const normalizedAddress = String(address || "").trim();
	if (!normalizedAddress) {
		return {
			ok: false,
			status: "bad-address",
			message: "住所を指定してください。",
			isCandidate: true,
		};
	}

	const url = new URL(ENDPOINT);
	url.searchParams.set("q", normalizedAddress);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetchImpl(url, { signal: controller.signal });
		if (!response.ok) {
			return {
				ok: false,
				status: "http-error",
				httpStatus: response.status,
				message: "国土地理院住所検索がHTTPエラーを返しました。",
				isCandidate: true,
			};
		}

		const body = await response.json();
		const first = Array.isArray(body)
			? body.find((item) => item && typeof item === "object")
			: null;
		const coordinates = Array.isArray(first?.geometry?.coordinates)
			? first.geometry.coordinates
			: [];
		const longitude = Number(coordinates[0]);
		const latitude = Number(coordinates[1]);
		const title =
			typeof first?.properties?.title === "string" ? first.properties.title.trim() : "";

		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			return {
				ok: false,
				status: "no-result",
				message: "住所候補の緯度経度を取得できませんでした。",
				isCandidate: true,
			};
		}

		return {
			ok: true,
			status: "connected",
			source: "国土地理院住所検索",
			queriedAddress: normalizedAddress,
			candidate: {
				title: title || "名称未取得",
				latitude,
				longitude,
			},
			isCandidate: true,
			caution: "住所候補であり、地番・筆界・正式所在地の確定結果ではありません。",
			verifiedAt: new Date().toISOString(),
		};
	} catch (error) {
		return {
			ok: false,
			status: "request-failed",
			message: String(error?.message || error),
			isCandidate: true,
		};
	} finally {
		clearTimeout(timeout);
	}
}

async function main() {
	const address = process.argv.slice(2).join(" ").trim() || DEFAULT_ADDRESS;
	const result = await verifyGsiAddressSearchConnection({ address });
	const exitCode = result.ok ? 0 : result.status === "bad-address" ? 2 : 1;
	finish(exitCode, result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
