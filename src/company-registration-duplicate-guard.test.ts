import assert from "node:assert/strict";
import {
	processBusinessCardForTest,
	processInquiryCompanyLinkForTest,
} from "./index";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function emailProp(value: string) {
	return { type: "email", email: value };
}

function phoneProp(value: string) {
	return { type: "phone_number", phone_number: value };
}

function selectProp(value: string) {
	return { type: "select", select: { name: value } };
}

function relationProp(ids: string[] = []) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function businessCardPage() {
	return {
		id: "card-1",
		properties: {
			氏名: titleProp("和上 太郎"),
			会社名: richTextProp("重複防止テスト株式会社"),
			メール: emailProp("taro@example-company.jp"),
			電話: phoneProp("06-0000-0000"),
			住所: richTextProp("大阪府大阪市"),
			役職: richTextProp("部長"),
			名刺画像: { type: "files", files: [] },
		},
	};
}

function inquiryPage(overrides: Record<string, unknown> = {}) {
	return {
		id: "inquiry-1",
		properties: {
			件名: titleProp("太陽光発電所の売却相談"),
			会社名: richTextProp("重複防止テスト株式会社"),
			お名前: richTextProp("和上 太郎"),
			メールアドレス: emailProp("taro@example-company.jp"),
			電話番号: phoneProp("06-0000-0000"),
			本文: richTextProp("法人として太陽光発電所の売却を相談したいです。"),
			要約: richTextProp("法人の売却相談"),
			売買区分: selectProp("売却相談"),
			問い合わせ種別: selectProp("法人"),
			重複チェックキー: richTextProp(
				"corp:重複防止テスト|email:taro@example-company.jp|phone:0600000000",
			),
			"メールID（ユニークキー）": richTextProp("gmail:test-message-1"),
			"Message-ID": richTextProp("<message-1@example-company.jp>"),
			"Thread-ID": richTextProp("thread-1"),
			関連企業: relationProp([]),
			企業重複チェックキー: richTextProp(""),
			企業連携ステータス: selectProp("未処理"),
			企業登録可否: selectProp("要確認"),
			企業連携メモ: richTextProp(""),
			重複判定ステータス: selectProp("未確認"),
			...overrides,
		},
	};
}

function duplicateInquiryPage(companyIds: string[]) {
	return {
		id: "inquiry-duplicate",
		properties: {
			件名: titleProp("既存の同一問い合わせ"),
			関連企業: relationProp(companyIds),
		},
	};
}

function companyPage(
	id: string,
	name = "重複防止テスト株式会社",
	overrides: Record<string, unknown> = {},
) {
	return {
		id,
		properties: {
			企業名: titleProp(name),
			売買区分: selectProp("不明"),
			企業重複チェックキー: richTextProp(
				"corp:重複防止テスト|domain:example-company.jp|phone:0600000000",
			),
			メールアドレス: emailProp("taro@example-company.jp"),
			問い合わせ担当者メールアドレス: emailProp("taro@example-company.jp"),
			電話番号: phoneProp("0600000000"),
			問い合わせ担当者電話番号: phoneProp("0600000000"),
			問い合わせ担当者名: richTextProp(""),
			住所: richTextProp(""),
			企業サマリー: richTextProp(""),
			問い合わせ要約: richTextProp(""),
			現在課題仮説: richTextProp(""),
			将来課題仮説: richTextProp(""),
			営業切り口: richTextProp(""),
			和上解決策適合: richTextProp(""),
			"3C：顧客・市場分析": richTextProp(""),
			"3C：競合分析": richTextProp(""),
			"3C：自社との関係性": richTextProp(""),
			根拠ソース: richTextProp(""),
			企業AI受付メモ: richTextProp(""),
			関連名刺: relationProp([]),
			関連問い合わせ: relationProp([]),
			...overrides,
		},
	};
}

