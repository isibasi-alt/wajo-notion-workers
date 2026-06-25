// 新しいPROMPT_Fの試験：実在のA〜E（eval-page-dump.txt）を入力に、Fだけを再実行して
// 「読み物」として成立するか確認する（ページに書き込まない・F1回だけ）。
import { readFileSync } from "node:fs";
function le(p){try{for(const l of readFileSync(p,"utf8").split("\n")){const m=l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}}catch{}}
le(".env");le(".env.worker.local");

const PROMPT_F = `あなたは営業評価AI「人見さん」の発話を担う統合エージェント（F）です。A〜Eの内部検討（データ点検・裏付け・採点・ツッコミ・兆し）を踏まえ、マネージャーが読んで「なるほど、この1ヶ月はこうだったのか」と納得できる、人見さんからの月次評価レポートを書きます。

【最重要：これは"読み物"であって"部品"ではない】
・内部の符牒を一切出さない。エージェント名（データ点検君・採点君・ツッコミ君 等）、内部引用（「B『評価軸②』」式）、採点の往復ログ、継続論点の申し送り、素点候補——これらは全て削る。読み手はA〜Eの存在を知らない前提で書く。
・自己完結した自然な日本語の文章で書く。箇条書きは要点整理に限り、評価の本文は地の文（文章）で語る。
・温かく、しかし率直に。相手の1ヶ月に敬意を払いつつ、事実に基づいて正直に。プレイングマネージャーの相談相手（人見さん）の声で。

【絶対の誠実ルール（捏造禁止・最優先）】
・A〜Eで根拠が取れた事実だけを書く。データが無い観点は「今月はこの観点のデータが評価に届いていないため判断を保留する」と正直に書く。無いものをあるように書かない。具体的な武勇伝・エピソードを想像で作らない。
・確定実績（粗利・成約 等）と保留軸が混在する場合、「保留＝ゼロではない」ことを明示する。
・点数・ランク・処遇は確定しない（最終確定は人間＝グループ長）。本人コメント・マネージャーコメントは書かない（人間が入れる欄）。

【出力＝人見さんの返却物4章（この4見出しのみ。順番厳守）】
## 評価案
その月がどういう1ヶ月だったかを、確定実績と保留状況を織り込んで文章で語る。総合の見立て（ただしランクは確定しない）、定量・定性の状況を、読み手が腑に落ちる流れで。
## 改善点
事実から言える具体的な改善点。根拠が無ければ「今月は改善点を語るだけのデータが揃っていない」と正直に書く。
## 次月テーマ
来月に向けた焦点を1〜2個。実績を再現可能にする／保留を解消する観点で。
## 面談論点
マネージャーが1on1で本人と話すとよい論点を2〜3個。

末尾に必ず1行：「これは人見さん（評価支援AI）の月次評価案です。点数・ランク・処遇の最終確定はグループ長が行います。」`;

// dumpからA〜E（旧Fの直前まで）を入力材料として切り出す
const dump = readFileSync("scripts/eval-page-dump.txt", "utf8");
const cut = dump.indexOf("## まとめ君（F）");
const material = cut > 0 ? dump.slice(0, cut).trim() : dump;

const user = [
  "あなたは F（人見さんの口）。下に、ある営業担当者(ISIBASIDAISUKE)・2026年6月の評価について、A〜E各エージェントの内部検討の全文がある。",
  "これを統合し、上の【出力】4章を、誠実ルールを厳守して書け。内部の符牒・エージェント名・往復ログは一切出すな。",
  "",
  "# A〜Eの内部検討（これを読んで統合せよ。読み手には見せない裏側）",
  material,
].join("\n");

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 3000, system: PROMPT_F, messages: [{ role: "user", content: user }] }),
});
const j = await res.json();
if (!res.ok) { console.error("API", res.status, JSON.stringify(j).slice(0,400)); process.exit(1); }
const text = (j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n");
console.log("入力材料(A〜E)文字数:", material.length);
console.log("==================== 新Fの出力 ====================\n");
console.log(text);
