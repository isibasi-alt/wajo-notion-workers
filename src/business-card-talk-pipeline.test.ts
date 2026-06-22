import assert from "node:assert/strict";
import {
	buildCompanyResearchAbTestLogForTest,
	fallbackDeepResearchForTest,
	isDeepResearchCompleteForTest,
	mergeCompanyResearchForTest,
	mergeDeepResearchForTest,
	parseBusinessCardOcrForTest,
	processBusinessCardForTest,
	processCompanyResearchForTest,
} from "./index";

const forbidden = /推測ですが|仮説ですが|憶測ですが/;

type PageProperties = Record<string, unknown>;

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function selectProp(value: string) {
	return { type: "select", select: { name: value } };
}

function urlProp(value: string | null = null) {
	return { type: "url", url: value };
}

function dateProp(value: string | null = null) {
	return { type: "date", date: value ? { start: value } : null };
}

function selectName(value: unknown): string {
	if (!value || typeof value !== "object") return "";
	const patch = value as Record<string, unknown>;
	const select = (patch.select as Record<string, unknown>)?.name;
	if (typeof select === "string") return select;
	const status = (patch.status as Record<string, unknown>)?.name;
	if (typeof status === "string") return status;
	const richText = patch.rich_text;
	if (Array.isArray(richText)) {
		return richTextFromPatch({ rich_text: richText });
	}
	const plainText = (patch.text as Record<string, unknown>)?.content;
	return typeof plainText === "string" ? plainText : "";
}

function relationProp(ids: string[] = []) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function richTextFromPatch(property: unknown): string {
	if (!property || typeof property !== "object") return "";
	const patch = property as Record<string, unknown>;
	const richText = patch.rich_text;
	if (!Array.isArray(richText)) return "";
	return richText
		.map((part) => {
			if (!part || typeof part !== "object") return "";
			const text = (part as Record<string, unknown>).text;
			if (text && typeof text === "object") {
				return typeof (text as Record<string, unknown>).content === "string"
					? ((text as Record<string, unknown>).content as string)
					: "";
			}
			return typeof (part as Record<string, unknown>).plain_text === "string"
				? ((part as Record<string, unknown>).plain_text as string)
				: "";
		})
		.join("");
}

function hasStrikethroughText(property: unknown): boolean {
	if (!property || typeof property !== "object") return false;
	const richText = (property as Record<string, unknown>).rich_text;
	if (!Array.isArray(richText)) return false;
	return richText.some((part) => {
		if (!part || typeof part !== "object") return false;
		const annotations = (part as Record<string, unknown>).annotations;
		return Boolean(
			annotations &&
				typeof annotations === "object" &&
				(annotations as Record<string, unknown>).strikethrough === true,
		);
	});
}

async function withoutAiKeys<T>(fn: () => Promise<T>): Promise<T> {
	const oldGemini = process.env.GEMINI_API_KEY;
	const oldGoogle = process.env.GOOGLE_API_KEY;
	const oldPerplexity = process.env.PERPLEXITY_API_KEY;
	process.env.GEMINI_API_KEY = "";
	process.env.GOOGLE_API_KEY = "";
	process.env.PERPLEXITY_API_KEY = "";
	try {
		return await fn();
	} finally {
		if (oldGemini === undefined) delete process.env.GEMINI_API_KEY;
		else process.env.GEMINI_API_KEY = oldGemini;
		if (oldGoogle === undefined) delete process.env.GOOGLE_API_KEY;
		else process.env.GOOGLE_API_KEY = oldGoogle;
		if (oldPerplexity === undefined) delete process.env.PERPLEXITY_API_KEY;
		else process.env.PERPLEXITY_API_KEY = oldPerplexity;
	}
}

