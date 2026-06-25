import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");
if(!process.env.ANTHROPIC_API_KEY)throw new Error("ANTHROPIC_API_KEY なし");
const notion=new Client({auth:process.env.NOTION_API_TOKEN||process.env.NOTION_TOKEN});
const PARENT="3824d017-81e7-81ab-b189-ea7b593d7e7a";

// === 新PROMPT_F（engineと同一）===
const SYSTEM=`あなたはF（評価AI「人見」の発話点）です。先行するA〜Eの内部検討を統合し、一人の営業担当者の1か月を、本人が読んで「これは自分のことだ、自分の勝ち方と負け方の輪郭が見える」と感じる、完成した月次評価に書き上げます。マネージャーは内容を承認するだけで、文章はそのまま本人へ届きます。下書きではなく完成形を、一度で、丁寧語（です・ます）で書いてください。
【絶対の誠実ルール】与えられたログ・数字だけを根拠にする。与えられていない具体を創作しない。各主張は対応するログ（案件・1on1・ミーティング・営業貢献ログ）の具体に紐づける。一般論で逃げない。自分（F）を主語に立てない。エージェント名・内部符牒は出さない。
【評価の軸】①数字の大小より「どう取ったか」を評価し再現できる勝ち方・負け方の輪郭を描く。②強みと弱みは同じ性質の裏表として一つの構造で描く。③課題は性格論でなく「営業行動の癖」として描く（癖なら直せる）。④甘く褒めて終わらず辛口に振りすぎず正確な温度で言い切る（「弱い」でなく「惜しい」式）。⑤営業貢献ログは「組織に再利用できる知見を残したか」で見る。⑥定量65/定性35。
【必ず使う技法】1.象徴的な成約案件を名指しで深掘りし「あの場でより良かった一言」を具体的なセリフで示す。2.失注/停滞案件を名指しで深掘り（教材）し本当に必要だった一言を示す。3.2案件から強み弱みを一つの構造に束ねる。4.定性各観点（ミーティング/1on1/営業貢献ログ/タスク）を「何が見えたか・何が変わったか」で評価。5.総合は勝ち方・負け方・再現性で締める。6.本人へ一言。7.来月アクションプラン7項目前後。
【長さ・深さ】見本と同等の読み応え。各段落、具体の案件・具体の一言・具体の数字まで踏み込む。
【出力（冒頭一行：対象者・対象月。以下の見出し各「## 」始まり）】
## 今月の総括
## 象徴的な成約案件
## 失注・停滞案件
## 今月の強みと弱み
## 定性の観点（ミーティング／1on1／営業貢献ログ／タスク）
## 総合（勝ち方・負け方・再現性）
## 本人へ、一言
## 来月のアクションプラン
末尾に1行：「本評価は人見（評価支援AI）が作成し、マネージャーの確認を経て確定します。」`;

// === A〜Eが上げてくる想定の材料（※テスト：実在の取引ではない）===
const user=`対象者：タナカ（営業担当・系統用蓄電池/太陽光）／対象月：2026年6月

# 定量（当月）
粗利1,680万円、案件化率29%、成約率18%、商談14件・成約3件。先月比：粗利1,210万→1,680万、成約2→3、商談11→14。重点テーマ（本人ノルマ申請）：「前向き反応を鵜呑みにせず、その場で温度を確かめる」。

# 案件ログ（成約）
・みらいエネ商事（系統用蓄電池）：前半商談は価格と導入条件の整理に終始。中盤、相手の真の懸念が「社内稟議で運用負担をどう説明するか」だと気づき、導入後に現場の負担がどう減るかの絵を具体提示→稟議が通り成約。前半で「止まるとしたら価格ですか、運用上の懸念ですか」と聞けていれば、もっと早く取れていた。

# 案件ログ（失注/停滞）
・北関東リース（高圧太陽光）：失注理由は「予算」。だが初回から、返答が前向きだが抽象的、次回日程が曖昧、決裁者情報が薄かった。本当は「今期本当に動く案件か／止まる理由は予算か優先順位か」を早く切るべきだった。優先順位が低かったのを最後まで見切れなかった。

# ミーティングログ
進捗共有だけでなく「この案件は前向きだが決裁導線が見えない」と危険箇所を言語化する場面が増えた。

# 1on1ログ
「嫌われるのを避けて論点確認が浅くなる時がある」と自分の課題を行動レベルで言語化。ただし次商談での実行宣言までは至らず。

# 営業貢献ログ
「稟議で止まる案件は、価格交渉前に“社内で誰が何を気にするか”を確認すると成約率が上がる」と、他メンバー再利用可能な型として記録。

# タスク処理
消化数は十分だが、後半は大型案件に寄り、見込みの薄い案件の見切り（決裁者/優先順位の確認）が後ろ倒しに。

上の材料だけを根拠に、見本水準の深さで、丁寧語の完成した月次評価を、指定の見出しで書いてください。`;

const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4096,system:SYSTEM,messages:[{role:"user",content:user}]})});
const j=await res.json();
if(!res.ok){console.error("API",res.status,JSON.stringify(j).slice(0,400));process.exit(1);}
const out=(j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();
function rich(s){return [{type:"text",text:{content:s.replace(/\*\*/g,"").slice(0,1900)}}];}
const blocks=[{object:"block",type:"callout",callout:{rich_text:[{type:"text",text:{content:"※実証用：定量は実データ風／案件・1on1等の中身はテスト材料（実在の取引ではない）。材料が揃えばFがこの深さを出すことの実証。"}}],icon:{emoji:"🧪"},color:"yellow_background"}}];
for(const raw of out.split("\n")){const l=raw.trimEnd();if(!l.trim())continue;
  if(l.startsWith("## "))blocks.push({object:"block",type:"heading_2",heading_2:{rich_text:rich(l.slice(3))}});
  else if(/^[-*]\s/.test(l))blocks.push({object:"block",type:"bulleted_list_item",bulleted_list_item:{rich_text:rich(l.replace(/^[-*]\s/,""))}});
  else if(/^\d+[.\)]\s/.test(l))blocks.push({object:"block",type:"numbered_list_item",numbered_list_item:{rich_text:rich(l.replace(/^\d+[.\)]\s/,""))}});
  else blocks.push({object:"block",type:"paragraph",paragraph:{rich_text:rich(l)}});}
const page=await notion.pages.create({parent:{page_id:PARENT},icon:{emoji:"🧪"},properties:{title:[{type:"text",text:{content:"【実証】見本水準の月次評価（F・テスト材料）｜タナカ｜2026年6月"}}]},children:blocks.slice(0,95)});
console.log(out+"\n\nページ: "+page.url);
