import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import {
	buildResidentDocumentHtmlForTest,
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

const residentTestImageDataUrl = `data:image/png;base64,${readFileSync(
	join(process.cwd(), "assets", "project-case-cover-wide.png"),
).toString("base64")}`;

function imageFilesProp(name = "image.png") {
	return {
		type: "files",
		files: [
			{
				name,
				type: "external",
				external: { url: residentTestImageDataUrl },
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
		住民向け問い合わせ窓口: richTextProp("和上ホールディングス O&M窓口 / 06-0000-0000"),
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

	const missingResidentContact = evaluateResidentDocumentDraftForTest({
		id: "resident-1b-contact",
		properties: readyResidentProps({
			住民向け問い合わせ窓口: richTextProp(""),
		}),
	});

	assert.equal(missingResidentContact.missingField, "住民向け問い合わせ窓口");

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
	assert.match(ready.summaryLines.join("\n"), /住民向け問い合わせ窓口: 和上ホールディングス O&M窓口/);
	const imageSectionCounts = Object.fromEntries(
		ready.sections.map((section) => [
			section.title,
			((section as { images?: Array<{ name: string }> }).images ?? []).length,
		]),
	);
	assert.deepEqual(imageSectionCounts, {
		表紙: 0,
		事業概要: 0,
		周知方法: 0,
		設備認定: 0,
		事業者変更: 0,
		所在地図: 1,
		ハザードマップ: 1,
		対象エリア: 1,
		反射光確認: 1,
		現場写真: 1,
		質問受付: 0,
		"連絡先・責任者": 0,
		最終確認: 0,
	});
	const residentHtml = buildResidentDocumentHtmlForTest(ready);
	assert.match(residentHtml, /住民説明会HTML/);
	assert.match(residentHtml, /北摂発電所/);
	assert.match(residentHtml, /発電所所在地画像/);
	assert.match(residentHtml, /hazard\.png/);
	assert.doesNotMatch(residentHtml, /Record ID:/);
	if (process.env.RESIDENT_HTML_TEST_OUTPUT) {
		await writeFile(process.env.RESIDENT_HTML_TEST_OUTPUT, residentHtml, "utf8");
	}

	const pdfBytes = await buildResidentDocumentPdfBytesForTest(ready, "resident-2");
	const pdf = await PDFDocument.load(pdfBytes);
	assert.equal(pdf.getPageCount(), 13);
	const pdfCheckDirectory = await mkdtemp(join(tmpdir(), "wajo-resident-pdf-"));
	const pdfCheckPath = join(pdfCheckDirectory, "resident.pdf");
	try {
		await writeFile(pdfCheckPath, pdfBytes);
		const extractedPdfText = execFileSync("pdftotext", ["-layout", pdfCheckPath, "-"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		assert.doesNotMatch(extractedPdfText, /Record ID:/);
		assert.match(extractedPdfText, /作成日:/);
	} finally {
		await rm(pdfCheckDirectory, { recursive: true, force: true });
	}
	if (process.env.RESIDENT_PDF_TEST_OUTPUT) {
		await writeFile(process.env.RESIDENT_PDF_TEST_OUTPUT, pdfBytes);
	}

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
		住民説明会資料HTML: { type: "files", files: [] },
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
	assert.match(processed.message, /HTML住民説明会資料を保存しました|HTML保存先プロパティが無かった/);
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
