import assert from "node:assert/strict";
import { processKnowledgeToTakaraRoutingForTest } from "./index";

// お宝ルーター（採用ナレッジ→お宝DB自動振り分け）の分類・起票ロジックを検証する。
// 実DBは叩かず、Notionクライアントをモックして create/update/comment を捕捉する。
// 検品基準（配線案）: ①事実系は正しいDBへ ②該当なしは行を作らない ③根拠URL逆リンク
//   ④データ状態=下書き ⑤判断カードは状態=未確認・判定は自動確定しない ⑥採用時のみ流す

const GRID_DS = "f19878cf-8833-40f2-b25c-e84da760db08";
const LAND_DS = "3a588533-451c-449c-a2be-f273c5ae7a01";
const GOV_DS = "e45ec9a0-bedb-4a17-a412-5b4c5c662e13";
const CARD_DS = "351ba44e-590c-446e-b4be-a14b1fd88257";

// 生成行ページが返す「全プロパティ空」ページ（safeUpdateExistingProperties が既存型を見るため）
function unionRowProperties(): Record<string, unknown> {
	const props: Record<string, unknown> = { Name: { type: "title", title: [] } };
	for (const n of ["情報区分", "データ状態", "FITFIP区分", "対象電圧", "判断軸", "状態", "判定"]) {
		props[n] = { type: "select", select: null };
	}
	for (const n of ["根拠URL", "根拠ページ"]) props[n] = { type: "url", url: null };
	for (const n of ["最終更新日"]) props[n] = { type: "date", date: null };
	for (const n of [
		"エリア名", "都道府県", "抑制運用メモ", "標準抑制率メモ", "土地活用一次メモ",
		"市区町村・地域帯", "地域キー", "農地種別メモ", "判断に効くメモ",
		"市区町村・対象エリア", "競合会社名", "競合戦略メモ", "判断理由", "次アクション", "地域",
	]) {
		props[n] = { type: "rich_text", rich_text: [] };
	}
	return props;
}

function knowledgeProps(decision: string, title: string, point: string, input: string): Record<string, unknown> {
	return {
		候補判定: { type: "select", select: { name: decision } },
		ナレッジタイトル: { type: "title", title: [{ plain_text: title }] },
		要点: { type: "rich_text", rich_text: [{ plain_text: point }] },
		入力テキスト: { type: "rich_text", rich_text: [{ plain_text: input }] },
	};
}

type Case = { id: string; props: Record<string, unknown> };

const cases: Record<string, Case> = {
	"know-a": {
		id: "know-a",
		props: knowledgeProps(
			"採用",
			"SOLSELが兵庫で買取価格を提示",
			"SOLSELと相見積になり、買取価格の査定で競合。失注リスクが出た",
			"兵庫県の商談でSOLSELと相見積、査定価格で競り合いになった",
		),
	},
	"know-b": {
		id: "know-b",
		props: knowledgeProps(
			"採用",
			"和歌山の農地転用が難航",
			"和歌山県の第1種農地で農転が難しく造成費も高い",
			"和歌山県の案件、農地転用の見込みが立たず地目も農地",
		),
	},
	"know-c": {
		id: "know-c",
		props: knowledgeProps(
			"採用",
			"福岡で出力制御が増えている",
			"福岡県の九州電力エリアで出力制御・抑制が増加",
			"福岡県で変電所の空き容量が逼迫、連系も厳しい",
		),
	},
	"know-d": {
		id: "know-d",
		props: knowledgeProps("採用", "朝礼の挨拶のコツ", "笑顔で挨拶すると場が和む", "社内の朝礼で使える一言の話"),
	},
	"know-e": {
		id: "know-e",
		props: knowledgeProps(
			"新規候補",
			"SOLSELが兵庫で買取価格を提示",
			"SOLSELと相見積、買取価格で競合",
			"兵庫県でSOLSELと相見積",
		),
	},
	"know-f": {
		id: "know-f",
		props: knowledgeProps(
			"採用",
			"宮城の山林案件は止めるべき",
			"宮城県の山林は再エネ課税もあり止める判断。造成も厳しい",
			"宮城県の山林、造成が厳しく止める方向",
		),
	},
};

type Captured = {
	creates: Array<{ ds: string; args: Record<string, unknown> }>;
	updates: Array<Record<string, unknown>>;
	comments: string[];
};

function makeNotion(cap: Captured, knowledgeId: string) {
	return {
		dataSources: { query: async () => ({ results: [] }) },
		blocks: { children: { list: async () => ({ results: [], has_more: false, next_cursor: null }) } },
		comments: {
			create: async (args: { rich_text: Array<{ text?: { content?: string } }> }) => {
				cap.comments.push(args.rich_text?.[0]?.text?.content ?? "");
				return {};
			},
		},
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === knowledgeId) {
					return { id: page_id, url: `https://notion.so/${page_id}`, properties: cases[knowledgeId].props };
				}
				return { id: page_id, url: `https://notion.so/${page_id}`, properties: unionRowProperties() };
			},
			create: async (args: Record<string, unknown>) => {
				const ds = (args.parent as { data_source_id: string }).data_source_id;
				const id = `created-${cap.creates.length + 1}`;
				cap.creates.push({ ds, args });
				return { id, url: `https://notion.so/${id}` };
			},
			update: async (args: Record<string, unknown>) => {
				cap.updates.push(args);
				return { id: args.page_id };
			},
		},
	} as unknown as Parameters<typeof processKnowledgeToTakaraRoutingForTest>[1];
}

