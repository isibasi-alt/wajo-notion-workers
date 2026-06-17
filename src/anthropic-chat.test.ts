import assert from "node:assert/strict";
import {
	callAnthropicChatForTest,
	DEAL_MEETING_FEEDBACK_RESPONSE_FORMAT,
} from "./index";

async function main() {
	const originalFetch = globalThis.fetch;
	const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
	const originalWajoAnthropicKey = process.env.WAJO_ANTHROPIC_API_KEY;
	const originalAnthropicModel = process.env.ANTHROPIC_MODEL;
	const originalWajoAnthropicModel = process.env.WAJO_ANTHROPIC_MODEL;
	let capturedUrl = "";
	let capturedInit: RequestInit | undefined;

	process.env.WAJO_ANTHROPIC_API_KEY = "test-anthropic-key";
	process.env.WAJO_ANTHROPIC_MODEL = "claude-test-model";
	delete process.env.ANTHROPIC_API_KEY;
	delete process.env.ANTHROPIC_MODEL;

	globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
		capturedUrl = String(url);
		capturedInit = init;
		return {
			ok: true,
			json: async () => ({
				content: [{ type: "text", text: "{\"ok\":true}" }],
			}),
		} as Response;
	};

	try {
		const raw = await callAnthropicChatForTest({
			system: "system prompt",
			user: "user prompt",
			maxTokens: 1234,
			temperature: 0,
			jsonSchema: DEAL_MEETING_FEEDBACK_RESPONSE_FORMAT,
		});

		assert.equal(raw, "{\"ok\":true}");
		assert.equal(capturedUrl, "https://api.anthropic.com/v1/messages");
		assert.equal(capturedInit?.method, "POST");
		assert.equal((capturedInit?.headers as Record<string, string>)["x-api-key"], "test-anthropic-key");
		assert.equal(
			(capturedInit?.headers as Record<string, string>)["anthropic-version"],
			"2023-06-01",
		);
		assert.equal((capturedInit?.headers as Record<string, string>)["content-type"], "application/json");

		const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
		assert.equal(body.model, "claude-test-model");
		assert.equal(body.max_tokens, 1234);
		assert.equal(body.system, "system prompt");
		assert.deepEqual(body.messages, [{ role: "user", content: "user prompt" }]);
		assert.equal(body.temperature, 0);
		assert.equal(body.response_format, undefined);
		assert.deepEqual(body.output_config, {
			format: {
				type: "json_schema",
				schema: {
					type: "object",
					additionalProperties: false,
					required: [
						"score",
						"salesFeedback",
						"improvementPoints",
						"nextTalkImage",
						"followMailHint",
						"closingHint",
						"status",
						"memo",
					],
					properties: {
						score: { type: "number" },
						salesFeedback: { type: "string" },
						improvementPoints: {
							type: "array",
							items: { type: "string" },
						},
						nextTalkImage: { type: "string" },
						followMailHint: { type: "string" },
						closingHint: { type: "string" },
						status: {
							type: "string",
							enum: ["返却済", "要確認", "対象外"],
						},
						memo: { type: "string" },
					},
				},
			},
		});
	} finally {
		globalThis.fetch = originalFetch;
		if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
		else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
		if (originalWajoAnthropicKey === undefined) delete process.env.WAJO_ANTHROPIC_API_KEY;
		else process.env.WAJO_ANTHROPIC_API_KEY = originalWajoAnthropicKey;
		if (originalAnthropicModel === undefined) delete process.env.ANTHROPIC_MODEL;
		else process.env.ANTHROPIC_MODEL = originalAnthropicModel;
		if (originalWajoAnthropicModel === undefined) delete process.env.WAJO_ANTHROPIC_MODEL;
		else process.env.WAJO_ANTHROPIC_MODEL = originalWajoAnthropicModel;
	}

	console.log("anthropic-chat.test.ts passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
