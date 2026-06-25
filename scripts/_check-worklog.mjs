import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const DS="d78b8698-219b-451f-88c9-2992a39754ed";
const text=(p)=>p?.type==="title"?(p.title||[]).map(x=>x.plain_text).join(""):p?.type==="rich_text"?(p.rich_text||[]).map(x=>x.plain_text).join(""):"";
const r=await notion.dataSources.query({data_source_id:DS,page_size:20});
console.log("=== 作業ログDB（石橋大右ダッシュボード配下）レコード数:",r.results.length,"===");
for(const p of r.results){const pp=p.properties;
  console.log(`■ ${text(pp["Name"])}`);
  console.log(`   対象月:${text(pp["対象月"])} ／ ステータス:${pp["ステータス"]?.select?.name||"-"} ／ 対象者:${(pp["対象営業ユーザー"]?.people||[]).map(u=>u.name||u.id).join(",")}`);
  console.log(`   月次評価ページ:${pp["月次評価ページ"]?.url||"-"}`);
}
console.log("\nDB本体URL: https://app.notion.com/p/496f7e2783b747579c5039906b63e717");
