import assert from "node:assert/strict";
import { processInquiryProjectCreationForTest } from "./index";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function selectProp(value: string) {
	return { type: "select", select: value ? { name: value } : null };
}

function dateProp(value: string | null = null) {
	return { type: "date", date: value ? { start: value } : null };
}

function relationProp(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function peopleProp(ids: string[]) {
	return { type: "people", people: ids.map((id) => ({ id })) };
}

function numberProp(value: number | null = null) {
	return { type: "number", number: value };
}

function proposalRequestDataSourceSchema() {
	return {
		properties: {
			案件名: { type: "title", title: {} },
			資料種別: {
				type: "select",
				select: {
					options: [
						{ name: "提案書" },
						{ name: "概要書" },
						{ name: "住民説明会資料" },
					],
				},
			},
			シミュレーションステータス: { type: "select", select: { options: [{ name: "入力待ち" }] } },
			資料作成ステータス: { type: "select", select: { options: [{ name: "入力待ち" }] } },
			関連案件: { type: "relation", relation: {} },
			関連設備詳細: { type: "relation", relation: {} },
			資料作成メモ: { type: "rich_text", rich_text: {} },
			周知方法: {
				type: "select",
				select: { options: [{ name: "所有者変更周知" }] },
			},
		},
	};
}

function inquiryPage(projectIds: string[] = []) {
	return {
		id: "inquiry-1",
		properties: {
			件名: titleProp("問-260526-001｜④ 高圧｜木村正明｜売却"),
			担当営業ユーザー: peopleProp(["assigned-user"]),
			関連企業: relationProp(["company-1"]),
			顧客接点ログ: relationProp(["log-1"]),
			予定粗利額: numberProp(3000000),
			"予定粗利の根拠": selectProp("案件多数見込み"),
			売買区分: selectProp("売却相談"),
			問い合わせ分類コード: selectProp("④ 高圧"),
			紐づき案件: relationProp(projectIds),
			ステータス: selectProp("担当確定"),
			進捗フェーズ: selectProp("担当確定"),
			案件化状態: selectProp("未案件化"),
			案件化スコア: numberProp(),
			案件化近さ: selectProp(""),
			案件化日: dateProp(),
			案件化メモ: richTextProp(""),
			"営業サマリー": richTextProp(""),
			"次の一手": richTextProp(""),
			確認待ち内容: richTextProp("現地写真と設備IDの確認待ち"),
			メール要約: richTextProp("FIT24円・1MW・2023年稼働・売却希望"),
			"📝 活動ログ": richTextProp("6/1 初回TEL：資料送付依頼あり"),
			最終アクション日: dateProp(),
		},
	};
}

function projectPage(id: string) {
	return {
		id,
		properties: {
			案件名: titleProp(""),
			担当営業ユーザー: peopleProp([]),
			関連企業: relationProp([]),
			元問い合わせ: relationProp([]),
			ステータス: selectProp(""),
			獲得ソース: selectProp(""),
			顧客接点ログ: relationProp([]),
			予定粗利額: numberProp(),
			"予定粗利の根拠": selectProp(""),
			売買区分: selectProp(""),
			案件種別: selectProp(""),
			対象物種別: selectProp(""),
			作成日: dateProp(),
			最終アクション日: dateProp(),
			案件詳細: richTextProp(""),
			情報ソース: richTextProp(""),
			"営業サマリー": richTextProp(""),
			"次の一手": richTextProp(""),
			確認待ち内容: richTextProp(""),
			問い合わせ要約: richTextProp(""),
			問い合わせ活動ログ: richTextProp(""),
		},
	};
}

async function main() {
	const updates: Array<Record<string, unknown>> = [];
	const creates: Array<Record<string, unknown>> = [];
	const comments: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];
	const appends: Array<Record<string, unknown>> = [];

	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "inquiry-1") return inquiryPage();
				return projectPage(page_id);
			},
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return { id: "project-created", properties: {} };
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
		},
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				return { results: [] };
			},
			retrieve: async () => proposalRequestDataSourceSchema(),
		},
		blocks: {
			children: {
				append: async (args: Record<string, unknown>) => {
					appends.push(args);
					return {};
				},
				list: async () => ({ results: [] }),
			},
		},
		comments: {
			create: async (args: Record<string, unknown>) => {
				comments.push(args);
				return {};
			},
		},
	};

	const created = await processInquiryProjectCreationForTest(
		"inquiry-1",
		notion as never,
		"click-user",
	);

	assert.equal(created.action, "created-project");
	assert.equal(created.projectId, "project-created");
	assert.ok(creates.length >= 5, `案件1件と関連4件の初期化が同時に起きるはず: ${creates.length}`);
	assert.ok(queries.length >= 1);
	assert.deepEqual(creates[0]!.template, {
		type: "template_id",
		template_id: "0b9815a4-37c4-4e4c-90b6-1d54fd9664a3",
		timezone: "Asia/Tokyo",
	});
	assert.equal(creates.slice(1).length, 4, "案件作成後に案内3件＋設備1件の依頼が作成されるはず");
	assert.deepEqual(creates[0]!.icon, {
		type: "icon",
		icon: { name: "school", color: "orange" },
	});
	assert.deepEqual(creates[0]!.cover, {
		type: "file_upload",
		file_upload: { id: "3714d017-81e7-8185-8498-00b21fcffbe1" },
	});
	assert.equal(appends.length, 1);
	assert.equal(appends[0]!.block_id, "project-created");
	const createdBodyText = JSON.stringify(appends[0]!.children ?? []);
	assert.match(createdBodyText, /営業サマリーと次の一手/);
	assert.match(createdBodyText, /現地写真と設備IDの確認待ち/);
	assert.match(createdBodyText, /設備詳細、シミュレーション、説明会用資料/);

	const projectUpdate = updates.find((update) => update.page_id === "project-created");
	assert.ok(projectUpdate);
	const projectProperties = projectUpdate.properties as Record<string, unknown>;
	assert.deepEqual(
		(projectProperties.元問い合わせ as { relation: Array<{ id: string }> }).relation.map(
			(page) => page.id,
		),
		["inquiry-1"],
	);
	assert.deepEqual(
		(projectProperties.担当営業ユーザー as { people: Array<{ id: string }> }).people.map(
			(user) => user.id,
		),
		["assigned-user"],
	);
	assert.deepEqual(
		(projectProperties.関連企業 as { relation: Array<{ id: string }> }).relation.map(
			(page) => page.id,
		),
		["company-1"],
	);
	assert.equal((projectProperties.予定粗利額 as { number: number }).number, 3000000);
	assert.equal(
		(projectProperties["予定粗利の根拠"] as { select: { name: string } }).select.name,
		"案件多数見込み",
		"問い合わせの予定粗利の根拠をそのまま引き継ぐ（価格あり固定で上書きしない）",
	);
	assert.equal(
		(projectProperties.売買区分 as { select: { name: string } }).select.name,
		"売却案件",
	);
	assert.equal(
		(projectProperties.案件種別 as { select: { name: string } }).select.name,
		"高圧",
		"問い合わせ分類コード④ 高圧から案件種別=高圧を引き継ぐ",
	);
	assert.equal(
		(projectProperties.対象物種別 as { select: { name: string } }).select.name,
		"太陽光発電所",
		"高圧/低圧は対象物種別=太陽光発電所として引き継ぐ",
	);
	assert.match(JSON.stringify(projectProperties["営業サマリー"]), /情報収集中/);
	assert.match(JSON.stringify(projectProperties["次の一手"]), /設備詳細を作成/);
	assert.match(JSON.stringify(projectProperties["問い合わせ要約"]), /FIT24円/);
	assert.match(JSON.stringify(projectProperties["問い合わせ活動ログ"]), /初回TEL/);

	const inquiryUpdate = updates.find((update) => update.page_id === "inquiry-1");
	assert.ok(inquiryUpdate);
	const inquiryProperties = inquiryUpdate.properties as Record<string, unknown>;
	assert.deepEqual(
		(inquiryProperties.紐づき案件 as { relation: Array<{ id: string }> }).relation.map(
			(page) => page.id,
		),
		["project-created"],
	);
	assert.equal(
		(inquiryProperties.ステータス as { select: { name: string } }).select.name,
		"案件化",
	);
	assert.match(JSON.stringify(inquiryProperties["営業サマリー"]), /案件化有無: あり/);
	assert.match(JSON.stringify(inquiryProperties["次の一手"]), /活動を残す/);
	assert.ok(comments.length >= 1);

	updates.length = 0;
	creates.length = 0;
	comments.length = 0;
	queries.length = 0;
	appends.length = 0;

	const existingNotion = {
		...notion,
		pages: {
			...notion.pages,
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "inquiry-1") return inquiryPage(["project-existing"]);
				return projectPage(page_id);
			},
		},
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				if (args.data_source_id === "54e869d7-ba3e-49e1-b760-af46e23499cb") {
					return { results: [projectPage("project-existing")] };
				}
				return { results: [] };
			},
			retrieve: async () => proposalRequestDataSourceSchema(),
		},
	};

	const skipped = await processInquiryProjectCreationForTest(
		"inquiry-1",
		existingNotion as never,
		"click-user",
	);

	assert.equal(skipped.action, "enriched-existing");
	assert.equal(skipped.projectId, "project-existing");
	assert.equal(creates.length, 4, "既存案件でも関連4件の初期化は走る");
	const enrichedProjectUpdate = updates.find((update) => update.page_id === "project-existing");
	assert.ok(enrichedProjectUpdate, "既存案件へ問い合わせ内容の引き継ぎ更新が走る");
	assert.match(
		JSON.stringify((enrichedProjectUpdate!.properties as Record<string, unknown>)["問い合わせ要約"]),
		/FIT24円/,
	);
	const existingInquiryUpdate = updates.find((update) => update.page_id === "inquiry-1");
	assert.ok(existingInquiryUpdate);
	assert.ok(comments.length >= 1);

	updates.length = 0;
	creates.length = 0;
	comments.length = 0;
	queries.length = 0;
	appends.length = 0;

	const missingGrossNotion = {
		...notion,
		pages: {
			...notion.pages,
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "inquiry-1") {
					const page = inquiryPage();
					page.properties.予定粗利額 = numberProp();
					return page;
				}
				return projectPage(page_id);
			},
		},
	};

	const missingGross = await processInquiryProjectCreationForTest(
		"inquiry-1",
		missingGrossNotion as never,
		"click-user",
	);

	assert.equal(missingGross.action, "error");
	assert.equal(missingGross.projectId, null);
	assert.equal(creates.length, 0, "予定粗利額なしで案件を作ってはいけない");
	assert.match(missingGross.message, /予定粗利額/);
	const missingGrossUpdate = updates.find((update) => update.page_id === "inquiry-1");
	assert.ok(missingGrossUpdate);
	assert.match(JSON.stringify(missingGrossUpdate.properties), /案件化保留/);

	updates.length = 0;
	creates.length = 0;
	comments.length = 0;
	queries.length = 0;
	appends.length = 0;

	const missingBasisNotion = {
		...notion,
		pages: {
			...notion.pages,
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "inquiry-1") {
					const page = inquiryPage();
					page.properties["予定粗利の根拠"] = selectProp("");
					return page;
				}
				return projectPage(page_id);
			},
		},
	};

	const missingBasis = await processInquiryProjectCreationForTest(
		"inquiry-1",
		missingBasisNotion as never,
		"click-user",
	);

	assert.equal(missingBasis.action, "error");
	assert.equal(missingBasis.projectId, null);
	assert.equal(creates.length, 0, "予定粗利の根拠なしで案件を作ってはいけない");
	assert.match(missingBasis.message, /予定粗利の根拠/);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
