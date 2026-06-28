#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const WORKER_ID =
	process.env.SHOUTA_VERIFY_WORKER_ID || "019e452d-22e7-7de1-b5ea-432a297bb478";
const COMPANY_ID =
	process.env.SHOUTA_VERIFY_COMPANY_ID ||
	process.argv.find((arg) => arg.startsWith("--company="))?.slice("--company=".length) ||
	"064b059f-c3ae-49f8-825d-28bc51a679a6";
const FORCE =
	process.env.SHOUTA_VERIFY_FORCE === "1" || process.argv.includes("--force");
const CAPABILITY = "processMeetingPrepReportByCompanyId";
const TARGET_RUN_NAME = `tool:${CAPABILITY}`;
const NOTION_VERSION = "2026-03-11";
const MEETING_PREP_REPORT_DATA_SOURCE_ID =
	process.env.MEETING_PREP_REPORT_DATA_SOURCE_ID ||
	"8db2bce8-66ab-428b-9fcb-4a36b9646922";
const CREATE_TEST_REPORT =
	process.env.SHOUTA_VERIFY_CREATE_TEST_REPORT !== "0" &&
	!process.argv.includes("--no-create-test-report");
const EXPECT_WORKER_SHOUTA_STOPPED =
	process.env.SHOUTA_VERIFY_EXPECT_STOPPED === "1" ||
	process.argv.includes("--expect-stopped");

const EXISTING_FIELDS = [
	"企業プロフィール",
	"3C分析",
	"商談仮説",
	"ヒアリングリスト",
	"注意点・リスク",
];
const SHOUTA_FIELDS = [
	"商太｜商談トーク",
	"商太｜商談の入り方",
	"商太｜提案ポイント",
	"商太｜想定されるポイントと返し",
	"商太｜最後に確認すること",
];
const FORBIDDEN_EXTRA_RUN_PATTERNS = [
	/processBusinessCard/,
	/processCompanyResearch/,
	/quickStartDeal/,
];

function runNtn(args, options = {}) {
	const result = spawnSync("npx", ["ntn", ...args], {
		cwd: process.cwd(),
		env: { ...process.env, NOTION_KEYRING: "0" },
		encoding: "utf8",
		timeout: options.timeout ?? 180000,
		maxBuffer: 20 * 1024 * 1024,
	});
	return {
		status: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
		error: result.error ? String(result.error.message || result.error) : "",
	};
}

function stripAnsi(value) {
	return String(value ?? "").replace(/\x1b\[[0-9;]*m/g, "");
}

function parseJsonOutput(output) {
	const text = stripAnsi(output).trim();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		const start = text.indexOf("{");
		const end = text.lastIndexOf("}");
		if (start >= 0 && end > start) {
			try {
				return JSON.parse(text.slice(start, end + 1));
			} catch {
				return null;
			}
		}
		return null;
	}
}

function ntnJson(args) {
	const result = runNtn(args);
	if (result.status !== 0) {
		throw new Error(
			`ntn ${args.join(" ")} failed (${result.status})\n${result.stderr}\n${result.stdout}`,
		);
	}
	const parsed = parseJsonOutput(result.stdout);
	if (!parsed) throw new Error(`ntn ${args.join(" ")} did not return JSON`);
	return parsed;
}

function page(pageId) {
	return ntnJson(["api", `/v1/pages/${pageId}`, "--notion-version", NOTION_VERSION]);
}

function createPage(body) {
	return ntnJson([
		"api",
		"/v1/pages",
		"--notion-version",
		NOTION_VERSION,
		"--method",
		"POST",
		"--data",
		JSON.stringify(body),
	]);
}

