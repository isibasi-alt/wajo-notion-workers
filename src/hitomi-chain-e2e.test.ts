// 一丁目一番地の見張り：実LLMで A→B→C→D→C→D→E→F の8工程が「完走する」ことを毎回守るE2Eテスト。
//   実行: npm run test:hitomi-chain-e2e
//   コスト: 実LLM 8呼び出し（約7〜8分）。大ちゃん承認済み（2026-06-26「8回呼んでくれていい」）。
//   守るもの：(1)callClaudeが8回呼ばれる (2)A〜Eが作業ページに全工程出る (3)Fが月次評価ページに出る。
//   どれか1つでも欠けたら assert で落ちる＝チェーンが壊れた瞬間に気づける。
import assert from "node:assert/strict";
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
import { runHitomiEvalChain, getCallClaudeCount } from "./hitomi-eval-chain";

function loadEnv(path: string){try{for(const l of readFileSync(path,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
loadEnv(".env"); loadEnv(".env.worker.local");
const notion = new Client({ auth: process.env.NOTION_API_TOKEN || process.env.NOTION_TOKEN });
const UID = "370d872b-594c-817a-8eb5-00025efeef7b"; // 検証用ダミー佐伯
const MARK = "【検証用ダミー｜佐伯】";
const PARENT = "3824d017-81e7-81ab-b189-ea7b593d7e7a";
const WORKLOG_DS = "d78b8698-219b-451f-88c9-2992a39754ed";
const M0 = "2026-06-01", M1 = "2026-07-01";
const text = (p: any): string => { if(!p) return ""; if(p.type==="title") return (p.title||[]).map((x:any)=>x.plain_text).join(""); if(p.type==="rich_text") return (p.rich_text||[]).map((x:any)=>x.plain_text).join(""); return ""; };
const txt = (p: any) => text(p).replace(/【検証用ダミー｜佐伯】/g,"").trim();
const sel = (p: any) => p?.select?.name || "";
const num = (p: any) => p?.type==="number"?p.number:p?.type==="formula"?p.formula?.number:p?.type==="rollup"?(p.rollup?.number??null):null;
async function q(ds: string, pp: string, dp: string, tp: string){ const r: any = await notion.dataSources.query({ data_source_id: ds, page_size: 50, filter: { and: [{ property: pp, people: { contains: UID } }, { property: dp, date: { on_or_after: M0 } }, { property: dp, date: { before: M1 } }] } }); return r.results.map((p:any)=>p.properties).filter((x:any)=>text(x[tp]).includes(MARK)); }
async function headings(pid: string){ const out: string[] = []; let c: string|undefined; do { const r: any = await notion.blocks.children.list({ block_id: pid, page_size: 100, start_cursor: c }); for(const b of r.results as any[]) if(b.type==="heading_2") out.push((b.heading_2?.rich_text??[]).map((t:any)=>t.plain_text??"").join("")); c = r.has_more ? r.next_cursor ?? undefined : undefined; } while(c); return out; }

(async () => {
  // 材料収集（佐伯の実ログ）
  const perf: any = (await notion.dataSources.query({ data_source_id: "e67ec5d5-90d3-4118-9788-976a6f5c94a1", page_size: 10, filter: { and: [{ property: "対象営業ユーザー", people: { contains: UID } }, { property: "開始日", date: { on_or_after: M0 } }, { property: "開始日", date: { before: M1 } }] } })).results.map((p:any)=>p.properties)[0] || {};
  const quant = `粗利実績${num(perf["実績粗利額（自動）"])}円/月次目標${num(perf["粗利目標（申請DB）"])}円、成約${num(perf["成約件数（自動）"])}件、商談${num(perf["商談件数（自動）"])}件、案件化${num(perf["案件化件数"])}件`;
  const deals = (await q("7838db8a-907a-4c61-b062-109f8278b2c9","担当営業ユーザー","商談日","商談名")).map((x:any)=>`・${txt(x["商談名"])}［${sel(x["商談結果"])}］${txt(x["商談概要"])}／FB:${txt(x["営業フィードバック"])}`).join("\n");
  const ones = (await q("6ad99df1-8ae7-47bd-a59b-236a6f0df521","対象営業ユーザー","面談日","面談名")).map((x:any)=>`・本人:${txt(x["本人の申告メモ"])}／上司:${txt(x["上司所見"])}／次:${txt(x["次アクション"])}`).join("\n");
  const contribs = (await q("f88056da-3052-418e-8cf4-e9b4197cd7ba","対象営業ユーザー","日付","貢献タイトル")).filter((x:any)=>sel(x["承認ステータス"])==="承認").map((x:any)=>`・${txt(x["貢献タイトル"])}［${sel(x["種別"])}］${txt(x["コメント"])}`).join("\n");
  const dailies = (await q("8f7489a5-47fe-4e0a-833b-ee21ab033ad5","担当営業ユーザー","日付","タイトル")).map((x:any)=>`・${txt(x["AI今日の要約"])}／躓:${txt(x["今日予定通りに行かなかったこと"])}`).join("\n");
  const speeches = (await q("86f5693c-db36-4356-aec1-210495f6032a","発言者","発言日時","発言タイトル")).map((x:any)=>`・[${sel(x["発言カテゴリ"])}] ${txt(x["発言内容"])}`).join("\n");
  const material = `対象者: 佐伯 亮太／対象月: 2026年6月／販売・関西南部\n【定量】${quant}\n【案件】\n${deals}\n【1on1】\n${ones}\n【営業貢献(承認済み)】\n${contribs}\n【日報】\n${dailies}\n【発言】\n${speeches}`;

  // 月次評価ページ(最終) と 作業ログDBレコード(裏) を本番webhookと同じ形で用意
  const evalPage: any = await notion.pages.create({ parent: { page_id: PARENT }, icon: { emoji: "🧪" }, properties: { title: [{ type: "text", text: { content: "【E2Eテスト】佐伯 月次評価 完走チェック" } }] } });
  const workPage: any = await notion.pages.create({ parent: { data_source_id: WORKLOG_DS }, properties: { Name: { title: [{ type: "text", text: { content: "【E2Eテスト】佐伯 A〜E作業ログ" } }] }, "対象月": { rich_text: [{ type: "text", text: { content: "2026-06" } }] }, "対象営業ユーザー": { people: [{ id: UID }] }, "月次評価ページ": { url: evalPage.url }, "ステータス": { select: { name: "処理中" } } } });
  const chunks: string[] = []; for(let i=0;i<material.length;i+=1800) chunks.push(material.slice(i,i+1800));
  await notion.blocks.children.append({ block_id: workPage.id, children: [{ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "自動収集データ（材料）" } }] } }, ...chunks.map(c=>({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: c } }] } }))] } as any);

  const before = getCallClaudeCount();
  console.log(`[e2e] チェーン実行（実LLM 8工程）... 評価ページ=${evalPage.url}`);
  const t0 = Date.now();
  await runHitomiEvalChain(notion as any, workPage.id, evalPage.id);
  console.log(`[e2e] 完走 ${Math.round((Date.now()-t0)/1000)}秒`);

  // ── 検証（どれか欠けたら落ちる）──
  const calls = getCallClaudeCount() - before;
  const workHeads = await headings(workPage.id);
  const finalHeads = await headings(evalPage.id);

  // (1) callClaude が ちょうど8回（A・B・C・D・C再・D再・E・F）
  assert.equal(calls, 8, `callClaude は8回呼ばれるべき。実際=${calls}回`);
  // (2) A〜E が作業ページに全工程出る
  for(const h of ["データ点検君（A）の結果","評価裏付け君（B）の結果","採点君（C）の結果","ツッコミ君（D）の結果","採点君（C）の再採点","ツッコミ君（D）の再確認","兆し発見君（E）の結果"]){
    assert.ok(workHeads.some(x=>x.includes(h)), `作業ページに「${h}」が無い＝この工程が出ていない`);
  }
  // (3) F が月次評価ページに出る／A〜Eは月次評価ページに混ざらない
  assert.ok(finalHeads.some(x=>x.includes("月次評価（人見）")), "月次評価ページにF「月次評価（人見）」が無い");
  assert.ok(!finalHeads.some(x=>x.includes("データ点検君")), "月次評価ページにA〜Eが混ざっている（分離失敗）");

  console.log(`[e2e] PASS ✅ callClaude=${calls}回／作業ページ見出し=${workHeads.length}／F出力あり／A〜E分離OK`);
})().catch((e) => { console.error("[e2e] FAIL ❌", String(e)); process.exit(1); });
