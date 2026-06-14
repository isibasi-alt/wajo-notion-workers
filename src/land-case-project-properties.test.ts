import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const start = source.indexOf("async function createProjectFromLand");
const end = source.indexOf("async function markLandCaseLinked", start);
assert.ok(start >= 0, "createProjectFromLand が見つからない");
assert.ok(end > start, "createProjectFromLand の範囲を切り出せない");

const createProjectFromLand = source.slice(start, end);

assert.match(
	createProjectFromLand,
	/獲得ソース:\s*select\("土地情報"\)/,
	"土地案件化では既存プロパティの獲得ソースへ土地情報を書き込む",
);
assert.match(
	createProjectFromLand,
	/仕入れ元区分:\s*select\("土地情報"\)/,
	"土地案件化では既存プロパティの仕入れ元区分へ土地情報を書き込む",
);
assert.doesNotMatch(
	createProjectFromLand,
	/獲得元区分/,
	"案件DBに存在しない獲得元区分を書き込んではいけない",
);
