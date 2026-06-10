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
	"callOpenAIDealMeetingFeedback",
	"callOpenAISecondReview",
	"callOpenAIDealNextActions",
]) {
	const body = functionBody(name);
	assert.match(
		body,
		/resolveWajoOpenAiConfig\(process\.env\)/,
		`${name} should accept WAJO_OPENAI_API_KEY before legacy OPENAI_API_KEY`,
	);
	assert.doesNotMatch(
		body,
		/const apiKey = process\.env\.OPENAI_API_KEY/,
		`${name} should not read only the legacy OPENAI_API_KEY`,
	);
}

console.log("meeting-deal-openai-config.test.ts passed");
