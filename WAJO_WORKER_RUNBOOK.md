# WAJO Notion Worker 運用メモ

最終更新: 2026-05-26

## 目的

この Worker は、名刺1枚や土地情報1件などの小さな入力を入口にして、企業マスター連携、3C下書き、土地詳細評価、処理ステータス返却までを自動化するための実行部隊です。

営業マンの入力は、原則として名刺1枚、土地なら住所と面積のような最小入力に寄せます。Worker が先に実務処理を行い、AIエージェントは例外判断や営業向け説明に軽量化します。

## デプロイ状態

- Worker 名: `wajo-card-company-enrichment-worker`
- Worker ID: `019e452d-22e7-7de1-b5ea-432a297bb478`
- Workspace ID: `3874d017-81e7-81d1-8a0c-00030776854b`
- Webhook key: `processBusinessCardWebhook`
- Webhook URL: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/V1fRI92c6-MwdTe6/processBusinessCardWebhook`
- 土地Webhook key: `processLandEvaluationWebhook`
- 土地Webhook URL: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/4R7E8Zq3NwrUlpO8/processLandEvaluationWebhook`
- 商談準備Webhook key: `processMeetingPrepReportWebhook`
- 商談準備Webhook URL: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/QQRQnbxGJ4Z4w_9A/processMeetingPrepReportWebhook`
- 企業評価Webhook key: `processCompanyResearchWebhook`
- 企業評価Webhook URL: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/5Q9FOGijgZCR7DXx/processCompanyResearchWebhook`
- 顧客接点ログWebhook key: `createCustomerContactLogWebhook`
- 顧客接点ログWebhook URL: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/9LpxkZ8wdsNZjEl5/createCustomerContactLogWebhook`

Webhook 用の共有シークレットと Notion API token は、Worker 環境変数に設定済みです。ローカル控えは `.env.worker.local` に置き、`.gitignore` で管理対象外にしています。秘密情報はこのメモには書きません。

## Google Drive 資料保存

提案シミュレーションPDFと住民説明会資料PDFは、Notion files への保存を残しつつ、Google Drive を正本置き場に寄せる方針です。Workerは以下の環境変数が揃っている場合だけDriveアップロードを有効化し、未設定時は従来どおりNotion保存へフォールバックします。

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `googleDriveAuth` の認可トークン（推奨）または `GOOGLE_DRIVE_REFRESH_TOKEN`
- 任意: `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- 任意: `GOOGLE_DRIVE_ROOT_FOLDER_NAME`（未設定時は `WAJO Sales OS 資料`）

Drive側は `WAJO Sales OS 資料` をルートにし、案件ごとに `案件資料｜...` フォルダを作成または再利用します。Notion側には `DriveフォルダURL`、`DriveフォルダID`、`Drive保存メモ`、PDFリンクを書き戻します。GoogleアカウントのログインパスワードはWorkerへ保存しません。OAuth更新トークンまたは同等のサーバー用認証で接続します。

添付資料の正本台帳は `案件資料DB`（data source: `fde6d55f-3127-4716-862c-5fb43b2cc3b4`）です。問い合わせDB、案件管理DB、営業資料作成依頼DBから双方向relation `案件資料DB` で紐付けます。資料種別は、販売資料、現場写真、発電シミュレーション、経産省/認定資料、電力会社資料、契約/同意書、登記/公図/地番図、ハザード/周辺地図、住民説明会資料、完成図書の10種類を初期値にしています。最低5種類が揃えば現場上は完了目安、最大10種類前後まで集める前提です。

2026-05-31 に Worker 側へ `googleDriveAuth` OAuth capability を追加しました。Notion OAuth redirect URL は `https://www.notion.so/workers/oauth/callback` です。Google Cloud Console で OAuth クライアント（Web application）を作成し、この redirect URL を承認済みリダイレクトURIに入れたうえで、`GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` を `ntn workers env set` で設定します。その後 `NOTION_KEYRING=0 npx ntn workers oauth start googleDriveAuth` で `wajo.sales.doc@gmail.com` を認可すると、以後の提案PDF/住民説明会PDFはGoogle Driveへ保存されます。現時点では `GOOGLE_DRIVE_ROOT_FOLDER_NAME=WAJO Sales OS 資料` を本番Worker環境へ設定済み。MacのGoogle Drive同期フォルダにも `wajo.sales.doc@gmail.com/マイドライブ/WAJO Sales OS 資料/_接続テスト/drive-sync-test.txt` を作成し、Driveデスクトップ側の接続は確認済みです。OAuthクライアントは Google Cloud project `wajo-tochi` に作成済みで、アプリ名は `WAJO Sales OS Drive連携`、OAuth client は `WAJO Sales OS Worker OAuth`。テストユーザーは `isibasi@gmail.com` と `wajo.sales.doc@gmail.com` を登録済み。2026-05-31 時点で `client_id` / `client_secret` は Worker 環境へ設定済み、`wajo.sales.doc@gmail.com` のOAuth認可も完了済みです。Google Drive API は project `981901408071` で有効化済みで、提案PDF/住民説明会PDFともGoogle Drive保存を本番確認済みです。

## 公開している能力

- `processBusinessCardById`: 名刺管理DBのページIDを1件指定して処理する
- `processPendingBusinessCards`: `企業連携ステータス` または `名刺AI処理状態` が `未処理` の名刺をまとめて処理する
- `processBusinessCardWebhook`: 外部サービスやNotion側からWebhookで名刺処理を起動する
- `processInquiryEmailIntake`: Gmail/Yoomなどから渡された問い合わせメールを、お問い合わせDBへ重複なしで登録する
- `processInquiryEmailIntakeWebhook`: 問い合わせメール入口をWebhookで起動する
- `processInquiryCompanyLinkById`: お問い合わせDBの1件から企業マスターへ既存紐づけまたは新規作成する
- `processInquiryCompanyLinkWebhook`: お問い合わせ→企業連携をWebhookで起動する
- `createCustomerContactLog`: 問い合わせ/案件/商談/成約の活動種別・活動内容・次回アクションから顧客接点ログDBへ軽量ログを作成する
- `createCustomerContactLogWebhook`: 顧客接点ログ作成をWebhookで起動する
- `processCompanyResearchById`: 企業マスターのページIDから企業評価と3C三項目を補完する
- `processCompanyResearchWebhook`: 企業マスターのページIDまたは企業名等から企業評価と3C三項目を補完する
- `processMeetingMemoFormatById`: 会議議事録DBのMeeting Notes本文をDBプロパティへ整形する
- `processMeetingMemoFormatWebhook`: 会議メモ整形をWebhookで起動する
- `processMeetingFeedbackById`: 会議議事録DBの整形済み内容から率直フィードバックを返す
- `processMeetingFeedbackWebhook`: 会議フィードバックをWebhookで起動する
- `processMeetingDealLinkById`: 会議議事録DBの商談会議だけを商談管理DBへ紐づける
- `processMeetingDealLinkWebhook`: 会議→商談連携をWebhookで起動する
- `processMeetingTasksById`: 会議議事録DBのアクション項目からチームトラッカーへ重複なしでタスク作成する
- `processMeetingTasksWebhook`: 会議タスク振り分けをWebhookで起動する
- `processManagerReviewById`: マネージャー評価DBから人見さん壁打ち補助メモを返す
- `processManagerReviewWebhook`: 人見さん壁打ち補助をWebhookで起動する
- `processSalesPerformanceReviewById`: 営業パフォーマンスDBから人見さん営業評価案を返す
- `processSalesPerformanceReviewWebhook`: 人見さん営業評価案をWebhookで起動する
- `processDailyReportReceiptSyncById`: 日報受付票DBへ生成済み日報のAI5項目を同期する
- `processDailyReportReceiptSyncWebhook`: WANiPO日報受付票同期をWebhookで起動する
- `processDailyReportLogById`: 承認済み日報を日報ログDBへ評価材料化する
- `processDailyReportLogWebhook`: WANiPO日報ログ化をWebhookで起動する
- `processMeetingPrepReportByCompanyId`: 企業マスターのページIDから商談前準備レポートを作成/補完する
- `processMeetingPrepReportWebhook`: 企業マスターのページIDまたは企業名等から商談前準備レポートを補完する
- `processResidentDocumentById`: 住民説明会ページの必須項目を上から順に検証し、未入力があれば最初の1項目で停止する
- `processResidentDocumentWebhook`: 住民説明会資料作成チェックをWebhookで起動する
- `processProposalSimulationById`: 提案シミュレーションの必須項目を上から順に検証し、利回り/回収年数試算と「御社への結論」文を返す。提案タイプは `法人対象`、`個人投資家向け`、`環境配慮型企業向け`、`系統用蓄電池` を判定し、営業用のA4 2枚構成テキスト（1枚目=結論、2枚目=前提・リスク）を作る。太陽光3タイプでは、販売価格/仕入れ価格/年間売電収入に加え、年間維持費、発電所名、所在地、電力会社エリア、低圧/高圧区分、パネル、パワコン、FIT/FIP、売電単価、残存売電期間、連系開始日を必須確認する。PDFは `提案PDF` / `シミュレーションPDF`（files型）へA4 2ページの安全サマリーとして保存し、保存先が無い場合は同一レコード本文末尾へPDFブロックを追加する。日本語の営業本文はNotion本文/プロパティ側に保持し、提出用の本格日本語PDFはGoogle Docs/Slides連携で仕上げる
- `processProposalSimulationWebhook`: 提案シミュレーションチェックをWebhookで起動する
- `processProjectEquipmentDetailRequestById`: 案件管理DBの1件から `発電所設備詳細DB` を1件だけ作成し、案件側へ紐づける
- `processProjectEquipmentDetailRequestWebhook`: 案件管理DBのボタンから発電所設備詳細を作成する
- `processConfirmedProjectLostDismissWebhook`: 失注確定済み案件のマネージャー用 `失注を差し戻す` ボタンから起動し、案件を `⏳ 確認待ち` へ戻す。失注理由・失注ログは削除しない
- `processConfirmedProjectLostCancelWebhook`: 失注確定済み案件のマネージャー用 `失注を取り消す` ボタンから起動し、案件を `失注前フェーズ` へ戻す。失注理由・失注ログは削除しない
- `processLandEvaluationById`: 土地情報DBのページIDを1件指定して、住所・面積を起点に土地詳細評価を返す
- `processLandEvaluationWebhook`: Notionボタンなどから土地詳細評価を直接起動する
- `processLandCaseById`: 土地情報DBの1件から案件管理DBへ土地案件を重複なしで作成する
- `processLandCaseWebhook`: 土地の案件化をWebhookで起動する
- `processDealMeetingFeedbackById`: 商談管理DBの関連会議から営業フィードバック、改善ポイント、次回トークを返す
- `processDealMeetingFeedbackWebhook`: 商談議事録フィードバックをWebhookで起動する
- `processDealFeedbackSecondReviewById`: 商談フィードバックをChatGPTで二次レビューし、一次欄を上書きせず補助欄へ返す
- `processDealFeedbackSecondReviewWebhook`: 商談フィードバック二次レビューをWebhookで起動する
- `processDealNextActionsById`: 商談フィードバックからチームトラッカーの次アクション候補を重複なしで作る
- `processDealNextActionsWebhook`: ネクストアクションAIをWebhookで起動する
- `collectSalesNews`: RSS/Googleニュース検索から業界ニュースDBへ候補登録する
- `collectSalesNewsWebhook`: ニュース収集をWebhookで起動する
- `processSalesTalkFinalizeByNewsId`: 業界ニュースの生成文を営業トーク管理DBの実戦項目へ整理する
- `processSalesTalkFinalizeWebhook`: 営業トーク管理DB仕上げをWebhookで起動する

