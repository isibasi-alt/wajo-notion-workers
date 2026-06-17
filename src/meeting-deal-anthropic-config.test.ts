import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

function functionBody(name: string): string {
	const marker = `async function ${name}`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${name} should exist`);
	const signatureEnd = source.indexOf("):", start);
	assert.notEqual(signatureEnd, -1, `${name} should have a typed signature`);
	const open = source.indexOf("{", signatureEnd);
	assert.notEqual(open, -1, `${name} should have a body`);
	let depth = 0;
	for (let i = open; i < source.length; i += 1) {
		const char = source[i];
		if (char === "{") depth += 1;
		if (char === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}
	throw new Error(`${name} body was not closed`);
}

const anthropicTextCalls: Array<[string, string]> = [
	["callAnthropicMeetingMemoFormat", "MEETING_MEMO_RESPONSE_FORMAT"],
	["callAnthropicMeetingFeedback", "MEETING_FEEDBACK_RESPONSE_FORMAT"],
	["callAnthropicManagerReview", "MANAGER_REVIEW_RESPONSE_FORMAT"],
	["callAnthropicSalesPerformanceReview", "SALES_PERFORMANCE_REVIEW_RESPONSE_FORMAT"],
	["callAnthropicDealMeetingFeedback", "DEAL_MEETING_FEEDBACK_RESPONSE_FORMAT"],
	["callAnthropicSecondReview", "SECOND_REVIEW_RESPONSE_FORMAT"],
	["callAnthropicDealNextActions", "DEAL_NEXT_ACTION_RESPONSE_FORMAT"],
	["callAnthropicSalesTalkFinalize", "SALES_TALK_FINALIZE_RESPONSE_FORMAT"],
	["callAnthropicMeetingPrepReport", "MEETING_PREP_RESPONSE_FORMAT"],
];

for (const [name, responseFormatName] of anthropicTextCalls) {
	const body = functionBody(name);
	assert.match(
		body,
		/callAnthropicChat\(/,
		`${name} should use the Anthropic chat helper`,
	);
	assert.match(
		body,
		new RegExp(`jsonSchema:\\s*${responseFormatName}`),
		`${name} should pass its JSON schema to Anthropic structured outputs`,
	);
	assert.doesNotMatch(
		body,
		/api\.openai\.com\/v1\/chat\/completions/,
		`${name} should not call OpenAI chat completions`,
	);
	assert.doesNotMatch(
		body,
		/response_format:/,
		`${name} should not pass OpenAI response_format to Anthropic`,
	);
	assert.doesNotMatch(
		body,
		/process\.env\.OPENAI_API_KEY|resolveWajoOpenAiConfig\(process\.env\)/,
		`${name} should not read OpenAI config after the Anthropic migration`,
	);
}

const legacyProviderPrefix = ["call", "Open", "AI"].join("");
for (const staleSuffix of [
	"MeetingMemoFormat",
	"MeetingFeedback",
	"ManagerReview",
	"SalesPerformanceReview",
	"DealMeetingFeedback",
	"SecondReview",
	"DealNextActions",
	"SalesTalkFinalize",
	"MeetingPrepReport",
]) {
	assert.doesNotMatch(source, new RegExp(`async function ${legacyProviderPrefix}${staleSuffix}\\b`));
}

console.log("meeting-deal-anthropic-config.test.ts passed");