function fresh(): Captured {
	return { creates: [], updates: [], comments: [] };
}

async function run() {
	// A: 競合 → 行政・競合DB。データ状態=下書き・根拠URL逆リンク・競合会社名=SOLSEL
	{
		const cap = fresh();
		const res = await processKnowledgeToTakaraRoutingForTest({ knowledgePageId: "know-a" }, makeNotion(cap, "know-a"));
		assert.equal(res.action, "routed", "A routed");
		assert.equal(res.bucket, "gov", "A bucket gov");
		assert.equal(cap.creates.length, 1, "A creates exactly 1 row");
		assert.equal(cap.creates[0].ds, GOV_DS, "A → 行政競合DB");
		const upd = cap.updates[0].properties as Record<string, { select?: { name: string }; url?: string; rich_text?: Array<{ text: { content: string } }> }>;
		assert.equal(upd["データ状態"].select?.name, "下書き", "A データ状態=下書き");
		assert.equal(upd["根拠URL"].url, "https://notion.so/know-a", "A 根拠URL 逆リンク");
		assert.ok(JSON.stringify(upd["競合会社名"]).includes("SOLSEL"), "A 競合会社名=SOLSEL");
		assert.ok(cap.comments.length >= 1, "A 逆流コメントあり");
	}
	// B: 土地 → 土地・規制DB。都道府県=和歌山県
	{
		const cap = fresh();
		const res = await processKnowledgeToTakaraRoutingForTest({ knowledgePageId: "know-b" }, makeNotion(cap, "know-b"));
		assert.equal(res.bucket, "land", "B bucket land");
		assert.equal(cap.creates[0].ds, LAND_DS, "B → 土地規制DB");
		const upd = cap.updates[0].properties as Record<string, { rich_text?: Array<{ text: { content: string } }> }>;
		assert.ok(JSON.stringify(upd["都道府県"]).includes("和歌山県"), "B 都道府県=和歌山県");
	}
	// C: 系統 → 系統・抑制DB。情報区分=抑制
	{
		const cap = fresh();
		const res = await processKnowledgeToTakaraRoutingForTest({ knowledgePageId: "know-c" }, makeNotion(cap, "know-c"));
		assert.equal(res.bucket, "grid", "C bucket grid");
		assert.equal(cap.creates[0].ds, GRID_DS, "C → 系統抑制DB");
		const upd = cap.updates[0].properties as Record<string, { select?: { name: string } }>;
		assert.equal(upd["情報区分"].select?.name, "抑制", "C 情報区分=抑制");
	}
	// D: 該当なし → 行を作らない
	{
		const cap = fresh();
		const res = await processKnowledgeToTakaraRoutingForTest({ knowledgePageId: "know-d" }, makeNotion(cap, "know-d"));
		assert.equal(res.action, "no-match", "D no-match");
		assert.equal(cap.creates.length, 0, "D creates nothing");
	}
	// E: 未採用 → 何もしない
	{
		const cap = fresh();
		const res = await processKnowledgeToTakaraRoutingForTest({ knowledgePageId: "know-e" }, makeNotion(cap, "know-e"));
		assert.equal(res.action, "skipped-not-adopted", "E skipped");
		assert.equal(cap.creates.length, 0, "E creates nothing");
	}
	// F: 判断シグナル → 事実行＋判断カード。判定は自動確定しない（判定プロパティを書かない）・状態=未確認
	{
		const cap = fresh();
		const res = await processKnowledgeToTakaraRoutingForTest({ knowledgePageId: "know-f" }, makeNotion(cap, "know-f"));
		assert.equal(res.createdCard, true, "F 判断カード起票");
		const cardCreate = cap.creates.find((c) => c.ds === CARD_DS);
		assert.ok(cardCreate, "F 判断カードDBに作成");
		const cardUpdate = cap.updates.find((u) => {
			const p = u.properties as Record<string, unknown>;
			return "状態" in p && "判断軸" in p;
		});
		assert.ok(cardUpdate, "F 判断カードのupdateあり");
		const p = cardUpdate!.properties as Record<string, { select?: { name: string } }>;
		assert.equal(p["状態"].select?.name, "未確認", "F 状態=未確認");
		assert.equal(p["判定"], undefined, "F 判定は自動確定しない（書かない）");
	}
	console.log("✅ knowledge-takara-routing: 全6ケース合格");
}

run().catch((e) => {
	console.error("❌ test failed:", e);
	process.exit(1);
});
