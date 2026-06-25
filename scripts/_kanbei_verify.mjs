import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const UID="370d872b-594c-817a-8eb5-00025efeef7b";
const M0="2026-06-01",M1="2026-07-01";
const num=(p)=>p?.type==="number"?p.number:p?.type==="formula"?p.formula?.number:p?.type==="rollup"?(p.rollup?.number??(Array.isArray(p.rollup?.array)?p.rollup.array.length:null)):null;
const text=(p)=>{if(!p)return"";if(p.type==="title")return(p.title||[]).map(x=>x.plain_text).join("");if(p.type==="rich_text")return(p.rich_text||[]).map(x=>x.plain_text).join("");return"";};

// 月次成績
const PERF="e67ec5d5-90d3-4118-9788-976a6f5c94a1";
const pr=(await notion.dataSources.query({data_source_id:PERF,page_size:10,filter:{and:[{property:"対象営業ユーザー",people:{contains:UID}},{property:"開始日",date:{on_or_after:M0}},{property:"開始日",date:{before:M1}}]}})).results;
console.log("=== 月次成績 行数:",pr.length,"===");
for(const p of pr){
  const x=p.properties;
  console.log("title:",text(x[Object.keys(x).find(k=>x[k].type==="title")]));
  for(const k of Object.keys(x)){
    const v=x[k];
    if(v.type==="rollup"){console.log("  [rollup]",k,"=",JSON.stringify(v.rollup).slice(0,200));}
    else if(v.type==="number"){console.log("  [num]",k,"=",v.number);}
    else if(v.type==="formula"){console.log("  [formula]",k,"=",JSON.stringify(v.formula).slice(0,120));}
  }
}
