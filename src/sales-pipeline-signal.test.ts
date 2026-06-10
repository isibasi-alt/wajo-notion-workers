import assert from "node:assert/strict";
import {
	assessInquiryPipelineForTest,
	assessProjectClosingForTest,
	refreshSalesPipelineSignalForTest,
} from "./index";

const NOW = "2026-05-26T09:00:00+09:00";

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: [{ plain_text: value }] };
}

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function selectProp(value: string) {
	return { type: "select", select: { name: value } };
}

function dateProp(value: string) {
	return { type: "date", date: { start: value } };
}

function numberProp(value: number | null = null) {
	return { type: "number", number: value };
}

function peopleProp(ids: string[]) {
	return { type: "people", people: ids.map((id) => ({ id })) };
}

function relationProp(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function multiSelectProp(values: string[]) {
	return { type: "multi_select", multi_select: values.map((name) => ({ name })) };
}

function contactLog(id: string, occurredAt: string, type: string, content: string, nextAction = "") {
	return {
		id,
		properties: {
			接点日時: dateProp(occurredAt),
			活動種別: selectProp(type),
			活動内容: richTextProp(content),
			次回アクション: richTextProp(nextAction),
		},
	};
}

function contactSignal(
	id: string,
	occurredAt: string,
	activityType: string,
	activityContent: string,
	nextAction = "",
) {
	return { id, occurredAt, activityType, activityContent, nextAction };
}

function inquiryPage() {
	return {
		id: "inquiry-1",
		properties: {
			件名: titleProp("問-260520-001｜④ 高圧｜サンコネックス｜売却"),
			ステータス: selectProp("対応中"),
			担当営業ユーザー: peopleProp(["user-1"]),
			受信日時: dateProp("2026-05-20"),
			"📅 最終連絡日": dateProp("2026-05-25"),
			資料収集ステータス: selectProp("収集中"),
			必要資料チェック: multiSelectProp(["経産省提出データ", "電力会社資料"]),
			紐づき案件: relationProp([]),
			案件化近さ: selectProp("① 情報不足"),
			案件化スコア: numberProp(),
			"問い合わせフェーズ（推奨）": selectProp("未対応"),
		"営業サマリー": richTextProp(""),
		"次の一手": richTextProp(""),
			案件化根拠: richTextProp(""),
			案件化次アクション: richTextProp(""),
			案件化停滞時間: numberProp(),
			案件化停滞日数: numberProp(),
			案件化停滞アラート: selectProp("⚪ 判定不可"),
			案件化最終判定日時: dateProp("2026-05-20"),
		},
	};
}

function linkedInquiryPage() {
	const page = inquiryPage();
	return {
		...page,
		id: "inquiry-linked",
		properties: {
			...page.properties,
			紐づき案件: relationProp(["project-1"]),
		},
	};
}

function projectPage() {
	return {
		id: "project-1",
		properties: {
			案件名: titleProp("滋賀県大津市｜250kW太陽光発電所｜売却案件"),
			ステータス: selectProp("📋 提案中"),
			担当営業ユーザー: peopleProp(["user-1"]),
			最終アクション日: dateProp("2026-05-23"),
			完成図書ステータス: selectProp("確認済"),
			予定粗利額: numberProp(3000000),
			関連成約: relationProp([]),
			成約近さ: selectProp("① 情報不足"),
			成約スコア: numberProp(),
			"推奨フェーズ（活動ログ）": selectProp("接点不足"),
		"営業サマリー": richTextProp(""),
		"次の一手": richTextProp(""),
			成約根拠: richTextProp(""),
			成約次アクション: richTextProp(""),
			成約停滞時間: numberProp(),
			成約停滞日数: numberProp(),
			成約停滞アラート: selectProp("⚪ 判定不可"),
			成約最終判定日時: dateProp("2026-05-20"),
		},
	};
}

async function main() {
	const inquiryAssessment = assessInquiryPipelineForTest(
		inquiryPage() as never,
		[
			contactSignal("log-1", "2026-05-23", "電話", "売却条件を確認。資料提出を依頼。"),
			contactSignal(
				"log-2",
				"2026-05-25T00:00:00+09:00",
				"Zoom",
				"価格条件を確認し、経産省資料を受領予定。",
			),
		] as never,
		NOW,
	);

	assert.equal(inquiryAssessment.proximity, "⑤ 資料回収中");
	assert.equal(inquiryAssessment.recommendedPhase, "資料回収中");
	assert.equal(inquiryAssessment.stagnationAlert, "🟡 1日超");
	assert.equal(inquiryAssessment.stagnationHours, 33);
	assert.ok(inquiryAssessment.reason.includes("接点2件"));
	assert.ok(inquiryAssessment.nextAction.includes("不足資料"));

	const taggedInquiry = inquiryPage() as { properties: Record<string, unknown> };
	taggedInquiry.properties["タグ"] = multiSelectProp(["現地調査", "値決め", "専売契約"]);
	const taggedInquiryAssessment = assessInquiryPipelineForTest(
		taggedInquiry as never,
		[contactSignal("log-tag-1", "2026-05-25T00:00:00+09:00", "電話", "売主と条件を確認。")],
		NOW,
	);

	assert.equal(taggedInquiryAssessment.proximity, "⑥ 案件化候補");
	assert.ok(taggedInquiryAssessment.score >= 80);
	assert.ok(taggedInquiryAssessment.reason.includes("タグ"));
	assert.equal(taggedInquiryAssessment.stagnationAlert, "🔴 高スコア1日超");

	const actualInquiryTags = inquiryPage() as { properties: Record<string, unknown> };
	actualInquiryTags.properties["タグ"] = multiSelectProp(["必要資料収取済み", "決済者承認済み"]);
	const actualInquiryTagAssessment = assessInquiryPipelineForTest(
		actualInquiryTags as never,
		[contactSignal("log-tag-actual", "2026-05-25T00:00:00+09:00", "電話", "売主と条件を確認。")],
		NOW,
	);

	assert.ok(actualInquiryTagAssessment.score >= 80);
	assert.ok(actualInquiryTagAssessment.reason.includes("タグ"));

	const projectAssessment = assessProjectClosingForTest(
		projectPage() as never,
		[
			contactSignal(
				"log-3",
				"2026-05-23T00:00:00+09:00",
				"Zoom",
				"買主へ提案済み。価格と支払条件を交渉中。",
			),
			contactSignal("log-4", "2026-05-21", "資料送付", "発電シミュレーションと契約条件を送付。"),
		] as never,
		NOW,
	);

	assert.equal(projectAssessment.proximity, "⑥ 提案中");
	assert.equal(projectAssessment.recommendedPhase, "提案中");
	assert.equal(projectAssessment.stagnationAlert, "🔴 3日超");
	assert.equal(projectAssessment.stagnationHours, 81);
	assert.ok(projectAssessment.nextAction.includes("成約報告"));

	const taggedProject = projectPage() as { properties: Record<string, unknown> };
	taggedProject.properties["タグ"] = multiSelectProp(["現地案内", "銀行審査"]);
	const taggedProjectAssessment = assessProjectClosingForTest(
		taggedProject as never,
		[contactSignal("log-tag-2", "2026-05-25T00:00:00+09:00", "電話", "買主と日程を確認。")],
		NOW,
	);

	assert.equal(taggedProjectAssessment.proximity, "⑥ 提案中");
	assert.ok(taggedProjectAssessment.score >= 80);
	assert.ok(taggedProjectAssessment.reason.includes("タグ"));
	assert.equal(taggedProjectAssessment.stagnationAlert, "🔴 高スコア1日超");

	const updates: Array<Record<string, unknown>> = [];
	const createdPages: Array<Record<string, unknown>> = [];
	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) =>
				page_id === "project-1"
					? projectPage()
					: page_id === "inquiry-linked"
						? linkedInquiryPage()
						: inquiryPage(),
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
			create: async (args: Record<string, unknown>) => {
				createdPages.push(args);
				return { id: `learning-log-${createdPages.length}` };
			},
		},
		dataSources: {
			query: async () => ({
				results: [
					contactLog("log-1", "2026-05-23", "電話", "売却条件を確認。資料提出を依頼。"),
					contactLog("log-2", "2026-05-25T00:00:00+09:00", "Zoom", "価格条件を確認し、経産省資料を受領予定。"),
				],
			}),
		},
	};

	const refreshed = await refreshSalesPipelineSignalForTest("inquiry-1", notion as never, NOW);

	assert.equal(refreshed.action, "updated-inquiry");
	assert.equal(updates.length, 1);
	const patched = updates[0]!.properties as Record<string, unknown>;
	assert.ok(patched.案件化近さ);
	assert.ok(patched.案件化スコア);
	assert.match(JSON.stringify(patched["営業サマリー"]), /営業状態: 対応中/);
	assert.match(
		JSON.stringify(patched["次の一手"]),
		/次の一手: 活動を残す|次の一手: 案件化する/,
	);
	assert.ok(patched.案件化停滞時間);
	assert.equal(patched.ステータス, undefined);
	assert.equal(createdPages.length, 1);
	const inquiryLearningLog = createdPages[0]!.properties as Record<string, unknown>;
	assert.ok(inquiryLearningLog.判定名);
	assert.ok(inquiryLearningLog.関連問い合わせ);
	assert.equal((inquiryLearningLog.判定種別 as { select: { name: string } }).select.name, "案件化予測");
	assert.equal((inquiryLearningLog.対象領域 as { select: { name: string } }).select.name, "問い合わせ");

	const linkedRefreshed = await refreshSalesPipelineSignalForTest("inquiry-linked", notion as never, NOW);

	assert.equal(linkedRefreshed.action, "updated-inquiry");
	const linkedPatch = updates.find((update) => update.page_id === "inquiry-linked")!.properties as Record<string, unknown>;
	assert.match(JSON.stringify(linkedPatch["営業サマリー"]), /案件化有無: あり/);
	assert.match(JSON.stringify(linkedPatch["次の一手"]), /次の一手: 活動を残す|次の一手: 設備詳細を作成/);

	const projectRefreshed = await refreshSalesPipelineSignalForTest("project-1", notion as never, NOW);

	assert.equal(projectRefreshed.action, "updated-project");
	const projectPatch = updates.find((update) => update.page_id === "project-1")!.properties as Record<string, unknown>;
	assert.match(JSON.stringify(projectPatch["営業サマリー"]), /営業状態: 📋 提案中/);
	assert.match(
		JSON.stringify(projectPatch["次の一手"]),
		/次の一手: 設備詳細を作成|次の一手: シミュレーション作成|次の一手: 成約報告する|次の一手: 活動を残す/,
	);
	assert.equal(createdPages.length, 3);
	const projectLearningLog = createdPages[2]!.properties as Record<string, unknown>;
	assert.ok(projectLearningLog.判定名);
	assert.ok(projectLearningLog.関連案件);
	assert.equal((projectLearningLog.判定種別 as { select: { name: string } }).select.name, "成約予測");
	assert.equal((projectLearningLog.対象領域 as { select: { name: string } }).select.name, "案件");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
