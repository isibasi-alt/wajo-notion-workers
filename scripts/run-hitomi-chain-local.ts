// ローカル実走：人見さん月次評価 6体自動連鎖（A→B→C→D→C再→D再→E→F）を実LLMで1回流す。
// 目的＝「自動連鎖が人手ゼロで回る」ことの実機証明。書込先はテストページ。
//   実行: node --import tsx scripts/run-hitomi-chain-local.ts
//   鍵は .env / .env.worker.local から読む（値は出力しない）。
import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
import { runHitomiEvalChain } from "../src/hitomi-eval-chain";

function loadEnv(path: string) {
	try {
		for (const line of readFileSync(path, "utf8").split("\n")) {
			const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
			if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
		}
	} catch {}
}
loadEnv(".env");
loadEnv(".env.worker.local");

const token = process.env.NOTION_API_TOKEN || process.env.NOTION_TOKEN;
if (!token) throw new Error("NOTION_API_TOKEN なし");
if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY なし");

const notion = new Client({ auth: token });
const TEST_PAGE = "3874d017-81e7-81f2-9a35-c86f1f3da150";

async function countHeadings(): Promise<string[]> {
	const heads: string[] = [];
	let cursor: string | undefined;
	do {
		const r = await notion.blocks.children.list({ block_id: TEST_PAGE, page_size: 100, start_cursor: cursor });
		for (const b of r.results as any[]) {
			if (b.type === "heading_2") {
				heads.push((b.heading_2?.rich_text ?? []).map((t: any) => t.plain_text ?? "").join(""));
			}
		}
		cursor = r.has_more ? r.next_cursor ?? undefined : undefined;
	} while (cursor);
	return heads;
}

(async () => {
	const before = await countHeadings();
	console.log(`[run] 実行前の見出し数: ${before.length}`);
	const t0 = Date.now();
	await runHitomiEvalChain(notion as any, TEST_PAGE);
	console.log(`[run] 連鎖完了 (${Math.round((Date.now() - t0) / 1000)}秒)`);
	const after = await countHeadings();
	console.log(`[run] 実行後の見出し数: ${after.length}（+${after.length - before.length}）`);
	console.log("[run] 今回追記された見出し（末尾）:");
	for (const h of after.slice(before.length)) console.log("   ・" + h);
})().catch((e) => {
	console.error("[run] ERROR:", String(e).slice(0, 500));
	process.exit(1);
});
