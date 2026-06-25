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
const months=er.results.map(p=>{const pp=p.properties||{};return {月:((pp["対象月"]?.rich_text||[]).map(x=>x.plain_text).join("")),ランク:(pp["評価ランク"]?.select?.name)||"-",総合:num(pp["総合スコア"]),定量:num(pp["定量スコア"]),定性:num(pp["定性スコア"]),粗利:num(pp["実績粗利額"]),達成率:num(pp["粗利達成率"]),成約:num(pp["成約数"]),商談:num(pp["商談数"])};}).filter(x=>x.月).sort((a,b)=>a.月.localeCompare(b.月));
const nr=await notion.dataSources.query({data_source_id:NORMA,page_size:30,filter:{property:"対象営業ユーザー",people:{contains:UID}}});
const jn=nr.results.map(p=>p.properties||{}).find(pp=>(pp["対象期間"]?.date?.start||"").startsWith("2026-06")&&txt(pp["重点テーマ"]));
const theme=jn?txt(jn["重点テーマ"]):"（重点テーマ未記入）";
const trend=months.map(m=>`${m.月}: ランク${m.ランク} 総合${m.総合} 粗利${m.粗利!=null?Math.round(m.粗利/10000)+"万円":"-"} 達成率${m.達成率!=null?Math.round(m.達成率*100)+"%":"-"} 成約${m.成約}件 商談${m.商談}件（定量${m.定量}/定性${m.定性}）`).join("\n");

const SYSTEM=`あなたは、和上ホールディングスの営業評価AI「人見」です。あなたが書く月次評価は、マネージャーが「承認するかどうか」を確認するだけで、文章はそのまま本人へ届きます。誰も文体を直しません。ですから、あなたの出力は下書きではなく、そのまま本人が読む「完成した評価」でなければなりません。一度で、最終形で、過不足なく書いてください。

【読み手と文体（最重要）】
・最終的にこの評価を読むのは、評価される本人（営業担当者）です。
・文体は丁寧語（です・ます）で統一します。落ち着いた、品位のある評価の言葉で。
・馴れ馴れしい「あなた」の連呼も、突き放した第三者報告調（「〇〇氏は〜である」）も避けます。一人の働き手の1ヶ月に敬意をもって向き合う、人事評価としての言葉で書いてください。
・気取った言い回し・意味の取りにくい曖昧表現・AIっぽいテンプレ（「〜と読めます」「可能性が高いです」「〜が求められます」の連発）を使いません。数字はただ並べず、意味づけして語ります。

【捏造厳禁】根拠は下に与える数字とノルマの重点テーマだけです。与えられていない具体（顧客名・失注事例など）を作りません。データの無い観点は無理に埋めません。

【分量】月に一度の評価にふさわしい読み応え。各章をしっかり書きます（水増し・繰り返しはしません）。

【出力＝4章（「## 」始まり・順番厳守）。冒頭に一行、対象者名と対象月を示します】
## 評価
## 改善点
## 来月のテーマ
## 面談で扱うこと
末尾に一行：「本評価は人見（評価支援AI）が作成し、マネージャーの確認を経て確定します。」`;

const user=`対象者：${NAME}（営業担当）／対象月：${months[months.length-1]?.月}\n\n# 月次の推移（当月＝${months[months.length-1]?.月}）\n${trend}\n\n# 本人が今月のノルマ申請で掲げた重点テーマ\n「${theme}」\n\n上の材料だけを根拠に、丁寧語で、そのまま本人に届く「完成した月次評価」を、指定の4章で書いてください。`;

const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4096,system:SYSTEM,messages:[{role:"user",content:user}]})});
const j=await res.json();
if(!res.ok){console.error("API",res.status,JSON.stringify(j).slice(0,400));process.exit(1);}
const out=(j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();
function rich(s){return [{type:"text",text:{content:s.replace(/\*\*/g,"").slice(0,1900)}}];}
const blocks=[];
for(const raw of out.split("\n")){const l=raw.trimEnd();if(!l.trim())continue;
  if(l.startsWith("## "))blocks.push({object:"block",type:"heading_2",heading_2:{rich_text:rich(l.slice(3))}});
  else if(/^[-*]\s/.test(l))blocks.push({object:"block",type:"bulleted_list_item",bulleted_list_item:{rich_text:rich(l.replace(/^[-*]\s/,""))}});
  else if(/^\d+[.\)]\s/.test(l))blocks.push({object:"block",type:"numbered_list_item",numbered_list_item:{rich_text:rich(l.replace(/^\d+[.\)]\s/,""))}});
  else blocks.push({object:"block",type:"paragraph",paragraph:{rich_text:rich(l)}});}
const page=await notion.pages.create({parent:{page_id:PARENT},icon:{emoji:"📋"},properties:{title:[{type:"text",text:{content:`月次評価｜${NAME}｜2026年6月`}}]},children:blocks.slice(0,95)});
console.log(out+"\n\nページ: "+page.url);
