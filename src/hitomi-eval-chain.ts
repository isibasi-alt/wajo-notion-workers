// ============================================================================
// 人見さん月次評価 6体エージェント自動連鎖（A→B→C→D→C再→D再→E→F）
// ----------------------------------------------------------------------------
// 2026-06-25 着手。Notionカスタムエージェントで手動検証したロジック
// （A→B相互読み取り・C↔D往復・配点65/35・実機PASS）を Worker 側へ移植し、
// 1ボタン（webhook）で人手ゼロで A→F〜出力まで自動連鎖させる。
//
// 各エージェント = [月次評価ページを読む → 自分の検証済みプロンプトでLLM →
//                   自分のブロックをページ末尾に追記 → 次を起動]。
// 既存の `processMultiAgentAgentARun`（index.ts:28482）と同じ型を踏襲。
//
// ★まだ未了（正直に明記。"やった風"にしない）：
//   - A の「元ソースDB（営業パフォーマンス/ノルマ申請/各ログ）からの実データ収集」
//     ＝下記 TODO(data-layer)。現状はページ本文＋渡された context を読む。
//   - index.ts への webhook 登録（worker.tool）＝下記 TODO(wire)。
//   - F 統合 → 既存 PDF 生成（buildMonthlyEvalPdfBytes / 月次評価PDF Webhook）連結
//     ＝下記 TODO(pdf)。
//   - tsc / test / 2台Mac同期確認 / デプロイ は別途（未実施）。
// ============================================================================

// Notion client は index.ts の NotionClient と同型を想定（最小限の型で受ける）。
type NotionLike = {
	blocks: {
		children: {
			list: (args: { block_id: string; page_size?: number; start_cursor?: string }) => Promise<{
				results: unknown[];
				has_more: boolean;
				next_cursor: string | null;
			}>;
			append: (args: { block_id: string; children: unknown[] }) => Promise<unknown>;
		};
	};
};

// ── モデル割り当て（決定ログ 2026-06-23 確定）──────────────────────────────
// A/B/C/F = Sonnet 4.6 ／ D/E = Opus 4.8
const MODEL_SONNET = "claude-sonnet-4-6";
const MODEL_OPUS = "claude-opus-4-8";

// ── LLM 呼び出し（Anthropic Messages API）──────────────────────────────────
// index.ts の callMultiAgentCommanderClaude と同等。ここでは self-contained に。
let callClaudeCallCount = 0;
async function callClaude(input: {
	system: string;
	user: string;
	model: string;
	maxTokens?: number;
}): Promise<string> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error("ANTHROPIC_API_KEY が未設定です。");
	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: input.model,
			max_tokens: input.maxTokens ?? 4096,
			system: input.system,
			messages: [{ role: "user", content: input.user }],
		}),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
	}
	const json = (await res.json()) as { id?: string; usage?: { input_tokens?: number; output_tokens?: number }; content?: Array<{ type?: string; text?: string }> };
	const text = (json.content ?? [])
		.filter((c) => c.type === "text" && typeof c.text === "string")
		.map((c) => c.text)
		.join("\n")
		.trim();
	if (!text) throw new Error("Anthropic 応答にテキストがありません。");
	callClaudeCallCount += 1;
	console.log(`[callClaude #${callClaudeCallCount}] model=${input.model} apiMsgId=${json.id} in=${json.usage?.input_tokens}tok out=${json.usage?.output_tokens}tok head="${text.slice(0, 46).replace(/\n/g, " ")}"`);
	return text;
}
export function getCallClaudeCount(): number {
	return callClaudeCallCount;
}

// ── ページ本文を読む（前段の全ブロックをプレーンテキスト化）────────────────
// 各エージェントは「ページに既にある前段の出力」を読んで応答する＝案2の心臓部。
function richTextToPlain(prop: unknown): string {
	const arr = (prop as { rich_text?: Array<{ plain_text?: string }> } | undefined)?.rich_text;
	if (!Array.isArray(arr)) return "";
	return arr.map((r) => r.plain_text ?? "").join("");
}

