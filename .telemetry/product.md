# Product: WAJO Sales OS

**Last updated:** 2026-07-03
**Method:** codebase scan + 監査役既存把握 (`~/wajo-notion-workers/src/index.ts` 全27,868行・台帳 `全数台帳_W_Webhook対応表.md`・Vault `20_Project/和上セールスOS/` 一式)

## Product Identity
- **One-liner:** 営業マンが Notion のボタンを押すたびに、問い合わせ→案件化→商談→成約/失注→歩合計算→月次評価 が Worker 経由で自動記録・集計され、マネージャーは承認と月末評価だけ回せば組織全体の営業活動が可視化される、和上ホールディングス独自の社内営業 OS。
- **Category:** b2b-saas（社内利用型・非公開）
- **Product type:** B2B（和上ホールディングス社内向け・単一 workspace）
- **Collaboration:** multiplayer（営業10名 + マネージャー + 制作部 + 経理 が同一 Notion workspace で並走）

## Business Model
- **Monetization:** internal-only（外販なし・社内 SaaS）
- **Pricing tiers:** N/A（社内利用）
- **Billing integration:** N/A（Notion サブスクリプション・Anthropic API 課金のみ）

## Tech Stack
- **Primary language:** TypeScript
- **Framework:** Notion Workers（Notion 公式 workers 環境・Cloudflare Workers 系）
- **Database:** Notion Data Sources（`collection://*`）— 案件管理DB / 成約報告DB / 失注報告DB / 営業パフォーマンスDB / 月次評価DB / 活動ログDB（発言/顧客接点/営業貢献の3カテゴリ）/ ノルマ申請DB / 会議(ミーティング)DB / 日報DB / 企業マスターDB 他
- **Background jobs:** Notion Worker webhooks（46 webhook + 44 tool = 90 handler・台帳 `全数台帳_W_Webhook対応表.md`）
- **HTTP client patterns:** `@notionhq/client`（Notion 公式 SDK）+ `fetch`（外部 API 用）
- **Module organization:** 単一ファイル `src/index.ts`（27,868行）に全 handler を集約・関数命名で feature 分離（`processInquiryProjectCreation` / `processSalesPerformanceReview` / `processClosingReport` 等）
- **AI integration:** Anthropic Claude API（月次評価・日報生成・商談前ブリーフ）+ OpenAI GPT-4o（商太モジュール）
- **Deploy:** `NOTION_KEYRING=0 npx ntn workers deploy --workers-config-file workers.json`

## Value Mapping

### Primary Value Action
**成約報告の確定**（`processClosingReport` → 営業パフォーマンスDB の粗利・成約件数更新 → 歩合計算連鎖）。ここが 0 に落ちたら、営業組織そのものが機能停止＝プロダクト失敗。

### Core Features (directly deliver value)
1. **問い合わせ→案件化**（`processInquiryProjectCreation`）— 問い合わせボタン → 案件管理DB にレコード生成・営業マン担当割当。営業活動の入口。
2. **商談前ブリーフ生成**（商太モジュール `shouta-brief.ts` 213行）— 案件から企業マスターを引き当て、AI が商談前レポートを自動生成。営業マンが持って行く一次資料。
3. **成約報告**（`processClosingReport`）— 成約ボタン → 成約報告DB → 営業パフォーマンスDB 集計 → 歩合計算。売上・粗利の正本入力経路。
4. **失注報告**（`processLostReport`）— 失注ボタン → 失注理由 + 学び を構造化記録。ナレッジ蓄積の源泉。
5. **月次評価（人見さん評価エンジン）**（`processSalesPerformanceReview`）— 月次評価DB のボタン → 営業パフォーマンスDB を集計 + 活動ログDB 3カテゴリを参照 → AI が定量65 + 定性35 で評価草案を人見さん（マネージャー）に提示。月次の評価ゲート。
6. **日報**（`processDailyReport*` 系）— 日報DB に営業マンが 1 行 + テンション入力 → 翌朝 6 時に AI が要約日報を生成 → マネージャー承認 → 評価材料化。

### Supporting Features (enable core actions)
1. **ノルマ申請DB** — 月初の目標設定ゲート。マネージャー承認済みでないと月次評価が「人間確認モード」に落ちる。
2. **活動ログDB（発言/顧客接点/営業貢献の3カテゴリ）** — 定性評価の採点材料。reflect 系 handler で各サブDBから活動ログDBへ集約。
3. **企業マスターDB** — 案件・成約・商談の共通参照。名刺1枚から企業情報を取り、商太に食わせる。
4. **マネージャー承認ゲート**（`checkManagerApprovalGate` L562-597）— マネージャー専用ボタン6本（失注承認/差戻し/案件取消/成約差戻し等）を営業ロールから遮断。`APPROVAL_GATE_MODE=enforce/monitor` 環境変数で挙動切替。
5. **多エージェント基盤**（`processMultiAgentCommanderRunWebhook` 他）— Mission DB 起票 → Commander/AgentA/AgentB 自動連鎖の実験基盤。人見さん評価の設計フェーズで使用。
6. **土地情報DB / 社外顧問DB** — 土地・顧問を案件に紐付ける補助。

