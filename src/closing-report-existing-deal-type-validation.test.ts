import assert from "node:assert/strict";
import { processClosingReportForTest } from "./index";

const updates: Array<Record<string, unknown>> = [];
const creates: Array<Record<string, unknown>> = [];
const comments: Array<Record<string, unknown>> = [];

const notion = {
	dataSources: {
		query: async () => ({
			results: [{
				id: "closing-existing",
				properties: {
					承認ステータス: { type: "select", select: { name: "成約" } },
				},
			}],
		}),
	},
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => ({
			id: page_id,
			properties: {
				案件名: {
					type: "title",
					title: [{ plain_text: "既存成約の売買区分未確定テスト案件" }],
				},
				売買区分: { type: "select", select: { name: "不明" } },
				実績粗利額: { type: "number", number: 1500000 },
				担当営業ユーザー: { type: "people", people: [{ id: "project-sales-user" }] },
				仕入れ担当: { type: "people", people: [] },
			},
		}),
		update: async (args: Record<string, unknown>) => {
			updates.push(args);
			return { id: args.page_id };
		},
		create: async (args: Record<string, unknown>) => {
			creates.push(args);
			return { id: "unexpected-create" };
		},
	},
	comments: {
		create: async (args: Record<string, unknown>) => {
			comments.push(args);
			return {};
		},
	},
};

async function main() {
	const result = await processClosingReportForTest(
		"project-1",
		notion as never,
		"button-click-user",
	);

	assert.equal(result.action, "existing-needs-deal-type");
	assert.equal(result.closingPageId, "closing-existing");
	assert.equal(creates.length, 0, "既存成約があっても重複作成しない");
	assert.equal(updates.length, 0, "売買区分未確定の既存成約は月次成績へ紐付けない");
	assert.equal(comments.length, 1);
	assert.match(JSON.stringify(comments[0]), /月次成績への反映は行っていません/);
	assert.match(JSON.stringify(comments[0]), /売却案件|購入希望|売買両方/);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
