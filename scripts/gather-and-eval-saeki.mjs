// 佐伯亮太の整合ダミー＋2DBで C(採点)→F(10枠判断シート)→人見さん(第三者解説)。
// カンベイ＆Perplexity修正同梱：配点ログ化／貢献件数rollup固定／あの場の一言／案件名2件まで減量／データ品質疑義明記。
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const UID="370d872b-594c-817a-8eb5-00025efeef7b";
const M0="2026-06-01",M1="2026-07-01";
const MARK="【検証用ダミー｜佐伯】";
const clean=(s)=>(s||"").replace(/【検証用ダミー｜佐伯】/g,"").trim();
const cleanName=(s)=>(s||"").replace(/【[^】]*】/g,"").trim();
const text=(p)=>{if(!p)return"";if(p.type==="title")return(p.title||[]).map(x=>x.plain_text).join("");if(p.type==="rich_text")return(p.rich_text||[]).map(x=>x.plain_text).join("");return"";};
const txt=(p)=>clean(text(p));
const sel=(p)=>p?.select?.name||"";
const stat=(p)=>p?.status?.name||"";
const num=(p)=>p?.type==="number"?p.number:p?.type==="formula"?p.formula?.number:p?.type==="rollup"?(p.rollup?.number??null):null;
async function q(ds,pp,dp,tp){try{const r=await notion.dataSources.query({data_source_id:ds,page_size:50,filter:{and:[{property:pp,people:{contains:UID}},{property:dp,date:{on_or_after:M0}},{property:dp,date:{before:M1}}]}});return r.results.map(p=>p.properties||{}).filter(x=>text(x[tp]).includes(MARK));}catch(e){console.error("q err",pp,String(e).slice(0,80));return [];}}
const yen=(n)=>n==null?"-":Math.round(n/10000)+"万円";
const pct=(n)=>n==null?"-":Math.round(n*100)+"%";

// スタッフマスター（プロフィール）
const sr=await notion.dataSources.query({data_source_id:"f770bee6-fb52-46db-adc2-9bcca9e406e8",page_size:5,filter:{property:"Notionユーザー",people:{contains:UID}}});
const spp=sr.results[0]?.properties||{};
const NAME=cleanName(text(spp["氏名"]))||"佐伯 亮太";
const profile={役職:sel(spp["役職"]),部署:sel(spp["部署"]),評価タイプ:sel(spp["評価タイプ"]),エリア:txt(spp["担当エリア"]),在籍:sel(spp["在籍ステータス"]),
  年間粗利目標:num(spp["年間粗利目標"]),年間成約目標:num(spp["年間成約目標"]),"1on1回数":num(spp["1on1実施回数"]),マネ評価:num(spp["平均マネージャー評価スコア"])};

// チームトラッカー（担当タスクの段取り）
const tr=await notion.dataSources.query({data_source_id:"3b44d017-81e7-82c9-9f2d-87004c53d722",page_size:50,filter:{property:"タスク担当者",people:{contains:UID}}});
const myTasks=tr.results.map(p=>p.properties).filter(x=>text(x["タスク名"]).includes(MARK));
const taskLines=myTasks.map(x=>`・${txt(x["タスク名"])}［${stat(x["ステータス"])}／優先${sel(x["優先順位"])}］${txt(x["概要"])}`).join("\n")||"（担当タスクなし）";
const taskSummary=(()=>{const by={};for(const x of myTasks){const s=stat(x["ステータス"])||"未設定";by[s]=(by[s]||0)+1;}return Object.entries(by).map(([k,v])=>`${k}${v}件`).join("・")||"なし";})();

