import assert from "node:assert/strict";
import { processMeetingKnowledgeForTest } from "./index";

const title = (value: string) => ({
	type: "title",
	title: [{ plain_text: value }],
});

const richText = (value: string) => ({
	type: "rich_text",
	rich_text: [{ plain_text: value }],
});

const select = (value: string) => ({
	type: "select",
	select: { name: value },
});

const relation = (ids: string[]) => ({
	type: "relation",
	relation: ids.map((id) => ({ id })),
});

const date = (value: string | null = null) => ({
	type: "date",
	date: value ? { start: value } : null,
});

const knowledgePageProperties = {
	ナレッジタイトル: title(""),
	ナレッジ種別: select("FAQ"),
	候補判定: select("新規候補"),
	元データ種別: select("手入力"),
	元ミーティング: relation([]),
	元企業: relation([]),
	元商談: relation([]),
	要点: richText(""),
	入力テキスト: richText(""),
	使いどころ: richText(""),
	根拠メモ: richText(""),
	推奨トーク: richText(""),
	AI候補度: select("中"),
	AI重要度: select("中"),
	確度: select("中"),
	重複疑い: { type: "checkbox", checkbox: false },
	公開範囲: select("全員"),
	対象部門: { type: "multi_select", multi_select: [] },
	生成ステータス: { type: "status", status: { name: "未着手" } },
	運用ステータス: { type: "status", status: { name: "未着手" } },
	AI関係発見メモ: richText(""),
};

const duplicateKnowledgePageProperties = {
	...knowledgePageProperties,
	重複疑い: { type: "checkbox", checkbox: true },
};

const meetingPageProperties = {
	ミーティング名: title("クレーム対応方針 会議"),
	ミーティング種別: select("営業会議"),
	要約: richText("価格説明不足によるクレームを受け、次回から保証・運用負荷・将来費用の比較軸を先に説明する。"),
	議事内容: richText("お客様が価格だけで判断しないよう、保証、運用負荷、将来費用を最初に確認する。謝罪時は事実確認と再発防止を分けて伝える。"),
	決定事項: richText("価格反論時は保証・運用負荷・将来費用で比較軸を握る。"),
	アクション項目: richText("営業トークに比較軸の確認質問を追加する。"),
	ナレッジ化ステータス: select("未判定"),
	ナレッジ化メモ: richText(""),
	ナレッジ化依頼日: date(),
	ナレッジ種別: select("営業トーク"),
	関連企業: relation(["company-1"]),
	関連商談: relation(["deal-1"]),
};

const weakTestMeetingPageProperties = {
	会議名: title("Codex会議→商談再有効化テスト正例 2026-06-06 1716"),
	会議種別: select("商談"),
	要約: richText(""),
	議事内容: richText("Codex監査用の疎通確認です。"),
	決定事項: richText(""),
	アクション項目: richText(""),
	ナレッジ化ステータス: select("未判定"),
	ナレッジ化メモ: richText(""),
	ナレッジ化依頼日: date(),
	ナレッジ種別: select("営業トーク"),
	関連企業: relation([]),
	関連商談: relation([]),
};

const currentFieldMeetingPageProperties = {
	ミーティング名: title("【検証用ダミー｜佐伯】6月第2週 営業会議"),
	ミーティング種別: select("営業ミーティング"),
	要約: richText(""),
	議事内容: richText(""),
	決定事項: richText(""),
	アクション項目: richText(""),
	良かった点: richText("佐伯の試算先行トークが具体的で再現性がある。"),
	改善ポイント: richText("価格を後出しにするだけでなく、相手の比較軸を先に確認する。"),
	次回確認事項: richText("南紀ファームの補助金採択スケジュールを確認する。"),
	AI率直フィードバック: richText("低圧案件では、価格提示前に試算と保証条件を分けて説明する手順を共有する価値がある。"),
	ミーティングの次の一手: richText("営業トークとしてチームへ横展開する。"),
	ナレッジ化ステータス: select("未判定"),
	ナレッジ化メモ: richText(""),
	ナレッジ化依頼日: date(),
	ナレッジ種別: select("営業トーク"),
	関連企業: relation([]),
	関連商談: relation([]),
};

