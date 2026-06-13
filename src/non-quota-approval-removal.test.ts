import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = readFileSync(path.join(__dirname, "index.ts"), "utf8");

const forbiddenWebhookNames = [
	"processClosingCancelWebhook",
	"processClosingDismissWebhook",
	"processProjectDismissWebhook",
	"processProjectCancelWebhook",
	"processProjectLostRequestWebhook",
	"processProjectLostApproveWebhook",
	"processProjectLostRejectWebhook",
];

const forbiddenManagerFlows = [
	"WAJO 成約取り消しWebhook",
	"WAJO 成約差し戻しWebhook",
	"WAJO 案件差し戻しWebhook",
	"WAJO 案件取り消しWebhook",
	"WAJO 案件失注承認Webhook",
	"WAJO 案件失注差し戻しWebhook",
	"マネージャーは後追いで差し戻し/取り消しを行います",
	"マネージャー用の失注承認ボタン",
	"マネージャー用の失注差し戻しボタン",
];

for (const name of forbiddenWebhookNames) {
	assert.equal(
		source.includes(`worker.webhook("${name}"`),
		false,
		`${name} must not be registered; approvals are only for quota and daily reports`,
	);
}

for (const text of forbiddenManagerFlows) {
	assert.equal(
		source.includes(text),
		false,
		`obsolete approval wording remains: ${text}`,
	);
}

assert.equal(
	source.includes('worker.webhook("processMonthlyQuotaLinkWebhook"'),
	true,
	"monthly quota webhook must remain because quota approval is still in scope",
);
assert.equal(
	source.includes('worker.webhook("processDailyReportLogWebhook"'),
	true,
	"daily report log webhook must remain because approved daily reports are still evaluation material",
);
