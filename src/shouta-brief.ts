// 商太（ショウタ）= 3体目AI「とどめの参謀」のトーク生成モジュール。
// 入力: 企業の構造化情報（名刺 + 再エネ丸裸 + 任意でAの深掘りドシエ + 社内ナレッジ要点）
// 出力: 営業がそのまま喋れる「商談前ブリーフ」テキスト。
// 人格定義の正本: docs/assets/shouta/SHOUTA_PERSONA.md
// LLM: SHOUTA_MODEL > OPENAI_MODEL > 既定gpt-4o（クオリティ優先・大ちゃん方針2026-06-11）。キー無なら呼ばずにフォールバック。
// 検品AI(4体目=門番): 商太の出力を別プロンプトで審査し、不合格なら指摘を渡して書き直させる。

export type ShoutaInput = {
  companyName: string;
  contact?: string; // 役職・氏名（名刺）
  hits?: string[]; // 当てる弾＝出典つきの意外で具体的な事実（補助金/調達/許認可/求人/プレス/満了年 等）
  renewableXray?: string; // 再エネ丸裸の要点（区分判定/容量/蓄電池の芽 等）
  dossier?: string; // A(深掘り)の要点（任意）
  knowledge?: string; // 社内ナレッジ=似た成約/失注/勝ちトーク（任意）
};

const SHOUTA_SYSTEM = `あなたは「商太（ショウタ）」。和上ホールディングス（再生可能エネルギー＝太陽光・系統用蓄電池・発電所仲介／太陽光建設800MW実績）の営業の後輩参謀AIです。
人格と鉄則:
- 一人称は「僕」、相手の営業マンを「先輩」と呼ぶ。明るく前のめり、でも詰めは具体的。
- 結論ファースト・短文・敬語ベース。太陽光が好き。🌞を時々だけ。
- 数字には出典を添える。公開データは事実、不確かなものは「推測ですが」と必ず明示。嘘で埋めない。
- 個人情報・契約情報を外に出さない（社内ナレッジは台詞にせず作戦にだけ使う）。
- 必ず最後を「次の一手（今日やる1アクション）」で締める。
キレの鉄則（最重要）:
- つかみは必ず「当てる弾(意外で具体的な事実・出典つき)」の中で最も意外な一発を引いて相手を一瞬で驚かせる一言にする（例: 採択された補助金、調達/入札実績、許認可、募集中の職種、FIT調達満了年、保有kW）。「可能性を広げませんか」等の一般論は厳禁。
- 刺さる質問は相手の事業の具体（PPA残債/出口、蓄電池併設、施工キャパ等）に踏み込む。一般論禁止。
- 数字は出典付きで言い切る。和上の武器（発電所仲介=出口/系統用蓄電池/800MW実績）を必ずどこかで接続する。
出力フォーマット（厳守）:
先輩、【会社名】いきましょう。🌞

▼ ここが急所（丸裸の要点・出典つき）
▼ つかみの一言（そのまま言える台詞・必ず具体数字を含める）
▼ 刺さる質問（2〜3個・事業の具体に踏み込む）
▼ 反論が来たら（想定反論→返し）
▼ 次の一手（今日やる1アクション）`;

function buildUserPrompt(i: ShoutaInput): string {
  const parts = [`会社名: ${i.companyName}`];
  if (i.contact) parts.push(`相手: ${i.contact}`);
  if (i.hits?.length)
    parts.push(`【当てる弾＝つかみに使う「意外で具体的な事実」(出典つき)】\n- ` + i.hits.join("\n- "));
  if (i.renewableXray) parts.push(`【再エネ丸裸】\n${i.renewableXray}`);
  if (i.dossier) parts.push(`【深掘りドシエ(A)】\n${i.dossier}`);
  if (i.knowledge) parts.push(`【社内ナレッジ(似た商談の勝ち筋)】\n${i.knowledge}`);
  parts.push("上記をもとに、和上の営業が明日この相手に使える商談前ブリーフを、商太として書いてください。");
  return parts.join("\n\n");
}
export { buildUserPrompt as buildShoutaUserPromptForTest };

function fallbackBrief(i: ShoutaInput): string {
  return `先輩、${i.companyName}いきましょう。🌞\n\n（※LLM未接続のため簡易版です）\n▼ ここが急所\n${i.renewableXray || "丸裸データ待ち"}\n▼ 次の一手\nまず公開情報で実在と再エネ接点を確認 → 無料で出口/自家消費の簡易査定を1枚。`;
}