function runs() {
	return ntnJson(["workers", "runs", "list", WORKER_ID, "--json"]);
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function plainText(prop) {
	if (!prop || typeof prop !== "object") return "";
	if (Array.isArray(prop.title)) return prop.title.map((item) => item.plain_text ?? "").join("");
	if (Array.isArray(prop.rich_text)) {
		return prop.rich_text.map((item) => item.plain_text ?? "").join("");
	}
	if (prop.select?.name) return String(prop.select.name);
	if (Array.isArray(prop.relation)) return prop.relation.map((item) => item.id).join(",");
	if (Array.isArray(prop.people)) return prop.people.map((item) => item.name ?? item.id).join(",");
	if (prop.date?.start) return String(prop.date.start);
	return "";
}

function relationIds(prop) {
	return Array.isArray(prop?.relation) ? prop.relation.map((item) => item.id).filter(Boolean) : [];
}

function readFields(pageObject, fields) {
	const props = pageObject?.properties ?? {};
	return Object.fromEntries(fields.map((name) => [name, plainText(props[name]).trim()]));
}

function richText(value) {
	return { rich_text: [{ type: "text", text: { content: value } }] };
}

function title(value) {
	return { title: [{ type: "text", text: { content: value } }] };
}

function relation(id) {
	return { relation: [{ id }] };
}

function select(name) {
	return { select: { name } };
}

function createVerificationReport(companyId) {
	const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
	const sentinel = {
		企業プロフィール: `商太live品質検証用の既存欄です。九州エリアの発電所出口整理を相談する想定。検証ID ${stamp}`,
		"3C分析": `顧客はFIT満了後の売電単価低下とPCS更新タイミングを気にしている。競合は売却査定だけで、蓄電池併設の話が薄い。検証ID ${stamp}`,
		商談仮説: `初回は売却を迫らず、出口の選択肢（継続保有、売却、蓄電池併設）を比較表で整理する。検証ID ${stamp}`,
		ヒアリングリスト: `FIT満了年、PCS更新時期、発電所一覧、売却希望時期、電力契約を確認する。検証ID ${stamp}`,
		"注意点・リスク": `断定せず、まず発電所一覧と電力契約を確認する。一般論だけで入らない。検証ID ${stamp}`,
	};
	return createPage({
		parent: { data_source_id: MEETING_PREP_REPORT_DATA_SOURCE_ID },
		properties: {
			"企業名（商談日）": title(`【商太live検証】${stamp}`),
			対象企業: relation(companyId),
			ステータス: select("準備中"),
			...Object.fromEntries(
				Object.entries(sentinel).map(([key, value]) => [key, richText(value)]),
			),
		},
	});
}

function hasAll(values) {
	return Object.values(values).every((value) => String(value).trim().length > 0);
}

function hasNone(values) {
	return Object.values(values).every((value) => String(value).trim().length === 0);
}

function diffChanged(before, after) {
	return Object.keys(before).filter((key) => before[key] && before[key] !== after[key]);
}

const QUALITY_MATERIAL_TOKENS = [
	"FIT満了",
	"PCS更新",
	"蓄電池併設",
	"出口",
	"発電所一覧",
	"電力契約",
	"継続保有",
	"売却希望時期",
];
const GENERIC_ESCAPE_PATTERNS = [
	/具体的なニーズを確認/,
	/再エネの可能性を広げ/,
	/まずは情報交換/,
	/御社の課題を教えてください/,
	/社名から/,
	/可能性が高いとお見受け/,
	/どんなプロジェクトに注力/,
];

function qualityHits(shoutaFields) {
	const text = Object.values(shoutaFields).join("\n");
	return QUALITY_MATERIAL_TOKENS.filter((token) => text.includes(token));
}

function genericEscapes(shoutaFields) {
	const text = Object.values(shoutaFields).join("\n");
	return GENERIC_ESCAPE_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
}

function openingQualityHits(shoutaFields) {
	return QUALITY_MATERIAL_TOKENS.filter((token) => String(shoutaFields["商太｜商談の入り方"] ?? "").includes(token));
}

function latestTargetRunAfter(runList, beforeStartedAt, beforeIds) {
	return runList
		.filter((run) => run.name === TARGET_RUN_NAME)
		.filter((run) => !beforeIds.has(run.runId))
		.filter((run) => new Date(run.startedAt).getTime() >= beforeStartedAt - 1000)
		.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
}

async function waitForTargetRun(beforeStartedAt, beforeIds) {
	for (let index = 0; index < 36; index += 1) {
		const list = runs();
		const run = latestTargetRunAfter(list, beforeStartedAt, beforeIds);
		if (run && run.exitCode !== null && run.endedAt) return { run, list };
		await sleep(5000);
	}
	throw new Error("商太対象runが時間内に完了しませんでした");
}

async function main() {
	const beforeRuns = runs();
	const beforeIds = new Set(beforeRuns.map((run) => run.runId));
	const beforeStartedAt = Date.now();

	const companyBefore = page(COMPANY_ID);
	const createdVerificationReport = CREATE_TEST_REPORT ? createVerificationReport(COMPANY_ID) : null;
	const beforeReportIds = relationIds(companyBefore.properties?.["関連商談準備レポート"]);
	const beforeReportId = createdVerificationReport?.id || beforeReportIds[0] || null;
	const beforeReport = beforeReportId ? page(beforeReportId) : null;
	const beforeExistingFields = beforeReport ? readFields(beforeReport, EXISTING_FIELDS) : {};

	const execInput = {
		companyPageId: COMPANY_ID,
		reportPageId: beforeReportId || "",
		dryRun: false,
		force: FORCE,
	};
	const execResult = runNtn(
		[
			"workers",
			"exec",
			CAPABILITY,
			"--worker-id",
			WORKER_ID,
			"-d",
			JSON.stringify(execInput),
		],
		{ timeout: 240000 },
	);
	const execJson = parseJsonOutput(execResult.stdout);

	const { run, list: afterRuns } = await waitForTargetRun(beforeStartedAt, beforeIds);
	if (run.exitCode !== 0) {
		throw new Error(`商太対象runが exit ${run.exitCode}: ${run.runId}`);
	}

	const companyAfter = page(COMPANY_ID);
	const afterReportIds = relationIds(companyAfter.properties?.["関連商談準備レポート"]);
	const reportId = execJson?.reportId || afterReportIds[0] || beforeReportId;
	if (!reportId) throw new Error("商談前準備レポートIDを特定できませんでした");

	const reportAfter = page(reportId);
	const afterExistingFields = readFields(reportAfter, EXISTING_FIELDS);
	const shoutaFields = readFields(reportAfter, SHOUTA_FIELDS);
	const changedExistingFields = beforeReport ? diffChanged(beforeExistingFields, afterExistingFields) : [];

	const extraRuns = afterRuns.filter((candidate) => {
		if (beforeIds.has(candidate.runId)) return false;
		if (candidate.runId === run.runId) return false;
		return FORBIDDEN_EXTRA_RUN_PATTERNS.some((pattern) => pattern.test(candidate.name));
	});

	const checks = {
		workerShoutaStopped: execJson?.action === "skipped-worker-shouta",
		shoutaFieldsEmpty: hasNone(shoutaFields),
		shoutaFieldsUpdated: hasAll(shoutaFields),
		existingFieldsStillPresent: hasAll(afterExistingFields),
		existingFieldsChanged: changedExistingFields,
		qualityMaterialHits: qualityHits(shoutaFields),
		openingMaterialHits: openingQualityHits(shoutaFields),
		genericEscapeHits: genericEscapes(shoutaFields),
		forbiddenExtraRuns: extraRuns.map((item) => ({
			runId: item.runId,
			name: item.name,
			exitCode: item.exitCode,
			startedAt: item.startedAt,
		})),
	};

	const failed = [];
	if (EXPECT_WORKER_SHOUTA_STOPPED) {
		if (!checks.workerShoutaStopped) {
			failed.push(`Worker商太停止actionではありません: ${execJson?.action ?? "unknown"}`);
		}
		if (!checks.shoutaFieldsEmpty) failed.push("停止確認用レポートの商太5欄が空ではありません");
		if (!checks.existingFieldsStillPresent) failed.push("既存5欄に空欄があります");
		if (checks.existingFieldsChanged.length > 0 && !FORCE) {
			failed.push(`既存5欄が変更されています: ${checks.existingFieldsChanged.join(", ")}`);
		}
	} else {
		if (!checks.shoutaFieldsUpdated) failed.push("商太5欄が全て埋まっていません");
		if (!checks.existingFieldsStillPresent) failed.push("既存5欄に空欄があります");
		if (checks.existingFieldsChanged.length > 0 && !FORCE) {
			failed.push(`既存5欄が変更されています: ${checks.existingFieldsChanged.join(", ")}`);
		}
		if (checks.qualityMaterialHits.length < 3) {
			failed.push(`商太出力が既存5欄の固有材料を十分に踏んでいません: ${checks.qualityMaterialHits.join(", ") || "なし"}`);
		}
		if (checks.openingMaterialHits.length < 1) {
			failed.push("商談の入り方が既存5欄の固有材料を踏んでいません");
		}
		if (checks.genericEscapeHits.length > 0) {
			failed.push(`商太出力に一般論逃げ表現があります: ${checks.genericEscapeHits.join(", ")}`);
		}
	}
	if (checks.forbiddenExtraRuns.length > 0) {
		failed.push("名刺入口・企業マスター高密度化・quickStartDeal系の余計なrunがあります");
	}

	const summary = {
		workerId: WORKER_ID,
		companyId: COMPANY_ID,
		reportId,
		createdVerificationReportId: createdVerificationReport?.id ?? null,
		exec: {
			status: execResult.status,
			parsed: execJson,
			stderr: execResult.stderr.trim(),
			error: execResult.error,
		},
		run: {
			runId: run.runId,
			name: run.name,
			exitCode: run.exitCode,
			startedAt: run.startedAt,
			endedAt: run.endedAt,
		},
		expectWorkerShoutaStopped: EXPECT_WORKER_SHOUTA_STOPPED,
		checks,
		shoutaFields,
		shoutaFieldLengths: Object.fromEntries(
			Object.entries(shoutaFields).map(([key, value]) => [key, value.length]),
		),
		existingFieldLengths: Object.fromEntries(
			Object.entries(afterExistingFields).map(([key, value]) => [key, value.length]),
		),
	};

	console.log(JSON.stringify(summary, null, 2));
	if (failed.length > 0) {
		throw new Error(failed.join(" / "));
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
