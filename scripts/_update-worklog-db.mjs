import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const DS="d78b8698-219b-451f-88c9-2992a39754ed";
await notion.dataSources.update({
  data_source_id:DS,
  properties:{
    "対象営業ユーザー":{people:{}},
    "対象月":{rich_text:{}},
    "ステータス":{select:{options:[{name:"処理中",color:"yellow"},{name:"完了",color:"green"}]}},
    "月次評価ページ":{url:{}},
  }
});
const ds=await notion.dataSources.retrieve({data_source_id:DS});
console.log("=== 作業ログDBのプロパティ（更新後）===");
for(const [k,v] of Object.entries(ds.properties||{})) console.log(`  ${k} <${v.type}>`);
