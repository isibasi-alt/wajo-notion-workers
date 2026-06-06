# ライン1（名刺→企業：Perplexity深掘り＋与信スコアリング）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 名刺/企業ページから、Perplexity(sonar・出典付き)で企業を多段深掘りし、与信スコアリング(信頼度/提案可否)とともに企業マスターDBへ「構造化列＋本文ドシエ」を書き戻す。

**Architecture:** 既存の `researchCompany`(Gemini・推測のみ) を `researchCompanyDeep`(Perplexity多段・並列・出典付き) に置換。TDBは `fetchTdbProfile` という interface 越しに呼び、本プランでは未設定時nullを返す暫定実装にしておく(実取得はプラン1B=COSMOSNet自動操作で接続)。スコアリング・マージ・ドシエ生成・完了判定は純粋関数としてTDDで実装。`processCompanyResearch` と `enrichCompany` を新パイプラインへ差し替え。

**Tech Stack:** TypeScript / Notion Worker(`src/index.ts` 単一ファイル) / Perplexity Chat Completions API(OpenAI互換) / テスト=tsx + `node:assert/strict`。

参照スペック: `docs/superpowers/specs/2026-06-07-meishi-to-shoudan-pipeline-design.md`

---

## ファイル構成

本リポジトリは `src/index.ts` 単一巨大ファイルに全実装を集約する既存方針。**新規ファイルは作らず** `src/index.ts` に追記/置換する（既存パターン踏襲）。テストのみ機能ごとに `src/*.test.ts` を新規作成し `package.json` に `test:*` を1行追加する。

主な追加/変更（すべて `src/index.ts`）:
- 型追加: `DeepResearch` / `CreditScore` / `TdbProfile`
- 定数追加: `WAJO_PLAYBOOK`、`PERPLEXITY_API_KEY`/`PERPLEXITY_MODEL`
- 純粋関数追加: `buildResearchQueries` / `parseDeepResearchResponse` / `normalizeDeepResearch` / `extractCitations` / `mergeDeepResearch` / `scoreCompany` / `tdbToPatches` / `buildDossierMarkdown` / `isDeepResearchComplete` / `fallbackDeepResearch`
- 副作用関数追加: `perplexityChat` / `researchCompanyDeep` / `fetchTdbProfile`(暫定) / `appendCompanyDossierBody`(既存`appendMeetingPrepReportBody`を踏襲)
- 置換: `processCompanyResearch`(L4485) / `enrichCompany`(L14325)

新規テスト: `src/deep-research-parse.test.ts` / `src/company-scoring.test.ts` / `src/deep-research-merge.test.ts` / `src/company-dossier.test.ts`

---

## Task 0: 新規Notion列の作成（前提セットアップ）

**Files:** Notion側のみ（コード変更なし）。企業マスターDB `7f394672-4f1e-4f01-ab6c-c98d29bd1f90`。

- [ ] **Step 1: 既存で流用する列を確認**（作成不要、既存）

`代表者` `資本金` `設立年月` `売上規模` `従業員規模` `業種` `上場区分` `ウェブサイトURL` `X（Twitter）` `LinkedIn` `法人番号（TDB）` `TDB企業コード` `TDB収録業績期` `TDB調査年月日`(date) `信頼度`(select 高/中/低) `提案可否`(select 提案可能/タイミング待ち/提案不可) `企業調査ステータス`(select)。

- [ ] **Step 2: 新規列を追加（text型、`リサーチ最終実行日`のみdate型）**

Notion MCP `notion-update-data-source` または手動で、企業マスターDBに以下を追加:
- `経営陣`(text) / `役員SNS発信メモ`(text) / `直近ニュース`(text) / `再エネ接点シグナル`(text) / `想定決裁者`(text) / `想定反論・懸念`(text) / `出典ソース`(text) / `リサーチ最終実行日`(date)

- [ ] **Step 3: 確認**

`notion-fetch collection://7f394672-4f1e-4f01-ab6c-c98d29bd1f90` を実行し、上記8列が schema に出ることを目視確認。

---

## Task 1: 型と環境変数の追加

**Files:**
- Modify: `src/index.ts`（型は `Research`(L354) 付近、定数は冒頭env群 L8–82 付近）

- [ ] **Step 1: 型を追加**

`Research`(L354–364) の直後に追記:
```ts
type DeepResearch = Research & {
	representative: string;   // 代表者
	executives: string;       // 経営陣（代表以外のキーパーソン）
	capital: string;          // 資本金
	founded: string;          // 設立年月
	revenue: string;          // 売上規模
	employees: string;        // 従業員規模
	industry: string;         // 業種
	listingStatus: string;    // 上場区分
	websiteUrl: string;
	xUrl: string;
	linkedinUrl: string;
	corporateNumber: string;  // 法人番号
	executiveSns: string;     // 役員SNS発信メモ（公開・事業範囲のみ）
	recentNews: string;       // 直近ニュース（日付つき）
	renewableSignals: string; // 再エネ接点シグナル
	decisionMaker: string;    // 想定決裁者
	objections: string;       // 想定反論・懸念
	citations: string[];      // 出典URL
};

type TdbProfile = {
	企業評点: number | null;   // TDB評点（概ね0-100、高いほど良い）
	倒産確率Pct: number | null; // 倒産確率(%)
	年商: string;
	資本金: string;
	従業員数: string;
	設立: string;
	業種: string;
	代表者: string;
	法人番号: string;
	調査年月日: string;        // ISO日付
	raw: string;              // 元帳票テキスト（監査用）
};

type CreditScore = {
	信頼度: "高" | "中" | "低";
	提案可否: "提案可能" | "タイミング待ち" | "提案不可";
	根拠: string;
};
```

- [ ] **Step 2: 環境変数定数を追加**

