import assert from "node:assert/strict";
import {
	normalizeCardRoutingForTest as routing,
	parseBusinessCardOcrForTest as parse,
} from "./index";

// 名刺画像インテイク(入口ルール2026-06-11)の純関数:
// - parseBusinessCardOcr: OCR応答のJSON検証。壊れた出力・全項目空を通さない
// - normalizeCardRouting: 撮影時の振り分け(絵文字ラベル込み)を3値に正規化
async function main() {
	// ── OCRパース ──
	// 正常
	{
		const ocr = parse(
			'{"氏名":"山田 太郎","会社名":"株式会社サンプル","役職":"部長","部署":"営業部","電話":"06-1234-5678","メール":"yamada@example.co.jp","住所":"大阪市北区","メモ":""}',
		);
		assert.ok(ocr);
		assert.equal(ocr?.氏名, "山田 太郎");
		assert.equal(ocr?.電話, "06-1234-5678");
	}
	// コードフェンス付き(旧ショートカットを壊していたパターン)でも拾える
	{
		const ocr = parse('```json\n{"氏名":"山田","会社名":"サンプル"}\n```');
		assert.ok(ocr);
		assert.equal(ocr?.会社名, "サンプル");
		assert.equal(ocr?.電話, ""); // 無い項目は空文字
	}
	// 壊れたJSON → null(リトライへ)
	assert.equal(parse("{氏名: 山田}"), null);
	assert.equal(parse("読み取れませんでした"), null);
	// 全項目空 → null(空殻を通さない)
	assert.equal(parse('{"氏名":"","会社名":"","電話":"","メール":""}'), null);
	// 文字列でない値は空文字扱い
	{
		const ocr = parse('{"氏名":"山田","電話":123456}');
		assert.equal(ocr?.電話, "");
	}

	// ── 振り分け正規化 ──
	assert.equal(routing("🏢 企業（営業先）"), "company");
	assert.equal(routing("企業"), "company");
	assert.equal(routing("🤝 社外顧問・ブローカー"), "broker");
	assert.equal(routing("ブローカー"), "broker");
	assert.equal(routing("❓ あとで決める"), "later");
	assert.equal(routing("後で"), "later");
	assert.equal(routing(undefined), "company"); // 未指定は従来通り企業連携
	assert.equal(routing(""), "company");

	console.log("OK business-card-image");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
