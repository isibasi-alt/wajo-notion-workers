import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const DBS=[["チームトラッカー","3b44d017-81e7-82c9-9f2d-87004c53d722"],["スタッフマスター","f770bee6-fb52-46db-adc2-9bcca9e406e8"]];
for(const [label,id] of DBS){
  const ds=await notion.dataSources.retrieve({data_source_id:id});
  console.log(`\n===== ${label} [${id}] =====`);
  for(const [k,v] of Object.entries(ds.properties||{})){
    let d="";
    if(v.type==="select")d="["+(v.select?.options||[]).map(o=>o.name).join(", ")+"]";
    else if(v.type==="multi_select")d="["+(v.multi_select?.options||[]).map(o=>o.name).join(", ")+"]";
    else if(v.type==="relation")d="→"+(v.relation?.data_source_id||"?");
    else if(v.type==="formula")d="⚙formula";
    else if(v.type==="rollup")d="⚙rollup rel="+v.rollup?.relation_property_name+" prop="+v.rollup?.rollup_property_name;
    console.log(`  ${k} <${v.type}> ${d}`);
  }
}
