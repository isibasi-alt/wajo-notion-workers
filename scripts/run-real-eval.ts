// 本物の月次評価を1本出す：実在の営業マン(ISIBASIDAISUKE)の2026年6月ページに
// データ層で実データを流し込み→6体連鎖(A→F)を実走。
//   実行: node --import tsx scripts/run-real-eval.ts
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
import { runHitomiEvalChain } from "../src/hitomi-eval-chain";

function loadEnv(p: string) {
	try {
		for (const l of readFileSync(p, "utf8").split("\n")) {
			const m = l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
			if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
		}
	} catch {}
}
loadEnv(".env");
loadEnv(".env.worker.local");
if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY なし");
const notion = new Client({ auth: process.env.NOTION_API_TOKEN || process.env.NOTION_TOKEN! });

const PAGE = "3824d017-81e7-81ab-b189-ea7b593d7e7a"; // 2026年6月｜ISIBASIDAISUKE
const SALES_PERF = "e67ec5d5-90d3-4118-9788-976a6f5c94a1";
const ACTIVITY = "a58a107d-92e3-43f3-887d-5e3acf72e9ec";
const num = (p: any) =>
	p?.type === "number" ? p.number : p?.type === "formula" ? p.formula?.number ?? null : p?.type === "rollup" ? p.rollup?.number ?? null : null;
const yen = (n: number) => "¥" + Math.round(n).toLocaleString("ja-JP");

async function heads(): Promise<string[]> {
	const out: string[] = [];
	let c: string | undefined;
	do {
		const r = await notion.blocks.children.list({ block_id: PAGE, page_size: 100, start_cursor: c });
		for (const b of r.results as any[]) if (b.type === "heading_2") out.push((b.heading_2?.rich_text ?? []).map((t: any) => t.plain_text).join(""));
		c = r.has_more ? r.next_cursor ?? undefined : undefined;
	} while (c);
	return out;
}

(async () => {
	// ── データ層：実データを収集してページへ追記 ──
	const pg: any = await notion.pages.retrieve({ page_id: PAGE });
	const tu = pg.properties?.["対象営業ユーザー"]?.people ?? [];
	const name = tu.map((x: any) => x.name).join("、") || "(未設定)";
	const uid = tu[0]?.id;
	const monthStart = "2026-06-01", nextMonthStart = "2026-07-01", monthLabel = "2026/6";
	const lines: string[] = [`対象者: ${name}`, `対象月: ${monthLabel}`, ""];
	let perf: any;
	if (uid) {
		const res = await notion.dataSources.query({
			data_source_id: SALES_PERF, page_size: 10,
			filter: { and: [{ property: "対象営業ユーザー", people: { contains: uid } }, { property: "開始日", date: { on_or_after: monthStart } }, { property: "開始日", date: { before: nextMonthStart } }] },
		});
		perf = (res.results as any[]).find((p) => (p.properties?.["期間種別"]?.select?.name ?? p.properties?.["期間種別"]?.status?.name) === "月次") ?? res.results[0];
	}
	lines.push("【定量】営業パフォーマンス＝月次成績DB");
	if (!perf) lines.push("当月の月次成績レコードなし＝粗利・成約は保留候補。");
	else {
		const pp = perf.properties ?? {};
		const gross = num(pp["実績粗利額（自動）"]);
		const target = num(pp["粗利目標（申請DB）"]);
		const closings = (pp["関連成約"]?.relation ?? []).length;
		lines.push(`月次成績ページID: ${perf.id}`);
		lines.push(`実績粗利額（自動）: ${gross == null ? "（空＝保留候補）" : yen(gross)}`);
		lines.push(target == null ? "粗利目標: （未設定＝目標未確定→粗利は保留）" : `粗利目標（申請DB）: ${yen(target)}`);
		if (gross != null && target) lines.push(`粗利達成率（実績/目標）: ${Math.round((gross / target) * 100)}%`);
		lines.push(`関連成約 件数: ${closings} 件`);
		const act = await notion.dataSources.query({ data_source_id: ACTIVITY, page_size: 100, filter: { property: "関連営業パフォーマンス", relation: { contains: perf.id } } });
		lines.push("", "【活動】活動ログDB（当月成績に紐づくもの）", `紐づく活動ログ 件数: ${act.results.length}${act.has_more ? "+" : ""} 件`);
	}
	lines.push("", "【次段・未配線】ノルマ申請・日報・会議発言・1on1・ツール・ナレッジは各DBの人×月実フィルタ確認後に配線（現時点は未収集＝該当軸は保留候補）。");
	const body = lines.join("\n");
	const children: any[] = [{ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "自動収集データ（Workerが元DBから収集）" } }] } }];
	for (let i = 0; i < body.length; i += 1800) children.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: body.slice(i, i + 1800) || " " } }] } });
	await notion.blocks.children.append({ block_id: PAGE, children });
	console.log("[real] データ層追記OK:\n" + body);

	// ── 6体連鎖 ──
	const before = await heads();
	console.log(`[real] 連鎖前の見出し数: ${before.length}`);
	const t0 = Date.now();
	await runHitomiEvalChain(notion as any, PAGE);
	const after = await heads();
	console.log(`[real] 連鎖完了 (${Math.round((Date.now() - t0) / 1000)}秒) 見出し ${before.length}→${after.length}`);
	console.log("[real] 追記された見出し:");
	for (const h of after.slice(before.length)) console.log("   ・" + h);
	console.log(`[real] 評価ページ: https://www.notion.so/${PAGE.replace(/-/g, "")}`);
})().catch((e) => {
	console.error("[real] ERROR:", String(e).slice(0, 600));
	process.exit(1);
});
