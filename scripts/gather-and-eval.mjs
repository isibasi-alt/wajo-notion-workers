import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const UID="b8d835b0-f874-452f-8e66-bb14af58aabd";
const M0="2026-06-01",M1="2026-07-01";
const txt=(p)=>((p?.rich_text||p?.title||[]).map(x=>x.plain_text).join("")).replace(/(.)\1{4,}/g,"$1").replace(/見せる(見える)?/g,m=>"").trim();
const num=(p)=>p?.type==="number"?p.number:p?.type==="formula"?p.formula?.number:p?.type==="rollup"?p.rollup?.number:null;
const isTest=(s)=>/テスト|削除可|Worker直結|サンプル/.test(s);
async function q(ds,pp,dp){try{const r=await notion.dataSources.query({data_source_id:ds,page_size:50,filter:{and:[{property:pp,people:{contains:UID}},{property:dp,date:{on_or_after:M0}},{property:dp,date:{before:M1}}]}});return r.results;}catch(e){return [];}}

// 定量＋推移（月次評価DB）＋ノルマ
const EV="cf6fc870-9c7b-4f98-a108-64a94d60c02d";
const ev=(await notion.dataSources.query({data_source_id:EV,page_size:50,filter:{property:"対象営業ユーザー",people:{contains:UID}}})).results
  .map(p=>{const x=p.properties||{};return{月:txt(x["対象月"]),総合:num(x["総合スコア"]),ランク:x["評価ランク"]?.select?.name,粗利:num(x["実績粗利額"]),達成率:num(x["粗利達成率"]),成約:num(x["成約数"]),商談:num(x["商談数"])};}).filter(z=>z.月).sort((a,b)=>a.月.localeCompare(b.月));
const cur=ev[ev.length-1]||{};
const nr=(await notion.dataSources.query({data_source_id:"27df8a65-4729-4600-bfc1-59bb1c460e73",page_size:30,filter:{property:"対象営業ユーザー",people:{contains:UID}}})).results.map(p=>p.properties||{}).find(x=>(x["対象期間"]?.date?.start||"").startsWith("2026-06")&&txt(x["重点テーマ"]));
const theme=nr?txt(nr["重点テーマ"]):"（未記入）";

// 案件
const deals=(await q("7838db8a-907a-4c61-b062-109f8278b2c9","担当営業ユーザー","商談日")).map(p=>p.properties||{}).filter(x=>!isTest(txt(x["商談名"]))).slice(0,5)
  .map(x=>`・${txt(x["商談名"])}｜成約:${(x["関連成約"]?.relation||[]).length?"有":"無"}｜概要:${txt(x["商談概要"]).slice(0,180)}｜改善:${txt(x["改善ポイント"]).slice(0,120)}｜営業FB:${txt(x["営業フィードバック"]).slice(0,160)}`).join("\n");
// ミーティング
const mtg=(await q("c22e58f6-42c9-4a2f-b24d-e65e889d59e9","担当営業ユーザー","ミーティング日")).map(p=>p.properties||{}).filter(x=>!isTest(txt(x["ミーティング名"]))).slice(0,3)
  .map(x=>`・${txt(x["ミーティング名"])}｜決定:${txt(x["決定事項"]).slice(0,100)}｜次回確認:${txt(x["次回確認事項"]).slice(0,80)}`).join("\n")||"（なし）";
// 営業貢献
const contrib=(await q("f88056da-3052-418e-8cf4-e9b4197cd7ba","対象営業ユーザー","日付")).map(p=>p.properties||{}).filter(x=>!isTest(txt(x["貢献タイトル"]))).slice(0,5)
  .map(x=>`・${txt(x["貢献タイトル"])}｜${txt(x["コメント"]).slice(0,120)}`).join("\n");
