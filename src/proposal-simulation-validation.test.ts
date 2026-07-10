import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import {
	buildProposalSimulationPdfBytesForTest,
	evaluateProposalSimulationDraftForTest,
} from "./index";

function numberProp(value: number | null = null) {
	return { type: "number", number: value };
}

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: value ? [{ plain_text: value }] : [] };
}

function selectProp(value: string) {
	return { type: "select", select: { name: value } };
}

function dateProp(start: string | null) {
	return { type: "date", date: start ? { start } : null };
}

function filesProp(...files: Array<{ url: string; name?: string }>) {
	return {
		type: "files",
		files: files.map((file, index) => ({
				type: "external",
			name: file.name ?? `site-photo-${index + 1}.png`,
			external: { url: file.url },
		})),
	};
}

const onePixelPng =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function solarRequiredProps(overrides: Record<string, unknown> = {}) {
	return {
		案件名: titleProp("提案B"),
		販売価格: numberProp(120000000),
		仕入れ価格: numberProp(100000000),
		月間発電量: numberProp(180000),
		売電単価: numberProp(20),
		"年間ランニングコスト（合計）": numberProp(3000000),
		発電所名: richTextProp("滋賀県湖南市 250kW太陽光"),
		所在地: richTextProp("滋賀県湖南市"),
		電力会社エリア: selectProp("関西電力"),
		"低圧/高圧区分": selectProp("高圧"),
		パネルメーカー: richTextProp("Jinko Solar"),
		パネル型式: richTextProp("Tiger Neo N-type"),
		パネル枚数: numberProp(420),
		"DC容量（パネル側kW）": numberProp(250),
		パワコンメーカー: richTextProp("HUAWEI"),
		パワコン型式: richTextProp("SUN2000"),
		"PCS容量（パワコン側kW）": numberProp(200),
		"FIT/FIP区分": selectProp("FIT"),
		残存売電期間: numberProp(14),
		連系開始日: dateProp("2021-06-01"),
		現場写真: filesProp(
			{ url: onePixelPng, name: "site-photo-1.png" },
			{ url: onePixelPng, name: "site-photo-2.png" },
		),
		...overrides,
	};
}

