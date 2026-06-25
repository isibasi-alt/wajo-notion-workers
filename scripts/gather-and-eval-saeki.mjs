// 佐伯亮太のクリーン整合ダミーで評価を回す：C（採点）→F（10枠判断シート統合）。
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const UID="370d872b-594c-817a-8eb5-00025efeef7b";
const NAME="佐伯 亮太";
const M0="2026-06-01",M1="2026-07-01";
const MARK=/【検証用ダミー｜佐伯】/g;
const clean=(s)=>(s||"").replace(MARK,"").trim();
const txt=(p)=>clean(((p?.rich_text||p?.title||[]).map(x=>x.plain_text).join("")));
const sel=(p)=>p?.select?.name||"";
const num=(p)=>p?.type==="number"?p.number:p?.type==="formula"?p.formula?.number:p?.type==="rollup"?(p.rollup?.number??null):null;
// 佐伯アカウントには既存の他テストデータが紛れるため、自分のMARKER付きデータだけに絞る（100%クリーン化）
async function q(ds,pp,dp,tp){try{const r=await notion.dataSources.query({data_source_id:ds,page_size:50,filter:{and:[{property:pp,people:{contains:UID}},{property:dp,date:{on_or_after:M0}},{property:dp,date:{before:M1}}]}});return r.results.map(p=>p.properties||{}).filter(x=>((x[tp]?.title||[]).map(t=>t.plain_text).join("")).includes("【検証用ダミー｜佐伯】"));}catch(e){console.error("q err",pp,String(e).slice(0,80));return [];}}
const yen=(n)=>n==null?"-":Math.round(n/10000)+"万円";
const pct=(n)=>n==null?"-":Math.round(n*100)+"%";

// 定量（月次成績DB・自動集計）
const PERF="e67ec5d5-90d3-4118-9788-976a6f5c94a1";
const perfRows=(await notion.dataSources.query({data_source_id:PERF,page_size:10,filter:{and:[{property:"対象営業ユーザー",people:{contains:UID}},{property:"開始日",date:{on_or_after:M0}},{property:"開始日",date:{before:M1}}]}})).results;
const perf=perfRows.map(p=>p.properties)[0]||{};
const Q={
  粗利実績:num(perf["実績粗利額（自動）"]), 粗利目標:num(perf["粗利目標（申請DB）"]), 粗利達成率:num(perf["粗利達成率（自動）"]),
  成約:num(perf["成約件数（自動）"]), 成約目標:num(perf["成約件数目標（申請DB）"]),
  商談:num(perf["商談件数（自動）"]), 商談目標:num(perf["商談件数目標（申請DB）"]),
  売上:num(perf["実績売上額（自動）"]), 案件化:num(perf["案件化件数"]), 貢献数:num(perf["貢献ログ件数"]), 日報数:num(perf["日報提出数"]),
};

// ノルマ重点テーマ
const nrm=(await notion.dataSources.query({data_source_id:"27df8a65-4729-4600-bfc1-59bb1c460e73",page_size:10,filter:{property:"対象営業ユーザー",people:{contains:UID}}})).results.map(p=>p.properties).find(x=>(x["対象期間"]?.date?.start||"").startsWith("2026-06"));
const theme=nrm?txt(nrm["重点テーマ"]):"（未記入）";
const policy=nrm?txt(nrm["取り組み方針"]):"";

// 各ログ
const deals=(await q("7838db8a-907a-4c61-b062-109f8278b2c9","担当営業ユーザー","商談日","商談名"))
  .map(x=>`・${txt(x["商談名"])}［${sel(x["商談結果"])}／営業スコア${num(x["営業スコア"])??"-"}］概要:${txt(x["商談概要"])}／改善:${txt(x["改善ポイント"])}／FB:${txt(x["営業フィードバック"])}`).join("\n");
const mtgs=(await q("c22e58f6-42c9-4a2f-b24d-e65e889d59e9","担当営業ユーザー","ミーティング日","ミーティング名"))
  .map(x=>`・${txt(x["ミーティング名"])}：決定=${txt(x["決定事項"])}／次回=${txt(x["次回確認事項"])}／良かった点=${txt(x["良かった点"])}`).join("\n")||"（なし）";
const ones=(await q("6ad99df1-8ae7-47bd-a59b-236a6f0df521","対象営業ユーザー","面談日","面談名"))
  .map(x=>`・${txt(x["面談名"])}：本人申告=${txt(x["本人の申告メモ"])}／上司所見=${txt(x["上司所見"])}／次アクション=${txt(x["次アクション"])}`).join("\n")||"（なし）";
const contribs=(await q("f88056da-3052-418e-8cf4-e9b4197cd7ba","対象営業ユーザー","日付","貢献タイトル"))
  .map(x=>`・${txt(x["貢献タイトル"])}［${sel(x["種別"])}／インパクト${sel(x["貢献インパクト"])}］${txt(x["コメント"])}`).join("\n")||"（なし）";