## All Green 計画の運用基準

2026-05-24 時点のリリース前判定は、Notion上の `AIエージェント台帳｜起動条件・権限・書き込み範囲` を正本にし、各AIを以下の3軸で見る。

1. 安全性チェック: 読み書き範囲、禁止事項、重複防止、確定系ステータスを勝手に進めないこと
2. トリガーチェック: 手動ボタン、Webhook、定時実行、薄いYoom起動役など、起動経路が1本に整理されていること
3. 品質チェック: 実データまたは削除可テストで、営業・管理者が使える密度の返却があり、薄い場合は完了にせず要確認で止まること

緑化の優先順位は、評価と営業実務への影響が大きい順にする。

1. 人見さん評価系: `processSalesPerformanceReview*`、`processManagerReview*`
2. 会議系: `processMeetingMemoFormat*`、`processMeetingFeedback*`、`processMeetingTasks*`、`processMeetingDealLink*`
3. 商談系: `processMeetingPrepReport*`、`processDealMeetingFeedback*`、`processDealFeedbackSecondReview*`、`processDealNextActions*`
4. 入口系: `processBusinessCard*`、`processInquiryEmailIntake*`、`processInquiryCompanyLink*`、`processCompanyResearch*`
5. 日報系: `processDailyReportReceiptSync*`、`processDailyReportLog*`
6. 土地・案件系: `processLandEvaluation*`、`processLandCase*`
7. ナレッジ・営業トーク系: `collectSalesNews*`、`processSalesTalkFinalize*`

Codex/Worker側で緑にできるのは、処理本体、重複防止、上書き防止、dry-run、本実行、ビルド確認まで。Notion UIでしか緑にできないのは、ボタンプロパティ本体の作成、Webhook URL/secret の貼り付け、Notion AI Meeting Notes の録音開始、保存済みAI本体の画面設定確認である。

2026-05-24 に `npm run check` と `npm run build` は通過済み。リモートWorker環境では `OPENAI_API_KEY`、`OPENAI_MODEL`、`NOTION_API_TOKEN`、`WAJO_WORKER_WEBHOOK_SECRET`、主要data source IDが登録済みであることをキー名のみ確認済み。

2026-05-24 の最終判定では、Notion の `AIエージェント台帳｜起動条件・権限・書き込み範囲` の3軸チェック表を更新し、リリース対象AIは安全性・トリガー・品質・総合をすべて `🟢 緑` に揃えた。`議事録要約オート作成` は旧AIとして `⏸ 停止` のまま資料室扱い。`Notion AI Meeting Notes` の新規録音1件確認は、AI未完成ではなく本番初回の人間UI確認として別管理にする。

## 人見さん評価の読み取り口

人見さん営業評価案は、`営業パフォーマンスDB` と `活動ログ` の2本を正本参照先にする。`営業パフォーマンスDB` は月次数字、ノルマ、商談件数、成約、評価返却欄を持つ月報側の正本で、`活動ログ` はその数字の裏側にある行動証拠のハブである。

`活動ログ` の下には、初期運用では以下を紐づける。

1. `発言ログ`
2. `日報ログ`
3. `顧客接点ログ`
4. `営業ログ`
5. 必要に応じて `営業貢献ログ`

2026-05-24 に `顧客接点ログDB` を追加した。電話、メール、Zoom、現地調査、測量、資料送付などの1回ごとの顧客接点は、活動ログDBへ直接積み上げず、このDBを生ログ正本にする。活動ログDBは月次・評価用の親ハブとして、顧客接点ログから必要な要約だけを受け取る。

- DB URL: `https://www.notion.so/c3c23a1df042497e87737a41ffd029ce`
- data source ID: `b65c13b4-1a72-4c58-8d2d-305c3e04a561`
- 設定書: `めぐるくん｜顧客接点ログ巡回設定` (`https://www.notion.so/36a4d01781e781f19851caaeb7f54d87`)

`createCustomerContactLog` は、顧客接点ログDBへ1件作成し、問い合わせDBの `📅 最終連絡日` または案件管理DBの `最終アクション日` が存在する場合だけ更新する。ステータス、成約/失注、営業パフォーマンスDBの点数、最終評価、活動ログDBへの反映は行わない。

2026-05-26 に顧客接点ログの表示を補強した。Worker は `接点タイトル` と `活動ログ` に `YYYY-MM-DD｜担当者｜活動種別｜活動内容` の1行要約を入れる。Notion の relation 先で表示されるのはページタイトルなので、`活動ログ` だけでなく `接点タイトル` も同じ1行にする。顧客接点ログDBには `関連成約` を追加し、`関連問い合わせ`、`関連案件`、`関連成約`、`関連企業` は各DB側の `顧客接点ログ` から逆引きできる双方向 relation に揃えた。

2026-05-24 に `processSalesPerformanceReviewById` の読み取り口を補強し、営業パフォーマンスDB側に以下の relation がある場合は評価材料として読むようにした。存在しない列はスキップする。

- `関連活動ログ`
- `活動ログ`
- `関連日報ログ`
- `日報ログ`
- `関連発言ログ`
- `発言ログ`
- `関連営業ログ`
- `営業ログ`
- `関連営業貢献ログ`

既存の `関連商談`、`関連成約`、`関連貢献ログ`、`関連マネージャー評価` の読み取りは互換性のため維持する。ただし、最終運用では人見さんが毎回DBを横断するのではなく、活動ログへ整理された要約を優先して読む。

## 企業評価・3C補完ルール

企業評価は、`企業調査ステータス = 完了` なのに3C三項目が空欄で終わる状態を避けるため、企業ページ単体をWorkerへ渡せる入口を追加しました。

1. 企業マスターDBから `企業名`、`ウェブサイトURL`、`メールアドレス`、`問い合わせ要約`、既存の企業評価項目を読む
2. 既存の人間入力や既存AI出力がある項目は、原則として上書きせず保持する
3. 空欄の `企業サマリー`、`現在課題仮説`、`将来課題仮説`、`営業切り口`、`和上解決策適合`、3C三項目、`根拠ソース` を補完する
4. `3C：顧客・市場分析`、`3C：競合分析`、`3C：自社との関係性` が揃った場合のみ `企業調査ステータス = 完了` にする
5. 3C不足が残る場合は `企業調査ステータス = 要確認` で止める
6. `企業AI受付メモ` には、Workerが3C確認・補完を実行したことだけを短く追記する

これはチームトラッカー、商談管理DB、案件管理DBを更新する処理ではありません。企業マスターの評価補完だけに限定します。

## 商談準備ブリーフ品質ゲート

商談準備ブリーフは、営業評価の `商談準備実施数` に連動し得るため、単にボタンが押されたことだけを成功扱いにしません。営業マンが商談前に使える品質を満たしたものだけを `準備完了` とし、根拠や企業別情報が薄いものは `準備中` で止めます。

2026-05-22 に `processMeetingPrepReportByCompanyId` / `processMeetingPrepReportWebhook` を補強し、商談準備作成時に企業情報の補完を試みるようにしました。既存の人間入力や既存AI出力は優先し、不足箇所だけを補います。

`準備完了` にする条件は以下です。

1. 対象企業名が入っている
2. 企業概要が入っている
3. 営業切り口が入っている
4. 売買区分が `未設定` / `不明` ではない
5. 3C三項目が入り、汎用テンプレートのままではない
6. 根拠ソースが `仮説生成` や `公開情報不足` だけではない
7. 企業プロフィール、3C、商談仮説、ヒアリングリスト、注意点・リスクが商談で使える本文量になっている

条件を満たさない場合は、商談準備レポート自体は作成/補完しますが、`ステータス = 準備中` のままにし、`注意点・リスク` に品質チェックメモを残します。評価連動の正本カウントは、原則として `準備完了` の商談準備レポートに寄せます。再実行時はプロパティ更新だけを行い、本文ブロックの追記は新規または空レポートの初回だけに制限します。