// 定量（月次成績DB・自動集計）
const PERF="e67ec5d5-90d3-4118-9788-976a6f5c94a1";
const perf=(await notion.dataSources.query({data_source_id:PERF,page_size:10,filter:{and:[{property:"対象営業ユーザー",people:{contains:UID}},{property:"開始日",date:{on_or_after:M0}},{property:"開始日",date:{before:M1}}]}})).results.map(p=>p.properties)[0]||{};
const Q={粗利実績:num(perf["実績粗利額（自動）"]),粗利目標:num(perf["粗利目標（申請DB）"]),粗利達成率:num(perf["粗利達成率（自動）"]),
  成約:num(perf["成約件数（自動）"]),成約目標:num(perf["成約件数目標（申請DB）"]),商談:num(perf["商談件数（自動）"]),商談目標:num(perf["商談件数目標（申請DB）"]),
  売上:num(perf["実績売上額（自動）"]),案件化:num(perf["案件化件数"]),案件化率:num(perf["月次案件化達成率（申請連動）"]),貢献数:num(perf["貢献ログ件数"]),日報数:num(perf["日報提出数"]),自動総合:num(perf["総合スコア（自動）"])};

// ノルマ
const nrm=(await notion.dataSources.query({data_source_id:"27df8a65-4729-4600-bfc1-59bb1c460e73",page_size:10,filter:{property:"対象営業ユーザー",people:{contains:UID}}})).results.map(p=>p.properties).find(x=>(x["対象期間"]?.date?.start||"").startsWith("2026-06"));
const theme=nrm?txt(nrm["重点テーマ"]):"（未記入）";

// 各ログ（MARKER絞り）
const dealRows=await q("7838db8a-907a-4c61-b062-109f8278b2c9","担当営業ユーザー","商談日","商談名");
const deals=dealRows.map(x=>`・${txt(x["商談名"])}［${sel(x["商談結果"])}／営業スコア${num(x["営業スコア"])??"-"}］概要:${txt(x["商談概要"])}／改善:${txt(x["改善ポイント"])}／FB:${txt(x["営業フィードバック"])}`).join("\n");
const mtgs=(await q("c22e58f6-42c9-4a2f-b24d-e65e889d59e9","担当営業ユーザー","ミーティング日","ミーティング名")).map(x=>`・${txt(x["ミーティング名"])}：決定=${txt(x["決定事項"])}／良かった点=${txt(x["良かった点"])}`).join("\n")||"（なし）";
const ones=(await q("6ad99df1-8ae7-47bd-a59b-236a6f0df521","対象営業ユーザー","面談日","面談名")).map(x=>`・${txt(x["面談名"])}：本人申告=${txt(x["本人の申告メモ"])}／上司所見=${txt(x["上司所見"])}／次アクション=${txt(x["次アクション"])}`).join("\n")||"（なし）";
const contribRows=(await q("f88056da-3052-418e-8cf4-e9b4197cd7ba","対象営業ユーザー","日付","貢献タイトル")).filter(x=>sel(x["承認ステータス"])==="承認"); // 未承認(申請中)は功績に数えない
const contribs=contribRows.map(x=>`・${txt(x["貢献タイトル"])}［${sel(x["種別"])}／インパクト${sel(x["貢献インパクト"])}］${txt(x["コメント"])}`).join("\n")||"（なし）";
const dailies=(await q("8f7489a5-47fe-4e0a-833b-ee21ab033ad5","担当営業ユーザー","日付","タイトル")).map(x=>`・[${sel(x["テンション"])}] 要約:${txt(x["AI今日の要約"])}／心残し:${txt(x["今日一番心に残り、今後に残したいこと"])}／つまずき:${txt(x["今日予定通りに行かなかったこと"])}`).join("\n")||"（なし）";
const speeches=(await q("86f5693c-db36-4356-aec1-210495f6032a","発言者","発言日時","発言タイトル")).map(x=>`・[${sel(x["発言カテゴリ"])}] ${txt(x["発言内容"])}`).join("\n")||"（なし）";

