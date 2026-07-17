import assert from "node:assert/strict";
import {
	processInquiryProjectCreationWithInputsForTest,
} from "./index";

async function main() {
	let writes = 0;
	const notion = {
		pages: {
			update: async () => {
				writes += 1;
				throw new Error("dryRun must not update Notion");
			},
		},
	};
	const result = await processInquiryProjectCreationWithInputsForTest(
		{
			inquiryPageId: "synthetic-inquiry-page",
			plannedGrossProfit: 3000000,
			plannedGrossBasis: "案件多数見込み",
			dryRun: true,
		},
		notion as never,
	);
	assert.equal(result.action, "dry-run");
	assert.equal(result.writesExecuted, false);
	assert.equal(result.created, 0);
	assert.deepEqual(result.payload, {
		inquiryPageId: "synthetic-inquiry-page",
		plannedGrossProfit: 3000000,
		plannedGrossBasis: "案件多数見込み",
		dryRun: true,
	});
	assert.equal(writes, 0);
	await assert.rejects(
		() => processInquiryProjectCreationWithInputsForTest(
			{
				inquiryPageId: "synthetic-inquiry-page",
				plannedGrossProfit: 3000000,
				plannedGrossBasis: "無効な根拠",
				dryRun: true,
			},
			notion as never,
		),
		/plannedGrossBasis must be one of/,
	);
	console.log("inquiry-project-creation-with-inputs: OK");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
