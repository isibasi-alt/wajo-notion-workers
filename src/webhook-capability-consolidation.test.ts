import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

assert.doesNotMatch(source, /worker\.tool\("cleanInquiryTitles"/);
assert.match(source, /worker\.tool\("assignInquiryReceptionNumbers"/);

assert.match(source, /worker\.webhook\("processBusinessCardWebhook"/);
assert.doesNotMatch(source, /worker\.webhook\("processBusinessCardLinkWebhook"/);
assert.doesNotMatch(source, /worker\.webhook\("processBusinessCardResearchWebhook"/);
assert.match(source, /mode=link\/research/);
assert.match(source, /shouldForceBusinessCardRun\(body\)/);

console.log("webhook capability consolidation tests passed");
