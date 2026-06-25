import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const DBS=[
  ["商談DEAL","7838db8a-907a-4c61-b062-109f8278b2c9"],
  ["ミーティングMEETING","c22e58f6-42c9-4a2f-b24d-e65e889d59e9"],
  ["活動ログACTIVITY","a58a107d-92e3-43f3-887d-5e3acf72e9ec"],
  ["発言SPEECH","86f5693c-db36-4356-aec1-210495f6032a"],
  ["営業貢献CONTRIB","f88056da-3052-418e-8cf4-e9b4197cd7ba"],
  ["1on1","6ad99df1-8ae7-47bd-a59b-236a6f0df521"],
  ["日報DAILY","8f7489a5-47fe-4e0a-833b-ee21ab033ad5"],
  ["ナレッジKNOWLEDGE","8ffd91e0-2f44-4915-926a-d410bcb04e95"],
];
for(const [label,id] of DBS){
  try{
    const ds=await notion.dataSources.retrieve({data_source_id:id});
    const props=Object.entries(ds.properties||{});
    const person=props.filter(([k,v])=>v.type==="people").map(([k])=>k);
    const date=props.filter(([k,v])=>v.type==="date"||v.type==="created_time").map(([k])=>k);
    const title=props.filter(([k,v])=>v.type==="title").map(([k])=>k);
    const text=props.filter(([k,v])=>v.type==="rich_text").map(([k])=>k);
    const rel=props.filter(([k,v])=>v.type==="relation").map(([k])=>k);
    console.log(`\n■ ${label} (${(ds.title||[]).map(t=>t.plain_text).join("")||ds.name})`);
    console.log(`  people: ${person.join(" / ")||"なし"}`);
    console.log(`  date:   ${date.join(" / ")||"なし"}`);
    console.log(`  title:  ${title.join(" / ")}`);
    console.log(`  text:   ${text.slice(0,8).join(" / ")}`);
    console.log(`  relation: ${rel.slice(0,10).join(" / ")}`);
  }catch(e){console.log(`\n■ ${label}: 取得エラー ${String(e).slice(0,100)}`);}
}
