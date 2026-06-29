import assert from "node:assert/strict";
import {
	processProposalSimulationForTest,
	processProjectProposalRequestForTest,
	processProjectResidentDocumentRequestForTest,
} from "./index";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function numberProp(value: number | null) {
	return { type: "number", number: value };
}

function selectProp(value: string) {
	return { type: "select", select: { name: value } };
}

function dateProp(start: string, end?: string) {
	return { type: "date", date: { start, end: end ?? null } };
}

function filesProp(name = "site.jpg") {
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

function relationProp(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function validProjectProperties() {
	return {
		案件名: titleProp("湖南市250kW 太陽光案件"),
		資料作成依頼: relationProp([]),
		発電所設備詳細: relationProp([]),
		資料作成メモ: richTextProp(""),
		案件番号: richTextProp("PJ-001"),
		提案タイプ: selectProp("法人対象"),
		販売価格: numberProp(22000000),
		仕入れ価格: numberProp(19000000),
		予定粗利額: numberProp(null),
		予定粗利の根拠: selectProp("未確認"),
		年間売電収入: numberProp(2090000),
		"年間維持費（ランニングコスト）": numberProp(374000),
		発電所名: richTextProp("湖南市250kW 太陽光発電所"),
		所在地: richTextProp("滋賀県湖南市"),
		発電所住所: richTextProp("滋賀県湖南市サンプル1-1"),
		電力会社エリア: selectProp("関西電力"),
		"低圧/高圧区分": selectProp("高圧"),
		パネルメーカー: richTextProp("Jinko Solar"),
		パネル型式: richTextProp("JKM-550"),
		パネル枚数: numberProp(456),
		"DC容量（パネル側kW）": numberProp(250.8),
		パワコンメーカー: richTextProp("Huawei"),
		パワコン型式: richTextProp("SUN2000"),
		"PCS容量（パワコン側kW）": numberProp(250),
		"FIT/FIP区分": selectProp("FIT"),
		売電単価: numberProp(14),
		残存売電期間: numberProp(12),
		連系開始日: dateProp("2020-04-01"),
		現場写真: filesProp("site.jpg"),
		周知方法: selectProp("所有者変更周知"),
		質問受付期間: dateProp("2026-06-01", "2026-06-30"),
		周知日: dateProp("2026-06-01"),
		"保守管理責任者 氏名": richTextProp("和上 太郎"),
		旧認定事業者: richTextProp("旧事業者株式会社"),
		新認定事業者: richTextProp("新事業者株式会社"),
		設備ID: richTextProp("A123456789"),
		発電所所在地画像: filesProp("location.jpg"),
		ハザードマップ: filesProp("hazard.jpg"),
		説明会対象エリア画像: filesProp("area.jpg"),
		"反射光画像（夏至）": filesProp("reflection-summer.jpg"),
		"反射光画像（冬至）": filesProp("reflection-winter.jpg"),
	};
}

function projectCoreOnlyProperties() {
	return {
		案件名: titleProp("湖南市250kW 太陽光案件"),
		資料作成依頼: relationProp([]),
		発電所設備詳細: relationProp(["equipment-1"]),
		資料作成メモ: richTextProp(""),
		案件番号: richTextProp("PJ-001"),
		提案タイプ: selectProp("法人対象"),
		販売価格: numberProp(22000000),
		仕入れ価格: numberProp(19000000),
		予定粗利額: numberProp(null),
		予定粗利の根拠: selectProp("未確認"),
	};
}

function equipmentDetailProperties() {
	return {
		設備詳細名: titleProp("湖南市250kW 設備詳細"),
		関連案件: relationProp(["project-1"]),
		年間売電収入: numberProp(2090000),
		"年間維持費（ランニングコスト）": numberProp(374000),
		発電所名: richTextProp("湖南市250kW 太陽光発電所"),
		所在地: richTextProp("滋賀県湖南市"),
		発電所住所: richTextProp("滋賀県湖南市サンプル1-1"),
		電力会社エリア: selectProp("関西電力"),
		"低圧/高圧区分": selectProp("高圧"),
		パネルメーカー: richTextProp("Jinko Solar"),
		パネル型式: richTextProp("JKM-550"),
		パネル枚数: numberProp(456),
		"DC容量（パネル側kW）": numberProp(250.8),
		パワコンメーカー: richTextProp("Huawei"),
		パワコン型式: richTextProp("SUN2000"),
		"PCS容量（パワコン側kW）": numberProp(250),
		"FIT/FIP区分": selectProp("FIT"),
		売電単価: numberProp(14),
		残存売電期間: numberProp(12),
		連系開始日: dateProp("2020-04-01"),
		現場写真: filesProp("site.jpg"),
	};
}

function projectPage(
	requestIds: string[] = [],
	propertyOverrides: Record<string, unknown> = {},
) {
	return {
		id: "project-1",
		url: "https://www.notion.so/project-1",
		properties: {
			...validProjectProperties(),
			資料作成依頼: relationProp(requestIds),
			...propertyOverrides,
		},
	};
}

function projectPageWithEquipmentOnly() {
	return {
		id: "project-1",
		url: "https://www.notion.so/project-1",
		properties: projectCoreOnlyProperties(),
	};
}

function equipmentPage() {
	return {
		id: "equipment-1",
		url: "https://www.notion.so/equipment-1",
		properties: equipmentDetailProperties(),
	};
}

function requestPage(id: string, documentType: string) {
	return {
		id,
		url: `https://www.notion.so/${id}`,
		properties: {
			案件名: titleProp(`湖南市250kW 太陽光案件｜${documentType}`),
			資料種別: { type: "select", select: { name: documentType } },
		},
	};
}

function readyProposalRequestPage() {
	return {
		id: "request-ready-1",
		url: "https://www.notion.so/request-ready-1",
		properties: {
			...validProjectProperties(),
			案件名: titleProp("湖南市250kW 太陽光案件｜提案シミュレーション"),
			関連案件: relationProp(["project-1"]),
			シミュレーションステータス: selectProp("入力待ち"),
			不足項目: richTextProp(""),
			想定粗利額: numberProp(null),
			想定利回り: numberProp(null),
			想定回収年数: numberProp(null),
			御社への結論: richTextProp(""),
			提案タイプガイド: richTextProp(""),
			年間償却額: numberProp(null),
			税効果: numberProp(null),
			税引後キャッシュフロー: numberProp(null),
			DSCR: numberProp(null),
			購入タイミング判定: selectProp("C"),
		},
	};
}

function queryDocumentType(args: Record<string, unknown> | undefined): string {
	if (!args) return "";
	const json = JSON.stringify(args);
	if (json.includes("住民説明会資料")) return "住民説明会資料";
	if (json.includes("提案書")) return "提案書";
	return "";
}

function makeNotion(options: {
	projectRequestIds?: string[];
	projectPropertyOverrides?: Record<string, unknown>;
	existingByDocumentType?: Record<string, Array<Record<string, unknown>>>;
	projectPageOverride?: Record<string, unknown>;
	equipmentPageOverride?: Record<string, unknown>;
} = {}) {
	const creates: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const comments: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];
	const appends: Array<Record<string, unknown>> = [];
	const fileUploads: Array<Record<string, unknown>> = [];
	const notion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return {
					results: options.existingByDocumentType?.[queryDocumentType(args)] ?? [],
				};
			},
		},
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "equipment-1") {
					return options.equipmentPageOverride ?? equipmentPage();
				}
				if (page_id.startsWith("request-created-")) {
					const index = Number(page_id.replace("request-created-", "")) - 1;
					const created = creates[index];
					assert.ok(created, `created request not found: ${page_id}`);
					return {
						id: page_id,
						url: `https://www.notion.so/${page_id}`,
						properties: created.properties as Record<string, unknown>,
					};
				}
				for (const pages of Object.values(options.existingByDocumentType ?? {})) {
					const found = pages.find((page) => page.id === page_id);
					if (found) return found;
				}
				assert.equal(page_id, "project-1");
				if (options.projectPageOverride) return options.projectPageOverride;
				return projectPage(
					options.projectRequestIds ?? [],
					options.projectPropertyOverrides ?? {},
				);
			},
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				const page = {
					id: `request-created-${creates.length}`,
					url: `https://www.notion.so/request-created-${creates.length}`,
					properties: args.properties as Record<string, unknown>,
				};
				return page;
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
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
				fileUploads.push({ action: "create", ...args });
				return { id: `file-upload-${fileUploads.length}` };
			},
			send: async (args: Record<string, unknown>) => {
				fileUploads.push({ action: "send", ...args });
				return {};
			},
			complete: async (args: Record<string, unknown>) => {
				fileUploads.push({ action: "complete", ...args });
				return {};
			},
		},
		blocks: {
			children: {
				append: async (args: Record<string, unknown>) => {
					appends.push(args);
					return {};
				},
			},
		},
	};
	return { notion, creates, updates, comments, queries, appends, fileUploads };
}