## 名刺処理ルール

1. 名刺管理DBから `氏名`、`会社名`、`メール`、`電話`、`住所`、`役職` を読む
2. `会社名`、メールドメイン、電話番号から `企業重複チェックキー` を作る
3. 企業マスターDBを検索し、以下を強い一致として扱う
   - `企業重複チェックキー` 一致
   - 正規化した会社名一致
   - メールドメイン一致
   - 電話番号一致
4. 強い候補が1件なら既存企業へ紐づける
5. 強い候補が複数なら `重複疑い` として止める
6. 強い候補がなければ新規企業を作る
7. 近似候補だけがある場合は、新規企業を作ったうえで企業側を `重複候補` にする
8. 企業マスターへ企業サマリー、課題仮説、営業切り口、3Cを返す
9. 名刺管理DBへ処理結果、Webhook引き継ぎ結果、関連企業を返す
10. 企業マスター側の `関連名刺` も追記する

この設計は、重複を恐れすぎて新規企業が作られない状態を避けるため、強い一致がない場合は作成を優先します。重複が後から判明した場合は、企業マスター側の重複整理で正本企業へ寄せます。

### 企業登録の二重作成ガード確認

企業登録は、名刺起点の `processBusinessCard*` とお問い合わせ起点の `processInquiryCompanyLink*` の2ルートを正本として扱います。再発防止テストは `npm run test:company-registration-duplicate-guard` です。

- 名刺起点: 既存企業の強い候補が1件なら `existing-linked`。企業DBの新規作成は0件。
- お問い合わせ起点: 同一問い合わせキーの既存問い合わせに関連企業があれば、その企業へ `existing-linked`。企業DBの新規作成は0件。
- 企業候補が複数強一致する場合: `duplicate-hold` で停止。企業DBの新規作成は0件。

2026-05-22 に `processCompanyResearchById` と `processCompanyResearchWebhook` を追加し、デプロイ済みです。`🧪 【要整理】AI連携テスト株式会社` に新Webhookを実行し、空欄だった3C三項目が補完され、`企業調査ステータス = 完了` と `企業AI受付メモ` への補完メモ追記まで確認しました。以後、企業ページ単体の `企業評価実行` ボタンは、旧AIで完了だけ上げる経路ではなく、このWebhookへ寄せるのが正本です。

## 土地詳細評価ルール

土地は Yoom を挟まず、既存の `詳細評価を実行` / `土地評価を開始` 相当の Notion ボタンから Worker Webhook を直接呼ぶ方針にします。完全自動化は狙わず、営業マンまたは管理者がボタンを押した時だけ走る手動起動型を正本にします。

処理の基本線は以下です。

1. 土地情報DBから `土地名称`、`所在地`、`面積（坪）`、`電力会社エリア`、`用途地域`、`接道`、`農転/登記/近隣確認`、`変電所距離` など、存在する項目だけを読む
2. 所在地と面積が不足している場合は、`要確認` として止める
3. 所在地から電力会社エリアを一次推定する
4. 面積規模から `系統用蓄電池候補`、`低圧集約候補`、`売却/現地確認候補` の仮説を置く
5. `AI総合スコア`、`総合評価`、`AIアクションバケット`、`案件化状態`、`土地評価`、`電力評価（仮説）`、`AI案件種別`、`次アクション` など、土地DBに存在する列だけへ返す
6. 系統、接道、農転、登記、補助金、需要地距離は確定扱いにせず、人間確認前提のメモとして返す

土地Workerは、既存プロパティがあるものだけを更新します。列名がない場合はスキップし、既存データやプロパティ定義は壊しません。

2026-05-21 時点で、ローカル実装は追加済み、`npm run check` と `npm run build` は通過済みです。初回の `ntn workers deploy` はキーチェーン認証が見つからず停止しましたが、`NOTION_KEYRING=0 ntn workers deploy` でファイル認証を明示してデプロイ完了済みです。Worker capability として `processLandEvaluationById`、Webhook として `processLandEvaluationWebhook` が公開されています。

同日、土地DBの `【Worker直結テスト｜削除可】土地評価ボタン用 20260521` で live 実行を確認済みです。`processLandEvaluationById` の返却は `evaluated / 案件化候補 / A / 85点` で、Notion 側には `処理ステータス = 完了`、`案件化状態 = 案件化保留`、`AIアクションバケット = 系統保留`、`AI案件種別 = 高圧系統用`、`AI総合スコア = 85`、`総合評価 = A`、`土地評価 = ◎`、`電力評価（仮説） = △`、`需要評価 = あり`、`案件化メモ`、`次アクション` まで返りました。さらに `processLandEvaluationWebhook` へ直接POSTして `eventId = 2bfa2be9-f443-4f15-bc2c-42d0557e6cb6` が返り、Webhook経由でも同じNotion返却が維持されることを確認済みです。

Notion 側の既存ボタン `詳細評価を実行` にも `Webhookを送信する` アクションを追加済みです。URL は `processLandEvaluationWebhook`、ヘッダーは `x-wajo-worker-secret`、送信内容は最小限の `土地名称`、`所在地`、`面積（坪）` を使います。Notion のWebhook payloadでページURL内の日付をページIDとして誤認するケースがあったため、Worker側はURL末尾のNotionページIDを優先して拾い、ページIDがない場合は土地名称・所在地・面積から対象土地を特定するよう補強しました。ボタン実地テストでは run `019e4731-2444-7444-94c8-973cc254f1b5` が正常終了し、Notion 側で `AI更新日時 = 2026-05-20T21:01:00.000Z`、`処理ステータス = 完了`、`AI総合スコア = 85`、`総合評価 = A` を確認済みです。

## 実地テスト結果

2026-05-20 に以下を確認済みです。

- `Worker検証蓄電株式会社` の1枚目名刺を処理し、新規企業が作成された
- 同じ会社名、同じドメイン、同じ電話番号の2枚目名刺を処理し、既存企業に紐づいた
- 2枚目処理時に新しい企業は増えなかった
- 企業マスター側の `関連名刺` に2枚の名刺が入った
- 企業側に3C項目が返った
- Webhook は HTTP 202 を返し、Notion Worker の実行履歴で正常終了を確認した
- TypeScript check と build は通過済み

2026-05-21 に Yoom 接続後の本流テストとして、以下も確認済みです。

- `【Yoom本流テスト】佐伯 結太｜20260521003037` を Webhook 直接起動で処理し、企業マスターに `Yoom本流テスト蓄電株式会社20260521003037` が新規作成された
- 同じ会社名、同じメールドメイン、同じ電話番号の `【Yoom重複テスト】鈴木 試験｜20260521003037` を処理し、既存企業へ紐づいた
- 2枚目処理時に新しい企業は増えず、企業マスター側の `関連名刺` が2件に増えた
- Yoom 監視側DBにトリガー用ページを作成後、Worker処理側DBの `【Yoom自然起動テスト】高橋 自動｜20260521003318` が数分後に `新規企業作成` / `引き継ぎ済` へ変わった
- Yoom は重複判定の本体ではなく、Workerを起こす役として実動確認済み
- 追加の入口確認として `【Yoom追加重複テスト】中村 入口｜20260521004306` は既存企業へ紐づき、`【Yoom追加新規テスト】森田 入口｜20260521004306` は新規企業作成、3C返却まで完了した
- 追加確認ではYoomトリガー用ページ作成後に数分待っても自然起動を確認できなかったため、`{ "limit": 3 }` を直接POSTして処理を完了させた。Worker本体は安定、Yoom自然起動は待ち時間/ばらつきありとして扱う

## 現在の制約

- このワークスペースでは、2026-05-20 時点で Notion Worker の Automation capability は有効化されていません。そのため、いまの本番候補は Custom Agent Tool、Webhook、またはYoomなどの外部起動です。
- `GEMINI_API_KEY` または `GOOGLE_API_KEY` が未設定の場合、外部調査ではなくWorker内の仮説生成を使います。この場合、推測を含む文面には `推測ですが` を入れる設計です。
- Notion側のDB項目名を変えた場合、Workerの読み書き先も合わせて修正が必要です。

## Yoom 起動設定メモ

Yoom は重複判定や企業作成の本体ではなく、Worker を起こすための起動役として使います。判断ロジックは Worker 側に寄せ、Yoom 側はできるだけ薄く保ちます。

### 問い合わせメール入口

2026-06-01 に `processGmailInquiryInbox` と `syncGmailInquiryInbox` を追加し、Yoom を使わず Worker が Gmail の `問い合わせ` ラベルを直接読む入口へ移行しました。Gmail 直読みでは、Worker が `問い合わせ` ラベルの未完了メールを取得し、既存の `processInquiryEmailIntake` に渡して重複判定・お問い合わせDB作成・必要時の企業連携を行います。作成または既存検出に成功したメールだけ `INQUIRY_DONE` ラベルを付けます。

### 問い合わせメール入口（Gmail直読み）

- Tool: `processGmailInquiryInbox`
- Sync: `syncGmailInquiryInbox`（5分ごと）
- OAuth capability: `googleGmailAuth`
- OAuth scope: `https://www.googleapis.com/auth/gmail.modify`
- 読み取り元ラベル: `GMAIL_INQUIRY_SOURCE_LABEL_NAME`（未設定時 `問い合わせ`）
- 完了ラベル: `GMAIL_INQUIRY_DONE_LABEL_NAME`（未設定時 `INQUIRY_DONE`）
- デフォルト検索: `GMAIL_INQUIRY_DEFAULT_QUERY`（未設定時 `newer_than:7d`。古い未完了ラベルの一括流入を防ぐ）
- 1回の処理件数: `GMAIL_INQUIRY_POLL_LIMIT`（未設定時10、最大50）
- 成功時に元ラベルを外すか: 未設定時は外す。`GMAIL_INQUIRY_REMOVE_SOURCE_LABEL=false` の場合だけ元ラベルを残す。Gmail検索で `-label:INQUIRY_DONE` が効かないケースがあるため、再処理防止は `INQUIRY_DONE` 付与 + 元 `問い合わせ` ラベル解除を正本にする。
- 除外対象: Yoomのエラー/完了など運用通知メール。`notify@yoom.fun` からのメール、または `【エラー発生】`、`フローボットタイトル`、`オペレーションタイトル`、`このメールはYoomから自動的に送信されています` を含むメールは、問い合わせDBを作らず `INQUIRY_DONE` 付与 + 元ラベル解除だけ行う。

