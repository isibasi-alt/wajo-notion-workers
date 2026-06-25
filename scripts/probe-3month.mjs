import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const EVAL="cf6fc870-9c7b-4f98-a108-64a94d60c02d";
const UID="b8d835b0-f874-452f-8e66-bb14af58aabd";
const num=(p)=>p?.type==="number"?p.number:p?.type==="formula"?p.formula?.number:null;
const txt=(p)=>((p?.rich_text||p?.title||[]).map(x=>x.plain_text).join(""));
const r=await notion.dataSources.query({data_source_id:EVAL,page_size:50,filter:{property:"対象営業ユーザー",people:{contains:UID}}});
const rows=r.results.map(p=>{const pp=p.properties||{};return {
  月:txt(pp["対象月"]), 評価名:txt(pp["評価名"]).slice(0,28),
  粗利:num(pp["実績粗利額"]), 目標:num(pp["粗利目標額"]), 達成率:num(pp["粗利達成率"]),
  成約:num(pp["成約数"]), 商談:num(pp["商談数"]), 総合:num(pp["総合スコア"]),
  定量:num(pp["定量スコア"]), 定性:num(pp["定性スコア"]), ランク:(pp["評価ランク"]?.select?.name)||null,
};});
rows.sort((a,b)=>String(a.月).localeCompare(String(b.月)));
for(const x of rows) console.log(JSON.stringify(x));
