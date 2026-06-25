import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const DASH="34c4d017-81e7-809c-b370-f197b669e004"; // 石橋大右のダッシュボード
// 既存チェック（再実行で重複作成しない）
const ex=await notion.search({query:"月次評価 ワークログ",filter:{property:"object",value:"data_source"},page_size:10}).catch(()=>({results:[]}));
const hit=(ex.results||[]).find(r=>((r.title||r.name||[]).map?.(x=>x.plain_text).join("")||"").includes("月次評価 ワークログ"));
if(hit){ console.log("既存あり data_source:",hit.id); process.exit(0); }
const db=await notion.databases.create({
  parent:{type:"page_id",page_id:DASH},
  title:[{type:"text",text:{content:"🗂 月次評価 ワークログ（A〜E検討）"}}],
  description:[{type:"text",text:{content:"人見さん月次評価のA〜E（点検・裏付け・採点・ツッコミ・兆し）の検討過程を1評価=1レコードで蓄積する作業DB。最終清書(F)は月次評価ページ本体に出す。"}}],
  properties:{
    "名前":{title:{}},
    "対象営業ユーザー":{people:{}},
    "対象月":{rich_text:{}},
    "ステータス":{select:{options:[{name:"処理中",color:"yellow"},{name:"完了",color:"green"}]}},
    "月次評価ページ":{url:{}},
  }
});
console.log("database id:",db.id);
console.log("database url:",db.url);
const full=await notion.databases.retrieve({database_id:db.id});
console.log("data_sources:",JSON.stringify((full.data_sources||[]).map(d=>d.id)));
