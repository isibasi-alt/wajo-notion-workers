import assert from "node:assert/strict";
import {
	buildApprovalStampForTest as buildStamp,
	readClosingApprovalStatusTextForTest as readStatus,
	dismissClosingReportForTest,
	cancelClosingReportForTest,
} from "./index";

// 正本スタンプ(チェックリスト1-2)の安全装置テスト。
// - buildApprovalStamp: 「承認者ID|ISO日時|操作|コミット」書式の純関数
// - readClosingApprovalStatusText: 旧「承認ステータス」とNotion実機の
//   「退役｜承認ステータス（使用禁止）」の両名読み取りフォールバック
// - dismiss/cancel: スタンプ列がページに存在する時だけ書く(列未作成=スケルトン期間は
//   何も書かない)ことを、safeUpdateExistingProperties経由の実呼び出しで確認

function richTextProp(value = ""): Record<string, unknown> {
	return {
		type: "rich_text",
		rich_text: value ? [{ type: "text", plain_text: value, text: { content: value } }] : [],
	};
}

async function main() {
	const savedCommit = process.env.WORKER_GIT_COMMIT;
	try {
		// ── buildApprovalStamp 書式 ──
		process.env.WORKER_GIT_COMMIT = "abcdef0123456789";
		const stamp = buildStamp("成約確定", "user-1", "2026-06-13T00:00:00.000Z");
		assert.equal(stamp, "user-1|2026-06-13T00:00:00.000Z|成約確定|abcdef012345");

		// userId欠落・コミット未設定でも欠損を明示して必ず4要素になる
		delete process.env.WORKER_GIT_COMMIT;
		const fallback = buildStamp("差戻し", undefined, "2026-06-13T00:00:00.000Z");
		assert.equal(fallback, "ユーザー不明|2026-06-13T00:00:00.000Z|差戻し|rev不明");
		assert.equal(fallback.split("|").length, 4);

		// ── readClosingApprovalStatusText 両名フォールバック ──
		const legacyOnly = {
			"退役｜承認ステータス（使用禁止）": { type: "select", select: { name: "取り消し" } },
		};
		assert.equal(readStatus(legacyOnly), "取り消し");
		const newName = {
			承認ステータス: { type: "select", select: { name: "成約" } },
			"退役｜承認ステータス（使用禁止）": { type: "select", select: { name: "下書き" } },
		};
		assert.equal(readStatus(newName), "成約"); // 現役名があれば優先
		assert.equal(readStatus({}), "");
		assert.equal(readStatus(undefined), "");

		// ── dismissClosingReport: スタンプ列があるページには書く ──
		const updates: Array<Record<string, unknown>> = [];
		const makeNotion = (closingProps: Record<string, unknown>) => ({
			dataSources: {
				query: async () => ({ results: [] }),
			},
			pages: {
				retrieve: async ({ page_id }: { page_id: string }) => ({
					id: page_id,
					properties:
						page_id === "project-1"
							? {
									ステータス: { type: "select", select: { name: "🏆 成約" } },
									管理アクションメモ: richTextProp(),
								}
							: closingProps,
				}),
				update: async (args: Record<string, unknown>) => {
					updates.push(args);
					return { id: args.page_id };
				},
			},
			comments: { create: async () => ({}) },
		});

		process.env.WORKER_GIT_COMMIT = "rev123456789abc";
		updates.length = 0;
		const withStamp = makeNotion({
			管理メモ: richTextProp(),
			"承認スタンプ🤖": richTextProp(),
			関連案件: { type: "relation", relation: [{ id: "project-1" }] },
		});
		await dismissClosingReportForTest(
			"closing-1",
			withStamp as never,
			"理由テスト",
			"manager-9",
		);
		const closingUpdate = updates.find((u) => u.page_id === "closing-1");
		assert.ok(closingUpdate, "成約報告ページへの更新が無い");
		const props = closingUpdate!.properties as Record<string, unknown>;
		// 実機に存在しない「承認ステータス」selectは黙ってスキップされる(エラーにしない)
		assert.equal(props["承認ステータス"], undefined);
		const stampValue = (
			(props["承認スタンプ🤖"] as { rich_text: Array<{ text: { content: string } }> })
				.rich_text ?? []
		)
			.map((r) => r.text.content)
			.join("");
		const parts = stampValue.split("|");
		assert.equal(parts.length, 4, `スタンプ書式が崩れている: ${stampValue}`);
		assert.equal(parts[0], "manager-9");
		assert.ok(!Number.isNaN(Date.parse(parts[1]!)), `ISO日時でない: ${parts[1]}`);
		assert.equal(parts[2], "差戻し");
		assert.equal(parts[3], "rev123456789");

		// ── dismissClosingReport: スタンプ列が無いページには何も書かない(スケルトン安全) ──
		updates.length = 0;
		const withoutStamp = makeNotion({
			管理メモ: richTextProp(),
			関連案件: { type: "relation", relation: [] },
		});
		await dismissClosingReportForTest("closing-2", withoutStamp as never, "", undefined);
		const update2 = updates.find((u) => u.page_id === "closing-2");
		assert.ok(update2, "管理メモ更新は行われるはず");
		assert.equal(
			(update2!.properties as Record<string, unknown>)["承認スタンプ🤖"],
			undefined,
			"列が無いのにスタンプを書こうとしている",
		);

		// ── cancelClosingReport: 退役名selectの「取り消し」も読めて二重取り消しを防ぐ ──
		updates.length = 0;
		const legacyCancelled = makeNotion({
			"退役｜承認ステータス（使用禁止）": { type: "select", select: { name: "取り消し" } },
			歩合確定額: { type: "number", number: 0 },
		});
		const result = await cancelClosingReportForTest(
			"closing-3",
			legacyCancelled as never,
		);
		assert.equal(result.action, "already-cancelled");
		assert.equal(updates.length, 0);
	} finally {
		if (savedCommit === undefined) delete process.env.WORKER_GIT_COMMIT;
		else process.env.WORKER_GIT_COMMIT = savedCommit;
	}
	console.log("OK approval-stamp");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
