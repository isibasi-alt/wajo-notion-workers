import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const t=(r)=>((r.properties?.title?.title||r.title||[]).map?.(x=>x.plain_text).join(""))||"(無題)";
for(const qy of ["ダッシュボード","石橋大右","石橋"]){
  console.log(`\n=== search "${qy}" ===`);
  const s=await notion.search({query:qy,filter:{property:"object",value:"page"},page_size:15}).catch(e=>({results:[]}));
  for(const r of s.results) console.log(`page  ${t(r)}\t${r.id}`);
}
