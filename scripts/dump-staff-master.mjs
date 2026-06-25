// スタッフマスターDBの全行を出す。氏名(title)とpeople/関連プロパティを汎用に。
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const STAFF="f770bee6-fb52-46db-adc2-9bcca9e406e8";

const r=await notion.dataSources.query({data_source_id:STAFF,page_size:100});
console.log("=== スタッフマスターDB 行数:", r.results.length, "===\n");
for(const p of r.results){
  const pp=p.properties||{};
  // title
  let name="";
  for(const [k,v] of Object.entries(pp)){ if(v.type==="title"){name=(v.title||[]).map(x=>x.plain_text).join("");} }
  console.log(`■ ${name||"(no title)"}  [pageId=${p.id}]`);
  for(const [k,v] of Object.entries(pp)){
    if(v.type==="people"){
      const ppl=(v.people||[]).map(u=>`${u.name||"(no name)"}<${u.id}>`).join(", ");
      console.log(`    people「${k}」= ${ppl||"(空)"}`);
    } else if(v.type==="select"){
      console.log(`    select「${k}」= ${v.select?.name||"(空)"}`);
    } else if(v.type==="rich_text"){
      const t=(v.rich_text||[]).map(x=>x.plain_text).join("");
      if(t) console.log(`    text「${k}」= ${t}`);
    } else if(v.type==="email"){
      if(v.email) console.log(`    email「${k}」= ${v.email}`);
    }
  }
  console.log("");
}
