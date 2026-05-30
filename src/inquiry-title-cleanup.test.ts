import assert from "node:assert/strict";
import * as index from "./index";
import {
	buildInquiryReceptionNumberForTest,
	buildInquiryDisplayTitleForTest,
	buildNumberedInquiryDisplayTitleForTest,
	inferInquiryCategoryCodeForTest,
} from "./index";

async function main() {
	assert.equal(
		inferInquiryCategoryCodeForTest({
			subject: "高圧問い合わせの件",
			body: "300kWの滋賀の案件について購入相談です。",
			dealType: "購入相談",
		}),
		"④ 高圧",
	);

	assert.equal(
		buildInquiryDisplayTitleForTest({
			subject: "とくとくファーム【太陽光発電所のかんたん査定】",
			body: "金額によっては売却を検討しているため",
			contactName: "斎藤 光",
			inquiryType: "個人投資家",
			dealType: "売却相談",
		}),
		"売｜斎藤 光｜太陽光｜⚠",
	);

	assert.equal(
		buildInquiryDisplayTitleForTest({
			subject: "企業名不明 高圧問い合わせの件",
			body: "高圧太陽光の販売案件を探しています。所在地は滋賀県、設備容量は300kWです。",
			companyName: "企業名不明",
			inquiryType: "法人",
			dealType: "購入相談",
		}),
		"買｜法人｜太陽光｜高",
	);

	assert.equal(
		buildInquiryDisplayTitleForTest({
			subject: "和上ホールディングス【ゼロカーボン総合支援／再生可能エネルギー100％】",
			body: "株式会社パワーエックスです。系統用蓄電所について完成渡し・権利売買ともに検討したいです。",
			companyName: "株式会社パワーエックス",
			inquiryType: "法人",
			dealType: "購入相談",
		}),
		"買｜株式会社パワーエックス｜蓄電池",
	);

	assert.equal(
		buildInquiryDisplayTitleForTest({
			subject: "低圧太陽光の売却相談",
			body: "低圧49.5kWを複数まとめて売却したいです。現場写真は未添付です。",
			companyName: "ABC発電株式会社",
			contactName: "田中 太郎",
			inquiryType: "法人",
			dealType: "売却相談",
		}),
		"売｜田中 太郎/ABC発電｜太陽光｜低バ｜⚠",
	);

	assert.equal(buildInquiryReceptionNumberForTest("260526", 7), "問-260526-007");

	assert.equal(
		buildNumberedInquiryDisplayTitleForTest(
			"問-260526-007",
			"売｜SanConnex｜太陽光｜高",
		),
		"問-260526-007｜売｜SanConnex｜太陽光｜高",
	);

	assert.equal(
		buildNumberedInquiryDisplayTitleForTest(
			"問-260526-007",
			"問-260526-007｜売｜SanConnex｜太陽光｜高",
		),
		"問-260526-007｜売｜SanConnex｜太陽光｜高",
	);

	assert.equal(typeof index.buildInquiryAttentionMemoForTest, "function");
	assert.deepEqual(
		index.buildInquiryAttentionMemoForTest({
			subject: "低圧太陽光の売却相談",
			body: "低圧49.5kWを複数まとめて売却したいです。現場写真は未添付です。",
			companyName: "ABC発電株式会社",
			contactName: "田中 太郎",
			inquiryType: "法人",
			dealType: "売却相談",
		}),
		[
			"太陽光案件のため中身確認が必要です。",
			"確認理由: 所在地未確認 / 販売価格未確認 / FIT/FIP・売電単価未確認 / 現場写真未添付 / バルク候補",
		].join("\n"),
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