env定数群（L78付近、`AI_LEARNING_LOG_DATA_SOURCE_ID` の後）に追記:
```ts
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || "sonar";
```

- [ ] **Step 3: 型チェック**

Run: `npm run check`
Expected: PASS（`tsc --noEmit` がエラーなし。新型は未使用だが型エラーは出ない）

- [ ] **Step 4: コミット**
```bash
git add src/index.ts
git commit -m "feat(line1): DeepResearch/TdbProfile/CreditScore 型とPerplexity env を追加"
```

---

## Task 2: 和上プレイブック定数

**Files:**
- Modify: `src/index.ts`（定数群付近）

- [ ] **Step 1: プレイブック定数を追加**
```ts
const WAJO_PLAYBOOK = [
	"和上ホールディングスの強み:",
	"- 太陽光・系統用蓄電池・発電所仲介(売買)の再エネ専門。太陽光建設実績 約800MW。",
	"- 提供価値: 自家消費型太陽光で電気代圧縮 / 系統用蓄電池・FIPで余剰を収益化 / 高圧・低圧両対応 / 投資回収シミュレーション / 発電所の売買仲介。",
	"- 刺さる相手の例: 工場・倉庫で電気代が原価を圧迫する企業 / 遊休地・屋根を持つ企業 / 脱炭素を取引先から要請される企業 / 売電中の発電所を売買したい事業者。",
	"- 営業の型: 相手の状況から課題仮説→和上の解決策を数字(電気代◯%減・回収□年・800MW実績)で接続→決裁者別(社長/財務/工場長)に言い換え→想定反論への切り返し。",
].join("\n");
```

- [ ] **Step 2: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: コミット**
```bash
git add src/index.ts
git commit -m "feat(line1): 和上営業プレイブック定数を追加"
```

---

## Task 3: リサーチクエリ生成（純粋関数・TDD）

**Files:**
- Modify: `src/index.ts`
- Test: `src/deep-research-parse.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/deep-research-parse.test.ts` を新規作成:
```ts
import assert from "node:assert/strict";
import { buildResearchQueriesForTest } from "./index";

async function main() {
	const queries = buildResearchQueriesForTest({
		companyName: "株式会社サンプル食品",
		domain: "sample-foods.co.jp",
		address: "滋賀県大津市1-2-3",
	});
	// 6観点ある
	assert.equal(queries.length, 6);
	// 各クエリに会社名が含まれる
	for (const q of queries) {
		assert.ok(q.prompt.includes("株式会社サンプル食品"), `会社名欠落: ${q.aspect}`);
		assert.ok(q.aspect.length > 0);
	}
	// 役員SNS観点と再エネ接点観点が含まれる
	const aspects = queries.map((q) => q.aspect);
	assert.ok(aspects.includes("executiveSns"));
	assert.ok(aspects.includes("renewableSignals"));
	console.log("OK buildResearchQueries");
}
main().catch((error) => { console.error(error); process.exit(1); });
```

- [ ] **Step 2: テストを実行して失敗を確認**

`package.json` の scripts に追記:
```json
"test:deep-research-parse": "tsx src/deep-research-parse.test.ts",
```
Run: `npm run test:deep-research-parse`
Expected: FAIL（`buildResearchQueriesForTest` が未定義）

- [ ] **Step 3: 実装を書く**

`src/index.ts` に追加:
```ts
function buildResearchQueries(input: { companyName: string; domain: string; address: string }): Array<{ aspect: string; prompt: string }> {
	const c = `会社名:${input.companyName} / ドメイン:${input.domain || "不明"} / 住所:${input.address || "不明"}`;
	const common = "日本語で、公開情報のみに基づき、各事実に出典URLを併記。裏取りできない点は『推測ですが』と明記。";
	return [
		{ aspect: "basic", prompt: `次の企業の基本情報(業種・事業内容・資本金・設立・従業員規模・売上規模・上場区分・本社所在地・公式サイト)を調べて。${c}。${common}` },
		{ aspect: "executives", prompt: `次の企業の代表者と主要役員(氏名・役職・経歴)を調べて。事業・経営に関する公開情報のみ。私生活は除外。${c}。${common}` },
		{ aspect: "executiveSns", prompt: `次の企業および代表・役員の公開SNS(X/LinkedIn/note/Facebook/YouTube)で、事業・経営に関する発信があれば要約して。アカウントURLも。私生活は除外。${c}。${common}` },
		{ aspect: "recentNews", prompt: `次の企業の直近1-2年のニュース・プレスリリース・動向を日付つきで調べて。${c}。${common}` },
		{ aspect: "renewableSignals", prompt: `次の企業の、再生可能エネルギー(太陽光・蓄電池)との接点を調べて。工場/倉庫の有無、電力使用規模、遊休地・屋根、脱炭素方針、補助金交付歴など。${c}。${common}` },
		{ aspect: "decisionMaker", prompt: `次の企業で、太陽光/蓄電池導入の意思決定に関わりそうな決裁者・部門を推定して。${c}。${common}` },
	];
}

export { buildResearchQueries as buildResearchQueriesForTest };
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:deep-research-parse`
Expected: PASS（`OK buildResearchQueries`）

- [ ] **Step 5: コミット**
```bash
git add src/index.ts src/deep-research-parse.test.ts package.json
git commit -m "feat(line1): 多段リサーチのクエリ生成(buildResearchQueries) + テスト"
```

---

## Task 4: レスポンス解析・正規化・出典抽出（純粋関数・TDD）

**Files:**
- Modify: `src/index.ts`
- Test: `src/deep-research-parse.test.ts`（Task 3 のファイルに追記）

- [ ] **Step 1: 失敗するテストを追記**

