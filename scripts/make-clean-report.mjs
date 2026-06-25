// 実際に出た6月評価を「清書した提出用レポート」を独立した子ページとして作る。
// 提出面（人が読む1枚）と AI討議ログ（親ページの生ログ）を分離する実証。
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const PARENT="3824d017-81e7-81ab-b189-ea7b593d7e7a";

const H1=(t)=>({object:"block",type:"heading_1",heading_1:{rich_text:[{type:"text",text:{content:t}}]}});
const H2=(t)=>({object:"block",type:"heading_2",heading_2:{rich_text:[{type:"text",text:{content:t}}]}});
const P=(t)=>({object:"block",type:"paragraph",paragraph:{rich_text:[{type:"text",text:{content:t}}]}});
const BUL=(t)=>({object:"block",type:"bulleted_list_item",bulleted_list_item:{rich_text:[{type:"text",text:{content:t}}]}});
const NUM=(t)=>({object:"block",type:"numbered_list_item",numbered_list_item:{rich_text:[{type:"text",text:{content:t}}]}});
const DIV=()=>({object:"block",type:"divider",divider:{}});
const CALL=(t,emoji,color)=>({object:"block",type:"callout",callout:{rich_text:[{type:"text",text:{content:t}}],icon:{emoji},color}});

const children=[
  CALL("総合評価：保留（データ整備中）\n今月は評価に必要なデータの一部のみ連携済みのため、AIは総合スコアを確定せず保留としました。点数を捏造せず保留する設計です。確定している実績は下記の通り。","📊","gray_background"),
  H2("確定実績（2026年6月）"),
  BUL("実績粗利額：6,103万円（¥61,034,567）"),
  BUL("成約：9件"),
  BUL("粗利達成率（参考）：339%（目標1,800万円に対し）※ノルマ申請の承認確認待ちのため、正式採用は保留"),
  H2("軸サマリー"),
  BUL("粗利：実績あり／達成率は目標承認待ちで保留"),
  BUL("成約：9件（実績あり）"),
  BUL("案件化率・成約率：当月データ未連携のため保留"),
  BUL("ノルマ計画妥当性・会議発言・日報・1on1・ツール活用・ナレッジ：データ未連携のため保留"),
  H2("良かった点"),
  BUL("粗利6,103万円・成約9件という確定実績がある（保留＝ゼロではない）。"),
  H2("課題・確認事項（グループ長へ）"),
  NUM("ノルマ申請（目標額）の承認状況を確認 → 確認できれば粗利達成率が正式に採点可能になる。"),
  NUM("案件化・成約率・活動量データの連携（現状ほぼ未連携で多くの軸が保留）。"),
  NUM("成約9件に対し活動ログ1件 → 記録漏れの可能性を確認。"),
  H2("グループ長 記入欄"),
  P("評価ランク：__________"),
  P("コメント：__________"),
  DIV(),
  P("※本レポートはAI補助による評価案。最終確定はグループ長が行う。詳細なAI討議ログ（A〜F各エージェントの検証過程）は親ページを参照。"),
];

const page=await notion.pages.create({
  parent:{page_id:PARENT},
  icon:{emoji:"📋"},
  properties:{title:[{type:"text",text:{content:"📋 月次評価レポート｜ISIBASIDAISUKE｜2026年6月（提出用・清書）"}}]},
  children,
});
console.log("作成:",page.id);
console.log("URL:",page.url);
