import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const pg=await notion.pages.retrieve({page_id:"3824d017-81e7-81ab-b189-ea7b593d7e7a"});
const rt=(p)=>((p?.rich_text||[]).map(x=>x.plain_text).join("")||"(空)");
for(const k of ["本人コメント","人見さんメモ本文","マネージャーコメント","成長ポイント","改善ポイント","次月テーマ","上司確認事項"]){
  console.log(`  ${k}: ${rt(pg.properties?.[k])}`);
}
