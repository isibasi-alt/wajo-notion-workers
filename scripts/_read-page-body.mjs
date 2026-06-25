import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const PAGE="38a4d017-81e7-8196-a7b0-eef02400e4e9";
let c;do{const r=await notion.blocks.children.list({block_id:PAGE,page_size:100,start_cursor:c});
for(const b of r.results){const t=b.type;const rt=b[t]?.rich_text||[];const s=rt.map(x=>x.plain_text).join("");if(s)console.log((t.startsWith("heading")?"\n## ":"")+s);}
c=r.has_more?r.next_cursor:undefined;}while(c);
