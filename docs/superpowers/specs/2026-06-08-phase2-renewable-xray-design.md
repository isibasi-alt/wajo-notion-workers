# フェーズ2「再エネ丸裸」設計（太陽光特化エンリッチメント）2026-06-08

> ゴール: 名刺1枚から、相手企業の再エネ状況を無料ソースで丸裸にし、営業が「買い手か売り手か＋切り口」を即つかめる状態にする。フェーズ3(ミラクル翔太/自社データ示唆)はスコープ外。

## 1. アーキテクチャ
**新DB「再エネ丸裸」(1社1カード) ──relation──▶ 企業マスター。** Workerが無料ソースを束ねて1カードをupsert。企業ページのタブには関連表示(=Notionタブの正しい使い方。前回の連絡先タブ失敗を回避)。

## 2. 新DBスキーマ(案1=1社1枚・YAGNI最小)
- 企業名(title) / 企業(relation→企業マスター ★タブ表示の鍵)
- 区分判定(select: 買い手候補/売り手候補/両面/不明)
- 保有再エネ容量合計(number kW) / FIT・FIP保有(select: あり(事業用)/なし/不明)
- 系統用蓄電池の芽(select: 高/中/低) / 自家消費余地(select: 高/中/低)
- 営業切り口(text) / 出典(text) / 最終更新(date)
- 設備明細(区分/出力/所在地/認定日)はカード本文にリスト。
- 企業マスター側の追加は **relation列1本のみ**(鉄板ルール=最小)。

## 3. データソース(全部無料)
- **FIT/FIP事業計画認定情報**(fit-portal.go.jp/publicinfo): 事業者名で 設備区分/出力/所在地/認定日 → 保有設備+容量合計。事業用のみ(20kW未満太陽光除外=むしろ狙いに合致)。**保有なし=自家消費の青地シグナル**。
- **gBizINFO**(APIキー申請中): 補助金/調達/許認可/業種/規模の再エネ接点。
- **Perplexity**(既存稼働): 脱炭素方針/再エネニュース/決裁者。
- 既存企業マスター値(業種/規模/所在地): 自家消費余地・電気代規模・蓄電池芽を推定。

## 4. データフロー
名刺→企業マスター(既存)→[再エネ丸裸]→ ①FIT検索(名+住所)→保有設備/容量 ②gBizINFO→補助金/調達/許認可 ③Perplexity→姿勢/ニュース ④業種規模所在地から推定 ⑤AI統合→区分判定+切り口(出典明示・不明は「推測ですが」) ⑥新DB upsert + 企業マスター「再エネ接点シグナル」に要約1行。

## 5. 買い手/売り手 判定(純関数化・テスト対象)
- FIT保有(事業用)あり×容量大 → 売り手候補(発電所仲介)
- FIT保有なし×電力消費大の業種/施設 → 買い手候補(自家消費/蓄電池)
- 両方→両面 / 情報不足→不明(断定しない)

## 6. エラー処理・安全
各軸が空/不一致でもnull化し他軸は活かす(既存normalize思想)。名寄せ曖昧は「候補」+出典で断定回避(全無料源=課金リスクなし)。既存値・手入力は非破壊(空欄補完のみ)。

## 7. 実装で詰める論点
FITはREST APIでなくCSV/検索サイト → (a)公表CSV取込→ローカル索引 vs (b)検索サイト都度引き(TDB部品と同じPlaywright流儀)。MVPは(b)、件数増えたら(a)。

## 8. テスト方針
- FITパーサ(事業者名→設備/容量)を実データTDD(エコスタイルG=FIT認定多数=教材)。
- 区分判定を純関数でユニットテスト(売り手/買い手/両面/不明)。
- 商号正規化は wajo-tdb-fetcher の normalizeName を流用/共通化。

## ★実装進捗 2026-06-08（エネルギー核＝実データ検証済・緑）
- **FIT公表データの実体はXLSX**(都道府県別・名前検索でなく一括DL)。設備所在地ベースで県別分割→1社の全国保有は全県取込が必要。事業用のみ(20kW未満太陽光は非公表)。
- `~/wajo-tdb-fetcher/fit.mjs` 新設(純関数):
  - `extractFitHoldings(rows, 事業者名)`=行配列から保有設備抽出(設備ID/区分/出力kW/所在地/運開/調達満了)+容量合計。
  - `classifyRenewable({容量合計kW,件数,業種})`=買い手/売り手/両面/不明＋蓄電池の芽＋自家消費余地＋理由。
  - `holdingsToMarkdown`=カード本文用。列位置`FIT_COL`は2026-04-30大阪府で実測(月次/他県で要再検証)。
