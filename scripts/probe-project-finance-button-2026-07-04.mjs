import { execFileSync } from "node:child_process";

const NOTION_CWD = "/Users/isibasidaisuke/wajo-notion-workers";
const BASE_ENV = { ...process.env, NOTION_KEYRING: "0" };
const NOTION_VERSION = "2026-03-11";

const PROPOSAL_REQUEST_DATA_SOURCE_ID = "9701e891-ffd0-43d7-b6f9-911fedc65391";
const FINANCE_DATA_SOURCE_ID = "7e4d0168-6e54-4071-bd55-f9730202225c";

function notion(args, body) {
  const stdout = execFileSync(
    "/Users/isibasidaisuke/.local/bin/ntn",
    ["api", ...args, "--notion-version", NOTION_VERSION],
    {
      cwd: NOTION_CWD,
      env: BASE_ENV,
      input: body ? JSON.stringify(body) : undefined,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
    },
  );
  return stdout.trim() ? JSON.parse(stdout) : null;
}

function plain(items) {
  return Array.isArray(items)
    ? items.map((item) => item.plain_text ?? item.text?.content ?? "").join("")
    : "";
}

function propValue(prop) {
  if (!prop || typeof prop !== "object") return null;
  switch (prop.type) {
    case "title":
      return plain(prop.title);
    case "rich_text":
      return plain(prop.rich_text);
    case "select":
      return prop.select?.name ?? null;
    case "status":
      return prop.status?.name ?? null;
    case "number":
      return prop.number ?? null;
    case "date":
      return prop.date?.start ?? null;
    case "relation":
      return (prop.relation ?? []).map((item) => item.id);
    case "url":
      return prop.url ?? null;
    default:
      return null;
  }
}

function pageTitle(page) {
  const titleProp = Object.values(page.properties ?? {}).find((prop) => prop?.type === "title");
  return titleProp ? plain(titleProp.title) : page.id;
}

function summarizePage(page, fields) {
  const out = {
    id: page.id,
    title: pageTitle(page),
    url: page.url ?? null,
  };
  for (const field of fields) {
    out[field] = propValue(page.properties?.[field]);
  }
  return out;
}

function queryByProject(dataSourceId, propertyName, projectPageId, pageSize = 10) {
  const response = notion(
    [`/v1/data_sources/${dataSourceId}/query`, "-X", "POST"],
    {
      page_size: pageSize,
      filter: {
        property: propertyName,
        relation: { contains: projectPageId },
      },
    },
  );
  return response.results ?? [];
}

function main() {
  const projectPageId = process.argv[2];
  if (!projectPageId) {
    throw new Error("Usage: node scripts/probe-project-finance-button-2026-07-04.mjs <project-page-id>");
  }

  const queuePages = queryByProject(
    PROPOSAL_REQUEST_DATA_SOURCE_ID,
    "関連案件",
    projectPageId,
    20,
  );
  const financePages = queryByProject(
    FINANCE_DATA_SOURCE_ID,
    "関連案件",
    projectPageId,
    20,
  );

  const queueSummaries = queuePages.map((page) =>
    summarizePage(page, [
      "資料種別",
      "案件名",
      "関連案件",
      "関連設備詳細",
      "関連ファイナンスシミュレーション",
      "シミュレーションステータス",
      "資料作成メモ",
    ]),
  );

  const financeSummaries = financePages.map((page) =>
    summarizePage(page, [
      "関連案件",
      "関連提案シミュレーション",
      "元提案シミュレーション",
      "関連営業提案",
      "借入額",
      "金利",
      "返済期間",
      "ファイナンス状態",
      "ファイナンスメモ",
    ]),
  );

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        projectPageId,
        queueCount: queueSummaries.length,
        financeCount: financeSummaries.length,
        queuePages: queueSummaries,
        financePages: financeSummaries,
      },
      null,
      2,
    ),
  );
}

main();