const dailies=(await q("8f7489a5-47fe-4e0a-833b-ee21ab033ad5","担当営業ユーザー","日付","タイトル"))
  .map(x=>`・[${sel(x["テンション"])}] 要約:${txt(x["AI今日の要約"])}／心残し:${txt(x["今日一番心に残り、今後に残したいこと"])}／つまずき:${txt(x["今日予定通りに行かなかったこと"])}`).join("\n")||"（なし）";
const speeches=(await q("86f5693c-db36-4356-aec1-210495f6032a","発言者","発言日時","発言タイトル"))
  .map(x=>`・[${sel(x["発言カテゴリ"])}/重要度${sel(x["重要度"])}] ${txt(x["発言内容"])}`).join("\n")||"（なし）";

const quant=`粗利 実績${yen(Q.粗利実績)}／目標${yen(Q.粗利目標)}（達成率${pct(Q.粗利達成率)}）、成約 ${Q.成約}件/目標${Q.成約目標}件、商談 ${Q.商談}件/目標${Q.商談目標}件、案件化 ${Q.案件化}件、売上 ${yen(Q.売上)}、営業貢献 ${Q.貢献数}件、日報提出 ${Q.日報数}件`;

async function call(system,user){
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4096,system,messages:[{role:"user",content:user}]})});
  const j=await res.json(); if(!res.ok){console.error("API",res.status,JSON.stringify(j).slice(0,300));process.exit(1);}
  return (j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();
}

// ── C：採点 ──
const cSys=`あなたは和上の月次評価の採点AI（C）です。定量65％・定性35％の比重で、各軸を達成率と定性材料から仮採点します。出力は内部受け渡し用に簡潔に：定量スコア(0-65)、定性スコア(0-35)、総合スコア(0-100)、仮ランク(S/A/B/C/D)、各軸の一言根拠。根拠のない物語を作らず、与えられた数字と事実だけに即す。空欄軸は実力0でなく保留として扱う。`;
const cUsr=`対象：${NAME}／2026年6月／販売・関西南部
【定量（月次成績DB・自動集計）】${quant}
【定性材料（要約）】
会議発言:\n${speeches}\n1on1:\n${ones}\n営業貢献:\n${contribs}\n日報:\n${dailies}`;
const C=await call(cSys,cUsr);

// ── F：10枠判断シート ──
const fSys=readFileSync("scripts/F-prompt-candidate.md","utf8")+`
【追加ガード】軸別の配点計算式は出さない（Google方式）。0・空の軸は保留として弱みに数えない。A〜E等の符牒・エージェント名・「ダミー」等の語を出力に出さない。例文は記入例で語順固定しない。氏名は与えられた表記のまま使う。`;
const fUsr=`対象社員名：${NAME}／対象月：2026年6月（販売・関西南部）

# C：軸別仮評価・総合スコア・仮ランク
${C}

# ノルマ重点テーマ（本人申告）
「${theme}」／方針：${policy}

# B：案件ログ（証拠）
${deals}

# B：ミーティング（営業会議）
${mtgs}

# B：1on1（マネージャー面談）
${ones}

# B：営業貢献ログ（ナレッジ・組織知）
${contribs}

# B：日報要点
${dailies}

# B：会議発言
${speeches}

上の材料だけを根拠に、固定10枠の月次評価 判断シートを、各欄「変数→1〜3文の解釈」で書いてください。案件の具体・「あの場でより良かった一言」は第2・3・8欄の解釈に簡潔に収める。`;
const F=await call(fSys,fUsr);

// ── Notionページ化 ──
function rich(s){return [{type:"text",text:{content:s.replace(/\*\*/g,"").slice(0,1900)}}];}
const blk=[{object:"block",type:"callout",callout:{rich_text:[{type:"text",text:{content:"検証用ダミー（佐伯 亮太）の整合データから生成。数字は成約・商談・ノルマのrelation自動集計＝物語と完全一致。"}}],icon:{emoji:"🧪"},color:"blue_background"}}];
for(const raw of F.split("\n")){const l=raw.trimEnd();if(!l.trim())continue;
  if(l.startsWith("## "))blk.push({object:"block",type:"heading_2",heading_2:{rich_text:rich(l.slice(3))}});
  else if(l.startsWith("### "))blk.push({object:"block",type:"heading_3",heading_3:{rich_text:rich(l.slice(4))}});
  else if(/^[-*]\s/.test(l))blk.push({object:"block",type:"bulleted_list_item",bulleted_list_item:{rich_text:rich(l.replace(/^[-*]\s/,""))}});
  else blk.push({object:"block",type:"paragraph",paragraph:{rich_text:rich(l)}});}
const page=await notion.pages.create({parent:{page_id:"3824d017-81e7-81ab-b189-ea7b593d7e7a"},icon:{emoji:"🧪"},properties:{title:[{type:"text",text:{content:"【検証ダミー】月次評価 判断シート｜佐伯 亮太｜2026年6月"}}]},children:blk.slice(0,98)});

console.log("===== C（採点）=====\n"+C+"\n");
console.log("===== F（判断シート）=====\n"+F+"\n");
console.log("ページ: "+page.url);
