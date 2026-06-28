import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
	buildResidentDocumentPdfBytesForTest,
	evaluateResidentDocumentDraftForTest,
	processResidentDocumentForTest,
} from "./index";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function dateProp(start: string, end?: string) {
	return { type: "date", date: { start, end: end ?? null } };
}

function filesProp(name = "image.jpg") {
	return {
		type: "files",
		files: [
			{
				name,
				type: "external",
				external: { url: `https://example.com/${name}` },
			},
		],
	};
}

const onePixelPng =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function imageFilesProp(name = "image.png") {
	return {
		type: "files",
		files: [
			{
				name,
				type: "external",
				external: { url: onePixelPng },
			},
		],
	};
}

function readyResidentProps(overrides: Record<string, unknown> = {}) {
	return {
		案件番号: titleProp("2026S099"),
		発電所名: titleProp("北摂発電所"),
		発電所住所: richTextProp("大阪府高槻市2-2"),
		周知方法: { type: "select", select: { name: "周知書面" } },
		質問受付期間: dateProp("2026-07-01", "2026-07-14"),
		周知日: dateProp("2026-07-20"),
		"保守管理責任者 氏名": richTextProp("佐藤花子"),
		旧認定事業者: richTextProp("旧認定事業者"),
		新認定事業者: richTextProp("新認定事業者"),
		設備ID: richTextProp("A123456789"),
		認定出力kW: { type: "number", number: 250 },
		発電所所在地画像: imageFilesProp("location.png"),
		ハザードマップ: imageFilesProp("hazard.png"),
		説明会対象エリア画像: imageFilesProp("area.png"),
		"反射光画像（夏至）": imageFilesProp("reflection-summer.png"),
		現場写真: imageFilesProp("site.png"),
		...overrides,
	};
}

async function main() {
	const missingPlantName = evaluateResidentDocumentDraftForTest({
		id: "resident-1",
		properties: {
			案件番号: titleProp("2026S001"),
			発電所名: titleProp(""),
			発電所住所: richTextProp("大阪府大阪市中央区1-1"),
			周知方法: { type: "select", select: { name: "説明会" } },
			質問受付期間: dateProp("2026-06-01", "2026-06-15"),
			周知日: dateProp("2026-06-20"),
			"保守管理責任者 氏名": richTextProp("山田太郎"),
		},
	});

	assert.equal(missingPlantName.missingField, "発電所名");
	assert.equal(missingPlantName.nextRequiredFields[0], "発電所住所");

	const missingOldOperator = evaluateResidentDocumentDraftForTest({
		id: "resident-1b",
		properties: readyResidentProps({
			旧認定事業者: richTextProp(""),
		}),
	});

	assert.equal(missingOldOperator.missingField, "旧認定事業者");

	const missingMap = evaluateResidentDocumentDraftForTest({
		id: "resident-1c",
		properties: readyResidentProps({
			発電所所在地画像: { type: "files", files: [] },
		}),
	});

	assert.equal(missingMap.missingField, "発電所所在地画像");

	const ready = evaluateResidentDocumentDraftForTest({
		id: "resident-2",
		properties: readyResidentProps(),
	});

	assert.equal(ready.missingField, null);
	assert.equal(ready.documentTitle, "2026S099｜住民説明会資料");
	assert.match(ready.summaryLines.join("\n"), /質問受付期間: 2026-07-01〜2026-07-14/);
	assert.match(ready.summaryLines.join("\n"), /認定出力: 250kW/);

	const pdfBytes = await buildResidentDocumentPdfBytesForTest(ready, "resident-2");
	const pdf = await PDFDocument.load(pdfBytes);
	assert.equal(pdf.getPageCount(), 13);

	const updates: Array<Record<string, unknown>> = [];
	const comments: Array<Record<string, unknown>> = [];
	const uploads: Array<Record<string, unknown>> = [];
	const readyPage = {
		id: "resident-3",
		url: "https://www.notion.so/resident-3",
		properties: {
			...readyResidentProps(),
			資料作成ステータス: { type: "select", select: { name: "入力待ち" } },
			資料作成メモ: richTextProp(""),
			不足項目: richTextProp(""),
			生成ドキュメント名: richTextProp(""),
			住民説明会資料PDF: { type: "files", files: [] },
		},
	};
	const notion = {
		pages: {
			retrieve: async () => readyPage,
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return readyPage;
			},
		},
		comments: {
			create: async (args: Record<string, unknown>) => {
				comments.push(args);
				return {};
			},
		},
		fileUploads: {
			create: async (args: Record<string, unknown>) => {
				uploads.push({ step: "create", ...args });
				return { id: "file-upload-1" };
			},
			send: async (args: Record<string, unknown>) => {
				uploads.push({ step: "send", ...args });
				return {};
			},
			complete: async (args: Record<string, unknown>) => {
				uploads.push({ step: "complete", ...args });
				return {};
			},
		},
	};
	const processed = await processResidentDocumentForTest(
		{ pageId: "resident-3", dryRun: false },
		notion as never,
	);
	assert.equal(processed.action, "prepared");
	assert.equal(processed.status, "作成完了");
	assert.match(processed.message, /PDFを保存しました/);
	assert.ok(
		updates.some((update) =>
			JSON.stringify(update.properties ?? {}).includes("file-upload-1"),
		),
	);
	assert.equal(comments.length, 1);
	assert.equal(uploads.filter((upload) => upload.step === "send").length, 1);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
