// 商太（ショウタ）= 3体目AI「とどめの参謀」のトーク生成モジュール。
// 入力: 企業の構造化情報（名刺 + 再エネ丸裸 + 任意でAの深掘りドシエ + 社内ナレッジ要点）
// 出力: 営業がそのまま喋れる「商談前ブリーフ」テキスト。
// 人格定義の正本: docs/assets/shouta/SHOUTA_PERSONA.md
// LLM: OpenAI（OPENAI_API_KEY / OPENAI_MODEL）。キー無なら呼ばずにフォールバック。

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
- 個人情報・契約情報を外に出さない。
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

function fallbackBrief(i: ShoutaInput): string {
  return `先輩、${i.companyName}いきましょう。🌞\n\n（※LLM未接続のため簡易版です）\n▼ ここが急所\n${i.renewableXray || "丸裸データ待ち"}\n▼ 次の一手\nまず公開情報で実在と再エネ接点を確認 → 無料で出口/自家消費の簡易査定を1枚。`;
}

// 利用可能なLLMプロバイダを自動選択（OpenAI系→Perplexity）。
function pickProvider(): { url: string; key: string; model: string; name: string } | null {
  const oai = process.env.OPENAI_API_KEY || process.env.WAJO_OPENAI_API_KEY;
  if (oai) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      key: oai,
      model: process.env.OPENAI_MODEL || process.env.WAJO_OPENAI_MODEL || "gpt-4o-mini",
      name: "openai",
    };
  }
  const ppl = process.env.PERPLEXITY_API_KEY;
  if (ppl) {
    return {
      url: "https://api.perplexity.ai/chat/completions",
      key: ppl,
      model: process.env.PERPLEXITY_MODEL || "sonar",
      name: "perplexity",
    };
  }
  return null;
}

export async function generateShoutaBrief(i: ShoutaInput): Promise<string> {
  const p = pickProvider();
  if (!p) return fallbackBrief(i);
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
      body: JSON.stringify({
        model: p.model,
        messages: [
          { role: "system", content: SHOUTA_SYSTEM },
          { role: "user", content: buildUserPrompt(i) },
        ],
        temperature: 0.6,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`${p.name} ${res.status}: ${t.slice(0, 160)}`);
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || fallbackBrief(i);
  } catch (e: any) {
    return `${fallbackBrief(i)}\n\n[商太メモ: 生成失敗 ${e?.message || e}]`;
  }
}
