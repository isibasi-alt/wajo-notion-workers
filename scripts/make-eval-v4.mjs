// 読み手＝本人（営業マン）。本人が自分の月間成績表で読む評価。語りかける文体。
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

const er=await notion.dataSources.query({data_source_id:EVAL,page_size:50,filter:{property:"対象営業ユーザー",people:{contains:UID}}});
const months=er.results.map(p=>{const pp=p.properties||{};return {
  月:((pp["対象月"]?.rich_text||[]).map(x=>x.plain_text).join("")),
  ランク:(pp["評価ランク"]?.select?.name)||"-", 総合:num(pp["総合スコア"]), 定量:num(pp["定量スコア"]), 定性:num(pp["定性スコア"]),
  粗利:num(pp["実績粗利額"]), 達成率:num(pp["粗利達成率"]), 成約:num(pp["成約数"]), 商談:num(pp["商談数"]),
}}).filter(x=>x.月).sort((a,b)=>a.月.localeCompare(b.月));
const nr=await notion.dataSources.query({data_source_id:NORMA,page_size:30,filter:{property:"対象営業ユーザー",people:{contains:UID}}});
const juneNorma=nr.results.map(p=>p.properties||{}).find(pp=>(pp["対象期間"]?.date?.start||"").startsWith("2026-06")&&txt(pp["重点テーマ"]));
const theme=juneNorma?txt(juneNorma["重点テーマ"]):"（重点テーマ未記入）";
const trendLines=months.map(m=>`${m.月}: ランク${m.ランク} 総合${m.総合} 粗利${m.粗利!=null?Math.round(m.粗利/10000)+"万円":"-"} 達成率${m.達成率!=null?Math.round(m.達成率*100)+"%":"-"} 成約${m.成約}件 商談${m.商談}件（定量${m.定量}/定性${m.定性}）`).join("\n");

const SYSTEM=`あなたは、和上ホールディングスの営業評価AI「人見」です。経験豊かで人を見る目があり、温かくも鋭い。あなたが書くのは、一人の営業担当者が"自分の月間成績表"で読む、その人自身への月次評価です。読み手は、評価されている本人。本人が読んで「これは自分の1ヶ月だ、読みたい。なるほど、と腑に落ちる。来月もやってやろう」と感じる、血の通った評価を書きます。

【誰に向けて書くか（最重要・絶対に外さない）】
・読み手＝評価されている本人（営業担当者）。マネージャーへの報告書ではない。本人に直接語りかける文体で書く。
・三人称（「○○さんは…」）で突き放さない。一人の人間が、相手の1ヶ月に本気で向き合って書いた手紙のように、本人へ向けて書く。
・甘やかさない。事実は率直に。良い月は讃え、落ちた月は逃げずに直視し、しかし必ず次へ向かわせる。

【文章の格】自然で心が動く日本語。AI調・テンプレ・逃げ口上（「〜と読めます」「可能性が高いです」「求められます」の連発）を排す。言い切るところは言い切り、問うところは問う。数字は羅列で終わらせず、意味と物語に変える。読み応えのある分量で、各章しっかり具体に踏み込む（水増し・繰り返しはしない）。

【与えられた材料だけで書く（捏造厳禁）】根拠は下の数字とノルマのテーマだけ。与えられていない具体（顧客名・失注事例・行動の詳細）を創作しない。数字の推移から読み取れる解釈・問い・励ましは深く展開してよい。データの無い観点は無理に埋めない。

【ノルマのテーマ】そのまま引用せず、文脈で噛み砕いて意味を補う（「材料不足の解消」＝商談の仕込み・案件パイプラインを厚くすること、のように一読で伝わるよう）。

【呼称】自分（評価AI）を「人見さん」とさん付けで呼ばない。本文で自分を主語に立てない。氏名は与えられた表記のまま使う（推測変換しない）。

【開示の節度（Google方式）】評価の結果・見どころ（ランク・達成率・推移・強み弱み・次の一手）は見せてよい。ただし「何を何回やれば何点上がる」式の攻略条件や、スコアの重み計算式は書かない。

【出力＝4章（この見出し・順番厳守・「## 」始まり。すべて本人に語りかける文体で）】
冒頭に一行、対象月とこれが誰の評価かを軽く示す。
## 評価案
## 改善点
## 次月テーマ
## 面談論点
（面談論点は「次の1on1で、あなたがマネージャーと一緒に確認するとよいこと」として本人視点で書く）
末尾に控えめに一行：「これはAIによる評価案です。ランク・処遇の最終確定は、あなたのマネージャーが行います。」`;

const user=`# あなた（このレポートを読む本人）
${NAME}（営業担当）。これは、あなた自身が自分の月間成績表で読む、あなたの${months[months.length-1]?.月}の月次評価です。

# あなたの月次推移（当月＝${months[months.length-1]?.月}）
${trendLines}

# あなたが今月のノルマ申請で掲げた重点テーマ
「${theme}」

上の材料だけを根拠に、本人（あなた）に語りかける文体で、指定の4章で、魅力的で自然な、読み応えのある月次評価を書け。`;

const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4096,system:SYSTEM,messages:[{role:"user",content:user}]})});
const j=await res.json();
if(!res.ok){console.error("API",res.status,JSON.stringify(j).slice(0,400));process.exit(1);}
const out=(j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();

function rich(s){return [{type:"text",text:{content:s.replace(/\*\*/g,"").slice(0,1900)}}];}
const blocks=[];
for(const raw of out.split("\n")){const l=raw.trimEnd();if(!l.trim())continue;
  if(l.startsWith("## "))blocks.push({object:"block",type:"heading_2",heading_2:{rich_text:rich(l.slice(3))}});
  else if(l.startsWith("# "))blocks.push({object:"block",type:"heading_1",heading_1:{rich_text:rich(l.slice(2))}});
  else if(/^[-*]\s/.test(l))blocks.push({object:"block",type:"bulleted_list_item",bulleted_list_item:{rich_text:rich(l.replace(/^[-*]\s/,""))}});
  else if(/^\d+[.\)]\s/.test(l))blocks.push({object:"block",type:"numbered_list_item",numbered_list_item:{rich_text:rich(l.replace(/^\d+[.\)]\s/,""))}});
  else blocks.push({object:"block",type:"paragraph",paragraph:{rich_text:rich(l)}});
}
const page=await notion.pages.create({parent:{page_id:PARENT},icon:{emoji:"📋"},properties:{title:[{type:"text",text:{content:`📋 あなたの月次評価｜${NAME}｜2026年6月（本人が読む版）`}}]},children:blocks.slice(0,95)});
console.log("==== Fの出力 v4（本人宛て）====\n"+out+"\n\nページ: "+page.url);
