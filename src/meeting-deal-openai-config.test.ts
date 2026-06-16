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

for (const name of [
	"callOpenAIMeetingMemoFormat",
	"callOpenAIMeetingFeedback",
	"callOpenAIManagerReview",
	"callOpenAISalesPerformanceReview",
	"callOpenAIDealMeetingFeedback",
	"callOpenAISecondReview",
	"callOpenAIDealNextActions",
	"callOpenAISalesTalkFinalize",
	"callOpenAIMeetingPrepReport",
]) {
	const body = functionBody(name);
	assert.match(
		body,
		/callAnthropicChat\(/,
		`${name} should use the Anthropic chat helper`,
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

console.log("meeting-deal-openai-config.test.ts passed");