function makeNotionForCardCase(companyClosingPoint: string) {
	const card = {
		id: "card-1",
		properties: {
			氏名: titleProp("西田玄輝"),
			会社名: richTextProp("株式会社コアリスホールディングス"),
			メール: { type: "email", email: "nori@coreis.co.jp" },
			電話: { type: "phone_number", phone_number: "06-0000-0000" },
			住所: richTextProp("大阪府大阪市"),
			役職: richTextProp("代表取締役"),
			名刺画像: { type: "files", files: [] },
		},
	};

	const company = {
		id: "8a6ed4d7709a44ae90e61af3a79b9bc1",
		properties: {
			企業名: titleProp("株式会社コアリス ホールディングス"),
			企業登録ソース: selectProp("名刺"),
			企業重複チェックキー: richTextProp(
				"corp:カブシキガイシャコアリスホールディングス|domain:coreis.co.jp|phone:0600000000",
			),
			成約へのポイント: richTextProp(companyClosingPoint),
			関連名刺: relationProp([]),
			関連問い合わせ: relationProp([]),
			関連案件: relationProp([]),
			企業AI受付メモ: richTextProp(""),
			企業調査ステータス: selectProp("未着手"),
			名刺起点Webhookメモ: richTextProp(""),
		},
	} as { id: string; properties: PageProperties };

	const notion = {
		dataSources: {
			query: async () => ({ results: [company] }),
		},
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
			if (page_id === "card-1") return card;
			if (page_id === company.id) return company;
			throw new Error(`unexpected retrieve: ${page_id}`);
		},
			update: async () => ({}) as Record<string, unknown>,
		},
	} as never;

	const updates: Array<{ page_id: string; properties?: PageProperties }> = [];
	const wrapped = {
		...notion,
		pages: {
			...notion.pages,
			update: async ({ page_id, properties }: { page_id: string; properties?: PageProperties }) => {
				updates.push({ page_id, properties });
				return { id: page_id } as Record<string, unknown>;
			},
		},
	};

	return { notion: wrapped, updates };
}

function makeNotionForNewCardCase(params: {
	cardCompanyName: string;
	cardPhone?: string;
	cardEmail?: string;
	cardAddress?: string;
	cardRole?: string;
	cardName?: string;
	}) {
	const card = {
		id: "card-1",
		properties: {
			氏名: titleProp(params.cardName ?? "山田 花子"),
			会社名: richTextProp(params.cardCompanyName),
			メール: { type: "email", email: params.cardEmail ?? "hanako@example.co.jp" },
			電話: { type: "phone_number", phone_number: params.cardPhone ?? "06-0000-1111" },
			住所: richTextProp(params.cardAddress ?? "大阪府大阪市中央区"),
			役職: richTextProp(params.cardRole ?? "営業室長"),
			名刺画像: { type: "files", files: [] },
		},
	};

	const notion = {
		__createdCompanies: new Map<string, { id: string; properties: Record<string, unknown> }>(),
		dataSources: {
			query: async () => ({ results: [] as Array<{ id: string; properties: Record<string, unknown> }> }),
		},
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
			if (page_id === "card-1") return card;
			const created = notion.__createdCompanies.get(page_id);
			if (created) return created;
			throw new Error(`unexpected retrieve: ${page_id}`);
		},
			create: async ({
				properties,
			}: {
				properties: Record<string, unknown>;
			}) => {
				const created = { id: "new-company-1", properties };
				notion.__createdCompanies.set(created.id, created);
				return created as { id: string; properties: Record<string, unknown> };
			},
			update: async () => ({}) as Record<string, unknown>,
		},
	} as never;

	const updates: Array<{ page_id: string; properties?: PageProperties }> = [];
	const wrapped = {
		...notion,
		pages: {
			...notion.pages,
			update: async ({ page_id, properties }: { page_id: string; properties?: PageProperties }) => {
				updates.push({ page_id, properties });
				return { id: page_id } as Record<string, unknown>;
			},
		},
	};

		return { notion: wrapped, updates };
	}