const dealCount=dealRows.length, contribCount=contribRows.length;
const annualPace=(Q.粗利実績!=null&&profile.年間粗利目標)?`年間粗利目標${yen(profile.年間粗利目標)}＝月平均${yen(profile.年間粗利目標/12)}必要、今月${yen(Q.粗利実績)}`:"年間目標データなし";
const quant=`粗利 実績${yen(Q.粗利実績)}／月次目標${yen(Q.粗利目標)}（達成率${pct(Q.粗利達成率)}）、成約 ${Q.成約}件/目標${Q.成約目標}件、商談 ${Q.商談}件/目標${Q.商談目標}件、案件化 ${Q.案件化}件（達成率${pct(Q.案件化率)}）、売上 ${yen(Q.売上)}、営業貢献 ${contribCount}件、日報提出 ${Q.日報数}件`;
const dataQuality=`平均マネージャー評価=${profile.マネ評価}（0〜100/0〜5系として値域外＝異常値の疑い・要確認）。月次成績の自動総合スコア=${Q.自動総合}（Notion側の自動採点は未計算＝Cの仮点とは別系統）。`;

async function call(system,user,model){
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:model||"claude-sonnet-4-6",max_tokens:4096,system,messages:[{role:"user",content:user}]})});
  const j=await res.json(); if(!res.ok){console.error("API",res.status,JSON.stringify(j).slice(0,300));process.exit(1);}
  return (j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();
}

// ── C：採点（配点を数式で明示＝再現可能ログ）──
const cSys=`あなたは和上の月次評価の採点AI（C）です。定量65％・定性35％。各軸の配点と計算過程を必ず数式で明示し再現可能にせよ（例：粗利＝達成率86%×配点35点≒30点）。総合・定量・定性・仮ランクを出す。【配点の出典】配点ウェイトは確定ルーブリック未整備のため"暫定の仮置き"である旨を必ず明記せよ（黙って確定値にしない）。【ランク確定保留】除外した異常値・未確定データがある場合、ランクは確定させず暫定幅(例:B〜A・確定保留)で示せ。根拠なき物語を作らず数字と事実だけ。空欄軸は実力0でなく保留。件数は与えられた値を勝手に増減しない。`;
const cUsr=`対象：${NAME}／2026年6月／${profile.役職}・${profile.評価タイプ}・${profile.エリア}
【定量（月次成績・自動集計）】${quant}（${annualPace}）
【データ品質メモ】${dataQuality}
【チーム文脈（担当タスク ${taskSummary}）】\n${taskLines}
【定性材料】会議発言:\n${speeches}\n1on1:\n${ones}\n営業貢献(${contribCount}件):\n${contribs}\n日報:\n${dailies}`;
const C=await call(cSys,cUsr);

