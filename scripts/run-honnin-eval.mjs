// 営業マン本人（佐伯亮太）が読んで心が動く月次評価を本気で作る。グループ長向け事務でなく、本人宛ての血の通った評価。
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const UID="370d872b-594c-817a-8eb5-00025efeef7b";
const M0="2026-06-01",M1="2026-07-01";
const MARK="【検証用ダミー｜佐伯】";
const cleanName=(s)=>(s||"").replace(/【[^】]*】/g,"").trim();
const text=(p)=>{if(!p)return"";if(p.type==="title")return(p.title||[]).map(x=>x.plain_text).join("");if(p.type==="rich_text")return(p.rich_text||[]).map(x=>x.plain_text).join("");return"";};
const txt=(p)=>(text(p)||"").replace(/【検証用ダミー｜佐伯】/g,"").trim();
const sel=(p)=>p?.select?.name||"";
const num=(p)=>p?.type==="number"?p.number:p?.type==="formula"?p.formula?.number:p?.type==="rollup"?(p.rollup?.number??null):null;
async function q(ds,pp,dp,tp){try{const r=await notion.dataSources.query({data_source_id:ds,page_size:50,filter:{and:[{property:pp,people:{contains:UID}},{property:dp,date:{on_or_after:M0}},{property:dp,date:{before:M1}}]}});return r.results.map(p=>p.properties||{}).filter(x=>text(x[tp]).includes(MARK));}catch(e){return[];}}
const yen=(n)=>n==null?"-":Math.round(n/10000)+"万円";
const pct=(n)=>n==null?"-":Math.round(n*100)+"%";

const sr=await notion.dataSources.query({data_source_id:"f770bee6-fb52-46db-adc2-9bcca9e406e8",page_size:5,filter:{property:"Notionユーザー",people:{contains:UID}}});
const spp=sr.results[0]?.properties||{};
const NAME=cleanName(text(spp["氏名"]))||"佐伯 亮太";
const annualGross=num(spp["年間粗利目標"]);
const PERF="e67ec5d5-90d3-4118-9788-976a6f5c94a1";
const perf=(await notion.dataSources.query({data_source_id:PERF,page_size:10,filter:{and:[{property:"対象営業ユーザー",people:{contains:UID}},{property:"開始日",date:{on_or_after:M0}},{property:"開始日",date:{before:M1}}]}})).results.map(p=>p.properties)[0]||{};
const Q={粗利:num(perf["実績粗利額（自動）"]),粗利目標:num(perf["粗利目標（申請DB）"]),達成率:num(perf["粗利達成率（自動）"]),成約:num(perf["成約件数（自動）"]),成約目標:num(perf["成約件数目標（申請DB）"]),商談:num(perf["商談件数（自動）"]),商談目標:num(perf["商談件数目標（申請DB）"]),案件化:num(perf["案件化件数"])};
const nrm=(await notion.dataSources.query({data_source_id:"27df8a65-4729-4600-bfc1-59bb1c460e73",page_size:10,filter:{property:"対象営業ユーザー",people:{contains:UID}}})).results.map(p=>p.properties).find(x=>(x["対象期間"]?.date?.start||"").startsWith("2026-06"));
const theme=nrm?txt(nrm["重点テーマ"]):"（未記入）";
const deals=(await q("7838db8a-907a-4c61-b062-109f8278b2c9","担当営業ユーザー","商談日","商談名")).map(x=>`・${txt(x["商談名"])}［${sel(x["商談結果"])}/営業スコア${num(x["営業スコア"])??"-"}］${txt(x["商談概要"])}／改善:${txt(x["改善ポイント"])}／FB:${txt(x["営業フィードバック"])}`).join("\n");
const ones=(await q("6ad99df1-8ae7-47bd-a59b-236a6f0df521","対象営業ユーザー","面談日","面談名")).map(x=>`・本人:${txt(x["本人の申告メモ"])}／上司:${txt(x["上司所見"])}／次:${txt(x["次アクション"])}`).join("\n");
const contribs=(await q("f88056da-3052-418e-8cf4-e9b4197cd7ba","対象営業ユーザー","日付","貢献タイトル")).filter(x=>sel(x["承認ステータス"])==="承認").map(x=>`・${txt(x["貢献タイトル"])}［${sel(x["種別"])}/${sel(x["貢献インパクト"])}］${txt(x["コメント"])}`).join("\n");
const dailies=(await q("8f7489a5-47fe-4e0a-833b-ee21ab033ad5","担当営業ユーザー","日付","タイトル")).map(x=>`・[${sel(x["テンション"])}] ${txt(x["AI今日の要約"])}／心残し:${txt(x["今日一番心に残り、今後に残したいこと"])}／躓:${txt(x["今日予定通りに行かなかったこと"])}`).join("\n");
const speeches=(await q("86f5693c-db36-4356-aec1-210495f6032a","発言者","発言日時","発言タイトル")).map(x=>`・[${sel(x["発言カテゴリ"])}] ${txt(x["発言内容"])}`).join("\n");
const annualPace=annualGross?`年間目標${yen(annualGross)}＝月平均${yen(annualGross/12)}必要。今月${yen(Q.粗利)}`:"";