function makeNotionForCompanyResearchCase() {
	const company = {
		id: "company-research-1",
		properties: {
			企業名: titleProp("株式会社リサーチ対象"),
			住所: richTextProp("大阪府大阪市"),
			ウェブサイトURL: urlProp(),
			メールアドレス: { type: "email", email: "info@example.co.jp" },
			電話番号: { type: "phone_number", phone_number: "06-1111-2222" },
			信頼度: selectProp("中"),
			提案可否: selectProp("タイミング待ち"),
			企業調査ステータス: selectProp("未着手"),
			リサーチ最終実行日: dateProp(),
			代表者: richTextProp(""),
			経営陣: richTextProp(""),
			業種: richTextProp(""),
			資本金: richTextProp(""),
			設立年月: richTextProp(""),
			売上規模: richTextProp(""),
			従業員規模: richTextProp(""),
			上場区分: richTextProp(""),
			"法人番号（TDB）": richTextProp(""),
			公式SNS情報: richTextProp(""),
			役員SNS発信メモ: richTextProp(""),
			"LinkedIn.": richTextProp(""),
			口コミ情報: richTextProp(""),
			求人情報や従業員レビュー: richTextProp(""),
			直近ニュース: richTextProp(""),
			再エネ接点シグナル: richTextProp(""),
			想定決裁者: richTextProp(""),
			想定反論・懸念: richTextProp(""),
			根拠ソース: richTextProp(""),
			出典ソース: richTextProp(""),
			企業サマリー: richTextProp("推測ですが、どの会社にも当てはまる説明です。"),
			現在課題仮説: richTextProp(""),
			将来課題仮説: richTextProp(""),
			営業切り口: richTextProp(""),
			和上解決策適合: richTextProp(""),
			"3C：顧客・市場分析": richTextProp(""),
			"3C：競合分析": richTextProp(""),
			"3C：自社との関係性": richTextProp(""),
			成約へのポイント: richTextProp("仮説ですが、決裁者は未確認です。"),
			企業AI受付メモ: richTextProp(""),
		},
	} as { id: string; properties: PageProperties };

	const updates: Array<{ page_id: string; properties?: PageProperties }> = [];
	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === company.id) return company;
				throw new Error(`unexpected retrieve: ${page_id}`);
			},
			update: async ({ page_id, properties }: { page_id: string; properties?: PageProperties }) => {
				updates.push({ page_id, properties });
				return { id: page_id } as Record<string, unknown>;
			},
		},
		blocks: {
			children: {
				append: async () => ({}),
			},
		},
	} as never;

	return { notion, updates, company };
}

