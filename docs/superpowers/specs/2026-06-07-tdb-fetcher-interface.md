# TDB取得部品 I/F契約書（ステップ0成果物）2026-06-07

> 本題＝営業が使えるデータの「最後のピース＝TDB確報与信」。その差し込み口を、**画面に依存しない"契約"として先に固める**ための文書。実画面マッピングとスクレイパ本体はこの後（Mac mini前で大ちゃん立会い）。盲目でスクレイパは書かない。

## 0. 全体像（誰が何をやるか）

```
[Worker側 src/index.ts]                       [取得部品＝会社Mac mini(24h稼働)]
 fetchTdbProfile(company)                        TDB Fetcher (Playwright)
   └─ process.env.TDB_FETCHER_URL を POST  ─────▶  ① CosmosNetへ自動ログイン
        body: {企業名, ヒント}                       ② 企業名/住所で検索
   ◀──────────  TdbProfile(JSON) 返却  ──────────  ③ 結果ページから8項目抽出
   └─ normalizeTdbProfile で型検証                   ④ 正規化(です/[1]を除去)してJSON返す
   └─ scoreCompany(tdb) で与信確定
   └─ tdbToPatches(tdb) で構造化8列へ
```

* **Worker側はブラウザを動かさない。** HTTPで叩くだけ。
* **CosmosNetのID/パスは取得部品(Mac mini)側の環境変数だけ**に置く。Worker・コード・Notion・チャットには絶対出さない。
* この契約が決まっていれば、**Worker側と取得部品を並行開発でき、後から差し替えるだけ**になる。

## 1. Worker側の環境変数（既存パターン＝process.env直読み）

`Env`型は無く、本プロジェクトは `process.env.XXX` を直接読む（例: `PERPLEXITY_API_KEY` [src/index.ts:84](../../../src/index.ts)）。TDBも同じ流儀で追加：

| 変数 | 例 | 用途 |
|---|---|---|
| `TDB_FETCHER_URL` | `http://<mac-mini-host>:8787/tdb` | 取得部品のエンドポイント。**未設定なら従来通りnull＝暫定与信にフォールバック** |
| `TDB_FETCHER_TOKEN` | `（共有シークレット）` | 取得部品との簡易認証（Bearer）。CosmosNet本体のID/パスではない |

> CosmosNet の ID/パスは **ここには置かない**。取得部品側（Mac mini）の環境変数に置く。

## 2. リクエスト（Worker → 取得部品）

`POST {TDB_FETCHER_URL}`　`Authorization: Bearer {TDB_FETCHER_TOKEN}`

```json
{
  "企業名": "株式会社エコスタイル",
  "ヒント": {
    "website": "https://www.eco-st.co.jp/",
    "住所": "大阪府大阪市中央区道修町..."
  }
}
```

* `企業名` 必須（`CompanyInfo.name`）。`ヒント`は名寄せ精度向上用（同名他社の誤取得を防ぐ。`CompanyInfo.website`/`address`から渡す）。
* 法人番号は現状 `CompanyInfo` に無いので送らない。**TDB側が法人番号を返してくる**（下記レスポンス）→ それを構造化列「法人番号（TDB）」に保存する。

## 3. レスポンス（取得部品 → Worker）＝ `TdbProfile` に一致させる

成功時（[src/index.ts:887](../../../src/index.ts) の `TdbProfile` と同型 + `status`）：

```json
{
  "status": "found",
  "企業評点": 51,
  "倒産確率Pct": 1.2,
  "年商": "154億1千万円",
  "資本金": "1,541百万円",
  "従業員数": "406名",
  "設立": "2004年10月5日",
  "業種": "太陽光発電・電力小売",
  "代表者": "木下 公貴",
  "法人番号": "1234567890123",
  "調査年月日": "2026-05-30",
  "raw": "（CosmosNet帳票の元テキスト・監査用）"
}
```

見つからない／失敗時：

