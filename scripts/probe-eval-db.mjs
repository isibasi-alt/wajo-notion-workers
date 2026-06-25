import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const ds=await notion.dataSources.retrieve({data_source_id:"cf6fc870-9c7b-4f98-a108-64a94d60c02d"});
console.log("評価DB名:", (ds.title||[]).map(t=>t.plain_text).join("")||ds.name||"(不明)");
console.log("プロパティ一覧:");
for(const [k,v] of Object.entries(ds.properties||{})) console.log(`  - ${k} (${v.type})`);