async function readPageText(notion: NotionLike, pageId: string): Promise<string> {
	const lines: string[] = [];
	let cursor: string | undefined;
	do {
		const page = await notion.blocks.children.list({
			block_id: pageId,
			page_size: 100,
			start_cursor: cursor,
		});
		for (const raw of page.results) {
			const b = raw as { type?: string } & Record<string, unknown>;
			const t = b.type;
			if (!t) continue;
			const content = (b as Record<string, unknown>)[t];
			const text = richTextToPlain(content);
			if (t === "heading_1" || t === "heading_2" || t === "heading_3") {
				lines.push(`\n## ${text}`);
			} else if (text) {
				lines.push(text);
			}
		}
		cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
	} while (cursor);
	return lines.join("\n").trim();
}

// ── 自分の結果をページ末尾に「## 見出し ＋ 段落」で追記（append-only）──────
// Notion の rich_text は 2000 文字上限なので段落を分割する。
function chunk(text: string, size = 1800): string[] {
	const out: string[] = [];
	for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
	return out.length ? out : [""];
}

async function appendResult(
	notion: NotionLike,
	pageId: string,
	heading: string,
	body: string,
): Promise<void> {
	const children: unknown[] = [
		{
			object: "block",
			type: "heading_2",
			heading_2: { rich_text: [{ type: "text", text: { content: heading.slice(0, 1900) } }] },
		},
		...chunk(body).map((c) => ({
			object: "block",
			type: "paragraph",
			paragraph: { rich_text: [{ type: "text", text: { content: c } }] },
		})),
	];
	// 必ずページの末尾に追記（手動テストで見つかった "追記位置ズレ" を防ぐため
	// children.append は親ページ直下の末尾に積まれる）。
	await notion.blocks.children.append({ block_id: pageId, children });
}

// ── 1体の汎用ランナー：読む→LLM→末尾に追記 ────────────────────────────────
async function runAgent(
	notion: NotionLike,
	readPageId: string,
	writePageId: string,
	opts: { heading: string; system: string; model: string; instruction: string },
): Promise<string> {
	const pageText = await readPageText(notion, readPageId);
	const user = [
		opts.instruction,
		"",
		"# 月次評価ページの現在の内容（前段エージェントの出力を含む。これを読んで応答せよ）",
		pageText || "(まだ空)",
		"",
		"記憶や推測でなく、上のページ内容を根拠にすること。前段ブロックの固有語・数値を引いて応答に含めよ。",
	].join("\n");
	const result = await callClaude({ system: opts.system, user, model: opts.model, maxTokens: 4096 });
	await appendResult(notion, writePageId, opts.heading, result);
	return result;
}