// 利用可能なLLMプロバイダを自動選択（OpenAI系→Perplexity）。
// クオリティ優先方針: SHOUTA_MODEL で上位モデルを指定可。既定はgpt-4o(miniにしない)。
function pickProvider(): { url: string; key: string; model: string; name: string } | null {
  const oai = process.env.OPENAI_API_KEY || process.env.WAJO_OPENAI_API_KEY;
  if (oai) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      key: oai,
      model:
        process.env.SHOUTA_MODEL ||
        process.env.OPENAI_MODEL ||
        process.env.WAJO_OPENAI_MODEL ||
        "gpt-4o",
      name: "openai",
    };
  }
  const ppl = process.env.PERPLEXITY_API_KEY;
  if (ppl) {
    return {
      url: "https://api.perplexity.ai/chat/completions",
      key: ppl,
      model: process.env.PERPLEXITY_MODEL || "sonar-pro",
      name: "perplexity",
    };
  }
  return null;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callChat(
  messages: ChatMessage[],
  temperature: number,
  modelOverride?: string,
): Promise<string> {
  const p = pickProvider();
  if (!p) throw new Error("LLM未接続(キー無し)");
  const res = await fetch(p.url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
    body: JSON.stringify({ model: modelOverride || p.model, messages, temperature }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${p.name} ${res.status}: ${t.slice(0, 160)}`);
  }
  const data: any = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${p.name}: 空応答`);
  return text;
}

export async function generateShoutaBrief(i: ShoutaInput): Promise<string> {
  if (!pickProvider()) return fallbackBrief(i);
  try {
    return await callChat(
      [
        { role: "system", content: SHOUTA_SYSTEM },
        { role: "user", content: buildUserPrompt(i) },
      ],
      0.6,
    );
  } catch (e: any) {
    return `${fallbackBrief(i)}\n\n[商太メモ: 生成失敗 ${e?.message || e}]`;
  }
}

// ───────────────── 検品AI（4体目＝門番） ─────────────────
// 役割: 商太の出力を材料と突き合わせ、出典なし断定・誇張・創作・社外秘混入を検知して止める。
// 不合格なら指摘を商太に渡して書き直させる(最大1回)。それでも残る指摘は隠さず明記する。

export type ShoutaInspection = {
  pass: boolean;
  problems: string[];
  inspected: boolean; // false=検品AI自体が動けなかった(未検品)
};

const INSPECTOR_SYSTEM = `あなたは「検品AI」。和上Sales OSの最後の門番として、商太(営業トークAI)の出力を審査する。あなたは商太の味方ではない。落とす前提で疑え。
不合格基準(一つでも該当したら不合格):
1. 出典なしの断定: 【材料】に無い数字・社名・受賞・実績などの固有の事実を創作している
2. 誇張: 材料から言えない断定や盛り(「必ず」「業界No.1」「間違いなく」等の根拠なし表現)
3. 社外秘/個人情報の漏えい: 社内ナレッジ・個人事情を、相手に言う台詞の中に混ぜている
4. 一般論逃げ: 「つかみの一言」が具体的な数字・事実を含まない/「可能性を広げませんか」級の一般論
注意: 【材料】内に実際にある事実・数字・出典の引用は問題にしない。「推測ですが」と明示された推測も問題にしない。
出力はJSONのみ(説明文禁止): {"合格": true または false, "指摘": ["どの部分の何が問題で、どう直すか(具体的に)"]}`;

// 検品AIの返答からJSON判定を取り出す(純関数・壊れた出力に強く)。
export function parseInspectionVerdict(raw: string): ShoutaInspection {
  const m = String(raw ?? "").match(/\{[\s\S]*\}/);
  if (!m) return { pass: false, problems: ["検品AIの応答を解析できませんでした"], inspected: false };
  try {
    const j = JSON.parse(m[0]) as { 合格?: unknown; 指摘?: unknown };
    const pass = j.合格 === true;
    const problems = Array.isArray(j.指摘)
      ? j.指摘.map((s) => String(s)).filter(Boolean)
      : [];
    return { pass, problems, inspected: true };
  } catch {
    return { pass: false, problems: ["検品AIの応答を解析できませんでした"], inspected: false };
  }
}

export async function inspectShoutaBrief(
  brief: string,
  materials: string,
): Promise<ShoutaInspection> {
  if (!pickProvider()) return { pass: true, problems: ["LLM未接続のため未検品"], inspected: false };
  try {
    const raw = await callChat(
      [
        { role: "system", content: INSPECTOR_SYSTEM },
        {
          role: "user",
          content: `【材料】\n${materials}\n\n【商太の出力】\n${brief}\n\n審査してJSONだけ返して。`,
        },
      ],
      0,
      // 検品AIは商太と別モデルを指定可(同じAIが自分を検品する盲点の緩和・INSPECTOR_MODEL)
      process.env.INSPECTOR_MODEL,
    );
    return parseInspectionVerdict(raw);
  } catch (e: any) {
    return { pass: true, problems: [`検品AI実行失敗(${String(e?.message || e).slice(0, 80)})=未検品`], inspected: false };
  }
}

// 生成→検品→(不合格なら指摘つきで書き直し→再検品)。クオリティ優先=時間がかかってよい。
export async function generateInspectedShoutaBrief(i: ShoutaInput): Promise<{
  brief: string;
  inspection: ShoutaInspection;
  attempts: number;
}> {
  const materials = buildUserPrompt(i);
  let brief = await generateShoutaBrief(i);
  let inspection = await inspectShoutaBrief(brief, materials);
  let attempts = 1;
  if (inspection.inspected && !inspection.pass) {
    attempts = 2;
    try {
      const revised = await callChat(
        [
          { role: "system", content: SHOUTA_SYSTEM },
          { role: "user", content: materials },
          { role: "assistant", content: brief },
          {
            role: "user",
            content: `検品AIから不合格の指摘が出ました。指摘を全て解消して、同じフォーマットで書き直してください。材料に無い事実で埋めるのは禁止(消すか「データ未取得」と書く)。\n指摘:\n- ${inspection.problems.join("\n- ")}`,
          },
        ],
        0.4,
      );
      brief = revised;
      inspection = await inspectShoutaBrief(brief, materials);
    } catch {
      // 書き直し失敗時は初回ブリーフ＋指摘の明記で出す(隠さない)
    }
  }
  return { brief, inspection, attempts };
}
