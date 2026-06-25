#!/usr/bin/env node
// ============================================================================
// カンベイ・ゲート（CDの門番）
// ----------------------------------------------------------------------------
// CD = 「カンベイが本物のOKを出すまで回す連鎖」の門番。
// デプロイ候補の変更(diff)を 軍師カンベイ(Claude Opus) が忖度なく検証し、
//   ACCEPT  → exit 0（deploy解放）
//   CONCERN → exit 1（穴あり・deployブロック）
//   REJECT  → exit 1（出すな・deployブロック）
// 忖度で頷かせない。本気で穴が無い時だけ ACCEPT。
//
// 使い方: ANTHROPIC_API_KEY を環境に置いて `node scripts/kanbei-gate.mjs`
//   KANBEI_BASE_REF（既定 origin/main）との差分を検証する。
// ============================================================================

import { execSync } from "node:child_process";

const KANBEI_SYSTEM = `あなたは軍師カンベイ（官兵衛）。和上ホールディングスのCDゲートの検証役です。
忖度しない。「同意するだけの軍師」にならない。うまくいく前提を疑い、穴・反証・リスク・未テストを突く。
渡された「本番デプロイ候補の変更(diff)」を独立に検証し、本番に出して安全かを判定せよ。
重大な穴（壊れる/未テスト/秘密漏れ/破壊的変更/意図不明）が一つでもあれば ACCEPT を出してはならない。
応答の最後の行に、必ず次のいずれか一つだけを出力すること：
VERDICT: ACCEPT
VERDICT: CONCERN
VERDICT: REJECT
ACCEPT は忖度でなく、本気で穴が無いと言い切れる時だけ。理由を先に簡潔に述べてから VERDICT 行を出せ。`;

async function callKanbei(userText) {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		console.error("[kanbei-gate] ANTHROPIC_API_KEY が未設定です。");
		process.exit(2);
	}
	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: "claude-opus-4-8",
			max_tokens: 2048,
			system: KANBEI_SYSTEM,
			messages: [{ role: "user", content: userText }],
		}),
	});
	if (!res.ok) {
		console.error(`[kanbei-gate] Anthropic ${res.status}: ${(await res.text()).slice(0, 500)}`);
		process.exit(2);
	}
	const j = await res.json();
	return (j.content ?? [])
		.filter((c) => c.type === "text" && typeof c.text === "string")
		.map((c) => c.text)
		.join("\n");
}

function getDiff() {
	const base = process.env.KANBEI_BASE_REF || "origin/main";
	try {
		return execSync(`git diff ${base}...HEAD`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
	} catch {
		try {
			return execSync("git diff HEAD~1...HEAD", { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
		} catch {
			return "";
		}
	}
}

const diff = getDiff();
if (!diff.trim()) {
	console.log("[kanbei-gate] 差分なし → SKIP（exit 0）");
	process.exit(0);
}

const verdict = await callKanbei(
	`# 本番デプロイ候補の変更(diff)\n\n${diff.slice(0, 120000)}\n\n上記を検証し、最後に VERDICT 行を出せ。`,
);
console.log("──────── カンベイの判定 ────────");
console.log(verdict);
console.log("────────────────────────────────");

const m = verdict.match(/VERDICT:\s*(ACCEPT|CONCERN|REJECT)/i);
const v = m ? m[1].toUpperCase() : "REJECT";
if (v === "ACCEPT") {
	console.log("[kanbei-gate] 本物のOK → deploy 解放（exit 0）");
	process.exit(0);
}
console.error(`[kanbei-gate] ${v} → deploy ブロック（exit 1）`);
process.exit(1);
