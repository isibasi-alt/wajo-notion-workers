import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const WORK="38a4d017-81e7-8181-afb8-f4287a020832"; // 今回の作業ページ(裏)
let cur, secs=[], curHead=null, buf="";
do{const r=await notion.blocks.children.list({block_id:WORK,page_size:100,start_cursor:cur});
for(const b of r.results){const t=b.type;const rt=b[t]?.rich_text||[];const s=rt.map(x=>x.plain_text).join("");
  if(t.startsWith("heading")){if(curHead!==null)secs.push([curHead,buf]);curHead=s;buf="";}
  else if(s)buf+=s+"\n";}
cur=r.has_more?r.next_cursor:undefined;}while(cur);
if(curHead!==null)secs.push([curHead,buf]);
console.log("=== 作業ページ(裏)の各工程：見出し / 中身の文字数 / 冒頭120字 ===\n");
for(const [h,body] of secs){
  console.log(`■ ${h}  （中身 ${body.length}字）`);
  console.log("   "+body.replace(/\n/g," ").slice(0,120)+"\n");
}
