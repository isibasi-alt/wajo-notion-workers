import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const STAFF="f770bee6-fb52-46db-adc2-9bcca9e406e8";
const TT="3b44d017-81e7-82c9-9f2d-87004c53d722";
const SAEKI="370d872b-594c-817a-8eb5-00025efeef7b";
const text=(p)=>{if(!p)return"";if(p.type==="title")return(p.title||[]).map(x=>x.plain_text).join("");if(p.type==="rich_text")return(p.rich_text||[]).map(x=>x.plain_text).join("");if(p.type==="select")return p.select?.name||"";if(p.type==="status")return p.status?.name||"";return"";};
const numv=(p)=>p?.type==="number"?p.number:p?.type==="rollup"?(p.rollup?.number??null):p?.type==="formula"?p.formula?.number:null;

console.log("===== スタッフマスター収集（挿入ロジックと同一クエリ）=====");
const sr=await notion.dataSources.query({data_source_id:STAFF,page_size:5,filter:{property:"Notionユーザー",people:{contains:SAEKI}}});
const sp=sr.results[0]?.properties||{};
console.log("ヒット件数:",sr.results.length);
console.log("氏名（正本）:",text(sp["氏名"]));
console.log("役職:",text(sp["役職"]),"／部署:",text(sp["部署"]),"／評価タイプ:",text(sp["評価タイプ"]));
console.log("担当エリア:",text(sp["担当エリア"]),"／在籍:",text(sp["在籍ステータス"]),"／雇用形態:",text(sp["雇用形態"]));
console.log("年間粗利目標:",numv(sp["年間粗利目標"]),"／年間成約目標:",numv(sp["年間成約目標"]));
console.log("1on1実施回数:",numv(sp["1on1実施回数"]),"／平均マネージャー評価:",numv(sp["平均マネージャー評価スコア"]));

console.log("\n===== チームトラッカー収集（挿入ロジックと同一クエリ）=====");
const tr=await notion.dataSources.query({data_source_id:TT,page_size:100,filter:{property:"タスク担当者",people:{contains:SAEKI}}});
console.log("担当タスク総数:",tr.results.length);
const by={};for(const t of tr.results){const s=text(t.properties?.["ステータス"])||"未設定";by[s]=(by[s]||0)+1;}
console.log("ステータス内訳:",Object.entries(by).map(([k,v])=>`${k} ${v}件`).join(" / ")||"（なし）");