async function main() {
	const financialInputWaitingCase = makeNotion({
		projectPropertyOverrides: {
			販売価格: numberProp(null),
		},
	});

	const financialInputWaiting = await processProjectProposalRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		financialInputWaitingCase.notion as never,
	);

	assert.equal(financialInputWaiting.action, "needs-input");
	assert.equal(financialInputWaiting.requestPageId, "request-created-1");
	assert.match(financialInputWaiting.message, /提案シミュレーション依頼/);
	assert.equal(financialInputWaitingCase.creates.length, 1);
	const financialInputWaitingProps = financialInputWaitingCase.creates[0]!
		.properties as Record<string, unknown>;
	assert.equal(
		(financialInputWaitingProps.資料種別 as { select: { name: string } }).select.name,
		"提案書",
	);
	assert.equal(
		(
			financialInputWaitingProps.シミュレーションステータス as {
				select: { name: string };
			}
		).select.name,
		"入力待ち",
	);
	assert.match(JSON.stringify(financialInputWaitingProps.資料作成メモ), /販売価格/);
	assert.ok(financialInputWaitingCase.updates.length >= 1);
	assert.ok(financialInputWaitingCase.comments.length >= 1);

	const equipmentLinkedCase = makeNotion({
		projectPageOverride: projectPageWithEquipmentOnly(),
	});

	const fromEquipment = await processProjectProposalRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		equipmentLinkedCase.notion as never,
	);

	assert.equal(fromEquipment.action, "needs-input");
	assert.equal(fromEquipment.requestPageId, "request-created-1");
	assert.equal(equipmentLinkedCase.creates.length, 1);
	const fromEquipmentProps = equipmentLinkedCase.creates[0]!.properties as Record<string, unknown>;
	assert.equal(
		(fromEquipmentProps.発電所名 as { rich_text: Array<{ text: { content: string } }> }).rich_text[0]!.text.content,
		"湖南市250kW 太陽光発電所",
	);
	assert.equal(
		(fromEquipmentProps.年間売電収入 as { number: number }).number,
		2090000,
	);
	assert.equal(
		(fromEquipmentProps.パネルメーカー as { rich_text: Array<{ text: { content: string } }> }).rich_text[0]!.text.content,
		"Jinko Solar",
	);

	const equipmentPageButtonCase = makeNotion();
	const fromEquipmentPageButton = await processProjectProposalRequestForTest(
		{ projectPageId: "equipment-1", dryRun: false },
		equipmentPageButtonCase.notion as never,
	);

	assert.equal(fromEquipmentPageButton.action, "needs-input");
	assert.equal(fromEquipmentPageButton.projectPageId, "project-1");
	assert.equal(fromEquipmentPageButton.requestPageId, "request-created-1");
	const fromEquipmentPageButtonProps = equipmentPageButtonCase.creates[0]!
		.properties as Record<string, unknown>;
	assert.deepEqual(
		(fromEquipmentPageButtonProps.関連案件 as { relation: Array<{ id: string }> }).relation,
		[{ id: "project-1" }],
	);
	assert.equal(
		(fromEquipmentPageButtonProps.発電所名 as { rich_text: Array<{ text: { content: string } }> }).rich_text[0]!.text.content,
		"湖南市250kW 太陽光発電所",
	);

	const { notion, creates, updates, comments, queries } = makeNotion();

	const created = await processProjectProposalRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		notion as never,
	);

	assert.ok(["created", "needs-input"].includes(created.action));
	assert.equal(created.requestPageId, "request-created-1");
	assert.equal(creates.length, 1);
	const createdProps = creates[0]!.properties as Record<string, unknown>;
	assert.deepEqual((createdProps.関連案件 as { relation: Array<{ id: string }> }).relation, [
		{ id: "project-1" },
	]);
	assert.equal(
		(createdProps.資料種別 as { select: { name: string } }).select.name,
		"提案書",
	);
	assert.equal(
		(createdProps.シミュレーションステータス as { select: { name: string } }).select.name,
		"入力待ち",
	);
	assert.equal(queries.length, 1);
	assert.equal(queryDocumentType(queries[0]!), "提案書");

	const projectRelationUpdate = updates.find((update) => {
		const properties = update.properties as Record<string, unknown>;
		return Boolean(properties.資料作成依頼);
	});
	assert.ok(projectRelationUpdate);
	const projectProps = projectRelationUpdate.properties as Record<string, unknown>;
	assert.deepEqual(
		(projectProps.資料作成依頼 as { relation: Array<{ id: string }> }).relation,
		[{ id: "request-created-1" }],
	);
	assert.equal(comments.length, 2);

	const simulationCase = makeNotion({
		existingByDocumentType: {
			提案書: [readyProposalRequestPage()],
		},
	});
	const simulation = await processProposalSimulationForTest(
		{ pageId: "request-ready-1", dryRun: false },
		simulationCase.notion as never,
	);
	assert.equal(simulation.status, "シミュレーション準備完了");
	assert.equal(simulation.grossProfit, 3000000);
	const projectGrossUpdate = simulationCase.updates.find((update) => {
		const properties = update.properties as Record<string, unknown>;
		return Boolean(properties.予定粗利額);
	});
	assert.ok(projectGrossUpdate);
	const grossProps = projectGrossUpdate.properties as Record<string, unknown>;
	assert.equal((grossProps.予定粗利額 as { number: number }).number, 3000000);
	assert.equal(
		(grossProps.予定粗利の根拠 as { select: { name: string } }).select.name,
		"価格あり",
	);
	const projectPdfAppend = simulationCase.appends.find((append) => append.block_id === "project-1");
	assert.ok(projectPdfAppend);
	assert.match(JSON.stringify(projectPdfAppend), /"type":"pdf"/);

	const existingCase = makeNotion({
		projectRequestIds: ["request-existing"],
		existingByDocumentType: {
			提案書: [requestPage("request-existing", "提案書")],
		},
	});

	const existing = await processProjectProposalRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		existingCase.notion as never,
	);

	assert.ok(["existing", "needs-input"].includes(existing.action));
	assert.equal(existing.requestPageId, "request-existing");
	assert.equal(existingCase.creates.length, 0);
	assert.equal(existingCase.updates.length, 0);
	assert.equal(existingCase.comments.length, 2);

	const residentCase = makeNotion({
		projectRequestIds: ["request-proposal-existing"],
		existingByDocumentType: {
			提案書: [requestPage("request-proposal-existing", "提案書")],
			住民説明会資料: [],
		},
	});

	const resident = await processProjectResidentDocumentRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		residentCase.notion as never,
	);

	assert.ok(["created", "needs-input"].includes(resident.action));
	assert.equal(resident.requestPageId, "request-created-1");
	assert.equal(residentCase.creates.length, 1);
	const residentProps = residentCase.creates[0]!.properties as Record<string, unknown>;
	assert.equal(
		(residentProps.資料種別 as { select: { name: string } }).select.name,
		"住民説明会資料",
	);
	assert.equal(
		(residentProps.資料作成ステータス as { select: { name: string } }).select.name,
		"入力待ち",
	);
	assert.equal(
		(residentProps.周知方法 as { select: { name: string } }).select.name,
		"所有者変更周知",
	);
	assert.equal(residentCase.queries.length, 1);
	assert.equal(queryDocumentType(residentCase.queries[0]!), "住民説明会資料");
	const residentProjectProps = residentCase.updates[0]!.properties as Record<string, unknown>;
	assert.deepEqual(
		(residentProjectProps.資料作成依頼 as { relation: Array<{ id: string }> }).relation,
		[{ id: "request-proposal-existing" }, { id: "request-created-1" }],
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
