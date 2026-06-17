import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
	attachMonthlyEvalPdfForTest,
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

function filesProperty(): Record<string, unknown> {
	return { type: "files", files: [] };
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
		評価PDF: filesProperty(),
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

	const updateCalls: Array<Record<string, unknown>> = [];
	const uploadCreateCalls: Array<Record<string, unknown>> = [];
	const uploadSendCalls: Array<Record<string, unknown>> = [];
	const uploadCompleteCalls: Array<Record<string, unknown>> = [];
	const commentCalls: Array<Record<string, unknown>> = [];
	const notion = {
		dataSources: {
			query: async () => ({ results: [] }),
		},
		pages: {
			create: async () => ({ id: "unused" }),
			retrieve: async () => ({
				id: "monthly-eval-test",
				properties: sampleMonthlyEvalProperties(),
			}),
			update: async (args: Record<string, unknown>) => {
				updateCalls.push(args);
				return { id: "monthly-eval-test", properties: sampleMonthlyEvalProperties() };
			},
		},
		fileUploads: {
			create: async (args: Record<string, unknown>) => {
				uploadCreateCalls.push(args);
				return { id: "file-upload-1" };
			},
			send: async (args: Record<string, unknown>) => {
				uploadSendCalls.push(args);
				return {};
			},
			complete: async (args: Record<string, unknown>) => {
				uploadCompleteCalls.push(args);
				return {};
			},
		},
		comments: {
			create: async (args: Record<string, unknown>) => {
				commentCalls.push(args);
				return {};
			},
		},
	};
	const result = await attachMonthlyEvalPdfForTest(
		"monthly-eval-test",
		notion as never,
		new Date("2026-06-17T03:00:00.000Z"),
	);
	assert.equal(result.action, "attached");
	assert.equal(result.fileName, "月次評価_2026年5月_山田太郎.pdf");
	assert.equal(uploadCreateCalls.length, 1);
	assert.deepEqual(uploadCreateCalls[0], {
		mode: "single_part",
		filename: "月次評価_2026年5月_山田太郎.pdf",
		content_type: "application/pdf",
	});
	assert.equal(uploadSendCalls.length, 1);
	assert.equal(uploadSendCalls[0]?.file_upload_id, "file-upload-1");
	const sentFile = uploadSendCalls[0]?.file as { filename?: string; data?: Blob } | undefined;
	assert.equal(sentFile?.filename, "月次評価_2026年5月_山田太郎.pdf");
	assert.ok(sentFile?.data instanceof Blob);
	assert.equal(sentFile?.data.type, "application/pdf");
	assert.deepEqual(uploadCompleteCalls, [{ file_upload_id: "file-upload-1" }]);
	assert.deepEqual(updateCalls[0], {
		page_id: "monthly-eval-test",
		properties: {
			評価PDF: {
				files: [
					{
						type: "file_upload",
						file_upload: { id: "file-upload-1" },
						name: "月次評価_2026年5月_山田太郎.pdf",
					},
				],
			},
		},
	});
	assert.equal(commentCalls.length, 1);
	assert.deepEqual((commentCalls[0]?.parent as Record<string, unknown>), { page_id: "monthly-eval-test" });
	const commentText = (((commentCalls[0]?.rich_text as Array<Record<string, unknown>>)[0]?.text as Record<string, unknown>)?.content);
	assert.match(String(commentText), /^PDFを添付しました（.+）$/);

	await assert.rejects(
		() => attachMonthlyEvalPdfForTest(
			"monthly-eval-missing-pdf-property",
			{
				...notion,
				pages: {
					...notion.pages,
					retrieve: async () => {
						const { 評価PDF: _evaluationPdf, ...properties } = sampleMonthlyEvalProperties();
						return { id: "monthly-eval-missing-pdf-property", properties };
					},
				},
			} as never,
			new Date("2026-06-17T03:00:00.000Z"),
		),
		/評価PDF/,
	);

	console.log("monthly-eval-pdf: all assertions passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