`src/deep-research-parse.test.ts` の `main()` 内末尾(`console.log("OK buildResearchQueries");` の後)に追記:
```ts
	// 出典抽出: Perplexityレスポンスの citations を吸い出す
	const cites = extractCitationsForTest({ citations: ["https://a.example/x", "https://b.example/y"] });
	assert.deepEqual(cites, ["https://a.example/x", "https://b.example/y"]);
	assert.deepEqual(extractCitationsForTest({}), []);

	// fallback: 空入力でも全フィールドが埋まる
	const fb = fallbackDeepResearchForTest("株式会社サンプル食品");
	assert.ok(fb.summary.includes("推測"));
	assert.equal(fb.citations.length, 0);

	// 正規化: 部分入力は fallback で穴埋め、citations は配列化
	const norm = normalizeDeepResearchForTest(
		{ summary: "食品製造業", representative: "山田太郎", citations: ["https://src.example/1"] },
		"株式会社サンプル食品",
	);
	assert.equal(norm.summary, "食品製造業");
	assert.equal(norm.representative, "山田太郎");
	assert.equal(norm.currentIssue.length > 0, true); // fallbackで補完
	assert.deepEqual(norm.citations, ["https://src.example/1"]);
	console.log("OK parse/normalize/citations");
```
ファイル冒頭の import を更新:
```ts
import { buildResearchQueriesForTest, extractCitationsForTest, fallbackDeepResearchForTest, normalizeDeepResearchForTest } from "./index";
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:deep-research-parse`
Expected: FAIL（未定義の `*ForTest`）

- [ ] **Step 3: 実装を書く**

`src/index.ts` に追加:
```ts
function fallbackDeepResearch(companyName: string): DeepResearch {
	const base = `推測ですが、${companyName}の公開情報が不足しているため、和上の営業仮説として整理します。`;
	return {
		summary: base,
		currentIssue: "推測ですが、電気料金やエネルギーコストの上昇が利益を圧迫している可能性があります。",
		futureIssue: "推測ですが、脱炭素・取引先要請への対応が今後の課題になり得ます。",
		salesAngle: "自家消費型太陽光による電気代圧縮と、蓄電池・FIPでの収益化を入口に提案。",
		fit: "屋根・遊休地があれば和上の太陽光/蓄電池の適合度は高いと考えられます(要確認)。",
		customerMarket3c: "推測ですが、業界全体でエネルギーコストと脱炭素対応が共通課題。",
		competitor3c: "推測ですが、地域の施工会社やEPCが競合になり得ます。",
		wajoRelation3c: "和上は800MW実績で施工リスクが低く、売買仲介まで一気通貫で対応可能。",
		source: "公開情報の取得が不足。要追加調査。",
		representative: "", executives: "", capital: "", founded: "", revenue: "", employees: "",
		industry: "", listingStatus: "", websiteUrl: "", xUrl: "", linkedinUrl: "", corporateNumber: "",
		executiveSns: "", recentNews: "", renewableSignals: "", decisionMaker: "", objections: "",
		citations: [],
	};
}

function extractCitations(response: { citations?: unknown }): string[] {
	if (!Array.isArray(response.citations)) return [];
	return response.citations.filter((c): c is string => typeof c === "string");
}

function normalizeDeepResearch(input: Partial<DeepResearch>, companyName: string): DeepResearch {
	const fb = fallbackDeepResearch(companyName);
	const pick = (v: unknown, d: string): string => (typeof v === "string" && v.trim() ? v : d);
	return {
		summary: pick(input.summary, fb.summary),
		currentIssue: pick(input.currentIssue, fb.currentIssue),
		futureIssue: pick(input.futureIssue, fb.futureIssue),
		salesAngle: pick(input.salesAngle, fb.salesAngle),
		fit: pick(input.fit, fb.fit),
		customerMarket3c: pick(input.customerMarket3c, fb.customerMarket3c),
		competitor3c: pick(input.competitor3c, fb.competitor3c),
		wajoRelation3c: pick(input.wajoRelation3c, fb.wajoRelation3c),
		source: pick(input.source, fb.source),
		representative: pick(input.representative, ""),
		executives: pick(input.executives, ""),
		capital: pick(input.capital, ""),
		founded: pick(input.founded, ""),
		revenue: pick(input.revenue, ""),
		employees: pick(input.employees, ""),
		industry: pick(input.industry, ""),
		listingStatus: pick(input.listingStatus, ""),
		websiteUrl: pick(input.websiteUrl, ""),
		xUrl: pick(input.xUrl, ""),
		linkedinUrl: pick(input.linkedinUrl, ""),
		corporateNumber: pick(input.corporateNumber, ""),
		executiveSns: pick(input.executiveSns, ""),
		recentNews: pick(input.recentNews, ""),
		renewableSignals: pick(input.renewableSignals, ""),
		decisionMaker: pick(input.decisionMaker, ""),
		objections: pick(input.objections, ""),
		citations: Array.isArray(input.citations) ? input.citations.filter((c): c is string => typeof c === "string") : [],
	};
}

export {
	extractCitations as extractCitationsForTest,
	fallbackDeepResearch as fallbackDeepResearchForTest,
	normalizeDeepResearch as normalizeDeepResearchForTest,
};
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:deep-research-parse`
Expected: PASS（`OK parse/normalize/citations`）

- [ ] **Step 5: コミット**
```bash
git add src/index.ts src/deep-research-parse.test.ts
git commit -m "feat(line1): DeepResearch解析・正規化・出典抽出 + テスト"
```

---

## Task 5: Perplexityクライアントと多段リサーチ（副作用・並列）

**Files:**
- Modify: `src/index.ts`（`callOpenAIMeetingMemoFormat` L4675 を雛形にする）

