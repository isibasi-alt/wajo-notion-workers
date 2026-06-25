import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function loadEnv(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
loadEnv(".env");loadEnv(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const PAGE="3824d017-81e7-81ab-b189-ea7b593d7e7a";
const rt=(b)=>{const t=b.type;return (b[t]?.rich_text||[]).map(x=>x.plain_text).join("");};
let all=[],c;
do{const r=await notion.blocks.children.list({block_id:PAGE,page_size:100,start_cursor:c});all.push(...r.results);c=r.has_more?r.next_cursor:undefined;}while(c);
// 見出しごとにテキストをまとめる
const sections=[];let cur=null;
for(const b of all){
  if(b.type==="heading_2"){cur={h:rt(b),body:[]};sections.push(cur);}
  else if(cur){const t=rt(b);if(t.trim())cur.body.push(t);}
}
const want=["採点君（C）の再採点","まとめ君（F）の統合レポート"];
for(const w of want){
  const s=sections.find(x=>x.h.includes(w));
  console.log("\n========== "+w+" ==========");
  console.log(s?s.body.join("\n"):"(見つからず)");
}
