import assert from "node:assert/strict";
import {
	checkManagerApprovalGateForTest as gate,
	isManagerUserForTest as isManager,
} from "./index";

// 承認系webhook5本(失注承認/失注差し戻し/案件差し戻し/案件取り消し/成約報告差し戻し)の
// マネージャー権限ゲートの安全装置テスト。二段ロケット:
// - APPROVAL_GATE_MODE 未設定/monitor → 遮断せず通す(wouldBlockをログ観測のみ)
// - APPROVAL_GATE_MODE=enforce → 非マネージャー遮断＋対象ページへ案内コメント
// ゲートが false を返すと各webhookは `if (!gateOk) continue;` で本処理(状態変更・通知)を
// 一切実行しない。よって「本処理が呼ばれない」＝ゲートが false を返すこと。

const comments: Array<{ pageId: string; message: string }> = [];
const notion = {
	comments: {
		create: async (args: {
			parent: { page_id: string };
			rich_text: Array<{ text: { content: string } }>;
		}) => {
			comments.push({
				pageId: args.parent.page_id,
				message: args.rich_text.map((r) => r.text.content).join(""),
			});
			return {};
		},
	},
};

const logs: string[] = [];
const originalLog = console.log;

async function main() {
	const savedMode = process.env.APPROVAL_GATE_MODE;
	const savedManagers = process.env.MANAGER_USER_IDS;
	console.log = (...args: unknown[]) => {
		logs.push(args.map(String).join(" "));
	};
	try {
		process.env.MANAGER_USER_IDS = "ABC-123, def456";
		const managerBody = { user: { id: "abc-123" } };
		const strangerBody = { user: { id: "stranger-999" } };
		const noUserBody = { pageId: "page-1" };

		// ── monitor(既定=環境変数未設定): 非マネージャーでも通す＋ログが出る ──
		delete process.env.APPROVAL_GATE_MODE;
		logs.length = 0;
		comments.length = 0;
		assert.equal(await gate("processProjectDismissWebhook", strangerBody, "page-1", notion as never), true);
		assert.equal(
			logs.some((l) =>
				l.includes("approval-gate monitor: handler=processProjectDismissWebhook userId=stranger-999 wouldBlock=true"),
			),
			true,
			`monitorログが出ていない: ${JSON.stringify(logs)}`,
		);
		assert.equal(comments.length, 0); // monitorではコメントも残さない

		// monitor明示指定でも同じ(enforce以外は全てmonitor扱い)
		process.env.APPROVAL_GATE_MODE = "monitor";
		logs.length = 0;
		assert.equal(await gate("processProjectCancelWebhook", managerBody, "page-1", notion as never), true);
		assert.equal(
			logs.some((l) =>
				l.includes("approval-gate monitor: handler=processProjectCancelWebhook userId=abc-123 wouldBlock=false"),
			),
			true,
		);

		// monitor: userId欠落でも通す(wouldBlock=true・userId=なし をログ)
		logs.length = 0;
		assert.equal(await gate("processClosingDismissWebhook", noUserBody, "page-1", notion as never), true);
		assert.equal(
			logs.some((l) =>
				l.includes("approval-gate monitor: handler=processClosingDismissWebhook userId=なし wouldBlock=true"),
			),
			true,
		);

		// ── enforce: 非マネージャー遮断(本処理を呼ばせない)＋案内コメントが残る ──
		process.env.APPROVAL_GATE_MODE = "enforce";
		logs.length = 0;
		comments.length = 0;
		assert.equal(await gate("processProjectLostApproveWebhook", strangerBody, "page-9", notion as never), false);
		assert.equal(comments.length, 1);
		assert.equal(comments[0]!.pageId, "page-9");
		assert.equal(
			comments[0]!.message.includes(
				"この操作はマネージャーのみ実行できます。MANAGER_USER_IDS に登録されたユーザーでボタンを押してください。",
			),
			true,
		);
		assert.equal(
			logs.some((l) =>
				l.includes("approval-gate enforce: handler=processProjectLostApproveWebhook userId=stranger-999 blocked=true"),
			),
			true,
		);

		// enforce: マネージャーは通る(コメントも増えない)
		comments.length = 0;
		assert.equal(await gate("processProjectLostRejectWebhook", managerBody, "page-9", notion as never), true);
		assert.equal(comments.length, 0);

		// enforce: userId欠落(payloadに無い) → 遮断
		comments.length = 0;
		assert.equal(await gate("processProjectLostRejectWebhook", noUserBody, "page-9", notion as never), false);
		assert.equal(comments.length, 1);

		// enforce: 大文字小文字・ハイフン差は正規化して許可(与信ゲートと同じisManagerUser)
		assert.equal(await gate("processProjectDismissWebhook", { user: { id: "DEF-456" } }, "page-9", notion as never), true);

		// enforce: コメント書き込みが失敗しても遮断は成立する(黙ってthrowしない)
		const brokenNotion = {
			comments: {
				create: async () => {
					throw new Error("comment api down");
				},
			},
		};
		assert.equal(await gate("processProjectCancelWebhook", strangerBody, "page-9", brokenNotion as never), false);

		// ── isManagerUser 正規化(ハイフン無し・大文字小文字) ──
		assert.equal(isManager("abc123"), true);
		assert.equal(isManager("ABC123"), true);
		assert.equal(isManager("abc-123"), true);
		assert.equal(isManager("DEF-456"), true);
		assert.equal(isManager("stranger-999"), false);
		assert.equal(isManager(undefined), false);
		// MANAGER_USER_IDS未設定 → 全員拒否(enforceなら全遮断=安全側)
		delete process.env.MANAGER_USER_IDS;
		assert.equal(isManager("abc-123"), false);
	} finally {
		console.log = originalLog;
		if (savedMode === undefined) delete process.env.APPROVAL_GATE_MODE;
		else process.env.APPROVAL_GATE_MODE = savedMode;
		if (savedManagers === undefined) delete process.env.MANAGER_USER_IDS;
		else process.env.MANAGER_USER_IDS = savedManagers;
	}
	console.log("OK approval-gate");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
