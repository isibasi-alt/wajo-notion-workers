import assert from "node:assert/strict";
import {
	fallbackDeepResearchForTest,
	isDeepResearchCompleteForTest,
	mergeCompanyResearchForTest,
	mergeDeepResearchForTest,
	processBusinessCardForTest,
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
	assert.match(closingText, /【取れていない事実】/);
	assert.match(closingText, /【取れば取れる】/);
	assert.match(closingText, /【初回ヒアリングで取る】/);
	assert.equal(forbidden.test(closingText), false);

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

	console.log("OK business-card-talk-pipeline");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
