#!/usr/bin/env node
// ============================================================================
// データ層プロパティ照合プローブ（読み取り専用・書き込み無し・Anthropic不使用）
// ----------------------------------------------------------------------------
// gatherHitomiSourceData が使う「検証済みのつもり」のプロパティ名が、
// 本物のNotionスキーマに実在するかをライブで照合する。NG が出たら捏造＝即直す。
//   使い方: node scripts/probe-hitomi-datalayer.mjs
//   鍵は .env / .env.worker.local から読む（値は一切出力しない）。
// ============================================================================
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";

function loadEnv(path) {
	try {
		for (const line of readFileSync(path, "utf8").split("\n")) {
			const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
			if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
		}
	} catch {}
}
loadEnv(".env");
loadEnv(".env.worker.local");

const token = process.env.NOTION_API_TOKEN || process.env.NOTION_TOKEN;
if (!token) {
	console.error("NOTION_API_TOKEN が見つかりません。");
	process.exit(2);
}
const notion = new Client({ auth: token });

const SALES_PERF = "e67ec5d5-90d3-4118-9788-976a6f5c94a1";
const ACTIVITY = "a58a107d-92e3-43f3-887d-5e3acf72e9ec";
const TEST_PAGE = "3874d017-81e7-81f2-9a35-c86f1f3da150";

const needPerf = [
	"対象営業ユーザー",
	"開始日",
	"終了日",
	"期間種別",
	"実績粗利額（自動）",
	"粗利目標",
	"関連成約",
];

function check(propNames, need) {
	for (const n of need) console.log(`  ${propNames.includes(n) ? "OK " : "NG "} ${n}`);
}

try {
	const perf = await notion.dataSources.retrieve({ data_source_id: SALES_PERF });
	const perfProps = Object.keys(perf.properties ?? {});
	console.log("■ 営業パフォーマンスDB プロパティ実在チェック:");
	check(perfProps, needPerf);
	console.log(
		`  （任意の粗利目標代替の実在: 粗利目標（申請DB）=${perfProps.includes("粗利目標（申請DB）") ? "有" : "無"} / 目標粗利額=${perfProps.includes("目標粗利額") ? "有" : "無"}）`,
	);

	const act = await notion.dataSources.retrieve({ data_source_id: ACTIVITY });
	const actProps = Object.keys(act.properties ?? {});
	console.log("■ 活動ログDB プロパティ実在チェック:");
	check(actProps, ["関連営業パフォーマンス"]);

	const pg = await notion.pages.retrieve({ page_id: TEST_PAGE });
	const tu = pg.properties?.["対象営業ユーザー"];
	const people = tu?.people ?? [];
	console.log("■ テストページ（評価太郎）対象営業ユーザー:");
	console.log(
		`  ${people.length ? people.map((p) => `${p.name ?? "(名前なし)"}=${p.id}`).join(", ") : "（未設定）"}`,
	);

	// 実在する対象者がいれば、当月の月次成績を実フィルタで引けるか試す（読み取りのみ）
	if (people.length) {
		const now = new Date();
		const jst = new Date(now.getTime() + 9 * 3600 * 1000);
		const y = jst.getUTCFullYear();
		const m = jst.getUTCMonth() + 1;
		const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
		const nm = m === 12 ? 1 : m + 1;
		const ny = m === 12 ? y + 1 : y;
		const nextMonthStart = `${ny}-${String(nm).padStart(2, "0")}-01`;
		const res = await notion.dataSources.query({
			data_source_id: SALES_PERF,
			page_size: 5,
			filter: {
				and: [
					{ property: "対象営業ユーザー", people: { contains: people[0].id } },
					{ property: "開始日", date: { on_or_after: monthStart } },
					{ property: "開始日", date: { before: nextMonthStart } },
				],
			},
		});
		console.log(`■ 当月(${monthStart}〜)の月次成績ヒット件数: ${res.results.length}`);
	}
	console.log("DONE");
} catch (e) {
	console.error("PROBE ERROR:", String(e).slice(0, 400));
	process.exit(1);
}
