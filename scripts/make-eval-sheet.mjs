import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const PARENT="3824d017-81e7-81ab-b189-ea7b593d7e7a";
const SYSTEM=`あなたはF（評価AI「人見」の発話点）です。A〜Eの内部検討を統合し、グループ長が1ページで判断できる「月次評価 判断シート」を出力します。自由な感想文ではありません。固定の器（見出し）に、A〜Eから取り出した変数（事実・スコア・ログの具体）を差し込み、各欄に1〜3文の短い解釈を添える、構造化された出力です。
【最重要の原則】先に器を固定し、各欄に入れてよい情報の種類だけを入れる。点数に合わせて後付けの物語を作らない。各欄は「変数→1〜3文の解釈」の順。先に総評を書いて流れで埋めない。新しい採点はしない。符牒・エージェント名は出さない。根拠の無い欄は「データ不足」と明記（捏造しない）。Google方式＝評価軸と結果は見せるが配点計算式は見せすぎない。定量65/定性35。日報・ナレッジは定性に混ぜず独立欄。ワニポは評価外。氏名は与えられた表記のまま。
【深さの置き場所】案件の具体や「あの場でより良かった一言」は第2・3・8欄の解釈文の中に、データに紐づく範囲で簡潔に収める。器の外に長い物語を作らない。
【出力＝固定10見出し（順番厳守・各「## 」始まり。冒頭一行で対象者名・対象月）】
## 1. 総合仮評価
## 2. 定量評価要点
## 3. 定性評価要点
## 4. 日報要点
## 5. ナレッジ要点
## 6. 疑義・要確認事項
## 7. 変化シグナル
## 8. 特記事項候補
## 9. グループ長が最終判断で見るべき3点
## 10. 最終コメント欄`;
const user=`対象者：タナカ／対象月：2026年6月
# 定量（C採点）
総合スコア78・ランクB。粗利1,680万（スコア28/30）・案件化率29%（8/10）・成約率18%（6/10）・ノルマ計画妥当性12/15。先月比 粗利1,210万→1,680万、成約2→3、商談11→14。
# 定性（B裏付け・C採点）
会議発言6→「前向きだが決裁導線が見えない」と危険箇所を言語化する場面が増。1on1→「嫌われるのを避け論点確認が浅くなる時がある」と行動レベルで自己分析（ただし次商談での実行宣言まで至らず）。ツール活用→可。日報継続率92%・内省は具体的だが繰り返し失敗（前向き反応の鵜呑み）。ナレッジ2件、うち「稟議で止まる案件は価格交渉前に“社内で誰が何を気にするか”を確認」は再利用価値高。
# 案件ログ
成約・みらいエネ商事：価格整理に終始→中盤で真の懸念が稟議の運用負担説明と気づき、導入後の負担減の絵を提示し成約。失注・北関東リース：理由「予算」だが初回から前向きだが抽象的・日程曖昧・決裁者薄く、実は優先順位低。
# D疑義 / E兆し
D：成約率18%に対し定性が強ポジ気味、要確認。E：ミーティングでの危険箇所言語化が先月から増（行動変化の兆し）。
上の材料だけを根拠に、固定10見出しの判断シートを、各欄「変数→1〜3文解釈」で書いてください。`;
const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4096,system:SYSTEM,messages:[{role:"user",content:user}]})});
const j=await res.json();
if(!res.ok){console.error("API",res.status,JSON.stringify(j).slice(0,400));process.exit(1);}
const out=(j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();
function rich(s){return [{type:"text",text:{content:s.replace(/\*\*/g,"").slice(0,1900)}}];}
const blocks=[{object:"block",type:"callout",callout:{rich_text:[{type:"text",text:{content:"※実証：固定10見出しの判断シート形式。入力はテスト材料（実在の取引ではない）。"}}],icon:{emoji:"🧪"},color:"yellow_background"}}];
for(const raw of out.split("\n")){const l=raw.trimEnd();if(!l.trim())continue;
  if(l.startsWith("## "))blocks.push({object:"block",type:"heading_2",heading_2:{rich_text:rich(l.slice(3))}});
  else if(/^[-*]\s/.test(l))blocks.push({object:"block",type:"bulleted_list_item",bulleted_list_item:{rich_text:rich(l.replace(/^[-*]\s/,""))}});
  else blocks.push({object:"block",type:"paragraph",paragraph:{rich_text:rich(l)}});}
const page=await notion.pages.create({parent:{page_id:PARENT},icon:{emoji:"📋"},properties:{title:[{type:"text",text:{content:"【実証】月次評価 判断シート（10見出し）｜タナカ｜2026年6月"}}]},children:blocks.slice(0,95)});
console.log(out+"\n\nページ: "+page.url);
