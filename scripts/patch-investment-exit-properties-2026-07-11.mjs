import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const NOTION_CWD = "/Users/isibasidaisuke/wajo-notion-workers";
const DATA_SOURCE_ID = "7e4d0168-6e54-4071-bd55-f9730202225c";
const NOTION_VERSION = "2026-03-11";
const BASE_ENV = { ...process.env, NOTION_KEYRING: "0" };

const PROPERTIES = {
	土地代ゼロ確認: { checkbox: {} },
	権利代ゼロ確認: { checkbox: {} },
	投資構成確認: { rich_text: {} },
	出口想定年数: { number: { format: "number" } },
	出口想定売却価格: { number: { format: "yen" } },
	出口費用率: { number: { format: "number" } },
	出口時残債: { number: { format: "yen" } },
	出口手取り: { number: { format: "yen" } },
	出口エクイティNPV: { number: { format: "yen" } },
	出口エクイティIRR: { number: { format: "number" } },
};

const VIEWS = [
	{
		id: "38e4d017-81e7-8185-a9f4-000c06f0ce7d",
		name: "営業用｜ファイナンス入力",
		properties: [
			"Name", "関連提案シミュレーション", "借入額", "借入比率", "金利", "返済期間", "自己資金",
			"実効税率", "今期利益見込", "流動比率", "利益剰余金", "自己資本比率",
			"土地代", "土地代ゼロ確認", "システム本体価格", "権利代", "権利代ゼロ確認",
			"出口想定年数", "出口想定売却価格", "出口費用率", "即時償却適用", "ファイナンス状態", "ファイナンスメモ",
		],
	},
	{
		id: "38e4d017-81e7-81e8-ac3c-000c37ecdbeb",
		name: "営業用｜ファイナンス判定",
		properties: [
			"Name", "関連提案シミュレーション", "投資構成確認", "年間返済額", "年間元本返済額", "年間利息額",
			"年間償却額", "税効果", "税引後キャッシュフロー", "経済メリット", "DSCR", "NPV", "IRR",
			"出口時残債", "出口手取り", "出口エクイティNPV", "出口エクイティIRR",
			"実質金利", "アドオン金利", "購入タイミング判定", "購入タイミング理由", "B/S評価メモ", "金利メモ", "ファイナンス状態",
		],
	},
];

function notion(args, body) {
	const stdout = execFileSync(
		"/Users/isibasidaisuke/.local/bin/ntn",
		["api", ...args, "--notion-version", NOTION_VERSION],
		{
			cwd: NOTION_CWD,
			env: BASE_ENV,
			input: body ? JSON.stringify(body) : undefined,
			encoding: "utf8",
			maxBuffer: 60 * 1024 * 1024,
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 30_000,
		},
	);
	return stdout.trim() ? JSON.parse(stdout) : null;
}

function compactSchema(dataSource) {
	return Object.fromEntries(
		Object.keys(PROPERTIES).map((name) => {
			const property = dataSource.properties?.[name];
			return [name, property ? { id: property.id, type: property.type } : null];
		}),
	);
}

function updateView(dataSource, spec) {
	const missing = spec.properties.filter((name) => !dataSource.properties?.[name]);
	if (missing.length > 0) throw new Error(`${spec.name} のプロパティ不足: ${missing.join(", ")}`);
	const configuration = {
		type: "table",
		frozen_column_index: 1,
		wrap_cells: true,
		properties: spec.properties.map((name) => ({ property_id: dataSource.properties[name].id, visible: true })),
	};
	notion([`/v1/views/${spec.id}`, "-X", "PATCH"], { name: spec.name, configuration });
	const verified = notion([`/v1/views/${spec.id}`]);
	return {
		id: verified.id,
		name: verified.name,
		visibleProperties: (verified.configuration?.properties ?? [])
			.filter((property) => property.visible !== false)
			.map((property) => property.property_name),
	};
}

const before = notion([`/v1/data_sources/${DATA_SOURCE_ID}`]);
const missingProperties = Object.fromEntries(
	Object.entries(PROPERTIES).filter(([name]) => !before.properties?.[name]),
);
if (Object.keys(missingProperties).length > 0) {
	notion([`/v1/data_sources/${DATA_SOURCE_ID}`, "-X", "PATCH"], {
		properties: missingProperties,
	});
}
const after = notion([`/v1/data_sources/${DATA_SOURCE_ID}`]);
const views = VIEWS.map((view) => updateView(after, view));
const evidence = {
	action: "patch-investment-exit-properties",
	dataSourceId: DATA_SOURCE_ID,
	added: Object.keys(missingProperties),
	before: compactSchema(before),
	after: compactSchema(after),
	views,
	ok: Object.keys(PROPERTIES).every((name) => Boolean(after.properties?.[name])),
};
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = `/Users/isibasidaisuke/WAJO Sales OS/INVESTMENT_EXIT_PROPERTIES_EVIDENCE_${stamp}.json`;
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...evidence, evidencePath }, null, 2));
