// 書き込み対象DBのフルスキーマ。型・select候補・relation相手・formula/rollup(自動)を明示。
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const DBS=[
  ["月次成績PERF","e67ec5d5-90d3-4118-9788-976a6f5c94a1"],
  ["成約報告CLOSING","8d5a506b-59b8-4e50-bc77-d5412774048d"],
  ["案件DEAL","7838db8a-907a-4c61-b062-109f8278b2c9"],
  ["ミーティングMTG","c22e58f6-42c9-4a2f-b24d-e65e889d59e9"],
  ["1on1","6ad99df1-8ae7-47bd-a59b-236a6f0df521"],
  ["営業貢献CONTRIB","f88056da-3052-418e-8cf4-e9b4197cd7ba"],
  ["日報DAILY","8f7489a5-47fe-4e0a-833b-ee21ab033ad5"],
  ["発言SPEECH","86f5693c-db36-4356-aec1-210495f6032a"],
  ["活動ACTIVITY","a58a107d-92e3-43f3-887d-5e3acf72e9ec"],
  ["ノルマQUOTA","27df8a65-4729-4600-bfc1-59bb1c460e73"],
  ["月次評価EVAL","cf6fc870-9c7b-4f98-a108-64a94d60c02d"],
];
for(const [label,id] of DBS){
  try{
    const ds=await notion.dataSources.retrieve({data_source_id:id});
    console.log(`\n========== ${label}  [${id}] ==========`);
    for(const [k,v] of Object.entries(ds.properties||{})){
      let detail="";
      if(v.type==="select") detail="候補=["+(v.select?.options||[]).map(o=>o.name).join(", ")+"]";
      else if(v.type==="status") detail="候補=["+(v.status?.options||[]).map(o=>o.name).join(", ")+"]";
      else if(v.type==="multi_select") detail="候補=["+(v.multi_select?.options||[]).map(o=>o.name).join(", ")+"]";
      else if(v.type==="relation") detail="→相手DS="+(v.relation?.data_source_id||v.relation?.database_id||"?");
      else if(v.type==="formula") detail="⚙自動(formula): "+(v.formula?.expression||"").slice(0,60);
      else if(v.type==="rollup") detail="⚙自動(rollup): rel="+v.rollup?.relation_property_name+" prop="+v.rollup?.rollup_property_name+" fn="+v.rollup?.function;
      console.log(`  ${k}\t<${v.type}>\t${detail}`);
    }
  }catch(e){console.log(`\n========== ${label}: エラー ${String(e).slice(0,120)}`);}
}
