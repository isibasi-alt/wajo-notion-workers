import assert from "node:assert/strict";
import { scoreInitialLandInputCapability } from "./land-initial-input-score.js";

const address = "三重県鈴鹿市国分町池ノ谷";

{
	const result = scoreInitialLandInputCapability({
		address,
		areaTsubo: 1680,
		evidence: [],
	});

	assert.equal(result.total, 10);
	assert.equal(result.metrics.area.score, 10);
	assert.equal(result.metrics.road.score, 0);
	assert.equal(result.metrics.grid.score, 0);
	assert.equal(result.metrics.substationDistance.score, 0);
	assert.equal(result.metrics.farmland.score, 0);
	assert.equal(result.metrics.hazard.score, 0);
	assert.equal(result.metrics.landUse.score, 0);
	assert.deepEqual(result.rejectedEvidence, []);
}

{
	const result = scoreInitialLandInputCapability({
		address,
		areaTsubo: 1680,
		evidence: [
			{
				metric: "grid",
				kind: "manual-past-document",
				label: "過去案件フォルダの接続検討回答書",
			},
			{
				metric: "landUse",
				kind: "manual-past-document",
				label: "過去案件フォルダの土地謄本",
			},
		],
	});

	assert.equal(result.total, 10);
	assert.equal(result.metrics.grid.score, 0);
	assert.equal(result.metrics.landUse.score, 0);
	assert.deepEqual(
		result.rejectedEvidence.map((item) => item.label),
		["過去案件フォルダの接続検討回答書", "過去案件フォルダの土地謄本"],
	);
}

{
	const result = scoreInitialLandInputCapability({
		address,
		areaTsubo: 1680,
		evidence: [
			{ metric: "road", kind: "automatic-source", label: "国土地理院道路候補" },
			{ metric: "hazard", kind: "automatic-source", label: "不動産情報ライブラリ防災一次確認" },
			{ metric: "landUse", kind: "automatic-source", label: "不動産情報ライブラリ用途地域" },
		],
	});

	assert.equal(result.total, 34);
	assert.equal(result.metrics.area.score, 10);
	assert.equal(result.metrics.road.score, 8);
	assert.equal(result.metrics.hazard.score, 6);
	assert.equal(result.metrics.landUse.score, 10);
	assert.deepEqual(result.rejectedEvidence, []);
}
