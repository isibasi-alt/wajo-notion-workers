import assert from "node:assert/strict";
import {
	normalizeTdbProfileForTest as normalizeTdbProfile,
	fetchTdbProfileForTest as fetchTdbProfile,
} from "./index";

// fetchTdbProfile は CompanyInfo の name/website/address しか使わない。
// Page等の重い型は使わないので部分オブジェクトで代用する。
const company = (over: Partial<{ name: string; website: string; address: string }> = {}) =>
	({ name: "株式会社エコスタイル", website: "https://www.eco-st.co.jp/", address: "大阪府大阪市中央区", ...over } as unknown as Parameters<typeof fetchTdbProfile>[0]);

async function main() {
	// ---- normalizeTdbProfile ----

	// status=found・正常 → 全項目が型通りに入る
	const ok = normalizeTdbProfile({
		status: "found",
		企業評点: 51, 倒産確率Pct: 1.2,
		年商: "154億1千万円", 資本金: "1,541百万円", 従業員数: "406名",
		設立: "2004年10月5日", 業種: "太陽光発電", 代表者: "木下 公貴",
		法人番号: "1234567890123", 調査年月日: "2026-05-30", raw: "帳票テキスト",
	});
	assert.ok(ok, "found正常はTdbProfileを返す");
	assert.equal(ok.企業評点, 51);
	assert.equal(ok.倒産確率Pct, 1.2);
	assert.equal(ok.資本金, "1,541百万円");
	assert.equal(ok.代表者, "木下 公貴");
	assert.equal(ok.法人番号, "1234567890123");

	// status=not_found → null
	assert.equal(normalizeTdbProfile({ status: "not_found" }), null);

	// status=error → null
	assert.equal(normalizeTdbProfile({ status: "error", reason: "login_failed" }), null);

	// statusが無い → null
	assert.equal(normalizeTdbProfile({ 企業評点: 51 }), null);

	// オブジェクトでない → null
	assert.equal(normalizeTdbProfile(null), null);
	assert.equal(normalizeTdbProfile("found"), null);
	assert.equal(normalizeTdbProfile(123), null);

	// 評点が文字列(壊れ) → 評点だけnullに丸める。プロファイル自体は捨てない(他の事実は使える)
	const badScore = normalizeTdbProfile({
		status: "found", 企業評点: "51", 倒産確率Pct: null,
		年商: "100億", 資本金: "1億", 従業員数: "", 設立: "", 業種: "",
		代表者: "山田", 法人番号: "", 調査年月日: "", raw: "",
	});
	assert.ok(badScore, "評点が壊れててもプロファイルは返す");
	assert.equal(badScore.企業評点, null);
	assert.equal(badScore.年商, "100億");
	assert.equal(badScore.代表者, "山田");

	// 文字項目の欠損 → 空文字。前後空白はtrim
	const sparse = normalizeTdbProfile({ status: "found", 代表者: "  木下  " });
	assert.ok(sparse);
	assert.equal(sparse.企業評点, null);
	assert.equal(sparse.年商, "");
	assert.equal(sparse.代表者, "木下");
	assert.equal(sparse.raw, "");

	// ---- fetchTdbProfile ----

	const origFetch = globalThis.fetch;
	const origUrl = process.env.TDB_FETCHER_URL;
	const origToken = process.env.TDB_FETCHER_TOKEN;
	try {
		// TDB_FETCHER_URL 未設定 → fetchせず null(従来通り暫定与信にフォールバック)
		delete process.env.TDB_FETCHER_URL;
		let called = false;
		globalThis.fetch = (async () => { called = true; return new Response("{}"); }) as typeof fetch;
		assert.equal(await fetchTdbProfile(company()), null);
		assert.equal(called, false, "URL未設定ならfetchを呼ばない");

		// URL設定・found応答 → 正規化したTdbProfileを返す。企業名とヒントを送る
		process.env.TDB_FETCHER_URL = "http://mac-mini.local:8787/tdb";
		process.env.TDB_FETCHER_TOKEN = "secret";
		let sentBody: any = null;
		let sentAuth: string | null = null;
		globalThis.fetch = (async (_url: string, init: RequestInit) => {
			sentBody = JSON.parse(String(init.body));
			sentAuth = (init.headers as Record<string, string>).authorization;
			return {
				ok: true,
				json: async () => ({ status: "found", 企業評点: 51, 倒産確率Pct: 1.2, 代表者: "木下 公貴" }),
			} as Response;
		}) as typeof fetch;
		const got = await fetchTdbProfile(company({ name: "株式会社エコスタイル" }));
		assert.ok(got, "found応答でTdbProfileを返す");
		assert.equal(got.企業評点, 51);
		assert.equal(got.代表者, "木下 公貴");
		assert.equal(sentBody.企業名, "株式会社エコスタイル");
		assert.equal(sentBody.ヒント.website, "https://www.eco-st.co.jp/");
		assert.equal(sentAuth, "Bearer secret");

		// HTTPエラー(!res.ok) → null
		globalThis.fetch = (async () => ({ ok: false, json: async () => ({}) }) as Response) as typeof fetch;
		assert.equal(await fetchTdbProfile(company()), null);

		// fetchが例外 → null(取得部品が落ちてても本体は止めない)
		globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
		assert.equal(await fetchTdbProfile(company()), null);
	} finally {
		globalThis.fetch = origFetch;
		if (origUrl === undefined) delete process.env.TDB_FETCHER_URL; else process.env.TDB_FETCHER_URL = origUrl;
		if (origToken === undefined) delete process.env.TDB_FETCHER_TOKEN; else process.env.TDB_FETCHER_TOKEN = origToken;
	}

	console.log("OK tdb-fetcher");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
