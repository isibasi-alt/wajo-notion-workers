import assert from "node:assert/strict";
import {
	isCreditCheckInFlightForTest as inFlight,
	isManagerUserForTest as isManager,
	isTdbSurveyFreshForTest as isFresh,
} from "./index";

// B与信「与信を取る(本命のみ)」の安全装置:
// - isManagerUser: MANAGER_USER_IDS に居る人だけ課金ボタンを実行できる
// - isTdbSurveyFresh: 調査年月日が新しければ再購入しない(二重課金ロック)
async function main() {
	// ── 権限ゲート ──
	const saved = process.env.MANAGER_USER_IDS;

	// 未設定 → 全員拒否(設定するまで課金ボタンは動かない=安全側)
	delete process.env.MANAGER_USER_IDS;
	assert.equal(isManager("abc-123"), false);

	// 登録者のみ許可。大文字小文字・ハイフン差は吸収
	process.env.MANAGER_USER_IDS = "ABC-123, def456";
	assert.equal(isManager("abc123"), true);
	assert.equal(isManager("abc-123"), true);
	assert.equal(isManager("DEF-456"), true);
	assert.equal(isManager("stranger-999"), false);
	assert.equal(isManager(undefined), false);
	assert.equal(isManager(""), false);

	if (saved === undefined) delete process.env.MANAGER_USER_IDS;
	else process.env.MANAGER_USER_IDS = saved;

	// ── 二重課金ロック ──
	const now = "2026-06-10T00:00:00.000Z";
	// 90日以内 → fresh=再購入しない
	assert.equal(isFresh("2026-05-01", now, 90), true);
	assert.equal(isFresh("2026-06-10", now, 90), true);
	// 90日超 → 購入対象
	assert.equal(isFresh("2026-01-01", now, 90), false);
	// 未来日付(入力異常) → 購入対象(安全に判定不能扱い)
	assert.equal(isFresh("2026-12-01", now, 90), false);
	// 壊れた日付/空 → 購入対象
	assert.equal(isFresh("", now, 90), false);
	assert.equal(isFresh("不明", now, 90), false);

	// ── 実行中ロック(取得中の再押し/重複配送で二重課金しない) ──
	const t = "2026-06-10T08:45:00.000Z";
	// マーカー無し → 実行中でない
	assert.equal(inFlight("通常のメモだけ", t, 10), false);
	// 5分前に開始・完了記録なし → 実行中(ブロック)
	assert.equal(inFlight("TDB取得中 2026-06-10T08:40(実行者:abc)", t, 10), true);
	// 開始後に成功記録あり → 実行中でない
	assert.equal(
		inFlight(
			"TDB取得中 2026-06-10T08:40(実行者:abc)\n2026-06-10 TDB確報与信を取得: 評点51",
			t,
			10,
		),
		false,
	);
	// 開始後に失敗記録あり → 実行中でない(再実行できる)
	assert.equal(
		inFlight(
			"TDB取得中 2026-06-10T08:40(実行者:abc)\n2026-06-10 TDB与信取得に失敗(部品未接続)",
			t,
			10,
		),
		false,
	);
	// 古い完了記録の後に新しいマーカー → 実行中(直近の開始が生きている)
	assert.equal(
		inFlight(
			"2026-06-01 TDB確報与信を取得: 評点50\nTDB取得中 2026-06-10T08:44(実行者:abc)",
			t,
			10,
		),
		true,
	);
	// TTL超過(30分前) → 実行中でない(クラッシュで永久ロックしない)
	assert.equal(inFlight("TDB取得中 2026-06-10T08:15(実行者:abc)", t, 10), false);

	console.log("OK credit-check");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