async function main() {
	const fallback = fallbackDeepResearchForTest("株式会社コアリスホールディングス");

	for (const [key, value] of Object.entries(fallback)) {
		if (typeof value === "string") {
			assert.equal(
				forbidden.test(value),
				false,
				`${key} should not contain forbidden hedge language`,
			);
		}
	}

	assert.match(fallback.closingPoint, /【取れていない事実】/);
	assert.match(fallback.closingPoint, /【取れば取れる】/);
	assert.match(fallback.closingPoint, /【初回ヒアリングで取る】/);

	const missingClosingPoint = { ...fallback, closingPoint: "" };
	assert.equal(
		isDeepResearchCompleteForTest(missingClosingPoint),
		false,
		"成約へのポイントが空なら深掘り完了扱いしない",
	);

	const merged = mergeDeepResearchForTest(
		{ closingPoint: "既存の成約へのポイントは営業現場で確認済み" },
		fallback,
	);
	assert.equal(
		merged.closingPoint,
		"既存の成約へのポイントは営業現場で確認済み",
		"既存の成約へのポイントをWorkerが上書きしない",
	);

	const signalResearch = mergeDeepResearchForTest(
		{},
		{
			...fallback,
			officialSns: "公式X: https://x.com/example",
			executiveSns: "代表者X: 本人性は公式サイト役員名と一致",
			linkedinProfiles: "会社LinkedIn: https://linkedin.com/company/example",
			jobSignals: "施工管理職の求人を確認",
			reviews: "第三者口コミは組織拡大期の傾向として扱う",
			officialSources: "https://example.co.jp/company",
			externalSources: "https://example.co.jp/jobs",
			sourceType: "mixed",
		},
	);
	assert.equal(signalResearch.officialSns, "公式X: https://x.com/example");
	assert.equal(signalResearch.executiveSns, "代表者X: 本人性は公式サイト役員名と一致");
	assert.equal(signalResearch.linkedinProfiles, "会社LinkedIn: https://linkedin.com/company/example");
	assert.equal(signalResearch.jobSignals, "施工管理職の求人を確認");
	assert.equal(signalResearch.reviews, "第三者口コミは組織拡大期の傾向として扱う");
	assert.equal(signalResearch.officialSources, "https://example.co.jp/company");
	assert.equal(signalResearch.externalSources, "https://example.co.jp/jobs");

	const companyMerged = mergeCompanyResearchForTest(
		{
			summary: "",
			currentIssue: "",
			futureIssue: "",
			salesAngle: "",
			fit: "",
			customerMarket3c: "",
			competitor3c: "",
			wajoRelation3c: "",
			source: "",
			closingPoint: "既存Notion値: 決裁者確認済み",
		},
		fallback,
	);
	assert.equal(
		companyMerged.closingPoint,
		"既存Notion値: 決裁者確認済み",
		"名刺起点の企業研究でも既存Notion値を守る",
	);

	const { notion, updates } = makeNotionForCardCase(
		"仮説ですが、推測ですが、成約までの決裁タイミングは未確認です。",
	);
	const cardResult = await withoutAiKeys(() =>
		processBusinessCardForTest({ pageId: "card-1", dryRun: false }, notion),
	);
	assert.equal(cardResult.action, "existing-linked");
	const companyUpdate = updates.find(
		(update) =>
			update.page_id === "8a6ed4d7709a44ae90e61af3a79b9bc1" &&
			update.properties &&
			Object.prototype.hasOwnProperty.call(update.properties, "成約へのポイント"),
	);
	assert.ok(companyUpdate);
	const closingPatch = companyUpdate!.properties?.["成約へのポイント"];
	const closingText = richTextFromPatch(closingPatch);
	assert.equal(hasStrikethroughText(closingPatch), true);
	assert.match(closingText, /【取れていない事実】/);
	assert.match(closingText, /【取れば取れる】/);
	assert.match(closingText, /【初回ヒアリングで取る】/);
	assert.match(closingText, /【修正情報】/);

	const saveOnlyCase = makeNotionForCardCase(
		"仮説ですが、推測ですが、成約までの決裁タイミングは未確認です。",
	);
	const saveOnlyResult = await withoutAiKeys(() =>
		processBusinessCardForTest(
			{ pageId: "card-1", dryRun: false, deepResearch: false },
			saveOnlyCase.notion,
		),
	);
	assert.equal(saveOnlyResult.action, "existing-linked");
	assert.equal(
		saveOnlyCase.updates.some(
			(update) =>
				update.page_id === "8a6ed4d7709a44ae90e61af3a79b9bc1" &&
				update.properties &&
				Object.prototype.hasOwnProperty.call(update.properties, "成約へのポイント"),
		),
		false,
		"名刺だけ保存なら企業深掘りと3C補正を走らせない",
	);
	const saveOnlyCardUpdate = saveOnlyCase.updates.find(
		(update) =>
			update.page_id === "card-1" &&
			update.properties &&
			Object.prototype.hasOwnProperty.call(update.properties, "Webhook引き継ぎメモ"),
	);
	assert.ok(saveOnlyCardUpdate);
	assert.match(
		richTextFromPatch(saveOnlyCardUpdate!.properties?.["Webhook引き継ぎメモ"]),
		/外部調査・3C・商談準備は未実行/,
	);

	const brokerCase = makeNotionForCardCase("");
	const brokerResult = await withoutAiKeys(() =>
		processBusinessCardForTest(
			{
				pageId: "card-1",
				dryRun: false,
				routing: "broker",
				engagementIntent: "active",
			},
			brokerCase.notion,
		),
	);
	assert.equal(brokerResult.action, "needs-review");
	const brokerCardUpdate = brokerCase.updates.find(
		(update) => update.page_id === "card-1" && update.properties?.["名刺AI処理メモ"],
	);
	assert.ok(brokerCardUpdate);
	assert.match(
		richTextFromPatch(brokerCardUpdate!.properties?.["名刺AI処理メモ"]),
		/【停止理由】/,
	);
	assert.match(
		richTextFromPatch(brokerCardUpdate!.properties?.["名刺AI処理メモ"]),
		/社外顧問・ブローカー/,
	);

	const laterCase = makeNotionForCardCase("");
	const laterResult = await withoutAiKeys(() =>
		processBusinessCardForTest(
			{
				pageId: "card-1",
				dryRun: false,
				routing: "later",
				engagementIntent: "active",
			},
			laterCase.notion,
		),
	);
	assert.equal(laterResult.action, "needs-review");
	const laterCardUpdate = laterCase.updates.find(
		(update) => update.page_id === "card-1" && update.properties?.["名刺AI処理メモ"],
	);
	assert.ok(laterCardUpdate);
	assert.match(
		richTextFromPatch(laterCardUpdate!.properties?.["名刺AI処理メモ"]),
		/【人が判断する一点】/,
	);

	const invalidPhoneCase = makeNotionForNewCardCase({
		cardCompanyName: "実在確認待ち株式会社",
		cardPhone: "123",
		cardEmail: "valid@example.co.jp",
	});
	const invalidPhoneResult = await withoutAiKeys(() =>
		processBusinessCardForTest(
			{ pageId: "card-1", dryRun: false, routing: "company", engagementIntent: "active" },
			invalidPhoneCase.notion,
		),
	);
	assert.equal(invalidPhoneResult.action, "needs-review");
	assert.match(invalidPhoneResult.message, /電話番号/);

	assert.equal(
		parseBusinessCardOcrForTest('{"氏名":"山田","会社名":"株式会社テスト","電話":"123","メール":""}'),
		null,
		"OCR電話番号が9桁未満なら入口で止める",
	);

	// DoD-1: 新規正常（既存候補なし）
	{
		const { notion, updates } = makeNotionForNewCardCase({
			cardCompanyName: "サンプル太陽光株式会社",
			cardName: "田中 太郎",
			cardRole: "営業マネージャー",
			cardPhone: "06-1111-2222",
			cardEmail: "tanaka@sample-solar.co.jp",
			cardAddress: "大阪府大阪市北区梅田1-1-1",
		});
		const newCardResult = await withoutAiKeys(() =>
			processBusinessCardForTest(
				{ pageId: "card-1", dryRun: false, deepResearch: false },
				notion,
			),
		);
		assert.equal(newCardResult.action, "created-company");
		assert.equal(newCardResult.companyName, "サンプル太陽光株式会社");
			const cardStatusUpdates = updates.filter(
				(u) => u.page_id === "card-1" && u.properties?.["企業連携ステータス"],
			);
			const finalCardStatus = selectName(
				cardStatusUpdates.at(-1)?.properties?.["企業連携ステータス"],
			);
			assert.equal(finalCardStatus, "新規企業作成");
			const webhookMemoUpdates = updates.filter(
				(u) => u.page_id === "card-1" && u.properties?.["Webhook引き継ぎメモ"],
			);
			const finalWebhookMemo = richTextFromPatch(
				webhookMemoUpdates.at(-1)?.properties?.["Webhook引き継ぎメモ"],
			);
			assert.match(
				finalWebhookMemo,
				/Notion Workerが新規企業作成と名刺連携まで実行。.*外部調査・3C・商談準備は未実行。/,
			);
			assert.ok(
				newCardResult.companyId === "new-company-1",
				"新規企業が1件作成される",
			);
		}

	{
		const { notion, updates, company } = makeNotionForCompanyResearchCase();
		const result = await withoutAiKeys(() =>
			processCompanyResearchForTest({ companyPageId: company.id, dryRun: false }, notion),
		);
		assert.equal(result.companyId, company.id);
		const companyUpdate = updates.find(
			(update) => update.page_id === company.id && update.properties?.["企業AI受付メモ"],
		);
		assert.ok(companyUpdate);
		const summaryPatch = companyUpdate!.properties?.["企業サマリー"];
		assert.ok(summaryPatch);
		assert.equal(hasStrikethroughText(summaryPatch), true);
		assert.match(richTextFromPatch(summaryPatch), /【修正情報】/);
		assert.match(richTextFromPatch(summaryPatch), /【修正理由】/);
		const closingPatch = companyUpdate!.properties?.["成約へのポイント"];
		assert.ok(closingPatch);
		assert.equal(hasStrikethroughText(closingPatch), true);
		const aiMemo = richTextFromPatch(companyUpdate!.properties?.["企業AI受付メモ"]);
		assert.match(aiMemo, /AI A相当/);
		assert.match(aiMemo, /AI B相当/);
		assert.match(aiMemo, /AI C相当/);
		assert.match(aiMemo, /【ABテスト対象】/);
		assert.match(aiMemo, /TDB\/COSMOSNetは通常フロー外/);
		assert.equal("TDB調査年月日" in (companyUpdate!.properties ?? {}), false);
	}

	const abLog = buildCompanyResearchAbTestLogForTest();
	assert.match(abLog, /公式SNS/);
	assert.match(abLog, /役員SNS/);
	assert.match(abLog, /口コミ情報/);
	assert.match(abLog, /求人・従業員レビュー/);
	assert.match(abLog, /出典整理/);

	console.log("OK business-card-talk-pipeline");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
