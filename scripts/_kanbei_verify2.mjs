import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const UID="370d872b-594c-817a-8eb5-00025efeef7b";
const M0="2026-06-01",M1="2026-07-01";
const text=(p)=>{if(!p)return"";if(p.type==="title")return(p.title||[]).map(x=>x.plain_text).join("");if(p.type==="rich_text")return(p.rich_text||[]).map(x=>x.plain_text).join("");return"";};
const sel=(p)=>p?.select?.name||"";const stat=(p)=>p?.status?.name||"";
const num=(p)=>p?.type==="number"?p.number:p?.type==="formula"?p.formula?.number:p?.type==="rollup"?(p.rollup?.number??null):null;
const dt=(p)=>p?.date?.start||"";

// 案件DB（成約・商談はここにフィルタ無しで全件、佐伯のMARKERだけ）
const MARK="【検証用ダミー｜佐伯】";
async function dump(name,ds,pp,dp,tp,fields){
  const r=await notion.dataSources.query({data_source_id:ds,page_size:50,filter:{and:[{property:pp,people:{contains:UID}},{property:dp,date:{on_or_after:M0}},{property:dp,date:{before:M1}}]}});
  const rows=r.results.map(p=>p.properties).filter(x=>text(x[tp]).includes(MARK));
  console.log(`\n=== ${name} 件数:${rows.length} (raw:${r.results.length}) ===`);
  for(const x of rows){console.log("  •",text(x[tp]).replace(MARK,""),"|",fields.map(f=>`${f}=${sel(x[f])||stat(x[f])||num(x[f])||dt(x[f])||text(x[f])}`).join(" / "));}
  return rows;
}
await dump("案件(商談)","7838db8a-907a-4c61-b062-109f8278b2c9","担当営業ユーザー","商談日","商談名",["商談結果","商談日","粗利額","粗利","成約金額","営業スコア"]);
await dump("成約","8d5a506b-59b8-4e50-bc77-d5412774048d","担当営業ユーザー","成約日","成約名",["成約日","粗利額","粗利","売上","成約金額"]);
await dump("1on1","6ad99df1-8ae7-47bd-a59b-236a6f0df521","対象営業ユーザー","面談日","面談名",["面談日"]);
await dump("営業貢献","f88056da-3052-418e-8cf4-e9b4197cd7ba","対象営業ユーザー","日付","貢献タイトル",["種別","貢献インパクト","日付"]);
await dump("ミーティング","c22e58f6-42c9-4a2f-b24d-e65e889d59e9","担当営業ユーザー","ミーティング日","ミーティング名",["ミーティング日"]);
await dump("発言","86f5693c-db36-4356-aec1-210495f6032a","発言者","発言日時","発言タイトル",["発言カテゴリ","重要度"]);
await dump("日報","8f7489a5-47fe-4e0a-833b-ee21ab033ad5","担当営業ユーザー","日付","タイトル",["日付","テンション"]);

// チームトラッカー（日付フィルタ無し）
const tr=await notion.dataSources.query({data_source_id:"3b44d017-81e7-82c9-9f2d-87004c53d722",page_size:50,filter:{property:"タスク担当者",people:{contains:UID}}});
const tasks=tr.results.map(p=>p.properties).filter(x=>text(x["タスク名"]).includes(MARK));
console.log(`\n=== チームトラッカー 件数:${tasks.length} (raw:${tr.results.length}) ===`);
for(const x of tasks){console.log("  •",text(x["タスク名"]).replace(MARK,""),"| status=",stat(x["ステータス"]),"優先=",sel(x["優先順位"]));}

// スタッフマスター
const sr=await notion.dataSources.query({data_source_id:"f770bee6-fb52-46db-adc2-9bcca9e406e8",page_size:5,filter:{property:"Notionユーザー",people:{contains:UID}}});
const s=sr.results[0]?.properties||{};
console.log("\n=== スタッフマスター ===");
console.log("  氏名:",text(s["氏名"]));
console.log("  年間粗利目標:",num(s["年間粗利目標"]),"年間成約目標:",num(s["年間成約目標"]),"1on1実施回数:",num(s["1on1実施回数"]),"平均マネ評価:",num(s["平均マネージャー評価スコア"]));
