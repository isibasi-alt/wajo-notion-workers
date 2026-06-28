import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

function bodyForWebhook(name: string): string {
	const marker = `worker.webhook("${name}"`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${name} registration should exist`);
	const next = source.indexOf("\nworker.webhook(", start + marker.length);
	return source.slice(start, next === -1 ? source.length : next);
}

function functionBody(name: string): string {
	const marker = `function ${name}`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${name} should exist`);
	const next = source.indexOf("\nasync function ", start + marker.length);
	return source.slice(start, next === -1 ? source.length : next);
}

for (const name of [
	"processMeetingMemoFormatWebhook",
	"processMeetingFeedbackWebhook",
	"processMeetingDealLinkWebhook",
	"processLandCaseWebhook",
	"processBrokerActionWebhook",
]) {
	assert.doesNotMatch(
		bodyForWebhook(name),
		/\bverifyWebhookSecret\(/,
		`${name} is triggered by a Notion button URL and must not require WAJO_WORKER_WEBHOOK_SECRET`,
	);
}

for (const name of [
	"registerMeetingQuickStartWebhook",
	"registerDealQuickStartWebhook",
]) {
	assert.doesNotMatch(
		functionBody(name),
		/\bverifyWebhookSecret\(/,
		`${name} creates Notion button URL webhooks and must not require WAJO_WORKER_WEBHOOK_SECRET`,
	);
}