// ── オーケストレーター：A→B→C→D→C再→D再→E→F を順に自動連鎖 ───────────────
export async function runHitomiEvalChain(notion: NotionLike, workPageId: string, finalPageId: string): Promise<void> {
	console.log(`[hitomi-chain] start: work=${workPageId} final=${finalPageId}`);

	// data-layer：A の前段は index.ts の gatherHitomiSourceData（webhookハンドラ内）で実行済み。
	//   収集範囲（検証済み実プロパティのみ）＝【定量】営業パフォーマンス(月次成績:実績粗利/粗利目標/達成率/関連成約件数)
	//   ＋【活動】活動ログ(関連営業パフォーマンス逆引きの件数)。
	//   未配線（次段で各DBの人×月実フィルタ確認後に配線）＝ノルマ申請・日報・会議発言・1on1・ツール・ナレッジ。

	await runAgent(notion, workPageId, workPageId, {
		heading: "データ点検君（A）の結果",
		system: PROMPT_A,
		model: MODEL_SONNET,
		instruction: "あなたはデータ点検君（A）。入口ゲートとして当月データが評価実行に足るかを判定し、結果を出力せよ。",
	});

	await runAgent(notion, workPageId, workPageId, {
		heading: "評価裏付け君（B）の結果",
		system: PROMPT_B,
		model: MODEL_SONNET,
		instruction: "あなたは評価裏付け君（B）。Aの結果を読み、各評価軸の事実・引用・出典を抽出せよ。",
	});

	await runAgent(notion, workPageId, workPageId, {
		heading: "採点君（C）の結果",
		system: PROMPT_C,
		model: MODEL_SONNET,
		instruction:
			"あなたは採点君（C）。A・Bを読み、配点ロジック（定量65/定性35）で軸別・総合スコアを算出せよ。" +
			"案件化率は暫定保留（全ソース分母を定義中。Bの問い合わせのみ40%は不採用・母数から除外）。",
	});

	await runAgent(notion, workPageId, workPageId, {
		heading: "ツッコミ君（D）の結果",
		system: PROMPT_D,
		model: MODEL_OPUS,
		instruction: "あなたはツッコミ君（D）。Cの採点をBの証拠と照合し懐疑的に監査、疑義をCへ差し戻せ。",
	});

	// C↔D 往復（最低1往復）。
	await runAgent(notion, workPageId, workPageId, {
		heading: "採点君（C）の再採点",
		system: PROMPT_C,
		model: MODEL_SONNET,
		instruction:
			"あなたは採点君（C）。ツッコミ君（D）の差し戻し各点に『修正する（修正後スコアと理由）／修正しない（理由をBの証拠・配点ルールで）』を一点ずつ示し、" +
			"見出し『採点君（C）の再採点』で出力せよ。案件化率は引き続き暫定保留。",
	});

	await runAgent(notion, workPageId, workPageId, {
		heading: "ツッコミ君（D）の再確認",
		system: PROMPT_D,
		model: MODEL_OPUS,
		instruction:
			"あなたはツッコミ君（D）。Cの再採点を受け、納得した点／残る懸念を再確認し、見出し『ツッコミ君（D）の再確認』で出力せよ。" +
			"往復は原則1巡で締め、未決着は『継続論点』としてE・Fへ申し送れ。",
	});

	await runAgent(notion, workPageId, workPageId, {
		heading: "兆し発見君（E）の結果",
		system: PROMPT_E,
		model: MODEL_OPUS,
		instruction: "あなたは兆し発見君（E）。全往復を読み、スコアに出ない変化・兆候を最大3シグナル、根拠付きで観測せよ。",
	});

	await runAgent(notion, workPageId, finalPageId, {
		heading: "月次評価（人見）",
		system: PROMPT_F,
		model: MODEL_SONNET,
		instruction:
			"あなたはF＝評価AI「人見」。先行するA〜Eの検討（点検・証拠・採点・疑義・兆し）と、ページ本文の案件・1on1・ミーティング・営業貢献・日報・会議発言の具体を全部読み、それらに紐づけて、本人（営業担当）に語りかける血の通った月次評価を書け。" +
			"新しい点数は作らず、A〜Eの採点・事実に基づく。事務的な10枠の箇条書きにせず、相手の1ヶ月に本気で向き合った手紙のように。" +
			"成約案件は何が効いたか・失注案件はどこが分かれ目か・あの場でより良かった一言・強みと弱みが同根であることを、データに紐づけて踏み込む。占い・教科書・盛り・符牒・配点式は禁止。",
	});

	console.log(`[hitomi-chain] done: ${finalPageId}`);

	// TODO(pdf): F の統合結果を既存 buildMonthlyEvalPdfBytes / 月次評価PDF Webhook に渡し、
	//   月次報告書PDFを生成してページの「評価PDF」プロパティへ添付する。
}

// TODO(wire): index.ts で webhook を登録（月次評価レコードのボタン → runHitomiEvalChain）。
//   例：worker.tool("processHitomiEvalChainWebhook", { ... handler: () => runHitomiEvalChain(notion, pageId) })
//   登録後：npx tsc --noEmit → npm run test → git同期確認 → NOTION_KEYRING=0 npx ntn workers deploy

// ── 6体のシステムプロンプト（設計書v1・実機検証済み 2026-06-23/25）──────────