// ── F：10枠判断シート（減量＋深掘り＋データ品質）──
const fSys=readFileSync("scripts/F-prompt-candidate.md","utf8")+`
【追加ガード】配点計算式は出さない（Google方式）。0・空の軸は保留として弱みに数えない。符牒・エージェント名・「ダミー」「占い」を出力に出さない。氏名は与えられた表記のまま。
【量の規律＝統合レポートは判断を速くする場所】案件名の列挙は寄与の大きい2件までを本文で扱い、残りは「他○件（状況）」と件数で圧縮する。価格提示/補助金/与信等の生の背景描写は最小限にし、評価に変換した表現（判断の質・営業行動の癖）で書く。商談${Q.商談}件は取りこぼさず件数を整合させる。
【深掘り＝見本バー】第8欄に「あの場でより良かった一言」を必ず1つ、失注した海南金属の商談場面に固定して紐づけて入れる（生成ごとに場面が揺れないよう海南に固定）。強みと弱みは同根（一つの癖の表裏）として言語化する。
【データ品質】第6欄に、与えられたデータ品質メモ（異常値・自動採点未計算）を必ず明記する。
【強み】案件化達成率が高い場合は第2欄の強みに含める。
【ランク確定保留】除外した異常値・未確定データがある間は仮ランクを確定値として断定せず「暫定(B〜A・確定保留)」と明記し、確定はデータ修正後にグループ長が行う旨を書く。
【配点】配点ウェイトは暫定の仮置きであり確定ルーブリックではない旨を最終コメントに一言添える。`;
const fUsr=`対象社員名：${NAME}／対象月：2026年6月（${profile.役職}・${profile.評価タイプ}・${profile.エリア}）

# 対象者プロフィール（スタッフマスター）
役職:${profile.役職}／部署:${profile.部署}／評価タイプ:${profile.評価タイプ}／担当エリア:${profile.エリア}／在籍:${profile.在籍}／${annualPace}（年間ペース参考）／年間成約目標:${profile.年間成約目標}件／1on1実施回数(通算):${profile["1on1回数"]}回

# データ品質メモ（第6欄で必ず触れる）
${dataQuality}

# C：軸別仮評価・総合スコア・仮ランク
${C}

# ノルマ重点テーマ（本人申告）
「${theme}」

# チーム文脈（担当タスク ${taskSummary}）
${taskLines}

# B：案件ログ（商談${dealCount}件・全件）
${deals}
# B：ミーティング
${mtgs}
# B：1on1
${ones}
# B：営業貢献ログ（${contribCount}件）
${contribs}
# B：日報要点
${dailies}
# B：会議発言
${speeches}

上の材料だけを根拠に、固定10枠の月次評価 判断シートを各欄「変数→1〜3文の解釈」で。案件背景は要約・変換し、深掘り（あの場でより良かった一言）は第8欄に。商談${Q.商談}件は件数整合を守る。`;
const F=await call(fUsr?fSys:fSys,fUsr);

// 人見さん等のキャラ演出は廃止（盛り排除）。判断シートのみ。

// ── Notionページ化（判断シート＋人見さんの所見）──
function rich(s){return [{type:"text",text:{content:s.replace(/\*\*/g,"").slice(0,1900)}}];}
const blk=[{object:"block",type:"callout",callout:{rich_text:[{type:"text",text:{content:`検証用ダミー（${NAME}）。整合データ＋2DB反映／カンベイ指摘修正(承認済み貢献のみ・ランク確定保留・配点は暫定仮置き)。`}}],icon:{emoji:"🧪"},color:"blue_background"}}];
const full=F;
for(const raw of full.split("\n")){const l=raw.trimEnd();if(!l.trim())continue;
  if(l==="---")blk.push({object:"block",type:"divider",divider:{}});
  else if(l.startsWith("## "))blk.push({object:"block",type:"heading_2",heading_2:{rich_text:rich(l.slice(3))}});
  else if(l.startsWith("### "))blk.push({object:"block",type:"heading_3",heading_3:{rich_text:rich(l.slice(4))}});
  else if(/^[-*]\s/.test(l))blk.push({object:"block",type:"bulleted_list_item",bulleted_list_item:{rich_text:rich(l.replace(/^[-*]\s/,""))}});
  else blk.push({object:"block",type:"paragraph",paragraph:{rich_text:rich(l)}});}
const page=await notion.pages.create({parent:{page_id:"3824d017-81e7-81ab-b189-ea7b593d7e7a"},icon:{emoji:"🧭"},properties:{title:[{type:"text",text:{content:`月次評価 判断シート｜${NAME}｜2026年6月`}}]},children:blk.slice(0,98)});

console.log("==== 件数整合 ====");
console.log(`商談${dealCount}件 / 営業貢献${contribCount}件 / rollup貢献ログ件数${Q.貢献数} / 案件化${Q.案件化}(達成率${pct(Q.案件化率)}) / 自動総合スコア${Q.自動総合}`);
console.log("\n==== C（配点ログ）====\n"+C+"\n");
console.log("==== F（判断シート）====\n"+F+"\n");

console.log("ページ: "+page.url);
