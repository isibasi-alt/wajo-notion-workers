export type LandInitialInputMetric =
	| "area"
	| "road"
	| "grid"
	| "substationDistance"
	| "farmland"
	| "hazard"
	| "landUse";

export type LandInitialInputEvidenceKind =
	| "automatic-source"
	| "manual-past-document"
	| "worker-test"
	| "notion-saved-result"
	| "ai-wording";

export type LandInitialInputEvidence = {
	metric: LandInitialInputMetric;
	kind: LandInitialInputEvidenceKind;
	label: string;
};

export type LandInitialInputCapabilityInput = {
	address: string;
	areaTsubo: number | null;
	evidence: LandInitialInputEvidence[];
};

type LandInitialInputMetricScore = {
	label: string;
	max: number;
	score: number;
	reason: string;
};

export type LandInitialInputCapabilityScore = {
	total: number;
	maxTotal: 100;
	metrics: Record<LandInitialInputMetric, LandInitialInputMetricScore>;
	acceptedEvidence: LandInitialInputEvidence[];
	rejectedEvidence: LandInitialInputEvidence[];
	rule: string;
};

const METRICS: Record<LandInitialInputMetric, { label: string; max: number }> = {
	area: { label: "面積", max: 15 },
	road: { label: "接道", max: 15 },
	grid: { label: "系統情報", max: 15 },
	substationDistance: { label: "変電所・連系点からの距離", max: 10 },
	farmland: { label: "農地転用", max: 20 },
	hazard: { label: "ハザード", max: 10 },
	landUse: { label: "地目・用地", max: 15 },
};

const AUTO_SOURCE_SCORES: Record<LandInitialInputMetric, number> = {
	area: 10,
	road: 8,
	grid: 6,
	substationDistance: 8,
	farmland: 12,
	hazard: 6,
	landUse: 10,
};

export function scoreInitialLandInputCapability(
	input: LandInitialInputCapabilityInput,
): LandInitialInputCapabilityScore {
	const acceptedEvidence = input.evidence.filter((item) => item.kind === "automatic-source");
	const rejectedEvidence = input.evidence.filter((item) => item.kind !== "automatic-source");
	const metrics = Object.fromEntries(
		(Object.keys(METRICS) as LandInitialInputMetric[]).map((metric) => {
			const baseScore = metric === "area" && input.address.trim() && (input.areaTsubo ?? 0) > 0 ? 10 : 0;
			const hasAutomaticEvidence = acceptedEvidence.some((item) => item.metric === metric);
			const autoScore = hasAutomaticEvidence ? AUTO_SOURCE_SCORES[metric] : 0;
			const score = Math.max(baseScore, autoScore);
			return [
				metric,
				{
					label: METRICS[metric].label,
					max: METRICS[metric].max,
					score,
					reason:
						score === 0
							? "初回入力から自動取得できた証拠なし"
							: metric === "area" && score === 10
								? "住所と面積の初回入力を扱える"
								: "初回入力から自動取得した証拠のみ加点",
				},
			];
		}),
	) as Record<LandInitialInputMetric, LandInitialInputMetricScore>;
	const total = Object.values(metrics).reduce((sum, item) => sum + item.score, 0);
	return {
		total,
		maxTotal: 100,
		metrics,
		acceptedEvidence,
		rejectedEvidence,
		rule: "住所＋面積の初回入力から自動取得できた証拠だけを加点する。過去資料、手作業発掘、Worker存在、Notion保存結果、AI文言は加点しない。",
	};
}