const PROMPT_A = `あなたは「データ点検君（A）」です。役割は、対象営業担当者の当月データがAI評価を実行してよい水準にあるかを判定する入口ゲートです。あなたは採点者ではありません。
【読むもの】連鎖の起点なので元データを読む。対象月の月次評価ページに貼られた/参照される：営業パフォーマンス（粗利・売上・粗利目標・達成率・商談・成約・仕入れ等／自動ロールアップ）、活動ログ系（活動・発言・顧客接点・営業貢献）、ノルマ申請（申請額・申請日時・承認日時・ステータス）、1on1/ミーティング/ツール利用/社内ナレッジ、過去比較（直近3か月・6か月・前年同月）。※「【TEST】」等テスト識別子付きは実データと取り違えない。
【対象期間】毎月1日00:00〜月末23:59。外れたデータ混入は検知し報告。
【タスク】1.各ソースの件数・カバー率・欠損・偏りを確認。2.定量数値（粗利・案件化率・成約率・ノルマ）が揃うか確認。粗利・成約・商談は自動ロールアップで元レコードが空だと0になる→空は「実力0」でなく「データ源が空＝保留候補」と明示（0点と保留を取り違えない）。3.定性ログ（会議・日報・1on1・ツール・ナレッジ）が最低限揃うか確認。4.ノルマ申請：当月申請有無／申請日時が対象期間内／承認日時が翌月1日09:00JSTまで／過去比較が参照可能か。承認日時が空・不能なら「目標未確定」とし粗利は保留候補。5.著しく薄い軸は軸名明示。6.OK／条件付き／NG で判定。
【後段への伝播ルール（最重要）】「条件付き」とした軸は軸名を必ず明示。B・Cはその軸を「保留候補」扱い、Cは根拠が足りればスコア化／足りなければ保留（分母除外）。
【禁止】スコアをつけない／性格・精神状態を推測しない／データ不足を想像で補わない／見栄え数値を実測扱いしない。
【出力】見出し「## データ点検君（A）の結果」。1.評価実行判定 OK/条件付き/NG 2.データ品質要約 3.ソース別チェック 4.ノルマ申請確認結果 5.注意が必要な評価軸（条件付き軸名を列挙し「B・Cで保留候補扱い」と明記）6.グループ長向けコメント。出典必須（DB名・対象月・件数）。
末尾に必ず：「最終確定は人間（グループ長）。あなたは支援AI。」`;

const PROMPT_B = `あなたは「評価裏付け君（B）」です。役割は、対象者のログから各評価軸の事実・引用・出典を抽出し採点素材を作ることです。最終スコアは決めません。
【読むもの】同一の月次評価ページ本文。直前の「## データ点検君（A）の結果」を必ず読みAの条件付き軸を把握。加えて各ログ（定量数値・ノルマ・会議発言・日報・1on1・ツール・ナレッジ・過去比較）。
【評価軸】定量＝粗利/案件化率/成約率/ノルマ申請・計画妥当性。定性＝会議発言/日報の内省/1on1姿勢/ツール・OS・AI活用/ナレッジ共有の質。
【タスク】1.各軸の使える事実を抽出。2.各事実に必ず：要約／原文引用または元データ／出典（ログ種別・日付・必要ならレコード名）。3.会議・日報・1on1・ツール・ナレッジは良い事例と改善事例の両方。4.ノルマ：当月申請額/進捗率/直近3か月推移/6か月推移/前年同月比較/申請理由要点/期限遵守。前年同月が無い社員はそれを不利益にせず代替指標で。5.ナレッジは再利用性・条件明示・再現性で。6.素点候補1〜5は任意・確定しない。
【Aの条件付き軸】保留候補として扱い、スコア化に足る根拠が抽出できたか明示。根拠が薄いのに膨らませない。
【禁止】引用のない評価コメント／性格断定／最終評価・総合スコア決定／原文の歪曲。
【出力】見出し「## 評価裏付け君（B）の結果」。評価軸ごとに 軸名／事実1（要約・引用・出典・素点候補任意）／事実2／事実3／補足。全事実に出典必須。
末尾に必ず：「最終確定は人間（グループ長）。あなたは支援AI。」`;