```json
{ "status": "not_found" }      // 該当企業なし
{ "status": "error", "reason": "login_failed | timeout | parse_failed" }
```

### 正規化ルール（取得部品側の責務＝"スッキリ"はここで担保）
* `企業評点`・`倒産確率Pct` は**数値 or null**（"—"や未取得は null）。`scoreCompany` がこの数値で与信を確定する。
* 文字項目（年商・資本金・代表者…）は**事実値のベタ書き**。**「です。」「[1][3]」等の語尾・出典番号を付けない**（本日の品質監査①の再発防止。出典はWorker側で別管理）。
* `調査年月日` は ISO（`YYYY-MM-DD`）。`tdbToPatches` が日付列へ入れる。
* `raw` は監査用に元帳票テキストを丸ごと（後で抽出ロジックを直す時の証拠）。

## 4. Worker側 `fetchTdbProfile` 差し替え（擬似コード・シグネチャ維持）

現状 [src/index.ts:405](../../../src/index.ts) は `return null` のみ。これを次に差し替える（**引数 `company: CompanyInfo` は変えない**＝呼び出し側 5066行 無改修）：

```ts
async function fetchTdbProfile(company: CompanyInfo): Promise<TdbProfile | null> {
  const url = process.env.TDB_FETCHER_URL?.trim();
  if (!url) return null; // 未設定＝従来通り暫定与信(信頼度中/タイミング待ち)にフォールバック
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.TDB_FETCHER_TOKEN ?? ""}`,
      },
      body: JSON.stringify({
        企業名: company.name,
        ヒント: { website: company.website, 住所: company.address },
      }),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return normalizeTdbProfile(data); // status!=="found" や型不一致は null を返す
  } catch {
    return null; // 取得部品が落ちていても本体リサーチは止めない
  }
}
```

`normalizeTdbProfile(data): TdbProfile | null`（**実装済**・テスト `src/tdb-fetcher.test.ts`）：
* **null を返すのは `status!=="found"` か非オブジェクトの時だけ**（not_found/error/壊れデータ→暫定与信にフォールバック）。
* 評点・倒産確率は `typeof==="number" && isFinite` を検証、それ以外は **null に丸める**（プロファイル全体は捨てない）。`scoreCompany` は評点nullを暫定扱いできるので、評点が壊れても年商・代表者等の事実は活かせる。
* 文字項目は string 化＋trim。欠損は空文字。

## 5. テスト方針（TDD・実装時）

* `normalizeTdbProfile`：found正常／not_found／error／型壊れ／評点が文字列、の各ケースをユニットテスト（`fetch`は呼ばないので純関数で回せる）。
* `fetchTdbProfile`：`TDB_FETCHER_URL`未設定→null、`fetch`成功/失敗をモックして null/TdbProfile を確認。
* 既存 `scoreCompany`/`tdbToPatches` のテストは**変更不要**（契約を合わせたため）。

## 6. 取得部品（Mac mini側）の責務 — ※実装はこの後

Playwrightで：CosmosNetログイン → 企業名/住所で検索 → 結果ページから8項目抽出 → §3形式に正規化してHTTP返却。
**実画面マッピング（ログイン/検索/結果のセレクタ確定）は大ちゃん立会いで一度実際に辿ってから**。CosmosNetのID/パスはMac miniの環境変数に置く。

### フォールバック（保険）
自動取得が不安定な間は「営業がCosmosNet帳票をコピペ → AIが§3の8項目へ解析」する貼り付け方式も用意可（規約も安全）。`normalizeTdbProfile` はそのまま再利用できる。

## 7. 「完了」の定義（証拠で示す）
実在1社で **[ボタン]→TDB8項目が企業マスターの構造化列に入り、与信が"暫定"でなく実評点ベース（信頼度/提案可否が評点由来）になり、ドシエに「TDB評点◯/倒産確率◯%」が出る**こと。テスト＋実機Notion結果で証拠提示してから「完了」と言う。
