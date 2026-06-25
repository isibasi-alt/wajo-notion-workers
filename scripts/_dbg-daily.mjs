import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const UID="370d872b-594c-817a-8eb5-00025efeef7b";
const clean=(s)=>(s||"").replace(/【検証用ダミー｜佐伯】/g,"").trim();
const txt=(p)=>clean(((p?.rich_text||p?.title||[]).map(x=>x.plain_text).join("")));
const r=await notion.dataSources.query({data_source_id:"8f7489a5-47fe-4e0a-833b-ee21ab033ad5",page_size:50,filter:{and:[{property:"担当営業ユーザー",people:{contains:UID}},{property:"日付",date:{on_or_after:"2026-06-01"}},{property:"日付",date:{before:"2026-07-01"}}]}});
console.log("佐伯6月の日報 件数:",r.results.length);
for(const p of r.results){const x=p.properties;
  console.log(`\n■ ${txt(x["タイトル"])}  テンション=[${x["テンション"]?.select?.name||"空"}]`);
  console.log("  要約   :", JSON.stringify(txt(x["AI今日の要約"])));
  console.log("  心残し :", JSON.stringify(txt(x["今日一番心に残り、今後に残したいこと"])));
  console.log("  つまずき:", JSON.stringify(txt(x["今日予定通りに行かなかったこと"])));
}