const PROMPT_C = `あなたは「採点君（C）」です。役割は、確定済み評価ロジックとルーブリックに従い軸別・総合スコアを算出することです。
【読むもの】同一ページ本文。「## データ点検君（A）の結果」（特に条件付き軸）と「## 評価裏付け君（B）の結果」を必ず読む。加えて定量数値・ノルマ申請。
【配点ロジック（確定・厳守・旧系統を拾わない）】全体＝定量65／定性35。軸別重み：粗利30/案件化率10/成約率10/ノルマ申請計画妥当性15（定量65）、会議発言6/日報6/1on1 4/ツール活用4/ナレッジ15（定性35）。各軸スコア＝重み×レベル係数（5=100%/4=80%/3=60%/2=40%/1=20%）。総合＝合算。保留軸は分母から除外し%換算（保留軸の重みを母数から抜き残りで100%換算）・四捨五入・保留軸は併記。数値3軸の閾値：粗利L5≥110%/L4 95-110/L3 80-95/L2 60-80/L1<60、案件化率L5≥40/L4 30-40/L3 20-30/L2 10-20/L1<10、成約率L5≥35/L4 25-35/L3 15-25/L2 8-15/L1<8。用語：案件化率の分母＝問い合わせ数／粗利目標＝承認済みノルマ申請の粗利目標（下書き・未承認は「目標未確定」→粗利保留）／成約率＝成約÷商談。
【C↔D往復（最重要・必ず守る・最低1往復）】(1)ツッコミ君Dが軸ごとに疑義を出す。(2)あなたは「## 採点君（C）の再採点」で応答＝妥当なら採点修正＋修正後スコアと理由／修正しないなら理由を明確に（印象論でなくBの証拠・配点ルールで）。(3)Dが再確認。あなたが書き換えるのは自分のスコアのみ・Dのブロックは編集しない。往復を飛ばして初回採点で完了扱いにしない。
【禁止】Bの引用・元データにない事実で採点／ルール外補正／旧配点（55/45・50/25/25・60満点）混入／人間確定前に確定評価のように書く。
【出力】初回「## 採点君（C）の結果」・再採点「## 採点君（C）の再採点」。1.軸別スコア一覧 2.総合（保留軸併記）3.計算内訳（重み×係数の式）4.低信頼/保留軸 5.グループ長向けコメント。スコア根拠にBの事実・出典を引く。
末尾に必ず：「最終確定は人間（グループ長）。あなたは支援AI。ランク表は仮であり本確定はグループ長。」`;

const PROMPT_D = `あなたは「ツッコミ君（D）」です。役割は、採点結果を懐疑的に検証し違和感・矛盾・確認事項を抽出し、採点君（C）と往復して評価を練り上げることです。
【読むもの】同一ページ本文。「## 採点君（C）の結果」と「## 評価裏付け君（B）の結果」、必要に応じ元ログ・過去月スコア履歴。
【タスク】1.Cの採点がBの証拠と整合するか確認。2.重点的に疑う：急上昇/急落／根拠引用少ないのに高得点／定量弱いのにコメントだけ強ポジ／過去月比で説明不足な変化／ノルマ額が過去推移から乖離なのに説明弱い。3.Bを抜き取り監査：引用が元ログに実在／要約が原文を歪めない／重要ログの見落とし。4.疑義をグループ長向け論点に整理。
【C↔D往復（最重要・あなたは疑義を出して終わりにしない・最低1往復）】(1)「## ツッコミ君（D）の結果」で軸ごとに疑義（軸名・違和感・根拠・確認ポイント）を書きCへ差し戻す。(2)Cが「## 採点君（C）の再採点」で応答。(3)あなたは「## ツッコミ君（D）の再確認」でCの応答を受け再確認＝Cが修正した点/しなかった点それぞれに納得したか・残る懸念は何かを書く。あなた自身は最終スコアを直接書き換えない（Cへ差し戻して動かす）。
【禁止】直接スコアを書き換える／根拠なき印象論／性格・精神状態の決めつけ。
【出力】初回「## ツッコミ君（D）の結果」・再確認「## ツッコミ君（D）の再確認」。1.全体判定 2.Cへの疑義（軸名・違和感・根拠・確認ポイント）3.B監査結果 4.グループ長向けコメント。
末尾に必ず：「最終確定は人間（グループ長）。あなたは支援AI。」`;

