import assert from "node:assert/strict";
import { processProjectEquipmentDetailRequestForTest } from "./index";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function relationProp(ids: string[]) {
	return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function projectPage(equipmentIds: string[] = []) {
	return {
		id: "project-1",
		url: "https://www.notion.so/project-1",
		properties: {
			案件名: titleProp("湖南市250kW 太陽光案件"),
			発電所設備詳細: relationProp(equipmentIds),
			資料作成メモ: richTextProp(""),
			所在地: richTextProp("滋賀県湖南市"),
			発電所住所: richTextProp("滋賀県湖南市サンプル1-1"),
		},
	};
}

function makeNotion(options: { equipmentIds?: string[] } = {}) {
	const creates: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const comments: Array<Record<string, unknown>> = [];
	const notion = {
		pages: {
			retrieve: async ({ page_id }: { page_id: string }) => {
				if (page_id === "equipment-existing") {
					return {
						id: "equipment-existing",
						url: "https://www.notion.so/equipment-existing",
						properties: {
							設備詳細名: titleProp("既存設備詳細"),
						},
					};
				}
				assert.equal(page_id, "project-1");
				return projectPage(options.equipmentIds ?? []);
			},
			create: async (args: Record<string, unknown>) => {
				creates.push(args);
				return {
					id: "equipment-created",
					url: "https://www.notion.so/equipment-created",
					properties: {},
				};
			},
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
		},
		comments: {
			create: async (args: Record<string, unknown>) => {
				comments.push(args);
				return {};
			},
		},
	};
	return { notion, creates, updates, comments };
}

async function main() {
	const createCase = makeNotion();

	const created = await processProjectEquipmentDetailRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		createCase.notion as never,
	);

	assert.equal(created.action, "created");
	assert.equal(created.equipmentPageId, "equipment-created");
	assert.equal(createCase.creates.length, 1);
	const createProps = createCase.creates[0]!.properties as Record<string, unknown>;
	assert.deepEqual(
		(createProps.関連案件 as { relation: Array<{ id: string }> }).relation,
		[{ id: "project-1" }],
	);
	assert.equal(
		(createProps.所在地 as { rich_text: Array<{ text: { content: string } }> }).rich_text[0]!.text.content,
		"滋賀県湖南市",
	);
	assert.equal(createCase.updates.length, 1);
	assert.deepEqual(
		(createCase.updates[0]!.properties as Record<string, { relation: Array<{ id: string }> }>).発電所設備詳細.relation,
		[{ id: "equipment-created" }],
	);
	assert.equal(createCase.comments.length, 1);

	const existingCase = makeNotion({ equipmentIds: ["equipment-existing"] });

	const existing = await processProjectEquipmentDetailRequestForTest(
		{ projectPageId: "project-1", dryRun: false },
		existingCase.notion as never,
	);

	assert.equal(existing.action, "existing");
	assert.equal(existing.equipmentPageId, "equipment-existing");
	assert.equal(existingCase.creates.length, 0);
	assert.equal(existingCase.updates.length, 0);
	assert.equal(existingCase.comments.length, 1);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
