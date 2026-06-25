// 材料は揃っている。やることは「魅力的な文章に装飾する」だけ。
// v2の欠点を全部潰す：①不自然な日本語→生きた文章 ②量不足→読み応え ③意味不明/自分をさん付け→噛み砕き＋呼称修正
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
const trendLines=months.map(m=>`${m.月}: ランク${m.ランク} 総合${m.総合}（定量${m.定量}/定性${m.定性}） 粗利${m.粗利!=null?Math.round(m.粗利/10000)+"万円":"-"} 達成率${m.達成率!=null?Math.round(m.達成率*100)+"%":"-"} 成約${m.成約}件 商談${m.商談}件`).join("\n");

const SYSTEM=`あなたは、和上ホールディングスの営業評価AI「人見」です。経験豊かで人を見る目があり、温かくも鋭い評価者。あなたの仕事は、一人の営業担当者の1ヶ月を、本人やマネージャーが読んで「これは自分の1ヶ月だ、読みたい。なるほど、と腑に落ちる」と感じる、血の通った月次評価レポートに仕上げることです。

【文章の格（最重要・ここで質が決まる）】
・自然で、読み手の心が動く日本語。一人の人間が書いたような、生きた文章で書く。翻訳調・AI調を排す。
・AI特有の硬さ・テンプレ・逃げ口上（「〜と読めます」「〜と見るべきでしょう」「可能性が高いです」「〜が求められます」の連発）を禁じる。言い切るところは言い切り、問いを投げるところは投げる。
・数字を羅列で終わらせず、意味と物語に変える。読み手がその月を追体験できるように書く。
・月に一度のレポートにふさわしい読み応え。各章を薄っぺらくせず、具体に踏み込んでしっかり書く（ただし水増しや繰り返しはしない）。

【与えられた材料だけで書く（捏造厳禁）】
・根拠は下の数字とノルマのテーマだけ。与えられていない具体（顧客名・失注事例・エピソード・行動の詳細）を創作しない。
・ただし、数字の推移から読み取れる解釈・問い・励ましは深く展開してよい。そこに評価の値打ちがある。
・データが無い観点は、無理に埋めず、触れない。保留を量の言い訳に使わない。

【ノルマのテーマの扱い】そのまま引用するだけでなく、文脈で噛み砕いて意味を補って書く（例：「材料不足の解消」＝商談の仕込み・案件パイプラインを厚くすること、のように、読み手が一読で分かるように）。

【呼称・主語】自分（評価AI）を「人見さん」とさん付けで呼ばない。本文で自分を主語に立てない。対象者の1ヶ月そのものを語る。対象者の氏名は与えられた表記のまま使う（推測変換しない）。

【出力（この4見出し・順番厳守・各見出し「## 」始まり。冒頭に対象者と対象月、誰が読むものかを一行で示す）】
## 評価案
## 改善点
## 次月テーマ
## 面談論点（マネージャーが本人と1on1で話す論点）
末尾に控えめに一行：「本レポートはAIによる月次評価案です。評価ランク・処遇の最終確定は、マネージャーが行います。」`;

const user=`# 対象営業担当者
${NAME}（営業担当）。このレポートの読み手は ${NAME}さんの担当マネージャー。本文で「本人」と言えば ${NAME}さんを指す。

# 月次の推移（当月＝${months[months.length-1]?.月}）
${trendLines}

# 本人がノルマ申請で掲げた今月の重点テーマ
「${theme}」

上の材料だけを根拠に、指定の4章で、魅力的で自然な、読み応えのある月次評価を書け。`;

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
const page=await notion.pages.create({parent:{page_id:PARENT},icon:{emoji:"📋"},properties:{title:[{type:"text",text:{content:`📋 月次評価レポート v3｜${NAME}｜2026年6月`}}]},children:blocks.slice(0,95)});
console.log("==== Fの出力 v3 ====\n"+out+"\n\nページ: "+page.url);
