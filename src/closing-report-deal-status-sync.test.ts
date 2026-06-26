import assert from "node:assert/strict";
import { processClosingReportForTest } from "./index";

const PROJECT_DATA_SOURCE_ID = "54e869d7-ba3e-49e1-b760-af46e23499cb";
const DEAL_DATA_SOURCE_ID = "7838db8a-907a-4c61-b062-109f8278b2c9";
const CLOSING_REPORT_DATA_SOURCE_ID = "8d5a506b-59b8-4e50-bc77-d5412774048d";

const updates: Array<Record<string, unknown>> = [];
const creates: Array<Record<string, unknown>> = [];

function relation(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

const projectPage = {
	id: "project-1",
	parent: { type: "data_source_id", data_source_id: PROJECT_DATA_SOURCE_ID },
	properties: {
		案件名: { type: "title", title: [{ plain_text: "テスト案件" }] },
		売買区分: { type: "select", select: { name: "売却案件" } },
		対象物種別: { type: "select", select: { name: "土地" } },
		実績粗利額: { type: "number", number: 1230000 },
		担当営業ユーザー: { type: "people", people: [{ id: "sales-1" }] },
		仕入れ担当: { type: "people", people: [] },
		関連企業: relation([]),
		ステータス: { type: "select", select: { name: "📋 提案中" } },
		成約日: { type: "date", date: null },
	},
};

const relatedDealPage = {
	id: "deal-1",
	parent: { type: "data_source_id", data_source_id: DEAL_DATA_SOURCE_ID },
	properties: {
		商談名: { type: "title", title: [{ plain_text: "テスト商談" }] },
		関連案件: relation(["project-1"]),
		商談ステータス: { type: "select", select: { name: "フォロー中" } },
	},
};

const notion = {
	dataSources: {
		query: async ({ data_source_id }: { data_source_id: string }) => {
			if (data_source_id === CLOSING_REPORT_DATA_SOURCE_ID) return { results: [] };
			if (data_source_id === DEAL_DATA_SOURCE_ID) return { results: [relatedDealPage] };
			return { results: [] };
		},
	},
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => {
			if (page_id === "project-1") return projectPage;
			if (page_id === "deal-1") return relatedDealPage;
			return {
				id: page_id,
				properties: {
					"承認スタンプ🤖": { type: "rich_text", rich_text: [] },
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
		create: async () => ({}),
	},
};

async function main() {
	const result = await processClosingReportForTest("project-1", notion as never, "trigger-user");

	assert.equal(result.action, "created");
	const dealUpdate = updates.find((update) => update.page_id === "deal-1");
	assert.ok(dealUpdate, "関連商談が更新されていない");
	assert.equal(
		((dealUpdate.properties as Record<string, unknown>).商談ステータス as { select: { name: string } }).select.name,
		"成約",
	);
	const closingCreate = creates[0] as {
		properties: {
			関連商談: { relation: Array<{ id: string }> };
		};
	};
	assert.equal(closingCreate.properties.関連商談.relation[0]?.id, "deal-1");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