// 日報
const daily=(await q("8f7489a5-47fe-4e0a-833b-ee21ab033ad5","担当営業ユーザー","日付")).map(p=>p.properties||{}).slice(0,6)
  .map(x=>`・要約:${txt(x["AI今日の要約"]).slice(0,70)}｜心に残り:${txt(x["今日一番心に残り、今後に残したいこと"]).slice(0,70)}｜つまずき:${txt(x["今日予定通りに行かなかったこと"]).slice(0,70)}`).filter(s=>s.replace(/[・要約:心に残りつまずき：｜]/g,"").trim().length>5).join("\n");
// 発言
const speech=(await q("86f5693c-db36-4356-aec1-210495f6032a","発言者","発言日時")).map(p=>p.properties||{}).slice(0,4).map(x=>`・${txt(x["発言内容"]).slice(0,90)}`).join("\n");

const trend=ev.map(m=>`${m.月}: ランク${m.ランク} 総合${m.総合} 粗利${m.粗利!=null?Math.round(m.粗利/10000)+"万":"-"} 達成率${m.達成率!=null?Math.round(m.達成率*100)+"%":"-"} 成約${m.成約} 商談${m.商談}`).join("\n");

const SYSTEM=readFileSync("scripts/F-prompt-candidate.md","utf8")+`
【追加ガード】軸別の配点計算式は出さない（Google方式）。0・空の軸は保留としていれば実力0で弱みに数えない。A〜E等の符牒・エージェント名を出力に出さない。例文は記入例で語順固定しない。`;
const user=`対象社員名：ISIBASIDAISUKE／対象月：2026年6月

# C：軸別仮評価・総合スコア・仮ランク
総合${cur.総合}点・仮ランク${cur.ランク}。定量：粗利${cur.粗利!=null?Math.round(cur.粗利/10000)+"万":"-"}・達成率${cur.達成率!=null?Math.round(cur.達成率*100)+"%":"-"}・成約${cur.成約}・商談${cur.商談}。
# 推移（E変化シグナルの材料）
${trend}
# ノルマ重点テーマ（本人申告）
「${theme}」
# B：案件ログ（証拠）
${deals}
# B：ミーティング
${mtg}
# B：営業貢献ログ（ナレッジ／組織知）
${contrib}
# B：日報要点
${daily||"（抽出可能な内省記述が乏しい）"}
# B：会議発言
${speech||"（なし）"}

上の材料だけを根拠に、固定10枠の月次評価 判断シートを、各欄「変数→1〜3文の解釈」で書いてください。案件の具体・「あの場でより良かった一言」は第2・3・8欄の解釈に簡潔に。`;

const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4096,system:SYSTEM,messages:[{role:"user",content:user}]})});
const j=await res.json();
if(!res.ok){console.error("API",res.status,JSON.stringify(j).slice(0,300));process.exit(1);}
const o=(j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();
function rich(s){return [{type:"text",text:{content:s.replace(/\*\*/g,"").slice(0,1900)}}];}
const blk=[{object:"block",type:"callout",callout:{rich_text:[{type:"text",text:{content:"本物の実ログから生成（商談17・営業貢献15・日報30件等を実機収集）。"}}],icon:{emoji:"✅"},color:"green_background"}}];
for(const raw of o.split("\n")){const l=raw.trimEnd();if(!l.trim())continue;
  if(l.startsWith("## "))blk.push({object:"block",type:"heading_2",heading_2:{rich_text:rich(l.slice(3))}});
  else if(/^[-*]\s/.test(l))blk.push({object:"block",type:"bulleted_list_item",bulleted_list_item:{rich_text:rich(l.replace(/^[-*]\s/,""))}});
  else blk.push({object:"block",type:"paragraph",paragraph:{rich_text:rich(l)}});}
const page=await notion.pages.create({parent:{page_id:"3824d017-81e7-81ab-b189-ea7b593d7e7a"},icon:{emoji:"✅"},properties:{title:[{type:"text",text:{content:"【本番データ】月次評価 判断シート｜ISIBASIDAISUKE｜2026年6月"}}]},children:blk.slice(0,95)});
console.log("==== 集めた材料(要約) ====");
console.log("案件:\n"+deals+"\n\n営業貢献:\n"+contrib+"\n");
console.log("==== Fの出力（本物データ）====\n"+o+"\n\nページ: "+page.url);
