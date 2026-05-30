import assert from "node:assert/strict";
import { SECOND_REVIEW_RESPONSE_FORMAT } from "./index";

assert.equal(SECOND_REVIEW_RESPONSE_FORMAT.type, "json_schema");
assert.equal(SECOND_REVIEW_RESPONSE_FORMAT.json_schema.name, "second_review");
assert.equal(SECOND_REVIEW_RESPONSE_FORMAT.json_schema.strict, true);
assert.deepEqual(SECOND_REVIEW_RESPONSE_FORMAT.json_schema.schema.required, [
	"quality",
	"summary",
	"strongPoints",
	"revisionSuggestions",
	"nextTalkUpgrade",
	"riskNotes",
	"recommendedStatus",
]);
assert.equal(
	SECOND_REVIEW_RESPONSE_FORMAT.json_schema.schema.properties.quality.enum.includes(
		"要修正",
	),
	true,
);
assert.equal(
	SECOND_REVIEW_RESPONSE_FORMAT.json_schema.schema.additionalProperties,
	false,
);
