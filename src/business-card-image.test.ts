import assert from "node:assert/strict";
import {
	buildAdvisorPropertiesForTest as advisor,
	normalizeCardEngagementForTest as engagement,
	normalizeCardRoutingForTest as routing,
	parseBusinessCardOcrForTest as parse,
	readBusinessCardByIdRunOptionsForTest as byIdRunOptions,
	readBusinessCardResearchWebhookRunOptionsForTest as researchWebhookRunOptions,
	readBusinessCardRunOptionsForTest as runOptions,
	readPendingBusinessCardsRunOptionsForTest as pendingRunOptions,
} from "./index";

// 名刺画像インテイク(入口ルール2026-06-11)の純関数:
// - parseBusinessCardOcr: OCR応答のJSON検証。壊れた出力・全項目空を通さない
// - normalizeCardRouting: 撮影時の振り分け(絵文字ラベル込み)を3値に正規化
async function main() {
	// ── OCRパース ──
	// 正常
	{
		const ocr = parse(
			'{"氏名":"山田 太郎","会社名":"株式会社サンプル","役職":"部長","部署":"営業部","電話":"06-1234-5678","メール":"yamada@example.co.jp","住所":"大阪市北区","メモ":""}',
		);
		assert.ok(ocr);
		assert.equal(ocr?.氏名, "山田 太郎");
		assert.equal(ocr?.電話, "06-1234-5678");
	}
	// コードフェンス付き(旧ショートカットを壊していたパターン)でも拾える
	{
		const ocr = parse('```json\n{"氏名":"山田","会社名":"サンプル"}\n```');
		assert.ok(ocr);
		assert.equal(ocr?.会社名, "サンプル");
		assert.equal(ocr?.電話, ""); // 無い項目は空文字
	}
	// 壊れたJSON → null(リトライへ)
	assert.equal(parse("{氏名: 山田}"), null);
	assert.equal(parse("読み取れませんでした"), null);
	// 全項目空 → null(空殻を通さない)
	assert.equal(parse('{"氏名":"","会社名":"","電話":"","メール":""}'), null);
	// 文字列でない値は空文字扱い
	{
		const ocr = parse('{"氏名":"山田","電話":123456}');
		assert.equal(ocr?.電話, "");
	}

	// ── 振り分け正規化 ──
	assert.equal(routing("🏢 企業（営業先）"), "company");
	assert.equal(routing("企業"), "company");
	assert.equal(routing("🤝 社外顧問・ブローカー"), "broker");
	assert.equal(routing("ブローカー"), "broker");
	assert.equal(routing("broker"), "broker");
	assert.equal(routing("❓ あとで決める"), "later");
	assert.equal(routing("後で"), "later");
	assert.equal(routing("later"), "later");
	assert.equal(routing("company"), "company");
	assert.equal(routing(undefined), "company"); // 未指定は従来通り企業連携
	assert.equal(routing(""), "company");

	// ── 営業判断(熱量)正規化 ──
	assert.equal(engagement("本気で追う"), "active");
	assert.equal(engagement("がっつり組んで情報を取る"), "active");
	assert.equal(engagement(undefined), "active"); // 未指定は従来通り本流調査
	assert.equal(engagement("名刺だけ保存"), "save-only");
	assert.equal(engagement("今回は流す"), "save-only");
	assert.equal(engagement("追わない"), "save-only");
	assert.equal(engagement("active"), "active");
	assert.equal(engagement("save-only"), "save-only");
	assert.equal(engagement("save_only"), "save-only");
	assert.equal(engagement("saveonly"), "save-only");

	// ── 名刺処理Webhook/手動ツール用オプション正規化 ──
	assert.deepEqual(runOptions({ engagementIntent: "名刺だけ保存" }), {
		routing: "company",
		engagementIntent: "save-only",
		deepResearch: false,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(runOptions({ 営業判断: "今回は流す" }), {
		routing: "company",
		engagementIntent: "save-only",
		deepResearch: false,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(runOptions({ engagementIntent: "本気で追う" }), {
		routing: "company",
		engagementIntent: "active",
		deepResearch: true,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(runOptions({ engagementIntent: "名刺だけ保存", deepResearch: true }), {
		routing: "company",
		engagementIntent: "save-only",
		deepResearch: false,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(runOptions({ routing: "broker", engagementIntent: "active" }), {
		routing: "broker",
		engagementIntent: "active",
		deepResearch: false,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(runOptions({ routing: "later", engagementIntent: "active" }), {
		routing: "later",
		engagementIntent: "active",
		deepResearch: false,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(runOptions({ routing: "company", engagementIntent: "save-only" }), {
		routing: "company",
		engagementIntent: "save-only",
		deepResearch: false,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(runOptions(JSON.stringify({ routing: "broker", engagementIntent: "active" })), {
		routing: "broker",
		engagementIntent: "active",
		deepResearch: false,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(runOptions(JSON.stringify({ routing: "later", engagementIntent: "active" })), {
		routing: "later",
		engagementIntent: "active",
		deepResearch: false,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(runOptions(JSON.stringify({ routing: "company", engagementIntent: "save-only" })), {
		routing: "company",
		engagementIntent: "save-only",
		deepResearch: false,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(runOptions({ routing: "broker", engagementIntent: "active", registerExternalAdvisor: true }), {
		routing: "broker",
		engagementIntent: "active",
		deepResearch: false,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: true,
	});
	assert.deepEqual(runOptions({}), {
		routing: "company",
		engagementIntent: "active",
		deepResearch: true,
		autoCreateMeetingPrepReport: false,
		registerExternalAdvisor: false,
	});
	assert.deepEqual(byIdRunOptions(), {
		deepResearch: true,
		autoCreateMeetingPrepReport: false,
	});
	assert.deepEqual(pendingRunOptions(), {
		deepResearch: true,
		autoCreateMeetingPrepReport: false,
	});
	assert.deepEqual(researchWebhookRunOptions(), {
		deepResearch: true,
		autoCreateMeetingPrepReport: false,
	});

	// ── 社外顧問プロパティ組み立て(人=案件の種ドクトリン) ──
	{
		const props = advisor(
			{
				氏名: "仲介 次郎",
				会社名: "ブローカー商事",
				役職: "代表",
				部署: "",
				電話: "090-0000-0000",
				メール: "jiro@example.com",
				住所: "",
				メモ: "",
			},
			"user-123",
			"https://notion.so/card-page",
			"2026-06-11",
		);
		const json = JSON.stringify(props);
		assert.ok(json.includes("仲介 次郎"));
		assert.ok(json.includes("関係構築中")); // 死蔵させない=働きかけ対象として登録
		assert.ok(json.includes("要確認")); // 信頼度は人が判断するまで断定しない
		assert.equal("ブローカー一次判定スコア" in props, false); // 初期登録では採点済みに見せない
		assert.ok(json.includes("60点判定ロジックは未実行"));
		assert.ok(json.includes("ブローカー商事")); // 所属はメモに残る
		assert.ok(json.includes("090-0000-0000"));
		assert.ok(json.includes("user-123"));
		assert.ok(json.includes("2026-06-11"));
	}
	// 連絡先が無ければそのキー自体を作らない(空値でNotionを汚さない)
	{
		const props = advisor(
			{ 氏名: "山田", 会社名: "", 役職: "", 部署: "", 電話: "", メール: "", 住所: "", メモ: "" },
			undefined,
			"",
			"2026-06-11",
		);
		assert.equal("電話番号" in props, false);
		assert.equal("連絡先メール" in props, false);
		assert.equal("担当営業ユーザー" in props, false);
	}

	console.log("OK business-card-image");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