async function main() {
	const creates: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];

	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "meeting-1") {
					return { id: page_id, properties: meetingPageProperties };
				}
				if (page_id === "meeting-weak") {
					return { id: page_id, properties: weakTestMeetingPageProperties };
				}
				if (page_id === "meeting-current-fields") {
					return { id: page_id, properties: currentFieldMeetingPageProperties };
				}
				return { id: page_id, properties: knowledgePageProperties };
			},
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return { id: "knowledge-1", properties: knowledgePageProperties };
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id, properties: {} };
			},
		},
		blocks: {
			children: {
				list: async ({ block_id }: { block_id: string }) => ({
					results: block_id === "meeting-weak"
						? [{
							type: "paragraph",
							paragraph: {
								rich_text: [{
									plain_text: "Codex監査用の疎通確認です。dry-run確認のための本文を長くしています。これはWorkerの処理確認用ダミーテキストです。",
								}],
							},
						}]
						: [],
					has_more: false,
				}),
			},
		},
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return { results: [] };
			},
		},
	};

	const dryRun = await processMeetingKnowledgeForTest(
		{ meetingPageId: "meeting-1", dryRun: true },
		notion as never,
	);
	assert.equal(dryRun.action, "dry-run");
	assert.equal(dryRun.created, 0);
	assert.equal(dryRun.candidates, 1);
	assert.match(dryRun.message, /クレーム対応方針 会議/);
	assert.equal(creates.length, 0);
	assert.equal(updates.length, 0);

	const live = await processMeetingKnowledgeForTest(
		{ meetingPageId: "meeting-1", dryRun: false },
		notion as never,
	);
	assert.equal(live.action, "created-knowledge");
	assert.equal(live.created, 1);
	assert.equal(creates.length, 1);
	assert.ok(updates.length >= 2);

	const createdProps = creates[0]!.properties as Record<string, unknown>;
	assert.equal((createdProps.ナレッジタイトル as { title: Array<{ text: { content: string } }> }).title[0]!.text.content, "価格反論時は保証・運用負荷・将来費用で比較軸を握る");

	const createdUpdate = updates.find((entry) => entry.page_id === "knowledge-1")!;
	const knowledgePatch = createdUpdate.properties as Record<string, unknown>;
	assert.equal((knowledgePatch.候補判定 as { select: { name: string } }).select.name, "新規候補");
	assert.equal((knowledgePatch.元データ種別 as { select: { name: string } }).select.name, "議事録");
	assert.deepEqual((knowledgePatch.元ミーティング as { relation: Array<{ id: string }> }).relation, [{ id: "meeting-1" }]);
	assert.deepEqual((knowledgePatch.元企業 as { relation: Array<{ id: string }> }).relation, [{ id: "company-1" }]);
	assert.deepEqual((knowledgePatch.元商談 as { relation: Array<{ id: string }> }).relation, [{ id: "deal-1" }]);
	assert.equal((knowledgePatch.公開範囲 as { select: { name: string } }).select.name, "全員");
	assert.match(JSON.stringify(knowledgePatch.根拠メモ), /会議種別: .*営業/);
	assert.match(JSON.stringify(knowledgePatch.根拠メモ), /良かった点/);

	const meetingUpdate = updates.find((entry) => entry.page_id === "meeting-1")!;
	const meetingPatch = meetingUpdate.properties as Record<string, unknown>;
	assert.equal((meetingPatch.ナレッジ化ステータス as { select: { name: string } }).select.name, "作成済");
	assert.match(JSON.stringify(meetingPatch.ナレッジ化メモ), /knowledge-1/);

	const duplicateFilters: string[] = [];
	const duplicateNotion = {
		...notion,
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				const filter = args.filter as { property?: string };
				duplicateFilters.push(filter.property ?? "");
				return {
					results: filter.property === "元ミーティング"
						? [
							{ id: "duplicate-knowledge", properties: duplicateKnowledgePageProperties },
							{ id: "existing-knowledge", properties: knowledgePageProperties },
						]
						: [],
				};
			},
		},
	};
	const duplicate = await processMeetingKnowledgeForTest(
		{ meetingPageId: "meeting-1", dryRun: false },
		duplicateNotion as never,
	);
	assert.equal(duplicate.action, "skipped-duplicate");
	assert.equal(duplicate.created, 0);
	assert.equal(duplicate.knowledgePageId, "existing-knowledge");
	assert.equal(duplicateFilters[0], "元ミーティング");

	const weak = await processMeetingKnowledgeForTest(
		{ meetingPageId: "meeting-weak", dryRun: true },
		notion as never,
	);
	assert.equal(weak.action, "dry-run");
	assert.equal(weak.candidates, 0);
	assert.match(weak.message, /材料が不足/);

	const currentFields = await processMeetingKnowledgeForTest(
		{ meetingPageId: "meeting-current-fields", dryRun: true },
		notion as never,
	);
	assert.equal(currentFields.action, "dry-run");
	assert.equal(currentFields.candidates, 1);
	assert.match(currentFields.message, /試算先行|比較軸|営業トーク/);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