- `normalizeName`にNFKC正規化追加(半角カナ・全角英数等の表記ゆれ吸収。TDB名寄せも堅牢化)。
- `fit.test.mjs`=**実データ(株式会社エコスタイル大阪2基)**でTDD緑。`npm test`=parse+matcher+fit 全緑。
- 実機デモ: 大阪府XLSX(4,126行)→エコスタイル2基/79kW→区分判定「両面」生成を確認。
- **残(キー待ち/別ステップ)**: ①gBizINFO連携(APIキー申請中) ②全国47県FIT取込→ローカル索引(I/Oシェル。XLSX読込はpython openpyxl or SheetJS) ③Notion新DB「再エネ丸裸」作成+企業マスターにrelation列1本(承認済方針) ④Worker capability配線(FIT/gBizINFO/Perplexity統合→カードupsert)。
- XLSX→行配列の取込はI/Oシェル責務(本核は純関数)。Worker(serverless)で全国XLSX保持は重い→TDB部品同様ローカル/Mac mini常駐サービス案が有力。

## ★実装進捗(2)2026-06-08深夜 — (い)Notion新DB作成 +(う)全国取込パイプライン 完了
### (い) Notion新DB「再エネ丸裸」= 作成＆実カード投入で検証済
- DB id `f10c5473-4c9e-4567-9b1b-558f78768a4c` / data_source `90752cb5-3159-4ed3-810f-1bafeeb07507` / 親=STAFF HOMEページ(後でUI移動可)。
- 列(10): 企業名(title)/企業(relation→企業マスター ★**single_property=企業マスター側に列追加せず=30ビュー無傷**)/区分判定/保有再エネ容量合計kW/FIT・FIP保有/系統用蓄電池の芽/自家消費余地/営業切り口/出典/最終更新。
- ★新API(2025-09 data_source中心)の罠: POST /v1/databases は `properties` を無視し既定Name列だけ作る→列はPATCH /v1/data_sources/<id> で追加。relationは data_source_id 指定・type=single_property。
- 実カード投入成功(エコスタイル page 3784d017-...): 区分=両面/79kW/FIT=あり/蓄電池の芽=高/relation=エコスタイル企業ページ。重複なし。
### (う) 全国47県FIT取込パイプライン = 実走検証済
- `~/wajo-tdb-fetcher/fit_ingest.py`: 公表ページから現行fileIDを出現順抽出→固定県順(北海道→沖縄)に割当→DL→**自作XLSXパーサ(openpyxl非依存)**→normalizeName(NFKC)で正規化キー索引化→`data/fit_index.json`。`python3 fit_ingest.py`(全47)/`... 大阪府 広島県`(部分)。
- `fit.mjs`に`loadFitIndex`/`lookupHoldings`追加(extractと同形→classifyRenewableへ直結)。
- 実走: 大阪府=4,122設備→2,817事業者索引化→エコスタイルlookup2件79kW一致。`npm test`(parse/matcher/fit)全緑。
- 全国一括は帯域節約で未実行(コマンド一発)。fit_index.json/samplesはgitignore。
### 残(次の一手)
1. **gBizINFO連携**(APIキー和上アカウントで申請中)→補助金/調達/許認可/規模を同様に索引/取得。
2. **Worker capability配線**: 名刺企業→fitlookup(+gBizINFO+Perplexity)→区分判定/切り口→Notion「再エネ丸裸」へupsert(企業relation付き)。serverlessでXLSX索引は重い→fit-fetcherをローカル/Mac mini常駐(TDB部品と同居)でHTTP提供する案。
3. (任意)タブ表示用に企業マスター側へ同期relation列が要るなら、その時だけ明示でdual化(ビュー再設定覚悟)。

## 9. スコープ外/別管理
- Part1(有料TDBの管理職×有効取引先ゲート)=別物(無料の本丸裸は課金ゲート不要)。docs/.../2026-06-08-tdb-alternatives-and-gating.md で管理。