初回セットアップでは、Google Cloud Console の OAuth クライアントに Gmail API を有効化し、Worker 側の `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を使って `NOTION_KEYRING=0 npx ntn workers oauth start googleGmailAuth` を実行します。認可するGoogleアカウントは、問い合わせメールと `問い合わせ` / `INQUIRY_DONE` ラベルを持つGmailアカウントです。

2026-06-01 本番接続済み。Google Cloud project `wajo-tochi` / `981901408071` で Gmail API を有効化し、`googleGmailAuth` を `isibasi@gmail.com` で認可しました。`processGmailInquiryInbox` の本番実行では、直近7日・`問い合わせ` ラベルの3件を処理し、新規2件、既存1件、エラー0件、完了ラベル3件でした。直後のdry-runで対象0件を確認済み。

2026-06-14 訂正: `syncGmailInquiryInbox` が healthy で5分間隔稼働している、という上の旧報告は誤りでした。現行ソースに `syncGmailInquiryInbox` / `worker.sync` は存在せず、5分ごとの LaunchAgent も作成していません。Gmail直読みの実体は手動実行可能な `processGmailInquiryInbox` です。

### 旧Yoom Webhook入口（退避）

2026-05-23 に `processInquiryEmailIntakeWebhook` を追加しました。問い合わせメールでは、Yoom 側の Notion検索、分岐の「有無」、Notionページ作成は外し、Gmailトリガーで取得した値を Worker へ送るだけに寄せていました。2026-06-01以降はGmail直読みを正本にし、このWebhook入口は緊急時の退避・手動投入用として残します。

- Method: `POST`
- URL: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/vip9HRA_m0KP8H7a/processInquiryEmailIntakeWebhook`
- Header: `Content-Type: application/json`
- Header: `x-wajo-worker-secret: <.env.worker.local の WAJO_WORKER_WEBHOOK_SECRET>`
- Body: `件名`、`from`、`to`、`本文`、`受信日時`、`GmailメールID`、`Message-ID`、`Thread-ID`、`Gmailラベル`、`linkCompany: true`

Yoom 側で保持していた Gmail トリガー、Notion検索、分岐、Notionページ作成は停止対象です。`gmail:{GmailメールID}` の保存、既存問い合わせの確認、問い合わせDB作成、必要時の企業連携は Worker 側で行います。

2026-05-23 の追加確認では、旧 `検証｜お問合せmail→notion v2 重複防止` が Notion 操作でエラー通知を出していました。5/19以降の明確なフォーム問い合わせ9件は `processInquiryEmailIntake` で手動バックフィル済みです。以後は v2 の Notion検索/分岐/Notion作成を使わず、この Webhook へ渡す構成に切り替えます。

2026-06-14 確認: Yoom から `フローボット停止2週間前` 通知が届いていた旧 `検証｜お問合せmail→notion v2 重複防止` は、画面で以下6件の停止済みを確認しました: `32695622`, `32674003`, `32644910`, `32599058`, `32566628`, `32519379`。問い合わせメール入口の正本は引き続き Worker の Gmail 直読みで、Yoom側の旧 Notion 検索/分岐/Notion作成フローは復活させないでください。

同日確認: Yoom `【本番】名刺管理DB -> Notion Worker起動`（template `401076` / trigger `212974`）は画面上で `トリガーOFF`、かつ「現在のプランでは実行できないオペレーションが含まれています」と表示されていました。過去通知の `object_not_found` は旧 database ID `3634d017-81e7-8177-b796-000b96b5d885` を参照したためのエラーで、2026-06-14時点ではこのYoomフローは自動起動しない状態です。

2026-06-14 追加修正: 問い合わせメール入口の重複防止が Gmail 個体ID / Message-ID / Thread-ID 寄りで、同一人物のフォーム本体・返信メール・資料請求違いを別問い合わせとして作る弱点を確認しました。`findExistingInquiryByEmail` に連絡先ベースの既存検索を追加し、`メールアドレス + お名前`、`電話番号 + メールアドレス`、`電話番号 + お名前`、または同一メールアドレスで14日以内の既存問い合わせを検出した場合は新規作成せず `skipped-existing` にします。再発防止テストは `npm run test:gmail-inquiry-intake` で、鎌田慎司さん相当の返信メールが既存問い合わせへ止まるケースを追加済みです。`npm run check`、`npm run build` 通過後、Worker `019e452d-22e7-7de1-b5ea-432a297bb478` へ再デプロイし、capability 一覧に `processGmailInquiryInbox` が出ることを確認しました。再デプロイ直後の `processGmailInquiryInbox` dry-run は `checked: 0 / created: 0 / existing: 0 / errors: 0` で、未処理の問い合わせラベル対象はありませんでした。

2026-06-14 5分ごと自動実行: `scripts/run-gmail-inquiry-inbox.sh` と `scripts/install-gmail-inquiry-worker-launchagent.sh` を追加しました。LaunchAgent 名は `com.wajo.gmail-inquiry-worker`、間隔は300秒です。起動するのは Worker tool `processGmailInquiryInbox` だけで、Codex/AI/企業調査は起動しません。自動実行時の引数は `dryRun:false / limit:20 / query:newer_than:30d / sourceLabelName:問い合わせ / doneLabelName:INQUIRY_DONE / removeSourceLabel:true / linkCompany:false` です。ログは `/tmp/wajo-gmail-inquiry/run.log` と `/tmp/wajo-gmail-inquiry/run.err` に残します。重複起動は `/tmp/wajo-gmail-inquiry.lock` で防止します。停止は `npm run gmail:inquiry:uninstall-5min` です。

同日整理: 既に作成済みだった重複候補は削除せず、AI専用の `重複判定ステータス` / `企業連携ステータス` を `重複疑い` にしてメモへ正本候補を残しました。対象は川上卓さんの `問-260613-002`（正本候補 `問-260613-001`）と、鎌田慎司さんの返信側 `問-260612-001`（正本候補 フォーム本体 `問-260612-002`）です。既に案件化済みのページが含まれるため、削除・アーカイブは未実施です。

2026-05-30 追加: 問い合わせタイトルは短縮表記へ寄せる。形式は `問-YYMMDD-001｜売/買｜名前/会社名｜太陽光｜低/高/低バ/高バ｜⚠` を基本にする。`⚠` は太陽光の売却・売買案件で中を開いて確認が必要という意味に限定し、理由は存在する場合のみ `確認待ち内容` へ `太陽光案件のため中身確認が必要です。` として書き戻す。主な理由は、所在地未確認、販売価格未確認、FIT/FIP・売電単価未確認、現場写真未確認/未添付、バルク候補。購入相談だけの太陽光問い合わせは、販売側の必須情報不足とは扱わず、原則 `⚠` を付けない。

同日確認: `cleanInquiryTitles` の本番 dry-run は、Worker/Notion API 側で正本問い合わせDB data source `0a7b4703-e62b-4e0d-9376-83cd370e69cd` を query できず停止した。`ntn datasources resolve 12e78d235e4b48d6b5826197b5b17b88` では同 data source を解決できるため、IDの形ではなく integration 共有/アクセス権の確認が必要。コード変更自体は `test:inquiry-title-cleanup`、`test:inquiry-project-creation`、`check`、`build` 通過後に Worker ID `019e452d-22e7-7de1-b5ea-432a297bb478` へデプロイ済み。

### 名刺入口

推奨フロー名は `【本番】名刺管理DB → Notion Worker起動` です。

Yoom 側の HTTP リクエスト設定は以下を正本にします。

- Method: `POST`
- URL: 上記 `processBusinessCardWebhook` の Webhook URL
- Header: `Content-Type: application/json`
- Header: `x-wajo-worker-secret: <.env.worker.local の WAJO_WORKER_WEBHOOK_SECRET>`
- Body: Notion の名刺ページIDが取れる場合は `{ "pageId": "{{名刺ページID}}" }`
- Body: ページID連携が不安定な場合は `{ "limit": 3 }`

Yoom の Custom Connect では、カスタムヘッダー欄を `x-wajo-worker-secret: ...` の行形式ではなく、以下の JSON 形式で入れます。

```json
{"x-wajo-worker-secret":"<.env.worker.local の WAJO_WORKER_WEBHOOK_SECRET>"}
```

2026-05-20 のテストでは、`{ "limit": 3 }` の POST で Worker から HTTP 202 と eventId が返るところまで確認済みです。

2026-05-21 の自然起動テストでは、Yoom監視側DBの作成をきっかけに、Worker処理側DBの未処理名刺が数分後に処理されることを確認しました。現在の構成では、Yoom は旧形式 data source ID を監視し、Worker は新しい `名刺管理` data source の未処理行を拾います。そのため、名刺の実投入先は Worker 処理側DBへ寄せるか、Yoom側でWorker処理側DBへ転記してから起動する構成へ整えるのが次の改善候補です。

追加テストでは、Yoomトリガー用ページを作成しても数分以内に自然起動しないケースがありました。本番初日は、未処理名刺の監視ビューを見ながら、止まっている場合は `processBusinessCardWebhook` に `{ "limit": 3 }` を送る予備手順を使います。長期的には、Yoom側で更新ページIDを渡すか、Worker処理側DBへ転記してから起動する構成へ寄せるのが安全です。

