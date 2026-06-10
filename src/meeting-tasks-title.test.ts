import assert from "node:assert/strict";
import { processMeetingTasksForTest } from "./index";

const title = (value: string) => ({
	type: "title",
	title: [{ plain_text: value }],
});

const richText = (value: string) => ({
	type: "rich_text",
	rich_text: [{ plain_text: value }],
});

const select = (value: string) => ({
	type: "select",
	select: { name: value },
});

async function runDryRunWithProperties(properties: Record<string, unknown>) {
	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => ({
				id: page_id,
				properties,
			}),
		},
		dataSources: {
			query: async () => ({ results: [] }),
		},
	};

	return processMeetingTasksForTest(
		{ meetingPageId: "meeting-1", dryRun: true },
		notion as never,
	);
}

async function main() {
	const baseProperties = {
		日時: richText("2026-06-07 10:00"),
		アクション項目: richText(
			"1. 提案資料を作成する / 担当: 石橋 / 期限: 2026-06-10",
		),
		タスク化ステータス: select("未処理"),
		担当営業ユーザー: { type: "people", people: [{ id: "sales-1" }] },
		関連チームタスク: { type: "relation", relation: [] },
		関連商談: { type: "relation", relation: [] },
		関連企業: { type: "relation", relation: [] },
	};

	const result = await runDryRunWithProperties({
		...baseProperties,
		会議名: title("6月営業会議"),
		会議名AI: richText("AI生成会議名"),
		"会議名（自動）": richText("自動生成会議名"),
	});

	assert.equal(result.action, "dry-run");
	assert.match(result.message, /^dry-run: 6月営業会議 /);
	assert.doesNotMatch(result.message, /^dry-run: 2026-06-07 10:00 /);

	const meetingTitle = await runDryRunWithProperties({
		...baseProperties,
		ミーティング名: title("リリース確認ミーティング"),
		会議名: title("6月営業会議"),
	});
	assert.match(meetingTitle.message, /^dry-run: リリース確認ミーティング /);

	const aiFallback = await runDryRunWithProperties({
		...baseProperties,
		会議名AI: richText("AI生成会議名"),
		"会議名（自動）": richText("自動生成会議名"),
	});
	assert.match(aiFallback.message, /^dry-run: AI生成会議名 /);

	const autoFallback = await runDryRunWithProperties({
		...baseProperties,
		"会議名（自動）": richText("自動生成会議名"),
	});
	assert.match(autoFallback.message, /^dry-run: 自動生成会議名 /);

	const defaultFallback = await runDryRunWithProperties(baseProperties);
	assert.match(defaultFallback.message, /^dry-run: 会議 /);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
