import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const TT="3b44d017-81e7-82c9-9f2d-87004c53d722";
const SAEKI="370d872b-594c-817a-8eb5-00025efeef7b";
const MARK="【検証用ダミー｜佐伯】";

const ds=await notion.dataSources.retrieve({data_source_id:TT});
const opts=(ds.properties["ステータス"]?.status?.options||[]).map(o=>o.name);
console.log("status候補:",opts);
const pick=(...kws)=>{for(const kw of kws){const f=opts.find(o=>o.includes(kw));if(f)return f;}return opts[0];};
const DOING=pick("進行","対応","中","Doing","In");
const DONE=pick("完了","済","Done");
const TODO=pick("未","Todo","To Do","予定","未着");
console.log("→ 使用:",{TODO,DOING,DONE});

async function upsertTask(name,props){
  const full=MARK+name;
  const r=await notion.dataSources.query({data_source_id:TT,page_size:100,filter:{property:"タスク担当者",people:{contains:SAEKI}}});
  const ex=r.results.find(p=>((p.properties?.["タスク名"]?.title||[]).map(x=>x.plain_text).join(""))===full);
  if(ex){console.log("既存:",full);return ex.id;}
  const c=await notion.pages.create({parent:{data_source_id:TT},properties:{タスク名:{title:[{text:{content:full}}]},タスク担当者:{people:[{id:SAEKI}]},...props}});
  console.log("作成:",full);return c.id;
}
const tasks=[
  {n:"南紀ファーム 補助金スケジュール確認",st:DOING,pr:"高",ty:"確認・調査",ef:"中",lim:"2026-06-30",g:"補助金採択時期を先方と握る。価格は採択見込み後に再提示する。"},
  {n:"御坊水産 再提案資料（削減試算）作成",st:DOING,pr:"中",ty:"書類作成",ef:"中",lim:"2026-06-28",g:"冷凍設備の電力負荷から削減試算を作り再提案に持参する。"},
  {n:"海南金属 失注振り返りメモをチーム共有",st:DONE,pr:"低",ty:"社内タスク",ef:"小",lim:"2026-06-20",g:"即決案件での価格提示タイミングの教訓を共有済み。"},
];
for(const t of tasks){
  await upsertTask(t.n,{
    ステータス:{status:{name:t.st}},
    優先順位:{select:{name:t.pr}},
    タスクタイプ:{multi_select:[{name:t.ty}]},
    努力レベル:{select:{name:t.ef}},
    期限:{date:{start:t.lim}},
    概要:{rich_text:[{text:{content:t.g}}]},
  });
}
console.log("\n--- 再収集（挿入ロジックと同一）---");
const tr=await notion.dataSources.query({data_source_id:TT,page_size:100,filter:{property:"タスク担当者",people:{contains:SAEKI}}});
const text=(p)=>p?.type==="status"?(p.status?.name||""):"";
const by={};for(const t of tr.results){const s=text(t.properties?.["ステータス"])||"未設定";by[s]=(by[s]||0)+1;}
console.log("担当タスク総数:",tr.results.length);
console.log("ステータス内訳:",Object.entries(by).map(([k,v])=>`${k} ${v}件`).join(" / ")||"（なし）");
