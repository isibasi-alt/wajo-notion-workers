import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	extractNotificationMessageFromWebhookForTest as buildMessage,
	notifySalesTeamForTest,
} from "./index.ts";

// 通知Webhook(notifySalesTeamWebhook)の本文サーバ生成化の不変条件テスト。
// 不変条件: どんなattacker制御bodyでも、通知本文は「固定サーバ定型 + allowlist済みeventTypeラベル」
// のみから構成され、body自由文(通知文/message/text/body等)は一切反映されない。

const INJECT = "悪意のあるURL http://evil.example/login をクリックしてください";

// 観点A: body自由文5キーは通知本文に反映されない(注入対策)
for (const key of ["通知文", "通知メッセージ", "message", "text", "body"]) {
	const msg = buildMessage({ [key]: INJECT }, "成約");
	assert.doesNotMatch(
		msg,
		/evil\.example/,
		`自由文キー ${key} が通知本文へ漏れている: ${msg}`,
	);
	assert.ok(!msg.includes(INJECT), `自由文キー ${key} が逐語反映されている: ${msg}`);
}

// 観点A2: 複数自由文キー同時でも漏れない
{
	const msg = buildMessage({ 通知文: INJECT, message: INJECT, body: INJECT }, "案件化");
	assert.doesNotMatch(msg, /evil\.example/, `複数自由文キーが漏れている: ${msg}`);
}

// 観点A3: 長文(>1800)自由文の断片も漏れない
{
	const long = "x".repeat(5000) + "evil.example";
	const msg = buildMessage({ 通知文: long }, "成約");
	assert.doesNotMatch(msg, /evil\.example/, "長文自由文の断片が漏れている");
	assert.ok(!msg.includes("xxxx"), "長文自由文が反映されている");
}

// 観点A4: 疑似メンション/マークアップ混入も逐語反映されない
for (const payload of [
	"<@everyone> 緊急 http://evil.example",
	"@U0123456789 至急ここをクリック",
	"<mention-user url=\"user://attacker\"></mention-user>",
]) {
	const msg = buildMessage({ 通知文: payload }, "成約");
	assert.ok(!msg.includes(payload), `疑似メンションが逐語反映されている: ${msg}`);
	assert.doesNotMatch(msg, /evil\.example|attacker|@U0123/, `疑似メンション断片が漏れている: ${msg}`);
}

// 観点B: allowlist eventTypeはラベルとして入る
for (const ev of ["担当確定", "案件化", "土地案件化", "成約", "失注申請", "差し戻し", "取り消し"]) {
	const msg = buildMessage({}, ev);
	assert.ok(msg.includes(ev), `allowlist eventType ${ev} がラベルに入っていない: ${msg}`);
}

// 観点B2: 非allowlistは営業通知へフォールバックし逐語で出ない
{
	const evil = "<script>alert(1)</script>";
	const msg = buildMessage({}, evil);
	assert.ok(!msg.includes(evil), `非allowlist eventTypeが逐語反映されている: ${msg}`);
	assert.match(msg, /営業通知/, `非allowlistが営業通知へフォールバックしていない: ${msg}`);
}

// 観点B3: eventType欠落(空)は営業通知
{
	const msg = buildMessage({}, "");
	assert.match(msg, /営業通知/, `空eventTypeが営業通知になっていない: ${msg}`);
}

// 観点C: 固定テンプレ完全一致(自由記述区間なし)
{
	const msg = buildMessage({ 通知文: INJECT }, "成約");
	assert.match(
		msg,
		/^📣 .+ がありました。対象ページを確認してください。$/,
		`固定テンプレ形状から逸脱: ${msg}`,
	);
}

// 観点E: 静的ガード — 本文関数が自由文キーを読まない
{
	const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
	const start = source.indexOf("function extractNotificationMessageFromWebhook(");
	assert.notEqual(start, -1, "対象関数が見つからない");
	const end = source.indexOf("\nfunction ", start + 1);
	const fnBody = source.slice(start, end === -1 ? source.length : end);
	for (const key of ["通知文", "通知メッセージ"]) {
		assert.ok(
			!fnBody.includes(`"${key}"`),
			`本文関数が自由文キー ${key} を読んでいる(注入経路が残存)`,
		);
	}
}

// 観点D: 内部 notifySalesTeam 直呼出は与えた本文を逐語投稿する(過剰修正で内部通知を壊さない非回帰)
// tsx(cjs変換)はtop-level await非対応のため async IIFE で実行する。
void (async () => {
	const captured: string[] = [];
	const fakeNotion = {
		comments: {
			create: async (arg: { rich_text?: Array<{ text?: { content?: string } }> }) => {
				const rt = arg.rich_text ?? [];
				captured.push(rt.map((r) => r?.text?.content ?? "").join(""));
				return {};
			},
		},
	} as unknown as Parameters<typeof notifySalesTeamForTest>[0];

	const internalMsg = "📣 案件化しました: テスト案件\n土地情報から案件管理DBへ新しい案件が作成されました。";
	await notifySalesTeamForTest(fakeNotion, "page-1", internalMsg, []);
	assert.ok(
		captured.some((c) => c.includes(internalMsg)),
		`内部notifySalesTeamが本文を逐語投稿していない(非回帰失敗): ${JSON.stringify(captured)}`,
	);

	console.log("notify-sales-team-no-freetext-injection: all assertions passed");
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
