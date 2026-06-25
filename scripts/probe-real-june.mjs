import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function loadEnv(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
loadEnv(".env");loadEnv(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const SALES_PERF="e67ec5d5-90d3-4118-9788-976a6f5c94a1";
const ACTIVITY="a58a107d-92e3-43f3-887d-5e3acf72e9ec";
const JUNE_PAGE="3824d017-81e7-81ab-b189-ea7b593d7e7a";
const num=(p)=>{const t=p?.type;if(t==="number")return p.number;if(t==="formula")return p.formula?.number??null;if(t==="rollup")return p.rollup?.number??null;return null;};
const pg=await notion.pages.retrieve({page_id:JUNE_PAGE});
const tu=pg.properties?.["対象営業ユーザー"]?.people||[];
console.log("対象者:",tu.map(x=>`${x.name}=${x.id}`).join(",")||"(未設定)");
if(!tu.length)process.exit(0);
const uid=tu[0].id;
const monthStart="2026-06-01",nextMonthStart="2026-07-01";
const res=await notion.dataSources.query({data_source_id:SALES_PERF,page_size:10,filter:{and:[{property:"対象営業ユーザー",people:{contains:uid}},{property:"開始日",date:{on_or_after:monthStart}},{property:"開始日",date:{before:nextMonthStart}}]}});
console.log("当月の月次成績ヒット件数:",res.results.length);
const perf=res.results.find(p=>{const k=p.properties?.["期間種別"];return (k?.select?.name||k?.status?.name)==="月次";})||res.results[0];
if(!perf){console.log("→ 当月の月次成績レコードなし＝粗利/成約は保留候補");}
else{
  const pp=perf.properties||{};
  console.log("月次成績ページID:",perf.id);
  console.log("実績粗利額（自動）:",num(pp["実績粗利額（自動）"]));
  console.log("粗利目標（申請DB）:",num(pp["粗利目標（申請DB）"]));
  console.log("関連成約 件数:",(pp["関連成約"]?.relation||[]).length);
  const act=await notion.dataSources.query({data_source_id:ACTIVITY,page_size:100,filter:{property:"関連営業パフォーマンス",relation:{contains:perf.id}}});
  console.log("紐づく活動ログ 件数:",act.results.length+(act.has_more?"+":""));
}
