import assert from "node:assert/strict";
import { processClosingReportRequestForTest } from "./index";

const updates: Array<Record<string, unknown>> = [];
const creates: Array<Record<string, unknown>> = [];
const comments: Array<Record<string, unknown>> = [];

function relation(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

const notion = {
	dataSources: {
		query: async () => ({ results: [] }),
	},
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => {
			if (page_id === "deal-1") {
				return {
					id: "deal-1",
					parent: { type: "data_source_id", data_source_id: "7838db8a-907a-4c61-b062-109f8278b2c9" },
					properties: {
						商談名: { type: "title", title: [{ plain_text: "テスト商談" }] },
						関連案件: relation(["project-1"]),
					},
				};
			}
			return {
				id: "project-1",
				parent: { type: "data_source_id", data_source_id: "54e869d7-ba3e-49e1-b760-af46e23499cb" },
				properties: {
					案件名: { type: "title", title: [{ plain_text: "テスト案件" }] },
					売買区分: { type: "select", select: { name: "売却案件" } },
					対象物種別: { type: "select", select: { name: "土地" } },
					実績粗利額: { type: "number", number: 1230000 },
					担当営業ユーザー: { type: "people", people: [{ id: "existing-sales" }] },
					仕入れ担当: { type: "people", people: [] },
					関連企業: relation(["company-1"]),
					ステータス: { type: "select", select: { name: "📋 提案中" } },
					成約日: { type: "date", date: null },
				},
			};
		},
		update: async (args: Record<string, unknown>) => {
			updates.push(args);
			return { id: args.page_id };
		},
		create: async (args: Record<string, unknown>) => {
			creates.push(args);
			return {
				id: "closing-1",
				url: "https://notion.so/closing-1",
				properties: {
					"承認スタンプ🤖": { type: "rich_text", rich_text: [] },
				},
			};
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
	const result = await processClosingReportRequestForTest(
		"deal-1",
		notion as never,
		"trigger-user",
	);

	assert.equal(result.action, "created");
	assert.equal(result.closingPageId, "closing-1");
	assert.equal(result.projectPageId, "project-1");
	assert.equal(result.sourcePageId, "deal-1");

	const closingCreate = creates[0] as {
		properties: {
			関連案件: { relation: Array<{ id: string }> };
		};
	};
	assert.equal(closingCreate.properties.関連案件.relation[0]?.id, "project-1");

	const projectUpdate = updates.find((u) => u.page_id === "project-1");
	assert.ok(projectUpdate, "案件ページが成約へ更新されていない");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
