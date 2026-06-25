import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const PARENT="3824d017-81e7-81ab-b189-ea7b593d7e7a";
const months=["4月","5月","6月"];
function line(x0,title,vals,unit,max,color){const base=250,h=160,pw=180;
  let s=`<text x="${x0+100}" y="32" font-size="16" font-weight="bold" text-anchor="middle" fill="#333">${title}</text>`;
  s+=`<line x1="${x0+25}" y1="${base}" x2="${x0+215}" y2="${base}" stroke="#ccc"/><line x1="${x0+25}" y1="${base}" x2="${x0+25}" y2="${base-h-15}" stroke="#ccc"/>`;
  const pts=vals.map((v,i)=>[x0+45+i*((pw-30)/(vals.length-1)),base-Math.round(v/max*h),v]);
  s+=`<polyline points="${pts.map(p=>p[0]+","+p[1]).join(" ")}" fill="none" stroke="${color}" stroke-width="3"/>`;
  pts.forEach((p,i)=>{s+=`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${color}"/><text x="${p[0]}" y="${p[1]-12}" font-size="13" font-weight="bold" text-anchor="middle" fill="#333">${p[2]}${unit}</text><text x="${p[0]}" y="${base+20}" font-size="12" text-anchor="middle" fill="#666">${months[i]}</text>`;});
  return s;}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="760" height="290" viewBox="0 0 760 290"><rect width="760" height="290" fill="#ffffff"/>${line(20,"売上（粗利）の推移",[200,250,300],"万",300,"#4a86c7")}${line(400,"案件化数の推移",[3,4,5],"件",5,"#5aa95a")}</svg>`;

const page=await notion.pages.create({parent:{page_id:PARENT},icon:{emoji:"📈"},properties:{title:[{type:"text",text:{content:"【折れ線グラフ試作】佐伯 3ヶ月推移"}}]}});
// 方法1: File(type指定)でcontent-type一致させる
try{
  const up=await notion.fileUploads.create({mode:"single_part",filename:"line.svg",content_type:"image/svg+xml"});
  const file=new File([svg],"line.svg",{type:"image/svg+xml"});
  await notion.fileUploads.send({file_upload_id:up.id,file});
  await notion.blocks.children.append({block_id:page.id,children:[{object:"block",type:"image",image:{type:"file_upload",file_upload:{id:up.id}}}]});
  console.log("✅ SVG折れ線グラフ Notion貼り付け 成功");
}catch(e){console.log("❌ SVG失敗:",String(e).slice(0,180));
  await notion.blocks.children.append({block_id:page.id,children:[{object:"block",type:"paragraph",paragraph:{rich_text:[{type:"text",text:{content:"（SVG画像は貼れず。テキスト折れ線/PNGを検討）"}}]}}]});
}
console.log("ページ:",page.url);
