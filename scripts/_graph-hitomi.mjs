import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const PARENT="3824d017-81e7-81ab-b189-ea7b593d7e7a";
const bar=(v,max,len=18)=>"█".repeat(Math.max(1,Math.round(v/max*len)))+"░".repeat(len-Math.max(1,Math.round(v/max*len)));
const graph=`売上（粗利）の伸び　※3ヶ月\n  4月 ${bar(200,300)} 200万円\n  5月 ${bar(250,300)} 250万円\n  6月 ${bar(300,300)} 300万円\n\n案件化数の伸び　※3ヶ月\n  4月 ${bar(3,5)} 3件\n  5月 ${bar(4,5)} 4件\n  6月 ${bar(5,5)} 5件\n\n（参考）成約数： 4月2件 → 5月3件 → 6月2件`;

// 人見さんの解説（Opus・グラフを見て本人に語る）
const hSys=`あなたは評価AI「人見」。佐伯さん本人に、3ヶ月推移グラフを見ながら語りかける短い解説を書く。データに紐づき、伸びている事実と、数字の裏にある課題を、血の通った言葉で。占い・教科書・一般論・AI口調・盛りは禁止。4〜6文。`;
const hUsr=`佐伯 亮太さんの3ヶ月推移：\n粗利 200万→250万→300万（右肩上がり）\n案件化 3→4→5件（右肩上がり）\n成約 2→3→2件（6月は5月から1件減）\nこのグラフを見て、本人に語りかける解説を書いてください。`;
const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-opus-4-8",max_tokens:1024,system:hSys,messages:[{role:"user",content:hUsr}]})});
const j=await res.json(); const hitomi=(j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();

const page=await notion.pages.create({parent:{page_id:PARENT},icon:{emoji:"📊"},properties:{title:[{type:"text",text:{content:"【グラフ＋人見さん解説 試作】佐伯 3ヶ月推移"}}]},children:[
  {object:"block",type:"heading_2",heading_2:{rich_text:[{type:"text",text:{content:"📊 3ヶ月の伸び"}}]}},
  {object:"block",type:"code",code:{language:"plain text",rich_text:[{type:"text",text:{content:graph}}]}},
  {object:"block",type:"heading_2",heading_2:{rich_text:[{type:"text",text:{content:"人見さんより"}}]}},
  {object:"block",type:"callout",callout:{icon:{emoji:"👩‍💼"},color:"purple_background",rich_text:[{type:"text",text:{content:hitomi.slice(0,1900)}}]}},
]});
console.log("==== グラフ ====\n"+graph);
console.log("\n==== 人見さんの解説 ====\n"+hitomi);
console.log("\nページ:",page.url);
