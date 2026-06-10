import assert from "node:assert/strict";
import { createClosingKnowledgeCandidateFromFeedbackForTest } from "./index";

function title(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function text(value: string) {
	return { type: "rich_text", rich_text: [{ plain_text: value }] };
}

function select(value: string) {
	return { type: "select", select: { name: value } };
}

function relation(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

async function main() {
	const creates: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];

	const closingPage = {
		id: "closing-1",
		properties: {
			成約名: title("大型蓄電池案件｜成約報告"),
			関連商談: relation(["deal-1"]),
			関連企業: relation(["company-1"]),
		},
	};
	const projectPage = {
		id: "project-1",
		properties: {
			案件名: title("大型蓄電池案件"),
			案件詳細: text("新しい提案導線で大型蓄電池案件を成約した。"),
		},
	};
	const notion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return { results: [] };
			},
		},
		pages: {
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return { id: "knowledge-1" };
			},
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				properties: {
					ナレッジタイトル: title(""),
					ナレッジ種別: select("FAQ"),
					候補判定: select("新規候補"),
					元データ種別: select("商談"),
					元商談: relation([]),
					元企業: relation([]),
					要点: text(""),
					入力テキスト: text(""),
					使いどころ: text(""),
					根拠メモ: text(""),
					推奨トーク: text(""),
					AI候補度: select("中"),
					AI重要度: select("中"),
					確度: select("中"),
					重複疑い: { type: "checkbox", checkbox: false },
					生成ステータス: { type: "status", status: { name: "未着手" } },
					運用ステータス: { type: "status", status: { name: "未着手" } },
				},
			}),
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
		},
	};

	const result = await createClosingKnowledgeCandidateFromFeedbackForTest(
		closingPage as never,
		projectPage as never,
		{
			勝因: "決裁者の判断軸を先に整理できた。",
			反省点: "資料提出前の条件確認をさらに早める。",
			次に活かす学び: "大型案件では経済性と運用リスクを分けて提示する。",
			ナレッジ化候補: "候補",
			ナレッジ化メモ: "大型案件の勝ち筋",
		},
		notion as never,
	);

	assert.equal(result.action, "created");
	assert.equal(creates.length, 1, "社内ナレッジDBへ未承認候補を作成する");
	assert.ok(
		queries.some((args) => JSON.stringify(args).includes("元商談")),
		"元商談relationで既存候補を確認する",
	);
	const knowledgeUpdate = updates.find((args) => args.page_id === "knowledge-1") as {
		properties: Record<string, unknown>;
	};
	assert.ok(knowledgeUpdate, "作成したナレッジ候補へ詳細を反映する");
	assert.deepEqual(knowledgeUpdate.properties.元商談, { relation: [{ id: "deal-1" }] });
	assert.deepEqual(knowledgeUpdate.properties.元企業, { relation: [{ id: "company-1" }] });
	assert.deepEqual(knowledgeUpdate.properties.候補判定, { select: { name: "新規候補" } });
	assert.deepEqual(knowledgeUpdate.properties.ナレッジ種別, { select: { name: "勝ちパターン" } });
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