function makeNotion(options: {
	companyResults?: Array<Record<string, unknown>>;
	duplicateInquiries?: Array<Record<string, unknown>>;
	card?: Record<string, unknown>;
	inquiry?: Record<string, unknown>;
	companiesById?: Record<string, Record<string, unknown>>;
} = {}) {
	const creates: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const queries: Array<Record<string, unknown>> = [];
	const companiesById = options.companiesById ?? {};
	for (const company of options.companyResults ?? []) {
		companiesById[company.id as string] = company;
	}
	const notion = {
		dataSources: {
			query: async (args: Record<string, unknown>) => {
				queries.push(args);
				const filter = args.filter as { property?: string } | undefined;
				if (filter?.property === "重複チェックキー") {
					return { results: options.duplicateInquiries ?? [] };
				}
				if (filter?.property === "企業重複チェックキー") {
					return { results: [] };
				}
				return { results: options.companyResults ?? [] };
			},
		},
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "card-1") return options.card ?? businessCardPage();
				if (page_id === "inquiry-1") return options.inquiry ?? inquiryPage();
				if (companiesById[page_id]) return companiesById[page_id];
				throw new Error(`unexpected retrieve: ${page_id}`);
			},
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return { id: `company-created-${creates.length}`, properties: {} };
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
		},
	};
	return { notion, creates, updates, queries };
}

async function withoutGemini<T>(fn: () => Promise<T>): Promise<T> {
	const oldGemini = process.env.GEMINI_API_KEY;
	const oldGoogle = process.env.GOOGLE_API_KEY;
	process.env.GEMINI_API_KEY = "";
	process.env.GOOGLE_API_KEY = "";
	try {
		return await fn();
	} finally {
		if (oldGemini === undefined) delete process.env.GEMINI_API_KEY;
		else process.env.GEMINI_API_KEY = oldGemini;
		if (oldGoogle === undefined) delete process.env.GOOGLE_API_KEY;
		else process.env.GOOGLE_API_KEY = oldGoogle;
	}
}

async function main() {
	const existingCompany = companyPage("company-1");
	const businessCardCase = makeNotion({
		companyResults: [existingCompany],
		companiesById: { "company-1": existingCompany },
	});

	const cardResult = await withoutGemini(() =>
		processBusinessCardForTest(
			{ pageId: "card-1", dryRun: false },
			businessCardCase.notion as never,
		),
	);

	assert.equal(cardResult.action, "existing-linked");
	assert.equal(cardResult.companyId, "company-1");
	assert.equal(businessCardCase.creates.length, 0);
	assert.ok(
		businessCardCase.updates.some((update) => update.page_id === "card-1"),
	);
	assert.ok(
		businessCardCase.updates.some((update) => update.page_id === "company-1"),
	);

	const duplicateLinkedCompany = companyPage("company-duplicate-source");
	const inquiryDuplicateCase = makeNotion({
		duplicateInquiries: [duplicateInquiryPage(["company-duplicate-source"])],
		companiesById: { "company-duplicate-source": duplicateLinkedCompany },
	});

	const duplicateResult = await processInquiryCompanyLinkForTest(
		{ inquiryPageId: "inquiry-1", dryRun: false },
		inquiryDuplicateCase.notion as never,
	);

	assert.equal(duplicateResult.action, "existing-linked");
	assert.equal(duplicateResult.companyId, "company-duplicate-source");
	assert.equal(inquiryDuplicateCase.creates.length, 0);
	assert.ok(
		inquiryDuplicateCase.updates.some((update) => update.page_id === "inquiry-1"),
	);

	const companyA = companyPage("company-a", "重複防止テスト株式会社", {
		企業重複チェックキー: richTextProp("corp:other-a"),
		メールアドレス: emailProp("a@other-a.jp"),
		電話番号: phoneProp("0611111111"),
	});
	const companyB = companyPage("company-b", "重複防止テスト株式会社", {
		企業重複チェックキー: richTextProp("corp:other-b"),
		メールアドレス: emailProp("b@other-b.jp"),
		電話番号: phoneProp("0622222222"),
	});
	const multipleStrongCase = makeNotion({
		companyResults: [companyA, companyB],
		companiesById: {
			"company-a": companyA,
			"company-b": companyB,
		},
	});

	const multipleStrongResult = await processInquiryCompanyLinkForTest(
		{ inquiryPageId: "inquiry-1", dryRun: false },
		multipleStrongCase.notion as never,
	);

	assert.equal(multipleStrongResult.action, "duplicate-hold");
	assert.equal(multipleStrongResult.companyId, null);
	assert.equal(multipleStrongCase.creates.length, 0);
	assert.ok(
		multipleStrongCase.updates.some((update) => update.page_id === "inquiry-1"),
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