async function main() {
	const missingSale = evaluateProposalSimulationDraftForTest({
		id: "proposal-1",
		properties: {
			案件名: titleProp("提案A"),
			販売価格: numberProp(null),
			仕入れ価格: numberProp(98000000),
			"想定年間売電収入": numberProp(24000000),
		},
	});

	assert.equal(missingSale.missingField, "販売価格");
	assert.equal(missingSale.grossProfit, null);
	assert.match(missingSale.conclusionText, /要件を満たす場合/);
	assert.match(missingSale.conclusionText, /税理士・会計士/);

	const missingSourcingPrice = evaluateProposalSimulationDraftForTest({
		id: "proposal-1c",
		properties: {
			案件名: titleProp("提案A2"),
			販売価格: numberProp(120000000),
			仕入れ価格: numberProp(null),
			"想定年間売電収入": numberProp(24000000),
		},
	});

	assert.equal(missingSourcingPrice.missingField, "仕入れ価格");
	assert.equal(missingSourcingPrice.nextRequiredFields[0], "年間売電収入（または月間発電量・売電単価）");
	assert.ok(missingSourcingPrice.nextRequiredFields.includes("パネルメーカー"));

	const missingBattery = evaluateProposalSimulationDraftForTest({
		id: "proposal-1b",
		properties: {
			案件名: titleProp("蓄電池提案A"),
			提案タイプ: selectProp("系統用蓄電池"),
			総事業費: numberProp(350000000),
			補助金想定額: numberProp(175000000),
			年間想定総売上: numberProp(null),
		},
	});

	assert.equal(missingBattery.missingField, "年間想定総売上");
	assert.match(missingBattery.conclusionText, /補助金は採択・交付決定が前提/);

	const readyWithDerivedIncome = evaluateProposalSimulationDraftForTest({
		id: "proposal-2",
		properties: solarRequiredProps(),
	});

	assert.equal(readyWithDerivedIncome.missingField, null);
	assert.equal(readyWithDerivedIncome.proposalKind, "corporate");
	assert.equal(readyWithDerivedIncome.grossProfit, 20000000);
	assert.equal(readyWithDerivedIncome.annualNetIncome, 40200000);
	assert.equal(readyWithDerivedIncome.sitePhotos.length, 2);
	assert.equal(readyWithDerivedIncome.sitePhotos[0]?.name, "site-photo-1.png");
	assert.equal(readyWithDerivedIncome.expectedYield, 33.5);
	assert.equal(readyWithDerivedIncome.paybackYears, 2.99);
	assert.match(readyWithDerivedIncome.summaryLines.join("\n"), /販売価格: ¥120,000,000/);
	assert.match(readyWithDerivedIncome.summaryLines.join("\n"), /仕入れ価格: ¥100,000,000/);
	assert.match(readyWithDerivedIncome.summaryLines.join("\n"), /年間売電収入: ¥43,200,000/);
	assert.match(readyWithDerivedIncome.summaryLines.join("\n"), /年間維持費（ランニングコスト）: ¥3,000,000/);
	assert.match(readyWithDerivedIncome.summaryLines.join("\n"), /年間手残り: ¥40,200,000/);
	assert.match(readyWithDerivedIncome.proposalTitle, /法人オーナー/);
	assert.match(readyWithDerivedIncome.pageOneLines.join("\n"), /黒字対策/);
	assert.match(readyWithDerivedIncome.pageOneLines.join("\n"), /販売価格 ¥120,000,000/);
	assert.match(readyWithDerivedIncome.pageOneLines.join("\n"), /年間手残り ¥40,200,000/);
	assert.match(readyWithDerivedIncome.pageTwoLines.join("\n"), /Jinko Solar/);
	assert.match(readyWithDerivedIncome.pageTwoLines.join("\n"), /連系開始日 2021-06-01/);
	assert.match(readyWithDerivedIncome.pageTwoLines.join("\n"), /稼働年数/);
	assert.match(readyWithDerivedIncome.summaryLines.join("\n"), /残存FIT年数: 14年/);
	assert.match(readyWithDerivedIncome.summaryLines.join("\n"), /出力抑制前提: 抑制データ未設定/);
	assert.match(readyWithDerivedIncome.summaryLines.join("\n"), /次のバージョンで収支反映/);
	assert.match(readyWithDerivedIncome.summaryLines.join("\n"), /残存FIT期間内の総手残り: ¥562,800,000/);
	assert.match(readyWithDerivedIncome.pageTwoLines.join("\n"), /土地は償却対象外です/);
	assert.match(readyWithDerivedIncome.pageTwoLines.join("\n"), /システム本体は17年で償却します/);
	assert.match(readyWithDerivedIncome.pageTwoLines.join("\n"), /権利代は5年で償却します/);
	assert.match(readyWithDerivedIncome.pageTwoLines.join("\n"), /貴社顧問税理士/);
	assert.match(readyWithDerivedIncome.conclusionText, /20年後の解体・廃棄費用/);

	// CO2-001: 年間CO2削減量が未入力でも、年間発電量(年間売電収入÷売電単価)から自動算出し、
	// 顧客文「御社への結論」に "○○トン" のプレースホルダーを出さない。
	// 年間発電量 = 43,200,000円 ÷ 20円/kWh = 2,160,000 kWh、× 0.000434 t/kWh = 937.44 t。
	const co2Autofill = evaluateProposalSimulationDraftForTest({
		id: "proposal-co2",
		properties: solarRequiredProps(),
	});
	assert.equal(co2Autofill.co2ReductionTons, 937.44);
	assert.doesNotMatch(co2Autofill.conclusionText, /○○トン/);
	assert.match(
		co2Autofill.conclusionText,
		/年間937\.44トンのCO2排出量削減効果/,
	);

	const solarPdfBytes = await buildProposalSimulationPdfBytesForTest(
		readyWithDerivedIncome,
		"proposal-2",
	);
	const solarPdf = await PDFDocument.load(solarPdfBytes);
	assert.equal(solarPdf.getPageCount(), 4);
	const pdfCheckDirectory = await mkdtemp(join(tmpdir(), "wajo-proposal-pdf-"));
	const pdfCheckPath = join(pdfCheckDirectory, "proposal.pdf");
	try {
		await writeFile(pdfCheckPath, solarPdfBytes);
		const extractedPdfText = execFileSync("pdftotext", ["-layout", pdfCheckPath, "-"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		assert.match(extractedPdfText, /総枚数 420枚/);
		assert.doesNotMatch(extractedPdfText, /総枚数 ４２０枚/);
	} finally {
		await rm(pdfCheckDirectory, { recursive: true, force: true });
	}
	if (process.env.PROPOSAL_PDF_TEST_OUTPUT) {
		await writeFile(process.env.PROPOSAL_PDF_TEST_OUTPUT, solarPdfBytes);
	}

	const missingPanelMaker = evaluateProposalSimulationDraftForTest({
		id: "proposal-2b",
		properties: solarRequiredProps({
			パネルメーカー: richTextProp(""),
		}),
	});

	assert.equal(missingPanelMaker.missingField, "パネルメーカー");
	assert.ok(missingPanelMaker.nextRequiredFields.includes("連系開始日"));

	const missingGridConnectionDate = evaluateProposalSimulationDraftForTest({
		id: "proposal-2c",
		properties: solarRequiredProps({
			連系開始日: dateProp(null),
		}),
	});

	assert.equal(missingGridConnectionDate.missingField, "連系開始日");

	const missingSitePhoto = evaluateProposalSimulationDraftForTest({
		id: "proposal-2e",
		properties: solarRequiredProps({
			現場写真: filesProp(),
		}),
	});

	assert.equal(missingSitePhoto.missingField, "現場写真");

	const readyWithRunningCostBreakdown = evaluateProposalSimulationDraftForTest({
		id: "proposal-2d",
		properties: solarRequiredProps({
			"年間ランニングコスト（合計）": numberProp(null),
			"O&M費": numberProp(1200000),
			保険料: numberProp(300000),
			地代: numberProp(500000),
			固定資産税: numberProp(400000),
			除草費: numberProp(100000),
			監視通信費: numberProp(50000),
		}),
	});

	assert.equal(readyWithRunningCostBreakdown.missingField, null);
	assert.equal(readyWithRunningCostBreakdown.runningCost, 2550000);
	assert.equal(readyWithRunningCostBreakdown.annualNetIncome, 40650000);
	assert.match(readyWithRunningCostBreakdown.summaryLines.join("\n"), /年間維持費（ランニングコスト）: ¥2,550,000/);
	assert.match(readyWithRunningCostBreakdown.pageTwoLines.join("\n"), /O&M費 ¥1,200,000/);

	const readyWithWajoSupport = evaluateProposalSimulationDraftForTest({
		id: "proposal-2d3",
		properties: solarRequiredProps({
			事故歴判定: selectProp("軽微修復済"),
			和上整備判定: selectProp("整備済"),
			保証判定: selectProp("保証対象"),
			和上整備サマリー: richTextProp("草刈り、電気点検、パネル清掃まで実施済み。"),
			和上保証コメント: richTextProp("主要設備は現時点で稼働確認済み。"),
			残リスク: richTextProp("造成法面は豪雨後の再確認を推奨。"),
			草刈り実施: selectProp("実施"),
			電気点検実施: selectProp("実施"),
		}),
	});

	assert.match(readyWithWajoSupport.pageTwoLines.join("\n"), /和上確認: 事故歴 軽微修復済 \/ 整備 整備済 \/ 保証 保証対象/);
	assert.match(readyWithWajoSupport.pageTwoLines.join("\n"), /残リスク: 造成法面は豪雨後の再確認を推奨。/);

	const solarTitleOnly = evaluateProposalSimulationDraftForTest({
		id: "proposal-2d2",
		properties: {
			案件名: titleProp("太陽光案件A（FIT）"),
			提案タイプ: richTextProp(""),
			販売価格: numberProp(120000000),
			仕入れ価格: numberProp(100000000),
			"想定年間売電収入": numberProp(24000000),
		},
	});

	assert.equal(solarTitleOnly.proposalKind, "corporate");
	assert.match(solarTitleOnly.proposalTitle, /法人オーナー/);

	const readyWithCurtailment = evaluateProposalSimulationDraftForTest({
		id: "proposal-2f",
		properties: solarRequiredProps({
			出力抑制前提: selectProp("抑制あり"),
			出力抑制率: numberProp(10),
		}),
	});

	assert.equal(readyWithCurtailment.annualIncome, 38880000);
	assert.equal(readyWithCurtailment.annualNetIncome, 35880000);
	assert.equal(readyWithCurtailment.expectedYield, 29.9);
	assert.equal(readyWithCurtailment.fitTotalNetCashflow, 502320000);
	assert.match(readyWithCurtailment.summaryLines.join("\n"), /出力抑制前提: 抑制データあり \/ 10%/);
	assert.match(readyWithCurtailment.summaryLines.join("\n"), /次のバージョンで対応予定/);
	assert.match(readyWithCurtailment.summaryLines.join("\n"), /出力抑制率: 10%/);

	const readyWithFinance = evaluateProposalSimulationDraftForTest({
		id: "proposal-2g",
	properties: solarRequiredProps({
			土地代: numberProp(20000000),
			システム本体価格: numberProp(65000000),
			権利代: numberProp(35000000),
			借入額: numberProp(60000000),
			金利: numberProp(2),
			返済期間: numberProp(10),
			実効税率: numberProp(30),
			今期利益見込: numberProp(100000000),
			流動比率: numberProp(220),
			利益剰余金: numberProp(120000000),
			自己資本比率: numberProp(55),
		}),
	});

	assert.equal(readyWithFinance.financeSimulation?.landPrice, 20000000);
	assert.equal(readyWithFinance.financeSimulation?.rightsPrice, 35000000);
	assert.equal(readyWithFinance.financeSimulation?.systemPrice, 65000000);
	assert.equal(readyWithFinance.financeSimulation?.annualDepreciation, 10823529);
	assert.equal(readyWithFinance.financeSimulation?.taxBenefit, 3247059);
	assert.equal(readyWithFinance.financeSimulation?.timingRank, "S");
	assert.equal(readyWithFinance.financeSimulation?.salesRubric.totalScore, 15);
	assert.equal(readyWithFinance.financeSimulation?.salesRubric.route, "C");
	assert.match(readyWithFinance.summaryLines.join("\n"), /今回の投資判定: S/);
	assert.match(readyWithFinance.summaryLines.join("\n"), /年間税効果: ¥3,247,059/);
	assert.match(readyWithFinance.summaryLines.join("\n"), /商品構成: 金額入力/);
	assert.match(readyWithFinance.summaryLines.join("\n"), /B\/Sルーブリック: 15点 \/ Cルート/);
	assert.match(readyWithFinance.pageTwoLines.join("\n"), /資産組み換え・大型投資型提案/);

	const readyWithCompositionRatios = evaluateProposalSimulationDraftForTest({
		id: "proposal-2h",
		properties: solarRequiredProps({
			土地比率: numberProp(20),
			システム比率: numberProp(50),
			権利代比率: numberProp(30),
			実効税率: numberProp(30),
			今期利益見込: numberProp(100000000),
			流動比率: numberProp(150),
			利益剰余金: numberProp(50000000),
			自己資本比率: numberProp(35),
		}),
	});

	assert.equal(readyWithCompositionRatios.financeSimulation?.composition.mode, "比率入力");
	assert.equal(readyWithCompositionRatios.financeSimulation?.landPrice, 24000000);
	assert.equal(readyWithCompositionRatios.financeSimulation?.systemPrice, 60000000);
	assert.equal(readyWithCompositionRatios.financeSimulation?.rightsPrice, 36000000);
	assert.equal(readyWithCompositionRatios.financeSimulation?.landRatio, 20);
	assert.equal(readyWithCompositionRatios.financeSimulation?.systemRatio, 50);
	assert.equal(readyWithCompositionRatios.financeSimulation?.rightsRatio, 30);
	assert.equal(readyWithCompositionRatios.financeSimulation?.annualDepreciation, 10729412);
	assert.equal(readyWithCompositionRatios.financeSimulation?.taxBenefit, 3218824);
	assert.equal(readyWithCompositionRatios.financeSimulation?.salesRubric.totalScore, 11);
	assert.equal(readyWithCompositionRatios.financeSimulation?.salesRubric.route, "B");
	assert.match(readyWithCompositionRatios.summaryLines.join("\n"), /構成比: 土地 20% \/ システム 50% \/ 権利代 30%/);
	assert.match(readyWithCompositionRatios.summaryLines.join("\n"), /営業設計: 権利代比率を上げると5年償却部分が増え/);
	assert.match(readyWithCompositionRatios.summaryLines.join("\n"), /本業シナジー・自家消費型提案/);
	assert.match(readyWithCompositionRatios.pageTwoLines.join("\n"), /商品構成: 比率入力/);

	const readyWithoutBsMetrics = evaluateProposalSimulationDraftForTest({
		id: "proposal-2i",
		properties: solarRequiredProps({
			土地代: numberProp(10000000),
			権利代: numberProp(10000000),
			実効税率: numberProp(30),
		}),
	});

	assert.equal(readyWithoutBsMetrics.financeSimulation?.salesRubric.totalScore, null);
	assert.equal(readyWithoutBsMetrics.financeSimulation?.salesRubric.route, null);
	assert.match(readyWithoutBsMetrics.summaryLines.join("\n"), /B\/Sルーブリック: 未判定/);
	assert.match(readyWithoutBsMetrics.pageTwoLines.join("\n"), /今回の投資判定/);

	const individual = evaluateProposalSimulationDraftForTest({
		id: "proposal-3",
		properties: solarRequiredProps({
			案件名: titleProp("提案C"),
			提案タイプ: selectProp("個人投資家向け"),
			販売価格: numberProp(22000000),
			買取総額: numberProp(18000000),
			仕入れ価格: numberProp(null),
			"想定年間売電収入": numberProp(2090000),
			"ランニングコスト（年）": numberProp(380000),
		}),
	});

	assert.equal(individual.proposalKind, "individual");
	assert.match(individual.proposalTitle, /個人投資家/);
	assert.match(individual.pageOneLines.join("\n"), /私的年金/);
	assert.match(individual.pageOneLines.join("\n"), /販売価格 ¥22,000,000/);
	assert.match(individual.pageTwoLines.join("\n"), /発電量変動/);
	assert.match(individual.typeGuideLines.join("\n"), /個人投資家向けを選ぶ条件/);
	assert.match(individual.typeGuideLines.join("\n"), /法人対象/);
	assert.match(individual.typeGuideLines.join("\n"), /環境配慮型企業向け/);
	assert.match(individual.typeGuideLines.join("\n"), /系統用蓄電池/);

	const esg = evaluateProposalSimulationDraftForTest({
		id: "proposal-4",
		properties: solarRequiredProps({
			案件名: titleProp("提案D"),
			提案タイプ: selectProp("環境配慮型企業向け"),
			販売価格: numberProp(22000000),
			買取総額: numberProp(18000000),
			仕入れ価格: numberProp(null),
			"想定年間売電収入": numberProp(2090000),
			"ランニングコスト（年）": numberProp(380000),
			"年間CO2削減量": numberProp(55),
		}),
	});

	assert.equal(esg.proposalKind, "esg");
	assert.match(esg.proposalTitle, /ESG/);
	assert.match(esg.pageOneLines.join("\n"), /脱炭素/);
	assert.match(esg.pageTwoLines.join("\n"), /環境価値/);

	const battery = evaluateProposalSimulationDraftForTest({
		id: "proposal-5",
		properties: {
			案件名: titleProp("蓄電池候補地A"),
			提案タイプ: selectProp("系統用蓄電池"),
			総事業費: numberProp(350000000),
			補助金想定額: numberProp(175000000),
			年間想定総売上: numberProp(35000000),
			年間ランニングコスト: numberProp(3000000),
			PCS出力: numberProp(2000),
			蓄電容量: numberProp(4000),
		},
	});

	assert.equal(battery.missingField, null);
	assert.equal(battery.proposalKind, "gridBattery");
	assert.equal(battery.grossProfit, 32000000);
	assert.equal(battery.expectedYield, 18.29);
	assert.equal(battery.paybackYears, 5.47);
	assert.match(battery.proposalTitle, /系統用蓄電池/);
	assert.match(battery.pageOneLines.join("\n"), /JEPX/);
	assert.match(battery.pageTwoLines.join("\n"), /補助金は採択・交付決定が前提/);
	assert.match(battery.conclusionText, /市場価格・約定・運用条件/);

	const pdfBytes = await buildProposalSimulationPdfBytesForTest(battery, "proposal-5");
	const pdf = await PDFDocument.load(pdfBytes);
	assert.equal(pdf.getPageCount(), 2);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
