// スタッフマスターDBを探し、登録されている営業マン（佐藤等のダミー含む）と紐づくユーザーIDを実機で出す。
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});

// 1) スタッフマスターらしきDBを検索
const s=await notion.search({query:"スタッフマスター",filter:{property:"object",value:"data_source"},page_size:20}).catch(e=>({results:[],err:e.message}));
const s2=await notion.search({query:"スタッフ",page_size:20}).catch(e=>({results:[]}));
console.log("=== search 'スタッフマスター' (data_source) ===");
for(const r of (s.results||[])) console.log(`${r.object}\t${(r.title||r.name||[]).map?.(x=>x.plain_text).join("")||r.title}\t${r.id}`);
console.log("\n=== search 'スタッフ' (all) ===");
for(const r of (s2.results||[])){
  const t=(r.properties?.title?.title||r.title||[]).map?.(x=>x.plain_text).join("")||"";
  console.log(`${r.object}\t${t}\t${r.id}`);
}
