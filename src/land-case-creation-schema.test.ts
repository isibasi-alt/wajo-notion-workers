import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

function functionBody(name: string): string {
	const marker = `async function ${name}`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${name} should exist`);
	const next = source.indexOf("\nasync function ", start + marker.length);
	return source.slice(start, next === -1 ? source.length : next);
}

const createProjectFromLand = functionBody("createProjectFromLand");

assert.doesNotMatch(
	createProjectFromLand,
	/獲得元区分\s*:/,
	"土地案件化は案件DBに存在しない 獲得元区分 を送ってはいけない",
);

assert.match(
	createProjectFromLand,
	/獲得ソース\s*:\s*select\("土地情報"\)/,
	"土地案件化は既存プロパティ 獲得ソース に土地情報を入れる",
);

assert.match(
	createProjectFromLand,
	/仕入れ元区分\s*:\s*select\("土地情報"\)/,
	"土地案件化は既存プロパティ 仕入れ元区分 に土地情報を入れる",
);

assert.match(
	createProjectFromLand,
	/売買区分\s*:\s*select\("売却案件"\)/,
	"土地案件化は 売買区分=売却案件 で固定する",
);
