import assert from "node:assert/strict";
import {
	findTeamTasksByMeetingForTest,
	createTeamTrackerTaskFromMeetingActionForTest,
} from "./index";

// チームトラッカーの会議relation実名「関連ミーティング」への寄せを固定するテスト。
// 旧名「関連会議議事録」はチームトラッカー実schemaに存在しない(2026-06-15裏取り)。
// 重複検索・relation書き込みとも実在列「関連ミーティング」へ寄ることを担保する。

async function main() {
	// --- 重複検索が「関連ミーティング」をqueryすること ---
	const queriedProps: string[] = [];
	const lookupNotion = {
		dataSources: {
			query: async (arg: { filter?: { property?: string } }) => {
				if (arg.filter?.property) queriedProps.push(arg.filter.property);
				return { results: [] };
			},
		},
	};
	await findTeamTasksByMeetingForTest(lookupNotion as never, "meeting-1");
	assert.ok(
		queriedProps.includes("関連ミーティング"),
		`重複検索が「関連ミーティング」をqueryしていない: ${JSON.stringify(queriedProps)}`,
	);
	assert.ok(
		!queriedProps.includes("関連会議議事録"),
		"存在しない旧名「関連会議議事録」をqueryしている",
	);

	// --- タスク作成が「関連ミーティング」relationへ書くこと ---
	// fakeのチームトラッカーページは実在列のみを持つ(旧名・誤名は持たない)。
	// safeUpdateExistingProperties は存在しない列を自動スキップするため、
	// 「関連ミーティング」「関連商談 1」「関連企業 1」だけが update に残る。
	const teamTaskProps = {
		概要: { type: "rich_text" },
		ステータス: { type: "status" },
		優先順位: { type: "select" },
		タスクタイプ: { type: "multi_select" },
		期限: { type: "date" },
		タスク担当者: { type: "people" },
		関連ミーティング: { type: "relation" },
		"関連商談 1": { type: "relation" },
		"関連企業 1": { type: "relation" },
	};
	const updates: Record<string, unknown>[] = [];
	const createNotion = {
		pages: {
			create: async () => ({ id: "team-task-1" }),
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				properties: teamTaskProps,
			}),
			update: async (arg: { properties: Record<string, unknown> }) => {
				updates.push(arg.properties);
				return {};
			},
		},
	};
	await createTeamTrackerTaskFromMeetingActionForTest(createNotion as never, {
		meetingPage: { id: "meeting-1" },
		titleText: "6月営業会議",
		candidate: {
			title: "提案資料を作成する",
			description: "会議で決まった提案資料作成",
			priority: "中",
			taskType: "書類作成",
			requiresHumanCheck: false,
			dueDate: "2026-06-20",
			dueText: "2026-06-20",
		},
		assignedUserIds: ["sales-1"],
		relatedDealIds: ["deal-1"],
		relatedCompanyIds: ["co-1"],
	} as never);

	const merged: Record<string, unknown> = {};
	for (const u of updates) Object.assign(merged, u);
	const has = (key: string) =>
		Object.prototype.hasOwnProperty.call(merged, key);

	assert.ok(
		has("関連ミーティング"),
		`タスク作成が「関連ミーティング」relationを書いていない: keys=${JSON.stringify(Object.keys(merged))}`,
	);
	assert.ok(
		!has("関連会議議事録"),
		"存在しない旧名「関連会議議事録」が update に残っている(実列へ寄っていない)",
	);
	assert.ok(has("関連商談 1"), "関連商談が実名「関連商談 1」へ寄っていない");
	assert.ok(has("関連企業 1"), "関連企業が実名「関連企業 1」へ寄っていない");

	console.log("meeting-tasks-relation-name: all assertions passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
