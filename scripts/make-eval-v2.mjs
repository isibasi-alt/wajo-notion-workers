// A→Fの「F」に、ライブで集めた材料（過去推移＋ノルマ）を食わせ、4機能込みの月次評価を生成。
// 4機能：①推移を踏まえる ②先月比の継続 ③ノルマからのコメント ④主語の明確化（人見さん→マネージャー／本人＝営業担当）
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const EVAL="cf6fc870-9c7b-4f98-a108-64a94d60c02d";
const NORMA="27df8a65-4729-4600-bfc1-59bb1c460e73";
const PARENT="3824d017-81e7-81ab-b189-ea7b593d7e7a";
const UID="b8d835b0-f874-452f-8e66-bb14af58aabd";
const NAME="ISIBASIDAISUKE";
const num=(p)=>p?.type==="number"?p.number:p?.type==="formula"?p.formula?.number:p?.type==="rollup"?p.rollup?.number:null;
const txt=(p)=>((p?.rich_text||[]).map(x=>x.plain_text).join(""));

// ① 過去〜当月の推移（月次評価DB）をライブ収集
const er=await notion.dataSources.query({data_source_id:EVAL,page_size:50,filter:{property:"対象営業ユーザー",people:{contains:UID}}});
const months=er.results.map(p=>{const pp=p.properties||{};return {
  月:((pp["対象月"]?.rich_text||[]).map(x=>x.plain_text).join("")),
  ランク:(pp["評価ランク"]?.select?.name)||"-", 総合:num(pp["総合スコア"]), 定量:num(pp["定量スコア"]), 定性:num(pp["定性スコア"]),
  粗利:num(pp["実績粗利額"]), 達成率:num(pp["粗利達成率"]), 成約:num(pp["成約数"]), 商談:num(pp["商談数"]),
}}).filter(x=>x.月).sort((a,b)=>a.月.localeCompare(b.月));

// ③ ノルマ申請（重点テーマ）をライブ収集（6月・重点テーマ入りを採用）
const nr=await notion.dataSources.query({data_source_id:NORMA,page_size:30,filter:{property:"対象営業ユーザー",people:{contains:UID}}});
const juneNorma=nr.results.map(p=>p.properties||{}).find(pp=>(pp["対象期間"]?.date?.start||"").startsWith("2026-06")&&txt(pp["重点テーマ"]));
const theme=juneNorma?txt(juneNorma["重点テーマ"]):"（重点テーマ未記入）";
const status=juneNorma?(juneNorma["進捗ステータス"]?.formula?.string||"-"):"-";

const trendLines=months.map(m=>`${m.月}: ランク${m.ランク} 総合${m.総合}（定量${m.定量}/定性${m.定性}） 粗利${m.粗利!=null?Math.round(m.粗利/10000)+"万":"-"} 達成率${m.達成率!=null?Math.round(m.達成率*100)+"%":"-"} 成約${m.成約} 商談${m.商談}`).join("\n");
const cur=months[months.length-1];

const PROMPT_F=`あなたは営業評価AI「人見さん」の発話点（統合エージェントF）です。人見さん＝A〜F評価体制“全体”のブランド人格であり、あなたはその“口”として月次評価レポートを出力します（あなた自身が人見さんそのものではなく、発話を担う一器官です）。
【宛先と主語：冒頭に必ず三者を明示し、本文でも徹底する】
・読み手＝対象営業担当者の「担当マネージャー」。
・評価の対象（本文でいう「本人」）＝対象営業担当者（氏名は与えられた表記のまま。推測・変換しない）。
・差出人＝人見さん（評価支援AI）。
・冒頭に必ず一行で：「宛先：（担当マネージャー）様／対象：△△さん（営業担当）／人見さんより」。
・「面談論点」は “あなた（マネージャー）が △△さん（本人）と1on1で話す論点” として書く。誰が誰と話すのか曖昧にしない。
【読み物であって部品ではない】内部符牒（エージェント名・内部引用・採点往復ログ・素点）は一切出さない。自然な文章で、温かく率直に。
【推移を必ず踏まえる（単月で語らない）】与えられた過去数ヶ月のランク・スコア・数字の推移を読み、「先月どうで、今月どう動いたか」を必ず語る。起伏があればその波にも触れる。
【ノルマから必ず語る】本人がノルマ申請で掲げた“重点テーマ”に対し、今月の結果がどうだったか（沿えたか・乖離したか）を必ずコメントする。
【誠実ルール】与えられたデータに基づく。無い観点は「データ未連携につき保留」。保留≠ゼロ。点数・ランク・処遇の最終確定は人間。本人コメント・マネージャーコメントは書かない（人間入力欄）。武勇伝を捏造しない。
【出力＝冒頭に宛先三者明示 → 次の4章のみ（順番厳守・各見出し「## 」始まり）】
## 評価案（推移＋今月＋ノルマ重点テーマとの整合を織り込んだ文章。スコア・ランクは現状値として提示し確定はしない）
## 改善点
## 次月テーマ
## 面談論点（マネージャーが本人と話す論点）
末尾に必ず一行：「これは人見さん（評価支援AI）の月次評価案です。点数・ランク・処遇の最終確定はグループ長／マネージャーが行います。」`;

const user=`# 対象営業担当者
${NAME}（営業担当）。担当マネージャー：サンプルのため氏名未設定（「担当マネージャー」と表記する）。

# 過去〜当月の推移（当月＝${cur?.月||"2026-06"}）
${trendLines}

# 本人のノルマ申請（当月）
重点テーマ：「${theme}」
進捗ステータス：${status}

上記だけを根拠に、4機能（推移を踏まえる／先月比の継続／ノルマ重点テーマへのコメント／主語の明確化）を満たした月次評価を、指定の4章で書け。`;

const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:3000,system:PROMPT_F,messages:[{role:"user",content:user}]})});
const j=await res.json();
if(!res.ok){console.error("API",res.status,JSON.stringify(j).slice(0,400));process.exit(1);}
const out=(j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();

function rich(s){return [{type:"text",text:{content:s.replace(/\*\*/g,"").slice(0,1900)}}];}
const blocks=[];
for(const raw of out.split("\n")){const l=raw.trimEnd();if(!l.trim())continue;
  if(l.startsWith("## "))blocks.push({object:"block",type:"heading_2",heading_2:{rich_text:rich(l.slice(3))}});
  else if(l.startsWith("# "))blocks.push({object:"block",type:"heading_1",heading_1:{rich_text:rich(l.slice(2))}});
  else if(/^[-*]\s/.test(l))blocks.push({object:"block",type:"bulleted_list_item",bulleted_list_item:{rich_text:rich(l.replace(/^[-*]\s/,""))}});
  else if(/^\d+\.\s/.test(l))blocks.push({object:"block",type:"numbered_list_item",numbered_list_item:{rich_text:rich(l.replace(/^\d+\.\s/,""))}});
  else blocks.push({object:"block",type:"paragraph",paragraph:{rich_text:rich(l)}});
}
const page=await notion.pages.create({parent:{page_id:PARENT},icon:{emoji:"📋"},properties:{title:[{type:"text",text:{content:`📋 月次評価レポート v2｜${NAME}｜2026年6月（推移＋ノルマ＋主語）`}}]},children:blocks.slice(0,95)});
console.log("==== 集めた推移 ====\n"+trendLines+"\n\n==== ノルマ重点テーマ ====\n"+theme+"\n");
console.log("==== Fの出力 v2 ====\n"+out+"\n");
console.log("ページ:",page.url);
