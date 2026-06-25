import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function loadEnv(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
loadEnv(".env");loadEnv(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const TEST="3874d017-81e7-81f2-9a35-c86f1f3da150";
const pg=await notion.pages.retrieve({page_id:TEST});
const dsId=pg.parent?.data_source_id||pg.parent?.database_id;
console.log("月次評価DB(親) data_source_id:",dsId,"parentType:",pg.parent?.type);
if(!dsId){console.log("親DB特定できず");process.exit(0);}
const q=await notion.dataSources.query({data_source_id:dsId,page_size:50});
console.log("総ページ数(最大50):",q.results.length);
let n=0;
for(const p of q.results){
  const props=p.properties||{};
  const titleKey=Object.keys(props).find(k=>props[k].type==="title");
  const title=(props[titleKey]?.title||[]).map(t=>t.plain_text).join("")||"(無題)";
  const tu=props["対象営業ユーザー"]?.people||[];
  if(tu.length){n++;console.log(`★[実対象者] "${title}" | 対象営業ユーザー=${tu.map(x=>x.name||x.id).join(",")} | id=${p.id}`);}
  else console.log(`  [未設定] "${title}" | id=${p.id}`);
}
console.log("対象営業ユーザー入りページ数:",n);
