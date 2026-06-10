import assert from "node:assert/strict";
import {
	resolveProductionVoiceAiConfigForTest,
	resolveProductionEnvValueForTest,
} from "./index";

async function main() {
	const openAiOnly = resolveProductionVoiceAiConfigForTest({
		OPENAI_API_KEY: "openai-key",
		OPENAI_MODEL: "gpt-4.1-mini",
	});
	assert.equal(openAiOnly.provider, "openai");
	assert.equal(openAiOnly.apiKey, "openai-key");
	assert.equal(openAiOnly.model, "gpt-4.1-mini");

	const wajoOpenAiOnly = resolveProductionVoiceAiConfigForTest({
		WAJO_OPENAI_API_KEY: "wajo-openai-key",
		WAJO_OPENAI_MODEL: "gpt-4.1-nano",
	});
	assert.equal(wajoOpenAiOnly.provider, "openai");
	assert.equal(wajoOpenAiOnly.apiKey, "wajo-openai-key");
	assert.equal(wajoOpenAiOnly.model, "gpt-4.1-nano");

	const anthropicFirst = resolveProductionVoiceAiConfigForTest({
		ANTHROPIC_API_KEY: "anthropic-key",
		ANTHROPIC_MODEL: "claude-test",
		OPENAI_API_KEY: "openai-key",
	});
	assert.equal(anthropicFirst.provider, "anthropic");
	assert.equal(anthropicFirst.apiKey, "anthropic-key");
	assert.equal(anthropicFirst.model, "claude-test");

	const none = resolveProductionVoiceAiConfigForTest({});
	assert.equal(none.provider, "none");
	assert.equal(none.apiKey, "");

	assert.equal(
		resolveProductionEnvValueForTest(
			{
				WAJO_PRODUCTION_FIELD_VOICE_DB_ID: "wajo-id",
				NOTION_FIELD_VOICE_DB_ID: "notion-id",
			},
			"WAJO_PRODUCTION_FIELD_VOICE_DB_ID",
			"NOTION_FIELD_VOICE_DB_ID",
			"<fallback>",
		),
		"wajo-id",
	);
	assert.equal(
		resolveProductionEnvValueForTest(
			{
				NOTION_FIELD_VOICE_DB_ID: "notion-id",
			},
			"WAJO_PRODUCTION_FIELD_VOICE_DB_ID",
			"NOTION_FIELD_VOICE_DB_ID",
			"<fallback>",
		),
		"notion-id",
	);
	assert.equal(
		resolveProductionEnvValueForTest(
			{},
			"WAJO_PRODUCTION_FIELD_VOICE_DB_ID",
			"NOTION_FIELD_VOICE_DB_ID",
			"<fallback>",
		),
		"<fallback>",
	);

	assert.equal(
		resolveProductionEnvValueForTest(
			{
				WAJO_OPENAI_API_KEY: "wajo-openai-key",
				OPENAI_API_KEY: "legacy-openai-key",
			},
			"WAJO_OPENAI_API_KEY",
			"OPENAI_API_KEY",
			"",
		),
		"wajo-openai-key",
	);
	assert.equal(
		resolveProductionEnvValueForTest(
			{
				OPENAI_API_KEY: "legacy-openai-key",
			},
			"WAJO_OPENAI_API_KEY",
			"OPENAI_API_KEY",
			"",
		),
		"legacy-openai-key",
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