## Entity Model

### Users
- **ID format:** Notion user UUID（32桁ハイフン形式）
- **Roles:** 営業マン / 営業マネージャー / 代表 / 制作部 / 経理 / 人見さん（評価責任者）/ マルチエージェント基盤の司令塔（Claude Code セッション）
- **Multi-account:** no（単一 Notion workspace）

### Accounts
- **ID format:** Notion page ID（企業マスターDB の page_id）
- **Hierarchy:** flat（1 企業 = 1 レコード。子会社/親会社の relation は台帳上「グループ」プロパティで表現）

## Group Hierarchy

```
和上ホールディングス（workspace）
└── 営業組織（暗黙）
    └── 営業マン / マネージャー / 代表
```

| Group Type | Parent | Where Actions Happen |
|------------|--------|---------------------|
| Workspace（和上HD 単一） | (root) | ほぼすべての Worker 実行がここに帰属 |
| 案件（Deal） | 企業マスター | 商談・成約・失注・活動ログの主戦場 |
| 月次評価（Monthly Review） | 営業マン × 対象月 | 評価ゲートと歩合計算 |

**Default event level:** 案件（Deal）レベル — 営業マン単独ではなく案件を軸に活動を記録する。
**Admin actions at:** Workspace レベル（マネージャー承認・APPROVAL_GATE_MODE 切替）。

## Current State
- **Existing tracking:** なし（本スキルで初めて設計する）。既存ログは Notion Worker runs（`ntn workers runs list` で exit code / duration / error のみ取得可・内部イベント可視化なし）
- **Documentation:** partial
  - Vault: `20_Project/和上セールスOS/`（看板・引き継ぎ・OS総チェック等）
  - Runbook: `~/wajo-notion-workers/WAJO_WORKER_RUNBOOK.md`
  - 台帳: `20_Project/名刺一枚で企業丸裸/台帳/全数台帳_W_Webhook対応表.md`（46 webhook + 44 tool の全一覧）
  - 監査役プロトコル: `20_Project/マルチエージェント基盤/_運用標準/07_監査役プロトコル.md`
- **Known issues:**
  - `feedback_silent_defaults` — キャップ値・モデル選定・列/ビュー増設を AI が黙って決める癖
  - `feedback_notion_property_add_breaks_views` — Notion DB プロパティ追加で既存 view が破壊されるリスク
  - `feedback_verification_discipline` — 中身が空のまま完走宣言（Phase 4A 茶番事案・2026-06-20 M-001）
  - `feedback_wajo_media_voice_corrections` — AI が直すほど AI 臭に戻る現象
  - webhook URL の secret が deploy 毎に再生成 → Notion ボタン URL 再配線が必要（既知の穴）

## Integration Targets
| Destination | Purpose | Priority |
|-------------|---------|----------|
| Notion（内部・現状唯一）| Worker 実行結果・DB 更新の全てが最終的に Notion 側に着地 | 🔴 最重要 |
| Accoil（候補）| 営業活動テレメトリの集計・BI・アクション | 🟡 検討中（**event name のみ・properties 保存なし**の制約あり・event 命名戦略に影響）|
| Segment / PostHog（候補）| CDP・イベント統合先 | 🟢 未評価 |
| Anthropic Console（既存）| Claude API 使用状況・課金モニタリング | 🟡 運用中 |

## Codebase Observations
- **Feature areas inferred:**
  - 問い合わせ導線（Gmail → Worker → 案件管理DB）
  - 案件化 / 成約 / 失注 / 差戻し / 取消（マネージャー承認ゲート付き）
  - 歩合計算（成約 → 営業パフォーマンスDB → 月次評価）
  - 活動ログ集約（発言 / 顧客接点 / 営業貢献 → 活動ログDB）
  - AI 補助（商太ブリーフ / 人見さん月次評価 / ワニポ日報 / スズム君）
  - マルチエージェント基盤（Commander / AgentA / AgentB / 監視板）
- **Entity model inferred:**
  - 営業マン（Notion user）× 案件（Deal）× 顧客（Company）が中心の三角形
  - 月次評価は「営業マン × 対象月」の合成キー
  - 活動ログ 3カテゴリは全て案件・企業に relation でぶら下がる
- **Multi-agent 基盤特有:** Mission DB / AgentB 連続監視板（`_AgentB_監視板_<Mission ID>.md`）が並走。Mission 単位のイベントも将来のテレメトリ対象になり得る。