営業マン向けには `未処理` という言葉を見せない方針に固定します。`名刺管理` には `営業用｜名刺登録だけ（完成版）`、管理側には `管理用｜入口未処理・要対応（完成版）` と `管理用｜入口処理ボード（完成版）` を追加済みです。完成運用の正本メモは `マニュアル保管庫（旧Ver.も含む）` の `名刺入口｜完成運用ルール` です。

パーソナルプランでは `カスタムコネクト` がプラン制限になり、フローボットの `トリガーON` が無効化されました。2026-05-20 にミニプラントライアルを適用した後、制限表示が消えたことを確認しています。

検証用に Google Apps Script 迂回も確認しましたが、GCP の Client ID / Client Secret / scope の事前設定が必要なため本番では未採用です。Yoom 上に一時追加していた Google Apps Script オペレーションは削除済みで、現在の本番フローは Notion トリガー + Custom Connect の1オペレーション構成、`トリガーON` です。

フリープランで新規フローボット作成上限に当たる場合は、不要なOFFの旧コピーを1本だけ流用します。本番の `お問合せmail→notion` と、検証用 `検証｜お問合せmail→notion v2 重複防止` は問い合わせ系のため触らない方針です。

流用候補は、現時点で本流ではなさそうな `【コピー】指定時間にkintoneから特定条件を満たすレコードをNotionに追加する` または `【コピー】Notionに追加されたページをもとに、AIワーカーがGammaでプレゼン資料を作成して紐づける` です。削除ではなく、まずOFFのまま中身を差し替え、HTTP 202 と Worker 実行履歴の正常終了を確認してからONにします。

## 成約報告の安全運用

2026-05-25 時点では、`processClosingReportWebhook` の挙動をいったん安全側へ変更していました。案件管理DBの `🏆 成約報告する` から Worker を起動した場合、同一案件の有効な成約報告があれば新規作成せず、未作成の場合だけ成約報告DBへ `申請中` レコードを1件作る構成でした。

この時点では案件管理DBのステータスは `📤 成約申請中` までに留め、案件の `成約日` は更新しませんでした。成約確定、確定日、承認者は成約報告DB側の `✅ 承認する` ボタンで処理する前提でした。

この旧前提は 2026-05-26 の方針変更で上書き済みです。

2026-05-26 に採用方針を「報告即時反映 + マネージャー後追い差し戻し/取り消し」へ更新しました。`processClosingReportWebhook` は、案件管理DBを `🏆 成約`、案件の `成約日` を当日、成約報告DBの `承認ステータス` を `成約` にします。締め済み/歩合確定済み、または `歩合確定額` が入った成約報告は取り消し不可です。

2026-05-27 に月次反映先を再整理しました。ノルマ申請DBは「目標申請の原本」とし、成約報告の実績反映先は営業マンパフォーマンスDBの月次成績ビューに戻します。`processClosingReportWebhook` は成約報告DBへ成約1件を作ったあと、営業マンパフォーマンスDBから `期間種別 = 月次`、`対象営業ユーザー = 案件の担当営業ユーザー`、`開始日/対象期間 = 当月` のレコードを探し、その `関連成約` に成約報告を追記します。該当月次レコードがなければ `YYYY年M月 月次成績` を自動作成します。担当営業ユーザーが未設定の場合のみ、クリックしたユーザーを補助的に使います。マネージャーの差し戻し/取り消しでは同じ `関連成約` から外し、月次成績のrollupを下げます。ノルマ申請DBへ成約報告を直接紐付ける旧Webhook `processMonthlyQuotaLinkWebhook` は退役扱いで、書き込みを行いません。

同日追加で、成約報告前の必須条件を明確化しました。`実績粗利額` または `予定粗利額` が空/0以下の場合は成約報告を作らず、案件ページに確認コメントを残して停止します。案件の `売買区分` は `売却案件` / `購入希望` / `売買両方` のいずれかが必須で、`不明`、`その他`、空欄の場合は成約報告も月次成績への後追い反映も止めます。成約報告DB側の `成約種別` は、`売却案件 -> 売却成約`、`購入希望 -> 購入成約`、`売買両方 -> 売買両方` に変換します。

同日に案件管理DBへ `管理アクション状態`、`管理アクション日`、`管理アクションメモ` を追加しました。マネージャー専用ボタンは案件DB側に `processProjectDismissWebhook` / `processProjectCancelWebhook` を貼ります。差し戻しは `ステータス = ⏳ 確認待ち`、取り消しは `ステータス = ❌ 失注` として履歴を残し、ページ削除や関連DB一括更新は行いません。

営業部通知は `notifySalesTeamWebhook` で受けます。Notionコメント上で全員へメンション通知するには、Worker 環境変数 `SALES_TEAM_USER_IDS` に営業部NotionユーザーIDをカンマ区切りで入れるか、Webhook body の `salesTeamUserIds` / `sales_team_user_ids` に同じIDリストを渡します。未設定時はコメント本文だけを残します。

主要Webhook URL:
- 成約報告: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/eBDUHxs_oQtd4M6f/processClosingReportWebhook`
- 成約差し戻し: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/70DMIf_89tfsH_Fy/processClosingDismissWebhook`
- 成約取り消し: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/XDUDzL4q41sZogn4/processClosingCancelWebhook`
- 案件差し戻し: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/Ny-nh3XiXJ_F-QkY/processProjectDismissWebhook`
- 案件取り消し: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/eNoyVNvfHHCwAFgJ/processProjectCancelWebhook`
- 問い合わせ担当取得: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/51cRpfeV-PFBlkyK/processInquiryAssignOwnerWebhook`