- [ ] **Step 1: Perplexityチャット関数を実装**
```ts
async function perplexityChat(messages: Array<{ role: string; content: string }>): Promise<{ content: string; citations: string[] }> {
	if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY が未設定です");
	const response = await fetch("https://api.perplexity.ai/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
		},
		body: JSON.stringify({ model: PERPLEXITY_MODEL, messages }),
	});
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Perplexity API error ${response.status}: ${errorText.slice(0, 200)}`);
	}
	const json = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
		citations?: unknown;
	};
	const content = json.choices?.[0]?.message?.content ?? "";
	return { content, citations: extractCitations(json) };
}
```

- [ ] **Step 2: 多段リサーチ統合を実装（並列＋統合呼び出し）**
```ts
async function researchCompanyDeep(input: { companyName: string; domain: string; address: string }): Promise<DeepResearch> {
	if (!PERPLEXITY_API_KEY) return fallbackDeepResearch(input.companyName);
	try {
		const queries = buildResearchQueries(input);
		// 観点別に並列で事実収集（合計時間は最遅1本）
		const results = await Promise.all(
			queries.map(async (q) => {
				try {
					const r = await perplexityChat([{ role: "user", content: q.prompt }]);
					return { aspect: q.aspect, content: r.content, citations: r.citations };
				} catch (error) {
					console.log("perplexity aspect failed", q.aspect, String(error));
					return { aspect: q.aspect, content: "", citations: [] as string[] };
				}
			}),
		);
		const allCitations = Array.from(new Set(results.flatMap((r) => r.citations)));
		const factsBlock = results.map((r) => `## ${r.aspect}\n${r.content}`).join("\n\n");
		// 事実を和上プレイブックで営業仕様のJSONに統合
		const synth = await perplexityChat([
			{ role: "system", content: `あなたは和上ホールディングスの営業企画。次のプレイブックに沿って、収集事実だけを根拠に企業ドシエJSONを作る。断定できない点は『推測ですが』。\n${WAJO_PLAYBOOK}` },
			{ role: "user", content: `=== 収集事実 ===\n${factsBlock.slice(0, 12000)}\n\n会社名:${input.companyName}\n\n次のJSONキーのみで返す(値は日本語文字列): summary,currentIssue,futureIssue,salesAngle,fit,customerMarket3c,competitor3c,wajoRelation3c,source,representative,executives,capital,founded,revenue,employees,industry,listingStatus,websiteUrl,xUrl,linkedinUrl,corporateNumber,executiveSns,recentNews,renewableSignals,decisionMaker,objections` },
		]);
		const parsed = parseJsonLoose(synth.content);
		const research = normalizeDeepResearch(parsed, input.companyName);
		research.citations = allCitations;
		return research;
	} catch (error) {
		console.log("researchCompanyDeep failed", String(error));
		return fallbackDeepResearch(input.companyName);
	}
}

function parseJsonLoose(raw: string): Partial<DeepResearch> {
	try {
		const match = raw.match(/\{[\s\S]*\}/);
		return match ? (JSON.parse(match[0]) as Partial<DeepResearch>) : {};
	} catch {
		return {};
	}
}
```

- [ ] **Step 3: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: コミット**
```bash
git add src/index.ts
git commit -m "feat(line1): Perplexityクライアント + 多段並列リサーチ統合"
```

---

## Task 6: 与信スコアリング（純粋関数・TDD）

**Files:**
- Modify: `src/index.ts`
- Test: `src/company-scoring.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/company-scoring.test.ts` を新規作成:
```ts
import assert from "node:assert/strict";
import { scoreCompanyForTest } from "./index";

async function main() {
	// TDB評点が高い → 提案可能・信頼度高
	const high = scoreCompanyForTest({ 企業評点: 65, 倒産確率Pct: 1, 年商: "80億", 資本金: "1億", 従業員数: "300", 設立: "1990", 業種: "食品", 代表者: "山田", 法人番号: "123", 調査年月日: "2026-06-07", raw: "" });
	assert.equal(high.信頼度, "高");
	assert.equal(high.提案可否, "提案可能");

	// 倒産確率が高い → タイミング待ちに抑制
	const risky = scoreCompanyForTest({ 企業評点: 60, 倒産確率Pct: 15, 年商: "", 資本金: "", 従業員数: "", 設立: "", 業種: "", 代表者: "", 法人番号: "", 調査年月日: "", raw: "" });
	assert.equal(risky.提案可否, "タイミング待ち");

	// 評点が低い → 提案不可
	const low = scoreCompanyForTest({ 企業評点: 30, 倒産確率Pct: null, 年商: "", 資本金: "", 従業員数: "", 設立: "", 業種: "", 代表者: "", 法人番号: "", 調査年月日: "", raw: "" });
	assert.equal(low.提案可否, "提案不可");
	assert.equal(low.信頼度, "低");

	// TDB未取得(null) → 暫定: 信頼度中・タイミング待ち・根拠に未取得と明記
	const noTdb = scoreCompanyForTest(null);
	assert.equal(noTdb.信頼度, "中");
	assert.equal(noTdb.提案可否, "タイミング待ち");
	assert.ok(noTdb.根拠.includes("TDB"));
	console.log("OK scoreCompany");
}
main().catch((error) => { console.error(error); process.exit(1); });
```

- [ ] **Step 2: テストを実行して失敗を確認**

`package.json` に追記:
```json
"test:company-scoring": "tsx src/company-scoring.test.ts",
```
Run: `npm run test:company-scoring`
Expected: FAIL（`scoreCompanyForTest` 未定義）

- [ ] **Step 3: 実装を書く**
```ts
function scoreCompany(tdb: TdbProfile | null): CreditScore {
	if (!tdb || tdb.企業評点 === null) {
		return {
			信頼度: "中",
			提案可否: "タイミング待ち",
			根拠: "TDB与信が未取得のため暫定判定。Perplexity公開情報ベース。TDB取得後に再評価する。",
		};
	}
	const 評点 = tdb.企業評点;
	const 倒産 = tdb.倒産確率Pct;
	let 信頼度: CreditScore["信頼度"];
	let 提案可否: CreditScore["提案可否"];
	if (評点 >= 51) { 信頼度 = "高"; 提案可否 = "提案可能"; }
	else if (評点 >= 41) { 信頼度 = "中"; 提案可否 = "提案可能"; }
	else if (評点 >= 36) { 信頼度 = "中"; 提案可否 = "タイミング待ち"; }
	else { 信頼度 = "低"; 提案可否 = "提案不可"; }
	// 倒産確率が高ければ提案可否を抑制
	if (倒産 !== null && 倒産 >= 10 && 提案可否 === "提案可能") 提案可否 = "タイミング待ち";
	if (倒産 !== null && 倒産 >= 30) { 提案可否 = "提案不可"; 信頼度 = "低"; }
	return {
		信頼度,
		提案可否,
		根拠: `TDB評点${評点}${倒産 !== null ? `・倒産確率${倒産}%` : ""}に基づく自動判定。`,
	};
}

