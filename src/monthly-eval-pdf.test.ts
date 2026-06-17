import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
	buildMonthlyEvalPdfBytesForTest,
	buildMonthlyEvalPdfSnapshotForTest,
	generateMonthlyEvalPdfFileNameForTest,
	resolveMonthlyEvalJapaneseFontPathForTest,
} from "./index";

function titleProperty(value: string): Record<string, unknown> {
	return {
		type: "title",
		title: [{ type: "text", plain_text: value, text: { content: value } }],
	};
}

function richTextProperty(value: string): Record<string, unknown> {
	return {
		type: "rich_text",
		rich_text: [{ type: "text", plain_text: value, text: { content: value } }],
	};
}

function numberProperty(value: number): Record<string, unknown> {
	return { type: "number", number: value };
}

function selectProperty(value: string): Record<string, unknown> {
	return { type: "select", select: { name: value } };
}

function dateProperty(value: string): Record<string, unknown> {
	return { type: "date", date: { start: value } };
}

function peopleProperty(name: string): Record<string, unknown> {
	return {
		type: "people",
		people: [{ id: "user-1", name, type: "person", person: { email: "sales@example.com" } }],
	};
}

function sampleMonthlyEvalProperties(): Record<string, unknown> {
	return {
		評価名: titleProperty("2026年5月 山田太郎｜月次評価"),
		対象営業ユーザー: peopleProperty("山田太郎"),
		対象月: richTextProperty("2026年5月"),
		締め日時: dateProperty("2026-06-10T18:00:00.000+09:00"),
		評価ステータス: selectProperty("確定"),
		定量スコア: numberProperty(52),
		定性スコア: numberProperty(28),
		総合スコア: numberProperty(80),
		評価ランク: selectProperty("A"),
		粗利達成率: numberProperty(0.86),
		実績粗利額: numberProperty(4300000),
		粗利目標額: numberProperty(5000000),
		成約数: numberProperty(3),
		商談数: numberProperty(18),
		案件化数: numberProperty(7),
		案件化率: numberProperty(0.39),
		仕入れ件数: numberProperty(2),
		専売許可数: numberProperty(1),
		歩合確定額: numberProperty(120000),
		歩合見込額: numberProperty(220000),
		日報提出数: numberProperty(19),
		日報継続率: numberProperty(0.9),
		発言ログ数: numberProperty(11),
		顧客接点数: numberProperty(42),
		営業貢献数: numberProperty(5),
		ナレッジ採用数: numberProperty(2),
		AI活用pt: numberProperty(14),
		人見さんメモ本文: richTextProperty("重点顧客の次回提案に向けて、粗利と成約確度の根拠を明確に残せている。"),
		成長ポイント: richTextProperty("商談後の発言ログが増え、勝ち筋の共有が具体的になった。"),
		改善ポイント: richTextProperty("問い合わせから案件化までの初動記録を、翌営業日までに残す。"),
		次月テーマ: richTextProperty("高粗利案件の初回提案品質を上げる。"),
		上司確認事項: richTextProperty("専売許可の事前確認を月初に行う。"),
		マネージャーコメント: richTextProperty("数字と活動の両面で前進。次月は案件化率を重点確認。"),
		本人コメント: richTextProperty("紹介案件の追客速度を上げる。"),
	};
}

async function main(): Promise<void> {
	const fontPath = resolveMonthlyEvalJapaneseFontPathForTest();
	assert.ok(fontPath, "日本語対応フォント候補がローカルに存在する");

	const snapshot = buildMonthlyEvalPdfSnapshotForTest({
		id: "monthly-eval-test",
		properties: sampleMonthlyEvalProperties(),
	});
	assert.equal(snapshot.evaluationName, "2026年5月 山田太郎｜月次評価");
	assert.equal(snapshot.salesPersonName, "山田太郎");
	assert.equal(snapshot.statusStamp, "確定");
	assert.equal(snapshot.rank, "A");
	assert.equal(snapshot.totalScore, 80);
	assert.equal(snapshot.quantitativeScore, 52);
	assert.equal(snapshot.qualitativeScore, 28);
	assert.equal(
		generateMonthlyEvalPdfFileNameForTest(snapshot),
		"月次評価_2026年5月_山田太郎.pdf",
	);

	const middleSnapshot = buildMonthlyEvalPdfSnapshotForTest({
		id: "monthly-eval-middle-test",
		properties: {
			...sampleMonthlyEvalProperties(),
			評価ステータス: selectProperty("下書き"),
		},
	});
	assert.equal(middleSnapshot.statusStamp, "集計中");
	assert.equal(
		generateMonthlyEvalPdfFileNameForTest(middleSnapshot),
		"月次評価_2026年5月_山田太郎.pdf",
	);

	const bytes = await buildMonthlyEvalPdfBytesForTest(snapshot);
	const buffer = Buffer.from(bytes);
	assert.equal(buffer.subarray(0, 5).toString("utf8"), "%PDF-");
	assert.ok(buffer.length > 20_000, "日本語フォントを埋め込んだPDFとして十分なサイズがある");

	const pdf = await PDFDocument.load(bytes);
	assert.equal(pdf.getPageCount(), 1);
	const page = pdf.getPage(0);
	assert.ok(Math.abs(page.getWidth() - 595.28) < 1, "A4縦の幅");
	assert.ok(Math.abs(page.getHeight() - 841.89) < 1, "A4縦の高さ");

	console.log("monthly-eval-pdf: all assertions passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
