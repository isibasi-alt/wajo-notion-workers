import assert from "node:assert/strict";
import {
	processProjectFinanceRequestForTest,
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
		関連ファイナンスシミュレーション: relationProp([]),
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
		関連ファイナンスシミュレーション: relationProp([]),
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
			関連案件: relationProp([]),
			関連設備詳細: relationProp([]),
			資料作成メモ: richTextProp(""),
			発電所名: richTextProp(""),
			年間売電収入: numberProp(null),
		},
	};
}

function requestDataSourceSchema() {
	return {
		properties: {
			案件名: { type: "title", title: {} },
			資料種別: {
				type: "select",
				select: {
					options: [
						{ name: "提案書" },
						{ name: "ファイナンスシミュレーション" },
						{ name: "住民説明会資料" },
					],
				},
			},
			シミュレーションステータス: {
				type: "select",
				select: { options: [{ name: "入力待ち" }] },
			},
			資料作成ステータス: {
				type: "select",
				select: { options: [{ name: "入力待ち" }] },
			},
			関連案件: { type: "relation", relation: {} },
			関連設備詳細: { type: "relation", relation: {} },
			資料作成メモ: { type: "rich_text", rich_text: {} },
			提案タイプ: { type: "select", select: { options: [{ name: "法人対象" }] } },
			販売価格: { type: "number", number: {} },
			仕入れ価格: { type: "number", number: {} },
			年間売電収入: { type: "number", number: {} },
			"年間維持費（ランニングコスト）": { type: "number", number: {} },
			発電所名: { type: "rich_text", rich_text: {} },
			所在地: { type: "rich_text", rich_text: {} },
			電力会社エリア: { type: "select", select: { options: [{ name: "関西電力" }] } },
			"低圧/高圧区分": { type: "select", select: { options: [{ name: "高圧" }] } },
			パネルメーカー: { type: "rich_text", rich_text: {} },
			パネル型式: { type: "rich_text", rich_text: {} },
			パネル枚数: { type: "number", number: {} },
			"DC容量（パネル側kW）": { type: "number", number: {} },
			パワコンメーカー: { type: "rich_text", rich_text: {} },
			パワコン型式: { type: "rich_text", rich_text: {} },
			"PCS容量（パワコン側kW）": { type: "number", number: {} },
			"FIT/FIP区分": { type: "select", select: { options: [{ name: "FIT" }] } },
			売電単価: { type: "number", number: {} },
			残存売電期間: { type: "number", number: {} },
			連系開始日: { type: "date", date: {} },
			現場写真: { type: "files", files: {} },
			抑制条件: { type: "rich_text", rich_text: {} },
			土地代: { type: "number", number: {} },
			システム本体価格: { type: "number", number: {} },
			権利代: { type: "number", number: {} },
			借入比率: { type: "number", number: {} },
			借入額: { type: "number", number: {} },
			金利: { type: "number", number: {} },
			返済期間: { type: "number", number: {} },
			実効税率: { type: "number", number: {} },
			今期利益見込: { type: "number", number: {} },
			流動比率: { type: "number", number: {} },
			利益剰余金: { type: "number", number: {} },
			自己資本比率: { type: "number", number: {} },
			周知方法: { type: "select", select: { options: [{ name: "所有者変更周知" }] } },
			質問受付期間: { type: "date", date: {} },
			周知日: { type: "date", date: {} },
			"保守管理責任者 氏名": { type: "rich_text", rich_text: {} },
			旧認定事業者: { type: "rich_text", rich_text: {} },
			新認定事業者: { type: "rich_text", rich_text: {} },
			設備ID: { type: "rich_text", rich_text: {} },
			発電所所在地画像: { type: "files", files: {} },
			ハザードマップ: { type: "files", files: {} },
			説明会対象エリア画像: { type: "files", files: {} },
			"反射光画像（夏至）": { type: "files", files: {} },
			"反射光画像（冬至）": { type: "files", files: {} },
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
			関連設備詳細: relationProp(["equipment-1"]),
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

function financeSimulationPage(id = "finance-1") {
	return {
		id,
		url: `https://www.notion.so/${id}`,
		properties: {
			Name: titleProp("湖南市250kW 太陽光案件｜ファイナンス"),
			関連案件: relationProp([]),
			関連提案シミュレーション: relationProp([]),
			元提案シミュレーション: relationProp([]),
			ファイナンス状態: selectProp("入力待ち"),
			借入比率: numberProp(null),
			借入額: numberProp(null),
			金利: numberProp(null),
			返済期間: numberProp(null),
			実効税率: numberProp(null),
			今期利益見込: numberProp(null),
			流動比率: numberProp(null),
			利益剰余金: numberProp(null),
			自己資本比率: numberProp(null),
			土地代: numberProp(null),
			システム本体価格: numberProp(null),
			権利代: numberProp(null),
			ファイナンスメモ: richTextProp(""),
			"B/S評価メモ": richTextProp(""),
			金利メモ: richTextProp(""),
			購入タイミング理由: richTextProp(""),
		},
	};
}

function queryDocumentType(args: Record<string, unknown> | undefined): string {
	if (!args) return "";
	const json = JSON.stringify(args);
	if (json.includes("住民説明会資料")) return "住民説明会資料";
	if (json.includes("ファイナンスシミュレーション")) return "ファイナンスシミュレーション";
	if (json.includes("提案書")) return "提案書";
	return "";
}

// Minimal filter emulation for relation/select filters so that a data-source
// query returns only the records that actually match (models real Notion,
// enabling the finance-record dedup fallback to be exercised faithfully).
function recordMatchesFilter(record: Record<string, unknown>, filter: unknown): boolean {
	if (!filter || typeof filter !== "object") return true;
	const f = filter as Record<string, unknown>;
	if (Array.isArray(f.and)) return f.and.every((sub) => recordMatchesFilter(record, sub));
	if (Array.isArray(f.or)) return f.or.some((sub) => recordMatchesFilter(record, sub));
	const property = typeof f.property === "string" ? f.property : "";
	if (!property) return true;
	const properties = (record.properties ?? {}) as Record<string, unknown>;
	const prop = (properties[property] ?? {}) as Record<string, unknown>;
	if (f.relation && typeof f.relation === "object") {
		const contains = (f.relation as Record<string, unknown>).contains;
		const relationIds = Array.isArray(prop.relation)
			? (prop.relation as Array<Record<string, unknown>>).map((item) => item?.id)
			: [];
		return relationIds.includes(contains);
	}
	if (f.select && typeof f.select === "object") {
		const equals = (f.select as Record<string, unknown>).equals;
		const selectName = (prop.select as Record<string, unknown> | undefined)?.name;
		return selectName === equals;
	}
	return true;
}

function makeNotion(options: {
	projectRequestIds?: string[];
	projectPropertyOverrides?: Record<string, unknown>;
	existingByDocumentType?: Record<string, Array<Record<string, unknown>>>;
	existingByDataSource?: Record<string, Array<Record<string, unknown>>>;
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
			retrieve: async () => requestDataSourceSchema(),
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				const dataSourceId = typeof args.data_source_id === "string" ? args.data_source_id : "";
				if (dataSourceId && options.existingByDataSource?.[dataSourceId]) {
					const records = options.existingByDataSource[dataSourceId] ?? [];
					return {
						results: records.filter((record) => recordMatchesFilter(record, args.filter)),
					};
				}
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
				if (page_id.startsWith("finance-created-")) {
					const index = Number(page_id.replace("finance-created-", "")) - 1;
					const created = creates.filter((entry) =>
						(entry.parent as { data_source_id?: string })?.data_source_id ===
						"7e4d0168-6e54-4071-bd55-f9730202225c"
					)[index];
					assert.ok(created, `created finance page not found: ${page_id}`);
					return {
						id: page_id,
						url: `https://www.notion.so/${page_id}`,
						properties: {
							...financeSimulationPage(page_id).properties,
							...(created.properties as Record<string, unknown>),
						},
					};
				}
				if (page_id.startsWith("sales-proposal-created-")) {
					const index = Number(page_id.replace("sales-proposal-created-", "")) - 1;
					const created = creates.filter((entry) =>
						(entry.parent as { data_source_id?: string })?.data_source_id ===
						"4c3a7df6-3ca1-458a-b595-d98cdeac2802"
					)[index];
					assert.ok(created, `created sales proposal page not found: ${page_id}`);
					return {
						id: page_id,
						url: `https://www.notion.so/${page_id}`,
						properties: created.properties as Record<string, unknown>,
					};
				}
				if (page_id.startsWith("request-created-")) {
					const index = Number(page_id.replace("request-created-", "")) - 1;
					const created = creates.filter((entry) =>
						(entry.parent as { data_source_id?: string })?.data_source_id ===
						"9701e891-ffd0-43d7-b6f9-911fedc65391"
					)[index];
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
				for (const pages of Object.values(options.existingByDataSource ?? {})) {
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
				const dataSourceId = (args.parent as { data_source_id?: string })?.data_source_id;
				const idPrefix =
					dataSourceId === "9701e891-ffd0-43d7-b6f9-911fedc65391"
						? "request-created"
						: dataSourceId === "7e4d0168-6e54-4071-bd55-f9730202225c"
							? "finance-created"
							: dataSourceId === "4c3a7df6-3ca1-458a-b595-d98cdeac2802"
								? "sales-proposal-created"
								: "created";
				const sameKindCount = creates.filter((entry) =>
					(entry.parent as { data_source_id?: string })?.data_source_id === dataSourceId
				).length;
				const page = {
					id: `${idPrefix}-${sameKindCount}`,
					url: `https://www.notion.so/${idPrefix}-${sameKindCount}`,
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
				list: async () => ({
					results: [],
					has_more: false,
					next_cursor: null,
				}),
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
	const proposalWithoutEquipmentCase = makeNotion({
		projectPropertyOverrides: {
			販売価格: numberProp(null),
		},
	});

	const proposalWithoutEquipment = await processProjectProposalRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		proposalWithoutEquipmentCase.notion as never,
	);

	assert.equal(proposalWithoutEquipment.action, "needs-input");
	assert.equal(proposalWithoutEquipment.requestPageId, null);
	assert.match(proposalWithoutEquipment.message, /設備詳細を入力する/);
	assert.equal(proposalWithoutEquipmentCase.creates.length, 0);
	assert.ok(proposalWithoutEquipmentCase.updates.length >= 1);
	assert.ok(proposalWithoutEquipmentCase.comments.length >= 1);

	const proposalMissingSimulationInputCase = makeNotion({
		projectPageOverride: {
			id: "project-1",
			url: "https://www.notion.so/project-1",
			properties: {
				...projectCoreOnlyProperties(),
				販売価格: numberProp(null),
			},
		},
	});

	const proposalMissingSimulationInput = await processProjectProposalRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		proposalMissingSimulationInputCase.notion as never,
	);

	assert.equal(proposalMissingSimulationInput.action, "needs-input");
	assert.equal(proposalMissingSimulationInput.requestPageId, null);
	assert.match(proposalMissingSimulationInput.message, /販売価格/);
	assert.equal(proposalMissingSimulationInputCase.creates.length, 0);
	assert.ok(proposalMissingSimulationInputCase.updates.length >= 1);
	assert.ok(proposalMissingSimulationInputCase.comments.length >= 1);

	const equipmentLinkedCase = makeNotion({
		projectPageOverride: projectPageWithEquipmentOnly(),
	});

	const fromEquipment = await processProjectProposalRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		equipmentLinkedCase.notion as never,
	);

	assert.equal(fromEquipment.action, "created");
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

	assert.equal(fromEquipmentPageButton.action, "created");
	assert.equal(fromEquipmentPageButton.projectPageId, "project-1");
	assert.equal(fromEquipmentPageButton.requestPageId, "request-created-1");
	const fromEquipmentPageButtonProps = equipmentPageButtonCase.creates[0]!
		.properties as Record<string, unknown>;
	assert.deepEqual(
		(fromEquipmentPageButtonProps.関連案件 as { relation: Array<{ id: string }> }).relation,
		[{ id: "project-1" }],
	);
	assert.deepEqual(
		(fromEquipmentPageButtonProps.関連設備詳細 as { relation: Array<{ id: string }> }).relation,
		[{ id: "equipment-1" }],
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

	assert.equal(created.action, "needs-input");
	assert.equal(created.requestPageId, null);
	assert.equal(creates.length, 0);
	assert.equal(queries.length, 0);
	assert.match(created.message, /設備詳細を入力する/);
	assert.ok(comments.length >= 1);

	const financeWithoutProposalCase = makeNotion({
		projectPropertyOverrides: {
			借入額: numberProp(15000000),
			金利: numberProp(1.2),
			返済期間: numberProp(15),
			実効税率: numberProp(30),
			今期利益見込: numberProp(8000000),
			流動比率: numberProp(180),
			利益剰余金: numberProp(70000000),
			自己資本比率: numberProp(42),
			土地代: numberProp(3000000),
			システム本体価格: numberProp(17000000),
			権利代: numberProp(2000000),
		},
	});
	const financeWithoutProposal = await processProjectFinanceRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		financeWithoutProposalCase.notion as never,
	);
	assert.equal(financeWithoutProposal.action, "needs-input");
	assert.equal(financeWithoutProposal.requestPageId, null);
	assert.match(financeWithoutProposal.message, /シミュレーション作成/);
	assert.equal(financeWithoutProposalCase.creates.length, 0);
	assert.ok(financeWithoutProposalCase.updates.length >= 1);
	assert.ok(financeWithoutProposalCase.comments.length >= 1);

	const financeIncompleteProposalCase = makeNotion({
		existingByDocumentType: {
			提案書: [requestPage("request-proposal-incomplete", "提案書")],
		},
	});
	const financeIncompleteProposal = await processProjectFinanceRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		financeIncompleteProposalCase.notion as never,
	);
	assert.equal(financeIncompleteProposal.action, "needs-input");
	assert.equal(financeIncompleteProposal.requestPageId, "request-proposal-incomplete");
	assert.match(financeIncompleteProposal.message, /シミュレーション入力を完了/);
	assert.equal(financeIncompleteProposalCase.creates.length, 0);
	assert.ok(financeIncompleteProposalCase.updates.length >= 1);
	assert.ok(financeIncompleteProposalCase.comments.length >= 1);

	const financeRequestCase = makeNotion({
		projectPropertyOverrides: {
			借入額: numberProp(15000000),
			金利: numberProp(1.2),
			返済期間: numberProp(15),
			実効税率: numberProp(30),
			今期利益見込: numberProp(8000000),
			流動比率: numberProp(180),
			利益剰余金: numberProp(70000000),
			自己資本比率: numberProp(42),
			土地代: numberProp(3000000),
			システム本体価格: numberProp(17000000),
			権利代: numberProp(2000000),
		},
		existingByDocumentType: {
			提案書: [readyProposalRequestPage()],
		},
	});
	const financeRequest = await processProjectFinanceRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		financeRequestCase.notion as never,
	);
	assert.equal(financeRequest.action, "created");
	assert.equal(financeRequest.requestPageId, "request-created-1");
	assert.match(financeRequest.message, /投資条件入力ページ/);
	assert.equal(financeRequestCase.creates.length, 2);
	const financeRequestCreate = financeRequestCase.creates.find((create) =>
		(create.parent as { data_source_id?: string })?.data_source_id ===
		"9701e891-ffd0-43d7-b6f9-911fedc65391"
	);
	assert.ok(financeRequestCreate);
	const financeRequestProps = financeRequestCreate!.properties as Record<string, unknown>;
	assert.equal(
		(financeRequestProps.資料種別 as { select: { name: string } }).select.name,
		"ファイナンスシミュレーション",
	);
	assert.equal(
		(financeRequestProps.借入額 as { number: number }).number,
		15000000,
	);
	assert.equal(
		(financeRequestProps.金利 as { number: number }).number,
		1.2,
	);
	assert.equal(
		(financeRequestProps.流動比率 as { number: number }).number,
		180,
	);
	assert.equal(
		(financeRequestProps.利益剰余金 as { number: number }).number,
		70000000,
	);
	assert.equal(
		(financeRequestProps.自己資本比率 as { number: number }).number,
		42,
	);
	assert.match(JSON.stringify(financeRequestProps.案件名), /投資条件入力/);
	const financeDraftCreate = financeRequestCase.creates.find((create) =>
		(create.parent as { data_source_id?: string })?.data_source_id ===
		"7e4d0168-6e54-4071-bd55-f9730202225c"
	);
	assert.ok(financeDraftCreate);
	const financeDraftUpdate = financeRequestCase.updates.find((update) => update.page_id === "finance-created-1");
	assert.ok(financeDraftUpdate);
	const financeDraftProps = financeDraftUpdate!.properties as Record<string, unknown>;
	assert.deepEqual(
		(financeDraftProps.関連案件 as { relation: Array<{ id: string }> }).relation,
		[{ id: "project-1" }],
	);
	assert.deepEqual(
		(financeDraftProps.関連提案シミュレーション as { relation: Array<{ id: string }> }).relation,
		[{ id: "request-created-1" }],
	);
	assert.equal(
		(financeDraftProps.ファイナンス状態 as { select: { name: string } }).select.name,
		"入力待ち",
	);
	assert.match(JSON.stringify(financeDraftProps.ファイナンスメモ), /借入額・金利・返済期間/);
	assert.match(JSON.stringify(financeDraftProps["B/S評価メモ"]), /案件/);
	assert.match(JSON.stringify(financeDraftProps.金利メモ), /システム本体価格/);
	assert.match(JSON.stringify(financeDraftProps.購入タイミング理由), /未判定/);
	const financeDraftAppend = financeRequestCase.appends.find(
		(append) => append.block_id === "finance-created-1",
	);
	assert.ok(financeDraftAppend);
	assert.match(JSON.stringify(financeDraftAppend), /投資条件入力/);
	assert.match(JSON.stringify(financeDraftAppend), /借入額/);
	assert.match(JSON.stringify(financeDraftAppend), /案件サマリー/);
	const financeProjectUpdate = financeRequestCase.updates.find((update) => {
		const properties = update.properties as Record<string, unknown>;
		return Boolean(properties.関連ファイナンスシミュレーション);
	});
	assert.ok(financeProjectUpdate);
	const financeProjectProps = financeProjectUpdate!.properties as Record<string, unknown>;
	assert.deepEqual(
		(financeProjectProps.関連ファイナンスシミュレーション as { relation: Array<{ id: string }> }).relation,
		[{ id: "finance-created-1" }],
	);

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
	const salesProposalCreate = simulationCase.creates.find((create) =>
		(create.parent as { data_source_id?: string })?.data_source_id ===
		"4c3a7df6-3ca1-458a-b595-d98cdeac2802"
	);
	assert.ok(salesProposalCreate);
	const salesProposalProps = salesProposalCreate!.properties as Record<string, unknown>;
	assert.equal(
		(salesProposalProps.提案状態 as { select: { name: string } }).select.name,
		"提案可能",
	);
	assert.equal(
		(salesProposalProps["案件アクション分類"] as { select: { name: string } }).select.name,
		"化ける案件",
	);
	assert.deepEqual(
		(salesProposalProps["関連提案シミュレーション依頼"] as { relation: Array<{ id: string }> }).relation,
		[{ id: "request-ready-1" }],
	);
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
	const financeRecordCreate = simulationCase.creates.find((create) =>
		(create.parent as { data_source_id?: string })?.data_source_id ===
		"7e4d0168-6e54-4071-bd55-f9730202225c"
	);
	assert.ok(financeRecordCreate);
	const financeRecordProps = financeRecordCreate!.properties as Record<string, unknown>;
	assert.deepEqual(
		(financeRecordProps.関連案件 as { relation: Array<{ id: string }> }).relation,
		[{ id: "project-1" }],
	);
	const projectPdfAppend = simulationCase.appends.find((append) => append.block_id === "project-1");
	assert.ok(projectPdfAppend);
	assert.match(JSON.stringify(projectPdfAppend), /"type":"pdf"/);
	assert.equal(
		simulationCase.fileUploads.some((upload) => upload.action === "complete"),
		false,
	);

	// 二重化しない: 同一案件に既存 finance 入力箱があり、その 関連提案シミュレーション が
	// 今回の提案ページ(request-ready-1)と不一致でも、新規作成せず既存箱を update し、
	// 計算値(年間返済額等)が書かれ、関連案件が保持されること。
	const dedupExistingBox = {
		id: "finance-existing-1",
		url: "https://www.notion.so/finance-existing-1",
		properties: {
			...financeSimulationPage("finance-existing-1").properties,
			関連案件: relationProp(["project-1"]),
			関連提案シミュレーション: relationProp(["request-other-9999"]),
			ファイナンス状態: selectProp("入力待ち"),
		},
	};
	const dedupCase = makeNotion({
		existingByDocumentType: {
			提案書: [readyProposalRequestPage()],
		},
		existingByDataSource: {
			"7e4d0168-6e54-4071-bd55-f9730202225c": [dedupExistingBox],
		},
	});
	await processProposalSimulationForTest(
		{ pageId: "request-ready-1", dryRun: false },
		dedupCase.notion as never,
	);
	const dedupFinanceCreates = dedupCase.creates.filter(
		(create) =>
			(create.parent as { data_source_id?: string })?.data_source_id ===
			"7e4d0168-6e54-4071-bd55-f9730202225c",
	);
	assert.equal(
		dedupFinanceCreates.length,
		0,
		"既存の finance 入力箱があるときは新規作成せず update すること",
	);
	const dedupUpdate = dedupCase.updates.find(
		(update) =>
			update.page_id === "finance-existing-1" &&
			(update.properties as Record<string, unknown>).年間返済額 !== undefined,
	);
	assert.ok(dedupUpdate, "既存 finance 箱へ計算値の update が行われること");
	const dedupProps = dedupUpdate!.properties as Record<string, unknown>;
	assert.deepEqual(
		(dedupProps.関連案件 as { relation: Array<{ id: string }> }).relation,
		[{ id: "project-1" }],
		"関連案件が必ず保持/設定されること",
	);
	assert.equal(
		(dedupProps.ファイナンス状態 as { select: { name: string } }).select.name,
		"準備完了",
	);
	assert.equal(
		typeof (dedupProps.年間返済額 as { number: number }).number,
		"number",
	);

	// 実機再現: 提案ページ自身の 関連案件 が空でも、紐づく設備詳細ページの 関連案件 から
	// 案件idを解決してフォールバックを発動し、既存の入力待ち箱へ update・関連案件を保持すること。
	const noProjectProposalPage = {
		id: "request-ready-noproject",
		url: "https://www.notion.so/request-ready-noproject",
		properties: {
			...readyProposalRequestPage().properties,
			関連案件: relationProp([]),
			関連設備詳細: relationProp(["equipment-1"]),
		},
	};
	const noProjectExistingBox = {
		id: "finance-box-noproject",
		url: "https://www.notion.so/finance-box-noproject",
		properties: {
			...financeSimulationPage("finance-box-noproject").properties,
			関連案件: relationProp(["project-1"]),
			関連提案シミュレーション: relationProp(["request-other-9999"]),
			ファイナンス状態: selectProp("入力待ち"),
		},
	};
	const noProjectCase = makeNotion({
		existingByDocumentType: {
			提案書: [noProjectProposalPage],
		},
		existingByDataSource: {
			"7e4d0168-6e54-4071-bd55-f9730202225c": [noProjectExistingBox],
		},
	});
	await processProposalSimulationForTest(
		{ pageId: "request-ready-noproject", dryRun: false },
		noProjectCase.notion as never,
	);
	const noProjectFinanceCreates = noProjectCase.creates.filter(
		(create) =>
			(create.parent as { data_source_id?: string })?.data_source_id ===
			"7e4d0168-6e54-4071-bd55-f9730202225c",
	);
	assert.equal(
		noProjectFinanceCreates.length,
		0,
		"提案ページの関連案件が空でも設備詳細経由で案件を解決し、新規作成せず既存箱へ集約すること",
	);
	const noProjectUpdate = noProjectCase.updates.find(
		(update) =>
			update.page_id === "finance-box-noproject" &&
			(update.properties as Record<string, unknown>).年間返済額 !== undefined,
	);
	assert.ok(noProjectUpdate, "既存 finance 箱へ計算値の update が行われること");
	const noProjectProps = noProjectUpdate!.properties as Record<string, unknown>;
	assert.deepEqual(
		(noProjectProps.関連案件 as { relation: Array<{ id: string }> }).relation,
		[{ id: "project-1" }],
		"設備詳細経由で解決した関連案件が必ず入ること",
	);

	const existingCase = makeNotion({
		projectRequestIds: ["request-existing"],
		projectPageOverride: projectPageWithEquipmentOnly(),
		existingByDocumentType: {
			提案書: [requestPage("request-existing", "提案書")],
		},
	});

	const existing = await processProjectProposalRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		existingCase.notion as never,
	);

	assert.equal(existing.action, "existing");
	assert.equal(existing.requestPageId, "request-existing");
	assert.equal(existingCase.creates.length, 0);
	assert.ok(existingCase.updates.length >= 1);
	const existingRequestUpdate = existingCase.updates.find((update) => {
		if (update.page_id !== "request-existing") return false;
		const properties = update.properties as Record<string, unknown>;
		return Boolean(properties.関連設備詳細);
	});
	assert.ok(existingRequestUpdate);
	const existingRequestProps = existingRequestUpdate!.properties as Record<string, unknown>;
	assert.deepEqual(
		(existingRequestProps.関連設備詳細 as { relation: Array<{ id: string }> }).relation,
		[{ id: "equipment-1" }],
	);
	assert.equal(
		(existingRequestProps.発電所名 as { rich_text: Array<{ text: { content: string } }> }).rich_text[0]!.text.content,
		"湖南市250kW 太陽光発電所",
	);
	assert.equal(
		(existingRequestProps.年間売電収入 as { number: number }).number,
		2090000,
	);
	assert.ok(existingCase.comments.length >= 1);

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