配置ルール:
- `🏆 成約を報告する` は案件管理DBに置く。営業担当が押す入口で、成約報告DB作成、案件ステータス成約化、月次成績反映まで行う。
- `成約差し戻し` と `成約取り消し` は成約報告DBに置く。マネージャーダッシュボードに表示する場合も、成約報告DBのリンクドビュー内だけに出す。月次成績から関連成約を外して数字を下げる対象はこの2つ。
- `案件差し戻し` と `案件取り消し` は案件管理DBに置く。マネージャーダッシュボードに表示する場合も、案件管理DBのリンクドビュー内だけに出す。成約報告DBや月次数字は直接触らず、案件の状態整理に使う。
- 1つのダッシュボード上に両方のビューを置いてよいが、成約報告用ボタンを案件DBビューに混ぜない。案件用ボタンを成約報告DBビューに混ぜない。
- 営業部通知: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/_hxuTFeAU5TWHKnE/notifySalesTeamWebhook`

再発防止テストは `test:closing-report-safety`、`test:closing-report-cancel-safety`、`test:monthly-performance-link`、`test:project-manager-action`、`test:inquiry-assign-owner` です。2026-05-27 時点では `test:second-review`、TypeScript check / build も通過済みです。

月次成績の再発防止テストは `test:monthly-performance-link` です。テスト内容は「成約報告IDが当月の営業マンパフォーマンスDBレコードの `関連成約` に重複なく追記されること」「対象期間の月境界が日本時間で崩れないこと」です。

## 問い合わせDB「担当になる」安全ボタン

2026-05-26 に、`processInquiryAssignOwnerWebhook` を追加しました。お問い合わせDBの `担当営業ユーザー` が空欄のときだけ、Webhookを起動したユーザーを担当にします。既に担当者がいる場合は上書きせず、ページコメントで担当変更はマネージャー経由にする旨を残します。

Webhook URL:
`https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/51cRpfeV-PFBlkyK/processInquiryAssignOwnerWebhook`

更新対象はお問い合わせDBの既存プロパティのみです。存在する場合に限り `担当営業ユーザー`、`ステータス = 担当確定`、`進捗フェーズ = 担当確定`、`担当確定日` / `担当取得日` / `担当日` / `最終アクション日` を更新します。担当取得に成功したときは営業部通知コメントを残します。全員メンションを飛ばす場合は `SALES_TEAM_USER_IDS` または Webhook body の `salesTeamUserIds` / `sales_team_user_ids` が必要です。

禁止事項は、既存担当者の上書き、案件化、企業作成、成約報告、評価DB更新です。担当変更・担当解除は管理者ボタン側で別途扱います。再発防止テストは `test:inquiry-assign-owner` です。

## フェーズ変更と失注理由の安全ルール

2026-05-30 に、問い合わせフェーズと案件フェーズは営業個人が簡単に手入力で変えられない運用へ寄せる方針にしました。営業画面の `問い合わせフェーズ` / `案件フェーズ` / `ステータス` は原則として現在地の表示にし、状態変更は `担当になる`、`案件化する`、`成約を報告する`、`失注にする`、`差し戻す` などのNotionボタンまたはWorker経由へ集約します。

Worker実装では、`成約`、`失注`、`差し戻し`、`取り消し`、`完了` のように数字・評価・管理判断へ影響する状態を直接書き換える処理に、条件チェック、処理者、処理日、前フェーズ、メモの記録をできるだけ持たせます。Notion単体では「DBは編集可だがステータス列だけ編集不可」の制御が弱いため、次に問い合わせ入口、Yoomail、案件フェーズ、成約/失注フローを触る時は、手入力ステータスを前提にしない設計を優先します。

失注は、問い合わせであっても案件であっても `失注理由` 必須です。`失注理由` が空のまま `失注` へ進めるボタン/Workerは `needs-lost-reason` のような失敗扱いで止め、問い合わせ/案件のステータスを変更しません。可能なら `失注理由メモ`、`失注日`、`失注処理者`、`失注前フェーズ` も残します。

問い合わせ段階の失注は、1日5〜6件来る前提で全件マネージャー承認にすると重すぎるため、原則は「失注理由必須 + 全体/管理者へのアナウンス」で運用します。誰がどの問い合わせを何の理由で失注にしたかを流し、えり好みや雑な見切りを可視化します。案件化後、または `案件化スコア` が高い問い合わせ、資料が揃っている問い合わせ、高粗利見込みの問い合わせは、勝手に失注させず `失注申請中` または管理者確認へ回します。

`失注理由` の初期候補は、`価格条件が合わない`、`連絡不通`、`他社決定`、`顧客都合で中止`、`条件未達`、`対象外案件`、`重複問い合わせ`、`情報不足`、`その他` です。問い合わせ側と案件側で同じ理由カテゴリを使い、入口で落ちたのか、案件化後に落ちたのかを後で分析できる状態にします。

## Google Drive資料管理の方針

2026-05-30 に、案件資料の正本置き場は Google Drive に寄せる方針にしました。Notion側には既に `案件資料`、`資料収集ステータス`、`必要資料チェック`、`不足資料メモ`、`完成図書候補`、案件側の `問い合わせ資料` / `完成図書` などの受け入れ体制があります。Drive接続は石橋大右個人アカウントではなく、`和上セールス部` のような法人/部門用Googleアカウントを新設して紐付けます。個人アカウント保管に見えると社内心理上も運用上も弱いため、資料・シミュレーションPDF・住民説明会資料・完成図書は部門アカウントのDriveを正本にします。

Worker/Notionの次回実装では、問い合わせ受付時点でDriveフォルダを作るか、既存フォルダURLを紐付ける導線を検討します。NotionにはDriveファイル本体を重複保存するのではなく、DriveフォルダURL、主要資料URL、資料チェック状態、不足メモを残します。住民説明会資料やシミュレーションもDrive保存へ寄せます。

案件化判定では、価格情報、売主意向、現地写真、経産省提出データ、電力会社資料、発電シミュレーション、契約/同意書などの資料が揃うほど `案件化スコア` / `案件化ステータス` が上がる形にします。資料不足のまま正式案件化しないよう、Yoomail/問い合わせ入口/案件化Workerを触る時はDrive資料状態をゲート条件に含めます。

## スコア連動の滞留アラート

2026-05-30 に、滞留アラートをスコア込みで重くする方針をWorkerへ反映しました。従来の単純な最終アクション日からの経過時間に加えて、`案件化スコア` / `成約スコア` が高いものは短い放置でも強いアラートにします。

- 95点以上で8時間超: `🚨 実行待ち当日超`
- 80点以上で24時間超: `🔴 高スコア1日超`
- 65点以上で48時間超: `🔴 高スコア2日超`
- 7日超/10日超: 従来どおり絶対日数として最重視

問い合わせで `活動を残す` / `createCustomerContactLog` により顧客接点ログが1件作られた時、問い合わせの `ステータス` が `未対応` ならWorkerが `対応中` へ進めます。営業が直接ステータスを触るのではなく、実際の活動記録を根拠に状態が動く設計です。関連テストは `test:sales-pipeline-signal` と `test:customer-contact-log-title` です。

## 表示専用ミラー列の運用

2026-05-31 に、営業マンがステータス/スコアを直接いじりにくくするため、問い合わせDBと案件管理DBに表示専用のformulaミラー列を追加しました。営業ビューでは正本の `ステータス`、`案件化スコア`、`成約スコア`、推奨フェーズ系プロパティを隠し、下記の `表示｜...` 系だけを出します。

- 正本問い合わせDB data source `0a7b4703-e62b-4e0d-9376-83cd370e69cd`: `表示｜問い合わせステータス`、`表示｜問い合わせフェーズ`、`表示｜案件化スコア`、`表示｜案件化近さ`
- 案件管理DB data source `54e869d7-ba3e-49e1-b760-af46e23499cb`: `表示｜案件ステータス`、`表示｜推奨フェーズ`、`表示｜成約スコア`、`表示｜成約近さ`

この列はあくまで読み取り表示であり、実ステータス/スコアの更新口ではありません。状態変更は `担当になる`、`活動を残す`、`案件化する`、`成約を報告する`、`失注にする` などのボタンまたはWorkerに寄せ、管理者確認ビューだけ実プロパティを見せます。Notion Public APIでは既存ビューの表示/非表示を安全に一括変更しにくいため、ビュー整備時は手動UIで「実プロパティを非表示、表示ミラーを表示」に揃えます。

2026-05-31 に、Webhook/Workerから作成する主要ページへNotion DBテンプレートを明示適用するよう修正しました。Notion API の `pages.create` は `template` を指定でき、`children` と同時指定はできないため、Workerはテンプレートを適用してから必要な本文ブロックだけを後追いで追加します。対象は問い合わせメール入口、問い合わせから案件化、土地から案件化、企業作成（問い合わせ/名刺）、顧客接点ログ、会議から商談作成です。問い合わせから `processInquiryProjectCreationWebhook` で案件化した新規案件ページは `案件入力テンプレート` を適用したうえで、初期本文ブロック `営業サマリー｜次のアクション` を追加します。内容は `営業状態: 🔴 情報収集中`、元問い合わせ、問い合わせ側の `確認待ち内容`、次に確認すること、ステータス/スコアを手で整えずボタン/Workerで進める運用ルールです。

同日追加で、問い合わせから案件化した新規案件ページには、Notion標準アイコン `school` を `orange` で設定し、カバーはNotionの横長カバー表示に合わせた `assets/project-case-cover-wide.png` を `file_upload` で付与します。テンプレート選択肢をユーザーに出す方式ではなく、Workerが `案件入力テンプレート` を1種類だけ明示適用し、その後に本文補足とアイコン/カバーだけを付ける運用です。使用するFile Upload IDは、カバー `3714d017-81e7-8185-8498-00b21fcffbe1` です。

2026-05-31 に、失注確定済み案件向けのマネージャー操作を2本追加しました。`processConfirmedProjectLostDismissWebhook` は `❌ 失注` の案件だけを対象に、`⏳ 確認待ち`、`失注申請状態 = 差し戻し`、`管理アクション状態 = 失注差し戻し` へ更新し、全員通知コメントを残します。`processConfirmedProjectLostCancelWebhook` は `❌ 失注` の案件だけを対象に、`失注前フェーズ` があればそこへ、なければ `📋 提案中` へ戻し、`失注申請状態 = 取り消し`、`管理アクション状態 = 失注取り消し`、`失注日 = clear` とします。どちらも失注理由・失注理由メモ・失注ログは消さず、監査履歴として残します。失注承認、失注申請差し戻し、失注済み差し戻し、失注取消はすべて `MANAGER_USER_IDS` に含まれるクリックユーザーだけ実行できます。Webhook URL は以下です。

- 失注を差し戻す: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/92Gexl74o1tdanpN/processConfirmedProjectLostDismissWebhook`
- 失注を取り消す: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/wv6-Eovmx0wbBZyS/processConfirmedProjectLostCancelWebhook`

Notion UI側の推奨ボタン名は、案件管理DBのマネージャー/失注処理ビューに `失注を差し戻す` と `失注を取り消す`。どちらも確認ダイアログを入れ、Webhook送信 payload は `This page` / `pageId` または `projectPageId` がWorkerへ渡る形にします。`失注を差し戻す` は「失注済み案件を確認待ちへ戻します。失注理由と失注ログは残します。」、`失注を取り消す` は「失注判定を取り消し、失注前フェーズへ戻します。失注理由と失注ログは監査履歴として残します。」を確認文にします。

同日仕上げとして、問い合わせDB・案件管理DBの両方に rich_text の `表示｜営業サマリー` と `表示｜次のアクション` を追加しました。これは固定された第1ステップ、第2ステップの管理ではなく、活動・情報量・案件化/成約スコアから「今どのあたりにいるか」と「次にやること」を示す無段階スコアリング表示です。`refreshSalesPipelineSignal` は、問い合わせでは `営業状態 / 次の推奨段階 / 成約見込み` と `次のアクション: 担当になる・活動を残す・案件化する` を、案件では `営業状態 / 次の推奨段階 / 成約見込み` と `次のアクション: 設備詳細を作成・シミュレーション作成・説明会用資料作成・成約報告する` を書き込みます。実ステータスは変更しません。直近確認として、問い合わせ `3704d017-81e7-808f-a6db-d46d31222b4e` と案件 `3704d017-81e7-81bc-9aa0-cbb64ee50593` で本番更新し、両列に表示が入ることを確認済みです。

2026-05-31 追加修正として、問い合わせから案件化した直後に、問い合わせ側の `表示｜営業サマリー` と `表示｜次のアクション` も同時に案件化済み表示へ更新するようにしました。これまでは `紐づき案件` と `ステータス = 案件化` は更新済みでも、問い合わせカードの表示が `案件化有無: なし` / `活動を残す` のまま残ることがあり、営業マン目線では途中で止まったように見えていました。今後は案件化処理時に `案件化有無: あり`、`次のアクション: 案件管理DBで活動を残す / 設備詳細を作成` まで同時更新します。

突貫の完成ロードマップは3つに圧縮します。Step 1 は `営業状況` と `次にやること` を営業ビューの前方へ出し、営業マンが最初に見る導線を完成させること。Step 2 は Webhook作成ページにNotionテンプレートを適用し、テンプレート適用後にWorkerが必要本文を補完する方式へ寄せること。Step 3 は本番スモーク確認として、問い合わせから案件化、活動ログ、設備詳細、シミュレーション、説明会資料、成約/失注の各ボタンが壊れていないことをテストページで確認し、営業に渡せる状態にすること。現時点でコード/DB列/ボタン/Workerはほぼ揃っており、残る主作業はNotion UI上のビュー前方表示と本番クリック確認です。

ユーザー側では `スタッフホーム`、`マネージャーホーム`、`スタッフダッシュボード`、`マネージャーダッシュボード` をリライト中です。2〜3日前に作成した整理前の営業フォーム/営業導線は廃止前提で扱い、新しいホーム/ダッシュボードには混ぜません。石橋さん側で今必要なのは、Notion UIで営業ビューの前方に `表示｜営業サマリー` と `表示｜次のアクション` を出すこと、古い営業フォームを `旧/廃止` と分かる状態にして新ホームから外すこと、実際の営業導線に `担当になる` / `活動を残す` / `案件化する` / `設備詳細を作成` / `シミュレーション作成` / `説明会用資料作成` / `成約報告する` / `失注申請する` が見えるか確認することです。

## 次に広げる候補

- 問い合わせDB: Gmail/Yoomの重複防止後、企業マスター連携をWorkerへ寄せる
- 日報受付票DB: 受付票から正本日報を1件だけ作る夜間処理をWorker化する
- 会議議事録DB: 会議後の商談連携、タスク化、3行要約の安定実行をWorkerへ寄せる
- 成約報告DB: 成約報告から勝因、次に活かす学び、ナレッジ化候補を構造化する
- マネージャー評価DB: 月次評価前の不足データ検知と人見さんへの引き渡しをWorker化する
## 提案タイププロパティ（Notion設定手順）

提案シミュレーションを置くDB（`営業資料作成依頼DB` または `資料生成DB`）に、以下を追加する。

2026-05-30 時点では、新規の受け皿DB `営業資料作成依頼DB` を作成済み。

- Database URL: `https://www.notion.so/485fef2e35474fe78ae04acc97b0d6c7`
- Data source ID: `9701e891-ffd0-43d7-b6f9-911fedc65391`
- 提案シミュレーションWebhook URL: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/Ho54j_2ZeWWlpCog/processProposalSimulationWebhook`
- 入力例4件: `法人対象`、`個人投資家向け`、`環境配慮型企業向け`、`系統用蓄電池`
- 実行確認: `【入力例】系統用蓄電池｜2MW/4MWh提案書` で `processProposalSimulationById` を実行し、`シミュレーション準備完了`、`提案PDF` 1件保存まで確認済み。
- 2026-05-30 実装確認: `PDF提案化する` ボタンを追加し、Webhook送信先を上記URLへ接続済み。Notion CLI/Public APIではボタンアクションやカスタムヘッダーを更新できないため、`processProposalSimulationWebhook` はNotionボタン起動時にURL内トークンで受ける設計（追加ヘッダー不要）へ変更済み。`npm run check`、`npm run test:proposal-simulation-validation`、`npm run build`、`NOTION_KEYRING=0 npx ntn workers deploy` 通過。秘密ヘッダーなしPOSTの成功 eventId は `b813b9cd-3f91-4772-b309-9feef4fa4f72`。
- 2026-05-30 追加確認: 入力不足時は `入力待ち`、不足解消後は `シミュレーション準備完了` へ変わることを画面上で確認済み。`processProposalSimulation` は返却メモへ `提案タイプの選び方` を追加し、`提案タイプガイド` / `提案タイプ説明` / `資料タイプ説明` プロパティがあれば同じ内容を書き込む。PDFはA4 2ページの安全サマリーとして、ヘッダー、区切り、指標カード、タイプガイドを追加した。pdf-lib標準フォント制約のため、PDF内は英数字中心、営業提出用の日本語本文はNotion本文/Google Docs・Slides連携側で仕上げる。`npm run test:proposal-simulation-validation`、`npm run check`、`npm run build`、`NOTION_KEYRING=0 npx ntn workers deploy` 通過済み。
- 2026-05-30 用語補正: 和上実務の正規用語に合わせ、`営業資料作成依頼DB` の `買取総額` を `仕入れ価格` へリネーム済み。Workerの出力メモは `販売価格` / `仕入れ価格`、本文の案件概要は `販売価格` で表示する。既存レコードや旧テンプレート保護のため、読み取りaliasとして `買取総額` / `買取価格` / `原価` / `仕入総額` は残す。`npm run test:proposal-simulation-validation`、`npm run check`、`npm run build`、`NOTION_KEYRING=0 npx ntn workers deploy` 通過後、`個人投資家向け` 入力例で本番Worker再実行まで確認済み。
- 2026-05-30 太陽光PDF構成補強: 太陽光3タイプでは、`年間維持費（ランニングコスト）`、`発電所名`、`所在地`、`電力会社エリア`、`低圧/高圧区分`、`パネルメーカー`、`パネル型式`、`パネル枚数`、`DC容量（パネル側kW）`、`パワコンメーカー`、`パワコン型式`、`PCS容量（パワコン側kW）`、`FIT/FIP区分`、`売電単価`、`残存売電期間`、`連系開始日` を必須化した。`年間維持費（ランニングコスト）` は合計入力を優先し、未入力なら `O&M費`、`保険料`、`地代`、`固定資産税`、`除草費`、`監視通信費`、`管理費` の入力済み内訳を合算する。`稼働年数` は連系開始日から自動計算し、`年間手残り` をPDF/メモの主要数字へ追加。`営業資料作成依頼DB` へ不足プロパティを追加し、太陽光入力例3件を補完済み。`npm run test:proposal-simulation-validation`、`npm run check`、`npm run build`、PDF画像確認、`NOTION_KEYRING=0 npx ntn workers deploy`、`processProposalSimulationById` 本番実行、Webhook POST（eventId `2eedb7fe-d9e0-476f-a238-7b08360a4b20`）まで確認済み。
- 2026-05-30 現場写真枠追加: `営業資料作成依頼DB` に files型の `現場写真` を追加済み。太陽光3タイプのPDFでは1ページ目上部に `Site Photos` 枠を常設し、`現場写真` / `発電所写真` / `現地写真` / `外観写真` / `設備写真` / `写真` のfiles型から最大2枚を読み込む。PNG/JPEGがあれば、スマホ縦写真を想定した3:4の縦長2枠へ横並びで差し込む。未入力時は既存レコードを止めず、2枚分の写真枠だけ表示する。営業提出前は `現場写真` を実質必須として確認する。`npm run test:proposal-simulation-validation`、`npm run check`、`npm run build`、PDF画像確認、`NOTION_KEYRING=0 npx ntn workers deploy`、`processProposalSimulationById` 本番実行まで確認済み。
- 2026-05-30 PDFリンク導線補強: `営業資料作成依頼DB` にURL型の `提案PDFリンク` とrich_textの `資料作成メモ` を追加した。WorkerはPDF保存後、`提案PDF` files型、`提案PDFリンク` URL型、既存互換の `提案PDF URL` rich_text に書き込む。`個人投資家向け` 入力例で `提案PDF` 1件、`提案PDFリンク` URLありを確認済み。
- 2026-05-31 提案シミュレーションPDF日本語化: 社内確認用とお客様テスト用は分けず、同一PDFを使う方針にした。`@pdf-lib/fontkit` と Noto Sans JP TTF を使い、提案シミュレーションPDFのタイトル、見出し、提案の結論、物件概要、確認ポイント、次のアクションを日本語表示へ変更した。日本語フォントはサブセット埋め込みだとQuick Lookで文字化けしたため、PDFビューア互換を優先して `subset: false` で埋め込む。金額などASCIIだけの値はHelvetica Boldで描画し、桁間隔が広がらないようにした。`npm run test:proposal-simulation-validation`、`npm run check`、`npm run build`、`NOTION_KEYRING=0 npx ntn workers deploy` 通過後、表示テストページ `【資料テスト】提案シミュレーションPDF 20260531-033511` で本番実行し、Notion `提案PDF` files 1件 + `提案PDFリンク` 保存、ダウンロードPDF 3,152,227 bytes / 2ページ、Quick Lookサムネイルで日本語と主要数字の表示を確認済み。
- 2026-05-31 見積補足ブロック追加: 提案シミュレーションPDFの1ページ目へ `見積補足コメント` を追加し、設備費ではなく20年間の収益資産として見る位置づけ、税制・補助金・融資・保険・発電量の確認前提を短く表示するようにした。2ページ目には `比較・和上を選ぶ理由` を追加し、不動産・定期預金・株式・保険商品・車両償却などとの比較観点、施工/O&M/金融機関連携/長期対応/30年実績、解体・廃棄費用や出力抑制まで隠さない提出前ルールを入れた。サンプルPDF `/tmp/wajo-proposal-strong.pdf` をQuick Lookサムネイルで目視し、1ページ目の見積補足コメント表示まで確認済み。
- 2026-05-31 投資メモ型レイアウトへ再調整: 提案シミュレーションPDFの1ページ目を、情報を詰め込む日本式見積書ではなく、海外の投資審査メモのような静かなレイアウトへ変更した。グラフは紙面上部の小さな `RECOVERY MODEL` パネルへ縮小し、0年/5年/10年/15年/20年の累計手残り、赤い投資額ライン、回収年数、20年累計だけを表示する。本文は `THESIS`、`KEY NUMBERS`、`CONDITIONS`、`WAJO REVIEW` のフレームへ分割し、段落を短くして、チラシ感を避ける。買主が最初に見る `出した金に対してどれだけ返るか` は残しつつ、紙面全体は落ち着いた投資メモとして見せる方針。サンプルPDF `/tmp/wajo-proposal-memo.pdf` をQuick Lookサムネイルで目視し、小型グラフ、フレーム分割、余白の表示を確認済み。
- 2026-05-31 セカンダリー資産化の価値訴求追加: 中古発電所/セカンダリー案件向けに、1ページ目の下段カードを `WAJO SECONDARY ASSET PROTOCOL` へ変更した。内容は、和上が現地で施工の粗さ、管理不良、劣化、将来故障しやすい箇所を数字の前に見抜くこと、仕入れた発電所をそのまま右から左へ流さず、現地確認、資料原本確認、設備状態の洗い出し、必要な手直し、O&M設計まで整えてから渡すこと、発電所を箱に詰め、洗い、磨き、ワックスをかけ、リボンをかけて渡すように買主が保有後に説明しやすい状態へ整えることを短く入れた。サンプルPDF `/tmp/wajo-proposal-secondary.pdf` をQuick Lookサムネイルで目視し、下段カード内に3段落が収まることを確認済み。
- 2026-05-30 案件DBから資料作成へ進む入口: 案件管理DBに `資料作成依頼` relation、`提案PDFリンク` URL、`資料作成メモ` rich_text を追加した。営業資料作成依頼DB側の逆relationは `関連案件`。Workerに `processProjectProposalRequestById` / `processProjectProposalRequestWebhook` を追加し、案件ページから営業資料作成依頼DBへ `資料種別 = 提案書`、`シミュレーションステータス = 入力待ち` の依頼を1件作成して案件側へ紐づけ返す。既に `資料作成依頼` がある場合は重複作成しない。資料作成依頼側でPDF生成が完了した場合、`関連案件` があれば案件側の `提案PDFリンク` / `資料作成メモ` へも書き戻す。正式テスト案件でdry-run、本実行、再実行existingまで確認済み。案件管理DB上部のNotionボタンは、`シミュレーション作成` をこのWebhookへ接続する想定。`説明会用資料作成` は次に同じ入口設計で住民説明会/事前周知資料側へつなぐ。
- 2026-05-30 説明会用資料見本確認: k-report のPDF見本はA4縦13ページ。1ページ目は周辺住民向けの所有者変更通知、2ページ目は改正再エネ特措法の趣旨と発電所所在地/ハザードマップ枠、3ページ目は事前周知対象判定表と事業計画、4-5ページ目は関係法令遵守・土地権原・着工/運転開始、6-10ページ目は安全面/景観面/生活環境面の影響と予防措置、11-12ページ目は廃棄費用・積立・含有物質・産廃処理・原状回復、13ページ目は説明会対象エリア地図。`説明会用資料作成` は `シミュレーション作成` と別入口にし、資料種別は `住民説明会資料` または `所有者変更周知` として扱う。追加必須候補は、旧/新認定事業者、設備ID、出力、低圧/高圧区分、パネル/パワコン情報、発電所所在地画像、ハザードマップ、説明会対象エリア画像、反射光画像（夏至/冬至）。
- 2026-05-31 住民説明会PDFを日本語13ページ化: 旧実装は英語の1ページ要約だったため、k-report見本の構成に合わせてA4縦13ページの日本語ドラフトへ置き換えた。構成は、所有者変更通知、制度趣旨と設備概要、所在地/ハザード、事前周知対象判定、関係法令・土地権原、安全面、景観面、生活環境面、反射光、廃棄費用・含有物質、産廃処理・原状回復、説明会対象エリア、提出前チェックリスト。`発電所所在地画像`、`ハザードマップ`、`説明会対象エリア画像`、`反射光画像`、`現場写真` はPDF内の画像枠へ差し込む。`npm run test:resident-document-validation` で13ページ生成を検証し、`npm run test:proposal-simulation-validation`、`npm run check`、`npm run build`、`NOTION_KEYRING=0 npx ntn workers deploy` 通過済み。本番テストページでGoogle Drive保存も確認済み。住民説明会側は `資料PDFリンク` を優先し、`提案PDFリンク` へ混ざらないようにした。
- 2026-05-31 住民説明会PDFの表紙強化: 住民説明会PDFに濃紺の左帯、金色アクセントライン、`WAJO LOCAL BRIEFING DOCUMENT` のヘッダー表示を追加した。1ページ目には `この資料の位置づけ`、13ページ目には `提出前の最終判定` の注意枠を入れ、地域住民向けの説明資料でありながら、社内提出前チェックにも使える見た目へ寄せた。サンプルPDF `/tmp/wajo-resident-strong.pdf` をQuick Lookサムネイルで目視し、表紙の日本語表示と注意枠を確認済み。
- 2026-05-30 説明会用資料入口を実装: Workerに `processProjectResidentDocumentRequestById` / `processProjectResidentDocumentRequestWebhook` を追加した。案件ページIDから `営業資料作成依頼DB` に `資料種別 = 住民説明会資料`、`資料作成ステータス = 入力待ち`、`周知方法 = 所有者変更周知` の依頼を作り、案件側 `資料作成依頼` relationへ戻す。重複判定は `関連案件 + 資料種別` なので、提案書依頼と説明会用資料依頼は同一案件に共存できる。追加したDBプロパティは `資料作成ステータス`、`案件番号`、`発電所住所`、`周知方法`、`質問受付期間`、`周知日`、`保守管理責任者 氏名`、旧/新認定事業者、設備ID、認定出力kW、発電所所在地画像、ハザードマップ、説明会対象エリア画像、反射光画像（夏至/冬至）。`npm run test:project-document-request`、`npm run test:resident-document-validation`、`npm run test:proposal-simulation-validation`、`npm run check`、`npm run build`、`NOTION_KEYRING=0 npx ntn workers deploy` 通過。正式テスト案件でdry-run、作成、再実行existing、提案依頼existing、説明会依頼の `processResidentDocumentById` dry-run（不足項目 `案件番号`）まで確認済み。
- 2026-05-30 NotionボタンUI接続完了: 案件管理DB上部の `シミュレーション作成` と `説明会用資料作成` をそれぞれ該当Webhookへ接続済み。確認メッセージ、`作成する` / `キャンセル`、既存プロパティ送信を設定した。`説明会用資料作成` はテスト案件 `群馬５５webhookテスト` でUI実行し、Notionの正常実行表示を確認済み。企業ダッシュボード上部の空 `New database` / `新規データベース` は0件確認後にアーカイブ済み。
- 2026-05-30 入力不足時の即時停止パッチ: 案件管理DBの `シミュレーション作成` / `説明会用資料作成` は、依頼レコード作成前に案件ページの必須項目を事前チェックする。不足があれば `needs-input` で止め、営業資料作成依頼DBを作らない。Webhookは `needs-input` をthrowしてNotionボタン側を失敗扱いにする。入力済みの場合は、案件側の金額・設備・日付・画像を営業資料作成依頼DBへ引き継ぐ。太陽光提案では `現場写真` も必須化し、住民説明会資料では旧/新認定事業者、設備ID、発電所所在地画像、ハザードマップ、説明会対象エリア画像、反射光画像、現場写真も必須化。`npm run test:project-document-request`、`npm run test:proposal-simulation-validation`、`npm run test:resident-document-validation`、`npm run check`、`npm run build`、`NOTION_KEYRING=0 npx ntn workers deploy` 通過済み。
- 2026-05-30 B案へ変更: 営業マンが `営業資料作成依頼DB` へ直接数字を入れる運用はやめ、案件管理DBを入口、`発電所設備詳細DB` を案件に1対1で紐づく設備入力DB、営業資料作成依頼DBをPDF作成ジョブ/履歴DBとして扱う。新規 `発電所設備詳細DB` database: `ed53afa4-59bf-4e14-a798-9eb3a431ee70` / data_source: `c326e9e7-e8ed-4918-b885-c5883dd3f35b`。案件DBには `発電所設備詳細` relation、企業マスター向けに `紹介元企業` / `売主企業` relationを追加済み。既存の `紹介ブローカー` は人ベースの紹介者として残す。Workerは案件ページに紐づく設備詳細ページを読み、案件側の価格・提案タイプと設備詳細側の発電所/設備/写真情報を統合して資料作成依頼へ引き継ぐ。`processProjectEquipmentDetailRequestWebhook` URL: `https://www.notion.so/webhooks/worker/3874d017-81e7-81d1-8a0c-00030776854b/019e452d-22e7-7de1-b5ea-432a297bb478/r2sLVvUvvE-CszWo/processProjectEquipmentDetailRequestWebhook`。`npm run test:project-equipment-detail-request`、`npm run test:project-document-request`、`npm run test:proposal-simulation-validation`、`npm run test:resident-document-validation`、`npm run check`、`npm run build`、`NOTION_KEYRING=0 npx ntn workers deploy` 通過済み。dry-runで案件 `岐阜県中津川市` は `発電所設備詳細DBへ「岐阜県中津川市｜設備詳細」を作成します` と返ることを確認済み。

