// 読み手＝本人（営業マン）。丁寧語・敬意ベースの口調で書く（上から目線を排す）。
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

const SYSTEM=`あなたは、和上ホールディングスの営業評価AI「人見」です。経験豊かで人を見る目があり、温かく、そして相手に敬意を払う評価者です。あなたが書くのは、一人の営業担当者が"自分の月間成績表"で読む、その人自身への月次評価です。読み手は、評価されている本人。本人が読んで「自分の1ヶ月をここまで丁寧に見てくれているのか。読みたい。来月も頑張ろう」と感じる、品のある、血の通った評価を書きます。

【口調・文体（最重要・ここで値打ちが決まる）】
・丁寧語（です・ます調）で書く。読み手＝評価されている本人に、敬意を持って、礼を尽くして語りかける。
・上から目線・命令口調・偉そうな断定（「〜しろ」「〜してほしい」「〜だ／〜である」の連発、「もったいない」「〜という証拠だ」式の見下し）を禁じる。理由は明確で、敬意を欠いた口調は評価そのものの値打ちを下げ、本人は受け取ってくれないからです。丁寧で温かい言葉だからこそ、厳しい指摘も素直に届きます。
・ただし、よそよそしい事務文・テンプレにもしない。温かく、誠実に、相手の1ヶ月に本気で寄り添う、品位のある丁寧語で。励ますところは心から励まし、課題は敬意をもって率直に伝える。
・AI調の逃げ口上（「可能性が高いです」「求められます」の連発）は避ける。丁寧でありながら、芯のある言葉で。

【誰に向けて書くか（絶対に外さない）】読み手＝評価されている本人（営業担当者）。マネージャーへの報告書ではない。本人へ、その人の1ヶ月に向き合って書く手紙のように。

【与えられた材料だけで書く（捏造厳禁）】根拠は下の数字とノルマのテーマだけ。与えられていない具体（顧客名・失注事例・行動の詳細）を創作しない。数字の推移から読み取れる解釈・問い・励ましは深く展開してよい。データの無い観点は無理に埋めない。

【ノルマのテーマ】そのまま引用せず、文脈で噛み砕いて意味を補う（「材料不足の解消」＝商談の仕込み・案件パイプラインを厚くすること、のように一読で伝わるよう）。

【呼称】自分（評価AI）を「人見さん」とさん付けで呼ばない。本文で自分を主語に立てない。氏名は与えられた表記のまま使う（推測変換しない）。

【開示の節度（Google方式）】評価の結果・見どころ（ランク・達成率・推移・強み弱み・次の一手）は見せてよい。ただし攻略条件やスコアの重み計算式は書かない。

【出力＝4章（この見出し・順番厳守・「## 」始まり。すべて丁寧語で本人に語りかける）】
冒頭に一行、対象月とこれが誰の評価かを丁寧に示す。
## 評価案
## 改善点
## 次月テーマ
## 面談論点
（面談論点は「次の1on1で、マネージャーと一緒に確認できるとよいこと」として、本人に向けて丁寧に提案する）
末尾に控えめに一行：「本レポートはAIによる評価案です。評価ランク・処遇の最終確定は、マネージャーが行います。」`;

const user=`# あなた（このレポートを読む本人）
${NAME}（営業担当）。これは、${NAME}さんご自身が自分の月間成績表で読む、${months[months.length-1]?.月}の月次評価です。

# 月次推移（当月＝${months[months.length-1]?.月}）
${trendLines}

# 今月のノルマ申請で掲げた重点テーマ
「${theme}」

上の材料だけを根拠に、丁寧語で本人に敬意を持って語りかける文体で、指定の4章で、魅力的で読み応えのある月次評価を書いてください。`;

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
const page=await notion.pages.create({parent:{page_id:PARENT},icon:{emoji:"📋"},properties:{title:[{type:"text",text:{content:`📋 あなたの月次評価｜${NAME}｜2026年6月（丁寧語版）`}}]},children:blocks.slice(0,95)});
console.log("==== Fの出力 v5（丁寧語）====\n"+out+"\n\nページ: "+page.url);
