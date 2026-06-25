import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const NORMA="27df8a65-4729-4600-bfc1-59bb1c460e73";
const UID="b8d835b0-f874-452f-8e66-bb14af58aabd";
const ds=await notion.dataSources.retrieve({data_source_id:NORMA});
console.log("ノルマ申請DB名:",(ds.title||[]).map(t=>t.plain_text).join("")||ds.name);
console.log("=== プロパティ一覧 ===");
let peopleProp=null;
for(const [k,v] of Object.entries(ds.properties||{})){console.log(`  - ${k} (${v.type})`); if(v.type==="people"&&!peopleProp)peopleProp=k;}
console.log("people型プロパティ(担当者候補):",peopleProp);
// 全件少しと、その人のレコードを試す
const all=await notion.dataSources.query({data_source_id:NORMA,page_size:10});
console.log("総レコード(最大10):",all.results.length);
const txt=(p)=>((p?.rich_text||p?.title||[]).map(x=>x.plain_text).join(""));
const num=(p)=>p?.type==="number"?p.number:null;
for(const pg of all.results.slice(0,6)){
  const pp=pg.properties||{};
  const titleKey=Object.keys(pp).find(k=>pp[k].type==="title");
  console.log(JSON.stringify({title:txt(pp[titleKey]).slice(0,30), people:peopleProp?(pp[peopleProp]?.people||[]).map(x=>x.name):null}));
}
