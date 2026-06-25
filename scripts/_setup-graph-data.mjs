import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
console.log("=== Notion file upload API が使えるか ===");
console.log("notion.fileUploads:", typeof notion.fileUploads, notion.fileUploads?Object.keys(notion.fileUploads):"(なし)");

const EVAL="cf6fc870-9c7b-4f98-a108-64a94d60c02d";
const SAEKI="370d872b-594c-817a-8eb5-00025efeef7b";
const MARK="【検証用ダミー｜佐伯｜推移】";
const text=(p)=>p?.type==="title"?(p.title||[]).map(x=>x.plain_text).join(""):"";
// 既存（佐伯の推移用レコード）
const ex=(await notion.dataSources.query({data_source_id:EVAL,page_size:50,filter:{property:"対象営業ユーザー",people:{contains:SAEKI}}})).results.map(p=>({m:( (p.properties["対象月"]?.rich_text||[]).map(x=>x.plain_text).join("") ),name:text(p.properties["評価名"]),id:p.id})).filter(x=>x.name.includes(MARK));
console.log("\n既存の佐伯・推移レコード:", ex.map(x=>x.m).join(",")||"なし");
// 3ヶ月（伸びを見せるラフなダミー）：粗利万円 / 成約 / 案件化
const months=[["2026年4月",2000000,2,3],["2026年5月",2500000,3,4],["2026年6月",3000000,2,5]];
for(const [m,gross,seiyaku,anken] of months){
  if(ex.find(x=>x.m===m)){console.log("既存スキップ",m);continue;}
  await notion.pages.create({parent:{data_source_id:EVAL},properties:{
    "評価名":{title:[{text:{content:`${MARK}${m}`}}]},
    "対象営業ユーザー":{people:[{id:SAEKI}]},
    "対象月":{rich_text:[{text:{content:m}}]},
    "実績粗利額":{number:gross},
    "成約数":{number:seiyaku},
    "案件化数":{number:anken},
  }});
  console.log("作成",m,`粗利${gross/10000}万 成約${seiyaku} 案件化${anken}`);
}
console.log("\n→ 3ヶ月推移データ用意完了（粗利200→250→300万／案件化3→4→5）");
