import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const PARENT="3824d017-81e7-81ab-b189-ea7b593d7e7a";
const labels=["4月","5月","6月"], gross=[200,250,300], anken=[3,4,5];
// Excel風の素朴な棒グラフSVG（2本）
function bars(x0,title,vals,unit,max,color){
  const bw=46,gap=34,base=250,h=170;let s=`<text x="${x0+90}" y="34" font-size="17" font-weight="bold" text-anchor="middle" fill="#333">${title}</text>`;
  s+=`<line x1="${x0+20}" y1="${base}" x2="${x0+200}" y2="${base}" stroke="#bbb"/>`;
  vals.forEach((v,i)=>{const bh=Math.round(v/max*h);const x=x0+30+i*(bw+gap);
    s+=`<rect x="${x}" y="${base-bh}" width="${bw}" height="${bh}" fill="${color}" rx="3"/>`;
    s+=`<text x="${x+bw/2}" y="${base-bh-8}" font-size="14" font-weight="bold" text-anchor="middle" fill="#333">${v}${unit}</text>`;
    s+=`<text x="${x+bw/2}" y="${base+20}" font-size="13" text-anchor="middle" fill="#666">${labels[i]}</text>`;});
  return s;
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="760" height="290" viewBox="0 0 760 290"><rect width="760" height="290" fill="#fff"/>${bars(20,"売上（粗利）の伸び",gross,"万",300,"#4a86c7")}${bars(400,"案件化数の伸び",anken,"件",5,"#6cb86c")}</svg>`;

// テストページ作成
const page=await notion.pages.create({parent:{page_id:PARENT},icon:{emoji:"📊"},properties:{title:[{type:"text",text:{content:"【グラフ試作】佐伯 3ヶ月推移"}}]}});
// file upload (SVG)
try{
  const up=await notion.fileUploads.create({mode:"single_part",filename:"graph.svg",content_type:"image/svg+xml"});
  const blob=new Blob([svg],{type:"image/svg+xml"});
  await notion.fileUploads.send({file_upload_id:up.id,file:blob});
  await notion.blocks.children.append({block_id:page.id,children:[{object:"block",type:"image",image:{type:"file_upload",file_upload:{id:up.id}}}]});
  console.log("画像(SVG)貼り付け OK");
}catch(e){console.log("SVG画像 失敗:",String(e).slice(0,200));}
console.log("ページ:",page.url);