const SYSTEM=`あなたは和上ホールディングスの営業評価AI「人見」。経験豊かで人を見る目があり、温かくも鋭い。あなたが書くのは、営業担当・${NAME}さん本人が"自分の月間成績表"で読む、彼への月次評価です。読み手は評価される本人。本人が読んで「これは自分の1ヶ月だ。見られている。なるほど腑に落ちる。来月もやってやろう」と感じる、血の通った評価を書きます。

【誰に向けて書くか・絶対に外さない】
・読み手＝本人（${NAME}さん）。グループ長への報告書ではない。本人に直接語りかける。
・三人称で突き放さない。一人の人間が、相手の1ヶ月に本気で向き合って書いた手紙のように。
・甘やかさない。事実は率直に。良い月は讃え、課題は逃げず直視し、しかし必ず次へ向かわせる。

【血の通った言葉・最重要】
・数字を羅列で終わらせず、意味と物語に変える（ただし与えられたデータに紐づく範囲で。捏造・推測の断定は禁止）。
・案件の深掘り：田辺製作所・和歌山運送の成約は"何が効いたのか"、海南金属の失注は"どこが分かれ目だったか"を、その人の行動に踏み込んで書く。
・「あの場でより良かった一言」：海南金属の商談の、あの場面で、こう一言言えていれば、という具体を1つ。
・強みと弱みは同根：「価格を初手で出さず、価値を固めてから後出しする丁寧さ」が、田辺・和歌山では勝因に、海南では敗因になった。同じ一つの癖の表裏であることを、本人が腑に落ちるように書く。叱るのでなく、一段上の技術（案件の見極め）として示す。
・来月への一手：粘る勇気は十分ある。次は同じ強さで「引く判断・即決を取りにいく判断」を。

【禁止】占い・教科書通り・一般論・AI口調（「〜と読めます」「可能性が高いです」の連発）・点数に合わせた後付け・盛り。データと事実に紐づいた、本物の言葉だけ。届いていない観点は無理に埋めない。

【開示の節度】評価の見どころ（達成率・推移・強み弱み・次の一手）は見せてよい。ただし「何を何回やれば何点」式の攻略条件や配点計算式は書かない。

【文体】自然で心が動く日本語。各段落しっかり具体に踏み込む（水増し・繰り返しはしない）。見出しは付けてよいが事務的な番号枠にはしない。末尾に控えめに一行：「これはAIによる評価案です。ランク・処遇の最終確定は、あなたのマネージャーが行います。」`;

const user=`# あなた（このレポートを読む本人）
${NAME}（販売・関西南部）。これは、あなた自身が読む、あなたの2026年6月の月次評価です。

# 今月の数字
粗利 ${yen(Q.粗利)}（目標${yen(Q.粗利目標)}・達成率${pct(Q.達成率)}）／成約 ${Q.成約}件（目標${Q.成約目標}件）／商談 ${Q.商談}件（目標${Q.商談目標}件）／案件化 ${Q.案件化}件。${annualPace}

# あなたが今月のノルマで掲げた重点テーマ
「${theme}」

# 今月の案件（あなたの商談）
${deals}

# 1on1（マネージャーとの面談）
${ones}

# あなたのチームへの貢献（承認済み）
${contribs}

# あなたの日報から
${dailies}

# あなたの会議での発言
${speeches}

上の材料だけを根拠に、本人（あなた）に語りかける、血の通った月次評価を書いてください。`;

const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-opus-4-8",max_tokens:4096,system:SYSTEM,messages:[{role:"user",content:user}]})});
const j=await res.json(); if(!res.ok){console.error("API",res.status,JSON.stringify(j).slice(0,300));process.exit(1);}
const out=(j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();

function rich(s){return [{type:"text",text:{content:s.replace(/\*\*/g,"").slice(0,1900)}}];}
const blk=[{object:"block",type:"callout",callout:{rich_text:[{type:"text",text:{content:`${NAME}さん 本人が読む月次評価｜2026年6月（人見より）`}}],icon:{emoji:"✉️"},color:"blue_background"}}];
for(const raw of out.split("\n")){const l=raw.trimEnd();if(!l.trim())continue;
  if(l.startsWith("## "))blk.push({object:"block",type:"heading_2",heading_2:{rich_text:rich(l.slice(3))}});
  else if(l.startsWith("### "))blk.push({object:"block",type:"heading_3",heading_3:{rich_text:rich(l.slice(4))}});
  else if(/^[-*]\s/.test(l))blk.push({object:"block",type:"bulleted_list_item",bulleted_list_item:{rich_text:rich(l.replace(/^[-*]\s/,""))}});
  else blk.push({object:"block",type:"paragraph",paragraph:{rich_text:rich(l)}});}
const page=await notion.pages.create({parent:{page_id:"3824d017-81e7-81ab-b189-ea7b593d7e7a"},icon:{emoji:"✉️"},properties:{title:[{type:"text",text:{content:`${NAME}さんへ｜2026年6月の月次評価（本人が読む版）`}}]},children:blk.slice(0,95)});
console.log("====== 本人が読む月次評価（人見→佐伯さん）======\n");
console.log(out);
console.log("\nページ: "+page.url);