1. `提案タイプ`（`select`）
- `法人対象`
- `個人投資家向け`
- `環境配慮型企業向け`
- `系統用蓄電池`

2. `提案PDF`（`files`）

3. `シミュレーションメモ`（`rich_text` か `text`）

4. `御社への結論`（`rich_text` か `text`）

運用ルール:
- `提案タイプ` 未選択時はタイトル/案件種別から推定するが、営業実務では明示選択を推奨。
- 4タイプの選び方は、`法人対象` = 黒字対策・即時償却・社内決裁、`個人投資家向け` = 私的年金・資産形成・相続、`環境配慮型企業向け` = ESG・脱炭素・CO2削減・企業価値、`系統用蓄電池` = BESS・系統接続・JEPX/容量市場/需給調整市場。迷ったら人間が `提案タイプ` を先に選ぶ。
- 太陽光提案の金額項目は `販売価格` と `仕入れ価格` を正規名にする。`買取価格` は和上内では `仕入れ価格` と同義として扱う。
- `系統用蓄電池` を選ぶ場合は、最低でも `総事業費`、`実質投資額`（または `補助金想定額`）、`年間想定総売上` を入力する。
- 提案書を押すビューでは `提案タイプ`、`提案PDF`、`シミュレーションメモ`、`御社への結論` を表示列に固定する。
- Notion Public APIではボタンのWebhookアクション内容まで安全に作成できない。ボタン名は `PDF提案化する`、対象は `このページ`、Webhook送信先は上記 `processProposalSimulationWebhook`。2026-05-30時点で接続済み。
