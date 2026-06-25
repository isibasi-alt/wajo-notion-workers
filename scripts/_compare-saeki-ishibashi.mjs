import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const DEAL="7838db8a-907a-4c61-b062-109f8278b2c9";
const SAEKI="370d872b-594c-817a-8eb5-00025efeef7b";
const ISHIBASHI="b8d835b0-f874-452f-8e66-bb14af58aabd";
const text=(p)=>p?.type==="title"?(p.title||[]).map(x=>x.plain_text).join(""):p?.type==="rich_text"?(p.rich_text||[]).map(x=>x.plain_text).join(""):"";
async function deals(uid){const r=await notion.dataSources.query({data_source_id:DEAL,page_size:50,filter:{property:"担当営業ユーザー",people:{contains:uid}}});return r.results.map(p=>({name:text(p.properties["商談名"]),gist:text(p.properties["商談概要"]).slice(0,50),id:p.id}));}
const s=await deals(SAEKI), i=await deals(ISHIBASHI);
console.log(`=== 佐伯さん(UID 370d872b) の商談：${s.length}件 ===`);
for(const d of s) console.log(`  ・${d.name}  ／概要:${d.gist}`);
console.log(`\n=== 石橋大右さん(UID b8d835b0) の商談：${i.length}件 ===`);
for(const d of i) console.log(`  ・${d.name}  ／概要:${d.gist}`);
// ページIDが一致する商談があるか（=同じレコードの使い回し）
const sIds=new Set(s.map(d=>d.id)), shared=i.filter(d=>sIds.has(d.id));
console.log(`\n=== 両者で「同じpage_id」を共有する商談（使い回しの証拠になる）：${shared.length}件 ===`);
console.log(shared.length?shared.map(d=>"  ・"+d.name).join("\n"):"  なし（＝別レコード。使い回しではない）");
