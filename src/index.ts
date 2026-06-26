import { Worker, WebhookVerificationError } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";
import fontkit from "@pdf-lib/fontkit";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateInspectedShoutaBrief, type ShoutaInput } from "./shouta-brief";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
	evaluateLandTreasure,
	type LandTreasureEvaluation,
	type LandTreasureSubstationCandidate,
} from "./land-treasure-engine.js";
import { runHitomiEvalChain } from "./hitomi-eval-chain";

const worker = new Worker();
export default worker;

const googleGmailAuth = worker.oauth("googleGmailAuth", {
	name: "googleGmailAuth",
	authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
	tokenEndpoint: "https://oauth2.googleapis.com/token",
	scope: "https://www.googleapis.com/auth/gmail.modify",
	clientId: process.env.GOOGLE_CLIENT_ID ?? "",
	clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
	authorizationParams: {
		access_type: "offline",
		prompt: "consent",
	},
});

const BUSINESS_CARD_DATA_SOURCE_ID =
	process.env.BUSINESS_CARD_DATA_SOURCE_ID ??
	"0634132a-c6cf-458d-b63c-b357489f227e";
const INQUIRY_DATA_SOURCE_ID =
	process.env.INQUIRY_DATA_SOURCE_ID ??
	"0a7b4703-e62b-4e0d-9376-83cd370e69cd";
const COMPANY_DATA_SOURCE_ID =
	process.env.COMPANY_DATA_SOURCE_ID ??
	"7f394672-4f1e-4f01-ab6c-c98d29bd1f90";
const MEETING_PREP_REPORT_DATA_SOURCE_ID =
	process.env.MEETING_PREP_REPORT_DATA_SOURCE_ID ??
	"8db2bce8-66ab-428b-9fcb-4a36b9646922";
const LAND_DATA_SOURCE_ID =
	process.env.LAND_DATA_SOURCE_ID ??
	"3dbe3c77-2e50-4639-92aa-c0741904974b";
const DEAL_DATA_SOURCE_ID =
	process.env.DEAL_DATA_SOURCE_ID ??
	"7838db8a-907a-4c61-b062-109f8278b2c9";
const PROJECT_DATA_SOURCE_ID =
	process.env.PROJECT_DATA_SOURCE_ID ??
	"54e869d7-ba3e-49e1-b760-af46e23499cb";
const POWER_PLANT_EQUIPMENT_DATA_SOURCE_ID =
	process.env.POWER_PLANT_EQUIPMENT_DATA_SOURCE_ID ??
	"c326e9e7-e8ed-4918-b885-c5883dd3f35b";
const PROPOSAL_REQUEST_DATA_SOURCE_ID =
	process.env.PROPOSAL_REQUEST_DATA_SOURCE_ID ??
	"9701e891-ffd0-43d7-b6f9-911fedc65391";
const MEETING_DATA_SOURCE_ID =
	process.env.MEETING_DATA_SOURCE_ID ??
	"c22e58f6-42c9-4a2f-b24d-e65e889d59e9";
const MEETING_PRIMARY_TYPES = ["ミーティング", "商談"] as const;
type MeetingPrimaryType = (typeof MEETING_PRIMARY_TYPES)[number];
const KNOWLEDGE_MEETING_RELATION_ALIASES = ["元ミーティング", "元会議議事録"] as const;
const ACTIVITY_LOG_DATA_SOURCE_ID =
	process.env.ACTIVITY_LOG_DATA_SOURCE_ID ??
	"a58a107d-92e3-43f3-887d-5e3acf72e9ec";
const CUSTOMER_CONTACT_LOG_DATA_SOURCE_ID =
	process.env.CUSTOMER_CONTACT_LOG_DATA_SOURCE_ID ??
	"b65c13b4-1a72-4c58-8d2d-305c3e04a561";
const SPEECH_LOG_DATA_SOURCE_ID =
	process.env.SPEECH_LOG_DATA_SOURCE_ID ??
	"86f5693c-db36-4356-aec1-210495f6032a";
const SALES_CONTRIBUTION_LOG_DATA_SOURCE_ID =
	process.env.SALES_CONTRIBUTION_LOG_DATA_SOURCE_ID ??
	"f88056da-3052-418e-8cf4-e9b4197cd7ba";
const SPEECH_LOG_CATEGORY_OPTIONS = [
	"質問",
	"提案",
	"反論",
	"約束",
	"称賛",
	"指示",
	"クロージング",
	"報告",
	"その他",
] as const;
const SALES_CONTRIBUTION_TYPE_OPTIONS = [
	"ナレッジ採用",
	"勝ちトーク化",
	"案件共有",
	"他者支援",
	"チーム支援",
	"社外顧問紹介",
] as const;
const SALES_CONTRIBUTION_CATEGORY_OPTIONS = [
	"会議貢献",
	"ナレッジ共有",
	"後輩育成",
	"提案支援",
	"案件支援",
	"商談フォロー",
	"確認・調査",
	"その他",
] as const;
const CONTRIBUTION_IMPACT_OPTIONS = ["大", "中", "小"] as const;
const HITOMI_MEMO_DATA_SOURCE_ID =
	process.env.HITOMI_MEMO_DATA_SOURCE_ID ??
	"a1118ded-21b2-4636-94fb-a868aefb5168";
const WANIPO_MEMORY_DATA_SOURCE_ID =
	process.env.WANIPO_MEMORY_DATA_SOURCE_ID ??
	"b8b06036-4f7e-4efe-a242-2df47ff29b1e";
const AI_CONSULTATION_DATA_SOURCE_ID =
	process.env.AI_CONSULTATION_DATA_SOURCE_ID ??
	"28c78664-8b8c-419d-9488-ef991d60ab98";
const MANAGER_REVIEW_DATA_SOURCE_ID =
	process.env.MANAGER_REVIEW_DATA_SOURCE_ID ??
	"3574d017-81e7-8084-bbfb-000b9afc3ecc";
const SALES_PERFORMANCE_DATA_SOURCE_ID =
	process.env.SALES_PERFORMANCE_DATA_SOURCE_ID ??
	"e67ec5d5-90d3-4118-9788-976a6f5c94a1";
const MONTHLY_QUOTA_DATA_SOURCE_ID =
	process.env.MONTHLY_QUOTA_DATA_SOURCE_ID ??
	"27df8a65-4729-4600-bfc1-59bb1c460e73";
const TEAM_TRACKER_DATA_SOURCE_ID =
	process.env.TEAM_TRACKER_DATA_SOURCE_ID ??
	"3b44d017-81e7-82c9-9f2d-87004c53d722";
const STAFF_MASTER_DATA_SOURCE_ID =
	process.env.STAFF_MASTER_DATA_SOURCE_ID ??
	"f770bee6-fb52-46db-adc2-9bcca9e406e8";
const HITOMI_EVAL_WORKLOG_DATA_SOURCE_ID =
	process.env.HITOMI_EVAL_WORKLOG_DATA_SOURCE_ID ??
	"d78b8698-219b-451f-88c9-2992a39754ed";
const NEWS_DATA_SOURCE_ID =
	process.env.NEWS_DATA_SOURCE_ID ??
	"15273928-a119-4b42-8801-185f54e55c58";
const SALES_TALK_DATA_SOURCE_ID =
	process.env.SALES_TALK_DATA_SOURCE_ID ??
	"e0b4877f-ec35-46ee-a274-e4f926f2e622";
const KNOWLEDGE_DATA_SOURCE_ID =
	process.env.KNOWLEDGE_DATA_SOURCE_ID ??
	"8ffd91e0-2f44-4915-926a-d410bcb04e95";
const DAILY_REPORT_REQUEST_DATA_SOURCE_ID =
	process.env.DAILY_REPORT_REQUEST_DATA_SOURCE_ID ??
	"990cdd37-1217-4424-9a24-dadf64f9baa0";
const DAILY_REPORT_DATA_SOURCE_ID =
	process.env.DAILY_REPORT_DATA_SOURCE_ID ??
	"8f7489a5-47fe-4e0a-833b-ee21ab033ad5";
const DAILY_REPORT_LOG_DATA_SOURCE_ID =
	process.env.DAILY_REPORT_LOG_DATA_SOURCE_ID ??
	"86124854-998d-4e7f-8305-d768441de556";
const CLOSING_REPORT_DATA_SOURCE_ID =
	process.env.CLOSING_REPORT_DATA_SOURCE_ID ??
	"8d5a506b-59b8-4e50-bc77-d5412774048d";
const CLOSING_REPORT_TEMPLATE_ID = process.env.CLOSING_REPORT_TEMPLATE_ID;
const INQUIRY_TEMPLATE_ID =
	process.env.INQUIRY_TEMPLATE_ID ??
	"cda2757f-fc36-4ec8-9de6-53478196c7c5";
const PROJECT_TEMPLATE_ID =
	process.env.PROJECT_TEMPLATE_ID ??
	"0b9815a4-37c4-4e4c-90b6-1d54fd9664a3";
const PROJECT_COVER_FILE_UPLOAD_ID =
	process.env.PROJECT_COVER_FILE_UPLOAD_ID ??
	"3714d017-81e7-8185-8498-00b21fcffbe1";
const MEETING_TEMPLATE_ID =
	process.env.MEETING_TEMPLATE_ID ??
	"22adce6c-9249-4806-8f91-14fec2753fb1";
const DEAL_TEMPLATE_ID =
	process.env.DEAL_TEMPLATE_ID ??
	"e6bb4094-52c0-4fca-b6be-1230b467c781";
const AI_LEARNING_LOG_DATA_SOURCE_ID =
	process.env.AI_LEARNING_LOG_DATA_SOURCE_ID ??
	"0577bcac-f09d-42f6-98e4-84062956abba";
const SALES_TEAM_USER_IDS = (process.env.SALES_TEAM_USER_IDS ?? "")
	.split(",")
	.map((id) => id.trim())
	.filter(Boolean);
const GMAIL_INQUIRY_SOURCE_LABEL_NAME =
	process.env.GMAIL_INQUIRY_SOURCE_LABEL_NAME ?? "問い合わせ";
const GMAIL_INQUIRY_DONE_LABEL_NAME =
	process.env.GMAIL_INQUIRY_DONE_LABEL_NAME ?? "INQUIRY_DONE";
const GMAIL_INQUIRY_DEFAULT_QUERY =
	process.env.GMAIL_INQUIRY_DEFAULT_QUERY ?? "newer_than:7d";
const GMAIL_INQUIRY_REMOVE_SOURCE_LABEL =
	process.env.GMAIL_INQUIRY_REMOVE_SOURCE_LABEL !== "false";
const GMAIL_INQUIRY_POLL_LIMIT = Math.min(
	Math.max(Number.parseInt(process.env.GMAIL_INQUIRY_POLL_LIMIT ?? "10", 10) || 10, 1),
	50,
);

function currentPerplexityApiKey(): string | undefined {
	return process.env.PERPLEXITY_API_KEY;
}
// クオリティ優先(大ちゃん方針2026-06-11): 既定をsonar-proに(wajo-intel CLIと同格の深掘り品質)。
// コスト注意: sonarの3〜15倍/トークン。深掘り7呼び出し全部に効く。安いYes/No判定は個別にsonar指定。
// 本番環境変数 PERPLEXITY_MODEL が設定済みだとそちらが勝つ(デプロイ時に要確認)。
const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || "sonar-pro";

const WAJO_PLAYBOOK = [
	"和上ホールディングスの強み:",
	"- 太陽光・系統用蓄電池・発電所仲介(売買)の再エネ専門。太陽光建設実績 約800MW。",
	"- 提供価値: 自家消費型太陽光で電気代圧縮 / 系統用蓄電池・FIPで余剰を収益化 / 高圧・低圧両対応 / 投資回収シミュレーション / 発電所の売買仲介。",
	"- 刺さる相手の例: 工場・倉庫で電気代が原価を圧迫する企業 / 遊休地・屋根を持つ企業 / 脱炭素を取引先から要請される企業 / 売電中の発電所を売買したい事業者。",
	"- 営業の型: 相手の状況から課題仮説→和上の解決策を数字(電気代◯%減・回収□年・800MW実績)で接続→決裁者別(社長/財務/工場長)に言い換え→想定反論への切り返し。",
].join("\n");
const COMPANY_RESEARCH_SOURCE_SEPARATOR = " / ";
const COMPANY_RESEARCH_IN_FLIGHT_TTL_MINUTES = Number(
	process.env.COMPANY_RESEARCH_IN_FLIGHT_TTL_MINUTES || "10",
);
const companyResearchInflight = new Map<string, number>();

function isCompanyResearchInFlight(companyId: string, nowMs = Date.now()): boolean {
	const startedAt = companyResearchInflight.get(companyId);
	if (!startedAt) return false;
	const ttlMs = Math.max(COMPANY_RESEARCH_IN_FLIGHT_TTL_MINUTES, 1) * 60 * 1000;
	if (nowMs - startedAt > ttlMs) {
		companyResearchInflight.delete(companyId);
		return false;
	}
	return true;
}

export { isCompanyResearchInFlight as isCompanyResearchInFlightForTest };

// ─── ライン1: 名刺→企業 深掘りリサーチ ─────────────────────────────────────
function buildResearchQueries(input: {
	companyName: string;
	domain: string;
	address: string;
}): Array<{ aspect: string; prompt: string }> {
	const c = `会社名:${input.companyName} / ドメイン:${input.domain || "不明"} / 住所:${input.address || "不明"}`;
	const common =
		"日本語で、公開情報のみに基づき、各事実に出典URLを併記。公開情報で裏取りできない軸は推測で埋めず『【取れていない事実】X が未確認。【取れば取れる】Y があれば X を取得可能』形式で取得不能な情報源を明示する（例：『公式サイトURLがあれば事業内容を取得可能』『TDB企業コードがあれば財務・与信を取得可能』『LinkedIn URLがあれば代表者経歴を取得可能』）。";
	return [
		{
			aspect: "basic",
			prompt: `次の企業の基本情報(業種・事業内容・資本金・設立・従業員規模・売上規模・上場区分・本社所在地・公式サイト)を調べて。${c}。${common}`,
		},
		{
			aspect: "executives",
			prompt: `次の企業の代表者と主要役員(氏名・役職・経歴)を調べて。事業・経営に関する公開情報のみ。私生活は除外。${c}。${common}`,
		},
		{
			aspect: "executiveSns",
			prompt: `次の企業の代表・役員本人と見なせる公開SNS(X/note/Facebook/YouTube等。LinkedInは除外)で、事業・経営に関する発信があれば要約して。本人性の根拠とアカウントURLも。私生活は除外。${c}。${common}`,
		},
		{
			aspect: "officialSns",
			prompt: `次の企業の会社公式・採用・広報・サービス公式SNS（公式X・公式Facebook・YouTube・note等。LinkedInは除外）を確認し、アカウントURLと発信テーマを要約して。${c}。${common}`,
		},
		{
			aspect: "linkedinProfiles",
			prompt: `次の企業のLinkedIn会社ページ、代表者・役員・主要担当者のLinkedInプロフィールを確認し、URL、所属一致、本人性根拠のみを1〜2行で返して。採用ページや求人情報は含めない。${c}。${common}`,
		},
		{
			aspect: "recentNews",
			prompt: `次の企業の直近1-2年のニュース・プレスリリース・動向を日付つきで調べて。${c}。${common}`,
		},
		{
			aspect: "renewableSignals",
			prompt: `次の企業の、再生可能エネルギー(太陽光・蓄電池)との接点を調べて。工場/倉庫の有無、電力使用規模、遊休地・屋根、脱炭素方針、補助金交付歴など。${c}。${common}`,
		},
		{
			aspect: "jobSignals",
			prompt: `次の企業の採用情報、採用職種、採用件数、採用広報、再エネ関連の必要人材を公開求人や採用ページから要約して。${c}。`,
		},
		{
			aspect: "reviews",
			prompt: `次の企業の第三者口コミ（OpenWork/転職会議/Glassdoor系等）を確認し、外部評判の傾向（良い点・懸念点）を要約して。${c}。`,
		},
		{
			aspect: "decisionMaker",
			prompt: `次の企業で、太陽光/蓄電池導入の意思決定に関わりそうな決裁者・部門を推定して。${c}。${common}`,
		},
	];
}

export { buildResearchQueries as buildResearchQueriesForTest };

function fallbackDeepResearch(companyName: string): DeepResearch {
	const base = `${companyName}は、Perplexity公開情報の取得前段階。事実不足のため断定せず、初回ヒアリングで取りに行くべき軸を3段構造で列挙する。`;
	return {
		summary: base,
		currentIssue:
			`【取れていない事実】${companyName}固有の現在課題（事業内容・電力使用規模・脱炭素方針・設備保有）が未確認。【取れば取れる】公式サイトURLがあれば事業内容を、TDB企業コードがあれば財務・与信を、直近プレスがあれば設備投資方針を取得可能。【初回ヒアリングで取る】電気代の利益圧迫率・脱炭素要請の出処（取引先/規制/IR）・遊休地/屋根の保有有無。`,
		futureIssue:
			`【取れていない事実】${companyName}固有の中期論点が未確認。【取れば取れる】中期経営計画・IR資料があれば設備投資ロードマップを取得可能。【初回ヒアリングで取る】2-3年後の電力調達契約更新時期・設備更新計画・脱炭素対応の優先順位。`,
		salesAngle:
			"事実が揃ってから提案を組む前提。初回は『電力コスト負担割合』『脱炭素要請の出処』『遊休地/屋根の保有』『投資判断者』の4軸を5-10分で確認する。",
		fit:
			"事実不足のため断定しない。初回ヒアリング後、和上の太陽光発電所仲介・系統用蓄電池・EPC/O&M・売買仲介のうちどれが適合するかを判定する。",
		customerMarket3c:
			`【取れていない事実】${companyName}固有の顧客・市場接点が未確認。【取れば取れる】業種コード・取引先公開情報・売上規模があれば市場ポジションを取得可能。【初回ヒアリングで取る】主要販売先の業種・電力使用量の業界水準との差・脱炭素関連の取引先要請。`,
		competitor3c:
			`【取れていない事実】${companyName}固有の競合関係が未確認。【取れば取れる】業界の取引先・既存提案先公開情報があれば競合軸を特定可能。【初回ヒアリングで取る】他社見積もり/提案を受けているか・比較軸（価格/工期/施工実績/系統知見）。`,
		wajoRelation3c:
			"和上は太陽光800MW実績・売買仲介・EPC/O&M・系統用蓄電池を一気通貫で提供。事実確認後、相手の課題に応じて具体接点（数字・現場知見・他社事例）を組む。",
		source: "公開情報未取得。Perplexity呼出失敗または接続なし。初回ヒアリング後に充実させる。",
		closingPoint:
			`【取れていない事実】${companyName}固有の成約決め手（決裁構造・予算規模・競合状況・タイミング要因）が未確認。【取れば取れる】IR資料・組織図公開情報・直近プレスがあれば決裁者と投資判断時期を取得可能。【初回ヒアリングで取る】(1)意思決定者と承認プロセス（誰が最終GO/NOGO・予算上限）(2)検討時期（今・3ヶ月以内・年内・来期）(3)競合提案の有無と比較軸 (4)和上の800MW実績・売買仲介・EPC一気通貫のうちどの点が刺さるか を確認する。`,
		representative: "",
		executives: "",
		capital: "",
		founded: "",
		revenue: "",
		employees: "",
		industry: "",
		listingStatus: "",
		websiteUrl: "",
		xUrl: "",
		linkedinUrl: "",
		corporateNumber: "",
		executiveSns: "",
		officialSns: "",
		linkedinProfiles: "",
		jobSignals: "",
		reviews: "",
		recentNews: "",
		renewableSignals: "",
		decisionMaker: "",
		objections: "",
		officialSources: "",
		externalSources: "",
		citations: [],
		sourceType: "mixed",
	};
}

function extractCitations(response: { citations?: unknown }): string[] {
	if (!Array.isArray(response.citations)) return [];
	return response.citations.filter((c): c is string => typeof c === "string");
}

function normalizeDeepResearch(
	input: Partial<DeepResearch>,
	companyName: string,
): DeepResearch {
	const fb = fallbackDeepResearch(companyName);
	const pick = (v: unknown, d: string): string =>
		typeof v === "string" && v.trim() ? v : d;
	return {
		summary: pick(input.summary, fb.summary),
		currentIssue: pick(input.currentIssue, fb.currentIssue),
		futureIssue: pick(input.futureIssue, fb.futureIssue),
		salesAngle: pick(input.salesAngle, fb.salesAngle),
		fit: pick(input.fit, fb.fit),
		customerMarket3c: pick(input.customerMarket3c, fb.customerMarket3c),
		competitor3c: pick(input.competitor3c, fb.competitor3c),
		wajoRelation3c: pick(input.wajoRelation3c, fb.wajoRelation3c),
		source: pick(input.source, fb.source),
		closingPoint: pick(input.closingPoint, fb.closingPoint),
		representative: pick(input.representative, ""),
		executives: pick(input.executives, ""),
		capital: pick(input.capital, ""),
		founded: pick(input.founded, ""),
		revenue: pick(input.revenue, ""),
		employees: pick(input.employees, ""),
		industry: pick(input.industry, ""),
		listingStatus: pick(input.listingStatus, ""),
		websiteUrl: pick(input.websiteUrl, ""),
		xUrl: pick(input.xUrl, ""),
		linkedinUrl: pick(input.linkedinUrl, ""),
		corporateNumber: pick(input.corporateNumber, ""),
		executiveSns: pick(input.executiveSns, ""),
		officialSns: pick(input.officialSns, ""),
		linkedinProfiles: pick(input.linkedinProfiles, ""),
		jobSignals: pick(input.jobSignals, ""),
	reviews: pick(input.reviews, ""),
	recentNews: pick(input.recentNews, ""),
	renewableSignals: pick(input.renewableSignals, ""),
	decisionMaker: pick(input.decisionMaker, ""),
	objections: pick(input.objections, ""),
	officialSources: pick(input.officialSources, ""),
	externalSources: pick(input.externalSources, ""),
		citations: Array.isArray(input.citations)
			? input.citations.filter((c): c is string => typeof c === "string")
			: [],
		sourceType:
			input.sourceType === "official" || input.sourceType === "external"
				? input.sourceType
				: "mixed",
	};
}

export {
	extractCitations as extractCitationsForTest,
	fallbackDeepResearch as fallbackDeepResearchForTest,
	normalizeDeepResearch as normalizeDeepResearchForTest,
};

async function perplexityChat(
	messages: Array<{ role: string; content: string }>,
	modelOverride?: string,
): Promise<{ content: string; citations: string[] }> {
	const apiKey = currentPerplexityApiKey();
	if (!apiKey) throw new Error("PERPLEXITY_API_KEY が未設定です");
	const response = await fetch("https://api.perplexity.ai/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({ model: modelOverride || PERPLEXITY_MODEL, messages }),
	});
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Perplexity API error ${response.status}: ${errorText.slice(0, 200)}`,
		);
	}
	const json = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
		citations?: unknown;
	};
	const content = json.choices?.[0]?.message?.content ?? "";
	return { content, citations: extractCitations(json) };
}

function parseJsonLoose(raw: string): Partial<DeepResearch> {
	try {
		const match = raw.match(/\{[\s\S]*\}/);
		return match ? (JSON.parse(match[0]) as Partial<DeepResearch>) : {};
	} catch {
		return {};
	}
}

async function researchCompanyDeep(input: {
	companyName: string;
	domain: string;
	address: string;
}): Promise<DeepResearch> {
	if (!currentPerplexityApiKey()) return fallbackDeepResearch(input.companyName);
	try {
		const queries = buildResearchQueries(input);
		// 観点別に並列で事実収集（合計時間は最遅1本）
		const results = await Promise.all(
			queries.map(async (q) => {
				try {
					const r = await perplexityChat([{ role: "user", content: q.prompt }]);
					return { aspect: q.aspect, content: r.content, citations: r.citations };
				} catch (error) {
					console.log("perplexity aspect failed", q.aspect, String(error));
					return { aspect: q.aspect, content: "", citations: [] as string[] };
				}
			}),
		);
		const allCitations = Array.from(
			new Set(results.flatMap((r) => r.citations)),
		);
		const factsBlock = results
			.map((r) => `## ${r.aspect}\n${r.content}`)
			.join("\n\n");
		// 事実を和上プレイブックで営業仕様のJSONに統合
		const synth = await perplexityChat([
			{
				role: "system",
				content: `あなたは和上ホールディングスの営業企画。次のプレイブックに沿って、収集事実だけを根拠に企業ドシエJSONを作る。事実が不足する軸は推測で埋めず『【取れていない事実】X が未確認。【取れば取れる】Y があれば X を取得可能。【初回ヒアリングで取る】Z』の3段構造で明示する。\n${WAJO_PLAYBOOK}`,
			},
			{
				role: "user",
				content: `=== 収集事実 ===\n${factsBlock.slice(0, 12000)}\n\n会社名:${input.companyName}\n\n次のJSONキーのみで返す(値は日本語文字列): summary,currentIssue,futureIssue,salesAngle,fit,customerMarket3c,competitor3c,wajoRelation3c,source,closingPoint,representative,executives,capital,founded,revenue,employees,industry,listingStatus,websiteUrl,xUrl,linkedinUrl,linkedinProfiles,corporateNumber,executiveSns,officialSns,jobSignals,reviews,recentNews,renewableSignals,decisionMaker,objections,officialSources,externalSources,sourceType\n\nclosingPoint は成約までの決め手を3段構造で明示する：『【取れていない事実】X が未確認。【取れば取れる】Y があれば X を取得可能。【初回ヒアリングで取る】(1)意思決定者と承認プロセス (2)検討時期 (3)競合提案と比較軸 (4)和上のどの点が刺さるか』。`,
			},
		]);
		const parsed = parseJsonLoose(synth.content);
		const research = normalizeDeepResearch(parsed, input.companyName);
		research.citations = allCitations;
		return research;
	} catch (error) {
		console.log("researchCompanyDeep failed", String(error));
		return fallbackDeepResearch(input.companyName);
	}
}

function scoreCompany(tdb: TdbProfile | null): CreditScore {
	if (!tdb || tdb.企業評点 === null) {
		return {
			信頼度: "中",
			提案可否: "タイミング待ち",
			根拠:
				"TDB与信が未取得のため暫定判定。Perplexity公開情報ベース。TDB取得後に再評価する。",
		};
	}
	const 評点 = tdb.企業評点;
	const 倒産 = tdb.倒産確率Pct;
	let 信頼度: CreditScore["信頼度"];
	let 提案可否: CreditScore["提案可否"];
	if (評点 >= 51) {
		信頼度 = "高";
		提案可否 = "提案可能";
	} else if (評点 >= 41) {
		信頼度 = "中";
		提案可否 = "提案可能";
	} else if (評点 >= 36) {
		信頼度 = "中";
		提案可否 = "タイミング待ち";
	} else {
		信頼度 = "低";
		提案可否 = "提案不可";
	}
	// 倒産確率が高ければ提案可否を抑制
	if (倒産 !== null && 倒産 >= 10 && 提案可否 === "提案可能")
		提案可否 = "タイミング待ち";
	if (倒産 !== null && 倒産 >= 30) {
		提案可否 = "提案不可";
		信頼度 = "低";
	}
	return {
		信頼度,
		提案可否,
		根拠: `TDB評点${評点}${倒産 !== null ? `・倒産確率${倒産}%` : ""}に基づく自動判定。`,
	};
}

export { scoreCompany as scoreCompanyForTest };

// 既存値(手入力)があれば壊さない。existingは企業マスターの読み取り値の部分集合。
function mergeDeepResearch(
	existing: Partial<DeepResearch>,
	research: DeepResearch,
): DeepResearch {
	const keep = (e: unknown, r: string): string =>
		typeof e === "string" && e.trim() ? e : r;
	return {
		summary: keep(existing.summary, research.summary),
		currentIssue: keep(existing.currentIssue, research.currentIssue),
		futureIssue: keep(existing.futureIssue, research.futureIssue),
		salesAngle: keep(existing.salesAngle, research.salesAngle),
		fit: keep(existing.fit, research.fit),
		customerMarket3c: keep(existing.customerMarket3c, research.customerMarket3c),
		competitor3c: keep(existing.competitor3c, research.competitor3c),
		wajoRelation3c: keep(existing.wajoRelation3c, research.wajoRelation3c),
		source: keep(existing.source, research.source),
		closingPoint: keep(existing.closingPoint, research.closingPoint),
		representative: keep(existing.representative, research.representative),
		executives: keep(existing.executives, research.executives),
		capital: keep(existing.capital, research.capital),
		founded: keep(existing.founded, research.founded),
		revenue: keep(existing.revenue, research.revenue),
		employees: keep(existing.employees, research.employees),
		industry: keep(existing.industry, research.industry),
		listingStatus: keep(existing.listingStatus, research.listingStatus),
		websiteUrl: keep(existing.websiteUrl, research.websiteUrl),
		xUrl: keep(existing.xUrl, research.xUrl),
		linkedinUrl: keep(existing.linkedinUrl, research.linkedinUrl),
		corporateNumber: keep(existing.corporateNumber, research.corporateNumber),
		executiveSns: keep(existing.executiveSns, research.executiveSns),
		officialSns: keep(existing.officialSns, research.officialSns),
		linkedinProfiles: keep(existing.linkedinProfiles, research.linkedinProfiles),
		jobSignals: keep(existing.jobSignals, research.jobSignals),
		reviews: keep(existing.reviews, research.reviews),
		recentNews: keep(existing.recentNews, research.recentNews),
		renewableSignals: keep(existing.renewableSignals, research.renewableSignals),
		decisionMaker: keep(existing.decisionMaker, research.decisionMaker),
		objections: keep(existing.objections, research.objections),
		officialSources: keep(existing.officialSources, research.officialSources),
		externalSources: keep(existing.externalSources, research.externalSources),
		citations: research.citations,
		sourceType: research.sourceType,
	};
}

function isDeepResearchComplete(r: DeepResearch): boolean {
	return [
		r.summary,
		r.currentIssue,
		r.futureIssue,
		r.salesAngle,
		r.fit,
		r.customerMarket3c,
		r.competitor3c,
		r.wajoRelation3c,
		r.source,
		r.closingPoint,
	].every((v) => v.trim().length > 0);
}

export {
	mergeDeepResearch as mergeDeepResearchForTest,
	isDeepResearchComplete as isDeepResearchCompleteForTest,
};

// TDB取得部品(会社Mac mini上のPlaywrightサービス)をHTTPで叩く。
// TDB_FETCHER_URL 未設定なら null=従来通り暫定与信にフォールバック(本番に影響ゼロ)。
// I/F契約: docs/superpowers/specs/2026-06-07-tdb-fetcher-interface.md
async function fetchTdbProfile(
	company: CompanyInfo,
	options?: { purchase?: boolean },
): Promise<TdbProfile | null> {
	const url = process.env.TDB_FETCHER_URL?.trim();
	if (!url) return null;
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${process.env.TDB_FETCHER_TOKEN ?? ""}`,
			},
			body: JSON.stringify({
				企業名: company.name,
				ヒント: { website: company.website, 住所: company.address },
				// 課金の二重キー: 取得部品側の TDB_ALLOW_PURCHASE=1 と、このリクエスト単位の
				// 購入許可が両方trueの時だけ帳票を購入する。A(企業評価実行)からは渡さない=常に無料。
				購入許可: options?.purchase === true,
			}),
		});
		if (!res.ok) return null;
		const data: unknown = await res.json();
		return normalizeTdbProfile(data);
	} catch {
		return null; // 取得部品が落ちていても本体リサーチは止めない
	}
}

// 与信取得(課金)の権限ゲート。MANAGER_USER_IDS(カンマ区切りNotionユーザーID)に
// 含まれる人だけ許可。未設定なら全員拒否=設定するまで課金ボタンは動かない(安全側)。
function isManagerUser(userId: string | undefined): boolean {
	const norm = (s: string) => s.trim().toLowerCase().replace(/-/g, "");
	const ids = (process.env.MANAGER_USER_IDS ?? "")
		.split(",")
		.map(norm)
		.filter(Boolean);
	if (ids.length === 0 || !userId) return false;
	return ids.includes(norm(userId));
}
export { isManagerUser as isManagerUserForTest };

// 承認系webhook(マネージャー用ボタン)の権限ゲート。二段ロケット方式:
// - APPROVAL_GATE_MODE=enforce のときだけ非マネージャーを遮断する
// - それ以外(未設定/monitor) は遮断せず通すが、wouldBlock をログに残す
//   (Notionボタンが実行者IDを実際に送るかは実機未証明のため、まず観測してから enforce に切替)
// 戻り値 true=本処理を続行してよい / false=遮断済み(案内コメントは残した)。
const APPROVAL_GATE_BLOCK_MESSAGE =
	"この操作はマネージャーのみ実行できます。MANAGER_USER_IDS に登録されたユーザーでボタンを押してください。";

async function checkManagerApprovalGate(
	handlerName: string,
	body: Record<string, unknown>,
	pageId: string,
	notion: NotionClient,
): Promise<boolean> {
	const mode =
		(process.env.APPROVAL_GATE_MODE ?? "").trim().toLowerCase() === "enforce"
			? "enforce"
			: "monitor";
	if (mode !== "enforce") {
		// 防御(検品指摘): monitorは観測専用なので、ゲート自身の不具合(payload解析の例外等)で
		// 現役の業務ボタン5本を巻き込まないよう経路全体をtry/catchし、例外時もログだけ残して必ず通す。
		try {
			const userId = extractTriggerUserIdFromWebhook(body);
			const wouldBlock = !isManagerUser(userId);
			console.log(
				`approval-gate monitor: handler=${handlerName} userId=${userId ?? "なし"} wouldBlock=${wouldBlock}`,
			);
		} catch (error) {
			console.log(
				`approval-gate monitor error(通過させる): handler=${handlerName} error=${String(error)}`,
			);
		}
		return true;
	}
	const userId = extractTriggerUserIdFromWebhook(body);
	if (isManagerUser(userId)) return true;
	// enforce遮断: 黙って失敗させず、対象ページへ既存ハンドラと同じ手段(コメント)で案内を残す。
	// createPageComment は内部でエラーを握りつぶすため、コメント失敗でも遮断自体は成立する。
	console.log(
		`approval-gate enforce: handler=${handlerName} userId=${userId ?? "なし"} blocked=true`,
	);
	await createPageComment(notion, pageId, `⛔ ${APPROVAL_GATE_BLOCK_MESSAGE}`);
	return false;
}
export { checkManagerApprovalGate as checkManagerApprovalGateForTest };

// ─── 正本スタンプ(チェックリスト1-2/1-3) ────────────────────────────────────
// 「承認/成約が正規ルート(Worker)を通った」事実を、Workerだけが書く1列に集約して残す。
// 列名は環境変数で差し替え可能。**列はまだNotionに存在しない(新列作成は大ちゃん承認待ち)**。
// 書き込みは safeUpdateExistingProperties 経由なので、列が無い間は何も書かれない=安全な
// スケルトン。大ちゃんがNotion UIでtext列を作った瞬間から自動で記録が始まる。
const CLOSING_APPROVAL_STAMP_PROPERTY =
	process.env.CLOSING_APPROVAL_STAMP_PROPERTY ?? "承認スタンプ🤖";

// スタンプ書式: `承認者ID|ISO日時|操作|コミット` の1行。改ざん検知formulaは
// 「生select=承認済/成約 なのにこの列が空」を🚨にする(列そのものの偽造は権限ロックが本丸)。
function buildApprovalStamp(
	operation: string,
	userId: string | undefined,
	nowIso = new Date().toISOString(),
): string {
	const rev =
		(process.env.WORKER_GIT_COMMIT ?? "").trim().slice(0, 12) || "rev不明";
	return `${userId ?? "ユーザー不明"}|${nowIso}|${operation}|${rev}`;
}
export { buildApprovalStamp as buildApprovalStampForTest };

// 成約報告の状態読み取り。旧「承認ステータス」selectはNotion側で
// 「退役｜承認ステータス（使用禁止）」へリネーム済み(2026-06-11棚卸しで実機確認済みの実機名)。
// 旧名しか見ないと取り消し/差戻し済みの判定が全て素通りするため、両方の名前を読む。
// ※読み取り専用フォールバック。退役列への書き込みは行わない。
function readClosingApprovalStatusText(
	properties: Record<string, unknown> | undefined,
): string {
	return (
		text(properties?.["承認ステータス"]) ||
		text(properties?.["退役｜承認ステータス（使用禁止）"])
	);
}
export { readClosingApprovalStatusText as readClosingApprovalStatusTextForTest };

// 実行中ロック(検品指摘③): TDB取得はPlaywrightで数十秒かかるため、その間の再押し/
// 重複配送で二重課金しないよう、企業AI受付メモの「TDB取得中 <ISO分>」マーカーを見る。
// ttl分以内のマーカーがあり、その後に完了/失敗の記録が無ければ「実行中」と判定(純関数)。
function isCreditCheckInFlight(
	memo: string,
	nowIso: string,
	ttlMinutes: number,
): boolean {
	const re = /TDB取得中 (\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/g;
	let last: { index: number; ts: string } | null = null;
	for (const m of memo.matchAll(re)) {
		last = { index: m.index ?? 0, ts: m[1] ?? "" };
	}
	if (!last) return false;
	const done = Math.max(
		memo.lastIndexOf("TDB確報与信を取得"),
		memo.lastIndexOf("TDB与信取得に失敗"),
	);
	if (done > last.index) return false;
	const started = Date.parse(`${last.ts}:00Z`);
	const now = Date.parse(nowIso);
	if (!Number.isFinite(started) || !Number.isFinite(now)) return false;
	const ageMinutes = (now - started) / 60000;
	return ageMinutes >= 0 && ageMinutes <= ttlMinutes;
}
export { isCreditCheckInFlight as isCreditCheckInFlightForTest };

// 二重課金ロック: 既存のTDB調査年月日が refreshDays 以内なら再購入しない(純関数)。
// 日付が読めない/無い場合は false=購入対象。
function isTdbSurveyFresh(
	surveyDateIso: string,
	nowIso: string,
	refreshDays: number,
): boolean {
	const survey = Date.parse(surveyDateIso);
	const now = Date.parse(nowIso);
	if (!Number.isFinite(survey) || !Number.isFinite(now)) return false;
	const ageDays = (now - survey) / (24 * 60 * 60 * 1000);
	return ageDays >= 0 && ageDays <= refreshDays;
}
export { isTdbSurveyFresh as isTdbSurveyFreshForTest };

// 取得部品の生JSONを TdbProfile に正規化・検証する純関数。
// status!=="found"や非オブジェクトはnull。評点/倒産確率は数値以外をnullに丸め、
// 文字項目はtrimして欠損は空文字(評点が壊れていても他の事実は捨てない)。
function normalizeTdbProfile(data: unknown): TdbProfile | null {
	if (typeof data !== "object" || data === null) return null;
	const d = data as Record<string, unknown>;
	if (d.status !== "found") return null;
	const num = (v: unknown): number | null =>
		typeof v === "number" && Number.isFinite(v) ? v : null;
	const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
	return {
		企業評点: num(d.企業評点),
		倒産確率Pct: num(d.倒産確率Pct),
		年商: str(d.年商),
		資本金: str(d.資本金),
		従業員数: str(d.従業員数),
		設立: str(d.設立),
		業種: str(d.業種),
		代表者: str(d.代表者),
		法人番号: str(d.法人番号),
		調査年月日: str(d.調査年月日),
		raw: str(d.raw),
	};
}

export {
	fetchTdbProfile as fetchTdbProfileForTest,
	normalizeTdbProfile as normalizeTdbProfileForTest,
};

// 短い事実列(代表者/資本金/設立年月/売上規模/従業員規模/業種)を営業がそのまま読める
// ベタ値にする。出典番号[1][3]/【1】/［１］と末尾の丁寧語「です。」を落とす。
// 文章列(3C/サマリー/直近ニュース等)には使わない=出典を残す。
function cleanStructuredFact(value: string): string {
	if (!value) return "";
	const out = value
		.replace(/\s*[\[【［]\s*[0-9０-９]+(?:\s*[,，、]\s*[0-9０-９]+)*\s*[\]】］]/g, "")
		.replace(/[ \t　]{2,}/g, " ")
		.trim();
	return out.replace(/(?:です。|です|。)\s*$/, "").trim();
}
export { cleanStructuredFact as cleanStructuredFactForTest };

// 短い事実列の書き込み: 空欄なら新値(クリーニング済)を入れる。
// 既存値が旧コードの書き残しで汚れている(出典番号[1][3]/末尾「です。」付き)場合は、
// 事実の中身は変えずノイズだけ落とした値に修復する。
// きれいな既存値(手入力含む)には触らない=非破壊マージの精神を守る。
function addStructuredFactPatch(
	patches: Record<string, SafePatch>,
	properties: Record<string, unknown>,
	propertyName: string,
	value: string,
): void {
	const existing = text(properties[propertyName]).trim();
	if (existing) {
		const repaired = cleanStructuredFact(existing);
		if (repaired && repaired !== existing) {
			patches[propertyName] = { kind: "text", value: repaired };
		}
		return;
	}
	const cleaned = cleanStructuredFact(value);
	if (!cleaned) return;
	patches[propertyName] = { kind: "text", value: cleaned };
}
export { addStructuredFactPatch as addStructuredFactPatchForTest };

function tdbToPatches(tdb: TdbProfile): Record<string, SafePatch> {
	const patches: Record<string, SafePatch> = {};
	const addText = (key: string, value: string) => {
		if (value && value.trim()) patches[key] = { kind: "text", value };
	};
	addText("資本金", tdb.資本金);
	addText("設立年月", tdb.設立);
	addText("売上規模", tdb.年商);
	addText("従業員規模", tdb.従業員数);
	addText("業種", tdb.業種);
	addText("代表者", tdb.代表者);
	addText("法人番号（TDB）", tdb.法人番号);
	if (tdb.調査年月日 && tdb.調査年月日.trim())
		patches["TDB調査年月日"] = { kind: "date", value: tdb.調査年月日 };
	return patches;
}

export { tdbToPatches as tdbToPatchesForTest };

// ── ドシエの「紙面」ビルダー(2026-06-11 大ちゃん指摘=継ぎ接ぎ表示の解消) ──
// 素の段落の羅列をやめ、コールアウト/表組み/区切り線/折りたたみで新聞の紙面のように組む。
// 先頭のheading_1「…商談ドシエ」は旧ドシエ置き換え検出(dossierBlockIdsToReplace)の鍵なので変えない。
function buildDossierBlocks(
	companyName: string,
	r: DeepResearch,
	score: CreditScore,
): Array<Record<string, unknown>> {
	const blocks: Array<Record<string, unknown>> = [];
	const section = (h: string, body: string) => {
		if (!body || !body.trim()) return;
		blocks.push(headingBlock(h, 2));
		for (const para of body.split("\n").map((s) => s.trim()).filter(Boolean)) {
			blocks.push(paragraphBlock(para));
		}
	};

	blocks.push(headingBlock(`${companyName} 商談ドシエ`, 1));
	const scoreColor =
		score.信頼度 === "高"
			? "green_background"
			: score.信頼度 === "低"
				? "red_background"
				: "yellow_background";
	blocks.push(
		calloutBlock(
			`与信判定: 信頼度 ${score.信頼度} ／ 提案可否 ${score.提案可否}\n${score.根拠}`,
			"🛡️",
			scoreColor,
		),
	);

	// 第1面: 会社の素顔
	section("会社概要", r.summary);
	const facts: Array<[string, string]> = (
		[
			["業種", r.industry],
			["資本金", r.capital],
			["売上", r.revenue],
			["従業員", r.employees],
			["設立", r.founded],
			["上場", r.listingStatus],
			["代表者", r.representative],
		] as Array<[string, string]>
	).filter((row) => Boolean(row[1] && row[1].trim()));
	if (facts.length > 0) {
		blocks.push(headingBlock("基本情報", 2));
		blocks.push(tableBlock(facts));
	}
	section("経営陣・キーパーソン", r.executives);
	section("役員・会社のSNS発信", r.executiveSns);

	// 第2面: いま動いている信号
	blocks.push(dividerBlock());
	section("直近の動き", r.recentNews);
	section("再エネ/蓄電池の接点", r.renewableSignals);
	section("現在の課題仮説", r.currentIssue);
	section("将来の課題仮説", r.futureIssue);

	// 第3面: 3C分析
	blocks.push(dividerBlock());
	section("3C：顧客・市場", r.customerMarket3c);
	section("3C：競合", r.competitor3c);
	section("3C：和上との関係性", r.wajoRelation3c);

	// 第4面: 攻め方
	blocks.push(dividerBlock());
	section("営業切り口", r.salesAngle);
	section("和上解決策の適合", r.fit);
	section("想定決裁者", r.decisionMaker);
	section("想定反論・切り返し", r.objections);

	// 出典は折りたたみ(普段は1行・開けば全部)
	if (r.citations.length > 0) {
		blocks.push(dividerBlock());
		blocks.push(
			toggleBlock(
				`出典（${r.citations.length}件・クリックで展開）`,
				r.citations.slice(0, 80),
			),
		);
	}
	return blocks;
}
export { buildDossierBlocks as buildDossierBlocksForTest };

// 旧ドシエ区画の特定(純関数・オフラインでテスト可能)。
// ドシエはページ末尾に追記される運用のため、最初の「…商談ドシエ」heading_1から
// 末尾までを旧ドシエ(と過去の複製)とみなして置き換え対象にする。
// ドシエ見出しより前のユーザーコンテンツには触らない。見出しが無ければ何も消さない。
function dossierBlockIdsToReplace(
	blocks: Array<{ id: string; type: string; text: string }>,
): string[] {
	const start = blocks.findIndex(
		(b) => b.type === "heading_1" && b.text.trim().endsWith("商談ドシエ"),
	);
	if (start === -1) return [];
	return blocks
		.slice(start)
		.map((b) => b.id)
		.filter((id) => id.length > 0);
}
export { dossierBlockIdsToReplace as dossierBlockIdsToReplaceForTest };

// 既存ドシエをアーカイブし、再実行で本文が複製しないようにする。
// blocks.update が使えない環境では従来通り追記のみ(安全側・クラッシュさせない)。
async function archiveExistingDossierBlocks(
	notion: NotionClient,
	pageId: string,
): Promise<void> {
	const list = notion.blocks?.children?.list;
	const update = notion.blocks?.update;
	if (!list || !update) return;
	const summaries: Array<{ id: string; type: string; text: string }> = [];
	let startCursor: string | null | undefined;
	for (let i = 0; i < 10; i += 1) {
		const response = await list({
			block_id: pageId,
			page_size: 100,
			start_cursor: startCursor,
		});
		for (const block of response.results) {
			summaries.push({
				id: typeof block.id === "string" ? block.id : "",
				type: typeof block.type === "string" ? block.type : "",
				text: blockPlainText(block),
			});
		}
		if (!response.has_more || !response.next_cursor) break;
		startCursor = response.next_cursor;
	}
	for (const blockId of dossierBlockIdsToReplace(summaries)) {
		try {
			await update({ block_id: blockId, archived: true });
		} catch (error) {
			// 既に消えている等の単発失敗で新ドシエの追記まで止めない(検品レビュー指摘2c)
			console.log("dossier archive skipped", blockId, String(error).slice(0, 120));
		}
	}
}

// 専用ページ(商談準備レポート等)の本文を全アーカイブ(再生成時の重ね書き防止)。
// 本文は全てWorker生成物である前提のページにだけ使うこと。
async function archiveAllPageBodyBlocks(
	notion: NotionClient,
	pageId: string,
): Promise<void> {
	const list = notion.blocks?.children?.list;
	const update = notion.blocks?.update;
	if (!list || !update) return;
	const ids: string[] = [];
	let startCursor: string | null | undefined;
	for (let i = 0; i < 10; i += 1) {
		const response = await list({
			block_id: pageId,
			page_size: 100,
			start_cursor: startCursor,
		});
		for (const block of response.results) {
			if (typeof block.id === "string" && block.id) ids.push(block.id);
		}
		if (!response.has_more || !response.next_cursor) break;
		startCursor = response.next_cursor;
	}
	for (const blockId of ids) {
		try {
			await update({ block_id: blockId, archived: true });
		} catch (error) {
			console.log("report body archive skipped", blockId, String(error).slice(0, 120));
		}
	}
}

// 旧ドシエをアーカイブして、紙面ブロック(コールアウト/表/区切り/折りたたみ)を追記する。
async function appendCompanyDossierBlocks(
	notion: NotionClient,
	pageId: string,
	blocks: Array<Record<string, unknown>>,
): Promise<void> {
	if (!notion.blocks?.children?.append) return;
	await archiveExistingDossierBlocks(notion, pageId);
	for (let i = 0; i < blocks.length; i += 90) {
		await notion.blocks.children.append({
			block_id: pageId,
			children: blocks.slice(i, i + 90),
		});
	}
}

// 整合性ガード: 現実的でない/矛盾した商談相手を深掘り前に弾く（無料・決定論）
const DEFAULT_TARGET_BLOCKLIST = [
	"政府",
	"government",
	"省庁",
	"行政機関",
	"大統領",
	"首相",
	"国会",
	"trump",
	"トランプ",
	"ntt",
];

function targetBlocklist(): string[] {
	const extra = (process.env.WAJO_RESEARCH_BLOCKLIST ?? "")
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	return [...DEFAULT_TARGET_BLOCKLIST, ...extra];
}

function validateResearchTarget(companyName: string): {
	ok: boolean;
	reason: string;
} {
	const name = companyName.trim();
	if (!name) return { ok: false, reason: "企業名が空のため調査できません。" };
	const lower = name.toLowerCase();
	if (name.includes("和上") || lower.includes("wajo")) {
		return {
			ok: false,
			reason: "自社（和上ホールディングス）を商談相手にはできません（論理矛盾）。",
		};
	}
	for (const kw of targetBlocklist()) {
		if (lower.includes(kw)) {
			return {
				ok: false,
				reason: `「${kw}」を含むため、現実的な商談相手でないと判断しました。誤りなら手動で調査してください。`,
			};
		}
	}
	return { ok: true, reason: "" };
}

export { validateResearchTarget as validateResearchTargetForTest };

// 整合性ガード(AI層): グレーな相手の妥当性を安価に判定。失敗時は通す(誤ブロック防止)。
async function assessTargetPlausibility(
	companyName: string,
): Promise<{ realistic: boolean; reason: string }> {
	if (!currentPerplexityApiKey()) return { realistic: true, reason: "" };
	try {
		// このガードはYes/No判定だけ=安いsonarで十分(sonar-pro既定化の対象外・検品レビュー反映)
		const r = await perplexityChat(
			[
				{
					role: "system",
					content:
						"あなたは日本の再エネ中小企業『和上ホールディングス』の営業審査担当。相手が太陽光/蓄電池の現実的な商談相手かを判定する。自社・各国政府・著名公人・非現実的な超巨大組織など商談がおよそ成立しない相手はrealistic=false。JSONのみで返す。",
				},
				{
					role: "user",
					content: `相手:「${companyName}」。{"realistic":true/false,"reason":"日本語で短く"} だけ返す。`,
				},
			],
			"sonar",
		);
		let parsed: { realistic?: unknown; reason?: unknown } = {};
		const m = r.content.match(/\{[\s\S]*\}/);
		if (m) parsed = JSON.parse(m[0]) as { realistic?: unknown; reason?: unknown };
		if (typeof parsed.realistic === "boolean") {
			return {
				realistic: parsed.realistic,
				reason: typeof parsed.reason === "string" ? parsed.reason : "",
			};
		}
		return { realistic: true, reason: "" };
	} catch (error) {
		console.log("assessTargetPlausibility failed", String(error));
		return { realistic: true, reason: "" };
	}
}

const MAX_PENDING_LIMIT = 10;
const companyResearchInFlight = new Set<string>();
const DEFAULT_SALES_NEWS_KEYWORDS = [
	"系統用蓄電池",
	"蓄電池 補助金",
	"蓄電池 系統接続",
	"再生可能エネルギー 制度改正",
	"太陽光発電 FIP FIT",
	"発電所 売買 太陽光",
	"電力市場 容量市場",
	"PPA 再生可能エネルギー",
	"低圧 太陽光 発電所",
	"脱炭素 電力 法人",
];

const PROPOSAL_PDF_FILE_PROPERTY_ALIASES = [
	"提案シミュレーションPDF",
	"提案PDF",
	"シミュレーションPDF",
	"提案書PDF",
	"PDFファイル",
];

const PROPOSAL_PDF_URL_PROPERTY_ALIASES = [
	"提案PDFリンク",
	"提案PDF URL",
	"シミュレーションPDF URL",
	"提案書URL",
	"PDF URL",
];

type NotionClient = {
	dataSources: {
		query: (args: Record<string, unknown>) => Promise<QueryResponse>;
	};
	pages: {
		create: (args: Record<string, unknown>) => Promise<Page>;
		retrieve: (args: Record<string, unknown>) => Promise<Page>;
		retrieveMarkdown?: (args: Record<string, unknown>) => Promise<{ markdown?: string }>;
		update: (args: Record<string, unknown>) => Promise<Page>;
		updateMarkdown?: (args: Record<string, unknown>) => Promise<unknown>;
	};
	fileUploads?: {
		create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
		send: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
		complete?: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
		retrieve?: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
	};
	blocks?: {
		children: {
			list: (args: Record<string, unknown>) => Promise<{
				results: Array<Record<string, unknown>>;
				has_more?: boolean;
				next_cursor?: string | null;
			}>;
			append: (args: Record<string, unknown>) => Promise<unknown>;
		};
		update?: (args: Record<string, unknown>) => Promise<unknown>;
	};
	comments?: {
		create: (args: Record<string, unknown>) => Promise<unknown>;
	};
};

type QueryResponse = {
	results: Page[];
	has_more?: boolean;
	next_cursor?: string | null;
};

type Page = {
	id: string;
	url?: string;
	properties?: Record<string, unknown>;
};

type MonthlyEvalPdfSnapshot = {
	pageId: string;
	evaluationName: string;
	salesPersonName: string;
	targetMonth: string;
	closedAt: string;
	evaluationStatus: string;
	statusStamp: "集計中" | "確定";
	quantitativeScore: number;
	qualitativeScore: number;
	totalScore: number;
	rank: string;
	kpis: Array<{ label: string; value: string; hint?: string }>;
	activities: Array<{ label: string; value: string }>;
	memoSections: Array<{ title: string; body: string }>;
	commentSections: Array<{ title: string; body: string }>;
};

type MonthlyEvalPdfFonts = {
	regular: PDFFont;
	bold: PDFFont;
};

type MonthlyEvalPdfFontPaths = {
	regular: string;
	bold: string;
};

type MonthlyEvalPdfAttachResult = {
	action: "attached";
	pageId: string;
	fileName: string;
	fileUploadId: string;
	message: string;
};

const MONTHLY_EVAL_PDF_PAGE_WIDTH = 595.28;
const MONTHLY_EVAL_PDF_PAGE_HEIGHT = 841.89;
const MONTHLY_EVAL_BUNDLED_JAPANESE_FONT_DIRS = [
	join(process.cwd(), "dist", "assets", "fonts"),
	join(process.cwd(), "assets", "fonts"),
	join(__dirname, "assets", "fonts"),
	join(__dirname, "..", "assets", "fonts"),
];
const MONTHLY_EVAL_BUNDLED_REGULAR_FONT_CANDIDATES =
	MONTHLY_EVAL_BUNDLED_JAPANESE_FONT_DIRS.map((dir) => join(dir, "NotoSansJP-Subset-Regular.otf"));
const MONTHLY_EVAL_BUNDLED_BOLD_FONT_CANDIDATES =
	MONTHLY_EVAL_BUNDLED_JAPANESE_FONT_DIRS.map((dir) => join(dir, "NotoSansJP-Subset-Bold.otf"));
const MONTHLY_EVAL_MACOS_JAPANESE_FONT_CANDIDATES = [
	"/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
	"/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
	"/System/Library/Fonts/ヒラギノ角ゴシック W5.ttc",
	"/System/Library/Fonts/AppleSDGothicNeo.ttc",
	"/System/Library/Fonts/Hiragino Sans GB.ttc",
];
const MONTHLY_EVAL_JAPANESE_REGULAR_FONT_CANDIDATES = [
	process.env.WAJO_PDF_JAPANESE_FONT_PATH ?? "",
	...MONTHLY_EVAL_BUNDLED_REGULAR_FONT_CANDIDATES,
	...MONTHLY_EVAL_MACOS_JAPANESE_FONT_CANDIDATES,
].filter(Boolean);
const MONTHLY_EVAL_JAPANESE_BOLD_FONT_CANDIDATES = [
	process.env.WAJO_PDF_JAPANESE_FONT_PATH ?? "",
	...MONTHLY_EVAL_BUNDLED_BOLD_FONT_CANDIDATES,
	...MONTHLY_EVAL_BUNDLED_REGULAR_FONT_CANDIDATES,
	...MONTHLY_EVAL_MACOS_JAPANESE_FONT_CANDIDATES,
].filter(Boolean);

const MONTHLY_EVAL_COLORS = {
	bg: rgb(0.043, 0.043, 0.078),
	panel: rgb(0.075, 0.075, 0.122),
	panelSoft: rgb(0.102, 0.102, 0.169),
	line: rgb(0.149, 0.149, 0.227),
	text: rgb(0.957, 0.957, 0.973),
	muted: rgb(0.541, 0.541, 0.639),
	violet: rgb(0.486, 0.361, 1),
	cyan: rgb(0.133, 0.827, 0.933),
	lime: rgb(0.639, 0.902, 0.208),
	coral: rgb(0.984, 0.443, 0.522),
	amber: rgb(0.984, 0.749, 0.141),
	white: rgb(1, 1, 1),
};

async function generateMonthlyEvalPdf(
	evalPageId: string,
	notion: NotionClient,
): Promise<Buffer> {
	const page = await notion.pages.retrieve({ page_id: evalPageId });
	const snapshot = buildMonthlyEvalPdfSnapshot(page);
	const bytes = await buildMonthlyEvalPdfBytes(snapshot);
	return Buffer.from(bytes);
}

async function attachMonthlyEvalPdf(
	evalPageId: string,
	notion: NotionClient,
	now = new Date(),
): Promise<MonthlyEvalPdfAttachResult> {
	if (!notion.fileUploads?.create || !notion.fileUploads.send) {
		throw new Error("この実行環境ではPDFアップロード機能を利用できません。");
	}

	const page = await notion.pages.retrieve({ page_id: evalPageId });
	const evaluationPdfProperty = page.properties?.["評価PDF"];
	if (
		!evaluationPdfProperty ||
		typeof evaluationPdfProperty !== "object" ||
		(evaluationPdfProperty as Record<string, unknown>).type !== "files"
	) {
		throw new Error("月次評価DBに「評価PDF」プロパティ(files)が見つかりません。");
	}

	await createPageComment(notion, page.id, "📄 PDFを生成中です…しばらくお待ちください");

	const snapshot = buildMonthlyEvalPdfSnapshot(page);
	const fileName = generateMonthlyEvalPdfFileName(snapshot);
	const pdfBytes = await generateMonthlyEvalPdf(evalPageId, notion);
	const created = await notion.fileUploads.create({
		filename: fileName,
		content_type: "application/pdf",
	});
	const fileUploadId =
		firstString(
			(created as Record<string, unknown>).id,
			readNestedString(created, ["file_upload", "id"]),
		) ?? "";
	if (!fileUploadId) {
		throw new Error("PDFアップロードIDの取得に失敗しました。");
	}

	await notion.fileUploads.send({
		file_upload_id: fileUploadId,
		file: {
			filename: fileName,
			data: new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }),
		},
	});

	await notion.pages.update({
		page_id: page.id,
		properties: {
			評価PDF: {
				files: [
					{
						type: "file_upload",
						file_upload: { id: fileUploadId },
						name: fileName,
					},
				],
			},
		},
	});

	const message = `PDFを添付しました（${formatMonthlyEvalDateTime(now.toISOString())}）`;
	await createPageComment(notion, page.id, message);
	return {
		action: "attached",
		pageId: page.id,
		fileName,
		fileUploadId,
		message,
	};
}

function buildMonthlyEvalPdfSnapshot(page: Page): MonthlyEvalPdfSnapshot {
	const properties = page.properties ?? {};
	const status = text(properties["評価ステータス"]);
	const targetMonth = text(properties["対象月"]) || "-";
	const salesPersonName = personLabelsFromProperty(properties["対象営業ユーザー"]).join("、") || "-";
	const rank = text(properties["評価ランク"]) || "-";
	const grossRate = numberValue(properties["粗利達成率"]);
	const dailyRate = numberValue(properties["日報継続率"]);
	const caseRate = numberValue(properties["案件化率"]);

	return {
		pageId: page.id,
		evaluationName: text(properties["評価名"]) || "月次評価",
		salesPersonName,
		targetMonth,
		closedAt: formatMonthlyEvalDateTime(dateStartFromProperty(properties["締め日時"])),
		evaluationStatus: status || "未設定",
		statusStamp: status === "確定" ? "確定" : "集計中",
		quantitativeScore: normalizeMonthlyEvalScore(numberValue(properties["定量スコア"])),
		qualitativeScore: normalizeMonthlyEvalScore(numberValue(properties["定性スコア"])),
		totalScore: normalizeMonthlyEvalScore(numberValue(properties["総合スコア"])),
		rank,
		kpis: [
			{
				label: "粗利達成率",
				value: formatMonthlyEvalRate(grossRate),
				hint: `目標 ${formatMonthlyEvalCurrency(numberValue(properties["粗利目標額"]))}`,
			},
			{ label: "実績粗利額", value: formatMonthlyEvalCurrency(numberValue(properties["実績粗利額"])) },
			{ label: "成約数", value: formatMonthlyEvalCount(numberValue(properties["成約数"]), "件") },
			{ label: "商談数", value: formatMonthlyEvalCount(numberValue(properties["商談数"]), "件") },
			{
				label: "案件化数",
				value: formatMonthlyEvalCount(numberValue(properties["案件化数"]), "件"),
				hint: `案件化率 ${formatMonthlyEvalRate(caseRate)}`,
			},
			{ label: "仕入れ件数", value: formatMonthlyEvalCount(numberValue(properties["仕入れ件数"]), "件") },
		],
		activities: [
			{ label: "日報提出数", value: formatMonthlyEvalCount(numberValue(properties["日報提出数"]), "件") },
			{ label: "日報継続率", value: formatMonthlyEvalRate(dailyRate) },
			{ label: "発言ログ数", value: formatMonthlyEvalCount(numberValue(properties["発言ログ数"]), "件") },
			{ label: "顧客接点数", value: formatMonthlyEvalCount(numberValue(properties["顧客接点数"]), "件") },
			{ label: "営業貢献数", value: formatMonthlyEvalCount(numberValue(properties["営業貢献数"]), "件") },
			{ label: "ナレッジ採用数", value: formatMonthlyEvalCount(numberValue(properties["ナレッジ採用数"]), "件") },
			{ label: "AI活用pt", value: formatMonthlyEvalCount(numberValue(properties["AI活用pt"]), "pt") },
		],
		memoSections: [
			{ title: "人見さんメモ", body: text(properties["人見さんメモ本文"]) },
			{ title: "成長ポイント", body: text(properties["成長ポイント"]) },
			{ title: "改善ポイント", body: text(properties["改善ポイント"]) },
			{ title: "次月テーマ", body: text(properties["次月テーマ"]) },
			{ title: "上司確認事項", body: text(properties["上司確認事項"]) },
		],
		commentSections: [
			{ title: "マネージャーコメント", body: text(properties["マネージャーコメント"]) },
			{ title: "本人コメント", body: text(properties["本人コメント"]) },
		],
	};
}

async function buildMonthlyEvalPdfBytes(snapshot: MonthlyEvalPdfSnapshot): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	pdf.registerFontkit(fontkit);
	const fonts = await embedMonthlyEvalPdfFonts(pdf);
	const page = pdf.addPage([MONTHLY_EVAL_PDF_PAGE_WIDTH, MONTHLY_EVAL_PDF_PAGE_HEIGHT]);
	const width = page.getWidth();
	const height = page.getHeight();
	const colors = MONTHLY_EVAL_COLORS;

	page.drawRectangle({ x: 0, y: 0, width, height, color: colors.bg });
	drawMonthlyEvalTopRule(page);
	drawMonthlyEvalHeader(page, fonts, snapshot);
	drawMonthlyEvalScoreHero(page, fonts, snapshot);
	drawMonthlyEvalScoreBars(page, fonts, snapshot);
	drawMonthlyEvalKpiCards(page, fonts, snapshot);
	drawMonthlyEvalActivityAndMemo(page, fonts, snapshot);
	drawMonthlyEvalComments(page, fonts, snapshot);
	drawMonthlyEvalFooter(page, fonts, snapshot);

	return pdf.save();
}

async function embedMonthlyEvalPdfFonts(pdf: PDFDocument): Promise<MonthlyEvalPdfFonts> {
	const fontPaths = resolveMonthlyEvalJapaneseFontPaths();
	if (fontPaths) {
		const regular = await embedMonthlyEvalPdfFont(pdf, fontPaths.regular);
		const bold =
			fontPaths.bold === fontPaths.regular
				? regular
				: await embedMonthlyEvalPdfFont(pdf, fontPaths.bold);
		return { regular, bold };
	}
	throw new Error(
		"月次評価PDFの日本語フォントが見つかりません。assets/fonts にNoto Sans JPを同梱するか、WAJO_PDF_JAPANESE_FONT_PATH でttf/otfフォントのパスを指定してください。",
	);
}

async function embedMonthlyEvalPdfFont(pdf: PDFDocument, fontPath: string): Promise<PDFFont> {
	const fontBytes = readFileSync(fontPath);
	return fontPath.toLowerCase().endsWith(".ttc")
		? pdf.embedFont(fontBytes)
		: pdf.embedFont(fontBytes, { subset: true });
}

function resolveMonthlyEvalJapaneseFontPaths(): MonthlyEvalPdfFontPaths | null {
	const regular = firstExistingPath(MONTHLY_EVAL_JAPANESE_REGULAR_FONT_CANDIDATES);
	if (!regular) return null;
	return {
		regular,
		bold: firstExistingPath(MONTHLY_EVAL_JAPANESE_BOLD_FONT_CANDIDATES) ?? regular,
	};
}

function resolveMonthlyEvalJapaneseFontPath(): string | null {
	return resolveMonthlyEvalJapaneseFontPaths()?.regular ?? null;
}

function firstExistingPath(candidates: string[]): string | null {
	for (const candidate of candidates) {
		if (candidate && existsSync(candidate)) return candidate;
	}
	return null;
}

function drawMonthlyEvalTopRule(page: PDFPage): void {
	const colors = MONTHLY_EVAL_COLORS;
	page.drawRectangle({ x: 0, y: 837, width: 198, height: 5, color: colors.violet });
	page.drawRectangle({ x: 198, y: 837, width: 198, height: 5, color: colors.cyan });
	page.drawRectangle({ x: 396, y: 837, width: 200, height: 5, color: colors.lime });
}

function drawMonthlyEvalHeader(
	page: PDFPage,
	fonts: MonthlyEvalPdfFonts,
	snapshot: MonthlyEvalPdfSnapshot,
): void {
	const colors = MONTHLY_EVAL_COLORS;
	const margin = 34;
	drawPdfText(page, "WAJO SALES OS", margin, 809, 8, fonts.bold, colors.cyan);
	drawPdfText(page, "月次評価レポート", margin, 784, 24, fonts.bold, colors.text);
	drawPdfText(page, snapshot.evaluationName, margin, 763, 10, fonts.regular, colors.muted);

	const stampColor = snapshot.statusStamp === "確定" ? colors.lime : colors.amber;
	page.drawRectangle({ x: 498, y: 780, width: 62, height: 30, color: stampColor, borderWidth: 0 });
	drawPdfText(page, snapshot.statusStamp, 515, 789, 13, fonts.bold, colors.bg);
	drawPdfText(page, `対象月 ${snapshot.targetMonth}`, 390, 754, 9, fonts.regular, colors.text);
	drawPdfText(page, `締め ${snapshot.closedAt || "-"}`, 390, 738, 9, fonts.regular, colors.muted);
	drawPdfText(page, `担当 ${snapshot.salesPersonName}`, 34, 738, 10, fonts.regular, colors.text);
}

function drawMonthlyEvalScoreHero(
	page: PDFPage,
	fonts: MonthlyEvalPdfFonts,
	snapshot: MonthlyEvalPdfSnapshot,
): void {
	const colors = MONTHLY_EVAL_COLORS;
	const y = 610;
	drawPanel(page, 34, y, 527, 105);
	drawPdfText(page, "総合スコア", 58, y + 75, 11, fonts.regular, colors.muted);
	drawPdfText(page, String(snapshot.totalScore), 58, y + 24, 46, fonts.bold, colors.text);
	drawPdfText(page, "/ 100", 142, y + 34, 16, fonts.regular, colors.muted);

	const rankColor = monthlyEvalRankColor(snapshot.rank);
	page.drawRectangle({ x: 420, y: y + 25, width: 96, height: 56, color: rankColor });
	drawPdfText(page, "RANK", 450, y + 62, 8, fonts.bold, colors.bg);
	drawPdfText(page, snapshot.rank || "-", 457, y + 32, 25, fonts.bold, colors.bg);

	drawWrappedPdfText(
		page,
		"定量と活動ログを分けて確認し、次月の打ち手へつなげる評価スナップショットです。",
		212,
		y + 72,
		185,
		8,
		10,
		fonts.regular,
		colors.muted,
		2,
	);
	drawPdfText(page, `評価ステータス: ${snapshot.evaluationStatus}`, 212, y + 45, 11, fonts.regular, colors.text);
	drawPdfText(page, "人見さんメモ枠つき", 212, y + 28, 10, fonts.regular, colors.cyan);
}

function drawMonthlyEvalScoreBars(
	page: PDFPage,
	fonts: MonthlyEvalPdfFonts,
	snapshot: MonthlyEvalPdfSnapshot,
): void {
	drawPanel(page, 34, 548, 527, 46);
	drawScoreBar(page, fonts, 58, 572, "定量スコア", snapshot.quantitativeScore, 65, MONTHLY_EVAL_COLORS.violet);
	drawScoreBar(page, fonts, 314, 572, "定性スコア", snapshot.qualitativeScore, 35, MONTHLY_EVAL_COLORS.cyan);
}

function drawMonthlyEvalKpiCards(
	page: PDFPage,
	fonts: MonthlyEvalPdfFonts,
	snapshot: MonthlyEvalPdfSnapshot,
): void {
	const startX = 34;
	const startY = 407;
	const cardW = 165;
	const cardH = 58;
	const gap = 16;
	drawPdfText(page, "KPI", startX, 501, 13, fonts.bold, MONTHLY_EVAL_COLORS.text);
	snapshot.kpis.forEach((item, index) => {
		const col = index % 3;
		const row = Math.floor(index / 3);
		const x = startX + col * (cardW + gap);
		const y = startY + (1 - row) * (cardH + 13);
		drawPanel(page, x, y, cardW, cardH);
		drawPdfText(page, item.label, x + 14, y + 37, 8, fonts.regular, MONTHLY_EVAL_COLORS.muted);
		drawPdfText(page, item.value, x + 14, y + 17, 15, fonts.bold, MONTHLY_EVAL_COLORS.text);
		if (item.hint) drawPdfText(page, item.hint, x + 14, y + 7, 6.5, fonts.regular, MONTHLY_EVAL_COLORS.cyan);
	});
}

function drawMonthlyEvalActivityAndMemo(
	page: PDFPage,
	fonts: MonthlyEvalPdfFonts,
	snapshot: MonthlyEvalPdfSnapshot,
): void {
	const colors = MONTHLY_EVAL_COLORS;
	drawPanel(page, 34, 232, 220, 142);
	drawPdfText(page, "活動ログ", 52, 351, 13, fonts.bold, colors.text);
	let y = 328;
	for (const item of snapshot.activities) {
		drawPdfText(page, item.label, 52, y, 8, fonts.regular, colors.muted);
		drawPdfText(page, item.value, 174, y, 10, fonts.bold, colors.text);
		y -= 15;
	}

	drawPanel(page, 271, 232, 290, 142, colors.panelSoft);
	drawPdfText(page, "人見さんメモ", 289, 351, 13, fonts.bold, colors.cyan);
	const memo = snapshot.memoSections
		.map((section) => `${section.title}: ${section.body || "-"}`)
		.join("\n");
	drawWrappedPdfText(page, memo, 289, 333, 250, 8, 11, fonts.regular, colors.text, 9);
}

function drawMonthlyEvalComments(
	page: PDFPage,
	fonts: MonthlyEvalPdfFonts,
	snapshot: MonthlyEvalPdfSnapshot,
): void {
	const colors = MONTHLY_EVAL_COLORS;
	const sections = [
		...snapshot.memoSections.filter((section) => section.title !== "人見さんメモ").slice(0, 3),
		...snapshot.commentSections,
	];
	drawPanel(page, 34, 72, 527, 134);
	drawPdfText(page, "コメント・次月アクション", 52, 183, 13, fonts.bold, colors.text);
	let y = 162;
	for (const section of sections.slice(0, 5)) {
		drawPdfText(page, section.title, 52, y, 8.5, fonts.bold, colors.amber);
		const usedLines = drawWrappedPdfText(
			page,
			section.body || "-",
			150,
			y,
			380,
			8,
			11,
			fonts.regular,
			colors.text,
			2,
		);
		y -= Math.max(16, usedLines * 11 + 4);
		if (y < 86) break;
	}
}

function drawMonthlyEvalFooter(
	page: PDFPage,
	fonts: MonthlyEvalPdfFonts,
	snapshot: MonthlyEvalPdfSnapshot,
): void {
	drawPdfText(
		page,
		`Monthly Evaluation Snapshot / ${snapshot.pageId}`,
		34,
		38,
		7,
		fonts.regular,
		MONTHLY_EVAL_COLORS.muted,
	);
	drawPdfText(page, "CONFIDENTIAL", 486, 38, 7, fonts.bold, MONTHLY_EVAL_COLORS.coral);
}

function drawScoreBar(
	page: PDFPage,
	fonts: MonthlyEvalPdfFonts,
	x: number,
	y: number,
	label: string,
	score: number,
	max: number,
	color: ReturnType<typeof rgb>,
): void {
	const colors = MONTHLY_EVAL_COLORS;
	const barWidth = 160;
	drawPdfText(page, `${label} ${score}/${max}`, x, y + 10, 9, fonts.bold, colors.text);
	page.drawRectangle({ x, y, width: barWidth, height: 7, color: colors.line });
	page.drawRectangle({ x, y, width: barWidth * Math.min(1, Math.max(0, score / max)), height: 7, color });
}

function drawPanel(
	page: PDFPage,
	x: number,
	y: number,
	width: number,
	height: number,
	color = MONTHLY_EVAL_COLORS.panel,
): void {
	page.drawRectangle({
		x,
		y,
		width,
		height,
		color,
		borderColor: MONTHLY_EVAL_COLORS.line,
		borderWidth: 0.8,
	});
}

function drawPdfText(
	page: PDFPage,
	textValue: string,
	x: number,
	y: number,
	size: number,
	font: PDFFont,
	color: ReturnType<typeof rgb>,
): void {
	page.drawText(textValue || "-", { x, y, size, font, color });
}

function drawWrappedPdfText(
	page: PDFPage,
	textValue: string,
	x: number,
	y: number,
	maxWidth: number,
	size: number,
	lineHeight: number,
	font: PDFFont,
	color: ReturnType<typeof rgb>,
	maxLines: number,
): number {
	const lines = wrapPdfText(textValue || "-", font, size, maxWidth).slice(0, maxLines);
	lines.forEach((line, index) => {
		const suffix = index === maxLines - 1 && wrapPdfText(textValue || "-", font, size, maxWidth).length > maxLines
			? "..."
			: "";
		drawPdfText(page, `${line}${suffix}`, x, y - index * lineHeight, size, font, color);
	});
	return lines.length;
}

function wrapPdfText(textValue: string, font: PDFFont, size: number, maxWidth: number): string[] {
	const normalized = textValue.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const lines: string[] = [];
	for (const sourceLine of normalized.split("\n")) {
		let current = "";
		for (const char of Array.from(sourceLine)) {
			const next = `${current}${char}`;
			if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
				lines.push(current);
				current = char.trimStart();
			} else {
				current = next;
			}
		}
		lines.push(current || "");
	}
	return lines.filter((line) => line.trim().length > 0);
}

function normalizeMonthlyEvalScore(value: number | null): number {
	if (value === null || !Number.isFinite(value)) return 0;
	return Math.max(0, Math.round(value));
}

function formatMonthlyEvalRate(value: number | null): string {
	if (value === null || !Number.isFinite(value)) return "-";
	const percent = Math.abs(value) <= 1.5 ? value * 100 : value;
	return `${Math.round(percent * 10) / 10}%`;
}

function formatMonthlyEvalCurrency(value: number | null): string {
	if (value === null || !Number.isFinite(value)) return "-";
	return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatMonthlyEvalCount(value: number | null, unit: string): string {
	if (value === null || !Number.isFinite(value)) return "-";
	return `${Math.round(value).toLocaleString("ja-JP")}${unit}`;
}

function formatMonthlyEvalDateTime(value: string): string {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

function monthlyEvalRankColor(rank: string): ReturnType<typeof rgb> {
	const colors = MONTHLY_EVAL_COLORS;
	if (rank === "S") return colors.lime;
	if (rank === "A") return colors.cyan;
	if (rank === "B") return colors.violet;
	if (rank === "C") return colors.amber;
	if (rank === "D") return colors.coral;
	return colors.line;
}

function generateMonthlyEvalPdfFileName(snapshot: MonthlyEvalPdfSnapshot): string {
	return `月次評価_${sanitizeFileName(snapshot.targetMonth)}_${sanitizeFileName(snapshot.salesPersonName)}.pdf`;
}

export {
	attachMonthlyEvalPdf as attachMonthlyEvalPdfForTest,
	buildMonthlyEvalPdfBytes as buildMonthlyEvalPdfBytesForTest,
	buildMonthlyEvalPdfSnapshot as buildMonthlyEvalPdfSnapshotForTest,
	generateMonthlyEvalPdf as generateMonthlyEvalPdfForTest,
	generateMonthlyEvalPdfFileName as generateMonthlyEvalPdfFileNameForTest,
	resolveMonthlyEvalJapaneseFontPath as resolveMonthlyEvalJapaneseFontPathForTest,
	resolveMonthlyEvalJapaneseFontPaths as resolveMonthlyEvalJapaneseFontPathsForTest,
};

type CardInput = {
	pageId: string;
	pageData?: Page;
	dryRun?: boolean;
	routing?: "company" | "broker" | "later";
	engagementIntent?: "active" | "save-only";
	// 入口で営業が決めた熱量。false 相当なら企業連携だけ行い、外部調査/企業マスター高密度化は走らせない。
	deepResearch?: boolean;
	// 画像インテイク経由の明示実行(自分で「処理中」を立てた直後に呼ぶため終端ガードを通す)
	force?: boolean;
	// 後方互換用。名刺1枚プロジェクト第1段階の入口では商談準備レポートを自動生成しない。
	// 実環境の三段階連携を有効化するためのフラグ。テストやdry-runでは false が無難。
	autoCreateMeetingPrepReport?: boolean;
	// 明示されたときだけ、企業マスター高密度化ではなく社外顧問DB登録ラインへ送る。
	registerExternalAdvisor?: boolean;
};

type CardResult = {
	pageId: string;
	action:
		| "existing-linked"
		| "created-company"
		| "duplicate-hold"
		| "needs-review"
		| "external-advisor-registered"
		| "external-advisor-linked"
		| "skipped"
		| "dry-run";
	companyId: string | null;
	companyName: string | null;
	message: string;
};

type Candidate = {
	page: Page;
	name: string;
	key: string;
	email: string;
	phone: string;
	score: number;
	reasons: string[];
	weak: boolean;
};

type CardInfo = {
	page: Page;
	name: string;
	companyName: string;
	email: string;
	domain: string;
	phone: string;
	address: string;
	role: string;
	key: string;
};

type InquiryInput = {
	inquiryPageId: string;
	pageData?: Page;
	dryRun?: boolean;
};

type InquiryEmailIntakeInput = {
	subject?: string;
	from?: string;
	to?: string;
	body?: string;
	receivedAt?: string;
	gmailMessageId?: string;
	messageId?: string;
	threadId?: string;
	labels?: string;
	sourceUrl?: string;
	dryRun?: boolean;
	linkCompany?: boolean;
};

type InquiryResult = {
	inquiryPageId: string;
	action:
		| "existing-linked"
		| "created-company"
		| "duplicate-hold"
		| "target-out"
		| "needs-review"
		| "skipped-existing"
		| "dry-run";
	companyId: string | null;
	companyName: string | null;
	message: string;
};

type InquiryProjectCreationResult = {
	inquiryPageId: string;
	action: "created-project" | "skipped-existing" | "enriched-existing" | "dry-run" | "error";
	projectId: string | null;
	created: number;
	message: string;
};

type InquiryEmailIntakeResult = {
	inquiryPageId: string | null;
	action:
		| "created-inquiry"
		| "skipped-existing"
		| "duplicate-hold"
		| "needs-review"
		| "dry-run"
		| "error";
	companyAction: string | null;
	message: string;
};

type GmailInquiryInboxInput = {
	dryRun?: boolean;
	limit?: number;
	query?: string;
	sourceLabelName?: string;
	doneLabelName?: string;
	removeSourceLabel?: boolean;
	linkCompany?: boolean;
};

type GmailInquiryInboxResult = {
	action: "processed" | "dry-run";
	checked: number;
	created: number;
	existing: number;
	ignored: number;
	labelled: number;
	errors: number;
	dryRunReady: number;
	message: string;
	samples: string[];
};

type GmailLabel = {
	id: string;
	name: string;
};

type GmailMessageRef = {
	id: string;
};

type GmailApiClient = {
	listLabels(): Promise<GmailLabel[]>;
	createLabel(name: string): Promise<GmailLabel>;
	listMessages(query: string, limit: number): Promise<GmailMessageRef[]>;
	getMessage(id: string): Promise<Record<string, unknown>>;
	modifyMessage(
		id: string,
		input: { addLabelIds?: string[]; removeLabelIds?: string[] },
	): Promise<void>;
};

type CustomerContactLogInput = {
	sourcePageId: string;
	sourceType: string;
	activityType: string;
	activityContent: string;
	nextAction: string;
	occurredAt: string;
	dryRun?: boolean;
};

type CustomerContactLogResult = {
	contactLogPageId: string | null;
	action: "created-log" | "needs-review" | "dry-run" | "error";
	message: string;
};

type PipelineLogSignal = {
	id: string;
	occurredAt: string;
	activityType: string;
	activityContent: string;
	nextAction: string;
};

type PipelineAssessment = {
	proximity: string;
	score: number;
	recommendedPhase: string;
	reason: string;
	nextAction: string;
	stagnationHours: number;
	stagnationDays: number;
	stagnationAlert: string;
	lastSignalAt: string;
};

type SalesPipelineSignalResult = {
	pageId: string;
	action: "updated-inquiry" | "updated-project" | "skipped" | "dry-run";
	message: string;
	assessment: PipelineAssessment | null;
};

type BulkCleanupResult = {
	action: "cleaned" | "dry-run" | "numbered" | "skipped";
	checked: number;
	updated: number;
	message: string;
};

type InquiryInfo = {
	page: Page;
	title: string;
	companyName: string;
	contactName: string;
	email: string;
	domain: string;
	phone: string;
	body: string;
	summary: string;
	firstTalk: string;
	dealType: string;
	inquiryType: string;
	companyLinkStatus: string;
	duplicateKey: string;
	mailUniqueKey: string;
	messageId: string;
	threadId: string;
	relatedCompanyIds: string[];
};

type InquiryEmailInfo = {
	subject: string;
	displayTitle: string;
	attentionMemo: string;
	attentionReasons: string[];
	categoryCode: string;
	receptionNumber?: string;
	fromRaw: string;
	fromEmail: string;
	contactEmail: string;
	to: string;
	body: string;
	receivedAt: string;
	gmailMessageId: string;
	messageId: string;
	threadId: string;
	labels: string;
	sourceUrl: string;
	contactName: string;
	companyName: string;
	phone: string;
	inquiryType: string;
	dealType: string;
	duplicateKeys: string[];
	primaryKey: string;
};

type Research = {
	summary: string;
	currentIssue: string;
	futureIssue: string;
	salesAngle: string;
	fit: string;
	customerMarket3c: string;
	competitor3c: string;
	wajoRelation3c: string;
	source: string;
	// 成約へのポイント（事実ベース・3段構造）。
	// Why: 旧経路では Notion AI ボタン「AIで企業情報を埋める」経由でしか書かれず、
	// ヘッジ表現連発の温床になっていた（大ちゃん 2026-06-20 指摘）。
	// Worker 側で先に3段構造の closingPoint を入れて、Notion AI ボタンが上書きできない状態にする。
	closingPoint: string;
};

type DeepResearch = Research & {
	representative: string;   // 代表者
	executives: string;       // 経営陣（代表以外のキーパーソン）
	capital: string;          // 資本金
	founded: string;          // 設立年月
	revenue: string;          // 売上規模
	employees: string;        // 従業員規模
	industry: string;         // 業種
	listingStatus: string;    // 上場区分
	websiteUrl: string;
	xUrl: string;
	linkedinUrl: string;
	corporateNumber: string;  // 法人番号
	executiveSns: string;     // 役員SNS発信メモ（公開・事業範囲のみ）
	recentNews: string;       // 直近ニュース（日付つき）
	renewableSignals: string; // 再エネ接点シグナル
	decisionMaker: string;    // 想定決裁者
	objections: string;       // 想定反論・懸念
	citations: string[];      // 出典URL
	officialSns: string;      // 公式SNS情報
	linkedinProfiles: string; // LinkedIn情報
	jobSignals: string;       // 求人情報や従業員レビュー
	reviews: string;          // 口コミ情報
	officialSources: string;  // Tier1/Tier2: 公式/準公式寄りの出典
	externalSources: string;  // Tier3/外部寄り情報の出典
	sourceType: "official" | "external" | "mixed"; // 内部監査向け分割フラグ
};

type CompanyResearchAgentRole =
	| "shota-external-research"
	| "official-research-kun"
	| "sales-material-kun"
	| "reflection-kun";

type CompanyResearchEvidenceElement = {
	agent: CompanyResearchAgentRole;
	kind: "official_fact" | "external_signal";
	field: string;
	value: string;
	targetProperty: string;
	derivedTargetProperty?: string;
	sourceUrl: string;
	confidence: "high" | "medium" | "low";
};

type TdbProfile = {
	企業評点: number | null;   // TDB評点（概ね0-100、高いほど良い）
	倒産確率Pct: number | null; // 倒産確率(%)
	年商: string;
	資本金: string;
	従業員数: string;
	設立: string;
	業種: string;
	代表者: string;
	法人番号: string;
	調査年月日: string;        // ISO日付
	raw: string;              // 元帳票テキスト（監査用）
};

type CreditScore = {
	信頼度: "高" | "中" | "低";
	提案可否: "提案可能" | "タイミング待ち" | "提案不可";
	根拠: string;
};

type MeetingPrepInput = {
	companyPageId: string;
	reportPageId?: string;
	dryRun?: boolean;
	force?: boolean;
};

type ResidentDocumentInput = {
	pageId: string;
	dryRun?: boolean;
};

type ResidentDocumentResult = {
	pageId: string;
	action: "prepared" | "needs-input" | "dry-run" | "error";
	status: string;
	missingField: string | null;
	message: string;
};

type ProposalSimulationInput = {
	pageId: string;
	dryRun?: boolean;
};

type ProposalSimulationResult = {
	pageId: string;
	action: "prepared" | "needs-input" | "dry-run" | "error";
	status: string;
	missingField: string | null;
	grossProfit: number | null;
	expectedYield: number | null;
	paybackYears: number | null;
	message: string;
};

type ProjectProposalRequestInput = {
	projectPageId: string;
	dryRun?: boolean;
};

type ProjectDocumentRequestKind = "proposal" | "resident";

type ProjectDocumentRequestConfig = {
	kind: ProjectDocumentRequestKind;
	documentType: string;
	requestTitleSuffix: string;
	statusProperty: string;
	statusValue: string;
	createdLabel: string;
	nextActionMessage: string;
	memo: string;
	defaultProperties?: Record<string, Record<string, unknown>>;
};

type ProjectDocumentRequestResult = {
	projectPageId: string;
	requestPageId: string | null;
	action: "created" | "existing" | "needs-input" | "dry-run";
	message: string;
};

type ProjectProposalRequestResult = ProjectDocumentRequestResult;

type ProjectEquipmentDetailRequestResult = {
	projectPageId: string;
	equipmentPageId: string | null;
	action: "created" | "existing" | "duplicate-hold" | "dry-run";
	message: string;
};

type CompanyResearchInput = {
	companyPageId: string;
	dryRun?: boolean;
};

type CompanyResearchResult = {
	companyId: string;
	action:
		| "updated-company"
		| "needs-review"
		| "dry-run"
		| "needs-permission"
		| "skipped-fresh"
		| "in-flight"
		| "updated-credit";
	message: string;
};

type MeetingMemoFormatInput = {
	meetingPageId: string;
	dryRun?: boolean;
	generateEvaluationLogs?: boolean;
};

type MeetingMemoFormatResult = {
	meetingPageId: string;
	action: "formatted" | "needs-review" | "target-out" | "dry-run" | "error";
	status: string;
	message: string;
};

type MeetingFeedbackInput = {
	meetingPageId: string;
	dryRun?: boolean;
};

type MeetingFeedbackResult = {
	meetingPageId: string;
	action: "feedback-created" | "needs-review" | "target-out" | "dry-run" | "error";
	status: string;
	message: string;
};

type MeetingDealLinkInput = {
	meetingPageId: string;
	dryRun?: boolean;
};

type MeetingDealLinkResult = {
	meetingPageId: string;
	dealPageId: string | null;
	action: "linked-existing" | "created-deal" | "needs-review" | "target-out" | "dry-run" | "error";
	message: string;
};

type MeetingTaskInput = {
	meetingPageId: string;
	dryRun?: boolean;
};

type MeetingTaskResult = {
	meetingPageId: string;
	action: "created-tasks" | "skipped-existing" | "needs-review" | "target-out" | "dry-run" | "error";
	created: number;
	skipped: number;
	message: string;
};

type MeetingKnowledgeInput = {
	meetingPageId: string;
	dryRun?: boolean;
};

type MeetingKnowledgeResult = {
	meetingPageId: string;
	action: "created-knowledge" | "skipped-duplicate" | "needs-review" | "dry-run" | "error";
	created: number;
	candidates: number;
	knowledgePageId: string | null;
	message: string;
};

type MeetingQuickStartInput = {
	meetingType: string;
	dryRun?: boolean;
	now?: Date;
};

type MeetingQuickStartResult = {
	meetingPageId: string | null;
	meetingUrl: string | null;
	action: "created-meeting" | "dry-run" | "use-deal-quick-start";
	meetingType: MeetingPrimaryType;
	meetingDate: string;
	title: string;
	message: string;
};

type DealQuickStartInput = {
	dryRun?: boolean;
	now?: Date;
};

type DealQuickStartResult = {
	dealPageId: string | null;
	dealUrl: string | null;
	action: "created-deal" | "dry-run";
	dealDate: string;
	title: string;
	message: string;
};

type ManagerReviewInput = {
	managerReviewPageId: string;
	dryRun?: boolean;
};

type ManagerReviewResult = {
	managerReviewPageId: string;
	action: "reviewed" | "needs-review" | "dry-run" | "error";
	status: string;
	message: string;
};

type SalesPerformanceReviewInput = {
	salesPerformancePageId: string;
	dryRun?: boolean;
};

type SalesPerformanceReviewResult = {
	salesPerformancePageId: string;
	action: "reviewed" | "needs-review" | "dry-run" | "error";
	status: string;
	message: string;
	sourcePreview: string[];
};

type DailyReportReceiptSyncInput = {
	receiptPageId: string;
	dryRun?: boolean;
};

type DailyReportReceiptSyncResult = {
	receiptPageId: string;
	dailyReportPageId: string | null;
	action: "synced" | "needs-review" | "dry-run" | "error";
	status: string;
	message: string;
};

type DailyReportLogInput = {
	dailyReportPageId: string;
	dryRun?: boolean;
};

type DailyReportLogResult = {
	dailyReportPageId: string;
	logPageId: string | null;
	action: "created-log" | "updated-log" | "needs-review" | "dry-run" | "error";
	status: string;
	message: string;
};

type MeetingPrepResult = {
	companyId: string;
	reportId: string | null;
	reportUrl: string | null;
	action: "updated-report" | "created-report" | "dry-run" | "skipped-fresh";
	message: string;
};

type CompanyInfo = {
	page: Page;
	name: string;
	dealType: string;
	website: string;
	email: string;
	phone: string;
	contactName: string;
	address: string;
	summary: string;
	inquirySummary: string;
	currentIssue: string;
	futureIssue: string;
	salesAngle: string;
	fit: string;
	customerMarket3c: string;
	competitor3c: string;
	wajoRelation3c: string;
	source: string;
	closingPoint: string;
	aiMemo: string;
};

type MeetingPrepReport = {
	profile: string;
	threeC: string;
	hypothesis: string;
	questions: string;
	risks: string;
	body: string;
};

type MeetingPrepAIResponse = MeetingPrepReport;

type MeetingPrepQuality = {
	ready: boolean;
	notes: string[];
};

type LandInput = {
	pageId: string;
	pageData?: Page;
	dryRun?: boolean;
};

type LandCaseInput = {
	landPageId: string;
	dryRun?: boolean;
};

type LandResult = {
	pageId: string;
	action: "evaluated" | "needs-review" | "dry-run";
	overallGrade: string;
	score: number;
	bucket: string;
	message: string;
};

type LandCaseResult = {
	landPageId: string;
	action: "created-project" | "skipped-existing" | "needs-review" | "dry-run" | "error";
	projectId: string | null;
	created: number;
	message: string;
};

type LandInfo = {
	page: Page;
	name: string;
	address: string;
	areaTsubo: number | null;
	powerArea: string;
	landUse: string;
	road: string;
	farmland: string;
	farmlandType: string;
	registry: string;
	nearbyResidentialDistanceM: number | null;
	nearbyResidentialCheck: string;
	transmissionLine: string;
	substationDistance: string;
	substationDistanceKm: number | null;
	latitude: number | null;
	longitude: number | null;
};

type ProjectInfo = {
	page: Page;
	name: string;
};

type LandEvaluation = {
	overallGrade: string;
	score: number;
	bucket: string;
	requiresInvestigation?: boolean;
	investigationGaps?: string[];
	actionBucket: string;
	caseStatus: string;
	projectType: string;
	powerArea: string;
	landRating: string;
	powerRating: string;
	roadRating: string;
	subsidyRating: string;
	demandRating: string;
	landEvaluation: string;
	powerEvaluation: string;
	roadEvaluation: string;
	subsidyEvaluation: string;
	demandEvaluation: string;
	nextAction: string;
	reviewMemo: string;
	nearestSubstationName?: string;
	nearestSubstationDistanceKm?: number | null;
	shouldPatchSubstationDistance?: boolean;
	nearestSubstationOperator?: string;
	nearestSubstationGridStatus?: string;
	substationCandidates?: LandTreasureSubstationCandidate[];
	physicalAiScore?: number;
	salesAiScore?: number;
	sabcReason?: string;
	farmlandPreAssessmentText?: string;
};

type DealSecondReviewInput = {
	dealPageId: string;
	dryRun?: boolean;
};

type DealSecondReviewResult = {
	dealPageId: string;
	action: "reviewed" | "needs-review" | "dry-run" | "error";
	quality: string | null;
	message: string;
};

type DealMeetingFeedbackInput = {
	dealPageId: string;
	dryRun?: boolean;
};

type DealMeetingFeedbackResult = {
	dealPageId: string;
	action: "feedback-created" | "skipped-existing" | "needs-review" | "dry-run" | "error";
	score: number | null;
	message: string;
};

type DealNextActionInput = {
	dealPageId: string;
	dryRun?: boolean;
};

type DealNextActionResult = {
	dealPageId: string;
	action: "created-tasks" | "skipped-existing" | "needs-review" | "dry-run" | "error";
	created: number;
	skipped: number;
	message: string;
};

type SalesTalkFinalizeInput = {
	newsPageId: string;
	dryRun?: boolean;
};

type SalesNewsCollectInput = {
	limit?: number;
	dryRun?: boolean;
	autoGenerateTalk?: boolean;
	autoFinalize?: boolean;
};

type SalesNewsCollectResult = {
	action: "collected" | "dry-run" | "error";
	fetched: number;
	candidates: number;
	created: number;
	skipped: number;
	finalized: number;
	pages: string[];
	message: string;
};

type SalesTalkFinalizeResult = {
	newsPageId: string;
	action: "finalized" | "needs-review" | "dry-run" | "error";
	updated: number;
	created: number;
	message: string;
};

type DealInfo = {
	page: Page;
	name: string;
	date: string;
	dateISO: string;
	summary: string;
	count: string;
	status: string;
	relatedMeetingId: string | null;
	assignedUserIds: string[];
	relatedCompanyIds: string[];
	salesScore: string;
	salesFeedback: string;
	improvementPoints: string;
	nextTalkImage: string;
	followMailHint: string;
	closingHint: string;
};

type MeetingContext = {
	summary: string;
	minutes: string;
	decisions: string;
	actionItems: string;
	text: string;
};

type SecondReviewAIResponse = {
	quality: string;
	summary: string;
	strongPoints: string[];
	revisionSuggestions: string[];
	nextTalkUpgrade: string;
	riskNotes: string[];
	recommendedStatus: string;
};

type DealMeetingFeedbackAIResponse = {
	score: number;
	salesFeedback: string;
	improvementPoints: string[];
	nextTalkImage: string;
	followMailHint: string;
	closingHint: string;
	status: "返却済" | "要確認" | "対象外";
	memo: string;
};

type DealNextActionAIResponse = {
	status: "作成候補あり" | "要確認" | "対象外";
	memo: string;
	actions: DealNextActionCandidate[];
};

type SalesTalkFinalizeAIResponse = {
	status: "作成候補あり" | "要確認" | "対象外";
	memo: string;
	talks: SalesTalkDraft[];
};

type SalesTalkDraft = {
	title: string;
	hook: string;
	script: string;
	target: string;
	objectionHandling: string;
	nextAction: string;
	usage: string[];
	importance: "🔴 必ず使う" | "🟡 余裕あれば" | "⚪ ストック";
	status: "使える" | "要修正";
	memo: string;
};

type SalesTalkNewsInfo = {
	page: Page;
	title: string;
	category: string;
	importance: string;
	oneLine: string;
	articleUrl: string;
	generatedTalk: string;
};

type SalesNewsFeed = {
	name: string;
	url: string;
	defaultCategory?: string;
};

type SalesNewsItem = {
	feedName: string;
	title: string;
	url: string;
	summary: string;
	publishedDate: string;
};

type ScoredSalesNewsItem = SalesNewsItem & {
	score: number;
	category: string;
	importance: string;
	oneLine: string;
	shouldCreateTalk: boolean;
};

type SalesTalkPageInfo = {
	page: Page;
	title: string;
	hook: string;
	script: string;
	target: string;
	objectionHandling: string;
	nextAction: string;
};

type DailyReportReceiptInfo = {
	page: Page;
	name: string;
	status: string;
	targetDate: string;
	reportIds: string[];
};

type DailyReportInfo = {
	page: Page;
	title: string;
	date: string;
	submissionStatus: string;
	userIds: string[];
	bossComment: string;
	todaySummary: string;
	progressView: string;
	noGo: string;
	pitfalls: string;
	nextMove: string;
	factCorrection: string;
	personComment: string;
};

type DealNextActionCandidate = {
	title: string;
	description: string;
	priority: "高" | "中" | "低";
	taskType: "確認・調査" | "書類作成" | "顧客フォロー" | "社内タスク";
	dueText: string;
	dueDate: string;
	requiresHumanCheck: boolean;
};

type TeamTaskInfo = {
	page: Page;
	title: string;
	status: string;
	done: boolean;
};

type MeetingMemoAIResponse = {
	text: string;
	summary: string;
	minutes: string;
	decisions: string;
	actionItems: string;
	taskStatus: "未処理" | "要確認" | "対象外";
	formatStatus: "整形済" | "要確認" | "対象外";
	memo: string;
	speechLogCandidates: MeetingSpeechLogCandidate[];
	salesContributionCandidates: MeetingSalesContributionCandidate[];
};

type MeetingSpeechLogCandidate = {
	title: string;
	content: string;
	category: string;
	speaker: string;
	evidenceQuote: string;
	confidence: string;
};

type MeetingSalesContributionCandidate = {
	title: string;
	type: string;
	category: string;
	impact: string;
	comment: string;
	evidenceQuote: string;
	confidence: string;
};

type MeetingEvaluationLogExtraction = {
	speechLogCandidates: MeetingSpeechLogCandidate[];
	salesContributionCandidates: MeetingSalesContributionCandidate[];
	skipped?: string[];
};

type ManagerReviewAIResponse = {
	summary: string;
	managerTalkingPoints: string[];
	strengths: string[];
	risks: string[];
	coachingTheme: string;
	nextMonthTheme: string;
	confirmationItems: string[];
	recommendedStatus: "レビュー中" | "要確認";
};

type SalesPerformanceReviewAIResponse = {
	conclusion: string;
	resultExplanation: string;
	actionGuidance: string;
	contributionView: string;
	evidence: string[];
	personComment: string;
	managerConfirmationItems: string[];
	nextMonthImprovements: string[];
	riskNotes: string[];
	recommendedStatus: "処理済" | "要確認";
};

type MeetingFeedbackAIResponse = {
	directFeedback: string;
	goodPoints: string[];
	improvementPoints: string[];
	nextQuestions: string[];
	nextAction: string;
	status: "返却済" | "要確認" | "対象外";
	memo: string;
};

type MeetingTaskCandidate = {
	title: string;
	description: string;
	taskType: string;
	priority: string;
	dueText: string;
	dueDate: string;
	requiresHumanCheck: boolean;
};

type MeetingDealLinkInfo = {
	page: Page;
	titleText: string;
	meetingType: string;
	meetingDate: string;
	summary: string;
	minutes: string;
	decisions: string;
	actionItems: string;
	text: string;
	relatedDealIds: string[];
	relatedCompanyIds: string[];
	assignedUserIds: string[];
};

export const SECOND_REVIEW_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "second_review",
		strict: true,
		schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"quality",
				"summary",
				"strongPoints",
				"revisionSuggestions",
				"nextTalkUpgrade",
				"riskNotes",
				"recommendedStatus",
			],
			properties: {
				quality: {
					type: "string",
					enum: ["良い", "要修正", "情報不足"],
				},
				summary: { type: "string" },
				strongPoints: {
					type: "array",
					items: { type: "string" },
				},
				revisionSuggestions: {
					type: "array",
					items: { type: "string" },
				},
				nextTalkUpgrade: { type: "string" },
				riskNotes: {
					type: "array",
					items: { type: "string" },
				},
				recommendedStatus: {
					type: "string",
					enum: ["レビュー済", "要確認"],
				},
			},
		},
	},
} as const;

export const MEETING_MEMO_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "meeting_memo_format",
		strict: true,
		schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"text",
				"summary",
				"minutes",
				"decisions",
				"actionItems",
				"taskStatus",
				"formatStatus",
				"memo",
				"speechLogCandidates",
				"salesContributionCandidates",
			],
			properties: {
				text: { type: "string" },
				summary: { type: "string" },
				minutes: { type: "string" },
				decisions: { type: "string" },
				actionItems: { type: "string" },
				taskStatus: {
					type: "string",
					enum: ["未処理", "要確認", "対象外"],
				},
				formatStatus: {
					type: "string",
					enum: ["整形済", "要確認", "対象外"],
				},
				memo: { type: "string" },
				speechLogCandidates: {
					type: "array",
					items: {
						type: "object",
						additionalProperties: false,
						required: [
							"title",
							"content",
							"category",
							"speaker",
							"evidenceQuote",
							"confidence",
						],
						properties: {
							title: { type: "string" },
							content: { type: "string" },
							category: { type: "string", enum: [...SPEECH_LOG_CATEGORY_OPTIONS] },
							speaker: { type: "string" },
							evidenceQuote: { type: "string" },
							confidence: { type: "string", enum: ["高", "中", "低"] },
						},
					},
				},
				salesContributionCandidates: {
					type: "array",
					items: {
						type: "object",
						additionalProperties: false,
						required: [
							"title",
							"type",
							"category",
							"impact",
							"comment",
							"evidenceQuote",
							"confidence",
						],
						properties: {
							title: { type: "string" },
							type: { type: "string", enum: [...SALES_CONTRIBUTION_TYPE_OPTIONS] },
							category: {
								type: "string",
								enum: [...SALES_CONTRIBUTION_CATEGORY_OPTIONS],
							},
							impact: { type: "string", enum: [...CONTRIBUTION_IMPACT_OPTIONS] },
							comment: { type: "string" },
							evidenceQuote: { type: "string" },
							confidence: { type: "string", enum: ["高", "中", "低"] },
						},
					},
				},
			},
		},
	},
} as const;

export const MANAGER_REVIEW_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "manager_review_wall",
		strict: true,
		schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"summary",
				"managerTalkingPoints",
				"strengths",
				"risks",
				"coachingTheme",
				"nextMonthTheme",
				"confirmationItems",
				"recommendedStatus",
			],
			properties: {
				summary: { type: "string" },
				managerTalkingPoints: {
					type: "array",
					items: { type: "string" },
				},
				strengths: {
					type: "array",
					items: { type: "string" },
				},
				risks: {
					type: "array",
					items: { type: "string" },
				},
				coachingTheme: { type: "string" },
				nextMonthTheme: { type: "string" },
				confirmationItems: {
					type: "array",
					items: { type: "string" },
				},
				recommendedStatus: {
					type: "string",
					enum: ["レビュー中", "要確認"],
				},
			},
		},
	},
} as const;

export const SALES_PERFORMANCE_REVIEW_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "sales_performance_review",
		strict: true,
		schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"conclusion",
				"resultExplanation",
				"actionGuidance",
				"contributionView",
				"evidence",
				"personComment",
				"managerConfirmationItems",
				"nextMonthImprovements",
				"riskNotes",
				"recommendedStatus",
			],
			properties: {
				conclusion: { type: "string" },
				resultExplanation: { type: "string" },
				actionGuidance: { type: "string" },
				contributionView: { type: "string" },
				evidence: {
					type: "array",
					items: { type: "string" },
				},
				personComment: { type: "string" },
				managerConfirmationItems: {
					type: "array",
					items: { type: "string" },
				},
				nextMonthImprovements: {
					type: "array",
					items: { type: "string" },
				},
				riskNotes: {
					type: "array",
					items: { type: "string" },
				},
				recommendedStatus: {
					type: "string",
					enum: ["処理済", "要確認"],
				},
			},
		},
	},
} as const;

export const MEETING_FEEDBACK_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "meeting_feedback",
		strict: true,
		schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"directFeedback",
				"goodPoints",
				"improvementPoints",
				"nextQuestions",
				"nextAction",
				"status",
				"memo",
			],
			properties: {
				directFeedback: { type: "string" },
				goodPoints: {
					type: "array",
					items: { type: "string" },
				},
				improvementPoints: {
					type: "array",
					items: { type: "string" },
				},
				nextQuestions: {
					type: "array",
					items: { type: "string" },
				},
				nextAction: { type: "string" },
				status: {
					type: "string",
					enum: ["返却済", "要確認", "対象外"],
				},
				memo: { type: "string" },
			},
		},
	},
} as const;

export const MEETING_PREP_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "meeting_prep_report",
		strict: true,
		schema: {
			type: "object",
			additionalProperties: false,
			required: ["profile", "threeC", "hypothesis", "questions", "risks", "body"],
			properties: {
				profile: { type: "string" },
				threeC: { type: "string" },
				hypothesis: { type: "string" },
				questions: { type: "string" },
				risks: { type: "string" },
				body: { type: "string" },
			},
		},
	},
} as const;

export const DEAL_MEETING_FEEDBACK_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "deal_meeting_feedback",
		strict: true,
		schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"score",
				"salesFeedback",
				"improvementPoints",
				"nextTalkImage",
				"followMailHint",
				"closingHint",
				"status",
				"memo",
			],
			properties: {
				score: { type: "number", minimum: 0, maximum: 100 },
				salesFeedback: { type: "string" },
				improvementPoints: {
					type: "array",
					items: { type: "string" },
				},
				nextTalkImage: { type: "string" },
				followMailHint: { type: "string" },
				closingHint: { type: "string" },
				status: {
					type: "string",
					enum: ["返却済", "要確認", "対象外"],
				},
				memo: { type: "string" },
			},
		},
	},
} as const;

export const DEAL_NEXT_ACTION_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "deal_next_action",
		strict: true,
		schema: {
			type: "object",
			additionalProperties: false,
			required: ["status", "memo", "actions"],
			properties: {
				status: {
					type: "string",
					enum: ["作成候補あり", "要確認", "対象外"],
				},
				memo: { type: "string" },
				actions: {
					type: "array",
					maxItems: 5,
					items: {
						type: "object",
						additionalProperties: false,
						required: [
							"title",
							"description",
							"priority",
							"taskType",
							"dueText",
							"dueDate",
							"requiresHumanCheck",
						],
						properties: {
							title: { type: "string" },
							description: { type: "string" },
							priority: { type: "string", enum: ["高", "中", "低"] },
							taskType: {
								type: "string",
								enum: ["確認・調査", "書類作成", "顧客フォロー", "社内タスク"],
							},
							dueText: { type: "string" },
							dueDate: { type: "string" },
							requiresHumanCheck: { type: "boolean" },
						},
					},
				},
			},
		},
	},
} as const;

export const SALES_TALK_FINALIZE_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "sales_talk_finalize",
		strict: true,
		schema: {
			type: "object",
			additionalProperties: false,
			required: ["status", "memo", "talks"],
			properties: {
				status: {
					type: "string",
					enum: ["作成候補あり", "要確認", "対象外"],
				},
				memo: { type: "string" },
				talks: {
					type: "array",
					minItems: 0,
					maxItems: 3,
					items: {
						type: "object",
						additionalProperties: false,
						required: [
							"title",
							"hook",
							"script",
							"target",
							"objectionHandling",
							"nextAction",
							"usage",
							"importance",
							"status",
							"memo",
						],
						properties: {
							title: { type: "string" },
							hook: { type: "string" },
							script: { type: "string" },
							target: { type: "string" },
							objectionHandling: { type: "string" },
							nextAction: { type: "string" },
							usage: {
								type: "array",
								maxItems: 3,
								items: {
									type: "string",
									enum: [
										"話題作り",
										"初回つかみ",
										"反論返し",
										"クロージング前",
										"関係構築",
									],
								},
							},
							importance: {
								type: "string",
								enum: ["🔴 必ず使う", "🟡 余裕あれば", "⚪ ストック"],
							},
							status: { type: "string", enum: ["使える", "要修正"] },
							memo: { type: "string" },
						},
					},
				},
			},
		},
	},
} as const;

type SafePatch =
	| { kind: "text"; value: string }
	| {
		kind: "text-with-revision";
		oldValue: string;
		newValue: string;
		reason: string;
		checkedAt: string;
		sourceUrl?: string;
	}
	| { kind: "select"; value: string }
	| { kind: "number"; value: number }
	| { kind: "date"; value: string }
	| { kind: "checkbox"; value: boolean }
	| { kind: "multi_select"; values: string[] }
	| { kind: "people"; ids: string[] }
	| { kind: "relation"; ids: string[] }
	| { kind: "clear" };

worker.tool("processBusinessCardById", {
	title: "WAJO 名刺1件を処理",
	description:
		"指定した名刺ページIDをWorker本流で処理します。テスト時はdryRun=trueで書き込みなし確認ができます。",
	schema: j.object({
		pageId: j.string().describe("名刺管理DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		force: j.boolean().describe("trueなら処理済みステータスを無視して再実行します"),
		registerExternalAdvisor: j
			.boolean()
			.describe("trueなら企業連携ではなく社外顧問DB登録ラインへ送ります。新規capabilityを増やさないための明示フラグ。"),
		autoCreateMeetingPrepReport: j
			.boolean()
			.describe("後方互換用。第1段階の名刺入口では指定されても商談前準備レポートを自動作成しません。"),
	}),
	outputSchema: j.object({
		pageId: j.string(),
		action: j.string(),
		companyId: j.string().nullable(),
		companyName: j.string().nullable(),
		message: j.string(),
	}),
	execute: async ({ pageId, dryRun, force = false, registerExternalAdvisor = false }, { notion }) => {
		const runOptions = readBusinessCardByIdRunOptions();
		return processBusinessCard(
			{
				pageId,
				dryRun,
				force: registerExternalAdvisor ? true : force,
				routing: registerExternalAdvisor ? "broker" : undefined,
				engagementIntent: registerExternalAdvisor ? "active" : undefined,
				registerExternalAdvisor,
				autoCreateMeetingPrepReport: runOptions.autoCreateMeetingPrepReport,
				deepResearch: registerExternalAdvisor ? false : runOptions.deepResearch,
			},
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processPendingBusinessCards", {
	title: "WAJO 未処理名刺をまとめて処理",
	description:
		"名刺管理DBから未処理名刺を拾い、企業DBへの紐づけ/作成と企業マスター高密度化まで行います。商談準備レポートは自動作成しません。",
	schema: j.object({
		limit: j.integer().describe("一度に処理する最大件数。通常は1から5"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		processed: j.integer(),
		results: j.array(
			j.object({
				pageId: j.string(),
				action: j.string(),
				companyId: j.string().nullable(),
				companyName: j.string().nullable(),
				message: j.string(),
			}),
		),
	}),
	execute: async ({ limit, dryRun }, { notion }) => {
		const safeLimit = Math.max(1, Math.min(limit || 1, MAX_PENDING_LIMIT));
		const runOptions = readPendingBusinessCardsRunOptions();
		const cards = await findPendingCards(notion as unknown as NotionClient, safeLimit);
		const results: CardResult[] = [];
		for (const card of cards) {
			results.push(
				await processBusinessCard(
					{
						pageId: card.id,
						pageData: card,
						dryRun,
						deepResearch: runOptions.deepResearch,
						autoCreateMeetingPrepReport: runOptions.autoCreateMeetingPrepReport,
					},
					notion as unknown as NotionClient,
				),
			);
		}
		return { processed: results.length, results };
	},
});

worker.tool("processInquiryCompanyLinkById", {
	title: "WAJO お問い合わせ→企業連携",
	description:
		"お問い合わせDBの1件を企業DBへ紐づけます。既存企業・重複問い合わせを確認し、同じ企業の二重作成を防ぎます。",
	schema: j.object({
		inquiryPageId: j.string().describe("お問い合わせDBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		inquiryPageId: j.string(),
		action: j.string(),
		companyId: j.string().nullable(),
		companyName: j.string().nullable(),
		message: j.string(),
	}),
	execute: async ({ inquiryPageId, dryRun }, { notion }) => {
		return processInquiryCompanyLink(
			{ inquiryPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processInquiryProjectCreationById", {
	title: "WAJO 問い合わせの案件化",
	description:
		"お問い合わせDBのページIDから案件管理DBに案件を1件だけ作成します。既に紐づき案件がある場合は新規作成せず、二重案件化を防ぎます。",
	schema: j.object({
		inquiryPageId: j.string().describe("お問い合わせDBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		inquiryPageId: j.string(),
		action: j.string(),
		projectId: j.string().nullable(),
		created: j.integer(),
		message: j.string(),
	}),
	execute: async ({ inquiryPageId, dryRun }, { notion }) => {
		return processInquiryProjectCreation(
			inquiryPageId,
			notion as unknown as NotionClient,
			undefined,
			Boolean(dryRun),
		);
	},
});

worker.tool("processProjectDealStartById", {
	title: "WAJO 案件から商談を作る",
	description:
		"案件管理DBのページIDから商談管理DBへ商談を1件だけ作成します。案件・関連企業・担当営業を引き継ぎます。進行中の商談が既にある場合は新規作成せず、二重作成を防ぎます（成約/失注済みは進行中扱いしません）。",
	schema: j.object({
		projectPageId: j.string().describe("案件管理DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		projectPageId: j.string(),
		dealPageId: j.string().nullable(),
		dealUrl: j.string().nullable(),
		action: j.string(),
		message: j.string(),
	}),
	execute: async ({ projectPageId, dryRun }, { notion }) => {
		return processProjectDealStart(
			{ projectPageId, dryRun: Boolean(dryRun) },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processInquiryEmailIntake", {
	title: "WAJO 問い合わせメール入口",
	description:
		"Gmail/Yoomなどから渡された問い合わせメール本文を受け取り、Worker側で重複判定してお問い合わせDBへ1件だけ作成します。必要なら企業連携Workerまで続けます。",
	schema: j.object({
		subject: j.string().describe("メール件名"),
		from: j.string().describe("送信者。フォーム通知の場合はメール本文内のメールアドレスを優先します"),
		to: j.string().describe("宛先"),
		body: j.string().describe("メール本文"),
		receivedAt: j.string().describe("受信日時。ISO文字列が望ましい"),
		gmailMessageId: j.string().describe("Gmail内部メールID。重複防止の第一キー"),
		messageId: j.string().describe("RFC Message-ID。分からない場合は空文字"),
		threadId: j.string().describe("Gmail Thread-ID。分からない場合は空文字"),
		labels: j.string().describe("Gmailラベル。カンマ区切りでも可"),
		sourceUrl: j.string().describe("Gmail原文リンク。分からない場合は空文字"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		linkCompany: j.boolean().describe("trueなら作成後にお問い合わせ→企業連携AIも実行します"),
	}),
	outputSchema: j.object({
		inquiryPageId: j.string().nullable(),
		action: j.string(),
		companyAction: j.string().nullable(),
		message: j.string(),
	}),
	execute: async (input, { notion }) => {
		return processInquiryEmailIntake(
			input as InquiryEmailIntakeInput,
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processGmailInquiryInbox", {
	title: "WAJO Gmail問い合わせ直読み",
	description:
		"Gmailの問い合わせラベルから未処理メールを読み、問い合わせメール入口へ渡します。成功時はINQUIRY_DONEラベルを付け、元の問い合わせラベルを外します。",
	schema: j.object({
		dryRun: j.boolean().describe("trueならNotion作成やGmailラベル変更を行いません"),
		limit: j.integer().describe("一度に処理する最大件数。未指定時10、最大50"),
		query: j.string().describe("Gmail検索条件。空ならnewer_than:7d"),
		sourceLabelName: j.string().describe("読み取り元ラベル。空なら問い合わせ"),
		doneLabelName: j.string().describe("完了ラベル。空ならINQUIRY_DONE"),
		removeSourceLabel: j.boolean().describe("成功時に読み取り元ラベルを外すか"),
		linkCompany: j.boolean().describe("問い合わせ作成後に企業連携まで実行するか"),
	}),
	outputSchema: j.object({
		action: j.string(),
		checked: j.integer(),
		created: j.integer(),
		existing: j.integer(),
		ignored: j.integer(),
		labelled: j.integer(),
		errors: j.integer(),
		dryRunReady: j.integer(),
		message: j.string(),
		samples: j.array(j.string()),
	}),
	execute: async (input, { notion }) => {
		return processGmailInquiryInbox(
			input as GmailInquiryInboxInput,
			notion as unknown as NotionClient,
			createGmailApiClient(await googleGmailAuth.accessToken()),
		);
	},
});

worker.tool("createCustomerContactLog", {
	title: "WAJO 顧客接点ログ作成",
		description:
			"問い合わせ/案件/商談/成約のページIDと、活動種別・活動内容・次回アクションから顧客接点ログDBへ1件作成します。ステータスや評価点は変更しません。",
		schema: j.object({
			sourcePageId: j.string().describe("問い合わせ/案件/商談/成約の元ページID。空なら未紐づきで作成します"),
		sourceType: j.string().describe("問い合わせ / 案件 / 商談 / 成約 / その他"),
		activityType: j.string().describe("電話 / メール / Zoom / 現地調査 / 測量 など"),
		activityContent: j.string().describe("活動内容。1行で十分です"),
		nextAction: j.string().describe("次回アクション。1行で十分です"),
		occurredAt: j.string().describe("接点日。空なら今日の日付を使います"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		contactLogPageId: j.string().nullable(),
		action: j.string(),
		message: j.string(),
	}),
	execute: async (input, { notion }) => {
		return createCustomerContactLog(
			input as CustomerContactLogInput,
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("reflectCustomerContactLogsToActivityLogs", {
	title: "WAJO 顧客接点ログ→活動ログ反映",
	description:
		"顧客接点ログDBの未反映/反映候補を活動ログDBへ集約し、元ログを反映済みにします。評価確定や点数変更は行いません。",
	schema: j.object({
		limit: j.integer().describe("一度に確認する最大件数。1から100。空なら20件"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		workerRunId: j.string().describe("任意の実行ID。空ならWorker側で生成します"),
	}),
	outputSchema: j.object({
		scanned: j.integer(),
		created: j.integer(),
		skipped: j.integer(),
		errors: j.integer(),
	}),
	execute: async ({ limit, dryRun, workerRunId }, { notion }) => {
		return reflectCustomerContactLogsToActivityLogs(
			{ limit, dryRun, workerRunId },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("reflectSpeechLogsToActivityLogs", {
	title: "WAJO 発言ログ→活動ログ反映",
	description:
		"発言ログDBの未集約レコードを活動ログDBへ集約します。評価確定や点数変更は行いません。",
	schema: j.object({
		limit: j.integer().describe("一度に確認する最大件数。1から100。空なら20件"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		workerRunId: j.string().describe("任意の実行ID。空なら元発言ページIDから生成します"),
	}),
	outputSchema: j.object({
		scanned: j.integer(),
		created: j.integer(),
		skipped: j.integer(),
		errors: j.integer(),
	}),
	execute: async ({ limit, dryRun, workerRunId }, { notion }) => {
		return reflectSpeechLogsToActivityLogs(
			{ limit, dryRun, workerRunId },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("reflectSalesContributionLogsToActivityLogs", {
	title: "WAJO 営業貢献ログ→活動ログ反映",
	description:
		"営業貢献ログDBの未反映/反映候補を活動ログDBへ集約し、元ログを反映済みにします。評価確定や点数変更は行いません。",
	schema: j.object({
		limit: j.integer().describe("一度に確認する最大件数。1から100。空なら20件"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		workerRunId: j.string().describe("任意の実行ID。空なら元貢献ページIDから生成します"),
	}),
	outputSchema: j.object({
		scanned: j.integer(),
		created: j.integer(),
		skipped: j.integer(),
		errors: j.integer(),
	}),
	execute: async ({ limit, dryRun, workerRunId }, { notion }) => {
		return reflectSalesContributionLogsToActivityLogs(
			{ limit, dryRun, workerRunId },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("reflectHitomiMemosToActivityLogs", {
	title: "WAJO 人見さんメモ→補助ログ反映",
	description:
		"人見さんメモDBの月次確認候補を活動ログDBへ補助文脈として集約します。評価対象にはせず、評価確定や点数変更は行いません。",
	schema: j.object({
		limit: j.integer().describe("一度に確認する最大件数。1から100。空なら20件"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		workerRunId: j.string().describe("任意の実行ID。空なら元メモページIDから生成します"),
	}),
	outputSchema: j.object({
		scanned: j.integer(),
		created: j.integer(),
		skipped: j.integer(),
		errors: j.integer(),
	}),
	execute: async ({ limit, dryRun, workerRunId }, { notion }) => {
		return reflectHitomiMemosToActivityLogs(
			{ limit, dryRun, workerRunId },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("reflectWaniPoMemoriesToActivityLogs", {
	title: "WAJO ワニポメモリー→補助ログ反映",
	description:
		"ワニポメモリーDBの本人共有済み/反映候補を活動ログDBへ補助文脈として集約します。評価対象にはせず、評価確定や点数変更は行いません。",
	schema: j.object({
		limit: j.integer().describe("一度に確認する最大件数。1から100。空なら20件"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		workerRunId: j.string().describe("任意の実行ID。空なら元メモページIDから生成します"),
	}),
	outputSchema: j.object({
		scanned: j.integer(),
		created: j.integer(),
		skipped: j.integer(),
		errors: j.integer(),
	}),
	execute: async ({ limit, dryRun, workerRunId }, { notion }) => {
		return reflectWaniPoMemoriesToActivityLogs(
			{ limit, dryRun, workerRunId },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("reflectAiConsultationsToActivityLogs", {
	title: "WAJO AI相談受付→補助ログ反映",
	description:
		"AI相談受付DBの完了相談を活動ログDBへ補助文脈として集約します。評価対象にはせず、評価確定や点数変更は行いません。",
	schema: j.object({
		limit: j.integer().describe("一度に確認する最大件数。1から100。空なら20件"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		workerRunId: j.string().describe("任意の実行ID。空なら元相談ページIDから生成します"),
	}),
	outputSchema: j.object({
		scanned: j.integer(),
		created: j.integer(),
		skipped: j.integer(),
		errors: j.integer(),
	}),
	execute: async ({ limit, dryRun, workerRunId }, { notion }) => {
		return reflectAiConsultationsToActivityLogs(
			{ limit, dryRun, workerRunId },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("linkActivityLogsToSalesPerformance", {
	title: "WAJO 活動ログ→月次営業評価リンク",
	description:
		"活動ログDBの評価対象ログを、活動者と活動日時から該当する営業マンパフォーマンス月次ページへ紐づけます。点数、ランク、評価ステータスは変更しません。",
	schema: j.object({
		limit: j.integer().describe("一度に確認する最大件数。1から100。空なら20件"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		scanned: j.integer(),
		linked: j.integer(),
		skipped: j.integer(),
		errors: j.integer(),
	}),
	execute: async ({ limit, dryRun }, { notion }) => {
		return linkActivityLogsToSalesPerformance(
			{ limit, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("refreshSalesPipelineSignal", {
	title: "WAJO 案件化/成約 温度計更新",
	description:
		"問い合わせまたは案件ページIDを指定し、顧客接点ログ等から案件化近さ/成約近さ、停滞時間、次アクションを再計算します。本体ステータスは変更しません。",
	schema: j.object({
		pageId: j.string().describe("問い合わせDBまたは案件管理DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		pageId: j.string(),
		action: j.string(),
		message: j.string(),
	}),
	execute: async ({ pageId, dryRun }, { notion }) => {
		const result = await refreshSalesPipelineSignal(
			pageId,
			notion as unknown as NotionClient,
			undefined,
			Boolean(dryRun),
		);
		return {
			pageId: result.pageId,
			action: result.action,
			message: result.message,
		};
	},
});

worker.tool("backfillCustomerContactLogDisplays", {
	title: "WAJO 顧客接点ログ 表示名整形",
	description:
		"既存の顧客接点ログを、日付・活動種別・活動内容だけの短い表示に整えます。関連先のステータスや数字は変更しません。",
	schema: j.object({
		limit: j.number().describe("処理する最大件数。通常は50程度"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		action: j.string(),
		checked: j.number(),
		updated: j.number(),
		message: j.string(),
	}),
	execute: async ({ limit, dryRun }, { notion }) => {
		return backfillCustomerContactLogDisplays(
			{ limit, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("cleanInquiryTitles", {
	title: "WAJO 問い合わせタイトル整形",
	description:
		"問い合わせDBの件名を、分類コード・相手・売買区分が分かる短い表示名に整えます。元のメール件名は元メール件名へ残します。",
	schema: j.object({
		limit: j.number().describe("処理する最大件数。通常は50程度"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		action: j.string(),
		checked: j.number(),
		updated: j.number(),
		message: j.string(),
	}),
	execute: async ({ limit, dryRun }, { notion }) => {
		return cleanInquiryTitles(
			{ limit, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("assignInquiryReceptionNumbers", {
	title: "WAJO 問い合わせ受付番号付与",
	description:
		"問い合わせDBに受付番号を付け、件名を 受付番号｜分類｜相手｜売買区分 の短い表示名に整えます。",
	schema: j.object({
		limit: j.number().describe("処理する最大件数。通常は100程度"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		action: j.string(),
		checked: j.number(),
		updated: j.number(),
		message: j.string(),
	}),
	execute: async ({ limit, dryRun }, { notion }) => {
		return assignInquiryReceptionNumbers(
			{ limit, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processMeetingPrepReportByCompanyId", {
	title: "WAJO 商談前準備レポート作成",
	description:
		"企業マスターのページIDから商談前準備レポートを作成/補完します。既にボタンで空レポートが作られている場合は最新の空レポートを埋めます。",
	schema: j.object({
		companyPageId: j.string().describe("企業マスターDBのページID"),
		reportPageId: j
			.string()
			.describe("既存の商談準備レポートページID。空なら同企業の既存レポートを再利用します(1社1枚)"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		force: j
			.boolean()
			.describe("trueなら鮮度ゲートを無視して作り直す。通常はfalse(30日以内の再生成は止まる)"),
	}),
	outputSchema: j.object({
		companyId: j.string(),
		reportId: j.string().nullable(),
		reportUrl: j.string().nullable(),
		action: j.string(),
		message: j.string(),
	}),
	execute: async ({ companyPageId, reportPageId, dryRun, force }, { notion }) => {
		return processMeetingPrepReport(
			{ companyPageId, reportPageId: reportPageId || undefined, dryRun, force },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processResidentDocumentById", {
	title: "WAJO 住民説明会資料作成チェック",
	description:
		"住民説明会ページIDを受け取り、必須入力を上から順にチェックします。未入力があれば最初の1項目だけ返して停止します。",
	schema: j.object({
		pageId: j.string().describe("住民説明会/事前周知DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		pageId: j.string(),
		action: j.string(),
		status: j.string(),
		missingField: j.string().nullable(),
		message: j.string(),
	}),
	execute: async ({ pageId, dryRun }, { notion }) => {
		return processResidentDocument(
			{ pageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processProposalSimulationById", {
	title: "WAJO 提案シミュレーション実行チェック",
	description:
		"提案ページIDを受け取り、必須入力を上から順にチェックして利回り試算を作ります。未入力があれば最初の1項目だけ返して停止します。",
	schema: j.object({
		pageId: j.string().describe("案件/発電所/見積ページのNotionページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		pageId: j.string(),
		action: j.string(),
		status: j.string(),
		missingField: j.string().nullable(),
		grossProfit: j.number().nullable(),
		expectedYield: j.number().nullable(),
		paybackYears: j.number().nullable(),
		message: j.string(),
	}),
	execute: async ({ pageId, dryRun }, { notion }) => {
		return processProposalSimulation(
			{ pageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processProjectProposalRequestById", {
	title: "WAJO 案件から提案シミュレーション依頼作成",
	description:
		"案件管理DBのページIDから営業資料作成依頼DBに提案シミュレーション依頼を1件作成し、案件側へリレーションで戻します。",
	schema: j.object({
		projectPageId: j.string().describe("案件管理DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		projectPageId: j.string(),
		requestPageId: j.string().nullable(),
		action: j.string(),
		message: j.string(),
	}),
	execute: async ({ projectPageId, dryRun }, { notion }) => {
		return processProjectProposalRequest(
			{ projectPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processProjectResidentDocumentRequestById", {
	title: "WAJO 案件から説明会用資料依頼作成",
	description:
		"案件管理DBのページIDから営業資料作成依頼DBに住民説明会/近隣周知資料の依頼を1件作成し、案件側へリレーションで戻します。",
	schema: j.object({
		projectPageId: j.string().describe("案件管理DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		projectPageId: j.string(),
		requestPageId: j.string().nullable(),
		action: j.string(),
		message: j.string(),
	}),
	execute: async ({ projectPageId, dryRun }, { notion }) => {
		return processProjectResidentDocumentRequest(
			{ projectPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processProjectEquipmentDetailRequestById", {
	title: "WAJO 案件から発電所設備詳細作成",
	description:
		"案件管理DBのページIDから発電所設備詳細DBを1件だけ作成し、案件側へリレーションで戻します。",
	schema: j.object({
		projectPageId: j.string().describe("案件管理DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		projectPageId: j.string(),
		equipmentPageId: j.string().nullable(),
		action: j.string(),
		message: j.string(),
	}),
	execute: async ({ projectPageId, dryRun }, { notion }) => {
		return processProjectEquipmentDetailRequest(
			{ projectPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processCompanyResearchById", {
	title: "WAJO 企業評価・3C補完",
	description:
		"企業マスターのページIDから企業評価と3Cを補完します。3C三項目が揃うまで企業調査ステータスを完了にしません。",
	schema: j.object({
		companyPageId: j.string().describe("企業マスターDBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		companyId: j.string(),
		action: j.string(),
		message: j.string(),
	}),
	execute: async ({ companyPageId, dryRun }, { notion }) => {
		return processCompanyResearch(
			{ companyPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processCreditCheckById", {
	title: "WAJO 与信を取る(本命のみ・課金)",
	description:
		"企業マスターのページIDからTDB確報与信(COSMOSNet)を取得します。マネージャーのみ・1社単位課金(≒1,320〜1,760円)・調査年月日が新しければ再購入しません。",
	schema: j.object({
		companyPageId: j.string().describe("企業マスターDBのページID"),
		requesterUserId: j
			.string()
			.describe("実行者のNotionユーザーID(MANAGER_USER_IDSと照合)。空なら権限なし扱い"),
		dryRun: j.boolean().describe("trueなら課金も書き込みもしません"),
		force: j
			.boolean()
			.describe("trueなら調査年月日が新しくても再取得(追加課金)。通常はfalse"),
	}),
	outputSchema: j.object({
		companyId: j.string(),
		action: j.string(),
		message: j.string(),
	}),
	execute: async ({ companyPageId, requesterUserId, dryRun, force }, { notion }) => {
		return processCreditCheck(
			{ companyPageId, requesterUserId, dryRun, force },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processMeetingMemoFormatById", {
	title: "WAJO ミーティングメモ整形",
	description:
		"ミーティングデータベースのページIDから、Meeting Notes本文または既存本文を読み、要約・議事内容・決定事項・アクション項目へ整理します。発言ログ・営業貢献ログ(評価材料候補)は既定ではプレビューのみで、generateEvaluationLogs=true の明示時だけ生成します。タスク作成や商談更新、評価確定は行いません。",
	schema: j.object({
		meetingPageId: j.string().describe("ミーティングデータベースのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		generateEvaluationLogs: j.boolean().describe("trueの場合のみ、発言ログ・営業貢献ログの評価材料候補を実作成します"),
	}),
	outputSchema: j.object({
		meetingPageId: j.string(),
		action: j.string(),
		status: j.string(),
		message: j.string(),
	}),
	execute: async ({ meetingPageId, dryRun, generateEvaluationLogs }, { notion }) => {
		return processMeetingMemoFormat(
			{ meetingPageId, dryRun, generateEvaluationLogs },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processMeetingFeedbackById", {
	title: "WAJO ミーティングフィードバック",
	description:
		"ミーティングデータベースのページIDから、整形済み内容を読み、次が良くなる率直フィードバックを返します。タスク作成や商談更新、評価確定は行いません。",
	schema: j.object({
		meetingPageId: j.string().describe("ミーティングデータベースのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		meetingPageId: j.string(),
		action: j.string(),
		status: j.string(),
		message: j.string(),
	}),
	execute: async ({ meetingPageId, dryRun }, { notion }) => {
		return processMeetingFeedback(
			{ meetingPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processMeetingDealLinkById", {
	title: "WAJO ミーティング→商談連携",
	description:
		"ミーティングデータベースのうち、種別またはタグが商談のページだけを商談管理DBへ紐づけます。関連企業1社の商談だけを対象にし、既存商談がある場合は新規作成しません。",
	schema: j.object({
		meetingPageId: j.string().describe("ミーティングデータベースのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		meetingPageId: j.string(),
		dealPageId: j.string().nullable(),
		action: j.string(),
		message: j.string(),
	}),
	execute: async ({ meetingPageId, dryRun }, { notion }) => {
		return processMeetingDealLink(
			{ meetingPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processMeetingTasksById", {
	title: "WAJO ミーティングタスク振り分け",
	description:
		"ミーティングデータベースのアクション項目からチームトラッカーへタスクを作成します。関連ミーティングで既存タスクを確認し、二重作成を防ぎます。",
	schema: j.object({
		meetingPageId: j.string().describe("ミーティングデータベースのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		meetingPageId: j.string(),
		action: j.string(),
		created: j.integer(),
		skipped: j.integer(),
		message: j.string(),
	}),
	execute: async ({ meetingPageId, dryRun }, { notion }) => {
		return processMeetingTasks(
			{ meetingPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processMeetingKnowledgeById", {
	title: "WAJO ミーティングナレッジ候補化",
	description:
		"ミーティングデータベースの内容から社内ナレッジDBへ未承認候補を作成します。既存の元ミーティングrelationで二重作成を防ぎます。",
	schema: j.object({
		meetingPageId: j.string().describe("ミーティングデータベースのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		meetingPageId: j.string(),
		action: j.string(),
		created: j.integer(),
		candidates: j.integer(),
		knowledgePageId: j.string().nullable(),
		message: j.string(),
	}),
	execute: async ({ meetingPageId, dryRun }, { notion }) => {
		return processMeetingKnowledge(
			{ meetingPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("quickStartMeetingByType", {
	title: "WAJO ミーティング開始",
	description:
		"ミーティングデータベースに、本日のミーティングページを作成します。商談はquickStartDealで商談データベースへ作成します。",
	schema: j.object({
		meetingType: j
			.string()
			.describe("ミーティング、営業会議、1on1など。旧値はタグ候補としてミーティングへ寄せます。商談はquickStartDealを使います。"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		meetingPageId: j.string().nullable(),
		meetingUrl: j.string().nullable(),
		action: j.string(),
		meetingType: j.string(),
		meetingDate: j.string(),
		title: j.string(),
		message: j.string(),
	}),
	execute: async ({ meetingType, dryRun }, { notion }) => {
		return processMeetingQuickStart(
			{ meetingType, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("quickStartDeal", {
	title: "WAJO 商談を作る",
	description:
		"商談データベースに本日の商談ページを作成します。会議/ミーティングDBには作成しません。関連企業未設定のため要確認で止めます。",
	schema: j.object({
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		dealPageId: j.string().nullable(),
		dealUrl: j.string().nullable(),
		action: j.string(),
		dealDate: j.string(),
		title: j.string(),
		message: j.string(),
	}),
	execute: async ({ dryRun }, { notion }) => {
		return processDealQuickStart(
			{ dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processManagerReviewById", {
	title: "WAJO 人見さん壁打ち補助",
	description:
		"マネージャー評価DBのページIDを受け取り、評価確定ではなく、マネージャーが確認する壁打ちメモと次月テーマを返します。",
	schema: j.object({
		managerReviewPageId: j.string().describe("マネージャー評価DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		managerReviewPageId: j.string(),
		action: j.string(),
		status: j.string(),
		message: j.string(),
	}),
	execute: async ({ managerReviewPageId, dryRun }, { notion }) => {
		return processManagerReview(
			{ managerReviewPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processSalesPerformanceReviewById", {
	title: "WAJO 人見さん営業評価案",
	description:
		"営業パフォーマンスDBのページIDを受け取り、評価確定ではなく、人見さんの一次評価案、上司確認事項、次月改善ポイントだけを返します。",
	schema: j.object({
		salesPerformancePageId: j.string().describe("営業パフォーマンスDBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		salesPerformancePageId: j.string(),
		action: j.string(),
		status: j.string(),
		message: j.string(),
		sourcePreview: j.array(j.string()),
	}),
	execute: async ({ salesPerformancePageId, dryRun }, { notion }) => {
		return processSalesPerformanceReview(
			{ salesPerformancePageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processDailyReportReceiptSyncById", {
	title: "WAJO WANiPO日報受付票同期",
	description:
		"日報受付票DBのページIDを受け取り、生成対象日報のAI5項目から受付票のAIフィードバック、明日へのひとこと、重点確認ポイント、依頼状態を同期します。日報原本は書き換えません。",
	schema: j.object({
		receiptPageId: j.string().describe("日報受付票DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		receiptPageId: j.string(),
		dailyReportPageId: j.string().nullable(),
		action: j.string(),
		status: j.string(),
		message: j.string(),
	}),
	execute: async ({ receiptPageId, dryRun }, { notion }) => {
		return processDailyReportReceiptSync(
			{ receiptPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processDailyReportLogById", {
	title: "WAJO WANiPO日報ログ化",
	description:
		"承認済み日報を日報ログDBへ評価材料化します。日報原本は書き換えず、点数付け・最終評価・総合評価は行いません。",
	schema: j.object({
		dailyReportPageId: j.string().describe("日報DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		dailyReportPageId: j.string(),
		logPageId: j.string().nullable(),
		action: j.string(),
		status: j.string(),
		message: j.string(),
	}),
	execute: async ({ dailyReportPageId, dryRun }, { notion }) => {
		return processDailyReportLog(
			{ dailyReportPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processLandEvaluationById", {
	title: "WAJO 土地詳細評価",
	description:
		"土地情報DBのページIDから、住所・面積を起点に土地評価、電力仮説、案件化候補、次アクションを返します。ボタン起動の後段処理として使います。",
	schema: j.object({
		pageId: j.string().describe("土地情報DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		pageId: j.string(),
		action: j.string(),
		overallGrade: j.string(),
		score: j.number(),
		bucket: j.string(),
		message: j.string(),
	}),
	execute: async ({ pageId, dryRun }, { notion }) => {
		return processLandEvaluation(
			{ pageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processLandCaseById", {
	title: "WAJO 土地の案件化",
	description:
		"土地情報DBのページIDから案件管理DBに土地案件を作成します。既に関連案件がある場合は新規作成せず、同一土地の重複案件化を防ぎます。",
	schema: j.object({
		landPageId: j.string().describe("土地情報DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		landPageId: j.string(),
		action: j.string(),
		projectId: j.string().nullable(),
		created: j.integer(),
		message: j.string(),
	}),
	execute: async ({ landPageId, dryRun }, { notion }) => {
		return processLandCaseCreation(
			{ landPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processDealMeetingFeedbackById", {
	title: "WAJO 商談議事録フィードバック",
	description:
		"商談管理DBのページIDを受け取り、関連会議議事録から営業スコア、営業フィードバック、改善ポイント、次回トークを返します。タスク作成や成約判断は行いません。",
	schema: j.object({
		dealPageId: j.string().describe("商談管理DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		dealPageId: j.string(),
		action: j.string(),
		score: j.number().nullable(),
		message: j.string(),
	}),
	execute: async ({ dealPageId, dryRun }, { notion }) => {
		return processDealMeetingFeedback(
			{ dealPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processDealFeedbackSecondReviewById", {
	title: "WAJO 商談フィードバック二次レビュー",
	description:
		"商談管理DBのページIDを受け取り、一次AIフィードバックをChatGPT（gpt-4o-mini）で二次レビューします。一次フィードバック欄は上書きしません。",
	schema: j.object({
		dealPageId: j.string().describe("商談管理DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		dealPageId: j.string(),
		action: j.string(),
		quality: j.string().nullable(),
		message: j.string(),
	}),
	execute: async ({ dealPageId, dryRun }, { notion }) => {
		return processDealFeedbackSecondReview(
			{ dealPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processDealNextActionsById", {
	title: "WAJO ネクストアクションAI",
	description:
		"商談管理DBのページIDを受け取り、営業フィードバックからチームトラッカーの次アクション候補を作成します。既存の関連タスクを見て重複作成を防ぎます。",
	schema: j.object({
		dealPageId: j.string().describe("商談管理DBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		dealPageId: j.string(),
		action: j.string(),
		created: j.integer(),
		skipped: j.integer(),
		message: j.string(),
	}),
	execute: async ({ dealPageId, dryRun }, { notion }) => {
		return processDealNextActions(
			{ dealPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("collectSalesNews", {
	title: "WAJO ニュース収集Worker",
	description:
		"RSS/Googleニュース検索からWAJO向け業界ニュースを収集し、業界ニュースDBへ重複なしで候補登録します。必要なら営業トーク生成文まで作ります。",
	schema: j.object({
		limit: j.integer().describe("作成候補の最大件数。通常は3から10"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
		autoGenerateTalk: j
			.boolean()
			.describe("trueならニュース候補に営業トーク生成文も入れます"),
		autoFinalize: j
			.boolean()
			.describe("trueなら営業トーク管理DBへの仕上げまで続けます"),
	}),
	outputSchema: j.object({
		action: j.string(),
		fetched: j.integer(),
		candidates: j.integer(),
		created: j.integer(),
		skipped: j.integer(),
		finalized: j.integer(),
		pages: j.array(j.string()),
		message: j.string(),
	}),
	execute: async ({ limit, dryRun, autoGenerateTalk, autoFinalize }, { notion }) => {
		return collectSalesNews(
			{ limit, dryRun, autoGenerateTalk, autoFinalize },
			notion as unknown as NotionClient,
		);
	},
});

worker.tool("processSalesTalkFinalizeByNewsId", {
	title: "WAJO 営業トーク管理DB仕上げ",
	description:
		"業界ニュースの営業トーク生成文を読み、営業トーク管理DBの実戦項目（つかみ、セリフ、刺さる相手、反論返し、次アクション）へ3ネタまで整理します。重複作成は防ぎます。",
	schema: j.object({
		newsPageId: j.string().describe("業界ニュースDBのページID"),
		dryRun: j.boolean().describe("trueならNotionへ書き込みません"),
	}),
	outputSchema: j.object({
		newsPageId: j.string(),
		action: j.string(),
		updated: j.integer(),
		created: j.integer(),
		message: j.string(),
	}),
	execute: async ({ newsPageId, dryRun }, { notion }) => {
		return processSalesTalkFinalize(
			{ newsPageId, dryRun },
			notion as unknown as NotionClient,
		);
	},
});

worker.webhook("processBusinessCardImageWebhook", {
	title: "WAJO 名刺画像インテイクWebhook(新ショートカット用)",
	description:
		"iPhoneショートカットから名刺画像(base64)＋振り分け＋担当者を受け取り、OCR→名刺ページ作成→振り分け(企業/ブローカー/あとで)→企業連携・A深掘りまで実行します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = coerceWebhookBodyRecord(event.body);
			const imageBase64 = firstString(
				body.imageBase64,
				body.image,
				body["画像"],
			);
			if (!imageBase64) {
				throw new Error(
					"imageBase64 / image / 画像 のいずれにも名刺画像(base64)がありません。",
				);
			}
			await processBusinessCardImage(
				{
					imageBase64,
					routing: firstString(body.routing, body["振り分け"]),
					engagementIntent: firstString(
						body.engagementIntent,
						body.relationshipIntent,
						body.followIntent,
						body["営業判断"],
						body["熱量"],
					),
					assigneeUserId: firstString(
						body.assigneeUserId,
						body["担当者"],
						extractTriggerUserIdFromWebhook(body),
					),
					dryRun: body.dryRun === true,
				},
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.tool("processBusinessCardImage", {
	title: "WAJO 名刺画像インテイク",
	description:
		"名刺画像(base64)からOCR→名刺ページ作成→振り分け→企業連携を実行します。activeでも商談準備レポートは自動作成せず、企業マスター高密度化までに止めます。",
	schema: j.object({
		imageBase64: j.string().describe("名刺画像のbase64(データURL可)"),
		routing: j
			.string()
			.describe("撮影時の振り分け: 企業 / 社外顧問 / あとで。空なら企業扱い"),
		engagementIntent: j
			.string()
			.describe("営業判断: 本気で追う / 名刺だけ保存。空なら本気で追う"),
		assigneeUserId: j.string().describe("担当営業のNotionユーザーID。空なら未設定"),
		dryRun: j.boolean().describe("trueならOCRのみ実行し書き込みません"),
	}),
	outputSchema: j.object({
		pageId: j.string().nullable(),
		action: j.string(),
		companyId: j.string().nullable(),
		message: j.string(),
	}),
	execute: async ({ imageBase64, routing, engagementIntent, assigneeUserId, dryRun }, { notion }) => {
		return processBusinessCardImage(
			{
				imageBase64,
				routing: routing || undefined,
				engagementIntent: engagementIntent || undefined,
				assigneeUserId: assigneeUserId || undefined,
				dryRun,
			},
			notion as unknown as NotionClient,
		);
	},
});

worker.webhook("processBusinessCardWebhook", {
	title: "WAJO 名刺処理Webhook",
	description:
		"外部サービスやNotion webhookから名刺処理を起動します。body.pageId があれば1件処理、なければ未処理を拾います。activeでも商談準備レポートは自動作成せず、企業マスター高密度化までに止めます。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = coerceWebhookBodyRecord(event.body);
			const runOptions = readBusinessCardRunOptions(body);
			const pageId = readBusinessCardWebhookPageId(body);
			if (runOptions.registerExternalAdvisor && !pageId) {
				throw new Error("registerExternalAdvisor=true は単一の pageId 指定時だけ使用できます。");
			}
			const limit =
				typeof body.limit === "number"
					? Math.max(1, Math.min(body.limit, MAX_PENDING_LIMIT))
					: 1;
			if (pageId) {
				await processBusinessCard(
					{
						pageId,
						routing: runOptions.routing,
						engagementIntent: runOptions.engagementIntent,
						dryRun: false,
						deepResearch: runOptions.deepResearch,
						autoCreateMeetingPrepReport: runOptions.autoCreateMeetingPrepReport,
						registerExternalAdvisor: runOptions.registerExternalAdvisor,
					},
					notion as unknown as NotionClient,
				);
				continue;
			}
			const cards = await findPendingCards(notion as unknown as NotionClient, limit);
			for (const card of cards) {
				await processBusinessCard(
					{
						pageId: card.id,
						pageData: card,
						routing: runOptions.routing,
						engagementIntent: runOptions.engagementIntent,
						dryRun: false,
						deepResearch: runOptions.deepResearch,
						autoCreateMeetingPrepReport: runOptions.autoCreateMeetingPrepReport,
					},
					notion as unknown as NotionClient,
				);
			}
		}
	},
});

worker.webhook("processBusinessCardLinkWebhook", {
	title: "WAJO 名刺連携のみWebhook",
	description:
		"名刺管理DB上の単一名刺を、外部調査・企業マスター高密度化なしで企業連携まで実行します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = coerceWebhookBodyRecord(event.body);
			const pageId = readBusinessCardWebhookPageId(body);
			if (!pageId) {
				throw new Error("pageId / page_id / entity.id のいずれからも名刺ページIDを特定できませんでした。");
			}
			await processBusinessCard(
				{
					pageId,
					dryRun: false,
					deepResearch: false,
					autoCreateMeetingPrepReport: false,
				},
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processBusinessCardResearchWebhook", {
	title: "WAJO 名刺調査Webhook",
	description:
		"名刺管理DB上の単一名刺を、第1段階の調査入口として外部調査・企業マスター高密度化まで実行します。商談準備レポートは自動作成しません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = coerceWebhookBodyRecord(event.body);
			const pageId = readBusinessCardWebhookPageId(body);
			if (!pageId) {
				throw new Error("pageId / page_id / entity.id のいずれからも名刺ページIDを特定できませんでした。");
			}
			const runOptions = readBusinessCardResearchWebhookRunOptions();
			await processBusinessCard(
				{
					pageId,
					dryRun: false,
					deepResearch: runOptions.deepResearch,
					autoCreateMeetingPrepReport: runOptions.autoCreateMeetingPrepReport,
					force: true,
				},
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processInquiryCompanyLinkWebhook", {
	title: "WAJO お問い合わせ→企業連携Webhook",
	description:
		"お問い合わせDBのページIDを受け取り、既存企業との照合・重複停止・必要時の企業作成を行います。商談やタスクは作成しません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const inquiryPageId = extractInquiryPageIdFromWebhook(body);
			if (!inquiryPageId) {
				throw new Error(
					"inquiryPageId / pageId / entity.id のいずれからも問い合わせページIDを特定できませんでした。",
				);
			}
			await processInquiryCompanyLink(
				{ inquiryPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processInquiryAssignOwnerWebhook", {
	title: "WAJO 問い合わせ 担当になるWebhook",
	description:
		"お問い合わせDBの「担当になる」ボタンから起動。担当営業ユーザーが空欄のときだけクリックしたユーザーを担当にし、既に担当者がいる場合は上書きしません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const inquiryPageId = extractInquiryPageIdFromWebhook(body);
			if (!inquiryPageId) {
				throw new Error(
					"inquiryPageId / pageId / entity.id のいずれからも問い合わせページIDを特定できませんでした。",
				);
			}
			const triggerUserId = extractTriggerUserIdFromWebhook(body);
			if (!triggerUserId) {
				throw new Error(
					"user.id / triggered_by.id / userId のいずれからもクリックしたユーザーIDを特定できませんでした。",
				);
			}
			await processInquiryAssignOwner(
				inquiryPageId,
				triggerUserId,
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processInquiryProjectCreationWebhook", {
	title: "WAJO 問い合わせ 案件化Webhook",
	description:
		"お問い合わせDBの「案件化する」ボタンから起動。既に紐づき案件がある場合は新規作成せず、案件管理DBへの二重登録を防ぎます。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const inquiryPageId = extractInquiryPageIdFromWebhook(body);
			if (!inquiryPageId) {
				throw new Error(
					"inquiryPageId / pageId / entity.id のいずれからも問い合わせページIDを特定できませんでした。",
				);
			}
			await processInquiryProjectCreation(
				inquiryPageId,
				notion as unknown as NotionClient,
				extractTriggerUserIdFromWebhook(body),
				false,
			);
		}
	},
});

worker.webhook("processProjectDealStartWebhook", {
	title: "WAJO 案件 商談化Webhook",
	description:
		"案件管理DBの「商談をする」ボタンから起動。商談管理DBへ商談を1件作成し、案件・関連企業・担当を引き継ぎます。進行中の商談が既にある場合は新規作成せず、二重作成を防ぎます。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const projectPageId = extractProjectPageIdFromWebhook(body);
			if (!projectPageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			await processProjectDealStart(
				{ projectPageId, dryRun: false },
				notion as unknown as NotionClient,
				extractTriggerUserIdFromWebhook(body),
			);
		}
	},
});

worker.webhook("processInquiryEmailIntakeWebhook", {
	title: "WAJO 問い合わせメール入口Webhook",
	description:
		"Gmail/Yoomなどから問い合わせメール本文を受け取り、Worker側で重複判定・お問い合わせDB作成・必要時の企業連携まで行います。Yoom側の有無分岐やNotion作成を置き換える入口です。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			await processInquiryEmailIntake(
				readInquiryEmailIntakeInputFromWebhook(body),
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("createCustomerContactLogWebhook", {
	title: "WAJO 顧客接点ログ作成Webhook",
	description:
		"問い合わせ/案件/商談ページの活動ボタンから、顧客接点ログDBへ軽量ログを作成します。ステータスや評価点は変更しません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			await createCustomerContactLog(
				readCustomerContactLogInputFromWebhook(body),
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("refreshSalesPipelineSignalWebhook", {
	title: "WAJO 案件化/成約 温度計更新Webhook",
	description:
		"問い合わせまたは案件ページの温度計を再計算します。案件化近さ/成約近さ、停滞時間、次アクションのみ更新し、本体ステータスは変更しません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const pageId =
				extractInquiryPageIdFromWebhook(body) ||
				extractProjectPageIdFromWebhook(body) ||
				extractWebhookPageId(body);
			if (!pageId) {
				throw new Error(
					"pageId / inquiryPageId / projectPageId / entity.id のいずれからもページIDを特定できませんでした。",
				);
			}
			await refreshSalesPipelineSignal(pageId, notion as unknown as NotionClient);
		}
	},
});

worker.webhook("processCompanyResearchWebhook", {
	title: "WAJO 企業評価・3C補完Webhook",
	description:
		"企業マスターのページIDを受け取り、企業評価と3C三項目を補完します。3C不足時は完了ではなく要確認で止めます。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const companyPageId = await resolveCompanyPageIdFromWebhook(
				body,
				notion as unknown as NotionClient,
			);
			if (!companyPageId) {
				throw new Error(
					"companyPageId/pageId または企業名から対象企業を特定できないため、企業評価を実行できません。",
				);
			}
			await processCompanyResearch(
				{ companyPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processCreditCheckWebhook", {
	title: "WAJO 与信を取る(本命のみ)Webhook",
	description:
		"企業マスターの「与信を取る(本命のみ)」ボタンから起動。マネージャーのみTDB確報与信を1社単位で取得します(課金)。押した人がMANAGER_USER_IDSに無い場合は課金せず停止します。",
	execute: async (events, { notion }) => {
		// 課金エンドポイントはフェイルクローズ(検品指摘①): シークレット未設定なら動かない
		if (!(process.env.WAJO_WORKER_WEBHOOK_SECRET ?? "").trim()) {
			throw new Error(
				"WAJO_WORKER_WEBHOOK_SECRET が未設定のため、課金Webhookは実行しません(フェイルクローズ)。",
			);
		}
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			// 課金は誤爆禁止(検品指摘・軽微): 企業名の部分一致フォールバックは使わず、
			// ページIDが明示されている時だけ実行する
			const companyPageId = extractWebhookPageId(body);
			if (!companyPageId) {
				throw new Error(
					"課金WebhookはページID必須です(企業名からの曖昧検索は誤課金防止のため使いません)。ボタンのWebhook設定でページIDを送ってください。",
				);
			}
			const requesterUserId = extractTriggerUserIdFromWebhook(body);
			await processCreditCheck(
				{ companyPageId, requesterUserId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processMeetingMemoFormatWebhook", {
	title: "WAJO ミーティングメモ整形Webhook",
	description:
		"ミーティングデータベースのページIDを受け取り、Meeting Notes本文または既存本文をDBプロパティへ整理します。発言ログ・営業貢献ログ(評価材料候補)はプレビューのみで実作成しません。チームトラッカーや商談管理DB、評価確定は更新しません。",
	execute: async (events, { notion }) => {
		// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const meetingPageId = extractMeetingPageIdFromWebhook(body);
			if (!meetingPageId) {
				throw new Error(
					"meetingPageId / pageId / entity.id のいずれからも会議ページIDを特定できませんでした。",
				);
			}
			await processMeetingMemoFormat(
				{ meetingPageId, dryRun: false, generateEvaluationLogs: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processMeetingFeedbackWebhook", {
	title: "WAJO ミーティングフィードバックWebhook",
	description:
		"ミーティングデータベースのページIDを受け取り、整形済み内容から率直フィードバックを返します。タスク作成、商談更新、評価確定は行いません。",
	execute: async (events, { notion }) => {
		// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const meetingPageId = extractMeetingPageIdFromWebhook(body);
			if (!meetingPageId) {
				throw new Error(
					"meetingPageId / pageId / entity.id のいずれからも会議ページIDを特定できませんでした。",
				);
			}
			await processMeetingFeedback(
				{ meetingPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processMeetingDealLinkWebhook", {
	title: "WAJO ミーティング→商談連携Webhook",
	description:
		"ミーティングデータベースのページIDを受け取り、種別またはタグが商談のページだけを商談管理DBへ紐づけます。関連企業が一意でない場合は要確認で停止します。",
	execute: async (events, { notion }) => {
		// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const meetingPageId = extractMeetingPageIdFromWebhook(body);
			if (!meetingPageId) {
				throw new Error(
					"meetingPageId / pageId / entity.id のいずれからも会議ページIDを特定できませんでした。",
				);
			}
			await processMeetingDealLink(
				{ meetingPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processMeetingTasksWebhook", {
	title: "WAJO ミーティングタスク振り分けWebhook",
	description:
		"ミーティングデータベースのページIDを受け取り、アクション項目からチームトラッカーへタスクを作成します。既存関連タスクがある場合は二重作成しません。",
	execute: async (events, { notion }) => {
		// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const meetingPageId = extractMeetingPageIdFromWebhook(body);
			if (!meetingPageId) {
				throw new Error(
					"meetingPageId / pageId / entity.id のいずれからも会議ページIDを特定できませんでした。",
				);
			}
			await processMeetingTasks(
				{ meetingPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processMeetingKnowledgeWebhook", {
	title: "WAJO ミーティングナレッジ候補化Webhook",
	description:
		"ミーティングデータベースのページIDを受け取り、社内ナレッジDBへ未承認候補を作成します。既存候補がある場合は二重作成しません。",
	execute: async (events, { notion }) => {
		// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const meetingPageId = extractMeetingPageIdFromWebhook(body);
			if (!meetingPageId) {
				throw new Error(
					"meetingPageId / pageId / entity.id のいずれからも会議ページIDを特定できませんでした。",
				);
			}
			await processMeetingKnowledge(
				{ meetingPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

registerMeetingQuickStartWebhook(
	"quickStartMeetingWebhook",
	"WAJO ミーティングを始めるWebhook",
	"ミーティング",
);
// Capability上限(100件)を超えるため、商談クイック起動Webhookの重複エイリアスは登録しない。
// 残す正本: quickStartDealWebhook。外す旧/曖昧エイリアス: quickStartDealMeetingWebhook。
registerDealQuickStartWebhook(
	"quickStartDealWebhook",
	"WAJO 商談を作るWebhook",
);

worker.webhook("processManagerReviewWebhook", {
	title: "WAJO 人見さん壁打ち補助Webhook",
	description:
		"マネージャー評価DBのページIDを受け取り、評価確定ではなく壁打ちメモと次月テーマだけを返します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const managerReviewPageId = extractManagerReviewPageIdFromWebhook(body);
			if (!managerReviewPageId) {
				throw new Error(
					"managerReviewPageId / pageId / entity.id のいずれからもマネージャー評価ページIDを特定できませんでした。",
				);
			}
			await processManagerReview(
				{ managerReviewPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processSalesPerformanceReviewWebhook", {
	title: "WAJO 人見さん営業評価案Webhook",
	description:
		"営業パフォーマンスDBのページIDを受け取り、評価確定ではなく一次評価案・上司確認事項・次月改善ポイントだけを返します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const salesPerformancePageId = extractSalesPerformancePageIdFromWebhook(body);
			if (!salesPerformancePageId) {
				throw new Error(
					"salesPerformancePageId / pageId / entity.id のいずれからも営業パフォーマンスページIDを特定できませんでした。",
				);
			}
			await processSalesPerformanceReview(
				{ salesPerformancePageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("attachMonthlyEvalPdfWebhook", {
	title: "WAJO 月次評価PDF添付Webhook",
	description:
		"月次評価レコードのページIDからPDFを生成し、評価PDFプロパティへ添付します。",
	execute: async (events, { notion }) => {
		// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const evalPageId = extractMonthlyEvalPageIdFromWebhook(body);
			if (!evalPageId) {
				throw new Error(
					"evalPageId / monthlyEvalPageId / pageId / entity.id のいずれからも月次評価ページIDを特定できませんでした。",
				);
			}
			await attachMonthlyEvalPdf(evalPageId, notion as unknown as NotionClient);
		}
	},
});

// ── 人見さん月次評価：データ層（A の前段。元ソースDBから「人×月」の材料を収集しページへ追記）──
// 2026-06-25。データ点検君（A）はページ本文を読むので、ここで実データを入れておけば
// 「A が空ページを読むだけ」を解消できる。
// ★捏造しないため、プロパティ名は実コードで検証済みのものだけ使う：
//   ・営業パフォーマンス(月次成績)＝対象営業ユーザー×開始日(当月)×期間種別=月次
//     （findSalesPerformanceForActivity / createMonthlyPerformanceRecord と同一の実プロパティ）
//   ・当月の活動＝活動ログDBの「関連営業パフォーマンス」relation を月次成績ページIDで逆引き
//     （linkActivityLogsToSalesPerformance と同一の実relation。件数のみ＝他プロパティは推測しない）
//   ・ノルマ申請/日報/会議発言/1on1/ツール/ナレッジは「人×月」の実フィルタが未確認のため
//     本データ層では収集しない（推測で書かない）。次段で各DBの実プロパティ確認後に配線する。
async function gatherHitomiSourceData(
	notion: NotionClient,
	evalPageId: string,
	materialPageId: string,
	now: Date,
): Promise<void> {
	const evalPage = (await notion.pages.retrieve({ page_id: evalPageId })) as Page;
	const props = evalPage.properties ?? {};
	const salesPersonIds = personIdsFromProperty(props["対象営業ユーザー"]);
	const salesPersonName =
		personLabelsFromProperty(props["対象営業ユーザー"]).join("、") || "(対象者未設定)";
	const { monthStart, nextMonthStart, monthLabel } = monthWindowJST(now);

	const lines: string[] = [
		`対象者: ${salesPersonName}`,
		`対象月: ${monthLabel}（${monthStart} 以上 〜 ${nextMonthStart} 未満）`,
		"",
	];

	if (salesPersonIds.length === 0) {
		lines.push(
			"⚠️ 対象営業ユーザー未設定のため定量データを収集できません。データ点検君（A）は『NG／目標未確定』相当として扱うこと。",
		);
	} else {
		// 1) 営業パフォーマンス(月次成績) を 対象営業ユーザー×当月 で引く（検証済み実プロパティ）
		let perfPage: Page | undefined;
		for (const userId of salesPersonIds) {
			try {
				const res = await notion.dataSources.query({
					data_source_id: SALES_PERFORMANCE_DATA_SOURCE_ID,
					page_size: 10,
					filter: {
						and: [
							{ property: "対象営業ユーザー", people: { contains: userId } },
							{ property: "開始日", date: { on_or_after: monthStart } },
							{ property: "開始日", date: { before: nextMonthStart } },
						],
					},
				});
				const results = res.results as Page[];
				perfPage = results.find((p) => text(p.properties?.["期間種別"]) === "月次") ?? results[0];
				if (perfPage) break;
			} catch (error) {
				lines.push(`（営業パフォーマンス検索エラー: ${String(error).slice(0, 160)}）`);
			}
		}

		lines.push("【定量】営業パフォーマンス＝月次成績DB");
		if (!perfPage) {
			lines.push(
				"当月の月次成績レコードが見つかりません。粗利・成約・商談は『データ源が空＝保留候補』として扱う（実力0点ではない）。",
			);
		} else {
			const pp = perfPage.properties ?? {};
			const gross = numberValue(pp["実績粗利額（自動）"]);
			// 粗利目標の実プロパティは「粗利目標（申請DB）」。
			// （probe-hitomi-datalayer.mjs でライブ照合：「粗利目標」「目標粗利額」は当DBに非存在＝使わない）
			const target = numberValue(pp["粗利目標（申請DB）"]);
			const closings = relationIdsFromProperty(pp["関連成約"]).length;
			lines.push(`月次成績ページID: ${perfPage.id}`);
			lines.push(`実績粗利額（自動）: ${gross === null ? "（空＝保留候補）" : formatYen(gross)}`);
			lines.push(
				target === null || target === undefined
					? "粗利目標: （未設定＝目標未確定→粗利は保留）"
					: `粗利目標: ${formatYen(target)}`,
			);
			if (gross !== null && target !== null && target !== undefined && target > 0) {
				lines.push(`粗利達成率（実績粗利/粗利目標）: ${formatPercent(gross / target)}`);
			}
			lines.push(`関連成約 件数: ${closings} 件`);

			// 2) 当月の活動ログを「関連営業パフォーマンス」relation で逆引き（件数のみ＝推測なし）
			try {
				const actRes = await notion.dataSources.query({
					data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID,
					page_size: 100,
					filter: { property: "関連営業パフォーマンス", relation: { contains: perfPage.id } },
				});
				lines.push("");
				lines.push("【活動】活動ログDB（当月成績に紐づくもの）");
				lines.push(`紐づく活動ログ 件数: ${actRes.results.length}${actRes.has_more ? "+（100件超）" : ""} 件`);
			} catch (error) {
				lines.push(`（活動ログ逆引きエラー: ${String(error).slice(0, 160)}）`);
			}
		}
		// ── 3) 対象者プロフィール＝スタッフマスターDB（氏名の正本・属性・年間目標・1on1回数）──
		//   A〜F は本ページ本文を読むため、ここで置けば6体全員が参照できる（DB中継）。
		//   氏名はここを正本にし、A〜F の出力での表記揺れ・誤記を防ぐ。
		try {
			let staffPage: Page | undefined;
			for (const userId of salesPersonIds) {
				const staffRes = await notion.dataSources.query({
					data_source_id: STAFF_MASTER_DATA_SOURCE_ID,
					page_size: 5,
					filter: { property: "Notionユーザー", people: { contains: userId } },
				});
				staffPage = (staffRes.results as Page[])[0];
				if (staffPage) break;
			}
			lines.push("");
			lines.push("【対象者プロフィール】スタッフマスターDB（氏名はこの表記を正本として使うこと）");
			if (!staffPage) {
				lines.push("対象者のスタッフマスター行が見つかりません（氏名・属性は未取得）。");
			} else {
				const sp = staffPage.properties ?? {};
				const annualGross = numberValue(sp["年間粗利目標"]);
				const annualClose = numberValue(sp["年間成約目標"]);
				const oneCount = numberValue(sp["1on1実施回数"]);
				const mgrAvg = numberValue(sp["平均マネージャー評価スコア"]);
				lines.push(`氏名（正本）: ${text(sp["氏名"]) || "（空）"}`);
				lines.push(
					`役職: ${text(sp["役職"]) || "（空）"} ／ 部署: ${text(sp["部署"]) || "（空）"} ／ 評価タイプ: ${text(sp["評価タイプ"]) || "（空）"}`,
				);
				lines.push(
					`担当エリア: ${text(sp["担当エリア"]) || "（空）"} ／ 在籍: ${text(sp["在籍ステータス"]) || "（空）"} ／ 雇用形態: ${text(sp["雇用形態"]) || "（空）"}`,
				);
				lines.push(
					`年間粗利目標: ${annualGross === null ? "（空）" : formatYen(annualGross)} ／ 年間成約目標: ${annualClose === null ? "（空）" : `${annualClose}件`}`,
				);
				lines.push(
					`1on1実施回数（通算・自動）: ${oneCount === null ? "（空）" : oneCount} ／ 平均マネージャー評価（自動）: ${mgrAvg === null ? "（空）" : mgrAvg}`,
				);
				lines.push(
					"※スタッフマスターの『今月〜（自動）』値は現在月のスナップショットのため、過去月の評価では参照しない（当月評価のみ参考）。",
				);
			}
		} catch (error) {
			lines.push(`（スタッフマスター取得エラー: ${String(error).slice(0, 160)}）`);
		}

		// ── 4) チーム文脈＝チームトラッカーDB（対象者の担当タスク状況）──
		//   行動量・段取りの補助材料。加点減点の直接根拠にはしない。
		try {
			let tasks: Page[] = [];
			for (const userId of salesPersonIds) {
				const ttRes = await notion.dataSources.query({
					data_source_id: TEAM_TRACKER_DATA_SOURCE_ID,
					page_size: 100,
					filter: { property: "タスク担当者", people: { contains: userId } },
				});
				tasks = ttRes.results as Page[];
				if (tasks.length) break;
			}
			lines.push("");
			lines.push("【チーム文脈】チームトラッカーDB（対象者の担当タスク。補助材料＝直接の加点減点根拠にしない）");
			if (!tasks.length) {
				lines.push("対象者担当のタスクは見つかりません。");
			} else {
				const byStatus: Record<string, number> = {};
				for (const t of tasks) {
					const st = text(t.properties?.["ステータス"]) || "未設定";
					byStatus[st] = (byStatus[st] ?? 0) + 1;
				}
				lines.push(`担当タスク総数: ${tasks.length}${tasks.length >= 100 ? "+（100件上限）" : ""} 件`);
				lines.push(
					`ステータス内訳: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}件`).join(" / ") || "（なし）"}`,
				);
			}
		} catch (error) {
			lines.push(`（チームトラッカー取得エラー: ${String(error).slice(0, 160)}）`);
		}
	}

	lines.push("");
	lines.push(
		"【次段・未配線（正直に明記）】ノルマ申請・日報・会議発言・1on1・ツール活用・ナレッジは、各DBの『人×月』実フィルタを確認後に配線する（現時点は未収集＝A は該当軸を保留候補扱い）。",
	);

	const children: Record<string, unknown>[] = [
		{
			object: "block",
			type: "heading_2",
			heading_2: {
				rich_text: [{ type: "text", text: { content: "自動収集データ（Workerが元DBから収集）" } }],
			},
		},
	];
	const body = lines.join("\n");
	for (let i = 0; i < body.length; i += 1800) {
		children.push({
			object: "block",
			type: "paragraph",
			paragraph: { rich_text: [{ type: "text", text: { content: body.slice(i, i + 1800) || " " } }] },
		});
	}
	await appendBlocksIfAny(notion, materialPageId, children);
}

worker.webhook("processHitomiEvalChainWebhook", {
	title: "WAJO 人見さん月次評価 6体自動連鎖Webhook",
	description:
		"月次評価レコードのページIDを受け取り、A→B→C→D→C再→D再→E→F の6体エージェントを自動連鎖で実行し各結果をページへ追記します。最終確定はグループ長。",
	execute: async (events, { notion }) => {
		// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const evalPageId = extractMonthlyEvalPageIdFromWebhook(body);
			if (!evalPageId) {
				throw new Error(
					"evalPageId / monthlyEvalPageId / pageId / entity.id のいずれからも月次評価ページIDを特定できませんでした。",
				);
			}
			// A の前にデータ層を実行：元ソースDBから「人×月」の材料をページへ追記する。
			// A〜Eの検討は「月次評価ワークログDB」（石橋大右ダッシュボード配下）に1評価=1レコードで蓄積する。
			const evalPg = (await (notion as unknown as NotionClient).pages.retrieve({ page_id: evalPageId })) as Page;
			const ep = evalPg.properties ?? {};
			const workName = `${text(ep["評価名"]) || "月次評価"}｜A〜E作業ログ`;
			const targetMonth = text(ep["対象月"]);
			const workPage = await (notion as unknown as NotionClient).pages.create({
				parent: { data_source_id: HITOMI_EVAL_WORKLOG_DATA_SOURCE_ID },
				properties: {
					Name: { title: [{ type: "text", text: { content: workName } }] },
					対象月: targetMonth ? { rich_text: [{ type: "text", text: { content: targetMonth } }] } : { rich_text: [] },
					対象営業ユーザー: { people: personIdsFromProperty(ep["対象営業ユーザー"]).map((id) => ({ id })) },
					月次評価ページ: { url: (evalPg as { url?: string }).url ?? null },
					ステータス: { select: { name: "処理中" } },
				},
			});
			const workId = workPage.id;
			await gatherHitomiSourceData(notion as unknown as NotionClient, evalPageId, workId, new Date());
			await runHitomiEvalChain(notion as never, workId, evalPageId);
			await (notion as unknown as NotionClient).pages.update({ page_id: workId, properties: { ステータス: { select: { name: "完了" } } } });
		}
	},
});

worker.webhook("processDailyReportReceiptSyncWebhook", {
	title: "WAJO WANiPO日報受付票同期Webhook",
	description:
		"日報受付票DBのページIDを受け取り、生成対象日報のAI5項目を受付票へ同期します。日報原本は書き換えません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const receiptPageId = extractDailyReportReceiptPageIdFromWebhook(body);
			if (!receiptPageId) {
				throw new Error(
					"receiptPageId / pageId / entity.id のいずれからも日報受付票ページIDを特定できませんでした。",
				);
			}
			await processDailyReportReceiptSync(
				{ receiptPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processDailyReportLogWebhook", {
	title: "WAJO WANiPO日報ログ化Webhook",
	description:
		"日報DBのページIDを受け取り、承認済み日報だけを日報ログDBへ評価材料化します。点数付けや最終評価は行いません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const dailyReportPageId = extractDailyReportPageIdFromWebhook(body);
			if (!dailyReportPageId) {
				throw new Error(
					"dailyReportPageId / pageId / entity.id のいずれからも日報ページIDを特定できませんでした。",
				);
			}
			await processDailyReportLog(
				{ dailyReportPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processLandEvaluationWebhook", {
	title: "WAJO 土地詳細評価Webhook",
	description:
		"土地情報DBのページIDを受け取り、住所・面積を起点に土地評価と案件化候補を返します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const pageId =
				extractWebhookLandPageId(body) ??
				(await resolveLandPageIdFromWebhook(body, notion as unknown as NotionClient));
			if (!pageId) {
				throw new Error(
					"landPageId/pageId または土地名称/所在地/面積から対象土地を特定できないため、土地評価を実行できません。",
				);
			}
			await processLandEvaluation(
				{ pageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processLandCaseWebhook", {
	title: "WAJO 土地の案件化Webhook",
	description:
		"土地情報DBのページIDを受け取り、案件管理DBに土地案件を作成します。既存関連案件がある場合は重複作成しません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const landPageId =
				extractWebhookLandPageId(body) ??
				(await resolveLandPageIdFromWebhook(body, notion as unknown as NotionClient));
			if (!landPageId) {
				throw new Error(
					"landPageId/pageId または土地名称/所在地/面積から対象土地を特定できないため、土地案件化を実行できません。",
				);
			}
			await processLandCaseCreation(
				{ landPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processMeetingPrepReportWebhook", {
	title: "WAJO 商談前準備レポートWebhook",
	description:
		"企業マスターのページIDを受け取り、商談前準備レポートDBの最新空レポートを補完します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const companyPageId = await resolveCompanyPageIdFromWebhook(
				body,
				notion as unknown as NotionClient,
			);
			const reportPageId = firstString(
				body.reportPageId,
				body.report_page_id,
				readNestedString(body, ["data", "reportPageId"]),
			);
			if (!companyPageId) {
				throw new Error(
					"companyPageId が見つからないため、商談準備レポートを作成できません。",
				);
			}
			await processMeetingPrepReport(
				{ companyPageId, reportPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processResidentDocumentWebhook", {
	title: "WAJO 住民説明会資料作成Webhook",
	description:
		"住民説明会ページIDを受け取り、必須入力を上から順にチェックします。未入力があれば最初の1項目だけ返して停止します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const pageId = extractResidentDocumentPageIdFromWebhook(body);
			if (!pageId) {
				throw new Error(
					"residentPageId / pageId / entity.id のいずれからも住民説明会ページIDを特定できませんでした。",
				);
			}
			const result = await processResidentDocument(
				{ pageId, dryRun: false },
				notion as unknown as NotionClient,
			);
			if (result.action === "needs-input") throw new Error(result.message);
		}
	},
});

worker.webhook("processProposalSimulationWebhook", {
	title: "WAJO 提案シミュレーションWebhook",
	description:
		"提案ページIDを受け取り、必須入力を上から順にチェックして利回り試算を作ります。未入力があれば最初の1項目だけ返して停止します。",
	execute: async (events, { notion }) => {
		// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const pageId = extractProposalSimulationPageIdFromWebhook(body);
			if (!pageId) {
				throw new Error(
					"proposalPageId / pageId / entity.id のいずれからも提案シミュレーション対象ページIDを特定できませんでした。",
				);
			}
			const result = await processProposalSimulation(
				{ pageId, dryRun: false },
				notion as unknown as NotionClient,
			);
			if (result.action === "needs-input") throw new Error(result.message);
		}
	},
});

worker.webhook("processProjectProposalRequestWebhook", {
	title: "WAJO 案件から提案シミュレーション依頼作成Webhook",
	description:
		"案件管理DBのページIDを受け取り、営業資料作成依頼DBに提案シミュレーション依頼を作成して案件側へ紐づけます。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const projectPageId = extractProjectPageIdFromWebhook(body);
			if (!projectPageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			const result = await processProjectProposalRequest(
				{ projectPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
			if (result.action === "needs-input") throw new Error(result.message);
		}
	},
});

worker.webhook("processProjectResidentDocumentRequestWebhook", {
	title: "WAJO 案件から説明会用資料依頼作成Webhook",
	description:
		"案件管理DBのページIDを受け取り、営業資料作成依頼DBに住民説明会/近隣周知資料の依頼を作成して案件側へ紐づけます。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const projectPageId = extractProjectPageIdFromWebhook(body);
			if (!projectPageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			const result = await processProjectResidentDocumentRequest(
				{ projectPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
			if (result.action === "needs-input") throw new Error(result.message);
		}
	},
});

worker.webhook("processProjectEquipmentDetailRequestWebhook", {
	title: "WAJO 案件から発電所設備詳細作成Webhook",
	description:
		"案件管理DBのページIDを受け取り、発電所設備詳細DBを1件だけ作成して案件側へ紐づけます。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const projectPageId = extractProjectPageIdFromWebhook(body);
			if (!projectPageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			await processProjectEquipmentDetailRequest(
				{ projectPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processDealMeetingFeedbackWebhook", {
	title: "WAJO 商談議事録フィードバックWebhook",
	description:
		"dealPageId / pageId / entity.id のいずれかから商談ページを特定し、関連会議議事録から営業フィードバックを返します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const dealPageId = extractDealPageIdFromWebhook(body);
			if (!dealPageId) {
				throw new Error(
					"dealPageId / pageId / entity.id のいずれからも商談ページIDを特定できませんでした。",
				);
			}
			await processDealMeetingFeedback(
				{ dealPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processDealFeedbackSecondReviewWebhook", {
	title: "WAJO 商談フィードバック二次レビューWebhook",
	description:
		"dealPageId / pageId / entity.id のいずれかから商談ページを特定し、一次フィードバックの二次レビューを実行します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const dealPageId = extractDealPageIdFromWebhook(body);
			if (!dealPageId) {
				throw new Error(
					"dealPageId / pageId / entity.id のいずれからも商談ページIDを特定できませんでした。",
				);
			}
			await processDealFeedbackSecondReview(
				{ dealPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processDealNextActionsWebhook", {
	title: "WAJO ネクストアクションAI Webhook",
	description:
		"dealPageId / pageId / entity.id のいずれかから商談ページを特定し、チームトラッカーへ次アクションを作成します。重複タスクは作成しません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const dealPageId = extractDealPageIdFromWebhook(body);
			if (!dealPageId) {
				throw new Error(
					"dealPageId / pageId / entity.id のいずれからも商談ページIDを特定できませんでした。",
				);
			}
			await processDealNextActions(
				{ dealPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("collectSalesNewsWebhook", {
	title: "WAJO ニュース収集Webhook",
	description:
		"RSS/Googleニュース検索からWAJO向け業界ニュースを収集し、業界ニュースDBへ候補登録します。商談・タスク・評価DBは更新しません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			await collectSalesNews(
				{
					limit: numberFromWebhookBody(body, "limit", 5),
					dryRun: booleanFromWebhookBody(body, "dryRun", false),
					autoGenerateTalk: booleanFromWebhookBody(body, "autoGenerateTalk", false),
					autoFinalize: booleanFromWebhookBody(body, "autoFinalize", false),
				},
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processSalesTalkFinalizeWebhook", {
	title: "WAJO 営業トーク管理DB仕上げWebhook",
	description:
		"newsPageId / pageId / entity.id のいずれかから業界ニュースを特定し、生成済み営業トークを営業トーク管理DBの実戦項目へ整理します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			verifyWebhookSecret(event.headers, event.body);
			const body = event.body as Record<string, unknown>;
			const newsPageId = extractNewsPageIdFromWebhook(body);
			if (!newsPageId) {
				throw new Error(
					"newsPageId / pageId / entity.id のいずれからも業界ニュースページIDを特定できませんでした。",
				);
			}
			await processSalesTalkFinalize(
				{ newsPageId, dryRun: false },
				notion as unknown as NotionClient,
			);
		}
	},
});

// ─── 成約報告ワンボタン パイプライン ────────────────────────────────────────

worker.webhook("processClosingReportWebhook", {
	title: "WAJO 成約報告Webhook",
	description:
		"案件管理DBまたは商談管理DBの「成約報告」ボタンから起動。商談ページの場合は関連案件を1件解決して、重複ガード付きで成約報告DBに成約レコードを作成し、案件ステータスを「🏆 成約」に更新します。マネージャーは後追いで差し戻し/取り消しを行います。",
	execute: async (events, { notion }) => {
		// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const sourcePageId = extractProjectPageIdFromWebhook(body);
			if (!sourcePageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			// ボタンを押したユーザーIDを取得（担当営業に自動セット）
			const triggerUserId = extractTriggerUserIdFromWebhook(body);
			await processClosingReportRequest(sourcePageId, notion as unknown as NotionClient, triggerUserId);
		}
	},
});

worker.webhook("processClosingCancelWebhook", {
	title: "WAJO 成約取り消しWebhook",
	description:
		"成約報告DBの「🔄 取り消す」ボタンから起動。締め前の成約報告を「取り消し」状態にし、案件DBのステータスを「📋 提案中」に戻します。歩合確定済みは取り消し不可。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const closingPageId = extractClosingReportPageIdFromWebhook(body);
			if (!closingPageId) {
				throw new Error(
					"closingPageId / pageId / entity.id のいずれからも成約報告ページIDを特定できませんでした。",
				);
			}
			// マネージャー操作なのにゲート無しだった穴を塞ぐ(1-1の5本と同型・既定monitorで挙動不変)
			const gateOk = await checkManagerApprovalGate(
				"processClosingCancelWebhook",
				body,
				closingPageId,
				notion as unknown as NotionClient,
			);
			if (!gateOk) continue;
			await cancelClosingReport(
				closingPageId,
				notion as unknown as NotionClient,
				extractManagerActionReasonFromWebhook(body),
				extractTriggerUserIdFromWebhook(body),
			);
		}
	},
});

worker.webhook("processClosingDismissWebhook", {
	title: "WAJO 成約差し戻しWebhook",
	description:
		"成約報告DBの「❌ 差し戻す」ボタンから起動。マネージャーが成約報告を差し戻し、承認ステータスを「差戻し」に変更。案件DBのステータスも「📋 提案中」に戻します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const closingPageId = extractClosingReportPageIdFromWebhook(body);
			if (!closingPageId) {
				throw new Error(
					"closingPageId / pageId / entity.id のいずれからも成約報告ページIDを特定できませんでした。",
				);
			}
			const gateOk = await checkManagerApprovalGate(
				"processClosingDismissWebhook",
				body,
				closingPageId,
				notion as unknown as NotionClient,
			);
			if (!gateOk) continue;
			await dismissClosingReport(
				closingPageId,
				notion as unknown as NotionClient,
				extractManagerActionReasonFromWebhook(body),
				extractTriggerUserIdFromWebhook(body),
			);
		}
	},
});

worker.webhook("processProjectDismissWebhook", {
	title: "WAJO 案件差し戻しWebhook",
	description:
		"案件管理DBのマネージャー用「差し戻し」ボタンから起動。案件を確認待ちに戻し、管理アクションメモを残します。成約報告DBや月次数字は直接変更しません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const projectPageId = extractProjectPageIdFromWebhook(body);
			if (!projectPageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			const gateOk = await checkManagerApprovalGate(
				"processProjectDismissWebhook",
				body,
				projectPageId,
				notion as unknown as NotionClient,
			);
			if (!gateOk) continue;
			await dismissProject(
				projectPageId,
				notion as unknown as NotionClient,
				extractManagerActionReasonFromWebhook(body),
			);
		}
	},
});

worker.webhook("processProjectCancelWebhook", {
	title: "WAJO 案件取り消しWebhook",
	description:
		"案件管理DBのマネージャー用「取り消し」ボタンから起動。案件を失注扱いにし、管理アクションメモを残します。ページ削除や関連DBの一括更新は行いません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const projectPageId = extractProjectPageIdFromWebhook(body);
			if (!projectPageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			const gateOk = await checkManagerApprovalGate(
				"processProjectCancelWebhook",
				body,
				projectPageId,
				notion as unknown as NotionClient,
			);
			if (!gateOk) continue;
			await cancelProject(
				projectPageId,
				notion as unknown as NotionClient,
				extractManagerActionReasonFromWebhook(body),
			);
		}
	},
});

worker.webhook("processInquiryLostWebhook", {
	title: "WAJO 問い合わせ失注Webhook",
	description:
		"お問い合わせDBの「失注にする」ボタンから起動。失注理由がある場合だけ問い合わせを失注にし、処理者・処理日・前フェーズ・監査ログを残します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const inquiryPageId = extractInquiryPageIdFromWebhook(body);
			if (!inquiryPageId) {
				throw new Error(
					"inquiryPageId / pageId / entity.id のいずれからも問い合わせページIDを特定できませんでした。",
				);
			}
			await processInquiryLost(inquiryPageId, notion as unknown as NotionClient, {
				reason: extractLostReasonFromWebhook(body),
				memo: extractLostMemoFromWebhook(body),
				triggerUserId: extractTriggerUserIdFromWebhook(body),
			});
		}
	},
});

worker.webhook("processProjectLostRequestWebhook", {
	title: "WAJO 案件失注申請Webhook",
	description:
		"案件管理DBの営業用「失注申請する」ボタンから起動。失注理由必須で、案件は失注確定ではなく失注申請中に止めます。申請事実は全員通知します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const projectPageId = extractProjectPageIdFromWebhook(body);
			if (!projectPageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			await processProjectLostRequest(projectPageId, notion as unknown as NotionClient, {
				reason: extractLostReasonFromWebhook(body),
				memo: extractLostMemoFromWebhook(body),
				triggerUserId: extractTriggerUserIdFromWebhook(body),
			});
		}
	},
});

worker.webhook("processProjectLostApproveWebhook", {
	title: "WAJO 案件失注承認Webhook",
	description:
		"マネージャー用の失注承認ボタンから起動。申請中の案件だけを正式に失注へ確定し、全員通知します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const projectPageId = extractProjectPageIdFromWebhook(body);
			if (!projectPageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			const gateOk = await checkManagerApprovalGate(
				"processProjectLostApproveWebhook",
				body,
				projectPageId,
				notion as unknown as NotionClient,
			);
			if (!gateOk) continue;
			await approveProjectLostRequest(projectPageId, notion as unknown as NotionClient, {
				memo: extractLostMemoFromWebhook(body) || extractManagerActionReasonFromWebhook(body),
				triggerUserId: extractTriggerUserIdFromWebhook(body),
				skipManagerGate: true,
			});
		}
	},
});

worker.webhook("processProjectLostRejectWebhook", {
	title: "WAJO 案件失注差し戻しWebhook",
	description:
		"マネージャー用の失注差し戻しボタンから起動。失注申請を差し戻し、案件を確認待ちへ戻して全員通知します。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const projectPageId = extractProjectPageIdFromWebhook(body);
			if (!projectPageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			const gateOk = await checkManagerApprovalGate(
				"processProjectLostRejectWebhook",
				body,
				projectPageId,
				notion as unknown as NotionClient,
			);
			if (!gateOk) continue;
			await rejectProjectLostRequest(projectPageId, notion as unknown as NotionClient, {
				memo: extractLostMemoFromWebhook(body) || extractManagerActionReasonFromWebhook(body),
				triggerUserId: extractTriggerUserIdFromWebhook(body),
				skipManagerGate: true,
			});
		}
	},
});

worker.webhook("notifySalesTeamWebhook", {
	title: "WAJO 営業部通知Webhook",
	description:
		"担当になる/案件化/成約など、Notionボタンの後段から営業部全員へコメント通知する汎用Webhookです。pageId と 通知種別/通知文 を受け取ります。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const pageId =
				extractProjectPageIdFromWebhook(body) ??
				extractClosingReportPageIdFromWebhook(body) ??
				extractWebhookLandPageId(body);
			if (!pageId) {
				throw new Error(
					"pageId / projectPageId / closingPageId / landPageId のいずれからも通知先ページIDを特定できませんでした。",
				);
			}
			const eventType = extractNotificationEventTypeFromWebhook(body);
			const salesTeamUserIds = extractSalesTeamUserIdsFromWebhook(body);
			await notifySalesTeam(
				notion as unknown as NotionClient,
				pageId,
				extractNotificationMessageFromWebhook(body, eventType),
				salesTeamUserIds.length > 0 ? salesTeamUserIds : SALES_TEAM_USER_IDS,
			);
		}
	},
});

// processMonthlyQuotaLinkWebhook（退役済み）は 2026-06-12 に登録ごと削除した。
// ノルマ申請DBは目標申請の原本とし、成約実績の月次反映は成約報告Workerが
// 営業マンパフォーマンスDBへ行う（WAJO_WORKER_RUNBOOK.md 参照）。

worker.webhook("processProjectWallHitWebhook", {
	title: "WAJO 案件壁打ちWebhook",
	description:
		"案件管理DBの「🤝 人見さんと壁打ちをする」ボタンから起動。案件情報をAIで分析し、壁打ちポイント・リスク・確認事項をページにコメントとして書き込みます。ステータス変更・成約判断は行いません。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const projectPageId = extractProjectPageIdFromWebhook(body);
			if (!projectPageId) {
				throw new Error(
					"projectPageId / pageId / entity.id のいずれからも案件ページIDを特定できませんでした。",
				);
			}
			await processProjectWallHit(projectPageId, notion as unknown as NotionClient);
		}
	},
});

worker.webhook("processMultiAgentCommanderRunWebhook", {
	title: "マルチエージェント基盤 Commander発火Webhook",
	description:
		"マルチエージェント基盤 Mission DBの「Commander Run」ボタンから起動。Anthropic Claude（既定 claude-opus-4-7）でCommander応答を生成し、Final Answer列に書き戻す。F1最小通電フェーズ・自己ブートストラップ用。設計図正本: 20_Project/マルチエージェント基盤/_F1_最小通電設計.md",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const missionPageId = extractWebhookPageId(body);
			if (!missionPageId) {
				throw new Error(
					"pageId / entity.id のいずれからもMissionページIDを特定できませんでした。",
				);
			}
			await processMultiAgentCommanderRun(
				missionPageId,
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processMultiAgentAgentARunWebhook", {
	title: "マルチエージェント基盤 AgentA発火Webhook",
	description:
		"マルチエージェント基盤 Tasks DBの「AgentA Run」ボタンから起動。AgentA（実行担当）がTaskを実行し、Result列に書き戻す。F2最小通電フェーズ。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const taskPageId = extractWebhookPageId(body);
			if (!taskPageId) {
				throw new Error(
					"pageId / entity.id のいずれからもTaskページIDを特定できませんでした。",
				);
			}
			await processMultiAgentAgentARun(
				taskPageId,
				notion as unknown as NotionClient,
			);
		}
	},
});

worker.webhook("processMultiAgentAgentBRunWebhook", {
	title: "マルチエージェント基盤 AgentB(Skeptic)発火Webhook",
	description:
		"マルチエージェント基盤 Tasks DBの「AgentB Run」ボタンから起動。AgentB（Skeptic役）がAgentA応答を疑い役として検証し、AgentB Review列に書き戻す。F3。",
	execute: async (events, { notion }) => {
		for (const event of events) {
			const body = event.body as Record<string, unknown>;
			const taskPageId = extractWebhookPageId(body);
			if (!taskPageId) {
				throw new Error(
					"pageId / entity.id のいずれからもTaskページIDを特定できませんでした。",
				);
			}
			await processMultiAgentAgentBRun(
				taskPageId,
				notion as unknown as NotionClient,
			);
		}
	},
});

// ────────────────────────────────────────────────────────────────────────────

async function processBusinessCard(
	input: CardInput,
	notion: NotionClient,
): Promise<CardResult> {
	const page =
		input.pageData ??
		(await notion.pages.retrieve({
			page_id: input.pageId,
		}));
	const card = readCard(page);
	const routing = input.routing ?? "company";
	const engagementIntent = input.engagementIntent ?? "active";
	const shouldDeepResearch = Boolean(
		!input.dryRun && input.deepResearch !== false && routing === "company" && engagementIntent === "active",
	);
	const shouldCreateMeetingPrep = Boolean(
		shouldDeepResearch && input.autoCreateMeetingPrepReport,
	);
	const webhookStatus = text(page.properties?.["Webhook引き継ぎステータス"]);

	// 終端/処理中ガード(検品指摘=オートメーション二重発火・再送で企業が二重作成される穴):
	// 既に処理中・処理済み・対象外の名刺は再処理しない。画像インテイク経由はforceで明示的に通す。
	const aiState = text(page.properties?.["名刺AI処理状態"]);
	if (
		!input.force &&
		["処理中", "対象外", "既存企業に紐づけ済", "新規企業作成"].includes(aiState)
	) {
		return {
			pageId: input.pageId,
			action: "skipped",
			companyId: null,
			companyName: null,
			message: `名刺AI処理状態=${aiState} のため再処理をスキップしました(二重処理防止)。`,
		};
	}
	if (
		!input.force &&
		aiState === "要確認" &&
		webhookStatus === "要確認で停止"
	) {
		return {
			pageId: input.pageId,
			action: "skipped",
			companyId: null,
			companyName: null,
			message: `名刺AI処理状態=${aiState} のため再処理をスキップしました(二重処理防止)。`,
		};
	}

	const integrityIssue = businessCardIntegrityIssue(card);
	if (integrityIssue || !shouldProcess(card)) {
		const stopReason =
			integrityIssue ||
			"会社名、メール、電話、名刺画像のいずれも不足しているため処理できません。";
		if (!input.dryRun) {
			await markCardNeedsReview(
				notion,
				card,
				buildHoldMemo({
					stopReason,
					scope: "名刺プロパティ（会社名/氏名/メール/電話/名刺画像）の入口Integrityを確認。",
					humanDecision: "大ちゃんが名刺画像または手入力値を見て、正本企業として扱うかを決める。",
					restartCondition: "会社名と連絡先の不足または不正値を修正し、routing=company で再実行。",
				}),
			);
		}
		return {
			pageId: input.pageId,
			action: input.dryRun ? "dry-run" : "needs-review",
			companyId: null,
			companyName: null,
			message: `名刺Integrity判定で停止: ${stopReason}`,
		};
	}

	if (routing === "broker" && input.registerExternalAdvisor) {
		if (input.dryRun) {
			return {
				pageId: input.pageId,
				action: "dry-run",
				companyId: null,
				companyName: null,
				message: "dry-run: 社外顧問DB登録ライン。Notionへの作成・更新は行いません。",
			};
		}
		const advisor = await registerExternalAdvisorFromBusinessCard(notion, card);
		return {
			pageId: input.pageId,
			action: advisor.created ? "external-advisor-registered" : "external-advisor-linked",
			companyId: null,
			companyName: null,
			message: `社外顧問DBへ${advisor.created ? "新規登録" : "既存更新"}しました。advisorPageId=${advisor.page.id}`,
		};
	}

	if (routing === "broker") {
		const memo = buildBrokerRegistrationHoldMemo(card, engagementIntent);
		if (!input.dryRun) {
			await markCardNeedsReview(notion, card, memo);
		}
		return {
			pageId: input.pageId,
			action: input.dryRun ? "dry-run" : "needs-review",
			companyId: null,
			companyName: null,
			message: `routing=${routing} / engagement=${engagementIntent} のため企業連携を停止し、ブローカー登録ライン待ちにしました。`,
		};
	}

	if (routing === "later") {
		const memo = buildHoldMemo({
			stopReason: "名刺振り分けが「あとで決める」に設定されたため、判定不能待ち。",
			scope: "名刺情報と既存企業候補の一次照合は未実施。",
			humanDecision: "営業担当が扱い対象企業を確定し、再実行で候補を確定する。",
			restartCondition: "後で決まった企業名が確定し、再調査起動フラグを active に戻した時。",
		});
		if (!input.dryRun) {
			await markCardNeedsReview(notion, card, memo);
		}
		return {
			pageId: input.pageId,
			action: input.dryRun ? "dry-run" : "needs-review",
			companyId: null,
			companyName: null,
			message: "routing=later のため要確認で停止しました。",
		};
	}

	if (input.dryRun) {
		const candidates = await findCompanyCandidates(notion, card);
		const strong = candidates.filter((candidate) => candidate.score >= 80);
		return {
			pageId: input.pageId,
			action: "dry-run",
			companyId: strong[0]?.page.id ?? null,
			companyName: strong[0]?.name ?? null,
			message: `dry-run: 強い候補 ${strong.length} 件、近似候補 ${candidates.filter((candidate) => candidate.weak).length} 件。`,
		};
	}

	await markCardProcessing(notion, card);

	try {
		const candidates = await findCompanyCandidates(notion, card);
		const strong = candidates.filter((candidate) => candidate.score >= 80);
		const weak = candidates.filter((candidate) => candidate.weak);

		if (!card.companyName) {
			await markCardNeedsReview(
				notion,
				card,
				buildHoldMemo({
					stopReason: "会社名が抽出できず、正本確定不能。",
					scope: "OCR結果（会社名/連絡先）を再確認。",
					humanDecision: "名刺画像の再読取りまたは手入力で会社名を確定する。",
					restartCondition: "会社名が確定した名刺データで再起動する。",
				}),
			);
			return {
				pageId: input.pageId,
				action: "needs-review",
				companyId: null,
				companyName: null,
				message: "会社名が読み取れませんでした。",
			};
		}

		if (strong.length > 1) {
			await markCardDuplicateHold(notion, card, strong);
			return {
				pageId: input.pageId,
				action: "duplicate-hold",
				companyId: null,
				companyName: null,
				message: `routing=${routing} / engagement=${engagementIntent}。strong候補が複数あるため一旦停止: ${strong.map((candidate) => candidate.name).join(", ")}`,
			};
		}

			if (strong.length === 1) {
				const company = strong[0]!;
				if (shouldDeepResearch) {
					await enrichCompany(notion, company.page, card, false);
				}
				const meetingPrepSummary = shouldCreateMeetingPrep
					? await createMeetingPrepReportFromBusinessCard(notion, company.page.id)
					: null;
				const linkMemo = shouldDeepResearch
					? `既存企業に紐づけ済: ${company.reasons.join(" / ")}`
					: `既存企業に紐づけ済: ${company.reasons.join(" / ")} / 営業判断=名刺だけ保存。外部調査・企業マスター高密度化は未実行。`;
				await linkCardToCompany(
					notion,
					card,
					company.page.id,
					"既存企業に紐づけ済",
					linkMemo,
					meetingPrepSummary,
					shouldDeepResearch
						? undefined
						: "Notion Workerが既存企業への紐づけまで実行。営業判断=名刺だけ保存のため、外部調査・企業マスター高密度化は未実行。",
				);
				return {
					pageId: input.pageId,
					action: "existing-linked",
					companyId: company.page.id,
					companyName: company.name,
					message: shouldDeepResearch
						? meetingPrepSummary
							? `既存企業へ紐づけ、必要項目を補完しました。${meetingPrepSummary}`
							: "既存企業へ紐づけ、必要項目を補完しました。"
						: "既存企業へ紐づけました。営業判断=名刺だけ保存のため、外部調査・企業マスター高密度化は未実行です。",
				};
			}

			const company = await createCompany(notion, card, weak[0], shouldDeepResearch);
			if (shouldDeepResearch) {
				await enrichCompany(notion, company, card, Boolean(weak[0]));
			}
			const meetingPrepSummary = shouldCreateMeetingPrep
				? await createMeetingPrepReportFromBusinessCard(notion, company.id)
				: null;
			const companyMemo = weak[0]
				? `近似候補はあるが強い一致なし。新規企業として作成し、重複候補へ回しました: ${weak[0].name}`
				: "強い既存候補なし。名刺起点で新規企業を作成しました。";
			await linkCardToCompany(
				notion,
				card,
				company.id,
				"新規企業作成",
				shouldDeepResearch
					? companyMemo
					: `${companyMemo} 営業判断=名刺だけ保存。外部調査・企業マスター高密度化は未実行。`,
				meetingPrepSummary,
				shouldDeepResearch
					? undefined
					: "Notion Workerが新規企業作成と名刺連携まで実行。営業判断=名刺だけ保存のため、外部調査・企業マスター高密度化は未実行。",
			);
			return {
				pageId: input.pageId,
				action: "created-company",
				companyId: company.id,
				companyName: card.companyName,
				message: shouldDeepResearch
					? meetingPrepSummary
						? `新規企業を作成し、企業情報と3Cを返却しました。${meetingPrepSummary}`
						: "新規企業を作成し、企業情報と3Cを返却しました。"
					: "新規企業を作成し、名刺と連携しました。営業判断=名刺だけ保存のため、外部調査・企業マスター高密度化は未実行です。",
			};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await markCardFailure(notion, card, message);
		throw error;
	}
}

// ── 名刺画像インテイク（入口ルール2026-06-11・新ショートカット用） ──
// iPhoneショートカットは「撮って送るだけ」: 画像base64＋振り分け＋担当者を1回POST。
// OCR・JSON検証・リトライ・ページ作成・重複チェック・企業登録・A深掘り連結は全部こちら側
// （旧ショートカットの不安定の主因=iPhone内のテキスト置換JSON整形・max_tokens不足・キー直書き を解消）。

type BusinessCardOcr = {
	氏名: string;
	会社名: string;
	役職: string;
	部署: string;
	電話: string;
	メール: string;
	住所: string;
	メモ: string;
};

type BrokerPrimaryRouting = "broker" | "later" | "company";

type BrokerPrimaryAssessment = {
	score: number | null;
	routing: BrokerPrimaryRouting;
	scoreReasons: string[];
	stopReasons: string[];
	nextAction: "進行可" | "軽確認" | "要追加調査" | "要管理者確認" | "要法務確認" | "保留";
};

function buildHoldMemo(input: {
	stopReason: string;
	scope: string;
	humanDecision: string;
	restartCondition: string;
}): string {
	return [
		`【停止理由】${input.stopReason}`,
		`【AIが確認した範囲】${input.scope}`,
		`【人が判断する一点】${input.humanDecision}`,
		`【再開条件】${input.restartCondition}`,
	].join("\n");
}

function isLikelyDummyCompanyName(value: string): boolean {
	const normalized = normalizeLookupText(value);
	if (!normalized) return true;
	return /^(会社名|未設定|不明|なし|null|none|test|dummy|sample|テスト|ダミー|サンプル|見本)$/.test(
		normalized,
	) || /^(テスト会社|ダミー会社|架空会社|会社名未設定|株式会社テスト|株式会社ダミー)$/.test(
		normalized,
	);
}

function isBusinessCardPhoneLengthValid(value: string): boolean {
	const phoneDigits = digits(value);
	return !phoneDigits || (phoneDigits.length >= 9 && phoneDigits.length <= 11);
}

function businessCardIntegrityIssue(card: CardInfo): string | null {
	if (!card.companyName.trim()) return "会社名が空欄のため正本企業を確定できません。";
	if (isLikelyDummyCompanyName(card.companyName)) {
		return "会社名がテスト値または明らかなダミー値のため停止しました。";
	}
	if (!isBusinessCardPhoneLengthValid(card.phone)) {
		return "電話番号が存在しますが、ハイフン除去後の桁数が9桁未満または11桁超です。";
	}
	if (!card.name && !card.email && !card.phone) {
		return "氏名、メール、電話がすべて無く、名刺情報として人手確認が必要です。";
	}
	return null;
}

// OCR応答のJSON検証(純関数・壊れた出力に強く)。全項目空は失敗扱い=創作した空殻を通さない。
function parseBusinessCardOcr(raw: string): BusinessCardOcr | null {
	const m = String(raw ?? "").match(/\{[\s\S]*\}/);
	if (!m) return null;
	try {
		const j = JSON.parse(m[0]) as Record<string, unknown>;
		const s = (k: string) => (typeof j[k] === "string" ? (j[k] as string).trim() : "");
		const ocr: BusinessCardOcr = {
			氏名: s("氏名"),
			会社名: s("会社名"),
			役職: s("役職"),
			部署: s("部署"),
			電話: s("電話"),
			メール: s("メール"),
			住所: s("住所"),
			メモ: s("メモ"),
		};
		if (!ocr.氏名 && !ocr.会社名 && !ocr.メール && !ocr.電話) return null;
		if (ocr.電話 && !isBusinessCardPhoneLengthValid(ocr.電話)) return null;
		return ocr;
	} catch {
		return null;
	}
}
export { parseBusinessCardOcr as parseBusinessCardOcrForTest };

function buildBrokerRegistrationHoldMemo(
	card: {
		name?: string;
		companyName?: string;
		email?: string;
		phone?: string;
		address?: string;
	},
	engagementIntent: "active" | "save-only",
): string {
	const valueOrUnknown = (value: string | undefined) => {
		const trimmed = String(value ?? "").trim();
		return trimmed || "未取得";
	};
	const candidateLines = [
		`氏名: ${valueOrUnknown(card.name)}`,
		`会社名/所属: ${valueOrUnknown(card.companyName)}`,
		`メール: ${valueOrUnknown(card.email)}`,
		`電話: ${valueOrUnknown(card.phone)}`,
		`住所: ${valueOrUnknown(card.address)}`,
		`engagementIntent: ${engagementIntent}`,
	].join("\n");

	return `${buildHoldMemo({
		stopReason:
			"名刺振り分けで「社外顧問・ブローカー」が選択されたため、企業マスター高密度化ラインの外部調査対象外。",
		scope: "名刺情報(氏名/会社名/連絡先)の確認のみ。企業候補検索、企業作成、外部調査は実施しない。",
		humanDecision:
			"大ちゃんまたは営業責任者が、ブローカー/社外顧問として別ラインに登録するか、企業案件として再扱いするかを決める。",
		restartCondition:
			"企業案件として扱う判断が明確になった場合のみ routing=company で再実行。ブローカー登録する場合は、登録先DB/UI/トリガー確定後に専用ラインで処理する。",
	})}

【ブローカー登録ライン】
【現在の扱い】企業マスター高密度化ラインへ進めず、ブローカー/社外顧問の別ライン待ちにする。
【登録候補情報】
${candidateLines}
【一次判定】未実施。60点基準はブローカー一次判定ロジックで別途判定する。
【停止条件】情報不足、本人の立場不明、会社/ドメイン衝突、broker/company兆候拮抗はbroker加点に使わず、要確認またはlaterへ逃がす。
【個人リスク】反社判定は行わない。本人一致度、リスク兆候、追加確認要否だけを整理する。
【未実施】ブローカー登録先DB、Notion UI権限、登録トリガーが未確定のため、このWorkerでは自動登録しない。
【次アクション】登録先DB/UI/トリガー確定後、登録ボタンまたは専用Webhookで別ラインへ送る。`;
}

// 振り分け(入口で営業が選ぶ)の正規化(純関数)。絵文字つきラベルでも判定できるようにする。
function normalizeCardRouting(value: string | undefined): "company" | "broker" | "later" {
	const raw = String(value ?? "").trim();
	const normalized = raw.toLowerCase();
	if (normalized === "company") return "company";
	if (normalized === "broker") return "broker";
	if (normalized === "later") return "later";
	const v = raw;
	if (v.includes("社外顧問") || v.includes("ブローカー") || v.includes("🤝")) return "broker";
	if (v.includes("あとで") || v.includes("後で") || v.includes("❓")) return "later";
	return "company"; // 未指定/「企業」は従来通り企業連携へ
}
export { normalizeCardRouting as normalizeCardRoutingForTest };

function normalizeCardEngagement(value: string | undefined): "active" | "save-only" {
	const raw = String(value ?? "").trim();
	const normalized = raw.toLowerCase();
	const compact = normalized.replace(/[\s_]+/g, "-");
	if (normalized === "active") return "active";
	if (compact === "save-only" || normalized === "saveonly") return "save-only";
	const v = raw;
	if (
		v.includes("名刺だけ") ||
		v.includes("保存") ||
		v.includes("流す") ||
		v.includes("追わない") ||
		v.includes("いらない")
	) {
		return "save-only";
	}
	return "active"; // 未指定は従来通り本流調査へ
}
export { normalizeCardEngagement as normalizeCardEngagementForTest };

function readBusinessCardRunOptions(body: unknown): {
	routing: "company" | "broker" | "later";
	engagementIntent: "active" | "save-only";
	deepResearch: boolean;
	autoCreateMeetingPrepReport: boolean;
	registerExternalAdvisor: boolean;
} {
	const record = coerceWebhookBodyRecord(body);
	const routing = normalizeCardRouting(
		firstString(
			record.routing,
			record.route,
			record.分岐,
			record.入力,
			record.対象,
			record.選択,
		),
	);
	const engagement = normalizeCardEngagement(
		firstString(
			record.engagementIntent,
			record.relationshipIntent,
			record.followIntent,
			record["営業判断"],
			record["熱量"],
		),
	);
	const registerExternalAdvisor = booleanFlag(
		record.registerExternalAdvisor,
		record.registerAdvisor,
		record.registerBroker,
		record["社外顧問登録"],
		record["ブローカー登録"],
	);
	if (registerExternalAdvisor) {
		return {
			routing: "broker",
			engagementIntent: "active",
			deepResearch: false,
			autoCreateMeetingPrepReport: false,
			registerExternalAdvisor,
		};
	}
	if (engagement === "save-only" || routing !== "company") {
		return {
			routing,
			engagementIntent: engagement,
			deepResearch: false,
			autoCreateMeetingPrepReport: false,
			registerExternalAdvisor,
		};
	}
	const deepResearch =
		typeof record.deepResearch === "boolean" ? record.deepResearch : engagement === "active";
	return {
		routing,
		engagementIntent: engagement,
		deepResearch,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor,
	};
}

function booleanFlag(...values: unknown[]): boolean {
	return values.some((value) => {
		if (value === true) return true;
		if (typeof value === "number") return value === 1;
		if (typeof value !== "string") return false;
		const normalized = value.trim().toLowerCase();
		return ["true", "1", "yes", "y", "on", "登録", "する", "はい"].includes(normalized);
	});
}

function readBusinessCardWebhookPageId(body: unknown): string | undefined {
	return extractWebhookPageId(coerceWebhookBodyRecord(body));
}
export { readBusinessCardRunOptions as readBusinessCardRunOptionsForTest };

function readBusinessCardByIdRunOptions(): {
	deepResearch: boolean;
	autoCreateMeetingPrepReport: boolean;
} {
	return { deepResearch: true, autoCreateMeetingPrepReport: false };
}
export { readBusinessCardByIdRunOptions as readBusinessCardByIdRunOptionsForTest };

function readPendingBusinessCardsRunOptions(): {
	deepResearch: boolean;
	autoCreateMeetingPrepReport: boolean;
} {
	return { deepResearch: true, autoCreateMeetingPrepReport: false };
}
export { readPendingBusinessCardsRunOptions as readPendingBusinessCardsRunOptionsForTest };

function readBusinessCardResearchWebhookRunOptions(): {
	deepResearch: boolean;
	autoCreateMeetingPrepReport: boolean;
} {
	return { deepResearch: true, autoCreateMeetingPrepReport: false };
}
export {
	readBusinessCardResearchWebhookRunOptions as readBusinessCardResearchWebhookRunOptionsForTest,
};


async function callOpenAIBusinessCardOcr(imageDataUrl: string): Promise<BusinessCardOcr> {
	const apiKey = process.env.OPENAI_API_KEY || process.env.WAJO_OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY が未設定のため名刺OCRを実行できません");
	const model = process.env.CARD_OCR_MODEL || "gpt-4o";
	const ask = async (extra: string): Promise<string> => {
		const res = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				max_tokens: 1024,
				response_format: { type: "json_object" },
				messages: [
					{
						role: "system",
						content:
							"あなたは名刺OCRです。画像から名刺情報を読み取り、JSONだけを返す。読み取れない項目は空文字。画像に無い情報の創作は禁止。キー: 氏名, 会社名, 役職, 部署, 電話, メール, 住所, メモ(その他の特記事項)。" +
							extra,
					},
					{
						role: "user",
						content: [{ type: "image_url", image_url: { url: imageDataUrl } }],
					},
				],
			}),
		});
		if (!res.ok) {
			throw new Error(`OpenAI OCR ${res.status}: ${(await res.text()).slice(0, 160)}`);
		}
		const data = (await res.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		return data.choices?.[0]?.message?.content ?? "";
	};
	const first = parseBusinessCardOcr(await ask(""));
	if (first) return first;
	// 壊れたJSONは一度だけ言い直させる(旧ショートカットはここで黙って壊れていた)
	const second = parseBusinessCardOcr(
		await ask("前回の出力はJSONとして壊れていた。必ず有効なJSONオブジェクトだけを返すこと。"),
	);
	if (second) return second;
	throw new Error("名刺OCRの結果をJSONとして解析できませんでした(2回試行)");
}

// 名刺JPEGをNotionへアップロード(失敗しても本体処理は止めない=画像なしで続行)
async function uploadBusinessCardJpeg(
	notion: NotionClient,
	jpegBytes: Uint8Array,
): Promise<string | null> {
	if (!notion.fileUploads?.create || !notion.fileUploads.send) return null;
	try {
		const fileName = `meishi_${todayIsoDateInTokyo()}.jpg`;
		const created = await notion.fileUploads.create({
			mode: "single_part",
			filename: fileName,
			content_type: "image/jpeg",
		});
		const fileUploadId =
			firstString(
				(created as Record<string, unknown>).id,
				readNestedString(created, ["file_upload", "id"]),
			) ?? "";
		if (!fileUploadId) return null;
		await notion.fileUploads.send({
			file_upload_id: fileUploadId,
			file: {
				filename: fileName,
				data: new Blob([new Uint8Array(jpegBytes)], { type: "image/jpeg" }),
			},
		});
		if (notion.fileUploads.complete) {
			try {
				await notion.fileUploads.complete({ file_upload_id: fileUploadId });
			} catch {
				// single_partではcomplete不要の場合があるため無視
			}
		}
		return fileUploadId;
	} catch (error) {
		console.log("business card image upload skipped", String(error).slice(0, 120));
		return null;
	}
}

// ── 人=案件の種ドクトリン(2026-06-11 大ちゃん確定) ──
// 和上の商品(発電所・土地)は物より先に「人の頭の中」にある=物の具体化を待つと遅い。
// よって🤝で振り分けられた人は死蔵せず、社外顧問DBに「関係構築中」で自動登録する。
// 社外顧問DBは案件DBの人物タブに表示される仕掛け=営業の働きかけ対象として生き続ける。
// 案件は1対1(ブローカーXから案件A/B/C)で、案件化の瞬間に「紹介案件」リレーションで紐づく(既存UI)。
const ADVISOR_DATA_SOURCE_ID =
	process.env.ADVISOR_DATA_SOURCE_ID ?? "de575c80-5e25-41a5-a27d-b1b3d84a0cbd";

// 社外顧問ページのプロパティを名刺OCRから組む(純関数)
function buildAdvisorProperties(
	ocr: BusinessCardOcr,
	assigneeUserId: string | undefined,
	cardPageUrl: string,
	today: string,
	cardPageId?: string,
): Record<string, unknown> {
	const memoLines = [
		`名刺パシャ/社外顧問登録ライン経由で登録(${today})。`,
		ocr.会社名 ? `所属(名刺より): ${ocr.会社名}` : "",
		ocr.部署 || ocr.役職
			? `役職: ${[ocr.部署, ocr.役職].filter(Boolean).join(" ")}`
			: "",
		cardPageUrl ? `名刺URL: ${cardPageUrl}` : "",
		cardPageId ? `名刺ページID: ${cardPageId}` : "",
	].filter(Boolean);
	const assessment = calculateBrokerPrimaryAssessment(ocr);
	const properties: Record<string, unknown> = {
		顧問名: title(ocr.氏名 || ocr.会社名 || "名刺(氏名読み取り不可)"),
		ステータス: select("関係構築中"),
		信頼度: select("要確認"),
		関係深度: select("不明"),
		初回接点日: { date: { start: today } },
		紹介実績メモ: richText(memoLines.join("\n")),
		ブローカー一次判定結果: select(assessment.routing),
		候補本人一致度: select("低"),
		リスク兆候: select("要確認"),
		次アクション: select(assessment.nextAction),
		判定根拠メモ: richText(buildExternalAdvisorAssessmentMemo(ocr, assessment, cardPageId)),
		注意点: richText("個人に対する反社判定は未実施。公開情報上のリスク兆候と本人一致度は、必要時に別途スクリーニングする。"),
	};
	if (assessment.score !== null) properties["ブローカー一次判定スコア"] = { number: assessment.score };
	if (cardPageId) properties["関連名刺"] = relation(cardPageId);
	if (ocr.電話) properties["電話番号"] = { phone_number: ocr.電話 };
	if (ocr.メール) properties["連絡先メール"] = { email: ocr.メール };
	if (assigneeUserId) {
		properties["担当営業ユーザー"] = {
			people: [{ object: "user", id: assigneeUserId }],
		};
	}
	return properties;
}
export { buildAdvisorProperties as buildAdvisorPropertiesForTest };

function calculateBrokerPrimaryAssessment(ocr: BusinessCardOcr): BrokerPrimaryAssessment {
	const roleText = [ocr.部署, ocr.役職].filter(Boolean).join(" ");
	const memoText = ocr.メモ || "";
	const companyText = ocr.会社名 || "";
	const email = (ocr.メール || "").toLowerCase();
	const joined = [roleText, memoText].filter(Boolean).join(" ").toLowerCase();
	const companyJoined = [companyText, roleText, memoText].filter(Boolean).join(" ").toLowerCase();
	const riskSignalText = memoText
		.split(/\n+/)
		.filter((line) => !/反社判定は(?:行わない|行っていない|未実施)|個人に対する反社判定/.test(line))
		.join("\n");
	const scoreReasons: string[] = [];
	const companyReasons: string[] = [];
	const stopReasons: string[] = [];
	let score = 0;

	const add = (points: number, reason: string) => {
		score += points;
		scoreReasons.push(`${points > 0 ? "+" : ""}${points}: ${reason}`);
	};
	const subtract = (points: number, reason: string) => {
		score -= points;
		companyReasons.push(`-${points}: ${reason}`);
		scoreReasons.push(`-${points}: ${reason}`);
	};

	if (/社外顧問|(?<!社外)顧問|アドバイザー|advisor|コンサル|consultant|紹介|仲介|ブローカー|broker|エージェント|agent/i.test(joined)) {
		add(20, "肩書またはメモに顧問・紹介・仲介系の表現あり");
	}
	if (/プロデューサー|producer|パートナー|partner/i.test(joined)) {
		add(10, "肩書またはメモにプロデューサー・パートナー系の弱い仲介兆候あり");
	}
	if (/つなぐ|繋ぐ|紹介する|紹介でき|案件を持|案件持込|案件持ち込み|知り合い|人脈|引き合わせ/i.test(memoText)) {
		add(15, "初回メモに紹介・接続・人脈提供が主目的と見える表現あり");
	}
	if (/第三者|他社|別会社|買い手|売り手|投資家|地主|紹介先|候補先/i.test(memoText)) {
		add(15, "初回メモに第三者案件・第三者企業の話が中心と見える表現あり");
	}
	if (/顧問契約|紹介契約|業務委託|外部パートナー|パートナー契約/i.test(memoText)) {
		add(10, "初回メモに顧問契約・紹介契約・外部パートナー系の表現あり");
	}
	if (/決裁者ではない|発注権限なし|紹介だけ|つなぐだけ/i.test(memoText)) {
		add(10, "初回メモに本人が発注・導入決裁者ではない兆候あり");
	}

	if (/自社.*(電気代|設備|土地|発電所|蓄電池|ppa|屋根|工場|倉庫)|弊社.*(電気代|設備|土地|発電所|蓄電池|ppa|屋根|工場|倉庫)/i.test(memoText)) {
		subtract(25, "初回メモが自社課題の相談に見える");
	}

	if (!ocr.氏名) stopReasons.push("氏名が未確認");
	if (!companyText) stopReasons.push("所属候補が未確認");
	if (email && /(gmail|yahoo|icloud|outlook|hotmail|docomo|ezweb|softbank|au\.com)/i.test(email)) {
		stopReasons.push("個人メールのため所属確認が弱い");
	}
	if (/反社|暴力団|風評|訴訟|行政処分|トラブル|違法/i.test(riskSignalText)) {
		stopReasons.push("個人リスク系の言及があるため、broker採点とは別に管理者確認");
	}
	if (scoreReasons.length === 0) {
		stopReasons.push("撮影時選択以外のbroker/company判定根拠が未確認");
	}
	const normalizedScore = Math.max(0, Math.min(100, score));
	if (normalizedScore > 0 && normalizedScore < 60) {
		stopReasons.push("broker兆候はあるが60点未満のためbroker確定不可");
	}
	if (normalizedScore > 0 && companyReasons.length > 0) {
		stopReasons.push("broker兆候とcompany兆候が混在");
	}

	if (scoreReasons.length === 0) {
		return {
			score: null,
			routing: "later",
			scoreReasons: [],
			stopReasons,
			nextAction: stopReasons.some((reason) => reason.includes("個人リスク")) ? "要管理者確認" : "要追加調査",
		};
	}

	const routing: BrokerPrimaryRouting =
		stopReasons.length > 0 ? "later" : normalizedScore >= 60 ? "broker" : normalizedScore <= 39 ? "company" : "later";
	const nextAction = stopReasons.some((reason) => reason.includes("個人リスク")) ? "要管理者確認" : "要追加調査";
	return { score: normalizedScore, routing, scoreReasons, stopReasons, nextAction };
}

function buildExternalAdvisorAssessmentMemo(
	ocr: BusinessCardOcr,
	assessment: BrokerPrimaryAssessment,
	cardPageId?: string,
): string {
	return [
		"【登録理由】名刺起点で社外顧問・ブローカーとして扱うため、社外顧問DBへ登録。",
		assessment.score === null ? "【登録状態】仮登録（未採点）" : "【登録状態】一次整理済み（採点根拠あり）",
		assessment.score === null
			? "【一次判定】未採点。撮影時選択以外の採点根拠が不足しているため、スコアは入力しない。"
			: `【一次判定】名刺情報・初回メモに基づく一次スコア: ${assessment.score}点 / routing=${assessment.routing}`,
		assessment.scoreReasons.length ? `【加点・減点根拠】${assessment.scoreReasons.join(" / ")}` : "",
		assessment.stopReasons.length ? `【停止理由】${assessment.stopReasons.join(" / ")}` : "【停止理由】該当なし",
		"【本人一致度】名刺本人を登録候補として扱う。外部ネガティブ情報との本人一致確認は未実施。",
		"【リスク兆候】反社判定は行わない。公開情報上のリスク兆候は未確認のため、必要に応じて追加調査。",
		`【次アクション】${assessment.nextAction}。営業上の扱い、紹介可能領域、本人/所属確認を人が確認する。`,
		cardPageId ? `【元名刺】${cardPageId}` : "",
		ocr.会社名 ? `【所属候補】${ocr.会社名}` : "",
		ocr.役職 || ocr.部署 ? `【役職】${[ocr.部署, ocr.役職].filter(Boolean).join(" ")}` : "",
	].filter(Boolean).join("\n");
}

async function linkAdvisorToBusinessCard(
	notion: NotionClient,
	advisorPage: Page,
	cardPageId: string,
): Promise<void> {
	const current = relationIdsFromProperty(advisorPage.properties?.["関連名刺"]);
	const next = uniqueIds([...current, cardPageId]);
	await notion.pages.update({
		page_id: advisorPage.id,
		properties: {
			関連名刺: relationIds(next),
		},
	});
}

async function updateExistingAdvisorAssessmentFromCard(
	notion: NotionClient,
	advisorPage: Page,
	ocr: BusinessCardOcr,
	cardPageId?: string,
): Promise<Record<string, unknown>> {
	const assessment = calculateBrokerPrimaryAssessment(ocr);
	const properties = {
		ブローカー一次判定スコア: { number: assessment.score },
		ブローカー一次判定結果: select(assessment.routing),
		候補本人一致度: select("低"),
		リスク兆候: select("要確認"),
		次アクション: select(assessment.nextAction),
		判定根拠メモ: richText(buildExternalAdvisorAssessmentMemo(ocr, assessment, cardPageId)),
	};
	await notion.pages.update({
		page_id: advisorPage.id,
		properties,
	});
	return properties;
}

async function linkBusinessCardToAdvisor(
	notion: NotionClient,
	cardPage: Page,
	advisorPageId: string,
	memo: string,
): Promise<void> {
	const current = relationIdsFromProperty(cardPage.properties?.["関連社外顧問"]);
	const next = uniqueIds([...current, advisorPageId]);
	await notion.pages.update({
		page_id: cardPage.id,
		properties: {
			関連社外顧問: relationIds(next),
			企業連携ステータス: select("対象外"),
			Webhook引き継ぎステータス: select("引き継ぎ済"),
			名刺AI処理状態: select("対象外"),
			企業連携メモ: richText(memo),
			名刺AI処理メモ: richText(memo),
		},
	});
}

function businessCardOcrFromCardInfo(card: CardInfo): BusinessCardOcr {
	const memo = [
		text(card.page.properties?.["メモ"]),
		text(card.page.properties?.["企業連携メモ"]),
		text(card.page.properties?.["名刺AI処理メモ"]),
	].flatMap((value) => value.split(/\n+/))
		.map((value) => value.trim())
		.filter(Boolean)
		.filter((line) => !/^【(?:社外顧問DB登録|社外顧問ページ|元名刺|企業マスター高密度化|注意)】/.test(line))
		.join("\n");
	return {
		氏名: card.name,
		会社名: card.companyName,
		役職: card.role,
		部署: "",
		電話: card.phone,
		メール: card.email,
		住所: card.address,
		メモ: memo,
	};
}

async function registerExternalAdvisorFromBusinessCard(
	notion: NotionClient,
	card: CardInfo,
): Promise<{ page: Page; created: boolean }> {
	const ocr = businessCardOcrFromCardInfo(card);
	const advisor = await createAdvisorFromCard(
		notion,
		ocr,
		undefined,
		typeof card.page.url === "string" ? card.page.url : "",
		card.page.id,
	);
	await researchExternalAdvisorPublicWeb(notion, advisor.page, ocr);
	const memo = [
		`【社外顧問DB登録】${advisor.created ? "新規登録" : "既存ページへ紐づけ更新"}`,
		`【社外顧問ページ】${advisor.page.id}`,
		`【元名刺】${card.page.id}`,
		"【企業マスター高密度化】routing=broker のため対象外。企業作成・外部調査・商談準備レポート自動作成は行わない。",
		"【注意】個人に対する反社判定は行っていない。必要時は本人一致度、リスク兆候、追加確認要否だけを別途確認する。",
	].join("\n");
	await linkBusinessCardToAdvisor(notion, card.page, advisor.page.id, memo);
	return advisor;
}

// 同名の社外顧問が既にいれば再登録しない(名寄せは同名完全一致のみ=安全側)
async function createAdvisorFromCard(
	notion: NotionClient,
	ocr: BusinessCardOcr,
	assigneeUserId: string | undefined,
	cardPageUrl: string,
	cardPageId?: string,
): Promise<{ page: Page; created: boolean }> {
	const name = ocr.氏名 || ocr.会社名 || "";
	if (name) {
		const dup = await notion.dataSources.query({
			data_source_id: ADVISOR_DATA_SOURCE_ID,
			page_size: 1,
			filter: { property: "顧問名", title: { equals: name } },
		});
		const existing = dup.results[0];
		if (existing) {
			if (cardPageId) await linkAdvisorToBusinessCard(notion, existing, cardPageId);
			const updatedProperties = await updateExistingAdvisorAssessmentFromCard(notion, existing, ocr, cardPageId);
			return {
				page: {
					...existing,
					properties: { ...(existing.properties ?? {}), ...updatedProperties },
				} as Page,
				created: false,
			};
		}
	}
	const page = await notion.pages.create({
		parent: { data_source_id: ADVISOR_DATA_SOURCE_ID },
		properties: buildAdvisorProperties(
			ocr,
			assigneeUserId,
			cardPageUrl,
			todayIsoDateInTokyo(),
			cardPageId,
		),
	});
	return { page, created: true };
}

type ExternalAdvisorPublicWebResearch = {
	memo: string;
	notes: string;
	identity: "高" | "中" | "低";
	risk: "なし" | "軽微" | "要確認" | "強い要確認";
	nextAction: "進行可" | "軽確認" | "要追加調査" | "要管理者確認" | "要法務確認" | "保留";
};

function buildExternalAdvisorPublicWebPrompt(ocr: BusinessCardOcr): string {
	const name = ocr.氏名 || "氏名未確認";
	const company = ocr.会社名 || "所属候補未確認";
	const domain = (ocr.メール || "").split("@")[1] || "メールドメイン未確認";
	return [
		"和上ホールディングスの社外顧問・ブローカー候補について、公開Web情報だけで本人一致度と追加確認事項を整理してください。",
		"反社判定、信用断定、紹介可否判断は行わないでください。",
		"同姓同名を本人と断定せず、出典URLがある事実だけを書いてください。",
		"",
		`氏名: ${name}`,
		`所属候補: ${company}`,
		`役職: ${ocr.役職 || "未確認"}`,
		`電話番号: ${ocr.電話 || "未確認"}`,
		`メールドメイン: ${domain}`,
		`住所/地域: ${ocr.住所 || "未確認"}`,
		`メモ: ${ocr.メモ || "なし"}`,
		"",
		"最低検索セット: 氏名、氏名空白あり/なし、氏名+所属候補、氏名+電話番号、氏名+メールドメイン、所属候補+電話番号、所属候補+地域、氏名+紹介、氏名+仲介、氏名+顧問、氏名+コンサル、氏名+案件、氏名+投資家、氏名+人脈。",
		"",
		"次の形式で返してください。",
		"【公開Web調査日】YYYY-MM-DD",
		"【検索した語】",
		"- ...",
		"【本人一致度】高 / 中 / 低",
		"【所属確認】確認 / 候補あり / 未確認",
		"【電話番号一致】確認 / 候補あり / 未確認",
		"【紹介可能領域】確認 / 候補あり / 未確認",
		"【紹介実績】確認 / 候補あり / 未確認",
		"【リスク兆候】なし / 軽微 / 要確認 / 強い要確認",
		"【確認できた情報】",
		"- 事実: ... 出典: URL",
		"【確認できなかった情報】",
		"- ...",
		"【注意点】",
		"- ...",
		"【次に人が確認すること】",
		"- 本人確認",
		"- 所属確認",
		"- 紹介可能領域",
		"- 紹介実績",
		"- 社内紹介経路",
		"【次アクション】進行可 / 軽確認 / 要追加調査 / 要管理者確認 / 要法務確認 / 保留",
	].join("\n");
}

function extractBracketValue(raw: string, label: string): string {
	const match = raw.match(new RegExp(`【${label}】([^\\n]+)`));
	return match?.[1]?.trim() ?? "";
}

function normalizeAdvisorIdentity(value: string): ExternalAdvisorPublicWebResearch["identity"] {
	if (value.includes("高")) return "高";
	if (value.includes("中")) return "中";
	return "低";
}

function normalizeAdvisorRisk(value: string): ExternalAdvisorPublicWebResearch["risk"] {
	if (value.includes("強い要確認")) return "強い要確認";
	if (value.includes("要確認")) return "要確認";
	if (value.includes("軽微")) return "軽微";
	return "なし";
}

function normalizeAdvisorNextAction(value: string): ExternalAdvisorPublicWebResearch["nextAction"] {
	if (value.includes("要法務確認")) return "要法務確認";
	if (value.includes("要管理者確認")) return "要管理者確認";
	if (value.includes("要追加調査")) return "要追加調査";
	if (value.includes("軽確認")) return "軽確認";
	if (value.includes("進行可")) return "進行可";
	return "要追加調査";
}

function normalizeExternalAdvisorPublicWebResearch(raw: string, today: string): ExternalAdvisorPublicWebResearch {
	const identity = normalizeAdvisorIdentity(extractBracketValue(raw, "本人一致度"));
	const risk = normalizeAdvisorRisk(extractBracketValue(raw, "リスク兆候"));
	const nextAction = normalizeAdvisorNextAction(extractBracketValue(raw, "次アクション"));
	return {
		memo: [`【公開Web調査 ${today}】`, raw.trim()].filter(Boolean).join("\n"),
		notes: [
			`【公開Web調査 ${today} 注意点】`,
			extractBracketValue(raw, "注意点") || "反社判定、信用断定、紹介可否判断は行わない。本人確認、所属確認、紹介可能領域、紹介実績、社内紹介経路を人が確認する。",
		].join("\n"),
		identity,
		risk: risk === "なし" && identity === "低" ? "要確認" : risk,
		nextAction: identity === "低" && nextAction === "進行可" ? "要追加調査" : nextAction,
	};
}

function buildExternalAdvisorPublicWebNotRun(today: string, reason: string): ExternalAdvisorPublicWebResearch {
	return {
		memo: [
			`【公開Web調査未実行 ${today}】`,
			`理由: ${reason}`,
			"公開Web調査結果は捏造せず、未調査として残す。",
		].join("\n"),
		notes: [
			`【公開Web調査未実行 ${today} 注意点】`,
			"本人確認、所属確認、紹介可能領域、紹介実績、社内紹介経路を人が確認する。",
			"反社判定、信用断定、紹介可否判断は行わない。",
		].join("\n"),
		identity: "低",
		risk: "要確認",
		nextAction: "要追加調査",
	};
}

async function researchExternalAdvisorPublicWeb(
	notion: NotionClient,
	advisorPage: Page,
	ocr: BusinessCardOcr,
): Promise<void> {
	const today = todayDateJST();
	let research: ExternalAdvisorPublicWebResearch;
	if (!currentPerplexityApiKey()) {
		research = buildExternalAdvisorPublicWebNotRun(today, "PERPLEXITY_API_KEY が未設定");
	} else {
		try {
			const response = await perplexityChat([
				{
					role: "user",
					content: buildExternalAdvisorPublicWebPrompt(ocr),
				},
			]);
			research = normalizeExternalAdvisorPublicWebResearch(response.content, today);
		} catch (error) {
			research = buildExternalAdvisorPublicWebNotRun(today, String(error).slice(0, 200));
		}
	}
	const existingMemo = text(advisorPage.properties?.["判定根拠メモ"]);
	const existingNotes = text(advisorPage.properties?.["注意点"]);
	await notion.pages.update({
		page_id: advisorPage.id,
		properties: {
			候補本人一致度: select(research.identity),
			リスク兆候: select(research.risk),
			次アクション: select(research.nextAction),
			判定根拠メモ: richText([existingMemo, research.memo].filter(Boolean).join("\n\n")),
			注意点: richText([existingNotes, research.notes].filter(Boolean).join("\n\n")),
		},
	});
}

type BusinessCardImageInput = {
	imageBase64: string;
	routing?: string;
	engagementIntent?: string;
	assigneeUserId?: string;
	dryRun: boolean;
};

type BusinessCardImageResult = {
	pageId: string | null;
	action:
		| "company-routed"
		| "broker-routed"
		| "queued-later"
		| "dry-run"
		| CardResult["action"];
	companyId: string | null;
	message: string;
};

async function processBusinessCardImage(
	input: BusinessCardImageInput,
	notion: NotionClient,
): Promise<BusinessCardImageResult> {
	const raw = input.imageBase64.trim();
	if (!raw) {
		return { pageId: null, action: "needs-review", companyId: null, message: "画像が空です。" };
	}
	const commaIndex = raw.indexOf(",");
	const base64 = raw.startsWith("data:") && commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw;
	const dataUrl = raw.startsWith("data:") ? raw : `data:image/jpeg;base64,${base64}`;
	const routing = normalizeCardRouting(input.routing);
	const engagement = normalizeCardEngagement(input.engagementIntent);
	const engagementLabel = engagement === "active" ? "本気で追う" : "名刺だけ保存";

	// サイズ上限(base64で約14MB≒画像10MB)。巨大ペイロードは早期に明示エラー
	if (base64.length > 14_000_000) {
		return {
			pageId: null,
			action: "needs-review",
			companyId: null,
			message: "画像が大きすぎます(10MB上限)。ショートカットのリサイズ設定を確認してください。",
		};
	}

	if (input.dryRun) {
		const ocr = await callOpenAIBusinessCardOcr(dataUrl);
		return {
			pageId: null,
			action: "dry-run",
			companyId: null,
			message: `dry-run: OCR成功。氏名=${ocr.氏名 || "不明"} / 会社=${ocr.会社名 || "不明"} / 振り分け=${routing}。書き込みなし。`,
		};
	}

	// 1. 再送ガード(検品指摘=iPhone側タイムアウト→再送で同じ名刺が2枚できる):
	//    画像ハッシュを企業重複チェックキーに刻み、同一画像の再送は既存ページを返す。
	const imageKey = `imgsha:${createHash("sha256").update(base64).digest("hex").slice(0, 40)}`;
	const dup = await notion.dataSources.query({
		data_source_id: BUSINESS_CARD_DATA_SOURCE_ID,
		page_size: 1,
		// containsで照合: 処理完了後はキーが「企業キー imgsha:...」の連結になるため(equalsだと取り逃す)
		filter: { property: "企業重複チェックキー", rich_text: { contains: imageKey } },
	});
	const existing = dup.results[0];
	if (existing) {
		return {
			pageId: existing.id,
			action: "skipped",
			companyId: null,
			message: "同じ画像の名刺が登録済みのため、再送をスキップしました(二重登録防止)。",
		};
	}

	// 2. 先に画像とページを保存(検品指摘=OCRが失敗すると営業の写真ごと消える沈黙データロスの防止)。
	//    状態は作成時点で確定させる=名刺管理DBのオートメーション二重発火をガードで弾けるようにする。
	const fileUploadId = await uploadBusinessCardJpeg(
		notion,
		new Uint8Array(Buffer.from(base64, "base64")),
	);
	const routingLabel =
		routing === "broker" ? "🤝社外顧問・ブローカー" : routing === "later" ? "❓あとで決める" : "🏢企業";
	const entryMemo = [
		`撮影時の振り分け: ${routingLabel}`,
		routing !== "later" && `営業判断: ${engagementLabel}`,
	]
		.filter(Boolean)
		.join("\n");
	const initialAiState =
		routing === "broker" ? "対象外" : routing === "later" ? "要確認" : "処理中";
	const initialLinkState = routing === "broker" ? "対象外" : "処理中";
	const properties: Record<string, unknown> = {
		氏名: title("名刺(読み取り中)"),
		メモ: richText(entryMemo),
		登録日: { date: { start: todayIsoDateInTokyo() } },
		企業重複チェックキー: richText(imageKey),
		名刺AI処理状態: select(initialAiState),
		企業連携ステータス: select(initialLinkState),
	};
	if (input.assigneeUserId) {
		properties["担当営業ユーザー"] = {
			people: [{ object: "user", id: input.assigneeUserId }],
		};
	}
	if (fileUploadId) {
		properties["名刺画像"] = {
			files: [
				{
					type: "file_upload",
					file_upload: { id: fileUploadId },
					name: `meishi_${todayIsoDateInTokyo()}.jpg`,
				},
			],
		};
	}
	const page = await notion.pages.create({
		parent: { data_source_id: BUSINESS_CARD_DATA_SOURCE_ID },
		properties,
	});

	// 3. OCR(失敗してもページと画像は残る=要確認で人に渡す)
	let ocr: BusinessCardOcr;
	try {
		ocr = await callOpenAIBusinessCardOcr(dataUrl);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await safeUpdateExistingProperties(notion, page, {
			名刺AI処理状態: { kind: "select", value: "要確認" },
			名刺AI処理メモ: {
				kind: "text",
				value: `名刺OCRに失敗(${message.slice(0, 200)})。${fileUploadId ? "画像は保存済み=名刺画像を見て" : "画像の保存にも失敗=もう一度撮影するか"}手入力してください。`,
			},
		});
		return {
			pageId: page.id,
			action: "needs-review",
			companyId: null,
			message: "OCRに失敗しましたが、ページは保存済みです(要確認キューへ)。",
		};
	}

		// 4. OCR結果を反映(不正なメール形式等でNotionが400を返しても「処理中スタック」にしない=再検品指摘)
		try {
			const ocrProps: Record<string, unknown> = {
				氏名: title(ocr.氏名 || ocr.会社名 || "名刺(氏名読み取り不可)"),
				会社名: richText(ocr.会社名),
				役職: richText([ocr.部署, ocr.役職].filter(Boolean).join(" ")),
				住所: richText(ocr.住所),
				メモ: richText([entryMemo, ocr.メモ].filter(Boolean).join("\n")),
			};
		if (ocr.電話) ocrProps["電話"] = { phone_number: ocr.電話 };
		if (ocr.メール) ocrProps["メール"] = { email: ocr.メール };
		await notion.pages.update({ page_id: page.id, properties: ocrProps });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await safeUpdateExistingProperties(notion, page, {
			名刺AI処理状態: { kind: "select", value: "要確認" },
			名刺AI処理メモ: {
				kind: "text",
				value: `OCR結果の書き込みに失敗(${message.slice(0, 200)})。メール/電話の形式不正の可能性。名刺画像を見て手入力してください。`,
			},
		});
		return {
			pageId: page.id,
			action: "needs-review",
			companyId: null,
			message: "OCR結果の書き込みに失敗しましたが、ページと画像は保存済みです(要確認キューへ)。",
		};
	}

	// 5. 振り分け(入口ルール: 人がその場で選んだ結果を尊重し、AIは確実な作業だけやる)
	if (routing === "broker") {
		const advisor = await createAdvisorFromCard(
			notion,
			ocr,
			input.assigneeUserId,
			typeof page.url === "string" ? page.url : "",
			page.id,
		);
		const memo = buildHoldMemo({
			stopReason: "撮影時に本人が社外顧問・ブローカーを選択したため、企業マスター高密度化の対象外。",
			scope: "名刺画像保存とOCR結果の反映まで。企業マスターDB連携と外部調査は未実行。",
			humanDecision: "社外顧問DBや別プロジェクトで扱うかを大ちゃんが決める。",
			restartCondition: "企業案件として扱う判断に変わった場合のみ、routing=company で再実行。",
		});
		await linkBusinessCardToAdvisor(
			notion,
			page as Page,
			advisor.page.id,
			`${memo}

【社外顧問DB登録】${advisor.created ? "新規登録" : "既存ページへ紐づけ更新"}
【社外顧問ページ】${advisor.page.id}`,
		);
		return {
			pageId: page.id,
			action: "broker-routed",
			companyId: null,
			message: `名刺を保存し、社外顧問DBへ${advisor.created ? "新規登録" : "既存紐づけ"}しました(${ocr.氏名 || ocr.会社名})。`,
		};
	}
	if (routing === "later") {
		await safeUpdateExistingProperties(notion, page, {
			名刺AI処理メモ: {
				kind: "text",
				value: buildHoldMemo({
					stopReason: "撮影時に『あとで決める』を選択したため、判断保留で停止。",
					scope: "名刺情報の保存のみ。",
					humanDecision: "対象企業を確定させる。",
					restartCondition: "routing を 'company' または 'broker' に変更して再実行。",
				}),
			},
		});
		return {
			pageId: page.id,
			action: "queued-later",
			companyId: null,
			message: `名刺を登録し、振り分け待ちキューに入れました(${ocr.氏名 || ocr.会社名})。`,
		};
	}
	// 🏢企業: 既存パイプライン(重複チェック→企業登録→A深掘り連結)へ。
	// 自分で「処理中」を立てた直後なので force で終端ガードを通す。
	const result = await processBusinessCard(
		{
			pageId: page.id,
			dryRun: false,
			force: true,
			routing,
			engagementIntent: engagement,
			deepResearch: engagement === "active",
			autoCreateMeetingPrepReport: false,
		},
		notion,
	);
	return {
		pageId: page.id,
		action: result.action,
		companyId: result.companyId,
		message: `名刺を登録し、企業連携を実行しました: ${result.message}`,
	};
}

async function processInquiryEmailIntake(
	input: InquiryEmailIntakeInput,
	notion: NotionClient,
): Promise<InquiryEmailIntakeResult> {
	const emailInfo = readInquiryEmailInfo(input);
	if (!emailInfo.subject && !emailInfo.body && !emailInfo.contactEmail) {
		return {
			inquiryPageId: null,
			action: "needs-review",
			companyAction: null,
			message:
				"件名・本文・メールアドレスが不足しているため、お問い合わせDBへ作成しませんでした。",
		};
	}

	const existing = await findExistingInquiryByEmail(notion, emailInfo);
	if (existing.length > 1) {
		return {
			inquiryPageId: null,
			action: "duplicate-hold",
			companyAction: null,
			message: `同一メール候補が複数あります。Workerは新規作成せず停止しました: ${existing
				.slice(0, 3)
				.map((page) => page.id)
				.join(", ")}`,
		};
	}

	if (existing.length === 1) {
		const page = existing[0]!;
		let companyAction: string | null = null;
		if (!input.dryRun && input.linkCompany !== false) {
			const linked = await processInquiryCompanyLink(
				{ inquiryPageId: page.id, pageData: page, dryRun: false },
				notion,
			);
			companyAction = linked.action;
		}
		return {
			inquiryPageId: page.id,
			action: input.dryRun ? "dry-run" : "skipped-existing",
			companyAction,
			message: input.dryRun
				? "dry-run: 同一メールの既存問い合わせが見つかったため、新規作成しません。"
				: "同一メールの既存問い合わせが見つかったため、新規作成せず既存ページを使いました。",
		};
	}

	if (input.dryRun) {
		return {
			inquiryPageId: null,
			action: "dry-run",
			companyAction: null,
			message: [
				"dry-run: 新規問い合わせとして作成できます。",
				`件名=${emailInfo.subject || "未設定"}`,
				`キー=${emailInfo.primaryKey}`,
				`会社=${emailInfo.companyName || "未入力"}`,
				`メール=${emailInfo.contactEmail || "未入力"}`,
			].join(" / "),
		};
	}

	const created = await createInquiryFromEmail(notion, emailInfo);
	let companyAction: string | null = null;
	if (input.linkCompany !== false) {
		const linked = await processInquiryCompanyLink(
			{ inquiryPageId: created.id, pageData: created, dryRun: false },
			notion,
		);
		companyAction = linked.action;
	}
	return {
		inquiryPageId: created.id,
		action: "created-inquiry",
		companyAction,
		message:
		"メール入口Workerでお問い合わせDBへ1件作成しました。Yoom側のNotion検索・有無分岐・Notion作成は不要にできます。",
	};
}

async function createCustomerContactLog(
	input: CustomerContactLogInput,
	notion: NotionClient,
): Promise<CustomerContactLogResult> {
	const sourcePageId = input.sourcePageId?.trim();
	const sourcePage = sourcePageId
		? await notion.pages.retrieve({ page_id: sourcePageId })
		: null;
	const sourceProperties = sourcePage?.properties ?? {};
	const phase = normalizeCustomerContactPhase(
		input.sourceType || inferCustomerContactPhase(sourceProperties),
	);
	const activityType = normalizeCustomerContactActivityType(input.activityType);
	const activityContent = input.activityContent?.trim() ?? "";
	const nextAction = input.nextAction?.trim() ?? "";
	const occurredAt = normalizeCustomerContactDate(input.occurredAt);
	const sourceTitle = sourcePage ? readGenericPageTitle(sourcePage) : "";
	const relatedInquiryIds = uniqueIds([
		...(phase === "問い合わせ" && sourcePage ? [sourcePage.id] : []),
		...relationIdsFromProperty(sourceProperties["元問い合わせ"]),
		...relationIdsFromProperty(sourceProperties["関連問い合わせ"]),
	]);
	const relatedProjectIds = uniqueIds([
		...(phase === "案件" && sourcePage ? [sourcePage.id] : []),
		...relationIdsFromProperty(sourceProperties["紐づき案件"]),
		...relationIdsFromProperty(sourceProperties["関連案件"]),
	]);
	const relatedDealIds = uniqueIds([
		...(phase === "商談" && sourcePage ? [sourcePage.id] : []),
		...relationIdsFromProperty(sourceProperties["関連商談"]),
	]);
	const relatedClosingIds = uniqueIds([
		...(phase === "成約後" && sourcePage ? [sourcePage.id] : []),
		...relationIdsFromProperty(sourceProperties["関連成約"]),
		...relationIdsFromProperty(sourceProperties["関連成約報告"]),
	]);
	const relatedCompanyIds = uniqueIds(relationIdsFromProperty(sourceProperties["関連企業"]));
	const assignedUserIds = uniqueIds([
		...personIdsFromProperty(sourceProperties["担当営業ユーザー"]),
		...personIdsFromProperty(sourceProperties["担当者"]),
	]);
	const assignedUserLabels = uniqueStrings([
		...personLabelsFromProperty(sourceProperties["担当営業ユーザー"]),
		...personLabelsFromProperty(sourceProperties["担当者"]),
	]);

	if (!activityContent && !nextAction) {
		return {
			contactLogPageId: null,
			action: "needs-review",
			message:
				"活動内容と次回アクションが空のため、顧客接点ログは作成しませんでした。",
		};
	}

	const titleText = buildCustomerContactLogTitle({
		occurredAt,
		assignedUserLabels,
		activityType,
		activityContent,
		nextAction,
		sourceTitle,
		phase,
	});

	if (input.dryRun) {
		return {
			contactLogPageId: null,
			action: "dry-run",
			message: [
				`dry-run: ${titleText} を顧客接点ログDBへ作成できます。`,
				`関連問い合わせ=${relatedInquiryIds.length}`,
				`関連案件=${relatedProjectIds.length}`,
				`関連商談=${relatedDealIds.length}`,
				`関連成約=${relatedClosingIds.length}`,
				"ステータス・評価点は変更しません。",
			].join(" / "),
		};
	}

	const properties: Record<string, unknown> = {
		接点タイトル: title(titleText),
		活動ログ: richText(titleText),
		活動表示: richText(titleText),
		活動種別: select(activityType),
		活動内容: richText(activityContent),
		次回アクション: richText(nextAction),
		接点日時: { date: { start: occurredAt } },
		フェーズ区分: select(phase),
		活動ログ反映状態: select("未反映"),
		停滞判定対象: { checkbox: true },
		めぐる確認状態: select("未確認"),
		Worker処理ID: richText(
			`customer-contact-${sourcePage?.id ?? "manual"}-${new Date().toISOString()}`,
		),
	};
	if (sourcePage?.url) properties["入力元URL"] = { url: sourcePage.url };
	if (assignedUserIds.length > 0) {
		properties["担当営業ユーザー"] = {
			people: assignedUserIds.map((id) => ({ object: "user", id })),
		};
	}
	if (relatedInquiryIds.length > 0) properties["関連問い合わせ"] = relationIds(relatedInquiryIds);
	if (relatedProjectIds.length > 0) properties["関連案件"] = relationIds(relatedProjectIds);
	if (relatedDealIds.length > 0) properties["関連商談"] = relationIds(relatedDealIds);
	if (relatedClosingIds.length > 0) properties["関連成約"] = relationIds(relatedClosingIds);
	if (relatedCompanyIds.length > 0) properties["関連企業"] = relationIds(relatedCompanyIds);

	const created = await notion.pages.create({
		parent: { data_source_id: CUSTOMER_CONTACT_LOG_DATA_SOURCE_ID },
		properties,
	});

	if (sourcePage) {
		await updateSourcePageAfterCustomerContact(notion, sourcePage, phase, occurredAt);
	}
	await refreshRelatedSalesPipelineSignals(notion, [
		...relatedInquiryIds,
		...relatedProjectIds,
	]).catch((error) => {
		console.log("sales pipeline signal refresh skipped", String(error));
	});

	return {
		contactLogPageId: created.id,
		action: "created-log",
		message:
			"顧客接点ログDBへ1件作成しました。活動ログへは未反映のまま、ステータス・評価点は変更していません。",
	};
}

function buildActivityLogFromContactLog(
	contactLogPage: Page,
	_workerRunId = `customer-contact-reflect-${new Date().toISOString()}`,
): Record<string, unknown> | null {
	const properties = contactLogPage.properties ?? {};
	const titleText =
		text(properties["接点タイトル"]) ||
		text(properties["活動表示"]) ||
		text(properties["活動ログ"]);
	const activityContent = text(properties["活動内容"]);
	const nextAction = text(properties["次回アクション"]);
	const activityLog = text(properties["活動ログ"]);
	const activityDisplay = text(properties["活動表示"]);
	const activityKind = text(properties["活動種別"]);
	const usefulNextAction = nextAction && !isLowSignalContactActivityText(nextAction) ? nextAction : "";
	if (!activityContent && !usefulNextAction && isTitleOnlyContactLog(titleText, activityLog, activityDisplay)) {
		return null;
	}
	if (!activityContent && !usefulNextAction && !activityLog) return null;
	if (!activityContent && !usefulNextAction && !activityKind) return null;
	const joinedForAuditCheck = [
		titleText,
		activityContent,
		usefulNextAction,
		activityLog,
		activityDisplay,
	].join(" ");
	if (isInternalTestOrAuditText(joinedForAuditCheck)) {
		return null;
	}
	const contactActivityBody = [
		activityContent,
		usefulNextAction,
		activityLog,
		activityDisplay,
	].join(" ");
	if (isLowSignalContactActivityText(contactActivityBody)) {
		return null;
	}
	if (!activityContent && !nextAction && !activityLog && !activityDisplay) return null;
	const body = [
		titleText ? `接点: ${titleText}` : "",
		activityContent ? `活動内容: ${activityContent}` : "",
		activityLog ? `活動ログ: ${activityLog}` : "",
		activityDisplay ? `活動表示: ${activityDisplay}` : "",
		usefulNextAction ? `次回アクション: ${usefulNextAction}` : "",
		contactLogPage.url ? `元ログ: ${contactLogPage.url}` : "",
	]
		.filter(Boolean)
		.join("\n");
	const activityDate =
		dateStartFromProperty(properties["接点日時"]) ||
		dateStartFromProperty(properties["活動日時"]);
	const assignedUserIds = uniqueIds([
		...personIdsFromProperty(properties["担当営業ユーザー"]),
		...personIdsFromProperty(properties["担当者"]),
	]);
	const relatedCompanyIds = uniqueIds(relationIdsFromProperty(properties["関連企業"]));
	const relatedDealIds = uniqueIds(relationIdsFromProperty(properties["関連商談"]));
	const createProperties: Record<string, unknown> = {
		活動タイトル: title(titleText || "顧客接点ログ"),
		活動ログ: richText(body),
		AIサマリ: richText(body),
		活動種別: select("社外打合せ"),
		活動処理状態: select("完了"),
		評価対象: { checkbox: true },
		Worker処理ID: richText(_workerRunId),
		関連顧客接点ログ: relationIds([contactLogPage.id]),
	};
	if (activityDate) createProperties["活動日時"] = { date: { start: activityDate } };
	if (assignedUserIds.length > 0) {
		createProperties["活動者"] = {
			people: assignedUserIds.map((id) => ({ object: "user", id })),
		};
	}
	if (relatedCompanyIds.length > 0) createProperties["関連企業"] = relationIds(relatedCompanyIds);
	if (relatedDealIds.length > 0) createProperties["関連商談"] = relationIds(relatedDealIds);
	return {
		parent: { data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID },
		properties: createProperties,
	};
}

function buildActivityLogFromSpeechLog(
	speechLogPage: Page,
	workerRunId?: string,
): Record<string, unknown> | null {
	const properties = speechLogPage.properties ?? {};
	const titleText = text(properties["発言タイトル"]);
	const speechContent = text(properties["発言内容"]);
	const category = text(properties["発言カテゴリ"]);
	const importance = text(properties["重要度"]);
	const processingMemo = text(properties["発言処理メモ"]);
	if ("評価加点候補" in properties && !checkboxValue(properties["評価加点候補"])) return null;
	const joinedForAuditCheck = [
		titleText,
		speechContent,
		category,
		importance,
		processingMemo,
	].join(" ");
	if (isInternalTestOrAuditText(joinedForAuditCheck)) return null;
	if (!speechContent) return null;
	const body = [
		titleText ? `発言: ${titleText}` : "",
		category ? `発言カテゴリ: ${category}` : "",
		importance ? `重要度: ${importance}` : "",
		`発言内容: ${speechContent}`,
		processingMemo ? `処理メモ: ${processingMemo}` : "",
		speechLogPage.url ? `元発言ログ: ${speechLogPage.url}` : "",
	]
		.filter(Boolean)
		.join("\n");
	const activityDate =
		dateStartFromProperty(properties["発言日時"]) ||
		createdDateFromPage(speechLogPage);
	const speakerIds = uniqueIds([
		...personIdsFromProperty(properties["発言者"]),
		...createdByUserIdsFromPage(speechLogPage),
	]);
	const relatedCompanyIds = uniqueIds(relationIdsFromProperty(properties["関連企業"]));
	const relatedMeetingIds = uniqueIds(relationIdsFromProperty(properties["関連会議"]));
	const workerProcessId = workerRunId || `speech-log-${speechLogPage.id}`;
	const createProperties: Record<string, unknown> = {
		活動タイトル: title(titleText || "発言ログ"),
		活動ログ: richText(body),
		AIサマリ: richText(body),
		活動種別: select("その他"),
		活動処理状態: select("完了"),
		評価対象: { checkbox: true },
		Worker処理ID: richText(workerProcessId),
		関連発言: relationIds([speechLogPage.id]),
	};
	if (activityDate) createProperties["活動日時"] = { date: { start: activityDate } };
	if (speakerIds.length > 0) {
		createProperties["活動者"] = {
			people: speakerIds.map((id) => ({ object: "user", id })),
		};
	}
	if (relatedCompanyIds.length > 0) createProperties["関連企業"] = relationIds(relatedCompanyIds);
	if (relatedMeetingIds.length > 0) createProperties["関連ミーティング"] = relationIds(relatedMeetingIds);
	return {
		parent: { data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID },
		properties: createProperties,
	};
}

function buildActivityLogFromSalesContributionLog(
	contributionLogPage: Page,
	workerRunId?: string,
): Record<string, unknown> | null {
	const properties = contributionLogPage.properties ?? {};
	const titleText = text(properties["貢献タイトル"]);
	const contributionType = text(properties["種別"]);
	const category = text(properties["貢献カテゴリ"]);
	const impact = text(properties["貢献インパクト"]);
	const approvalStatus = text(properties["承認ステータス"]);
	const reflectionStatus = text(properties["評価反映状態"]);
	const aiComment = text(properties["AIコメント"]);
	const visibleComment = text(properties["本人への見える化コメント"]);
	const comment = text(properties["コメント"]);
	const managerMemo = text(properties["マネージャーメモ"]);
	const points = numberValue(properties["ポイント"]) ?? numberValue(properties["ポイント手入力"]);
	if (
		(reflectionStatus || approvalStatus) &&
		(reflectionStatus !== "未反映" || approvalStatus !== "承認")
	) {
		return null;
	}
	const joinedForAuditCheck = [
		titleText,
		contributionType,
		category,
		impact,
		aiComment,
		visibleComment,
		comment,
		managerMemo,
	].join(" ");
	if (isInternalTestOrAuditText(joinedForAuditCheck)) return null;
	if (!aiComment && !visibleComment && !comment && !managerMemo) return null;
	const body = [
		titleText ? `貢献: ${titleText}` : "",
		contributionType ? `種別: ${contributionType}` : "",
		category ? `貢献カテゴリ: ${category}` : "",
		impact ? `貢献インパクト: ${impact}` : "",
		typeof points === "number" ? `ポイント: ${points}` : "",
		aiComment ? `AIコメント: ${aiComment}` : "",
		visibleComment ? `本人への見える化コメント: ${visibleComment}` : "",
		comment ? `コメント: ${comment}` : "",
		managerMemo ? `マネージャーメモ: ${managerMemo}` : "",
		contributionLogPage.url ? `元営業貢献ログ: ${contributionLogPage.url}` : "",
	]
		.filter(Boolean)
		.join("\n");
	const activityDate =
		dateStartFromProperty(properties["日付"]) ||
		dateStartFromProperty(properties["確認日"]) ||
		createdDateFromPage(contributionLogPage);
	const activityUserIds = uniqueIds([
		...personIdsFromProperty(properties["対象営業ユーザー"]),
		...createdByUserIdsFromPage(contributionLogPage),
	]);
	const relatedDealIds = uniqueIds(relationIdsFromProperty(properties["関連商談"]));
	const workerProcessId = workerRunId || `sales-contribution-${contributionLogPage.id}`;
	const createProperties: Record<string, unknown> = {
		活動タイトル: title(titleText || "営業貢献ログ"),
		活動ログ: richText(body),
		AIサマリ: richText(body),
		活動種別: select("その他"),
		活動処理状態: select("完了"),
		評価対象: { checkbox: true },
		Worker処理ID: richText(workerProcessId),
		関連営業貢献ログ: relationIds([contributionLogPage.id]),
	};
	if (activityDate) createProperties["活動日時"] = { date: { start: activityDate } };
	if (activityUserIds.length > 0) {
		createProperties["活動者"] = {
			people: activityUserIds.map((id) => ({ object: "user", id })),
		};
	}
	if (relatedDealIds.length > 0) createProperties["関連商談"] = relationIds(relatedDealIds);
	return {
		parent: { data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID },
		properties: createProperties,
	};
}

function buildActivityLogFromHitomiMemo(
	hitomiMemoPage: Page,
	workerRunId?: string,
): Record<string, unknown> | null {
	const properties = hitomiMemoPage.properties ?? {};
	if (!isHitomiMemoEvaluationEvidence(properties)) return null;
	const titleText = text(properties["メモ名"]);
	const originalMemo = text(properties["ひとこと原文"]);
	const organizedMemo = text(properties["人見さん整理メモ"]);
	const memoType = text(properties["メモ種別"]);
	const materialStatus = text(properties["評価材料化状態"]);
	const monthlyStatus = text(properties["月次評価反映状態"]);
	const aiCategory = text(properties["AI活用カテゴリ"]);
	const aiPointStatus = text(properties["AI活用ポイント状態"]);
	const aiPointReason = text(properties["AI活用ポイント理由"]);
	const nextAction = text(properties["次アクション"]);
	const aiPoints = numberValue(properties["AI活用ポイント"]);
	const joinedForAuditCheck = [
		titleText,
		originalMemo,
		organizedMemo,
		memoType,
		aiCategory,
		aiPointReason,
		nextAction,
	].join(" ");
	if (isInternalTestOrAuditText(joinedForAuditCheck)) return null;
	if (!originalMemo && !organizedMemo && !aiPointReason && !nextAction) return null;
	const body = [
		titleText ? `人見さんメモ: ${titleText}` : "",
		memoType ? `メモ種別: ${memoType}` : "",
		materialStatus ? `評価材料化状態: ${materialStatus}` : "",
		monthlyStatus ? `月次評価反映状態: ${monthlyStatus}` : "",
		originalMemo ? `ひとこと原文: ${originalMemo}` : "",
		organizedMemo ? `人見さん整理メモ: ${organizedMemo}` : "",
		aiCategory ? `AI活用カテゴリ: ${aiCategory}` : "",
		typeof aiPoints === "number" ? `AI活用ポイント: ${aiPoints}` : "",
		aiPointStatus ? `AI活用ポイント状態: ${aiPointStatus}` : "",
		aiPointReason ? `AI活用ポイント理由: ${aiPointReason}` : "",
		nextAction ? `次アクション: ${nextAction}` : "",
		hitomiMemoPage.url ? `元人見さんメモ: ${hitomiMemoPage.url}` : "",
	]
		.filter(Boolean)
		.join("\n");
	const activityDate =
		dateStartFromProperty(properties["報告日"]) ||
		dateStartFromProperty(properties["関連月"]) ||
		createdDateFromPage(hitomiMemoPage);
	const activityUserIds = uniqueIds([
		...personIdsFromProperty(properties["対象スタッフ"]),
		...createdByUserIdsFromPage(hitomiMemoPage),
	]);
	const workerProcessId = workerRunId || `hitomi-memo-${hitomiMemoPage.id}`;
	const createProperties: Record<string, unknown> = {
		活動タイトル: title(titleText || "人見さんメモ"),
		活動ログ: richText(body),
		AIサマリ: richText(body),
		活動種別: select("その他"),
		活動処理状態: select("完了"),
		評価対象: { checkbox: false },
		Worker処理ID: richText(workerProcessId),
		関連人見さんメモ: relationIds([hitomiMemoPage.id]),
	};
	if (activityDate) createProperties["活動日時"] = { date: { start: activityDate } };
	if (activityUserIds.length > 0) {
		createProperties["活動者"] = {
			people: activityUserIds.map((id) => ({ object: "user", id })),
		};
	}
	return {
		parent: { data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID },
		properties: createProperties,
	};
}

function buildActivityLogFromWaniPoMemory(
	waniPoMemoryPage: Page,
	workerRunId?: string,
): Record<string, unknown> | null {
	const properties = waniPoMemoryPage.properties ?? {};
	if (!isWaniPoMemoryEvaluationEvidence(properties)) return null;
	const titleText = text(properties["メモ名"]);
	const originalMemo = text(properties["原文メモ"]);
	const organizedMemo = text(properties["ワニポ整理メモ"]);
	const memoType = text(properties["メモ種別"]);
	const visibility = text(properties["公開範囲"]);
	const useStatus = text(properties["評価利用可否"]);
	const monthlyStatus = text(properties["月次評価反映状態"]);
	const aiCategory = text(properties["AI活用カテゴリ"]);
	const aiPointStatus = text(properties["AI活用ポイント状態"]);
	const aiPointReason = text(properties["AI活用ポイント理由"]);
	const nextPrompt = text(properties["次の声かけ"]);
	const aiPoints = numberValue(properties["AI活用ポイント"]);
	const joinedForAuditCheck = [
		titleText,
		originalMemo,
		organizedMemo,
		memoType,
		aiCategory,
		aiPointReason,
		nextPrompt,
	].join(" ");
	if (isInternalTestOrAuditText(joinedForAuditCheck)) return null;
	if (!originalMemo && !organizedMemo && !aiPointReason && !nextPrompt) return null;
	const body = [
		titleText ? `ワニポメモリー: ${titleText}` : "",
		memoType ? `メモ種別: ${memoType}` : "",
		visibility ? `公開範囲: ${visibility}` : "",
		useStatus ? `評価利用可否: ${useStatus}` : "",
		monthlyStatus ? `月次評価反映状態: ${monthlyStatus}` : "",
		originalMemo ? `原文メモ: ${originalMemo}` : "",
		organizedMemo ? `ワニポ整理メモ: ${organizedMemo}` : "",
		aiCategory ? `AI活用カテゴリ: ${aiCategory}` : "",
		typeof aiPoints === "number" ? `AI活用ポイント: ${aiPoints}` : "",
		aiPointStatus ? `AI活用ポイント状態: ${aiPointStatus}` : "",
		aiPointReason ? `AI活用ポイント理由: ${aiPointReason}` : "",
		nextPrompt ? `次の声かけ: ${nextPrompt}` : "",
		waniPoMemoryPage.url ? `元ワニポメモリー: ${waniPoMemoryPage.url}` : "",
	]
		.filter(Boolean)
		.join("\n");
	const activityDate =
		dateStartFromProperty(properties["記録日"]) ||
		createdDateFromPage(waniPoMemoryPage);
	const activityUserIds = uniqueIds([
		...personIdsFromProperty(properties["対象スタッフ"]),
		...createdByUserIdsFromPage(waniPoMemoryPage),
	]);
	const workerProcessId = workerRunId || `wanipo-memory-${waniPoMemoryPage.id}`;
	const createProperties: Record<string, unknown> = {
		活動タイトル: title(titleText || "ワニポメモリー"),
		活動ログ: richText(body),
		AIサマリ: richText(body),
		活動種別: select("その他"),
		活動処理状態: select("完了"),
		評価対象: { checkbox: false },
		Worker処理ID: richText(workerProcessId),
		関連ワニポメモリー: relationIds([waniPoMemoryPage.id]),
	};
	if (activityDate) createProperties["活動日時"] = { date: { start: activityDate } };
	if (activityUserIds.length > 0) {
		createProperties["活動者"] = {
			people: activityUserIds.map((id) => ({ object: "user", id })),
		};
	}
	return {
		parent: { data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID },
		properties: createProperties,
	};
}

function buildActivityLogFromAiConsultation(
	aiConsultationPage: Page,
	workerRunId?: string,
): Record<string, unknown> | null {
	const properties = aiConsultationPage.properties ?? {};
	const titleText = text(properties["相談内容 1"]);
	const agent = text(properties["相談先エージェント"]);
	const processingStatus = text(properties["処理状態"]);
	const aiAnswer = text(properties["AI回答"]);
	const joinedForAuditCheck = [titleText, agent, aiAnswer].join(" ");
	if (isInternalTestOrAuditText(joinedForAuditCheck)) return null;
	if (processingStatus && processingStatus !== "完了") return null;
	if (!titleText && !aiAnswer) return null;
	const body = [
		titleText ? `AI相談受付: ${titleText}` : "",
		agent ? `相談先エージェント: ${agent}` : "",
		processingStatus ? `処理状態: ${processingStatus}` : "",
		aiAnswer ? `AI回答: ${aiAnswer}` : "",
		aiConsultationPage.url ? `元AI相談受付: ${aiConsultationPage.url}` : "",
	]
		.filter(Boolean)
		.join("\n");
	const activityDate = createdDateFromPage(aiConsultationPage);
	const activityUserIds = uniqueIds([
		...personIdsFromProperty(properties["相談者"]),
		...createdByUserIdsFromPage(aiConsultationPage),
	]);
	const workerProcessId = workerRunId || `ai-consultation-${aiConsultationPage.id}`;
	const createProperties: Record<string, unknown> = {
		活動タイトル: title(titleText || "AI相談受付"),
		活動ログ: richText(body),
		AIサマリ: richText(body),
		活動種別: select("その他"),
		活動処理状態: select("完了"),
		評価対象: { checkbox: false },
		Worker処理ID: richText(workerProcessId),
	};
	if (activityDate) createProperties["活動日時"] = { date: { start: activityDate } };
	if (activityUserIds.length > 0) {
		createProperties["活動者"] = {
			people: activityUserIds.map((id) => ({ object: "user", id })),
		};
	}
	return {
		parent: { data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID },
		properties: createProperties,
	};
}

async function reflectCustomerContactLogsToActivityLogs(
	input: { limit?: number; dryRun?: boolean; workerRunId?: string },
	notion: NotionClient,
): Promise<{ scanned: number; created: number; skipped: number; errors: number }> {
	const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
	const response = await notion.dataSources.query({
		data_source_id: CUSTOMER_CONTACT_LOG_DATA_SOURCE_ID,
		page_size: limit,
		filter: {
			or: [
				{ property: "活動ログ反映状態", select: { equals: "未反映" } },
				{ property: "活動ログ反映状態", select: { equals: "反映候補" } },
			],
		},
	});
	let created = 0;
	let skipped = 0;
	let errors = 0;
	for (const page of response.results) {
		const createArgs = buildActivityLogFromContactLog(
			page,
			input.workerRunId,
		);
		if (!createArgs) {
			skipped += 1;
			if (!input.dryRun) {
				try {
					await notion.pages.update({
						page_id: page.id,
						properties: {
							活動ログ反映状態: select("対象外"),
						},
					});
				} catch (error) {
					errors += 1;
					console.log("customer contact skip status update failed", String(error));
				}
			}
			continue;
		}
		if (input.dryRun) {
			created += 1;
			continue;
		}
		try {
			const activityPage = await notion.pages.create(createArgs);
			await notion.pages.update({
				page_id: page.id,
				properties: {
					活動ログ反映状態: select("反映済み"),
					関連活動ログ: relationIds([activityPage.id]),
				},
			});
			created += 1;
		} catch (error) {
			errors += 1;
			console.log("customer contact activity reflection failed", String(error));
		}
	}
	return {
		scanned: response.results.length,
		created,
		skipped,
		errors,
	};
}

async function reflectSpeechLogsToActivityLogs(
	input: { limit?: number; dryRun?: boolean; workerRunId?: string },
	notion: NotionClient,
): Promise<{ scanned: number; created: number; skipped: number; errors: number }> {
	const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
	const response = await notion.dataSources.query({
		data_source_id: SPEECH_LOG_DATA_SOURCE_ID,
		page_size: limit,
		filter: {
			and: [
				{
					property: "関連活動",
					relation: { is_empty: true },
				},
				{
					property: "評価加点候補",
					checkbox: { equals: true },
				},
			],
		},
	});
	let created = 0;
	let skipped = 0;
	let errors = 0;
	for (const page of response.results) {
		const workerProcessId = input.workerRunId || `speech-log-${page.id}`;
		const createArgs = buildActivityLogFromSpeechLog(
			page,
			workerProcessId,
		);
		if (!createArgs) {
			skipped += 1;
			continue;
		}
		if (input.dryRun) {
			created += 1;
			continue;
		}
		try {
			const activityPage = await notion.pages.create(createArgs);
			const updateProperties: Record<string, unknown> = {
				Worker処理ID: richText(workerProcessId),
			};
			if (activityPage?.id) {
				updateProperties.関連活動 = relationIds([activityPage.id]);
			}
			await notion.pages.update({
				page_id: page.id,
				properties: updateProperties,
			});
			created += 1;
		} catch (error) {
			errors += 1;
			console.log("speech activity reflection failed", String(error));
		}
	}
	return {
		scanned: response.results.length,
		created,
		skipped,
		errors,
	};
}

async function reflectSalesContributionLogsToActivityLogs(
	input: { limit?: number; dryRun?: boolean; workerRunId?: string },
	notion: NotionClient,
): Promise<{ scanned: number; created: number; skipped: number; errors: number }> {
	const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
	const response = await notion.dataSources.query({
		data_source_id: SALES_CONTRIBUTION_LOG_DATA_SOURCE_ID,
		page_size: limit,
		filter: {
			and: [
				{
					property: "評価反映状態",
					select: { equals: "未反映" },
				},
				{
					property: "承認ステータス",
					select: { equals: "承認" },
				},
			],
		},
	});
	let created = 0;
	let skipped = 0;
	let errors = 0;
	for (const page of response.results) {
		const pageProperties = page.properties ?? {};
		const approvalStatus = text(pageProperties["承認ステータス"]);
		const reflectionStatus = text(pageProperties["評価反映状態"]);
		if (
			(reflectionStatus || approvalStatus) &&
			(reflectionStatus !== "未反映" || approvalStatus !== "承認")
		) {
			skipped += 1;
			continue;
		}
		const createArgs = buildActivityLogFromSalesContributionLog(
			page,
			input.workerRunId,
		);
		if (!createArgs) {
			skipped += 1;
			if (!input.dryRun) {
				try {
					await notion.pages.update({
						page_id: page.id,
						properties: {
							評価反映状態: select("対象外"),
						},
					});
				} catch (error) {
					errors += 1;
					console.log("sales contribution skip status update failed", String(error));
				}
			}
			continue;
		}
		if (input.dryRun) {
			created += 1;
			continue;
		}
		try {
			await notion.pages.create(createArgs);
			await notion.pages.update({
				page_id: page.id,
				properties: {
					評価反映状態: select("反映済み"),
				},
			});
			created += 1;
		} catch (error) {
			errors += 1;
			console.log("sales contribution activity reflection failed", String(error));
		}
	}
	return {
		scanned: response.results.length,
		created,
		skipped,
		errors,
	};
}

async function reflectHitomiMemosToActivityLogs(
	input: { limit?: number; dryRun?: boolean; workerRunId?: string },
	notion: NotionClient,
): Promise<{ scanned: number; created: number; skipped: number; errors: number }> {
	const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
	const response = await notion.dataSources.query({
		data_source_id: HITOMI_MEMO_DATA_SOURCE_ID,
		page_size: limit,
		filter: {
			or: [
				{ property: "評価材料化状態", select: { equals: "月次評価で確認" } },
				{ property: "評価材料化状態", select: { equals: "営業貢献ログへ反映" } },
				{ property: "月次評価反映状態", select: { equals: "反映候補" } },
			],
		},
	});
	let created = 0;
	let skipped = 0;
	let errors = 0;
	for (const page of response.results) {
		const createArgs = buildActivityLogFromHitomiMemo(
			page,
			input.workerRunId,
		);
		if (!createArgs) {
			skipped += 1;
			if (!input.dryRun) {
				try {
					await notion.pages.update({
						page_id: page.id,
						properties: {
							月次評価反映状態: select("見送り"),
						},
					});
				} catch (error) {
					errors += 1;
					console.log("hitomi memo skip status update failed", String(error));
				}
			}
			continue;
		}
		if (input.dryRun) {
			created += 1;
			continue;
		}
		try {
			await notion.pages.create(createArgs);
			await notion.pages.update({
				page_id: page.id,
				properties: {
					月次評価反映状態: select("反映済み"),
				},
			});
			created += 1;
		} catch (error) {
			errors += 1;
			console.log("hitomi memo activity reflection failed", String(error));
		}
	}
	return {
		scanned: response.results.length,
		created,
		skipped,
		errors,
	};
}

async function reflectWaniPoMemoriesToActivityLogs(
	input: { limit?: number; dryRun?: boolean; workerRunId?: string },
	notion: NotionClient,
): Promise<{ scanned: number; created: number; skipped: number; errors: number }> {
	const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
	const response = await notion.dataSources.query({
		data_source_id: WANIPO_MEMORY_DATA_SOURCE_ID,
		page_size: limit,
		filter: {
			and: [
				{
					or: [
						{ property: "評価利用可否", select: { equals: "本人が許可したら使う" } },
						{ property: "評価利用可否", select: { equals: "本人共有済み" } },
					],
				},
				{ property: "月次評価反映状態", select: { equals: "反映候補" } },
				{ property: "公開範囲", select: { does_not_equal: "本人のみ" } },
			],
		},
	});
	let created = 0;
	let skipped = 0;
	let errors = 0;
	for (const page of response.results) {
		const createArgs = buildActivityLogFromWaniPoMemory(
			page,
			input.workerRunId,
		);
		if (!createArgs) {
			skipped += 1;
			if (!input.dryRun) {
				try {
					await notion.pages.update({
						page_id: page.id,
						properties: {
							月次評価反映状態: select("見送り"),
						},
					});
				} catch (error) {
					errors += 1;
					console.log("wanipo memory skip status update failed", String(error));
				}
			}
			continue;
		}
		if (input.dryRun) {
			created += 1;
			continue;
		}
		try {
			await notion.pages.create(createArgs);
			await notion.pages.update({
				page_id: page.id,
				properties: {
					月次評価反映状態: select("反映済み"),
				},
			});
			created += 1;
		} catch (error) {
			errors += 1;
			console.log("wanipo memory activity reflection failed", String(error));
		}
	}
	return {
		scanned: response.results.length,
		created,
		skipped,
		errors,
	};
}

async function activityLogExistsByWorkerProcessId(
	notion: NotionClient,
	workerProcessId: string,
): Promise<boolean> {
	const response = await notion.dataSources.query({
		data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID,
		page_size: 1,
		filter: {
			property: "Worker処理ID",
			rich_text: { equals: workerProcessId },
		},
	});
	return response.results.length > 0;
}

async function reflectAiConsultationsToActivityLogs(
	input: { limit?: number; dryRun?: boolean; workerRunId?: string },
	notion: NotionClient,
): Promise<{ scanned: number; created: number; skipped: number; errors: number }> {
	const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
	const response = await notion.dataSources.query({
		data_source_id: AI_CONSULTATION_DATA_SOURCE_ID,
		page_size: limit,
		filter: {
			property: "処理状態",
			status: { equals: "完了" },
		},
	});
	let created = 0;
	let skipped = 0;
	let errors = 0;
	for (const page of response.results) {
		const workerProcessId = input.workerRunId
			? `${input.workerRunId}-${page.id}`
			: `ai-consultation-${page.id}`;
		let exists = false;
		try {
			exists = await activityLogExistsByWorkerProcessId(notion, workerProcessId);
		} catch (error) {
			errors += 1;
			console.log("ai consultation activity idempotency check failed", String(error));
			continue;
		}
		if (exists) {
			skipped += 1;
			continue;
		}
		const createArgs = buildActivityLogFromAiConsultation(
			page,
			workerProcessId,
		);
		if (!createArgs) {
			skipped += 1;
			continue;
		}
		if (input.dryRun) {
			created += 1;
			continue;
		}
		try {
			await notion.pages.create(createArgs);
			created += 1;
		} catch (error) {
			errors += 1;
			console.log("ai consultation activity reflection failed", String(error));
		}
	}
	return {
		scanned: response.results.length,
		created,
		skipped,
		errors,
	};
}

async function linkActivityLogsToSalesPerformance(
	input: { limit?: number; dryRun?: boolean },
	notion: NotionClient,
): Promise<{ scanned: number; linked: number; skipped: number; errors: number }> {
	const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
	const response = await notion.dataSources.query({
		data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID,
		page_size: limit,
		filter: {
			and: [
				{ property: "評価対象", checkbox: { equals: true } },
				{ property: "関連営業パフォーマンス", relation: { is_empty: true } },
			],
		},
	});
	let linked = 0;
	let skipped = 0;
	let errors = 0;
	for (const activityPage of response.results) {
		const activityDate = dateStartFromProperty(activityPage.properties?.["活動日時"]);
		const activityUserIds = personIdsFromProperty(activityPage.properties?.["活動者"]);
		if (!activityDate || activityUserIds.length === 0) {
			skipped += 1;
			continue;
		}
		try {
			const performancePage = await findSalesPerformanceForActivity(
				notion,
				activityDate,
				activityUserIds,
			);
			if (!performancePage) {
				skipped += 1;
				continue;
			}
			if (!input.dryRun) {
				await notion.pages.update({
					page_id: activityPage.id,
					properties: {
						関連営業パフォーマンス: relationIds([performancePage.id]),
					},
				});
				const currentActivityIds = relationIdsFromProperty(
					performancePage.properties?.["関連活動ログ"],
				);
				await notion.pages.update({
					page_id: performancePage.id,
					properties: {
						関連活動ログ: relationIds(
							uniqueIds([...currentActivityIds, activityPage.id]),
						),
					},
				});
			}
			linked += 1;
		} catch (error) {
			errors += 1;
			console.log("activity performance link failed", String(error));
		}
	}
	return {
		scanned: response.results.length,
		linked,
		skipped,
		errors,
	};
}

async function findSalesPerformanceForActivity(
	notion: NotionClient,
	activityDate: string,
	activityUserIds: string[],
): Promise<Page | null> {
	for (const userId of activityUserIds) {
		const response = await notion.dataSources.query({
			data_source_id: SALES_PERFORMANCE_DATA_SOURCE_ID,
			page_size: 5,
			filter: {
				and: [
					{ property: "対象営業ユーザー", people: { contains: userId } },
					{ property: "開始日", date: { on_or_before: activityDate } },
					{ property: "終了日", date: { on_or_after: activityDate } },
				],
			},
		});
		const monthly = response.results.find(
			(page) => text(page.properties?.["期間種別"]) === "月次",
		);
		return monthly ?? response.results[0] ?? null;
	}
	return null;
}

export {
	createCustomerContactLog as createCustomerContactLogForTest,
	buildActivityLogFromContactLog as buildActivityLogFromContactLogForTest,
	buildActivityLogFromSpeechLog as buildActivityLogFromSpeechLogForTest,
	buildActivityLogFromSalesContributionLog as buildActivityLogFromSalesContributionLogForTest,
	buildActivityLogFromHitomiMemo as buildActivityLogFromHitomiMemoForTest,
	buildActivityLogFromWaniPoMemory as buildActivityLogFromWaniPoMemoryForTest,
	buildActivityLogFromAiConsultation as buildActivityLogFromAiConsultationForTest,
	reflectCustomerContactLogsToActivityLogs as reflectCustomerContactLogsToActivityLogsForTest,
	reflectSpeechLogsToActivityLogs as reflectSpeechLogsToActivityLogsForTest,
	reflectSalesContributionLogsToActivityLogs as reflectSalesContributionLogsToActivityLogsForTest,
	reflectHitomiMemosToActivityLogs as reflectHitomiMemosToActivityLogsForTest,
	reflectWaniPoMemoriesToActivityLogs as reflectWaniPoMemoriesToActivityLogsForTest,
	reflectAiConsultationsToActivityLogs as reflectAiConsultationsToActivityLogsForTest,
	linkActivityLogsToSalesPerformance as linkActivityLogsToSalesPerformanceForTest,
	buildInquiryDisplayTitle as buildInquiryDisplayTitleForTest,
	buildNumberedInquiryDisplayTitle as buildNumberedInquiryDisplayTitleForTest,
	buildInquiryAttentionMemo as buildInquiryAttentionMemoForTest,
	buildInquiryReceptionNumber as buildInquiryReceptionNumberForTest,
	inferInquiryCategoryCode as inferInquiryCategoryCodeForTest,
	buildGmailInquirySearchQuery as buildGmailInquirySearchQueryForTest,
	processGmailInquiryInbox as processGmailInquiryInboxForTest,
	readGmailInquiryInput as readGmailInquiryInputForTest,
	shouldIgnoreGmailInquiryInput as shouldIgnoreGmailInquiryInputForTest,
};

function buildCustomerContactLogTitle(input: {
	occurredAt: string;
	assignedUserLabels: string[];
	activityType: string;
	activityContent: string;
	nextAction: string;
	sourceTitle: string;
	phase: string;
}): string {
	const dateLabel = input.occurredAt.slice(0, 10) || todayDateJST();
	const actionLabel = compactOneLine(input.activityType || "活動", 16);
	const summary = compactOneLine(
		input.activityContent ||
			input.nextAction ||
			input.sourceTitle ||
			(input.phase === "その他" ? "顧客接点" : input.phase),
		48,
	);
	return [dateLabel, actionLabel, summary].filter(Boolean).join("｜");
}

function compactOneLine(value: string, maxLength: number): string {
	const normalized = value.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

async function updateSourcePageAfterCustomerContact(
	notion: NotionClient,
	sourcePage: Page,
	phase: string,
	occurredAt: string,
): Promise<void> {
	if (phase === "問い合わせ") {
		const currentStatus = text(sourcePage.properties?.["ステータス"]);
		await safeUpdateExistingProperties(notion, sourcePage, {
			"📅 最終連絡日": { kind: "date", value: occurredAt },
			...(currentStatus === "未対応"
				? {
					ステータス: { kind: "select" as const, value: "対応中" },
					進捗フェーズ: { kind: "select" as const, value: "対応中" },
				}
				: {}),
			"🤖 AI判定状態": { kind: "select", value: "✅ 判定済" },
			"🤖 AI判定根拠": {
				kind: "text",
				value:
					currentStatus === "未対応"
						? `顧客接点ログDBに接点記録あり（${occurredAt}）。未対応から対応中へ進めました。`
						: `顧客接点ログDBに接点記録あり（${occurredAt}）。ステータスは変更していません。`,
			},
		});
		return;
	}
	if (phase === "案件") {
		await safeUpdateExistingProperties(notion, sourcePage, {
			最終アクション日: { kind: "date", value: occurredAt },
		});
	}
}

async function refreshRelatedSalesPipelineSignals(
	notion: NotionClient,
	pageIds: string[],
): Promise<void> {
	for (const pageId of uniqueIds(pageIds)) {
		await refreshSalesPipelineSignal(pageId, notion).catch((error) => {
			console.log("related sales pipeline signal refresh skipped", { pageId, error: String(error) });
		});
	}
}

async function refreshSalesPipelineSignal(
	pageId: string,
	notion: NotionClient,
	nowIso = new Date().toISOString(),
	dryRun = false,
): Promise<SalesPipelineSignalResult> {
	const page = await notion.pages.retrieve({ page_id: pageId });
	const properties = page.properties ?? {};

	if (properties["件名"]) {
		const logs = await findCustomerContactLogsForPage(notion, "関連問い合わせ", page.id);
		const assessment = assessInquiryPipeline(page, logs, nowIso);
		if (!dryRun) {
			const status = text(properties["ステータス"]) || "未設定";
			const hasProject = relationIdsFromProperty(properties["紐づき案件"]).length > 0 || /案件化/.test(status);
			await safeUpdateExistingProperties(notion, page, {
				案件化近さ: { kind: "select", value: assessment.proximity },
				案件化スコア: { kind: "number", value: assessment.score },
				"問い合わせフェーズ（推奨）": {
					kind: "select",
					value: assessment.recommendedPhase,
				},
				案件化根拠: { kind: "text", value: assessment.reason },
				案件化次アクション: { kind: "text", value: assessment.nextAction },
				営業サマリー: {
					kind: "text",
					value: buildPipelineSalesSummary(status, assessment, [
						`案件化有無: ${hasProject ? "あり" : "なし"}`,
					]),
				},
				次の一手: {
					kind: "text",
					value: `次の一手: ${inquiryPipelineDisplayNextAction(hasProject, assessment)}`,
				},
				案件化停滞時間: { kind: "number", value: assessment.stagnationHours },
				案件化停滞日数: { kind: "number", value: assessment.stagnationDays },
				案件化停滞アラート: { kind: "select", value: assessment.stagnationAlert },
				案件化最終判定日時: { kind: "date", value: nowIso },
			});
			await createPipelineAssessmentLearningLog(notion, page, assessment, {
				kind: "案件化予測",
				area: "問い合わせ",
				relationProperty: "関連問い合わせ",
				nowIso,
			}).catch((error) => {
				console.log("inquiry pipeline learning log skipped", String(error));
			});
		}
		return {
			pageId: page.id,
			action: dryRun ? "dry-run" : "updated-inquiry",
			message: `問い合わせの案件化温度計を更新しました（${assessment.proximity} / ${assessment.score}点）。`,
			assessment,
		};
	}

	if (properties["案件名"]) {
		const logs = await findCustomerContactLogsForPage(notion, "関連案件", page.id);
		const assessment = assessProjectClosing(page, logs, nowIso);
		if (!dryRun) {
			const status = text(properties["ステータス"]) || "未設定";
			await safeUpdateExistingProperties(notion, page, {
				成約近さ: { kind: "select", value: assessment.proximity },
				成約スコア: { kind: "number", value: assessment.score },
				"推奨フェーズ（活動ログ）": {
					kind: "select",
					value: assessment.recommendedPhase,
				},
				"フェーズ根拠（活動ログ）": { kind: "text", value: assessment.reason },
				次アクション推奨: { kind: "text", value: assessment.nextAction },
				成約根拠: { kind: "text", value: assessment.reason },
				成約次アクション: { kind: "text", value: assessment.nextAction },
				営業サマリー: {
					kind: "text",
					value: buildPipelineSalesSummary(status, assessment),
				},
				次の一手: { kind: "text", value: "次の一手: 活動を残す" },
				成約停滞時間: { kind: "number", value: assessment.stagnationHours },
				成約停滞日数: { kind: "number", value: assessment.stagnationDays },
				成約停滞アラート: { kind: "select", value: assessment.stagnationAlert },
				成約最終判定日時: { kind: "date", value: nowIso },
			});
			await createPipelineAssessmentLearningLog(notion, page, assessment, {
				kind: "成約予測",
				area: "案件",
				relationProperty: "関連案件",
				nowIso,
			}).catch((error) => {
				console.log("project closing learning log skipped", String(error));
			});
		}
		return {
			pageId: page.id,
			action: dryRun ? "dry-run" : "updated-project",
			message: `案件の成約温度計を更新しました（${assessment.proximity} / ${assessment.score}点）。`,
			assessment,
		};
	}

	return {
		pageId: page.id,
		action: "skipped",
		message: "問い合わせDBまたは案件管理DBのページではないため、温度計更新をスキップしました。",
		assessment: null,
	};
}

function buildPipelineSalesSummary(
	status: string,
	assessment: PipelineAssessment,
	extraLines: string[] = [],
): string {
	return [
		`営業状態: ${status}`,
		...extraLines,
		`判定: ${assessment.proximity} / ${assessment.score}点`,
		`推奨フェーズ: ${assessment.recommendedPhase}`,
		`根拠: ${assessment.reason}`,
	].join("\n");
}

function inquiryPipelineDisplayNextAction(
	hasProject: boolean,
	assessment: PipelineAssessment,
): string {
	if (hasProject) return "設備詳細を作成";
	if (assessment.score >= 80) return "案件化する";
	return "活動を残す";
}

async function findCustomerContactLogsForPage(
	notion: NotionClient,
	relationProperty: "関連問い合わせ" | "関連案件",
	pageId: string,
): Promise<PipelineLogSignal[]> {
	const response = await notion.dataSources.query({
		data_source_id: CUSTOMER_CONTACT_LOG_DATA_SOURCE_ID,
		filter: {
			property: relationProperty,
			relation: { contains: pageId },
		},
		page_size: 20,
	});
	return (response.results ?? []).map(readCustomerContactLogSignal);
}

function assessInquiryPipeline(
	page: Page,
	logs: PipelineLogSignal[],
	nowIso = new Date().toISOString(),
): PipelineAssessment {
	const properties = page.properties ?? {};
	const status = text(properties["ステータス"]);
	const assigned = personIdsFromProperty(properties["担当営業ユーザー"]).length > 0;
	const materialStatus = text(properties["資料収集ステータス"]);
	const requiredMaterials = text(properties["必要資料チェック"])
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	const tags = labelsFromProperty(properties["タグ"]);
	const hasProject = relationIdsFromProperty(properties["紐づき案件"]).length > 0;
	const sourceText = [
		readGenericPageTitle(page),
		...tags,
		text(properties["本文"]),
		text(properties["メール要約"]),
		text(properties["要約"]),
		text(properties["📝 活動ログ"]),
		...logs.map((log) => `${log.activityType} ${log.activityContent} ${log.nextAction}`),
	].join(" ");
	const lastSignalAt = latestSignalDate([
		...logs.map((log) => log.occurredAt),
		dateStartFromProperty(properties["📅 最終連絡日"]),
		dateStartFromProperty(properties["受信日時"]),
	]);

	if (hasProject || /案件化/.test(status)) {
		const stagnation = buildStagnation(lastSignalAt, nowIso, 100);
		return {
			proximity: "⑦ 案件化可",
			score: 100,
			recommendedPhase: "案件化候補",
			reason: buildPipelineReason([
				"既に案件へ紐づいている、またはステータスが案件化です。",
				`接点${logs.length}件`,
			]),
			nextAction: "案件化済みです。案件管理DB側で成約に向けた次アクションを確認してください。",
			lastSignalAt,
			...stagnation,
		};
	}

	let score = readGenericPageTitle(page) ? 5 : 0;
	const reasons: string[] = [];
	if (assigned) {
		score += 12;
		reasons.push("担当者あり");
	} else {
		reasons.push("担当者未設定");
	}
	if (logs.length > 0) {
		score += 18;
		reasons.push(`接点${logs.length}件`);
	}
	if (logs.some((log) => /Zoom|対面|現地|商談/.test(log.activityType))) {
		score += 8;
		reasons.push("強い接点あり");
	}
	score += inquiryMaterialScore(materialStatus);
	if (materialStatus) reasons.push(`資料=${materialStatus}`);
	if (requiredMaterials.length > 0) {
		score += Math.min(4, requiredMaterials.length * 2);
		reasons.push(`必要資料${requiredMaterials.length}項目`);
	}
	if (/価格|条件|査定|専任|専売|権利|登記|経産|電力|シミュレーション/.test(sourceText)) {
		score += 8;
		reasons.push("条件/資料の具体情報あり");
	}
	const tagSignal = scorePipelineTags(tags, [
		{ pattern: /現地調査|現調/, score: 12, label: "現地調査" },
		{ pattern: /値決め|値段交渉|価格交渉|価格設定/, score: 12, label: "値決め/価格交渉" },
		{ pattern: /専売|専任|媒介|専売契約/, score: 16, label: "専売/媒介" },
		{ pattern: /資料受領|資料回収|書類回収|資料.*済|必要資料|収取/, score: 10, label: "資料回収" },
		{ pattern: /決裁者|決済者|承認済|社内承認|稟議/, score: 12, label: "決裁者承認" },
	], 24);
	if (tagSignal.score > 0) {
		score += tagSignal.score;
		reasons.push(`タグ=${tagSignal.labels.join("、")}`);
	}
	score = clampScore(score);
	const proximity = inquiryProximityFromScore(score);
	const recommendedPhase = inquiryRecommendedPhaseFromScore(score, materialStatus);
	const stagnation = buildStagnation(lastSignalAt, nowIso, score);
	return {
		proximity,
		score,
		recommendedPhase,
		reason: buildPipelineReason(reasons),
		nextAction: inquiryNextAction({ assigned, logs, materialStatus, score }),
		lastSignalAt,
		...stagnation,
	};
}

function assessProjectClosing(
	page: Page,
	logs: PipelineLogSignal[],
	nowIso = new Date().toISOString(),
): PipelineAssessment {
	const properties = page.properties ?? {};
	const status = text(properties["ステータス"]);
	const docStatus = text(properties["完成図書ステータス"]);
	const tags = labelsFromProperty(properties["タグ"]);
	const hasClosing = relationIdsFromProperty(properties["関連成約"]).length > 0;
	const gross = numberValue(properties["予定粗利額"]) ?? numberValue(properties["目標粗利額"]) ?? 0;
	const sourceText = [
		readGenericPageTitle(page),
		...tags,
		text(properties["案件詳細"]),
		text(properties["確認待ち内容"]),
		...logs.map((log) => `${log.activityType} ${log.activityContent} ${log.nextAction}`),
	].join(" ");
	const lastSignalAt = latestSignalDate([
		...logs.map((log) => log.occurredAt),
		dateStartFromProperty(properties["最終アクション日"]),
		dateStartFromProperty(properties["作成日"]),
	]);

	if (hasClosing || /成約|成約申請/.test(status)) {
		const stagnation = buildStagnation(lastSignalAt, nowIso, 100);
		return {
			proximity: "⑦ 成約報告候補",
			score: 100,
			recommendedPhase: "成約報告候補",
			reason: buildPipelineReason([
				"成約報告または成約ステータスが確認できます。",
				`接点${logs.length}件`,
			]),
			nextAction: "成約報告の内容と歩合・粗利の整合を確認してください。",
			lastSignalAt,
			...stagnation,
		};
	}

	let score = projectStatusScore(status);
	const reasons = [`ステータス=${status || "未設定"}`];
	if (logs.length > 0) {
		score += 12;
		reasons.push(`接点${logs.length}件`);
	}
	if (logs.some((log) => /Zoom|対面|現地|商談/.test(log.activityType))) {
		score += 8;
		reasons.push("強い商談接点あり");
	}
	if (/提案|見積|価格|条件|契約|支払|成約|申込|買主|売主/.test(sourceText)) {
		score += 8;
		reasons.push("提案/条件交渉の具体情報あり");
	}
	if (/確認済|完成/.test(docStatus)) {
		score += 5;
		reasons.push(`完成図書=${docStatus}`);
	} else if (/不足/.test(docStatus)) {
		score -= 5;
		reasons.push("完成図書に不足あり");
	}
	if (gross > 0) {
		score += 3;
		reasons.push("予定粗利あり");
	}
	const tagSignal = scorePipelineTags(tags, [
		{ pattern: /現地案内|案内/, score: 14, label: "現地案内" },
		{ pattern: /銀行審査|融資|ローン|与信/, score: 12, label: "銀行審査" },
		{ pattern: /契約書|契約|申込|申し込み/, score: 14, label: "契約手続き" },
		{ pattern: /決済日|決済予定|決済完了|入金|着金/, score: 14, label: "決済/入金" },
		{ pattern: /決裁者|決済者|承認済|社内承認|稟議/, score: 12, label: "決裁者承認" },
		{ pattern: /値段交渉|価格交渉|条件交渉/, score: 8, label: "条件交渉" },
	], 10);
	if (tagSignal.score > 0) {
		score += tagSignal.score;
		reasons.push(`タグ=${tagSignal.labels.join("、")}`);
	}
	score = clampScore(score);
	const proximity = projectClosingProximityFromScore(score);
	const recommendedPhase = projectRecommendedPhaseFromScore(score);
	const stagnation = buildStagnation(lastSignalAt, nowIso, score);
	return {
		proximity,
		score,
		recommendedPhase,
		reason: buildPipelineReason(reasons),
		nextAction: projectNextAction({ status, docStatus, score }),
		lastSignalAt,
		...stagnation,
	};
}

function readCustomerContactLogSignal(page: Page): PipelineLogSignal {
	const properties = page.properties ?? {};
	return {
		id: page.id,
		occurredAt: dateStartFromProperty(properties["接点日時"]) || dateStartFromProperty(properties["作成日"]),
		activityType: text(properties["活動種別"]) || "活動",
		activityContent: text(properties["活動内容"]) || text(properties["活動表示"]) || text(properties["活動ログ"]),
		nextAction: text(properties["次回アクション"]),
	};
}

async function createPipelineAssessmentLearningLog(
	notion: NotionClient,
	page: Page,
	assessment: PipelineAssessment,
	input: {
		kind: "案件化予測" | "成約予測";
		area: "問い合わせ" | "案件";
		relationProperty: "関連問い合わせ" | "関連案件";
		nowIso: string;
	},
): Promise<void> {
	const pageTitle = readGenericPageTitle(page) || page.id;
	const titleText = `${input.kind}｜${pageTitle}｜${assessment.proximity}｜${assessment.score}点`;
	const reason = [
		`判定: ${assessment.proximity} / ${assessment.score}点`,
		`推奨フェーズ: ${assessment.recommendedPhase}`,
		`停滞: ${assessment.stagnationHours}時間 / ${assessment.stagnationAlert}`,
		assessment.reason,
	].filter(Boolean).join("\n");

	await notion.pages.create({
		parent: { data_source_id: AI_LEARNING_LOG_DATA_SOURCE_ID },
		properties: {
			判定名: title(titleText),
			判定種別: select(input.kind),
			対象領域: select(input.area),
			判定日時: { date: { start: input.nowIso } },
			"AI/Worker名": richText("refreshSalesPipelineSignal"),
			判定バージョン: richText("sales-pipeline-v1"),
			判定スコア: { number: assessment.score },
			判定ラベル: richText(assessment.proximity),
			判定根拠: richText(reason),
			次アクション: richText(assessment.nextAction),
			実結果: select("未確認"),
			"予測との差": select("未確認"),
			学習反映状態: select("未確認"),
			[input.relationProperty]: relationIds([page.id]),
		},
	});
}

type DealFeedbackLearningLogInput = {
	dealPageId: string;
	meetingPageId?: string | null;
	dealName: string;
	score: number;
	salesFeedback: string;
	improvementPoints: string[];
	nextTalkImage: string;
	followMailHint: string;
	closingHint: string;
	nowIso?: string;
};

type MeetingFeedbackLearningLogInput = {
	meetingPageId: string;
	meetingTitle: string;
	meetingType: string;
	status: string;
	directFeedback: string;
	goodPoints: string[];
	improvementPoints: string[];
	nextQuestions: string[];
	nextAction: string;
	nowIso?: string;
};

async function createDealFeedbackLearningLog(
	notion: NotionClient,
	input: DealFeedbackLearningLogInput,
): Promise<string | null> {
	const exists = await aiLearningLogExists(
		notion,
		"関連商談",
		input.dealPageId,
		"商談フィードバック",
	);
	if (exists) return null;

	const titleText = `商談フィードバック｜${input.dealName || input.dealPageId}｜${input.score}点`;
	const reason = [
		`営業スコア: ${input.score}点`,
		`営業フィードバック: ${input.salesFeedback}`,
		`改善ポイント:\n${input.improvementPoints.map((item) => `・${item}`).join("\n")}`,
		`フォローメールヒント: ${input.followMailHint}`,
		`成約へのヒント: ${input.closingHint}`,
	].filter(Boolean).join("\n");
	const properties: Record<string, unknown> = {
		判定名: title(titleText),
		判定種別: select("商談フィードバック"),
		対象領域: select("商談"),
		判定日時: { date: { start: input.nowIso || new Date().toISOString() } },
		"AI/Worker名": richText("processDealMeetingFeedback"),
		判定バージョン: richText("deal-feedback-v1"),
		判定スコア: { number: clampScore(input.score) },
		判定ラベル: richText(`営業スコア ${clampScore(input.score)}点`),
		判定根拠: richText(reason),
		次アクション: richText(input.nextTalkImage),
		実結果: select("未確認"),
		"予測との差": select("未確認"),
		学習反映状態: select("未確認"),
		関連商談: relationIds([input.dealPageId]),
	};
	if (input.meetingPageId) {
		properties.関連会議 = relationIds([input.meetingPageId]);
	}
	const created = await notion.pages.create({
		parent: { data_source_id: AI_LEARNING_LOG_DATA_SOURCE_ID },
		properties,
	});
	return created.id;
}

async function createMeetingFeedbackLearningLog(
	notion: NotionClient,
	input: MeetingFeedbackLearningLogInput,
): Promise<string | null> {
	const exists = await aiLearningLogExists(
		notion,
		"関連会議",
		input.meetingPageId,
		"会議フィードバック",
	);
	if (exists) return null;

	const titleText = `会議フィードバック｜${input.meetingTitle || input.meetingPageId}｜${input.status}`;
	const reason = [
		`会議種別: ${input.meetingType || "未設定"}`,
		`率直フィードバック: ${input.directFeedback}`,
		`良かった点:\n${input.goodPoints.map((item) => `・${item}`).join("\n")}`,
		`改善ポイント:\n${input.improvementPoints.map((item) => `・${item}`).join("\n")}`,
		`次回確認事項:\n${input.nextQuestions.map((item) => `・${item}`).join("\n")}`,
	].filter(Boolean).join("\n");
	const created = await notion.pages.create({
		parent: { data_source_id: AI_LEARNING_LOG_DATA_SOURCE_ID },
		properties: {
			判定名: title(titleText),
			判定種別: select("会議フィードバック"),
			対象領域: select("会議"),
			判定日時: { date: { start: input.nowIso || new Date().toISOString() } },
			"AI/Worker名": richText("processMeetingFeedback"),
			判定バージョン: richText("meeting-feedback-v1"),
			判定ラベル: richText(input.status || "返却済"),
			判定根拠: richText(reason),
			次アクション: richText(input.nextAction),
			実結果: select("未確認"),
			"予測との差": select("未確認"),
			学習反映状態: select("未確認"),
			関連会議: relationIds([input.meetingPageId]),
		},
	});
	return created.id;
}

async function aiLearningLogExists(
	notion: NotionClient,
	relationProperty: string,
	pageId: string,
	kind: string,
): Promise<boolean> {
	const response = await notion.dataSources.query({
		data_source_id: AI_LEARNING_LOG_DATA_SOURCE_ID,
		filter: {
			and: [
				{ property: relationProperty, relation: { contains: pageId } },
				{ property: "判定種別", select: { equals: kind } },
			],
		},
		page_size: 1,
	});
	return ((response.results ?? []) as Page[]).length > 0;
}

async function markAiLearningLogsOutcome(
	notion: NotionClient,
	input: {
		relationProperty: "関連土地" | "関連問い合わせ" | "関連案件" | "関連商談" | "関連会議" | "関連成約";
		pageId: string;
		outcome: "案件化" | "成約" | "失注" | "見送り" | "保留" | "差し戻し" | "停滞";
		outcomeDate?: string;
		scoreThreshold: number;
		note: string;
	},
): Promise<number> {
	const response = await notion.dataSources.query({
		data_source_id: AI_LEARNING_LOG_DATA_SOURCE_ID,
		filter: {
			property: input.relationProperty,
			relation: { contains: input.pageId },
		},
		page_size: 50,
	});
	const pages = (response.results ?? []) as Page[];
	const outcomeDate = input.outcomeDate || todayDateJST();
	for (const page of pages) {
		const score = numberValue(page.properties?.["判定スコア"]) ?? 0;
		const kind = text(page.properties?.["判定種別"]);
		const gap = predictionGapForPositiveOutcome(score, input.scoreThreshold);
		await notion.pages.update({
			page_id: page.id,
			properties: {
				実結果: select(input.outcome),
				結果日: { date: { start: outcomeDate } },
				"予測との差": select(gap),
				人間の補足メモ: richText(input.note),
				学習反映状態: select("学習候補"),
				ルール化判断: select("未判断"),
				ルール化優先度: select(learningRulePriorityForGap(gap)),
				外れ原因カテゴリ: multiSelect(learningCauseCategoriesForGap(gap)),
				反映先: multiSelect(learningRuleTargetsForGap(gap)),
				再検証状態: select("未検証"),
				ルール反映メモ: richText(learningRuleMemo(kind, gap, score, input.scoreThreshold)),
			},
		});
	}
	return pages.length;
}

function predictionGapForPositiveOutcome(score: number, threshold: number): string {
	return score >= threshold ? "的中" : "過小評価";
}

function learningRulePriorityForGap(gap: string): string {
	if (gap === "的中") return "P3｜記録のみ";
	if (gap === "過小評価" || gap === "過大評価") return "P1｜今週直す";
	return "P2｜様子を見る";
}

function learningCauseCategoriesForGap(gap: string): string[] {
	if (gap === "過小評価") return ["配点が弱い"];
	if (gap === "過大評価") return ["配点が強すぎる"];
	return [];
}

function learningRuleTargetsForGap(gap: string): string[] {
	if (gap === "過小評価" || gap === "過大評価") {
		return ["Worker配点", "AIプロンプト"];
	}
	return [];
}

function learningRuleMemo(kind: string, gap: string, score: number, threshold: number): string {
	if (gap === "的中") {
		return `${kind || "AI判定"}は基準${threshold}点に対して${score}点で、実結果と方向性が合っています。現時点では良い判定例として蓄積します。`;
	}
	if (gap === "過小評価") {
		return `${kind || "AI判定"}は基準${threshold}点に対して${score}点でしたが、実結果が前進しました。低く見積もった理由を確認し、配点・タグ・プロンプトのどこを強めるか判断してください。`;
	}
	if (gap === "過大評価") {
		return `${kind || "AI判定"}は基準${threshold}点に対して${score}点でしたが、実結果が伸びませんでした。高く見積もった理由を確認し、過剰加点を弱めるか判断してください。`;
	}
	return `${kind || "AI判定"}の実結果が返りました。外れ理由と反映先を確認してください。`;
}

function inquiryMaterialScore(status: string): number {
	if (/案件へ引き継ぎ済|確認済/.test(status)) return 24;
	if (/収集中/.test(status)) return 15;
	if (/不足あり/.test(status)) return 10;
	return 0;
}

function labelsFromProperty(property: unknown): string[] {
	return text(property)
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
}

function normalizeMeetingPrimaryType(value: string): {
	primaryType: MeetingPrimaryType;
	tags: string[];
} {
	const raw = value.trim();
	if (/商談|提案|顧客|取引先/.test(raw)) {
		return { primaryType: "商談", tags: raw === "商談" ? ["商談"] : ["商談", raw] };
	}
	if (!raw || raw === "ミーティング" || raw === "会議") {
		return { primaryType: "ミーティング", tags: [] };
	}
	const tag = legacyMeetingTypeToTag(raw);
	return { primaryType: "ミーティング", tags: tag ? [tag] : [raw] };
}

function readMeetingPrimaryType(properties: Record<string, unknown>): MeetingPrimaryType | "" {
	const explicit = firstString(
		text(properties["種別"]),
		text(properties["ミーティング種別"]),
		text(properties["会議種別"]),
	) ?? "";
	const tags = readMeetingTagLabels(properties);
	if (explicit) return normalizeMeetingPrimaryType(explicit).primaryType;
	return tags.some((tag) => /商談|提案|顧客|取引先/.test(tag)) ? "商談" : "";
}

function readMeetingTagLabels(properties: Record<string, unknown>): string[] {
	const explicitTags = labelsFromProperty(properties["タグ"]);
	const legacyType = firstString(
		text(properties["ミーティング種別"]),
		text(properties["会議種別"]),
	) ?? "";
	const legacyTag = legacyMeetingTypeToTag(legacyType);
	return uniqueStrings([
		...explicitTags,
		legacyTag,
	]).filter((tag) => tag !== "ミーティング" && tag !== "商談");
}

function readMeetingKindForPrompt(properties: Record<string, unknown>): string {
	const primaryType = readMeetingPrimaryType(properties) || "未設定";
	const tags = readMeetingTagLabels(properties);
	return tags.length > 0
		? `${primaryType} / タグ: ${tags.join("、")}`
		: primaryType;
}

function legacyMeetingTypeToTag(value: string): string {
	const raw = value.trim();
	if (!raw || raw === "ミーティング" || raw === "商談") return "";
	const map: Record<string, string> = {
		"1on1": "1on1",
		経営会議: "経営",
		役員会議: "役員",
		全体会議: "全体会議",
		営業会議: "営業",
		社内ミーティング: "社内",
		その他: "その他",
	};
	return map[raw] ?? raw;
}

function scorePipelineTags(
	tags: string[],
	rules: Array<{ pattern: RegExp; score: number; label: string }>,
	maxScore: number,
): { score: number; labels: string[] } {
	const matched = new Map<string, number>();
	for (const tag of tags) {
		for (const rule of rules) {
			if (!rule.pattern.test(tag)) continue;
			matched.set(rule.label, Math.max(matched.get(rule.label) ?? 0, rule.score));
		}
	}
	const rawScore = [...matched.values()].reduce((sum, value) => sum + value, 0);
	return {
		score: Math.min(maxScore, rawScore),
		labels: [...matched.keys()],
	};
}

function inquiryProximityFromScore(score: number): string {
	if (score >= 95) return "⑦ 案件化可";
	if (score >= 80) return "⑥ 案件化候補";
	if (score >= 65) return "⑤ 資料回収中";
	if (score >= 50) return "④ 条件確認中";
	if (score >= 35) return "③ 接触済";
	if (score >= 20) return "② 初動前";
	return "① 情報不足";
}

function inquiryRecommendedPhaseFromScore(score: number, materialStatus: string): string {
	if (score >= 80) return "案件化候補";
	if (/収集中|不足あり|確認済|案件へ引き継ぎ済/.test(materialStatus) || score >= 65) {
		return "資料回収中";
	}
	if (score >= 50) return "条件確認中";
	if (score >= 35) return "初回接触済";
	if (score >= 20) return "担当確定";
	return "未対応";
}

function inquiryNextAction(input: {
	assigned: boolean;
	logs: PipelineLogSignal[];
	materialStatus: string;
	score: number;
}): string {
	if (!input.assigned) return "担当営業ユーザーを決め、初回連絡を入れてください。";
	if (input.logs.length === 0) return "電話またはメールで初回接触し、顧客接点ログを残してください。";
	if (/不足あり|収集中/.test(input.materialStatus)) {
		return "不足資料を回収し、案件化できる条件がそろっているか確認してください。";
	}
	if (input.score >= 80) return "案件化候補です。案件化ボタンを押してよいか最終確認してください。";
	return "売買条件、対象物、必要資料を整理し、次回接点を設定してください。";
}

function projectStatusScore(status: string): number {
	if (/提案中/.test(status)) return 55;
	if (/売れる状態/.test(status)) return 45;
	if (/確認待ち/.test(status)) return 25;
	if (/情報収集中/.test(status)) return 10;
	return 5;
}

function projectClosingProximityFromScore(score: number): string {
	if (score >= 95) return "⑦ 成約報告候補";
	if (score >= 80) return "⑥ 提案中";
	if (score >= 65) return "⑤ 条件交渉中";
	if (score >= 50) return "④ 資料回収中";
	if (score >= 35) return "③ 初回商談済";
	if (score >= 20) return "② 接点不足";
	return "① 情報不足";
}

function projectRecommendedPhaseFromScore(score: number): string {
	if (score >= 95) return "成約報告候補";
	if (score >= 80) return "提案中";
	if (score >= 65) return "条件交渉中";
	if (score >= 50) return "資料回収中";
	if (score >= 35) return "初回接触済";
	return "接点不足";
}

function projectNextAction(input: { status: string; docStatus: string; score: number }): string {
	if (input.score >= 80) {
		return "成約報告候補です。相手の最終意思、契約条件、粗利、必要書類を確認してください。";
	}
	if (/不足/.test(input.docStatus)) return "不足している完成図書・証憑を先に回収してください。";
	if (/情報収集中|確認待ち/.test(input.status)) {
		return "売れる状態にするため、価格・権利・資料・相手の意思を整理してください。";
	}
	return "次回商談または提案後フォローを設定し、顧客接点ログへ残してください。";
}

function latestSignalDate(values: string[]): string {
	const dated = values
		.map((value) => ({ value, time: parsePipelineDate(value) }))
		.filter((item): item is { value: string; time: number } => item.time !== null)
		.sort((a, b) => b.time - a.time);
	return dated[0]?.value ?? "";
}

function buildStagnation(
	lastSignalAt: string,
	nowIso: string,
	score = 0,
): Pick<PipelineAssessment, "stagnationHours" | "stagnationDays" | "stagnationAlert"> {
	const last = parsePipelineDate(lastSignalAt);
	const now = parsePipelineDate(nowIso);
	if (last === null || now === null || now < last) {
		return {
			stagnationHours: 0,
			stagnationDays: 0,
			stagnationAlert: "⚪ 判定不可",
		};
	}
	const hours = Math.floor((now - last) / 36e5);
	const days = Math.floor(hours / 24);
	return {
		stagnationHours: hours,
		stagnationDays: days,
		stagnationAlert: stagnationAlertFromHours(hours, score),
	};
}

function parsePipelineDate(value: string): number | null {
	if (!value) return null;
	const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value;
	const time = Date.parse(normalized);
	return Number.isFinite(time) ? time : null;
}

function stagnationAlertFromHours(hours: number, score = 0): string {
	if (hours >= 240) return "🚨 10日超";
	if (hours >= 168) return "🚨 7日超";
	if (hours >= 72) return "🔴 3日超";
	if (score >= 95 && hours >= 8) return "🚨 実行待ち当日超";
	if (score >= 80 && hours >= 24) return "🔴 高スコア1日超";
	if (score >= 65 && hours >= 48) return "🔴 高スコア2日超";
	if (hours >= 24) return "🟡 1日超";
	return "🟢 当日対応";
}

function buildPipelineReason(parts: string[]): string {
	return parts.filter(Boolean).join(" / ").slice(0, 1800);
}

export {
	markAiLearningLogsOutcome as markAiLearningLogsOutcomeForTest,
	processLandEvaluation as processLandEvaluationForTest,
	assessInquiryPipeline as assessInquiryPipelineForTest,
	assessProjectClosing as assessProjectClosingForTest,
	refreshSalesPipelineSignal as refreshSalesPipelineSignalForTest,
};

function normalizeCustomerContactPhase(value: string): string {
	if (/問い合わせ|問合せ|inquiry/i.test(value)) return "問い合わせ";
	if (/案件|project|case/i.test(value)) return "案件";
	if (/商談|deal/i.test(value)) return "商談";
	if (/成約/.test(value)) return "成約後";
	return "その他";
}

function normalizeCustomerContactActivityType(value: string): string {
	const raw = value.trim();
	if (/電話|call|tel/i.test(raw)) return "電話";
	if (/メール|mail|email/i.test(raw)) return "メール";
	if (/zoom/i.test(raw)) return "Zoom";
	if (/meet/i.test(raw)) return "Google Meet";
	if (/オンライン/.test(raw)) return "オンライン商談";
	if (/対面|訪問/.test(raw)) return "対面商談";
	if (/現地|現調/.test(raw)) return "現地調査";
	if (/測量/.test(raw)) return "測量";
	if (/資料/.test(raw)) return "資料送付";
	if (/社内|確認/.test(raw)) return "社内確認";
	return raw || "その他";
}

function normalizeCustomerContactDate(value: string): string {
	const trimmed = value.trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
	return todayDateJST();
}

function inferCustomerContactPhase(properties: Record<string, unknown>): string {
	if (properties["件名"]) return "問い合わせ";
	if (properties["案件名"]) return "案件";
	if (properties["商談名"]) return "商談";
	return "その他";
}

function readGenericPageTitle(page: Page): string {
	const properties = page.properties ?? {};
	return (
		text(properties["件名"]) ||
		text(properties["案件名"]) ||
		text(properties["商談名"]) ||
		text(properties["成約名"]) ||
		text(properties["企業名"]) ||
		text(properties["名前"]) ||
		text(properties["title"]) ||
		""
	);
}

async function backfillCustomerContactLogDisplays(
	input: { limit?: number; dryRun?: boolean },
	notion: NotionClient,
): Promise<BulkCleanupResult> {
	const limit = normalizeBulkLimit(input.limit);
	const existing = await notion.dataSources.query({
		data_source_id: CUSTOMER_CONTACT_LOG_DATA_SOURCE_ID,
		page_size: limit,
	});
	const pages = (existing.results ?? []) as Page[];
	let updated = 0;
	const samples: string[] = [];

	for (const page of pages) {
		const properties = page.properties ?? {};
		const currentDisplay = text(properties["活動表示"]);
		const displayText = buildCustomerContactLogTitle({
			occurredAt: dateStart(properties["接点日時"]) || todayDateJST(),
			assignedUserLabels: personLabelsFromProperty(properties["担当営業ユーザー"]),
			activityType: text(properties["活動種別"]) || "活動",
			activityContent: text(properties["活動内容"]),
			nextAction: text(properties["次回アクション"]),
			sourceTitle: text(properties["活動ログ"]) || text(properties["接点タイトル"]),
			phase: text(properties["フェーズ区分"]) || "顧客接点",
		});
		if (!displayText || currentDisplay === displayText) continue;
		updated += 1;
		if (samples.length < 5) samples.push(displayText);
		if (input.dryRun) continue;
		await safeUpdateExistingProperties(notion, page, {
			接点タイトル: { kind: "text", value: displayText },
			活動ログ: { kind: "text", value: displayText },
			活動表示: { kind: "text", value: displayText },
		});
	}

	return {
		action: input.dryRun ? "dry-run" : updated > 0 ? "cleaned" : "skipped",
		checked: pages.length,
		updated,
		message:
			updated > 0
				? `顧客接点ログ ${pages.length} 件を確認し、${updated} 件を短い表示へ整えました。例: ${samples.join(" / ")}`
				: `顧客接点ログ ${pages.length} 件を確認しました。更新対象はありません。`,
	};
}

function dateStart(property: unknown): string {
	if (!property || typeof property !== "object") return "";
	const prop = property as Record<string, unknown>;
	const date = prop.date as Record<string, unknown> | undefined;
	return typeof date?.start === "string" ? date.start.slice(0, 10) : "";
}

function normalizeBulkLimit(value: number | undefined): number {
	if (!Number.isFinite(value ?? 0)) return 50;
	return Math.min(Math.max(Math.floor(value ?? 50), 1), 100);
}

async function processInquiryCompanyLink(
	input: InquiryInput,
	notion: NotionClient,
): Promise<InquiryResult> {
	const page =
		input.pageData ??
		(await notion.pages.retrieve({
			page_id: input.inquiryPageId,
		}));
	const inquiry = readInquiry(page);
	const card = inquiryToCardInfo(inquiry);

	if (inquiry.relatedCompanyIds.length > 0) {
		const companyPage = await notion.pages.retrieve({
			page_id: inquiry.relatedCompanyIds[0]!,
		});
		const company = readCompany(companyPage);
		const preservedStatus =
			inquiry.companyLinkStatus === "新規作成済"
				? "新規作成済"
				: "既存企業に紐づけ済";
		if (!input.dryRun) {
			await markInquiryLinkedToCompany(
				notion,
				inquiry,
				inquiry.relatedCompanyIds[0]!,
				preservedStatus,
				"既に関連企業が入っているため、企業連携済みとして整理。",
			);
			await addInquiryRelationToCompany(
				notion,
				inquiry.relatedCompanyIds[0]!,
				inquiry.page.id,
			);
		}
		return {
			inquiryPageId: inquiry.page.id,
			action: input.dryRun ? "dry-run" : "skipped-existing",
			companyId: inquiry.relatedCompanyIds[0]!,
			companyName: company.name || inquiry.companyName || null,
			message: input.dryRun
				? "dry-run: 既に関連企業が入っています。"
				: "既存の関連企業を保持し、問い合わせ側の連携状態だけ整えました。",
		};
	}

	if (!shouldProcessInquiry(inquiry)) {
		if (!input.dryRun) {
			await markInquiryTargetOut(
				notion,
				inquiry,
				"会社名・法人判定材料が不足しているため、企業DBは作成せず対象外にしました。",
			);
		}
		return {
			inquiryPageId: inquiry.page.id,
			action: input.dryRun ? "dry-run" : "target-out",
			companyId: null,
			companyName: null,
			message: "会社名・メール・電話・本文の法人判定材料が不足しています。",
		};
	}

	const duplicates = await findDuplicateInquiries(notion, inquiry);
	const duplicateCompanies = uniqueIds(
		duplicates.flatMap((duplicate) =>
			relationIdsFromProperty(duplicate.properties?.["関連企業"]),
		),
	);
	if (duplicateCompanies.length === 1) {
		const companyPage = await notion.pages.retrieve({
			page_id: duplicateCompanies[0]!,
		});
		const company = readCompany(companyPage);
		if (!input.dryRun) {
			await markInquiryLinkedToCompany(
				notion,
				inquiry,
				duplicateCompanies[0]!,
				"既存企業に紐づけ済",
				"同一キーの既存問い合わせに関連企業があるため、その企業へ紐づけ。",
			);
			await addInquiryRelationToCompany(notion, duplicateCompanies[0]!, inquiry.page.id);
		}
		return {
			inquiryPageId: inquiry.page.id,
			action: input.dryRun ? "dry-run" : "existing-linked",
			companyId: duplicateCompanies[0]!,
			companyName: company.name || inquiry.companyName || null,
			message: "同一問い合わせキーの既存企業へ紐づけました。",
		};
	}
	if (duplicateCompanies.length > 1 || (duplicates.length > 0 && !inquiry.companyName)) {
		if (!input.dryRun) {
			await markInquiryDuplicateHold(
				notion,
				inquiry,
				duplicates,
				"同一キーの問い合わせが複数あるため、企業作成せず重複疑いで停止。",
			);
		}
		return {
			inquiryPageId: inquiry.page.id,
			action: input.dryRun ? "dry-run" : "duplicate-hold",
			companyId: null,
			companyName: null,
			message: `重複疑いの問い合わせが ${duplicates.length} 件あります。`,
		};
	}

	const candidates = await findCompanyCandidates(notion, card);
	const strong = candidates.filter((candidate) => candidate.score >= 80);
	const weak = candidates.filter((candidate) => candidate.weak);

	if (input.dryRun) {
			return {
				inquiryPageId: inquiry.page.id,
				action: "dry-run",
				companyId: strong[0]?.page.id ?? duplicateCompanies[0] ?? null,
				companyName: strong[0]?.name ?? (inquiry.companyName || null),
				message: `dry-run: 強い企業候補 ${strong.length} 件、近似候補 ${weak.length} 件、重複問い合わせ ${duplicates.length} 件。`,
			};
		}

	if (strong.length > 1) {
		await markInquiryCandidateHold(notion, inquiry, strong);
		return {
			inquiryPageId: inquiry.page.id,
			action: "duplicate-hold",
			companyId: null,
			companyName: null,
			message: `強い企業候補が複数あります: ${strong.map((candidate) => candidate.name).join(", ")}`,
		};
	}

	if (strong.length === 1) {
		const company = strong[0]!;
		await updateExistingCompanyFromInquiry(notion, company.page, inquiry);
		await markInquiryLinkedToCompany(
			notion,
			inquiry,
			company.page.id,
			"既存企業に紐づけ済",
			`既存企業に紐づけ済: ${company.reasons.join(" / ")}`,
		);
		await addInquiryRelationToCompany(notion, company.page.id, inquiry.page.id);
		return {
			inquiryPageId: inquiry.page.id,
			action: "existing-linked",
			companyId: company.page.id,
			companyName: company.name,
			message: "既存企業へ紐づけ、問い合わせ要約と窓口情報を補完しました。",
		};
	}

	if (!inquiry.companyName) {
		await markInquiryNeedsReview(
			notion,
			inquiry,
			"会社名が未入力のため、企業DBを新規作成せず要確認にしました。",
		);
		return {
			inquiryPageId: inquiry.page.id,
			action: "needs-review",
			companyId: null,
			companyName: null,
			message: "会社名が未入力です。",
		};
	}

	const company = await createCompanyFromInquiry(notion, inquiry, weak[0]);
	await markInquiryLinkedToCompany(
		notion,
		inquiry,
		company.id,
		"新規作成済",
		weak[0]
			? `近似候補はあるが強い一致なし。問い合わせ起点で新規作成し、重複候補へ回しました: ${weak[0].name}`
			: "強い既存候補なし。問い合わせ起点で新規企業を作成しました。",
	);
	return {
		inquiryPageId: inquiry.page.id,
		action: "created-company",
		companyId: company.id,
		companyName: inquiry.companyName,
		message: "新規企業を作成し、問い合わせへ関連企業を返却しました。",
	};
}

async function processCompanyResearch(
	input: CompanyResearchInput,
	notion: NotionClient,
): Promise<CompanyResearchResult> {
	const companyPage = await notion.pages.retrieve({
		page_id: input.companyPageId,
	});
	const company = readCompany(companyPage);
	let acquiredResearchLock = false;
	if (!input.dryRun) {
		if (isCompanyResearchInFlight(company.page.id)) {
			return {
				companyId: company.page.id,
				action: "in-flight",
				message: `同一企業の深掘り調査が実行中です(${COMPANY_RESEARCH_IN_FLIGHT_TTL_MINUTES}分以内に開始)。二重実行を止めました。`,
			};
		}
		companyResearchInflight.set(company.page.id, Date.now());
		acquiredResearchLock = true;
	}

	try {
	// 0. 整合性ガード（深掘り前）: 矛盾/非現実的な相手はPerplexityを呼ばず要確認で停止
	const guard = validateResearchTarget(company.name);
	const plausibility = guard.ok
		? await assessTargetPlausibility(company.name)
		: { realistic: true, reason: "" };
	if (!guard.ok || !plausibility.realistic) {
		const reason = !guard.ok
			? guard.reason
			: plausibility.reason || "現実的な商談相手でないと判断しました。";
		if (input.dryRun) {
			return {
				companyId: company.page.id,
				action: "dry-run",
				message: `dry-run: 整合性チェックで停止: ${reason}`,
			};
		}
		await safeUpdateExistingProperties(notion, companyPage, {
			企業調査ステータス: { kind: "select", value: "要確認" },
			企業AI受付メモ: {
				kind: "text",
				value: buildHoldMemo({
					stopReason: reason,
					scope: "企業名のリサーチ対象妥当性を深掘り前に確認。",
					humanDecision: "この企業を営業対象として調査してよいかを大ちゃんが決める。",
					restartCondition: "正本企業名または調査対象を修正し、企業調査を再実行。",
				}),
			},
		});
		return {
			companyId: company.page.id,
			action: "needs-review",
			message: `整合性チェックで停止: ${reason}`,
		};
	}

	// 1. TDB/COSMOSNetは通常フロー外。与信取得は管理者ボタン専用に分離する。
	let tdb: TdbProfile | null = null;
	const score = scoreCompany(tdb);

	// 2. Perplexity多段深掘り
	const card = companyToCardInfo(company);
	const research = await researchCompanyDeep({
		companyName: company.name,
		domain: card.domain,
		address: company.address,
	});

	// 3. 既存手入力を壊さないマージ
	const existing: Partial<DeepResearch> = {
		summary: company.summary,
		currentIssue: company.currentIssue,
		futureIssue: company.futureIssue,
		salesAngle: company.salesAngle,
		fit: company.fit,
		customerMarket3c: company.customerMarket3c,
		competitor3c: company.competitor3c,
		wajoRelation3c: company.wajoRelation3c,
		source: company.source,
		closingPoint: company.closingPoint,
	};
	const merged = mergeDeepResearch(existing, research);
	const complete = isDeepResearchComplete(merged);
	const status = complete ? "完了" : "要確認";

	if (input.dryRun) {
		return {
			companyId: company.page.id,
			action: "dry-run",
			message: complete
				? "dry-run: 深掘りリサーチと与信判定を反映し、完了にできます。"
				: "dry-run: 一部不足のため要確認で止める想定です。",
		};
	}

	// 4. 構造化列（TDB由来は安全マージ、リサーチ由来は空欄のみ補完）
	const patches: Record<string, SafePatch> = tdb ? tdbToPatches(tdb) : {};
	if (tdb) {
		patches["信頼度"] = { kind: "select", value: score.信頼度 };
		patches["提案可否"] = { kind: "select", value: score.提案可否 };
	}
	patches["企業調査ステータス"] = { kind: "select", value: status };
	// 実行の足あと: いつのリサーチかを列で見えるように打刻(鮮度判断・再実行判断に使う)
	patches["リサーチ最終実行日"] = {
		kind: "date",
		value: new Date().toISOString().slice(0, 10),
	};
	const properties = companyPage.properties ?? {};
	// 短い事実列はベタ値化(出典番号・末尾「です。」を除去)。経営陣は文章なので除外。
	// 既存値が旧コードの汚れ付きならノイズだけ修復する(addStructuredFactPatch)。
	addStructuredFactPatch(patches, properties, "代表者", merged.representative);
	addPatchIfBlank(patches, properties, "経営陣", merged.executives);
	addStructuredFactPatch(patches, properties, "業種", merged.industry);
	addStructuredFactPatch(patches, properties, "資本金", merged.capital);
	addStructuredFactPatch(patches, properties, "設立年月", merged.founded);
	addStructuredFactPatch(patches, properties, "売上規模", merged.revenue);
	addStructuredFactPatch(patches, properties, "従業員規模", merged.employees);
	addStructuredFactPatch(patches, properties, "上場区分", merged.listingStatus);
	addStructuredFactPatch(patches, properties, "法人番号（TDB）", merged.corporateNumber);
	addPatchIfBlank(patches, properties, "ウェブサイトURL", merged.websiteUrl);
	addPatchIfBlank(patches, properties, "公式SNS情報", merged.officialSns);
	addPatchIfBlank(patches, properties, "役員SNS発信メモ", merged.executiveSns);
	addPatchIfBlank(
		patches,
		properties,
		"LinkedIn.",
		normalizeSourcesText([merged.linkedinProfiles, merged.linkedinUrl]),
	);
	addPatchIfBlank(patches, properties, "口コミ情報", merged.reviews);
	addPatchIfBlank(patches, properties, "求人情報や従業員レビュー", merged.jobSignals);
	addPatchIfBlank(patches, properties, "直近ニュース", merged.recentNews);
	addPatchIfBlank(patches, properties, "再エネ接点シグナル", merged.renewableSignals);
	addPatchIfBlank(patches, properties, "想定決裁者", merged.decisionMaker);
	addPatchIfBlank(patches, properties, "想定反論・懸念", merged.objections);
	const officialSourceText = normalizeSourcesText([merged.officialSources, merged.source]);
	const externalSourceText = normalizeSourcesText([
		merged.externalSources,
		merged.citations.join("\n"),
	]);
	const primarySourceUrl = firstSourceUrl(officialSourceText, externalSourceText);
	addPatchIfBlank(patches, properties, "根拠ソース", officialSourceText);
	addPatchIfBlank(patches, properties, "出典ソース", externalSourceText);
	// 既存テキスト列は空欄補完を基本にし、汚れ値/古い保留文だけ取り消し線付き履歴で修復する。
	addResearchPatchWithRevision(
		patches,
		properties,
		"企業サマリー",
		research.summary || merged.summary,
		primarySourceUrl,
	);
	addResearchPatchWithRevision(
		patches,
		properties,
		"現在課題仮説",
		research.currentIssue || merged.currentIssue,
		primarySourceUrl,
	);
	addResearchPatchWithRevision(
		patches,
		properties,
		"将来課題仮説",
		research.futureIssue || merged.futureIssue,
		primarySourceUrl,
	);
	addResearchPatchWithRevision(
		patches,
		properties,
		"営業切り口",
		research.salesAngle || merged.salesAngle,
		primarySourceUrl,
	);
	addResearchPatchWithRevision(
		patches,
		properties,
		"和上解決策適合",
		research.fit || merged.fit,
		primarySourceUrl,
	);
	addPatchIfBlank(patches, properties, "3C：顧客・市場分析", merged.customerMarket3c);
	addPatchIfBlank(patches, properties, "3C：競合分析", merged.competitor3c);
	addPatchIfBlank(patches, properties, "3C：自社との関係性", merged.wajoRelation3c);
	addResearchPatchWithRevision(
		patches,
		properties,
		"成約へのポイント",
		research.closingPoint || merged.closingPoint,
		primarySourceUrl,
	);
	appendMemoText(
		patches,
		properties,
		"企業AI受付メモ",
		buildCompanyResearchAuditMemo({ research: merged, score, status }),
	);
	await safeUpdateExistingProperties(notion, companyPage, patches);

	// 5. 本文ドシエ
	const dossierBlocks = buildDossierBlocks(company.name, merged, score);
	await appendCompanyDossierBlocks(notion, company.page.id, dossierBlocks);

	return {
		companyId: company.page.id,
		action: complete ? "updated-company" : "needs-review",
		message: complete
			? `深掘りリサーチ完了。与信: ${score.信頼度}/${score.提案可否}。`
			: `深掘りは反映したが一部不足のため要確認。与信: ${score.信頼度}/${score.提案可否}。`,
	};
	} finally {
		if (acquiredResearchLock) companyResearchInflight.delete(company.page.id);
	}
}

// ── B与信「与信を取る(本命のみ)」── 課金を伴うTDB確報与信の取得。
// 鉄則: ①マネージャーだけ(MANAGER_USER_IDS) ②本命1社ずつボタン手動 ③新鮮なら再購入しない
// ④購入はリクエスト単位の購入許可と取得部品側TDB_ALLOW_PURCHASEの二重キー。全件自動取得は構造的に不可能。
type CreditCheckInput = {
	companyPageId: string;
	requesterUserId?: string;
	dryRun: boolean;
	force?: boolean;
};

async function processCreditCheck(
	input: CreditCheckInput,
	notion: NotionClient,
): Promise<CompanyResearchResult> {
	const companyPage = await notion.pages.retrieve({
		page_id: input.companyPageId,
	});
	const company = readCompany(companyPage);

	// 1. 権限ゲート(課金ボタンはマネージャーのみ)
	if (!isManagerUser(input.requesterUserId)) {
		return {
			companyId: company.page.id,
			action: "needs-permission",
			message:
				"与信取得(課金)はマネージャーのみ実行できます。MANAGER_USER_IDS に登録されたユーザーでボタンを押してください。",
		};
	}

	// 2. 二重課金ロック(既存のTDB調査年月日が新しければ買い直さない)
	const properties = companyPage.properties ?? {};
	const surveyProp = properties["TDB調査年月日"] as
		| { date?: { start?: string } }
		| undefined;
	const surveyDate = surveyProp?.date?.start ?? "";
	const refreshDays = Number(process.env.TDB_REFRESH_DAYS) || 90;
	if (
		!input.force &&
		surveyDate &&
		isTdbSurveyFresh(surveyDate, new Date().toISOString(), refreshDays)
	) {
		return {
			companyId: company.page.id,
			action: "skipped-fresh",
			message: `TDB与信は取得済みです(調査年月日 ${surveyDate}・${refreshDays}日以内)。再取得する場合は force を指定してください(追加課金)。`,
		};
	}

	if (input.dryRun) {
		return {
			companyId: company.page.id,
			action: "dry-run",
			message: `dry-run: ${company.name} のTDB確報与信を取得し、与信8項目と信頼度/提案可否を更新できます(課金≒1,320〜1,760円/件)。`,
		};
	}

	// 3. 実行中ロック(検品指摘③): 取得中の再押し/重複配送で二重課金しない
	const nowIso = new Date().toISOString();
	const inFlightTtl = Number(process.env.TDB_INFLIGHT_TTL_MINUTES) || 10;
	if (isCreditCheckInFlight(company.aiMemo, nowIso, inFlightTtl)) {
		return {
			companyId: company.page.id,
			action: "in-flight",
			message: `TDB与信を取得中です(${inFlightTtl}分以内に開始)。完了を待ってから再実行してください。`,
		};
	}
	const markerMemo = appendShortMemo(
		company.aiMemo,
		`TDB取得中 ${nowIso.slice(0, 16)}(実行者:${input.requesterUserId ?? "不明"})`,
	);
	await safeUpdateExistingProperties(notion, companyPage, {
		企業AI受付メモ: { kind: "text", value: markerMemo },
	});

	// 4. 取得(リクエスト単位の購入許可つき)
	const tdb = await fetchTdbProfile(company, { purchase: true });
	if (!tdb) {
		const memo = appendShortMemo(
			markerMemo,
			`${nowIso.slice(0, 10)} TDB与信取得に失敗(部品未接続/該当なし/購入ガード)。課金は発生していない可能性が高いが、取得部品のログを確認。`,
		);
		await safeUpdateExistingProperties(notion, companyPage, {
			企業AI受付メモ: { kind: "text", value: memo },
		});
		return {
			companyId: company.page.id,
			action: "needs-review",
			message:
				"TDB与信を取得できませんでした(取得部品未接続/該当なし/購入ガード)。企業AI受付メモに記録しました。",
		};
	}

	// 5. 与信確定: TDB8項目(確報=既存値より優先)＋信頼度/提案可否＋メモ(実行者を監査記録)
	const score = scoreCompany(tdb);
	const memo = appendShortMemo(
		markerMemo,
		`${nowIso.slice(0, 10)} TDB確報与信を取得: 評点${tdb.企業評点 ?? "不明"}/倒産確率${tdb.倒産確率Pct ?? "不明"}%。信頼度${score.信頼度}/提案可否${score.提案可否}。(実行者:${input.requesterUserId ?? "不明"})`,
	);
	await safeUpdateExistingProperties(notion, companyPage, {
		...tdbToPatches(tdb),
		信頼度: { kind: "select", value: score.信頼度 },
		提案可否: { kind: "select", value: score.提案可否 },
		企業AI受付メモ: { kind: "text", value: memo },
	});
	return {
		companyId: company.page.id,
		action: "updated-credit",
		message: `TDB確報与信を反映しました。評点${tdb.企業評点 ?? "不明"} → 信頼度${score.信頼度}/提案可否${score.提案可否}。`,
	};
}

function registerMeetingQuickStartWebhook(
	name: string,
	titleText: string,
	meetingType: MeetingPrimaryType,
): void {
	worker.webhook(name, {
		title: titleText,
		description:
			"ミーティングデータベースに、本日のミーティングページを作成します。商談は商談専用Webhookで商談データベースへ作成します。",
		execute: async (events, { notion }) => {
			// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
			for (const event of events) {
				await processMeetingQuickStart(
					{ meetingType, dryRun: false },
					notion as unknown as NotionClient,
				);
			}
		},
	});
}

function registerDealQuickStartWebhook(
	name: string,
	titleText: string,
): void {
	worker.webhook(name, {
		title: titleText,
		description:
			"商談データベースに本日の商談ページを作成します。関連企業未設定のため要確認で止めます。",
		execute: async (events, { notion }) => {
			// Notionボタン起動のためverifyWebhookSecretは不要（URLに認証トークン含む）
			for (const event of events) {
				await processDealQuickStart(
					{ dryRun: false },
					notion as unknown as NotionClient,
				);
			}
		},
	});
}

async function processMeetingQuickStart(
	input: MeetingQuickStartInput,
	notion: NotionClient,
): Promise<MeetingQuickStartResult> {
	const normalized = normalizeMeetingPrimaryType(input.meetingType);
	if (normalized.primaryType === "商談") {
		const now = input.now ?? new Date();
		const { date } = meetingQuickStartDateTimeJST(now);
		return {
			meetingPageId: null,
			meetingUrl: null,
			action: "use-deal-quick-start",
			meetingType: "商談",
			meetingDate: date,
			title: "商談",
			message:
				"商談はミーティングデータベースへ作成しません。quickStartDeal / quickStartDealWebhook で商談データベースへ作成してください。",
		};
	}
	const meetingType = normalized.primaryType;
	const now = input.now ?? new Date();
	const { date, time } = meetingQuickStartDateTimeJST(now);
	const titleText = buildMeetingQuickStartTitle(meetingType, now);
	const createArgs = buildMeetingQuickStartCreateArgs({
		meetingType,
		now,
		tags: normalized.tags,
	});
	const children = buildMeetingQuickStartChildren(meetingType, date, time);
	const markdown = await buildMeetingQuickStartMarkdown(notion);

	if (input.dryRun) {
		return {
			meetingPageId: null,
			meetingUrl: null,
			action: "dry-run",
			meetingType,
			meetingDate: date,
			title: titleText,
			message: `dry-run: ${titleText} をミーティングデータベースへ作成できます。`,
		};
	}

	const created = await notion.pages.create(createArgs);
	await replacePageMarkdownOrAppendFallback(notion, created.id, markdown, children);
	return {
		meetingPageId: created.id,
		meetingUrl: created.url ?? null,
		action: "created-meeting",
		meetingType,
		meetingDate: date,
		title: titleText,
		message: `${titleText} をミーティングデータベースへ作成しました。Notion標準ボタン側では作成後にページを開く設定にしてください。`,
	};
}

async function buildMeetingQuickStartMarkdown(notion: NotionClient): Promise<string> {
	return retrieveTemplateMarkdown(notion, MEETING_TEMPLATE_ID);
}

async function processDealQuickStart(
	input: DealQuickStartInput,
	notion: NotionClient,
): Promise<DealQuickStartResult> {
	const now = input.now ?? new Date();
	const { date } = meetingQuickStartDateTimeJST(now);
	const titleText = buildDealQuickStartTitle(now);
	const createArgs = buildDealQuickStartCreateArgs({ now });
	const children = buildDealQuickStartChildren();
	const markdown = await buildDealQuickStartMarkdown(notion);

	if (input.dryRun) {
		return {
			dealPageId: null,
			dealUrl: null,
			action: "dry-run",
			dealDate: date,
			title: titleText,
			message: `dry-run: ${titleText} を商談データベースへ作成できます。関連企業未設定のため要確認で止めます。`,
		};
	}

	const created = await notion.pages.create(createArgs);
	await replacePageMarkdownOrAppendFallback(notion, created.id, markdown, children);
	const fullPage = await notion.pages.retrieve({ page_id: created.id });
	await safeUpdateExistingProperties(notion, fullPage, {
		商談ステータス: { kind: "select", value: "要確認" },
		商談概要: {
			kind: "text",
			value:
				"関連企業未設定のため要確認。企業ページまたは案件ページ起点で作る場合は、関連企業を自動引き継ぎする。",
		},
		商談日: { kind: "date", value: date },
	});

	return {
		dealPageId: created.id,
		dealUrl: created.url ?? null,
		action: "created-deal",
		dealDate: date,
		title: titleText,
		message:
			`${titleText} を商談データベースへ作成しました。関連企業未設定のため要確認で止めています。`,
	};
}

function buildMeetingQuickStartCreateArgs(input: {
	meetingType: MeetingPrimaryType;
	now?: Date;
	tags?: string[];
}): Record<string, unknown> {
	const now = input.now ?? new Date();
	const { dateTime } = meetingQuickStartDateTimeJST(now);
	const titleText = buildMeetingQuickStartTitle(input.meetingType, now);
	return {
		parent: { data_source_id: MEETING_DATA_SOURCE_ID },
		properties: {
			ミーティング名: title(titleText),
			ミーティング日: { date: { start: dateTime } },
			ミーティング種別: select(input.meetingType),
			タグ: multiSelect(buildMeetingQuickStartTags(input.meetingType, input.tags ?? [])),
		},
		template: pageTemplate(MEETING_TEMPLATE_ID),
	};
}

function buildDealQuickStartCreateArgs(input: {
	now?: Date;
}): Record<string, unknown> {
	const now = input.now ?? new Date();
	const titleText = buildDealQuickStartTitle(now);
	return {
		parent: { data_source_id: DEAL_DATA_SOURCE_ID },
		properties: {
			商談名: title(titleText),
		},
	};
}

async function buildDealQuickStartMarkdown(notion: NotionClient): Promise<string> {
	const templateMarkdown = await retrieveTemplateMarkdown(notion, DEAL_TEMPLATE_ID);
	if (templateMarkdown) {
		return appendDealRequiredCompanyWarning(templateMarkdown);
	}
	return appendDealRequiredCompanyWarning([
		'<meeting-notes>',
		"\t商談",
		"\t<notes>",
		"\t</notes>",
		"</meeting-notes>",
		'<callout icon="🎤" color="orange_bg">',
		"\t**まずは上の ▶️ ボタンで録音スタート**",
		"\tAIが自動で文字起こし・要約・アクション項目を抽出します。",
		"</callout>",
		"---",
		'<callout icon="🤝" color="green_bg">',
		"\t**商談の定義**：明確な相手（対象企業）がいて、売買に関する行為が発生している集まり。原則として**見積書を持参する段階から**が商談。**関連企業は必須入力。**",
		"</callout>",
		"### 基本情報を入力",
		'<table header-row="true" header-column="true">',
		"<tr>",
		"<td>項目</td>",
		"<td>入力方法</td>",
		"</tr>",
		"<tr>",
		"<td>📅 商談日（必須）</td>",
		"<td>← プロパティ「商談日」を選択</td>",
		"</tr>",
		"<tr>",
		"<td>🏢 関連企業（必須）</td>",
		"<td>← プロパティ「関連企業」を選択</td>",
		"</tr>",
		"<tr>",
		"<td>📁 関連案件</td>",
		"<td>← プロパティ「関連案件」を選択</td>",
		"</tr>",
		"<tr>",
		"<td>🧑‍💼 担当営業（必須）</td>",
		"<td>← プロパティ「担当営業ユーザー」を選択</td>",
		"</tr>",
		"</table>",
		"---",
		"## 決定事項 / 合意事項",
		"-",
		"## 次アクション（誰が・いつまで）",
		"- [ ]",
		"## 懸念・宿題",
		"-",
		"## 商談メモ",
		"-",
		"## 次回の一手",
		"-",
	].join("\n"));
}

async function retrieveTemplateMarkdown(
	notion: NotionClient,
	templateId: string | undefined,
): Promise<string> {
	const clean = (templateId ?? "").trim();
	if (!clean || !notion.pages.retrieveMarkdown) return "";
	try {
		const response = await notion.pages.retrieveMarkdown({ page_id: clean });
		return typeof response.markdown === "string" ? response.markdown.trim() : "";
	} catch (error) {
		console.log(`template markdown retrieval skipped: ${String(error).slice(0, 180)}`);
		return "";
	}
}

function appendDealRequiredCompanyWarning(markdown: string): string {
	const warning =
		'<callout icon="⚠️" color="red_bg">\n\t関連企業が未設定です。商談は必ず企業を紐づけてください。企業未設定のまま完成扱いにはしません。\n</callout>';
	if (markdown.includes("関連企業が未設定です")) return markdown;
	return `${markdown.trim()}\n---\n${warning}`;
}

function buildDealQuickStartChildren(): Record<string, unknown>[] {
	return [
		{
			type: "callout",
			callout: {
				icon: { type: "emoji", emoji: "▶️" },
				rich_text: blockRichText(
					"この商談ページで Notion AI Meeting Notes の録音を開始してください。録音後、商談フィードバック、次回アクション、勝ち筋、成約/失注兆候をWAJO側AIで返します。",
				),
			},
		},
		{
			type: "callout",
			callout: {
				icon: { type: "emoji", emoji: "⚠️" },
				rich_text: blockRichText(
					"関連企業が未設定です。商談は必ず企業を紐づけてください。企業未設定のまま完成扱いにはしません。",
				),
			},
		},
	];
}

async function replacePageMarkdownOrAppendFallback(
	notion: NotionClient,
	pageId: string,
	markdown: string,
	fallbackChildren: Record<string, unknown>[],
): Promise<void> {
	if (!notion.pages.updateMarkdown || !markdown.trim()) {
		await appendBlocksIfAny(notion, pageId, fallbackChildren);
		return;
	}
	await notion.pages.updateMarkdown({
		page_id: pageId,
		type: "replace_content",
		replace_content: {
			new_str: markdown,
		},
	});
}

function buildMeetingQuickStartTags(
	meetingType: MeetingPrimaryType,
	tags: string[],
): string[] {
	return uniqueStrings([
		...tags,
		meetingType === "商談" ? "商談" : "",
	]).slice(0, 8);
}

function buildMeetingQuickStartChildren(
	meetingType: MeetingPrimaryType,
	meetingDate: string,
	meetingTime: string,
): Record<string, unknown>[] {
	const label = meetingType === "商談" ? "商談" : "ミーティング";
	return [
		{
			type: "callout",
			callout: {
				icon: { type: "emoji", emoji: "▶️" },
				rich_text: blockRichText(
					"このページで Notion AI Meeting Notes の録音を開始してください。録音後、メモ整形・タスク化・ナレッジ候補化を必要に応じて実行します。",
				),
			},
		},
		{
			type: "heading_2",
			heading_2: { rich_text: blockRichText("ミーティング情報") },
		},
		{
			type: "bulleted_list_item",
			bulleted_list_item: { rich_text: blockRichText(`種別: ${label}`) },
		},
		{
			type: "bulleted_list_item",
			bulleted_list_item: {
				rich_text: blockRichText(`開始時刻: ${meetingDate} ${meetingTime}`),
			},
		},
		{
			type: "heading_2",
			heading_2: { rich_text: blockRichText("議題") },
		},
		{
			type: "paragraph",
			paragraph: { rich_text: blockRichText("") },
		},
		{
			type: "heading_2",
			heading_2: { rich_text: blockRichText("決定事項") },
		},
		{
			type: "paragraph",
			paragraph: { rich_text: blockRichText("") },
		},
		{
			type: "heading_2",
			heading_2: { rich_text: blockRichText("アクション項目") },
		},
		{
			type: "paragraph",
			paragraph: { rich_text: blockRichText("") },
		},
		{
			type: "heading_2",
			heading_2: { rich_text: blockRichText("ナレッジ候補") },
		},
		{
			type: "paragraph",
			paragraph: { rich_text: blockRichText("") },
		},
	];
}

function blockRichText(content: string): Array<Record<string, unknown>> {
	return richTextItems(content);
}

function buildMeetingQuickStartTitle(
	meetingType: MeetingPrimaryType,
	now = new Date(),
): string {
	const { date, time } = meetingQuickStartDateTimeJST(now);
	return `${meetingType}｜${date} ${time}`;
}

function buildDealQuickStartTitle(now = new Date()): string {
	const { date, time } = meetingQuickStartDateTimeJST(now);
	return `商談｜${date} ${time}`;
}

function meetingQuickStartDateTimeJST(now: Date): {
	date: string;
	time: string;
	dateTime: string;
} {
	const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
	const iso = jst.toISOString();
	const date = iso.slice(0, 10);
	const time = iso.slice(11, 16);
	return {
		date,
		time,
		dateTime: `${date}T${time}:00+09:00`,
	};
}

export {
	buildDealQuickStartCreateArgs as buildDealQuickStartCreateArgsForTest,
	buildMeetingQuickStartCreateArgs as buildMeetingQuickStartCreateArgsForTest,
	buildMeetingQuickStartTitle as buildMeetingQuickStartTitleForTest,
	processDealQuickStart as processDealQuickStartForTest,
	processMeetingDealLink as processMeetingDealLinkForTest,
	processMeetingMemoFormat as processMeetingMemoFormatForTest,
	processMeetingQuickStart as processMeetingQuickStartForTest,
};

async function processMeetingMemoFormat(
	input: MeetingMemoFormatInput,
	notion: NotionClient,
): Promise<MeetingMemoFormatResult> {
	const meetingPage = await notion.pages.retrieve({
		page_id: input.meetingPageId,
	});
	const properties = meetingPage.properties ?? {};
	const titleText = readMeetingTitleText(properties);
	const meetingType = readMeetingKindForPrompt(properties);
	const propertyText = buildMeetingPropertySource(properties);
	const blockText = await fetchPageBlockPlainText(notion, meetingPage.id);
	const source = [blockText, propertyText].filter(Boolean).join("\n\n").slice(0, 12000);

	if (source.replace(/\s/g, "").length < 80) {
		const message =
			"Meeting Notes本文または会議本文が未生成/短すぎるため、整形せず要確認で停止しました。";
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, meetingPage, {
				メモ整形ステータス: { kind: "select", value: "要確認" },
				メモ整形メモ: { kind: "text", value: message },
			});
		}
		return {
			meetingPageId: meetingPage.id,
			action: "needs-review",
			status: "要確認",
			message,
		};
	}

	if (input.dryRun) {
		return {
			meetingPageId: meetingPage.id,
			action: "dry-run",
			status: "dry-run",
			message: `dry-run: ${titleText} / ${meetingType} を ${source.length} 文字の本文から整形できます。`,
		};
	}

	let formatted: MeetingMemoAIResponse;
	try {
		formatted = await callAnthropicMeetingMemoFormat({
			title: titleText,
			meetingType,
			source,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await safeUpdateExistingProperties(notion, meetingPage, {
			メモ整形ステータス: { kind: "select", value: "エラー" },
			メモ整形メモ: {
				kind: "text",
				value: `会議メモ整形Workerエラー: ${message.slice(0, 500)}`,
			},
		});
		return {
			meetingPageId: meetingPage.id,
			action: "error",
			status: "エラー",
			message: `Anthropic API呼び出し失敗: ${message}`,
		};
	}

	const taskStatus = resolveMeetingMemoTaskStatus(properties, formatted.taskStatus);
	const patches: Record<string, SafePatch> = {
		メモ整形ステータス: { kind: "select", value: formatted.formatStatus },
		メモ整形メモ: {
			kind: "text",
			value: buildMeetingMemoFormatMemo(formatted, properties, taskStatus),
		},
		タスク化ステータス: { kind: "select", value: taskStatus },
	};

	addPatchIfBlank(patches, properties, "テキスト", formatted.text);
	addPatchIfBlank(patches, properties, "要約", formatted.summary);
	addPatchIfBlank(patches, properties, "議事内容", formatted.minutes);
	addPatchIfBlank(patches, properties, "決定事項", formatted.decisions);
	addPatchIfBlank(patches, properties, "アクション項目", formatted.actionItems);
	await safeUpdateExistingProperties(notion, meetingPage, patches);

	const evaluationLogPreview = await createMeetingEvaluationLogsFromExtraction(
		{
			meetingPage,
			extraction: {
				speechLogCandidates: formatted.speechLogCandidates,
				salesContributionCandidates: formatted.salesContributionCandidates,
			},
			source,
			dryRun: true,
		},
		notion,
	);
	const evaluationLogResult = input.generateEvaluationLogs
		? await createMeetingEvaluationLogsFromExtraction(
			{
				meetingPage,
				extraction: {
					speechLogCandidates: formatted.speechLogCandidates,
					salesContributionCandidates: formatted.salesContributionCandidates,
				},
				source,
				dryRun: false,
			},
			notion,
		)
		: null;

	return {
		meetingPageId: meetingPage.id,
		action: formatted.formatStatus === "対象外" ? "target-out" : "formatted",
		status: formatted.formatStatus,
		message: [
			`会議メモ整形完了。タスク化ステータス: ${taskStatus}。`,
			input.generateEvaluationLogs
				? `発言ログ作成: ${evaluationLogResult?.speechCreated ?? 0}件。`
				: `評価材料候補プレビュー: 発言ログ${evaluationLogPreview.speechCreated}件。`,
			input.generateEvaluationLogs
				? `営業貢献ログ作成: ${evaluationLogResult?.salesContributionCreated ?? 0}件。`
				: `営業貢献ログ${evaluationLogPreview.salesContributionCreated}件。生成は未実行。`,
			(evaluationLogResult?.errors ?? 0) > 0
				? `評価材料候補作成エラー: ${evaluationLogResult?.errors ?? 0}件。`
				: "",
			evaluationLogPreview.messages.length > 0
				? `プレビュー除外: ${evaluationLogPreview.messages.slice(0, 3).join(" / ")}`
				: "",
		].filter(Boolean).join(" "),
	};
}

function resolveMeetingMemoTaskStatus(
	properties: Record<string, unknown>,
	aiTaskStatus: MeetingMemoAIResponse["taskStatus"],
): MeetingMemoAIResponse["taskStatus"] | "作成済" {
	const currentTaskStatus = text(properties["タスク化ステータス"]);
	const hasRelatedTasks =
		relationIdsFromProperty(properties["関連チームタスク"]).length > 0 ||
		relationIdsFromProperty(properties["関連タスク"]).length > 0;
	if (currentTaskStatus === "作成済" || hasRelatedTasks) return "作成済";
	return aiTaskStatus;
}

function buildMeetingPropertySource(properties: Record<string, unknown>): string {
	return [
		["既存テキスト", text(properties["テキスト"])],
		["既存要約", text(properties["要約"])],
		["既存議事内容", text(properties["議事内容"])],
		["既存決定事項", text(properties["決定事項"])],
		["既存アクション項目", text(properties["アクション項目"])],
	]
		.filter(([, value]) => value)
		.map(([label, value]) => `【${label}】\n${value}`)
		.join("\n\n");
}

function addPatchIfBlank(
	patches: Record<string, SafePatch>,
	properties: Record<string, unknown>,
	propertyName: string,
	value: string,
): void {
	if (!value.trim()) return;
	if (!isTextPropertyBlank(properties[propertyName])) return;
	patches[propertyName] = { kind: "text", value };
}

function isTextPropertyBlank(property: unknown): boolean {
	return text(property).trim().length === 0;
}

function appendMemoText(
	patches: Record<string, SafePatch>,
	properties: Record<string, unknown>,
	propertyName: string,
	append: string,
): void {
	const current = text(properties[propertyName]).trim();
	patches[propertyName] = {
		kind: "text",
		value: current ? `${current}\n\n${append}` : append,
	};
}

function shouldKeepWithRevision(current: string): boolean {
	const needsReview = /[未要]確認|【取れていない事実】|【取れば取れる】|【初回ヒアリングで取る】/.test(
		current,
	);
	return (
		isLikelyFabricatedText(current) ||
		(current.length <= 18 && needsReview) ||
		needsReview
	);
}

function addPatchWithRevision(
	patches: Record<string, SafePatch>,
	properties: Record<string, unknown>,
	propertyName: string,
	incoming: string,
	reason: string,
	sourceUrl?: string,
): void {
	const current = text(properties[propertyName]).trim();
	const next = incoming.trim();
	if (!next) return;
	if (normalizeWhitespace(next) === normalizeWhitespace(current)) return;
	const isThreeTier = (value: string): boolean => /【取れていない事実】/.test(value);
	if (current && isThreeTier(current) && isThreeTier(next)) return;
	if (!current) {
		patches[propertyName] = { kind: "text", value: next };
		return;
	}
	if (shouldKeepWithRevision(current)) {
		patches[propertyName] = {
			kind: "text-with-revision",
			oldValue: current,
			newValue: next,
			reason,
			checkedAt: todayDateJST(),
			sourceUrl,
		};
		return;
	}
}

function addResearchPatchWithRevision(
	patches: Record<string, SafePatch>,
	properties: Record<string, unknown>,
	propertyName: string,
	incoming: string,
	sourceUrl?: string,
): void {
	const current = text(properties[propertyName]).trim();
	if (!current) {
		addPatchIfBlank(patches, properties, propertyName, incoming);
		return;
	}
	addPatchWithRevision(
		patches,
		properties,
		propertyName,
		incoming,
		"企業マスター高密度化で、既存値の汚れ値または古い保留文を検出したため。",
		sourceUrl,
	);
}

function isLikelyFabricatedText(value: string): boolean {
	if (!value) return false;
	return /推測|仮説|憶測/.test(normalizeWhitespace(value));
}

function firstSourceUrl(...values: string[]): string | undefined {
	for (const value of values) {
		const match = value.match(/https?:\/\/[^\s）)】]+/);
		if (match?.[0]) return match[0];
	}
	return undefined;
}

function buildCompanyResearchAbTestLog(): string {
	return [
		"【ABテスト対象】公式事実取得 / 公式SNS / 役員SNS / 口コミ情報 / 求人・従業員レビュー / 出典整理",
		"【方式A】Perplexity経由で候補を取得し、要約粒度で反映する。",
		"【方式B】公式サイト・公的DB・各媒体を直接確認し、固定投稿や最新5件まで分けて反映する。",
		"【採用方式】初期運用は方式Aの要約方式。重要企業・本命企業は方式Bを検証継続。",
		"【理由】通常フローの読了負担と二重リサーチを抑えつつ、出典URLと要確認理由を残せるため。",
		"【次回調整】誤同定率、取得率、営業が読む密度を見て、公式SNS・役員SNS・求人の粒度を調整する。",
	].join("\n");
}

function buildCompanyResearchAgentElements(
	research: DeepResearch,
): {
	officialFacts: CompanyResearchEvidenceElement[];
	externalSignals: CompanyResearchEvidenceElement[];
} {
	return {
		officialFacts: buildAiAOfficialFactElements(research),
		externalSignals: buildAiBExternalSignalElements(research),
	};
}

function buildAiAOfficialFactElements(
	research: DeepResearch,
): CompanyResearchEvidenceElement[] {
	const sourceUrl = firstSourceUrl(
		normalizeSourcesText([research.officialSources, research.source]),
		normalizeSourcesText([research.externalSources, research.citations.join("\n")]),
	);
	const rows: Array<[string, string, string, "high" | "medium" | "low"]> = [
		["representative", research.representative, "代表者", "high"],
		["executives", research.executives, "経営陣", "medium"],
		["industry", research.industry, "業種", "high"],
		["capital", research.capital, "資本金", "high"],
		["founded", research.founded, "設立年月", "high"],
		["revenue", research.revenue, "売上規模", "medium"],
		["employees", research.employees, "従業員規模", "medium"],
		["listing_status", research.listingStatus, "上場区分", "high"],
		["website_url", research.websiteUrl, "ウェブサイトURL", "high"],
		["corporate_number", research.corporateNumber, "法人番号（TDB）", "high"],
		["summary", research.summary, "企業サマリー", "medium"],
	];
	return rows
		.filter(([, value]) => Boolean(value?.trim()))
		.map(([field, value, targetProperty, confidence]) => ({
			agent: "official-research-kun" as const,
			kind: "official_fact" as const,
			field,
			value,
			targetProperty,
			sourceUrl: sourceUrl ?? "",
			confidence,
		}));
}

function buildAiBExternalSignalElements(
	research: DeepResearch,
): CompanyResearchEvidenceElement[] {
	const sourceUrl = firstSourceUrl(
		normalizeSourcesText([research.externalSources, research.citations.join("\n")]),
		normalizeSourcesText([research.officialSources, research.source]),
	);
	const rows: Array<[
		string,
		string,
		string,
		string | undefined,
		"high" | "medium" | "low",
	]> = [
		["official_sns", research.officialSns, "公式SNS情報", "営業切り口", "medium"],
		["executive_sns", research.executiveSns, "役員SNS発信メモ", "営業切り口", "medium"],
		["linkedin", normalizeSourcesText([research.linkedinProfiles, research.linkedinUrl]), "LinkedIn.", "役員SNS発信メモ", "medium"],
		["reviews", research.reviews, "口コミ情報", "想定反論・懸念", "low"],
		["hiring_trend", research.jobSignals, "求人情報や従業員レビュー", "現在課題仮説", "medium"],
		["recent_news", research.recentNews, "直近ニュース", "営業切り口", "medium"],
		["renewable_signal", research.renewableSignals, "再エネ接点シグナル", "営業切り口", "medium"],
		["decision_maker", research.decisionMaker, "想定決裁者", undefined, "low"],
		["objections", research.objections, "想定反論・懸念", undefined, "low"],
	];
	return rows
		.filter(([, value]) => Boolean(value?.trim()))
		.map(([field, value, targetProperty, derivedTargetProperty, confidence]) => ({
			agent: "sales-material-kun" as const,
			kind: "external_signal" as const,
			field,
			value,
			targetProperty,
			derivedTargetProperty,
			sourceUrl: sourceUrl ?? "",
			confidence,
		}));
}

function buildCompanyResearchAuditMemo(input: {
	research: DeepResearch;
	score: CreditScore;
	status: string;
}): string {
	const today = todayDateJST();
	const { officialFacts, externalSignals } = buildCompanyResearchAgentElements(
		input.research,
	);
	const officialFactNames = uniqueStrings(
		officialFacts.map((element) => element.targetProperty),
	);
	const externalSignalNames = uniqueStrings(
		externalSignals.map((element) => element.targetProperty),
	);
	return [
		`${today} 商太: researchCompanyDeepで外部調査を1回だけ実行し、公式調査くん/営業材料くんへ素材を分配。二重リサーチなし。`,
		`${today} 公式調査くん（公式調査くん相当）: ${officialFactNames.length ? `${officialFactNames.join("、")}を公式ファクトとして分類。` : "公式ファクトは追加取得なし。"}`,
		`${today} 営業材料くん（営業材料くん相当）: ${externalSignalNames.length ? `${externalSignalNames.join("、")}を外部シグナルとして分類。` : "外部シグナルは追加取得なし。"}`,
		`${today} 反映くん（反映くん相当）: 公式事実、公式SNS、役員SNS、LinkedIn、口コミ、求人・従業員レビュー、要確認を分離。既存値は上書きせず、必要時のみ取り消し線付き履歴で追記。`,
		`${today} 与信: TDB/COSMOSNetは通常フロー外。管理者ボタン専用のため自動取得・暫定与信列の上書きなし。参考判定=${input.score.信頼度}/${input.score.提案可否}。調査ステータス=${input.status}。`,
		buildCompanyResearchAbTestLog(),
	].join("\n");
}

export {
	buildAiAOfficialFactElements as buildAiAOfficialFactElementsForTest,
	buildAiBExternalSignalElements as buildAiBExternalSignalElementsForTest,
	buildCompanyResearchAbTestLog as buildCompanyResearchAbTestLogForTest,
	buildCompanyResearchAgentElements as buildCompanyResearchAgentElementsForTest,
};

function normalizeSourcesText(values: Array<string | undefined>): string {
	return uniqueStrings(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean)).join(
		"\n",
	);
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, "");
}

function buildMeetingMemoFormatMemo(
	formatted: MeetingMemoAIResponse,
	properties: Record<string, unknown>,
	taskStatus: string = formatted.taskStatus,
): string {
	const skipped = ["テキスト", "要約", "議事内容", "決定事項", "アクション項目"].filter(
		(name) => !isTextPropertyBlank(properties[name]),
	);
	const lines = [
		`Worker整形: ${new Date().toISOString()}`,
		`メモ整形ステータス: ${formatted.formatStatus}`,
		`タスク化ステータス: ${taskStatus}`,
		formatted.memo ? `処理メモ: ${formatted.memo}` : "",
		skipped.length > 0
			? `既存入力があるため上書きしなかった項目: ${skipped.join(", ")}`
			: "",
	].filter(Boolean);
	return lines.join("\n").slice(0, 1800);
}

async function callAnthropicMeetingMemoFormat(input: {
	title: string;
	meetingType: string;
	source: string;
}): Promise<MeetingMemoAIResponse> {
	const systemPrompt = [
		"あなたは和上ホールディングスのミーティングメモ整形AIです。",
		"Notion AI Meeting Notes本文またはミーティング本文を読み、ミーティングデータベースのプロパティへ整理します。",
		"",
		"役割:",
		"- 文字起こし/ミーティング内容を読みやすい形に整理する",
		"- 要約、議事内容、決定事項、アクション項目を作る",
		"- 会議/1on1本文に明記された発言ログ候補と営業貢献ログ候補を抽出する",
		"- チームトラッカーにタスクを作らない",
		"- 商談管理DB、関連チームタスク、商談連携状態を更新しない",
		"- 点数、ランク、評価ステータス、給与・処遇判断を確定しない",
		"",
		"アクション項目ルール:",
		"- 会議後に誰かが実行すべきものだけ抽出する",
		"- 担当者が不明なら「担当者要確認」と書く",
		"- 期限が不明なら「期限要確認」と書く",
		"- 不明な担当者を推測でNotionユーザーに割り当てない",
		"",
		"ステータス:",
		"- 明確なアクション項目が1件以上ある場合 taskStatus=未処理",
		"- アクション項目はあるが担当者や期限が曖昧な場合 taskStatus=要確認",
		"- 明確なアクション項目がない場合 taskStatus=対象外",
		"- 本文が短い/未完成/曖昧な場合 formatStatus=要確認",
		"- 整形できた場合 formatStatus=整形済",
		"- 明確な会議内容がない場合 formatStatus=対象外",
		"",
		"発言ログ候補ルール:",
		"- speechLogCandidates には、商談/評価の根拠になる本人の発言だけを入れる",
		`- category は必ず ${SPEECH_LOG_CATEGORY_OPTIONS.join("/")} のどれか。迷う場合は「その他」。旧値「商談」は使わない`,
		"- title は短い発言タイトル、content は本文に根拠がある発言内容だけを書く",
		"- speaker は本文に出ている発言者名だけを書く。不明なら「発言者要確認」",
		"- evidenceQuote は本文から連続する短い抜粋をそのまま入れる",
		"- 根拠が弱いもの、本文にない固有名・数値を含むものは配列に入れない",
		"",
		"営業貢献ログ候補ルール:",
		"- salesContributionCandidates には、会議本文から正当に判断できるナレッジ採用、勝ちトーク化、案件共有、他者支援、チーム支援、社外顧問紹介だけを入れる",
		"- type は必ず「ナレッジ採用/勝ちトーク化/案件共有/他者支援/チーム支援/社外顧問紹介」のどれか。会議で判定できない場合は候補に入れない",
		"- category は type とは独立に、必ず「会議貢献/ナレッジ共有/後輩育成/提案支援/案件支援/商談フォロー/確認・調査/その他」のどれか。迷う場合は「会議貢献」",
		"- 日報いいね、上司FB、特大、紹介、仕組み化提案、成約・失注の学びは会議抽出のselect値として使わない",
		"- impact は大/中/小。本文上の高は大、低は小へ寄せる。迷うものは中",
		"- comment は本文に根拠がある貢献内容だけを書く",
		"- evidenceQuote は本文から連続する短い抜粋をそのまま入れる",
		"- 自己申告だけで根拠が弱いもの、本文にない固有名・数値を含むものは配列に入れない",
		"",
		"必ずJSONのみを返してください。",
	].join("\n");

	const userPrompt = [
		`会議名: ${input.title || "未設定"}`,
		`種別・タグ: ${input.meetingType || "未設定"}`,
		"",
		"=== ミーティング本文 ===",
		input.source.slice(0, 12000),
	].join("\n");

	const raw = await callAnthropicChat({
		system: systemPrompt,
		user: userPrompt,
		maxTokens: 2000,
		temperature: 0,
		jsonSchema: MEETING_MEMO_RESPONSE_FORMAT,
	});
	return parseMeetingMemoAIResponse(raw);
}

function parseMeetingMemoAIResponse(raw: string): MeetingMemoAIResponse {
	try {
		const parsed = JSON.parse(raw) as Partial<MeetingMemoAIResponse>;
		const taskStatus =
			parsed.taskStatus === "未処理" ||
			parsed.taskStatus === "要確認" ||
			parsed.taskStatus === "対象外"
				? parsed.taskStatus
				: "要確認";
		const formatStatus =
			parsed.formatStatus === "整形済" ||
			parsed.formatStatus === "要確認" ||
			parsed.formatStatus === "対象外"
				? parsed.formatStatus
				: "要確認";
		return {
			text: typeof parsed.text === "string" ? parsed.text : "",
			summary: typeof parsed.summary === "string" ? parsed.summary : "",
			minutes: typeof parsed.minutes === "string" ? parsed.minutes : "",
			decisions: typeof parsed.decisions === "string" ? parsed.decisions : "",
			actionItems: typeof parsed.actionItems === "string" ? parsed.actionItems : "",
			taskStatus,
			formatStatus,
			memo: typeof parsed.memo === "string" ? parsed.memo : "",
			speechLogCandidates: normalizeMeetingSpeechLogCandidates(
				(parsed as { speechLogCandidates?: unknown }).speechLogCandidates,
			),
			salesContributionCandidates: normalizeMeetingSalesContributionCandidates(
				(parsed as { salesContributionCandidates?: unknown }).salesContributionCandidates,
			),
		};
	} catch (error) {
		console.log("parseMeetingMemoAIResponse failed", String(error));
		return {
			text: "",
			summary: "",
			minutes: "",
			decisions: "",
			actionItems: "",
			taskStatus: "要確認",
			formatStatus: "要確認",
			memo: `JSONパース失敗: ${raw.slice(0, 200)}`,
			speechLogCandidates: [],
			salesContributionCandidates: [],
		};
	}
}

function normalizeMeetingSpeechLogCandidates(value: unknown): MeetingSpeechLogCandidate[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item): MeetingSpeechLogCandidate | null => {
			if (!item || typeof item !== "object") return null;
			const candidate = item as Record<string, unknown>;
			return {
				title: stringValue(candidate.title),
				content: stringValue(candidate.content),
				category: stringValue(candidate.category),
				speaker: stringValue(candidate.speaker),
				evidenceQuote: stringValue(candidate.evidenceQuote),
				confidence: normalizeConfidence(stringValue(candidate.confidence)),
			};
		})
		.filter((item): item is MeetingSpeechLogCandidate => Boolean(item))
		.slice(0, 8);
}

function normalizeMeetingSalesContributionCandidates(
	value: unknown,
): MeetingSalesContributionCandidate[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item): MeetingSalesContributionCandidate | null => {
			if (!item || typeof item !== "object") return null;
			const candidate = item as Record<string, unknown>;
			return {
				title: stringValue(candidate.title),
				type: stringValue(candidate.type),
				category: stringValue(candidate.category),
				impact: normalizeContributionImpact(stringValue(candidate.impact)),
				comment: stringValue(candidate.comment),
				evidenceQuote: stringValue(candidate.evidenceQuote),
				confidence: normalizeConfidence(stringValue(candidate.confidence)),
			};
		})
		.filter((item): item is MeetingSalesContributionCandidate => Boolean(item))
		.slice(0, 8);
}

function stringValue(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeConfidence(value: string): string {
	if (value === "高" || value === "中" || value === "低") return value;
	return "低";
}

function filterMeetingEvaluationLogExtraction(
	extraction: MeetingEvaluationLogExtraction,
	source: string,
): Required<MeetingEvaluationLogExtraction> {
	const skipped: string[] = [];
	if (source.replace(/\s/g, "").length < 80) {
		return {
			speechLogCandidates: [],
			salesContributionCandidates: [],
			skipped: [
				...extraction.speechLogCandidates.map((candidate) =>
					`発言ログ候補を短文停止: ${candidate.title || candidate.content}`,
				),
				...extraction.salesContributionCandidates.map((candidate) =>
					`営業貢献候補を短文停止: ${candidate.title || candidate.comment}`,
				),
			],
		};
	}

	const speechLogCandidates = extraction.speechLogCandidates
		.map((candidate) => ({
			...candidate,
			category: normalizeSpeechLogCategory(candidate.category, candidate.content),
		}))
		.filter((candidate) => {
			const reason = meetingSpeechLogSkipReason(candidate, source);
			if (reason) {
				skipped.push(reason);
				return false;
			}
			return true;
		})
		.slice(0, 5);
	const salesContributionCandidates = extraction.salesContributionCandidates
		.map((candidate) => ({
			...candidate,
			type: normalizeSalesContributionType(candidate.type, candidate.comment),
			category: normalizeSalesContributionCategory(candidate.category, candidate.comment),
			impact: normalizeContributionImpact(candidate.impact),
		}))
		.filter((candidate) => {
			const reason = meetingSalesContributionSkipReason(candidate, source);
			if (reason) {
				skipped.push(reason);
				return false;
			}
			return true;
		})
		.slice(0, 5);
	return {
		speechLogCandidates,
		salesContributionCandidates,
		skipped,
	};
}

function meetingSpeechLogSkipReason(
	candidate: MeetingSpeechLogCandidate,
	source: string,
): string {
	const label = candidate.title || candidate.content || "無題発言";
	if (candidate.confidence === "低") return `発言ログ候補を低信頼で除外: ${label}`;
	if (!isAllowedMeetingOption(candidate.category, SPEECH_LOG_CATEGORY_OPTIONS)) {
		return `発言ログ候補をselect集合外で除外: ${label} / 発言カテゴリ=${candidate.category || "未設定"}`;
	}
	if (!candidate.title.trim() || !candidate.content.trim()) {
		return `発言ログ候補を必須不足で除外: ${label}`;
	}
	if (!sourceContainsMeaningfulQuote(source, candidate.evidenceQuote)) {
		return `発言ログ候補を根拠不一致で除外: ${label} / ${candidate.speaker} / ${candidate.content}`;
	}
	if (candidate.speaker && !isUnknownSpeaker(candidate.speaker) && !sourceIncludesText(source, candidate.speaker)) {
		return `発言ログ候補を本文外発言者で除外: ${label} / ${candidate.speaker}`;
	}
	const unsupported = unsupportedSpecificTokens(source, [
		candidate.title,
		candidate.content,
		candidate.speaker,
		candidate.evidenceQuote,
	].join("\n"));
	if (unsupported.length > 0) {
		return `発言ログ候補を本文外固有情報で除外: ${label} / ${unsupported.join(", ")}`;
	}
	return "";
}

function meetingSalesContributionSkipReason(
	candidate: MeetingSalesContributionCandidate,
	source: string,
): string {
	const label = candidate.title || candidate.comment || "無題貢献";
	if (candidate.confidence === "低") return `営業貢献候補を低信頼で除外: ${label}`;
	if (!isAllowedMeetingOption(candidate.type, SALES_CONTRIBUTION_TYPE_OPTIONS)) {
		return `営業貢献候補をselect集合外で除外: ${label} / 種別=${candidate.type || "未設定"}`;
	}
	if (!isAllowedMeetingOption(candidate.category, SALES_CONTRIBUTION_CATEGORY_OPTIONS)) {
		return `営業貢献候補をselect集合外で除外: ${label} / 貢献カテゴリ=${candidate.category || "未設定"}`;
	}
	if (!isAllowedMeetingOption(candidate.impact, CONTRIBUTION_IMPACT_OPTIONS)) {
		return `営業貢献候補をselect集合外で除外: ${label} / 貢献インパクト=${candidate.impact || "未設定"}`;
	}
	if (!candidate.title.trim() || !candidate.comment.trim()) {
		return `営業貢献候補を必須不足で除外: ${label}`;
	}
	if (!sourceContainsMeaningfulQuote(source, candidate.evidenceQuote)) {
		return `営業貢献候補を根拠不一致で除外: ${label} / ${candidate.comment}`;
	}
	const unsupported = unsupportedSpecificTokens(source, [
		candidate.title,
		candidate.type,
		candidate.category,
		candidate.comment,
		candidate.evidenceQuote,
	].join("\n"));
	if (unsupported.length > 0) {
		return `営業貢献候補を本文外固有情報で除外: ${label} / ${unsupported.join(", ")}`;
	}
	return "";
}

function sourceContainsMeaningfulQuote(source: string, quote: string): boolean {
	const normalizedQuote = normalizeForSourceMatch(quote);
	if (normalizedQuote.length < 8) return false;
	return normalizeForSourceMatch(source).includes(normalizedQuote);
}

function sourceIncludesText(source: string, value: string): boolean {
	const normalizedValue = normalizeForSourceMatch(value);
	if (!normalizedValue) return true;
	return normalizeForSourceMatch(source).includes(normalizedValue);
}

function normalizeForSourceMatch(value: string): string {
	return value.replace(/\s/g, "").trim();
}

function isUnknownSpeaker(value: string): boolean {
	return /不明|要確認|未設定|担当者/.test(value);
}

function isAllowedMeetingOption<T extends readonly string[]>(
	value: string,
	options: T,
): value is T[number] {
	return (options as readonly string[]).includes(value);
}

function unsupportedSpecificTokens(source: string, value: string): string[] {
	const normalizedSource = normalizeForSourceMatch(source);
	const tokens = uniqueStrings([
		...matchTokens(value, /[0-9０-９]+(?:[,.．，][0-9０-９]+)?(?:億円|万円|円|件|社|名|日|月|年|%|％|MW|kW|kWh|坪|㎡|m2)?/g),
		...matchTokens(value, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g),
		...matchTokens(value, /[A-Za-z0-9.-]+\.(?:co\.jp|com|jp|net|org)/g),
		...matchTokens(value, /[一-龯々ァ-ヶーA-Za-z0-9]+(?:株式会社|有限会社|合同会社|商事|ホールディングス|HD)/g),
		...matchTokens(value, /[一-龯々ァ-ヶー]{2,}(?:さん|様|氏|社長|部長|課長)/g),
	]);
	return tokens.filter((token) => !normalizedSource.includes(normalizeForSourceMatch(token)));
}

function matchTokens(value: string, pattern: RegExp): string[] {
	return value.match(pattern) ?? [];
}

function normalizeSpeechLogCategory(category: string, _content: string): string {
	const normalized = category.trim();
	if (!normalized) return "その他";
	if (isAllowedMeetingOption(normalized, SPEECH_LOG_CATEGORY_OPTIONS)) return normalized;
	return "";
}

function normalizeSalesContributionType(type: string, _comment: string): string {
	const normalized = type.trim();
	if (isAllowedMeetingOption(normalized, SALES_CONTRIBUTION_TYPE_OPTIONS)) {
		return normalized;
	}
	return "";
}

function normalizeSalesContributionCategory(category: string, _comment: string): string {
	const normalized = category.trim();
	if (!normalized) return "会議貢献";
	if (isAllowedMeetingOption(normalized, SALES_CONTRIBUTION_CATEGORY_OPTIONS)) {
		return normalized;
	}
	return "";
}

function normalizeContributionImpact(value: string): "大" | "中" | "小" | "" {
	const normalized = value.trim();
	if (!normalized) return "中";
	if (normalized === "高" || normalized === "大") return "大";
	if (normalized === "中") return "中";
	if (normalized === "低" || normalized === "小") return "小";
	return "";
}

function buildMeetingEvaluationLogCreatePlans(input: {
	meetingPage: Page;
	extraction: MeetingEvaluationLogExtraction;
	source: string;
}): {
	speechLogCreates: Record<string, unknown>[];
	salesContributionCreates: Record<string, unknown>[];
	skipped: string[];
} {
	const filtered = filterMeetingEvaluationLogExtraction(input.extraction, input.source);
	const properties = input.meetingPage.properties ?? {};
	const meetingDate = readMeetingDateForEvaluationLog(properties, input.meetingPage);
	const meetingTitle = readMeetingTitleText(properties);
	const singleSalesUserIds = singleUserIds(personIdsFromProperty(properties["担当営業ユーザー"]));
	const relatedCompanyIds = relationIdsFromProperty(properties["関連企業"]);
	const relatedDealIds = relationIdsFromProperty(properties["関連商談"]);
	const speechLogCreates = filtered.speechLogCandidates.map((candidate) => {
		const createProperties: Record<string, unknown> = {
			発言タイトル: title(candidate.title),
			発言内容: richText(buildMeetingSpeechLogContent(candidate, meetingTitle)),
			発言カテゴリ: select(candidate.category),
			関連会議: relationIds([input.meetingPage.id]),
			評価加点候補: { checkbox: false },
		};
		if (meetingDate) createProperties["発言日時"] = { date: { start: meetingDate } };
		if (singleSalesUserIds.length === 1) {
			createProperties["発言者"] = {
				people: singleSalesUserIds.map((id) => ({ object: "user", id })),
			};
		}
		if (relatedCompanyIds.length > 0) {
			createProperties["関連企業"] = relationIds(relatedCompanyIds.slice(0, 3));
		}
		createProperties["発言処理メモ"] = richText(
			buildMeetingSpeechProcessingMemo(candidate, meetingTitle, input.meetingPage.id),
		);
		return {
			parent: { data_source_id: SPEECH_LOG_DATA_SOURCE_ID },
			properties: createProperties,
		};
	});
	const salesContributionCreates = filtered.salesContributionCandidates.map((candidate) => {
		const createProperties: Record<string, unknown> = {
			貢献タイトル: title(candidate.title),
			種別: select(candidate.type),
			貢献カテゴリ: select(candidate.category),
			貢献インパクト: select(candidate.impact),
			AIコメント: richText(
				buildMeetingSalesContributionComment(
					candidate,
					meetingTitle,
					input.meetingPage.id,
				),
			),
			評価反映状態: select("未反映"),
		};
		if (meetingDate) createProperties["日付"] = { date: { start: meetingDate } };
		if (singleSalesUserIds.length === 1) {
			createProperties["対象営業ユーザー"] = {
				people: singleSalesUserIds.map((id) => ({ object: "user", id })),
			};
		}
		if (relatedDealIds.length > 0) {
			createProperties["関連商談"] = relationIds(relatedDealIds.slice(0, 3));
		}
		return {
			parent: { data_source_id: SALES_CONTRIBUTION_LOG_DATA_SOURCE_ID },
			properties: createProperties,
		};
	});
	return {
		speechLogCreates,
		salesContributionCreates,
		skipped: filtered.skipped,
	};
}

function buildMeetingSpeechLogContent(
	candidate: MeetingSpeechLogCandidate,
	meetingTitle: string,
): string {
	return [
		candidate.content,
		candidate.speaker ? `発言者候補: ${candidate.speaker}` : "",
		`元会議: ${meetingTitle}`,
		`根拠抜粋: ${candidate.evidenceQuote}`,
	].filter(Boolean).join("\n").slice(0, 1800);
}

function buildMeetingSpeechProcessingMemo(
	candidate: MeetingSpeechLogCandidate,
	meetingTitle: string,
	meetingPageId: string,
): string {
	const extractionHash = meetingEvaluationExtractionHash("speech", meetingPageId, candidate);
	return [
		`会議メモ整形Worker抽出: ${new Date().toISOString()}`,
		`元会議: ${meetingTitle}`,
		`元会議ID: ${meetingPageId}`,
		`抽出ハッシュ:${extractionHash}`,
		`発言者候補: ${candidate.speaker || "未設定"}`,
		`信頼度: ${candidate.confidence}`,
		`根拠抜粋: ${candidate.evidenceQuote}`,
		"点数・ランク・評価確定は未実施。",
	].join("\n").slice(0, 1800);
}

function buildMeetingSalesContributionComment(
	candidate: MeetingSalesContributionCandidate,
	meetingTitle: string,
	meetingPageId: string,
): string {
	const extractionHash = meetingEvaluationExtractionHash(
		"salesContribution",
		meetingPageId,
		candidate,
	);
	return [
		candidate.comment,
		`元会議: ${meetingTitle}`,
		`元会議ID: ${meetingPageId}`,
		`抽出ハッシュ:${extractionHash}`,
		`根拠抜粋: ${candidate.evidenceQuote}`,
		`抽出信頼度: ${candidate.confidence}`,
		"会議本文からの営業貢献候補。承認・点数・評価確定は未実施。",
	].join("\n").slice(0, 1800);
}

function meetingEvaluationExtractionHash(
	kind: "speech" | "salesContribution",
	meetingPageId: string,
	candidate: MeetingSpeechLogCandidate | MeetingSalesContributionCandidate,
): string {
	const body =
		kind === "speech"
			? (candidate as MeetingSpeechLogCandidate).content
			: (candidate as MeetingSalesContributionCandidate).comment;
	const evidence = candidate.evidenceQuote || body;
	return createHash("sha256")
		.update([
			kind,
			meetingPageId,
			normalizeForSourceMatch(evidence),
			normalizeForSourceMatch(body),
		].join("\n"))
		.digest("hex")
		.slice(0, 16);
}

function readMeetingDateForEvaluationLog(
	properties: Record<string, unknown>,
	meetingPage: Page,
): string {
	return (
		dateStartFromProperty(properties["会議日時"]) ||
		dateStartFromProperty(properties["ミーティング日時"]) ||
		dateStartFromProperty(properties["開催日時"]) ||
		dateStartFromProperty(properties["開催日"]) ||
		dateStartFromProperty(properties["日付"]) ||
		createdDateFromPage(meetingPage)
	);
}

function singleUserIds(ids: string[]): string[] {
	const unique = uniqueIds(ids);
	return unique.length === 1 ? unique : [];
}

async function createMeetingEvaluationLogsFromExtraction(
	input: {
		meetingPage: Page;
		extraction: MeetingEvaluationLogExtraction;
		source: string;
		dryRun?: boolean;
	},
	notion: NotionClient,
): Promise<{
	speechCreated: number;
	salesContributionCreated: number;
	skipped: number;
	errors: number;
	messages: string[];
}> {
	const plans = buildMeetingEvaluationLogCreatePlans({
		meetingPage: input.meetingPage,
		extraction: input.extraction,
		source: input.source,
	});
	const messages = [...plans.skipped];
	if (input.dryRun) {
		return {
			speechCreated: plans.speechLogCreates.length,
			salesContributionCreated: plans.salesContributionCreates.length,
			skipped: plans.skipped.length,
			errors: 0,
			messages,
		};
	}
	let speechCreated = 0;
	let salesContributionCreated = 0;
	let duplicateSkipped = 0;
	let errors = 0;
	for (const createArgs of plans.speechLogCreates) {
		try {
			const duplicate = await meetingEvaluationLogAlreadyExists(
				notion,
				"speech",
				input.meetingPage.id,
				createArgs,
			);
			if (duplicate) {
				duplicateSkipped += 1;
				messages.push(`重複スキップ: 発言ログ ${meetingLogCreateTitle(createArgs)}`);
				continue;
			}
			await notion.pages.create(createArgs);
			speechCreated += 1;
		} catch (error) {
			errors += 1;
			messages.push(`発言ログ作成失敗: ${String(error).slice(0, 160)}`);
		}
	}
	for (const createArgs of plans.salesContributionCreates) {
		try {
			const duplicate = await meetingEvaluationLogAlreadyExists(
				notion,
				"salesContribution",
				input.meetingPage.id,
				createArgs,
			);
			if (duplicate) {
				duplicateSkipped += 1;
				messages.push(`重複スキップ: 営業貢献ログ ${meetingLogCreateTitle(createArgs)}`);
				continue;
			}
			await notion.pages.create(createArgs);
			salesContributionCreated += 1;
		} catch (error) {
			errors += 1;
			messages.push(`営業貢献ログ作成失敗: ${String(error).slice(0, 160)}`);
		}
	}
	return {
		speechCreated,
		salesContributionCreated,
		skipped: plans.skipped.length + duplicateSkipped,
		errors,
		messages,
	};
}

async function meetingEvaluationLogAlreadyExists(
	notion: NotionClient,
	kind: "speech" | "salesContribution",
	meetingPageId: string,
	createArgs: Record<string, unknown>,
): Promise<boolean> {
	if (!notion.dataSources?.query) return false;
	const createProperties = meetingLogCreateProperties(createArgs);
	const titleText =
		kind === "speech"
			? createPropertyText(createProperties["発言タイトル"])
			: createPropertyText(createProperties["貢献タイトル"]);
	const titleFilters = uniqueStrings([
		titleText,
		normalizeMeetingLogTitleKey(titleText),
	])
		.filter(Boolean)
		.map((value) =>
			kind === "speech"
				? { property: "発言タイトル", title: { equals: value } }
				: { property: "貢献タイトル", title: { equals: value } },
		);
	const extractionHash = meetingLogCreateExtractionHash(kind, createProperties);
	const hashFilter = extractionHash
		? kind === "speech"
			? {
				property: "発言処理メモ",
				rich_text: { contains: `抽出ハッシュ:${extractionHash}` },
			}
			: {
				property: "AIコメント",
				rich_text: { contains: `抽出ハッシュ:${extractionHash}` },
			}
		: null;
	const identityFilters = [hashFilter, ...titleFilters].filter(Boolean);
	const filter =
		kind === "speech"
			? {
				and: [
					{ property: "関連会議", relation: { contains: meetingPageId } },
					identityFilters.length > 1
						? { or: identityFilters }
						: identityFilters[0] ?? null,
				].filter(Boolean),
			}
			: {
				and: [
					{ property: "AIコメント", rich_text: { contains: `元会議ID: ${meetingPageId}` } },
					identityFilters.length > 1
						? { or: identityFilters }
						: identityFilters[0] ?? null,
				].filter(Boolean),
			};
	const response = await notion.dataSources.query({
		data_source_id:
			kind === "speech"
				? SPEECH_LOG_DATA_SOURCE_ID
				: SALES_CONTRIBUTION_LOG_DATA_SOURCE_ID,
		page_size: 1,
		filter,
	});
	return Array.isArray(response.results) && response.results.length > 0;
}

function normalizeMeetingLogTitleKey(value: string): string {
	return value.replace(/\s/g, "").trim();
}

function meetingLogCreateExtractionHash(
	kind: "speech" | "salesContribution",
	properties: Record<string, unknown>,
): string {
	const memo =
		kind === "speech"
			? createPropertyText(properties["発言処理メモ"])
			: createPropertyText(properties["AIコメント"]);
	const match = memo.match(/抽出ハッシュ:([a-f0-9]+)/i);
	return match?.[1] ?? "";
}

function meetingLogCreateProperties(createArgs: Record<string, unknown>): Record<string, unknown> {
	const properties = createArgs.properties;
	return properties && typeof properties === "object"
		? (properties as Record<string, unknown>)
		: {};
}

function meetingLogCreateTitle(createArgs: Record<string, unknown>): string {
	const properties = meetingLogCreateProperties(createArgs);
	return (
		createPropertyText(properties["発言タイトル"]) ||
		createPropertyText(properties["貢献タイトル"]) ||
		"無題"
	);
}

function createPropertyText(property: unknown): string {
	if (!property || typeof property !== "object") return "";
	const prop = property as Record<string, unknown>;
	const titleItems = Array.isArray(prop.title) ? prop.title : [];
	const richTextItemsValue = Array.isArray(prop.rich_text) ? prop.rich_text : [];
	const items = titleItems.length > 0 ? titleItems : richTextItemsValue;
	return items
		.map((item) => {
			if (!item || typeof item !== "object") return "";
			const rich = item as Record<string, unknown>;
			if (typeof rich.plain_text === "string") return rich.plain_text;
			if (rich.text && typeof rich.text === "object") {
				const textValue = rich.text as Record<string, unknown>;
				return typeof textValue.content === "string" ? textValue.content : "";
			}
			return "";
		})
		.join("")
		.trim();
}

export {
	buildMeetingEvaluationLogCreatePlans as buildMeetingEvaluationLogCreatePlansForTest,
	createMeetingEvaluationLogsFromExtraction as createMeetingEvaluationLogsFromExtractionForTest,
	filterMeetingEvaluationLogExtraction as filterMeetingEvaluationLogExtractionForTest,
	parseMeetingMemoAIResponse as parseMeetingMemoAIResponseForTest,
};

async function fetchPageBlockPlainText(
	notion: NotionClient,
	pageId: string,
	depth = 0,
): Promise<string> {
	if (!notion.blocks?.children?.list || depth > 2) return "";
	const lines: string[] = [];
	let startCursor: string | null | undefined;
	for (let i = 0; i < 5; i += 1) {
		const response = await notion.blocks.children.list({
			block_id: pageId,
			page_size: 100,
			start_cursor: startCursor,
		});
		for (const block of response.results) {
			const blockText = blockPlainText(block);
			if (blockText) lines.push(blockText);
			if (block.has_children === true && typeof block.id === "string") {
				const childText = await fetchPageBlockPlainText(notion, block.id, depth + 1);
				if (childText) lines.push(childText);
			}
		}
		if (!response.has_more || !response.next_cursor) break;
		startCursor = response.next_cursor;
	}
	return lines.join("\n").slice(0, 16000);
}

function blockPlainText(block: Record<string, unknown>): string {
	const type = typeof block.type === "string" ? block.type : "";
	const typed = type && block[type] && typeof block[type] === "object"
		? (block[type] as Record<string, unknown>)
		: {};
	const parts: string[] = [];
	for (const key of ["rich_text", "title", "caption"]) {
		const value = typed[key];
		if (Array.isArray(value)) {
			const plainText = plain(value);
			if (plainText) parts.push(plainText);
		}
	}
	for (const key of ["text", "transcript", "summary"]) {
		const value = typed[key];
		if (typeof value === "string" && value.trim()) parts.push(value.trim());
		if (Array.isArray(value)) {
			const plainText = plain(value);
			if (plainText) parts.push(plainText);
		}
	}
	if (type === "child_page" && typeof typed.title === "string") {
		parts.push(typed.title);
	}
	// 表の行(table_row): cells=リッチテキスト配列の配列。「項目: 内容」形に直す
	// (基本情報の表組み化でドシエ全文抽出から数字が消えないように。検品レビュー反映)
	if (type === "table_row" && Array.isArray(typed.cells)) {
		const cellTexts = (typed.cells as unknown[])
			.map((cell) => (Array.isArray(cell) ? plain(cell) : ""))
			.filter(Boolean);
		if (cellTexts.length > 0) parts.push(cellTexts.join(": "));
	}
	return parts.join("\n").trim();
}

async function processMeetingFeedback(
	input: MeetingFeedbackInput,
	notion: NotionClient,
): Promise<MeetingFeedbackResult> {
	const meetingPage = await notion.pages.retrieve({
		page_id: input.meetingPageId,
	});
	const properties = meetingPage.properties ?? {};
	const titleText = readMeetingTitleText(properties);
	const meetingType = readMeetingKindForPrompt(properties);
	const source = buildMeetingFeedbackSource(properties);

	if (source.replace(/\s/g, "").length < 120) {
		const message =
			"会議フィードバックに必要な要約・議事内容・アクション項目が短すぎるため、要確認で停止しました。";
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, meetingPage, {
				振り返りステータス: { kind: "select", value: "要確認" },
				振り返りメモ: { kind: "text", value: message },
			});
		}
		return {
			meetingPageId: meetingPage.id,
			action: "needs-review",
			status: "要確認",
			message,
		};
	}

	if (input.dryRun) {
		return {
			meetingPageId: meetingPage.id,
			action: "dry-run",
			status: "dry-run",
			message: `dry-run: ${titleText} / ${meetingType} を ${source.length} 文字の会議材料から振り返りできます。`,
		};
	}

	let feedback: MeetingFeedbackAIResponse;
	try {
		feedback = await callAnthropicMeetingFeedback({
			title: titleText,
			meetingType,
			source,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await safeUpdateExistingProperties(notion, meetingPage, {
			振り返りステータス: { kind: "select", value: "エラー" },
			振り返りメモ: {
				kind: "text",
				value: `会議フィードバックWorkerエラー: ${message.slice(0, 500)}`,
			},
		});
		return {
			meetingPageId: meetingPage.id,
			action: "error",
			status: "エラー",
			message: `Anthropic API呼び出し失敗: ${message}`,
		};
	}

	const patches: Record<string, SafePatch> = {
		振り返りステータス: { kind: "select", value: feedback.status },
		振り返りメモ: {
			kind: "text",
			value: buildMeetingFeedbackMemo(feedback),
		},
	};
	addPatchIfBlank(patches, properties, "AI率直フィードバック", feedback.directFeedback);
	addPatchIfBlank(patches, properties, "良かった点", feedback.goodPoints.join("\n"));
	addPatchIfBlank(patches, properties, "改善ポイント", feedback.improvementPoints.join("\n"));
	addPatchIfBlank(patches, properties, "次回確認事項", feedback.nextQuestions.join("\n"));
	addPatchIfBlank(patches, properties, "会議の次の一手", feedback.nextAction);
	await safeUpdateExistingProperties(notion, meetingPage, patches);
	await createMeetingFeedbackLearningLog(notion, {
		meetingPageId: meetingPage.id,
		meetingTitle: titleText,
		meetingType,
		status: feedback.status,
		directFeedback: feedback.directFeedback,
		goodPoints: feedback.goodPoints,
		improvementPoints: feedback.improvementPoints,
		nextQuestions: feedback.nextQuestions,
		nextAction: feedback.nextAction,
	}).catch((error) => {
		console.log("meeting feedback learning log skipped", String(error));
	});

	return {
		meetingPageId: meetingPage.id,
		action: feedback.status === "返却済" ? "feedback-created" : "needs-review",
		status: feedback.status,
		message:
			feedback.status === "返却済"
				? "会議フィードバックを返却しました。タスク作成、商談更新、評価確定は行っていません。"
				: "会議フィードバックは要確認で停止しました。タスク作成、商談更新、評価確定は行っていません。",
	};
}

function buildMeetingFeedbackSource(properties: Record<string, unknown>): string {
	return [
		["種別・タグ", readMeetingKindForPrompt(properties)],
		["要約", text(properties["要約"])],
		["議事内容", text(properties["議事内容"])],
		["決定事項", text(properties["決定事項"])],
		["アクション項目", text(properties["アクション項目"])],
		["テキスト", text(properties["テキスト"])],
	]
		.filter(([, value]) => value)
		.map(([label, value]) => `【${label}】\n${value}`)
		.join("\n\n")
		.slice(0, 12000);
}

function buildMeetingFeedbackMemo(feedback: MeetingFeedbackAIResponse): string {
	const lines = [
		`Worker振り返り: ${new Date().toISOString()}`,
		`振り返りステータス: ${feedback.status}`,
		"チームトラッカー、商談管理DB、1on1ログDB、点数・最終評価は未更新。",
		feedback.memo ? `処理メモ: ${feedback.memo}` : "",
	].filter(Boolean);
	return lines.join("\n").slice(0, 1800);
}

async function processMeetingDealLink(
	input: MeetingDealLinkInput,
	notion: NotionClient,
): Promise<MeetingDealLinkResult> {
	const meetingPage = await notion.pages.retrieve({
		page_id: input.meetingPageId,
	});
	const meeting = readMeetingDealLinkInfo(meetingPage);

	if (meeting.meetingType !== "商談") {
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, meeting.page, {
				商談連携状態: { kind: "select", value: "未処理" },
			});
		}
		return {
			meetingPageId: meeting.page.id,
			dealPageId: null,
			action: "target-out",
			message:
				"種別またはタグが商談ではないため、商談管理DBへの連携は行いませんでした。",
		};
	}

	const existingByMeeting = await findDealsByMeeting(notion, meeting.page.id);
	const explicitDealIds = meeting.relatedDealIds;
	if (explicitDealIds.length > 1 || existingByMeeting.length > 1) {
		const message =
			"関連商談または関連会議から複数の商談候補が見つかったため、要確認で停止しました。";
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, meeting.page, {
				商談連携状態: { kind: "select", value: "要確認" },
			});
		}
		return {
			meetingPageId: meeting.page.id,
			dealPageId: null,
			action: "needs-review",
			message,
		};
	}

	const existingDealId = explicitDealIds[0] ?? existingByMeeting[0]?.id;
	if (existingDealId) {
		if (input.dryRun) {
			return {
				meetingPageId: meeting.page.id,
				dealPageId: existingDealId,
				action: "dry-run",
				message: "dry-run: 既存商談へ会議を紐づけ、会議側を連携済みにできます。",
			};
		}
		const dealPage = await notion.pages.retrieve({ page_id: existingDealId });
		await linkMeetingAndDeal(notion, meeting, dealPage);
		return {
			meetingPageId: meeting.page.id,
			dealPageId: existingDealId,
			action: "linked-existing",
			message:
				"既存商談へ会議を紐づけました。商談のフィードバック欄やスコアは更新していません。",
		};
	}

	if (meeting.relatedCompanyIds.length !== 1) {
		const message =
			"商談会議ですが、関連企業が1社に確定していないため、商談作成は行わず要確認で停止しました。";
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, meeting.page, {
				商談連携状態: { kind: "select", value: "要確認" },
			});
		}
		return {
			meetingPageId: meeting.page.id,
			dealPageId: null,
			action: "needs-review",
			message,
		};
	}

	if (input.dryRun) {
		return {
			meetingPageId: meeting.page.id,
			dealPageId: null,
			action: "dry-run",
			message:
				"dry-run: 種別/タグ=商談、関連企業1社、既存関連商談なし。商談管理DBへ1件作成できます。",
		};
	}

	const dealPage = await createDealFromMeeting(notion, meeting);
	await linkMeetingAndDeal(notion, meeting, dealPage);
	return {
		meetingPageId: meeting.page.id,
		dealPageId: dealPage.id,
		action: "created-deal",
		message:
			"商談会議から商談管理DBへ1件作成し、会議と相互リンクしました。チームトラッカー、成約DB、営業評価DBは更新していません。",
	};
}

function readMeetingDealLinkInfo(page: Page): MeetingDealLinkInfo {
	const properties = page.properties ?? {};
	return {
		page,
		titleText: readMeetingTitleText(properties),
		meetingType: readMeetingPrimaryType(properties),
		meetingDate:
			dateStartFromProperty(properties["ミーティング日"]) ||
			dateStartFromProperty(properties["会議日"]),
		summary: text(properties["要約"]),
		minutes: text(properties["議事内容"]),
		decisions: text(properties["決定事項"]),
		actionItems: text(properties["アクション項目"]),
		text: text(properties["テキスト"]),
		relatedDealIds: relationIdsFromProperty(properties["関連商談"]),
		relatedCompanyIds: relationIdsFromProperty(properties["関連企業"]),
		assignedUserIds: personIdsFromProperty(properties["担当営業ユーザー"]),
	};
}

async function findDealsByMeeting(
	notion: NotionClient,
	meetingId: string,
): Promise<Page[]> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: DEAL_DATA_SOURCE_ID,
			page_size: 10,
			filter: {
				// 商談管理DBの実プロパティ名は「関連ミーティング」（2026-06-12 スキーマ裏取り済み）
				property: "関連ミーティング",
				relation: { contains: meetingId },
			},
		});
		return response.results;
	} catch (error) {
		console.log("deal lookup by meeting skipped", String(error));
		return [];
	}
}

async function createDealFromMeeting(
	notion: NotionClient,
	meeting: MeetingDealLinkInfo,
): Promise<Page> {
	const created = await notion.pages.create({
		parent: { data_source_id: DEAL_DATA_SOURCE_ID },
		properties: {
			商談名: title(buildDealNameFromMeeting(meeting)),
		},
	});
	const fullPage = await notion.pages.retrieve({ page_id: created.id });
	const patches: Record<string, SafePatch> = {
		商談ステータス: { kind: "select", value: "実施済" },
		商談概要: { kind: "text", value: buildDealSummaryFromMeeting(meeting) },
		// 実プロパティ名は「関連ミーティング」「元ミーティングID」。旧名も併記（存在しない側はsafeUpdateが自動スキップ）
		関連ミーティング: { kind: "relation", ids: [meeting.page.id] },
		関連会議: { kind: "relation", ids: [meeting.page.id] },
		関連企業: { kind: "relation", ids: meeting.relatedCompanyIds },
		元ミーティングID: { kind: "text", value: meeting.page.id },
		元会議議事録ID: { kind: "text", value: meeting.page.id },
	};
	if (meeting.meetingDate) {
		patches["商談日"] = { kind: "date", value: meeting.meetingDate };
		patches["最新議事録日"] = { kind: "date", value: meeting.meetingDate };
	}
	if (meeting.assignedUserIds.length > 0) {
		patches["担当営業ユーザー"] = {
			kind: "people",
			ids: meeting.assignedUserIds.slice(0, 3),
		};
	}
	await safeUpdateExistingProperties(notion, fullPage, patches);
	return created;
}

async function linkMeetingAndDeal(
	notion: NotionClient,
	meeting: MeetingDealLinkInfo,
	dealPage: Page,
): Promise<void> {
	const dealProperties = dealPage.properties ?? {};
	// 実プロパティ名は「関連ミーティング」。旧名「関連会議」の過去レコードにもフォールバック
	const currentMeetings = relationIdsFromProperty(
		dealProperties["関連ミーティング"] ?? dealProperties["関連会議"],
	);
	const mergedMeetingIds = uniqueStrings([...currentMeetings, meeting.page.id]);
	const dealPatches: Record<string, SafePatch> = {
		関連ミーティング: { kind: "relation", ids: mergedMeetingIds },
		関連会議: { kind: "relation", ids: mergedMeetingIds },
		元ミーティングID: { kind: "text", value: meeting.page.id },
		元会議議事録ID: { kind: "text", value: meeting.page.id },
	};
	addPatchIfBlank(dealPatches, dealProperties, "商談概要", buildDealSummaryFromMeeting(meeting));
	addDatePatchIfBlank(dealPatches, dealProperties, "最新議事録日", meeting.meetingDate);
	addDatePatchIfBlank(dealPatches, dealProperties, "商談日", meeting.meetingDate);
	if (meeting.relatedCompanyIds.length > 0) {
		const currentCompanies = relationIdsFromProperty(dealProperties["関連企業"]);
		dealPatches["関連企業"] = {
			kind: "relation",
			ids: uniqueStrings([...currentCompanies, ...meeting.relatedCompanyIds]).slice(0, 5),
		};
	}
	if (meeting.assignedUserIds.length > 0) {
		const currentUsers = personIdsFromProperty(dealProperties["担当営業ユーザー"]);
		dealPatches["担当営業ユーザー"] = {
			kind: "people",
			ids: uniqueStrings([...currentUsers, ...meeting.assignedUserIds]).slice(0, 3),
		};
	}
	await safeUpdateExistingProperties(notion, dealPage, dealPatches);

	const meetingDealIds = uniqueStrings([...meeting.relatedDealIds, dealPage.id]);
	await safeUpdateExistingProperties(notion, meeting.page, {
		関連商談: { kind: "relation", ids: meetingDealIds },
		商談連携状態: { kind: "select", value: "連携済" },
	});
}

function buildDealNameFromMeeting(meeting: MeetingDealLinkInfo): string {
	const base = meeting.titleText.replace(/^【AIテスト】\s*/, "").trim();
	return `${base || "商談"}｜商談`;
}

function buildDealSummaryFromMeeting(meeting: MeetingDealLinkInfo): string {
	return [
		`会議名: ${meeting.titleText}`,
		meeting.meetingDate ? `会議日: ${meeting.meetingDate}` : "",
		meeting.summary ? `要約: ${meeting.summary}` : "",
		meeting.minutes ? `議事内容: ${meeting.minutes}` : "",
		meeting.decisions ? `決定事項: ${meeting.decisions}` : "",
		meeting.actionItems ? `アクション項目: ${meeting.actionItems}` : "",
		!meeting.summary && !meeting.minutes && meeting.text
			? `本文抜粋: ${meeting.text.slice(0, 500)}`
			: "",
		`Worker処理ID: meeting-deal-link-${meeting.page.id}`,
	].filter(Boolean).join("\n").slice(0, 1800);
}

async function processMeetingTasks(
	input: MeetingTaskInput,
	notion: NotionClient,
): Promise<MeetingTaskResult> {
	const meetingPage = await notion.pages.retrieve({
		page_id: input.meetingPageId,
	});
	const properties = meetingPage.properties ?? {};
	const titleText = readMeetingTitleText(properties);
	const actionItems = text(properties["アクション項目"]);
	const taskStatus = text(properties["タスク化ステータス"]);
	const assignedUserIds = personIdsFromProperty(properties["担当営業ユーザー"]);
	const relatedTaskIds = relationIdsFromProperty(properties["関連チームタスク"]);
	const relatedDealIds = relationIdsFromProperty(properties["関連商談"]);
	const relatedCompanyIds = relationIdsFromProperty(properties["関連企業"]);

	if (actionItems.replace(/\s/g, "").length < 8) {
		const message =
			"アクション項目が空または短すぎるため、チームトラッカーへのタスク作成は行いませんでした。";
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, meetingPage, {
				タスク化ステータス: { kind: "select", value: "対象外" },
				タスク化メモ: { kind: "text", value: message },
			});
		}
		return {
			meetingPageId: meetingPage.id,
			action: "target-out",
			created: 0,
			skipped: 0,
			message,
		};
	}

	const candidates = parseMeetingTaskCandidates(actionItems);
	if (candidates.length === 0) {
		const message =
			"アクション項目はありますが、タスク名として扱える行を抽出できなかったため要確認で停止しました。";
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, meetingPage, {
				タスク化ステータス: { kind: "select", value: "要確認" },
				タスク化メモ: { kind: "text", value: message },
			});
		}
		return {
			meetingPageId: meetingPage.id,
			action: "needs-review",
			created: 0,
			skipped: 0,
			message,
		};
	}

	const existingTasks = await findTeamTasksByMeeting(notion, meetingPage.id);
	const existingRelatedTasks = await Promise.all(
		relatedTaskIds.map(async (taskId) => {
			try {
				const page = await notion.pages.retrieve({ page_id: taskId });
				return readTeamTaskInfo(page);
			} catch (error) {
				console.log("related team task retrieve skipped", String(error));
				return null;
			}
		}),
	);
	const allExistingTasks = dedupeTeamTasks([
		...existingTasks,
		...existingRelatedTasks.filter((task): task is TeamTaskInfo => Boolean(task)),
	]);
	const plans = candidates.map((candidate) => ({
		candidate,
		duplicate: allExistingTasks.find((task) =>
			taskTitlesSimilar(candidate.title, task.title),
		),
	}));
	const skipped = plans.filter((plan) => plan.duplicate).length;
	const createPlans = plans.filter((plan) => !plan.duplicate);

	if (input.dryRun) {
		return {
			meetingPageId: meetingPage.id,
			action: "dry-run",
			created: createPlans.length,
			skipped,
			message: [
				`dry-run: ${titleText} / 現在ステータス=${taskStatus || "未設定"}。`,
				`タスク候補 ${candidates.length} 件、作成予定 ${createPlans.length} 件、重複スキップ予定 ${skipped} 件。`,
				`候補: ${candidates.map((item) => item.title).join(" / ")}`,
			].join(""),
		};
	}

	const createdTaskIds: string[] = [];
	for (const plan of createPlans) {
		const created = await createTeamTrackerTaskFromMeetingAction(notion, {
			meetingPage,
			titleText,
			candidate: plan.candidate,
			assignedUserIds,
			relatedDealIds,
			relatedCompanyIds,
		});
		createdTaskIds.push(created.id);
	}

	const linkedTaskIds = uniqueStrings([
		...relatedTaskIds,
		...allExistingTasks.map((task) => task.page.id),
		...createdTaskIds,
	]);
	const anyNeedsHumanCheck =
		candidates.some((candidate) => candidate.requiresHumanCheck) ||
		assignedUserIds.length !== 1;
	const finalStatus = linkedTaskIds.length > 0 ? "作成済" : anyNeedsHumanCheck ? "要確認" : "対象外";
	await safeUpdateExistingProperties(notion, meetingPage, {
		タスク化ステータス: { kind: "select", value: finalStatus },
		関連チームタスク: { kind: "relation", ids: linkedTaskIds },
		タスク化メモ: {
			kind: "text",
			value: buildMeetingTaskResultMemo({
				titleText,
				created: createdTaskIds.length,
				skipped,
				total: candidates.length,
				anyNeedsHumanCheck,
			}),
		},
	});

	const action = createdTaskIds.length > 0 ? "created-tasks" : "skipped-existing";
	return {
		meetingPageId: meetingPage.id,
		action,
		created: createdTaskIds.length,
		skipped,
		message:
			createdTaskIds.length > 0
				? `会議アクション項目からチームトラッカーへ ${createdTaskIds.length} 件作成しました。重複スキップ ${skipped} 件。`
				: `既存の関連会議タスクと重複したため新規作成は行いませんでした。重複スキップ ${skipped} 件。`,
	};
}

export { processMeetingTasks as processMeetingTasksForTest };

type MeetingKnowledgeCandidate = {
	title: string;
	knowledgeKind: string;
	meetingKnowledgeKind: string;
	summary: string;
	source: string;
	usage: string;
	recommendedTalk: string;
	confidence: string;
	candidateLevel: string;
	importance: string;
	publicScope: string;
	departments: string[];
};

async function processMeetingKnowledge(
	input: MeetingKnowledgeInput,
	notion: NotionClient,
): Promise<MeetingKnowledgeResult> {
	const meetingPage = await notion.pages.retrieve({
		page_id: input.meetingPageId,
	});
	const properties = meetingPage.properties ?? {};
	const titleText = readMeetingTitleText(properties);
	const meetingType = readMeetingKindForPrompt(properties);
	const blockText = await fetchPageBlockPlainText(notion, meetingPage.id);
	const candidate = buildMeetingKnowledgeCandidate({
		titleText,
		meetingType,
		properties,
		blockText,
	});

	if (!candidate) {
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, meetingPage, {
				ナレッジ化ステータス: { kind: "select", value: "要確認" },
				ナレッジ化メモ: {
					kind: "text",
					value: `Worker会議ナレッジ化: ${new Date().toISOString()}\n会議材料が薄いため候補を作成しませんでした。要約、議事内容、決定事項、アクション項目のいずれかを補ってください。`,
				},
			});
		}
		return {
			meetingPageId: meetingPage.id,
			action: input.dryRun ? "dry-run" : "needs-review",
			created: 0,
			candidates: 0,
			knowledgePageId: null,
			message: `会議 ${titleText} はナレッジ候補化に必要な材料が不足しています。`,
		};
	}

	const existing = sortKnowledgePagesForReuse(
		await findKnowledgePagesByMeeting(notion, meetingPage.id),
	);
	if (existing.length > 0) {
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, meetingPage, {
				ナレッジ化ステータス: { kind: "select", value: "作成済" },
				ナレッジ化メモ: {
					kind: "text",
					value: `Worker会議ナレッジ化: ${new Date().toISOString()}\n既に元会議議事録から社内ナレッジ候補が作成済みです。既存候補: ${existing.map((page) => page.id).join(", ")}`,
				},
				ナレッジ化依頼日: { kind: "date", value: todayDateJST() },
				ナレッジ種別: { kind: "select", value: candidate.meetingKnowledgeKind },
			});
		}
		return {
			meetingPageId: meetingPage.id,
			action: "skipped-duplicate",
			created: 0,
			candidates: 1,
			knowledgePageId: existing[0]?.id ?? null,
			message: `会議 ${titleText} は既に社内ナレッジ候補があります。重複作成は行いません。`,
		};
	}

	if (input.dryRun) {
		return {
			meetingPageId: meetingPage.id,
			action: "dry-run",
			created: 0,
			candidates: 1,
			knowledgePageId: null,
			message: `dry-run: ${titleText} から社内ナレッジ候補を1件作成できます。候補: ${candidate.title}`,
		};
	}

	const knowledgePage = await createKnowledgePageFromMeeting(notion, {
		meetingPage,
		titleText,
		meetingType,
		candidate,
		relatedCompanyIds: relationIdsFromProperty(properties["関連企業"]),
		relatedDealIds: relationIdsFromProperty(properties["関連商談"]),
	});
	await safeUpdateExistingProperties(notion, meetingPage, {
		ナレッジ化ステータス: { kind: "select", value: "作成済" },
		ナレッジ化メモ: {
			kind: "text",
			value: buildMeetingKnowledgeResultMemo({
				titleText,
				knowledgePageId: knowledgePage.id,
				candidate,
			}),
		},
		ナレッジ化依頼日: { kind: "date", value: todayDateJST() },
		ナレッジ種別: { kind: "select", value: candidate.meetingKnowledgeKind },
	});

	return {
		meetingPageId: meetingPage.id,
		action: "created-knowledge",
		created: 1,
		candidates: 1,
		knowledgePageId: knowledgePage.id,
		message: `会議 ${titleText} から社内ナレッジ候補を1件作成しました。`,
	};
}

export { processMeetingKnowledge as processMeetingKnowledgeForTest };

function buildMeetingKnowledgeCandidate(input: {
	titleText: string;
	meetingType: string;
	properties: Record<string, unknown>;
	blockText: string;
}): MeetingKnowledgeCandidate | null {
	const source = buildMeetingKnowledgeSource(input.properties, input.blockText);
	if (source.replace(/\s/g, "").length < 60) return null;
	const material = buildMeetingKnowledgeMaterial(input.properties, input.blockText);
	if (!hasMeetingKnowledgeSignal(material)) return null;

	const combined = [
		input.titleText,
		input.meetingType,
		source,
	].join("\n");
	const knowledgeKind = inferMeetingKnowledgeKind(input.meetingType, combined);
	const titleText =
		pickMeetingKnowledgeTitle(input.properties, material) ||
		`${input.titleText}からの学び`;
	const publicScope = /1on1|評価|面談|人事|給与|退職|注意/.test(combined)
		? "マネージャーのみ"
		: "全員";
	const departments = /1on1|評価|面談/.test(combined)
		? ["マネージャー"]
		: /経理|請求|契約|稟議|バックオフィス|管理部/.test(combined)
			? ["バックオフィス", "共通"]
			: ["営業", "共通"];

	return {
		title: titleText,
		knowledgeKind,
		meetingKnowledgeKind: meetingKnowledgeKindFromInternalKind(knowledgeKind),
		summary: buildMeetingKnowledgeSummary(input.titleText, input.meetingType, source),
		source,
		usage: buildMeetingKnowledgeUsage(knowledgeKind, input.meetingType),
		recommendedTalk: buildMeetingKnowledgeRecommendedTalk(knowledgeKind, titleText),
		confidence: source.replace(/\s/g, "").length >= 180 ? "中" : "低",
		candidateLevel: source.replace(/\s/g, "").length >= 180 ? "中" : "低",
		importance: /クレーム|苦情|トラブル|謝罪|決定|ルール|再発防止/.test(combined)
			? "高"
			: "中",
		publicScope,
		departments,
	};
}

function buildMeetingKnowledgeMaterial(
	properties: Record<string, unknown>,
	blockText: string,
): string {
	return [
		text(properties["要約"]),
		text(properties["議事内容"]),
		text(properties["決定事項"]),
		text(properties["アクション項目"]),
		text(properties["良かった点"]),
		text(properties["改善ポイント"]),
		text(properties["次回確認事項"]),
		text(properties["AI率直フィードバック"]),
		text(properties["ミーティングの次の一手"]),
		blockText,
	]
		.filter(Boolean)
		.join("\n\n")
		.slice(0, 4000);
}

function hasMeetingKnowledgeSignal(material: string): boolean {
	const compact = material.replace(/\s/g, "");
	if (compact.length < 60) return false;
	const signalScore = countMeetingKnowledgeSignals(material);
	const auditOrTest = /Codex|監査用|疎通確認|dry[-ー]?run|ドライラン|テスト|処理確認|ダミー/.test(material);
	if (auditOrTest) return signalScore >= 2 && compact.length >= 140;
	return signalScore >= 1;
}

function countMeetingKnowledgeSignals(material: string): number {
	const signalPatterns = [
		/クレーム|苦情|トラブル|謝罪|炎上|再発防止/,
		/決定|ルール|運用|手順|方針|基準|スタンス/,
		/価格|反論|保証|運用負荷|将来費用|初期費用|費用/,
		/勝因|成約|失注|見送り|撤退|断念/,
		/ヒアリング|提案|確認質問|反論処理|営業トーク/,
		/対応|判断|顧客|お客様|取引先|競合/,
		/従業員|社員|理念|存在価値|レゾンデートル/,
		/案件|契約|請求|稟議|バックオフィス|管理部/,
	];
	return signalPatterns.filter((pattern) => pattern.test(material)).length;
}

function buildMeetingKnowledgeSource(
	properties: Record<string, unknown>,
	blockText: string,
): string {
	return [
		["種別・タグ", readMeetingKindForPrompt(properties)],
		["要約", text(properties["要約"])],
		["議事内容", text(properties["議事内容"])],
		["決定事項", text(properties["決定事項"])],
		["アクション項目", text(properties["アクション項目"])],
		["良かった点", text(properties["良かった点"])],
		["改善ポイント", text(properties["改善ポイント"])],
		["次回確認事項", text(properties["次回確認事項"])],
		["AI率直フィードバック", text(properties["AI率直フィードバック"])],
		["ミーティングの次の一手", text(properties["ミーティングの次の一手"])],
		["本文", blockText],
	]
		.filter(([, value]) => value)
		.map(([label, value]) => `【${label}】\n${value}`)
		.join("\n\n")
		.slice(0, 4000);
}

function inferMeetingKnowledgeKind(meetingType: string, source: string): string {
	if (/クレーム|苦情|トラブル|謝罪|炎上|再発防止/.test(source)) return "クレーム";
	if (/失注|見送り|撤退|断念/.test(source)) return "失注学び";
	if (/勝因|成約|刺さった|成功|受注/.test(source)) return "勝ちパターン";
	if (/決定|ルール|運用|手順|方針|基準|スタンス/.test(source)) return "運用ルール";
	if (/商談|営業|価格|反論|ヒアリング|提案/.test(source) || meetingType === "商談") {
		return "営業トーク";
	}
	return "FAQ";
}

function meetingKnowledgeKindFromInternalKind(kind: string): string {
	if (kind === "クレーム") return "クレーム対応";
	if (kind === "勝ちパターン") return "成功事例";
	if (kind === "運用ルール") return "マニュアル";
	if (kind === "失注学び") return "その他";
	if (kind === "営業トーク") return "営業トーク";
	return "FAQ";
}

function pickMeetingKnowledgeTitle(
	properties: Record<string, unknown>,
	source: string,
): string {
	const candidates = [
		text(properties["決定事項"]),
		text(properties["要約"]),
		text(properties["アクション項目"]),
		source,
	];
	for (const candidate of candidates) {
		const titleText = cleanMeetingKnowledgeTitle(firstKnowledgeSentence(candidate));
		if (titleText.replace(/\s/g, "").length >= 8) return titleText.slice(0, 80);
	}
	return "";
}

function firstKnowledgeSentence(value: string): string {
	const clean = value
		.replace(/【[^】]+】/g, " ")
		.replace(/^[-*・\s]+/, "")
		.trim();
	return clean.split(/[。！？!?]\s*/).find((part) => part.trim())?.trim() ?? "";
}

function cleanMeetingKnowledgeTitle(value: string): string {
	return value
		.replace(/^(決定事項|要約|アクション項目|議事内容|本文)[:：]\s*/, "")
		.replace(/^[-*・\s]+/, "")
		.replace(/^\d+[.．、)\s]+/, "")
		.replace(/[。！？!?]+$/, "")
		.trim();
}

function buildMeetingKnowledgeSummary(
	titleText: string,
	meetingType: string,
	source: string,
): string {
	const excerpt = source
		.replace(/【[^】]+】/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 500);
	return [
		`会議: ${titleText}`,
		`種別: ${meetingType || "未設定"}`,
		`抽出要点: ${excerpt}`,
	].join("\n");
}

function buildMeetingKnowledgeUsage(kind: string, meetingType: string): string {
	if (kind === "クレーム") return "クレーム対応、謝罪、再発防止、顧客説明の場面";
	if (kind === "勝ちパターン") return "似た案件の初回商談、提案前、営業ロールプレイ";
	if (kind === "失注学び") return "失注予防、提案前チェック、マネージャー相談";
	if (kind === "運用ルール") return "社内判断、会議後の運用整理、新人教育";
	if (meetingType === "商談" || kind === "営業トーク") {
		return "商談準備、反論処理、ヒアリング設計、フォロー連絡";
	}
	return "FAQ、新人教育、次回同種会議の事前確認";
}

function buildMeetingKnowledgeRecommendedTalk(kind: string, titleText: string): string {
	if (kind === "営業トーク") {
		return `${titleText}。次回の商談では、相手が何を比較軸にしているかを先に確認し、価格・保証・運用負荷・将来リスクを分けて説明する。`;
	}
	if (kind === "クレーム") {
		return `${titleText}。対応時は、事実確認、謝罪、再発防止、次の期限を分けて伝える。`;
	}
	return `${titleText}。同じ状況では、会議で出た判断基準を先に確認してから次の行動を決める。`;
}

async function findKnowledgePagesByMeeting(
	notion: NotionClient,
	meetingPageId: string,
): Promise<Page[]> {
	const pages = new Map<string, Page>();
	for (const propertyName of KNOWLEDGE_MEETING_RELATION_ALIASES) {
		try {
			const response = await notion.dataSources.query({
				data_source_id: KNOWLEDGE_DATA_SOURCE_ID,
				page_size: 10,
				filter: {
					property: propertyName,
					relation: { contains: meetingPageId },
				},
			});
			for (const page of response.results) pages.set(page.id, page);
		} catch (error) {
			console.log("meeting knowledge lookup skipped", {
				propertyName,
				error: String(error),
			});
		}
	}
	return [...pages.values()];
}

function sortKnowledgePagesForReuse(pages: Page[]): Page[] {
	return [...pages].sort((a, b) => {
		const aDuplicate = checkboxValue(a.properties?.["重複疑い"]) ? 1 : 0;
		const bDuplicate = checkboxValue(b.properties?.["重複疑い"]) ? 1 : 0;
		if (aDuplicate !== bDuplicate) return aDuplicate - bDuplicate;
		return String((a as Record<string, unknown>).created_time ?? "").localeCompare(
			String((b as Record<string, unknown>).created_time ?? ""),
		);
	});
}

async function createKnowledgePageFromMeeting(
	notion: NotionClient,
	input: {
		meetingPage: Page;
		titleText: string;
		meetingType: string;
		candidate: MeetingKnowledgeCandidate;
		relatedCompanyIds: string[];
		relatedDealIds: string[];
	},
): Promise<Page> {
	const created = await notion.pages.create({
		parent: { data_source_id: KNOWLEDGE_DATA_SOURCE_ID },
		properties: {
			ナレッジタイトル: title(input.candidate.title),
		},
	});
	const fullPage = await notion.pages.retrieve({ page_id: created.id });
	const patches: Record<string, SafePatch> = {
		ナレッジ種別: { kind: "select", value: input.candidate.knowledgeKind },
		候補判定: { kind: "select", value: "新規候補" },
		元データ種別: { kind: "select", value: "議事録" },
		元ミーティング: { kind: "relation", ids: [input.meetingPage.id] },
		元会議議事録: { kind: "relation", ids: [input.meetingPage.id] },
		要点: { kind: "text", value: input.candidate.summary },
		入力テキスト: { kind: "text", value: input.candidate.source },
		使いどころ: { kind: "text", value: input.candidate.usage },
		根拠メモ: {
			kind: "text",
			value: `Worker会議ナレッジ化: ${new Date().toISOString()}\n会議: ${input.titleText}\n会議種別: ${input.meetingType}\n外部AIは未使用。会議DB内の要約/議事内容/決定事項/アクション項目/良かった点/改善ポイント/次回確認事項/AI率直フィードバック/ミーティングの次の一手/本文から抽出。`,
		},
		推奨トーク: { kind: "text", value: input.candidate.recommendedTalk },
		AI候補度: { kind: "select", value: input.candidate.candidateLevel },
		AI重要度: { kind: "select", value: input.candidate.importance },
		確度: { kind: "select", value: input.candidate.confidence },
		重複疑い: { kind: "checkbox", value: false },
		公開範囲: { kind: "select", value: input.candidate.publicScope },
		対象部門: { kind: "multi_select", values: input.candidate.departments },
		生成ステータス: { kind: "select", value: "完了" },
		運用ステータス: { kind: "select", value: "未着手" },
		AI関係発見メモ: {
			kind: "text",
			value: "同じ元会議議事録relationの候補がある場合はWorker側で二重作成を止めます。",
		},
	};
	if (input.relatedCompanyIds.length > 0) {
		patches["元企業"] = {
			kind: "relation",
			ids: input.relatedCompanyIds.slice(0, 3),
		};
	}
	if (input.relatedDealIds.length > 0) {
		patches["元商談"] = {
			kind: "relation",
			ids: input.relatedDealIds.slice(0, 3),
		};
	}
	await safeUpdateExistingProperties(notion, fullPage, patches);
	return created;
}

function buildMeetingKnowledgeResultMemo(input: {
	titleText: string;
	knowledgePageId: string;
	candidate: MeetingKnowledgeCandidate;
}): string {
	return [
		`Worker会議ナレッジ化: ${new Date().toISOString()}`,
		`会議: ${input.titleText}`,
		`作成候補: ${input.candidate.title}`,
		`社内ナレッジDBページ: ${input.knowledgePageId}`,
		"候補判定は新規候補。採用/保留/不採用は人間が判断してください。",
	].join("\n").slice(0, 1800);
}

function readMeetingTitleText(properties: Record<string, unknown>): string {
	return readFirstTextByAliases(properties, [
		"ミーティング名",
		"会議名",
		"ミーティング名AI",
		"会議名AI",
		"ミーティング名（自動）",
		"会議名（自動）",
	]) || "会議";
}

function parseMeetingTaskCandidates(actionItems: string): MeetingTaskCandidate[] {
	const seen = new Set<string>();
	const result: MeetingTaskCandidate[] = [];
	const lines = actionItems
		.split(/\r?\n/)
		.map((line) => line.trim())
		.flatMap((line) => splitInlineActionItems(line))
		.map((line) => line.trim())
		.filter(Boolean);

	for (const rawLine of lines) {
		const candidate = parseMeetingTaskCandidate(rawLine);
		if (!candidate) continue;
		const key = normalizeTaskTitle(candidate.title);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		result.push(candidate);
	}
	return result.slice(0, 10);
}

function splitInlineActionItems(line: string): string[] {
	if (!line.includes(" / ") && !/[。．]\s*\d+[.．、]/.test(line)) return [line];
	return line
		.replace(/([。．])\s*(?=\d+[.．、])/g, "$1\n")
		.split(/\n/)
		.filter(Boolean);
}

function parseMeetingTaskCandidate(rawLine: string): MeetingTaskCandidate | null {
	const line = rawLine
		.replace(/^[-*・\s]+/, "")
		.replace(/^\d+[.．、)\s]+/, "")
		.trim();
	if (!line || /^(アクション項目|タスク|決定事項|議事内容)[:：]?$/.test(line)) {
		return null;
	}
	if (line.replace(/\s/g, "").length < 6) return null;
	const titleText = extractMeetingTaskTitle(line);
	if (titleText.replace(/\s/g, "").length < 6) return null;
	const dueDate = extractISODateFromText(line);
	const dueText = extractLabeledValue(line, ["期限", "期日", "締切"]) || dueDate || "期限要確認";
	const assigneeValue = extractLabeledValue(line, ["担当者", "担当"]);
	const requiresHumanCheck =
		/担当者要確認|担当要確認|担当者[:：]?\s*(不明|未定|要確認)|誰がやるか未定/.test(line) ||
		/期限要確認|期限[:：]?\s*(不明|未定|要確認)/.test(line);
	return {
		title: titleText.slice(0, 90),
		description: line,
		taskType: inferMeetingTaskType(line),
		priority: inferMeetingTaskPriority(line),
		dueText,
		dueDate,
		requiresHumanCheck: requiresHumanCheck || /要確認|不明|未定/.test(assigneeValue),
	};
}

function extractMeetingTaskTitle(line: string): string {
	const first = line
		.split(/\s*[／/]\s*(?=担当|期限|期日|締切|タスク|種別|補足)/)[0]
		?.trim();
	const withoutLabels = (first || line)
		.replace(/^(タスク内容|内容)[:：]\s*/, "")
		.replace(/\s*(担当者?|期限|期日|締切|タスクタイプ|種別|補足)[:：].*$/, "")
		.trim();
	return withoutLabels || line;
}

function extractLabeledValue(line: string, labels: string[]): string {
	for (const label of labels) {
		const pattern = new RegExp(`${label}\\s*[:：]\\s*([^/／\\n]+)`);
		const match = line.match(pattern);
		if (match?.[1]) return match[1].trim();
	}
	return "";
}

function extractISODateFromText(line: string): string {
	const match = line.match(/\b20\d{2}-\d{2}-\d{2}\b/);
	return match?.[0] ?? "";
}

function inferMeetingTaskType(line: string): string {
	if (/提案資料|資料|見積|書類|作成|ドラフト|契約書/.test(line)) return "書類作成";
	if (/メール|電話|連絡|報告|共有|送付/.test(line)) return "連絡・報告";
	if (/商談|フォロー|顧客|決裁者/.test(line)) return "商談フォロー";
	if (/社内|会議|稟議|調整/.test(line)) return "社内タスク";
	if (/確認|調査|リスト|候補|条件|情報/.test(line)) return "確認・調査";
	return "その他";
}

function inferMeetingTaskPriority(line: string): string {
	if (/至急|今日|本日|明日|急ぎ|高/.test(line)) return "High";
	if (/低|余裕/.test(line)) return "Low";
	return "Medium";
}

async function findTeamTasksByMeeting(
	notion: NotionClient,
	meetingId: string,
): Promise<TeamTaskInfo[]> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: TEAM_TRACKER_DATA_SOURCE_ID,
			page_size: 50,
			filter: {
				property: "関連会議議事録",
				relation: { contains: meetingId },
			},
		});
		return response.results.map(readTeamTaskInfo);
	} catch (error) {
		console.log("meeting task lookup skipped", String(error));
		return [];
	}
}

function dedupeTeamTasks(tasks: TeamTaskInfo[]): TeamTaskInfo[] {
	const seen = new Set<string>();
	const result: TeamTaskInfo[] = [];
	for (const task of tasks) {
		if (!task.page.id || seen.has(task.page.id)) continue;
		seen.add(task.page.id);
		result.push(task);
	}
	return result;
}

async function createTeamTrackerTaskFromMeetingAction(
	notion: NotionClient,
	input: {
		meetingPage: Page;
		titleText: string;
		candidate: MeetingTaskCandidate;
		assignedUserIds: string[];
		relatedDealIds: string[];
		relatedCompanyIds: string[];
	},
): Promise<Page> {
	const created = await notion.pages.create({
		parent: { data_source_id: TEAM_TRACKER_DATA_SOURCE_ID },
		properties: {
			タスク名: title(input.candidate.title),
		},
	});
	const fullPage = await notion.pages.retrieve({ page_id: created.id });
	const memo = buildMeetingTaskMemo(input);
	const patches: Record<string, SafePatch> = {
		概要: { kind: "text", value: memo },
		"説明⚠️まず入力": { kind: "text", value: memo },
		ステータス: { kind: "select", value: "未着手" },
		優先順位: { kind: "select", value: input.candidate.priority },
		タスクタイプ: { kind: "multi_select", values: [input.candidate.taskType] },
		関連会議議事録: { kind: "relation", ids: [input.meetingPage.id] },
	};
	if (input.relatedDealIds.length > 0) {
		patches["関連商談"] = {
			kind: "relation",
			ids: input.relatedDealIds.slice(0, 3),
		};
	}
	if (input.relatedCompanyIds.length > 0) {
		patches["関連企業"] = {
			kind: "relation",
			ids: input.relatedCompanyIds.slice(0, 3),
		};
	}
	if (!input.candidate.requiresHumanCheck && input.assignedUserIds.length === 1) {
		patches["タスク担当者"] = {
			kind: "people",
			ids: input.assignedUserIds,
		};
	}
	if (input.candidate.dueDate) {
		patches["期限"] = { kind: "date", value: input.candidate.dueDate };
	}
	await safeUpdateExistingProperties(notion, fullPage, patches);
	return created;
}

function buildMeetingTaskMemo(input: {
	meetingPage: Page;
	titleText: string;
	candidate: MeetingTaskCandidate;
	assignedUserIds: string[];
}): string {
	const assignee =
		!input.candidate.requiresHumanCheck && input.assignedUserIds.length === 1
			? "会議の担当営業ユーザーを設定"
			: "担当者要確認";
	return [
		`会議: ${input.titleText || input.meetingPage.id}`,
		`根拠: ${input.candidate.description}`,
		`期限: ${input.candidate.dueText || "期限要確認"}`,
		`担当: ${assignee}`,
		input.candidate.requiresHumanCheck
			? "確認: 担当者または期限が曖昧なため人間確認を推奨。"
			: "",
		`Worker処理ID: meeting-task-${input.meetingPage.id}-${normalizeTaskTitle(input.candidate.title).slice(0, 40)}`,
	].filter(Boolean).join("\n").slice(0, 1800);
}

function buildMeetingTaskResultMemo(input: {
	titleText: string;
	created: number;
	skipped: number;
	total: number;
	anyNeedsHumanCheck: boolean;
}): string {
	return [
		`Worker会議タスク化: ${new Date().toISOString()}`,
		`会議: ${input.titleText || "未設定"}`,
		`候補: ${input.total} 件 / 新規作成: ${input.created} 件 / 重複スキップ: ${input.skipped} 件`,
		input.anyNeedsHumanCheck
			? "担当者または期限が曖昧な項目があります。チームトラッカーの担当者要確認ビューで拾ってください。"
			: "",
		"チームトラッカー以外は更新していません。商談管理DB、成約DB、営業評価DBは未更新。",
	].filter(Boolean).join("\n").slice(0, 1800);
}

async function callAnthropicMeetingFeedback(input: {
	title: string;
	meetingType: string;
	source: string;
}): Promise<MeetingFeedbackAIResponse> {
	const systemPrompt = [
		"あなたは和上ホールディングスの会議フィードバックAIです。",
		"会議議事録DBの整形済み内容を読み、次回が良くなる率直なフィードバックを返します。",
		"",
		"原点:",
		"- 記録して終わりではなく、会議・1on1・社内MTGの次が良くなること",
		"- 根拠があるなら遠慮せず厳しめに指摘する",
		"- 分からないことは分からない、要確認と書く",
		"",
		"禁止:",
		"- チームトラッカーにタスクを作成しない",
		"- 関連チームタスクを更新しない",
		"- 商談管理DBを作成・更新しない",
		"- 1on1ログDBを更新しない",
		"- 点数付け、最終評価、総合評価、給与・処遇判断をしない",
		"- 人格評価をしない",
		"",
		"出力:",
		"- AI率直フィードバック: 1段落。良い点と甘い点をはっきり書く",
		"- 良かった点: 箇条書き",
		"- 改善ポイント: 箇条書き。次回に直せる行動へ落とす",
		"- 次回確認事項: 次回会議で聞くべき質問",
		"- 会議の次の一手: 具体的な1手",
		"- 会議内容が薄い/テスト色が強い/材料不足なら status=要確認",
		"- フィードバック可能なら status=返却済",
		"必ずJSONのみを返してください。",
	].join("\n");

	const userPrompt = [
		`会議名: ${input.title || "未設定"}`,
		`会議種別: ${input.meetingType || "未設定"}`,
		"",
		"=== 会議材料 ===",
		input.source.slice(0, 12000),
	].join("\n");

	const raw = await callAnthropicChat({
		system: systemPrompt,
		user: userPrompt,
		maxTokens: 2000,
		temperature: 0,
		jsonSchema: MEETING_FEEDBACK_RESPONSE_FORMAT,
	});
	return parseMeetingFeedbackAIResponse(raw);
}

function parseMeetingFeedbackAIResponse(raw: string): MeetingFeedbackAIResponse {
	try {
		const parsed = JSON.parse(raw) as Partial<MeetingFeedbackAIResponse>;
		const status =
			parsed.status === "返却済" ||
			parsed.status === "要確認" ||
			parsed.status === "対象外"
				? parsed.status
				: "要確認";
		return {
			directFeedback:
				typeof parsed.directFeedback === "string" ? parsed.directFeedback : "",
			goodPoints: stringArray(parsed.goodPoints),
			improvementPoints: stringArray(parsed.improvementPoints),
			nextQuestions: stringArray(parsed.nextQuestions),
			nextAction: typeof parsed.nextAction === "string" ? parsed.nextAction : "",
			status,
			memo: typeof parsed.memo === "string" ? parsed.memo : "",
		};
	} catch (error) {
		console.log("parseMeetingFeedbackAIResponse failed", String(error));
		return {
			directFeedback: "",
			goodPoints: [],
			improvementPoints: [],
			nextQuestions: [],
			nextAction: "",
			status: "要確認",
			memo: `JSONパース失敗: ${raw.slice(0, 200)}`,
		};
	}
}

async function processManagerReview(
	input: ManagerReviewInput,
	notion: NotionClient,
): Promise<ManagerReviewResult> {
	const managerReviewPage = await notion.pages.retrieve({
		page_id: input.managerReviewPageId,
	});
	const properties = managerReviewPage.properties ?? {};
	const titleText = text(properties["名前"]) || text(properties["評価名"]) || "マネージャー評価";
	const aiStatus = text(properties["AI処理状態"]);
	const evaluationStatus = text(properties["評価ステータス"]);

	if (["確定", "処理済"].includes(aiStatus) || evaluationStatus === "完了") {
		return {
			managerReviewPageId: managerReviewPage.id,
			action: "needs-review",
			status: aiStatus || evaluationStatus || "完了済み",
			message:
				"既に確定または完了済みのため、Workerは評価・点数・ランク・コメントを変更しませんでした。",
		};
	}

	const targetStaffIds = relationIdsFromProperty(properties["対象スタッフ"]);
	const targetSalesUserIds = personIdsFromProperty(properties["対象営業ユーザー"]);
	const managerUserIds = personIdsFromProperty(properties["担当マネージャー"]);
	const relatedSummaryIds = relationIdsFromProperty(properties["関連営業評価サマリー"]);
	const missing: string[] = [];
	const hasTarget = targetStaffIds.length > 0 || targetSalesUserIds.length > 0;
	if (!hasTarget) {
		missing.push("対象スタッフ または 対象営業ユーザー");
	}
	if (managerUserIds.length === 0) missing.push("担当マネージャー");
	if (relatedSummaryIds.length === 0) missing.push("関連営業評価サマリー");

	const blockText = await fetchPageBlockPlainText(notion, managerReviewPage.id);
	const relatedSummaryText = await buildManagerRelatedSummarySource(
		notion,
		relatedSummaryIds,
	);
	const source = [
		buildManagerReviewPropertySource(properties),
		relatedSummaryText,
		blockText ? `【ページ本文】\n${blockText}` : "",
	]
		.filter(Boolean)
		.join("\n\n")
		.slice(0, 12000);

	if (!hasTarget) {
		const message = `対象者を特定できないため、評価せず要確認で停止しました。不足: ${missing.join(" / ")}`;
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, managerReviewPage, {
				AI処理状態: { kind: "select", value: "要確認" },
				AI補助メモ: {
					kind: "text",
					value: appendShortMemo(text(properties["AI補助メモ"]), message),
				},
			});
		}
		return {
			managerReviewPageId: managerReviewPage.id,
			action: "needs-review",
			status: "要確認",
			message,
		};
	}

	if (source.replace(/\s/g, "").length < 120) {
		const message =
			"評価材料が短すぎるため、点数・ランク・最終評価は行わず要確認で停止しました。";
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, managerReviewPage, {
				AI処理状態: { kind: "select", value: "要確認" },
				AI補助メモ: {
					kind: "text",
					value: appendShortMemo(text(properties["AI補助メモ"]), message),
				},
			});
		}
		return {
			managerReviewPageId: managerReviewPage.id,
			action: "needs-review",
			status: "要確認",
			message,
		};
	}

	if (input.dryRun) {
		return {
			managerReviewPageId: managerReviewPage.id,
			action: "dry-run",
			status: "dry-run",
			message: `dry-run: ${titleText} を ${source.length} 文字の評価材料から壁打ち補助できます。不足警告: ${missing.join(" / ") || "なし"}。`,
		};
	}

	let review: ManagerReviewAIResponse;
	try {
		review = await callAnthropicManagerReview({
			title: titleText,
			source,
			missing,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await safeUpdateExistingProperties(notion, managerReviewPage, {
			AI処理状態: { kind: "select", value: "要確認" },
			AI補助メモ: {
				kind: "text",
				value: appendShortMemo(
					text(properties["AI補助メモ"]),
					`人見さん壁打ちWorkerエラー: ${message.slice(0, 500)}`,
				),
			},
		});
		return {
			managerReviewPageId: managerReviewPage.id,
			action: "error",
			status: "要確認",
			message: `Anthropic API呼び出し失敗: ${message}`,
		};
	}

	const onlyManagerMissing = missing.length === 1 && missing[0] === "担当マネージャー";
	const status =
		onlyManagerMissing || review.recommendedStatus !== "要確認" ? "レビュー中" : "要確認";
	const patches: Record<string, SafePatch> = {
		AI処理状態: { kind: "select", value: status },
		AI補助メモ: {
			kind: "text",
			value: buildManagerReviewMemo(review, missing),
		},
	};
	addPatchIfBlank(patches, properties, "改善指示", review.managerTalkingPoints.join("\n"));
	addPatchIfBlank(patches, properties, "次月のマネジメントテーマ", review.nextMonthTheme);
	addPatchIfBlank(patches, properties, "成長ポイント", review.strengths.join("\n"));
	addPatchIfBlank(patches, properties, "改善テーマ", review.coachingTheme);
	addPatchIfBlank(patches, properties, "育成コメント", review.coachingTheme);
	addPatchIfBlank(patches, properties, "目標達成コメント", review.summary);
	addPatchIfBlank(patches, properties, "コンプライアンスコメント", review.risks.join("\n"));

	await safeUpdateExistingProperties(notion, managerReviewPage, patches);

	return {
		managerReviewPageId: managerReviewPage.id,
		action: status === "要確認" ? "needs-review" : "reviewed",
		status,
		message:
			status === "要確認"
				? "壁打ちメモは作成しましたが、不足情報があるため要確認で止めました。点数・ランク・最終評価は変更していません。"
				: "人見さん壁打ち補助を作成しました。点数・ランク・最終評価は変更していません。",
	};
}

function buildManagerReviewPropertySource(properties: Record<string, unknown>): string {
	const scoreLines = [
		["収益責任スコア", numberValue(properties["収益責任スコア"])],
		["人材育成責任スコア", numberValue(properties["人材育成責任スコア"])],
		["コンプライアンス責任スコア", numberValue(properties["コンプライアンス責任スコア"])],
		["総合評価スコア", numberValue(properties["総合評価スコア"])],
		["商談品質スコア", numberValue(properties["商談品質スコア"])],
		["行動継続スコア", numberValue(properties["行動継続スコア"])],
		["ナレッジ貢献スコア", numberValue(properties["ナレッジ貢献スコア"])],
		["チーム貢献スコア", numberValue(properties["チーム貢献スコア"])],
	]
		.filter(([, value]) => typeof value === "number")
		.map(([label, value]) => `${label}: ${value}`);
	const textLines = [
		["1on1評価コメント", text(properties["1on1評価コメント"])],
		["目標達成コメント", text(properties["目標達成コメント"])],
		["育成コメント", text(properties["育成コメント"])],
		["コンプライアンスコメント", text(properties["コンプライアンスコメント"])],
		["成長ポイント", text(properties["成長ポイント"])],
		["改善テーマ", text(properties["改善テーマ"])],
		["改善指示", text(properties["改善指示"])],
		["次月のマネジメントテーマ", text(properties["次月のマネジメントテーマ"])],
		["AI補助メモ", text(properties["AI補助メモ"])],
	]
		.filter(([, value]) => value)
		.map(([label, value]) => `【${label}】\n${value}`);
	const period = dateStartFromProperty(properties["評価期間"]);
	return [
		period ? `評価期間: ${period}` : "",
		scoreLines.length > 0 ? `【スコア参考値】\n${scoreLines.join("\n")}` : "",
		textLines.join("\n\n"),
	]
		.filter(Boolean)
		.join("\n\n");
}

async function buildManagerRelatedSummarySource(
	notion: NotionClient,
	relatedSummaryIds: string[],
): Promise<string> {
	if (relatedSummaryIds.length === 0) return "";
	const lines: string[] = [];
	for (const id of relatedSummaryIds.slice(0, 3)) {
		try {
			const page = await notion.pages.retrieve({ page_id: id });
			lines.push(`【関連営業評価サマリー】\n${buildGenericPageSummary(page.properties ?? {})}`);
		} catch (error) {
			lines.push(`【関連営業評価サマリー】取得失敗: ${String(error).slice(0, 120)}`);
		}
	}
	return lines.join("\n\n");
}

function buildGenericPageSummary(properties: Record<string, unknown>): string {
	return Object.entries(properties)
		.map(([name, property]) => {
			const value = text(property) || propertyNumberText(property) || dateStartFromProperty(property);
			return value ? `${name}: ${value}` : "";
		})
		.filter(Boolean)
		.slice(0, 35)
		.join("\n");
}

function propertyNumberText(property: unknown): string {
	const value = numberValue(property);
	return typeof value === "number" ? String(value) : "";
}

function buildManagerReviewMemo(
	review: ManagerReviewAIResponse,
	missing: string[],
): string {
	const lines = [
		`Worker壁打ち: ${new Date().toISOString()}`,
		"点数・評価ランク・最終評価・評価ステータス完了は未変更。",
		missing.length > 0 ? `不足/人間確認: ${missing.join(" / ")}` : "",
		"要約:",
		review.summary,
		"",
		"マネージャーへの問い:",
		...review.managerTalkingPoints,
		"",
		"確認事項:",
		...review.confirmationItems,
	].filter((line) => line !== undefined && line !== null);
	return lines.join("\n").slice(0, 1800);
}

async function callAnthropicManagerReview(input: {
	title: string;
	source: string;
	missing: string[];
}): Promise<ManagerReviewAIResponse> {
	const systemPrompt = [
		"あなたは和上ホールディングスの人見さん壁打ち補助AIです。",
		"マネージャー評価DBの材料を読み、マネージャーが部下評価や1on1で確認すべき論点を返します。",
		"",
		"絶対ルール:",
		"- 点数を新規採点しない",
		"- 評価ランクを確定しない",
		"- 総合評価や処遇判断を確定しない",
		"- 評価ステータスを完了にしない",
		"- マネージャー本人を裁く文面にしない",
		"- 人格評価ではなく、次の行動、確認事項、改善テーマへ落とす",
		"- 根拠が弱い場合は、分からない、要確認と明示する",
		"- 対象スタッフまたは対象営業ユーザーが分かっており評価材料が十分なら、担当マネージャー未設定だけで要確認にしなくてよい",
		"",
		"返す内容:",
		"- マネージャーが本人と話すべき問い",
		"- 伸びている点",
		"- 放置すると危ない点",
		"- 次月のマネジメントテーマ",
		"- 人間が確認すべき不足情報",
		"",
		"recommendedStatus は、不足情報がある場合は要確認、壁打ち材料として使える場合はレビュー中にしてください。",
		"必ずJSONのみを返してください。",
	].join("\n");

	const userPrompt = [
		`評価ページ: ${input.title || "未設定"}`,
		input.missing.length > 0 ? `不足情報: ${input.missing.join(" / ")}` : "不足情報: なし",
		"",
		"=== 評価材料 ===",
		input.source.slice(0, 12000),
	].join("\n");

	const raw = await callAnthropicChat({
		system: systemPrompt,
		user: userPrompt,
		maxTokens: 4000,
		temperature: 0,
		jsonSchema: MANAGER_REVIEW_RESPONSE_FORMAT,
	});
	return parseManagerReviewAIResponse(raw);
}

function parseManagerReviewAIResponse(raw: string): ManagerReviewAIResponse {
	try {
		const parsed = JSON.parse(raw) as Partial<ManagerReviewAIResponse>;
		const recommendedStatus =
			parsed.recommendedStatus === "レビュー中" || parsed.recommendedStatus === "要確認"
				? parsed.recommendedStatus
				: "要確認";
		return {
			summary: typeof parsed.summary === "string" ? parsed.summary : "",
			managerTalkingPoints: stringArray(parsed.managerTalkingPoints),
			strengths: stringArray(parsed.strengths),
			risks: stringArray(parsed.risks),
			coachingTheme: typeof parsed.coachingTheme === "string" ? parsed.coachingTheme : "",
			nextMonthTheme: typeof parsed.nextMonthTheme === "string" ? parsed.nextMonthTheme : "",
			confirmationItems: stringArray(parsed.confirmationItems),
			recommendedStatus,
		};
	} catch (error) {
		console.log("parseManagerReviewAIResponse failed", String(error));
		return {
			summary: "",
			managerTalkingPoints: ["AI返却JSONの解析に失敗したため、人間確認が必要です。"],
			strengths: [],
			risks: [],
			coachingTheme: "",
			nextMonthTheme: "",
			confirmationItems: [`JSONパース失敗: ${raw.slice(0, 200)}`],
			recommendedStatus: "要確認",
		};
	}
}

async function processSalesPerformanceReview(
	input: SalesPerformanceReviewInput,
	notion: NotionClient,
): Promise<SalesPerformanceReviewResult> {
	const performancePage = await notion.pages.retrieve({
		page_id: input.salesPerformancePageId,
	});
	const properties = performancePage.properties ?? {};
	const titleText = text(properties["評価名"]) || "営業評価";
	const aiStatus = text(properties["AI処理状態"]);
	const evaluationStatus = text(properties["評価ステータス"]);
	const auditStatus = text(properties["監査区分"]);
	const targetPeriod = text(properties["対象期間"]) || dateStartFromProperty(properties["開始日"]);
	const targetSalesUserIds = personIdsFromProperty(properties["対象営業ユーザー"]);
	const evaluationReady = checkboxValue(properties["評価準備OK"]);
	const auditOrTest = isAuditOrTestPerformance(properties, titleText);

	if (evaluationStatus === "確定") {
		return {
			salesPerformancePageId: performancePage.id,
			action: "needs-review",
			status: evaluationStatus,
			message:
				"評価ステータスが確定済みのため、人見さんWorkerはAI評価メモ、点数、ランク、評価ステータスを変更しませんでした。",
			sourcePreview: [],
		};
	}

	const missing: string[] = [];
	if (targetSalesUserIds.length === 0) missing.push("対象営業ユーザー");
	if (!targetPeriod) missing.push("対象期間");
	if (!evaluationReady && !auditOrTest) missing.push("評価準備OK");

	const propertySource = buildSalesPerformanceReviewSource(properties);
	const related = await buildSalesPerformanceRelatedSourceWithStats(notion, properties);
	const relatedSource = related.source;
	const qualitativeLogCounts = related.qualitativeLogCounts;
	const source = buildSalesPerformanceEvaluationSource({
		propertySource,
		relatedSource,
	});

	if (missing.length > 0 && !auditOrTest) {
		const message = `評価の前提が不足しているため、点数・ランク・最終評価は変更せず要確認で停止しました。不足: ${missing.join(" / ")}`;
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, performancePage, {
				AI処理状態: { kind: "select", value: "要確認" },
				上司確認事項: {
					kind: "text",
					value: appendShortMemo(text(properties["上司確認事項"]), message),
				},
			});
		}
		return {
			salesPerformancePageId: performancePage.id,
			action: "needs-review",
			status: "要確認",
			message,
			sourcePreview: [],
		};
	}

	if (source.replace(/\s/g, "").length < 160) {
		const message =
			"評価材料が短すぎるため、点数・ランク・最終評価は変更せず要確認で停止しました。";
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, performancePage, {
				AI処理状態: { kind: "select", value: "要確認" },
				上司確認事項: {
					kind: "text",
					value: appendShortMemo(text(properties["上司確認事項"]), message),
				},
			});
		}
		return {
			salesPerformancePageId: performancePage.id,
			action: "needs-review",
			status: "要確認",
			message,
			sourcePreview: [],
		};
	}

	if (input.dryRun) {
		return {
			salesPerformancePageId: performancePage.id,
			action: "dry-run",
			status: "dry-run",
			message: `dry-run: ${titleText} を ${source.length} 文字の評価材料から一次評価案化できます。不足警告: ${missing.join(" / ") || "なし"}。監査/テスト扱い: ${auditOrTest ? "はい" : "いいえ"}。`,
			sourcePreview: buildSalesPerformanceDryRunPreview(source),
		};
	}

	let review: SalesPerformanceReviewAIResponse;
	try {
		review = await callAnthropicSalesPerformanceReview({
			title: titleText,
			auditStatus,
			targetPeriod,
			source,
			missing,
			auditOrTest,
			qualitativeLogCounts,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await safeUpdateExistingProperties(notion, performancePage, {
			AI処理状態: { kind: "select", value: "要確認" },
			上司確認事項: {
				kind: "text",
				value: appendShortMemo(
					text(properties["上司確認事項"]),
					`人見さん営業評価Workerエラー: ${message.slice(0, 500)}`,
				),
			},
		});
		return {
			salesPerformancePageId: performancePage.id,
			action: "error",
			status: "要確認",
			message: `Anthropic API呼び出し失敗: ${message}`,
			sourcePreview: [],
		};
	}

	// 捏造ガード: 定性ログ0件なら定性評価をコード側で固定文に差し替える（テスト/監査データでも適用）
	review = applySalesPerformanceQualitativeGuard(review, qualitativeLogCounts);

	const status =
		review.recommendedStatus === "要確認" && !auditOrTest ? "要確認" : "処理済";
	const patches = buildSalesPerformanceReviewPatches(properties, review, missing, auditOrTest);

	await safeUpdateExistingProperties(notion, performancePage, patches);

	return {
		salesPerformancePageId: performancePage.id,
		action: status === "処理済" ? "reviewed" : "needs-review",
		status,
		message:
			status === "処理済"
				? "人見さん営業評価案を返却しました。総合スコア、評価ランク、評価ステータス確定は変更していません。"
				: "一次評価案は作成しましたが、不足情報があるため要確認で止めました。総合スコア、評価ランク、評価ステータス確定は変更していません。",
		sourcePreview: [],
	};
}

function isAuditOrTestPerformance(
	properties: Record<string, unknown>,
	titleText: string,
): boolean {
	const joined = [
		titleText,
		text(properties["監査区分"]),
		text(properties["本人コメント"]),
		text(properties["上司確認事項"]),
		text(properties["AI評価メモ"]),
	].join(" ");
	return /AIテスト|正式テスト|監査除外|ドライラン|削除可|検証/.test(joined);
}

function buildSalesPerformanceReviewSource(
	properties: Record<string, unknown>,
): string {
	const quantitativeScore = computeSalesPerformanceQuantitativeScore(properties);
	const textLines = [
		["評価名", text(properties["評価名"])],
		["対象期間", text(properties["対象期間"])],
		["期間種別", text(properties["期間種別"])],
		["評価タイプ", text(properties["評価タイプ"])],
		["評価ステータス", text(properties["評価ステータス"])],
		["監査区分", text(properties["監査区分"])],
		["AI処理状態", text(properties["AI処理状態"])],
	]
		.filter(([, value]) => value)
		.map(([label, value]) => `【${label}】\n${value}`);
	const dates = [
		dateStartFromProperty(properties["開始日"])
			? `開始日: ${dateStartFromProperty(properties["開始日"])}`
			: "",
		dateStartFromProperty(properties["終了日"])
			? `終了日: ${dateStartFromProperty(properties["終了日"])}`
			: "",
	].filter(Boolean);
		return [
			dates.join("\n"),
			`【定量評価（実績）｜65点（粗利30/案件化率10/成約率10/ノルマ申請計画妥当性15）】\nAIは定量点を付け直さない。以下はWorker計算済みの点数・内訳・達成率・生値。保留軸は採点対象外（分子・分母から除外）。総合は採点軸の獲得÷満点×100。\n${buildSalesPerformanceQuantitativeScoreLines(quantitativeScore).join("\n")}`,
			textLines.join("\n\n"),
		]
		.filter(Boolean)
		.join("\n\n");
}

// 2026-06-23 確定配点（定量65）。旧50点系（粗利19/成約9/仕入れ8/商談6/案件化5/専売3）は取り下げ済。
// 定量65 = 粗利30 / 案件化率10 / 成約率10 / ノルマ申請計画妥当性15。
// 残り35点（会議発言6/日報6/1on1 4/ツール活用4/ナレッジ15）は定性=AI・活動ログ側で見るため
// このWorker計算（定量）には含めない。
type SalesPerformanceQuantitativeScoreKey =
	| "粗利"
	| "案件化率"
	| "成約率"
	| "ノルマ申請計画妥当性";

// 保留＝採点軸の分子・分母の両方から除外。0点化しない（5月の「表示86 vs 素計算0」バグの元）。
type SalesPerformanceQuantitativeScoreDetail = {
	label: SalesPerformanceQuantitativeScoreKey;
	weight: number;
	// held=true のとき採点対象外（分子・分母から除外）。score は null。
	held: boolean;
	heldReason: string;
	score: number | null;
	achievementRate: number | null;
	clippedAchievementRate: number | null;
	rateSource: string;
	actual: number | null;
	target: number | null;
	actualLabel: string;
	targetLabel: string;
	detail: string;
};

type SalesPerformanceQuantitativeScore = {
	// 採点軸（保留でない軸）の獲得合計
	earned: number;
	// 採点軸（保留でない軸）の満点合計
	maxOfScored: number;
	// 総合 = round(earned / maxOfScored * 100)。採点軸が全て保留なら null。
	overall: number | null;
	heldKeys: SalesPerformanceQuantitativeScoreKey[];
	details: Record<
		SalesPerformanceQuantitativeScoreKey,
		SalesPerformanceQuantitativeScoreDetail
	>;
};

type SalesPerformanceQuantitativeItem = {
	key: SalesPerformanceQuantitativeScoreKey;
	weight: number;
	rateAliases: string[];
	actualAliases: string[];
	targetAliases: string[];
	actualLabel: string;
	targetLabel: string;
	// この軸を常に保留にする（実機DBに分母/採点源が無い等）。理由を併記。
	alwaysHold?: string;
};

const SALES_PERFORMANCE_QUANTITATIVE_ITEMS: SalesPerformanceQuantitativeItem[] = [
	{
		// 粗利30: ロールアップ源（成約報告 8d5a506b・商談管理）が空なら保留（0点にしない）。
		key: "粗利",
		weight: 30,
		rateAliases: [
			"月次粗利達成率（申請連動）",
			"粗利達成率（自動）",
			"粗利達成率（グラフ用）",
			"粗利達成率",
		],
		actualAliases: ["実績粗利額（自動）", "実績粗利額"],
		targetAliases: ["粗利目標（申請DB）", "粗利目標", "目標粗利額"],
		actualLabel: "実績粗利額",
		targetLabel: "粗利目標",
	},
	{
		// 案件化率10: 分母「問い合わせ数」は実機DBに無い→常に保留。
		// プロパティを作らない・本人memoの数値を分母にしない。
		key: "案件化率",
		weight: 10,
		rateAliases: [],
		actualAliases: ["案件化件数"],
		targetAliases: [],
		actualLabel: "案件化件数",
		targetLabel: "問い合わせ数",
		alwaysHold:
			"分母「問い合わせ数」の月次集計列が実機DBに無いため常に保留（採点対象外）。プロパティ増設・memo数値の代用はしない。TODO（要Notion実機確認）: 月次の問い合わせ数ロールアップが整備されたら配線する。",
	},
	{
		// 成約率10: ロールアップ源（成約報告 8d5a506b・商談管理）が空なら保留（0点にしない）。
		key: "成約率",
		weight: 10,
		rateAliases: ["月次成約達成率（申請連動）", "成約達成率（自動）", "成約達成率"],
		actualAliases: ["成約件数（自動）", "成約件数"],
		targetAliases: ["成約件数目標（申請DB）", "成約目標", "目標成約件数"],
		actualLabel: "成約件数",
		targetLabel: "成約件数目標",
	},
	{
		// ノルマ申請計画妥当性15: 妥当性を測る数値列が実機DBに未確認。
		// 推測で配線せず保留＋TODO（捏造禁止）。本人コメント/memoの数値は採点ソースにしない。
		key: "ノルマ申請計画妥当性",
		weight: 15,
		rateAliases: [],
		actualAliases: [],
		targetAliases: [],
		actualLabel: "ノルマ申請計画妥当性",
		targetLabel: "計画妥当性スコア",
		alwaysHold:
			"計画妥当性を数値化する採点列が実機DBに未確認のため保留（採点対象外）。TODO（要Notion実機確認）: ノルマ申請DB側の妥当性指標を確認し、確定後に配線する。コメントやmemoに書かれた数値は採点ソースにしない。",
	},
];

function computeSalesPerformanceQuantitativeScore(
	properties: Record<string, unknown>,
): SalesPerformanceQuantitativeScore {
	const details = {} as Record<
		SalesPerformanceQuantitativeScoreKey,
		SalesPerformanceQuantitativeScoreDetail
	>;
	let earned = 0;
	let maxOfScored = 0;
	const heldKeys: SalesPerformanceQuantitativeScoreKey[] = [];

	for (const item of SALES_PERFORMANCE_QUANTITATIVE_ITEMS) {
		const detail = computeSalesPerformanceQuantitativeItem(properties, item);
		details[item.key] = detail;
		if (detail.held || detail.score === null) {
			// 保留軸は分子・分母の両方から除外する（0点化しない）。
			heldKeys.push(item.key);
			continue;
		}
		earned += detail.score;
		maxOfScored += detail.weight;
	}

	// 総合 = (採点軸の獲得合計 ÷ 採点軸の満点合計) × 100、四捨五入。採点軸が全て保留なら null。
	const overall =
		maxOfScored > 0 ? Math.round((earned / maxOfScored) * 100) : null;

	return { earned, maxOfScored, overall, heldKeys, details };
}

function computeSalesPerformanceQuantitativeItem(
	properties: Record<string, unknown>,
	item: SalesPerformanceQuantitativeItem,
): SalesPerformanceQuantitativeScoreDetail {
	const rate = readSalesPerformanceAchievementRate(properties, item);
	const achievementRate =
		typeof rate.achievementRate === "number" && Number.isFinite(rate.achievementRate)
			? rate.achievementRate
			: null;

	// この軸を常に保留にする設定（分母が実機DBに無い／採点列未確認など）。
	if (item.alwaysHold) {
		return buildHeldSalesPerformanceQuantitativeDetail(item, rate, item.alwaysHold);
	}

	// 達成率が取れない＝採点ソース（ロールアップ等）が空 → 保留（採点対象外・分母除外）。
	// 旧実装はここで clippedAchievementRate=0 → score 0 にしていたが、欠損を0点化しない。
	if (achievementRate === null) {
		const sourceCandidates = [
			...(item.rateAliases.length > 0 ? [item.rateAliases.join(" / ")] : []),
			`${item.actualLabel}/${item.targetLabel}`,
		].join(" または ");
		return buildHeldSalesPerformanceQuantitativeDetail(
			item,
			rate,
			`採点ソースが空のため保留（採点対象外）: ${sourceCandidates} を取得できません`,
		);
	}

	const clippedAchievementRate = Math.min(Math.max(achievementRate, 0), 1);
	const score = Math.round(clippedAchievementRate * item.weight);
	return {
		label: item.key,
		weight: item.weight,
		held: false,
		heldReason: "",
		score,
		achievementRate,
		clippedAchievementRate,
		rateSource: rate.rateSource,
		actual: rate.actual,
		target: rate.target,
		actualLabel: item.actualLabel,
		targetLabel: item.targetLabel,
		detail: `取得: ${rate.rateSource}`,
	};
}

function buildHeldSalesPerformanceQuantitativeDetail(
	item: SalesPerformanceQuantitativeItem,
	rate: { rateSource: string; actual: number | null; target: number | null },
	heldReason: string,
): SalesPerformanceQuantitativeScoreDetail {
	return {
		label: item.key,
		weight: item.weight,
		held: true,
		heldReason,
		score: null,
		achievementRate: null,
		clippedAchievementRate: null,
		rateSource: rate.rateSource,
		actual: rate.actual,
		target: rate.target,
		actualLabel: item.actualLabel,
		targetLabel: item.targetLabel,
		detail: `保留: ${heldReason}`,
	};
}

function readSalesPerformanceAchievementRate(
	properties: Record<string, unknown>,
	item: SalesPerformanceQuantitativeItem,
): {
	achievementRate: number | null;
	rateSource: string;
	actual: number | null;
	target: number | null;
} {
	const actual = numberValueAnyWithSource(properties, item.actualAliases);
	const target = numberValueAnyWithSource(properties, item.targetAliases);
	const formulaRate = numberValueAnyWithSource(properties, item.rateAliases);
	if (formulaRate.value !== null) {
		return {
			achievementRate: formulaRate.value,
			rateSource: formulaRate.name,
			actual: actual.value,
			target: target.value,
		};
	}
	if (actual.value !== null && target.value !== null && target.value > 0) {
		return {
			achievementRate: actual.value / target.value,
			rateSource: `${actual.name} / ${target.name}`,
			actual: actual.value,
			target: target.value,
		};
	}
	return {
		achievementRate: null,
		rateSource: "",
		actual: actual.value,
		target: target.value,
	};
}

function numberValueAnyWithSource(
	properties: Record<string, unknown>,
	names: string[],
): { value: number | null; name: string } {
	for (const name of names) {
		const value = numberValue(properties[name]);
		if (typeof value === "number" && Number.isFinite(value)) {
			return { value, name };
		}
	}
	return { value: null, name: "" };
}

function buildSalesPerformanceQuantitativeScoreLines(
	score: SalesPerformanceQuantitativeScore,
): string[] {
	const heldSuffix =
		score.heldKeys.length > 0
			? `（保留：${score.heldKeys.join("・")}）`
			: "（保留：なし）";
	const totalLine =
		score.overall === null
			? `総合: 採点不可（採点軸が全て保留）${heldSuffix}`
			: `総合: ${score.overall}点（採点軸の獲得 ${score.earned} ÷ 採点軸の満点 ${score.maxOfScored} ×100）${heldSuffix}`;
	return [
		totalLine,
		...SALES_PERFORMANCE_QUANTITATIVE_ITEMS.map((item) =>
			buildSalesPerformanceQuantitativeScoreLine(score.details[item.key]),
		),
	];
}

function buildSalesPerformanceQuantitativeScoreLine(
	detail: SalesPerformanceQuantitativeScoreDetail,
): string {
	const source = detail.rateSource || detail.detail;
	if (detail.held || detail.score === null) {
		return `${detail.label}: 保留/${detail.weight}点満点（採点対象外・分母除外。理由: ${detail.heldReason || detail.detail} / ${detail.actualLabel}: ${formatQuantitativeNumber(detail.actual)} / ${detail.targetLabel}: ${formatQuantitativeNumber(detail.target)}）`;
	}
	return `${detail.label}: ${detail.score}/${detail.weight}点（達成率: ${formatQuantitativeRate(detail.achievementRate)} / クリップ後: ${formatQuantitativeRate(detail.clippedAchievementRate)} / ${detail.actualLabel}: ${formatQuantitativeNumber(detail.actual)} / ${detail.targetLabel}: ${formatQuantitativeNumber(detail.target)} / 参照: ${source}）`;
}

function formatQuantitativeRate(value: number | null): string {
	if (value === null || !Number.isFinite(value)) return "未取得";
	return `${Math.round(value * 1000) / 10}%`;
}

function formatQuantitativeNumber(value: number | null): string {
	if (value === null || !Number.isFinite(value)) return "未取得";
	return String(value);
}

function buildSalesPerformanceEvaluationSource(input: {
	propertySource: string;
	relatedSource: string;
	pageText?: string;
}): string {
	void input.pageText;
	return [input.propertySource, input.relatedSource]
		.filter((part) => part.trim().length > 0)
		.join("\n\n")
		.slice(0, 16000);
}

function buildSalesPerformanceDryRunPreview(source: string): string[] {
	const importantLinePattern =
		/^(総合|粗利|案件化率|成約率|ノルマ申請計画妥当性): .+(\/\d+点|点|保留)/;
	return source
		.split(/\n+/)
		.map((line) => line.trim())
		.filter(Boolean)
		.filter((line) =>
				line.includes("定量評価（実績）｜65点") ||
				line.includes("定性評価（ナレッジ）｜35点") ||
				line.includes("定性評価（行動ログ）｜35点") ||
			line.includes("補助確認事項（採点対象外）") ||
			line.includes("採点対象: false") ||
			line.includes("活動ログ未接続") ||
			line.includes("活動ログ未集約") ||
			line.includes("活動ログ件数超過") ||
			line.startsWith("URL:") ||
			importantLinePattern.test(line),
		)
		.slice(0, 20);
}

type SalesPerformanceQualitativeLogCounts = {
	speechLogs: number;
	customerContactLogs: number;
	contributionLogs: number;
};

function totalSalesPerformanceQualitativeLogs(
	counts: SalesPerformanceQualitativeLogCounts,
): number {
	return counts.speechLogs + counts.customerContactLogs + counts.contributionLogs;
}

async function buildSalesPerformanceRelatedSource(
	notion: NotionClient,
	properties: Record<string, unknown>,
): Promise<string> {
	const result = await buildSalesPerformanceRelatedSourceWithStats(notion, properties);
	return result.source;
}

async function buildSalesPerformanceRelatedSourceWithStats(
	notion: NotionClient,
	properties: Record<string, unknown>,
): Promise<{
	source: string;
	qualitativeLogCounts: SalesPerformanceQualitativeLogCounts;
}> {
	const qualitativeLogCounts: SalesPerformanceQualitativeLogCounts = {
		speechLogs: 0,
		customerContactLogs: 0,
		contributionLogs: 0,
	};
	const sections: string[] = [];
	const activityIds = uniqueIds([
		...relationIdsFromProperty(properties["関連活動ログ"]),
		...relationIdsFromProperty(properties["活動ログ"]),
	]);
	const legacyDirectMap: Array<[string, string[], number]> = [
		["旧直接ログ:関連日報ログ", relationIdsFromProperty(properties["関連日報ログ"]), 5],
		["旧直接ログ:日報ログ", relationIdsFromProperty(properties["日報ログ"]), 5],
		["旧直接ログ:関連発言ログ", relationIdsFromProperty(properties["関連発言ログ"]), 5],
		["旧直接ログ:発言ログ", relationIdsFromProperty(properties["発言ログ"]), 5],
		["旧直接ログ:関連顧客接点ログ", relationIdsFromProperty(properties["関連顧客接点ログ"]), 5],
		["旧直接ログ:顧客接点ログ", relationIdsFromProperty(properties["顧客接点ログ"]), 5],
		["旧直接ログ:関連貢献ログ", relationIdsFromProperty(properties["関連貢献ログ"]), 5],
		["旧直接ログ:貢献ログ", relationIdsFromProperty(properties["貢献ログ"]), 5],
		["旧直接ログ:関連営業貢献ログ", relationIdsFromProperty(properties["関連営業貢献ログ"]), 5],
		["旧直接ログ:営業貢献ログ", relationIdsFromProperty(properties["営業貢献ログ"]), 5],
		["旧直接ログ:関連営業ログ", relationIdsFromProperty(properties["関連営業ログ"]), 5],
		["旧直接ログ:営業ログ", relationIdsFromProperty(properties["営業ログ"]), 5],
		["旧直接ログ:関連ノルマ申請", relationIdsFromProperty(properties["関連ノルマ申請"]), 5],
		["旧直接ログ:ノルマ申請", relationIdsFromProperty(properties["ノルマ申請"]), 5],
		["旧直接ログ:関連商談", relationIdsFromProperty(properties["関連商談"]), 5],
		["旧直接ログ:商談", relationIdsFromProperty(properties["商談"]), 5],
		["旧直接ログ:関連成約", relationIdsFromProperty(properties["関連成約"]), 5],
		["旧直接ログ:関連成約報告", relationIdsFromProperty(properties["関連成約報告"]), 5],
		["旧直接ログ:成約報告", relationIdsFromProperty(properties["成約報告"]), 5],
		["旧直接ログ:関連マネージャー評価", relationIdsFromProperty(properties["関連マネージャー評価"]), 5],
		["旧直接ログ:マネージャー評価", relationIdsFromProperty(properties["マネージャー評価"]), 5],
	];
	if (activityIds.length > 0) {
		const winPatternLines: string[] = [];
		const qualitativeLines: string[] = [];
		const supportLines: string[] = [];
		for (const id of activityIds.slice(0, 8)) {
			const summary = await buildSalesActivityEvidenceSummary(notion, id);
			if (summary.winPatternScoring) winPatternLines.push(summary.winPatternScoring);
			if (summary.qualitativeScoring) qualitativeLines.push(summary.qualitativeScoring);
			if (summary.support) supportLines.push(summary.support);
			qualitativeLogCounts.speechLogs += summary.qualitativeCounts.speechLogs;
			qualitativeLogCounts.customerContactLogs +=
				summary.qualitativeCounts.customerContactLogs;
			qualitativeLogCounts.contributionLogs +=
				summary.qualitativeCounts.contributionLogs;
		}
		if (activityIds.length > 8) {
			qualitativeLines.push(
				`活動ログ件数超過: 関連活動ログ${activityIds.length}件中8件のみを評価材料として読みました。残り${activityIds.length - 8}件は人間確認または集約ルール見直しが必要です。`,
			);
		}
		sections.push(`【定性評価（ナレッジ）｜35点のうちナレッジ15点】\n営業貢献ログだけを、会社に残した勝ち筋・再現性・共有価値（ナレッジ）の根拠として読む。\n${winPatternLines.length > 0 ? winPatternLines.join("\n---\n") : "営業貢献ログ未接続: ナレッジ15点の根拠はまだありません。"}`);
		sections.push(`【定性評価（行動ログ）｜35点のうち会議発言6/日報6/1on1 4/ツール活用4点】\n発言ログ・顧客接点ログを、日々の行動と商談プロセスの根拠として読む。ツール活用度は本文ではなく回数/ポイントがある場合だけ小さく確認する。\n${qualitativeLines.length > 0 ? qualitativeLines.join("\n---\n") : "発言ログ・顧客接点ログ未接続: 行動ログ点の根拠はまだありません。"}`);
		if (supportLines.length > 0) {
			sections.push(
				`【補助確認事項（採点対象外）】\nAI活用ログ、人見さんメモ、ワニポメモリーは採点根拠にせず、面談前の確認材料としてだけ扱う。\n${supportLines.join("\n---\n")}`,
			);
		}
	} else {
		sections.push("【定性評価（ナレッジ）｜35点のうちナレッジ15点】\n活動ログ未接続: 営業マンパフォーマンスDBに関連活動ログがありません。");
		sections.push("【定性評価（行動ログ）｜35点のうち会議発言6/日報6/1on1 4/ツール活用4点】\n活動ログ未接続: 営業マンパフォーマンスDBに関連活動ログがありません。");
	}
	const legacyDirectCount = legacyDirectMap.reduce((sum, [, ids]) => sum + ids.length, 0);
	if (legacyDirectCount > 0) {
		sections.push(
			"【データ不足・警告】\n活動ログ未集約: 直接ログはありますが、65/35評価には使いません。活動ログDBへ集約してから評価材料にしてください。",
		);
	}
	return {
		source: sections.join("\n\n").slice(0, 10000),
		qualitativeLogCounts,
	};
}

type SalesActivityEvidenceSummary = {
	winPatternScoring: string;
	qualitativeScoring: string;
	support: string;
	qualitativeCounts: SalesPerformanceQualitativeLogCounts;
};

const EMPTY_SALES_PERFORMANCE_QUALITATIVE_LOG_COUNTS: SalesPerformanceQualitativeLogCounts =
	{
		speechLogs: 0,
		customerContactLogs: 0,
		contributionLogs: 0,
	};

async function buildSalesActivityEvidenceSummary(
	notion: NotionClient,
	pageId: string,
): Promise<SalesActivityEvidenceSummary> {
	try {
			const page = await notion.pages.retrieve({ page_id: pageId });
			const properties = page.properties ?? {};
			const support = buildActivitySupportEvidenceSummary(page, properties);
			if (!checkboxValue(properties["評価対象"])) {
				return {
					winPatternScoring: "",
					qualitativeScoring: "",
					support,
					qualitativeCounts: EMPTY_SALES_PERFORMANCE_QUALITATIVE_LOG_COUNTS,
				};
			}
			if (!hasActivityScoringSource(properties)) {
				return {
					winPatternScoring: "",
					qualitativeScoring: "",
					support,
					qualitativeCounts: EMPTY_SALES_PERFORMANCE_QUALITATIVE_LOG_COUNTS,
				};
			}
			const base = [
				page.url ? `URL: ${page.url}` : "",
				buildGenericPageSummary(properties),
			]
				.filter(Boolean)
				.join("\n");
			const winPatternSummary = await buildActivityChildEvidenceSummary(notion, properties, [
				"関連営業貢献ログ",
			]);
			const qualitativeSummary = await buildActivityChildEvidenceSummary(notion, properties, [
				"関連発言",
				"関連顧客接点ログ",
			]);
			return {
				winPatternScoring: winPatternSummary
					? [base, winPatternSummary].filter(Boolean).join("\n")
					: "",
				qualitativeScoring: qualitativeSummary
					? [base, qualitativeSummary].filter(Boolean).join("\n")
					: "",
				support,
				qualitativeCounts: {
					speechLogs: relationIdsFromProperty(properties["関連発言"]).length,
				customerContactLogs: relationIdsFromProperty(properties["関連顧客接点ログ"])
					.length,
					contributionLogs: relationIdsFromProperty(properties["関連営業貢献ログ"])
						.length,
				},
			};
		} catch (error) {
			return {
				winPatternScoring: `取得失敗: ${String(error).slice(0, 120)}`,
				qualitativeScoring: "",
				support: "",
				qualitativeCounts: EMPTY_SALES_PERFORMANCE_QUALITATIVE_LOG_COUNTS,
			};
		}
	}

function hasActivityScoringSource(properties: Record<string, unknown>): boolean {
	return (
		relationIdsFromProperty(properties["関連発言"]).length > 0 ||
		relationIdsFromProperty(properties["関連顧客接点ログ"]).length > 0 ||
		relationIdsFromProperty(properties["関連営業貢献ログ"]).length > 0
	);
}

function buildActivitySupportEvidenceSummary(
	page: Page,
	properties: Record<string, unknown>,
): string {
	const supportRelations: Array<[string, string[]]> = [
		["関連人見さんメモ", relationIdsFromProperty(properties["関連人見さんメモ"])],
		["関連ワニポメモリー", relationIdsFromProperty(properties["関連ワニポメモリー"])],
		["関連AI活用ログ", relationIdsFromProperty(properties["関連AI活用ログ"])],
	];
	const relationLines = supportRelations
		.filter(([, ids]) => ids.length > 0)
		.map(([label, ids]) => `${label}: ${ids.length}件`);
	const isScoringTarget = checkboxValue(properties["評価対象"]);
	if (relationLines.length === 0 && isScoringTarget) return "";
	const titleText = text(properties["活動タイトル"]) || text(properties["名前"]);
	return [
		page.url ? `URL: ${page.url}` : "",
		titleText ? `活動タイトル: ${titleText}` : "",
		`採点対象: ${isScoringTarget ? "true" : "false"}`,
		relationLines.join("\n"),
	]
		.filter(Boolean)
		.join("\n");
}

async function buildActivityChildEvidenceSummary(
	notion: NotionClient,
	properties: Record<string, unknown>,
	labels?: Array<"関連発言" | "関連顧客接点ログ" | "関連営業貢献ログ">,
): Promise<string> {
	const childMap: Array<[string, string[], number]> = [
		["関連発言", relationIdsFromProperty(properties["関連発言"]), 5],
		["関連顧客接点ログ", relationIdsFromProperty(properties["関連顧客接点ログ"]), 5],
		["関連営業貢献ログ", relationIdsFromProperty(properties["関連営業貢献ログ"]), 5],
	];
	const sections: string[] = [];
	for (const [label, ids, limit] of childMap) {
		if (labels && !labels.includes(label as "関連発言" | "関連顧客接点ログ" | "関連営業貢献ログ")) continue;
		if (ids.length === 0) continue;
		const lines: string[] = [];
		for (const id of ids.slice(0, limit)) {
			try {
					const page = await notion.pages.retrieve({ page_id: id });
					const childProperties = page.properties ?? {};
					lines.push([
					page.url ? `URL: ${page.url}` : "",
					buildGenericPageSummary(childProperties),
				]
					.filter(Boolean)
					.join("\n"));
			} catch (error) {
				lines.push(`取得失敗: ${String(error).slice(0, 120)}`);
			}
		}
		sections.push(`【${label}】\n${lines.filter(Boolean).join("\n---\n")}`);
	}
	return sections.join("\n");
}

function isHitomiMemoEvaluationEvidence(properties: Record<string, unknown>): boolean {
	const materialStatus = text(properties["評価材料化状態"]);
	const monthlyStatus = text(properties["月次評価反映状態"]);
	return (
		materialStatus === "月次評価で確認" ||
		materialStatus === "営業貢献ログへ反映" ||
		monthlyStatus === "反映候補"
	);
}

function isWaniPoMemoryEvaluationEvidence(properties: Record<string, unknown>): boolean {
	const useStatus = text(properties["評価利用可否"]);
	const monthlyStatus = text(properties["月次評価反映状態"]);
	const visibility = text(properties["公開範囲"]);
	return (
		(useStatus === "本人が許可したら使う" || useStatus === "本人共有済み") &&
		monthlyStatus === "反映候補" &&
		visibility !== "本人のみ"
	);
}

export {
	buildSalesPerformanceEvaluationSource as buildSalesPerformanceEvaluationSourceForTest,
	buildSalesPerformanceDryRunPreview as buildSalesPerformanceDryRunPreviewForTest,
	buildSalesPerformanceReviewSource as buildSalesPerformanceReviewSourceForTest,
	computeSalesPerformanceQuantitativeScore as computeSalesPerformanceQuantitativeScoreForTest,
	buildSalesPerformanceRelatedSource as buildSalesPerformanceRelatedSourceForTest,
	buildSalesPerformanceRelatedSourceWithStats as buildSalesPerformanceRelatedSourceWithStatsForTest,
	buildSalesPerformanceReviewPatches as buildSalesPerformanceReviewPatchesForTest,
	isHitomiMemoEvaluationEvidence as isHitomiMemoEvaluationEvidenceForTest,
	isWaniPoMemoryEvaluationEvidence as isWaniPoMemoryEvaluationEvidenceForTest,
};

function buildSalesPerformanceReviewPatches(
	properties: Record<string, unknown>,
	review: SalesPerformanceReviewAIResponse,
	missing: string[],
	auditOrTest: boolean,
): Record<string, SafePatch> {
	const status =
		review.recommendedStatus === "要確認" && !auditOrTest ? "要確認" : "処理済";
	const patches: Record<string, SafePatch> = {
		AI処理状態: { kind: "select", value: status },
		AI評価メモ: {
			kind: "text",
			value: replaceWorkerReviewSection(
				text(properties["AI評価メモ"]),
				"人見さんWorker一次評価案:",
				buildSalesPerformanceReviewMemo(review, missing, auditOrTest),
			),
		},
		上司確認事項: {
			kind: "text",
			value: replaceWorkerReviewSection(
				text(properties["上司確認事項"]),
				"人見さん確認事項:",
				buildSalesPerformanceConfirmationMemo(review, missing, auditOrTest),
			),
		},
	};
	addSalesPerformanceReviewTextPatch(
		patches,
		properties,
		"次月改善ポイント",
		review.nextMonthImprovements.map((item) => `・${item}`).join("\n"),
	);
	addSalesPerformanceReviewTextPatch(patches, properties, "改善ポイント", review.actionGuidance);
	addSalesPerformanceReviewTextPatch(patches, properties, "成長ポイント", review.personComment);
	addSalesPerformanceReviewTextPatch(
		patches,
		properties,
		"次月テーマ",
		review.nextMonthImprovements[0] ?? "",
	);
	return patches;
}

function addSalesPerformanceReviewTextPatch(
	patches: Record<string, SafePatch>,
	properties: Record<string, unknown>,
	propertyName: string,
	value: string,
): void {
	if (!value.trim()) return;
	const current = text(properties[propertyName]);
	patches[propertyName] = {
		kind: "text",
		value: replaceSalesPerformanceStampedAppend(current, value),
	};
}

const SALES_PERFORMANCE_STAMPED_APPEND_MARKER = "人見さんWorker今回追記:";

function replaceSalesPerformanceStampedAppend(current: string, value: string): string {
	if (!current.trim()) return value;
	const note = buildSalesPerformanceStampedAppend(value);
	const markerIndex = current.indexOf(SALES_PERFORMANCE_STAMPED_APPEND_MARKER);
	if (markerIndex < 0) return appendShortMemo(current, note);
	const beforeMarker = current.slice(0, markerIndex).trim();
	return beforeMarker ? `${beforeMarker}\n${note}` : note;
}

function buildSalesPerformanceStampedAppend(value: string): string {
	return [`人見さんWorker今回追記: ${new Date().toISOString()}`, value]
		.filter(Boolean)
		.join("\n");
}

function buildSalesPerformanceReviewMemo(
	review: SalesPerformanceReviewAIResponse,
	missing: string[],
	auditOrTest: boolean,
): string {
	const evidenceLines = review.evidence
		.filter((item) => item.trim().length > 0)
		.slice(0, 8)
		.map((item) => `・${item}`);
	const lines = [
		`人見さんWorker一次評価案: ${new Date().toISOString()}`,
		"総合スコア・評価ランク・評価ステータス確定は未変更。",
		auditOrTest ? "監査除外/テストデータとして確認。本番評価根拠には使わない。" : "",
		missing.length > 0 ? `不足/人間確認: ${missing.join(" / ")}` : "",
		evidenceLines.length > 0 ? "【根拠リンク・材料】" : "",
		...evidenceLines,
		"",
		"【結論】",
		review.conclusion,
		"",
		"【定量評価（実績）65点（粗利30/案件化率10/成約率10/ノルマ申請計画妥当性15）】",
		review.resultExplanation,
		"",
		"【定性評価（ナレッジ）35点のうちナレッジ15点】",
		review.contributionView,
		"",
		"【定性評価（行動ログ）35点のうち会議発言6/日報6/1on1 4/ツール活用4点】",
		review.actionGuidance,
		"",
		"【補助確認事項（採点対象外）】",
		review.riskNotes.length > 0
			? review.riskNotes.map((item) => `・${item}`).join("\n")
			: "補助材料は採点根拠にせず、面談前の確認材料として扱う。",
		"",
		"【本人に返す短いコメント】",
		review.personComment,
	].filter((line) => line !== undefined && line !== null);
	return lines.join("\n").slice(0, 1800);
}

function replaceWorkerReviewSection(
	current: string,
	marker: string,
	note: string,
): string {
	if (!current) return note;
	if (!current.includes(marker)) return appendShortMemo(current, note);
	const markerIndex = current.indexOf(marker);
	const beforeMarker = current.slice(0, markerIndex).trim();
	if (!beforeMarker) return note;
	return `${beforeMarker}\n\n${note}`;
}

function buildSalesPerformanceConfirmationMemo(
	review: SalesPerformanceReviewAIResponse,
	missing: string[],
	auditOrTest: boolean,
): string {
	const lines = [
		`人見さん確認事項: ${new Date().toISOString()}`,
		auditOrTest ? "監査除外/テストデータのため本番評価には反映しない。" : "",
		missing.length > 0 ? `不足/人間確認: ${missing.join(" / ")}` : "",
		...review.managerConfirmationItems.map((item) => `・${item}`),
		review.riskNotes.length > 0 ? "注意:" : "",
		...review.riskNotes.map((item) => `・${item}`),
	].filter(Boolean);
	return lines.join("\n").slice(0, 1800);
}

const SALES_PERFORMANCE_QUALITATIVE_MISSING_TEXT =
	"定性評価（ナレッジ・行動ログ）: 対象期間の営業貢献ログ・顧客接点ログ・発言ログが未入力のため評価できません（データ不足）";
const SALES_PERFORMANCE_CONTRIBUTION_MISSING_TEXT =
	"定性評価（ナレッジ）: 対象期間の営業貢献ログが未入力のため評価できません（データ不足）";
const SALES_PERFORMANCE_QUALITATIVE_MISSING_PERSON_COMMENT =
	"対象期間の営業貢献ログ・顧客接点ログ・発言ログが未入力のため定性（ナレッジ/行動ログ）コメントなし（データ不足）";
const SALES_PERFORMANCE_QUALITATIVE_MISSING_IMPROVEMENT =
	"活動ログの入力から始めてください（現状データ不足のため改善点を特定できません）";
const SALES_PERFORMANCE_QUALITATIVE_MISSING_MANAGER_ITEM =
	"営業貢献ログ・顧客接点ログ・発言ログが未入力のためデータ整備を確認してください";
const SALES_PERFORMANCE_QUANTITATIVE_ONLY_CONCLUSION_PREFIX =
	"【定量実績のみに基づく結論（定性データ不足）】";

function applySalesPerformanceQualitativeGuard(
	review: SalesPerformanceReviewAIResponse,
	qualitativeLogCounts: SalesPerformanceQualitativeLogCounts,
): SalesPerformanceReviewAIResponse {
	const normalized = normalizeSalesPerformanceReviewSections(review);
	if (totalSalesPerformanceQualitativeLogs(qualitativeLogCounts) > 0) {
		if (qualitativeLogCounts.contributionLogs > 0) return normalized;
		return {
			...normalized,
			contributionView: SALES_PERFORMANCE_CONTRIBUTION_MISSING_TEXT,
			managerConfirmationItems: appendUniqueShortItem(
				normalized.managerConfirmationItems,
				"営業貢献ログが未入力のため、定性評価のナレッジ15点の評価根拠を確認してください",
			),
		};
	}
	const conclusion = normalized.conclusion.trim();
	return {
		...normalized,
		conclusion: conclusion.startsWith(
			SALES_PERFORMANCE_QUANTITATIVE_ONLY_CONCLUSION_PREFIX,
		)
			? conclusion
			: `${SALES_PERFORMANCE_QUANTITATIVE_ONLY_CONCLUSION_PREFIX}${conclusion}`,
		actionGuidance: SALES_PERFORMANCE_QUALITATIVE_MISSING_TEXT,
		contributionView: SALES_PERFORMANCE_CONTRIBUTION_MISSING_TEXT,
		personComment: SALES_PERFORMANCE_QUALITATIVE_MISSING_PERSON_COMMENT,
		nextMonthImprovements: [SALES_PERFORMANCE_QUALITATIVE_MISSING_IMPROVEMENT],
		managerConfirmationItems: [SALES_PERFORMANCE_QUALITATIVE_MISSING_MANAGER_ITEM],
	};
}

function normalizeSalesPerformanceReviewSections(
	review: SalesPerformanceReviewAIResponse,
): SalesPerformanceReviewAIResponse {
	return {
		...review,
		// resultExplanation=定量。定性（ナレッジ/行動ログ）以降が混ざったら切る。"【勝ちパターン化"は旧見出しの保険。
		resultExplanation: stripSalesPerformanceEmbeddedSections(
			review.resultExplanation,
			["【勝ちパターン化", "【定性評価", "【補助確認事項", "【本人に返す", "【上司確認"],
		),
		// contributionView=定性ナレッジ。定量と「行動ログ」定性が混ざったら切る（自分の見出しは切らない）。
		contributionView: stripSalesPerformanceEmbeddedSections(
			review.contributionView,
			["【定量評価", "【定性評価（行動ログ", "【補助確認事項", "【本人に返す", "【上司確認"],
		),
		// actionGuidance=定性行動ログ。定量と「ナレッジ」定性が混ざったら切る（自分の見出しは切らない）。"【勝ちパターン化"は旧見出しの保険。
		actionGuidance: stripSalesPerformanceEmbeddedSections(
			review.actionGuidance,
			["【定量評価", "【定性評価（ナレッジ", "【勝ちパターン化", "【補助確認事項", "【本人に返す", "【上司確認"],
		),
	};
}

function stripSalesPerformanceEmbeddedSections(value: string, markers: string[]): string {
	const hit = markers
		.map((marker) => value.indexOf(marker))
		.filter((index) => index >= 0)
		.sort((a, b) => a - b)[0];
	return (hit === undefined ? value : value.slice(0, hit)).trim();
}

function appendUniqueShortItem(items: string[], item: string): string[] {
	return items.some((current) => current.includes(item)) ? items : [...items, item];
}

type SalesPerformanceReviewPromptInput = {
	title: string;
	auditStatus: string;
	targetPeriod: string;
	source: string;
	missing: string[];
	auditOrTest: boolean;
	qualitativeLogCounts: SalesPerformanceQualitativeLogCounts;
};

function buildSalesPerformanceReviewPrompts(
	input: SalesPerformanceReviewPromptInput,
): { systemPrompt: string; userPrompt: string } {
	const counts = input.qualitativeLogCounts;
	const qualitativeUnavailable =
		totalSalesPerformanceQualitativeLogs(counts) === 0;

	const systemPrompt = [
		"あなたは和上ホールディングスのAI人事評価担当「人見さん」です。",
		"営業パフォーマンスDBの月次評価材料を読み、一次評価案、上司確認事項、次月改善ポイントを返します。",
		"",
		"絶対ルール:",
		"- 総合スコアを新規採点しない",
		"- 評価ランクを新規確定しない",
		"- 評価ステータスを確定にしない",
		"- 配点は定量65（粗利30/案件化率10/成約率10/ノルマ申請計画妥当性15）＋定性35（会議発言6/日報6/1on1 4/ツール活用4/ナレッジ15）",
		"- 定量65点はWorkerがコード計算済み。提示された定量内訳をそのまま使い、AIが点を付け直さない",
		"- 保留軸（採点対象外）は採点軸の分子・分母の両方から除外する。0点として扱わない",
		"- 給与、報酬、昇格、処遇判断をしない",
		"- テスト/監査除外データを本番評価根拠にしない",
		"- 人格評価をしない",
		"- 不明なことは要確認と明示する",
		"- 入力の評価材料に存在しないログ・活動・発言・数値を引用や推測で創作しない",
		"- 本人コメント・memo・ワニポメモリーに書かれた数値（110%等）を採点ソースにしない",
		"- 材料が無い項目は「データ不足のため評価不可」と書く",
		"",
		"出力方針:",
		...(qualitativeUnavailable
			? [
					"- 定性のナレッジ対象ログ（営業貢献ログ）と行動ログ対象ログ（顧客接点ログ・発言ログ）は0件。定性評価を行わない",
					"- actionGuidance と contributionView には定性評価文を書かず「データ不足のため評価不可」とだけ書く",
					"- 定量評価は提示されたWorker計算済み内訳を根拠にコメントだけ書く。点数や配点を変更しない",
				]
			: [
					"- 評価は定量65＋定性35で見る。定量65点はWorker計算済み、定性35点のうちナレッジ15点は営業貢献ログ、残り（会議発言6/日報6/1on1 4/ツール活用4）は行動ログから見る",
					"- 定量評価は提示されたWorker計算済み内訳を根拠にコメントだけ書く。点数や配点を変更しない",
					"- ナレッジ（定性15点）は活動ログDBに集約された営業貢献ログだけを見る",
					"- 行動ログ定性は活動ログDBに集約された顧客接点ログ、発言ログだけを見る",
					"- ツール活用度は本文ではなく回数/ポイントがある場合だけ小さく確認し、AI相談本文を採点根拠にしない",
					"- 行動評価とナレッジ評価は、確認論点としてマネージャー面談に落とす",
				]),
		"- AI相談本文、人見さんメモ、ワニポメモリー、本人コメント、マネージャーメモは主たる採点根拠にしない",
		"- 月次ページ本文、自由記述、本人コメント、マネージャーメモは採点根拠にしない",
		"- 既存の数値やスコアは、変更ではなく読み解きとして説明する",
		...(qualitativeUnavailable
			? [
					"- personComment、nextMonthImprovements、managerConfirmationItems にも定性評価に基づく内容を書かない。データ不足を前提にする",
				]
			: [
					"- 本人に返す言葉は厳しさと成長支援を両立させる",
					"- 次月改善ポイントは3件以内で具体化する",
				]),
		"- evidence には、評価コメントの根拠になる数値、活動ログURL、データ不足警告を短く入れる",
		"- recommendedStatus は、評価材料として使えるなら処理済、不足が大きいなら要確認にする",
		"必ずJSONのみを返してください。",
	].join("\n");

	const userPrompt = [
		`評価ページ: ${input.title || "未設定"}`,
		`対象期間: ${input.targetPeriod || "未設定"}`,
		`監査区分: ${input.auditStatus || "未設定"}`,
		`監査/テスト扱い: ${input.auditOrTest ? "はい" : "いいえ"}`,
		input.missing.length > 0 ? `不足情報: ${input.missing.join(" / ")}` : "不足情報: なし",
		`定性35対象ログ件数: ナレッジ=営業貢献ログ ${counts.contributionLogs}件 / 行動ログ=顧客接点ログ ${counts.customerContactLogs}件・発言ログ ${counts.speechLogs}件`,
		"",
		"=== 評価材料 ===",
		input.source.slice(0, 16000),
	].join("\n");

	return { systemPrompt, userPrompt };
}

async function callAnthropicSalesPerformanceReview(
	input: SalesPerformanceReviewPromptInput,
): Promise<SalesPerformanceReviewAIResponse> {
	const { systemPrompt, userPrompt } = buildSalesPerformanceReviewPrompts(input);

	const raw = await callAnthropicChat({
		system: systemPrompt,
		user: userPrompt,
		maxTokens: 4000,
		temperature: 0,
		jsonSchema: SALES_PERFORMANCE_REVIEW_RESPONSE_FORMAT,
	});
	return parseSalesPerformanceReviewAIResponse(raw);
}

function resolveWajoOpenAiConfig(
	env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): { apiKey: string; model: string } {
	return {
		apiKey: (env.WAJO_OPENAI_API_KEY || env.OPENAI_API_KEY || "").trim(),
		model: (env.WAJO_OPENAI_MODEL || env.OPENAI_MODEL || "gpt-4o-mini").trim(),
	};
}

function resolveWajoAnthropicConfig(
	env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): { apiKey: string; model: string } {
	return {
		apiKey: (env.WAJO_ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || "").trim(),
		model: (env.WAJO_ANTHROPIC_MODEL || env.ANTHROPIC_MODEL || "claude-sonnet-4-6").trim(),
	};
}

async function callAnthropicChat(input: {
	system: string;
	user: string;
	maxTokens: number;
	temperature: number;
	jsonSchema?: WajoJsonSchemaResponseFormat;
}): Promise<string> {
	const { apiKey, model } = resolveWajoAnthropicConfig(process.env);
	if (!apiKey) throw new Error("WAJO_ANTHROPIC_API_KEY / ANTHROPIC_API_KEY が未設定です");

	const outputConfig = buildAnthropicOutputConfig(input.jsonSchema);
	const response = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model,
			max_tokens: input.maxTokens,
			system: input.system,
			messages: [{ role: "user", content: input.user }],
			temperature: input.temperature,
			...(outputConfig ? { output_config: outputConfig } : {}),
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Anthropic API error ${response.status}: ${errorText.slice(0, 200)}`);
	}

	const json = (await response.json()) as {
		content?: Array<{ type?: string; text?: string }>;
	};
	const raw =
		json.content?.find((part) => typeof part?.text === "string")?.text ??
		json.content?.[0]?.text;
	if (!raw) throw new Error("Anthropic からレスポンスが返りませんでした");
	return raw;
}

type WajoJsonSchemaResponseFormat = {
	type: "json_schema";
	json_schema: {
		name: string;
		strict?: boolean;
		schema: unknown;
	};
};

const ANTHROPIC_JSON_SCHEMA_UNSUPPORTED_KEYS = new Set([
	"minimum",
	"maximum",
	"exclusiveMinimum",
	"exclusiveMaximum",
	"minLength",
	"maxLength",
	"pattern",
	"format",
	"minItems",
	"maxItems",
	"multipleOf",
]);

function buildAnthropicOutputConfig(
	responseFormat: WajoJsonSchemaResponseFormat | undefined,
): { format: { type: "json_schema"; schema: unknown } } | undefined {
	if (!responseFormat) return undefined;
	return {
		format: {
			type: "json_schema",
			schema: sanitizeAnthropicJsonSchema(responseFormat.json_schema.schema),
		},
	};
}

function sanitizeAnthropicJsonSchema(schema: unknown): unknown {
	if (Array.isArray(schema)) {
		return schema.map((item) => sanitizeAnthropicJsonSchema(item));
	}
	if (!schema || typeof schema !== "object") return schema;
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(schema)) {
		if (ANTHROPIC_JSON_SCHEMA_UNSUPPORTED_KEYS.has(key)) continue;
		result[key] = sanitizeAnthropicJsonSchema(value);
	}
	return result;
}

export {
	resolveWajoOpenAiConfig as resolveWajoOpenAiConfigForTest,
	resolveWajoAnthropicConfig as resolveWajoAnthropicConfigForTest,
	callAnthropicChat as callAnthropicChatForTest,
	applySalesPerformanceQualitativeGuard as applySalesPerformanceQualitativeGuardForTest,
	buildSalesPerformanceReviewPrompts as buildSalesPerformanceReviewPromptsForTest,
	SALES_PERFORMANCE_QUALITATIVE_MISSING_TEXT as SALES_PERFORMANCE_QUALITATIVE_MISSING_TEXT_FOR_TEST,
	SALES_PERFORMANCE_QUALITATIVE_MISSING_PERSON_COMMENT as SALES_PERFORMANCE_QUALITATIVE_MISSING_PERSON_COMMENT_FOR_TEST,
	SALES_PERFORMANCE_QUALITATIVE_MISSING_IMPROVEMENT as SALES_PERFORMANCE_QUALITATIVE_MISSING_IMPROVEMENT_FOR_TEST,
	SALES_PERFORMANCE_QUALITATIVE_MISSING_MANAGER_ITEM as SALES_PERFORMANCE_QUALITATIVE_MISSING_MANAGER_ITEM_FOR_TEST,
	SALES_PERFORMANCE_QUANTITATIVE_ONLY_CONCLUSION_PREFIX as SALES_PERFORMANCE_QUANTITATIVE_ONLY_CONCLUSION_PREFIX_FOR_TEST,
};

function parseSalesPerformanceReviewAIResponse(
	raw: string,
): SalesPerformanceReviewAIResponse {
	try {
		const parsed = JSON.parse(raw) as Partial<SalesPerformanceReviewAIResponse>;
		return {
			conclusion: typeof parsed.conclusion === "string" ? parsed.conclusion : "",
			resultExplanation:
				typeof parsed.resultExplanation === "string" ? parsed.resultExplanation : "",
			actionGuidance:
				typeof parsed.actionGuidance === "string" ? parsed.actionGuidance : "",
			contributionView:
				typeof parsed.contributionView === "string" ? parsed.contributionView : "",
			evidence: stringArray(parsed.evidence),
			personComment:
				typeof parsed.personComment === "string" ? parsed.personComment : "",
			managerConfirmationItems: stringArray(parsed.managerConfirmationItems),
			nextMonthImprovements: stringArray(parsed.nextMonthImprovements).slice(0, 3),
			riskNotes: stringArray(parsed.riskNotes),
			recommendedStatus:
				parsed.recommendedStatus === "処理済" ? "処理済" : "要確認",
		};
	} catch (error) {
		console.log("parseSalesPerformanceReviewAIResponse failed", String(error));
		return {
			conclusion: "",
			resultExplanation: "",
			actionGuidance: "",
			contributionView: "",
			evidence: [],
			personComment: "",
			managerConfirmationItems: ["AI返却JSONの解析に失敗したため、人間確認が必要です。"],
			nextMonthImprovements: [],
			riskNotes: [`JSONパース失敗: ${raw.slice(0, 200)}`],
			recommendedStatus: "要確認",
		};
	}
}

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => (typeof item === "string" ? item.trim() : ""))
		.filter(Boolean)
		.slice(0, 8);
}

// 商太(3体目=とどめの参謀)への入力を、企業ページの実データから組む(純関数)。
// hits=当てる弾(Aが集めた出典つきの動き)。knowledge=和上側にしか無い手がかり(社内情報)。
// 空の物は渡さない=商太の鉄則「データに無い事は創作しない」を入力側でも守る。
function buildShoutaInput(
	companyName: string,
	properties: Record<string, unknown>,
): ShoutaInput {
	const pick = (name: string) => text(properties[name]).trim();
	const hits: string[] = [];
	if (pick("直近ニュース")) hits.push(`直近の動き: ${pick("直近ニュース")}`);
	if (pick("経営陣")) hits.push(`経営陣: ${pick("経営陣")}`);
	const knowledgeLines: string[] = [];
	if (pick("成約へのポイント"))
		knowledgeLines.push(`成約へのポイント: ${pick("成約へのポイント")}`);
	if (pick("問い合わせ要約"))
		knowledgeLines.push(`問い合わせ要約: ${pick("問い合わせ要約")}`);
	const dealType = pick("売買区分");
	if (dealType && dealType !== "不明") knowledgeLines.push(`売買区分: ${dealType}`);
	const dossierLines: string[] = [];
	if (pick("企業サマリー")) dossierLines.push(pick("企業サマリー"));
	if (pick("営業切り口")) dossierLines.push(pick("営業切り口"));
	if (pick("和上解決策適合")) dossierLines.push(pick("和上解決策適合"));
	if (pick("現在課題仮説")) dossierLines.push(`現在課題仮説: ${pick("現在課題仮説")}`);
	if (pick("将来課題仮説")) dossierLines.push(`将来課題仮説: ${pick("将来課題仮説")}`);
	if (pick("想定決裁者")) dossierLines.push(`想定決裁者: ${pick("想定決裁者")}`);
	if (pick("想定反論・懸念"))
		dossierLines.push(`想定反論・懸念: ${pick("想定反論・懸念")}`);
	if (pick("初回トーク方針"))
		knowledgeLines.push(`初回トーク方針: ${pick("初回トーク方針")}`);
	return {
		companyName,
		contact:
			pick("面談相手（名前・役職）") || pick("問い合わせ担当者名") || undefined,
		hits,
		renewableXray: pick("再エネ接点シグナル") || undefined,
		dossier: dossierLines.length > 0 ? dossierLines.join("\n") : undefined,
		knowledge: knowledgeLines.length > 0 ? knowledgeLines.join("\n") : undefined,
	};
}
export { buildShoutaInput as buildShoutaInputForTest };

async function processMeetingPrepReport(
	input: MeetingPrepInput,
	notion: NotionClient,
): Promise<MeetingPrepResult> {
	const companyPage = await notion.pages.retrieve({
		page_id: input.companyPageId,
	});
	const baseCompany = readCompany(companyPage);
	// 1社1枚の解決はenrich(Gemini課金)より前に行う(検品指摘: ゲートの前に課金が走っていた)
	const report = await resolveMeetingPrepReport(notion, baseCompany, input.reportPageId);
	const reportIsBlank = !report || isBlankMeetingPrepReport(report);

	// 鮮度ゲート(連打防止・1社1枚): 中身のある既存レポートが新しい間は再生成しない。
	// 会社の情報は決算等が動かない限り大きく変わらない=同内容の量産はコストと見た目の両方で損。
	// enrich/LLMより前に止めるので、このreturnは完全無料。
	if (report && !reportIsBlank && !input.force && !input.dryRun) {
		const lastEdited = String(
			(report as unknown as Record<string, unknown>).last_edited_time ?? "",
		);
		const refreshDays = Number(process.env.REPORT_REFRESH_DAYS) || 30;
		if (
			lastEdited &&
			isTdbSurveyFresh(lastEdited, new Date().toISOString(), refreshDays)
		) {
			return {
				companyId: baseCompany.page.id,
				reportId: report.id,
				reportUrl: report.url ?? null,
				action: "skipped-fresh",
				message: `商談準備レポートは作成済みです（最終更新 ${lastEdited.slice(0, 10)}）。会社の情報が大きく動くまで、もう少しタイミングを待ってください。決算発表や大きなニュースの後に再実行すると新しい中身になります（どうしても今作り直す場合は force 指定）。`,
			};
		}
	}

	// ゲート通過後にだけ補完(Gemini)を行う
	const company = await enrichCompanyForMeetingPrep(baseCompany);
	const prep = await buildMeetingPrepReportWithAI(company);
	const quality = assessMeetingPrepQuality(company, prep);
	const finalPrep = {
		...prep,
		risks: withMeetingPrepQualityMemo(prep.risks, quality),
	};

	if (input.dryRun) {
		return {
			companyId: company.page.id,
			reportId: report?.id ?? null,
			reportUrl: report?.url ?? null,
			action: "dry-run",
			message: report
				? "dry-run: 既存の商談準備レポートを更新できます。"
				: "dry-run: 新しい商談準備レポートを作成できます。",
		};
	}

	const targetReport =
		report ??
		(await createMeetingPrepReportPage(notion, company, "Workerが企業ページから新規作成。"));

	await notion.pages.update({
		page_id: targetReport.id,
		properties: {
			"企業名（商談日）": title(company.name || "商談準備レポート"),
			対象企業: relation(company.page.id),
			売買区分: select(company.dealType || "未設定"),
			ステータス: select(quality.ready ? "準備完了" : "準備中"),
			企業プロフィール: richText(finalPrep.profile),
			"3C分析": richText(finalPrep.threeC),
			商談仮説: richText(finalPrep.hypothesis),
			ヒアリングリスト: richText(finalPrep.questions),
			"注意点・リスク": richText(finalPrep.risks),
		},
	});
	await addMeetingPrepRelationToCompany(notion, company.page.id, targetReport.id);

	// 本文: 既存レポートの作り直し(鮮度切れ/force)の場合は旧本文をアーカイブしてから書く。
	// 1社1枚ルール=本文も常に最新1セットだけ(重ね書きで縦に伸びない)。
	if (!reportIsBlank) {
		await archiveAllPageBodyBlocks(notion, targetReport.id);
	}
	// 商太ブリーフ: 材料(A実データ/和上の手がかり)がゼロの時は呼ばない=数字の創作圧力をかけない。
	// クオリティ優先(2026-06-11): 企業ページ本文(Aドシエ全文)まで食わせ、検品AI(4体目)を通してから書く。
	let briefWritten = false;
	{
		const shoutaInput = buildShoutaInput(
			company.name,
			companyPage.properties ?? {},
		);
		const bodyDossier = await fetchPageBlockPlainText(notion, company.page.id);
		if (bodyDossier.trim()) {
			shoutaInput.dossier = [
				shoutaInput.dossier,
				`【企業ページ本文(Aドシエ全文)】\n${bodyDossier}`,
			]
				.filter(Boolean)
				.join("\n\n");
		}
		const hasMaterial =
			(shoutaInput.hits?.length ?? 0) > 0 ||
			Boolean(shoutaInput.renewableXray) ||
			Boolean(shoutaInput.dossier) ||
			Boolean(shoutaInput.knowledge);
		let shoutaBrief = "";
		if (hasMaterial) {
			const result = await generateInspectedShoutaBrief(shoutaInput);
			const verdictLine = result.inspection.inspected
				? result.inspection.pass
					? `✅ 検品AI通過（生成${result.attempts}回）`
					: `⚠️ 検品AIの指摘が残っています（人間確認推奨）: ${result.inspection.problems.join(" ／ ")}`
				: `ℹ️ 未検品: ${result.inspection.problems.join(" ／ ")}`;
			// 判定行は先頭(60行カットで消えない位置・検品レビュー反映)
			shoutaBrief = `${verdictLine}\n${result.brief}`;
		}
		briefWritten = shoutaBrief.trim().length > 0;
		await appendMeetingPrepReportBody(
			notion,
			targetReport.id,
			company,
			finalPrep,
			shoutaBrief,
		);
	}

	const briefNote = briefWritten ? "(商太ブリーフ付き)" : "";
	return {
		companyId: company.page.id,
		reportId: targetReport.id,
		reportUrl: targetReport.url ?? null,
		action: report ? "updated-report" : "created-report",
		message: quality.ready
			? report
				? `商談準備レポートの空欄を補完し、準備完了にしました${briefNote}。`
				: `商談準備レポートを新規作成し、準備完了にしました${briefNote}。`
			: "商談準備レポートを作成/補完しましたが、根拠不足または企業別情報不足のため準備中で止めました。",
	};
}

type RequiredFieldCheck = {
	label: string;
	value: string | number | null;
};

type ResidentDocumentDraft = {
	missingField: string | null;
	nextRequiredFields: string[];
	documentTitle: string;
	summaryLines: string[];
};

type ProposalSimulationDraft = {
	missingField: string | null;
	nextRequiredFields: string[];
	proposalKind: ProposalKind;
	proposalTitle: string;
	titleLabel: string;
	typeGuideLines: string[];
	salePrice: number | null;
	purchaseCost: number | null;
	annualIncome: number | null;
	runningCost: number;
	annualNetIncome: number | null;
	solarDetails: SolarProposalDetails | null;
	sitePhotos: ProposalSitePhoto[];
	runningCostBreakdown: RunningCostBreakdownItem[];
	annualReductionAmount: number | null;
	reductionRate: number | null;
	co2ReductionTons: number | null;
	grossProfit: number | null;
	expectedYield: number | null;
	paybackYears: number | null;
	conclusionText: string;
	summaryLines: string[];
	pageOneLines: string[];
	pageTwoLines: string[];
};

type RunningCostBreakdownItem = {
	label: string;
	value: number;
};

type SolarProposalDetails = {
	plantName: string;
	location: string;
	powerArea: string;
	voltageClass: string;
	panelMaker: string;
	panelModel: string;
	panelCount: number | null;
	dcCapacityKw: number | null;
	powerConditionerMaker: string;
	powerConditionerModel: string;
	pcsCapacityKw: number | null;
	fitFipType: string;
	unitPrice: number | null;
	remainingSalesYears: number | null;
	gridConnectionDate: string;
	operationYears: string;
};

type ProposalSitePhoto = {
	url: string;
	name: string;
};

type ProposalKind = "corporate" | "individual" | "esg" | "gridBattery";

async function processResidentDocument(
	input: ResidentDocumentInput,
	notion: NotionClient,
): Promise<ResidentDocumentResult> {
	const page = await notion.pages.retrieve({ page_id: input.pageId });
	const draft = evaluateResidentDocumentDraft(page);

	if (draft.missingField) {
		const message = buildSequentialMissingMessage(
			"住民説明会資料",
			draft.missingField,
			draft.nextRequiredFields,
		);
		if (!input.dryRun) {
			const patches: Record<string, SafePatch> = {};
			setAliasPatch(
				patches,
				["資料作成ステータス", "住民説明会資料ステータス", "生成ステータス"],
				{ kind: "select", value: "入力待ち" },
			);
			setAliasPatch(
				patches,
				["不足項目", "最終不足項目", "入力エラー項目"],
				{ kind: "text", value: draft.missingField },
			);
			setAliasPatch(
				patches,
				["資料作成メモ", "住民説明会メモ", "処理結果メモ"],
				{ kind: "text", value: message },
			);
			await safeUpdateExistingProperties(notion, page, patches);
			await createPageComment(notion, page.id, `⚠️ ${message}`);
		}
	return {
		pageId: page.id,
		action: input.dryRun ? "dry-run" : "needs-input",
		status: "入力待ち",
		missingField: draft.missingField,
			message,
		};
	}

	const readyMessage = [
		"住民説明会資料の必須入力チェックを通過しました。",
		...draft.summaryLines,
		"次ステップ: PDF生成ワーカーに渡して資料を作成してください。",
	].join("\n");
	if (!input.dryRun) {
		const patches: Record<string, SafePatch> = {};
		setAliasPatch(
			patches,
			["資料作成ステータス", "住民説明会資料ステータス", "生成ステータス"],
			{ kind: "select", value: "作成準備完了" },
		);
		setAliasPatch(
			patches,
			["不足項目", "最終不足項目", "入力エラー項目"],
			{ kind: "clear" },
		);
		setAliasPatch(
			patches,
			["資料作成メモ", "住民説明会メモ", "処理結果メモ"],
			{ kind: "text", value: readyMessage },
		);
		setAliasPatch(
			patches,
			["生成ドキュメント名", "資料タイトル", "住民説明会資料名"],
			{ kind: "text", value: draft.documentTitle },
		);
		await safeUpdateExistingProperties(notion, page, patches);
		await createPageComment(
			notion,
			page.id,
			`✅ 住民説明会資料の準備が完了しました。\n${draft.documentTitle}`,
		);
	}
	return {
		pageId: page.id,
		action: input.dryRun ? "dry-run" : "prepared",
		status: "作成準備完了",
		missingField: null,
		message: readyMessage,
	};
}

async function processProposalSimulation(
	input: ProposalSimulationInput,
	notion: NotionClient,
): Promise<ProposalSimulationResult> {
	const page = await notion.pages.retrieve({ page_id: input.pageId });
	const draft = evaluateProposalSimulationDraft(page);

	if (draft.missingField) {
		const message = buildSequentialMissingMessage(
			"提案シミュレーション",
			draft.missingField,
			draft.nextRequiredFields,
		);
		if (!input.dryRun) {
			const patches: Record<string, SafePatch> = {};
			setAliasPatch(
				patches,
				["シミュレーションステータス", "PDFシミュレーションステータス", "生成ステータス"],
				{ kind: "select", value: "入力待ち" },
			);
			setAliasPatch(
				patches,
				["不足項目", "最終不足項目", "入力エラー項目"],
				{ kind: "text", value: draft.missingField },
			);
			setAliasPatch(
				patches,
				["シミュレーションメモ", "資料作成メモ", "処理結果メモ"],
				{ kind: "text", value: message },
			);
			setAliasPatch(
				patches,
				["御社への結論", "提案結論", "提案結論（自動）", "提案結論（下書き）"],
				{ kind: "text", value: buildPlaceholderConclusionText(draft.proposalKind) },
			);
			setAliasPatch(
				patches,
				["提案タイプガイド", "提案タイプ説明", "資料タイプ説明"],
				{ kind: "text", value: draft.typeGuideLines.join("\n") },
			);
			await safeUpdateExistingProperties(notion, page, patches);
			await createPageComment(notion, page.id, `⚠️ ${message}`);
		}
		return {
			pageId: page.id,
			action: input.dryRun ? "dry-run" : "needs-input",
			status: "入力待ち",
			missingField: draft.missingField,
			grossProfit: null,
			expectedYield: null,
			paybackYears: null,
			message,
		};
	}

	const pdfExport = input.dryRun
		? {
				attached: false,
				destination: "none" as const,
				message: "dry-runのためPDFは保存していません。",
				fileName: "",
				fileUrl: null as string | null,
		  }
		: await exportProposalSimulationPdf(notion, page, draft);
	const readyMessage = [
		"提案シミュレーションの必須入力チェックを通過しました。",
		`提案書タイトル: ${draft.proposalTitle}`,
		...draft.summaryLines,
		`【御社への結論】${draft.conclusionText}`,
		"【A4 2枚構成｜1枚目】",
		...draft.pageOneLines,
		"【A4 2枚構成｜2枚目】",
		...draft.pageTwoLines,
		"【提案タイプの選び方】",
		...draft.typeGuideLines,
		`PDF出力: ${pdfExport.message}`,
		pdfExport.destination === "property"
			? "保存先: レコード内のPDFプロパティ（提案PDF / シミュレーションPDF 等）から確認できます。"
			: pdfExport.destination === "page_block"
				? "保存先: 同じレコード本文の末尾にPDFを追加しています。"
				: "PDFが保存されていない場合は、レコードに files 型の「提案PDF」プロパティを1つ追加してください。",
	].join("\n");
	if (!input.dryRun) {
		const patches: Record<string, SafePatch> = {};
		setAliasPatch(
			patches,
			["シミュレーションステータス", "PDFシミュレーションステータス", "生成ステータス"],
			{ kind: "select", value: "シミュレーション準備完了" },
		);
		setAliasPatch(
			patches,
			["不足項目", "最終不足項目", "入力エラー項目"],
			{ kind: "clear" },
		);
		setAliasPatch(
			patches,
			["シミュレーションメモ", "資料作成メモ", "処理結果メモ"],
			{ kind: "text", value: readyMessage },
		);
		setAliasPatch(
			patches,
			["御社への結論", "提案結論", "提案結論（自動）", "提案結論（下書き）"],
			{ kind: "text", value: draft.conclusionText },
		);
		setAliasPatch(
			patches,
			["提案タイプガイド", "提案タイプ説明", "資料タイプ説明"],
			{ kind: "text", value: draft.typeGuideLines.join("\n") },
		);
		if (pdfExport.fileUrl) {
			setAliasPatch(patches, PROPOSAL_PDF_URL_PROPERTY_ALIASES, {
				kind: "text",
				value: pdfExport.fileUrl,
			});
		}
		if (draft.grossProfit !== null) {
			setAliasPatch(
				patches,
				["想定粗利額", "粗利試算", "試算粗利額"],
				{ kind: "number", value: draft.grossProfit },
			);
		}
		if (draft.expectedYield !== null) {
			setAliasPatch(
				patches,
				["想定利回り", "利回り", "IRR(簡易)"],
				{ kind: "number", value: draft.expectedYield },
			);
		}
		if (draft.paybackYears !== null) {
			setAliasPatch(
				patches,
				["想定回収年数", "回収年数"],
			{ kind: "number", value: draft.paybackYears },
			);
		}
		await safeUpdateExistingProperties(notion, page, patches);
		if (pdfExport.fileUrl) {
			await updateRelatedProjectProposalPdfLink(notion, page, pdfExport.fileUrl);
		}
		await createPageComment(
			notion,
			page.id,
			`✅ 提案シミュレーションの準備が完了しました。\n${draft.summaryLines.join("\n")}\n${pdfExport.message}`,
		);
	}
	return {
		pageId: page.id,
		action: input.dryRun ? "dry-run" : "prepared",
		status: "シミュレーション準備完了",
		missingField: null,
		grossProfit: draft.grossProfit,
		expectedYield: draft.expectedYield,
		paybackYears: draft.paybackYears,
		message: readyMessage,
	};
}

const PROJECT_DOCUMENT_REQUEST_CONFIGS: Record<
	ProjectDocumentRequestKind,
	ProjectDocumentRequestConfig
> = {
	proposal: {
		kind: "proposal",
		documentType: "提案書",
		requestTitleSuffix: "提案シミュレーション",
		statusProperty: "シミュレーションステータス",
		statusValue: "入力待ち",
		createdLabel: "提案シミュレーション依頼",
		nextActionMessage:
			"次は資料作成依頼側で不足項目を補完し、PDF提案化してください。",
		memo: "案件管理DBから作成しました。必要項目を補完してPDF提案化してください。",
	},
	resident: {
		kind: "resident",
		documentType: "住民説明会資料",
		requestTitleSuffix: "説明会用資料",
		statusProperty: "資料作成ステータス",
		statusValue: "入力待ち",
		createdLabel: "説明会用資料依頼",
		nextActionMessage:
			"次は資料作成依頼側で近隣周知・説明会資料の不足項目を補完してください。",
		memo: "案件管理DBから作成しました。近隣周知・説明会資料の必須項目を補完してください。",
		defaultProperties: {
			周知方法: select("所有者変更周知"),
		},
	},
};

async function processProjectProposalRequest(
	input: ProjectProposalRequestInput,
	notion: NotionClient,
): Promise<ProjectProposalRequestResult> {
	return processProjectDocumentRequest(input, notion, "proposal");
}

async function processProjectResidentDocumentRequest(
	input: ProjectProposalRequestInput,
	notion: NotionClient,
): Promise<ProjectDocumentRequestResult> {
	return processProjectDocumentRequest(input, notion, "resident");
}

async function processProjectEquipmentDetailRequest(
	input: ProjectProposalRequestInput,
	notion: NotionClient,
): Promise<ProjectEquipmentDetailRequestResult> {
	const projectPage = await notion.pages.retrieve({ page_id: input.projectPageId });
	const projectName = readGenericPageTitle(projectPage) || "案件";
	const existingEquipmentIds = relationIdsFromAliases(
		projectPage.properties ?? {},
		PROJECT_EQUIPMENT_DETAIL_RELATION_ALIASES,
	);
	if (existingEquipmentIds.length > 1) {
		const message = `発電所設備詳細が複数紐づいているため、重複作成を止めました: ${projectName}`;
		if (!input.dryRun) {
			await createPageComment(
				notion,
				projectPage.id,
				`⚠️ ${message}\n正しい設備詳細を1件に整理してから、再度実行してください。`,
			);
		}
		return {
			projectPageId: projectPage.id,
			equipmentPageId: null,
			action: input.dryRun ? "dry-run" : "duplicate-hold",
			message,
		};
	}
	if (existingEquipmentIds.length > 0) {
		const message = `既存の発電所設備詳細があります: ${projectName}`;
		if (!input.dryRun) {
			await createPageComment(
				notion,
				projectPage.id,
				`⚡ ${message}\n設備詳細を重複作成しませんでした。`,
			);
		}
		return {
			projectPageId: projectPage.id,
			equipmentPageId: existingEquipmentIds[0]!,
			action: input.dryRun ? "dry-run" : "existing",
			message,
		};
	}

	const equipmentTitle = `${projectName}｜設備詳細`;
	if (input.dryRun) {
		return {
			projectPageId: projectPage.id,
			equipmentPageId: null,
			action: "dry-run",
			message: `dry-run: 発電所設備詳細DBへ「${equipmentTitle}」を作成します。`,
		};
	}

	const equipmentPage = await notion.pages.create({
		parent: { data_source_id: POWER_PLANT_EQUIPMENT_DATA_SOURCE_ID },
		properties: {
			設備詳細名: title(equipmentTitle),
			関連案件: relation(projectPage.id),
			...buildEquipmentDetailInitialProperties(projectPage),
		},
	});
	const equipmentUrl = typeof (equipmentPage as Record<string, unknown>).url === "string"
		? ((equipmentPage as Record<string, unknown>).url as string)
		: "";
	await safeUpdateExistingProperties(notion, projectPage, {
		発電所設備詳細: { kind: "relation", ids: [equipmentPage.id] },
		資料作成メモ: {
			kind: "text",
			value: `発電所設備詳細を作成しました。${equipmentUrl}`,
		},
	});
	await createPageComment(
		notion,
		projectPage.id,
		[
			`⚡ 発電所設備詳細を作成しました: ${equipmentTitle}`,
			equipmentUrl ? `開く: ${equipmentUrl}` : "",
			"案件ページ上で設備詳細を入力してから、シミュレーション作成または説明会用資料作成へ進んでください。",
		].filter(Boolean).join("\n"),
	);
	return {
		projectPageId: projectPage.id,
		equipmentPageId: equipmentPage.id,
		action: "created",
		message: `発電所設備詳細を作成しました: ${equipmentTitle}`,
	};
}

function buildEquipmentDetailInitialProperties(
	projectPage: Page,
): Record<string, Record<string, unknown>> {
	const properties = projectPage.properties ?? {};
	const prefill: Record<string, Record<string, unknown>> = {};
	setTextPrefill(prefill, "発電所名", properties, ["発電所名", "物件名", "案件名"]);
	setTextPrefill(prefill, "所在地", properties, ["所在地", "住所"]);
	setTextPrefill(prefill, "発電所住所", properties, ["発電所住所", "所在地", "住所"]);
	setSelectPrefill(prefill, "電力会社エリア", properties, ["電力会社エリア"]);
	setSelectPrefill(prefill, "低圧/高圧区分", properties, ["低圧/高圧区分"]);
	setFilesPrefill(prefill, "現場写真", properties, [
		"現場写真",
		"発電所写真",
		"現地写真",
		"外観写真",
		"設備写真",
		"写真",
	]);
	return prefill;
}

async function processProjectDocumentRequest(
	input: ProjectProposalRequestInput,
	notion: NotionClient,
	kind: ProjectDocumentRequestKind,
): Promise<ProjectDocumentRequestResult> {
	const config = PROJECT_DOCUMENT_REQUEST_CONFIGS[kind];
	const projectPage = await notion.pages.retrieve({ page_id: input.projectPageId });
	const equipmentPage = await retrieveProjectEquipmentDetailPage(notion, projectPage);
	const documentSourcePage = mergeProjectWithEquipmentDetail(projectPage, equipmentPage);
	const projectName = readGenericPageTitle(projectPage) || "案件";
	const readiness = evaluateProjectDocumentRequestReadiness(documentSourcePage, kind);
	const missingMessage = readiness.missingField
		? buildSequentialMissingMessage(
				kind === "proposal" ? "シミュレーション作成" : "説明会用資料作成",
				readiness.missingField,
				readiness.nextRequiredFields,
			)
		: "";
	const existingRequestIds = relationIdsFromProperty(
		projectPage.properties?.["資料作成依頼"],
	);
	const existingRequest = await findExistingProjectDocumentRequest(
		notion,
		projectPage.id,
		config.documentType,
	);
	if (existingRequest) {
		const message = `既存の${config.createdLabel}があります: ${projectName}`;
		if (!input.dryRun) {
			await createPageComment(
				notion,
				projectPage.id,
				`📄 ${message}\n${config.documentType}の資料作成依頼を重複作成しませんでした。`,
			);
		}
		return {
			projectPageId: projectPage.id,
			requestPageId: existingRequest.id,
			action: "existing",
			message,
		};
	}

	const requestTitle = `${projectName}｜${config.requestTitleSuffix}`;
	if (input.dryRun) {
		return {
			projectPageId: projectPage.id,
			requestPageId: null,
			action: "dry-run",
			message: `dry-run: 営業資料作成依頼DBへ「${requestTitle}」を作成します。`,
		};
	}

	const requestMemo = [config.memo, missingMessage].filter(Boolean).join("\n");
	const requestPage = await notion.pages.create({
		parent: { data_source_id: PROPOSAL_REQUEST_DATA_SOURCE_ID },
		properties: {
			案件名: title(requestTitle),
			資料種別: select(config.documentType),
			[config.statusProperty]: select(config.statusValue),
			関連案件: relation(projectPage.id),
			資料作成メモ: richText(requestMemo),
			...(config.defaultProperties ?? {}),
			...readiness.prefillProperties,
		},
	});
	const requestUrl = typeof (requestPage as Record<string, unknown>).url === "string"
		? ((requestPage as Record<string, unknown>).url as string)
		: "";
	const requestIds = uniqueStrings([...existingRequestIds, requestPage.id]);
	await safeUpdateExistingProperties(notion, projectPage, {
		資料作成依頼: { kind: "relation", ids: requestIds },
		資料作成メモ: {
			kind: "text",
			value: [
				`${config.createdLabel}を作成しました。${requestUrl}`,
				missingMessage,
			].filter(Boolean).join("\n"),
		},
	});
	await createPageComment(
		notion,
		projectPage.id,
		[
			`📄 ${config.createdLabel}を作成しました: ${requestTitle}`,
			requestUrl ? `開く: ${requestUrl}` : "",
			missingMessage ? `不足: ${readiness.missingField}` : "",
			config.nextActionMessage,
		].filter(Boolean).join("\n"),
	);
	return {
		projectPageId: projectPage.id,
		requestPageId: requestPage.id,
		action: "created",
		message: `${config.createdLabel}を作成しました: ${requestTitle}`,
	};
}

function evaluateProjectDocumentRequestReadiness(
	projectPage: Page,
	kind: ProjectDocumentRequestKind,
): {
	missingField: string | null;
	nextRequiredFields: string[];
	prefillProperties: Record<string, Record<string, unknown>>;
} {
	if (kind === "proposal") {
		const draft = evaluateProposalSimulationDraft(projectPage);
		return {
			missingField: draft.missingField,
			nextRequiredFields: draft.nextRequiredFields,
			prefillProperties: buildProposalRequestPrefillProperties(projectPage, draft),
		};
	}
	const draft = evaluateResidentDocumentDraft(projectPage);
	return {
		missingField: draft.missingField,
		nextRequiredFields: draft.nextRequiredFields,
		prefillProperties: buildResidentRequestPrefillProperties(projectPage),
	};
}

function buildProposalRequestPrefillProperties(
	projectPage: Page,
	draft: ProposalSimulationDraft,
): Record<string, Record<string, unknown>> {
	const properties = projectPage.properties ?? {};
	const prefill: Record<string, Record<string, unknown>> = {
		提案タイプ: select(proposalKindJapaneseLabel(draft.proposalKind)),
	};
	if (draft.proposalKind === "gridBattery") {
		if (draft.salePrice !== null) prefill.総事業費 = { number: draft.salePrice };
		if (draft.purchaseCost !== null) prefill.実質投資額 = { number: draft.purchaseCost };
		if (draft.annualIncome !== null) prefill.年間想定総売上 = { number: draft.annualIncome };
		return prefill;
	}
	const details = draft.solarDetails;
	if (draft.salePrice !== null) prefill.販売価格 = { number: draft.salePrice };
	if (draft.purchaseCost !== null) prefill.仕入れ価格 = { number: draft.purchaseCost };
	if (draft.annualIncome !== null) prefill.年間売電収入 = { number: draft.annualIncome };
	prefill["年間維持費（ランニングコスト）"] = { number: draft.runningCost };
	if (details) {
		prefill.発電所名 = richText(details.plantName);
		prefill.所在地 = richText(details.location);
		prefill.電力会社エリア = select(details.powerArea);
		prefill["低圧/高圧区分"] = select(details.voltageClass);
		prefill.パネルメーカー = richText(details.panelMaker);
		prefill.パネル型式 = richText(details.panelModel);
		if (details.panelCount !== null) prefill.パネル枚数 = { number: details.panelCount };
		if (details.dcCapacityKw !== null) {
			prefill["DC容量（パネル側kW）"] = { number: details.dcCapacityKw };
		}
		prefill.パワコンメーカー = richText(details.powerConditionerMaker);
		prefill.パワコン型式 = richText(details.powerConditionerModel);
		if (details.pcsCapacityKw !== null) {
			prefill["PCS容量（パワコン側kW）"] = { number: details.pcsCapacityKw };
		}
		prefill["FIT/FIP区分"] = select(details.fitFipType);
		if (details.unitPrice !== null) prefill.売電単価 = { number: details.unitPrice };
		if (details.remainingSalesYears !== null) {
			prefill.残存売電期間 = { number: details.remainingSalesYears };
		}
		const gridConnectionDate = datePropertyValueFromAliases(properties, [
			"連系開始日",
			"発電開始日",
			"売電開始日",
			"稼働開始日",
		]);
		if (gridConnectionDate) prefill.連系開始日 = gridConnectionDate;
	}
	const sitePhotos = filesPropertyValueFromImages(draft.sitePhotos);
	if (sitePhotos) prefill.現場写真 = sitePhotos;
	return prefill;
}

function buildResidentRequestPrefillProperties(
	projectPage: Page,
): Record<string, Record<string, unknown>> {
	const properties = projectPage.properties ?? {};
	const prefill: Record<string, Record<string, unknown>> = {};
	setTextPrefill(prefill, "案件番号", properties, [
		"案件番号",
		"発電所問合せ番号",
		"案件ID",
	]);
	setTextPrefill(prefill, "発電所名", properties, ["発電所名", "物件名", "案件名"]);
	setTextPrefill(prefill, "発電所住所", properties, ["発電所住所", "所在地", "住所"]);
	setSelectPrefill(prefill, "周知方法", properties, ["周知方法", "説明会方式", "周知区分"]);
	setDatePrefill(prefill, "質問受付期間", properties, ["質問受付期間", "質問受付期限"]);
	setDatePrefill(prefill, "周知日", properties, ["周知日", "説明会日", "開催日"]);
	setTextPrefill(prefill, "保守管理責任者 氏名", properties, [
		"保守管理責任者 氏名",
		"保守管理責任者",
		"責任者氏名",
	]);
	setTextPrefill(prefill, "旧認定事業者", properties, [
		"旧認定事業者",
		"旧事業者",
		"旧所有者",
	]);
	setTextPrefill(prefill, "新認定事業者", properties, [
		"新認定事業者",
		"新事業者",
		"新所有者",
	]);
	setTextPrefill(prefill, "設備ID", properties, ["設備ID", "認定設備ID"]);
	setFilesPrefill(prefill, "発電所所在地画像", properties, [
		"発電所所在地画像",
		"地図画像",
		"所在地画像",
		"位置図",
	]);
	setFilesPrefill(prefill, "ハザードマップ", properties, ["ハザードマップ"]);
	setFilesPrefill(prefill, "説明会対象エリア画像", properties, [
		"説明会対象エリア画像",
		"対象エリア画像",
		"周辺住民範囲画像",
	]);
	setFilesPrefill(prefill, "反射光画像（夏至）", properties, [
		"反射光画像（夏至）",
		"反射光画像",
		"反射光シミュレーション画像",
	]);
	setFilesPrefill(prefill, "反射光画像（冬至）", properties, [
		"反射光画像（冬至）",
		"反射光画像",
		"反射光シミュレーション画像",
	]);
	setFilesPrefill(prefill, "現場写真", properties, [
		"現場写真",
		"発電所写真",
		"現地写真",
		"外観写真",
		"設備写真",
		"写真",
	]);
	return prefill;
}

async function findExistingProjectDocumentRequest(
	notion: NotionClient,
	projectPageId: string,
	documentType: string,
): Promise<Page | null> {
	const existing = await notion.dataSources.query({
		data_source_id: PROPOSAL_REQUEST_DATA_SOURCE_ID,
		filter: {
			and: [
				{ property: "関連案件", relation: { contains: projectPageId } },
				{ property: "資料種別", select: { equals: documentType } },
			],
		},
		page_size: 1,
	});
	return existing.results[0] ?? null;
}

const PROJECT_EQUIPMENT_DETAIL_RELATION_ALIASES = [
	"発電所設備詳細",
	"設備詳細",
	"発電所情報",
	"設備情報",
];

async function retrieveProjectEquipmentDetailPage(
	notion: NotionClient,
	projectPage: Page,
): Promise<Page | null> {
	const equipmentIds = relationIdsFromAliases(
		projectPage.properties ?? {},
		PROJECT_EQUIPMENT_DETAIL_RELATION_ALIASES,
	);
	if (equipmentIds.length === 0) return null;
	try {
		return await notion.pages.retrieve({ page_id: equipmentIds[0]! });
	} catch (error) {
		console.log("equipment detail retrieve skipped", {
			projectPageId: projectPage.id,
			equipmentPageId: equipmentIds[0],
			error: String(error),
		});
		return null;
	}
}

function relationIdsFromAliases(
	properties: Record<string, unknown>,
	aliases: string[],
): string[] {
	for (const alias of aliases) {
		const ids = relationIdsFromProperty(properties[alias]);
		if (ids.length > 0) return ids;
	}
	return [];
}

function mergeProjectWithEquipmentDetail(projectPage: Page, equipmentPage: Page | null): Page {
	if (!equipmentPage) return projectPage;
	const projectProperties = projectPage.properties ?? {};
	const merged: Record<string, unknown> = { ...projectProperties };
	for (const [name, value] of Object.entries(equipmentPage.properties ?? {})) {
		if (name === "設備詳細名" || name === "関連案件") continue;
		if (!notionPropertyHasValue(merged[name])) merged[name] = value;
	}
	return {
		...projectPage,
		properties: merged,
	};
}

function notionPropertyHasValue(property: unknown): boolean {
	if (!property || typeof property !== "object") return false;
	const prop = property as Record<string, unknown>;
	const type = prop.type;
	if (type === "title" && Array.isArray(prop.title)) return prop.title.length > 0;
	if (type === "rich_text" && Array.isArray(prop.rich_text)) {
		return prop.rich_text.length > 0;
	}
	if (type === "select") return Boolean(prop.select);
	if (type === "status") return Boolean(prop.status);
	if (type === "number") return typeof prop.number === "number";
	if (type === "date") return Boolean(prop.date);
	if (type === "files" && Array.isArray(prop.files)) return prop.files.length > 0;
	if (type === "relation" && Array.isArray(prop.relation)) {
		return prop.relation.length > 0;
	}
	if (type === "email") return typeof prop.email === "string" && prop.email.length > 0;
	if (type === "phone_number") {
		return typeof prop.phone_number === "string" && prop.phone_number.length > 0;
	}
	if (type === "url") return typeof prop.url === "string" && prop.url.length > 0;
	if (type === "checkbox") return prop.checkbox === true;
	if (type === "multi_select" && Array.isArray(prop.multi_select)) {
		return prop.multi_select.length > 0;
	}
	return false;
}

async function updateRelatedProjectProposalPdfLink(
	notion: NotionClient,
	proposalPage: Page,
	pdfUrl: string,
): Promise<void> {
	const relatedProjectIds = relationIdsFromProperty(proposalPage.properties?.["関連案件"]);
	if (relatedProjectIds.length === 0) return;
	for (const projectPageId of relatedProjectIds) {
		try {
			const projectPage = await notion.pages.retrieve({ page_id: projectPageId });
			await safeUpdateExistingProperties(notion, projectPage, {
				提案PDFリンク: { kind: "text", value: pdfUrl },
				資料作成メモ: {
					kind: "text",
					value: `提案PDFを作成しました。${pdfUrl}`,
				},
			});
		} catch (error) {
			console.log("related project pdf link update skipped", {
				projectPageId,
				error: String(error),
			});
		}
	}
}

type ProposalPdfExportResult = {
	attached: boolean;
	destination: "property" | "page_block" | "none";
	message: string;
	fileName: string;
	fileUrl: string | null;
};

async function exportProposalSimulationPdf(
	notion: NotionClient,
	page: Page,
	draft: ProposalSimulationDraft,
): Promise<ProposalPdfExportResult> {
	if (!notion.fileUploads?.create || !notion.fileUploads.send) {
		return {
			attached: false,
			destination: "none",
			message: "この実行環境ではPDFアップロード機能を利用できません。",
			fileName: "",
			fileUrl: null,
		};
	}

	const properties = page.properties ?? {};
	const filePropertyName = findFirstFilesPropertyNameByAliases(
		properties,
		PROPOSAL_PDF_FILE_PROPERTY_ALIASES,
	);

	const titleSeed = draft.titleLabel || readGenericPageTitle(page) || "proposal-simulation";
	const fileName = `${sanitizeFileName(titleSeed)}_${todayIsoDateInTokyo()}.pdf`;
	try {
		const pdfBytes = await buildProposalSimulationPdfBytes(draft, page.id);
		const created = await notion.fileUploads.create({
			mode: "single_part",
			filename: fileName,
			content_type: "application/pdf",
		});
		const fileUploadId =
			firstString(
				(created as Record<string, unknown>).id,
				readNestedString(created, ["file_upload", "id"]),
			) ?? "";
		if (!fileUploadId) {
			return {
				attached: false,
				destination: "none",
				message: "PDFアップロードIDの取得に失敗しました。",
				fileName,
				fileUrl: null,
			};
		}

		await notion.fileUploads.send({
			file_upload_id: fileUploadId,
			file: {
				filename: fileName,
				data: new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }),
			},
		});
		if (notion.fileUploads.complete) {
			try {
				await notion.fileUploads.complete({ file_upload_id: fileUploadId });
			} catch {
				// single_partではcomplete不要の場合があるため無視
			}
		}

		let fileUrl: string | null = null;
		if (filePropertyName) {
			await notion.pages.update({
				page_id: page.id,
				properties: {
					[filePropertyName]: {
						files: [
							{
								type: "file_upload",
								file_upload: { id: fileUploadId },
								name: fileName,
							},
						],
					},
				},
			});
			try {
				const refreshed = await notion.pages.retrieve({ page_id: page.id });
				fileUrl = readFirstFileUrlByAliases(refreshed.properties ?? {}, [filePropertyName]);
			} catch {
				// URL取得に失敗してもPDF保存は成功扱い
			}
			return {
				attached: true,
				destination: "property",
				message: `PDFを保存しました（${filePropertyName}）。`,
				fileName,
				fileUrl,
			};
		}

		if (notion.blocks?.children?.append) {
			await notion.blocks.children.append({
				block_id: page.id,
				children: [
					{
						object: "block",
						type: "heading_3",
						heading_3: {
							rich_text: [
								{
									type: "text",
									text: { content: "提案シミュレーションPDF" },
								},
							],
						},
					},
					{
						object: "block",
						type: "pdf",
						pdf: {
							file_upload: { id: fileUploadId },
							caption: [
								{
									type: "text",
									text: { content: fileName },
								},
							],
						},
					},
				],
			});
			return {
				attached: true,
				destination: "page_block",
				message:
					"PDF保存先プロパティが無かったため、同じレコード本文の末尾にPDFを追加しました。",
				fileName,
				fileUrl: null,
			};
		}

		return {
			attached: false,
			destination: "none",
			message:
				"PDFアップロードは完了しましたが、保存先が未設定です。files型の「提案PDF」を追加してください。",
			fileName,
			fileUrl,
		};
	} catch (error) {
		return {
			attached: false,
			destination: "none",
			message: `PDF保存に失敗しました。${String(error)}`,
			fileName,
			fileUrl: null,
		};
	}
}

async function buildProposalSimulationPdfBytes(
	draft: ProposalSimulationDraft,
	pageId: string,
): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const left = 42;
	const createPageWriter = () => {
		const page = pdf.addPage([595.28, 841.89]); // A4 portrait
		const maxWidth = page.getWidth() - left * 2;
		page.drawRectangle({
			x: 0,
			y: page.getHeight() - 88,
			width: page.getWidth(),
			height: 88,
			color: rgb(0.06, 0.18, 0.24),
		});
		let y = page.getHeight() - 36;
		const drawWrapped = (textLine: string, size = 11, strong = false) => {
			const wrapped = wrapTextForPdf(toPdfSafeText(textLine), strong ? bold : font, size, maxWidth);
			for (const line of wrapped) {
				page.drawText(line, {
					x: left,
					y,
					size,
					font: strong ? bold : font,
					color: rgb(0.11, 0.14, 0.18),
				});
				y -= size + 5;
				if (y < 45) return;
			}
		};
		const drawHeader = (title: string, subtitle: string) => {
			page.drawText(toPdfSafeText(title), {
				x: left,
				y,
				size: 17,
				font: bold,
				color: rgb(1, 1, 1),
			});
			y -= 22;
			page.drawText(toPdfSafeText(subtitle), {
				x: left,
				y,
				size: 9,
				font,
				color: rgb(0.84, 0.9, 0.88),
			});
			y = page.getHeight() - 114;
		};
		const drawSectionTitle = (title: string) => {
			y -= 4;
			page.drawText(toPdfSafeText(title).toUpperCase(), {
				x: left,
				y,
				size: 9,
				font: bold,
				color: rgb(0.05, 0.32, 0.38),
			});
			y -= 8;
			page.drawLine({
				start: { x: left, y },
				end: { x: page.getWidth() - left, y },
				thickness: 0.7,
				color: rgb(0.65, 0.78, 0.76),
			});
			y -= 14;
		};
		const drawMetricRows = (rows: Array<[string, string]>) => {
			const rowHeight = 28;
			for (const [label, value] of rows) {
				if (y < 80) return;
				page.drawRectangle({
					x: left,
					y: y - 8,
					width: maxWidth,
					height: rowHeight,
					color: rgb(0.94, 0.97, 0.96),
				});
				page.drawText(toPdfSafeText(label), {
					x: left + 12,
					y,
					size: 9,
					font,
					color: rgb(0.32, 0.39, 0.4),
				});
				page.drawText(toPdfSafeText(value), {
					x: left + 240,
					y,
					size: 10,
					font: bold,
					color: rgb(0.09, 0.14, 0.16),
				});
				y -= rowHeight + 4;
			}
		};
		const drawRule = () => {
			y -= 6;
			page.drawLine({
				start: { x: left, y },
				end: { x: page.getWidth() - left, y },
				thickness: 0.8,
				color: rgb(0.75, 0.78, 0.76),
			});
			y -= 14;
		};
		const drawSitePhotoFrame = async (
			title: string,
			sitePhotos: ProposalSitePhoto[],
			height = 232,
		) => {
			drawSectionTitle(title);
			const boxY = y - height;
			page.drawRectangle({
				x: left,
				y: boxY,
				width: maxWidth,
				height,
				borderColor: rgb(0.08, 0.12, 0.14),
				borderWidth: 1.2,
				color: rgb(0.98, 0.98, 0.96),
			});
			const gap = 14;
			const slotHeight = height - 28;
			const slotWidth = Math.min((maxWidth - gap - 24) / 2, slotHeight * 0.75);
			const totalSlotWidth = slotWidth * 2 + gap;
			const startX = left + (maxWidth - totalSlotWidth) / 2;
			const slotY = boxY + 14;
			for (let index = 0; index < 2; index += 1) {
				const slotX = startX + index * (slotWidth + gap);
				page.drawRectangle({
					x: slotX,
					y: slotY,
					width: slotWidth,
					height: slotHeight,
					borderColor: rgb(0.16, 0.21, 0.23),
					borderWidth: 1,
					color: rgb(1, 1, 1),
				});
				const sitePhoto = sitePhotos[index] ?? null;
				let drewImage = false;
				if (sitePhoto?.url) {
					const image = await embedPdfImageFromUrl(pdf, sitePhoto.url);
					if (image) {
						const padding = 5;
						const fit = fitRectWithinBox(
							image.width,
							image.height,
							slotWidth - padding * 2,
							slotHeight - padding * 2,
						);
						page.drawImage(image, {
							x: slotX + padding + fit.x,
							y: slotY + padding + fit.y,
							width: fit.width,
							height: fit.height,
						});
						drewImage = true;
					}
				}
				if (!drewImage) {
					page.drawText(`SITE PHOTO ${index + 1}`, {
						x: slotX + 14,
						y: slotY + slotHeight / 2 + 8,
						size: 11,
						font: bold,
						color: rgb(0.44, 0.48, 0.48),
					});
					page.drawText("Portrait 3:4", {
						x: slotX + 14,
						y: slotY + slotHeight / 2 - 10,
						size: 8,
						font,
						color: rgb(0.44, 0.48, 0.48),
					});
				}
				if (sitePhoto?.name) {
					page.drawText(toPdfSafeText(sitePhoto.name).slice(0, 26), {
						x: slotX,
						y: slotY - 9,
						size: 7,
						font,
						color: rgb(0.36, 0.4, 0.4),
					});
				}
			}
			y = boxY - 22;
		};
		return { drawWrapped, drawHeader, drawSectionTitle, drawMetricRows, drawRule, drawSitePhotoFrame };
	};

	const generatedDate = todayIsoDateInTokyo();
	const first = createPageWriter();
	first.drawHeader(
		"WAJO Proposal Sheet",
		`Page 1 / Executive Summary / ${proposalKindLabelForPdf(draft.proposalKind)} / ${generatedDate}`,
	);
	if (draft.proposalKind !== "gridBattery") {
		await first.drawSitePhotoFrame("Site Photos", draft.sitePhotos, 232);
	}
	first.drawSectionTitle("Core Message");
	for (const line of buildProposalPdfPageOneLines(draft)) {
		first.drawWrapped(line, 10);
	}
	const saleMetricLabel = draft.proposalKind === "gridBattery" ? "Project Cost" : "Sales Price";
	const purchaseMetricLabel = draft.proposalKind === "gridBattery" ? "Net Investment" : "Sourcing Price";
	first.drawSectionTitle("Simulation Metrics");
	first.drawMetricRows([
		[saleMetricLabel, formatYenForPdf(draft.salePrice)],
		[purchaseMetricLabel, formatYenForPdf(draft.purchaseCost)],
		["Annual Income", formatYenForPdf(draft.annualIncome)],
		["Annual Maintenance Cost", formatYenForPdf(draft.runningCost)],
		["Annual Net Cashflow", formatYenForPdf(draft.annualNetIncome)],
		["Gross Profit / Annual Net Profit", formatYenForPdf(draft.grossProfit)],
		["Expected Yield", formatPercentForPdf(draft.expectedYield, 2)],
		["Payback Years", formatDecimalForPdf(draft.paybackYears, 2)],
	]);
	first.drawRule();
	first.drawWrapped(`Record ID: ${pageId}`, 8);

	const second = createPageWriter();
	second.drawHeader(
		"WAJO Proposal Sheet",
		`Page 2 / Assumptions, Risks and Type Guide / ${proposalKindLabelForPdf(draft.proposalKind)}`,
	);
	second.drawSectionTitle("Assumptions / Risk Notes");
	for (const line of buildProposalPdfPageTwoLines(draft)) {
		second.drawWrapped(line, 10);
	}
	second.drawSectionTitle("Energy / ESG Impact");
	second.drawMetricRows([
		["Annual Cost Reduction Rate", formatPercentForPdf(draft.reductionRate, 1)],
		["Annual Cost Reduction Amount", formatYenForPdf(draft.annualReductionAmount)],
		["Annual CO2 Reduction", `${formatDecimalForPdf(draft.co2ReductionTons, 2)} tons`],
	]);
	second.drawSectionTitle("Proposal Type Guide");
	for (const line of buildProposalTypeGuidePdfLines(draft.proposalKind)) {
		second.drawWrapped(line, 8.5);
	}
	second.drawRule();
	second.drawWrapped(
		"Full Japanese sales copy is stored on the Notion record. This PDF is a safe two-page summary generated by WAJO Sales OS.",
		9,
	);

	return pdf.save();
}

async function buildResidentDocumentPdfBytes(
	draft: ResidentDocumentDraft,
	pageId: string,
): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const sections = [
		"Cover",
		"Project Overview",
		"Notification Method",
		"Facility Certification",
		"Operator Change",
		"Site Location",
		"Hazard Map",
		"Target Area",
		"Reflection Check",
		"Site Photos",
		"Question Period",
		"Contact / Responsibility",
		"Final Confirmation",
	];
	const summary = draft.summaryLines.length > 0 ? draft.summaryLines : ["No summary lines"];
	for (const [index, section] of sections.entries()) {
		const page = pdf.addPage([595.28, 841.89]);
		page.drawRectangle({
			x: 0,
			y: page.getHeight() - 86,
			width: page.getWidth(),
			height: 86,
			color: rgb(0.08, 0.16, 0.22),
		});
		page.drawText(toPdfSafeText(draft.documentTitle || "Resident Briefing Document"), {
			x: 42,
			y: page.getHeight() - 36,
			size: 16,
			font: bold,
			color: rgb(1, 1, 1),
		});
		page.drawText(`Page ${index + 1} / 13 / ${section}`, {
			x: 42,
			y: page.getHeight() - 58,
			size: 9,
			font,
			color: rgb(0.84, 0.9, 0.88),
		});
		page.drawText(toPdfSafeText(section), {
			x: 42,
			y: page.getHeight() - 126,
			size: 14,
			font: bold,
			color: rgb(0.08, 0.16, 0.22),
		});
		let y = page.getHeight() - 158;
		for (const line of summary) {
			page.drawText(toPdfSafeText(line).slice(0, 92), {
				x: 42,
				y,
				size: 10,
				font,
				color: rgb(0.12, 0.14, 0.16),
			});
			y -= 18;
			if (y < 72) break;
		}
		page.drawText(`Record ID: ${pageId}`, {
			x: 42,
			y: 42,
			size: 8,
			font,
			color: rgb(0.38, 0.42, 0.44),
		});
	}
	return pdf.save();
}

function buildProposalPdfPageOneLines(draft: ProposalSimulationDraft): string[] {
	if (draft.proposalKind === "gridBattery") {
		return [
			`Proposal focus: ${proposalKindLabelForPdf(draft.proposalKind)}`,
			`Project cost: ${formatYenForPdf(draft.salePrice)} / Net investment: ${formatYenForPdf(draft.purchaseCost)}`,
			`Annual revenue: ${formatYenForPdf(draft.annualIncome)} / Annual running cost: ${formatYenForPdf(draft.runningCost)}`,
			`Annual net profit: ${formatYenForPdf(draft.annualNetIncome)} / Expected yield: ${formatPercentForPdf(draft.expectedYield, 2)} / Payback: ${formatDecimalForPdf(draft.paybackYears, 2)} years`,
			"Positioning: Grid-scale battery storage revenue depends on market prices, awards, operation policy and grid conditions.",
		];
	}
	const details = draft.solarDetails;
	return nonEmptyLines([
		`Proposal focus: ${proposalKindLabelForPdf(draft.proposalKind)}`,
		details
			? `Asset: Solar power plant / ${pdfSafeValue(details.plantName, "See Notion record")} / ${englishVoltageClass(details.voltageClass)}`
			: "Asset: Solar power plant",
		`Sales price: ${formatYenForPdf(draft.salePrice)} / Sourcing price: ${formatYenForPdf(draft.purchaseCost)}`,
		`Annual revenue: ${formatYenForPdf(draft.annualIncome)} / Annual maintenance cost: ${formatYenForPdf(draft.runningCost)}`,
		`Annual net cashflow: ${formatYenForPdf(draft.annualNetIncome)} / Expected yield: ${formatPercentForPdf(draft.expectedYield, 2)} / Payback: ${formatDecimalForPdf(draft.paybackYears, 2)} years`,
		details
			? `Equipment summary: ${pdfSafeValue(details.panelMaker, "Panel maker")} ${pdfSafeValue(details.panelModel, "")} / ${formatDecimalForPdf(details.panelCount, 0)} panels / DC ${formatDecimalForPdf(details.dcCapacityKw, 1)} kW`
			: "",
	]);
}

function buildProposalPdfPageTwoLines(draft: ProposalSimulationDraft): string[] {
	if (draft.proposalKind === "gridBattery") {
		return [
			"Subsidy assumptions must be confirmed against the public offering guideline and grant decision.",
			"Market revenue changes with JEPX spreads, capacity market awards, balancing market awards, degradation cost and penalties.",
			"Required checks: grid connection, receiving point, PCS output, battery capacity, EMS or aggregator operation, insurance, O&M and land terms.",
		];
	}
	const details = draft.solarDetails;
	const maintenanceBreakdown =
		draft.runningCostBreakdown.length > 0
			? `Maintenance breakdown: ${draft.runningCostBreakdown
					.map((item) => `${pdfSafeValue(item.label, "Cost")} ${formatYenForPdf(item.value)}`)
					.join(" / ")}`
			: "";
	return nonEmptyLines([
		details
			? `Site: ${pdfSafeValue(details.location, "See Notion record")} / Power area: ${pdfSafeValue(details.powerArea, "See Notion record")} / Voltage: ${englishVoltageClass(details.voltageClass)}`
			: "",
		details
			? `Panels: ${pdfSafeValue(details.panelMaker, "Panel maker")} / ${pdfSafeValue(details.panelModel, "Panel model")} / ${formatDecimalForPdf(details.panelCount, 0)} panels / DC ${formatDecimalForPdf(details.dcCapacityKw, 1)} kW`
			: "",
		details
			? `PCS: ${pdfSafeValue(details.powerConditionerMaker, "PCS maker")} / ${pdfSafeValue(details.powerConditionerModel, "PCS model")} / ${formatDecimalForPdf(details.pcsCapacityKw, 1)} kW`
			: "",
		details
			? `Feed-in terms: ${pdfSafeValue(details.fitFipType, "FIT/FIP")} / ${formatDecimalForPdf(details.unitPrice, 2)} JPY per kWh / remaining ${formatDecimalForPdf(details.remainingSalesYears, 1)} years`
			: "",
		details
			? `Operation: grid connection ${pdfSafeValue(details.gridConnectionDate, "See Notion record")} / operating period ${formatOperationYearsForPdf(details.operationYears)}`
			: "",
		maintenanceBreakdown,
		"Risk notes: generation variance, curtailment, insurance deductible, equipment failure, financing terms and future disposal cost must be shown before submission.",
	]);
}

function buildProposalTypeGuidePdfLines(currentKind: ProposalKind): string[] {
	return [
		`Current proposal type: ${proposalKindLabelForPdf(currentKind)}`,
		"Individual Investor: private customer, retirement income, asset formation, inheritance and monthly cashflow.",
		"Corporate Owner: tax planning, depreciation, tax credit review, financing and internal approval.",
		"ESG / Decarbonization Company: CO2 reduction, supply-chain explanation, bank dialogue and corporate value.",
		"Grid-Scale Battery Storage: BESS, grid connection, JEPX, capacity market, balancing market and land screening.",
	];
}

async function embedPdfImageFromUrl(
	pdf: PDFDocument,
	url: string,
): Promise<PDFImage | null> {
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		const bytes = new Uint8Array(await response.arrayBuffer());
		if (isPngBytes(bytes)) return await pdf.embedPng(bytes);
		if (isJpegBytes(bytes)) return await pdf.embedJpg(bytes);
		return null;
	} catch {
		return null;
	}
}

function isPngBytes(bytes: Uint8Array): boolean {
	return (
		bytes.length > 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47
	);
}

function isJpegBytes(bytes: Uint8Array): boolean {
	return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function fitRectWithinBox(
	sourceWidth: number,
	sourceHeight: number,
	boxWidth: number,
	boxHeight: number,
): { x: number; y: number; width: number; height: number } {
	const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
	const width = sourceWidth * scale;
	const height = sourceHeight * scale;
	return {
		x: (boxWidth - width) / 2,
		y: (boxHeight - height) / 2,
		width,
		height,
	};
}

function formatOperationYearsForPdf(value: string): string {
	const match = value.match(/(\d+)年(?:(\d+)か月)?/);
	if (!match) return pdfSafeValue(value, "Calculated from Notion date");
	const years = Number(match[1]);
	const months = match[2] ? Number(match[2]) : 0;
	return months > 0 ? `${years} years ${months} months` : `${years} years`;
}

function proposalKindLabelForPdf(kind: ProposalKind): string {
	if (kind === "individual") return "Individual Investor";
	if (kind === "esg") return "ESG / Decarbonization Company";
	if (kind === "gridBattery") return "Grid-Scale Battery Storage";
	return "Corporate Owner";
}

function toPdfSafeText(value: string): string {
	const replacements: Array<[RegExp, string]> = [
		[/御社への結論/g, "Conclusion"],
		[/本案件/g, "This project"],
		[/提案/g, "proposal"],
		[/補助金/g, "subsidy"],
		[/市場収益/g, "market revenue"],
		[/系統用蓄電池/g, "grid-scale battery storage"],
		[/太陽光発電/g, "solar power"],
		[/販売価格/g, "Sales Price"],
		[/仕入れ価格/g, "Sourcing Price"],
		[/年間売電収入/g, "Annual Revenue"],
		[/年間維持費（ランニングコスト）/g, "Annual Maintenance Cost"],
		[/年間維持費/g, "Annual Maintenance Cost"],
		[/年間ランニングコスト/g, "Annual Running Cost"],
		[/年間手残り/g, "Annual Net Cashflow"],
		[/発電所名/g, "Plant Name"],
		[/所在地/g, "Location"],
		[/電力会社エリア/g, "Power Area"],
		[/低圧\/高圧区分/g, "Voltage Class"],
		[/パネルメーカー/g, "Panel Maker"],
		[/パネル型式/g, "Panel Model"],
		[/パネル枚数/g, "Panel Count"],
		[/パワコンメーカー/g, "PCS Maker"],
		[/パワコン型式/g, "PCS Model"],
		[/連系開始日/g, "Grid Connection Date"],
		[/稼働年数/g, "Operation Years"],
		[/売電単価/g, "Feed-in Unit Price"],
		[/残存売電期間/g, "Remaining Sales Years"],
		[/年間想定純利益/g, "annual net profit"],
		[/想定実質利回り/g, "expected net yield"],
		[/回収年数/g, "payback years"],
	];
	let safe = value;
	for (const [pattern, replacement] of replacements) {
		safe = safe.replace(pattern, replacement);
	}
	return safe.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}

function findFirstFilesPropertyNameByAliases(
	properties: Record<string, unknown>,
	aliases: string[],
): string | null {
	for (const alias of aliases) {
		const property = properties[alias];
		if (!property || typeof property !== "object") continue;
		if ((property as Record<string, unknown>).type === "files") return alias;
	}
	return null;
}

function readFirstFileUrlByAliases(
	properties: Record<string, unknown>,
	aliases: string[],
): string | null {
	for (const alias of aliases) {
		const property = properties[alias];
		if (!property || typeof property !== "object") continue;
		const prop = property as Record<string, unknown>;
		if (prop.type !== "files" || !Array.isArray(prop.files) || prop.files.length === 0) continue;
		const first = prop.files[0];
		if (!first || typeof first !== "object") continue;
		const fileObj = first as Record<string, unknown>;
		if (fileObj.type === "file" && fileObj.file && typeof fileObj.file === "object") {
			const file = fileObj.file as Record<string, unknown>;
			if (typeof file.url === "string" && file.url) return file.url;
		}
		if (fileObj.type === "external" && fileObj.external && typeof fileObj.external === "object") {
			const external = fileObj.external as Record<string, unknown>;
			if (typeof external.url === "string" && external.url) return external.url;
		}
	}
	return null;
}

function readImageFilesByAliases(
	properties: Record<string, unknown>,
	aliases: string[],
	limit = 2,
): ProposalSitePhoto[] {
	const images: ProposalSitePhoto[] = [];
	const seenFiles = new Set<string>();
	for (const alias of aliases) {
		const property = properties[alias];
		if (!property || typeof property !== "object") continue;
		const prop = property as Record<string, unknown>;
		if (prop.type !== "files" || !Array.isArray(prop.files) || prop.files.length === 0) continue;
		for (const item of prop.files) {
			const image = readFileUrlFromNotionFile(item);
			if (!image) continue;
			const imageKey = `${image.name}\n${image.url}`;
			if (seenFiles.has(imageKey)) continue;
			images.push(image);
			seenFiles.add(imageKey);
			if (images.length >= limit) return images;
		}
	}
	return images;
}

function filesPropertyValueFromImages(
	images: ProposalSitePhoto[],
): Record<string, unknown> | null {
	if (images.length === 0) return null;
	return {
		files: images.map((image) => ({
			name: image.name,
			type: "external",
			external: { url: image.url },
		})),
	};
}

function filesPropertyValueFromAliases(
	properties: Record<string, unknown>,
	aliases: string[],
	limit = 2,
): Record<string, unknown> | null {
	return filesPropertyValueFromImages(readImageFilesByAliases(properties, aliases, limit));
}

function datePropertyValueFromAliases(
	properties: Record<string, unknown>,
	aliases: string[],
): Record<string, unknown> | null {
	for (const alias of aliases) {
		const property = properties[alias];
		if (!property || typeof property !== "object") continue;
		const prop = property as Record<string, unknown>;
		if (prop.type === "date" && prop.date && typeof prop.date === "object") {
			const date = prop.date as Record<string, unknown>;
			const start = typeof date.start === "string" ? date.start : "";
			const end = typeof date.end === "string" ? date.end : "";
			if (start) return { date: { start, end: end || null } };
		}
		const label = dateLabelFromProperty(property);
		const start = label.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
		if (start) return { date: { start, end: null } };
	}
	return null;
}

function setTextPrefill(
	prefill: Record<string, Record<string, unknown>>,
	targetName: string,
	properties: Record<string, unknown>,
	aliases: string[],
): void {
	const value = readFirstTextByAliases(properties, aliases);
	if (value) prefill[targetName] = richText(value);
}

function setSelectPrefill(
	prefill: Record<string, Record<string, unknown>>,
	targetName: string,
	properties: Record<string, unknown>,
	aliases: string[],
): void {
	const value = readFirstTextByAliases(properties, aliases);
	if (value) prefill[targetName] = select(value);
}

function setDatePrefill(
	prefill: Record<string, Record<string, unknown>>,
	targetName: string,
	properties: Record<string, unknown>,
	aliases: string[],
): void {
	const value = datePropertyValueFromAliases(properties, aliases);
	if (value) prefill[targetName] = value;
}

function setFilesPrefill(
	prefill: Record<string, Record<string, unknown>>,
	targetName: string,
	properties: Record<string, unknown>,
	aliases: string[],
): void {
	const value = filesPropertyValueFromAliases(properties, aliases);
	if (value) prefill[targetName] = value;
}

function readFileUrlFromNotionFile(item: unknown): ProposalSitePhoto | null {
	if (!item || typeof item !== "object") return null;
	const fileObj = item as Record<string, unknown>;
	const name = typeof fileObj.name === "string" ? fileObj.name : "site-photo";
	if (fileObj.type === "file" && fileObj.file && typeof fileObj.file === "object") {
		const file = fileObj.file as Record<string, unknown>;
		const url = typeof file.url === "string" ? file.url : "";
		return url ? { url, name } : null;
	}
	if (fileObj.type === "external" && fileObj.external && typeof fileObj.external === "object") {
		const external = fileObj.external as Record<string, unknown>;
		const url = typeof external.url === "string" ? external.url : "";
		return url ? { url, name } : null;
	}
	return null;
}

function sanitizeFileName(value: string): string {
	const normalized = value
		.replace(/[\\/:*?"<>|]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return normalized.length > 0 ? normalized.slice(0, 80) : "proposal-simulation";
}

function wrapTextForPdf(
	textLine: string,
	font: { widthOfTextAtSize: (text: string, size: number) => number },
	size: number,
	maxWidth: number,
): string[] {
	if (!textLine) return [""];
	const words = textLine.split(" ");
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
			current = candidate;
			continue;
		}
		if (current) lines.push(current);
		current = word;
	}
	if (current) lines.push(current);
	return lines.length > 0 ? lines : [textLine];
}

function formatYenForPdf(value: number | null): string {
	if (value === null || !Number.isFinite(value)) return "N/A";
	return `${Math.round(value).toLocaleString("en-US")} JPY`;
}

function formatPercentForPdf(value: number | null, digits: number): string {
	if (value === null || !Number.isFinite(value)) return "N/A";
	return `${value.toFixed(digits).replace(/\.?0+$/, "")}%`;
}

function formatDecimalForPdf(value: number | null, digits: number): string {
	if (value === null || !Number.isFinite(value)) return "N/A";
	return value.toFixed(digits).replace(/\.?0+$/, "");
}

function pdfSafeValue(value: string, fallback: string): string {
	const safe = toPdfSafeText(value);
	return safe.length > 0 ? safe : fallback;
}

function englishVoltageClass(value: string): string {
	if (/特高/.test(value)) return "Extra high voltage";
	if (/高圧/.test(value)) return "High voltage";
	if (/低圧/.test(value)) return "Low voltage";
	return pdfSafeValue(value, "Voltage class");
}

function todayIsoDateInTokyo(date = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

function evaluateResidentDocumentDraft(page: Page): ResidentDocumentDraft {
	const properties = page.properties ?? {};
	const caseNumber = readFirstTextByAliases(properties, [
		"案件番号",
		"発電所問合せ番号",
		"案件ID",
	]);
	const plantName = readFirstTextByAliases(properties, ["発電所名", "物件名", "案件名"]);
	const plantAddress = readFirstTextByAliases(properties, ["発電所住所", "所在地", "住所"]);
	const notifyMethod = readFirstTextByAliases(properties, ["周知方法", "説明会方式", "周知区分"]);
	const questionPeriod = readFirstDateLabelByAliases(properties, [
		"質問受付期間",
		"質問受付期限",
	]);
	const briefingDate = readFirstDateLabelByAliases(properties, ["周知日", "説明会日", "開催日"]);
	const managerName = readFirstTextByAliases(properties, [
		"保守管理責任者 氏名",
		"保守管理責任者",
		"責任者氏名",
	]);
	const oldOperator = readFirstTextByAliases(properties, [
		"旧認定事業者",
		"旧事業者",
		"旧所有者",
	]);
	const newOperator = readFirstTextByAliases(properties, [
		"新認定事業者",
		"新事業者",
		"新所有者",
	]);
	const facilityId = readFirstTextByAliases(properties, ["設備ID", "認定設備ID"]);
	const certifiedOutputKw = readFirstNumberByAliases(properties, [
		"認定出力kW",
		"認定出力",
		"設備認定出力",
		"設備容量kW",
	]);
	const plantLocationImages = readImageFilesByAliases(properties, [
		"発電所所在地画像",
		"地図画像",
		"所在地画像",
		"位置図",
	]);
	const hazardMapImages = readImageFilesByAliases(properties, ["ハザードマップ"]);
	const targetAreaImages = readImageFilesByAliases(properties, [
		"説明会対象エリア画像",
		"対象エリア画像",
		"周辺住民範囲画像",
	]);
	const reflectionImages = readImageFilesByAliases(properties, [
		"反射光画像",
		"反射光画像（夏至）",
		"反射光画像（冬至）",
		"反射光シミュレーション画像",
	]);
	const siteImages = readImageFilesByAliases(properties, [
		"現場写真",
		"発電所写真",
		"現地写真",
		"外観写真",
		"設備写真",
		"写真",
	]);

	const checks: RequiredFieldCheck[] = [
		{ label: "案件番号", value: caseNumber },
		{ label: "発電所名", value: plantName },
		{ label: "発電所住所", value: plantAddress },
		{ label: "周知方法", value: notifyMethod },
		{ label: "質問受付期間", value: questionPeriod },
		{ label: "周知日", value: briefingDate },
		{ label: "保守管理責任者", value: managerName },
		{ label: "旧認定事業者", value: oldOperator },
		{ label: "新認定事業者", value: newOperator },
		{ label: "設備ID", value: facilityId },
		{ label: "認定出力", value: certifiedOutputKw },
		{ label: "発電所所在地画像", value: plantLocationImages.length > 0 ? "あり" : "" },
		{ label: "ハザードマップ", value: hazardMapImages.length > 0 ? "あり" : "" },
		{ label: "説明会対象エリア画像", value: targetAreaImages.length > 0 ? "あり" : "" },
		{ label: "反射光画像", value: reflectionImages.length > 0 ? "あり" : "" },
		{ label: "現場写真", value: siteImages.length > 0 ? "あり" : "" },
	];
	const missingIndex = checks.findIndex((check) => !hasFieldValue(check.value));
	if (missingIndex >= 0) {
		return {
			missingField: checks[missingIndex]!.label,
			nextRequiredFields: checks
				.slice(missingIndex + 1)
				.map((check) => check.label),
			documentTitle: "",
			summaryLines: [],
		};
	}

	const titleBase = caseNumber || plantName || readGenericPageTitle(page) || "住民説明会資料";
	return {
		missingField: null,
		nextRequiredFields: [],
		documentTitle: `${titleBase}｜住民説明会資料`,
		summaryLines: [
			`案件番号: ${caseNumber}`,
			`発電所名: ${plantName}`,
			`認定出力: ${formatNumberWithUnit(certifiedOutputKw, "kW")}`,
			`周知方法: ${notifyMethod}`,
			`質問受付期間: ${questionPeriod}`,
			`周知日: ${briefingDate}`,
		],
	};
}

const SOLAR_RUNNING_COST_TOTAL_ALIASES = [
	"年間維持費（ランニングコスト）",
	"年間ランニングコスト（合計）",
	"年間ランニングコスト",
	"ランニングコスト（年）",
	"年間維持費",
	"年間運用費",
];

const RUNNING_COST_BREAKDOWN_ALIASES: Array<[string, string[]]> = [
	["O&M費", ["O&M費", "年間O&M費", "O&M費（年）"]],
	["保険料", ["保険料", "年間保険料"]],
	["地代", ["地代", "年間地代", "土地賃料"]],
	["固定資産税", ["固定資産税", "年間固定資産税"]],
	["除草費", ["除草費", "年間除草費", "草刈費"]],
	["監視通信費", ["監視通信費", "通信費", "監視費"]],
	["管理費", ["管理費", "年間管理費"]],
];

function evaluateProposalSimulationDraft(page: Page): ProposalSimulationDraft {
	const properties = page.properties ?? {};
	const titleLabel = readFirstTextByAliases(properties, [
		"案件名",
		"提案名",
		"案件タイトル",
		"発電所名",
		"タイトル",
		"名称",
	]);
	const proposalKind = inferProposalKind(
		readFirstTextByAliases(properties, [
			"提案タイプ",
			"提案相手タイプ",
			"提案書タイプ",
			"資料タイプ",
			"対象者",
			"顧客タイプ",
			"AI案件種別",
		]),
		titleLabel,
	);
	const proposalTitle = buildProposalTitle(proposalKind, titleLabel);
	const typeGuideLines = buildProposalTypeGuideLines(proposalKind);
	const isGridBattery = proposalKind === "gridBattery";
	const salePrice = readFirstNumberByAliases(
		properties,
		isGridBattery
			? [
					"総事業費",
					"物件総額",
					"投資額",
					"販売価格",
					"提案価格",
					"売価",
					"契約金額（税込）",
			  ]
			: [
					"販売価格",
					"提案価格",
					"売価",
					"物件総額",
					"投資額",
					"契約金額（税込）",
					"総事業費",
			  ],
	);
	let purchaseCost = readFirstNumberByAliases(
		properties,
		isGridBattery
			? [
					"実質投資額",
					"補助金控除後投資額",
					"自己投資額",
					"仕入れ価格",
					"仕入価格",
					"仕入れ総額",
					"仕入総額",
					"買取価格",
					"買取総額",
					"原価",
					"取得費合計",
			  ]
			: [
					"仕入れ価格",
					"仕入価格",
					"仕入れ総額",
					"仕入総額",
					"買取価格",
					"買取総額",
					"原価",
					"取得費合計",
					"実質投資額",
					"自己投資額",
			  ],
	);
	const subsidyAmount = readFirstNumberByAliases(properties, [
		"補助金想定額",
		"補助金額",
		"導入補助金",
		"補助金",
	]);
	if (isGridBattery && purchaseCost === null && salePrice !== null && subsidyAmount !== null) {
		purchaseCost = Math.max(0, salePrice - subsidyAmount);
	}
	const monthlyGeneration = readFirstNumberByAliases(properties, [
		"月間発電量",
		"想定月間発電量",
	]);
	const unitPrice = readFirstNumberByAliases(properties, [
		"売電単価",
		"kWh単価",
		"FIT単価",
		"FIP単価",
	]);
	let annualIncome = readFirstNumberByAliases(properties, [
		"年間想定総売上",
		"年間想定収益",
		"年間収益",
		"年間売上",
		"想定年間売電収入",
		"年間売電収入",
		"年間収入",
		"売電収入（年）",
	]);
	if (annualIncome === null && monthlyGeneration !== null && unitPrice !== null) {
		annualIncome = roundTo(monthlyGeneration * unitPrice * 12, 0);
	}
	const runningCostInput = readRunningCostInput(properties);
	const runningCost = runningCostInput.total ?? 0;
	const solarDetails = isGridBattery
		? null
		: buildSolarProposalDetails(properties, unitPrice);
	const sitePhotos = readImageFilesByAliases(properties, [
		"現場写真",
		"発電所写真",
		"現地写真",
		"外観写真",
		"設備写真",
		"写真",
	]);
	const annualElectricCost = readFirstNumberByAliases(properties, [
		"現在年間電気代",
		"現状年間電気代",
		"年間電気代",
		"年間電力コスト",
	]);
	const annualReductionAmountRaw = readFirstNumberByAliases(properties, [
		"年間電気代削減額",
		"想定年間削減額",
		"年間削減額",
	]);
	const co2ReductionTons = readFirstNumberByAliases(properties, [
		"年間CO2削減量",
		"CO2削減量（年）",
		"年間CO2排出削減量",
	]);
	const reductionRateFromProperty = readFirstNumberByAliases(properties, [
		"年間電気代削減率",
		"削減率",
	]);

	const checks: RequiredFieldCheck[] = isGridBattery
		? [
				{ label: "総事業費", value: salePrice },
				{ label: "実質投資額（または補助金想定額）", value: purchaseCost },
				{ label: "年間想定総売上", value: annualIncome },
		  ]
		: [
				{ label: "販売価格", value: salePrice },
				{ label: "仕入れ価格", value: purchaseCost },
				{ label: "年間売電収入（または月間発電量・売電単価）", value: annualIncome },
				{ label: "年間維持費（ランニングコスト）", value: runningCostInput.total },
				{ label: "発電所名", value: solarDetails?.plantName ?? "" },
				{ label: "所在地", value: solarDetails?.location ?? "" },
				{ label: "電力会社エリア", value: solarDetails?.powerArea ?? "" },
				{ label: "低圧/高圧区分", value: solarDetails?.voltageClass ?? "" },
				{ label: "パネルメーカー", value: solarDetails?.panelMaker ?? "" },
				{ label: "パネル型式", value: solarDetails?.panelModel ?? "" },
				{ label: "パネル枚数", value: solarDetails?.panelCount ?? null },
				{ label: "DC容量（パネル側kW）", value: solarDetails?.dcCapacityKw ?? null },
				{ label: "パワコンメーカー", value: solarDetails?.powerConditionerMaker ?? "" },
				{ label: "パワコン型式", value: solarDetails?.powerConditionerModel ?? "" },
				{ label: "PCS容量（パワコン側kW）", value: solarDetails?.pcsCapacityKw ?? null },
				{ label: "FIT/FIP区分", value: solarDetails?.fitFipType ?? "" },
				{ label: "売電単価", value: solarDetails?.unitPrice ?? null },
				{ label: "残存売電期間", value: solarDetails?.remainingSalesYears ?? null },
				{ label: "連系開始日", value: solarDetails?.gridConnectionDate ?? "" },
				{ label: "現場写真", value: sitePhotos.length > 0 ? "あり" : "" },
		  ];
	const missingIndex = checks.findIndex((check) => !hasFieldValue(check.value));
	if (missingIndex >= 0) {
		return {
			missingField: checks[missingIndex]!.label,
			nextRequiredFields: checks
				.slice(missingIndex + 1)
				.map((check) => check.label),
			proposalKind,
			proposalTitle,
			titleLabel,
			typeGuideLines,
			salePrice,
			purchaseCost,
			annualIncome,
			runningCost,
			annualNetIncome: null,
			solarDetails,
			sitePhotos,
			runningCostBreakdown: runningCostInput.breakdown,
			annualReductionAmount: null,
			reductionRate: null,
			co2ReductionTons,
			grossProfit: null,
			expectedYield: null,
			paybackYears: null,
			conclusionText: buildPlaceholderConclusionText(proposalKind),
			summaryLines: [],
			pageOneLines: [],
			pageTwoLines: [],
		};
	}

	const grossProfit =
		isGridBattery
			? roundTo((annualIncome as number) - runningCost, 0)
			: roundTo((salePrice as number) - (purchaseCost as number), 0);
	const annualNetIncome = roundTo((annualIncome as number) - runningCost, 0);
	const investmentBase = isGridBattery ? (purchaseCost as number) : (salePrice as number);
	const expectedYield =
		investmentBase > 0 && annualNetIncome > 0
			? roundTo((annualNetIncome / investmentBase) * 100, 2)
			: null;
	const paybackYears =
		annualNetIncome > 0 ? roundTo(investmentBase / annualNetIncome, 2) : null;
	const annualReductionAmount = annualReductionAmountRaw ?? annualNetIncome;
	const reductionRate = annualElectricCost && annualReductionAmount
		? roundTo((annualReductionAmount / annualElectricCost) * 100, 1)
		: (reductionRateFromProperty ?? expectedYield);
	const conclusionText = buildProposalConclusionText({
		proposalKind,
		reductionRate,
		annualReductionAmount,
		co2ReductionTons,
	});
	const summaryLines = buildProposalSummaryLines({
		proposalKind,
		salePrice: salePrice as number,
		purchaseCost: purchaseCost as number,
		annualIncome: annualIncome as number,
		runningCost,
		annualNetIncome,
		grossProfit,
		expectedYield,
		paybackYears,
		subsidyAmount,
	});
	const pageLines = buildTwoPageProposalLines({
		proposalKind,
		proposalTitle,
		titleLabel,
		salePrice: salePrice as number,
		purchaseCost: purchaseCost as number,
		annualIncome: annualIncome as number,
		runningCost,
		annualNetIncome,
		grossProfit,
		expectedYield,
		paybackYears,
		annualReductionAmount,
		reductionRate,
		co2ReductionTons,
		subsidyAmount,
		solarDetails,
		runningCostBreakdown: runningCostInput.breakdown,
	});

	return {
		missingField: null,
		nextRequiredFields: [],
		proposalKind,
		proposalTitle,
		titleLabel,
		typeGuideLines,
		salePrice,
		purchaseCost,
		annualIncome,
		runningCost,
		annualNetIncome,
		solarDetails,
		sitePhotos,
		runningCostBreakdown: runningCostInput.breakdown,
		annualReductionAmount,
		reductionRate,
		co2ReductionTons,
		grossProfit,
		expectedYield,
		paybackYears,
		conclusionText,
		summaryLines,
		pageOneLines: pageLines.pageOneLines,
		pageTwoLines: pageLines.pageTwoLines,
	};
}

function readRunningCostInput(properties: Record<string, unknown>): {
	total: number | null;
	breakdown: RunningCostBreakdownItem[];
} {
	const total = readFirstNumberByAliases(properties, SOLAR_RUNNING_COST_TOTAL_ALIASES);
	const breakdown = RUNNING_COST_BREAKDOWN_ALIASES.flatMap(([label, aliases]) => {
		const value = readFirstNumberByAliases(properties, aliases);
		return value !== null ? [{ label, value }] : [];
	});
	if (total !== null) {
		return { total, breakdown };
	}
	if (breakdown.length === 0) {
		return { total: null, breakdown };
	}
	return {
		total: roundTo(
			breakdown.reduce((sum, item) => sum + item.value, 0),
			0,
		),
		breakdown,
	};
}

function buildSolarProposalDetails(
	properties: Record<string, unknown>,
	unitPrice: number | null,
): SolarProposalDetails {
	const gridConnectionDate = readFirstDateLabelByAliases(properties, [
		"連系開始日",
		"発電開始日",
		"売電開始日",
		"稼働開始日",
	]);
	return {
		plantName: readFirstTextByAliases(properties, ["発電所名", "物件名", "案件名"]),
		location: readFirstTextByAliases(properties, ["所在地", "発電所住所", "住所"]),
		powerArea: readFirstTextByAliases(properties, [
			"電力会社エリア",
			"電力エリア",
			"管轄電力会社",
		]),
		voltageClass: readFirstTextByAliases(properties, [
			"低圧/高圧区分",
			"電圧区分",
			"低圧高圧区分",
			"高圧低圧",
		]),
		panelMaker: readFirstTextByAliases(properties, [
			"パネルメーカー",
			"太陽光パネルメーカー",
			"モジュールメーカー",
		]),
		panelModel: readFirstTextByAliases(properties, [
			"パネル型式",
			"太陽光パネル型式",
			"モジュール型式",
		]),
		panelCount: readFirstNumberByAliases(properties, ["パネル枚数", "モジュール枚数"]),
		dcCapacityKw: readFirstNumberByAliases(properties, [
			"DC容量（パネル側kW）",
			"DC容量",
			"パネル容量kW",
			"パネル容量",
			"設備容量（DC）",
		]),
		powerConditionerMaker: readFirstTextByAliases(properties, [
			"パワコンメーカー",
			"PCSメーカー",
			"パワーコンディショナメーカー",
		]),
		powerConditionerModel: readFirstTextByAliases(properties, [
			"パワコン型式",
			"PCS型式",
			"パワーコンディショナ型式",
		]),
		pcsCapacityKw: readFirstNumberByAliases(properties, [
			"PCS容量（パワコン側kW）",
			"PCS容量",
			"パワコン容量",
			"AC容量（PCS側kW）",
		]),
		fitFipType: readFirstTextByAliases(properties, [
			"FIT/FIP区分",
			"売電区分",
			"FIT区分",
		]),
		unitPrice,
		remainingSalesYears: readFirstNumberByAliases(properties, [
			"残存売電期間",
			"残り売電期間",
			"残存FIT期間",
		]),
		gridConnectionDate,
		operationYears: calculateOperationYearsLabel(gridConnectionDate),
	};
}

function calculateOperationYearsLabel(dateLabel: string, now = new Date()): string {
	const match = dateLabel.match(/\d{4}-\d{2}-\d{2}/);
	if (!match) return "";
	const start = new Date(`${match[0]}T00:00:00+09:00`);
	if (Number.isNaN(start.getTime())) return "";
	let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
	if (now.getDate() < start.getDate()) months -= 1;
	if (months < 0) return "0年未満";
	const years = Math.floor(months / 12);
	const remainderMonths = months % 12;
	return remainderMonths > 0 ? `${years}年${remainderMonths}か月` : `${years}年`;
}

function inferProposalKind(rawValue: string, titleLabel: string): ProposalKind {
	const value = `${rawValue} ${titleLabel}`;
	if (/蓄電池|系統|BESS|電力貯蔵/i.test(value)) return "gridBattery";
	if (/個人|投資家|私的年金|資産形成/.test(value)) return "individual";
	if (/環境|ESG|脱炭素|SDGs|実業|非化石/.test(value)) return "esg";
	return "corporate";
}

function buildProposalTitle(proposalKind: ProposalKind, titleLabel: string): string {
	const suffix = titleLabel ? `｜${titleLabel}` : "";
	if (proposalKind === "individual") {
		return `【個人投資家向け】私的年金型 太陽光発電投資 御提案書${suffix}`;
	}
	if (proposalKind === "esg") {
		return `【企業価値向上】ESG・脱炭素経営実現型 太陽光発電投資 御提案書${suffix}`;
	}
	if (proposalKind === "gridBattery") {
		return `【次世代エネルギー投資】系統用蓄電池 事業シミュレーション 御提案書${suffix}`;
	}
	return `【法人オーナー向け】黒字対策・即時償却検討型 太陽光発電投資 御提案書${suffix}`;
}

function buildProposalTypeGuideLines(currentKind: ProposalKind): string[] {
	return [
		`現在の提案タイプ: ${proposalKindJapaneseLabel(currentKind)}`,
		"個人投資家向けを選ぶ条件: 個人のお客様、私的年金、資産形成、相続、毎月の手残りを重視する提案。",
		"法人対象を選ぶ条件: 法人オーナー、黒字対策、即時償却、税額控除、融資、社内決裁を重視する提案。",
		"環境配慮型企業向けを選ぶ条件: ESG、脱炭素、CO2削減、取引先説明、金融機関への企業価値訴求を重視する提案。",
		"系統用蓄電池を選ぶ条件: BESS、蓄電池、系統接続、JEPX、容量市場、需給調整市場、土地評価から蓄電池候補になった案件。",
		"迷った場合: 提案タイプを先に選ぶ。未選択時はタイトルや案件種別から推測するが、営業提出前は人間が選び直す。",
	];
}

function proposalKindJapaneseLabel(kind: ProposalKind): string {
	if (kind === "individual") return "個人投資家向け";
	if (kind === "esg") return "環境配慮型企業向け";
	if (kind === "gridBattery") return "系統用蓄電池";
	return "法人対象";
}

function buildProposalSummaryLines(input: {
	proposalKind: ProposalKind;
	salePrice: number;
	purchaseCost: number;
	annualIncome: number;
	runningCost: number;
	annualNetIncome: number;
	grossProfit: number;
	expectedYield: number | null;
	paybackYears: number | null;
	subsidyAmount: number | null;
}): string[] {
	const yieldText = input.expectedYield !== null ? `${input.expectedYield}%` : "算出不可";
	const paybackText = input.paybackYears !== null ? `${input.paybackYears}年` : "算出不可";
	if (input.proposalKind === "gridBattery") {
		return [
			`総事業費: ${formatYen(input.salePrice)}`,
			`補助金想定額: ${input.subsidyAmount !== null ? formatYen(input.subsidyAmount) : "未入力"}`,
		`実質投資額: ${formatYen(input.purchaseCost)}`,
		`年間想定総売上: ${formatYen(input.annualIncome)}`,
		`年間ランニングコスト: ${formatYen(input.runningCost)}`,
		`年間想定純利益: ${formatYen(input.annualNetIncome)}`,
		`想定実質利回り: ${yieldText}`,
		`想定回収年数: ${paybackText}`,
	];
	}
	return [
	`販売価格: ${formatYen(input.salePrice)}`,
	`仕入れ価格: ${formatYen(input.purchaseCost)}`,
	`年間売電収入: ${formatYen(input.annualIncome)}`,
	`年間維持費（ランニングコスト）: ${formatYen(input.runningCost)}`,
	`年間手残り: ${formatYen(input.annualNetIncome)}`,
	`想定粗利: ${formatYen(input.grossProfit)}`,
	`想定利回り: ${yieldText}`,
	`想定回収年数: ${paybackText}`,
	];
}

function buildTwoPageProposalLines(input: {
	proposalKind: ProposalKind;
	proposalTitle: string;
	titleLabel: string;
	salePrice: number;
	purchaseCost: number;
	annualIncome: number;
	runningCost: number;
	annualNetIncome: number;
	grossProfit: number;
	expectedYield: number | null;
	paybackYears: number | null;
	annualReductionAmount: number | null;
	reductionRate: number | null;
	co2ReductionTons: number | null;
	subsidyAmount: number | null;
	solarDetails: SolarProposalDetails | null;
	runningCostBreakdown: RunningCostBreakdownItem[];
}): { pageOneLines: string[]; pageTwoLines: string[] } {
	const yieldText = input.expectedYield !== null ? `${input.expectedYield}%` : "算出不可";
	const paybackText = input.paybackYears !== null ? `${input.paybackYears}年` : "算出不可";
	if (input.proposalKind === "gridBattery") {
		return {
			pageOneLines: [
				"1枚目｜提案の結論",
				input.proposalTitle,
				"御社への結論: 本案件は、土地・系統条件が整う場合に、JEPXの価格差、容量市場、需給調整市場など複数の収益源を検討できる系統用蓄電池候補です。",
				"なぜ今か: 再エネ導入拡大により、余剰電力の有効活用と電力需給の調整力が重要になっています。",
				`案件概要: 総事業費 ${formatYen(input.salePrice)} / 実質投資額 ${formatYen(input.purchaseCost)} / 年間想定総売上 ${formatYen(input.annualIncome)}`,
				`収益目安: 年間想定純利益 ${formatYen(input.annualNetIncome)} / 想定実質利回り ${yieldText} / 回収年数 ${paybackText}`,
			],
			pageTwoLines: [
				"2枚目｜前提・未確認事項",
				"補助金は採択・交付決定が前提です。補助率や対象経費は公募要領、交付決定、GX関連要件を確認してから確定します。",
				"市場収益は、JEPX価格差、容量市場、需給調整市場の約定、運用者、劣化コスト、ペナルティ条件により変動します。",
				"必須確認: 系統連系可否 / 接続検討状況 / 受電地点 / PCS出力 / 蓄電容量 / アグリゲーターまたはEMS運用体制 / 保険 / O&M / 地代または土地取得条件。",
				"次アクション: 土地情報DBの所在地・面積・電力会社エリア・変電所距離・接道・用途地域を確認し、蓄電池候補として案件化できるか人間が最終判断します。",
			],
		};
	}
	const siteLine = buildSolarSiteLine(input.solarDetails);
	const equipmentLines = buildSolarEquipmentLines(input.solarDetails);
	const revenueLine = buildSolarRevenueLine(input.solarDetails);
	const maintenanceLine = buildMaintenanceBreakdownLine(input.runningCostBreakdown);
	const mainMetricsLine =
		`主要数字: 販売価格 ${formatYen(input.salePrice)} / 年間売電収入 ${formatYen(input.annualIncome)} / ` +
		`年間維持費（ランニングコスト） ${formatYen(input.runningCost)} / 年間手残り ${formatYen(input.annualNetIncome)} / 想定利回り ${yieldText}`;
	if (input.proposalKind === "individual") {
		return {
			pageOneLines: nonEmptyLines([
				"1枚目｜提案の結論",
				input.proposalTitle,
				siteLine,
				"お客様への結論: 本案件は、株式や不動産とは異なる収入源を持つ、私的年金づくり向けの太陽光発電投資候補です。",
				"選ばれる理由: 不動産のような入居者退去リスクがなく、管理はO&M体制に委託できます。",
				mainMetricsLine,
			]),
			pageTwoLines: nonEmptyLines([
				"2枚目｜前提・リスク",
				...equipmentLines,
				revenueLine,
				maintenanceLine,
				`実質収支: 年間維持費（ランニングコスト） ${formatYen(input.runningCost)} を控除後、年間手残りは ${formatYen(input.annualNetIncome)}、回収年数は ${paybackText} です。`,
				"発電量変動、出力抑制、保険免責、設備故障、将来の廃棄費用積立を前提に、都合の良い数字だけで判断しない資料にします。",
				"次アクション: 融資利用の有無、投資期間、相続・出口方針、毎月の手残り目線を確認します。",
			]),
		};
	}
	if (input.proposalKind === "esg") {
		return {
			pageOneLines: nonEmptyLines([
				"1枚目｜提案の結論",
				input.proposalTitle,
				siteLine,
				"御社への結論: 本案件は、投資収益だけでなく、脱炭素対応、取引先への説明、金融機関への企業価値訴求に使える再エネ資産候補です。",
				`環境効果: 年間CO2削減量 ${input.co2ReductionTons !== null ? `${trimTrailingZeros(input.co2ReductionTons)}トン` : "未入力"} / 想定利回り ${yieldText}`,
				mainMetricsLine,
				"選ばれる理由: サプライチェーンの脱炭素要請、ESG評価、採用広報、銀行との対話材料に展開できます。",
			]),
			pageTwoLines: nonEmptyLines([
				"2枚目｜前提・リスク",
				...equipmentLines,
				revenueLine,
				maintenanceLine,
				`経済効果: 年間手残り ${formatYen(input.annualNetIncome)} / 回収年数 ${paybackText}`,
				"環境価値や非化石価値の主張可否は、契約形態、証書、トラッキング、電力利用形態により変わります。",
				"次アクション: 取引先からの要請内容、RE100等の基準、社内稟議で必要な環境指標を確認します。",
			]),
		};
	}
	return {
		pageOneLines: nonEmptyLines([
			"1枚目｜提案の結論",
			input.proposalTitle,
			siteLine,
			"御社への結論: 本案件は、黒字対策と安定収益を同時に検討したい法人オーナー向けの太陽光発電投資候補です。",
			"選ばれる理由: 税制活用の可能性、FIT/FIP制度に基づく収益見通し、本業への管理負担を抑えた運用を一体で検討できます。",
			mainMetricsLine,
		]),
		pageTwoLines: nonEmptyLines([
			"2枚目｜前提・リスク",
			...equipmentLines,
			revenueLine,
			maintenanceLine,
			`実質収支: 年間維持費（ランニングコスト） ${formatYen(input.runningCost)} を控除後、年間手残りは ${formatYen(input.annualNetIncome)}、回収年数は ${paybackText} です。`,
			"税制適用は事前手続き、設備要件、経営力向上計画の認定、税理士・会計士確認が前提です。",
			"FIT/FIP、発電量、出力抑制、保険免責、将来の解体・廃棄費用積立まで開示し、社内決裁に耐える提案にします。",
		]),
	};
}

function nonEmptyLines(lines: string[]): string[] {
	return lines.filter((line) => line.trim().length > 0);
}

function buildSolarSiteLine(details: SolarProposalDetails | null): string {
	if (!details) return "";
	return `物件概要: ${details.plantName} / ${details.location} / ${details.powerArea} / ${details.voltageClass}`;
}

function buildSolarEquipmentLines(details: SolarProposalDetails | null): string[] {
	if (!details) return [];
	return [
		`設備: パネルメーカー ${details.panelMaker} / パネル型式 ${details.panelModel} / パネル枚数 ${formatNumberWithUnit(details.panelCount, "枚")} / DC容量 ${formatNumberWithUnit(details.dcCapacityKw, "kW")}`,
		`パワコン: パワコンメーカー ${details.powerConditionerMaker} / パワコン型式 ${details.powerConditionerModel} / PCS容量 ${formatNumberWithUnit(details.pcsCapacityKw, "kW")}`,
	];
}

function buildSolarRevenueLine(details: SolarProposalDetails | null): string {
	if (!details) return "";
	return `売電条件: ${details.fitFipType} / 売電単価 ${formatNumberWithUnit(details.unitPrice, "円/kWh")} / 残存売電期間 ${formatNumberWithUnit(details.remainingSalesYears, "年")} / 連系開始日 ${details.gridConnectionDate} / 稼働年数 ${details.operationYears}`;
}

function buildMaintenanceBreakdownLine(items: RunningCostBreakdownItem[]): string {
	if (items.length === 0) return "";
	return `維持費内訳: ${items.map((item) => `${item.label} ${formatYen(item.value)}`).join(" / ")}`;
}

function formatNumberWithUnit(value: number | null, unit: string): string {
	return value !== null && Number.isFinite(value) ? `${trimTrailingZeros(value)}${unit}` : "未入力";
}

function buildProposalConclusionText(input: {
	proposalKind: ProposalKind;
	reductionRate: number | null;
	annualReductionAmount: number | null;
	co2ReductionTons: number | null;
}): string {
	const rateText =
		input.reductionRate !== null && Number.isFinite(input.reductionRate)
			? `${trimTrailingZeros(input.reductionRate)}`
			: "○○";
	const amountText =
		input.annualReductionAmount !== null && Number.isFinite(input.annualReductionAmount)
			? `${trimTrailingZeros(yenToManYen(input.annualReductionAmount))}`
			: "○○";
	const co2Text =
		input.co2ReductionTons !== null && Number.isFinite(input.co2ReductionTons)
			? `${trimTrailingZeros(input.co2ReductionTons)}`
			: "○○";
	if (input.proposalKind === "gridBattery") {
		return [
			"本プランは、系統用蓄電池を用いてJEPXの価格差、容量市場、需給調整市場など複数の収益源を検討する次世代エネルギー投資です。",
			"ただし、収益は市場価格・約定・運用条件・系統連系条件・蓄電池劣化・ペナルティ条件により変動します。",
			"補助金は採択・交付決定が前提であり、補助率や対象経費は公募要領と個別審査で確認します。",
			"土地情報が入った段階では、所在地、面積、電力会社エリア、変電所距離、接道、用途地域、接続検討状況を確認し、蓄電池候補として案件化できるかを人間が最終判断します。",
		].join("\n");
	}
	if (input.proposalKind === "individual") {
		return [
			"本プランは、老後資金や家族への資産引き継ぎを見据えた、私的年金型の太陽光発電投資候補です。",
			"不動産のような入居者退去リスクはありませんが、発電量変動、出力抑制、設備故障、保険免責、将来の解体・廃棄費用は前提として開示します。",
			`想定では年間${amountText}万円規模の収益改善と、年間${co2Text}トンのCO2削減効果を確認できます。`,
			"融資利用、投資期間、出口方針、相続方針を確認した上で、無理のない収支表へ落とし込みます。",
		].join("\n");
	}
	if (input.proposalKind === "esg") {
		return [
			"本プランは、投資収益だけでなく、脱炭素対応、取引先への説明、金融機関への企業価値訴求に使える再エネ資産候補です。",
			`想定では年間${co2Text}トンのCO2削減効果と、年間${amountText}万円規模の収益改善を同時に検討できます。`,
			"環境価値や非化石価値の主張可否は、契約形態、証書、トラッキング、電力利用形態により変わるため、個別に確認します。",
			"社内稟議では、経済効果、環境指標、リスク、運用体制を同じ資料内で説明できる形にします。",
		].join("\n");
	}
	return [
		`本プランは、年間電気代を約${rateText}%（${amountText}万円）削減し、同時に年間${co2Text}トンのCO2排出量削減を検討できる太陽光発電投資候補です。`,
		"中小企業経営強化税制は、要件を満たす場合に即時償却または税額控除を選択できる可能性があります。設備取得前の証明書・確認書、経営力向上計画の認定、税理士・会計士確認を前提にします。",
		"不動産のような入居者退去リスクはありませんが、発電量変動、出力抑制、設備故障、保険免責、将来の解体・廃棄費用は前提として開示します。",
		"信頼される提案は、表面利回りだけでなく実質利回り、融資条件、20年後の解体・廃棄費用まで正直に示します。",
	].join("\n");
}

function buildPlaceholderConclusionText(proposalKind: ProposalKind = "corporate"): string {
	if (proposalKind === "gridBattery") {
		return buildProposalConclusionText({
			proposalKind,
			reductionRate: null,
			annualReductionAmount: null,
			co2ReductionTons: null,
		});
	}
	return [
		"本プランは、年間電気代を約○○%（○○万円）削減し、同時に年間○○トンのCO2排出量削減を検討できる太陽光発電投資候補です。",
		"中小企業経営強化税制は、要件を満たす場合に即時償却または税額控除を選択できる可能性があります。設備取得前の証明書・確認書、経営力向上計画の認定、税理士・会計士確認を前提にします。",
		"表面利回りだけでなく、実質利回り、融資条件、発電量変動、出力抑制、保険免責、20年後の解体・廃棄費用まで正直に示します。",
	].join("\n");
}

function yenToManYen(value: number): number {
	return roundTo(value / 10000, 1);
}

function trimTrailingZeros(value: number): string {
	return value.toFixed(2).replace(/\.?0+$/, "");
}

function buildSequentialMissingMessage(
	workLabel: string,
	missingField: string,
	nextFields: string[],
): string {
	const remaining = nextFields.length > 0 ? `\n次に確認する項目: ${nextFields.join(" / ")}` : "";
	return `${workLabel}を実行する前に「${missingField}」を入力してください。修正後にもう一度ボタンを押してください。${remaining}`;
}

function hasFieldValue(value: string | number | null): boolean {
	if (typeof value === "number") return Number.isFinite(value);
	if (typeof value === "string") return value.trim().length > 0;
	return false;
}

function readFirstTextByAliases(
	properties: Record<string, unknown>,
	aliases: string[],
): string {
	for (const alias of aliases) {
		const value = text(properties[alias]);
		if (value) return value;
	}
	return "";
}

function readFirstDateLabelByAliases(
	properties: Record<string, unknown>,
	aliases: string[],
): string {
	for (const alias of aliases) {
		const value = dateLabelFromProperty(properties[alias]);
		if (value) return value;
	}
	return "";
}

function readFirstNumberByAliases(
	properties: Record<string, unknown>,
	aliases: string[],
): number | null {
	for (const alias of aliases) {
		const property = properties[alias];
		const direct = numberValue(property);
		if (direct !== null) return direct;
		const fromText = numberFromText(text(property));
		if (fromText !== null) return fromText;
	}
	return null;
}

function dateLabelFromProperty(property: unknown): string {
	if (!property || typeof property !== "object") return "";
	const prop = property as Record<string, unknown>;
	if (prop.type === "date" && prop.date && typeof prop.date === "object") {
		const date = prop.date as Record<string, unknown>;
		const start = typeof date.start === "string" ? date.start : "";
		const end = typeof date.end === "string" ? date.end : "";
		if (!start) return "";
		return end ? `${start}〜${end}` : start;
	}
	return text(property);
}

function setAliasPatch(
	patches: Record<string, SafePatch>,
	aliases: string[],
	patch: SafePatch,
): void {
	for (const alias of aliases) {
		patches[alias] = patch;
	}
}

function roundTo(value: number, digits: number): number {
	const scale = 10 ** digits;
	return Math.round(value * scale) / scale;
}

async function enrichCompanyForMeetingPrep(company: CompanyInfo): Promise<CompanyInfo> {
	const research = await researchCompany(companyToCardInfo(company));
	return withCompanyResearch(company, mergeCompanyResearch(company, research));
}

async function processDailyReportReceiptSync(
	input: DailyReportReceiptSyncInput,
	notion: NotionClient,
): Promise<DailyReportReceiptSyncResult> {
	const receiptPage = await notion.pages.retrieve({ page_id: input.receiptPageId });
	const receipt = readDailyReportReceipt(receiptPage);
	const reportId = receipt.reportIds[0];
	if (!reportId) {
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, receipt.page, {
				依頼状態: { kind: "select", value: "要確認" },
				処理結果メモ: {
					kind: "text",
					value: "生成対象日報が未設定のため、受付票同期を停止しました。",
				},
			});
		}
		return {
			receiptPageId: receipt.page.id,
			dailyReportPageId: null,
			action: "needs-review",
			status: "要確認",
			message: "生成対象日報が未設定です。",
		};
	}

	const reportPage = await notion.pages.retrieve({ page_id: reportId });
	const report = readDailyReport(reportPage);
	const hasAiFive = [
		report.todaySummary,
		report.progressView,
		report.noGo,
		report.pitfalls,
		report.nextMove,
	].some((value) => value.replace(/\s/g, "").length > 0);

	if (!hasAiFive) {
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, receipt.page, {
				依頼状態: { kind: "select", value: "要確認" },
				処理結果メモ: {
					kind: "text",
					value:
						"生成対象日報のAI5項目が未生成のため、受付票へ返却せず要確認で停止しました。",
				},
			});
		}
		return {
			receiptPageId: receipt.page.id,
			dailyReportPageId: report.page.id,
			action: "needs-review",
			status: "要確認",
			message: "生成対象日報のAI5項目が未生成です。",
		};
	}

	const feedback = buildDailyReportReceiptFeedback(report);
	const tomorrow = buildDailyReportTomorrowLine(report);
	const focus = buildDailyReportFocusPoints(report);

	if (input.dryRun) {
		return {
			receiptPageId: receipt.page.id,
			dailyReportPageId: report.page.id,
			action: "dry-run",
			status: "完了予定",
			message: `dry-run: ${report.title} のAI5項目から受付票へ返却欄を同期できます。日報原本は更新しません。`,
		};
	}

	const properties = receipt.page.properties ?? {};
	const patches: Record<string, SafePatch> = {
		依頼状態: { kind: "select", value: "完了" },
		処理結果メモ: {
			kind: "text",
			value: [
				`WANiPO受付票同期Worker: ${new Date().toISOString()}`,
				`生成対象日報: ${report.title}`,
				"日報原本は書き換えず、受付票の返却欄のみ同期。",
			].join("\n"),
		},
		接続確認メモ: {
			kind: "text",
			value: "Workerで生成対象日報のAI5項目を確認し、受付票へ返却同期済み。",
		},
	};
	addPatchIfBlank(patches, properties, "AIフィードバック", feedback);
	addPatchIfBlank(patches, properties, "明日へのひとこと", tomorrow);
	addPatchIfBlank(patches, properties, "重点確認ポイント", focus);

	await safeUpdateExistingProperties(notion, receipt.page, patches);

	return {
		receiptPageId: receipt.page.id,
		dailyReportPageId: report.page.id,
		action: "synced",
		status: "完了",
		message:
			"WANiPO日報受付票へAIフィードバック、明日へのひとこと、重点確認ポイントを同期しました。日報原本は更新していません。",
	};
}

async function processDailyReportLog(
	input: DailyReportLogInput,
	notion: NotionClient,
): Promise<DailyReportLogResult> {
	const reportPage = await notion.pages.retrieve({ page_id: input.dailyReportPageId });
	const report = readDailyReport(reportPage);
	const existingLog = await findDailyReportLogByReport(notion, report.page.id);
	const hasAiFive = [
		report.todaySummary,
		report.progressView,
		report.noGo,
		report.pitfalls,
		report.nextMove,
	].some((value) => value.replace(/\s/g, "").length > 0);

	// ⚠️ リスク(チェックリスト1-4・2026-06-13時点の既知の穴):
	// 「提出状態」は日報DBの生selectで、営業本人がNotion UIから直接「承認済み」を
	// 選べてしまう(上司承認のWorker正本が存在しない)。ここを正本スタンプ方式に揃えるには
	// 「上司承認ボタン→Worker→スタンプ列」の新設(Notion列+ボタン=大ちゃん承認待ち)が必要。
	// LIVEの日報フローを壊さないため、当面は生select信頼+下の上司コメント必須チェックを
	// 弱い突合として維持する(上司コメントも本人が書ける点は残存リスク)。
	if (report.submissionStatus !== "承認済み") {
		return {
			dailyReportPageId: report.page.id,
			logPageId: existingLog?.id ?? null,
			action: "needs-review",
			status: "対象外",
			message: `提出状態が承認済みではないため、日報ログ化しません。現在: ${report.submissionStatus || "未設定"}`,
		};
	}
	if (!report.bossComment.trim()) {
		return {
			dailyReportPageId: report.page.id,
			logPageId: existingLog?.id ?? null,
			action: "needs-review",
			status: "要確認",
			message:
				"上司コメントプロパティが空のため、ページコメントではなく上司コメントプロパティ第一参照の方針で停止しました。",
		};
	}
	if (!hasAiFive) {
		return {
			dailyReportPageId: report.page.id,
			logPageId: existingLog?.id ?? null,
			action: "needs-review",
			status: "要確認",
			message: "日報本体のAI5項目が不足しているため、評価材料ログ化を停止しました。",
		};
	}

	const patches = buildDailyReportLogPatches(report, existingLog ?? undefined);
	if (input.dryRun) {
		return {
			dailyReportPageId: report.page.id,
			logPageId: existingLog?.id ?? null,
			action: "dry-run",
			status: "処理済予定",
			message: existingLog
				? `dry-run: 既存日報ログ ${existingLog.id} を上司コメントプロパティ参照で更新できます。日報原本は更新しません。`
				: "dry-run: 日報ログDBへ評価材料ログを新規作成できます。日報原本は更新しません。",
		};
	}

	let targetLog = existingLog;
	if (!targetLog) {
		const createProperties: Record<string, unknown> = {
			タイトル: title(buildDailyReportLogTitle(report)),
			関連日報: relation(report.page.id),
			提出状態: select("承認済み"),
			承認状態: select("承認済み"),
			ワニポ評価材料化ステータス: select("処理済"),
			月次反映状態: select("未反映"),
			評価対象区分: select("通常評価"),
		};
		if (report.date) createProperties["日付"] = { date: { start: report.date } };
		targetLog = await notion.pages.create({
			parent: { data_source_id: DAILY_REPORT_LOG_DATA_SOURCE_ID },
			properties: createProperties,
		});
	}

	await safeUpdateExistingProperties(notion, targetLog, patches);

	return {
		dailyReportPageId: report.page.id,
		logPageId: targetLog.id,
		action: existingLog ? "updated-log" : "created-log",
		status: "処理済",
		message:
			"WANiPO日報ログ化Workerで日報ログDBへ評価材料ログを作成/更新しました。上司コメントプロパティを第一参照し、日報原本・AI5項目・点数・最終評価は更新していません。",
	};
}

async function findDailyReportLogByReport(
	notion: NotionClient,
	dailyReportPageId: string,
): Promise<Page | null> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: DAILY_REPORT_LOG_DATA_SOURCE_ID,
			page_size: 10,
			filter: {
				property: "関連日報",
				relation: { contains: dailyReportPageId },
			},
		});
		return response.results[0] ?? null;
	} catch (error) {
		console.log("daily report log lookup skipped", String(error));
		return null;
	}
}

function buildDailyReportLogPatches(
	report: DailyReportInfo,
	existingLog?: Page,
): Record<string, SafePatch> {
	const currentPerformanceIds = existingLog
		? relationIdsFromProperty(existingLog.properties?.["関連営業パフォーマンス"])
		: [];
	const patches: Record<string, SafePatch> = {
		タイトル: { kind: "text", value: buildDailyReportLogTitle(report) },
		関連日報: { kind: "relation", ids: [report.page.id] },
		提出状態: { kind: "select", value: "承認済み" },
		承認状態: { kind: "select", value: "承認済み" },
		ワニポ評価材料化ステータス: { kind: "select", value: "処理済" },
		月次反映状態: { kind: "select", value: "未反映" },
		評価対象区分: { kind: "select", value: "通常評価" },
		日報評価メモ: { kind: "text", value: buildDailyReportEvaluationMemo(report) },
		加点候補: { kind: "text", value: buildDailyReportPlusMemo(report) },
		注意・見落とし: { kind: "text", value: buildDailyReportRiskMemo(report) },
		本人修正要約: {
			kind: "text",
			value: report.factCorrection || "本人の事実修正・実結果は未入力。",
		},
		本人ひとこと要約: {
			kind: "text",
			value: report.personComment || "本人のひとことは未入力。",
		},
		上司コメント要約: {
			kind: "text",
			value: report.bossComment,
		},
	};
	if (report.date) patches["日付"] = { kind: "date", value: report.date };
	if (report.userIds.length > 0) {
		patches["対象営業ユーザー"] = { kind: "people", ids: report.userIds };
	}
	if (currentPerformanceIds.length > 0) {
		patches["関連営業パフォーマンス"] = {
			kind: "relation",
			ids: currentPerformanceIds,
		};
	}
	return patches;
}

function buildDailyReportLogTitle(report: DailyReportInfo): string {
	const date = report.date ? report.date.replace(/-/g, "/") : "日付未設定";
	return `${date} 日報ログ｜${report.title}`;
}

function buildDailyReportEvaluationMemo(report: DailyReportInfo): string {
	return [
		"【AI今日の要約】",
		report.todaySummary,
		"",
		"【AI進捗の見立て】",
		report.progressView,
		"",
		"【AI明日の一手】",
		report.nextMove,
	].filter((value) => value !== "").join("\n").slice(0, 1800);
}

function buildDailyReportPlusMemo(report: DailyReportInfo): string {
	return [
		"日報AI5項目が生成済みで、承認済みとして評価材料化可能。",
		report.nextMove ? `明日の一手: ${report.nextMove}` : "",
		report.bossComment ? `上司コメント: ${report.bossComment}` : "",
	].filter(Boolean).join("\n").slice(0, 1800);
}

function buildDailyReportRiskMemo(report: DailyReportInfo): string {
	return [
		report.noGo ? `【絶対にやってはいけないこと】\n${report.noGo}` : "",
		report.pitfalls ? `【ハマりがちなパターン】\n${report.pitfalls}` : "",
		"点数付け・最終評価・総合評価は禁止。月次反映状態は未反映のまま。",
	].filter(Boolean).join("\n\n").slice(0, 1800);
}

function readDailyReportReceipt(page: Page): DailyReportReceiptInfo {
	const properties = page.properties ?? {};
	return {
		page,
		name: text(properties["受付名"]),
		status: text(properties["依頼状態"]),
		targetDate: dateStartFromProperty(properties["対象日付"]),
		reportIds: relationIdsFromProperty(properties["生成対象日報"]),
	};
}

function readDailyReport(page: Page): DailyReportInfo {
	const properties = page.properties ?? {};
	return {
		page,
		title: text(properties["タイトル"]) || text(properties["日報名"]) || page.id,
		date: dateStartFromProperty(properties["日付"]),
		submissionStatus: text(properties["提出状態"]),
		userIds: personIdsFromProperty(properties["担当営業ユーザー"]),
		bossComment: text(properties["上司コメント"]),
		todaySummary: text(properties["AI今日の要約"]),
		progressView: text(properties["AI進捗の見立て"]),
		noGo: text(properties["AI絶対にやってはいけないこと"]),
		pitfalls: text(properties["AIハマりがちなパターン3つ"]),
		nextMove: text(properties["AI明日の一手"]),
		factCorrection: text(properties["本人の事実修正・実結果"]),
		personComment: text(properties["本人のひとこと"]),
	};
}

function buildDailyReportReceiptFeedback(report: DailyReportInfo): string {
	return [
		report.todaySummary ? `【今日の要約】\n${report.todaySummary}` : "",
		report.progressView ? `【進捗の見立て】\n${report.progressView}` : "",
		report.nextMove ? `【明日の一手】\n${report.nextMove}` : "",
	].filter(Boolean).join("\n\n").slice(0, 1800);
}

function buildDailyReportTomorrowLine(report: DailyReportInfo): string {
	const source = report.nextMove || report.progressView || report.todaySummary;
	if (!source) return "明日の一手を日報原本で確認してください。";
	const first = source.split(/[。\n]/).map((item) => item.trim()).find(Boolean);
	return (first ? `${first}。` : source).slice(0, 500);
}

function buildDailyReportFocusPoints(report: DailyReportInfo): string {
	return [
		report.noGo ? `【絶対にやってはいけないこと】\n${report.noGo}` : "",
		report.pitfalls ? `【ハマりがちなパターン】\n${report.pitfalls}` : "",
	].filter(Boolean).join("\n\n").slice(0, 1800);
}

async function processLandEvaluation(
	input: LandInput,
	notion: NotionClient,
): Promise<LandResult> {
	const page =
		input.pageData ??
		(await notion.pages.retrieve({
			page_id: input.pageId,
		}));
	const land = readLand(page);
	const evaluation = await buildLandEvaluation(land);

	if (input.dryRun) {
		return {
			pageId: input.pageId,
			action: "dry-run",
			overallGrade: evaluation.overallGrade,
			score: evaluation.score,
			bucket: evaluation.bucket,
			message: `dry-run: ${evaluation.bucket} / ${evaluation.overallGrade} / ${evaluation.score}点。`,
		};
	}

	if (!shouldProcessLand(land)) {
		await markLandNeedsReview(notion, land, evaluation);
		return {
			pageId: input.pageId,
			action: "needs-review",
			overallGrade: evaluation.overallGrade,
			score: evaluation.score,
			bucket: evaluation.bucket,
			message: "所在地または面積が不足しているため、詳細評価前の要確認にしました。",
		};
	}

	if (evaluation.requiresInvestigation) {
		await markLandNeedsReview(notion, land, evaluation);
		return {
			pageId: input.pageId,
			action: "needs-review",
			overallGrade: evaluation.overallGrade,
			score: evaluation.score,
			bucket: evaluation.bucket,
			message: `本評価に必要な確認が不足しているため、要確認にしました: ${evaluation.investigationGaps?.join("、") ?? "確認事項あり"}`,
		};
	}

	await markLandProcessing(notion, land);

	try {
		await writeLandEvaluation(notion, land, evaluation);
		await createLandEvaluationLearningLog(notion, land, evaluation).catch((error) => {
			console.log("land evaluation learning log skipped", String(error));
		});
		return {
			pageId: input.pageId,
			action: "evaluated",
			overallGrade: evaluation.overallGrade,
			score: evaluation.score,
			bucket: evaluation.bucket,
			message: "土地詳細評価を返却しました。案件化判断は人間確認前提です。",
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await markLandFailure(notion, land, message);
		throw error;
	}
}

async function processLandCaseCreation(
	input: LandCaseInput,
	notion: NotionClient,
): Promise<LandCaseResult> {
	const landPage = await notion.pages.retrieve({ page_id: input.landPageId });
	const land = readLand(landPage);
	const existingProjects = await findProjectsByLand(notion, land.page.id);
	const existingRelationIds = relationIdsFromProperty(
		land.page.properties?.["関連案件"],
	);
	const allExistingIds = uniqueStrings([
		...existingRelationIds,
		...existingProjects.map((project) => project.page.id),
	]);

	if (!land.name || !land.address) {
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, land.page, {
				案件化状態: { kind: "select", value: "案件化保留" },
				案件化メモ: {
					kind: "text",
					value:
						"土地名または所在地が不足しているため、案件管理DBへ作成せず要確認にしました。",
				},
			});
		}
		return {
			landPageId: input.landPageId,
			action: "needs-review",
			projectId: null,
			created: 0,
			message: "土地名または所在地が不足しているため、案件化せず停止しました。",
		};
	}

	if (allExistingIds.length > 0) {
		if (!input.dryRun) {
			await markLandCaseLinked(notion, land, allExistingIds, "既存の関連案件を検出したため、新規案件は作成していません。");
			await markAiLearningLogsOutcome(notion, {
				relationProperty: "関連土地",
				pageId: land.page.id,
				outcome: "案件化",
				scoreThreshold: 65,
				note: "土地案件化Workerが既存関連案件を検出し、実結果を案件化として反映。",
			}).catch((error) => {
				console.log("land case learning outcome skipped", String(error));
			});
		}
		return {
			landPageId: input.landPageId,
			action: input.dryRun ? "dry-run" : "skipped-existing",
			projectId: allExistingIds[0] ?? null,
			created: 0,
			message: `既存の関連案件 ${allExistingIds.length} 件を検出。新規作成は行いません。`,
		};
	}

	if (input.dryRun) {
		return {
			landPageId: input.landPageId,
			action: "dry-run",
			projectId: null,
			created: 1,
			message: `dry-run: 案件管理DBへ土地案件を1件作成予定です。対象: ${land.name}`,
		};
	}

	try {
		const project = await createProjectFromLand(notion, land);
		await markLandCaseLinked(notion, land, [project.id], "案件管理DBへ土地案件を1件作成しました。");
		await markAiLearningLogsOutcome(notion, {
			relationProperty: "関連土地",
			pageId: land.page.id,
			outcome: "案件化",
			scoreThreshold: 65,
			note: "土地案件化Workerが案件管理DBへ新規案件を作成し、実結果を案件化として反映。",
		}).catch((error) => {
			console.log("land case learning outcome skipped", String(error));
		});
		await notifySalesTeam(
			notion,
			project.id,
			`📣 案件化しました: ${land.name}\n土地情報から案件管理DBへ新しい案件が作成されました。`,
		);
		return {
			landPageId: input.landPageId,
			action: "created-project",
			projectId: project.id,
			created: 1,
			message: "案件管理DBへ土地案件を1件作成し、関連土地情報で紐づけました。",
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await safeUpdateExistingProperties(notion, land.page, {
			案件化状態: { kind: "select", value: "案件化保留" },
			案件化メモ: { kind: "text", value: `土地案件化Worker処理失敗: ${message}` },
		});
		return {
			landPageId: input.landPageId,
			action: "error",
			projectId: null,
			created: 0,
			message: `土地案件化に失敗しました: ${message.slice(0, 300)}`,
		};
	}
}

async function findProjectsByLand(
	notion: NotionClient,
	landPageId: string,
): Promise<ProjectInfo[]> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: PROJECT_DATA_SOURCE_ID,
			page_size: 20,
			filter: {
				property: "関連土地情報",
				relation: { contains: landPageId },
			},
		});
		return response.results.map(readProjectInfo);
	} catch (error) {
		console.log("project lookup skipped", String(error));
		return [];
	}
}

function readProjectInfo(page: Page): ProjectInfo {
	return {
		page,
		name: text(page.properties?.["案件名"]),
	};
}

async function createProjectRecord(
	notion: NotionClient,
	properties: Record<string, unknown>,
): Promise<Page> {
	return notion.pages.create({
		parent: { data_source_id: PROJECT_DATA_SOURCE_ID },
		icon: {
			type: "icon",
			icon: { name: "school", color: "orange" },
		},
		cover: {
			type: "file_upload",
			file_upload: { id: PROJECT_COVER_FILE_UPLOAD_ID },
		},
		properties,
		template: pageTemplate(PROJECT_TEMPLATE_ID),
	});
}

async function createProjectFromLand(
	notion: NotionClient,
	land: LandInfo,
): Promise<Page> {
	const projectName = `${land.name}｜土地案件`;
	const created = await createProjectRecord(notion, {
		案件名: title(projectName),
		ステータス: select("🔴 情報収集中"),
		獲得ソース: select("土地情報"),
		獲得元区分: select("土地情報"),
		仕入れ元区分: select("土地情報"),
		対象物種別: select("土地"),
		案件種別: select(inferProjectTypeFromLand(land)),
		売買区分: select("不明"),
		作成日: { date: { start: todayDateJST() } },
		最終アクション日: { date: { start: todayDateJST() } },
		関連土地情報: { relation: [{ id: land.page.id }] },
	});
	const projectPage = await notion.pages.retrieve({ page_id: created.id });
	const memo = [
		`土地情報DBからWorker案件化。`,
		`土地名: ${land.name}`,
		`所在地: ${land.address}`,
		land.areaTsubo ? `面積: ${Math.round(land.areaTsubo).toLocaleString("ja-JP")}坪` : "",
		land.powerArea ? `電力エリア: ${land.powerArea}` : "",
		land.road ? `接道: ${land.road}` : "",
		"重複防止: 関連土地情報から既存案件を確認してから作成。",
	].filter(Boolean).join("\n");
	const patches: Record<string, SafePatch> = {
		案件詳細: { kind: "text", value: memo },
		情報ソース: { kind: "text", value: "土地情報DB / Worker案件化" },
		確認待ち内容: {
			kind: "text",
			value:
				"系統、接道、農転/登記、所有者、売却条件、現地確認を人間が確認してください。",
		},
	};
	const assigneeIds = personIdsFromProperty(land.page.properties?.["担当営業ユーザー"]);
	if (assigneeIds.length > 0) {
		patches["担当営業ユーザー"] = {
			kind: "people",
			ids: assigneeIds.slice(0, 3),
		};
	}
	await safeUpdateExistingProperties(notion, projectPage, patches);
	return notion.pages.retrieve({ page_id: created.id });
}

async function markLandCaseLinked(
	notion: NotionClient,
	land: LandInfo,
	projectIds: string[],
	message: string,
): Promise<void> {
	const current = relationIdsFromProperty(land.page.properties?.["関連案件"]);
	await safeUpdateExistingProperties(notion, land.page, {
		案件化状態: { kind: "select", value: "案件化済" },
		案件化日: { kind: "date", value: todayDateJST() },
		関連案件: { kind: "relation", ids: uniqueStrings([...current, ...projectIds]) },
		案件化メモ: {
			kind: "text",
			value: [
				message,
				`関連案件数: ${uniqueStrings([...current, ...projectIds]).length}`,
				"同一土地の再実行時は既存関連案件を検出し、新規作成しない。",
			].join("\n"),
		},
	});
}

function inferProjectTypeFromLand(land: LandInfo): string {
	const area = land.areaTsubo ?? 0;
	if (/蓄電池|系統/.test(land.powerArea) || area >= 1500) return "蓄電池";
	if (area >= 300) return "低圧";
	return "その他";
}

// ── 商談フィードバック二次レビュー ────────────────────────────────────────────

async function processDealMeetingFeedback(
	input: DealMeetingFeedbackInput,
	notion: NotionClient,
): Promise<DealMeetingFeedbackResult> {
	const dealPage = await notion.pages.retrieve({ page_id: input.dealPageId });
	const deal = readDeal(dealPage);
	const lastProcessedMeetingId = text(
		dealPage.properties?.["営業FB最終処理議事録ID"],
	);
	const meetingContext = deal.relatedMeetingId
		? await fetchMeetingContext(notion, deal.relatedMeetingId)
		: null;
	const payload = buildDealMeetingFeedbackPayload(deal, meetingContext);

	if (!deal.relatedMeetingId && payload.replace(/\s/g, "").length < 160) {
		return {
			dealPageId: input.dealPageId,
			action: "needs-review",
			score: null,
			message:
				"関連会議議事録がなく、商談フィードバックに必要な材料も短いため要確認で停止しました。",
		};
	}

	if (
		deal.relatedMeetingId &&
		lastProcessedMeetingId === deal.relatedMeetingId &&
		deal.salesFeedback &&
		deal.improvementPoints &&
		deal.nextTalkImage
	) {
		return {
			dealPageId: input.dealPageId,
			action: "skipped-existing",
			score: numberValue(dealPage.properties?.["営業スコア"]),
			message:
				"同じ関連会議議事録IDで既に営業フィードバックを返却済みのため、二重処理せず停止しました。",
		};
	}

	if (input.dryRun) {
		return {
			dealPageId: input.dealPageId,
			action: "dry-run",
			score: null,
			message: `dry-run: ${deal.name || input.dealPageId} を ${payload.length} 文字の商談材料からフィードバックできます。関連会議: ${deal.relatedMeetingId || "なし"}。`,
		};
	}

	let feedback: DealMeetingFeedbackAIResponse;
	try {
		feedback = await callAnthropicDealMeetingFeedback(payload);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			dealPageId: input.dealPageId,
			action: "error",
			score: null,
			message: `Anthropic API呼び出し失敗: ${message}`,
		};
	}

	if (feedback.status === "対象外" || !feedback.salesFeedback.trim()) {
		return {
			dealPageId: input.dealPageId,
			action: "needs-review",
			score: null,
			message:
				feedback.memo ||
				"商談フィードバックに必要な材料が不足しているため、書き戻しせず要確認で停止しました。",
		};
	}

	const score = clampScore(feedback.score);
	await safeUpdateExistingProperties(notion, dealPage, {
		営業スコア: { kind: "number", value: score },
		営業フィードバック: { kind: "text", value: feedback.salesFeedback },
		改善ポイント: {
			kind: "text",
			value: feedback.improvementPoints.map((item) => `・${item}`).join("\n"),
		},
		次回トークイメージ: { kind: "text", value: feedback.nextTalkImage },
		フォローメールヒント: { kind: "text", value: feedback.followMailHint },
		成約へのヒント: { kind: "text", value: feedback.closingHint },
		営業FB更新日時: { kind: "date", value: todayDateJST() },
		営業FB最終処理議事録ID: {
			kind: "text",
			value: deal.relatedMeetingId || input.dealPageId,
		},
	});
	await createDealFeedbackLearningLog(notion, {
		dealPageId: dealPage.id,
		meetingPageId: deal.relatedMeetingId || null,
		dealName: deal.name || input.dealPageId,
		score,
		salesFeedback: feedback.salesFeedback,
		improvementPoints: feedback.improvementPoints,
		nextTalkImage: feedback.nextTalkImage,
		followMailHint: feedback.followMailHint,
		closingHint: feedback.closingHint,
	}).catch((error) => {
		console.log("deal feedback learning log skipped", String(error));
	});

	return {
		dealPageId: input.dealPageId,
		action: "feedback-created",
		score,
		message:
			"商談議事録フィードバックを返却しました。チームトラッカー、成約DB、営業評価DB、二次レビュー欄は更新していません。",
	};
}

function buildDealMeetingFeedbackPayload(
	deal: DealInfo,
	meeting: MeetingContext | null,
): string {
	const lines: string[] = [
		"=== 商談情報 ===",
		`商談名: ${deal.name || "未設定"}`,
		`商談ステータス: ${deal.status || "未設定"}`,
		`商談回数: ${deal.count || "不明"}`,
		`商談日: ${deal.date || "不明"}`,
		`商談概要: ${deal.summary || "未入力"}`,
		`既存営業スコア: ${deal.salesScore || "未入力"}`,
		`既存営業フィードバック: ${deal.salesFeedback || "未入力"}`,
	];
	if (meeting) {
		lines.push(
			"",
			"=== 関連会議議事録 ===",
			`要約: ${meeting.summary || "未入力"}`,
			`議事内容: ${meeting.minutes || "未入力"}`,
			`決定事項: ${meeting.decisions || "未入力"}`,
			`アクション項目: ${meeting.actionItems || "未入力"}`,
			`文字起こし/本文: ${meeting.text || "未入力"}`,
		);
	}
	return lines.join("\n").slice(0, 12000);
}

async function callAnthropicDealMeetingFeedback(
	payload: string,
): Promise<DealMeetingFeedbackAIResponse> {
	const systemPrompt = [
		"あなたは和上ホールディングスの商談議事録フィードバックAIです。",
		"商談管理DBと関連会議議事録を読み、営業マンが次の商談を良くするためのフィードバックを返します。",
		"",
		"重要:",
		"- これは営業担当者の最終評価ではなく、商談品質のフィードバックです。",
		"- 根拠がある場合は遠慮せず、改善点をはっきり書きます。",
		"- 分からないことは推測で断定せず、要確認に寄せます。",
		"",
		"出力:",
		"- score は0〜100の商談品質スコア。会話の具体性、顧客理解、次アクション、成約可能性を総合して付ける。",
		"- salesFeedback は良い点と甘い点を1段落で率直に書く。",
		"- improvementPoints は次回までに直す具体行動を3〜5個。",
		"- nextTalkImage は次回商談でそのまま話せるトーク例。",
		"- followMailHint は商談後メールの要点。",
		"- closingHint は成約へ近づけるための確認・提案。",
		"- 材料不足なら status=要確認、明確に商談でなければ status=対象外。",
		"",
		"禁止:",
		"- チームトラッカーにタスクを作成しない。",
		"- 成約判断、給与評価、最終評価、総合評価をしない。",
		"- 商談ステータスを成約/失注へ確定しない。",
		"必ずJSONのみを返してください。",
	].join("\n");

	const raw = await callAnthropicChat({
		system: systemPrompt,
		user: payload,
		maxTokens: 2000,
		temperature: 0,
		jsonSchema: DEAL_MEETING_FEEDBACK_RESPONSE_FORMAT,
	});
	return parseDealMeetingFeedbackAIResponse(raw);
}

function parseDealMeetingFeedbackAIResponse(
	raw: string,
): DealMeetingFeedbackAIResponse {
	try {
		const parsed = JSON.parse(raw) as Partial<DealMeetingFeedbackAIResponse>;
		const status =
			parsed.status === "返却済" ||
			parsed.status === "要確認" ||
			parsed.status === "対象外"
				? parsed.status
				: "要確認";
		return {
			score: typeof parsed.score === "number" ? parsed.score : 0,
			salesFeedback:
				typeof parsed.salesFeedback === "string" ? parsed.salesFeedback : "",
			improvementPoints: Array.isArray(parsed.improvementPoints)
				? parsed.improvementPoints.filter((item): item is string => typeof item === "string")
				: [],
			nextTalkImage:
				typeof parsed.nextTalkImage === "string" ? parsed.nextTalkImage : "",
			followMailHint:
				typeof parsed.followMailHint === "string" ? parsed.followMailHint : "",
			closingHint: typeof parsed.closingHint === "string" ? parsed.closingHint : "",
			status,
			memo: typeof parsed.memo === "string" ? parsed.memo : "",
		};
	} catch (error) {
		console.log("parseDealMeetingFeedbackAIResponse failed", String(error));
		return {
			score: 0,
			salesFeedback: "",
			improvementPoints: [],
			nextTalkImage: "",
			followMailHint: "",
			closingHint: "",
			status: "要確認",
			memo: `JSONパース失敗: ${raw.slice(0, 200)}`,
		};
	}
}

function clampScore(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(100, Math.round(value)));
}

async function processDealFeedbackSecondReview(
	input: DealSecondReviewInput,
	notion: NotionClient,
): Promise<DealSecondReviewResult> {
	const dealPage = await notion.pages.retrieve({ page_id: input.dealPageId });
	const deal = readDeal(dealPage);

	// 一次フィードバックが空なら対象外
	if (!deal.salesFeedback && !deal.improvementPoints && !deal.closingHint) {
		if (!input.dryRun) {
			await safeUpdateExistingProperties(notion, dealPage, {
				二次FBステータス: { kind: "select", value: "対象外" },
				二次レビューコメント: {
					kind: "text",
					value: "一次フィードバックが未入力のため対象外にしました。",
				},
			});
		}
		return {
			dealPageId: input.dealPageId,
			action: "needs-review",
			quality: null,
			message: "一次フィードバックが未入力のため対象外にしました。",
		};
	}

	// 関連会議の取得（失敗しても続行）
	let meetingContext: MeetingContext | null = null;
	if (deal.relatedMeetingId) {
		meetingContext = await fetchMeetingContext(notion, deal.relatedMeetingId);
	}

	// Anthropic送信ペイロード構築（個人情報を除外）
	const payload = buildSecondReviewPayload(deal, meetingContext);

	if (input.dryRun) {
		return {
			dealPageId: input.dealPageId,
			action: "dry-run",
			quality: null,
			message: [
				`dry-run: 送信予定ペイロード ${JSON.stringify(payload).length} 文字。`,
				`商談名=${deal.name || "（未入力）"}。`,
				`フィードバック有無: スコア=${Boolean(deal.salesScore)}, FB=${Boolean(deal.salesFeedback)}, 改善=${Boolean(deal.improvementPoints)}, 成約ヒント=${Boolean(deal.closingHint)}。`,
				meetingContext ? "関連会議: あり。" : "関連会議: なし。",
			].join(""),
		};
	}

	// Anthropic 呼び出し
	let reviewResponse: SecondReviewAIResponse;
	try {
		reviewResponse = await callAnthropicSecondReview(payload);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await safeUpdateExistingProperties(notion, dealPage, {
			二次FBステータス: { kind: "select", value: "エラー" },
			二次レビューコメント: {
				kind: "text",
				value: `二次レビューAPIエラー: ${message.slice(0, 500)}`,
			},
		});
		return {
			dealPageId: input.dealPageId,
			action: "error",
			quality: null,
			message: `Anthropic API呼び出し失敗: ${message}`,
		};
	}

	// Notion 書き戻し（一次フィードバック欄は更新しない）
	const comment = buildSecondReviewComment(reviewResponse);
	await safeUpdateExistingProperties(notion, dealPage, {
		二次FBステータス: {
			kind: "select",
			value: reviewResponse.recommendedStatus || "レビュー済",
		},
		二次レビューコメント: { kind: "text", value: comment },
		フィードバック品質: {
			kind: "select",
			value: reviewResponse.quality || "情報不足",
		},
		二次レビュー更新日時: { kind: "date", value: new Date().toISOString() },
		二次レビュー最終処理商談ID: { kind: "text", value: input.dealPageId },
	});

	// 活動ログへ記録（評価対象フラグON・冪等）
	try {
		await createDealActivityLog(notion, deal, reviewResponse);
	} catch (error) {
		console.log("activity log creation skipped", String(error));
	}

	return {
		dealPageId: input.dealPageId,
		action: "reviewed",
		quality: reviewResponse.quality,
		message: `二次レビュー完了。品質: ${reviewResponse.quality}、ステータス: ${reviewResponse.recommendedStatus}。`,
	};
}

function readDeal(page: Page): DealInfo {
	const properties = page.properties ?? {};
	// 商談管理DBの実プロパティ名は「関連ミーティング」。旧名「関連会議」にもフォールバック
	const meetingIds = relationIdsFromProperty(
		properties["関連ミーティング"] ?? properties["関連会議"],
	);
	const score = numberValue(properties["営業スコア"]);
	return {
		page,
		name: text(properties["商談名"]),
		date: text(properties["商談日"]) || text(properties["商談日時"]),
		dateISO: dateStartFromProperty(properties["商談日"]),
		summary: text(properties["商談概要"]),
		count: text(properties["商談回数"]),
		status: text(properties["商談ステータス"]),
		relatedMeetingId: meetingIds[0] ?? null,
		assignedUserIds: personIdsFromProperty(properties["担当営業ユーザー"]),
		relatedCompanyIds: relationIdsFromProperty(properties["関連企業"]),
		salesScore: score !== null ? String(score) : text(properties["営業スコア"]),
		salesFeedback: text(properties["営業フィードバック"]),
		improvementPoints: text(properties["改善ポイント"]),
		nextTalkImage: text(properties["次回トークイメージ"]),
		followMailHint: text(properties["フォローメールヒント"]),
		closingHint: text(properties["成約へのヒント"]),
	};
}

export { readDeal as readDealForTest };

async function fetchMeetingContext(
	notion: NotionClient,
	meetingId: string,
): Promise<MeetingContext | null> {
	try {
		const page = await notion.pages.retrieve({ page_id: meetingId });
		const properties = page.properties ?? {};
		return {
			summary: text(properties["要約"]) || text(properties["サマリー"]),
			minutes: text(properties["議事内容"]) || text(properties["議事録"]),
			decisions: text(properties["決定事項"]),
			actionItems:
				text(properties["アクション項目"]) || text(properties["アクションアイテム"]),
			text: text(properties["テキスト"]) || text(properties["本文"]),
		};
	} catch (error) {
		console.log("meeting context fetch skipped", String(error));
		return null;
	}
}

function buildSecondReviewPayload(
	deal: DealInfo,
	meeting: MeetingContext | null,
): string {
	const lines: string[] = [
		"=== 商談情報 ===",
		`商談ステータス: ${deal.status || "未設定"}`,
		`商談回数: ${deal.count || "不明"}`,
		`商談日: ${deal.date || "不明"}`,
		`商談概要: ${deal.summary || "（未入力）"}`,
		"",
		"=== 一次AIフィードバック ===",
		`営業スコア: ${deal.salesScore || "（未入力）"}`,
		`営業フィードバック: ${deal.salesFeedback || "（未入力）"}`,
		`改善ポイント: ${deal.improvementPoints || "（未入力）"}`,
		`次回トークイメージ: ${deal.nextTalkImage || "（未入力）"}`,
		`フォローメールヒント: ${deal.followMailHint || "（未入力）"}`,
		`成約へのヒント: ${deal.closingHint || "（未入力）"}`,
	];

	if (meeting) {
		const meetingLines: string[] = [];
		if (meeting.summary) meetingLines.push(`会議要約: ${meeting.summary}`);
		if (meeting.minutes) meetingLines.push(`議事内容: ${meeting.minutes}`);
		if (meeting.decisions) meetingLines.push(`決定事項: ${meeting.decisions}`);
		if (meeting.actionItems) meetingLines.push(`アクション項目: ${meeting.actionItems}`);
		if (meeting.text) meetingLines.push(`会議テキスト: ${meeting.text}`);
		if (meetingLines.length > 0) {
			lines.push("", "=== 関連会議情報 ===", ...meetingLines);
		}
	}

	return lines.join("\n").slice(0, 6000);
}

async function callAnthropicSecondReview(payload: string): Promise<SecondReviewAIResponse> {
	const systemPrompt = [
		"あなたは和上ホールディングスの営業フィードバック二次レビュアーです。",
		"一次AIが返した営業フィードバックを、営業現場で本当に次の商談に使えるかという観点でレビューしてください。",
		"",
		"レビュー観点:",
		"1. フィードバックが具体的か",
		"2. 次回トークイメージがそのまま話せるレベルか",
		"3. 改善ポイントが行動に落ちているか",
		"4. 成約へのヒントが商談状況に合っているか",
		"5. 根拠が薄い断定や、言い過ぎがないか",
		"6. もっと踏み込むべき質問があるか",
		"",
		"禁止:",
		"- 最終評価、総合評価、給与、処遇判断をしない",
		"- 商談ステータスや成約判断を確定しない",
		"- タスクを作らない",
		"- 人格評価をしない",
		"- 不明なことを断定しない",
		"",
		"必ずJSONのみを返してください。",
		"キー: quality(良い|要修正|情報不足), summary(文字列), strongPoints(配列), revisionSuggestions(配列), nextTalkUpgrade(文字列), riskNotes(配列), recommendedStatus(レビュー済|要確認)",
	].join("\n");

	const raw = await callAnthropicChat({
		system: systemPrompt,
		user: payload,
		maxTokens: 4000,
		temperature: 0,
		jsonSchema: SECOND_REVIEW_RESPONSE_FORMAT,
	});

	return parseSecondReviewResponse(raw);
}

function parseSecondReviewResponse(raw: string): SecondReviewAIResponse {
	try {
		const parsed = JSON.parse(raw) as Partial<SecondReviewAIResponse>;
		const toStringArray = (value: unknown): string[] =>
			Array.isArray(value)
				? value.filter((s): s is string => typeof s === "string")
				: [];
		return {
			quality:
				typeof parsed.quality === "string" ? parsed.quality : "情報不足",
			summary: typeof parsed.summary === "string" ? parsed.summary : "",
			strongPoints: toStringArray(parsed.strongPoints),
			revisionSuggestions: toStringArray(parsed.revisionSuggestions),
			nextTalkUpgrade:
				typeof parsed.nextTalkUpgrade === "string" ? parsed.nextTalkUpgrade : "",
			riskNotes: toStringArray(parsed.riskNotes),
			recommendedStatus:
				parsed.recommendedStatus === "要確認" ? "要確認" : "レビュー済",
		};
	} catch (error) {
		console.log("parseSecondReviewResponse failed", String(error));
		return {
			quality: "情報不足",
			summary: `JSONパース失敗: ${raw.slice(0, 200)}`,
			strongPoints: [],
			revisionSuggestions: ["AIレスポンスのパースに失敗しました。"],
			nextTalkUpgrade: "",
			riskNotes: [],
			recommendedStatus: "要確認",
		};
	}
}

function buildSecondReviewComment(response: SecondReviewAIResponse): string {
	const parts: string[] = [];
	if (response.summary) parts.push(`【サマリー】\n${response.summary}`);
	if (response.strongPoints.length > 0) {
		parts.push(`【良い点】\n${response.strongPoints.map((p) => `・${p}`).join("\n")}`);
	}
	if (response.revisionSuggestions.length > 0) {
		parts.push(
			`【修正提案】\n${response.revisionSuggestions.map((p) => `・${p}`).join("\n")}`,
		);
	}
	if (response.nextTalkUpgrade) {
		parts.push(`【次回トーク強化】\n${response.nextTalkUpgrade}`);
	}
	if (response.riskNotes.length > 0) {
		parts.push(`【注意点】\n${response.riskNotes.map((p) => `・${p}`).join("\n")}`);
	}
	return parts.join("\n\n").slice(0, 1800);
}

async function createDealActivityLog(
	notion: NotionClient,
	deal: DealInfo,
	reviewResponse: SecondReviewAIResponse,
): Promise<void> {
	const workerProcessId = `deal-review-${deal.page.id}`;

	// 冪等性チェック：同じ商談の活動ログが既に存在すればスキップ
	const existing = await notion.dataSources.query({
		data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID,
		filter: {
			property: "Worker処理ID",
			rich_text: { equals: workerProcessId },
		},
		page_size: 1,
	});
	if (existing.results.length > 0) {
		console.log("deal activity log already exists, skipping", deal.page.id);
		return;
	}

	const properties: Record<string, unknown> = {
		活動タイトル: title(`${deal.name || "商談"}（二次レビュー済）`),
		活動種別: select("商談"),
		活動処理状態: select("完了"),
		評価対象: { checkbox: true },
		AIサマリ: richText(reviewResponse.summary || ""),
		"Worker処理ID": richText(workerProcessId),
		関連商談: relationIds([deal.page.id]),
	};

	if (deal.dateISO) {
		properties["活動日時"] = { date: { start: deal.dateISO } };
	}
	if (deal.assignedUserIds.length > 0) {
		properties["活動者"] = {
			people: deal.assignedUserIds.map((id) => ({ object: "user", id })),
		};
	}
	if (deal.relatedCompanyIds.length > 0) {
		properties["関連企業"] = relationIds(deal.relatedCompanyIds);
	}

	await notion.pages.create({
		parent: { data_source_id: ACTIVITY_LOG_DATA_SOURCE_ID },
		properties,
	});
	console.log("deal activity log created", deal.page.id);
}

// ── ネクストアクションAI ─────────────────────────────────────────────────────

async function processDealNextActions(
	input: DealNextActionInput,
	notion: NotionClient,
): Promise<DealNextActionResult> {
	const dealPage = await notion.pages.retrieve({ page_id: input.dealPageId });
	const deal = readDeal(dealPage);
	const meetingContext = deal.relatedMeetingId
		? await fetchMeetingContext(notion, deal.relatedMeetingId)
		: null;
	const source = buildDealNextActionPayload(deal, meetingContext);

	if (source.replace(/\s/g, "").length < 120) {
		return {
			dealPageId: input.dealPageId,
			action: "needs-review",
			created: 0,
			skipped: 0,
			message:
				"商談フィードバック、改善ポイント、次回トーク、成約ヒントが不足しているため、タスク作成せず停止しました。",
		};
	}

	const existingTasks = await findTeamTasksByDeal(notion, deal.page.id);
	let aiResponse: DealNextActionAIResponse;
	try {
		aiResponse = await callAnthropicDealNextActions(source);
	} catch (error) {
		return {
			dealPageId: input.dealPageId,
			action: "error",
			created: 0,
			skipped: 0,
			message: `ネクストアクションAIの生成に失敗しました: ${String(error).slice(0, 300)}`,
		};
	}

	const candidates = normalizeDealNextActionCandidates(aiResponse.actions);
	if (aiResponse.status !== "作成候補あり" || candidates.length === 0) {
		return {
			dealPageId: input.dealPageId,
			action: "needs-review",
			created: 0,
			skipped: existingTasks.length,
			message:
				aiResponse.memo ||
				"明確にチームトラッカーへ作るべき次アクションがないため、タスク作成せず停止しました。",
		};
	}

	const planned = candidates.map((candidate) => ({
		candidate,
		duplicate: existingTasks.find((task) =>
			taskTitlesSimilar(task.title, candidate.title),
		),
	}));

	if (input.dryRun) {
		const duplicateCount = planned.filter((item) => item.duplicate).length;
		return {
			dealPageId: input.dealPageId,
			action: "dry-run",
			created: planned.length - duplicateCount,
			skipped: duplicateCount,
			message: [
				`dry-run: 作成候補 ${planned.length} 件。`,
				`既存関連タスク ${existingTasks.length} 件。`,
				`重複スキップ予定 ${duplicateCount} 件。`,
				`候補: ${planned.map((item) => item.candidate.title).join(" / ")}`,
			].join(""),
		};
	}

	let created = 0;
	let skipped = 0;
	for (const item of planned) {
		if (item.duplicate) {
			skipped += 1;
			continue;
		}
		await createTeamTrackerTaskFromDealAction(notion, deal, item.candidate);
		created += 1;
	}

	return {
		dealPageId: input.dealPageId,
		action: created > 0 ? "created-tasks" : "skipped-existing",
		created,
		skipped,
		message:
			created > 0
				? `ネクストアクションを ${created} 件作成しました。重複 ${skipped} 件は作成していません。`
				: `既存の関連タスクと重複するため、新規作成は行いませんでした。重複スキップ ${skipped} 件。`,
	};
}

function buildDealNextActionPayload(
	deal: DealInfo,
	meeting: MeetingContext | null,
): string {
	const lines = [
		"=== 商談 ===",
		`商談名: ${deal.name || "未設定"}`,
		`商談日: ${deal.date || "未設定"}`,
		`商談ステータス: ${deal.status || "未設定"}`,
		`商談概要: ${deal.summary || "未入力"}`,
		`担当営業ユーザーID数: ${deal.assignedUserIds.length}`,
		"",
		"=== 営業フィードバック ===",
		`営業フィードバック: ${deal.salesFeedback || "未入力"}`,
		`改善ポイント: ${deal.improvementPoints || "未入力"}`,
		`次回トークイメージ: ${deal.nextTalkImage || "未入力"}`,
		`フォローメールヒント: ${deal.followMailHint || "未入力"}`,
		`成約へのヒント: ${deal.closingHint || "未入力"}`,
	];
	if (meeting) {
		lines.push(
			"",
			"=== 関連会議 ===",
			`要約: ${meeting.summary || "未入力"}`,
			`決定事項: ${meeting.decisions || "未入力"}`,
			`アクション項目: ${meeting.actionItems || "未入力"}`,
		);
	}
	return lines.join("\n").slice(0, 10000);
}

async function callAnthropicDealNextActions(
	payload: string,
): Promise<DealNextActionAIResponse> {
	const today = new Date().toISOString().slice(0, 10);

	const systemPrompt = [
		"あなたは和上ホールディングスのネクストアクションAIです。",
		"商談管理DBの営業フィードバック、改善ポイント、次回トーク、成約ヒントを読み、チームトラッカーへ作るべき具体タスク候補だけを抽出します。",
		"",
		"重要ルール:",
		"- タスク候補は最大5件",
		"- 具体的な行動がないものは作らない",
		"- 担当者を推測しない。担当者の割当はWorkerが商談の担当営業ユーザーから行う",
		"- 期限が明確でない場合、dueDate は空文字にして dueText に「期限要確認」と書く",
		"- 今日の日付は " + today,
		"- 商談ステータス、営業スコア、営業フィードバック、成約判断、評価は更新しない",
		"- 既存タスクの重複判定はWorker側で行うため、同じ意味のタスクを細かく分割しすぎない",
		"- 商談名にテスト、ドライラン、確認などの語が含まれていても、材料が具体的なら通常通り候補を返す",
		"",
		"良いタスク例:",
		"- 決裁者同席を打診する",
		"- 返金条件を確認する",
		"- A社向け提案資料の初版を作成する",
		"- フォローメールを送る",
		"",
		"必ずJSONのみを返してください。",
	].join("\n");

	const raw = await callAnthropicChat({
		system: systemPrompt,
		user: payload,
		maxTokens: 2000,
		temperature: 0,
		jsonSchema: DEAL_NEXT_ACTION_RESPONSE_FORMAT,
	});
	return parseDealNextActionAIResponse(raw);
}

function parseDealNextActionAIResponse(raw: string): DealNextActionAIResponse {
	try {
		const parsed = JSON.parse(raw) as Partial<DealNextActionAIResponse>;
		const status =
			parsed.status === "作成候補あり" ||
			parsed.status === "要確認" ||
			parsed.status === "対象外"
				? parsed.status
				: "要確認";
		return {
			status,
			memo: typeof parsed.memo === "string" ? parsed.memo : "",
			actions: Array.isArray(parsed.actions)
				? parsed.actions
						.map(normalizeDealNextActionCandidate)
						.filter((action): action is DealNextActionCandidate => Boolean(action))
				: [],
		};
	} catch (error) {
		console.log("parseDealNextActionAIResponse failed", String(error));
		return {
			status: "要確認",
			memo: `JSONパース失敗: ${raw.slice(0, 200)}`,
			actions: [],
		};
	}
}

function normalizeDealNextActionCandidates(
	actions: DealNextActionCandidate[],
): DealNextActionCandidate[] {
	const seen = new Set<string>();
	const result: DealNextActionCandidate[] = [];
	for (const raw of actions) {
		const action = normalizeDealNextActionCandidate(raw);
		if (!action) continue;
		const key = normalizeTaskTitle(action.title);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		result.push(action);
	}
	return result.slice(0, 5);
}

function normalizeDealNextActionCandidate(
	raw: Partial<DealNextActionCandidate>,
): DealNextActionCandidate | null {
	const titleText = typeof raw.title === "string" ? raw.title.trim() : "";
	const description =
		typeof raw.description === "string" ? raw.description.trim() : "";
	if (titleText.replace(/\s/g, "").length < 6) return null;
	const priority =
		raw.priority === "高" || raw.priority === "中" || raw.priority === "低"
			? raw.priority
			: "中";
	const taskType =
		raw.taskType === "確認・調査" ||
		raw.taskType === "書類作成" ||
		raw.taskType === "顧客フォロー" ||
		raw.taskType === "社内タスク"
			? raw.taskType
			: "確認・調査";
	const dueDate =
		typeof raw.dueDate === "string" && isISODateOnly(raw.dueDate)
			? raw.dueDate
			: "";
	const dueText =
		typeof raw.dueText === "string" && raw.dueText.trim()
			? raw.dueText.trim()
			: dueDate || "期限要確認";
	return {
		title: titleText.slice(0, 90),
		description: description || titleText,
		priority,
		taskType,
		dueText,
		dueDate,
		requiresHumanCheck: Boolean(raw.requiresHumanCheck),
	};
}

async function findTeamTasksByDeal(
	notion: NotionClient,
	dealId: string,
): Promise<TeamTaskInfo[]> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: TEAM_TRACKER_DATA_SOURCE_ID,
			page_size: 50,
			filter: {
				property: "関連商談",
				relation: { contains: dealId },
			},
		});
		return response.results.map(readTeamTaskInfo);
	} catch (error) {
		console.log("team task lookup skipped", String(error));
		return [];
	}
}

function readTeamTaskInfo(page: Page): TeamTaskInfo {
	const properties = page.properties ?? {};
	return {
		page,
		title: text(properties["タスク名"]) || text(properties["名前"]) || "",
		status: text(properties["ステータス"]),
		done: checkboxValue(properties["完了"]),
	};
}

async function createTeamTrackerTaskFromDealAction(
	notion: NotionClient,
	deal: DealInfo,
	action: DealNextActionCandidate,
): Promise<void> {
	const created = await notion.pages.create({
		parent: { data_source_id: TEAM_TRACKER_DATA_SOURCE_ID },
		properties: {
			タスク名: title(action.title),
		},
	});
	const fullPage = await notion.pages.retrieve({ page_id: created.id });
	const memo = buildDealNextActionTaskMemo(deal, action);
	const patches: Record<string, SafePatch> = {
		概要: { kind: "text", value: memo },
		"説明⚠️まず入力": { kind: "text", value: memo },
		ステータス: { kind: "select", value: "未着手" },
		優先順位: { kind: "select", value: action.priority },
		タスクタイプ: { kind: "multi_select", values: [action.taskType] },
		関連商談: { kind: "relation", ids: [deal.page.id] },
	};
	if (deal.relatedMeetingId) {
		patches["関連会議議事録"] = {
			kind: "relation",
			ids: [deal.relatedMeetingId],
		};
	}
	if (deal.relatedCompanyIds.length > 0) {
		patches["関連企業"] = {
			kind: "relation",
			ids: deal.relatedCompanyIds.slice(0, 3),
		};
	}
	if (deal.assignedUserIds.length > 0) {
		patches["タスク担当者"] = {
			kind: "people",
			ids: deal.assignedUserIds.slice(0, 3),
		};
	}
	if (action.dueDate) {
		patches["期限"] = { kind: "date", value: action.dueDate };
	}
	await safeUpdateExistingProperties(notion, fullPage, patches);
}

function buildDealNextActionTaskMemo(
	deal: DealInfo,
	action: DealNextActionCandidate,
): string {
	const assignee =
		deal.assignedUserIds.length > 0
			? "商談の担当営業ユーザーを設定"
			: "担当者要確認";
	return [
		`商談: ${deal.name || deal.page.id}`,
		`根拠: ${action.description}`,
		`期限: ${action.dueText || "期限要確認"}`,
		`担当: ${assignee}`,
		action.requiresHumanCheck ? "確認: 内容に曖昧さがあるため人間確認を推奨。" : "",
		`Worker処理ID: deal-next-action-${deal.page.id}-${normalizeTaskTitle(action.title).slice(0, 40)}`,
	].filter(Boolean).join("\n").slice(0, 1800);
}

// ── ニュース収集Worker：RSSから業界ニュースDBへ候補登録 ────────────────────────

async function collectSalesNews(
	input: SalesNewsCollectInput,
	notion: NotionClient,
): Promise<SalesNewsCollectResult> {
	const limit = Math.max(1, Math.min(input.limit ?? 5, 20));
	const feeds = buildSalesNewsFeeds();
	const fetchedItems = await fetchSalesNewsItems(feeds);
	const scoredItems = scoreAndDeduplicateSalesNews(fetchedItems)
		.filter((item) => item.score >= 25)
		.slice(0, Math.max(limit * 4, 12));

	let created = 0;
	let skipped = 0;
	let finalized = 0;
	const pages: string[] = [];
	const selected: ScoredSalesNewsItem[] = [];

	for (const item of scoredItems) {
		if (selected.length >= limit) break;
		const exists = await salesNewsAlreadyExists(notion, item);
		if (exists) {
			skipped += 1;
			continue;
		}
		selected.push(item);
	}

	if (input.dryRun) {
		return {
			action: "dry-run",
			fetched: fetchedItems.length,
			candidates: selected.length,
			created: selected.length,
			skipped,
			finalized: 0,
			pages: selected.map((item) => `${item.title} (${item.url})`),
			message: [
				`dry-run: RSS ${feeds.length}本から ${fetchedItems.length} 件取得。`,
				`候補 ${selected.length} 件、既存スキップ ${skipped} 件。`,
				`キーワード: ${feeds.map((feed) => feed.name).join(" / ")}`,
			].join(""),
		};
	}

	for (const item of selected) {
		const page = await createSalesNewsPage(notion, item, Boolean(input.autoGenerateTalk));
		created += 1;
		pages.push(page.url ?? page.id);
		if (input.autoGenerateTalk && input.autoFinalize) {
			const result = await processSalesTalkFinalize(
				{ newsPageId: page.id, dryRun: false },
				notion,
			);
			if (result.action === "finalized") finalized += result.created + result.updated;
		}
	}

	return {
		action: "collected",
		fetched: fetchedItems.length,
		candidates: selected.length,
		created,
		skipped,
		finalized,
		pages,
		message: [
			`ニュース候補を ${created} 件登録しました。`,
			`既存スキップ ${skipped} 件。`,
			input.autoGenerateTalk
				? "営業トーク生成文もニュース側へ下書きしました。"
				: "営業トーク生成は未実行です。",
			input.autoFinalize
				? `営業トーク管理DB仕上げ ${finalized} 件。`
				: "営業トーク管理DBへの仕上げは未実行です。",
		].join(""),
	};
}

function buildSalesNewsFeeds(): SalesNewsFeed[] {
	const configuredFeeds = parseSalesNewsFeedsJson(
		process.env.SALES_NEWS_RSS_FEEDS_JSON ?? process.env.NEWS_RSS_FEEDS_JSON,
	);
	if (configuredFeeds.length > 0) return configuredFeeds;

	const keywords = parseSalesNewsKeywords(
		process.env.SALES_NEWS_RSS_KEYWORDS ?? process.env.NEWS_RSS_KEYWORDS,
	);
	return (keywords.length > 0 ? keywords : DEFAULT_SALES_NEWS_KEYWORDS).map(
		(keyword) => ({
			name: keyword,
			url: googleNewsRssUrl(keyword),
			defaultCategory: inferSalesNewsCategory(keyword),
		}),
	);
}

function parseSalesNewsKeywords(value: string | undefined): string[] {
	if (!value) return [];
	return uniqueStrings(
		value
			.split(/[\n,、]/)
			.map((keyword) => keyword.trim())
			.filter(Boolean),
	).slice(0, 30);
}

function parseSalesNewsFeedsJson(value: string | undefined): SalesNewsFeed[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map((item): SalesNewsFeed | null => {
				if (!item || typeof item !== "object") return null;
				const record = item as Record<string, unknown>;
				const name = firstString(record.name, record.title, record.keyword) ?? "";
				const url = firstString(record.url, record.feedUrl, record.feed_url) ?? "";
				const defaultCategory = firstString(record.defaultCategory, record.category);
				if (!name || !url) return null;
				return { name, url, defaultCategory };
			})
			.filter((feed): feed is SalesNewsFeed => Boolean(feed))
			.slice(0, 30);
	} catch (error) {
		console.log("NEWS_RSS_FEEDS_JSON parse skipped", String(error));
		return [];
	}
}

function googleNewsRssUrl(keyword: string): string {
	return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=JP&ceid=JP:ja`;
}

async function fetchSalesNewsItems(feeds: SalesNewsFeed[]): Promise<SalesNewsItem[]> {
	const results: SalesNewsItem[] = [];
	for (const feed of feeds.slice(0, 30)) {
		const items = await fetchSalesNewsFeed(feed);
		results.push(...items);
	}
	return results;
}

async function fetchSalesNewsFeed(feed: SalesNewsFeed): Promise<SalesNewsItem[]> {
	try {
		const response = await fetch(feed.url, {
			headers: {
				"User-Agent": "WAJO-Sales-News-Collector/1.0",
				Accept: "application/rss+xml, application/atom+xml, text/xml, */*",
			},
			signal: AbortSignal.timeout(12000),
		});
		if (!response.ok) {
			console.log("news rss fetch skipped", { feed: feed.name, status: response.status });
			return [];
		}
		const xml = await response.text();
		return parseSalesNewsXml(xml, feed);
	} catch (error) {
		console.log("news rss fetch failed", { feed: feed.name, error: String(error) });
		return [];
	}
}

function parseSalesNewsXml(xml: string, feed: SalesNewsFeed): SalesNewsItem[] {
	const chunks = xml.match(/<item\b[\s\S]*?<\/item>/gi);
	if (chunks?.length) {
		return chunks
			.map((chunk) => parseRssItem(chunk, feed))
			.filter((item): item is SalesNewsItem => Boolean(item));
	}
	const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
	return entries
		.map((chunk) => parseAtomEntry(chunk, feed))
		.filter((item): item is SalesNewsItem => Boolean(item));
}

function parseRssItem(chunk: string, feed: SalesNewsFeed): SalesNewsItem | null {
	const titleText = xmlField(chunk, "title");
	const link = xmlField(chunk, "link");
	const summary = xmlField(chunk, "description") || xmlField(chunk, "content:encoded");
	const pubDate = xmlField(chunk, "pubDate") || xmlField(chunk, "dc:date");
	const titleClean = cleanNewsText(titleText);
	const url = cleanNewsUrl(link);
	if (!titleClean || !url) return null;
	return {
		feedName: feed.name,
		title: titleClean,
		url,
		summary: cleanNewsText(summary),
		publishedDate: normalizeNewsDate(pubDate),
	};
}

function parseAtomEntry(chunk: string, feed: SalesNewsFeed): SalesNewsItem | null {
	const titleText = xmlField(chunk, "title");
	const link = atomLink(chunk) || xmlField(chunk, "link");
	const summary = xmlField(chunk, "summary") || xmlField(chunk, "content");
	const pubDate = xmlField(chunk, "updated") || xmlField(chunk, "published");
	const titleClean = cleanNewsText(titleText);
	const url = cleanNewsUrl(link);
	if (!titleClean || !url) return null;
	return {
		feedName: feed.name,
		title: titleClean,
		url,
		summary: cleanNewsText(summary),
		publishedDate: normalizeNewsDate(pubDate),
	};
}

function xmlField(chunk: string, name: string): string {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = chunk.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
	if (!match) return "";
	return decodeXmlEntities(stripCdata(match[1] ?? ""));
}

function atomLink(chunk: string): string {
	const match =
		chunk.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i) ??
		chunk.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
	return match ? decodeXmlEntities(match[1] ?? "") : "";
}

function stripCdata(value: string): string {
	return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function cleanNewsText(value: string): string {
	return decodeXmlEntities(value)
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function decodeXmlEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
			String.fromCharCode(Number.parseInt(code, 16)),
		)
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

function cleanNewsUrl(value: string): string {
	const url = value.trim();
	if (!url) return "";
	try {
		return new URL(url).toString();
	} catch {
		return url;
	}
}

function normalizeNewsDate(value: string): string {
	const parsed = value ? new Date(value) : new Date();
	if (Number.isNaN(parsed.getTime())) return todayDateJST();
	return parsed.toISOString().slice(0, 10);
}

function scoreAndDeduplicateSalesNews(items: SalesNewsItem[]): ScoredSalesNewsItem[] {
	const seen = new Set<string>();
	const seenTopicTitles: string[] = [];
	const result: ScoredSalesNewsItem[] = [];
	for (const item of items) {
		const key = normalizeNewsUniqueKey(item.url, item.title);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		if (seenTopicTitles.some((titleText) => salesNewsTopicsSimilar(titleText, item.title))) {
			continue;
		}
		const scored = scoreSalesNewsItem(item);
		if (scored) {
			result.push(scored);
			seenTopicTitles.push(item.title);
		}
	}
	return result.sort((a, b) => b.score - a.score);
}

function normalizeNewsUniqueKey(url: string, titleText: string): string {
	const normalizedUrl = url
		.replace(/[?#].*$/, "")
		.replace(/^https?:\/\/(www\.)?/, "")
		.replace(/\/$/, "")
		.toLowerCase();
	const normalizedTitle = normalizeLookupText(titleText);
	return normalizedUrl || normalizedTitle;
}

function scoreSalesNewsItem(item: SalesNewsItem): ScoredSalesNewsItem | null {
	const body = `${item.title}\n${item.summary}\n${item.feedName}`;
	let score = 0;
	score += scoreByKeywords(body, [
		["系統用蓄電池", 40],
		["蓄電池", 28],
		["系統接続", 25],
		["接続検討", 18],
		["容量市場", 22],
		["電力市場", 20],
		["補助金", 25],
		["助成", 18],
		["制度改正", 22],
		["FIP", 18],
		["FIT", 12],
		["太陽光", 18],
		["再生可能エネルギー", 18],
		["再エネ", 18],
		["PPA", 16],
		["発電所", 15],
		["売買", 14],
		["用地", 14],
		["脱炭素", 12],
		["電力", 10],
	]);
	score += recencyScore(item.publishedDate);
	if (/芸能|スポーツ|ゲーム|暗号資産|占い/.test(body)) score -= 30;
	if (score < 10) return null;
	const category = inferSalesNewsCategory(body);
	const importance = score >= 70 ? "🔴 必読" : score >= 35 ? "🟡 参考" : "⚪ 情報";
	return {
		...item,
		score,
		category,
		importance,
			oneLine: buildSalesNewsOneLine(item, category),
		shouldCreateTalk: score >= 35,
	};
}

function scoreByKeywords(value: string, rules: Array<[string, number]>): number {
	return rules.reduce((total, [keyword, score]) => {
		return total + (value.toLowerCase().includes(keyword.toLowerCase()) ? score : 0);
	}, 0);
}

function salesNewsTopicsSimilar(a: string, b: string): boolean {
	const left = significantSalesNewsTokens(a);
	const right = significantSalesNewsTokens(b);
	if (left.length === 0 || right.length === 0) return false;
	const overlap = left.filter((token) => right.includes(token));
	return overlap.length >= 2;
}

function significantSalesNewsTokens(value: string): string[] {
	const body = value.replace(/\s+-\s+[^-]+$/, "");
	const fixedTokens = [
		"系統用蓄電池",
		"蓄電池",
		"系統接続",
		"接続検討",
		"容量市場",
		"需給調整市場",
		"電力調整市場",
		"電力市場",
		"補助金",
		"制度改正",
		"太陽光",
		"再生可能エネルギー",
		"再エネ",
		"PPA",
		"発電所",
		"プロロジス",
		"物流施設",
		"低圧",
		"用地",
		"脱炭素",
	];
	return uniqueStrings(
		fixedTokens.filter((token) => body.toLowerCase().includes(token.toLowerCase())),
	);
}

function recencyScore(dateText: string): number {
	const time = Date.parse(dateText);
	if (Number.isNaN(time)) return 5;
	const days = Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
	if (days <= 3) return 20;
	if (days <= 14) return 12;
	if (days <= 45) return 4;
	return -12;
}

function inferSalesNewsCategory(value: string): string {
	if (/蓄電池|系統|接続検討|容量市場|需給調整/.test(value)) return "🔋 蓄電池・系統";
	if (/補助金|助成|制度|税制|公募/.test(value)) return "💰 補助金・制度";
	if (/不動産|用地|土地|地権者|農地/.test(value)) return "🏗️ 不動産・用地";
	if (/市場|政策|法改正|省令|経産省|電力取引/.test(value)) return "📊 市場・政策";
	if (/太陽光|再生可能エネルギー|再エネ|PPA|発電所|脱炭素/.test(value)) {
		return "⚡ 電力・再エネ";
	}
	return "🌐 その他";
}

function buildSalesNewsOneLine(item: SalesNewsItem, category: string): string {
	const summary = item.summary || item.title;
	const hint = salesNewsTalkHint(category);
	return `営業メモ: ${summary.slice(0, 120)} / 使い方: ${hint}`;
}

function salesNewsTalkHint(category: string): string {
	if (category.includes("蓄電池")) {
		return "蓄電池案件で、系統・収益性・運用リスクを確認する入口に使う。";
	}
	if (category.includes("補助金")) {
		return "補助金ありきではなく、制度変更に耐える事業設計の話題に使う。";
	}
	if (category.includes("不動産")) {
		return "用地オーナーや仲介先に、土地の活用余地を聞く入口に使う。";
	}
	if (category.includes("市場")) {
		return "電力市場の変化を踏まえ、今の収益前提が古くないか確認する。";
	}
	return "初回の話題作りと、顧客の温度感確認に使う。";
}

async function salesNewsAlreadyExists(
	notion: NotionClient,
	item: ScoredSalesNewsItem,
): Promise<boolean> {
	try {
		const byUrl = await notion.dataSources.query({
			data_source_id: NEWS_DATA_SOURCE_ID,
			page_size: 1,
			filter: { property: "記事URL", url: { equals: item.url } },
		});
		if (byUrl.results.length > 0) return true;
	} catch (error) {
		console.log("news url lookup skipped", String(error));
	}
	try {
		const titlePrefix = item.title.slice(0, 40);
		if (!titlePrefix) return false;
		const byTitle = await notion.dataSources.query({
			data_source_id: NEWS_DATA_SOURCE_ID,
			page_size: 5,
			filter: { property: "タイトル", title: { contains: titlePrefix } },
		});
		const normalized = normalizeLookupText(item.title);
		return byTitle.results.some((page) => {
			const existingTitle = text(page.properties?.["タイトル"]);
			return normalizeLookupText(existingTitle) === normalized;
		});
	} catch (error) {
		console.log("news title lookup skipped", String(error));
		return false;
	}
}

async function createSalesNewsPage(
	notion: NotionClient,
	item: ScoredSalesNewsItem,
	autoGenerateTalk: boolean,
): Promise<Page> {
	const created = await notion.pages.create({
		parent: { data_source_id: NEWS_DATA_SOURCE_ID },
		properties: {
			タイトル: title(item.title),
		},
	});
	const fullPage = await notion.pages.retrieve({ page_id: created.id });
	const patches: Record<string, SafePatch> = {
		記事URL: { kind: "text", value: item.url },
		投稿日: { kind: "date", value: item.publishedDate || todayDateJST() },
		ひとこと: { kind: "text", value: item.oneLine },
		カテゴリー: { kind: "select", value: item.category },
		重要度: { kind: "select", value: item.importance },
		トーク作成: { kind: "checkbox", value: item.shouldCreateTalk },
		トーク化ステータス: { kind: "select", value: "未" },
	};
	if (autoGenerateTalk) {
		patches["営業トーク（生成）"] = {
			kind: "text",
			value: buildSalesTalkSeedFromNews(item),
		};
	}
	await safeUpdateExistingProperties(notion, fullPage, patches);
	return notion.pages.retrieve({ page_id: created.id });
}

function buildSalesTalkSeedFromNews(item: ScoredSalesNewsItem): string {
	const hint = salesNewsTalkHint(item.category);
	return [
		`元ニュース: ${item.title}`,
		`カテゴリ: ${item.category}`,
		`記事URL: ${item.url}`,
		`要点: ${item.summary || item.oneLine}`,
		"",
		"営業トーク案1: 最近このテーマが動いています。蓄電池や太陽光の判断は、制度・系統・収益前提が少し変わるだけで結論が変わります。御社の今の前提は、最新状況で一度見直せていますか。",
		`営業トーク案2: ${hint} 今すぐ売り込むというより、まずは今の課題と判断材料が古くなっていないかを一緒に確認したいです。`,
		"想定反論: まだ急いでいない。 / 切り返し: 急いで契約する必要はありません。ただ、先に条件だけ見ておくと、制度や系統の変化が出た時に判断が早くなります。",
		"次アクション: 関連する案件・用地・企業の状況を聞き、必要なら商談準備ブリーフや提案材料につなげる。",
	].join("\n").slice(0, 1800);
}

// ── 営業トーク自動生成エージェント：管理DB仕上げ ───────────────────────────────

async function processSalesTalkFinalize(
	input: SalesTalkFinalizeInput,
	notion: NotionClient,
): Promise<SalesTalkFinalizeResult> {
	const newsPage = await notion.pages.retrieve({ page_id: input.newsPageId });
	const news = readSalesTalkNews(newsPage);

	if (news.generatedTalk.replace(/\s/g, "").length < 120) {
		return {
			newsPageId: input.newsPageId,
			action: "needs-review",
			updated: 0,
			created: 0,
			message:
				"ニュース側の営業トーク生成文が不足しているため、営業トーク管理DBへの仕上げは行いませんでした。",
		};
	}

	let aiResponse: SalesTalkFinalizeAIResponse;
	try {
		aiResponse = await callAnthropicSalesTalkFinalize(news);
	} catch (error) {
		return {
			newsPageId: input.newsPageId,
			action: "error",
			updated: 0,
			created: 0,
			message: `営業トーク仕上げAIの生成に失敗しました: ${String(error).slice(0, 300)}`,
		};
	}

	const drafts = normalizeSalesTalkDrafts(aiResponse.talks);
	if (aiResponse.status !== "作成候補あり" || drafts.length === 0) {
		return {
			newsPageId: input.newsPageId,
			action: "needs-review",
			updated: 0,
			created: 0,
			message:
				aiResponse.memo ||
				"営業トーク管理DBへ展開できる明確なトーク候補がないため停止しました。",
		};
	}

	const existingTalks = await findSalesTalkPagesByNews(notion, news.page.id);
	const planned = matchSalesTalkDrafts(news, drafts, existingTalks);
	const updateCount = planned.filter((item) => item.page).length;
	const createCount = planned.length - updateCount;

	if (input.dryRun) {
		return {
			newsPageId: input.newsPageId,
			action: "dry-run",
			updated: updateCount,
			created: createCount,
			message: [
				`dry-run: 営業トーク候補 ${planned.length} 件。`,
				`既存更新予定 ${updateCount} 件、新規作成予定 ${createCount} 件。`,
				`候補: ${planned.map((item) => item.draft.title).join(" / ")}`,
			].join(""),
		};
	}

	let updated = 0;
	let created = 0;
	const touchedUrls: string[] = [];
	for (const item of planned) {
		if (item.page) {
			await updateSalesTalkPageFromDraft(notion, news, item.page, item.draft);
			updated += 1;
			if (item.page.page.url) touchedUrls.push(item.page.page.url);
			continue;
		}
		const createdPage = await createSalesTalkPageFromDraft(notion, news, item.draft);
		created += 1;
		if (createdPage.url) touchedUrls.push(createdPage.url);
	}

	await safeUpdateExistingProperties(notion, news.page, {
		トーク化ステータス: { kind: "select", value: "作成済" },
		トーク化日: { kind: "date", value: todayDateJST() },
		営業トーク管理DB: { kind: "text", value: touchedUrls[0] ?? "" },
	});

	return {
		newsPageId: input.newsPageId,
		action: "finalized",
		updated,
		created,
		message: `営業トーク管理DBを仕上げました。更新 ${updated} 件、新規作成 ${created} 件。ニュース側生成文は正本として残しています。`,
	};
}

function readSalesTalkNews(page: Page): SalesTalkNewsInfo {
	const properties = page.properties ?? {};
	return {
		page,
		title: text(properties["タイトル"]) || text(properties["Name"]) || page.id,
		category: text(properties["カテゴリー"]),
		importance: text(properties["重要度"]),
		oneLine: text(properties["ひとこと"]),
		articleUrl: text(properties["記事URL"]),
		generatedTalk: text(properties["営業トーク（生成）"]),
	};
}

async function callAnthropicSalesTalkFinalize(
	news: SalesTalkNewsInfo,
): Promise<SalesTalkFinalizeAIResponse> {
	const systemPrompt = [
		"あなたは和上ホールディングスの営業トーク整形AIです。",
		"業界ニュースDBに既に生成された営業トーク本文を読み、営業マンがそのまま使える営業トーク管理DB用の3ネタに分割します。",
		"",
		"重要ルール:",
		"- 新しい外部事実を足さない。入力文にある内容を整形する",
		"- 最大3件。入力に3ネタある場合は3件に分ける",
		"- 各トークは、つかみ、セリフ本文、刺さる相手、想定反論と切り返し、次アクションを必ず分ける",
		"- セリフ本文は営業マンが口に出せる短い話し言葉にする",
		"- 用途は 話題作り / 初回つかみ / 反論返し / クロージング前 / 関係構築 から選ぶ",
		"- 品質が低い、または情報不足なら status は 要修正 にする",
		"- チームトラッカー、商談管理DB、企業DBは更新しない。ここでは営業トーク管理DB用の構造化だけを行う",
		"",
		"必ずJSONのみを返してください。",
	].join("\n");

	const payload = [
		"=== ニュース ===",
		`タイトル: ${news.title}`,
		`カテゴリー: ${news.category || "未設定"}`,
		`重要度: ${news.importance || "未設定"}`,
		`ひとこと: ${news.oneLine || "未入力"}`,
		`記事URL: ${news.articleUrl || "未入力"}`,
		"",
		"=== 営業トーク生成文 ===",
		news.generatedTalk,
	].join("\n").slice(0, 12000);

	const raw = await callAnthropicChat({
		system: systemPrompt,
		user: payload,
		maxTokens: 4000,
		temperature: 0,
		jsonSchema: SALES_TALK_FINALIZE_RESPONSE_FORMAT,
	});
	return parseSalesTalkFinalizeAIResponse(raw);
}

function parseSalesTalkFinalizeAIResponse(raw: string): SalesTalkFinalizeAIResponse {
	try {
		const parsed = JSON.parse(raw) as Partial<SalesTalkFinalizeAIResponse>;
		const status =
			parsed.status === "作成候補あり" ||
			parsed.status === "要確認" ||
			parsed.status === "対象外"
				? parsed.status
				: "要確認";
		return {
			status,
			memo: typeof parsed.memo === "string" ? parsed.memo : "",
			talks: Array.isArray(parsed.talks)
				? parsed.talks
						.map(normalizeSalesTalkDraft)
						.filter((talk): talk is SalesTalkDraft => Boolean(talk))
				: [],
		};
	} catch (error) {
		console.log("parseSalesTalkFinalizeAIResponse failed", String(error));
		return {
			status: "要確認",
			memo: `JSONパース失敗: ${raw.slice(0, 200)}`,
			talks: [],
		};
	}
}

function normalizeSalesTalkDrafts(talks: SalesTalkDraft[]): SalesTalkDraft[] {
	const seen = new Set<string>();
	const result: SalesTalkDraft[] = [];
	for (const raw of talks) {
		const talk = normalizeSalesTalkDraft(raw);
		if (!talk) continue;
		const key = normalizeSalesTalkTitle(talk.title || talk.hook);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		result.push(talk);
	}
	return result.slice(0, 3);
}

function normalizeSalesTalkDraft(raw: Partial<SalesTalkDraft>): SalesTalkDraft | null {
	const titleText = typeof raw.title === "string" ? raw.title.trim() : "";
	const hook = typeof raw.hook === "string" ? raw.hook.trim() : "";
	const script = typeof raw.script === "string" ? raw.script.trim() : "";
	const target = typeof raw.target === "string" ? raw.target.trim() : "";
	const objectionHandling =
		typeof raw.objectionHandling === "string" ? raw.objectionHandling.trim() : "";
	const nextAction =
		typeof raw.nextAction === "string" ? raw.nextAction.trim() : "";
	if ((titleText + hook + script).replace(/\s/g, "").length < 40) return null;
	const usage = Array.isArray(raw.usage)
		? raw.usage.filter((item) =>
				[
					"話題作り",
					"初回つかみ",
					"反論返し",
					"クロージング前",
					"関係構築",
				].includes(item),
			)
		: [];
	const importance =
		raw.importance === "🔴 必ず使う" ||
		raw.importance === "🟡 余裕あれば" ||
		raw.importance === "⚪ ストック"
			? raw.importance
			: "🟡 余裕あれば";
	const status = raw.status === "使える" ? "使える" : "要修正";
	return {
		title: (titleText || hook || "営業トーク候補").slice(0, 120),
		hook: (hook || titleText).slice(0, 240),
		script: (script || hook || titleText).slice(0, 1400),
		target: (target || "刺さる相手要確認").slice(0, 800),
		objectionHandling: (objectionHandling || "想定反論・切り返し要確認").slice(0, 1000),
		nextAction: (nextAction || "次アクション要確認").slice(0, 800),
		usage: usage.length > 0 ? usage.slice(0, 3) : ["話題作り"],
		importance,
		status,
		memo:
			typeof raw.memo === "string" && raw.memo.trim()
				? raw.memo.trim().slice(0, 800)
				: "ニュース側生成文を営業トーク管理DB向けに整形。",
	};
}

async function findSalesTalkPagesByNews(
	notion: NotionClient,
	newsPageId: string,
): Promise<SalesTalkPageInfo[]> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: SALES_TALK_DATA_SOURCE_ID,
			page_size: 20,
			filter: {
				property: "元ニュース",
				relation: { contains: newsPageId },
			},
		});
		return response.results.map(readSalesTalkPage);
	} catch (error) {
		console.log("sales talk lookup skipped", String(error));
		return [];
	}
}

function readSalesTalkPage(page: Page): SalesTalkPageInfo {
	const properties = page.properties ?? {};
	return {
		page,
		title: text(properties["トーク名"]),
		hook: text(properties["つかみ（1行）"]),
		script: text(properties["セリフ（トーク本文）"]),
		target: text(properties["刺さる相手"]),
		objectionHandling: text(properties["想定反論→切り返し"]),
		nextAction: text(properties["次アクション（提案/質問）"]),
	};
}

function matchSalesTalkDrafts(
	news: SalesTalkNewsInfo,
	drafts: SalesTalkDraft[],
	existingTalks: SalesTalkPageInfo[],
): Array<{ draft: SalesTalkDraft; page?: SalesTalkPageInfo }> {
	const used = new Set<string>();
	return drafts.map((draft, index) => {
		const draftKey = normalizeSalesTalkTitle(draft.title);
		const direct = existingTalks.find((talk) => {
			if (used.has(talk.page.id)) return false;
			const titleKey = normalizeSalesTalkTitle(talk.title);
			const hookKey = normalizeSalesTalkTitle(talk.hook);
			return (
				(titleKey && (titleKey === draftKey || titleKey.includes(draftKey))) ||
				(hookKey && (hookKey === draftKey || draftKey.includes(hookKey)))
			);
		});
		if (direct) {
			used.add(direct.page.id);
			return { draft, page: direct };
		}
		if (index === 0) {
			const placeholder = existingTalks.find((talk) => {
				if (used.has(talk.page.id)) return false;
				return isPlaceholderSalesTalkPage(news, talk);
			});
			if (placeholder) {
				used.add(placeholder.page.id);
				return { draft, page: placeholder };
			}
		}
		return { draft };
	});
}

function isPlaceholderSalesTalkPage(
	news: SalesTalkNewsInfo,
	talk: SalesTalkPageInfo,
): boolean {
	const titleKey = normalizeSalesTalkTitle(talk.title);
	const newsKey = normalizeSalesTalkTitle(news.title);
	const hasDetails = [talk.script, talk.target, talk.objectionHandling, talk.nextAction].some(
		(value) => value.replace(/\s/g, "").length > 0,
	);
	return !hasDetails && (!titleKey || titleKey === newsKey || newsKey.includes(titleKey));
}

async function createSalesTalkPageFromDraft(
	notion: NotionClient,
	news: SalesTalkNewsInfo,
	draft: SalesTalkDraft,
): Promise<Page> {
	const created = await notion.pages.create({
		parent: { data_source_id: SALES_TALK_DATA_SOURCE_ID },
		properties: {
			トーク名: title(draft.title),
		},
	});
	const fullPage = await notion.pages.retrieve({ page_id: created.id });
	await updateSalesTalkPageFromDraft(notion, news, readSalesTalkPage(fullPage), draft);
	return notion.pages.retrieve({ page_id: created.id });
}

async function updateSalesTalkPageFromDraft(
	notion: NotionClient,
	news: SalesTalkNewsInfo,
	talk: SalesTalkPageInfo,
	draft: SalesTalkDraft,
): Promise<void> {
	const properties = talk.page.properties ?? {};
	const patches: Record<string, SafePatch> = {};
	addSelectPatchIfBlankOrValues(patches, properties, "カテゴリ", news.category || "🔋 蓄電池・系統", []);
	addSelectPatchIfBlankOrValues(patches, properties, "ステータス", draft.status, ["下書き"]);
	addSelectPatchIfBlankOrValues(patches, properties, "実戦ログ由来", "記事起点", []);
	addSelectPatchIfBlankOrValues(patches, properties, "実戦反映ステータス", "未使用", []);
	addMultiSelectPatchIfBlank(patches, properties, "用途", draft.usage);
	addSelectPatchIfBlankOrValues(patches, properties, "重要度", draft.importance, []);
	addDatePatchIfBlank(patches, properties, "作成日", todayDateJST());
	const currentNewsIds = relationIdsFromProperty(properties["元ニュース"]);
	if (!currentNewsIds.includes(news.page.id)) {
		patches["元ニュース"] = {
			kind: "relation",
			ids: [...currentNewsIds, news.page.id],
		};
	}
	addPatchIfBlankOrPlaceholder(patches, properties, "トーク名", draft.title, [
		news.title,
	]);
	addPatchIfBlankOrPlaceholder(patches, properties, "トーク名（自動）", draft.title, [
		news.title,
	]);
	addPatchIfBlankOrPlaceholder(patches, properties, "つかみ（1行）", draft.hook, [
		news.title,
	]);
	addPatchIfBlank(patches, properties, "セリフ（トーク本文）", draft.script);
	addPatchIfBlank(patches, properties, "刺さる相手", draft.target);
	addPatchIfBlank(patches, properties, "想定反論→切り返し", draft.objectionHandling);
	addPatchIfBlank(patches, properties, "次アクション（提案/質問）", draft.nextAction);
	addPatchIfBlank(
		patches,
		properties,
		"改善メモ",
		[
			"Worker仕上げ済み。",
			`元ニュース: ${news.title}`,
			`整形メモ: ${draft.memo}`,
			"ニュース側の営業トーク（生成）を正本として、管理DBの実戦項目へ分割転記。",
		].join("\n"),
	);
	await safeUpdateExistingProperties(notion, talk.page, patches);
}

function addPatchIfBlankOrPlaceholder(
	patches: Record<string, SafePatch>,
	properties: Record<string, unknown>,
	name: string,
	value: string,
	placeholders: string[],
): void {
	if (!value) return;
	const current = text(properties[name]);
	if (!current || isPlaceholderTalkValue(current, placeholders)) {
		patches[name] = { kind: "text", value };
	}
}

function addSelectPatchIfBlankOrValues(
	patches: Record<string, SafePatch>,
	properties: Record<string, unknown>,
	name: string,
	value: string,
	replaceableValues: string[],
): void {
	if (!value) return;
	const current = text(properties[name]);
	if (!current || replaceableValues.includes(current)) {
		patches[name] = { kind: "select", value };
	}
}

function addMultiSelectPatchIfBlank(
	patches: Record<string, SafePatch>,
	properties: Record<string, unknown>,
	name: string,
	values: string[],
): void {
	if (values.length === 0) return;
	if (!text(properties[name])) {
		patches[name] = { kind: "multi_select", values };
	}
}

function addDatePatchIfBlank(
	patches: Record<string, SafePatch>,
	properties: Record<string, unknown>,
	name: string,
	value: string,
): void {
	if (!value) return;
	if (!dateStartFromProperty(properties[name])) {
		patches[name] = { kind: "date", value };
	}
}

function isPlaceholderTalkValue(value: string, placeholders: string[]): boolean {
	const current = normalizeSalesTalkTitle(value);
	if (!current) return true;
	return placeholders
		.map(normalizeSalesTalkTitle)
		.filter(Boolean)
		.some((placeholder) => current === placeholder || placeholder.includes(current));
}

function normalizeSalesTalkTitle(value: string): string {
	return value
		.toLowerCase()
		.replace(/【[^】]*】/g, "")
		.replace(/ネタ\s*\d+/g, "")
		.replace(/[「」『』（）()［］\[\]〈〉<>]/g, "")
		.replace(/[\s　・･\-ー＿_.,，。:：/／|｜]/g, "")
		.trim();
}

function todayDateJST(): string {
	return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function taskTitlesSimilar(a: string, b: string): boolean {
	const left = normalizeTaskTitle(a);
	const right = normalizeTaskTitle(b);
	if (!left || !right) return false;
	if (left === right || left.includes(right) || right.includes(left)) return true;
	const leftTokens = significantTaskTokens(left);
	const rightTokens = significantTaskTokens(right);
	const overlap = leftTokens.filter((token) => rightTokens.includes(token));
	return overlap.length >= Math.min(2, leftTokens.length, rightTokens.length);
}

function normalizeTaskTitle(value: string): string {
	return value
		.toLowerCase()
		.replace(/【[^】]*】/g, "")
		.replace(/[「」『』（）()［］\[\]〈〉<>]/g, "")
		.replace(/を?(する|行う|実施する|確認する|作成する|送る|打診する)$/g, "")
		.replace(/[\s　・･\-ー＿_.,，。:：/／|｜]/g, "")
		.trim();
}

function significantTaskTokens(value: string): string[] {
	const tokens = [
		"決裁者",
		"同席",
		"打診",
		"提案資料",
		"見積",
		"返金条件",
		"フォローメール",
		"日程",
		"候補",
		"確認",
		"作成",
		"送付",
		"資料",
		"条件",
		"次回",
	];
	return tokens.filter((token) => value.includes(token));
}

function isISODateOnly(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function extractDealPageIdFromWebhook(body: Record<string, unknown>): string | undefined {
	return firstString(
		body.dealPageId,
		body.deal_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "dealPageId"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function extractNewsPageIdFromWebhook(body: Record<string, unknown>): string | undefined {
	return firstString(
		body.newsPageId,
		body.news_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "newsPageId"]),
		readNestedString(body, ["data", "news_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function extractInquiryPageIdFromWebhook(body: Record<string, unknown>): string | undefined {
	return firstString(
		body.inquiryPageId,
		body.inquiry_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "inquiryPageId"]),
		readNestedString(body, ["data", "inquiry_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function extractDailyReportReceiptPageIdFromWebhook(
	body: Record<string, unknown>,
): string | undefined {
	return firstString(
		body.receiptPageId,
		body.receipt_page_id,
		body.dailyReportReceiptPageId,
		body.daily_report_receipt_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "receiptPageId"]),
		readNestedString(body, ["data", "receipt_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function extractDailyReportPageIdFromWebhook(
	body: Record<string, unknown>,
): string | undefined {
	return firstString(
		body.dailyReportPageId,
		body.daily_report_page_id,
		body.reportPageId,
		body.report_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "dailyReportPageId"]),
		readNestedString(body, ["data", "daily_report_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function extractMeetingPageIdFromWebhook(body: Record<string, unknown>): string | undefined {
	return firstString(
		body.meetingPageId,
		body.meeting_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "meetingPageId"]),
		readNestedString(body, ["data", "meeting_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function extractManagerReviewPageIdFromWebhook(
	body: Record<string, unknown>,
): string | undefined {
	return firstString(
		body.managerReviewPageId,
		body.manager_review_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "managerReviewPageId"]),
		readNestedString(body, ["data", "manager_review_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function extractSalesPerformancePageIdFromWebhook(
	body: Record<string, unknown>,
): string | undefined {
	return firstString(
		body.salesPerformancePageId,
		body.sales_performance_page_id,
		body.performancePageId,
		body.performance_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "salesPerformancePageId"]),
		readNestedString(body, ["data", "sales_performance_page_id"]),
		readNestedString(body, ["data", "performancePageId"]),
		readNestedString(body, ["data", "performance_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function extractMonthlyEvalPageIdFromWebhook(
	body: Record<string, unknown>,
): string | undefined {
	return firstString(
		body.evalPageId,
		body.eval_page_id,
		body.monthlyEvalPageId,
		body.monthly_eval_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "evalPageId"]),
		readNestedString(body, ["data", "eval_page_id"]),
		readNestedString(body, ["data", "monthlyEvalPageId"]),
		readNestedString(body, ["data", "monthly_eval_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function extractResidentDocumentPageIdFromWebhook(
	body: Record<string, unknown>,
): string | undefined {
	return firstString(
		body.residentPageId,
		body.resident_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "residentPageId"]),
		readNestedString(body, ["data", "resident_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function extractProposalSimulationPageIdFromWebhook(
	body: Record<string, unknown>,
): string | undefined {
	return firstString(
		body.proposalPageId,
		body.proposal_page_id,
		body.simulationPageId,
		body.simulation_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "proposalPageId"]),
		readNestedString(body, ["data", "proposal_page_id"]),
		readNestedString(body, ["data", "simulationPageId"]),
		readNestedString(body, ["data", "simulation_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

// ── 土地評価 ──────────────────────────────────────────────────────────────────

function readLand(page: Page): LandInfo {
	const properties = page.properties ?? {};
	const address =
		text(properties["所在地"]) ||
		text(properties["住所"]) ||
		text(properties["土地所在地"]);
	const areaTsubo =
		numberValue(properties["面積（坪）"]) ??
		numberValue(properties["面積"]) ??
		numberFromText(text(properties["面積（坪）"]) || text(properties["面積"]));
	const powerArea =
		text(properties["電力会社エリア"]) || inferPowerAreaFromAddress(address);
	const substationDistanceKm =
		numberValue(properties["変電所距離（km）"]) ??
		numberValue(properties["変電所距離"]) ??
		numberValue(properties["系統距離"]) ??
		distanceKmFromText(
			text(properties["変電所距離（km）"]) ||
				text(properties["変電所距離"]) ||
				text(properties["系統距離"]) ||
				text(properties["最寄り変電所距離"]),
		);

	return {
		page,
		name:
			text(properties["土地名称"]) ||
			text(properties["名前"]) ||
			text(properties["Name"]) ||
			"土地候補",
		address,
		areaTsubo,
		powerArea,
		landUse: text(properties["用途地域"]),
		road:
			text(properties["接道"]) ||
			text(properties["接道状況"]) ||
			text(properties["道路状況"]),
		farmland:
			text(properties["農地転用可否"]) ||
			text(properties["農転/登記/近隣確認"]) ||
			text(properties["農地判定"]) ||
			text(properties["登記確認"]),
		farmlandType: text(properties["農地種別"]),
		registry:
			text(properties["登記確認状況"]) ||
			text(properties["登記確認"]) ||
			text(properties["農転/登記/近隣確認"]),
		nearbyResidentialDistanceM:
			numberValue(properties["近隣住宅距離（m）"]) ??
			numberValue(properties["近隣住宅距離"]) ??
			numberFromText(text(properties["近隣住宅距離（m）"]) || text(properties["近隣住宅距離"])),
		nearbyResidentialCheck: text(properties["近隣住宅確認"]),
		transmissionLine: text(properties["送電線の有無"]),
		substationDistance:
			(substationDistanceKm !== null ? `${substationDistanceKm}km` : "") ||
			text(properties["変電所距離（km）"]) ||
			text(properties["変電所距離"]) ||
			text(properties["系統距離"]) ||
			text(properties["最寄り変電所距離"]),
		substationDistanceKm,
		latitude:
			numberValue(properties["緯度"]) ??
			numberValue(properties["latitude"]) ??
			numberValue(properties["Latitude"]) ??
			placeCoordinate(properties["GPS情報"], "lat") ??
			numberFromText(text(properties["緯度"]) || text(properties["latitude"])),
		longitude:
			numberValue(properties["経度"]) ??
			numberValue(properties["longitude"]) ??
			numberValue(properties["Longitude"]) ??
			placeCoordinate(properties["GPS情報"], "lon") ??
			numberFromText(text(properties["経度"]) || text(properties["longitude"])),
	};
}

function shouldProcessLand(land: LandInfo): boolean {
	return Boolean(land.address && land.areaTsubo && land.areaTsubo > 0);
}

type LandMapContext = {
	latitude: number | null;
	longitude: number | null;
	googleMapsUrl: string;
	roadAccess: string;
	geocodeSource: string;
	geocodeCandidateRequiresReview: boolean;
	farmlandNavi: LandFarmlandNaviContext;
	surroundingPlaces: LandSurroundingPlacesContext;
	reinfolib: LandReinfolibContext;
	parcelCadastre: LandParcelCadastreContext;
	gsiRoad: LandGsiRoadContext;
	gridCapacity: LandGridCapacityContext;
};

type LandFarmlandNaviRecord = {
	address: string;
	landCategory: string;
	area: number | null;
	agriculturalClassification: string;
	cityPlanningClassification: string;
	ownerIntention: string;
	rightClassification: string;
	idleStatus: string;
	jurisdictionAgricultureCommitteeName: string;
	latitude: number | null;
	longitude: number | null;
	distanceM: number | null;
};

type LandFarmlandFieldPolygonCandidate = {
	fieldPolygonId: string;
	cityCode: string;
	landCategory: string;
	area: number | null;
	geometryType: string;
	sourceUrl: string;
};

type LandFarmlandNaviContext = {
	status: "connected" | "no-token" | "no-coordinate" | "no-result" | "error";
	source: string;
	message: string;
	records: LandFarmlandNaviRecord[];
	nearest: LandFarmlandNaviRecord | null;
	fieldPolygons: LandFarmlandFieldPolygonCandidate[];
};

type LandSurroundingPlaceCandidate = {
	name: string;
	primaryType: string;
	categoryLabel: string;
	formattedAddress: string;
	latitude: number | null;
	longitude: number | null;
	distanceM: number | null;
	googleMapsUri: string;
};

type LandSurroundingPlacesContext = {
	status: "connected" | "no-key" | "no-coordinate" | "no-result" | "error";
	source: string;
	message: string;
	places: LandSurroundingPlaceCandidate[];
};

type LandParcelCadastreCandidate = {
	municipality: string;
	oaza: string;
	koaza: string;
	lotNumber: string;
	mapType: string;
	accuracy: string;
	sourceUrl: string;
	confirmationUrl: string;
};

type LandParcelCadastreContext = {
	status: "connected" | "no-url" | "no-coordinate" | "no-result" | "error";
	source: string;
	message: string;
	candidates: LandParcelCadastreCandidate[];
};

type LandGsiRoadCandidate = {
	name: string;
	category: string;
	widthRank: string;
	widthEstimateM: number | null;
	distanceM: number;
	sourceUrl: string;
};

type LandGsiRoadContext = {
	status: "connected" | "no-coordinate" | "no-result" | "error";
	source: string;
	message: string;
	candidates: LandGsiRoadCandidate[];
};

type LandGridCapacityRecord = {
	powerArea: string;
	operator: string;
	facilityName: string;
	voltageKv: number | null;
	availableCapacityMw: number | null;
	status: string;
	nMinusOne: string;
	updatedAt: string;
	sourceUrl: string;
};

type LandGridCapacityOfficialLink = {
	label: string;
	url: string;
};

type LandGridCapacityContext = {
	status: "connected" | "no-url" | "no-result" | "error";
	source: string;
	message: string;
	powerArea: string;
	officialLinks: LandGridCapacityOfficialLink[];
	records: LandGridCapacityRecord[];
};

type LandReinfolibPricePoint = {
	cityCode: string;
	targetYear: string;
	useCategory: string;
	location: string;
	priceYenPerSqm: number | null;
	yearOnYearChangeRate: string;
	distanceM: number | null;
};

type LandReinfolibZoning = {
	cityCode: string;
	cityName: string;
	useArea: string;
	buildingCoverageRatio: string;
	floorAreaRatio: string;
};

type LandReinfolibHazardRisk = {
	apiId: string;
	label: string;
	detail: string;
};

type LandReinfolibTransactionSummary = {
	cityCode: string;
	count: number;
	medianUnitPriceYenPerSqm: number | null;
	sampleDistricts: string[];
};

type LandReinfolibContext = {
	status: "connected" | "no-token" | "no-coordinate" | "no-result" | "error";
	source: string;
	message: string;
	landPrice: LandReinfolibPricePoint | null;
	zoning: LandReinfolibZoning | null;
	hazards: LandReinfolibHazardRisk[];
	transactionSummary: LandReinfolibTransactionSummary | null;
	referencePriceRange: string;
};

async function resolveLandMapContext(land: LandInfo): Promise<LandMapContext> {
	const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || "";
	let latitude = land.latitude;
	let longitude = land.longitude;
	let geocodeSource = "";
	let geocodeCandidateRequiresReview = false;
	let roadAccess = "";

	if ((latitude === null || longitude === null) && land.address) {
		const googleGeocoded = key ? await geocodeLandAddress(land.address, key) : null;
		const gsiGeocoded = googleGeocoded ? null : await geocodeLandAddressByGsi(land.address);
		const geocoded = googleGeocoded || gsiGeocoded;
		if (geocoded) {
			latitude = geocoded.latitude;
			longitude = geocoded.longitude;
			geocodeSource = googleGeocoded
				? "Google Geocoding API"
				: `国土地理院住所検索（住所候補: ${gsiGeocoded?.title || "名称未取得"} / 正式住所・地番の確定結果ではない）`;
			geocodeCandidateRequiresReview = Boolean(gsiGeocoded && !googleGeocoded);
		}
	}

	if (latitude !== null && longitude !== null && key && !land.road) {
		roadAccess = await fetchGoogleRoadAccess(latitude, longitude, key);
	}

	const farmlandNavi = await fetchFarmlandNaviContext(latitude, longitude);
	const surroundingPlaces = await fetchGoogleSurroundingPlacesContext(latitude, longitude, key);
	const reinfolib = await fetchReinfolibContext(latitude, longitude, land.areaTsubo);
	const parcelCadastre = await fetchParcelCadastreContext(latitude, longitude);
	const gsiRoad = await fetchGsiRoadContext(latitude, longitude);
	const powerArea = land.powerArea || inferPowerAreaFromAddress(land.address) || "未確認";
	const gridCapacity = await fetchGridCapacityContext(powerArea);

	return {
		latitude,
		longitude,
		googleMapsUrl:
			latitude !== null && longitude !== null
				? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
				: "",
		roadAccess,
		geocodeSource,
		geocodeCandidateRequiresReview,
		farmlandNavi,
		surroundingPlaces,
		reinfolib,
		parcelCadastre,
		gsiRoad,
		gridCapacity,
	};
}

async function fetchFarmlandNaviContext(
	latitude: number | null,
	longitude: number | null,
): Promise<LandFarmlandNaviContext> {
	const source = "WAGRI農地API / eMAFF農地ナビ連携データ";
	if (latitude === null || longitude === null) {
		return {
			status: "no-coordinate",
			source,
			message: "農地ナビ接続: 未実行（緯度経度なし）",
			records: [],
			nearest: null,
			fieldPolygons: [],
		};
	}
	const token = process.env.WAGRI_ACCESS_TOKEN || process.env.WAGRI_API_TOKEN || process.env.WAGRI_TOKEN || "";
	if (!token) {
		return {
			status: "no-token",
			source,
			message: "農地ナビ接続: 未接続（WAGRI_ACCESS_TOKEN未設定）",
			records: [],
			nearest: null,
			fieldPolygons: [],
		};
	}

	const delta = 0.0025;
	const url = new URL("https://api.wagri2.net/basic/farmland/AgriculturalLand/SearchByLongitudeLatitude");
	url.searchParams.set("minLatitude", String(latitude - delta));
	url.searchParams.set("maxLatitude", String(latitude + delta));
	url.searchParams.set("minLongitude", String(longitude - delta));
	url.searchParams.set("maxLongitude", String(longitude + delta));

	const body = await fetchJsonWithHeaders(url, { "X-Authorization": token });
	if (!Array.isArray(body)) {
		return {
			status: "error",
			source,
			message: "農地ナビ接続: 取得失敗（WAGRI農地APIの応答を解析できません）",
			records: [],
			nearest: null,
			fieldPolygons: [],
		};
	}

	const records = body
		.map((item) => readFarmlandNaviRecord(item, latitude, longitude))
		.filter((record): record is LandFarmlandNaviRecord => record !== null)
		.sort((a, b) => (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY))
		.slice(0, 10);
	const nearest = records[0] ?? null;
	const fieldPolygons = await fetchFarmlandFieldPolygonCandidates(latitude, longitude, token);
	return {
		status: records.length > 0 || fieldPolygons.length > 0 ? "connected" : "no-result",
		source,
		message:
			records.length > 0 || fieldPolygons.length > 0
				? `農地ナビ接続: WAGRI農地API 取得成功（農地ピン${records.length}件 / ID付与済み筆ポリゴン取得API v3 ${fieldPolygons.length}件）`
				: "農地ナビ接続: WAGRI農地API 取得0件",
		records,
		nearest,
		fieldPolygons,
	};
}

function readFarmlandNaviRecord(
	value: unknown,
	originLatitude: number,
	originLongitude: number,
): LandFarmlandNaviRecord | null {
	const item = readObject(value);
	const latitude = numberOrNull(item.Latitude);
	const longitude = numberOrNull(item.Longitude);
	const area = numberOrNull(item.Area);
	const address = stringOrBlank(item.Address);
	const landCategory = stringOrBlank(item.LandCategory);
	const agriculturalClassification = stringOrBlank(item.AgriculturalVibrationMethodClassification);
	const cityPlanningClassification = stringOrBlank(item.CityPlanningActClassification);
	if (!address && !landCategory && !agriculturalClassification && !cityPlanningClassification) return null;
	return {
		address,
		landCategory,
		area,
		agriculturalClassification,
		cityPlanningClassification,
		ownerIntention: stringOrBlank(item.IntentionOwnerAgriculturalLand),
		rightClassification: stringOrBlank(item.RightClassification),
		idleStatus: stringOrBlank(item.IsIdleAgriculturalLand),
		jurisdictionAgricultureCommitteeName: stringOrBlank(item.JurisdictionAgricultureCommitteeName),
		latitude,
		longitude,
		distanceM:
			latitude !== null && longitude !== null
				? Math.round(distanceMetersBetween(originLatitude, originLongitude, latitude, longitude))
				: null,
	};
}

async function fetchFarmlandFieldPolygonCandidates(
	latitude: number,
	longitude: number,
	token: string,
): Promise<LandFarmlandFieldPolygonCandidate[]> {
	const url = new URL("https://api.wagri2.net/basic/farmland/FieldPolygonID3/Get");
	url.searchParams.set("lat", String(latitude));
	url.searchParams.set("lng", String(longitude));
	url.searchParams.set("cmp", "1");
	const body = await fetchJsonWithHeaders(url, { "X-Authorization": token });
	if (!body) return [];
	return farmlandFieldPolygonFeatures(body)
		.map((feature) => readFarmlandFieldPolygonCandidate(feature.properties, feature.geometry, url.toString()))
		.filter((candidate): candidate is LandFarmlandFieldPolygonCandidate => candidate !== null)
		.slice(0, 5);
}

function farmlandFieldPolygonFeatures(body: unknown): Array<{ properties: unknown; geometry: unknown }> {
	if (Array.isArray(body)) {
		return body.map((item) => {
			const root = readObject(item);
			return {
				properties: root.properties || root.Properties || root,
				geometry: root.geometry || root.Geometry,
			};
		});
	}
	const root = readObject(body);
	if (root.type === "Feature" || root.Type === "Feature") {
		return [{ properties: root.properties || root.Properties, geometry: root.geometry || root.Geometry }];
	}
	const features = objectArray(root.features || root.Features || root.data || root.Data || root.results || root.result);
	return features.map((feature) => ({
		properties: feature.properties || feature.Properties || feature,
		geometry: feature.geometry || feature.Geometry,
	}));
}

function readFarmlandFieldPolygonCandidate(
	properties: unknown,
	geometry: unknown,
	sourceUrl: string,
): LandFarmlandFieldPolygonCandidate | null {
	const props = readObject(properties);
	const geom = readObject(geometry);
	const fieldPolygonId = firstNonBlank(
		props.FieldPolygonId,
		props.FieldPolygonID,
		props.fieldPolygonId,
		props.field_polygon_id,
		props.ID,
		props.id,
		props.筆ポリゴンID,
		props.筆ID,
	);
	const cityCode = firstNonBlank(props.CityCode, props.cityCode, props.LocalGovernmentCd, props.市区町村コード);
	const landCategory = firstNonBlank(props.LandCategory, props.landCategory, props.地目);
	const area =
		numberFromUnknown(props.Area) ??
		numberFromUnknown(props.area) ??
		numberFromUnknown(props.面積) ??
		numberFromUnknown(props["面積㎡"]);
	const geometryType = firstNonBlank(geom.type, geom.Type, props.geometryType, props.形状種別);
	if (!fieldPolygonId && !cityCode && !landCategory && area === null && !geometryType) return null;
	return {
		fieldPolygonId,
		cityCode,
		landCategory,
		area,
		geometryType,
		sourceUrl,
	};
}

function distanceMetersBetween(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const radiusKm = 6371;
	const dLat = degreesToRadians(lat2 - lat1);
	const dLon = degreesToRadians(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(degreesToRadians(lat1)) *
			Math.cos(degreesToRadians(lat2)) *
			Math.sin(dLon / 2) ** 2;
	return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
}

function degreesToRadians(value: number): number {
	return (value * Math.PI) / 180;
}

function farmlandNaviEvidence(context: LandFarmlandNaviContext): string {
	if (context.status !== "connected" || (!context.nearest && context.fieldPolygons.length === 0)) return context.message;
	const nearest = context.nearest;
	const lines = [
		context.message,
		`農地ナビ接続元: ${context.source}`,
		nearest?.address ? `所在・地番: ${nearest.address}` : "",
		nearest?.distanceM !== null && nearest?.distanceM !== undefined ? `入力地点からの距離: 約${nearest.distanceM}m` : "",
		nearest?.landCategory ? `地目: ${nearest.landCategory}` : "",
		nearest?.area !== null && nearest?.area !== undefined ? `農地ナビ面積: ${nearest.area.toLocaleString("ja-JP")}㎡` : "",
		nearest?.agriculturalClassification ? `農振法区分: ${nearest.agriculturalClassification}` : "",
		nearest?.cityPlanningClassification ? `都市計画法区分: ${nearest.cityPlanningClassification}` : "",
		nearest?.ownerIntention ? `所有者意向: ${nearest.ownerIntention}` : "",
		nearest?.rightClassification ? `権利の種類: ${nearest.rightClassification}` : "",
		nearest?.idleStatus ? `遊休農地: ${nearest.idleStatus}` : "",
		nearest?.jurisdictionAgricultureCommitteeName ? `所管農業委員会: ${nearest.jurisdictionAgricultureCommitteeName}` : "",
		...context.fieldPolygons.slice(0, 3).map((candidate, index) =>
			[
				`農地筆ポリゴン候補${index + 1}: ID付与済み筆ポリゴン取得API v3`,
				candidate.fieldPolygonId ? `筆ポリゴンID=${candidate.fieldPolygonId}` : "",
				candidate.cityCode ? `市区町村コード=${candidate.cityCode}` : "",
				candidate.landCategory ? `地目=${candidate.landCategory}` : "",
				candidate.area !== null ? `面積=${candidate.area.toLocaleString("ja-JP")}㎡` : "",
				candidate.geometryType ? `農地区画形状候補=${candidate.geometryType}` : "農地区画形状候補",
			].filter(Boolean).join(" / "),
		),
		"注意: eMAFF農地ナビ/WAGRIの農地ピン・農地筆ポリゴンは法的証明ではないため、農業委員会で最終確認。",
	];
	return lines.filter(Boolean).join("\n");
}

async function fetchGoogleSurroundingPlacesContext(
	latitude: number | null,
	longitude: number | null,
	key: string,
): Promise<LandSurroundingPlacesContext> {
	const source = "Google Places API (New) Nearby Search";
	if (latitude === null || longitude === null) {
		return {
			status: "no-coordinate",
			source,
			message: "周辺条件: 未実行（緯度経度なし）",
			places: [],
		};
	}
	if (!key) {
		return {
			status: "no-key",
			source,
			message: "周辺条件: 未接続（GOOGLE_MAPS_API_KEY未設定）",
			places: [],
		};
	}

	const url = new URL("https://places.googleapis.com/v1/places:searchNearby");
	const body = await fetchJsonPostWithHeaders(
		url,
		{
			"Content-Type": "application/json",
			"X-Goog-Api-Key": key,
			"X-Goog-FieldMask":
				"places.displayName,places.primaryType,places.types,places.formattedAddress,places.location,places.googleMapsUri",
		},
		{
			includedTypes: [
				"school",
				"hospital",
				"train_station",
				"shopping_mall",
				"supermarket",
				"local_government_office",
			],
			maxResultCount: 12,
			locationRestriction: {
				circle: {
					center: { latitude, longitude },
					radius: 1500,
				},
			},
			rankPreference: "DISTANCE",
			languageCode: "ja",
			regionCode: "JP",
		},
	);
	if (!body) {
		return {
			status: "error",
			source,
			message: "周辺条件: Google Places API 取得失敗",
			places: [],
		};
	}
	const root = readObject(body);
	const places = objectArray(root.places)
		.map((place) => readSurroundingPlaceCandidate(place, latitude, longitude))
		.filter((candidate): candidate is LandSurroundingPlaceCandidate => candidate !== null)
		.slice(0, 8);
	return {
		status: places.length > 0 ? "connected" : "no-result",
		source,
		message:
			places.length > 0
				? `周辺条件: Google Places API 取得成功（周辺施設候補${places.length}件）`
				: "周辺条件: Google Places API 取得0件",
		places,
	};
}

function readSurroundingPlaceCandidate(
	value: Record<string, unknown>,
	originLatitude: number,
	originLongitude: number,
): LandSurroundingPlaceCandidate | null {
	const displayName = readObject(value.displayName);
	const location = readObject(value.location);
	const latitude = numberOrNull(location.latitude);
	const longitude = numberOrNull(location.longitude);
	const primaryType = firstNonBlank(value.primaryType, ...(Array.isArray(value.types) ? value.types : []));
	const name = firstNonBlank(displayName.text, value.name);
	if (!name && !primaryType) return null;
	return {
		name,
		primaryType,
		categoryLabel: surroundingPlaceCategoryLabel(primaryType),
		formattedAddress: stringOrBlank(value.formattedAddress),
		latitude,
		longitude,
		distanceM:
			latitude !== null && longitude !== null
				? Math.round(distanceMetersBetween(originLatitude, originLongitude, latitude, longitude))
				: null,
		googleMapsUri: stringOrBlank(value.googleMapsUri),
	};
}

function surroundingPlaceCategoryLabel(primaryType: string): string {
	if (/school/.test(primaryType)) return "学校候補";
	if (/hospital|doctor|pharmacy/.test(primaryType)) return "病院候補";
	if (/train_station|transit_station|bus_station/.test(primaryType)) return "駅候補";
	if (/shopping_mall|supermarket|store|restaurant/.test(primaryType)) return "商業候補";
	if (/local_government_office|city_hall/.test(primaryType)) return "行政候補";
	return "周辺施設候補";
}

function surroundingPlacesEvidence(context: LandSurroundingPlacesContext): string {
	if (context.status !== "connected") return context.message;
	const lines = [
		context.message,
		`周辺条件接続元: ${context.source}`,
		...context.places.slice(0, 5).map((place, index) =>
			[
				`周辺施設候補${index + 1}: ${place.categoryLabel}`,
				place.name,
				place.distanceM !== null ? `入力地点から約${place.distanceM}m` : "",
				place.formattedAddress,
				place.googleMapsUri ? `確認リンク=${place.googleMapsUri}` : "",
			].filter(Boolean).join(" / "),
		),
		"注意: Google Places APIの周辺施設候補であり、住宅密集判定ではない。近隣説明リスクは航空写真、ストリートビュー、現地確認で確認。",
	];
	return lines.filter(Boolean).join("\n");
}

async function fetchParcelCadastreContext(
	latitude: number | null,
	longitude: number | null,
): Promise<LandParcelCadastreContext> {
	const source = "法務省 登記所備付地図データ / G空間情報センター配置済みGeoJSON";
	if (latitude === null || longitude === null) {
		return {
			status: "no-coordinate",
			source,
			message: "登記所備付地図データ接続: 未実行（緯度経度なし）",
			candidates: [],
		};
	}

	const urlTexts = uniqueStrings(
		[
			...(process.env.MOJ_CHIZU_GEOJSON_URLS || "").split(/[\n,]/),
			process.env.MOJ_CHIZU_GEOJSON_URL || "",
		]
			.map((value) => value.trim())
			.filter(Boolean),
	);
	if (urlTexts.length === 0) {
		return {
			status: "no-url",
			source,
			message: "登記所備付地図データ接続: 未接続（MOJ_CHIZU_GEOJSON_URLS未設定）",
			candidates: [],
		};
	}

	let readableSourceCount = 0;
	const candidates: LandParcelCadastreCandidate[] = [];
	for (const urlText of urlTexts.slice(0, 12)) {
		let url: URL;
		try {
			url = new URL(urlText);
		} catch {
			continue;
		}
		const body = await fetchJson(url);
		if (!body) continue;
		readableSourceCount += 1;
		for (const feature of geoJsonFeatures(body)) {
			if (!pointInGeoJsonGeometry(feature.geometry, longitude, latitude)) continue;
			const candidate = readParcelCadastreCandidate(feature.properties, url.toString());
			if (candidate) candidates.push(candidate);
			if (candidates.length >= 5) break;
		}
		if (candidates.length >= 5) break;
	}

	if (candidates.length > 0) {
		return {
			status: "connected",
			source,
			message: `登記所備付地図データ接続: 取得成功（地番候補${candidates.length}件）`,
			candidates,
		};
	}

	return {
		status: readableSourceCount > 0 ? "no-result" : "error",
		source,
		message:
			readableSourceCount > 0
				? "登記所備付地図データ接続: 取得0件（地番候補なし）"
				: "登記所備付地図データ接続: 取得失敗（配置済みGeoJSONを読み取れません）",
		candidates: [],
	};
}

function readParcelCadastreCandidate(
	properties: unknown,
	sourceUrl: string,
): LandParcelCadastreCandidate | null {
	const props = readObject(properties);
	const lotNumber = firstNonBlank(
		props.地番,
		props.地番表示,
		props.筆番,
		props.chiban,
		props.Chiban,
		props.lotNumber,
		props.LOT_NO,
	);
	const municipality = firstNonBlank(
		props.市区町村名,
		props.市町村名,
		props.自治体名,
		props.city,
		props.municipality,
		props.MUNICIPALITY,
	);
	const oaza = firstNonBlank(
		props.大字,
		props.大字名,
		props.大字町丁目名,
		props.oaza,
		props.OAZA,
	);
	const koaza = firstNonBlank(
		props.小字,
		props.小字名,
		props.koaza,
		props.KOAZA,
	);
	if (!lotNumber && !municipality && !oaza && !koaza) return null;
	return {
		municipality,
		oaza,
		koaza,
		lotNumber,
		mapType: firstNonBlank(props.地図種類, props.図郭種別, props.map_type, props.type),
		accuracy: firstNonBlank(props.精度区分, props.座標系, props.accuracy),
		sourceUrl,
		confirmationUrl: "https://www.moj.go.jp/MINJI/minji05_00494.html",
	};
}

function parcelCadastreEvidence(context: LandParcelCadastreContext): string {
	if (context.status !== "connected") return context.message;
	const lines = [
		context.message,
		`登記所備付地図データ接続元: ${context.source}`,
		...context.candidates.slice(0, 3).map((candidate, index) => {
			const location = [candidate.municipality, candidate.oaza, candidate.koaza].filter(Boolean).join("");
			const lot = candidate.lotNumber ? ` ${candidate.lotNumber}` : "";
			return [
				`地番候補${index + 1}: ${location}${lot}`.trim(),
				"筆界候補",
				`地図種類=${candidate.mapType || "未記載"}`,
				`精度=${candidate.accuracy || "未記載"}`,
				`確認リンク=${candidate.confirmationUrl}`,
			].join(" / ");
		}),
		"注意: 地番候補・筆界候補であり、登記確認済みではない。所有者・地目・地積・権利部は登記情報提供サービスまたは法務局で確認。",
	];
	return lines.filter(Boolean).join("\n");
}

async function fetchGsiRoadContext(
	latitude: number | null,
	longitude: number | null,
): Promise<LandGsiRoadContext> {
	const source = "国土地理院ベクトルタイル提供実験（地図情報・道路中心線）";
	if (latitude === null || longitude === null) {
		return {
			status: "no-coordinate",
			source,
			message: "国土地理院道路候補: 未実行（緯度経度なし）",
			candidates: [],
		};
	}
	if (process.env.GSI_ROAD_TILE_ENABLED === "0") {
		return {
			status: "no-result",
			source,
			message: "国土地理院道路候補: 未実行（GSI_ROAD_TILE_ENABLED=0）",
			candidates: [],
		};
	}

	const tile = lonLatToTile(longitude, latitude, 16);
	const tileUrls: URL[] = [];
	for (let dx = -1; dx <= 1; dx += 1) {
		for (let dy = -1; dy <= 1; dy += 1) {
			tileUrls.push(gsiRoadTileUrl(tile.z, tile.x + dx, tile.y + dy));
		}
	}

	const candidates: LandGsiRoadCandidate[] = [];
	for (const url of tileUrls) {
		const body = await fetchJson(url);
		if (!body) continue;
		for (const feature of geoJsonFeatures(body)) {
			const distanceM = distanceMetersToLineGeometry(feature.geometry, longitude, latitude);
			if (distanceM === null || distanceM > 40) continue;
			const candidate = readGsiRoadCandidate(feature.properties, url.toString(), distanceM);
			if (candidate) candidates.push(candidate);
		}
	}

	const nearest = uniqueGsiRoadCandidates(candidates)
		.sort((a, b) => a.distanceM - b.distanceM)
		.slice(0, 5);
	return {
		status: nearest.length > 0 ? "connected" : "no-result",
		source,
		message:
			nearest.length > 0
				? `国土地理院道路候補: 取得成功（道路候補${nearest.length}件）`
				: "国土地理院道路候補: 取得0件（40m圏内の道路中心線候補なし）",
		candidates: nearest,
	};
}

function uniqueGsiRoadCandidates(candidates: LandGsiRoadCandidate[]): LandGsiRoadCandidate[] {
	const seen = new Set<string>();
	const unique: LandGsiRoadCandidate[] = [];
	for (const candidate of candidates) {
		const key = [
			candidate.name,
			candidate.category,
			candidate.widthRank,
			Math.round(candidate.distanceM / 5) * 5,
		].join("|");
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(candidate);
	}
	return unique;
}

function gsiRoadTileUrl(z: number, x: number, y: number): URL {
	return new URL(`https://cyberjapandata.gsi.go.jp/xyz/experimental_rdcl/${z}/${x}/${y}.geojson`);
}

function readGsiRoadCandidate(
	properties: unknown,
	sourceUrl: string,
	distanceM: number,
): LandGsiRoadCandidate | null {
	const props = readObject(properties);
	const widthRank = firstNonBlank(
		props.rnkWidth,
		props.vt_rnkwidth,
		props.幅員区分,
		props.widthRank,
		props.Width,
		props.width,
	);
	const name = firstNonBlank(props.name, props.道路名, props.routeName, props.路線名);
	const category = firstNonBlank(props.rdCtg, props.vt_rdctg, props.道路分類, props.category);
	if (!name && !category && !widthRank) return null;
	return {
		name,
		category,
		widthRank,
		widthEstimateM: estimateRoadWidthM(widthRank),
		distanceM: Math.round(distanceM),
		sourceUrl,
	};
}

function gsiRoadEvidence(context: LandGsiRoadContext, address = ""): string {
	const roadLedgerText = roadLedgerConfirmationEvidence(address);
	if (context.status !== "connected") return context.message;
	const lines = [
		context.message,
		`国土地理院道路候補接続元: ${context.source}`,
		...context.candidates.slice(0, 3).map((candidate, index) => {
			const widthEstimate =
				candidate.widthEstimateM !== null ? `幅員推定=約${candidate.widthEstimateM.toFixed(1)}m` : "幅員推定=未算出";
			return [
				`道路候補${index + 1}: ${candidate.name || "名称未記載"}`,
				candidate.category ? `道路分類=${candidate.category}` : "道路分類=未記載",
				`入力地点から約${candidate.distanceM}m`,
				candidate.widthRank ? `幅員区分=${candidate.widthRank}` : "幅員区分=未記載",
				widthEstimate,
				"道路台帳で確認",
			].join(" / ");
		}),
		roadLedgerText,
		"注意: 国土地理院の道路中心線と幅員区分からの道路候補・幅員推定であり、接道成立、道路種別、道路幅員確定、大型車搬入可否の証明ではありません。道路台帳・建築指導課・土木事務所で確認。",
	];
	return lines.filter(Boolean).join("\n");
}

function roadLedgerConfirmationEvidence(address: string): string {
	const municipality = municipalityFromAddress(address);
	const target = municipality || "所在地の市区町村";
	const searchUrl = roadLedgerSearchUrl(target);
	return [
		`道路台帳確認先: ${target} 道路管理課・建築指導課・土木事務所`,
		"確認事項: 幅員、道路種別、建築基準法道路、接道義務、大型車搬入",
		`検索リンク=${searchUrl}`,
		"注意: 検索リンクは確認入口であり、公式回答ではない",
	].join(" / ");
}

function roadLedgerConfirmationQuickEvidence(address: string): string {
	const municipality = municipalityFromAddress(address);
	const target = municipality || "所在地の市区町村";
	return [
		`道路台帳確認先: ${target} 道路管理課・建築指導課・土木事務所`,
		"建築基準法道路",
		"検索リンク=https://www.google.com/search",
	].join(" / ");
}

function municipalityFromAddress(address: string): string {
	const normalized = address.replace(/\s+/g, "");
	if (!normalized) return "";
	const withoutPrefecture = normalized.replace(/^.*?[都道府県]/, "");
	const match = withoutPrefecture.match(/^(.+?(?:市|区|町|村))/);
	return match?.[1] || "";
}

function roadLedgerSearchUrl(target: string): string {
	const query = `${target} 道路台帳 幅員 建築基準法道路`;
	return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

async function fetchGridCapacityContext(powerArea: string): Promise<LandGridCapacityContext> {
	const normalizedPowerArea = powerArea || "未確認";
	const source = "資源エネルギー庁 / OCCTO / 各送配電会社の系統空容量公開情報";
	const officialLinks = gridCapacityOfficialLinks(normalizedPowerArea);
	const urlTexts = gridCapacityPublicUrls();
	if (urlTexts.length === 0) {
		return {
			status: "no-url",
			source,
			message: `系統空き確認: 公表値候補未取得（GRID_CAPACITY_PUBLIC_JSON_URLS未設定）。${gridCapacityLinkLabels(officialLinks)}で確認。接続可否確定ではない。`,
			powerArea: normalizedPowerArea,
			officialLinks,
			records: [],
		};
	}

	const records: LandGridCapacityRecord[] = [];
	for (const urlText of urlTexts) {
		let url: URL;
		try {
			url = new URL(urlText);
		} catch {
			continue;
		}
		const body = await fetchJson(url);
		for (const item of gridCapacityRecords(body)) {
			const record = readGridCapacityRecord(item, url.toString());
			if (record && powerAreaMatchesGridCapacity(record, normalizedPowerArea)) {
				records.push(record);
			}
		}
	}
	const uniqueRecords = uniqueGridCapacityRecords(records).slice(0, 5);
	return {
		status: uniqueRecords.length > 0 ? "connected" : "no-result",
		source,
		message:
			uniqueRecords.length > 0
				? `系統空き確認: 公表値候補${uniqueRecords.length}件（接続可否確定ではない）`
				: `系統空き確認: 公表値候補0件。${gridCapacityLinkLabels(officialLinks)}と接続検討で確認。接続可否確定ではない。`,
		powerArea: normalizedPowerArea,
		officialLinks,
		records: uniqueRecords,
	};
}

function gridCapacityPublicUrls(): string[] {
	const values = [
		process.env.GRID_CAPACITY_PUBLIC_JSON_URLS || "",
		process.env.GRID_CAPACITY_PUBLIC_JSON || "",
		process.env.GRID_CAPACITY_PUBLIC_JSON_URL || "",
	];
	return uniqueStrings(
		values
			.flatMap((value) => value.split(/[\n,]/))
			.map((value) => value.trim())
			.filter(Boolean),
	);
}

function gridCapacityOfficialLinks(powerArea: string): LandGridCapacityOfficialLink[] {
	const links: LandGridCapacityOfficialLink[] = [
		{
			label: "資源エネルギー庁 系統情報公表ページ",
			url: "https://www.enecho.meti.go.jp/category/saving_and_new/saiene/grid/07_map.html",
		},
		{
			label: "OCCTO/電力広域的運営推進機関 空き容量マップリンク集",
			url: "https://www.occto.or.jp/access/link/mapping.html",
		},
	];
	if (/中部/.test(powerArea)) {
		links.push({
			label: "中部電力パワーグリッド 系統空容量・予想潮流マッピング",
			url: "https://powergrid.chuden.co.jp/goannai/hatsuden_kouri/takuso_kyokyu/rule/map/",
		});
	}
	return links;
}

function gridCapacityLinkLabels(links: LandGridCapacityOfficialLink[]): string {
	return links.map((link) => link.label).join(" / ");
}

function gridCapacityRecords(body: unknown | null): Array<Record<string, unknown>> {
	if (Array.isArray(body)) return objectArray(body);
	const root = readObject(body);
	return objectArray(root.data || root.Data || root.results || root.result || root.items || root.features);
}

function readGridCapacityRecord(value: Record<string, unknown>, fallbackSourceUrl: string): LandGridCapacityRecord | null {
	const props = readObject(value.properties || value);
	const facilityName = firstNonBlank(
		props.facilityName,
		props.substationName,
		props.name,
		props.設備名,
		props.変電所名,
		props.系統名,
	);
	const operator = firstNonBlank(props.operator, props.powerGrid, props.company, props.送配電会社, props.会社名);
	const powerArea = firstNonBlank(props.powerArea, props.area, gridCapacityPowerArea(props), operator);
	const availableCapacityMw =
		numberFromUnknown(props.availableCapacityMw) ??
		numberFromUnknown(props.availableCapacityMW) ??
		numberFromUnknown(props.availableCapacity) ??
		numberFromUnknown(props.空容量MW) ??
		numberFromUnknown(props.空容量) ??
		numberFromUnknown(props.capacityMw);
	const voltageKv =
		numberFromUnknown(props.voltageKv) ??
		numberFromUnknown(props.voltageKV) ??
		numberFromUnknown(props.voltage) ??
		numberFromUnknown(props.電圧kV) ??
		numberFromUnknown(props.電圧);
	const status = firstNonBlank(props.status, props.状態, props.空容量状態, props.constraintStatus);
	const nMinusOne = firstNonBlank(props.nMinusOne, props.N1, props["N-1"], props.N_MINUS_ONE, props.備考);
	const updatedAt = firstNonBlank(props.updatedAt, props.updateDate, props.更新日, props.公表日);
	const sourceUrl = firstNonBlank(props.sourceUrl, props.url, props.公式リンク, props.link) || fallbackSourceUrl;
	if (!facilityName && !operator && availableCapacityMw === null && !status) return null;
	return {
		powerArea,
		operator,
		facilityName,
		voltageKv,
		availableCapacityMw,
		status,
		nMinusOne,
		updatedAt,
		sourceUrl,
	};
}

function gridCapacityPowerArea(props: Record<string, unknown>): string {
	return firstNonBlank(props.電力エリア, props.供給エリア, props.エリア);
}

function powerAreaMatchesGridCapacity(record: LandGridCapacityRecord, powerArea: string): boolean {
	const areaKey = gridCapacityAreaKey(powerArea);
	if (!areaKey) return true;
	return new RegExp(areaKey).test([record.powerArea, record.operator].join(" "));
}

function gridCapacityAreaKey(powerArea: string): string {
	if (/中部/.test(powerArea)) return "中部";
	if (/東京/.test(powerArea)) return "東京";
	if (/関西/.test(powerArea)) return "関西";
	if (/九州/.test(powerArea)) return "九州";
	if (/北海道/.test(powerArea)) return "北海道";
	if (/東北/.test(powerArea)) return "東北";
	if (/北陸/.test(powerArea)) return "北陸";
	if (/中国/.test(powerArea)) return "中国";
	if (/四国/.test(powerArea)) return "四国";
	if (/沖縄/.test(powerArea)) return "沖縄";
	return "";
}

function uniqueGridCapacityRecords(records: LandGridCapacityRecord[]): LandGridCapacityRecord[] {
	const seen = new Set<string>();
	const unique: LandGridCapacityRecord[] = [];
	for (const record of records) {
		const key = [
			record.operator,
			record.facilityName,
			record.voltageKv ?? "",
			record.availableCapacityMw ?? "",
			record.updatedAt,
		].join("|");
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(record);
	}
	return unique;
}

function gridCapacityEvidence(context: LandGridCapacityContext): string {
	if (context.status !== "connected") {
		return [
			context.message,
			`系統空き確認元: ${context.source}`,
			`公式確認先: ${context.officialLinks.map((link) => `${link.label} ${link.url}`).join(" / ")}`,
			"注意: 空容量マップの表示は公表値候補であり、接続可否確定ではない。送配電会社の接続検討で受電地点、連系制約、N-1電制、工事費負担金を確認。",
		].join("\n");
	}
	const lines = [
		context.message,
		`系統空き確認元: ${context.source}`,
		`公式確認先: ${context.officialLinks.map((link) => `${link.label} ${link.url}`).join(" / ")}`,
		...context.records.slice(0, 3).map((record, index) => {
			const capacity =
				record.availableCapacityMw !== null
					? `空容量 ${record.availableCapacityMw.toLocaleString("ja-JP", { maximumFractionDigits: 3 })}MW`
					: "空容量 未記載";
			return [
				`公表値候補${index + 1}: ${record.facilityName || "設備名未記載"}`,
				record.operator || "送配電会社未記載",
				record.voltageKv !== null ? `${record.voltageKv}kV` : "電圧未記載",
				capacity,
				record.status ? `状態=${record.status}` : "",
				record.nMinusOne || "N-1電制は接続検討で確認",
				record.updatedAt ? `更新=${record.updatedAt}` : "",
				`公式リンク=${record.sourceUrl}`,
			].filter(Boolean).join(" / ");
		}),
		"注意: 公表値候補であり、接続可否確定ではない。送配電会社の接続検討、受電地点、連系制約、N-1電制、工事費負担金で確認。",
	];
	return lines.filter(Boolean).join("\n");
}

function estimateRoadWidthM(value: string): number | null {
	const text = normalizeDigits(value);
	if (!text) return null;
	const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*m?\s*以上\s*(\d+(?:\.\d+)?)\s*m?\s*未満/i);
	if (rangeMatch) return (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2;
	const underMatch = text.match(/(\d+(?:\.\d+)?)\s*m?\s*未満/i);
	if (underMatch) return Number(underMatch[1]) / 2;
	const overMatch = text.match(/(\d+(?:\.\d+)?)\s*m?\s*以上/i);
	if (overMatch) return Number(overMatch[1]);
	const explicitMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m|メートル)/i);
	if (explicitMatch) return Number(explicitMatch[1]);
	const code = Number(text);
	if (code === 1) return 1.5;
	if (code === 2) return 4.25;
	if (code === 3) return 9.25;
	if (code === 4) return 16.25;
	if (code === 5) return 19.5;
	return null;
}

async function fetchReinfolibContext(
	latitude: number | null,
	longitude: number | null,
	areaTsubo: number | null,
): Promise<LandReinfolibContext> {
	const source = "国土交通省 不動産情報ライブラリAPI";
	if (latitude === null || longitude === null) {
		return {
			status: "no-coordinate",
			source,
			message: "不動産情報ライブラリ接続: 未実行（緯度経度なし）",
			landPrice: null,
			zoning: null,
			hazards: [],
			transactionSummary: null,
			referencePriceRange: "",
		};
	}
	const key =
		process.env.REINFOLIB_API_KEY ||
		process.env.REAL_ESTATE_LIBRARY_API_KEY ||
		process.env.MLIT_REINFOLIB_API_KEY ||
		"";
	if (!key) {
		return {
			status: "no-token",
			source,
			message: "不動産情報ライブラリ接続: 未接続（REINFOLIB_API_KEY未設定）",
			landPrice: null,
			zoning: null,
			hazards: [],
			transactionSummary: null,
			referencePriceRange: "",
		};
	}

	const tile = lonLatToTile(longitude, latitude, 15);
	const headers = { "Ocp-Apim-Subscription-Key": key };
	const landPriceYear = process.env.REINFOLIB_LAND_PRICE_YEAR || String(new Date().getFullYear() - 1);
	const [priceBody, zoningBody, disasterBody, floodBody, sedimentBody] = await Promise.all([
		fetchJsonWithHeaders(
			reinfolibUrl("XPT002", {
				response_format: "geojson",
				z: String(tile.z),
				x: String(tile.x),
				y: String(tile.y),
				year: landPriceYear,
			}),
			headers,
		),
		fetchJsonWithHeaders(
			reinfolibUrl("XKT002", {
				response_format: "geojson",
				z: String(tile.z),
				x: String(tile.x),
				y: String(tile.y),
			}),
			headers,
		),
		fetchJsonWithHeaders(
			reinfolibUrl("XKT016", {
				response_format: "geojson",
				z: String(tile.z),
				x: String(tile.x),
				y: String(tile.y),
			}),
			headers,
		),
		fetchJsonWithHeaders(
			reinfolibUrl("XKT026", {
				response_format: "geojson",
				z: String(tile.z),
				x: String(tile.x),
				y: String(tile.y),
			}),
			headers,
		),
		fetchJsonWithHeaders(
			reinfolibUrl("XKT029", {
				response_format: "geojson",
				z: String(tile.z),
				x: String(tile.x),
				y: String(tile.y),
			}),
			headers,
		),
	]);
	const landPrice = readReinfolibLandPrice(priceBody, latitude, longitude);
	const zoning = readReinfolibZoning(zoningBody, latitude, longitude);
	const hazards = [
		...readReinfolibHazards(disasterBody, latitude, longitude, "XKT016", "災害危険区域"),
		...readReinfolibHazards(floodBody, latitude, longitude, "XKT026", "洪水浸水想定区域"),
		...readReinfolibHazards(sedimentBody, latitude, longitude, "XKT029", "土砂災害警戒区域"),
	];
	const cityCode = zoning?.cityCode || landPrice?.cityCode || "";
	const transactionSummary = cityCode
		? await fetchReinfolibTransactionSummary(cityCode, headers)
		: null;
	const referencePriceRange = buildReinfolibReferencePriceRange(
		areaTsubo,
		landPrice?.priceYenPerSqm ?? transactionSummary?.medianUnitPriceYenPerSqm ?? null,
	);
	const hasAnyResult = Boolean(
		landPrice || zoning || hazards.length > 0 || transactionSummary || referencePriceRange,
	);
	return {
		status: hasAnyResult ? "connected" : "no-result",
		source,
		message: hasAnyResult
			? "不動産情報ライブラリ接続: 取得成功"
			: "不動産情報ライブラリ接続: 取得0件",
		landPrice,
		zoning,
		hazards,
		transactionSummary,
		referencePriceRange,
	};
}

function reinfolibUrl(apiId: string, params: Record<string, string>): URL {
	const url = new URL(`https://www.reinfolib.mlit.go.jp/ex-api/external/${apiId}`);
	for (const [key, value] of Object.entries(params)) {
		if (value) url.searchParams.set(key, value);
	}
	return url;
}

function lonLatToTile(longitude: number, latitude: number, z: number): { z: number; x: number; y: number } {
	const latRad = degreesToRadians(latitude);
	const scale = 2 ** z;
	const x = Math.floor(((longitude + 180) / 360) * scale);
	const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale);
	return { z, x, y };
}

function readReinfolibLandPrice(
	body: unknown | null,
	latitude: number,
	longitude: number,
): LandReinfolibPricePoint | null {
	const features = geoJsonFeatures(body);
	let nearest: LandReinfolibPricePoint | null = null;
	for (const feature of features) {
		const props = readObject(feature.properties);
		const coordinates = pointCoordinates(feature.geometry);
		const distanceM = coordinates
			? Math.round(distanceMetersBetween(latitude, longitude, coordinates.latitude, coordinates.longitude))
			: null;
		const price: LandReinfolibPricePoint = {
			cityCode: stringOrBlank(props.city_code),
			targetYear: stringOrBlank(props.target_year_name_ja),
			useCategory: stringOrBlank(props.use_category_name_ja),
			location: stringOrBlank(props.location_number_ja) || stringOrBlank(props.place_name_ja),
			priceYenPerSqm: yenNumber(props.u_current_years_price_ja),
			yearOnYearChangeRate: stringOrBlank(props.year_on_year_change_rate),
			distanceM,
		};
		if (!price.priceYenPerSqm && !price.location) continue;
		if (!nearest || (price.distanceM ?? Number.POSITIVE_INFINITY) < (nearest.distanceM ?? Number.POSITIVE_INFINITY)) {
			nearest = price;
		}
	}
	return nearest;
}

function readReinfolibZoning(
	body: unknown | null,
	latitude: number,
	longitude: number,
): LandReinfolibZoning | null {
	for (const feature of geoJsonFeatures(body)) {
		if (!pointInGeoJsonGeometry(feature.geometry, longitude, latitude)) continue;
		const props = readObject(feature.properties);
		return {
			cityCode: stringOrBlank(props.city_code),
			cityName: stringOrBlank(props.city_name),
			useArea: stringOrBlank(props.use_area_ja),
			buildingCoverageRatio: stringOrBlank(props.u_building_coverage_ratio_ja),
			floorAreaRatio: stringOrBlank(props.u_floor_area_ratio_ja),
		};
	}
	return null;
}

function readReinfolibHazards(
	body: unknown | null,
	latitude: number,
	longitude: number,
	apiId: string,
	label: string,
): LandReinfolibHazardRisk[] {
	return geoJsonFeatures(body)
		.filter((feature) => pointInGeoJsonGeometry(feature.geometry, longitude, latitude))
		.map((feature) => ({
			apiId,
			label,
			detail: reinfolibHazardDetail(readObject(feature.properties)),
		}));
}

async function fetchReinfolibTransactionSummary(
	cityCode: string,
	headers: Record<string, string>,
): Promise<LandReinfolibTransactionSummary | null> {
	const year = process.env.REINFOLIB_TRANSACTION_YEAR || String(new Date().getFullYear() - 1);
	const body = await fetchJsonWithHeaders(
		reinfolibUrl("XIT001", {
			year,
			priceClassification: "01",
			city: cityCode,
			language: "ja",
		}),
		headers,
	);
	const records = reinfolibRecords(body).filter((item) => /土地/.test(stringOrBlank(item.Type)));
	if (records.length === 0) return null;
	const unitPrices = records
		.map((item) => {
			const unitPrice = yenNumber(item.UnitPrice);
			if (unitPrice) return unitPrice;
			const tradePrice = yenNumber(item.TradePrice);
			const area = numberFromUnknown(item.Area);
			return tradePrice && area && area > 0 ? Math.round(tradePrice / area) : null;
		})
		.filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
		.sort((a, b) => a - b);
	const sampleDistricts = uniqueStrings(records.map((item) => stringOrBlank(item.DistrictName)).filter(Boolean)).slice(0, 3);
	return {
		cityCode,
		count: records.length,
		medianUnitPriceYenPerSqm: medianNumber(unitPrices),
		sampleDistricts,
	};
}

function reinfolibEvidence(context: LandReinfolibContext): string {
	if (context.status !== "connected") return context.message;
	const lines = [context.message, `不動産情報ライブラリ接続元: ${context.source}`];
	if (context.landPrice) {
		const price = context.landPrice;
		lines.push(
			[
				"地価公示・地価調査:",
				price.priceYenPerSqm !== null ? `${price.priceYenPerSqm.toLocaleString("ja-JP")}円/㎡` : "",
				price.targetYear ? `（${price.targetYear}` : "",
				price.useCategory ? ` / ${price.useCategory}` : "",
				price.location ? ` / ${price.location}` : "",
				price.distanceM !== null ? ` / 入力地点から約${price.distanceM}m` : "",
				price.targetYear ? "）" : "",
			].join(""),
		);
		if (price.yearOnYearChangeRate) lines.push(`地価変動率: ${price.yearOnYearChangeRate}%`);
	}
	if (context.referencePriceRange) lines.push(`参考価格レンジ: ${context.referencePriceRange}（売買価格確定ではない）`);
	if (context.zoning) {
		if (context.zoning.useArea) lines.push(`用途地域: ${context.zoning.useArea}`);
		if (context.zoning.buildingCoverageRatio) lines.push(`建蔽率: ${context.zoning.buildingCoverageRatio}`);
		if (context.zoning.floorAreaRatio) lines.push(`容積率: ${context.zoning.floorAreaRatio}`);
		if (context.zoning.cityName) lines.push(`都市計画確認自治体: ${context.zoning.cityName}`);
	}
	if (context.hazards.length > 0) {
		lines.push(
			`防災一次確認: ${context.hazards
				.map((risk) => `${risk.label}${risk.detail ? `（${risk.detail}）` : ""}`)
				.join(" / ")}`,
		);
	} else {
		lines.push("防災一次確認: 災害危険区域・洪水浸水想定区域・土砂災害警戒区域はAPI応答内で重なり未検出（安全確定ではない）");
	}
	if (context.transactionSummary) {
		const summary = context.transactionSummary;
		lines.push(
			[
				`同一市区町村の取引事例候補: ${summary.count}件`,
				summary.medianUnitPriceYenPerSqm !== null
					? `㎡単価中央値 約${summary.medianUnitPriceYenPerSqm.toLocaleString("ja-JP")}円/㎡`
					: "",
				summary.sampleDistricts.length > 0 ? `地区例: ${summary.sampleDistricts.join("、")}` : "",
			].filter(Boolean).join(" / "),
		);
	}
	lines.push("注意: 不動産情報ライブラリの価格・都市計画・防災情報は一次確認であり、売買価格、接道、建築可否、安全性の確定ではありません。");
	return lines.filter(Boolean).join("\n");
}

function buildReinfolibReferencePriceRange(areaTsubo: number | null, unitPriceYenPerSqm: number | null): string {
	if (!areaTsubo || areaTsubo <= 0 || !unitPriceYenPerSqm || unitPriceYenPerSqm <= 0) return "";
	const areaSqm = areaTsubo * 3.305785;
	const base = areaSqm * unitPriceYenPerSqm;
	return `${formatRoughYen(base * 0.7)}〜${formatRoughYen(base * 1.3)}`;
}

function formatRoughYen(value: number): string {
	if (value >= 100_000_000) return `約${(value / 100_000_000).toFixed(1)}億円`;
	return `約${Math.round(value / 10_000).toLocaleString("ja-JP")}万円`;
}

function geoJsonFeatures(body: unknown | null): Array<{ properties: unknown; geometry: unknown }> {
	const root = readObject(body);
	if (root.type === "Feature") {
		return [{ properties: root.properties, geometry: root.geometry }];
	}
	return objectArray(root.features).map((feature) => ({
		properties: feature.properties,
		geometry: feature.geometry,
	}));
}

function pointCoordinates(geometry: unknown): { latitude: number; longitude: number } | null {
	const geom = readObject(geometry);
	if (geom.type !== "Point") return null;
	const coordinates = Array.isArray(geom.coordinates) ? geom.coordinates : [];
	const longitude = numberOrNull(coordinates[0]);
	const latitude = numberOrNull(coordinates[1]);
	return latitude !== null && longitude !== null ? { latitude, longitude } : null;
}

function pointInGeoJsonGeometry(geometry: unknown, longitude: number, latitude: number): boolean {
	const geom = readObject(geometry);
	if (geom.type === "Point") {
		const point = pointCoordinates(geometry);
		return Boolean(point && distanceMetersBetween(latitude, longitude, point.latitude, point.longitude) <= 25);
	}
	if (geom.type === "Polygon") {
		return polygonContainsPoint(geom.coordinates, longitude, latitude);
	}
	if (geom.type === "MultiPolygon") {
		const polygons = Array.isArray(geom.coordinates) ? geom.coordinates : [];
		return polygons.some((polygon) => polygonContainsPoint(polygon, longitude, latitude));
	}
	return false;
}

function distanceMetersToLineGeometry(
	geometry: unknown,
	longitude: number,
	latitude: number,
): number | null {
	const geom = readObject(geometry);
	if (geom.type === "LineString") {
		return distanceMetersToLineString(geom.coordinates, longitude, latitude);
	}
	if (geom.type === "MultiLineString") {
		const lines = Array.isArray(geom.coordinates) ? geom.coordinates : [];
		const distances = lines
			.map((line) => distanceMetersToLineString(line, longitude, latitude))
			.filter((value): value is number => value !== null);
		return distances.length > 0 ? Math.min(...distances) : null;
	}
	return null;
}

function distanceMetersToLineString(
	coordinates: unknown,
	longitude: number,
	latitude: number,
): number | null {
	const points = Array.isArray(coordinates) ? coordinates : [];
	let nearest: number | null = null;
	for (let i = 1; i < points.length; i += 1) {
		const previous = lonLatPoint(points[i - 1]);
		const current = lonLatPoint(points[i]);
		if (!previous || !current) continue;
		const distanceM = distanceMetersToSegment(longitude, latitude, previous.longitude, previous.latitude, current.longitude, current.latitude);
		nearest = nearest === null ? distanceM : Math.min(nearest, distanceM);
	}
	return nearest;
}

function lonLatPoint(value: unknown): { longitude: number; latitude: number } | null {
	const coordinates = Array.isArray(value) ? value : [];
	const longitude = numberOrNull(coordinates[0]);
	const latitude = numberOrNull(coordinates[1]);
	return longitude !== null && latitude !== null ? { longitude, latitude } : null;
}

function distanceMetersToSegment(
	pointLongitude: number,
	pointLatitude: number,
	startLongitude: number,
	startLatitude: number,
	endLongitude: number,
	endLatitude: number,
): number {
	const lonScale = Math.cos(degreesToRadians(pointLatitude)) * 111_320;
	const latScale = 111_320;
	const px = 0;
	const py = 0;
	const sx = (startLongitude - pointLongitude) * lonScale;
	const sy = (startLatitude - pointLatitude) * latScale;
	const ex = (endLongitude - pointLongitude) * lonScale;
	const ey = (endLatitude - pointLatitude) * latScale;
	const dx = ex - sx;
	const dy = ey - sy;
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared === 0) return Math.hypot(px - sx, py - sy);
	const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lengthSquared));
	const nearestX = sx + t * dx;
	const nearestY = sy + t * dy;
	return Math.hypot(px - nearestX, py - nearestY);
}

function polygonContainsPoint(polygon: unknown, longitude: number, latitude: number): boolean {
	const rings = Array.isArray(polygon) ? polygon : [];
	const outer = rings[0];
	if (!ringContainsPoint(outer, longitude, latitude)) return false;
	return !rings.slice(1).some((ring) => ringContainsPoint(ring, longitude, latitude));
}

function ringContainsPoint(ring: unknown, longitude: number, latitude: number): boolean {
	const points = Array.isArray(ring) ? ring : [];
	let inside = false;
	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const current = Array.isArray(points[i]) ? points[i] : [];
		const previous = Array.isArray(points[j]) ? points[j] : [];
		const xi = numberOrNull(current[0]);
		const yi = numberOrNull(current[1]);
		const xj = numberOrNull(previous[0]);
		const yj = numberOrNull(previous[1]);
		if (xi === null || yi === null || xj === null || yj === null) continue;
		const intersects = yi > latitude !== yj > latitude && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
}

function reinfolibHazardDetail(props: Record<string, unknown>): string {
	return [
		stringOrBlank(props.A48_005_ja),
		stringOrBlank(props.A48_007_name_ja),
		stringOrBlank(props.A48_008_ja),
		stringOrBlank(props.A31a_202),
		stringOrBlank(props.A31a_205) ? `浸水深ランク${stringOrBlank(props.A31a_205)}` : "",
		stringOrBlank(props.A33_001),
		stringOrBlank(props.A33_005_ja),
	]
		.filter(Boolean)
		.join(" / ");
}

function reinfolibRecords(body: unknown | null): Array<Record<string, unknown>> {
	if (Array.isArray(body)) return objectArray(body);
	const root = readObject(body);
	return objectArray(root.data || root.Data || root.results || root.result);
}

function yenNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return null;
	const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
	return match ? Number(match[0]) : null;
}

function numberFromUnknown(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return null;
	const normalized = value.replace(/,/g, "").trim();
	if (!normalized) return null;
	const number = Number(normalized);
	return Number.isFinite(number) ? number : null;
}

function medianNumber(values: number[]): number | null {
	if (values.length === 0) return null;
	const middle = Math.floor(values.length / 2);
	return values.length % 2 === 1
		? values[middle]!
		: Math.round((values[middle - 1]! + values[middle]!) / 2);
}

async function fetchJsonWithHeaders(
	url: URL,
	headers: Record<string, string>,
): Promise<unknown | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const response = await fetch(url, { headers, signal: controller.signal });
		if (!response.ok) return null;
		return response.json();
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

async function fetchJsonPostWithHeaders(
	url: URL,
	headers: Record<string, string>,
	body: Record<string, unknown>,
): Promise<unknown | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		if (!response.ok) return null;
		return response.json();
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

async function geocodeLandAddress(
	address: string,
	key: string,
): Promise<{ latitude: number; longitude: number } | null> {
	const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
	url.searchParams.set("address", address);
	url.searchParams.set("language", "ja");
	url.searchParams.set("region", "jp");
	url.searchParams.set("key", key);
	const body = await fetchJson(url);
	const results = objectArray((body as Record<string, unknown> | null)?.results);
	const first = results[0];
	const location = readObject(readObject(first?.geometry).location);
	const latitude = numberOrNull(location.lat);
	const longitude = numberOrNull(location.lng);
	return latitude !== null && longitude !== null ? { latitude, longitude } : null;
}

async function geocodeLandAddressByGsi(
	address: string,
): Promise<{ latitude: number; longitude: number; title: string } | null> {
	const url = new URL("https://msearch.gsi.go.jp/address-search/AddressSearch");
	url.searchParams.set("q", address);
	const body = await fetchJson(url);
	const first = objectArray(body)[0];
	const coordinates = Array.isArray(readObject(first?.geometry).coordinates)
		? (readObject(first?.geometry).coordinates as unknown[])
		: [];
	const longitude = numberOrNull(coordinates[0]);
	const latitude = numberOrNull(coordinates[1]);
	const title = stringOrBlank(readObject(first?.properties).title);
	return latitude !== null && longitude !== null
		? { latitude, longitude, title }
		: null;
}

async function fetchGoogleRoadAccess(
	latitude: number,
	longitude: number,
	key: string,
): Promise<string> {
	const url = new URL("https://roads.googleapis.com/v1/nearestRoads");
	url.searchParams.set("points", `${latitude},${longitude}`);
	url.searchParams.set("key", key);
	const body = await fetchJson(url);
	const snappedPoints = objectArray((body as Record<string, unknown> | null)?.snappedPoints);
	if (snappedPoints.length === 0) return "";
	const placeIds = uniqueStrings(
		snappedPoints
			.map((point) => {
				const placeId = readObject(point).placeId;
				return typeof placeId === "string" ? placeId : "";
			})
			.filter(Boolean),
	).slice(0, 3);
	return placeIds.length > 0
		? `近接道路候補あり（Google Roads placeId: ${placeIds.join(", ")}）。幅員は道路台帳で確認。`
		: "近接道路候補あり。幅員は道路台帳で確認。";
}

async function fetchJson(url: URL): Promise<unknown | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) return null;
		return response.json();
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

function objectArray(value: unknown): Array<Record<string, unknown>> {
	return Array.isArray(value)
		? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
		: [];
}

function readObject(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function numberOrNull(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrBlank(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function firstNonBlank(...values: unknown[]): string {
	for (const value of values) {
		const text = stringOrBlank(value);
		if (text) return text;
	}
	return "";
}

function normalizeDigits(value: string): string {
	return value.replace(/[０-９．]/g, (char) =>
		String.fromCharCode(char.charCodeAt(0) - 0xfee0),
	);
}

function buildLandQuickEvidence(mapContext: LandMapContext, address = ""): string {
	const parts: string[] = [];
	if (mapContext.googleMapsUrl || mapContext.geocodeSource || mapContext.roadAccess) {
		parts.push(
			[
				"座標化",
				mapContext.geocodeSource ? `座標取得: ${mapContext.geocodeSource}` : "",
				mapContext.googleMapsUrl ? `Google Maps: ${mapContext.googleMapsUrl}` : "",
				mapContext.roadAccess ? "Google Roads: 近接道路候補あり" : "",
			].filter(Boolean).join(" / "),
		);
	}
	const farmland = mapContext.farmlandNavi.nearest;
	if (farmland) {
		const farmlandPolygon = mapContext.farmlandNavi.fieldPolygons[0] ?? null;
		parts.push(
			[
				"農地ナビ接続",
				"WAGRI農地API",
				"eMAFF農地ナビ",
				farmlandPolygon ? "ID付与済み筆ポリゴン取得API v3" : "",
				farmlandPolygon ? "農地筆ポリゴン候補" : "",
				farmlandPolygon?.fieldPolygonId ? `筆ポリゴンID: ${farmlandPolygon.fieldPolygonId}` : "",
				farmlandPolygon?.geometryType ? `農地区画形状候補: ${farmlandPolygon.geometryType}` : farmlandPolygon ? "農地区画形状候補" : "",
				farmland.landCategory ? `地目: ${farmland.landCategory}` : "",
				farmland.agriculturalClassification ? `農振法区分: ${farmland.agriculturalClassification}` : "",
				farmland.cityPlanningClassification ? `都市計画法区分: ${farmland.cityPlanningClassification}` : "",
				farmland.jurisdictionAgricultureCommitteeName ? `所管農業委員会: ${farmland.jurisdictionAgricultureCommitteeName}` : "",
			].filter(Boolean).join(" / "),
		);
	}
	const gridRecord = mapContext.gridCapacity.records[0] ?? null;
	if (gridRecord) {
		parts.push(
			[
				"系統空き確認",
				"公表値候補",
				"資源エネルギー庁",
				"OCCTO/電力広域的運営推進機関",
				mapContext.gridCapacity.officialLinks.some((link) => /中部/.test(link.label))
					? "中部電力パワーグリッド 系統空容量・予想潮流マッピング"
					: "",
				gridRecord.operator ? `送配電会社: ${gridRecord.operator}` : "",
				gridRecord.facilityName ? `設備: ${gridRecord.facilityName}` : "",
				gridRecord.voltageKv !== null ? `${gridRecord.voltageKv}kV` : "",
				gridRecord.availableCapacityMw !== null
					? `空容量 ${gridRecord.availableCapacityMw.toLocaleString("ja-JP", { maximumFractionDigits: 3 })}MW`
					: "",
				gridRecord.status ? `状態: ${gridRecord.status}` : "",
				"接続可否確定ではない",
				"接続検討で確認",
			].filter(Boolean).join(" / "),
		);
	} else {
		parts.push(
			[
				"系統空き確認",
				"公表値候補未取得",
				"資源エネルギー庁",
				"OCCTO/電力広域的運営推進機関",
				mapContext.gridCapacity.officialLinks.some((link) => /中部/.test(link.label))
					? "中部電力パワーグリッド 系統空容量・予想潮流マッピング"
					: "",
				"接続可否確定ではない",
				"接続検討で確認",
			].filter(Boolean).join(" / "),
		);
	}
	if (mapContext.surroundingPlaces.places.length > 0) {
		const categories = uniqueStrings(
			mapContext.surroundingPlaces.places.map((place) => place.categoryLabel).filter(Boolean),
		).slice(0, 4);
		parts.push(
			[
				"周辺条件",
				"Google Places API",
				`周辺施設候補: ${categories.join("、")}`,
				"近隣説明リスクは現地確認",
				"住宅密集判定ではない",
			].filter(Boolean).join(" / "),
		);
	}
	const road = mapContext.gsiRoad.candidates[0] ?? null;
	if (road) {
		parts.push(
			[
				`国土地理院道路候補: ${road.name || "名称未記載"}`,
				"道路中心線",
				road.category ? `道路分類=${road.category}` : "",
				`距離約${road.distanceM}m`,
				road.widthRank ? `幅員区分=${road.widthRank}` : "",
				road.widthEstimateM !== null ? `幅員推定=約${road.widthEstimateM.toFixed(1)}m` : "",
				"道路台帳で確認",
				roadLedgerConfirmationQuickEvidence(address),
			].filter(Boolean).join(" / "),
		);
	}
	const parcel = mapContext.parcelCadastre.candidates[0] ?? null;
	if (parcel) {
		parts.push(
			[
				"登記所備付地図データ接続",
				`地番候補: ${[parcel.municipality, parcel.oaza, parcel.koaza].filter(Boolean).join("")}${parcel.lotNumber ? ` ${parcel.lotNumber}` : ""}`,
				"筆界候補",
				"登記確認済みではない",
			].join(" / "),
		);
	}
	const reinfolib = mapContext.reinfolib;
	if (reinfolib.status === "connected") {
		const reinfolibParts = ["不動産情報ライブラリ接続"];
		if (reinfolib.landPrice?.priceYenPerSqm !== null && reinfolib.landPrice?.priceYenPerSqm !== undefined) {
			reinfolibParts.push(`地価公示・地価調査: ${reinfolib.landPrice.priceYenPerSqm.toLocaleString("ja-JP")}円/㎡`);
		}
		if (reinfolib.referencePriceRange) {
			reinfolibParts.push(`参考価格レンジ: ${reinfolib.referencePriceRange}（売買価格確定ではない）`);
		}
		if (reinfolib.zoning?.useArea) reinfolibParts.push(`用途地域: ${reinfolib.zoning.useArea}`);
		if (reinfolib.zoning?.buildingCoverageRatio) reinfolibParts.push(`建蔽率: ${reinfolib.zoning.buildingCoverageRatio}`);
		if (reinfolib.zoning?.floorAreaRatio) reinfolibParts.push(`容積率: ${reinfolib.zoning.floorAreaRatio}`);
		if (reinfolib.hazards.length > 0) {
			reinfolibParts.push(`防災一次確認: ${reinfolib.hazards.map((risk) => risk.label).join(" / ")}`);
		}
		if (reinfolib.transactionSummary) {
			reinfolibParts.push(`同一市区町村の取引事例候補: ${reinfolib.transactionSummary.count}件`);
		}
		parts.push(reinfolibParts.join(" / "));
	}
	return parts.join(" / ");
}

async function buildLandEvaluation(land: LandInfo): Promise<LandEvaluation> {
	const missing: string[] = [];
	if (!land.address) missing.push("所在地");
	if (!land.areaTsubo || land.areaTsubo <= 0) missing.push("面積（坪）");

	const area = land.areaTsubo ?? 0;
	const powerArea = land.powerArea || inferPowerAreaFromAddress(land.address) || "未確認";
	const areaLabel = area > 0 ? `${Math.round(area).toLocaleString("ja-JP")}坪` : "面積未確認";
	if (missing.length === 0) {
		const mapContext = await resolveLandMapContext(land);
		const latitude = land.latitude ?? mapContext.latitude;
		const longitude = land.longitude ?? mapContext.longitude;
		const road = land.road || mapContext.roadAccess;
		const farmlandNavi = mapContext.farmlandNavi;
		const nearestFarmland = farmlandNavi.nearest;
		const farmlandNaviText = farmlandNaviEvidence(farmlandNavi);
		const reinfolibText = reinfolibEvidence(mapContext.reinfolib);
		const parcelCadastreText = parcelCadastreEvidence(mapContext.parcelCadastre);
		const gsiRoadText = gsiRoadEvidence(mapContext.gsiRoad, land.address);
		const gridCapacityText = gridCapacityEvidence(mapContext.gridCapacity);
		const surroundingPlacesText = surroundingPlacesEvidence(mapContext.surroundingPlaces);
		const quickEvidence = buildLandQuickEvidence(mapContext, land.address);
		const farmland = land.farmland || nearestFarmland?.agriculturalClassification || "";
		const farmlandType = land.farmlandType || nearestFarmland?.landCategory || "";
		const landUse =
			land.landUse ||
			mapContext.reinfolib.zoning?.useArea ||
			nearestFarmland?.cityPlanningClassification ||
			"";
		const treasure: LandTreasureEvaluation = evaluateLandTreasure({
			name: land.name,
			address: land.address,
			areaTsubo: land.areaTsubo,
			powerArea,
			landUse,
			road,
			farmland,
			farmlandType,
			registry: land.registry,
			nearbyResidentialDistanceM: land.nearbyResidentialDistanceM,
			nearbyResidentialCheck: land.nearbyResidentialCheck,
			transmissionLine: land.transmissionLine,
			latitude,
			longitude,
			substationDistanceKm: land.substationDistanceKm,
		});
		const mapEvidence = [
			mapContext.googleMapsUrl ? `Google Maps: ${mapContext.googleMapsUrl}` : "",
			mapContext.geocodeSource ? `座標取得: ${mapContext.geocodeSource}` : "",
			mapContext.roadAccess ? `Google道路アクセス: ${mapContext.roadAccess}` : "",
			surroundingPlacesText,
			gridCapacityText,
			gsiRoadText,
			parcelCadastreText,
			reinfolibText,
			farmlandNaviText,
		].filter(Boolean).join("\n");
		const investigationGaps = uniqueStrings([
			...(mapContext.geocodeCandidateRequiresReview ? ["所在地・地番確認"] : []),
			...landInvestigationGaps(treasure.blockers),
		]);
		if (investigationGaps.length > 0) {
			const scout = buildLandScoutReport({
				land,
				treasure,
				mapEvidence,
				quickEvidence,
				investigationGaps,
			});
			return {
				overallGrade: "C",
				score: Math.min(treasure.score, 45),
				bucket: "要確認",
				requiresInvestigation: true,
				investigationGaps,
				actionBucket: "継続監視",
				caseStatus: "未案件化",
				projectType: treasure.projectType,
				powerArea: treasure.powerArea,
				landRating: "△",
				powerRating: treasure.powerRating,
				roadRating: treasure.roadRating,
				subsidyRating: "要確認",
				demandRating: treasure.demandRating,
				landEvaluation: scout.landEvaluation,
				powerEvaluation: treasure.powerEvaluation,
				roadEvaluation: treasure.roadEvaluation,
				subsidyEvaluation: treasure.subsidyEvaluation,
				demandEvaluation: treasure.demandEvaluation,
				nextAction: scout.nextAction,
				reviewMemo: scout.reviewMemo,
				nearestSubstationName: treasure.nearestSubstationName,
				nearestSubstationDistanceKm: treasure.nearestSubstationDistanceKm,
				shouldPatchSubstationDistance: !mapContext.geocodeCandidateRequiresReview,
				nearestSubstationOperator: treasure.nearestSubstationOperator,
				nearestSubstationGridStatus: treasure.nearestSubstationGridStatus,
				substationCandidates: treasure.substationCandidates,
				physicalAiScore: treasure.physicalAiScore,
				salesAiScore: treasure.salesAiScore,
				sabcReason: treasure.sabcReason,
				farmlandPreAssessmentText: treasure.farmlandPreAssessmentText,
			};
		}
		return {
			overallGrade: treasure.overallGrade,
			score: treasure.score,
			bucket: treasure.bucket,
			actionBucket: treasure.actionBucket,
			caseStatus: treasure.caseStatus,
			projectType: treasure.projectType,
			powerArea: treasure.powerArea,
			landRating: treasure.landRating,
			powerRating: treasure.powerRating,
			roadRating: treasure.roadRating,
			subsidyRating: treasure.subsidyRating,
			demandRating: treasure.demandRating,
			landEvaluation: mapEvidence ? `${treasure.landEvaluation}\n${mapEvidence}` : treasure.landEvaluation,
			powerEvaluation: mapEvidence ? `${treasure.powerEvaluation}\n${mapEvidence}` : treasure.powerEvaluation,
			roadEvaluation: mapEvidence ? `${treasure.roadEvaluation}\n${mapEvidence}` : treasure.roadEvaluation,
			subsidyEvaluation: treasure.subsidyEvaluation,
			demandEvaluation: treasure.demandEvaluation,
			nextAction: treasure.nextAction,
			reviewMemo: mapEvidence ? `${treasure.reviewMemo} / ${mapEvidence.replace(/\n/g, " / ")}` : treasure.reviewMemo,
			nearestSubstationName: treasure.nearestSubstationName,
			nearestSubstationDistanceKm: treasure.nearestSubstationDistanceKm,
			shouldPatchSubstationDistance: true,
			nearestSubstationOperator: treasure.nearestSubstationOperator,
			nearestSubstationGridStatus: treasure.nearestSubstationGridStatus,
			substationCandidates: treasure.substationCandidates,
			physicalAiScore: treasure.physicalAiScore,
			salesAiScore: treasure.salesAiScore,
			sabcReason: treasure.sabcReason,
			farmlandPreAssessmentText: treasure.farmlandPreAssessmentText,
		};
	}

	const score = Math.min(45, Math.max(0, 28 + (land.address ? 8 : 0) + (area > 0 ? 8 : 0)));
	const overallGrade = "C";
	const bucket = "要確認";
	const actionBucket = chooseLandActionBucket(land, score, true);
	const caseStatus = "未案件化";
	const projectType = area >= 1500 ? "高圧系統用" : area >= 300 ? "低圧バルク" : "未判定";
	const landRating = "×";
	const powerRating = "×";
	const roadRating = chooseRoadRating(land.road);
	const subsidyRating = "要確認";
	const demandRating = area >= 1500 ? "あり" : area >= 300 ? "不明" : "なし";
	const reviewMemo = `${missing.join("、")}が不足。評価前に入力を確認してください。`;

	return {
		overallGrade,
		score,
		bucket,
		actionBucket,
		caseStatus,
		projectType,
		powerArea,
		landRating,
		powerRating,
		roadRating,
		subsidyRating,
		demandRating,
		landEvaluation: [
			`${land.name}は、${areaLabel}・所在地「${land.address || "未確認"}」を起点にした土地評価です。`,
			missing.length > 0
				? `要確認: ${reviewMemo}`
				: `推測ですが、面積規模からは「${projectType}」として一次確認する価値があります。`,
			`総合評価は${overallGrade}、AI総合スコアは${score}点です。`,
		].join("\n"),
		powerEvaluation:
			powerArea === "未確認"
				? "電力会社エリアは未確認です。所在地確定後に、変電所距離・系統空き・事前相談要否を確認してください。"
				: `推測ですが、所在地から${powerArea}の可能性があります。変電所距離、系統空き、接続検討、事前相談の有無は確定情報で確認してください。`,
		roadEvaluation:
			land.road ||
			"未確認。接道幅員、道路種別、進入経路、大型車搬入可否を現地資料または道路台帳で確認してください。",
		subsidyEvaluation:
			"未確認。補助金・制度適合は年度、用途、設備種別、自治体条件により変わるため、公式情報で確認してください。",
		demandEvaluation:
			area >= 1500
				? "推測ですが、蓄電池・高圧/特高系の需要仮説を置けます。需要地距離と系統側の受け皿を優先確認してください。"
				: "推測ですが、低圧集約、売却候補、近隣案件との組み合わせで価値を確認します。単独案件化は追加確認が必要です。",
		nextAction:
			missing.length > 0
				? `まず${missing.join("、")}を入力し、再度「土地評価を開始」してください。`
				: score >= 65
					? "変電所距離、系統空き、接道、農転/登記、近隣住宅距離を確認し、案件化可否を人間が判断してください。"
					: "不足条件を整理し、接道・用途地域・農転/登記・需要地距離を確認してから再評価してください。",
		reviewMemo,
		farmlandPreAssessmentText: "",
	};
}

function landInvestigationGaps(blockers: string[]): string[] {
	const gaps: string[] = [];
	const text = blockers.join("\n");
	if (/変電所距離/.test(text)) gaps.push("変電所距離・系統空き");
	if (/接道|大型車|道路/.test(text)) gaps.push("接道幅員・大型車搬入");
	if (/農地|農転/.test(text)) gaps.push("農地・農転");
	if (/登記|所有者/.test(text)) gaps.push("登記・所有者");
	if (/近隣住宅/.test(text)) gaps.push("近隣住宅距離");
	return uniqueStrings(gaps);
}

function buildLandScoutReport(input: {
	land: LandInfo;
	treasure: LandTreasureEvaluation;
	mapEvidence: string;
	quickEvidence: string;
	investigationGaps: string[];
}): { landEvaluation: string; nextAction: string; reviewMemo: string } {
	const { land, treasure, mapEvidence, quickEvidence, investigationGaps } = input;
	const areaText =
		land.areaTsubo && land.areaTsubo > 0
			? `${Math.round(land.areaTsubo).toLocaleString("ja-JP")}坪`
			: "面積未確認";
	const distanceText =
		treasure.nearestSubstationDistanceKm !== null
			? `最寄り変電所まで約${Math.round(treasure.nearestSubstationDistanceKm * 10) / 10}km`
			: "変電所距離は未確認";
	const substationText = treasure.nearestSubstationName
		? `${treasure.nearestSubstationName}（${treasure.nearestSubstationOperator || "電力会社未確認"}）`
		: "未特定";
	const substationCandidatesText =
		treasure.substationCandidates.length > 0
			? [
				"変電所候補3件:",
				...treasure.substationCandidates.map((candidate, index) =>
					[
						`${index + 1}. ${candidate.name}`,
						`${Math.round(candidate.distanceKm * 10) / 10}km`,
						candidate.operator,
						`系統=${candidate.gridStatus || "未確認"}`,
						candidate.voltageKv !== null ? `${candidate.voltageKv}kV` : "電圧未確認",
						`確認リンク=${candidate.confirmationUrl}`,
					].join(" / "),
				),
			].join("\n")
			: "変電所候補3件: 未特定（緯度経度なし）";
	const conclusion =
		(land.areaTsubo ?? 0) >= 1500
			? "蓄電池一次候補。ただし本評価前。"
			: "土地一次候補。ただし本評価前。";
	const substationCandidateStatus =
		treasure.substationCandidates.length > 0 ? "変電所候補あり。" : "変電所候補未特定。";
	const uncheckedStatus = "農地・登記・接道・系統空きは未確認。";
	const todayActionSummary =
		"今日やることは、地番確認、農業委員会確認、道路台帳確認、空き容量マップ確認、所有者への売却意向確認。";
	const farmlandPreAssessmentText = treasure.farmlandPreAssessmentText || "";
	const farmlandSalesInputGuide = treasure.farmlandPreAssessment?.salesInputGuide || "";
	const rejectionReasons = [
		"地番・登記・所有者が確認できない",
		"農業委員会で農地区分または転用見込みを確認できない",
		"道路台帳で幅員・道路種別・大型車搬入が成立しない",
		"送配電会社の空き容量・接続検討の前提が合わない",
		"近隣説明リスクが高く、合意形成の見込みが立たない",
	];
	const nextAction = [
		todayActionSummary,
		farmlandSalesInputGuide,
		"",
		"今日やること:",
		"1. 地番を確認する",
		"2. 登記情報提供サービスで所有者・地目・地積・権利部を確認する",
		"3. 農業委員会へ農地区分と転用見込みを確認する",
		"4. 道路台帳で幅員、道路種別、大型車搬入可否を確認する",
		"5. 送配電会社の空き容量マップまたは接続検討窓口で系統空きを確認する",
		"6. Google Places APIの周辺施設候補と現地確認で、学校・病院・駅・住宅密集を含む近隣説明リスクを確認する（住宅密集判定ではない）",
		"7. 所有者へ売却意向、希望価格、引渡条件を確認する",
		"",
		"見送り理由候補:",
		...rejectionReasons.map((reason) => `- ${reason}`),
		"",
		"営業トーク:",
		"「系統用地として検討できる可能性があるため、地番と売却意向だけ先に確認させてください。」",
	].join("\n");
	const confirmationGuide = buildLandOfficialConfirmationGuide(treasure.powerArea);
	const landEvaluation = [
		"土地スカウト一次評価",
		`結論: ${conclusion}`,
		substationCandidateStatus,
		uncheckedStatus,
		todayActionSummary,
		"",
		"根拠:",
		`- 所在地: ${land.address || "未確認"}`,
		`- 面積: ${areaText}`,
		`- 電力会社エリア: ${treasure.powerArea || "未確認"}`,
		`- 変電所候補: ${substationText}`,
		substationCandidatesText,
		`- 距離: ${distanceText}`,
		"",
		"詰まり:",
		"- 安全判定: 変電所だけでは案件化・S評価にしない。",
		farmlandPreAssessmentText,
		`- 本評価不可: ${investigationGaps.join(" / ")} が未確認です。`,
		`- 未確認詳細: ${treasure.blockers.join(" / ")}`,
		"- 農転確認済み、登記確認済み、接道成立、系統空きあり、価格確定とは言いません。",
		quickEvidence ? `- 取得済み要約: ${quickEvidence}` : "",
		mapEvidence ? `- 取得済み参考情報: ${mapEvidence.replace(/\n/g, " / ")}` : "",
		"",
		confirmationGuide,
		"",
		nextAction,
	].filter(Boolean).join("\n");
	const reviewMemo = [
		`本評価不可。公的確認または人間確認が必要: ${investigationGaps.join(" / ")}`,
		`調査指示: 地番、登記、農地・農転、道路台帳、系統空き、所有者意向を確認してから本評価へ進める。`,
		`見送り理由候補: ${rejectionReasons.join(" / ")}`,
		farmlandPreAssessmentText ? `農転事前判定: ${farmlandPreAssessmentText.replace(/\n/g, " / ")}` : "",
		confirmationGuide,
		quickEvidence ? `取得済み要約: ${quickEvidence}` : "",
		mapEvidence ? `取得済み参考情報: ${mapEvidence.replace(/\n/g, " / ")}` : "",
		treasure.sabcReason ? `一次スコア根拠: ${treasure.sabcReason}` : "",
	].filter(Boolean).join("\n");
	return { landEvaluation, nextAction, reviewMemo };
}

function buildLandOfficialConfirmationGuide(powerArea: string): string {
	const gridLabel = powerArea && powerArea !== "未確認" ? `${powerArea}エリア` : "該当電力エリア";
	return [
		"確認先:",
		"- 不動産情報ライブラリ: https://www.reinfolib.mlit.go.jp/ （地価公示、地価調査、都市計画、防災、周辺施設の一次確認）",
		"- eMAFF農地ナビ: https://map.maff.go.jp/ （農地台帳、地目、農振法区分、都市計画法区分の確認。農地の所在・地番は住居住所と異なる点に注意）",
		"- 登記情報提供サービス: https://www1.touki.or.jp/ （所有者、地目、地積、権利部の確認）",
		"- 登記所備付地図: https://www.moj.go.jp/MINJI/minji05_00494.html （法務省/G空間情報センターの地図データ。証明用途は法務局または登記情報提供サービスで確認）",
		"- 資源エネルギー庁 系統情報公表ページ: https://www.enecho.meti.go.jp/category/saving_and_new/saiene/grid/07_map.html （系統情報の公表元・リンク確認）",
		"- 空き容量マップ: https://www.occto.or.jp/access/link/mapping.html （OCCTO/電力広域的運営推進機関のリンク集から送配電会社の系統連系制約マップを確認）",
		...(powerArea && /中部/.test(powerArea)
			? [
				"- 中部電力パワーグリッド 系統空容量・予想潮流マッピング: https://powergrid.chuden.co.jp/goannai/hatsuden_kouri/takuso_kyokyu/rule/map/ （公表値候補。接続可否確定ではない）",
			]
			: []),
		`- 送配電会社窓口: ${gridLabel}の接続検討、連系制約、空き容量、受電地点を確認`,
		"- 道路台帳・建築指導課・土木事務所: 幅員、道路種別、大型車搬入、接道義務を確認",
	].join("\n");
}

function chooseLandActionBucket(
	land: LandInfo,
	score: number,
	needsReview: boolean,
): string {
	if (needsReview) return "継続監視";
	if (!land.road) return "接道確認";
	if ((land.areaTsubo ?? 0) >= 1500 && !land.substationDistance) return "系統保留";
	if ((land.areaTsubo ?? 0) >= 300 && (land.areaTsubo ?? 0) < 1500) return "低圧集約";
	if (score >= 80) return "即アタック";
	if (score >= 65) return "現地確認";
	return "継続監視";
}

function chooseRoadRating(road: string): string {
	if (!road) return "要確認";
	if (/不可|なし|無し|狭い|2m未満|未接道/.test(road)) return "不可";
	if (/可|あり|有り|4m|幅員|接道/.test(road)) return "可";
	return "要確認";
}

async function markLandProcessing(
	notion: NotionClient,
	land: LandInfo,
): Promise<void> {
	await safeUpdateExistingProperties(notion, land.page, {
		処理ステータス: { kind: "select", value: "解析開始" },
		案件化状態: { kind: "select", value: "未案件化" },
		AIアクションバケット: { kind: "select", value: "継続監視" },
		一次AI受付メモ: {
			kind: "text",
			value: "Notion Workerが土地詳細評価を開始。",
		},
		Webhook引き継ぎステータス: { kind: "select", value: "処理中" },
		Webhook引き継ぎメモ: {
			kind: "text",
			value: "Notion Workerが土地詳細評価を開始。",
		},
	});
}

async function markLandNeedsReview(
	notion: NotionClient,
	land: LandInfo,
	evaluation: LandEvaluation,
): Promise<void> {
	const patches: Record<string, SafePatch> = {
		処理ステータス: { kind: "select", value: "要確認" },
		案件化状態: { kind: "select", value: "未案件化" },
		AIアクションバケット: { kind: "select", value: "継続監視" },
		総合評価: { kind: "select", value: evaluation.overallGrade },
		AI総合スコア: { kind: "number", value: evaluation.score },
		土地評価: { kind: "select", value: evaluation.landRating },
		"電力評価（仮説）": { kind: "select", value: evaluation.powerRating },
		電力評価: { kind: "select", value: evaluation.powerRating },
		AI案件種別: { kind: "select", value: evaluation.projectType },
		AI接道評価: { kind: "select", value: evaluation.roadRating },
		AI補助金評価: { kind: "select", value: evaluation.subsidyRating },
		需要評価: { kind: "select", value: evaluation.demandRating },
		案件化メモ: { kind: "text", value: evaluation.landEvaluation },
		次アクション: { kind: "text", value: evaluation.nextAction },
		一次AI受付メモ: { kind: "text", value: evaluation.reviewMemo },
		AI更新日時: { kind: "date", value: new Date().toISOString() },
		設計上の弱点: { kind: "text", value: evaluation.reviewMemo },
		Webhook引き継ぎステータス: { kind: "select", value: "要確認で停止" },
		Webhook引き継ぎメモ: { kind: "text", value: evaluation.reviewMemo },
	};
	if (
		evaluation.shouldPatchSubstationDistance !== false &&
		evaluation.nearestSubstationDistanceKm !== undefined &&
		evaluation.nearestSubstationDistanceKm !== null
	) {
		patches["変電所距離（km）"] = {
			kind: "number",
			value: Math.round(evaluation.nearestSubstationDistanceKm * 100) / 100,
		};
	}
	await safeUpdateExistingProperties(notion, land.page, patches);
}

async function markLandFailure(
	notion: NotionClient,
	land: LandInfo,
	message: string,
): Promise<void> {
	await safeUpdateExistingProperties(notion, land.page, {
		処理ステータス: { kind: "select", value: "要確認" },
		案件化状態: { kind: "select", value: "未案件化" },
		AIアクションバケット: { kind: "select", value: "継続監視" },
		一次AI受付メモ: { kind: "text", value: `土地Worker処理失敗: ${message}` },
		案件化メモ: { kind: "text", value: `土地Worker処理失敗: ${message}` },
		設計上の弱点: { kind: "text", value: `土地Worker処理失敗: ${message}` },
		Webhook引き継ぎステータス: { kind: "select", value: "引き継ぎ失敗" },
		Webhook引き継ぎメモ: { kind: "text", value: `土地Worker処理失敗: ${message}` },
	});
}

async function writeLandEvaluation(
	notion: NotionClient,
	land: LandInfo,
	evaluation: LandEvaluation,
): Promise<void> {
	const patches: Record<string, SafePatch> = {
		処理ステータス: { kind: "select", value: "完了" },
		案件化状態: { kind: "select", value: evaluation.caseStatus },
		AIアクションバケット: { kind: "select", value: evaluation.actionBucket },
		総合評価: { kind: "select", value: evaluation.overallGrade },
		AI総合スコア: { kind: "number", value: evaluation.score },
		電力会社エリア: { kind: "select", value: evaluation.powerArea },
		AI案件種別: { kind: "select", value: evaluation.projectType },
		土地評価: { kind: "select", value: evaluation.landRating },
		"電力評価（仮説）": { kind: "select", value: evaluation.powerRating },
		電力評価: { kind: "select", value: evaluation.powerRating },
		AI接道評価: { kind: "select", value: evaluation.roadRating },
		AI補助金評価: { kind: "select", value: evaluation.subsidyRating },
		需要評価: { kind: "select", value: evaluation.demandRating },
		案件化メモ: {
			kind: "text",
			value: [
				evaluation.landEvaluation,
				evaluation.powerEvaluation,
				evaluation.roadEvaluation,
				`補助金: ${evaluation.subsidyEvaluation}`,
				`需要: ${evaluation.demandEvaluation}`,
			].join("\n"),
		},
		一次AI受付メモ: { kind: "text", value: evaluation.reviewMemo },
		次アクション: { kind: "text", value: evaluation.nextAction },
		AI更新日時: { kind: "date", value: new Date().toISOString() },
		Webhook引き継ぎステータス: { kind: "select", value: "引き継ぎ済" },
		Webhook引き継ぎメモ: {
			kind: "text",
			value: "Notion Workerが土地詳細評価を返却。案件化判断は人間確認前提。",
		},
		設計上の弱点: { kind: "text", value: evaluation.reviewMemo },
	};

	const farmlandStatus = land.farmland.trim();
	if (farmlandStatus) {
		patches["農地転用可否"] = { kind: "select", value: farmlandStatus };
	}
	const registryStatus = land.registry.trim();
	if (registryStatus) {
		patches["登記確認状況"] = { kind: "select", value: registryStatus };
	}
	const nearbyResidentialCheck = land.nearbyResidentialCheck.trim();
	if (nearbyResidentialCheck) {
		patches["近隣住宅確認"] = { kind: "select", value: nearbyResidentialCheck };
	}
	if (land.nearbyResidentialDistanceM !== null && Number.isFinite(land.nearbyResidentialDistanceM)) {
		patches["近隣住宅距離（m）"] = {
			kind: "number",
			value: land.nearbyResidentialDistanceM,
		};
	}
	if (evaluation.nearestSubstationDistanceKm !== undefined && evaluation.nearestSubstationDistanceKm !== null) {
		patches["変電所距離（km）"] = {
			kind: "number",
			value: Math.round(evaluation.nearestSubstationDistanceKm * 100) / 100,
		};
	}
	if (evaluation.nearestSubstationName) {
		patches["最寄り変電所"] = { kind: "text", value: evaluation.nearestSubstationName };
		patches["最寄り変電所名"] = { kind: "text", value: evaluation.nearestSubstationName };
	}
	await safeUpdateExistingProperties(notion, land.page, patches);
}

async function createLandEvaluationLearningLog(
	notion: NotionClient,
	land: LandInfo,
	evaluation: LandEvaluation,
): Promise<void> {
	const distanceKm =
		evaluation.nearestSubstationDistanceKm !== undefined
			? evaluation.nearestSubstationDistanceKm
			: distanceKmFromText(land.substationDistance);
	const titleText = `土地評価｜${land.name}｜${evaluation.overallGrade}｜${evaluation.score}点`;
	const reason = [
		`土地名: ${land.name}`,
		`所在地: ${land.address || "未確認"}`,
		land.areaTsubo ? `面積: ${Math.round(land.areaTsubo).toLocaleString("ja-JP")}坪` : "",
		evaluation.nearestSubstationName ? `最寄り変電所: ${evaluation.nearestSubstationName}` : "",
		distanceKm !== null ? `変電所距離: ${distanceKm}km` : "変電所距離: 未確認",
		evaluation.substationCandidates && evaluation.substationCandidates.length > 0
			? `変電所候補3件: ${evaluation.substationCandidates
				.map((candidate, index) => `${index + 1}. ${candidate.name} ${Math.round(candidate.distanceKm * 10) / 10}km`)
				.join(" / ")}`
			: "",
		evaluation.sabcReason ? `SABC/2AI根拠: ${evaluation.sabcReason}` : "",
		evaluation.farmlandPreAssessmentText
			? `農転事前判定: ${evaluation.farmlandPreAssessmentText}`
			: "",
		`AIアクション: ${evaluation.actionBucket}`,
		`案件化状態予測: ${evaluation.caseStatus}`,
		evaluation.landEvaluation,
		evaluation.powerEvaluation,
	].filter(Boolean).join("\n");

	const properties: Record<string, unknown> = {
		判定名: title(titleText),
		判定種別: select("土地評価"),
		対象領域: select("土地"),
		判定日時: { date: { start: new Date().toISOString() } },
		"AI/Worker名": richText("processLandEvaluation"),
		判定バージョン: richText("land-evaluation-v2-sabc-2ai"),
		判定スコア: { number: evaluation.score },
		判定ラベル: richText(`${evaluation.overallGrade} / ${evaluation.bucket}`),
		判定根拠: richText(reason),
		次アクション: richText(evaluation.nextAction),
		実結果: select("未確認"),
		"予測との差": select("未確認"),
		学習反映状態: select("未確認"),
		土地AI総合評価: richText(evaluation.overallGrade),
		関連土地: relationIds([land.page.id]),
	};
	if (distanceKm !== null) properties.変電所距離km = { number: distanceKm };
	if (land.areaTsubo !== null) properties["土地面積（坪）"] = { number: land.areaTsubo };

	await notion.pages.create({
		parent: { data_source_id: AI_LEARNING_LOG_DATA_SOURCE_ID },
		properties,
	});
}

async function resolveMeetingPrepReport(
	notion: NotionClient,
	company: CompanyInfo,
	reportPageId?: string,
): Promise<Page | null> {
	if (reportPageId) {
		return notion.pages.retrieve({ page_id: reportPageId });
	}
	const response = await notion.dataSources.query({
		data_source_id: MEETING_PREP_REPORT_DATA_SOURCE_ID,
		page_size: 10,
		filter: {
			property: "対象企業",
			relation: { contains: company.page.id },
		},
		sorts: [{ timestamp: "created_time", direction: "descending" }],
	});
	// 1社1枚ルール(2026-06-11 大ちゃん指摘=同内容レポートが3枚4枚と並ぶのはチープ):
	// 空レポート(ボタンで先に作られた箱)があればそれを優先し、無ければ最新の既存レポートを
	// 再利用する。中身入りでも新規作成はしない=重複が構造的に生まれない。
	return (
		response.results.find((page) => isBlankMeetingPrepReport(page)) ??
		response.results[0] ??
		null
	);
}

async function createMeetingPrepReportPage(
	notion: NotionClient,
	company: CompanyInfo,
	memo: string,
): Promise<Page> {
	return notion.pages.create({
		parent: { data_source_id: MEETING_PREP_REPORT_DATA_SOURCE_ID },
		properties: {
			"企業名（商談日）": title(company.name || "商談準備レポート"),
			対象企業: relation(company.page.id),
			売買区分: select(company.dealType || "未設定"),
			ステータス: select("準備中"),
			注意点・リスク: richText(memo),
		},
	});
}

async function addMeetingPrepRelationToCompany(
	notion: NotionClient,
	companyId: string,
	reportId: string,
): Promise<void> {
	const company = await notion.pages.retrieve({ page_id: companyId });
	const current = relationIdsFromProperty(
		company.properties?.["関連商談準備レポート"],
	);
	if (current.includes(reportId)) return;
	await notion.pages.update({
		page_id: companyId,
		properties: {
			関連商談準備レポート: relationIds([...current, reportId]),
		},
	});
}

function isBlankMeetingPrepReport(page: Page): boolean {
	const properties = page.properties ?? {};
	return [
		"企業プロフィール",
		"3C分析",
		"商談仮説",
		"ヒアリングリスト",
		"注意点・リスク",
	].every((name) => !text(properties[name]));
}

function readCompany(page: Page): CompanyInfo {
	const properties = page.properties ?? {};
	return {
		page,
		name: text(properties["企業名"]),
		dealType: text(properties["売買区分"]),
		website:
			text(properties["ウェブサイトURL"]) ||
			text(properties["URL"]) ||
			text(properties["HP"]) ||
			text(properties["Webサイト"]),
		email:
			text(properties["メールアドレス"]) ||
			text(properties["問い合わせ担当者メールアドレス"]),
		phone:
			text(properties["電話番号"]) ||
			text(properties["問い合わせ担当者電話番号"]),
		contactName: text(properties["問い合わせ担当者名"]),
		address: text(properties["住所"]),
		summary: text(properties["企業サマリー"]),
		inquirySummary: text(properties["問い合わせ要約"]),
		currentIssue: text(properties["現在課題仮説"]),
		futureIssue: text(properties["将来課題仮説"]),
		salesAngle: text(properties["営業切り口"]),
		fit: text(properties["和上解決策適合"]),
		customerMarket3c: text(properties["3C：顧客・市場分析"]),
		competitor3c: text(properties["3C：競合分析"]),
		wajoRelation3c: text(properties["3C：自社との関係性"]),
		source: text(properties["根拠ソース"]),
		closingPoint: text(properties["成約へのポイント"]),
		aiMemo: text(properties["企業AI受付メモ"]),
	};
}

function companyToCardInfo(company: CompanyInfo): CardInfo {
	const domain = extractDomain(company.email) || extractDomain(company.website);
	const phone = digits(company.phone);
	const key = [
		`corp:${normalizeCompanyName(company.name)}`,
		`domain:${domain}`,
		`phone:${phone}`,
	].join("|");
	return {
		page: company.page,
		name: company.contactName,
		companyName: company.name,
		email: company.email,
		domain,
		phone,
		address: company.address,
		role: "",
		key,
	};
}

function mergeCompanyResearch(
	company: CompanyInfo,
	research: Research,
): Research {
	return {
		summary: company.summary || research.summary,
		currentIssue: company.currentIssue || research.currentIssue,
		futureIssue: company.futureIssue || research.futureIssue,
		salesAngle: company.salesAngle || research.salesAngle,
		fit: company.fit || research.fit,
		customerMarket3c: company.customerMarket3c || research.customerMarket3c,
		competitor3c: company.competitor3c || research.competitor3c,
		wajoRelation3c: company.wajoRelation3c || research.wajoRelation3c,
		source: company.source || research.source,
		closingPoint: company.closingPoint || research.closingPoint,
	};
}

function withCompanyResearch(company: CompanyInfo, research: Research): CompanyInfo {
	return {
		...company,
		summary: research.summary,
		currentIssue: research.currentIssue,
		futureIssue: research.futureIssue,
		salesAngle: research.salesAngle,
		fit: research.fit,
		customerMarket3c: research.customerMarket3c,
		competitor3c: research.competitor3c,
		wajoRelation3c: research.wajoRelation3c,
		source: research.source,
		closingPoint: research.closingPoint,
	};
}

async function buildMeetingPrepReportWithAI(
	company: CompanyInfo,
): Promise<MeetingPrepReport> {
	const fallback = buildMeetingPrepReport(company);
	const { apiKey } = resolveWajoAnthropicConfig(process.env);
	if (!apiKey) return fallback;
	try {
		return await callAnthropicMeetingPrepReport(company, fallback);
	} catch (error) {
		console.log("meeting prep AI fallback used", String(error));
		return fallback;
	}
}

async function callAnthropicMeetingPrepReport(
	company: CompanyInfo,
	fallback: MeetingPrepReport,
): Promise<MeetingPrepReport> {
	const systemPrompt = [
		"あなたは和上ホールディングスの商談準備ブリーフAIです。",
		"営業マンが商談前にそのまま使える、企業別で具体的な準備レポートを作ります。",
		"",
		"重要:",
		"- 汎用テンプレートにしない",
		"- 「再エネ活用、蓄電池導入、発電所売買、脱炭素対応、電力コスト対策を検討する法人または投資家層」のような汎用文をそのまま使わない",
		"- 「競合は蓄電池開発会社、EPC、アグリゲーター」のような業界一般論だけで終わらせない",
		"- 会社情報にない事実は断定しない",
		"- 事実が不足する軸は推測で埋めず、『【取れていない事実】X が未確認。【取れば取れる】Y があれば X を取得可能。【初回ヒアリングで取る】Z』の3段構造で明示する",
		"- 営業マンが最初の5分で使える入口トークと質問に落とす",
		"- 商談ステータス、タスク、評価、成約判断は更新しない",
		"",
		"出力フィールド:",
		"- profile: 企業概要、事業、接点、根拠ソースを短く整理",
		"- threeC: Customer / Competitor / Company の3見出しで、企業別に書く",
		"- hypothesis: 初回ゴール、入口トーク、商談仮説、次アクション仮説",
		"- questions: 商談で聞く質問を箇条書き",
		"- risks: 注意点、断定禁止、確認漏れリスク",
		"- body: 上記を統合した本文",
		"",
		"必ずJSONのみを返してください。",
	].join("\n");

	const userPrompt = [
		`企業名: ${company.name || "未設定"}`,
		`売買区分: ${company.dealType || "未設定"}`,
		`窓口: ${company.contactName || "未設定"}`,
		`Web/ドメイン: ${company.website || company.email || "未設定"}`,
		`住所: ${company.address || "未設定"}`,
		`企業概要: ${company.summary || "未設定"}`,
		`問い合わせ要約: ${company.inquirySummary || "未設定"}`,
		`現在課題仮説: ${company.currentIssue || "未設定"}`,
		`将来課題仮説: ${company.futureIssue || "未設定"}`,
		`営業切り口: ${company.salesAngle || "未設定"}`,
		`和上解決策適合: ${company.fit || "未設定"}`,
		`3C顧客市場: ${company.customerMarket3c || "未設定"}`,
		`3C競合: ${company.competitor3c || "未設定"}`,
		`3C和上接点: ${company.wajoRelation3c || "未設定"}`,
		`根拠ソース: ${company.source || "未設定"}`,
		`成約へのポイント: ${company.closingPoint || "未設定"}`,
		"",
		"=== 既存レポート草案（汎用表現があれば悪い例として扱い、企業別に書き直す） ===",
		JSON.stringify(fallback),
	].join("\n");

	const raw = await callAnthropicChat({
		system: systemPrompt,
		user: userPrompt.slice(0, 12000),
		maxTokens: 4000,
		temperature: 0,
		jsonSchema: MEETING_PREP_RESPONSE_FORMAT,
	});
	return normalizeMeetingPrepAIResponse(raw, fallback);
}

function normalizeMeetingPrepAIResponse(
	raw: string,
	fallback: MeetingPrepReport,
): MeetingPrepReport {
	try {
		const parsed = JSON.parse(raw) as Partial<MeetingPrepAIResponse>;
		return {
			profile: typeof parsed.profile === "string" && parsed.profile ? parsed.profile : fallback.profile,
			threeC: typeof parsed.threeC === "string" && parsed.threeC ? parsed.threeC : fallback.threeC,
			hypothesis:
				typeof parsed.hypothesis === "string" && parsed.hypothesis
					? parsed.hypothesis
					: fallback.hypothesis,
			questions:
				typeof parsed.questions === "string" && parsed.questions
					? parsed.questions
					: fallback.questions,
			risks: typeof parsed.risks === "string" && parsed.risks ? parsed.risks : fallback.risks,
			body: typeof parsed.body === "string" && parsed.body ? parsed.body : fallback.body,
		};
	} catch (error) {
		console.log("normalizeMeetingPrepAIResponse failed", String(error));
		return fallback;
	}
}

function isCompanyResearchComplete(research: Research): boolean {
	return [
		research.summary,
		research.currentIssue,
		research.futureIssue,
		research.salesAngle,
		research.fit,
		research.customerMarket3c,
		research.competitor3c,
		research.wajoRelation3c,
		research.source,
		research.closingPoint,
	].every((value) => value.trim().length > 0);
}

export { mergeCompanyResearch as mergeCompanyResearchForTest };

function appendShortMemo(current: string, note: string): string {
	if (!current) return note;
	if (current.includes(note)) return current;
	const combined = `${current}\n${note}`;
	if (combined.length <= 1800) return combined;
	if (note.length >= 1800) return note.slice(0, 1800);
	const separator = "\n--- 既存メモ抜粋 ---\n";
	const remaining = 1800 - note.length - separator.length;
	const currentExcerpt = remaining > 0 ? current.slice(Math.max(0, current.length - remaining)) : "";
	return `${note}${separator}${currentExcerpt}`.slice(0, 1800);
}

function extractDomain(value: string): string {
	if (!value) return "";
	const emailDomain = value.includes("@") ? value.split("@").pop() : "";
	if (emailDomain) return emailDomain.toLowerCase().trim();
	try {
		const url = value.startsWith("http") ? value : `https://${value}`;
		return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? "";
	}
}

function buildMeetingPrepReport(company: CompanyInfo): MeetingPrepReport {
	const name = company.name || "対象企業";
	const dealType = company.dealType || "未設定";
	const sourceNote =
		company.source ||
		"企業マスター登録情報をもとに作成。公開情報が不足する箇所は仮説として扱う。";
	const profile = [
		`対象企業: ${name}`,
		`売買区分: ${dealType}`,
		company.website ? `Web: ${company.website}` : "",
		company.contactName ? `窓口: ${company.contactName}` : "",
		company.email ? `メール: ${company.email}` : "",
		company.phone ? `電話: ${company.phone}` : "",
		`企業概要: ${
			company.summary ||
			"企業マスター上の企業概要が未入力のため、初回商談では事業内容と再エネ/蓄電池との接点を最初に確認する。"
		}`,
		company.inquirySummary ? `問い合わせ要約: ${company.inquirySummary}` : "",
		`根拠: ${sourceNote}`,
	].filter(Boolean).join("\n");

	const customerMarket =
		company.customerMarket3c ||
		`【取れていない事実】${name}固有の顧客・市場接点（業種・取引先・売上規模）が未確認。【取れば取れる】公式サイト・業種コード・取引先公開情報があれば市場ポジションを取得可能。【初回ヒアリングで取る】関心領域（再エネ/蓄電池/発電所売買/脱炭素）と意思決定者を確認する。`;
	const competitor =
		company.competitor3c ||
		`【取れていない事実】${name}が比較検討している競合関係が未確認。【取れば取れる】業界の既存提案先・取引先公開情報があれば競合軸を特定可能。【初回ヒアリングで取る】『他社見積もり/提案を受けているか』『比較軸（価格/案件品質/系統知見/許認可/運用体制）のうちどこを重視するか』を確認する。`;
	const wajo =
		company.wajoRelation3c ||
		company.fit ||
		"和上ホールディングスは、太陽光発電所仲介、系統用蓄電池、EPC/O&M、事業性判断、現場知見をまとめて提示できる点で接点を作れます。";
	const threeC = [
		"【Customer / 顧客・市場】",
		customerMarket,
		"",
		"【Competitor / 競合】",
		competitor,
		"",
		"【Company / 和上との接点】",
		wajo,
	].join("\n");

	const hypothesis = [
		`初回ゴール: ${name}が「買いたい/売りたい/相談したい」のどこにいるかを10分以内に確定する。`,
		`入口トーク: ${
			company.salesAngle ||
			"再エネ・蓄電池・発電所売買のどこに関心があるかを確認し、具体案件の有無、予算感、時期、意思決定者を押さえる。"
		}`,
		`現在課題: ${
			company.currentIssue ||
			`【取れていない事実】${name}固有の現在課題が未確認。【取れば取れる】公式IR資料・直近プレスがあれば設備投資・脱炭素方針を取得可能。【初回ヒアリングで取る】どの軸で迷いがあるか（情報・採算性・系統許認可・社内決裁）を質問で特定する。`
		}`,
		`将来課題: ${
			company.futureIssue ||
			`【取れていない事実】${name}固有の中期論点が未確認。【取れば取れる】中期経営計画・IR資料があれば方針を取得可能。【初回ヒアリングで取る】2-3年後の電力調達・設備更新・脱炭素対応・出口戦略の優先順位を確認する。`
		}`,
		`次アクション仮説: 商談後は、案件条件・予算・時期・決裁者・希望資料を整理し、関連案件または企業評価に接続する。`,
	].join("\n");

	const questions = buildHearingQuestions(company);
	const risks = [
		"公開情報が不足している場合、企業規模・事業内容・意思決定体制を断定しない。",
		"利回り、補助金、系統接続、許認可、工期、買取価格は初回商談で確約しない。",
		"購入相談の場合は、希望エリア・予算・利回り・与信・決裁者・購入期限を確認する。",
		"売却相談の場合は、所有者、権利関係、設備容量、FIT/FIP、接続状況、O&M、売却希望額を確認する。",
		"既存企業情報と今回の問い合わせ内容がズレる場合は、企業マスターを上書きせず、商談メモ側に差分として残す。",
	].join("\n");

	const body = [
		"## 商談前準備サマリー",
		profile,
		"",
		"## 3C分析",
		threeC,
		"",
		"## 商談仮説",
		hypothesis,
		"",
		"## ヒアリングリスト",
		questions,
		"",
		"## 注意点・リスク",
		risks,
	].join("\n");

	return { profile, threeC, hypothesis, questions, risks, body };
}

function assessMeetingPrepQuality(
	company: CompanyInfo,
	prep: MeetingPrepReport,
): MeetingPrepQuality {
	const notes: string[] = [];
	const source = company.source.trim();

	if (!company.name.trim()) notes.push("対象企業名が未確定");
	if (!company.summary.trim()) notes.push("企業概要が不足");
	if (!company.salesAngle.trim()) notes.push("営業切り口が不足");
	if (!company.dealType.trim() || ["未設定", "不明"].includes(company.dealType)) {
		notes.push("売買区分が未確定");
	}
	if (
		!prep.threeC.trim() ||
		!/(Customer|顧客|市場)/i.test(prep.threeC) ||
		!/(Competitor|競合)/i.test(prep.threeC) ||
		!/(Company|和上|自社)/i.test(prep.threeC)
	) {
		notes.push("3C三項目が不足");
	}
	if (isGenericMeetingPrep3c(prep.threeC)) {
		notes.push("3Cが汎用テンプレート寄り");
	}
	if (!source || isWeakMeetingPrepSource(source)) {
		notes.push("根拠ソースが弱い");
	}
	if (
		[prep.profile, prep.threeC, prep.hypothesis, prep.questions, prep.risks].some(
			(value) => value.replace(/\s/g, "").length < 80,
		)
	) {
		notes.push("商談で使う本文量が不足");
	}

	return { ready: notes.length === 0, notes };
}

function isWeakMeetingPrepSource(source: string): boolean {
	return /仮説生成|公開情報不足|追加調査前|企業マスター登録情報をもとに作成|名刺情報 \+ Notion Worker/.test(
		source,
	);
}

function isGenericMeetingPrep3c(value: string): boolean {
	return /再エネ活用、蓄電池導入、発電所売買、脱炭素対応、電力コスト対策|競合は蓄電池開発会社、EPC、アグリゲーター|太陽光・蓄電池案件の具体情報、施工\/運用知見/.test(
		value,
	);
}

function withMeetingPrepQualityMemo(
	risks: string,
	quality: MeetingPrepQuality,
): string {
	const memo = quality.ready
		? "品質チェック: 企業別情報、3C、根拠ソース、商談仮説、ヒアリング項目が揃っているため、準備完了扱い。"
		: `品質チェック: ${quality.notes.join(" / ")}。このレポートは商談準備の下書きとして扱い、人間確認後に準備完了へ進める。`;
	return `${risks}\n${memo}`;
}

function buildHearingQuestions(company: CompanyInfo): string {
	const base = [
		"今回の相談目的は、購入・売却・情報収集・比較検討のどれですか。",
		"希望時期、予算感、社内決裁者、決裁までの流れはどのようになっていますか。",
		"すでに検討中の案件、保有設備、土地、紹介元、比較先はありますか。",
		"商談後に必要な資料は、案件一覧、概算収支、会社概要、事例、現地情報のどれですか。",
	];
	const buying = [
		"購入希望の場合、希望エリア、低圧/高圧/蓄電池、利回り目線、投資期間、融資利用の有無はどうですか。",
		"案件選定で一番重視するのは、価格、利回り、系統、施工品質、運用体制、出口戦略のどれですか。",
	];
	const selling = [
		"売却希望の場合、所有者、設備容量、売却希望額、売却希望時期、O&M状況、権利関係は確認済みですか。",
		"売却理由は、資金化、事業整理、相続/承継、運用負荷、別投資への移行のどれに近いですか。",
	];
	const extra =
		company.dealType.includes("売")
			? selling
			: company.dealType.includes("購") || company.dealType.includes("買")
				? buying
				: [...buying.slice(0, 1), ...selling.slice(0, 1)];
	return [...base, ...extra].map((item) => `・${item}`).join("\n");
}

async function appendMeetingPrepReportBody(
	notion: NotionClient,
	reportId: string,
	company: CompanyInfo,
	prep: MeetingPrepReport,
	shoutaBrief?: string,
): Promise<void> {
	if (!notion.blocks?.children?.append) return;
	// 商太ブリーフは紙面ブロック(検品判定=コールアウト/▼=見出し/つかみ=引用)で組む
	const briefBlocks = shoutaBrief?.trim() ? shoutaBriefToBlocks(shoutaBrief) : [];
	await notion.blocks.children.append({
		block_id: reportId,
		children: [
			...(briefBlocks.length > 0
				? [
						headingBlock("商太の商談前ブリーフ(そのまま喋れる)", 2),
						...briefBlocks,
						dividerBlock(),
					]
				: []),
			headingBlock("商談前準備サマリー", 2),
			paragraphBlock(prep.profile),
			headingBlock("3C分析", 2),
			paragraphBlock(prep.threeC),
			headingBlock("商談仮説", 2),
			paragraphBlock(prep.hypothesis),
			headingBlock("ヒアリングリスト", 2),
			paragraphBlock(prep.questions),
			headingBlock("注意点・リスク", 2),
			paragraphBlock(prep.risks),
		],
	});
}

function headingBlock(content: string, level: 1 | 2 | 3): Record<string, unknown> {
	const type = `heading_${level}`;
	return {
		object: "block",
		type,
		[type]: { rich_text: [{ type: "text", text: { content } }] },
	};
}

function paragraphBlock(content: string): Record<string, unknown> {
	return {
		object: "block",
		type: "paragraph",
		paragraph: {
			rich_text: [{ type: "text", text: { content: content.slice(0, 1900) } }],
		},
	};
}

// ── 紙面用ブロック部品(2026-06-11 継ぎ接ぎ表示の解消) ──
function calloutBlock(
	content: string,
	emoji: string,
	color: string,
): Record<string, unknown> {
	return {
		object: "block",
		type: "callout",
		callout: {
			rich_text: [{ type: "text", text: { content: content.slice(0, 1900) } }],
			icon: { type: "emoji", emoji },
			color,
		},
	};
}

function dividerBlock(): Record<string, unknown> {
	return { object: "block", type: "divider", divider: {} };
}

function quoteBlock(content: string): Record<string, unknown> {
	return {
		object: "block",
		type: "quote",
		quote: {
			rich_text: [{ type: "text", text: { content: content.slice(0, 1900) } }],
		},
	};
}

// 2列の表(項目|内容)。1行目を行ヘッダにして「基本情報」を一覧化する。
function tableBlock(rows: Array<[string, string]>): Record<string, unknown> {
	const cell = (s: string) => [{ type: "text", text: { content: s.slice(0, 1900) } }];
	return {
		object: "block",
		type: "table",
		table: {
			table_width: 2,
			has_column_header: false,
			has_row_header: true,
			children: rows.slice(0, 30).map(([k, v]) => ({
				object: "block",
				type: "table_row",
				table_row: { cells: [cell(k), cell(v)] },
			})),
		},
	};
}

// 折りたたみ(タイトル＋中身の箇条書き)。出典の山を普段は1行に畳む。
function toggleBlock(title: string, items: string[]): Record<string, unknown> {
	return {
		object: "block",
		type: "toggle",
		toggle: {
			rich_text: [{ type: "text", text: { content: title.slice(0, 1900) } }],
			children: items.map((item) => ({
				object: "block",
				type: "bulleted_list_item",
				bulleted_list_item: {
					rich_text: [{ type: "text", text: { content: item.slice(0, 1900) } }],
				},
			})),
		},
	};
}

// 商太ブリーフを紙面ブロックへ(純関数)。
// 1行目の検品判定(✅/⚠️/ℹ️)→コールアウト、▼見出し→heading_3、
// 「つかみの一言」セクションの台詞→引用ブロック、他→段落。
function shoutaBriefToBlocks(brief: string): Array<Record<string, unknown>> {
	const blocks: Array<Record<string, unknown>> = [];
	let inTsukami = false;
	for (const raw of brief.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith("✅")) {
			blocks.push(calloutBlock(line, "✅", "green_background"));
			continue;
		}
		if (line.startsWith("⚠️") || line.startsWith("⚠")) {
			blocks.push(calloutBlock(line, "⚠️", "yellow_background"));
			continue;
		}
		if (line.startsWith("ℹ️") || line.startsWith("ℹ")) {
			blocks.push(calloutBlock(line, "ℹ️", "gray_background"));
			continue;
		}
		if (line.startsWith("▼")) {
			inTsukami = line.includes("つかみ");
			blocks.push(headingBlock(line.replace(/^▼\s*/, "▼ "), 3));
			continue;
		}
		if (inTsukami) {
			blocks.push(quoteBlock(line));
			continue;
		}
		blocks.push(paragraphBlock(line));
	}
	return blocks.slice(0, 70);
}
export { shoutaBriefToBlocks as shoutaBriefToBlocksForTest };

async function findPendingCards(
	notion: NotionClient,
	limit: number,
): Promise<Page[]> {
	const response = await notion.dataSources.query({
		data_source_id: BUSINESS_CARD_DATA_SOURCE_ID,
		page_size: limit,
		filter: {
			or: [
				{
					property: "企業連携ステータス",
					select: { equals: "未処理" },
				},
				{
					property: "名刺AI処理状態",
					select: { equals: "未処理" },
				},
			],
		},
	});
	return response.results;
}

function readInquiryEmailIntakeInputFromWebhook(
	body: Record<string, unknown>,
): InquiryEmailIntakeInput {
	return {
		subject: extractWebhookBodyText(body, [
			"件名",
			"メール件名",
			"subject",
			"Subject",
			"mailSubject",
		]),
		from: extractWebhookBodyText(body, [
			"送信者（メール）",
			"送信者",
			"from",
			"From",
			"fromEmail",
			"sender",
		]),
		to: extractWebhookBodyText(body, ["宛先（To）", "宛先", "to", "To"]),
		body: extractWebhookBodyText(body, [
			"本文",
			"メール本文",
			"body",
			"text",
			"plainText",
			"content",
		]),
		receivedAt: extractWebhookBodyText(body, [
			"受信日時",
			"受信日",
			"receivedAt",
			"received_at",
			"date",
			"Date",
			"internalDate",
		]),
		gmailMessageId: extractWebhookBodyText(body, [
			"GmailメールID",
			"メールID",
			"gmailMessageId",
			"gmail_message_id",
			"gmailId",
			"mailId",
		]),
		messageId: extractWebhookBodyText(body, [
			"Message-ID",
			"messageId",
			"message_id",
			"rfcMessageId",
			"rfc_message_id",
		]),
		threadId: extractWebhookBodyText(body, [
			"Thread-ID",
			"threadId",
			"thread_id",
			"GmailスレッドID",
			"スレッドID",
		]),
		labels: bodyString(
			body.labels ??
				body.labelIds ??
				body["Gmailラベル"] ??
				(body.data as Record<string, unknown> | undefined)?.labels,
		),
		sourceUrl: extractWebhookBodyText(body, [
			"原文リンク",
			"Gmail URL",
			"gmailUrl",
			"sourceUrl",
			"url",
			"URL",
		]),
		dryRun: booleanFromWebhookBody(body, "dryRun", false),
		linkCompany: booleanFromWebhookBody(body, "linkCompany", true),
	};
}

function buildGmailInquirySearchQuery(input: {
	sourceLabelName?: string;
	doneLabelName?: string;
	query?: string;
}): string {
	const base = input.query?.trim() || GMAIL_INQUIRY_DEFAULT_QUERY;
	const sourceLabel = input.sourceLabelName?.trim();
	const doneLabel = input.doneLabelName?.trim();
	return [
		sourceLabel ? `label:${sourceLabel}` : "",
		base,
		doneLabel ? `-label:${doneLabel}` : "",
	]
		.filter(Boolean)
		.join(" ");
}

function readGmailInquiryInput(
	message: Record<string, unknown>,
	labelNamesById: Map<string, string> = new Map(),
): InquiryEmailIntakeInput {
	const payload = (message.payload as Record<string, unknown> | undefined) ?? {};
	const headers = Array.isArray(payload.headers) ? payload.headers : [];
	const headerValue = (name: string): string => {
		const found = headers.find((header) => {
			if (!header || typeof header !== "object") return false;
			return String((header as Record<string, unknown>).name ?? "").toLowerCase() === name.toLowerCase();
		}) as Record<string, unknown> | undefined;
		return String(found?.value ?? "");
	};
	const id = String(message.id ?? "");
	const threadId = String(message.threadId ?? "");
	const labelIds = Array.isArray(message.labelIds) ? message.labelIds.map((label) => String(label)) : [];
	const labels = labelIds
		.map((labelId) => labelNamesById.get(labelId) ?? labelId)
		.filter(Boolean)
		.join(", ");
	return {
		subject: headerValue("Subject"),
		from: headerValue("From"),
		to: headerValue("To"),
		body: readGmailPlainTextBody(payload),
		receivedAt: gmailInternalDateToIso(message.internalDate) || headerValue("Date"),
		gmailMessageId: id,
		messageId: normalizeRfcMessageId(headerValue("Message-ID")),
		threadId,
		labels,
		sourceUrl: threadId
			? `https://mail.google.com/mail/u/0/#inbox/${threadId}`
			: id
				? `https://mail.google.com/mail/u/0/#inbox/${id}`
				: "",
	};
}

function readGmailPlainTextBody(payload: Record<string, unknown>): string {
	const body = payload.body as Record<string, unknown> | undefined;
	const direct = decodeGmailBase64(body?.data);
	if (direct) return direct;
	const parts = Array.isArray(payload.parts) ? payload.parts : [];
	for (const part of parts) {
		if (!part || typeof part !== "object") continue;
		const item = part as Record<string, unknown>;
		if (String(item.mimeType ?? "").includes("text/plain")) {
			const partBody = item.body as Record<string, unknown> | undefined;
			const decoded = decodeGmailBase64(partBody?.data);
			if (decoded) return decoded;
		}
		const nested = readGmailPlainTextBody(item);
		if (nested) return nested;
	}
	return "";
}

function decodeGmailBase64(value: unknown): string {
	if (typeof value !== "string" || !value) return "";
	try {
		const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
		return Buffer.from(normalized, "base64").toString("utf8");
	} catch {
		return "";
	}
}

function gmailInternalDateToIso(value: unknown): string {
	if (typeof value !== "string" && typeof value !== "number") return "";
	const date = new Date(Number(value));
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function shouldIgnoreGmailInquiryInput(input: InquiryEmailIntakeInput): boolean {
	const source = `${input.subject ?? ""}\n${input.from ?? ""}\n${input.body ?? ""}`;
	if (/notify@yoom\.fun|Yoom/i.test(input.from ?? "")) {
		return /お問合せmail→notion|フローボット|Yoomから|エラー発生/i.test(source);
	}
	return false;
}

function normalizeGmailPollLimit(value: number | undefined): number {
	if (!Number.isFinite(value ?? 0)) return GMAIL_INQUIRY_POLL_LIMIT;
	return Math.min(Math.max(Math.floor(value ?? GMAIL_INQUIRY_POLL_LIMIT), 1), 50);
}

function createGmailApiClient(token: string): GmailApiClient {
	const request = async (
		path: string,
		options: { method?: string; body?: Record<string, unknown> } = {},
	): Promise<Record<string, unknown>> => {
		const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
			method: options.method ?? "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			...(options.body ? { body: JSON.stringify(options.body) } : {}),
		});
		if (!response.ok) {
			throw new Error(`Gmail API ${options.method ?? "GET"} ${path} failed: ${response.status}`);
		}
		return response.status === 204 ? {} : ((await response.json()) as Record<string, unknown>);
	};
	return {
		listLabels: async () => {
			const response = await request("/labels");
			return Array.isArray(response.labels)
				? response.labels
					.map((label) => label as Record<string, unknown>)
					.map((label) => ({
						id: String(label.id ?? ""),
						name: String(label.name ?? ""),
					}))
					.filter((label) => label.id && label.name)
				: [];
		},
		createLabel: async (name: string) => {
			const response = await request("/labels", {
				method: "POST",
				body: {
					name,
					labelListVisibility: "labelShow",
					messageListVisibility: "show",
				},
			});
			return {
				id: String(response.id ?? ""),
				name: String(response.name ?? name),
			};
		},
		listMessages: async (query: string, limit: number) => {
			const params = new URLSearchParams({
				q: query,
				maxResults: String(limit),
			});
			const response = await request(`/messages?${params.toString()}`);
			return Array.isArray(response.messages)
				? response.messages
					.map((message) => message as Record<string, unknown>)
					.map((message) => ({ id: String(message.id ?? "") }))
					.filter((message) => message.id)
				: [];
		},
		getMessage: async (id: string) => request(`/messages/${encodeURIComponent(id)}?format=full`),
		modifyMessage: async (id: string, input: { addLabelIds?: string[]; removeLabelIds?: string[] }) => {
			await request(`/messages/${encodeURIComponent(id)}/modify`, {
				method: "POST",
				body: {
					addLabelIds: input.addLabelIds ?? [],
					removeLabelIds: input.removeLabelIds ?? [],
				},
			});
		},
	};
}

async function resolveGmailInquiryLabels(
	gmail: GmailApiClient,
	sourceLabelName: string,
	doneLabelName: string,
): Promise<{
	sourceLabel: GmailLabel | null;
	doneLabel: GmailLabel;
	labelNamesById: Map<string, string>;
}> {
	const labels = await gmail.listLabels();
	const labelNamesById = new Map(labels.map((label) => [label.id, label.name]));
	const sourceLabel = labels.find((label) => label.name === sourceLabelName) ?? null;
	let doneLabel = labels.find((label) => label.name === doneLabelName);
	if (!doneLabel) {
		doneLabel = await gmail.createLabel(doneLabelName);
		labelNamesById.set(doneLabel.id, doneLabel.name);
	}
	return { sourceLabel, doneLabel, labelNamesById };
}

async function processGmailInquiryInbox(
	input: GmailInquiryInboxInput,
	notion: NotionClient,
	gmail: GmailApiClient,
): Promise<GmailInquiryInboxResult> {
	const dryRun = input.dryRun !== false;
	const limit = normalizeGmailPollLimit(input.limit);
	const sourceLabelName = input.sourceLabelName?.trim() || GMAIL_INQUIRY_SOURCE_LABEL_NAME;
	const doneLabelName = input.doneLabelName?.trim() || GMAIL_INQUIRY_DONE_LABEL_NAME;
	const removeSourceLabel =
		typeof input.removeSourceLabel === "boolean"
			? input.removeSourceLabel
			: GMAIL_INQUIRY_REMOVE_SOURCE_LABEL;
	const { sourceLabel, doneLabel, labelNamesById } = await resolveGmailInquiryLabels(
		gmail,
		sourceLabelName,
		doneLabelName,
	);
	const query = buildGmailInquirySearchQuery({
		sourceLabelName,
		doneLabelName,
		query: input.query,
	});
	const refs = await gmail.listMessages(query, limit);
	let created = 0;
	let existing = 0;
	let ignored = 0;
	let labelled = 0;
	let errors = 0;
	let dryRunReady = 0;
	const samples: string[] = [];

	for (const ref of refs) {
		try {
			const message = await gmail.getMessage(ref.id);
			const emailInput = readGmailInquiryInput(message, labelNamesById);
			if (shouldIgnoreGmailInquiryInput(emailInput)) {
				ignored += 1;
				samples.push(`ignored:${emailInput.subject || ref.id}`);
				if (!dryRun) {
					await gmail.modifyMessage(ref.id, {
						addLabelIds: [doneLabel.id],
						removeLabelIds: removeSourceLabel && sourceLabel?.id ? [sourceLabel.id] : [],
					});
					labelled += 1;
				}
				continue;
			}
			const result = await processInquiryEmailIntake(
				{
					...emailInput,
					dryRun,
					linkCompany: input.linkCompany,
				},
				notion,
			);
			if (result.action === "created-inquiry") created += 1;
			if (result.action === "skipped-existing" || result.action === "duplicate-hold") existing += 1;
			if (result.action === "dry-run") dryRunReady += 1;
			if (
				result.action === "created-inquiry" ||
				result.action === "skipped-existing" ||
				result.action === "duplicate-hold"
			) {
				if (!dryRun) {
					await gmail.modifyMessage(ref.id, {
						addLabelIds: [doneLabel.id],
						removeLabelIds: removeSourceLabel && sourceLabel?.id ? [sourceLabel.id] : [],
					});
					labelled += 1;
				}
			}
			samples.push(`${result.action}:${emailInput.subject || ref.id}`);
		} catch (error) {
			errors += 1;
			samples.push(`error:${ref.id}:${String(error).slice(0, 120)}`);
		}
	}

	return {
		action: dryRun ? "dry-run" : "processed",
		checked: refs.length,
		created,
		existing,
		ignored,
		labelled,
		errors,
		dryRunReady,
		samples: samples.slice(0, 10),
		message: dryRun
			? `dry-run: Gmail問い合わせ ${refs.length} 件を確認しました。Notion作成とGmailラベル変更は行っていません。`
			: `Gmail問い合わせ ${refs.length} 件を処理しました。作成${created}、既存${existing}、除外${ignored}、ラベル付与${labelled}、エラー${errors}。`,
	};
}

function readCustomerContactLogInputFromWebhook(
	body: Record<string, unknown>,
): CustomerContactLogInput {
	return {
		sourcePageId: extractSourcePageIdFromWebhook(body) ?? "",
		sourceType: extractWebhookBodyText(body, [
			"フェーズ区分",
			"sourceType",
			"source_type",
			"phase",
			"種別",
		]),
		activityType: extractWebhookBodyText(body, [
			"活動種別",
			"activityType",
			"activity_type",
			"contactType",
			"contact_type",
		]),
		activityContent: extractWebhookBodyText(body, [
			"活動内容",
			"activityContent",
			"activity_content",
			"content",
			"内容",
		]),
		nextAction: extractWebhookBodyText(body, [
			"次回アクション",
			"nextAction",
			"next_action",
			"next",
		]),
		occurredAt: extractWebhookBodyText(body, [
			"接点日時",
			"活動日時",
			"occurredAt",
			"occurred_at",
			"date",
		]),
		dryRun: booleanFromWebhookBody(body, "dryRun", false),
	};
}

function extractSourcePageIdFromWebhook(body: Record<string, unknown>): string | undefined {
	return firstString(
		body.sourcePageId,
		body.source_page_id,
		body.inquiryPageId,
		body.inquiry_page_id,
		body.projectPageId,
		body.project_page_id,
		body.dealPageId,
		body.deal_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "sourcePageId"]),
		readNestedString(body, ["data", "source_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

function readInquiryEmailInfo(input: InquiryEmailIntakeInput): InquiryEmailInfo {
	const source = input.body ?? "";
	const fromRaw = input.from ?? "";
	const fromEmail = extractEmailAddress(fromRaw);
	const explicitEmail = extractInquiryLineValue(source, [
		"メールアドレス",
		"Email",
		"mail",
		"連絡先メール",
	]);
	const contactEmail = extractEmailAddress(explicitEmail) || fromEmail;
	const subject = (input.subject ?? "").trim();
	const receivedAt = normalizeEmailReceivedAt(input.receivedAt ?? "");
	const contactName = extractInquiryLineValue(source, [
		"お名前",
		"名前",
		"氏名",
		"ご担当者名",
		"担当者名",
	]).slice(0, 120);
	const companyName =
		extractInquiryLineValue(source, ["会社名", "法人名", "企業名", "貴社名"]).slice(
			0,
			120,
		) || inferCompanyNameFromInquiryText(`${subject}\n${source}`);
	const phone = digits(
		extractInquiryLineValue(source, [
			"電話番号",
			"TEL",
			"Tel",
			"携帯番号",
			"連絡先電話番号",
		]),
	);
	const labels = normalizeLabelText(input.labels ?? "");
	const inquiryType = inferInquiryTypeFromEmail({ subject, body: source, companyName });
	const dealType = inferDealTypeFromEmail(`${subject}\n${source}`);
	const categoryCode = inferInquiryCategoryCode({
		subject,
		body: source,
		labels,
		inquiryType,
		dealType,
	});
	const titleInput = {
		subject,
		body: source,
		labels,
		companyName,
		contactName,
		inquiryType,
		dealType,
		categoryCode,
	};
	const displayTitle = buildInquiryDisplayTitle(titleInput);
	const attentionReasons = buildInquiryAttentionReasons(titleInput);
	const attentionMemo = buildInquiryAttentionMemo(titleInput);
	const gmailMessageId = (input.gmailMessageId ?? "").trim();
	const messageId = normalizeRfcMessageId(input.messageId ?? "");
	const threadId = (input.threadId ?? "").trim();
	const duplicateKeys = buildInquiryEmailDuplicateKeys({
		subject,
		contactEmail,
		receivedAt,
		gmailMessageId,
		messageId,
		threadId,
	});
	const primaryKey =
		duplicateKeys[0] ??
		buildInquiryDuplicateKey(companyName, contactEmail, phone) ??
		`mail-fallback:${normalizeLookupText(subject).slice(0, 60)}`;
	return {
		subject,
		displayTitle,
		attentionMemo,
		attentionReasons,
		categoryCode,
		fromRaw,
		fromEmail,
		contactEmail,
		to: (input.to ?? "").trim(),
		body: source.trim(),
		receivedAt,
		gmailMessageId,
		messageId,
		threadId,
		labels,
		sourceUrl: (input.sourceUrl ?? "").trim(),
		contactName,
		companyName,
		phone,
		inquiryType,
		dealType,
		duplicateKeys,
		primaryKey,
	};
}

function extractInquiryLineValue(body: string, labels: string[]): string {
	for (const label of labels) {
		const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const match = body.match(new RegExp(`${escaped}\\s*[:：]\\s*([^\\n\\r]+)`, "i"));
		if (match?.[1]?.trim()) return cleanNewsText(match[1]).slice(0, 500);
	}
	return "";
}

function extractEmailAddress(value: string): string {
	const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
	return match?.[0]?.trim().toLowerCase() ?? "";
}

function normalizeEmailReceivedAt(value: string): string {
	const parsed = value ? new Date(value) : new Date();
	if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
	return parsed.toISOString();
}

function normalizeRfcMessageId(value: string): string {
	return value.trim().replace(/^<|>$/g, "");
}

function normalizeLabelText(value: string): string {
	return uniqueStrings(
		value
			.split(/[\n,、]/)
			.map((label) => label.trim())
			.filter(Boolean),
	).join(", ");
}

function buildInquiryEmailDuplicateKeys(input: {
	subject: string;
	contactEmail: string;
	receivedAt: string;
	gmailMessageId: string;
	messageId: string;
	threadId: string;
}): string[] {
	const keys: string[] = [];
	if (input.gmailMessageId) keys.push(`gmail:${input.gmailMessageId}`);
	if (input.messageId) keys.push(`message-id:${input.messageId}`);
	if (input.threadId && input.contactEmail) {
		keys.push(`thread:${input.threadId}|email:${input.contactEmail}`);
	}
	const legacyDate = normalizeLegacyMailDate(input.receivedAt);
	if (input.contactEmail && input.subject && legacyDate) {
		keys.push(`${input.contactEmail}|${input.subject}|${legacyDate}`);
		keys.push(`${input.contactEmail}｜${input.subject}｜${legacyDate}`);
	}
	return uniqueStrings(keys);
}

function normalizeLegacyMailDate(value: string): string {
	const parsed = value ? new Date(value) : null;
	if (!parsed || Number.isNaN(parsed.getTime())) return value;
	return parsed.toISOString().replace(".000Z", "Z");
}

function inferInquiryTypeFromEmail(input: {
	subject: string;
	body: string;
	companyName: string;
}): string {
	const body = `${input.subject}\n${input.body}`;
	if (input.companyName || /法人|会社|株式会社|合同会社|有限会社|御社|貴社/.test(body)) {
		return "法人";
	}
	if (/個人|売却査定|太陽光発電所|とくとくファーム|買いたい/.test(body)) {
		return "個人投資家";
	}
	return "不明";
}

function inferDealTypeFromEmail(value: string): string {
	if (/売却|査定|買取|資産価値|見積もり依頼/.test(value)) return "売却相談";
	if (/購入|買いたい|販売|詳細希望|資料請求|権利付き/.test(value)) return "購入相談";
	if (/相談|問い合わせ|お問合せ|資料/.test(value)) return "その他相談";
	return "不明";
}

function inferInquiryCategoryCode(input: {
	subject: string;
	body: string;
	labels?: string;
	inquiryType?: string;
	dealType?: string;
}): string {
	const value = `${input.subject}\n${input.body}\n${input.labels ?? ""}`;
	if (/蓄電池|蓄電所|系統用|BESS|ESS/i.test(value)) return "⑤ 蓄電池";
	if (/特高|高圧|[5-9]\d\s*kW|[1-9]\d{2,}\s*kW|MW|メガソーラー/i.test(value)) {
		return "④ 高圧";
	}
	if (/低圧|49\.?5\s*kW|50\s*kW未満|小規模太陽光/i.test(value)) return "③ 低圧";
	if (input.dealType === "売却相談" || /売却|査定|買取|資産価値/.test(value)) {
		return "① 売却査定";
	}
	if (input.dealType === "購入相談" || /購入|買いたい|買付|販売案件|資料請求/.test(value)) {
		return "② 購入相談";
	}
	if (input.inquiryType === "法人") return "⑥ 法人相談";
	return "⑦ その他";
}

function buildInquiryDisplayTitle(input: {
	subject: string;
	body: string;
	labels?: string;
	companyName?: string;
	contactName?: string;
	inquiryType?: string;
	dealType?: string;
	categoryCode?: string;
}): string {
	const subject = stripInquiryReceptionPrefix(input.subject);
	const categoryCode =
		input.categoryCode ??
		inferInquiryCategoryCode({
			subject,
			body: input.body,
			labels: input.labels,
			inquiryType: input.inquiryType,
			dealType: input.dealType,
		});
	const compact = buildCompactInquiryTitleParts({ ...input, subject, categoryCode });
	const titleText = [
		compact.dealCode,
		compact.party,
		compact.assetLabel,
		compact.scaleLabel,
		compact.needsAttention ? "⚠" : "",
	]
		.filter(Boolean)
		.join("｜");
	return compactOneLine(titleText || compact.assetLabel || "その他", 80);
}

function buildNumberedInquiryDisplayTitle(
	receptionNumber: string,
	displayTitle: string,
): string {
	const cleanTitle = stripInquiryReceptionPrefix(displayTitle).trim();
	if (!receptionNumber) return compactOneLine(cleanTitle, 100);
	return compactOneLine(`${receptionNumber}｜${cleanTitle || "⑦ その他"}`, 100);
}

function extractInquiryReceptionNumber(value: string): string {
	const match = value.match(/問-\d{6}-\d{3,}/);
	return match?.[0] ?? "";
}

function extractInquiryReceptionParts(value: string): { dateStamp: string; sequence: number } | null {
	const match = value.match(/問-(\d{6})-(\d{3,})/);
	if (!match?.[1] || !match[2]) return null;
	return { dateStamp: match[1], sequence: Number.parseInt(match[2], 10) };
}

function stripInquiryReceptionPrefix(value: string): string {
	return value.replace(/^問-\d{6}-\d{3,}\s*[｜|]\s*/u, "").trim();
}

function inquiryReceptionDateStamp(value: string): string {
	const parsed = value ? new Date(value) : new Date();
	const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
	const tokyo = new Date(date.getTime() + 9 * 60 * 60 * 1000);
	const year = String(tokyo.getUTCFullYear()).slice(-2);
	const month = String(tokyo.getUTCMonth() + 1).padStart(2, "0");
	const day = String(tokyo.getUTCDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

function buildInquiryReceptionNumber(dateStamp: string, sequence: number): string {
	return `問-${dateStamp}-${String(sequence).padStart(3, "0")}`;
}

async function nextInquiryReceptionNumber(
	notion: NotionClient,
	receivedAt: string,
): Promise<string> {
	const dateStamp = inquiryReceptionDateStamp(receivedAt);
	const prefix = `問-${dateStamp}-`;
	let maxSequence = 0;
	let startCursor: string | undefined;
	try {
		do {
			const existing = await notion.dataSources.query({
				data_source_id: INQUIRY_DATA_SOURCE_ID,
				filter: {
					property: "受付番号",
					rich_text: { starts_with: prefix },
				},
				page_size: 100,
				...(startCursor ? { start_cursor: startCursor } : {}),
			});
			for (const page of (existing.results ?? []) as Page[]) {
				const properties = page.properties ?? {};
				const parts = extractInquiryReceptionParts(
					text(properties["受付番号"]) || text(properties["件名"]),
				);
				if (parts?.dateStamp === dateStamp) {
					maxSequence = Math.max(maxSequence, parts.sequence);
				}
			}
			startCursor =
				existing.has_more && typeof existing.next_cursor === "string"
					? existing.next_cursor
					: undefined;
		} while (startCursor);
	} catch (error) {
		console.log("受付番号の既存検索をスキップしました", String(error));
	}
	return buildInquiryReceptionNumber(dateStamp, maxSequence + 1);
}

function cleanInquiryTitleToken(value: string): string {
	return value
		.replace(/^(企業名|会社名|法人名|氏名|お名前)\s*[:：]\s*/g, "")
		.replace(/企業名不明|会社名不明|法人名不明|氏名不明|不明企業|未設定/g, "")
		.replace(/株式会社\s*$/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 32);
}

function buildCompactInquiryTitleParts(input: {
	subject: string;
	body: string;
	labels?: string;
	companyName?: string;
	contactName?: string;
	inquiryType?: string;
	dealType?: string;
	categoryCode?: string;
}): {
	dealCode: string;
	party: string;
	assetLabel: string;
	scaleLabel: string;
	needsAttention: boolean;
	attentionReasons: string[];
} {
	const value = inquiryTitleSearchText(input);
	const dealCode = compactInquiryDealCode(input.dealType ?? "", value);
	const party = compactInquiryParty(input);
	const assetLabel = compactInquiryAssetLabel(input.categoryCode ?? "", value);
	const scaleLabel = compactSolarScaleLabel(input.categoryCode ?? "", value);
	const attentionReasons = buildInquiryAttentionReasons(input);
	return {
		dealCode,
		party,
		assetLabel,
		scaleLabel,
		needsAttention: attentionReasons.length > 0,
		attentionReasons,
	};
}

function compactInquiryDealCode(dealType: string, value: string): string {
	if (/売買両方|売り買い|売却.*購入|購入.*売却/.test(`${dealType}\n${value}`)) return "売買";
	if (/売却|査定|売りたい|売主|買取/.test(`${dealType}\n${value}`)) return "売";
	if (/購入|買いたい|買主|販売案件|資料請求/.test(`${dealType}\n${value}`)) return "買";
	if (/相談|問い合わせ|お問合せ|資料/.test(`${dealType}\n${value}`)) return "相談";
	return "";
}

function compactInquiryParty(input: {
	companyName?: string;
	contactName?: string;
	inquiryType?: string;
}): string {
	const contact = cleanInquiryTitleToken(input.contactName ?? "");
	const company = cleanInquiryTitleToken(input.companyName ?? "");
	if (contact && company) return compactOneLine(`${contact}/${company}`, 28);
	if (contact) return compactOneLine(contact, 28);
	if (company) return compactOneLine(company, 28);
	if (input.inquiryType === "法人") return "法人";
	if (input.inquiryType === "個人投資家") return "個人";
	return "";
}

function compactInquiryAssetLabel(categoryCode: string, value: string): string {
	if (/蓄電池|蓄電所|系統用|BESS|ESS/i.test(`${categoryCode}\n${value}`)) return "蓄電池";
	if (/土地|用地|地権者/.test(value)) return "土地";
	if (/FIP展|FIP.*展開|FIP/.test(value)) return "FIP展";
	if (/施工|工事|建設/.test(value)) return "施工";
	if (/材料|部材|商材|パネル|PCS|パワコン/.test(value) && !isSolarInquiry(categoryCode, value)) {
		return "材料";
	}
	if (/メンテ|O&M|保守|管理/.test(value)) return "メンテ";
	if (/顧問|アドバイザー|コンサル/.test(value)) return "顧問希望";
	if (isSolarInquiry(categoryCode, value)) return "太陽光";
	return categoryCode.replace(/^[①②③④⑤⑥⑦]\s*/u, "") || "その他";
}

function compactSolarScaleLabel(categoryCode: string, value: string): string {
	if (!isSolarInquiry(categoryCode, value)) return "";
	const low = /低圧|49\.?5\s*kW|50\s*kW未満|小規模太陽光|③\s*低圧/i.test(
		`${categoryCode}\n${value}`,
	);
	const high = /特高|高圧|[5-9]\d\s*kW|[1-9]\d{2,}\s*kW|MW|メガソーラー|④\s*高圧/i.test(
		`${categoryCode}\n${value}`,
	);
	const bulk = isBulkSolarInquiry(value);
	if (low && bulk) return "低バ";
	if (high && bulk) return "高バ";
	if (low) return "低";
	if (high) return "高";
	if (bulk) return "バ";
	return "";
}

function buildInquiryAttentionMemo(input: {
	subject: string;
	body: string;
	labels?: string;
	companyName?: string;
	contactName?: string;
	inquiryType?: string;
	dealType?: string;
	categoryCode?: string;
}): string {
	const reasons = buildInquiryAttentionReasons(input);
	if (reasons.length === 0) return "";
	return [
		"太陽光案件のため中身確認が必要です。",
		`確認理由: ${reasons.join(" / ")}`,
	].join("\n");
}

function buildInquiryAttentionReasons(input: {
	subject: string;
	body: string;
	labels?: string;
	companyName?: string;
	contactName?: string;
	inquiryType?: string;
	dealType?: string;
	categoryCode?: string;
}): string[] {
	const value = inquiryTitleSearchText(input);
	const categoryCode =
		input.categoryCode ??
		inferInquiryCategoryCode({
			subject: input.subject,
			body: input.body,
			labels: input.labels,
			inquiryType: input.inquiryType,
			dealType: input.dealType,
		});
	if (!isSolarInquiry(categoryCode, value)) return [];
	const dealCode = compactInquiryDealCode(input.dealType ?? "", value);
	if (dealCode !== "売" && dealCode !== "売買") return [];

	const reasons: string[] = [];
	if (!hasSolarLocation(value)) reasons.push("所在地未確認");
	if (!hasSolarPrice(value)) reasons.push("販売価格未確認");
	if (!hasSolarTariff(value)) reasons.push("FIT/FIP・売電単価未確認");
	if (hasExplicitMissingPhoto(value)) {
		reasons.push("現場写真未添付");
	} else if (!hasSolarPhotoMention(value)) {
		reasons.push("現場写真未確認");
	}
	if (isBulkSolarInquiry(value)) reasons.push("バルク候補");
	return uniqueStrings(reasons);
}

function inquiryTitleSearchText(input: {
	subject: string;
	body: string;
	labels?: string;
	companyName?: string;
	contactName?: string;
	inquiryType?: string;
	dealType?: string;
	categoryCode?: string;
}): string {
	return [
		input.subject,
		input.body,
		input.labels ?? "",
		input.companyName ?? "",
		input.contactName ?? "",
		input.inquiryType ?? "",
		input.dealType ?? "",
		input.categoryCode ?? "",
	].join("\n");
}

function isSolarInquiry(categoryCode: string, value: string): boolean {
	return /太陽光|発電所|売電|低圧|高圧|特高|FIT|FIP|パネル|パワコン|PCS|ソーラー|③\s*低圧|④\s*高圧/i.test(
		`${categoryCode}\n${value}`,
	);
}

function isBulkSolarInquiry(value: string): boolean {
	return /バルク|複数|多数|まとめ|一括|集約|複数区画|複数案件|[2-9]\s*(件|基|区画|発電所|サイト)|[二三四五六七八九十]+件/.test(
		value,
	);
}

function hasSolarLocation(value: string): boolean {
	return /所在地|住所|場所|都道府県|北海道|東京都|大阪府|京都府|.{1,4}県|市|区|町|村/.test(
		value,
	);
}

function hasSolarPrice(value: string): boolean {
	return /販売価格|仕入れ価格|希望売却価格|売却希望価格|希望価格|価格\s*[:：]\s*[0-9]|[0-9０-９,，.]+\s*(万円|円)/.test(
		value,
	);
}

function hasSolarTariff(value: string): boolean {
	return /FIT|FIP|売電単価|売電価格|固定買取|円\s*\/\s*kWh|円\s*\/\s*kw|kWh単価/i.test(
		value,
	);
}

function hasExplicitMissingPhoto(value: string): boolean {
	return /現場写真|発電所写真|現地写真|外観写真|設備写真|写真/.test(value) && /未添付|添付なし|なし|無し|未提出|未入力/.test(value);
}

function hasSolarPhotoMention(value: string): boolean {
	return /現場写真|発電所写真|現地写真|外観写真|設備写真|写真/.test(value);
}

function simplifyInquiryDealType(value: string): string {
	if (/売却/.test(value)) return "売却";
	if (/購入/.test(value)) return "購入";
	if (/その他/.test(value)) return "相談";
	return "";
}

function inferInquiryAssetHint(value: string, categoryCode: string): string {
	if (/高圧|低圧|蓄電池/.test(categoryCode)) return "";
	if (/太陽光発電所|発電所|売電/.test(value)) return "太陽光発電所";
	if (/土地|用地|地権者/.test(value)) return "土地";
	if (/工事|施工|建設/.test(value)) return "工事";
	if (/卸|部材|パネル|PCS|パワコン/.test(value)) return "商材";
	return "";
}

async function findExistingInquiryByEmail(
	notion: NotionClient,
	emailInfo: InquiryEmailInfo,
): Promise<Page[]> {
	const pages: Page[] = [];
	for (const key of emailInfo.duplicateKeys) {
		pages.push(
			...(await safeInquiryQuery(notion, {
				property: "重複チェックキー",
				rich_text: { equals: key },
			})),
		);
		pages.push(
			...(await safeInquiryQuery(notion, {
				property: "メールID（ユニークキー）",
				rich_text: { equals: key },
			})),
		);
	}
	if (emailInfo.messageId) {
		pages.push(
			...(await safeInquiryQuery(notion, {
				property: "Message-ID",
				rich_text: { equals: emailInfo.messageId },
			})),
		);
	}
	if (emailInfo.threadId) {
		pages.push(
			...(await safeInquiryQuery(notion, {
				property: "Thread-ID",
				rich_text: { equals: emailInfo.threadId },
			})),
		);
	}
	const contactCandidates = await findExistingInquiryByContact(notion, emailInfo);
	pages.push(...contactCandidates);
	return uniquePages(pages);
}

async function findExistingInquiryByContact(
	notion: NotionClient,
	emailInfo: InquiryEmailInfo,
): Promise<Page[]> {
	const candidates: Page[] = [];
	if (emailInfo.contactEmail) {
		candidates.push(
			...(await safeInquiryQuery(notion, {
				property: "メールアドレス",
				email: { equals: emailInfo.contactEmail },
			})),
		);
	}
	if (emailInfo.phone) {
		candidates.push(
			...(await safeInquiryQuery(notion, {
				property: "電話番号",
				phone_number: { equals: emailInfo.phone },
			})),
		);
	}
	if (emailInfo.contactName) {
		candidates.push(
			...(await safeInquiryQuery(notion, {
				property: "お名前",
				rich_text: { equals: emailInfo.contactName },
			})),
		);
	}
	return uniquePages(candidates).filter((page) =>
		isSameInquiryContactCandidate(page, emailInfo),
	);
}

function isSameInquiryContactCandidate(page: Page, emailInfo: InquiryEmailInfo): boolean {
	const properties = page.properties ?? {};
	const candidateEmail = text(properties["メールアドレス"]).toLowerCase();
	const candidatePhone = digits(text(properties["電話番号"]));
	const candidateName = normalizeLookupText(text(properties["お名前"]) || text(properties["氏名"]));
	const emailMatches = Boolean(emailInfo.contactEmail && candidateEmail === emailInfo.contactEmail);
	const phoneMatches = Boolean(emailInfo.phone && candidatePhone === emailInfo.phone);
	const nameMatches = Boolean(
		emailInfo.contactName &&
			candidateName === normalizeLookupText(emailInfo.contactName),
	);
	if (phoneMatches && (emailMatches || nameMatches)) return true;
	if (emailMatches && nameMatches) return true;
	if (!emailMatches) return false;
	const candidateDate = dateStartFromProperty(properties["受信日時"]);
	return isNearbyInquiryDate(candidateDate, emailInfo.receivedAt);
}

function isNearbyInquiryDate(left: string, right: string): boolean {
	const leftDate = left ? new Date(left) : null;
	const rightDate = right ? new Date(right) : null;
	if (!leftDate || !rightDate) return true;
	if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return true;
	const diffMs = Math.abs(leftDate.getTime() - rightDate.getTime());
	return diffMs <= 14 * 24 * 60 * 60 * 1000;
}

async function createInquiryFromEmail(
	notion: NotionClient,
	emailInfo: InquiryEmailInfo,
): Promise<Page> {
	const receptionNumber = await nextInquiryReceptionNumber(notion, emailInfo.receivedAt);
	const displayTitle = buildNumberedInquiryDisplayTitle(
		receptionNumber,
		emailInfo.displayTitle || emailInfo.subject || "新規お問い合わせ",
	);
	const numberedEmailInfo = {
		...emailInfo,
		displayTitle,
		receptionNumber,
	};
	const properties: Record<string, unknown> = {
		件名: title(displayTitle),
		受付番号: richText(receptionNumber),
		元メール件名: richText(emailInfo.subject),
		問い合わせ分類コード: select(emailInfo.categoryCode),
		ステータス: select("未対応"),
		本文: richText(emailInfo.body),
		要約: richText(buildInquiryEmailSummary(numberedEmailInfo)),
		初回トーク方針: richText(buildInquiryEmailFirstTalk(numberedEmailInfo)),
		問い合わせ種別: select(emailInfo.inquiryType),
		売買区分: select(emailInfo.dealType),
		重複チェックキー: richText(emailInfo.primaryKey),
		"メールID（ユニークキー）": richText(emailInfo.primaryKey),
		"Message-ID": richText(emailInfo.messageId),
		"Thread-ID": richText(emailInfo.threadId),
		Gmailラベル: richText(emailInfo.labels),
		"送信者（メール）": richText(emailInfo.fromRaw || emailInfo.fromEmail),
		"宛先（To）": richText(emailInfo.to),
		企業連携ステータス: select("未処理"),
		企業登録可否: select("要確認"),
		重複判定ステータス: select("正常"),
		企業連携メモ: richText("メール入口Workerが新規作成。企業連携はWorker側で後続処理。"),
	};
	if (emailInfo.receivedAt) {
		properties["受信日時"] = { date: { start: emailInfo.receivedAt } };
	}
	if (emailInfo.sourceUrl && /^https?:\/\//.test(emailInfo.sourceUrl)) {
		properties["原文リンク"] = { url: emailInfo.sourceUrl.slice(0, 1900) };
	}
	if (emailInfo.contactEmail) {
		properties["メールアドレス"] = email(emailInfo.contactEmail);
	}
	if (emailInfo.contactName) {
		properties["お名前"] = richText(emailInfo.contactName);
	}
	if (emailInfo.companyName) {
		properties["会社名"] = richText(emailInfo.companyName);
	}
	if (emailInfo.phone) {
		properties["電話番号"] = phoneNumber(emailInfo.phone);
	}
	const created = await createNotionPageWithMissingPropertyFallback(
		notion,
		INQUIRY_DATA_SOURCE_ID,
		properties,
		pageTemplate(INQUIRY_TEMPLATE_ID),
	);
	await appendBlocksIfAny(notion, created.id, [
		{
			object: "block",
			type: "callout",
			callout: {
				rich_text: [{ type: "text", text: { content: "— 問い合わせ画面 —" } }],
				icon: { emoji: "🔵" },
				color: "blue_background",
			},
		},
	]);
	const createdPage = await notion.pages.retrieve({ page_id: created.id });
	if (emailInfo.attentionMemo) {
		await safeUpdateExistingProperties(notion, createdPage, {
			確認待ち内容: { kind: "text", value: emailInfo.attentionMemo },
		});
		return notion.pages.retrieve({ page_id: created.id });
	}
	return createdPage;
}

async function createNotionPageWithMissingPropertyFallback(
	notion: NotionClient,
	dataSourceId: string,
	properties: Record<string, unknown>,
	template?: Record<string, unknown>,
): Promise<Page> {
	const mutableProperties: Record<string, unknown> = { ...properties };
	let retry = 0;
	const maxRetry = 6;
	while (true) {
		try {
			return await notion.pages.create({
				parent: { data_source_id: dataSourceId },
				properties: mutableProperties,
				...(template ? { template } : {}),
			});
		} catch (error) {
			const missingProperties = parseMissingPropertiesFromNotionError(error);
			if (missingProperties.length === 0 || retry >= maxRetry) {
				throw error;
			}
			let removed = 0;
			for (const missingProperty of missingProperties) {
				if (Object.prototype.hasOwnProperty.call(mutableProperties, missingProperty)) {
					delete mutableProperties[missingProperty];
					removed += 1;
				}
			}
			if (removed === 0) {
				throw error;
			}
			retry += 1;
		}
	}
}

function parseMissingPropertiesFromNotionError(error: unknown): string[] {
	const text = extractNotionErrorText(error);
	const names = new Set<string>();
	const pattern = /(?:^|[.。:\s])([^:.\n。、]+?)\s+is not a property that exists/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text)) !== null) {
		const name = match[1]?.trim();
		if (name) names.add(name);
	}
	return [...names];
}

function extractNotionErrorText(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	if (error && typeof error === "object") {
		const raw = error as { message?: unknown; msg?: unknown; toString?: () => string };
		if (typeof raw.message === "string") return raw.message;
		if (typeof raw.msg === "string") return raw.msg;
		if (typeof raw.toString === "function") return raw.toString();
	}
	return String(error);
}

function buildInquiryEmailSummary(emailInfo: InquiryEmailInfo): string {
	const subject = emailInfo.subject || "件名未設定";
	const company = emailInfo.companyName ? `会社: ${emailInfo.companyName}` : "";
	const contact = emailInfo.contactName ? `担当/氏名: ${emailInfo.contactName}` : "";
	const mail = emailInfo.contactEmail ? `メール: ${emailInfo.contactEmail}` : "";
	return [
		`表示名: ${emailInfo.displayTitle || subject}`,
		emailInfo.receptionNumber ? `受付番号: ${emailInfo.receptionNumber}` : "",
		subject !== emailInfo.displayTitle ? `元件名: ${subject}` : "",
		company,
		contact,
		mail,
		`分類: ${emailInfo.categoryCode}`,
		`種別: ${emailInfo.inquiryType} / ${emailInfo.dealType}`,
		emailInfo.attentionReasons.length > 0
			? `確認理由: ${emailInfo.attentionReasons.join(" / ")}`
			: "",
	].filter(Boolean).join("\n").slice(0, 900);
}

function buildInquiryEmailFirstTalk(emailInfo: InquiryEmailInfo): string {
	if (emailInfo.dealType === "売却相談") {
		return "まず所在地、設備容量、FIT/FIP単価、残存期間、希望売却価格、必要資料の有無を確認する。価格だけでなく、手残り額・売却スピード・買主確度・途中減額リスクも比較軸として握る。";
	}
	if (emailInfo.dealType === "購入相談") {
		return "まず希望エリア、予算、容量・案件規模、購入時期、融資利用の有無、求めている権利や土地条件を確認する。紹介可否だけでなく、条件に合う案件の探し方も案内する。";
	}
	if (emailInfo.inquiryType === "法人") {
		return "まず会社として何を相談したいか、対象案件、希望時期、意思決定者、予算感を短く確認する。必要に応じて企業評価フローと商談準備へつなげる。";
	}
	return "まず問い合わせの目的、希望条件、連絡可能時間、次に知りたい情報を確認する。担当者や期限が曖昧な場合は要確認として扱う。";
}

async function cleanInquiryTitles(
	input: { limit?: number; dryRun?: boolean },
	notion: NotionClient,
): Promise<BulkCleanupResult> {
	const limit = normalizeBulkLimit(input.limit);
	const existing = await notion.dataSources.query({
		data_source_id: INQUIRY_DATA_SOURCE_ID,
		page_size: limit,
	});
	const pages = (existing.results ?? []) as Page[];
	let updated = 0;
	const samples: string[] = [];

	for (const page of pages) {
		const properties = page.properties ?? {};
		const currentTitle = text(properties["件名"]);
		const rawSubject = text(properties["元メール件名"]) || currentTitle;
		const receptionNumber =
			text(properties["受付番号"]) || extractInquiryReceptionNumber(currentTitle);
		const categoryCode = inferInquiryCategoryCode({
			subject: rawSubject,
			body: text(properties["本文"]) || text(properties["要約"]),
			labels: text(properties["Gmailラベル"]),
			inquiryType: text(properties["問い合わせ種別"]),
			dealType: text(properties["売買区分"]),
		});
		const titleInput = {
			subject: rawSubject,
			body: text(properties["本文"]) || text(properties["要約"]),
			labels: text(properties["Gmailラベル"]),
			companyName: text(properties["会社名"]) || text(properties["企業名"]),
			contactName: text(properties["お名前"]) || text(properties["氏名"]),
			inquiryType: text(properties["問い合わせ種別"]),
			dealType: text(properties["売買区分"]),
			categoryCode,
		};
		const displayTitle = buildInquiryDisplayTitle(titleInput);
		const attentionMemo = buildInquiryAttentionMemo(titleInput);
		const currentAttentionMemo = text(properties["確認待ち内容"]);
		const shouldUpdateAttentionMemo =
			Boolean(attentionMemo) &&
			(!currentAttentionMemo ||
				currentAttentionMemo.startsWith("太陽光案件のため中身確認が必要です。"));
		const displayTitleWithNumber = buildNumberedInquiryDisplayTitle(
			receptionNumber,
			displayTitle,
		);
		if (!displayTitleWithNumber) continue;
		const needsUpdate =
			currentTitle !== displayTitleWithNumber ||
			text(properties["問い合わせ分類コード"]) !== categoryCode ||
			(receptionNumber && text(properties["受付番号"]) !== receptionNumber) ||
			!text(properties["元メール件名"]) ||
			shouldUpdateAttentionMemo;
		if (!needsUpdate) continue;
		updated += 1;
		if (samples.length < 5) samples.push(`${currentTitle} -> ${displayTitleWithNumber}`);
		if (input.dryRun) continue;
		const patches: Record<string, SafePatch> = {
			件名: { kind: "text", value: displayTitleWithNumber },
			受付番号: { kind: "text", value: receptionNumber },
			元メール件名: { kind: "text", value: rawSubject },
			問い合わせ分類コード: { kind: "select", value: categoryCode },
		};
		if (shouldUpdateAttentionMemo) {
			patches["確認待ち内容"] = { kind: "text", value: attentionMemo };
		}
		await safeUpdateExistingProperties(notion, page, patches);
	}

	return {
		action: input.dryRun ? "dry-run" : updated > 0 ? "cleaned" : "skipped",
		checked: pages.length,
		updated,
		message:
			updated > 0
				? `問い合わせ ${pages.length} 件を確認し、${updated} 件の表示名を整えました。例: ${samples.join(" / ")}`
				: `問い合わせ ${pages.length} 件を確認しました。更新対象はありません。`,
	};
}

async function assignInquiryReceptionNumbers(
	input: { limit?: number; dryRun?: boolean },
	notion: NotionClient,
): Promise<BulkCleanupResult> {
	const limit = normalizeBulkLimit(input.limit);
	const existing = await notion.dataSources.query({
		data_source_id: INQUIRY_DATA_SOURCE_ID,
		page_size: limit,
		sorts: [
			{ property: "受信日時", direction: "ascending" },
			{ timestamp: "created_time", direction: "ascending" },
		],
	});
	const pages = ((existing.results ?? []) as Page[]).sort(compareInquiryPagesForReception);
	const maxByDate = new Map<string, number>();

	for (const page of pages) {
		const properties = page.properties ?? {};
		const existingNumber =
			text(properties["受付番号"]) || extractInquiryReceptionNumber(text(properties["件名"]));
		const parts = extractInquiryReceptionParts(existingNumber);
		if (!parts) continue;
		maxByDate.set(parts.dateStamp, Math.max(maxByDate.get(parts.dateStamp) ?? 0, parts.sequence));
	}

	let updated = 0;
	const samples: string[] = [];
	for (const page of pages) {
		const properties = page.properties ?? {};
		const currentTitle = text(properties["件名"]);
		const rawSubject = text(properties["元メール件名"]) || stripInquiryReceptionPrefix(currentTitle);
		const receivedAt =
			dateStartFromProperty(properties["受信日時"]) ||
			(typeof (page as Record<string, unknown>).created_time === "string"
				? ((page as Record<string, unknown>).created_time as string)
				: "");
		const dateStamp = inquiryReceptionDateStamp(receivedAt);
		const existingNumber =
			text(properties["受付番号"]) || extractInquiryReceptionNumber(currentTitle);
		let receptionNumber = existingNumber;
		if (!receptionNumber) {
			const nextSequence = (maxByDate.get(dateStamp) ?? 0) + 1;
			maxByDate.set(dateStamp, nextSequence);
			receptionNumber = buildInquiryReceptionNumber(dateStamp, nextSequence);
		}
		const categoryCode = inferInquiryCategoryCode({
			subject: rawSubject,
			body: text(properties["本文"]) || text(properties["要約"]),
			labels: text(properties["Gmailラベル"]),
			inquiryType: text(properties["問い合わせ種別"]),
			dealType: text(properties["売買区分"]),
		});
		const titleInput = {
			subject: rawSubject,
			body: text(properties["本文"]) || text(properties["要約"]),
			labels: text(properties["Gmailラベル"]),
			companyName: text(properties["会社名"]) || text(properties["企業名"]),
			contactName: text(properties["お名前"]) || text(properties["氏名"]),
			inquiryType: text(properties["問い合わせ種別"]),
			dealType: text(properties["売買区分"]),
			categoryCode,
		};
		const baseTitle = buildInquiryDisplayTitle(titleInput);
		const attentionMemo = buildInquiryAttentionMemo(titleInput);
		const currentAttentionMemo = text(properties["確認待ち内容"]);
		const shouldUpdateAttentionMemo =
			Boolean(attentionMemo) &&
			(!currentAttentionMemo ||
				currentAttentionMemo.startsWith("太陽光案件のため中身確認が必要です。"));
		const displayTitle = buildNumberedInquiryDisplayTitle(receptionNumber, baseTitle);
		const needsUpdate =
			currentTitle !== displayTitle ||
			text(properties["受付番号"]) !== receptionNumber ||
			text(properties["問い合わせ分類コード"]) !== categoryCode ||
			!text(properties["元メール件名"]) ||
			shouldUpdateAttentionMemo;
		if (!needsUpdate) continue;
		updated += 1;
		if (samples.length < 5) samples.push(`${currentTitle} -> ${displayTitle}`);
		if (input.dryRun) continue;
		const patches: Record<string, SafePatch> = {
			件名: { kind: "text", value: displayTitle },
			受付番号: { kind: "text", value: receptionNumber },
			元メール件名: { kind: "text", value: rawSubject },
			問い合わせ分類コード: { kind: "select", value: categoryCode },
		};
		if (shouldUpdateAttentionMemo) {
			patches["確認待ち内容"] = { kind: "text", value: attentionMemo };
		}
		await safeUpdateExistingProperties(notion, page, patches);
	}

	return {
		action: input.dryRun ? "dry-run" : updated > 0 ? "numbered" : "skipped",
		checked: pages.length,
		updated,
		message:
			updated > 0
				? `問い合わせ ${pages.length} 件を確認し、${updated} 件へ受付番号を付与/整形しました。例: ${samples.join(" / ")}`
				: `問い合わせ ${pages.length} 件を確認しました。受付番号の更新対象はありません。`,
	};
}

function compareInquiryPagesForReception(a: Page, b: Page): number {
	const aDate =
		dateStartFromProperty(a.properties?.["受信日時"]) ||
		(((a as Record<string, unknown>).created_time as string | undefined) ?? "");
	const bDate =
		dateStartFromProperty(b.properties?.["受信日時"]) ||
		(((b as Record<string, unknown>).created_time as string | undefined) ?? "");
	if (aDate !== bDate) return aDate.localeCompare(bDate);
	return a.id.localeCompare(b.id);
}

function readInquiry(page: Page): InquiryInfo {
	const properties = page.properties ?? {};
	const emailValue =
		text(properties["メールアドレス"]) || text(properties["送信者（メール）"]);
	const phoneValue = digits(text(properties["電話番号"]));
	const companyName =
		text(properties["会社名"]) ||
		text(properties["企業名"]) ||
		inferCompanyNameFromInquiryText(
			[
				text(properties["件名"]),
				text(properties["本文"]),
				text(properties["要約"]),
			].join("\n"),
		);
	const domain = extractDomain(emailValue);
	const duplicateKey =
		text(properties["重複チェックキー"]) ||
		buildInquiryDuplicateKey(companyName, emailValue, phoneValue);

	return {
		page,
		title: text(properties["件名"]),
		companyName,
		contactName: text(properties["お名前"]) || text(properties["氏名"]),
		email: emailValue,
		domain,
		phone: phoneValue,
		body: text(properties["本文"]),
		summary: text(properties["要約"]),
		firstTalk: text(properties["初回トーク方針"]),
		dealType: text(properties["売買区分"]) || "不明",
		inquiryType: text(properties["問い合わせ種別"]) || "不明",
		companyLinkStatus: text(properties["企業連携ステータス"]),
		duplicateKey,
		mailUniqueKey: text(properties["メールID（ユニークキー）"]),
		messageId: text(properties["Message-ID"]),
		threadId: text(properties["Thread-ID"]),
		relatedCompanyIds: relationIdsFromProperty(properties["関連企業"]),
	};
}

function inquiryToCardInfo(inquiry: InquiryInfo): CardInfo {
	const key = [
		`corp:${normalizeCompanyName(inquiry.companyName)}`,
		`domain:${inquiry.domain}`,
		`phone:${inquiry.phone}`,
	].join("|");
	return {
		page: inquiry.page,
		name: inquiry.contactName,
		companyName: inquiry.companyName,
		email: inquiry.email,
		domain: inquiry.domain,
		phone: inquiry.phone,
		address: "",
		role: "",
		key,
	};
}

function shouldProcessInquiry(inquiry: InquiryInfo): boolean {
	if (inquiry.inquiryType === "個人投資家" && !inquiry.companyName) return false;
	const body = `${inquiry.title}\n${inquiry.body}\n${inquiry.summary}`;
	return Boolean(
		inquiry.companyName ||
			inquiry.email ||
			inquiry.phone ||
			/法人|会社|株式会社|合同会社|有限会社|御社|貴社/i.test(body),
	);
}

function inferCompanyNameFromInquiryText(value: string): string {
	const match = value.match(
		/(?:会社名|法人名|企業名|貴社名)[:：]\s*([^\n\r]+)/,
	);
	return match?.[1]?.trim().slice(0, 120) ?? "";
}

function buildInquiryDuplicateKey(
	companyName: string,
	emailValue: string,
	phoneValue: string,
): string {
	return [
		`corp:${normalizeCompanyName(companyName)}`,
		`email:${emailValue.toLowerCase()}`,
		`phone:${phoneValue}`,
	]
		.filter((part) => !part.endsWith(":"))
		.join("|");
}

async function findDuplicateInquiries(
	notion: NotionClient,
	inquiry: InquiryInfo,
): Promise<Page[]> {
	const results: Page[] = [];
	const seen = new Set<string>();
	const push = (pages: Page[]) => {
		for (const page of pages) {
			if (page.id === inquiry.page.id || seen.has(page.id)) continue;
			seen.add(page.id);
			results.push(page);
		}
	};

	if (inquiry.duplicateKey) {
		push(
			await safeInquiryQuery(notion, {
				property: "重複チェックキー",
				rich_text: { equals: inquiry.duplicateKey },
			}),
		);
	}
	if (inquiry.mailUniqueKey) {
		push(
			await safeInquiryQuery(notion, {
				property: "メールID（ユニークキー）",
				rich_text: { equals: inquiry.mailUniqueKey },
			}),
		);
	}
	if (inquiry.messageId) {
		push(
			await safeInquiryQuery(notion, {
				property: "Message-ID",
				rich_text: { equals: inquiry.messageId },
			}),
		);
	}
	return results;
}

async function safeInquiryQuery(
	notion: NotionClient,
	filter: Record<string, unknown>,
): Promise<Page[]> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: INQUIRY_DATA_SOURCE_ID,
			page_size: 10,
			filter,
		});
		return response.results;
	} catch (error) {
		console.log("inquiry query skipped", { filter, error: String(error) });
		return [];
	}
}

async function createCompanyFromInquiry(
	notion: NotionClient,
	inquiry: InquiryInfo,
	weakCandidate?: Candidate,
): Promise<Page> {
	const properties: Record<string, unknown> = {
		企業名: title(inquiry.companyName),
		企業登録ソース: select("問い合わせ"),
		企業重複チェックキー: richText(inquiryToCardInfo(inquiry).key),
		企業AI受付メモ: richText(
			`問い合わせ起点でWorkerが作成。元問い合わせ: ${inquiry.title || inquiry.page.id}`,
		),
		企業調査ステータス: select("解析開始"),
		問い合わせ要約: richText(inquiry.summary || inquiry.body || inquiry.title),
		売買区分: select(inquiry.dealType || "不明"),
		重複整理ステータス: select(weakCandidate ? "重複候補" : "正本候補"),
		関連問い合わせ: relation(inquiry.page.id),
	};

	if (inquiry.contactName) properties["問い合わせ担当者名"] = richText(inquiry.contactName);
	if (inquiry.email) {
		properties["メールアドレス"] = email(inquiry.email);
		properties["問い合わせ担当者メールアドレス"] = email(inquiry.email);
	}
	if (inquiry.phone) {
		properties["電話番号"] = phoneNumber(inquiry.phone);
		properties["問い合わせ担当者電話番号"] = phoneNumber(inquiry.phone);
	}
	if (weakCandidate) {
		properties["正本企業"] = relation(weakCandidate.page.id);
		properties["重複整理メモ"] = richText(
			`近似候補あり: ${weakCandidate.name}。強い一致ではないため新規作成し、後続で整理対象にしました。`,
		);
	}

	return notion.pages.create({
		parent: { data_source_id: COMPANY_DATA_SOURCE_ID },
		properties,
	});
}

async function updateExistingCompanyFromInquiry(
	notion: NotionClient,
	companyPage: Page,
	inquiry: InquiryInfo,
): Promise<void> {
	const company = readCompany(companyPage);
	const patches: Record<string, SafePatch> = {
		企業AI受付メモ: {
			kind: "text",
			value: appendShortMemo(
				company.aiMemo,
				`問い合わせ ${inquiry.title || inquiry.page.id} を既存企業へ紐づけ。`,
			),
		},
		関連問い合わせ: {
			kind: "relation",
			ids: uniqueIds([
				...relationIdsFromProperty(companyPage.properties?.["関連問い合わせ"]),
				inquiry.page.id,
			]),
		},
	};
	if (!company.inquirySummary && (inquiry.summary || inquiry.body)) {
		patches["問い合わせ要約"] = {
			kind: "text",
			value: inquiry.summary || inquiry.body,
		};
	}
	if (!company.contactName && inquiry.contactName) {
		patches["問い合わせ担当者名"] = { kind: "text", value: inquiry.contactName };
	}
	if (!company.email && inquiry.email) {
		patches["メールアドレス"] = { kind: "text", value: inquiry.email };
		patches["問い合わせ担当者メールアドレス"] = {
			kind: "text",
			value: inquiry.email,
		};
	}
	if (!company.phone && inquiry.phone) {
		patches["電話番号"] = { kind: "text", value: inquiry.phone };
		patches["問い合わせ担当者電話番号"] = {
			kind: "text",
			value: inquiry.phone,
		};
	}
	if (!company.dealType || company.dealType === "不明") {
		patches["売買区分"] = { kind: "select", value: inquiry.dealType || "不明" };
	}
	await safeUpdateExistingProperties(notion, companyPage, patches);
}

async function markInquiryLinkedToCompany(
	notion: NotionClient,
	inquiry: InquiryInfo,
	companyId: string,
	status: "既存企業に紐づけ済" | "新規作成済",
	memo: string,
): Promise<void> {
	await safeUpdateExistingProperties(notion, inquiry.page, {
		関連企業: { kind: "relation", ids: [companyId] },
		企業重複チェックキー: {
			kind: "text",
			value: inquiryToCardInfo(inquiry).key,
		},
		重複チェックキー: { kind: "text", value: inquiry.duplicateKey },
		企業連携ステータス: { kind: "select", value: status },
		企業登録可否: {
			kind: "select",
			value: status === "新規作成済" ? "登録可" : "既存確認",
		},
		企業連携メモ: { kind: "text", value: memo },
		重複判定ステータス: { kind: "select", value: "正常" },
	});
}

async function markInquiryTargetOut(
	notion: NotionClient,
	inquiry: InquiryInfo,
	memo: string,
): Promise<void> {
	await safeUpdateExistingProperties(notion, inquiry.page, {
		企業連携ステータス: { kind: "select", value: "対象外" },
		企業登録可否: { kind: "select", value: "個人のため保留" },
		企業連携メモ: { kind: "text", value: memo },
	});
}

async function markInquiryNeedsReview(
	notion: NotionClient,
	inquiry: InquiryInfo,
	memo: string,
): Promise<void> {
	await safeUpdateExistingProperties(notion, inquiry.page, {
		企業連携ステータス: { kind: "select", value: "重複疑い" },
		企業登録可否: { kind: "select", value: "要確認" },
		企業連携メモ: { kind: "text", value: memo },
		重複判定ステータス: { kind: "select", value: "重複疑い" },
	});
}

async function markInquiryDuplicateHold(
	notion: NotionClient,
	inquiry: InquiryInfo,
	duplicates: Page[],
	memo: string,
): Promise<void> {
	await safeUpdateExistingProperties(notion, inquiry.page, {
		企業連携ステータス: { kind: "select", value: "重複疑い" },
		企業登録可否: { kind: "select", value: "要確認" },
		企業連携メモ: {
			kind: "text",
			value: `${memo} 重複候補: ${duplicates
				.slice(0, 3)
				.map((page) => text(page.properties?.["件名"]) || page.id)
				.join(", ")}`,
		},
		重複判定ステータス: { kind: "select", value: "重複疑い" },
	});
}

async function markInquiryCandidateHold(
	notion: NotionClient,
	inquiry: InquiryInfo,
	candidates: Candidate[],
): Promise<void> {
	await safeUpdateExistingProperties(notion, inquiry.page, {
		企業連携ステータス: { kind: "select", value: "重複疑い" },
		企業登録可否: { kind: "select", value: "要確認" },
		企業連携メモ: {
			kind: "text",
			value: `強い企業候補が複数あるため停止: ${candidates
				.slice(0, 3)
				.map((candidate) => `${candidate.name}(${candidate.reasons.join("/")})`)
				.join(", ")}`,
		},
		重複判定ステータス: { kind: "select", value: "重複疑い" },
	});
}

async function addInquiryRelationToCompany(
	notion: NotionClient,
	companyId: string,
	inquiryId: string,
): Promise<void> {
	const company = await notion.pages.retrieve({ page_id: companyId });
	const current = relationIdsFromProperty(company.properties?.["関連問い合わせ"]);
	if (current.includes(inquiryId)) return;
	await safeUpdateExistingProperties(notion, company, {
		関連問い合わせ: {
			kind: "relation",
			ids: uniqueIds([...current, inquiryId]),
		},
	});
}

async function findCompanyCandidates(
	notion: NotionClient,
	card: CardInfo,
): Promise<Candidate[]> {
	const queryResults: Page[] = [];
	const seen = new Set<string>();
	const push = (pages: Page[]) => {
		for (const page of pages) {
			if (seen.has(page.id)) continue;
			seen.add(page.id);
			queryResults.push(page);
		}
	};

	if (card.key) {
		push(
			await safeCompanyQuery(notion, {
				property: "企業重複チェックキー",
				rich_text: { equals: card.key },
			}),
		);
	}
	if (card.companyName) {
		push(
			await safeCompanyQuery(notion, {
				property: "企業名",
				title: { contains: card.companyName },
			}),
		);
	}
	if (card.phone) {
		push(
			await safeCompanyQuery(notion, {
				property: "電話番号",
				phone_number: { equals: card.phone },
			}),
		);
		push(
			await safeCompanyQuery(notion, {
				property: "問い合わせ担当者電話番号",
				phone_number: { equals: card.phone },
			}),
		);
	}
	if (card.email) {
		push(
			await safeCompanyQuery(notion, {
				property: "メールアドレス",
				email: { equals: card.email },
			}),
		);
		push(
			await safeCompanyQuery(notion, {
				property: "問い合わせ担当者メールアドレス",
				email: { equals: card.email },
			}),
		);
	}

	return queryResults
		.map((page) => scoreCandidate(page, card))
		.filter((candidate) => candidate.score > 0 || candidate.weak)
		.sort((a, b) => b.score - a.score);
}

async function safeCompanyQuery(
	notion: NotionClient,
	filter: Record<string, unknown>,
): Promise<Page[]> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: COMPANY_DATA_SOURCE_ID,
			page_size: 10,
			filter,
		});
		return response.results;
	} catch (error) {
		console.log("company query skipped", { filter, error: String(error) });
		return [];
	}
}

function scoreCandidate(page: Page, card: CardInfo): Candidate {
	const properties = page.properties ?? {};
	const name = text(properties["企業名"]);
	const key = text(properties["企業重複チェックキー"]);
	const email =
		text(properties["メールアドレス"]) ||
		text(properties["問い合わせ担当者メールアドレス"]);
	const phone = digits(
		text(properties["電話番号"]) ||
			text(properties["問い合わせ担当者電話番号"]),
	);
	const normalizedCandidate = normalizeCompanyName(name);
	const normalizedCard = normalizeCompanyName(card.companyName);
	const reasons: string[] = [];
	let score = 0;

	if (card.key && key && key === card.key) {
		score += 100;
		reasons.push("企業重複チェックキー一致");
	}
	if (normalizedCandidate && normalizedCandidate === normalizedCard) {
		score += 90;
		reasons.push("正規化会社名一致");
	}
	if (card.domain && email.toLowerCase().endsWith(`@${card.domain}`)) {
		score += 85;
		reasons.push("メールドメイン一致");
	}
	if (card.phone && phone && phone === card.phone) {
		score += 85;
		reasons.push("電話番号一致");
	}

	const weak =
		score === 0 &&
		Boolean(normalizedCandidate) &&
		Boolean(normalizedCard) &&
		(normalizedCandidate.includes(normalizedCard) ||
			normalizedCard.includes(normalizedCandidate));

	if (weak) reasons.push("会社名の近似候補");

	return { page, name, key, email, phone, score, reasons, weak };
}

async function createCompany(
	notion: NotionClient,
	card: CardInfo,
	weakCandidate?: Candidate,
	deepResearch = true,
): Promise<Page> {
	const properties: Record<string, unknown> = {
		企業名: title(card.companyName),
		企業登録ソース: select("名刺"),
		企業重複チェックキー: richText(card.key),
		企業AI受付メモ: richText(
			`名刺起点でWorkerが作成。元名刺: ${card.name || card.page.id}`,
		),
		企業調査ステータス: select(deepResearch ? "解析開始" : "未着手"),
		名刺起点Webhookメモ: richText(
			deepResearch
				? "Notion Workerが名刺起点で企業を作成し、外部調査と企業マスター高密度化を実行。"
				: "Notion Workerが名刺起点で企業を作成。営業判断=名刺だけ保存のため、外部調査と企業マスター高密度化は未実行。",
		),
		重複整理ステータス: select(weakCandidate ? "重複候補" : "正本候補"),
		関連名刺: relation(card.page.id),
	};

	if (card.email) {
		properties["メールアドレス"] = email(card.email);
		properties["問い合わせ担当者メールアドレス"] = email(card.email);
	}
	if (card.phone) {
		properties["電話番号"] = phoneNumber(card.phone);
		properties["問い合わせ担当者電話番号"] = phoneNumber(card.phone);
	}
	if (card.address) properties["住所"] = richText(card.address);
	if (card.name) properties["問い合わせ担当者名"] = richText(card.name);
	if (weakCandidate) {
		properties["正本企業"] = relation(weakCandidate.page.id);
		properties["重複整理メモ"] = richText(
			`近似候補あり: ${weakCandidate.name}。強い一致ではないため新規作成し、後続で整理対象にしました。`,
		);
	}

	return notion.pages.create({
		parent: { data_source_id: COMPANY_DATA_SOURCE_ID },
		properties,
	});
}

async function enrichCompany(
	notion: NotionClient,
	company: Page,
	card: CardInfo,
	isDuplicateCandidate: boolean,
): Promise<void> {
	// 名刺の最低限を先に確実化してから、深掘りパイプライン(Perplexity+与信)へ委譲。
	await notion.pages.update({
		page_id: company.id,
		properties: {
			企業調査ステータス: select("解析開始"),
			名刺起点Webhookメモ: richText(
				isDuplicateCandidate
					? "名刺起点。近似候補ありのためWorkerが深掘り調査を実行。"
					: "名刺起点。Workerが深掘り調査(Perplexity+与信)を実行。",
			),
		},
	});
	await processCompanyResearch({ companyPageId: company.id, dryRun: false }, notion);
}

async function linkCardToCompany(
	notion: NotionClient,
	card: CardInfo,
	companyId: string,
	status: "既存企業に紐づけ済" | "新規企業作成",
	memo: string,
	meetingPrepMemo?: string | null,
	webhookMemo?: string | null,
): Promise<void> {
	// 画像インテイクの再送ガード(imgsha:トークン)を消さない(再検品指摘=処理完了後の再送で二重登録)
	const existingDupKey = text(card.page.properties?.["企業重複チェックキー"]);
	const imgshaToken =
		existingDupKey.split(/\s+/).find((t) => t.startsWith("imgsha:")) ?? "";
	await notion.pages.update({
		page_id: card.page.id,
		properties: {
			関連企業: relation(companyId),
			企業重複チェックキー: richText(
				[card.key, imgshaToken].filter(Boolean).join(" "),
			),
			企業連携ステータス: select(status),
				企業連携メモ: richText(memo),
				Webhook引き継ぎステータス: select("引き継ぎ済"),
				Webhook引き継ぎメモ: richText(
					webhookMemo ?? "Notion Workerが企業調査と企業マスター高密度化まで実行。",
				),
			名刺AI処理状態: select(status),
			名刺AI処理メモ: richText(
				[
					"Notion Workerで処理済み。",
					meetingPrepMemo && `商談準備レポート: ${meetingPrepMemo}`,
				]
					.filter(Boolean)
					.join("\n"),
			),
		},
	});
	await addCardRelationToCompany(notion, companyId, card.page.id);
}

async function createMeetingPrepReportFromBusinessCard(
	notion: NotionClient,
	companyId: string,
): Promise<string | null> {
	try {
		const result = await processMeetingPrepReport(
			{ companyPageId: companyId, dryRun: false },
			notion,
		);
		return result.action === "skipped-fresh"
			? "既存レポートを再利用して商談準備を反映しました。"
			: `商談準備レポートを${result.action === "created-report" ? "新規作成" : "更新"}しました。`;
	} catch (error) {
		const shortError = String(error).slice(0, 120);
		console.log(
			"名刺起点の商談準備レポート自動作成をスキップ:",
			shortError,
		);
		return `商談準備レポート作成でエラーが発生しました(要確認): ${shortError}`;
	}
}

async function addCardRelationToCompany(
	notion: NotionClient,
	companyId: string,
	cardId: string,
): Promise<void> {
	const company = await notion.pages.retrieve({ page_id: companyId });
	const current = relationIdsFromProperty(company.properties?.["関連名刺"]);
	if (current.includes(cardId)) return;
	await notion.pages.update({
		page_id: companyId,
		properties: {
			関連名刺: relationIds([...current, cardId]),
		},
	});
}

async function markCardProcessing(
	notion: NotionClient,
	card: CardInfo,
): Promise<void> {
	await notion.pages.update({
		page_id: card.page.id,
		properties: {
			企業連携ステータス: select("処理中"),
			Webhook引き継ぎステータス: select("待機"),
			名刺AI処理状態: select("処理中"),
			企業連携メモ: richText("Notion Workerが処理開始。"),
		},
	});
}

async function markCardDuplicateHold(
	notion: NotionClient,
	card: CardInfo,
	candidates: Candidate[],
): Promise<void> {
	const candidateSummary = candidates
		.slice(0, 3)
		.map((candidate) => `${candidate.name}(${candidate.reasons.join("/")})`)
		.join(", ");
	const memo = buildHoldMemo({
		stopReason: `強い候補が複数あるため停止: ${candidateSummary}`,
		scope: "既存企業候補の会社名、重複チェックキー、メールドメイン、電話番号を照合。",
		humanDecision: "どの企業を企業マスターDBの正本として扱うかを大ちゃんが決める。",
		restartCondition: "正本企業を1社に確定し、関連企業を手動指定または重複整理後に再実行。",
	});
	await notion.pages.update({
		page_id: card.page.id,
		properties: {
			企業連携ステータス: select("重複疑い"),
			Webhook引き継ぎステータス: select("要確認で停止"),
			名刺AI処理状態: select("重複疑い"),
			企業連携メモ: richText(memo),
			名刺AI処理メモ: richText(memo),
			設計上の弱点: richText(memo),
		},
	});
}

async function markCardNeedsReview(
	notion: NotionClient,
	card: CardInfo,
	message: string,
): Promise<void> {
	await notion.pages.update({
		page_id: card.page.id,
		properties: {
			企業連携ステータス: select("要確認"),
			Webhook引き継ぎステータス: select("要確認で停止"),
			名刺AI処理状態: select("要確認"),
			企業連携メモ: richText(message),
			名刺AI処理メモ: richText(message),
			設計上の弱点: richText(message),
		},
	});
}

async function markCardFailure(
	notion: NotionClient,
	card: CardInfo,
	message: string,
): Promise<void> {
	await notion.pages.update({
		page_id: card.page.id,
		properties: {
			企業連携ステータス: select("連携失敗"),
			// 「処理中」のまま残すと終端ガードで再処理不能になる(再検品指摘)。要確認=再処理可能な状態へ戻す
			名刺AI処理状態: select("要確認"),
			Webhook引き継ぎステータス: select("引き継ぎ失敗"),
			企業連携メモ: richText(`Worker処理失敗: ${message}`),
			設計上の弱点: richText(`Worker処理失敗: ${message}`),
		},
	});
}

async function researchCompany(card: CardInfo): Promise<Research> {
	const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
	if (apiKey) {
		const fromGemini = await researchCompanyWithGemini(card, apiKey);
		if (fromGemini) return fromGemini;
	}
	return fallbackResearch(card);
}

async function researchCompanyWithGemini(
	card: CardInfo,
	apiKey: string,
): Promise<Research | null> {
	const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
	const prompt = [
		"和上ホールディングスの営業準備として企業情報を整理してください。",
		"個人情報は使わず、会社名・ドメイン・住所だけを参考にしてください。",
		"公開情報が不足する軸は推測で埋めず『【取れていない事実】X が未確認。【取れば取れる】Y があれば X を取得可能。【初回ヒアリングで取る】Z』の3段構造で明示してください。",
		"JSONだけを返してください。",
		`会社名: ${card.companyName}`,
		`ドメイン: ${card.domain || "不明"}`,
		`住所: ${card.address || "不明"}`,
		"JSON keys: summary,currentIssue,futureIssue,salesAngle,fit,customerMarket3c,competitor3c,wajoRelation3c,source,closingPoint",
		"closingPoint は成約までの決め手を3段構造で書く：『【取れていない事実】X が未確認。【取れば取れる】Y があれば X を取得可能。【初回ヒアリングで取る】(1)意思決定者と承認プロセス (2)検討時期 (3)競合提案と比較軸 (4)和上のどの点が刺さるか』。",
	].join("\n");

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						responseMimeType: "application/json",
					},
				}),
			},
		);
		if (!response.ok) {
			console.log("Gemini research skipped", await response.text());
			return null;
		}
		const json = (await response.json()) as {
			candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
		};
		const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!raw) return null;
		return normalizeResearch(JSON.parse(raw) as Partial<Research>, card);
	} catch (error) {
		console.log("Gemini research failed", String(error));
		return null;
	}
}

function fallbackResearch(card: CardInfo): Research {
	const company = card.companyName || "対象企業";
	const domain = card.domain ? `（ドメイン: ${card.domain}）` : "";
	const address = card.address ? `（住所: ${card.address}）` : "";
	return {
		summary: `${company}${domain}${address}は、名刺起点で登録された企業。Gemini呼出失敗または接続なしのため、Worker fallback で組み立て。事業内容・規模・代表者経歴・直近接点は未確認で、初回ヒアリングで取りに行く軸として整理する。`,
		currentIssue: `【取れていない事実】${company}固有の現在課題が未確認。【取れば取れる】公式サイトURL${card.domain ? `（${card.domain}）` : "（未取得）"}があれば事業内容を、IR資料があれば業績・方針を、TDB企業コードがあれば財務・与信を取得可能。【初回ヒアリングで取る】再エネ/蓄電池の関心軸・電力コスト負担割合・脱炭素要請の有無・遊休地/屋根の保有を確認する。`,
		futureIssue:
			`【取れていない事実】${company}固有の中期論点が未確認。【取れば取れる】中期経営計画・直近プレスがあれば設備投資・脱炭素ロードマップを取得可能。【初回ヒアリングで取る】2-3年後の調達契約更新時期・設備更新計画・出口戦略の優先順位を確認する。`,
		salesAngle:
			"事実不足のため、初回は『再エネ/蓄電池への関心軸』『投資対象（事業or投資案件）』『保有設備（屋根/遊休地）』『電力コスト負担』『相談したい案件の有無』の5軸を5-10分で確認する。",
		fit:
			"事実確認後、和上の太陽光発電所仲介・系統用蓄電池・EPC/O&M・投資判断材料整理のうちどれが適合するかを判定する。現段階では断定しない。",
		customerMarket3c:
			`【取れていない事実】${company}固有の顧客・市場接点が未確認。【取れば取れる】業種コード・取引先公開情報・売上規模があれば市場ポジションを取得可能。【初回ヒアリングで取る】主要販売先業種・電力使用量の業界水準との差・脱炭素関連の取引先要請を確認する。`,
		competitor3c:
			`【取れていない事実】${company}固有の競合関係が未確認。【取れば取れる】既存提案先・取引先公開情報があれば競合軸を特定可能。【初回ヒアリングで取る】他社見積もり/提案の有無・比較軸（価格/施工実績/系統知見/許認可/運用体制）を確認する。`,
		wajoRelation3c:
			"和上は太陽光・蓄電池の現場知見（800MW実績）、発電所売買仲介、EPC/O&M、投資判断材料整理を一気通貫で提供。事実確認後、相手の課題に応じて具体接点（数字・現場知見・他社事例）を組む。",
		source:
			"名刺情報のみ。Web/IR/TDB公開情報の取得待ち。初回ヒアリング後に充実させる。",
		closingPoint:
			`【取れていない事実】${company}固有の成約決め手（決裁構造・予算規模・競合状況・タイミング要因）が未確認。【取れば取れる】IR資料・組織図公開情報・直近プレスがあれば決裁者と投資判断時期を取得可能。【初回ヒアリングで取る】(1)意思決定者と承認プロセス（誰が最終GO/NOGO・予算上限）(2)検討時期（今・3ヶ月以内・年内・来期）(3)競合提案の有無と比較軸 (4)和上の800MW実績・売買仲介・EPC一気通貫のうちどの点が刺さるか を確認する。`,
	};
}

function normalizeResearch(input: Partial<Research>, card: CardInfo): Research {
	const fallback = fallbackResearch(card);
	return {
		summary: input.summary || fallback.summary,
		currentIssue: input.currentIssue || fallback.currentIssue,
		futureIssue: input.futureIssue || fallback.futureIssue,
		salesAngle: input.salesAngle || fallback.salesAngle,
		fit: input.fit || fallback.fit,
		customerMarket3c: input.customerMarket3c || fallback.customerMarket3c,
		competitor3c: input.competitor3c || fallback.competitor3c,
		wajoRelation3c: input.wajoRelation3c || fallback.wajoRelation3c,
		source: input.source || fallback.source,
		closingPoint: input.closingPoint || fallback.closingPoint,
	};
}

function readCard(page: Page): CardInfo {
	const properties = page.properties ?? {};
	const name = text(properties["氏名"]);
	const companyName = text(properties["会社名"]);
	const emailValue = text(properties["メール"]);
	const phoneValue = digits(text(properties["電話"]));
	const domain = emailValue.includes("@")
		? emailValue.split("@").pop()?.toLowerCase() || ""
		: "";
	const key = [
		`corp:${normalizeCompanyName(companyName)}`,
		`domain:${domain}`,
		`phone:${phoneValue}`,
	].join("|");

	return {
		page,
		name,
		companyName,
		email: emailValue,
		domain,
		phone: phoneValue,
		address: text(properties["住所"]),
		role: text(properties["役職"]),
		key,
	};
}

function shouldProcess(card: CardInfo): boolean {
	const properties = card.page.properties ?? {};
	const hasImage = Array.isArray((properties["名刺画像"] as { files?: unknown[] })?.files)
		? ((properties["名刺画像"] as { files: unknown[] }).files.length ?? 0) > 0
		: false;
	return Boolean(card.companyName || card.email || card.phone || hasImage);
}

async function safeUpdateExistingProperties(
	notion: NotionClient,
	page: Page,
	patches: Record<string, SafePatch>,
): Promise<void> {
	const properties = buildExistingPropertyPatch(page, patches);
	if (Object.keys(properties).length === 0) return;
	try {
		await notion.pages.update({ page_id: page.id, properties });
		return;
	} catch (error) {
		console.log("bulk page update skipped; retrying property by property", String(error));
	}
	for (const [name, value] of Object.entries(properties)) {
		try {
			await notion.pages.update({
				page_id: page.id,
				properties: { [name]: value },
			});
		} catch (error) {
			console.log("property update skipped", { pageId: page.id, name, error: String(error) });
		}
	}
}

function buildExistingPropertyPatch(
	page: Page,
	patches: Record<string, SafePatch>,
): Record<string, unknown> {
	const pageProperties = page.properties ?? {};
	const result: Record<string, unknown> = {};
	for (const [name, patch] of Object.entries(patches)) {
		const property = pageProperties[name];
		const value = propertyValueForExistingType(property, patch);
		if (!value) continue;
		result[name] = value;
	}
	return result;
}

function propertyValueForExistingType(
	property: unknown,
	patch: SafePatch,
): Record<string, unknown> | undefined {
	if (!property || typeof property !== "object") return undefined;
	const type = (property as Record<string, unknown>).type;
	if (patch.kind === "clear") {
		if (type === "rich_text") return { rich_text: [] };
		if (type === "select") return { select: null };
		if (type === "status") return { status: null };
		if (type === "number") return { number: null };
		if (type === "date") return { date: null };
		if (type === "checkbox") return { checkbox: false };
		if (type === "multi_select") return { multi_select: [] };
		if (type === "people") return { people: [] };
		if (type === "relation") return { relation: [] };
		if (type === "url") return { url: null };
		return undefined;
	}
	if (patch.kind === "text-with-revision") {
		if (type === "rich_text") return { rich_text: richTextRevisionItems(patch) };
		return undefined;
	}
	if (patch.kind === "text") {
		if (type === "rich_text") return richText(patch.value);
		if (type === "title") return title(patch.value);
		if (type === "url") return { url: patch.value.slice(0, 1900) };
		return undefined;
	}
	if (patch.kind === "select") {
		if (type === "select") return select(patch.value);
		if (type === "status") return { status: { name: patch.value } };
		if (type === "rich_text") return richText(patch.value);
		if (type === "title") return title(patch.value);
		return undefined;
	}
	if (patch.kind === "number") {
		if (type === "number") return { number: patch.value };
		if (type === "rich_text") return richText(String(patch.value));
		return undefined;
	}
	if (patch.kind === "date") {
		if (type === "date") return { date: { start: patch.value } };
		if (type === "rich_text") return richText(patch.value);
		return undefined;
	}
	if (patch.kind === "checkbox") {
		if (type === "checkbox") return { checkbox: patch.value };
		if (type === "rich_text") return richText(patch.value ? "true" : "false");
		return undefined;
	}
	if (patch.kind === "multi_select") {
		const values = patch.values.filter(Boolean).slice(0, 5);
		if (values.length === 0) return undefined;
		if (type === "multi_select") {
			return { multi_select: values.map((name) => ({ name })) };
		}
		if (type === "select") return select(values[0] ?? "");
		if (type === "rich_text") return richText(values.join(", "));
		return undefined;
	}
	if (patch.kind === "people") {
		if (type === "people") {
			return { people: patch.ids.map((id) => ({ object: "user", id })) };
		}
		return undefined;
	}
	if (patch.kind === "relation") {
		if (type === "relation") return relationIds(patch.ids);
		return undefined;
	}
	return undefined;
}

function numberValue(property: unknown): number | null {
	if (!property || typeof property !== "object") return null;
	const prop = property as Record<string, unknown>;
	if (prop.type === "number" && typeof prop.number === "number") {
		return prop.number;
	}
	if (prop.type === "rollup" && prop.rollup && typeof prop.rollup === "object") {
		const rollup = prop.rollup as Record<string, unknown>;
		if (typeof rollup.number === "number") return rollup.number;
	}
	if (prop.type === "formula" && prop.formula && typeof prop.formula === "object") {
		const formula = prop.formula as Record<string, unknown>;
		if (typeof formula.number === "number") return formula.number;
	}
	return null;
}

function numberValueAny(properties: Record<string, unknown>, names: string[]): number | null {
	for (const name of names) {
		const value = numberValue(properties[name]);
		if (value !== null) return value;
	}
	return null;
}

function placeCoordinate(property: unknown, key: "lat" | "lon"): number | null {
	if (!property || typeof property !== "object") return null;
	const prop = property as Record<string, unknown>;
	if (prop.type !== "place" || !prop.place || typeof prop.place !== "object") return null;
	const place = prop.place as Record<string, unknown>;
	return typeof place[key] === "number" && Number.isFinite(place[key]) ? place[key] : null;
}

function numberFromText(value: string): number | null {
	const normalized = value.replace(/,/g, "");
	const match = normalized.match(/\d+(?:\.\d+)?/);
	return match ? Number(match[0]) : null;
}

function distanceKmFromText(value: string): number | null {
	const normalized = normalizeDigits(value).replace(/[,，]/g, "");
	if (!normalized.trim()) return null;
	const kmMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:km|㎞|キロメートル|キロ)/i);
	if (kmMatch) return Number(kmMatch[1]);
	const meterMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:m|ｍ|メートル|メーター|米)/i);
	if (meterMatch) return Number(meterMatch[1]) / 1000;
	const match = normalized.match(/\d+(?:\.\d+)?/);
	return match ? Number(match[0]) : null;
}

function inferPowerAreaFromAddress(address: string): string {
	if (!address) return "";
	if (/大阪|京都|兵庫|奈良|滋賀|和歌山/.test(address)) return "関西電力";
	if (/東京|神奈川|埼玉|千葉|茨城|栃木|群馬|山梨|静岡県富士川以東/.test(address)) {
		return "東京電力";
	}
	if (/愛知|岐阜|三重|長野|静岡/.test(address)) return "中部電力";
	if (/福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島/.test(address)) return "九州電力";
	if (/北海道/.test(address)) return "北海道電力";
	if (/青森|岩手|宮城|秋田|山形|福島|新潟/.test(address)) return "東北電力";
	if (/富山|石川|福井/.test(address)) return "北陸電力";
	if (/鳥取|島根|岡山|広島|山口/.test(address)) return "中国電力";
	if (/徳島|香川|愛媛|高知/.test(address)) return "四国電力";
	if (/沖縄/.test(address)) return "沖縄電力";
	return "";
}

function text(property: unknown): string {
	if (!property || typeof property !== "object") return "";
	const prop = property as Record<string, unknown>;
	if (prop.type === "title" && Array.isArray(prop.title)) {
		return plain(prop.title);
	}
	if (prop.type === "rich_text" && Array.isArray(prop.rich_text)) {
		return plain(prop.rich_text);
	}
	if (prop.type === "email" && typeof prop.email === "string") return prop.email;
	if (prop.type === "phone_number" && typeof prop.phone_number === "string") {
		return prop.phone_number;
	}
	if (prop.type === "url" && typeof prop.url === "string") return prop.url;
	if (prop.type === "select" && prop.select && typeof prop.select === "object") {
		const selectValue = prop.select as Record<string, unknown>;
		return typeof selectValue.name === "string" ? selectValue.name : "";
	}
	if (prop.type === "status" && prop.status && typeof prop.status === "object") {
		const statusValue = prop.status as Record<string, unknown>;
		return typeof statusValue.name === "string" ? statusValue.name : "";
	}
	if (prop.type === "multi_select" && Array.isArray(prop.multi_select)) {
		return prop.multi_select
			.map((item) => {
				if (!item || typeof item !== "object") return "";
				const option = item as Record<string, unknown>;
				return typeof option.name === "string" ? option.name : "";
			})
			.filter(Boolean)
			.join(", ");
	}
	return "";
}

function isInternalTestOrAuditText(value: string): boolean {
	return /Codex|test|テスト|試験|AIテスト|正式テスト|監査除外|ドライラン|dry[-ー]?run|削除可|検証|リリース確認|疎通確認|ダミー|クリック確認|ストレステスト|AI本流|stale read|race 条件|フローレンス|リリースノート/i.test(
		value,
	);
}

function isLowSignalContactActivityText(value: string): boolean {
	const compact = value.replace(/\s+/g, "").trim();
	if (!compact) return false;
	const normalized = compact.replace(/[。．.？?！!]/g, "");
	if (/Transcribedtext|^Fw:|｜活動｜Fw:/i.test(normalized)) return true;
	if (/Switch|まだわからんけどな|どうなるかわからん|一致するか分からん/i.test(normalized)) return true;
	if (/YES|謝謝|測試|Godis|yeste|食料行って帰り/i.test(normalized)) return true;
	if (/問い合わせの内容は|絞った方がいい|売る.*買う.*売りたい/.test(normalized)) return true;
	if (/^(オンラインしました|即利用しました)$/.test(normalized)) return true;
	if (compact.length < 4) return true;
	if (
		/電話|メール|訪問|Zoom|オンライン|商談|資料|見積|提案|査定|売却|購入|蓄電池|太陽光|確認|送付|連絡|追客|打合|問い合わせ|案件|現地|調査|相談|次回|折返|条件|価格|契約|成約/.test(
			compact,
		)
	) {
		return false;
	}
	const hasKanji = /[\u4e00-\u9fff]/.test(compact);
	const hasLatin = /[A-Za-z]/.test(compact);
	if (hasLatin && !hasKanji) return true;
	if (!hasKanji && compact.length < 12) return true;
	return false;
}

function isTitleOnlyContactLog(
	titleText: string,
	activityLog: string,
	activityDisplay: string,
): boolean {
	const titleKey = normalizeContactDisplayText(titleText);
	if (!titleKey) return false;
	const carriers = [activityLog, activityDisplay]
		.map(normalizeContactDisplayText)
		.filter(Boolean);
	return carriers.length > 0 && carriers.every((value) => value === titleKey);
}

function normalizeContactDisplayText(value: string): string {
	return value.replace(/\s+/g, "").trim();
}

function checkboxValue(property: unknown): boolean {
	if (!property || typeof property !== "object") return false;
	const prop = property as Record<string, unknown>;
	return prop.type === "checkbox" && prop.checkbox === true;
}

function plain(items: unknown[]): string {
	return items
		.map((item) => {
			if (!item || typeof item !== "object") return "";
			const rich = item as Record<string, unknown>;
			return typeof rich.plain_text === "string" ? rich.plain_text : "";
		})
		.join("")
		.trim();
}

function normalizeCompanyName(value: string): string {
	return value
		.toLowerCase()
		.replace(/株式会社|有限会社|合同会社|（株）|㈱|inc\.?|co\.?\s*ltd\.?/g, "")
		.replace(/[\s　・･\-ー＿_.,，。()（）【】\[\]]/g, "")
		.trim();
}

function digits(value: string): string {
	return value.replace(/\D/g, "");
}

function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

function readNestedString(
	value: unknown,
	path: string[],
): string | undefined {
	let cursor = value;
	for (const key of path) {
		if (!cursor || typeof cursor !== "object") return undefined;
		cursor = (cursor as Record<string, unknown>)[key];
	}
	return typeof cursor === "string" && cursor.trim() ? cursor.trim() : undefined;
}

function extractWebhookLandPageId(body: Record<string, unknown>): string | undefined {
	return firstString(
		body.landPageId,
		body.land_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "landPageId"]),
		readNestedString(body, ["data", "land_page_id"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

async function resolveLandPageIdFromWebhook(
	body: Record<string, unknown>,
	notion: NotionClient,
): Promise<string | undefined> {
	const name = extractWebhookBodyText(body, [
		"土地名称",
		"土地名",
		"Name",
		"name",
		"title",
	]);
	const address = extractWebhookBodyText(body, [
		"所在地",
		"住所",
		"土地所在地",
		"address",
	]);
	const areaText = extractWebhookBodyText(body, [
		"面積（坪）",
		"面積",
		"areaTsubo",
		"area_tsubo",
	]);
	const area = numberFromText(areaText);

	const candidates = uniquePages([
		...(name ? await safeLandQuery(notion, { property: "土地名称", title: { contains: name } }) : []),
		...(address
			? await safeLandQuery(notion, { property: "所在地", rich_text: { contains: address } })
			: []),
	]);
	if (candidates.length === 0) return undefined;

	const matching = candidates.filter((page) => {
		const land = readLand(page);
		const nameMatches = !name || normalizeLookupText(land.name) === normalizeLookupText(name);
		const addressMatches =
			!address || normalizeLookupText(land.address) === normalizeLookupText(address);
		const areaMatches =
			area === null || land.areaTsubo === null || Math.abs(land.areaTsubo - area) < 0.01;
		return nameMatches && addressMatches && areaMatches;
	});
	if (matching.length === 1) return matching[0]!.id;
	if (candidates.length === 1) return candidates[0]!.id;
	return undefined;
}

async function safeLandQuery(
	notion: NotionClient,
	filter: Record<string, unknown>,
): Promise<Page[]> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: LAND_DATA_SOURCE_ID,
			page_size: 10,
			filter,
		});
		return response.results;
	} catch (error) {
		console.log("land lookup skipped", String(error));
		return [];
	}
}

function uniquePages(pages: Page[]): Page[] {
	const seen = new Set<string>();
	const result: Page[] = [];
	for (const page of pages) {
		if (seen.has(page.id)) continue;
		seen.add(page.id);
		result.push(page);
	}
	return result;
}

function uniqueStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		if (!value || seen.has(value)) continue;
		seen.add(value);
		result.push(value);
	}
	return result;
}

function normalizeLookupText(value: string): string {
	return value.replace(/[\s　・･\-ー＿_.,，。()（）【】\[\]]/g, "").toLowerCase();
}

function coerceWebhookBodyRecord(body: unknown): Record<string, unknown> {
	if (body && typeof body === "object" && !Array.isArray(body)) {
		return body as Record<string, unknown>;
	}
	if (typeof body === "string") {
		try {
			const parsed = JSON.parse(body);
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return parsed as Record<string, unknown>;
			}
		} catch {
			return {};
		}
	}
	return {};
}

function extractWebhookPageId(body: Record<string, unknown>): string | undefined {
	return firstString(
		body.companyPageId,
		body.company_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "companyPageId"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		pageIdFromUrl(readNestedString(body, ["data", "URL"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

async function resolveCompanyPageIdFromWebhook(
	body: Record<string, unknown>,
	notion: NotionClient,
): Promise<string | undefined> {
	const direct = extractWebhookPageId(body);
	if (direct) return direct;

	const duplicateKey = extractWebhookBodyText(body, [
		"企業重複チェックキー",
		"companyDuplicateKey",
		"company_duplicate_key",
	]);
	if (duplicateKey) {
		const byKey = await safeCompanyQuery(notion, {
			property: "企業重複チェックキー",
			rich_text: { equals: duplicateKey },
		});
		if (byKey.length === 1) return byKey[0]!.id;
	}

	const companyName = extractWebhookBodyText(body, [
		"企業名",
		"会社名",
		"companyName",
		"company_name",
		"name",
	]);
	if (!companyName) return undefined;
	const byName = await safeCompanyQuery(notion, {
		property: "企業名",
		title: { contains: companyName },
	});
	const normalized = normalizeCompanyName(companyName);
	const exact = byName.filter(
		(page) => normalizeCompanyName(text(page.properties?.["企業名"])) === normalized,
	);
	const candidates = exact.length > 0 ? exact : byName;
	if (candidates.length === 1) return candidates[0]!.id;
	return undefined;
}

function extractWebhookBodyText(
	body: Record<string, unknown>,
	keys: string[],
): string {
	for (const key of keys) {
		const value = firstString(
			bodyString(body[key]),
			bodyString((body.data as Record<string, unknown> | undefined)?.[key]),
			bodyString((body.properties as Record<string, unknown> | undefined)?.[key]),
			bodyString(
				((body.data as Record<string, unknown> | undefined)?.properties as
					| Record<string, unknown>
					| undefined)?.[key],
			),
			bodyString(
				((body.page as Record<string, unknown> | undefined)?.properties as
					| Record<string, unknown>
					| undefined)?.[key],
			),
		);
		if (value) return value;
	}
	return "";
}

function bodyString(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) {
		return value.map(bodyString).filter(Boolean).join(", ");
	}
	if (!value || typeof value !== "object") return "";
	const object = value as Record<string, unknown>;
	const fromProperty = text(object);
	if (fromProperty) return fromProperty;
	return firstString(
		object.plain_text,
		object.name,
		object.title,
		object.url,
		object.value,
		object.content,
		bodyString(object.text),
		bodyString(object.select),
		bodyString(object.rich_text),
	) ?? "";
}

function numberFromWebhookBody(
	body: Record<string, unknown>,
	key: string,
	fallback: number,
): number {
	const value = (body[key] ?? (body.data as Record<string, unknown> | undefined)?.[key]) as
		| number
		| string
		| undefined;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value.trim());
		if (Number.isFinite(parsed)) return parsed;
	}
	return fallback;
}

function booleanFromWebhookBody(
	body: Record<string, unknown>,
	key: string,
	fallback: boolean,
): boolean {
	const value = body[key] ?? (body.data as Record<string, unknown> | undefined)?.[key];
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		if (/^(true|1|yes|on)$/i.test(value.trim())) return true;
		if (/^(false|0|no|off)$/i.test(value.trim())) return false;
	}
	return fallback;
}

function pageIdFromUrl(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const clean = value.split(/[?#]/)[0] ?? value;
	const compactMatches = clean.match(/[0-9a-f]{32}/gi);
	const uuidMatches = clean.match(
		/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
	);
	const compact =
		compactMatches?.at(-1) ?? uuidMatches?.at(-1)?.replace(/-/g, "");
	if (!compact) return undefined;
	return [
		compact.slice(0, 8),
		compact.slice(8, 12),
		compact.slice(12, 16),
		compact.slice(16, 20),
		compact.slice(20),
	].join("-");
}

function pageTemplate(templateId: string | undefined): Record<string, unknown> {
	const clean = (templateId ?? "").trim();
	if (!clean) throw new Error("ページ作成テンプレートIDが未設定です。");
	return {
		type: "template_id",
		template_id: clean,
		timezone: "Asia/Tokyo",
	};
}

async function appendBlocksIfAny(
	notion: NotionClient,
	pageId: string,
	children: Record<string, unknown>[],
): Promise<void> {
	if (children.length === 0) return;
	if (!notion.blocks?.children?.append) {
		throw new Error("blocks.children.append が利用できないため、テンプレート後の補足ブロックを追加できません。");
	}
	await notion.blocks.children.append({
		block_id: pageId,
		children,
	});
}

function title(value: string): Record<string, unknown> {
	return { title: [{ text: { content: value.slice(0, 1800) } }] };
}

function richText(value: string): Record<string, unknown> {
	return { rich_text: richTextItems(value) };
}

function richTextItems(value: string): Array<Record<string, unknown>> {
	const chunks: string[] = [];
	const chunkSize = 1800;
	for (let index = 0; index < value.length; index += chunkSize) {
		chunks.push(value.slice(index, index + chunkSize));
	}
	if (chunks.length === 0) chunks.push("");
	return chunks.map((content) => ({ type: "text", text: { content } }));
}

function annotatedRichTextItems(
	value: string,
	annotations?: Record<string, unknown>,
): Array<Record<string, unknown>> {
	const chunks: string[] = [];
	const chunkSize = 1800;
	for (let index = 0; index < value.length; index += chunkSize) {
		chunks.push(value.slice(index, index + chunkSize));
	}
	if (chunks.length === 0) chunks.push("");
	return chunks.map((content) => ({
		type: "text",
		text: { content },
		...(annotations ? { annotations } : {}),
	}));
}

function richTextRevisionItems(
	patch: Extract<SafePatch, { kind: "text-with-revision" }>,
): Array<Record<string, unknown>> {
	return [
		...annotatedRichTextItems(patch.oldValue, {
			bold: false,
			italic: false,
			strikethrough: true,
			underline: false,
			code: false,
			color: "default",
		}),
		...annotatedRichTextItems(
			`\n【修正情報】${patch.newValue}\n【修正理由】${patch.reason}\n【確認日】${patch.checkedAt}${patch.sourceUrl ? `\n【出典】${patch.sourceUrl}` : ""}`,
		),
	];
}

function select(name: string): Record<string, unknown> {
	return { select: { name } };
}

function multiSelect(names: string[]): Record<string, unknown> {
	return { multi_select: names.map((name) => ({ name })) };
}

function relation(id: string): Record<string, unknown> {
	return { relation: [{ id }] };
}

function relationIds(ids: string[]): Record<string, unknown> {
	return { relation: ids.map((id) => ({ id })) };
}

function uniqueIds(ids: string[]): string[] {
	const result: string[] = [];
	const seen = new Set<string>();
	for (const id of ids) {
		if (!id || seen.has(id)) continue;
		seen.add(id);
		result.push(id);
	}
	return result;
}

function relationIdsFromProperty(property: unknown): string[] {
	if (!property || typeof property !== "object") return [];
	const prop = property as Record<string, unknown>;
	if (!Array.isArray(prop.relation)) return [];
	return prop.relation
		.map((item) => {
			if (!item || typeof item !== "object") return "";
			const relationItem = item as Record<string, unknown>;
			return typeof relationItem.id === "string" ? relationItem.id : "";
		})
		.filter(Boolean);
}

function personIdsFromProperty(property: unknown): string[] {
	if (!property || typeof property !== "object") return [];
	const prop = property as Record<string, unknown>;
	if (!Array.isArray(prop.people)) return [];
	return prop.people
		.map((item) => {
			if (!item || typeof item !== "object") return "";
			const person = item as Record<string, unknown>;
			return typeof person.id === "string" ? person.id : "";
		})
		.filter(Boolean);
}

function personLabelsFromProperty(property: unknown): string[] {
	if (!property || typeof property !== "object") return [];
	const prop = property as Record<string, unknown>;
	if (!Array.isArray(prop.people)) return [];
	return prop.people
			.map((item) => {
				if (!item || typeof item !== "object") return "";
				const person = item as Record<string, unknown>;
				return firstString(person.name, person.id) ?? "";
			})
			.filter(Boolean);
}

function dateStartFromProperty(property: unknown): string {
	if (!property || typeof property !== "object") return "";
	const prop = property as Record<string, unknown>;
	if (prop.type !== "date" || !prop.date || typeof prop.date !== "object") return "";
	const date = prop.date as Record<string, unknown>;
	return typeof date.start === "string" ? date.start : "";
}

function createdDateFromPage(page: Page): string {
	const createdTime = (page as Record<string, unknown>).created_time;
	return typeof createdTime === "string" ? createdTime.slice(0, 10) : "";
}

function createdByUserIdsFromPage(page: Page): string[] {
	const createdBy = (page as Record<string, unknown>).created_by;
	if (!createdBy || typeof createdBy !== "object") return [];
	const user = createdBy as Record<string, unknown>;
	const id = typeof user.id === "string" ? user.id : "";
	return id ? [id] : [];
}

function email(value: string): Record<string, unknown> {
	return { email: value };
}

function phoneNumber(value: string): Record<string, unknown> {
	return { phone_number: value };
}

function verifyWebhookSecret(
	headers: Record<string, string>,
	body?: unknown,
): void {
	const expected = process.env.WAJO_WORKER_WEBHOOK_SECRET;
	if (!expected) return;
	const bodyRecord = coerceWebhookBodyRecord(body);
	const actual =
		headers["x-wajo-worker-secret"] ||
		headers["X-WAJO-WORKER-SECRET"] ||
		firstString(
			bodyRecord.secret,
			bodyRecord.wajoWorkerSecret,
			bodyRecord.wajo_worker_secret,
		);
	if (actual !== expected) {
		throw new WebhookVerificationError("Invalid WAJO worker webhook secret");
	}
}

// ─── 成約報告パイプライン 実装 ──────────────────────────────────────────────

interface ClosingFeedbackAIResponse {
	勝因: string;
	反省点: string;
	次に活かす学び: string;
	ナレッジ化候補: "候補" | "不要";
	ナレッジ化メモ: string;
}

/** 案件DBのページIDをWebhookボディから抽出 */
function extractProjectPageIdFromWebhook(body: Record<string, unknown>): string | undefined {
	return firstString(
		body.projectPageId,
		body.project_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "projectPageId"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

/** 成約報告DBのページIDをWebhookボディから抽出 */
function extractClosingReportPageIdFromWebhook(body: Record<string, unknown>): string | undefined {
	return firstString(
		body.closingPageId,
		body.closing_page_id,
		body.pageId,
		body.page_id,
		body.id,
		pageIdFromUrl(bodyString(body.url)),
		pageIdFromUrl(bodyString(body.URL)),
		readNestedString(body, ["data", "closingPageId"]),
		readNestedString(body, ["data", "pageId"]),
		readNestedString(body, ["data", "page_id"]),
		pageIdFromUrl(readNestedString(body, ["data", "url"])),
		readNestedString(body, ["page", "id"]),
		readNestedString(body, ["source", "page_id"]),
		readNestedString(body, ["entity", "id"]),
	);
}

async function resolveClosingReportProjectPageId(
	sourcePageId: string,
	notion: NotionClient,
): Promise<{
	action: "ready" | "needs-related-project" | "ambiguous-related-project";
	message: string;
	projectPageId: string | null;
	sourcePageId: string;
}> {
	const sourcePage = await notion.pages.retrieve({ page_id: sourcePageId });
	const parentDataSourceId = ((sourcePage as { parent?: { data_source_id?: string } }).parent)?.data_source_id;
	if (parentDataSourceId === PROJECT_DATA_SOURCE_ID) {
		return {
			action: "ready",
			message: "案件管理DBページとして成約報告を続行します。",
			projectPageId: sourcePageId,
			sourcePageId,
		};
	}

	const relatedProjectIds = relationIdsFromProperty(sourcePage.properties?.["関連案件"]);
	const sourceTitle = readGenericPageTitle(sourcePage) || sourcePageId;
	if (relatedProjectIds.length === 1) {
		return {
			action: "ready",
			message: `商談「${sourceTitle}」の関連案件から成約報告を続行します。`,
			projectPageId: relatedProjectIds[0]!,
			sourcePageId,
		};
	}

	if (relatedProjectIds.length === 0) {
		const message = [
			`⚠️ 成約報告を止めました: ${sourceTitle}`,
			"",
			"この商談ページに「関連案件」が入っていないため、どの案件を成約にするか特定できません。",
			"商談ページの「関連案件」を1件だけ設定してから、もう一度「成約報告する」を押してください。",
			"この時点では案件ステータス、成約報告DB、月次成績は更新していません。",
		].join("\n");
		await createPageComment(notion, sourcePageId, message);
		return {
			action: "needs-related-project",
			message,
			projectPageId: null,
			sourcePageId,
		};
	}

	const message = [
		`⚠️ 成約報告を止めました: ${sourceTitle}`,
		"",
		`この商談ページに「関連案件」が${relatedProjectIds.length}件入っているため、どの案件を成約にするか一意に決められません。`,
		"商談ページの「関連案件」を1件だけにしてから、もう一度「成約報告する」を押してください。",
		"この時点では案件ステータス、成約報告DB、月次成績は更新していません。",
	].join("\n");
	await createPageComment(notion, sourcePageId, message);
	return {
		action: "ambiguous-related-project",
		message,
		projectPageId: null,
		sourcePageId,
	};
}

/** Webhookを起動したユーザーのIDを抽出（ボタンを押した人） */
function extractTriggerUserIdFromWebhook(body: Record<string, unknown>): string | undefined {
	return firstString(
		readNestedString(body, ["user", "id"]),
		readNestedString(body, ["triggered_by", "id"]),
		readNestedString(body, ["triggeredBy", "id"]),
		readNestedString(body, ["automation", "user", "id"]),
		readNestedString(body, ["source", "user_id"]),
		body.userId,
		body.user_id,
	);
}

function extractManagerActionReasonFromWebhook(body: Record<string, unknown>): string {
	return extractWebhookBodyText(body, [
		"理由",
		"差し戻し理由",
		"取り消し理由",
		"管理メモ",
		"メモ",
		"reason",
		"message",
	]);
}

function extractLostReasonFromWebhook(body: Record<string, unknown>): string {
	return extractWebhookBodyText(body, [
		"失注理由",
		"失注理由カテゴリ",
		"lostReason",
		"lost_reason",
		"reason",
		"理由",
	]);
}

function extractLostMemoFromWebhook(body: Record<string, unknown>): string {
	return extractWebhookBodyText(body, [
		"失注理由メモ",
		"失注申請メモ",
		"lostMemo",
		"lost_memo",
		"memo",
		"メモ",
		"message",
	]);
}

function extractNotificationEventTypeFromWebhook(body: Record<string, unknown>): string {
	return (
		extractWebhookBodyText(body, [
			"通知種別",
			"イベント",
			"eventType",
			"event_type",
			"action",
		]) || "営業通知"
	);
}

function extractNotificationMessageFromWebhook(
	body: Record<string, unknown>,
	eventType: string,
): string {
	const explicit = extractWebhookBodyText(body, [
		"通知文",
		"通知メッセージ",
		"message",
		"text",
		"body",
	]);
	if (explicit) return explicit;
	return `📣 ${eventType} がありました。対象ページを確認してください。`;
}

function userIdsFromWebhookValue(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.flatMap(userIdsFromWebhookValue)
			.map((id) => id.trim())
			.filter(Boolean);
	}
	if (typeof value === "string") {
		return value
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean);
	}
	return [];
}

function extractSalesTeamUserIdsFromWebhook(body: Record<string, unknown>): string[] {
	const data = body.data as Record<string, unknown> | undefined;
	return uniqueStrings([
		...userIdsFromWebhookValue(body.salesTeamUserIds),
		...userIdsFromWebhookValue(body.sales_team_user_ids),
		...userIdsFromWebhookValue(body.salesUsers),
		...userIdsFromWebhookValue(data?.salesTeamUserIds),
		...userIdsFromWebhookValue(data?.sales_team_user_ids),
	]);
}

function salesTeamNotificationRichText(
	message: string,
	userIds = SALES_TEAM_USER_IDS,
): Array<Record<string, unknown>> {
	const mentions = userIds.slice(0, 30).flatMap((id) => [
		{
			type: "mention",
			mention: { type: "user", user: { id } },
		},
		{ type: "text", text: { content: " " } },
	]);
	return [
		...mentions,
		{
			type: "text",
			text: { content: `${mentions.length ? "\n" : ""}${message.slice(0, 1800)}` },
		},
	];
}

async function createPageComment(
	notion: NotionClient,
	pageId: string,
	message: string,
	mentionSalesTeam = false,
	salesTeamUserIds = SALES_TEAM_USER_IDS,
): Promise<void> {
	if (!notion.comments?.create) return;
	try {
		await notion.comments.create({
			parent: { page_id: pageId },
			rich_text: mentionSalesTeam
				? salesTeamNotificationRichText(message, salesTeamUserIds)
				: [{ type: "text", text: { content: message.slice(0, 1800) } }],
		});
	} catch (error) {
		console.log("comment notification skipped", { pageId, error: String(error) });
	}
}

async function notifySalesTeam(
	notion: NotionClient,
	pageId: string,
	message: string,
	salesTeamUserIds = SALES_TEAM_USER_IDS,
): Promise<void> {
	await createPageComment(notion, pageId, message, true, salesTeamUserIds);
}

async function processInquiryAssignOwner(
	inquiryPageId: string,
	triggerUserId: string,
	notion: NotionClient,
): Promise<{ action: string; message: string }> {
	const inquiryPage = await notion.pages.retrieve({ page_id: inquiryPageId });
	const properties = inquiryPage.properties ?? {};
	const inquiryTitle =
		text(properties["件名"]) ||
		text(properties["問い合わせ名"]) ||
		text(properties["名前"]) ||
		"問い合わせ";
	const assignedUserIds = personIdsFromProperty(properties["担当営業ユーザー"]);

	if (assignedUserIds.includes(triggerUserId)) {
		return {
			action: "already-owned",
			message: "この問い合わせは既にあなたが担当しています。重複更新は行いませんでした。",
		};
	}

	if (assignedUserIds.length > 0) {
		await createPageComment(
			notion,
			inquiryPage.id,
			"⚠️ 担当取得は行いませんでした。\n既に担当営業ユーザーが設定されています。担当変更が必要な場合はマネージャー側で変更してください。",
		);
		return {
			action: "already-assigned",
			message: "既に担当営業ユーザーが設定されているため、上書きしませんでした。",
		};
	}

	const today = todayDateJST();
	await safeUpdateExistingProperties(notion, inquiryPage, {
		担当営業ユーザー: { kind: "people", ids: [triggerUserId] },
		ステータス: { kind: "select", value: "担当確定" },
		進捗フェーズ: { kind: "select", value: "担当確定" },
		担当確定日: { kind: "date", value: today },
		担当取得日: { kind: "date", value: today },
		担当日: { kind: "date", value: today },
		最終アクション日: { kind: "date", value: today },
	});

	await notifySalesTeam(
		notion,
		inquiryPage.id,
		`🙋 担当が決まりました: ${inquiryTitle}\n担当営業ユーザーにボタンを押したユーザーを設定しました。`,
	);

	return {
		action: "assigned",
		message: "担当営業ユーザーを設定しました。既に担当者がいる場合は上書きしない安全形です。",
	};
}

async function processInquiryProjectCreation(
	inquiryPageId: string,
	notion: NotionClient,
	triggerUserId?: string,
	dryRun = false,
): Promise<InquiryProjectCreationResult> {
	const inquiryPage = await notion.pages.retrieve({ page_id: inquiryPageId });
	const inquiryTitle = readGenericPageTitle(inquiryPage) || "問い合わせ";
	const relationProjectIds = uniqueStrings([
		...relationIdsFromProperty(inquiryPage.properties?.["紐づき案件"]),
		...relationIdsFromProperty(inquiryPage.properties?.["関連案件"]),
	]);
	const existingProjects = await findProjectsByInquiry(notion, inquiryPage.id);
	const existingProjectIds = uniqueStrings([
		...relationProjectIds,
		...existingProjects.map((project) => project.page.id),
	]);

	if (existingProjectIds.length > 0) {
		if (!dryRun) {
			const targetProjectId = existingProjectIds[0]!;
			try {
				const existingProjectPage = await notion.pages.retrieve({ page_id: targetProjectId });
				await enrichProjectFromInquiry(notion, existingProjectPage, inquiryPage, triggerUserId);
			} catch (error) {
				console.log("inquiry project enrich skipped", String(error));
			}
			await markInquiryProjectLinked(
				notion,
				inquiryPage,
				existingProjectIds,
				triggerUserId,
				"既存の案件を検出し、問い合わせ内容を引き継ぎ（更新）しました。重複案件は作成していません。",
			);
			await createPageComment(
				notion,
				inquiryPage.id,
				"✅ 既存の案件に問い合わせ内容を引き継ぎました。重複案件は作成していません。",
			);
		}
		return {
			inquiryPageId,
			action: dryRun ? "dry-run" : "enriched-existing",
			projectId: existingProjectIds[0] ?? null,
			created: 0,
			message: `既存案件 ${existingProjectIds.length} 件を検出。新規作成せず、問い合わせ内容を引き継ぎました。`,
		};
	}

	const plannedGrossProfit = numberValue(inquiryPage.properties?.["予定粗利額"]);
	if (plannedGrossProfit === null || plannedGrossProfit <= 0) {
		if (!dryRun) {
			await safeUpdateExistingProperties(notion, inquiryPage, {
				案件化状態: { kind: "select", value: "案件化保留" },
				案件化メモ: {
					kind: "text",
					value: "予定粗利額が未入力のため、案件管理DBへの新規作成を止めました。",
				},
			});
		}
		return {
			inquiryPageId,
			action: "error",
			projectId: null,
			created: 0,
			message: "予定粗利額が未入力のため、案件化を止めました。",
		};
	}

	const plannedGrossBasis = text(inquiryPage.properties?.["予定粗利の根拠"]);
	if (!plannedGrossBasis) {
		if (!dryRun) {
			await safeUpdateExistingProperties(notion, inquiryPage, {
				案件化状態: { kind: "select", value: "案件化保留" },
				案件化メモ: {
					kind: "text",
					value: "予定粗利の根拠が未入力のため、案件管理DBへの新規作成を止めました。",
				},
			});
		}
		return {
			inquiryPageId,
			action: "error",
			projectId: null,
			created: 0,
			message: "予定粗利の根拠が未入力のため、案件化を止めました。",
		};
	}

	if (dryRun) {
		return {
			inquiryPageId,
			action: "dry-run",
			projectId: null,
			created: 1,
			message: `dry-run: 案件管理DBへ問い合わせ起点の案件を1件作成予定です。対象: ${inquiryTitle}`,
		};
	}

	try {
		const project = await createProjectFromInquiry(notion, inquiryPage, triggerUserId);
		await markInquiryProjectLinked(
			notion,
			inquiryPage,
			[project.id],
			triggerUserId,
			"案件管理DBへ問い合わせ起点の案件を1件作成しました。",
		);
		await markAiLearningLogsOutcome(notion, {
			relationProperty: "関連問い合わせ",
			pageId: inquiryPage.id,
			outcome: "案件化",
			scoreThreshold: 65,
			note: "問い合わせ案件化Workerが案件管理DBへ新規案件を作成し、案件化予測の実結果を反映。",
		}).catch((error) => {
			console.log("inquiry project learning outcome skipped", String(error));
		});
		await notifySalesTeam(
			notion,
			project.id,
			`📣 案件化しました: ${inquiryTitle}\n問い合わせから案件管理DBへ新しい案件が作成されました。`,
		);
		return {
			inquiryPageId,
			action: "created-project",
			projectId: project.id,
			created: 1,
			message: "案件管理DBへ問い合わせ起点の案件を1件作成し、問い合わせ側へ紐づけ返しました。",
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await safeUpdateExistingProperties(notion, inquiryPage, {
			案件化状態: { kind: "select", value: "案件化保留" },
			案件化メモ: { kind: "text", value: `問い合わせ案件化Worker処理失敗: ${message}` },
		});
		return {
			inquiryPageId,
			action: "error",
			projectId: null,
			created: 0,
			message: `問い合わせ案件化に失敗しました: ${message.slice(0, 300)}`,
		};
	}
}

async function findProjectsByInquiry(
	notion: NotionClient,
	inquiryPageId: string,
): Promise<ProjectInfo[]> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: PROJECT_DATA_SOURCE_ID,
			page_size: 20,
			filter: {
				property: "元問い合わせ",
				relation: { contains: inquiryPageId },
			},
		});
		return (response.results ?? []).map(readProjectInfo);
	} catch (error) {
		console.log("inquiry project lookup skipped", String(error));
		return [];
	}
}

async function createProjectFromInquiry(
	notion: NotionClient,
	inquiryPage: Page,
	triggerUserId?: string,
): Promise<Page> {
	const inquiryTitle = readGenericPageTitle(inquiryPage) || "問い合わせ";
	const projectName = buildInquiryProjectName(inquiryTitle);
	const created = await createProjectRecord(notion, {
		案件名: title(projectName),
		ステータス: select("🔴 情報収集中"),
		獲得ソース: select("問い合わせ"),
		仕入れ元区分: select("問い合わせ"),
		作成日: { date: { start: todayDateJST() } },
		最終アクション日: { date: { start: todayDateJST() } },
	});
	const projectPage = await notion.pages.retrieve({ page_id: created.id });
	await enrichProjectFromInquiry(notion, projectPage, inquiryPage, triggerUserId);
	return notion.pages.retrieve({ page_id: created.id });
}

// 案件ページ（新規でも、純正ボタンが先に作った既存でも）へ、問い合わせ内容を確実に引き継ぐ。
async function enrichProjectFromInquiry(
	notion: NotionClient,
	projectPage: Page,
	inquiryPage: Page,
	triggerUserId?: string,
): Promise<void> {
	const properties = inquiryPage.properties ?? {};
	const inquiryTitle = readGenericPageTitle(inquiryPage) || "問い合わせ";
	const existingAssignedUserIds = personIdsFromProperty(properties["担当営業ユーザー"]);
	const assignedUserIds =
		existingAssignedUserIds.length > 0
			? uniqueStrings(existingAssignedUserIds)
			: triggerUserId
				? [triggerUserId]
				: [];
	const relatedCompanyIds = relationIdsFromProperty(properties["関連企業"]);
	const contactLogIds = relationIdsFromProperty(properties["顧客接点ログ"]);
	const plannedGrossProfit = numberValue(properties["予定粗利額"]);
	const projectDealType = projectDealTypeFromInquiryDealType(text(properties["売買区分"]));
	const inquiryAttentionMemo = text(properties["確認待ち内容"]);
	const memo = [
		"お問い合わせDBからWorker案件化。",
		`元問い合わせ: ${inquiryTitle}`,
		"重複防止: 紐づき案件と案件管理DBの元問い合わせを確認してから作成。",
		"次に確認すること: 対象物、売買条件、必要資料、価格、所有者/決裁者。",
	].join("\n");
	const patches: Record<string, SafePatch> = {
		案件名: { kind: "text", value: buildInquiryProjectName(inquiryTitle) },
		案件詳細: { kind: "text", value: memo },
		情報ソース: { kind: "text", value: "お問い合わせDB / Worker案件化" },
		確認待ち内容: {
			kind: "text",
			value: [
				inquiryAttentionMemo,
				"案件化後確認: 売買条件、資料、価格、所有者/決裁者、現地確認の要否を確認してください。",
			]
				.filter(Boolean)
				.join("\n\n"),
		},
		元問い合わせ: { kind: "relation", ids: [inquiryPage.id] },
	};
	if (assignedUserIds.length > 0) {
		patches["担当営業ユーザー"] = {
			kind: "people",
			ids: assignedUserIds.slice(0, 5),
		};
	}
	if (relatedCompanyIds.length > 0) {
		patches["関連企業"] = { kind: "relation", ids: relatedCompanyIds };
	}
	if (contactLogIds.length > 0) {
		patches["顧客接点ログ"] = { kind: "relation", ids: contactLogIds };
	}
	// 案件化時、お問い合わせ内容を案件側の専用引き継ぎ列へ写す（DB設計者が用意した受け皿）。
	const inquirySummary = text(properties["メール要約"]);
	if (inquirySummary) {
		patches["問い合わせ要約"] = { kind: "text", value: inquirySummary };
	}
	const inquiryActivityLog =
		text(properties["📝 活動ログ"]) || text(properties["活動ログ"]) || text(properties["本文"]);
	if (inquiryActivityLog) {
		patches["問い合わせ活動ログ"] = { kind: "text", value: inquiryActivityLog };
	}
	if (plannedGrossProfit !== null && plannedGrossProfit > 0) {
		patches["予定粗利額"] = { kind: "number", value: plannedGrossProfit };
		// 問い合わせ側で入力された根拠をそのまま引き継ぐ（固定の「価格あり」で上書きしない）。
		patches["予定粗利の根拠"] = {
			kind: "select",
			value: projectGrossBasisFromInquiry(text(properties["予定粗利の根拠"])),
		};
	}
	if (projectDealType) {
		patches["売買区分"] = { kind: "select", value: projectDealType };
	}
	// 問い合わせ分類コードから案件種別・対象物種別を引き継ぐ（読み取れる区分だけ）。
	const inquiryCategoryCode = text(properties["問い合わせ分類コード"]);
	const projectCaseType = projectCaseTypeFromInquiryCategory(inquiryCategoryCode);
	if (projectCaseType) {
		patches["案件種別"] = { kind: "select", value: projectCaseType };
	}
	const projectAssetType = projectAssetTypeFromInquiryCategory(inquiryCategoryCode);
	if (projectAssetType) {
		patches["対象物種別"] = { kind: "select", value: projectAssetType };
	}
	patches["営業サマリー"] = {
		kind: "text",
		value:
			"情報収集中。問い合わせから案件化済み。対象物、売買条件、必要資料、価格、決裁者を確認してください。",
	};
	patches["次の一手"] = {
		kind: "text",
		value: "設備詳細を作成し、資料作成に必要な情報を埋める。",
	};
	await safeUpdateExistingProperties(notion, projectPage, patches);
	// 押し直し対策：既に引き継ぎ済みなら本文ブロックを二重追記しない。
	const existingProjectBody = await fetchPageBlockPlainText(notion, projectPage.id);
	if (!existingProjectBody.includes("営業サマリーと次の一手")) {
		await appendBlocksIfAny(
			notion,
			projectPage.id,
			buildInquiryProjectFollowupChildren({
				inquiryTitle,
				inquiryAttentionMemo,
			}),
		);
		// 問い合わせ本文（手入力の土地詳細・活動メモ等）を案件本文へ丸ごとコピーする。
		const inquiryBody = (await fetchPageBlockPlainText(notion, inquiryPage.id)).trim();
		const inquiryBodyMeaningful = inquiryBody.replace(/[—\-\s]/g, "").replace(/問い合わせ画面/g, "");
		if (inquiryBodyMeaningful.length > 0) {
			const bodyBlocks: Record<string, unknown>[] = [
				headingBlock("問い合わせ本文（引き継ぎ）", 2),
			];
			for (const line of inquiryBody
				.split("\n")
				.map((entry) => entry.trim())
				.filter(Boolean)
				.slice(0, 80)) {
				bodyBlocks.push(paragraphBlock(line.slice(0, 1800)));
			}
			await appendBlocksIfAny(notion, projectPage.id, bodyBlocks);
		}
	}
}

function buildInquiryProjectFollowupChildren(input: {
	inquiryTitle: string;
	inquiryAttentionMemo: string;
}): Record<string, unknown>[] {
	const attentionText =
		input.inquiryAttentionMemo ||
		"売買条件、資料、価格、所有者/決裁者、現地確認の要否を確認してください。";
	return [
		headingBlock("営業サマリーと次の一手", 2),
		paragraphBlock(`元問い合わせ: ${input.inquiryTitle}`),
		{
			object: "block",
			type: "callout",
			callout: {
				rich_text: blockRichText(
					`確認待ち: ${attentionText}\n次に見る場所: 設備詳細、シミュレーション、説明会用資料`,
				),
				icon: { emoji: "🧭" },
				color: "blue_background",
			},
		},
		{
			object: "block",
			type: "bulleted_list_item",
			bulleted_list_item: {
				rich_text: blockRichText("現地写真と設備IDの確認待ちがある場合は、先に設備入力を埋める。"),
			},
		},
		{
			object: "block",
			type: "bulleted_list_item",
			bulleted_list_item: {
				rich_text: blockRichText("案件化直後は、活動ログと次回アクションまで残す。"),
			},
		},
	];
}

function projectDealTypeFromInquiryDealType(inquiryDealType: string): string | null {
	if (inquiryDealType === "売却相談") return "売却案件";
	if (inquiryDealType === "購入相談") return "購入希望";
	if (inquiryDealType === "売買両方") return "売買両方";
	if (inquiryDealType === "その他相談") return "その他";
	if (inquiryDealType === "不明") return "不明";
	return null;
}

// 問い合わせの「予定粗利の根拠」を案件側へそのまま引き継ぐ。両DBで選択肢は同一。
// 不明な値だけ案件化必須を満たすため「価格あり」へ寄せる。
const PROJECT_GROSS_BASIS_OPTIONS = new Set([
	"価格あり",
	"相場見込み",
	"案件多数見込み",
	"仮置き",
]);

function projectGrossBasisFromInquiry(inquiryGrossBasis: string): string {
	return PROJECT_GROSS_BASIS_OPTIONS.has(inquiryGrossBasis) ? inquiryGrossBasis : "価格あり";
}

// 問い合わせ分類コード(① 売却査定〜⑦ その他)から案件種別(高圧/低圧/蓄電池/その他)へ。
// 設備種別が読み取れる③④⑤だけ写し、売却/購入/法人/その他は案件種別を断定しない(null)。
function projectCaseTypeFromInquiryCategory(categoryCode: string): string | null {
	if (categoryCode.includes("高圧")) return "高圧";
	if (categoryCode.includes("低圧")) return "低圧";
	if (categoryCode.includes("蓄電池")) return "蓄電池";
	return null;
}

// 問い合わせ分類コードから対象物種別(土地/太陽光発電所/系統用蓄電池/その他)を推定。
// 低圧/高圧=太陽光発電所、蓄電池=系統用蓄電池。読めない区分はnull(断定しない)。
function projectAssetTypeFromInquiryCategory(categoryCode: string): string | null {
	if (categoryCode.includes("高圧") || categoryCode.includes("低圧")) return "太陽光発電所";
	if (categoryCode.includes("蓄電池")) return "系統用蓄電池";
	return null;
}

function buildInquiryProjectName(inquiryTitle: string): string {
	const clean = inquiryTitle.replace(/\s+/g, " ").trim();
	return (clean || `問い合わせ案件 ${todayDateJST()}`).slice(0, 1800);
}

// ===== 案件 → 商談（「商談をする」ボタン）=====
type ProjectDealStartResult = {
	projectPageId: string;
	dealPageId: string | null;
	dealUrl: string | null;
	action: "created" | "existing" | "dry-run" | "error";
	message: string;
};

// 既に終わった商談(成約/失注)は重複判定の対象外。これら以外の進行中商談があれば新規作成しない。
const CLOSED_DEAL_STATUSES = new Set(["成約", "失注"]);

function buildProjectDealName(projectName: string): string {
	const clean = projectName.replace(/\s+/g, " ").trim() || "案件";
	return `${clean}｜商談`.slice(0, 1800);
}

// 案件の対象物種別・案件種別・売買区分から商談タグを推定（読み取れるものだけ）。
function projectDealTags(projectProperties: Record<string, unknown>): string[] {
	const tags: string[] = [];
	const assetType = text(projectProperties["対象物種別"]);
	const caseType = text(projectProperties["案件種別"]);
	if (assetType === "太陽光発電所" || caseType === "高圧" || caseType === "低圧") {
		tags.push("太陽光");
	}
	if (assetType === "系統用蓄電池" || caseType === "蓄電池") {
		tags.push("蓄電池");
	}
	const dealType = text(projectProperties["売買区分"]);
	if (dealType === "売却案件") tags.push("売りたい商談");
	if (dealType === "購入希望") tags.push("買いたい商談");
	return uniqueStrings(tags);
}

function buildProjectDealSummary(
	projectName: string,
	projectProperties: Record<string, unknown>,
): string {
	const lines = [
		`案件「${projectName}」起点の商談。`,
		"案件管理DBの内容を引き継ぎ。詳細は関連案件を参照。",
	];
	const grossProfit = numberValue(projectProperties["予定粗利額"]);
	if (grossProfit !== null && grossProfit > 0) {
		lines.push(`予定粗利額: ${Math.round(grossProfit).toLocaleString("ja-JP")}円`);
	}
	const dealType = text(projectProperties["売買区分"]);
	if (dealType) lines.push(`売買区分: ${dealType}`);
	const inquirySummary = text(projectProperties["問い合わせ要約"]);
	if (inquirySummary) lines.push(`問い合わせ要約: ${inquirySummary}`);
	return lines.join("\n");
}

// 商談ページ本文の雛形（案件からの引き継ぎサマリー＋商談メモ枠）。
function buildProjectDealChildren(
	projectName: string,
	summary: string,
): Record<string, unknown>[] {
	const blocks: Record<string, unknown>[] = [
		headingBlock("商談メモ（案件から引き継ぎ）", 2),
		paragraphBlock(`元案件: ${projectName}`),
	];
	for (const line of summary.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
		blocks.push(paragraphBlock(line.slice(0, 1800)));
	}
	blocks.push(headingBlock("決定事項 / 合意事項", 3));
	blocks.push(paragraphBlock(""));
	blocks.push(headingBlock("次アクション（誰が・いつまで）", 3));
	blocks.push(paragraphBlock(""));
	return blocks;
}

async function findDealsByProject(
	notion: NotionClient,
	projectPageId: string,
): Promise<Page[]> {
	try {
		const response = await notion.dataSources.query({
			data_source_id: DEAL_DATA_SOURCE_ID,
			page_size: 20,
			filter: {
				property: "関連案件",
				relation: { contains: projectPageId },
			},
		});
		return (response.results ?? []) as Page[];
	} catch (error) {
		console.log("project deal lookup skipped", String(error));
		return [];
	}
}

// 案件ページから商談管理DBへ商談を1件作成し、案件・関連企業・担当を引き継ぐ。
// 進行中の商談が既にあれば新規作成しない（成約/失注済みは進行中扱いしない）。案件ページは更新しない。
async function processProjectDealStart(
	input: { projectPageId: string; dryRun?: boolean },
	notion: NotionClient,
	triggerUserId?: string,
): Promise<ProjectDealStartResult> {
	const projectPage = await notion.pages.retrieve({ page_id: input.projectPageId });
	const projectName = readGenericPageTitle(projectPage) || "案件";
	const existingDeals = await findDealsByProject(notion, input.projectPageId);
	const openDeal = existingDeals.find((deal) => {
		const status = text((deal as Page).properties?.["商談ステータス"]);
		return !CLOSED_DEAL_STATUSES.has(status);
	});
	if (openDeal) {
		if (!input.dryRun) {
			await createPageComment(
				notion,
				input.projectPageId,
				"✅ 進行中の商談を検出しました。重複商談は作成していません。",
			);
		}
		return {
			projectPageId: input.projectPageId,
			dealPageId: openDeal.id,
			dealUrl: (openDeal as { url?: string }).url ?? null,
			action: "existing",
			message: "進行中の商談が既にあるため、新規作成しませんでした。",
		};
	}

	if (input.dryRun) {
		return {
			projectPageId: input.projectPageId,
			dealPageId: null,
			dealUrl: null,
			action: "dry-run",
			message: `dry-run: 商談管理DBへ「${projectName}」の商談を1件作成できます。`,
		};
	}

	const properties = projectPage.properties ?? {};
	const relatedCompanyIds = relationIdsFromProperty(properties["関連企業"]);
	const existingAssignedUserIds = personIdsFromProperty(properties["担当営業ユーザー"]);
	const assignedUserIds =
		existingAssignedUserIds.length > 0
			? uniqueStrings(existingAssignedUserIds)
			: triggerUserId
				? [triggerUserId]
				: [];
	// 商談ページは作成後に取得しない方針なので、プロパティは作成時にまとめて設定する。
	const dealSummary = buildProjectDealSummary(projectName, properties);
	const dealProperties: Record<string, unknown> = {
		商談名: title(buildProjectDealName(projectName)),
		商談ステータス: select("準備中"),
		商談日: { date: { start: todayDateJST() } },
		関連案件: relation(input.projectPageId),
		商談概要: richText(dealSummary),
	};
	if (relatedCompanyIds.length > 0) {
		dealProperties["関連企業"] = relationIds(relatedCompanyIds);
	}
	if (assignedUserIds.length > 0) {
		dealProperties["担当営業ユーザー"] = {
			people: assignedUserIds.slice(0, 5).map((id) => ({ id })),
		};
	}
	const dealTags = projectDealTags(properties);
	if (dealTags.length > 0) {
		dealProperties["タグ"] = multiSelect(dealTags);
	}
	const created = await notion.pages.create({
		parent: { data_source_id: DEAL_DATA_SOURCE_ID },
		icon: { type: "icon", icon: { name: "chart-area", color: "gray" } },
		properties: dealProperties,
		template: pageTemplate(DEAL_TEMPLATE_ID),
	});
	// 商談本文に案件引き継ぎサマリー＋商談メモ枠を追加（blocks API が無い環境では黙ってスキップ）。
	try {
		await appendBlocksIfAny(
			notion,
			created.id,
			buildProjectDealChildren(projectName, dealSummary),
		);
	} catch (error) {
		console.log("deal body scaffold skipped", String(error));
	}
	await createPageComment(
		notion,
		input.projectPageId,
		"✅ 商談管理DBへ商談を作成しました。案件・関連企業・担当を引き継いでいます。",
	);
	return {
		projectPageId: input.projectPageId,
		dealPageId: created.id,
		dealUrl: (created as { url?: string }).url ?? null,
		action: "created",
		message: "商談管理DBへ商談を1件作成し、案件と相互リンクしました。",
	};
}

async function markInquiryProjectLinked(
	notion: NotionClient,
	inquiryPage: Page,
	projectIds: string[],
	triggerUserId: string | undefined,
	message: string,
): Promise<void> {
	const properties = inquiryPage.properties ?? {};
	const currentProjectIds = uniqueStrings([
		...relationIdsFromProperty(properties["紐づき案件"]),
		...relationIdsFromProperty(properties["関連案件"]),
	]);
	const linkedProjectIds = uniqueStrings([...currentProjectIds, ...projectIds]);
	const today = todayDateJST();
	const patches: Record<string, SafePatch> = {
		ステータス: { kind: "select", value: "案件化" },
		進捗フェーズ: { kind: "select", value: "案件化" },
		案件化状態: { kind: "select", value: "案件化済" },
		案件化日: { kind: "date", value: today },
		最終アクション日: { kind: "date", value: today },
		紐づき案件: { kind: "relation", ids: linkedProjectIds },
		関連案件: { kind: "relation", ids: linkedProjectIds },
		案件化メモ: {
			kind: "text",
			value: [
				message,
				`関連案件数: ${linkedProjectIds.length}`,
				"再実行時は既存関連案件を検出し、新規作成しない。",
			].join("\n"),
		},
		営業サマリー: {
			kind: "text",
			value: `案件化有無: あり\n${message}`,
		},
		次の一手: {
			kind: "text",
			value: "活動を残す。その後、案件管理DBで設備詳細を作成する。",
		},
	};
	if (triggerUserId) {
		patches["案件化実行者"] = { kind: "people", ids: [triggerUserId] };
	}
	await safeUpdateExistingProperties(notion, inquiryPage, patches);
}

export { processInquiryAssignOwner as processInquiryAssignOwnerForTest };
export { processInquiryEmailIntake as processInquiryEmailIntakeForTest };
export { processInquiryProjectCreation as processInquiryProjectCreationForTest };
export { processProjectDealStart as processProjectDealStartForTest };
export { processBusinessCard as processBusinessCardForTest };
export { processCompanyResearch as processCompanyResearchForTest };
export { processInquiryCompanyLink as processInquiryCompanyLinkForTest };
export {
	processProjectEquipmentDetailRequest as processProjectEquipmentDetailRequestForTest,
};
export { processProjectProposalRequest as processProjectProposalRequestForTest };
export {
	processProjectResidentDocumentRequest as processProjectResidentDocumentRequestForTest,
};
export {
	buildProposalSimulationPdfBytes as buildProposalSimulationPdfBytesForTest,
	buildResidentDocumentPdfBytes as buildResidentDocumentPdfBytesForTest,
	createDealFeedbackLearningLog as createDealFeedbackLearningLogForTest,
	createMeetingFeedbackLearningLog as createMeetingFeedbackLearningLogForTest,
	evaluateProposalSimulationDraft as evaluateProposalSimulationDraftForTest,
	evaluateResidentDocumentDraft as evaluateResidentDocumentDraftForTest,
};

/**
 * 成約報告メイン処理
 * - 重複ガード（同一案件の有効な成約報告が既存なら skip）
 * - 成約報告DB に成約レコード作成（承認ステータス → 「成約」）
 * - 案件DB ステータス → 「🏆 成約」に更新
 * - ボタンを押したユーザーを担当営業に自動セット
 * - 営業部へコメント通知
 * - AI フィードバック（勝因・反省点・学び）を非同期生成
 */
async function processClosingReport(
	projectPageId: string,
	notion: NotionClient,
	triggerUserId?: string,
): Promise<{ action: string; message: string; closingPageId: string | null }> {
	// 1. 案件ページ取得
	const projectPage = await notion.pages.retrieve({ page_id: projectPageId });
	const projectName = text(projectPage.properties?.["案件名"]) || "案件";

	// 2. 重複チェック（同一案件に有効な成約報告が既にある場合は作成しない）
	const existing = await notion.dataSources.query({
		data_source_id: CLOSING_REPORT_DATA_SOURCE_ID,
		filter: {
			property: "関連案件",
			relation: { contains: projectPageId },
		},
		page_size: 5,
	});
	const activeReports = ((existing.results ?? []) as Page[]).filter((p) => {
		// 旧名/退役名の両方を読む(旧名のみだとリネーム後は常に""となり、
		// 取り消し/差戻し済み報告が「有効」と誤判定されて再報告がブロックされ続ける)
		const s = readClosingApprovalStatusText(p.properties);
		return s !== "取り消し" && s !== "差戻し" && s !== "差し戻し";
	});
	if (activeReports.length > 0) {
		const existingId = activeReports[0]!.id;
		const projectProperties = projectPage.properties ?? {};
		const dealType = text(projectProperties["売買区分"]);
		if (!closingDealTypeFromProjectDealType(dealType)) {
			const message = [
				`⚠️ 既存成約報告の月次反映を止めました: ${projectName}`,
				"",
				`この案件の成約報告は既に存在します（ID: ${existingId}）。`,
				"ただし、案件ページの「売買区分」が未確定のため、月次成績への反映は行っていません。",
				"「売却案件」「購入希望」「売買両方」のいずれかに設定してから、もう一度「🏆 成約を報告する」を押してください。",
			].join("\n");
			await createPageComment(notion, projectPage.id, message);
			return {
				action: "existing-needs-deal-type",
				closingPageId: existingId,
				message,
			};
		}
		await safeUpdateExistingProperties(notion, projectPage, {
			ステータス: { kind: "select", value: "🏆 成約" },
			成約日: { kind: "date", value: todayDateJST() },
		});
		const syncedDeals = await syncRelatedDealsToClosed(projectPageId, notion);
		const dealSalesPersonIds = personIdsFromProperty(projectProperties["担当営業ユーザー"]);
		const salesPersonIds = dealSalesPersonIds.length > 0
			? dealSalesPersonIds
			: (triggerUserId ? [triggerUserId] : []);
		const grossProfit =
			numberValue(projectProperties["実績粗利額"]) ??
			numberValue(projectProperties["予定粗利額"]);
		const sourcingPersonIds = personIdsFromProperty(projectProperties["仕入れ担当"]);
		const commissionRate = sourcingPersonIds.length > 0 ? 0.02 : 0.04;
		const closingSummary = grossProfit !== null && grossProfit > 0
			? { grossProfit, commissionAmount: Math.round(grossProfit * commissionRate) }
			: undefined;
		let linked = false;
		try {
			linked = await linkClosingToMonthlyPerformanceRecord(
				existingId,
				salesPersonIds,
				notion,
				new Date(),
				closingSummary,
			);
		} catch (error) {
			console.error("existing closing monthly link repair error:", String(error));
		}
		const message = linked
			? `この案件の成約報告は既に存在します（ID: ${existingId}）。重複作成せず、案件ステータスを「🏆 成約」へ補修し、月次成績への紐付けを確認しました。関連商談 ${syncedDeals.updatedCount} 件を成約へ同期しました。`
			: `この案件の成約報告は既に存在します（ID: ${existingId}）。重複作成せず、案件ステータスを「🏆 成約」へ補修しました。関連商談 ${syncedDeals.updatedCount} 件を成約へ同期しました。月次成績への紐付けは未確認です。`;
		await createPageComment(notion, projectPage.id, message);
		return {
			action: linked ? "already-exists-linked" : "already-exists",
			closingPageId: existingId,
			message,
		};
	}

	// 3. 案件プロパティ読み取り
	const dealType = text(projectPage.properties?.["売買区分"]);
	const targetType = text(projectPage.properties?.["対象物種別"]);
	const grossProfit =
		numberValue(projectPage.properties?.["実績粗利額"]) ??
		numberValue(projectPage.properties?.["予定粗利額"]);

	if (grossProfit === null || grossProfit <= 0) {
		const message = buildMissingGrossProfitMessage(projectName);
		await createPageComment(notion, projectPage.id, message);
		return {
			action: "needs-gross-profit",
			closingPageId: null,
			message,
		};
	}

	const closingDealType = closingDealTypeFromProjectDealType(dealType);
	if (!closingDealType) {
		const message = buildMissingDealTypeMessage(projectName);
		await createPageComment(notion, projectPage.id, message);
		return {
			action: "needs-deal-type",
			closingPageId: null,
			message,
		};
	}

	// 担当営業：案件側の担当を優先し、未設定時だけクリックしたユーザーを使う
	const dealSalesPersonIds = personIdsFromProperty(projectPage.properties?.["担当営業ユーザー"]);
	const salesPersonIds = dealSalesPersonIds.length > 0
		? dealSalesPersonIds
		: (triggerUserId ? [triggerUserId] : []);
	const sourcingPersonIds = personIdsFromProperty(projectPage.properties?.["仕入れ担当"]);
	const relatedCompanyIds = relationIdsFromProperty(projectPage.properties?.["関連企業"]);
	const hasSeparateSourcing = sourcingPersonIds.length > 0;
	const commissionRate = hasSeparateSourcing ? 0.02 : 0.04;
	const commissionAmount = Math.round(grossProfit * commissionRate);

	// 4. 案件ステータスは即時成約へ。後追いでマネージャーが差し戻し/取り消しを行う。
	await safeUpdateExistingProperties(notion, projectPage, {
		ステータス: { kind: "select", value: "🏆 成約" },
		成約日: { kind: "date", value: todayDateJST() },
	});
	const syncedDeals = await syncRelatedDealsToClosed(projectPageId, notion);

	// 5. 成約報告ページ作成
	// 注意: 旧「承認ステータス: 成約」の書き込みは削除した(2026-06-13)。
	// 実機の成約報告DBに「承認ステータス」プロパティは存在せず(「退役｜承認ステータス（使用禁止）」
	// へリネーム済み)、pages.create に存在しない列を含めると validation_error で
	// 成約報告の作成自体が失敗するため。確定の正本は承認スタンプ列(下記)が担う。
	const properties: Record<string, unknown> = {
		成約名: title(`${projectName}｜成約報告`),
		対象物種別: select(targetType || "その他"),
		売買区分: select(closingDealType),
		歩合対象: { checkbox: true },
		成約日: { date: { start: todayDateJST() } },
		関連案件: { relation: [{ id: projectPageId }] },
		AI処理状態: select("処理中"),
	};
	properties["粗利額"] = { number: grossProfit };
	// 歩合見込額をここで計算して書き込む（月次成績のrollupで集計される）
	// 仕入れ・販売が同一人物 → 4%全額、別々 → それぞれ2%
	properties["歩合見込額"] = { number: commissionAmount };
	if (salesPersonIds.length > 0) {
		properties["担当営業ユーザー"] = { people: salesPersonIds.map((id) => ({ id })) };
	}
	if (hasSeparateSourcing) {
		properties["仕入れ担当"] = { people: sourcingPersonIds.map((id) => ({ id })) };
	}
	if (relatedCompanyIds.length > 0) {
		properties["関連企業"] = { relation: relatedCompanyIds.map((id) => ({ id })) };
	}
	if (syncedDeals.dealIds.length > 0) {
		properties["関連商談"] = relationIds(syncedDeals.dealIds);
	}
	const relatedLandIds = uniqueStrings([
		...relationIdsFromProperty(projectPage.properties?.["関連土地情報"]),
		...relationIdsFromProperty(projectPage.properties?.["土地情報"]),
		...relationIdsFromProperty(projectPage.properties?.["関連土地"]),
	]);
	const relatedInquiryIds = uniqueStrings([
		...relationIdsFromProperty(projectPage.properties?.["元問い合わせ"]),
		...relationIdsFromProperty(projectPage.properties?.["関連問い合わせ"]),
	]);

	// 6. ページコンテンツ（callout）
	const contentBlocks: unknown[] = [];
	contentBlocks.push({
		object: "block",
		type: "callout",
		callout: {
			rich_text: [{
				type: "text",
				text: {
					content: buildClosingFanfareMessage({
						projectName,
						grossProfit,
						commissionAmount,
						syncedDealCount: syncedDeals.updatedCount,
						linkedDealCount: syncedDeals.dealIds.length,
					}),
				},
			}],
			icon: { emoji: "🎉" },
			color: "green_background",
		},
	});
	if (!hasSeparateSourcing) {
		contentBlocks.push({
			object: "block",
			type: "callout",
			callout: {
				rich_text: [{
					type: "text",
					text: { content: "⚠️ 仕入れ担当が未設定です。右サイドバーの「仕入れ担当」欄に担当者を入力してください。入力後、仕入れ歩合（粗利×2%）が自動計算されます。" },
				}],
				icon: { emoji: "⚠️" },
				color: "yellow_background",
			},
		});
	}
	const commissionNote = hasSeparateSourcing
		? `（販売担当 2% ＋ 仕入れ担当 2% で歩合計算されます。粗利額が入力済みの場合、歩合見込額 = 粗利額 × 2%）`
		: `（仕入れ・販売ともに同一担当：粗利額 × 4%）`;
	const successMessage = buildClosingSuccessMessage({
		projectName,
		grossProfit,
		commissionAmount,
		commissionNote,
	});
	contentBlocks.push({
		object: "block",
		type: "callout",
			callout: {
				rich_text: [{
					type: "text",
					text: { content: successMessage },
				}],
			icon: { emoji: "🏆" },
			color: "green_background",
		},
	});

	const created = await notion.pages.create({
		parent: { data_source_id: CLOSING_REPORT_DATA_SOURCE_ID },
		properties,
		children: contentBlocks,
	});

	await markAiLearningLogsOutcome(notion, {
		relationProperty: "関連案件",
		pageId: projectPage.id,
		outcome: "成約",
		scoreThreshold: 80,
		note: "成約報告Workerが成約報告を作成し、成約予測の実結果を反映。",
	}).catch((error) => {
		console.log("project closing learning outcome skipped", String(error));
	});
	for (const landId of relatedLandIds) {
		await markAiLearningLogsOutcome(notion, {
			relationProperty: "関連土地",
			pageId: landId,
			outcome: "成約",
			scoreThreshold: 65,
			note: "成約報告Workerが関連土地までさかのぼり、土地評価の実結果を成約として反映。",
		}).catch((error) => {
			console.log("land closing learning outcome skipped", String(error));
		});
	}
	for (const inquiryId of relatedInquiryIds) {
		await markAiLearningLogsOutcome(notion, {
			relationProperty: "関連問い合わせ",
			pageId: inquiryId,
			outcome: "成約",
			scoreThreshold: 65,
			note: "成約報告Workerが関連問い合わせまでさかのぼり、案件化予測の最終実結果を成約として反映。",
		}).catch((error) => {
			console.log("inquiry closing learning outcome skipped", String(error));
		});
	}

	// 7. 月次成績（営業マンパフォーマンスDB）に紐付け
	let monthlyLinked = false;
	try {
		monthlyLinked = await linkClosingToMonthlyPerformanceRecord(
			created.id,
			salesPersonIds,
			notion,
			new Date(),
			{ grossProfit, commissionAmount },
		);
	} catch (err) {
		console.error("linkClosingToMonthlyPerformanceRecord error:", String(err));
	}
	if (!monthlyLinked && notion.blocks?.children?.append) {
		await notion.blocks.children.append({
			block_id: created.id,
			children: [
				{
					object: "block",
					type: "callout",
					callout: {
						rich_text: [
							{
								type: "text",
								text: {
									content:
										"📊 月次成績への自動反映が完了していません。\n" +
										"営業マンパフォーマンスDBに対象営業ユーザー付きの月次成績を用意するか、成約報告の担当営業ユーザーを確認してください。\n" +
										"ノルマ申請DBは目標値の原本、月次成績は営業マンパフォーマンスDBで確認します。",
								},
							},
						],
						icon: { emoji: "📋" },
						color: "blue_background",
					},
				},
			],
		});
	}

	// 7.5. 正本スタンプ(1-2): 成約確定がWorker経由で行われた事実をWorkerだけが記録する。
	// 列が未作成の間は safeUpdateExistingProperties が黙ってスキップする(=スケルトン)。
	// 手作業でDBに直接ページを作った「成約」はこのスタンプを持たない→改ざん検知formulaで🚨。
	await safeUpdateExistingProperties(notion, created, {
		[CLOSING_APPROVAL_STAMP_PROPERTY]: {
			kind: "text",
			value: buildApprovalStamp(
				monthlyLinked ? "成約確定" : "成約確定(月次未反映)",
				triggerUserId ?? salesPersonIds[0],
			),
		},
	}).catch((err) => {
		console.error("closing approval stamp error:", String(err));
	});

	// 8. 営業部への通知（非同期・ノーブロック）
	void notifySalesTeam(
		notion,
		projectPage.id,
		[
			`🏆 成約しました: ${projectName}`,
			`粗利: ${formatYen(grossProfit)}`,
			`歩合見込: ${formatYen(commissionAmount)}`,
			"成約報告が作成され、月次成績の数字に反映されました。",
		].join("\n"),
	).catch(() => {
		// コメントAPIが利用できない場合はサイレントスキップ
	});
	void createPageComment(
		notion,
		created.id,
		successMessage,
		false,
	).catch(() => {
		// コメントAPIが利用できない場合はサイレントスキップ
	});

	// 9. AI フィードバック（勝因・学び・ナレッジ化候補）を生成。await で完走させる
	// （このランタイムは return 後の非同期を破棄するため、void だと OpenAI 完了前に
	//  切れて AI処理状態が「処理中」のまま固まる）。
	try {
		await generateClosingFeedback(projectPage, created.id, notion);
	} catch (err) {
		console.error("generateClosingFeedback error:", String(err));
	}

	return {
		action: "created",
		closingPageId: created.id,
		message: `成約報告を登録しました（ID: ${created.id}）。粗利 ${formatYen(grossProfit)}、歩合見込 ${formatYen(commissionAmount)} を月次成績へ反映し、関連商談 ${syncedDeals.updatedCount} 件を成約へ同期し、AIフィードバック（勝因・学び・ナレッジ化候補）も生成しました。`,
	};
}

async function syncRelatedDealsToClosed(
	projectPageId: string,
	notion: NotionClient,
): Promise<{ dealIds: string[]; updatedCount: number }> {
	const relatedDeals = await findDealsByProject(notion, projectPageId);
	let updated = 0;
	for (const deal of relatedDeals) {
		const currentStatus = text(deal.properties?.["商談ステータス"]);
		if (currentStatus === "成約") continue;
		await safeUpdateExistingProperties(notion, deal, {
			商談ステータス: { kind: "select", value: "成約" },
		});
		updated += 1;
	}
	return {
		dealIds: relatedDeals.map((deal) => deal.id),
		updatedCount: updated,
	};
}

async function processClosingReportRequest(
	sourcePageId: string,
	notion: NotionClient,
	triggerUserId?: string,
): Promise<{
	action: string;
	message: string;
	closingPageId: string | null;
	projectPageId: string | null;
	sourcePageId: string;
}> {
	const resolved = await resolveClosingReportProjectPageId(sourcePageId, notion);
	if (!resolved.projectPageId) {
		return {
			action: resolved.action,
			message: resolved.message,
			closingPageId: null,
			projectPageId: null,
			sourcePageId,
		};
	}

	const result = await processClosingReport(resolved.projectPageId, notion, triggerUserId);
	return {
		...result,
		projectPageId: resolved.projectPageId,
		sourcePageId,
	};
}

function buildMissingGrossProfitMessage(projectName: string): string {
	return [
		`⚠️ 成約報告の準備はできています: ${projectName}`,
		"",
		"ただし、粗利が未入力のため成約報告の作成を止めました。",
		"案件ページの「実績粗利額」または「予定粗利額」を入力してから、もう一度「🏆 成約を報告する」を押してください。",
		"",
		"この時点では案件ステータスも成約報告DBも更新していません。二重登録は発生していません。",
	].join("\n");
}

function buildMissingDealTypeMessage(projectName: string): string {
	return [
		`⚠️ 売買区分を確認してください: ${projectName}`,
		"",
		"この案件が「売る案件」なのか「買う案件」なのか未確定のため、成約報告の作成を止めました。",
		"案件ページの「売買区分」を「売却案件」「購入希望」「売買両方」のいずれかに設定してから、もう一度「🏆 成約を報告する」を押してください。",
		"",
		"この時点では案件ステータスも成約報告DBも更新していません。",
	].join("\n");
}

function closingDealTypeFromProjectDealType(dealType: string): string | null {
	if (dealType === "売却案件") return "売却成約";
	if (dealType === "購入希望") return "購入成約";
	if (dealType === "売買両方") return "売買両方";
	return null;
}

function buildClosingSuccessMessage({
	projectName,
	grossProfit,
	commissionAmount,
	commissionNote,
}: {
	projectName: string;
	grossProfit: number;
	commissionAmount: number;
	commissionNote: string;
}): string {
	return [
		`🏆 成約速報: ${projectName}`,
		"",
		"成約報告を登録しました。月次成績と歩合見込へ反映します。",
		`粗利: ${formatYen(grossProfit)}`,
		`歩合見込: ${formatYen(commissionAmount)}`,
		"反映先: 営業マンパフォーマンスDB｜月次成績",
		"",
		"マネージャーは必要に応じて差し戻し/取り消しを行えます。",
		commissionNote,
	].join("\n");
}

function buildClosingFanfareMessage({
	projectName,
	grossProfit,
	commissionAmount,
	syncedDealCount,
	linkedDealCount,
}: {
	projectName: string;
	grossProfit: number;
	commissionAmount: number;
	syncedDealCount: number;
	linkedDealCount: number;
}): string {
	return [
		`🎉 成約ファンファーレ: ${projectName}`,
		"",
		"成約報告 実行結果",
		"案件更新: 成功",
		`商談同期: ${syncedDealCount}件成功 / 関連商談 ${linkedDealCount}件`,
		"成約報告DB: 作成済み",
		"関連案件: 紐付け済み",
		linkedDealCount > 0 ? "関連商談: 紐付け済み" : "関連商談: 対象なし",
		`粗利額: ${formatYen(grossProfit)}`,
		`歩合見込: ${formatYen(commissionAmount)}`,
		"月次成績反映: 後続処理で確認",
		"AIフィードバック: 後続処理で確認",
		"ナレッジ候補: AI処理後に判定",
	].join("\n");
}

function formatYen(value: number): string {
	return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

/**
 * 成約報告を営業マンパフォーマンスDBの今月レコードに自動紐付け
 * → 月次成績ビューのrollup（成約件数・実績粗利額・歩合見込額）が更新される
 */
async function linkClosingToMonthlyPerformanceRecord(
	closingPageId: string,
	salesPersonIds: string[],
	notion: NotionClient,
	now = new Date(),
	closingSummary?: { grossProfit: number; commissionAmount: number },
): Promise<boolean> {
	if (salesPersonIds.length === 0) return false;

	const { monthStart, nextMonthStart, monthLabel } = monthWindowJST(now);
	const salesPersonId = salesPersonIds[0]!;
	const baseFilter = [
		{ property: "期間種別", select: { equals: "月次" } },
		{ property: "対象営業ユーザー", people: { contains: salesPersonId } },
	];
	const monthTextCandidates = uniqueStrings([
		monthLabel,
		monthStart.slice(0, 7),
		`${monthStart.slice(0, 4)}年${Number(monthStart.slice(5, 7))}月`,
		`${monthStart.slice(0, 4)}年${monthStart.slice(5, 7)}月`,
	]);
	const queryCandidates: Array<{ label: string; filter: Record<string, unknown> }> = [
		{
			label: "開始日",
			filter: {
				and: [
					...baseFilter,
					{ property: "開始日", date: { on_or_after: monthStart } },
					{ property: "開始日", date: { before: nextMonthStart } },
				],
			},
		},
		...monthTextCandidates.map((label) => ({
			label: `対象期間:${label}`,
			filter: {
				and: [
					...baseFilter,
					{ property: "対象期間", rich_text: { contains: label } },
				],
			},
		})),
		{
			label: "対象期間-date",
			filter: {
				and: [
					...baseFilter,
					{ property: "対象期間", date: { on_or_after: monthStart } },
					{ property: "対象期間", date: { before: nextMonthStart } },
				],
			},
		},
	];

	let performancePage: Page | undefined;
	for (const candidate of queryCandidates) {
		try {
			const existing = await notion.dataSources.query({
				data_source_id: SALES_PERFORMANCE_DATA_SOURCE_ID,
				filter: candidate.filter,
				page_size: 10,
			});
			performancePage = selectProductionMonthlyPerformancePage((existing.results ?? []) as Page[]);
			if (performancePage) break;
		} catch (error) {
			console.log(`[linkClosing] 月次成績検索をスキップ: ${candidate.label}`, String(error));
		}
	}

	if (!performancePage) {
		performancePage = await createMonthlyPerformanceRecord(
			closingPageId,
			salesPersonId,
			notion,
			now,
		);
		console.log(`[linkClosing] 月次成績レコードを自動作成: ${performancePage.id}`);
	} else {
		console.log(`[linkClosing] 月次成績レコード発見: ${performancePage.id}`);
	}

	// 既存の関連成約に新しいページを追加
	const existingClosingIds = relationIdsFromProperty(performancePage.properties?.["関連成約"]);
	const wasAlreadyLinked = existingClosingIds.includes(closingPageId);
	const newClosingIds = [...new Set([...existingClosingIds, closingPageId])];

	if (!wasAlreadyLinked) {
		await notion.pages.update({
			page_id: performancePage.id,
			properties: {
				関連成約: { relation: newClosingIds.map((id) => ({ id })) },
			},
		});
	}
	if (closingSummary && notion.blocks?.children?.append) {
		await notion.blocks.children.append({
			block_id: closingPageId,
			children: [
				{
					object: "block",
					type: "callout",
					callout: {
						rich_text: [
							{
								type: "text",
								text: {
									content: buildMonthlyAchievementMessage(
										performancePage,
										closingSummary,
										wasAlreadyLinked,
									),
								},
							},
						],
						icon: { emoji: "📊" },
						color: "blue_background",
					},
				},
			],
		});
	}

	console.log(`成約報告を月次成績（営業マンパフォーマンスDB ID: ${performancePage.id}）の「関連成約」に紐付けました`);
	return true;
}

async function createMonthlyPerformanceRecord(
	closingPageId: string,
	salesPersonId: string,
	notion: NotionClient,
	now: Date,
): Promise<Page> {
	const { monthStart, nextMonthStart, monthLabel } = monthWindowJST(now);
	const monthEnd = monthEndFromNextMonthStart(nextMonthStart);
	const monthTitle = monthTitleFromMonthStart(monthStart);
	return notion.pages.create({
		parent: { data_source_id: SALES_PERFORMANCE_DATA_SOURCE_ID },
		properties: {
			評価名: title(`${monthTitle} 月次成績`),
			期間種別: select("月次"),
			対象期間: richText(monthLabel),
			開始日: { date: { start: monthStart } },
			終了日: { date: { start: monthEnd } },
			対象営業ユーザー: { people: [{ id: salesPersonId }] },
			関連成約: { relation: [{ id: closingPageId }] },
			監査区分: select("通常監査"),
			評価ステータス: select("集計中"),
			AI処理状態: select("未処理"),
		},
	});
}

function selectProductionMonthlyPerformancePage(pages: Page[]): Page | undefined {
	return pages.find((page) => {
		const properties = page.properties ?? {};
		const titleText = text(properties["評価名"]);
		return !isAuditOrTestPerformance(properties, titleText);
	});
}

function monthTitleFromMonthStart(monthStart: string): string {
	const [year, month] = monthStart.split("-");
	return `${year}年${Number(month)}月`;
}

function monthEndFromNextMonthStart(nextMonthStart: string): string {
	const [year, month] = nextMonthStart.split("-").map((value) => Number(value));
	return new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
}

function buildMonthlyAchievementMessage(
	performancePage: Page,
	closingSummary: { grossProfit: number; commissionAmount: number },
	wasAlreadyLinked: boolean,
): string {
	const properties = performancePage.properties ?? {};
	const currentGross = numberValue(properties["実績粗利額（自動）"]) ?? 0;
	const targetGross =
		numberValue(properties["粗利目標"]) ??
		numberValue(properties["粗利目標（申請DB）"]) ??
		numberValue(properties["目標粗利額"]) ??
		0;
	const afterGross = wasAlreadyLinked
		? currentGross
		: currentGross + closingSummary.grossProfit;
	const lines = [
		"📊 月次成績反映メモ",
		`今回粗利: ${formatYen(closingSummary.grossProfit)}`,
		`歩合見込加算: ${formatYen(closingSummary.commissionAmount)}`,
		`反映後の粗利見込み: ${formatYen(afterGross)}`,
	];
	if (targetGross > 0) {
		lines.push(
			`今月目標: ${formatYen(targetGross)}`,
			`達成率見込み: ${formatPercent(currentGross / targetGross)} → ${formatPercent(afterGross / targetGross)}`,
		);
	} else {
		lines.push("粗利目標が入ると、ここに今月の達成率見込みを表示できます。");
	}
	lines.push("Notionのrollup反映には少し時間差が出ることがあります。");
	return lines.join("\n");
}

function formatPercent(value: number): string {
	return `${Math.round(value * 100)}%`;
}

export {
	linkClosingToMonthlyPerformanceRecord as linkClosingToMonthlyPerformanceRecordForTest,
	linkClosingToMonthlyPerformanceRecord as linkClosingToPerformanceRecordForTest,
	processClosingReport as processClosingReportForTest,
	processClosingReportRequest as processClosingReportRequestForTest,
};

function monthWindowJST(now: Date): {
	monthStart: string;
	nextMonthStart: string;
	monthLabel: string;
} {
	const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
	const year = jst.getUTCFullYear();
	const month = jst.getUTCMonth() + 1;
	const nextYear = month === 12 ? year + 1 : year;
	const nextMonth = month === 12 ? 1 : month + 1;
	return {
		monthStart: `${year}-${String(month).padStart(2, "0")}-01`,
		nextMonthStart: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
		monthLabel: `${year}/${month}`,
	};
}

/** 成約報告の取り消し
 * 締め前の「成約」はマネージャーが取り消せる。
 * 締め済み/歩合確定済み、または歩合確定額が入っているものは取り消さず、調整レコードで扱う。
 * 取り消し時は月次成績のリレーションも除去して数字を下げる。
 */
async function cancelClosingReport(
	closingPageId: string,
	notion: NotionClient,
	reason = "",
	triggerUserId?: string,
): Promise<{ action: string; message: string }> {
	const closingPage = await notion.pages.retrieve({ page_id: closingPageId });
	const currentStatus = readClosingApprovalStatusText(closingPage.properties);
	const fixedCommission = numberValue(closingPage.properties?.["歩合確定額"]) ?? 0;

	// 既に取り消し済み
	if (currentStatus === "取り消し") {
		return {
			action: "already-cancelled",
			message: "既に取り消し済みです。",
		};
	}

	if (
		currentStatus === "締め済み" ||
		currentStatus === "歩合確定済み" ||
		fixedCommission > 0
	) {
		return {
			action: "blocked",
			message:
				"歩合確定済みまたは締め済みのため取り消しできません。必要な場合は調整レコードで処理してください。",
		};
	}

	// 1. 成約報告を取り消し状態に変更
	const memo = [
		`取り消し日: ${todayDateJST()}`,
		reason ? `理由: ${reason.slice(0, 500)}` : "",
	].filter(Boolean).join("\n");
	await safeUpdateExistingProperties(notion, closingPage, {
		承認ステータス: { kind: "select", value: "取り消し" },
		管理メモ: { kind: "text", value: memo },
		// 正本スタンプ(1-2): 取り消しもWorker経由の事実として上書き記録(列未作成ならスキップ)
		[CLOSING_APPROVAL_STAMP_PROPERTY]: {
			kind: "text",
			value: buildApprovalStamp("取り消し", triggerUserId),
		},
	});

	// 2. 案件DBのステータスを提案中に戻す
	const projectIds = relationIdsFromProperty(closingPage.properties?.["関連案件"]);
	if (projectIds.length > 0) {
		const projectPage = await notion.pages.retrieve({ page_id: projectIds[0]! });
		await safeUpdateExistingProperties(notion, projectPage, {
			ステータス: { kind: "select", value: "📋 提案中" },
			成約日: { kind: "clear" },
			管理アクション状態: { kind: "select", value: "取り消し" },
			管理アクション日: { kind: "date", value: todayDateJST() },
			管理アクションメモ: { kind: "text", value: memo },
			最終アクション日: { kind: "date", value: todayDateJST() },
		});
		await createPageComment(
			notion,
			projectPage.id,
			`🔄 成約報告が取り消されました。\n${memo}`,
		);
	}

	// 3. 月次成績のリレーションから除去（rollupの数字を即時減算）
	await removeLinkFromMonthlyPerformanceRecords(closingPageId, notion).catch((err) => {
		console.error("removeLinkFromMonthlyPerformanceRecords error:", String(err));
	});

	return {
		action: "cancelled",
		message: "成約報告を取り消しました。案件を「📋 提案中」に戻し、成績からも除外しました。",
	};
}

/**
 * 営業マンパフォーマンスDBの月次成績から成約報告のリレーションを除去する
 * 成約取り消し時に呼び出し、rollupの数字（成約件数・粗利額・歩合）を自動減算させる
 */
async function removeLinkFromMonthlyPerformanceRecords(
	closingPageId: string,
	notion: NotionClient,
): Promise<void> {
	const existing = await notion.dataSources.query({
		data_source_id: SALES_PERFORMANCE_DATA_SOURCE_ID,
		filter: {
			property: "関連成約",
			relation: { contains: closingPageId },
		},
		page_size: 5,
	});

	const pages = (existing.results ?? []) as Page[];
	if (pages.length === 0) {
		console.log(`月次成績に紐付けレコードが見つかりませんでした（成約ID: ${closingPageId}）`);
		return;
	}

	for (const page of pages) {
		const currentIds = relationIdsFromProperty(page.properties?.["関連成約"]);
		const newIds = currentIds.filter((id) => id !== closingPageId);
		await notion.pages.update({
			page_id: page.id,
			properties: {
				関連成約: { relation: newIds.map((id) => ({ id })) },
			},
		});
		console.log(`成約ID ${closingPageId} を月次成績（営業マンパフォーマンスDB ${page.id}）の関連成約から除去しました`);
	}
}

export { cancelClosingReport as cancelClosingReportForTest };
export { dismissClosingReport as dismissClosingReportForTest };

/** マネージャーによる成約報告の差し戻し */
async function dismissClosingReport(
	closingPageId: string,
	notion: NotionClient,
	reason = "",
	triggerUserId?: string,
): Promise<{ action: string; message: string }> {
	const closingPage = await notion.pages.retrieve({ page_id: closingPageId });
	const memo = [
		`差し戻し日: ${todayDateJST()}`,
		reason ? `理由: ${reason.slice(0, 500)}` : "",
	].filter(Boolean).join("\n");

	await safeUpdateExistingProperties(notion, closingPage, {
		承認ステータス: { kind: "select", value: "差戻し" },
		管理メモ: { kind: "text", value: memo },
		// 正本スタンプ(1-2): マネージャーゲート(1-1)を通った差し戻しだけがここに到達する
		[CLOSING_APPROVAL_STAMP_PROPERTY]: {
			kind: "text",
			value: buildApprovalStamp("差戻し", triggerUserId),
		},
	});

	// 案件DBのステータスを提案中に戻す
	const projectIds = relationIdsFromProperty(closingPage.properties?.["関連案件"]);
	if (projectIds.length > 0) {
		const projectPage = await notion.pages.retrieve({ page_id: projectIds[0]! });
		await safeUpdateExistingProperties(notion, projectPage, {
			ステータス: { kind: "select", value: "📋 提案中" },
			成約日: { kind: "clear" },
			管理アクション状態: { kind: "select", value: "差し戻し" },
			管理アクション日: { kind: "date", value: todayDateJST() },
			管理アクションメモ: { kind: "text", value: memo },
			最終アクション日: { kind: "date", value: todayDateJST() },
		});
		await createPageComment(
			notion,
			projectPage.id,
			`↩️ 成約報告が差し戻されました。\n${memo}`,
		);
	}

	await removeLinkFromMonthlyPerformanceRecords(closingPageId, notion).catch((err) => {
		console.error("removeLinkFromMonthlyPerformanceRecords error:", String(err));
	});

	return {
		action: "dismissed",
		message:
			"成約報告を差し戻しました。案件のステータスを「📋 提案中」に戻しました。担当営業に内容の確認を促してください。",
	};
}

async function dismissProject(
	projectPageId: string,
	notion: NotionClient,
	reason = "",
): Promise<{ action: string; message: string }> {
	const projectPage = await notion.pages.retrieve({ page_id: projectPageId });
	const projectName = text(projectPage.properties?.["案件名"]) || "案件";
	const memo = [
		`${todayDateJST()} マネージャー差し戻し`,
		reason ? `理由: ${reason.slice(0, 500)}` : "理由: 条件・権利関係・担当/共有範囲の再確認が必要",
	].join("\n");

	await safeUpdateExistingProperties(notion, projectPage, {
		ステータス: { kind: "select", value: "⏳ 確認待ち" },
		確認待ち内容: { kind: "text", value: memo },
		管理アクション状態: { kind: "select", value: "差し戻し" },
		管理アクション日: { kind: "date", value: todayDateJST() },
		管理アクションメモ: { kind: "text", value: memo },
		最終アクション日: { kind: "date", value: todayDateJST() },
	});
	await createPageComment(notion, projectPage.id, `↩️ 案件「${projectName}」を差し戻しました。\n${memo}`);

	return {
		action: "dismissed",
		message: `案件「${projectName}」を確認待ちへ差し戻しました。`,
	};
}

async function cancelProject(
	projectPageId: string,
	notion: NotionClient,
	reason = "",
): Promise<{ action: string; message: string }> {
	const projectPage = await notion.pages.retrieve({ page_id: projectPageId });
	const projectName = text(projectPage.properties?.["案件名"]) || "案件";
	const memo = [
		`${todayDateJST()} マネージャー取り消し`,
		reason ? `理由: ${reason.slice(0, 500)}` : "理由: 優先度低下／見送り",
	].join("\n");

	await safeUpdateExistingProperties(notion, projectPage, {
		ステータス: { kind: "select", value: "❌ 失注" },
		成約日: { kind: "clear" },
		失注理由: { kind: "multi_select", values: ["優先度低下／見送り"] },
		確認待ち内容: { kind: "text", value: memo },
		管理アクション状態: { kind: "select", value: "取り消し" },
		管理アクション日: { kind: "date", value: todayDateJST() },
		管理アクションメモ: { kind: "text", value: memo },
		最終アクション日: { kind: "date", value: todayDateJST() },
	});
	await createPageComment(notion, projectPage.id, `🔄 案件「${projectName}」を取り消しました。\n${memo}`);

	return {
		action: "cancelled",
		message: `案件「${projectName}」を失注扱いで取り消しました。`,
	};
}

type LostActionOptions = {
	reason?: string;
	memo?: string;
	triggerUserId?: string;
	skipManagerGate?: boolean;
};

function normalizeLostReasons(reason: string | undefined): string[] {
	return uniqueStrings(
		(reason ?? "")
			.split(/[,\n、，]/)
			.map((value) => value.trim())
			.filter(Boolean),
	);
}

function lostReasonText(reasons: string[]): string {
	return reasons.join("、");
}

function buildLostAuditMemo({
	actionLabel,
	reasons,
	memo,
	previousPhase,
}: {
	actionLabel: string;
	reasons: string[];
	memo?: string;
	previousPhase: string;
}): string {
	return [
		`${todayDateJST()} ${actionLabel}`,
		`失注理由: ${lostReasonText(reasons)}`,
		previousPhase ? `失注前フェーズ: ${previousPhase}` : "",
		memo ? `メモ: ${memo.slice(0, 500)}` : "",
	].filter(Boolean).join("\n");
}

async function blockNonManagerLostAction(
	notion: NotionClient,
	pageId: string,
	options: LostActionOptions,
	actionLabel: string,
): Promise<{ action: "blocked"; message: string } | null> {
	if (options.skipManagerGate || isManagerUser(options.triggerUserId)) return null;
	const message = `${actionLabel}はマネージャー専用です。MANAGER_USER_IDS に登録されたユーザーで実行してください。`;
	await createPageComment(notion, pageId, `⛔ ${message}`);
	return { action: "blocked", message };
}

function projectLostPreviousPhase(projectPage: Page): string {
	return (
		text(projectPage.properties?.["ステータス"]) ||
		text(projectPage.properties?.["推奨フェーズ（活動ログ）"]) ||
		"未設定"
	);
}

function inquiryLostPreviousPhase(inquiryPage: Page): string {
	return (
		text(inquiryPage.properties?.["ステータス"]) ||
		text(inquiryPage.properties?.["問い合わせフェーズ（推奨）"]) ||
		"未設定"
	);
}

async function processInquiryLost(
	inquiryPageId: string,
	notion: NotionClient,
	options: LostActionOptions = {},
): Promise<{ action: string; message: string }> {
	const inquiryPage = await notion.pages.retrieve({ page_id: inquiryPageId });
	const inquiryTitle = readGenericPageTitle(inquiryPage) || "問い合わせ";
	const reasons = normalizeLostReasons(options.reason);
	if (reasons.length === 0) {
		await createPageComment(
			notion,
			inquiryPage.id,
			"⚠️ 失注理由が未入力のため、問い合わせを失注にしていません。失注理由を選んでからもう一度実行してください。",
		);
		return {
			action: "needs-lost-reason",
			message: "失注理由が未入力のため、問い合わせステータスは変更していません。",
		};
	}

	const previousPhase = inquiryLostPreviousPhase(inquiryPage);
	const memo = buildLostAuditMemo({
		actionLabel: "問い合わせ失注",
		reasons,
		memo: options.memo,
		previousPhase,
	});
	const patches: Record<string, SafePatch> = {
		ステータス: { kind: "select", value: "失注" },
		失注理由: { kind: "multi_select", values: reasons },
		失注理由メモ: { kind: "text", value: options.memo || lostReasonText(reasons) },
		失注日: { kind: "date", value: todayDateJST() },
		失注前フェーズ: { kind: "text", value: previousPhase },
		失注ログ: { kind: "text", value: memo },
		最終アクション日: { kind: "date", value: todayDateJST() },
	};
	if (options.triggerUserId) {
		patches["失注処理者"] = { kind: "people", ids: [options.triggerUserId] };
	}
	await safeUpdateExistingProperties(notion, inquiryPage, patches);
	await notifySalesTeam(
		notion,
		inquiryPage.id,
		[
			`📉 問い合わせを失注にしました: ${inquiryTitle}`,
			`理由: ${lostReasonText(reasons)}`,
			options.memo ? `メモ: ${options.memo}` : "",
			"問い合わせ段階の軽量監査ログとして記録しました。",
		].filter(Boolean).join("\n"),
	);
	return {
		action: "lost",
		message: "問い合わせを失注にし、理由・処理者・処理日・監査ログを残しました。",
	};
}

async function processProjectLostRequest(
	projectPageId: string,
	notion: NotionClient,
	options: LostActionOptions = {},
): Promise<{ action: string; message: string }> {
	const projectPage = await notion.pages.retrieve({ page_id: projectPageId });
	const projectName = text(projectPage.properties?.["案件名"]) || "案件";
	const reasons = normalizeLostReasons(options.reason);
	if (reasons.length === 0) {
		await createPageComment(
			notion,
			projectPage.id,
			"⚠️ 失注理由が未入力のため、失注申請を出していません。失注理由を選んでからもう一度実行してください。",
		);
		return {
			action: "needs-lost-reason",
			message: "失注理由が未入力のため、案件ステータスは変更していません。",
		};
	}

	const previousPhase = projectLostPreviousPhase(projectPage);
	const memo = buildLostAuditMemo({
		actionLabel: "案件失注申請",
		reasons,
		memo: options.memo,
		previousPhase,
	});
	const patches: Record<string, SafePatch> = {
		ステータス: { kind: "select", value: "失注申請中" },
		失注理由: { kind: "multi_select", values: reasons },
		失注理由メモ: { kind: "text", value: options.memo || lostReasonText(reasons) },
		失注前フェーズ: { kind: "text", value: previousPhase },
		失注申請状態: { kind: "select", value: "申請中" },
		失注申請メモ: { kind: "text", value: memo },
		管理アクション状態: { kind: "select", value: "失注申請中" },
		管理アクション日: { kind: "date", value: todayDateJST() },
		管理アクションメモ: { kind: "text", value: memo },
		最終アクション日: { kind: "date", value: todayDateJST() },
	};
	if (options.triggerUserId) {
		patches["失注処理者"] = { kind: "people", ids: [options.triggerUserId] };
	}
	await safeUpdateExistingProperties(notion, projectPage, patches);
	await notifySalesTeam(
		notion,
		projectPage.id,
		[
			`📨 失注申請が出ました: ${projectName}`,
			`理由: ${lostReasonText(reasons)}`,
			options.memo ? `メモ: ${options.memo}` : "",
			"この時点では正式な失注ではありません。マネージャー承認後に `❌ 失注` へ確定します。",
		].filter(Boolean).join("\n"),
	);
	return {
		action: "requested",
		message: "案件を失注申請中にし、マネージャー承認待ちとして記録しました。",
	};
}

async function approveProjectLostRequest(
	projectPageId: string,
	notion: NotionClient,
	options: LostActionOptions = {},
): Promise<{ action: string; message: string }> {
	const projectPage = await notion.pages.retrieve({ page_id: projectPageId });
	const managerBlock = await blockNonManagerLostAction(
		notion,
		projectPage.id,
		options,
		"失注承認",
	);
	if (managerBlock) return managerBlock;
	const projectName = text(projectPage.properties?.["案件名"]) || "案件";
	const currentStatus = text(projectPage.properties?.["失注申請状態"]);
	if (currentStatus && currentStatus !== "申請中") {
		return {
			action: "blocked",
			message: `失注申請状態が「${currentStatus}」のため、承認処理は行いませんでした。`,
		};
	}
	const reasons = normalizeLostReasons(text(projectPage.properties?.["失注理由"]));
	const previousPhase =
		text(projectPage.properties?.["失注前フェーズ"]) || projectLostPreviousPhase(projectPage);
	const memo = [
		buildLostAuditMemo({
			actionLabel: "案件失注承認",
			reasons: reasons.length > 0 ? reasons : ["未設定"],
			memo: options.memo,
			previousPhase,
		}),
	].join("\n");
	const patches: Record<string, SafePatch> = {
		ステータス: { kind: "select", value: "❌ 失注" },
		成約日: { kind: "clear" },
		失注申請状態: { kind: "select", value: "承認済" },
		失注日: { kind: "date", value: todayDateJST() },
		管理アクション状態: { kind: "select", value: "失注承認" },
		管理アクション日: { kind: "date", value: todayDateJST() },
		管理アクションメモ: { kind: "text", value: memo },
		最終アクション日: { kind: "date", value: todayDateJST() },
	};
	if (options.triggerUserId) {
		patches["失注処理者"] = { kind: "people", ids: [options.triggerUserId] };
	}
	await safeUpdateExistingProperties(notion, projectPage, patches);
	await notifySalesTeam(
		notion,
		projectPage.id,
		[
			`📉 失注が承認されました: ${projectName}`,
			reasons.length > 0 ? `理由: ${lostReasonText(reasons)}` : "",
			options.memo ? `マネージャーメモ: ${options.memo}` : "",
			"ステータスを `失注申請中` から `❌ 失注` へ確定しました。",
		].filter(Boolean).join("\n"),
	);
	return {
		action: "approved",
		message: "案件の失注申請を承認し、正式に失注へ確定しました。",
	};
}

async function rejectProjectLostRequest(
	projectPageId: string,
	notion: NotionClient,
	options: LostActionOptions = {},
): Promise<{ action: string; message: string }> {
	const projectPage = await notion.pages.retrieve({ page_id: projectPageId });
	const managerBlock = await blockNonManagerLostAction(
		notion,
		projectPage.id,
		options,
		"失注差し戻し",
	);
	if (managerBlock) return managerBlock;
	const projectName = text(projectPage.properties?.["案件名"]) || "案件";
	const memo = [
		`${todayDateJST()} 案件失注申請差し戻し`,
		options.memo ? `理由: ${options.memo.slice(0, 500)}` : "理由: マネージャー確認により再対応が必要",
	].join("\n");
	const patches: Record<string, SafePatch> = {
		ステータス: { kind: "select", value: "⏳ 確認待ち" },
		失注申請状態: { kind: "select", value: "差し戻し" },
		失注申請メモ: { kind: "text", value: memo },
		管理アクション状態: { kind: "select", value: "失注差し戻し" },
		管理アクション日: { kind: "date", value: todayDateJST() },
		管理アクションメモ: { kind: "text", value: memo },
		最終アクション日: { kind: "date", value: todayDateJST() },
	};
	await safeUpdateExistingProperties(notion, projectPage, patches);
	await notifySalesTeam(
		notion,
		projectPage.id,
		[
			`↩️ 失注申請が差し戻されました: ${projectName}`,
			options.memo ? `マネージャーメモ: ${options.memo}` : "",
			"案件は `⏳ 確認待ち` に戻しました。担当者は次アクションを確認してください。",
		].filter(Boolean).join("\n"),
	);
	return {
		action: "rejected",
		message: "案件の失注申請を差し戻し、確認待ちへ戻しました。",
	};
}

async function dismissConfirmedProjectLost(
	projectPageId: string,
	notion: NotionClient,
	options: LostActionOptions = {},
): Promise<{ action: string; message: string }> {
	const projectPage = await notion.pages.retrieve({ page_id: projectPageId });
	const managerBlock = await blockNonManagerLostAction(
		notion,
		projectPage.id,
		options,
		"失注済み差し戻し",
	);
	if (managerBlock) return managerBlock;
	const projectName = text(projectPage.properties?.["案件名"]) || "案件";
	const memo = [
		`${todayDateJST()} 失注確定後差し戻し`,
		options.memo ? `理由: ${options.memo.slice(0, 500)}` : "理由: マネージャー確認により再対応が必要",
	].join("\n");
	const patches: Record<string, SafePatch> = {
		ステータス: { kind: "select", value: "⏳ 確認待ち" },
		失注申請状態: { kind: "select", value: "差し戻し" },
		失注申請メモ: { kind: "text", value: memo },
		管理アクション状態: { kind: "select", value: "失注差し戻し" },
		管理アクション日: { kind: "date", value: todayDateJST() },
		管理アクションメモ: { kind: "text", value: memo },
		最終アクション日: { kind: "date", value: todayDateJST() },
	};
	await safeUpdateExistingProperties(notion, projectPage, patches);
	await notifySalesTeam(
		notion,
		projectPage.id,
		[
			`↩️ 失注済み案件を差し戻しました: ${projectName}`,
			options.memo ? `マネージャーメモ: ${options.memo}` : "",
			"案件は `⏳ 確認待ち` に戻しました。担当者は次アクションを確認してください。",
		].filter(Boolean).join("\n"),
	);
	return {
		action: "lost-dismissed",
		message: "失注済み案件を差し戻し、確認待ちへ戻しました。",
	};
}

async function cancelConfirmedProjectLost(
	projectPageId: string,
	notion: NotionClient,
	options: LostActionOptions = {},
): Promise<{ action: string; message: string }> {
	const projectPage = await notion.pages.retrieve({ page_id: projectPageId });
	const managerBlock = await blockNonManagerLostAction(
		notion,
		projectPage.id,
		options,
		"失注取消",
	);
	if (managerBlock) return managerBlock;
	const projectName = text(projectPage.properties?.["案件名"]) || "案件";
	const previousPhase = text(projectPage.properties?.["失注前フェーズ"]) || "📋 提案中";
	const memo = [
		`${todayDateJST()} 失注取消`,
		options.memo ? `理由: ${options.memo.slice(0, 500)}` : "理由: マネージャー確認により失注判定を取り消し",
		`戻し先フェーズ: ${previousPhase}`,
	].join("\n");
	const patches: Record<string, SafePatch> = {
		ステータス: { kind: "select", value: previousPhase },
		失注申請状態: { kind: "select", value: "取り消し" },
		失注申請メモ: { kind: "text", value: memo },
		失注日: { kind: "clear" },
		管理アクション状態: { kind: "select", value: "失注取り消し" },
		管理アクション日: { kind: "date", value: todayDateJST() },
		管理アクションメモ: { kind: "text", value: memo },
		最終アクション日: { kind: "date", value: todayDateJST() },
	};
	await safeUpdateExistingProperties(notion, projectPage, patches);
	await notifySalesTeam(
		notion,
		projectPage.id,
		[
			`🔄 失注を取り消しました: ${projectName}`,
			`戻し先: ${previousPhase}`,
			options.memo ? `マネージャーメモ: ${options.memo}` : "",
		].filter(Boolean).join("\n"),
	);
	return {
		action: "lost-cancelled",
		message: "失注を取り消し、案件を失注前フェーズへ戻しました。",
	};
}

export {
	approveProjectLostRequest as approveProjectLostRequestForTest,
	cancelConfirmedProjectLost as cancelConfirmedProjectLostForTest,
	cancelProject as cancelProjectForTest,
	dismissConfirmedProjectLost as dismissConfirmedProjectLostForTest,
	dismissProject as dismissProjectForTest,
	processInquiryLost as processInquiryLostForTest,
	processProjectLostRequest as processProjectLostRequestForTest,
	rejectProjectLostRequest as rejectProjectLostRequestForTest,
};

/**
 * 成約 AI フィードバック生成
 * 案件ページの情報から勝因・反省点・次に活かす学びをOpenAIで生成し、成約報告DBに書き込む
 */
async function generateClosingFeedback(
	projectPage: Page,
	closingPageId: string,
	notion: NotionClient,
): Promise<void> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		console.error("OPENAI_API_KEY が未設定のため、AIフィードバックをスキップします");
		return;
	}
	const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

	const projectName = text(projectPage.properties?.["案件名"]) || "案件";
	const targetType = text(projectPage.properties?.["対象物種別"]) || "不明";
	const dealType = text(projectPage.properties?.["売買区分"]) || "不明";
	const grossProfit =
		numberValue(projectPage.properties?.["実績粗利額"]) ??
		numberValue(projectPage.properties?.["予定粗利額"]);
	const projectDetail = text(projectPage.properties?.["案件詳細"]) || "";
	const confirmedContent = text(projectPage.properties?.["確認待ち内容"]) || "";

	const grossProfitText = grossProfit
		? `${(grossProfit / 10000).toFixed(0)}万円`
		: "未入力";

	const payload = [
		`【案件名】${projectName}`,
		`【対象物種別】${targetType}`,
		`【売買区分】${dealType}`,
		`【粗利額】${grossProfitText}`,
		projectDetail ? `【案件詳細】\n${projectDetail.slice(0, 800)}` : "",
		confirmedContent ? `【確認待ち内容】\n${confirmedContent.slice(0, 400)}` : "",
	].filter(Boolean).join("\n\n");

	const systemPrompt = `あなたは再生可能エネルギー（太陽光発電所・系統用蓄電池・土地）の売買仲介会社の営業コーチです。
成約した案件の情報を読んで、以下の内容を日本語で分析してください。

必ずJSONのみで返答してください（前後に説明文を付けない）：
{
  "勝因": "成約できた主な要因（1〜3文）",
  "反省点": "改善できた点・反省点（1〜3文）",
  "次に活かす学び": "次の案件に活かせる具体的な学び（1〜3文）",
  "ナレッジ化候補": "候補" または "不要",
  "ナレッジ化メモ": "ナレッジ化すべき理由（50文字以内、不要なら空文字）"
}

ナレッジ化候補「候補」の基準：珍しいケース、大型案件（粗利1億円以上）、新しい手法、他の営業マンが学べる特別な経緯がある場合。
情報が不足している場合は推測で簡潔に記載してください。`;

	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			temperature: 0,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: payload },
			],
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Open公式調査くんPI error ${response.status}: ${errorText.slice(0, 200)}`);
	}

	const json = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const raw = json.choices?.[0]?.message?.content;
	if (!raw) throw new Error("OpenAI からレスポンスが返りませんでした");

	let feedback: ClosingFeedbackAIResponse;
	try {
		const jsonStart = raw.indexOf("{");
		const jsonEnd = raw.lastIndexOf("}");
		const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart ? raw.slice(jsonStart, jsonEnd + 1) : raw;
		feedback = JSON.parse(jsonStr) as ClosingFeedbackAIResponse;
	} catch {
		console.error("AIフィードバック JSONパース失敗:", raw.slice(0, 200));
		const closingPageForError = await notion.pages.retrieve({ page_id: closingPageId });
		await safeUpdateExistingProperties(notion, closingPageForError, {
			AI処理状態: { kind: "select", value: "要確認" },
			管理メモ: { kind: "text", value: `AIフィードバック生成失敗（JSONパースエラー）` },
		});
		return;
	}

	const closingPage = await notion.pages.retrieve({ page_id: closingPageId });
	const patches: Record<string, SafePatch> = {
		勝因: { kind: "text", value: feedback.勝因 || "" },
		反省点: { kind: "text", value: feedback.反省点 || "" },
		次に活かす学び: { kind: "text", value: feedback.次に活かす学び || "" },
		AI処理状態: { kind: "select", value: "処理済" },
	};
	if (feedback.ナレッジ化候補 === "候補") {
		patches["ナレッジ化候補"] = { kind: "select", value: "候補" };
		if (feedback.ナレッジ化メモ) {
			patches["ナレッジ化メモ"] = { kind: "text", value: feedback.ナレッジ化メモ };
		}
	}
	await safeUpdateExistingProperties(notion, closingPage, patches);
}

// ─── 人見さんと壁打ちをする ──────────────────────────────────────────────────

interface ProjectWallHitAIResponse {
	summary: string;
	talkingPoints: string[];
	risks: string[];
	confirmationItems: string[];
	recommendedAction: string;
}

/**
 * 案件の壁打ちメモを AI で生成し、案件ページにコメントとして書き込む
 * ステータス変更・成約判断・最終評価は行わない
 */
async function processProjectWallHit(
	projectPageId: string,
	notion: NotionClient,
): Promise<{ action: string; message: string }> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		console.error("OPENAI_API_KEY が未設定のため、壁打ちメモ生成をスキップします");
		return { action: "skipped", message: "OPENAI_API_KEY が未設定のためスキップしました" };
	}
	const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

	// 1. 案件ページ取得
	const projectPage = await notion.pages.retrieve({ page_id: projectPageId });
	const projectName = text(projectPage.properties?.["案件名"]) || "案件";
	const targetType = text(projectPage.properties?.["対象物種別"]) || "未設定";
	const dealType = text(projectPage.properties?.["売買区分"]) || "未設定";
	const status = text(projectPage.properties?.["ステータス"]) || "未設定";
	const grossProfit =
		numberValue(projectPage.properties?.["実績粗利額"]) ??
		numberValue(projectPage.properties?.["予定粗利額"]);
	const projectDetail = text(projectPage.properties?.["案件詳細"]) || "";
	const confirmedContent = text(projectPage.properties?.["確認待ち内容"]) || "";

	const grossProfitText = grossProfit
		? `${(grossProfit / 10000).toFixed(0)}万円`
		: "未入力";

	// 2. ページ本文も読み込む
	const blockText = await fetchPageBlockPlainText(notion, projectPageId);

	const payload = [
		`【案件名】${projectName}`,
		`【対象物種別】${targetType}`,
		`【売買区分】${dealType}`,
		`【現在のステータス】${status}`,
		`【粗利額（見込）】${grossProfitText}`,
		projectDetail ? `【案件詳細】\n${projectDetail.slice(0, 600)}` : "",
		confirmedContent ? `【確認待ち内容】\n${confirmedContent.slice(0, 400)}` : "",
		blockText ? `【ページ本文】\n${blockText.slice(0, 1000)}` : "",
	]
		.filter(Boolean)
		.join("\n\n");

	const systemPrompt = `あなたは再生可能エネルギー（太陽光発電所・系統用蓄電池・土地）の売買仲介会社のマネージャーアシスタントです。
営業担当から「人見さん（マネージャー）と壁打ちしたい」というリクエストが届きました。
この案件情報をもとに、マネージャーとの壁打ちを有意義にするための準備メモを作成してください。

必ずJSONのみで返答してください（前後に説明文を付けない）：
{
  "summary": "案件の現状サマリー（2〜3文）",
  "talkingPoints": ["壁打ちで話すべきポイント1", "ポイント2", ...（3〜5項目）"],
  "risks": ["リスク・懸念点1", "リスク2", ...（2〜4項目）"],
  "confirmationItems": ["マネージャーに確認したいこと1", "確認事項2", ...（2〜4項目）"],
  "recommendedAction": "推奨する次のアクション（1〜2文）"
}

重要なルール：
- 成約判断・最終評価・ステータス変更の提案はしない
- マネージャーへの質問を具体的かつ実務的に書く
- 情報が不足している場合は「情報不足のため確認が必要」と明記する`;

	// 3. Open公式調査くんPI 呼び出し
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			temperature: 0,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: payload },
			],
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Open公式調査くんPI error ${response.status}: ${errorText.slice(0, 200)}`);
	}

	const json = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const raw = json.choices?.[0]?.message?.content;
	if (!raw) throw new Error("OpenAI からレスポンスが返りませんでした");

	// 4. JSON パース
	let wallHit: ProjectWallHitAIResponse;
	try {
		const jsonStart = raw.indexOf("{");
		const jsonEnd = raw.lastIndexOf("}");
		const jsonStr =
			jsonStart >= 0 && jsonEnd > jsonStart ? raw.slice(jsonStart, jsonEnd + 1) : raw;
		wallHit = JSON.parse(jsonStr) as ProjectWallHitAIResponse;
	} catch {
		console.error("壁打ちメモ JSONパース失敗:", raw.slice(0, 200));
		return { action: "error", message: "AIレスポンスのパースに失敗しました" };
	}

	// 5. 案件ページにブロックとして追記（ステータス変更・確定は一切しない）
	const today = new Date().toLocaleDateString("ja-JP", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

	if (!notion.blocks?.children?.append) {
		console.error("blocks.children.append が利用できないため壁打ちメモを書き込めませんでした");
		return { action: "error", message: "blocks API が利用できません" };
	}

	const bulletItems = (items: string[]) =>
		items.map((item) => ({
			object: "block",
			type: "bulleted_list_item",
			bulleted_list_item: {
				rich_text: [{ type: "text", text: { content: item } }],
			},
		}));

	await notion.blocks.children.append({
		block_id: projectPageId,
		children: [
			{
				object: "block",
				type: "callout",
				callout: {
					rich_text: [
						{
							type: "text",
							text: { content: `🤝 壁打ちメモ（${today} AI生成）` },
						},
					],
					icon: { emoji: "🤝" },
					color: "blue_background",
				},
			},
			headingBlock("📋 案件サマリー", 3),
			paragraphBlock(wallHit.summary ?? ""),
			headingBlock("💬 壁打ちポイント", 3),
			...bulletItems(wallHit.talkingPoints ?? []),
			headingBlock("⚠️ リスク・懸念点", 3),
			...bulletItems(wallHit.risks ?? []),
			headingBlock("❓ マネージャーへの確認事項", 3),
			...bulletItems(wallHit.confirmationItems ?? []),
			{
				object: "block",
				type: "callout",
				callout: {
					rich_text: [
						{
							type: "text",
							text: {
								content: `➡️ 推奨アクション\n${wallHit.recommendedAction ?? ""}`,
							},
						},
					],
					icon: { emoji: "➡️" },
					color: "green_background",
				},
			},
		],
	});

	console.log(`壁打ちメモを案件ページ「${projectName}」に書き込みました`);
	return {
		action: "created",
		message: `壁打ちメモを案件ページ「${projectName}」に書き込みました。`,
	};
}

// ノルマ申請書への成約自動紐付け（linkUnclaimedClosingsToQuota）は、退役webhook
// processMonthlyQuotaLinkWebhook の削除（2026-06-12）に伴い呼び出し元ゼロとなったため削除した。

// ────────────────────────────────────────────────────────────────────────────
// マルチエージェント基盤（F1：最小通電）
// 設計図正本: 20_Project/マルチエージェント基盤/_F1_最小通電設計.md
// 発火Webhook: processMultiAgentCommanderRunWebhook
// ────────────────────────────────────────────────────────────────────────────

const MULTI_AGENT_COMMANDER_SYSTEM_PROMPT = `あなたは石橋大右（和上ホールディングス代表）のマルチエージェント基盤の「Commander（司令塔）」です。

最大責務は、本来のプロジェクトの意味（Project Why）を見失わないこと。

毎回の応答で以下を確認：
1. この判断は Project Why に沿っているか
2. 小タスクの達成が目的化していないか
3. 目の前の問題解決が、本来の勝ち筋を壊していないか
4. 石橋大右さんの判断軸に反していないか
5. 進めるべきか、立ち止まるべきか

応答には必ず以下を含める：
- 今回の判断
- その理由
- Project Why との整合
- 次の一手

応答は日本語。お伺い締め（「次に進めるならGOくれたら」式）禁止。`;

async function callMultiAgentCommanderClaude(input: {
	system: string;
	user: string;
	maxTokens: number;
	agent?: "claude" | "codex";
}): Promise<string> {
	// CLI ブリッジ経路：WAJO_CLI_BRIDGE_URL と WAJO_CLI_BRIDGE_TOKEN が設定されていれば
	// Mac 上の `claude -p` / `codex exec` を tunnel 経由で呼ぶ
	// （MAX/Pro サブスクで動く・API課金ゼロ）
	const bridgeUrl = (process.env.WAJO_CLI_BRIDGE_URL || "").trim();
	const bridgeToken = (process.env.WAJO_CLI_BRIDGE_TOKEN || "").trim();
	if (bridgeUrl && bridgeToken) {
		const defaultAgent =
			(process.env.WAJO_MULTI_AGENT_BRIDGE_DEFAULT_AGENT || "")
				.toLowerCase()
				.trim() === "codex"
				? "codex"
				: "claude";
		const agent = input.agent ?? defaultAgent;
		const combinedPrompt = `${input.system}\n\n---\n\n${input.user}`;
		const bridgeRes = await fetch(`${bridgeUrl}/run`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${bridgeToken}`,
			},
			body: JSON.stringify({
				agent,
				prompt: combinedPrompt,
				timeout: 240000,
			}),
		});
		if (!bridgeRes.ok) {
			const errorText = await bridgeRes.text();
			throw new Error(
				`CLI Bridge ${bridgeRes.status}: ${errorText.slice(0, 200)}`,
			);
		}
		const bridgeData = (await bridgeRes.json()) as {
			stdout?: string;
			stderr?: string;
			exitCode?: number;
		};
		if (bridgeData.exitCode !== 0) {
			throw new Error(
				`CLI ${agent} exit ${bridgeData.exitCode}: ${(bridgeData.stderr || "").slice(0, 300)}`,
			);
		}
		const stdout = (bridgeData.stdout || "").trim();
		if (!stdout) {
			throw new Error(`CLI ${agent} から空応答が返りました`);
		}
		return stdout;
	}

	// 既存フォールバック：Anthropic API 直叩き（ブリッジ未設定時）
	const apiKey = (
		process.env.WAJO_ANTHROPIC_API_KEY ||
		process.env.ANTHROPIC_API_KEY ||
		""
	).trim();
	const model = (
		process.env.WAJO_MULTI_AGENT_COMMANDER_MODEL ||
		process.env.COMMANDER_MODEL ||
		"claude-opus-4-7"
	).trim();
	if (!apiKey) {
		throw new Error(
			"WAJO_ANTHROPIC_API_KEY / ANTHROPIC_API_KEY が未設定（CLI Bridge も未設定）",
		);
	}

	const response = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model,
			max_tokens: input.maxTokens,
			system: input.system,
			messages: [{ role: "user", content: input.user }],
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Anthropic API error ${response.status}: ${errorText.slice(0, 200)}`,
		);
	}

	const json = (await response.json()) as {
		content?: Array<{ type?: string; text?: string }>;
	};
	const raw =
		json.content?.find((part) => typeof part?.text === "string")?.text ??
		json.content?.[0]?.text;
	if (!raw) throw new Error("Anthropic からレスポンスが返りませんでした");
	return raw;
}

function extractMultiAgentPlainText(prop: unknown): string {
	if (!prop || typeof prop !== "object") return "";
	const p = prop as Record<string, unknown>;
	if (p.type === "title") {
		const arr = Array.isArray(p.title) ? (p.title as Array<Record<string, unknown>>) : [];
		return arr.map((t) => (typeof t?.plain_text === "string" ? t.plain_text : "")).join("");
	}
	if (p.type === "rich_text") {
		const arr = Array.isArray(p.rich_text)
			? (p.rich_text as Array<Record<string, unknown>>)
			: [];
		return arr.map((t) => (typeof t?.plain_text === "string" ? t.plain_text : "")).join("");
	}
	if (p.type === "select") {
		const sel = p.select as Record<string, unknown> | null | undefined;
		return typeof sel?.name === "string" ? sel.name : "";
	}
	return "";
}

const MULTI_AGENT_TASKS_DATA_SOURCE_ID =
	process.env.WAJO_MULTI_AGENT_TASKS_DATA_SOURCE_ID ||
	"9d14741a-d630-4658-932d-7d842f943901";

const MULTI_AGENT_DISCUSSIONS_DATA_SOURCE_ID =
	process.env.WAJO_MULTI_AGENT_DISCUSSIONS_DATA_SOURCE_ID ||
	"fbbc1257-3144-4725-8338-f376dac4f934";

async function recordMultiAgentDiscussionEntry(
	notion: NotionClient,
	params: {
		missionPageId: string;
		taskPageId?: string | null;
		speaker: "Commander" | "AgentA" | "AgentB";
		content: string;
		turn: number;
	},
): Promise<void> {
	try {
		const now = new Date();
		const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
		const timePart = now
			.toISOString()
			.slice(11, 19)
			.replace(/:/g, "");
		const discussionId = `D-${datePart}-${timePart}-${params.speaker}`;

		const properties: Record<string, unknown> = {
			"Discussion ID": {
				title: [{ type: "text", text: { content: discussionId } }],
			},
			"Mission": { relation: [{ id: params.missionPageId }] },
			"Speaker": { select: { name: params.speaker } },
			"Content": {
				rich_text: [
					{
						type: "text",
						text: { content: params.content.slice(0, 1990) },
					},
				],
			},
			"Discussion Status": { select: { name: "Open" } },
			"Turn": { number: params.turn },
		};

		if (params.taskPageId) {
			properties["Linked Task"] = {
				relation: [{ id: params.taskPageId }],
			};
		}

		await notion.pages.create({
			parent: { data_source_id: MULTI_AGENT_DISCUSSIONS_DATA_SOURCE_ID },
			properties,
		});
	} catch (err) {
		console.warn(
			`[multi-agent] recordMultiAgentDiscussionEntry failed (non-fatal): ${String(err)}`,
		);
	}
}

function extractNextTaskInstructionFromCommanderAnswer(
	answer: string,
): string | null {
	const patterns = [
		/##\s*次の一手\s*\n([\s\S]*?)(?=\n##\s|\n---|\n#\s|$)/,
		/##\s*次のタスク\s*\n([\s\S]*?)(?=\n##\s|\n---|\n#\s|$)/,
		/##\s*次のアクション\s*\n([\s\S]*?)(?=\n##\s|\n---|\n#\s|$)/,
	];
	for (const re of patterns) {
		const m = answer.match(re);
		if (m && m[1]) {
			const text = m[1].trim();
			if (text.length >= 10) return text;
		}
	}
	return null;
}

async function createTaskFromCommanderAnswer(
	notion: NotionClient,
	missionPageId: string,
	instruction: string,
): Promise<string | null> {
	const now = new Date();
	const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
	const timePart = now
		.toISOString()
		.slice(11, 19)
		.replace(/:/g, "");
	const taskId = `T-${datePart}-${timePart}-auto`;

	const created = (await notion.pages.create({
		parent: { data_source_id: MULTI_AGENT_TASKS_DATA_SOURCE_ID },
		properties: {
			"Task ID": {
				title: [{ type: "text", text: { content: taskId } }],
			},
			"Mission": { relation: [{ id: missionPageId }] },
			"Instruction": {
				rich_text: [
					{
						type: "text",
						text: { content: instruction.slice(0, 1900) },
					},
				],
			},
			"Assigned To": { select: { name: "AgentA" } },
			"Task Status": { select: { name: "Pending" } },
		},
	})) as unknown as { id?: string };

	return created.id ?? null;
}

async function processMultiAgentCommanderRun(
	missionPageId: string,
	notion: NotionClient,
	debateContext?: {
		previousVerdict: "Pass" | "Concern" | "Reject";
		previousReview: string;
		previousAgentAResult: string;
		previousTaskId: string;
	},
): Promise<void> {
	const isDebate = !!debateContext;
	console.log(
		`[multi-agent] Commander start: ${missionPageId} debate=${isDebate ? "yes" : "no"}`,
	);

	const page = (await notion.pages.retrieve({ page_id: missionPageId })) as unknown as {
		properties?: Record<string, unknown>;
	};
	const props = (page.properties ?? {}) as Record<string, unknown>;

	const title =
		extractMultiAgentPlainText(props["Title"]) ||
		extractMultiAgentPlainText(props["Name"]) ||
		extractMultiAgentPlainText(props["名前"]);
	const projectName = extractMultiAgentPlainText(props["Project Name"]);
	const projectWhy = extractMultiAgentPlainText(props["Project Why"]);
	const contextSummary = extractMultiAgentPlainText(props["Context Summary"]);
	const successCriteria = extractMultiAgentPlainText(props["Success Criteria"]);
	const existingFinalAnswer = isDebate
		? extractMultiAgentPlainText(props["Final Answer"])
		: "";
	const discussionsProp = props["Discussions"] as
		| { type?: string; relation?: Array<unknown> }
		| undefined;
	const priorDiscussionCount =
		discussionsProp?.type === "relation" && Array.isArray(discussionsProp.relation)
			? discussionsProp.relation.length
			: 0;

	const nowIso = new Date().toISOString();

	try {
		await notion.pages.update({
			page_id: missionPageId,
			properties: {
				"Mission Status": {
					select: { name: isDebate ? "Discussion" : "Running" },
				},
				"Last Action At": { date: { start: nowIso } },
			},
		});
	} catch (err) {
		console.warn(
			`[multi-agent] Failed to set Mission Status: ${String(err)}`,
		);
	}

	const userPrompt = isDebate
		? [
				"# Mission（議論モード・再判断）",
				`- Title: ${title || "(未入力)"}`,
				`- Project Name: ${projectName || "(未入力)"}`,
				"",
				"# Project Why（本来目的）",
				projectWhy || "(未入力)",
				"",
				"# Context Summary（背景）",
				contextSummary || "(未入力)",
				"",
				"# Success Criteria（成功条件）",
				successCriteria || "(未入力)",
				"",
				"---",
				"# これまでの議論経過",
				"",
				"## あなた（Commander）の前回判断",
				existingFinalAnswer || "(取得不可)",
				"",
				"## AgentA（実行担当）の実行結果",
				debateContext!.previousAgentAResult || "(取得不可)",
				"",
				`## AgentB（Skeptic）からの指摘【Verdict: ${debateContext!.previousVerdict}】`,
				debateContext!.previousReview || "(取得不可)",
				"",
				"---",
				"上記の議論を踏まえ、Commanderとして**議論モードの最終判断**を出せ。AgentBの指摘を真摯に受け止め、必要なら方針を修正・撤回し、納得できるなら理由を述べて維持する。新たなTaskは発行しない（既に議論が成立している）。",
				"",
				"**応答に必須の構造：**",
				"1. 議論を踏まえた最終判断（一段落で結論）",
				"2. **AgentB指摘への逐条対応**：AgentBの指摘を①②③...と番号付けて引用し、各番号について必ず **「取り込む」「反論する」「保留する」のいずれかでラベル付け**せよ。曖昧なまとめは禁止。",
				"3. Project Why との整合",
				"4. 次の人間アクション（あれば）",
				"",
				"**Mission Statusとの整合：** あなたがMissionを完了として扱うなら、応答末尾に「F6合格／本Mission完了」と明記すること。テスト未完了や懸念残りの場合は「Mission Status: WaitingHuman 推奨」など、Notion側のステータスと矛盾しない表現を使う。",
			].join("\n")
		: [
				"# Mission",
				`- Title: ${title || "(未入力)"}`,
				`- Project Name: ${projectName || "(未入力)"}`,
				"",
				"# Project Why（本来目的）",
				projectWhy || "(未入力)",
				"",
				"# Context Summary（背景）",
				contextSummary || "(未入力)",
				"",
				"# Success Criteria（成功条件）",
				successCriteria || "(未入力)",
				"",
				"---",
				"このMissionに対してCommanderとして応答せよ。設計図v4 §11.2 の出力ルールに従い、『今回の判断／その理由／Project Why との整合／次の一手』を必ず含める。",
			].join("\n");

	let finalAnswer: string;
	try {
		finalAnswer = await callMultiAgentCommanderClaude({
			system: MULTI_AGENT_COMMANDER_SYSTEM_PROMPT,
			user: userPrompt,
			maxTokens: 4096,
		});
	} catch (err) {
		console.error(`[multi-agent] Anthropic call failed: ${String(err)}`);
		await notion.pages.update({
			page_id: missionPageId,
			properties: {
				"Mission Status": { select: { name: "Error" } },
				"Final Answer": {
					rich_text: [
						{
							type: "text",
							text: {
								content: `Commander failed: ${String(err).slice(0, 1900)}`,
							},
						},
					],
				},
				"Last Action At": { date: { start: new Date().toISOString() } },
			},
		});
		throw err;
	}

	const combinedAnswer = isDebate
		? `${existingFinalAnswer}\n\n---\n\n# 議論モード・最終判断\n\n${finalAnswer}`
		: finalAnswer;
	const truncated =
		combinedAnswer.length > 1990
			? combinedAnswer.slice(0, 1990) + "…"
			: combinedAnswer;

	// 議論モード時、Commander応答本文に「Mission Status: <値>」宣言があれば抽出して反映。
	// なければ Completed のまま。これにより Final Answer 本文と Notion Status の矛盾を防ぐ。
	let finalStatusName = "Completed";
	if (isDebate) {
		const m = finalAnswer.match(
			/Mission\s*Status\s*[:：]\s*\*{0,2}\s*(Draft|Running|Discussion|WaitingHuman|Completed|Error)\b/i,
		);
		if (m && m[1]) {
			const candidate = m[1];
			const canonical = ["Draft", "Running", "Discussion", "WaitingHuman", "Completed", "Error"].find(
				(s) => s.toLowerCase() === candidate.toLowerCase(),
			);
			if (canonical) {
				finalStatusName = canonical;
				console.log(
					`[multi-agent] Debate mode: Mission Status from answer = ${canonical}`,
				);
			}
		}
	}

	await notion.pages.update({
		page_id: missionPageId,
		properties: {
			"Final Answer": {
				rich_text: [{ type: "text", text: { content: truncated } }],
			},
			"Mission Status": { select: { name: finalStatusName } },
			"Last Action At": { date: { start: new Date().toISOString() } },
		},
	});

	console.log(
		`[multi-agent] Commander completed: ${missionPageId} debate=${isDebate ? "yes" : "no"} (${finalAnswer.length} chars)`,
	);

	// F4: Commander応答をDiscussion DBに記録
	// turn番号は議論モード時は (現Discussion数 / 3) + 1、初回は 1
	const commanderTurn = isDebate
		? Math.floor(priorDiscussionCount / 3) + 1
		: 1;
	await recordMultiAgentDiscussionEntry(notion, {
		missionPageId,
		speaker: "Commander",
		content: isDebate ? `【議論モード・最終判断】\n${finalAnswer}` : finalAnswer,
		turn: commanderTurn,
	});

	// F6: 議論モード時は自動連鎖をskip（既に議論が成立している）
	if (isDebate) {
		console.log(`[multi-agent] Debate mode: auto-chain skipped`);
		return;
	}

	// F2.5 自動連鎖：Commander応答の「次の一手」セクションからTaskを自動起票し、
	// 同期でAgentAを実行する。失敗してもCommander本体は成功扱い（警告のみ）。
	const nextInstruction = extractNextTaskInstructionFromCommanderAnswer(finalAnswer);
	if (nextInstruction) {
		try {
			console.log(`[multi-agent] Auto-chain: creating Task from Commander answer`);
			const newTaskPageId = await createTaskFromCommanderAnswer(
				notion,
				missionPageId,
				nextInstruction,
			);
			if (newTaskPageId) {
				console.log(
					`[multi-agent] Auto-chain: invoking AgentA on ${newTaskPageId}`,
				);
				await processMultiAgentAgentARun(newTaskPageId, notion);
				// F3: AgentA完了直後にAgentB（Skeptic）も自動実行
				try {
					console.log(
						`[multi-agent] Auto-chain: invoking AgentB on ${newTaskPageId}`,
					);
					await processMultiAgentAgentBRun(newTaskPageId, notion);
				} catch (agentBErr) {
					console.warn(
						`[multi-agent] AgentB auto-chain failed (non-fatal): ${String(agentBErr)}`,
					);
				}
			}
		} catch (chainErr) {
			console.warn(
				`[multi-agent] Auto-chain failed (non-fatal): ${String(chainErr)}`,
			);
		}
	} else {
		console.log(
			`[multi-agent] Auto-chain: no 「次の一手」section found in answer`,
		);
	}
}

// ────────────────────────────────────────────────────────────────────────────
// マルチエージェント基盤 F2: AgentA（実行担当）
// ────────────────────────────────────────────────────────────────────────────

const MULTI_AGENT_AGENT_A_SYSTEM_PROMPT = `あなたは石橋大右（和上ホールディングス代表）のマルチエージェント基盤の「Agent A（実行担当）」です。

Commanderから渡された指示（Instruction）を、Project Why に照らして実行します。Skeptic役はAgent Bが別途担うため、Agent Aは『前に進める』『素直に実行する』ことを優先します。

毎回の応答で：
1. 指示を素直に受け取り、まず実行する
2. 実行結果と、その実行が Project Why に資するかの自己評価を含める
3. 形骸化した報告は禁止。具体的な根拠・成果物・次に必要な情報源を示す

**絶対禁則（2026-06-17 追加・Skeptic指摘で恒久化）：**
- **「未実行」を「実行結果」と書いてはいけない**。
- 実行不可なら、応答冒頭に \`Status: Blocked\` と明示し、その理由（必要な前提が欠けている／権限がない／対象が存在しない／環境制約／必要な情報が不足等）を述べる。
- Blockedの場合、「実行結果」「成果物」欄は \`(Blockedのため未実行)\` と明記する。
- 「実行準備の説明」「実行計画の提示」「実行手順の列挙」は実行結果ではない。実行したかどうかを偽らない。
- ここを誤魔化すと議論モードでSkepticに突かれる。

応答には必ず以下を含める：
- 実行結果（やったこと・分かったこと・成果物。Blockedならその旨を明示）
- 使った根拠（参照したMission文脈・前提・Why整合）
- 残った不確実性（自分が処理できなかった点・Skepticに見てほしい点）
- 自己評価スコア（0-100の整数。低めに見積もる。Blockedなら0）
- 次に必要な情報・タスク

応答は日本語。お伺い締め（「次に進めるならGOくれたら」式）禁止。`;

async function processMultiAgentAgentARun(
	taskPageId: string,
	notion: NotionClient,
): Promise<void> {
	console.log(`[multi-agent] AgentA start: ${taskPageId}`);

	const taskPage = (await notion.pages.retrieve({
		page_id: taskPageId,
	})) as unknown as { properties?: Record<string, unknown> };
	const taskProps = (taskPage.properties ?? {}) as Record<string, unknown>;

	const taskId =
		extractMultiAgentPlainText(taskProps["Task ID"]) ||
		extractMultiAgentPlainText(taskProps["Title"]);
	const instruction = extractMultiAgentPlainText(taskProps["Instruction"]);
	const assignedTo = extractMultiAgentPlainText(taskProps["Assigned To"]);

	const missionProp = taskProps["Mission"] as
		| { type?: string; relation?: Array<{ id?: string }> }
		| undefined;
	const missionRelationArr =
		missionProp?.type === "relation" && Array.isArray(missionProp.relation)
			? missionProp.relation
			: [];
	const missionPageId = missionRelationArr[0]?.id;

	let missionTitle = "";
	let missionWhy = "";
	let missionContextSummary = "";
	if (missionPageId) {
		try {
			const missionPage = (await notion.pages.retrieve({
				page_id: missionPageId,
			})) as unknown as { properties?: Record<string, unknown> };
			const missionProps = (missionPage.properties ?? {}) as Record<
				string,
				unknown
			>;
			missionTitle = extractMultiAgentPlainText(missionProps["Title"]);
			missionWhy = extractMultiAgentPlainText(missionProps["Project Why"]);
			missionContextSummary = extractMultiAgentPlainText(
				missionProps["Context Summary"],
			);
		} catch (err) {
			console.warn(`[multi-agent] Mission fetch failed: ${String(err)}`);
		}
	}

	const nowIso = new Date().toISOString();

	try {
		await notion.pages.update({
			page_id: taskPageId,
			properties: {
				"Task Status": { select: { name: "Running" } },
				"Last Action At": { date: { start: nowIso } },
			},
		});
	} catch (err) {
		console.warn(
			`[multi-agent] Failed to set Task Status=Running: ${String(err)}`,
		);
	}

	const userPrompt = [
		"# Task",
		`- Task ID: ${taskId || "(未入力)"}`,
		`- Assigned To: ${assignedTo || "(未入力)"}`,
		"",
		"# Instruction（Commanderからの指示）",
		instruction || "(未入力)",
		"",
		"# 紐づくMission",
		`- Title: ${missionTitle || "(未取得)"}`,
		"",
		"# Project Why（本来目的）",
		missionWhy || "(未取得)",
		"",
		"# Context Summary",
		missionContextSummary || "(未取得)",
		"",
		"---",
		"このTaskをAgent Aとして実行せよ。応答に『実行結果／使った根拠／残った不確実性／自己評価スコア(0-100整数)／次に必要な情報』を必ず含める。",
	].join("\n");

	let result: string;
	try {
		result = await callMultiAgentCommanderClaude({
			system: MULTI_AGENT_AGENT_A_SYSTEM_PROMPT,
			user: userPrompt,
			maxTokens: 4096,
		});
	} catch (err) {
		console.error(`[multi-agent] AgentA Anthropic call failed: ${String(err)}`);
		await notion.pages.update({
			page_id: taskPageId,
			properties: {
				"Task Status": { select: { name: "Failed" } },
				"Result": {
					rich_text: [
						{
							type: "text",
							text: {
								content: `AgentA failed: ${String(err).slice(0, 1900)}`,
							},
						},
					],
				},
				"Last Action At": { date: { start: new Date().toISOString() } },
			},
		});
		throw err;
	}

	const truncated =
		result.length > 1990 ? result.slice(0, 1990) + "…" : result;

	await notion.pages.update({
		page_id: taskPageId,
		properties: {
			"Result": {
				rich_text: [{ type: "text", text: { content: truncated } }],
			},
			"Task Status": { select: { name: "Done" } },
			"Last Action At": { date: { start: new Date().toISOString() } },
		},
	});

	console.log(
		`[multi-agent] AgentA completed: ${taskPageId} (${result.length} chars)`,
	);

	// F4: AgentA応答をDiscussion DBにturn=2で記録
	if (missionPageId) {
		await recordMultiAgentDiscussionEntry(notion, {
			missionPageId,
			taskPageId,
			speaker: "AgentA",
			content: result,
			turn: 2,
		});
	}
}

// ────────────────────────────────────────────────────────────────────────────
// マルチエージェント基盤 F3: AgentB（Skeptic / 疑い役）
// 設計図v4 §8.2 Skeptic原則：うまくいく前提を疑う・反証を探す・代替案も必須
// ────────────────────────────────────────────────────────────────────────────

const MULTI_AGENT_AGENT_B_SYSTEM_PROMPT = `あなたは石橋大右（和上ホールディングス代表）のマルチエージェント基盤の「Agent B（Skeptic / 疑い役）」です。

Agent A（実行担当）の応答を読み、設計図v4 §8.2 の Skeptic 原則に従って疑ってかかります：
- うまくいく前提を疑う
- 実行結果を鵜呑みにしない
- 必ず抜け漏れ・副作用・反証を探す
- 「それは本当にプロジェクト目的に資するか」を問い続ける
- 可能なら代替案も出す

ただし「批判だけで進まない」ことも禁止（設計図v4 §13.1）。反証と代替案をセットで出す。

応答には必ず以下を含める：
- 検証結果（疑い・抜け漏れ・反証）3項目以上
- 致命度（Pass / Concern / Reject の3段階で1つだけ選ぶ、末尾に【Verdict: Pass】等の形で明示）
- 代替案または改善案（必須・1つ以上）
- Project Why との整合性チェック
- 自己評価スコア（0-100の整数。低めに見積もる）

応答は日本語。お伺い締め禁止。形骸的な「特に問題なし」は禁止（最低1つは突っ込む）。`;

function extractAgentBVerdict(reviewText: string): "Pass" | "Concern" | "Reject" {
	const m = reviewText.match(/【\s*Verdict\s*[:：]\s*(Pass|Concern|Reject)\s*】/i);
	if (m) {
		const v = m[1];
		if (/^pass$/i.test(v)) return "Pass";
		if (/^concern$/i.test(v)) return "Concern";
		if (/^reject$/i.test(v)) return "Reject";
	}
	if (/Reject|致命|重大な欠陥|やり直し/i.test(reviewText)) return "Reject";
	if (/Concern|懸念|要修正|警戒/i.test(reviewText)) return "Concern";
	return "Pass";
}

async function processMultiAgentAgentBRun(
	taskPageId: string,
	notion: NotionClient,
): Promise<void> {
	console.log(`[multi-agent] AgentB start: ${taskPageId}`);

	const taskPage = (await notion.pages.retrieve({
		page_id: taskPageId,
	})) as unknown as { properties?: Record<string, unknown> };
	const taskProps = (taskPage.properties ?? {}) as Record<string, unknown>;

	const taskId =
		extractMultiAgentPlainText(taskProps["Task ID"]) ||
		extractMultiAgentPlainText(taskProps["Title"]);
	const instruction = extractMultiAgentPlainText(taskProps["Instruction"]);
	const agentAResult = extractMultiAgentPlainText(taskProps["Result"]);

	if (!agentAResult || agentAResult.trim().length < 10) {
		console.warn(
			`[multi-agent] AgentB skipped: AgentA Result is empty for ${taskPageId}`,
		);
		await notion.pages.update({
			page_id: taskPageId,
			properties: {
				"AgentB Review": {
					rich_text: [
						{
							type: "text",
							text: {
								content:
									"AgentB skipped: AgentA Result が空のため疑い役を実行できません。",
							},
						},
					],
				},
				"AgentB Verdict": { select: { name: "Concern" } },
				"Last Action At": { date: { start: new Date().toISOString() } },
			},
		});
		return;
	}

	const missionProp = taskProps["Mission"] as
		| { type?: string; relation?: Array<{ id?: string }> }
		| undefined;
	const missionRelationArr =
		missionProp?.type === "relation" && Array.isArray(missionProp.relation)
			? missionProp.relation
			: [];
	const missionPageId = missionRelationArr[0]?.id;

	let missionWhy = "";
	let missionTitle = "";
	if (missionPageId) {
		try {
			const missionPage = (await notion.pages.retrieve({
				page_id: missionPageId,
			})) as unknown as { properties?: Record<string, unknown> };
			const missionProps = (missionPage.properties ?? {}) as Record<
				string,
				unknown
			>;
			missionTitle = extractMultiAgentPlainText(missionProps["Title"]);
			missionWhy = extractMultiAgentPlainText(missionProps["Project Why"]);
		} catch (err) {
			console.warn(`[multi-agent] Mission fetch failed: ${String(err)}`);
		}
	}

	const userPrompt = [
		"# Task（AgentBが疑う対象）",
		`- Task ID: ${taskId || "(未入力)"}`,
		"",
		"# Instruction（Commanderからの指示）",
		instruction || "(未入力)",
		"",
		"# AgentA Result（疑う対象の応答）",
		agentAResult,
		"",
		"# 紐づくMission",
		`- Title: ${missionTitle || "(未取得)"}`,
		"",
		"# Project Why",
		missionWhy || "(未取得)",
		"",
		"---",
		"このAgentA応答を Agent B（Skeptic）として疑え。応答に『検証結果(3項目以上)／致命度【Verdict: Pass|Concern|Reject】／代替案(必須)／Why整合性／自己評価スコア(0-100整数)』を必ず含める。",
	].join("\n");

	let review: string;
	try {
		review = await callMultiAgentCommanderClaude({
			system: MULTI_AGENT_AGENT_B_SYSTEM_PROMPT,
			user: userPrompt,
			maxTokens: 4096,
		});
	} catch (err) {
		console.error(`[multi-agent] AgentB Anthropic call failed: ${String(err)}`);
		await notion.pages.update({
			page_id: taskPageId,
			properties: {
				"AgentB Review": {
					rich_text: [
						{
							type: "text",
							text: {
								content: `AgentB failed: ${String(err).slice(0, 1900)}`,
							},
						},
					],
				},
				"AgentB Verdict": { select: { name: "Concern" } },
				"Last Action At": { date: { start: new Date().toISOString() } },
			},
		});
		throw err;
	}

	const verdict = extractAgentBVerdict(review);
	const truncated = review.length > 1990 ? review.slice(0, 1990) + "…" : review;

	await notion.pages.update({
		page_id: taskPageId,
		properties: {
			"AgentB Review": {
				rich_text: [{ type: "text", text: { content: truncated } }],
			},
			"AgentB Verdict": { select: { name: verdict } },
			"Last Action At": { date: { start: new Date().toISOString() } },
		},
	});

	console.log(
		`[multi-agent] AgentB completed: ${taskPageId} verdict=${verdict} (${review.length} chars)`,
	);

	// F4: AgentB応答をDiscussion DBに記録（turn=3固定。議論モードでもAgentB再起動はないため）
	if (missionPageId) {
		await recordMultiAgentDiscussionEntry(notion, {
			missionPageId,
			taskPageId,
			speaker: "AgentB",
			content: `【Verdict: ${verdict}】\n${review}`,
			turn: 3,
		});
	}

	// F6: 議論モード遷移
	// Verdict=Concern/Reject の場合、Discussion件数をチェックして上限内なら
	// Commander を再呼出（議論モード）。上限超過なら Mission Status=WaitingHuman。
	if (missionPageId && (verdict === "Concern" || verdict === "Reject")) {
		try {
			const missionForCount = (await notion.pages.retrieve({
				page_id: missionPageId,
			})) as unknown as { properties?: Record<string, unknown> };
			const discussionsRel = missionForCount.properties?.["Discussions"] as
				| { type?: string; relation?: Array<unknown> }
				| undefined;
			const currentDiscussionCount =
				discussionsRel?.type === "relation" && Array.isArray(discussionsRel.relation)
					? discussionsRel.relation.length
					: 0;

			// 1ターン = Commander + AgentA + AgentB = 3件
			// 初回ラウンド完了時=3件、議論モードCommander応答1回ごとに+1件
			// 上限=議論モードCommander応答3回まで → currentDiscussionCount >= 6 で停止
			if (currentDiscussionCount >= 6) {
				console.log(
					`[multi-agent] Debate turn limit reached (${currentDiscussionCount} discussions): setting WaitingHuman`,
				);
				await notion.pages.update({
					page_id: missionPageId,
					properties: {
						"Mission Status": { select: { name: "WaitingHuman" } },
						"Last Action At": { date: { start: new Date().toISOString() } },
					},
				});
				return;
			}

			console.log(
				`[multi-agent] Debate mode trigger: verdict=${verdict} count=${currentDiscussionCount} → invoking Commander re-judgment`,
			);
			await processMultiAgentCommanderRun(missionPageId, notion, {
				previousVerdict: verdict,
				previousReview: review,
				previousAgentAResult: agentAResult,
				previousTaskId: taskPageId,
			});
		} catch (debateErr) {
			console.warn(
				`[multi-agent] Debate mode failed (non-fatal): ${String(debateErr)}`,
			);
		}
	}
}
