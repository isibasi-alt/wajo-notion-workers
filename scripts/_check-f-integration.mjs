import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const EVAL="38a4d017-81e7-8101-97fa-cccb8ffbfbec"; // E2E評価ページ(F)
const WORK="38a4d017-81e7-812a-a7ec-d9f2175379c8"; // E2E作業ページ(A〜E)
async function blocks(pid){const out=[];let c;do{const r=await notion.blocks.children.list({block_id:pid,page_size:100,start_cursor:c});for(const b of r.results){const t=b.type;const s=(b[t]?.rich_text||[]).map(x=>x.plain_text).join("");out.push({t,s});}c=r.has_more?r.next_cursor:undefined;}while(c);return out;}
// 作業ページから D再確認 と E兆し のセクション本文を取り出す
const wb=await blocks(WORK);let cur=null,buf={};
for(const b of wb){if(b.t.startsWith("heading")){cur=b.s;buf[cur]="";}else if(cur&&b.s)buf[cur]+=b.s+"\n";}
console.log("===== 作業ページ：ツッコミ君（D）の再確認（E・Fへの申し送り）=====");
console.log((buf["ツッコミ君（D）の再確認"]||"(無)").slice(0,700));
console.log("\n===== 作業ページ：兆し発見君（E）の結果 =====");
console.log((buf["兆し発見君（E）の結果"]||"(無)").slice(0,900));
console.log("\n\n===== 月次評価ページ：F の本文（佐伯さんへ）=====");
const eb=await blocks(EVAL);
for(const b of eb){if(b.s)console.log((b.t.startsWith("heading")?"\n## ":"")+b.s);}