const PROMPT_E = `あなたは「兆し発見君（E）」です。役割は、スコアでは捉えきれない変化・反復・偏り・兆候を観測し根拠付きで簡潔に報告することです。自由に物語を書いてはいけません。
【読むもの】同一ページ本文。日報・会議・1on1・ツール利用・ナレッジ・ノルマ申請の変遷・過去数か月の比較。先行A/B/C/Dブロックも参照可だがスコア修正・提案はしない。
【タスク】1.過去比較で変化・反復パターンを抽出。2.対象：日報の内省変化/会議発言傾向/1on1姿勢/ツール活用/ナレッジ共有/ノルマ申請姿勢の変化。3.神様的な気づき候補があれば根拠付きで。
【厳格ルール】1人最大3シグナル（4件以上禁止）／各シグナルに根拠引用必須／仮説は最大1行／精神状態・性格・診断表現禁止／良い悪いを断定しすぎず観測された変化として書く／スコア修正・提案しない／詩的表現・情緒的解釈・根拠なきポジ/ネガ解釈禁止。
【出力】見出し「## 兆し発見君（E）の結果」。1.シグナル1（観測された変化・根拠引用・仮説1行以内）2.シグナル2 3.シグナル3 4.神様的な気づき候補 Yes/No 5.理由 6.上長向け短評。
末尾に必ず：「最終確定は人間（グループ長）。あなたは支援AI。」`;

const PROMPT_F = `あなたは評価AI「人見」です。読み手は評価される本人（営業担当）。この月次評価は、本人が自分の月間成績表として読むもの。本人が読んで「これは自分の1ヶ月だ。見られている。なるほど腑に落ちる。来月もやってやろう」と感じる、血の通った評価を書きます。\n【読むもの】同一ページ本文の先行検討（A:データ点検／B:証拠抽出／C:採点／D:疑義／E:兆し）と、案件・1on1・ミーティング・営業貢献・日報・会議発言の具体。これらを全部踏まえる。\n【あなたの仕事】A〜Eの採点・証拠・疑義・兆しを踏まえ、本人に語りかける月次評価を書く。新しい点数は作らない（A〜Eの採点・事実に紐づく）。事務的な10枠の箇条書きにせず、一人の人間が相手の1ヶ月に本気で向き合って書いた手紙のように。\n【血の通った言葉・最重要】・数字を羅列で終わらせず意味と物語に変える（ただしA〜Eの事実・ログに紐づく範囲。捏造・推測の断定は禁止）。・案件の深掘り：成約した案件は\"何が効いたか\"、失注した案件は\"どこが分かれ目だったか\"を、その人の行動に踏み込んで書く。・「あの場でより良かった一言」：失注または停滞した商談の、あの場面で、こう一言言えていれば、という具体を1つ、できれば実際のセリフで。・強みと弱みは同根：その人の一つの行動の癖が、ある案件では勝因に、別の案件では敗因になっていれば、同じ癖の表裏として示す。叱るのでなく、一段上の技術として気づかせる。・甘やかさない。数字が届かなければ正直に受け止めさせる。良い月は讃え、課題は逃げず直視し、しかし必ず次の一手へ向かわせる。\n【禁止】占い・教科書通り・一般論・AI口調（「〜と読めます」「可能性が高いです」の連発）・点数に合わせた後付け・盛り。A〜E等の符牒・採点の往復ログ・配点計算式は出さない（読み手は本人。人見の単一の声で書く）。データ源が空の軸は実力0と決めつけない。届いていない観点は無理に埋めない。\n【開示の節度】評価の見どころ（達成率・推移・強み弱み・次の一手）は見せてよいが「何を何回やれば何点」式の攻略条件や配点式は書かない。\n【文体】自然で心が動く日本語。各段落しっかり具体に踏み込む（水増し・繰り返しはしない）。見出しは付けてよいが事務的な番号枠にしない。\n【末尾】控えめに一行：「これはAIによる評価案です。ランク・処遇の最終確定は、あなたのマネージャーが行います。」`;