export { scoreCompany as scoreCompanyForTest };
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:company-scoring`
Expected: PASS（`OK scoreCompany`）

- [ ] **Step 5: コミット**
```bash
git add src/index.ts src/company-scoring.test.ts package.json
git commit -m "feat(line1): 与信スコアリング(scoreCompany) + テスト"
```

---

## Task 7: 非破壊マージ＋完了判定（純粋関数・TDD）

**Files:**
- Modify: `src/index.ts`
- Test: `src/deep-research-merge.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/deep-research-merge.test.ts` を新規作成:
```ts
import assert from "node:assert/strict";
import { mergeDeepResearchForTest, isDeepResearchCompleteForTest, fallbackDeepResearchForTest } from "./index";

async function main() {
	const research = fallbackDeepResearchForTest("株式会社サンプル");
	research.summary = "AI生成サマリー";
	research.representative = "AI山田";
	// 既存に手入力がある項目は壊さない
	const merged = mergeDeepResearchForTest(
		{ summary: "手入力サマリー", representative: "" },
		research,
	);
	assert.equal(merged.summary, "手入力サマリー");      // 既存優先
	assert.equal(merged.representative, "AI山田");        // 既存空→AI採用

	// 完了判定: 9コア項目が揃えば true
	assert.equal(isDeepResearchCompleteForTest(research), true);
	const empty = fallbackDeepResearchForTest("X");
	empty.source = "";
	assert.equal(isDeepResearchCompleteForTest(empty), false);
	console.log("OK merge/complete");
}
main().catch((error) => { console.error(error); process.exit(1); });
```

- [ ] **Step 2: テストを実行して失敗を確認**

`package.json` に追記:
```json
"test:deep-research-merge": "tsx src/deep-research-merge.test.ts",
```
Run: `npm run test:deep-research-merge`
Expected: FAIL

- [ ] **Step 3: 実装を書く**

既存 `mergeCompanyResearch`/`isCompanyResearchComplete` は残し、Deep用を追加:
```ts
// 既存値(手入力)があれば壊さない。existingは企業マスターの読み取り値の部分集合。
function mergeDeepResearch(existing: Partial<DeepResearch>, research: DeepResearch): DeepResearch {
	const keep = (e: unknown, r: string): string => (typeof e === "string" && e.trim() ? e : r);
	return {
		summary: keep(existing.summary, research.summary),
		currentIssue: keep(existing.currentIssue, research.currentIssue),
		futureIssue: keep(existing.futureIssue, research.futureIssue),
		salesAngle: keep(existing.salesAngle, research.salesAngle),
		fit: keep(existing.fit, research.fit),
		customerMarket3c: keep(existing.customerMarket3c, research.customerMarket3c),
		competitor3c: keep(existing.competitor3c, research.competitor3c),
		wajoRelation3c: keep(existing.wajoRelation3c, research.wajoRelation3c),
		source: keep(existing.source, research.source),
		representative: keep(existing.representative, research.representative),
		executives: keep(existing.executives, research.executives),
		capital: keep(existing.capital, research.capital),
		founded: keep(existing.founded, research.founded),
		revenue: keep(existing.revenue, research.revenue),
		employees: keep(existing.employees, research.employees),
		industry: keep(existing.industry, research.industry),
		listingStatus: keep(existing.listingStatus, research.listingStatus),
		websiteUrl: keep(existing.websiteUrl, research.websiteUrl),
		xUrl: keep(existing.xUrl, research.xUrl),
		linkedinUrl: keep(existing.linkedinUrl, research.linkedinUrl),
		corporateNumber: keep(existing.corporateNumber, research.corporateNumber),
		executiveSns: keep(existing.executiveSns, research.executiveSns),
		recentNews: keep(existing.recentNews, research.recentNews),
		renewableSignals: keep(existing.renewableSignals, research.renewableSignals),
		decisionMaker: keep(existing.decisionMaker, research.decisionMaker),
		objections: keep(existing.objections, research.objections),
		citations: research.citations,
	};
}

function isDeepResearchComplete(r: DeepResearch): boolean {
	return [r.summary, r.currentIssue, r.futureIssue, r.salesAngle, r.fit, r.customerMarket3c, r.competitor3c, r.wajoRelation3c, r.source]
		.every((v) => v.trim().length > 0);
}

