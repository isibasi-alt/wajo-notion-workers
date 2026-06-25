import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const UID="b8d835b0-f874-452f-8e66-bb14af58aabd";
const M0="2026-06-01", M1="2026-07-01";
const txt=(p)=>((p?.rich_text||p?.title||[]).map(x=>x.plain_text).join(""));
async function q(ds,personProp,dateProp,extra){
  try{
    const r=await notion.dataSources.query({data_source_id:ds,page_size:50,filter:{and:[{property:personProp,people:{contains:UID}},{property:dateProp,date:{on_or_after:M0}},{property:dateProp,date:{before:M1}}]}});
    return r.results;
  }catch(e){return {err:String(e).slice(0,120)};}
}
const out=[];
// 商談
let r=await q("7838db8a-907a-4c61-b062-109f8278b2c9","担当営業ユーザー","商談日");
out.push(`商談DEAL: ${Array.isArray(r)?r.length+"件":r.err}`);
if(Array.isArray(r))for(const p of r.slice(0,3)){const pp=p.properties||{};out.push(`  ・${txt(pp["商談名"])}｜概要:${txt(pp["商談概要"]).slice(0,40)}｜営業FB:${txt(pp["営業フィードバック"]).slice(0,40)}`);}
// ミーティング
r=await q("c22e58f6-42c9-4a2f-b24d-e65e889d59e9","担当営業ユーザー","ミーティング日");
out.push(`ミーティング: ${Array.isArray(r)?r.length+"件":r.err}`);
if(Array.isArray(r))for(const p of r.slice(0,2)){const pp=p.properties||{};out.push(`  ・${txt(pp["ミーティング名"])}｜決定:${txt(pp["決定事項"]).slice(0,40)}`);}
// 1on1
r=await q("6ad99df1-8ae7-47bd-a59b-236a6f0df521","対象営業ユーザー","面談日");
out.push(`1on1: ${Array.isArray(r)?r.length+"件":r.err}`);
if(Array.isArray(r))for(const p of r.slice(0,2)){const pp=p.properties||{};out.push(`  ・${txt(pp["面談名"])}｜評価材料:${txt(pp["評価材料メモ"]).slice(0,50)}`);}
// 営業貢献
r=await q("f88056da-3052-418e-8cf4-e9b4197cd7ba","対象営業ユーザー","日付");
out.push(`営業貢献: ${Array.isArray(r)?r.length+"件":r.err}`);
if(Array.isArray(r))for(const p of r.slice(0,2)){const pp=p.properties||{};out.push(`  ・${txt(pp["貢献タイトル"])}｜:${txt(pp["コメント"]).slice(0,50)}`);}
// 日報
r=await q("8f7489a5-47fe-4e0a-833b-ee21ab033ad5","担当営業ユーザー","日付");
out.push(`日報: ${Array.isArray(r)?r.length+"件":r.err}`);
// 発言
r=await q("86f5693c-db36-4356-aec1-210495f6032a","発言者","発言日時");
out.push(`発言SPEECH: ${Array.isArray(r)?r.length+"件":r.err}`);
// 活動
r=await q("a58a107d-92e3-43f3-887d-5e3acf72e9ec","活動者","活動日時");
out.push(`活動ACTIVITY: ${Array.isArray(r)?r.length+"件":r.err}`);
console.log(out.join("\n"));
