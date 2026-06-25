import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const NORMA="27df8a65-4729-4600-bfc1-59bb1c460e73";
const UID="b8d835b0-f874-452f-8e66-bb14af58aabd";
const txt=(p)=>((p?.rich_text||[]).map(x=>x.plain_text).join(""));
const num=(p)=>p?.type==="number"?p.number:p?.type==="formula"?(p.formula?.number??p.formula?.string):p?.type==="rollup"?p.rollup?.number:null;
const r=await notion.dataSources.query({data_source_id:NORMA,page_size:20,filter:{property:"対象営業ユーザー",people:{contains:UID}}});
console.log("ISIBASIDAISUKEのノルマ申請レコード数:",r.results.length);
for(const pg of r.results){
  const pp=pg.properties||{};
  const period=pp["対象期間"]?.date?.start||null;
  console.log(JSON.stringify({
    対象期間:period,
    担当マネージャー:(pp["担当マネージャー"]?.people||[]).map(x=>x.name),
    粗利目標:num(pp["粗利目標"]),
    重点テーマ:txt(pp["重点テーマ"]).slice(0,80),
    ノルマ達成率:num(pp["ノルマ達成率"]),
    進捗ステータス:num(pp["進捗ステータス"]),
    マネージャーコメント:txt(pp["マネージャーコメント"]).slice(0,50),
  }));
}
