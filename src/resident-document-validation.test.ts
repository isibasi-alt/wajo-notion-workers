import assert from "node:assert/strict";
import { evaluateResidentDocumentDraftForTest } from "./index";

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
		発電所所在地画像: filesProp("location.jpg"),
		ハザードマップ: filesProp("hazard.jpg"),
		説明会対象エリア画像: filesProp("area.jpg"),
		"反射光画像（夏至）": filesProp("reflection-summer.jpg"),
		現場写真: filesProp("site.jpg"),
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
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