export {
	mergeDeepResearch as mergeDeepResearchForTest,
	isDeepResearchComplete as isDeepResearchCompleteForTest,
};
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:deep-research-merge`
Expected: PASS（`OK merge/complete`）

- [ ] **Step 5: コミット**
```bash
git add src/index.ts src/deep-research-merge.test.ts package.json
git commit -m "feat(line1): DeepResearch非破壊マージ + 完了判定 + テスト"
```

---

## Task 8: TDB差し込み口（暫定）と列パッチ生成（TDD）

**Files:**
- Modify: `src/index.ts`
- Test: `src/company-scoring.test.ts`（Task 6 のファイルに追記）

- [ ] **Step 1: 失敗するテストを追記**

`src/company-scoring.test.ts` の import を更新し、`main()` 末尾に追記:
```ts
// import 行
import { scoreCompanyForTest, tdbToPatchesForTest } from "./index";
// main() 末尾(console.log("OK scoreCompany"); の前)に:
	const patches = tdbToPatchesForTest({ 企業評点: 65, 倒産確率Pct: 1, 年商: "80億", 資本金: "1億円", 従業員数: "300名", 設立: "1990-04", 業種: "食品製造", 代表者: "山田太郎", 法人番号: "1234567890123", 調査年月日: "2026-06-07", raw: "帳票" });
	assert.equal(patches["資本金"].kind, "text");
	assert.equal((patches["資本金"] as { value: string }).value, "1億円");
	assert.equal((patches["代表者"] as { value: string }).value, "山田太郎");
	assert.equal(patches["TDB調査年月日"].kind, "date");
	// 空値の項目はパッチに入れない
	const sparse = tdbToPatchesForTest({ 企業評点: null, 倒産確率Pct: null, 年商: "", 資本金: "", 従業員数: "", 設立: "", 業種: "", 代表者: "", 法人番号: "", 調査年月日: "", raw: "" });
	assert.equal(Object.keys(sparse).length, 0);
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:company-scoring`
Expected: FAIL（`tdbToPatchesForTest` 未定義）

- [ ] **Step 3: 実装を書く**
```ts
// 暫定: TDBアクセスは未接続。プラン1B(COSMOSNet自動取得)でここを差し替える。
async function fetchTdbProfile(_company: CompanyInfo): Promise<TdbProfile | null> {
	// TODO(plan-1B): COSMOSNet取得部品から TdbProfile を返すよう接続する。
	return null;
}

function tdbToPatches(tdb: TdbProfile): Record<string, SafePatch> {
	const patches: Record<string, SafePatch> = {};
	const addText = (key: string, value: string) => { if (value && value.trim()) patches[key] = { kind: "text", value }; };
	addText("資本金", tdb.資本金);
	addText("設立年月", tdb.設立);
	addText("売上規模", tdb.年商);
	addText("従業員規模", tdb.従業員数);
	addText("業種", tdb.業種);
	addText("代表者", tdb.代表者);
	addText("法人番号（TDB）", tdb.法人番号);
	if (tdb.調査年月日 && tdb.調査年月日.trim()) patches["TDB調査年月日"] = { kind: "date", value: tdb.調査年月日 };
	return patches;
}

export { tdbToPatches as tdbToPatchesForTest };
```
注: `fetchTdbProfile` の `async`/未使用引数は意図的（差し込み口）。`npm run check` で未使用引数エラーが出る場合は引数名を `_company` のままにする（既存 tsconfig は noUnusedParameters 無効の想定。エラーになる場合のみ `void _company;` を先頭に置く）。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:company-scoring`
Expected: PASS

- [ ] **Step 5: コミット**
```bash
git add src/index.ts src/company-scoring.test.ts
git commit -m "feat(line1): TDB差し込み口(暫定) + TDB列パッチ生成 + テスト"
```

---

## Task 9: ドシエ本文生成（純粋関数・TDD）

**Files:**
- Modify: `src/index.ts`
- Test: `src/company-dossier.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/company-dossier.test.ts` を新規作成:
```ts
import assert from "node:assert/strict";
import { buildDossierMarkdownForTest, fallbackDeepResearchForTest } from "./index";

async function main() {
	const r = fallbackDeepResearchForTest("株式会社サンプル食品");
	r.recentNews = "2026-01 新工場稼働";
	r.citations = ["https://news.example/1", "https://corp.example/about"];
	const md = buildDossierMarkdownForTest("株式会社サンプル食品", r, { 信頼度: "高", 提案可否: "提案可能", 根拠: "TDB評点65" });
	assert.ok(md.includes("株式会社サンプル食品"));
	assert.ok(md.includes("提案可能"));         // スコア反映
	assert.ok(md.includes("2026-01 新工場稼働")); // ニュース反映
	assert.ok(md.includes("https://news.example/1")); // 出典反映
	assert.ok(md.includes("出典"));
	console.log("OK dossier");
}
main().catch((error) => { console.error(error); process.exit(1); });
```

- [ ] **Step 2: テストを実行して失敗を確認**

`package.json` に追記:
```json
"test:company-dossier": "tsx src/company-dossier.test.ts",
```
Run: `npm run test:company-dossier`
Expected: FAIL

- [ ] **Step 3: 実装を書く**
```ts
function buildDossierMarkdown(companyName: string, r: DeepResearch, score: CreditScore): string {
	const section = (h: string, body: string) => (body && body.trim() ? `## ${h}\n${body}\n` : "");
	const lines = [
		`# ${companyName} 商談ドシエ`,
		`**与信判定**: 信頼度 ${score.信頼度} / 提案可否 ${score.提案可否}（${score.根拠}）`,
		"",
		section("会社概要", r.summary),
		section("基本情報", [r.industry && `業種: ${r.industry}`, r.capital && `資本金: ${r.capital}`, r.revenue && `売上: ${r.revenue}`, r.employees && `従業員: ${r.employees}`, r.founded && `設立: ${r.founded}`, r.listingStatus && `上場: ${r.listingStatus}`].filter(Boolean).join(" / ")),
		section("経営陣・キーパーソン", [r.representative && `代表者: ${r.representative}`, r.executives].filter(Boolean).join("\n")),
		section("役員・会社のSNS発信", r.executiveSns),
		section("直近の動き", r.recentNews),
		section("再エネ/蓄電池の接点", r.renewableSignals),
		section("現在の課題仮説", r.currentIssue),
		section("将来の課題仮説", r.futureIssue),
		section("3C：顧客・市場", r.customerMarket3c),
		section("3C：競合", r.competitor3c),
		section("3C：和上との関係性", r.wajoRelation3c),
		section("営業切り口", r.salesAngle),
		section("和上解決策の適合", r.fit),
		section("想定決裁者", r.decisionMaker),
		section("想定反論・切り返し", r.objections),
		r.citations.length ? `## 出典\n${r.citations.map((c) => `- ${c}`).join("\n")}` : "",
	];
	return lines.filter((l) => l !== "").join("\n");
}

