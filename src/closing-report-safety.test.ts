import assert from "node:assert/strict";
import { processClosingReportForTest } from "./index";

const updates: Array<Record<string, unknown>> = [];
const creates: Array<Record<string, unknown>> = [];

const notion = {
	dataSources: {
		query: async () => ({ results: [] }),
	},
	pages: {
		retrieve: async ({ page_id }: { page_id: string }) => ({
			id: page_id,
			properties: {
				案件名: {
					type: "title",
					title: [{ plain_text: "テスト案件" }],
				},
				売買区分: { type: "select", select: { name: "売却案件" } },
				対象物種別: { type: "select", select: { name: "土地" } },
				実績粗利額: { type: "number", number: 1230000 },
				担当営業ユーザー: { type: "people", people: [{ id: "existing-sales" }] },
				仕入れ担当: { type: "people", people: [] },
				関連企業: { type: "relation", relation: [{ id: "company-1" }] },
				ステータス: { type: "select", select: { name: "📋 提案中" } },
				成約日: { type: "date", date: null },
			},
		}),
		update: async (args: Record<string, unknown>) => {
			updates.push(args);
			return { id: args.page_id };
		},
		create: async (args: Record<string, unknown>) => {
			creates.push(args);
			return {
				id: "closing-1",
				url: "https://notion.so/closing-1",
				// 正本スタンプ列(1-2)が作成済みのDBを想定(列が無い場合のスキップは
				// approval-stamp.test.ts 側で担保)
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
	const result = await processClosingReportForTest(
		"project-1",
		notion as never,
		"trigger-user",
	);

	assert.equal(result.action, "created");
	assert.equal(result.closingPageId, "closing-1");

	const projectUpdate = updates[0] as {
		properties: {
			ステータス: { select: { name: string } };
			成約日?: unknown;
		};
	};
	assert.equal(projectUpdate.properties.ステータス.select.name, "🏆 成約");
	assert.equal(
		(projectUpdate.properties.成約日 as { date: { start: string } }).date.start.length,
		10,
	);

	const closingCreate = creates[0] as {
		properties: {
			承認ステータス?: unknown;
			関連案件: { relation: Array<{ id: string }> };
			担当営業ユーザー: { people: Array<{ id: string }> };
		};
	};
	// 旧「承認ステータス: 成約」は実機DBに存在しない列(退役リネーム済み)のため、
	// pages.create に含めない(含めると validation_error で成約報告の作成が落ちる)
	assert.equal(closingCreate.properties.承認ステータス, undefined);
	assert.equal(closingCreate.properties.関連案件.relation[0]?.id, "project-1");
	assert.equal(closingCreate.properties.担当営業ユーザー.people[0]?.id, "existing-sales");

	// 正本スタンプ(1-2): 成約確定の完了時点でWorkerが「承認者ID|ISO日時|操作|コミット」を書く
	const stampUpdate = updates.find(
		(u) =>
			u.page_id === "closing-1" &&
			(u.properties as Record<string, unknown>)["承認スタンプ🤖"] !== undefined,
	);
	assert.ok(stampUpdate, "成約確定の正本スタンプが書かれていない");
	const stampText = (
		(stampUpdate!.properties as Record<string, unknown>)["承認スタンプ🤖"] as {
			rich_text: Array<{ text: { content: string } }>;
		}
	).rich_text
		.map((r) => r.text.content)
		.join("");
	const stampParts = stampText.split("|");
	assert.equal(stampParts.length, 4, `スタンプ書式が崩れている: ${stampText}`);
	assert.equal(stampParts[0], "trigger-user");
	assert.equal(stampParts[2], "成約確定");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