export { buildDossierMarkdown as buildDossierMarkdownForTest };
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:company-dossier`
Expected: PASS（`OK dossier`）

- [ ] **Step 5: コミット**
```bash
git add src/index.ts src/company-dossier.test.ts package.json
git commit -m "feat(line1): 商談ドシエ本文生成(buildDossierMarkdown) + テスト"
```

---

## Task 10: `processCompanyResearch` を新パイプラインへ置換

**Files:**
- Modify: `src/index.ts:4485-4538`（`processCompanyResearch` 本体）

- [ ] **Step 1: ドシエ本文追記ヘルパーを実装（既存 `appendMeetingPrepReportBody` L12705 を踏襲）**

まず `appendMeetingPrepReportBody`(L12705) を開いて、`notion.blocks.children.append` のブロック生成パターンを確認する。それに合わせて、Markdown文字列を段落ブロック化して追記する関数を作る:
```ts
async function appendCompanyDossierBody(notion: NotionClient, pageId: string, markdown: string): Promise<void> {
	// appendMeetingPrepReportBody と同じブロック生成方式に合わせること。
	// markdown を行単位で paragraph ブロックにして blocks.children.append する。
	const blocks = markdown.split("\n").filter((line) => line.length > 0).map((line) => ({
		object: "block",
		type: "paragraph",
		paragraph: { rich_text: [{ type: "text", text: { content: line.slice(0, 1900) } }] },
	}));
	for (let i = 0; i < blocks.length; i += 90) {
		await notion.blocks!.children!.append({ block_id: pageId, children: blocks.slice(i, i + 90) });
	}
}
```
注: `notion.blocks` の正確な形は既存 `appendMeetingPrepReportBody` に合わせて修正する（本ステップの完了条件は「既存と同じ呼び方になっていること」）。

- [ ] **Step 2: `processCompanyResearch`(L4485-4538) を置換**
```ts
async function processCompanyResearch(input: CompanyResearchInput, notion: NotionClient): Promise<CompanyResearchResult> {
	const companyPage = await notion.pages.retrieve({ page_id: input.companyPageId });
	const company = readCompany(companyPage);

	// 1. TDB与信（暫定: 未接続でnull。プラン1Bで接続）
	const tdb = await fetchTdbProfile(company);
	const score = scoreCompany(tdb);

	// 2. Perplexity多段深掘り
	const card = companyToCardInfo(company);
	const research = await researchCompanyDeep({ companyName: company.name, domain: card.domain, address: company.address });

	// 3. 既存手入力を壊さないマージ
	const existing: Partial<DeepResearch> = {
		summary: company.summary, currentIssue: company.currentIssue, futureIssue: company.futureIssue,
		salesAngle: company.salesAngle, fit: company.fit, customerMarket3c: company.customerMarket3c,
		competitor3c: company.competitor3c, wajoRelation3c: company.wajoRelation3c, source: company.source,
	};
	const merged = mergeDeepResearch(existing, research);
	const complete = isDeepResearchComplete(merged);
	const status = complete ? "完了" : "要確認";

	if (input.dryRun) {
		return { companyId: company.page.id, action: "dry-run",
			message: complete ? "dry-run: 深掘りリサーチと与信判定を反映し、完了にできます。" : "dry-run: 一部不足のため要確認で止める想定です。" };
	}

	// 4. 構造化列（TDB由来は安全マージ、リサーチ由来は空欄のみ補完）
	const patches: Record<string, SafePatch> = tdb ? tdbToPatches(tdb) : {};
	patches["信頼度"] = { kind: "select", value: score.信頼度 };
	patches["提案可否"] = { kind: "select", value: score.提案可否 };
	patches["企業調査ステータス"] = { kind: "select", value: status };
	const properties = companyPage.properties ?? {};
	addPatchIfBlank(patches, properties, "代表者", merged.representative);
	addPatchIfBlank(patches, properties, "経営陣", merged.executives);
	addPatchIfBlank(patches, properties, "業種", merged.industry);
	addPatchIfBlank(patches, properties, "資本金", merged.capital);
	addPatchIfBlank(patches, properties, "設立年月", merged.founded);
	addPatchIfBlank(patches, properties, "売上規模", merged.revenue);
	addPatchIfBlank(patches, properties, "従業員規模", merged.employees);
	addPatchIfBlank(patches, properties, "役員SNS発信メモ", merged.executiveSns);
	addPatchIfBlank(patches, properties, "直近ニュース", merged.recentNews);
	addPatchIfBlank(patches, properties, "再エネ接点シグナル", merged.renewableSignals);
	addPatchIfBlank(patches, properties, "想定決裁者", merged.decisionMaker);
	addPatchIfBlank(patches, properties, "想定反論・懸念", merged.objections);
	addPatchIfBlank(patches, properties, "出典ソース", merged.citations.join("\n"));
	// 既存9テキスト列
	addPatchIfBlank(patches, properties, "企業サマリー", merged.summary);
	addPatchIfBlank(patches, properties, "現在課題仮説", merged.currentIssue);
	addPatchIfBlank(patches, properties, "将来課題仮説", merged.futureIssue);
	addPatchIfBlank(patches, properties, "営業切り口", merged.salesAngle);
	addPatchIfBlank(patches, properties, "和上解決策適合", merged.fit);
	addPatchIfBlank(patches, properties, "3C：顧客・市場分析", merged.customerMarket3c);
	addPatchIfBlank(patches, properties, "3C：競合分析", merged.competitor3c);
	addPatchIfBlank(patches, properties, "3C：自社との関係性", merged.wajoRelation3c);
	addPatchIfBlank(patches, properties, "根拠ソース", merged.source);
	await safeUpdateExistingProperties(notion, companyPage, patches);

	// 5. 本文ドシエ
	const dossier = buildDossierMarkdown(company.name, merged, score);
	await appendCompanyDossierBody(notion, company.page.id, dossier);

	return {
		companyId: company.page.id,
		action: complete ? "updated-company" : "needs-review",
		message: complete ? `深掘りリサーチ完了。与信: ${score.信頼度}/${score.提案可否}。` : `深掘りは反映したが一部不足のため要確認。与信: ${score.信頼度}/${score.提案可否}。`,
	};
}
```
注: `信頼度`/`提案可否`/各列はTDB/AI由来を**毎回更新**(`patches`直書き)、テキスト系は`addPatchIfBlank`で**手入力を壊さない**。`safeUpdateExistingProperties`が存在プロパティのみ・型整合で書くため、Task 0の列が無くても落ちない(その列はスキップ)。

- [ ] **Step 3: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: 既存テストが壊れていないか確認**

Run: `npm run test:company-registration-duplicate-guard`
Expected: PASS（名刺重複ガードは別関数なので影響なし）

- [ ] **Step 5: コミット**
```bash
git add src/index.ts
git commit -m "feat(line1): processCompanyResearchを深掘り+与信+ドシエ出力へ置換"
```

---

## Task 11: 名刺入口 `enrichCompany` を深掘りパイプラインへ接続

**Files:**
- Modify: `src/index.ts:14325-14352`（`enrichCompany`）

- [ ] **Step 1: `enrichCompany` を置換**

名刺処理時は「簡易エンリッチ→深掘り」を同じ `processCompanyResearch` に集約し、無条件「完了」をやめる:
```ts
async function enrichCompany(notion: NotionClient, company: Page, card: CardInfo, isDuplicateCandidate: boolean): Promise<void> {
	// 名刺の最低限(会社名/連絡先)を先に確実化してから、深掘りパイプラインへ委譲
	await notion.pages.update({
		page_id: company.id,
		properties: {
			企業調査ステータス: select("解析開始"),
			名刺起点Webhookメモ: richText(isDuplicateCandidate
				? "名刺起点。近似候補ありのためWorkerが深掘り調査を実行。"
				: "名刺起点。Workerが深掘り調査(Perplexity+与信)を実行。"),
		},
	});
	await processCompanyResearch({ companyPageId: company.id, dryRun: false }, notion);
}
```

- [ ] **Step 2: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: 既存の名刺処理テストを確認**

Run: `npm run test:company-registration-duplicate-guard`
Expected: PASS

- [ ] **Step 4: コミット**
```bash
git add src/index.ts
git commit -m "feat(line1): 名刺入口enrichCompanyを深掘りパイプラインへ接続"
```

---

## Task 12: 全テスト＋実機検証（完了の定義）

**Files:** なし（検証のみ）

- [ ] **Step 1: 関連テストを全て実行**

Run:
```bash
npm run check
npm run test:deep-research-parse
npm run test:deep-research-merge
npm run test:company-scoring
npm run test:company-dossier
npm run test:company-registration-duplicate-guard
```
Expected: 全てPASS

- [ ] **Step 2: Worker環境変数を設定**

`PERPLEXITY_API_KEY` を Worker 環境変数に設定（`ntn workers env set` 等）。`PERPLEXITY_MODEL` は未設定なら `sonar`。

- [ ] **Step 3: 実機ドライラン**

`processCompanyResearchById` を `dryRun: true` で実在企業1件に実行し、戻りメッセージを確認（書き込みなし）。

- [ ] **Step 4: 実機本番（1件）**

テスト用企業ページ1件で `dryRun: false` 実行 → 企業マスターの構造化列・与信(信頼度/提案可否)・本文ドシエ・出典が埋まることをNotionで目視確認。**この結果(スクリーンショット/ページ)を大ちゃんへ提示する**（口頭の「完了」ではなく証拠）。

- [ ] **Step 5: 名刺1枚 → 企業 のE2E**

名刺1枚を登録 → Webhook起動 → 企業マスターにドシエが生成されることを確認。`企業調査ステータス` が `完了`/`要確認` で止まる(無条件完了でない)ことを確認。

---

## 自己レビュー結果（writing-plans self-review）

- **スペック網羅**: 簡易エンリッチ/TDB与信/スコアリング/多段Perplexity(出典必須)/ハイブリッド出力/非破壊マージ/無条件完了の廃止/フォールバック=各Taskで実装。TDB実取得のみ Task 8 で差し込み口に留め、プラン1B(COSMOSNet)へ委譲(スペック§5の方針どおり)。
- **プレースホルダ**: 残置は意図的な2点のみ — (a)`fetchTdbProfile`の暫定null(プラン1Bで接続)、(b)`appendCompanyDossierBody`は既存`appendMeetingPrepReportBody`の実呼び出し形に合わせる指示。いずれも"既存実装に合わせる/次プランで接続"が明示されており、論理の空欄ではない。
- **型整合**: `DeepResearch`/`CreditScore`/`TdbProfile` のフィールド名は全Taskで一致。`SafePatch`/ヘルパー(`addPatchIfBlank`/`safeUpdateExistingProperties`/`select`/`richText`)は既存定義に準拠。
- **未解決(実装時に確認)**: TDB評点のスケール(0-100前提)とスコア閾値は暫定。COSMOSNetの実帳票が来たら閾値を実データで較正する。
