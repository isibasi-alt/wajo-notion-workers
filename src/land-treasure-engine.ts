import { LAND_SUBSTATIONS, type LandSubstation } from "./land-substations.js";

export type LandTreasureInput = {
	name: string;
	address: string;
	areaTsubo: number | null;
	powerArea: string;
	landUse: string;
	road: string;
	farmland: string;
	farmlandType: string;
	registry: string;
	nearbyResidentialDistanceM: number | null;
	nearbyResidentialCheck: string;
	transmissionLine: string;
	latitude: number | null;
	longitude: number | null;
	substationDistanceKm: number | null;
	inputEvidenceState?: string;
};

export type LandTreasureGrade = "S" | "A" | "B" | "C";
export type LandScaleDistanceGate = "通過候補" | "面積不足" | "距離超過" | "距離未確認";
export type LandFarmlandProspectRank = "高" | "中" | "低";
export type LandFarmlandConfidence = "高" | "中" | "低";
export type LandFarmlandFormalStatus = "未照会" | "照会準備中" | "照会済み" | "回答済み";
export type LandQuickDecision = "行く" | "行かない";

export type LandTreasureSubstationCandidate = {
	name: string;
	distanceKm: number;
	operator: string;
	gridStatus: string;
	voltageKv: number | null;
	latitude: number;
	longitude: number;
	confirmationUrl: string;
};

export type LandFarmlandPreAssessment = {
	score: number;
	rank: LandFarmlandProspectRank;
	confidence: LandFarmlandConfidence;
	formalStatus: LandFarmlandFormalStatus;
	actionBranch: string;
	salesInputGuide: string;
	evidence: string[];
};

export type LandTreasureEvaluation = {
	overallGrade: LandTreasureGrade;
	score: number;
	bucket: string;
	actionBucket: string;
	caseStatus: string;
	projectType: string;
	powerArea: string;
	landRating: string;
	powerRating: string;
	roadRating: string;
	subsidyRating: string;
	demandRating: string;
	quickDecision: LandQuickDecision;
	quickDecisionReason: string;
	salesPathDeadline: string;
	salesPathRequest: string;
	missingDataRequest: string;
	scaleDistanceGate: LandScaleDistanceGate;
	scaleDistanceEvidenceState: "根拠確認済み" | "根拠未確認";
	scaleDistanceSource: "変電所DB座標再計算" | "土地DB手入力距離" | "距離未確認";
	nearestSubstationName: string;
	nearestSubstationDistanceKm: number | null;
	nearestSubstationOperator: string;
	nearestSubstationGridStatus: string;
	substationCandidates: LandTreasureSubstationCandidate[];
	roadWidthM: number | null;
	physicalAiScore: number;
	salesAiScore: number;
	customerValue: string;
	blockers: string[];
	sabcReason: string;
	farmlandPreAssessment: LandFarmlandPreAssessment;
	farmlandPreAssessmentText: string;
	landEvaluation: string;
	powerEvaluation: string;
	roadEvaluation: string;
	subsidyEvaluation: string;
	demandEvaluation: string;
	nextAction: string;
	reviewMemo: string;
};

type NearestSubstation = {
	substation: LandSubstation;
	distanceKm: number;
};

export function evaluateLandTreasure(input: LandTreasureInput): LandTreasureEvaluation {
	const area = input.areaTsubo ?? 0;
	const powerArea = input.powerArea || inferPowerAreaFromAddress(input.address) || "未確認";
	const nearestCandidates = findNearestSubstations(input.latitude, input.longitude, powerArea, 3);
	const nearest = nearestCandidates[0] ?? null;
	const distanceKm = nearest?.distanceKm ?? input.substationDistanceKm;
	const scaleDistanceGate = evaluateScaleDistanceGate(area, distanceKm);
	const scaleDistanceEvidenceState = ["原本", "行政正式書面"].includes(input.inputEvidenceState ?? "")
		? "根拠確認済み"
		: "根拠未確認";
	const scaleDistanceSource =
		input.latitude !== null && input.longitude !== null && nearest
			? "変電所DB座標再計算"
			: input.substationDistanceKm !== null
				? "土地DB手入力距離"
				: "距離未確認";
	const roadWidthM = roadWidthFromText(input.road);
	const gridStatus = nearest?.substation.grid || "";
	const blockers = identifyBirdEyeBlockers(input, roadWidthM, distanceKm);
	const farmlandPreAssessment = evaluateFarmlandPreAssessment(input, blockers, roadWidthM);
	const farmlandPreAssessmentText = formatFarmlandPreAssessment(farmlandPreAssessment);
	const physicalAiScore = scorePhysicalAi({
		area,
		distanceKm,
		gridStatus,
		roadWidthM,
		landUse: input.landUse,
		blockers,
	});
	const salesAiScore = scoreSalesAi({
		area,
		distanceKm,
		roadWidthM,
		powerArea,
		farmland: input.farmland,
		farmlandType: input.farmlandType,
		registry: input.registry,
		blockers,
	});
	const uncappedScore = clamp(Math.round(physicalAiScore * 0.62 + salesAiScore * 0.38), 0, 100);
	const score = Math.min(
		applyBirdEyeCaps(uncappedScore, blockers),
		scaleDistanceGate === "通過候補" ? 100 : 64,
	);
	const overallGrade: LandTreasureGrade =
		score >= 90 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : "C";
	const bucket =
		overallGrade === "S"
			? "即アタック"
			: overallGrade === "A"
				? "案件化候補"
				: overallGrade === "B"
					? "優先確認"
					: "追加確認";
	const actionBucket =
		overallGrade === "S"
			? "即アタック"
			: roadWidthM === null
				? "接道確認"
				: distanceKm === null && area >= 1500
					? "系統保留"
					: overallGrade === "A" || overallGrade === "B"
						? "現地確認"
						: "継続監視";
	const caseStatus = overallGrade === "S" || overallGrade === "A" ? "案件化保留" : "未案件化";
	const projectType =
		area >= 5000
			? "高圧系統用"
			: area >= 1500
				? "高圧系統用"
				: area >= 300
					? "低圧バルク"
					: "未判定";
	const landRating = score >= 90 ? "◎" : score >= 80 ? "◎" : score >= 65 ? "○" : "△";
	const powerRating = choosePowerRating(distanceKm, gridStatus);
	const roadRating = chooseRoadRatingFromWidth(roadWidthM, input.road);
	const subsidyRating = "要確認";
	const demandRating = area >= 1500 ? "あり" : area >= 300 ? "不明" : "なし";
	const nearestName = nearest?.substation.n ?? "";
	const nearestDistanceText =
		distanceKm === null ? "未確認" : `${round1(distanceKm)}km`;
	const substationLine = nearest
		? `最寄り変電所: ${nearestName}（${nearestDistanceText} / ${nearest.substation.op} / 系統=${gridStatus || "未確認"} / ${nearest.substation.kv ?? "電圧未確認"}kV）`
		: `最寄り変電所: 未特定（距離=${nearestDistanceText}）`;
	const substationCandidates = nearestCandidates.map((candidate) => ({
		name: candidate.substation.n,
		distanceKm: candidate.distanceKm,
		operator: candidate.substation.op,
		gridStatus: candidate.substation.grid,
		voltageKv: candidate.substation.kv ?? null,
		latitude: candidate.substation.lat,
		longitude: candidate.substation.lng,
		confirmationUrl: googleMapsUrl(candidate.substation.lat, candidate.substation.lng),
	}));
	const substationCandidatesLine = formatSubstationCandidates(substationCandidates);
	const roadLine = roadWidthM
		? `接道: ${input.road || "入力なし"}（幅員${roadWidthM}mとして判定）`
		: `接道: ${input.road || "未確認"}（幅員は未確定）`;
	const nearbyResidentialAlert = buildNearbyResidentialAlert(input);
	const customerValue = buildCustomerValueStatement({
		grade: overallGrade,
		score,
		area,
		distanceKm,
		powerArea,
		projectType,
		blockers,
	});
	const quickDecision = chooseLandQuickDecision({
		area,
		distanceKm,
		scaleDistanceGate,
		blockers,
		farmlandPreAssessment,
	});
	const quickDecisionReason = buildLandQuickDecisionReason({
		area,
		distanceKm,
		scaleDistanceGate,
		blockers,
		farmlandPreAssessment,
		powerArea,
	});
	const salesPathDeadline = formatJstSalesPathDeadline(2);
	const salesPathRequest = buildLandSalesPathRequest(
		quickDecision,
		quickDecisionReason,
		salesPathDeadline,
	);
	const missingDataRequest = buildLandMissingDataRequest(input, {
		powerArea,
		distanceKm,
		roadWidthM,
		scaleDistanceGate,
		scaleDistanceEvidenceState,
		farmlandPreAssessment,
		blockers,
	});
	const blockerLine =
		blockers.length > 0
			? `変電所だけではS評価にしない。主な阻害要因: ${blockers.join(" / ")}`
			: "変電所距離だけでなく、面積・接道・農転/登記・近隣住宅・営業出口を合わせても大きな阻害要因は未検出。";
	const sabcReason = [
		`SABC評価=${overallGrade}`,
		`2AI統合=${score}点`,
		`AI-1 物理・系統評価=${physicalAiScore}点`,
		`AI-2 営業・案件化評価=${salesAiScore}点`,
		`速報判断=${quickDecision}`,
		`D規模・距離ゲート=${scaleDistanceGate} / 入力根拠=${scaleDistanceEvidenceState} / 距離出所=${scaleDistanceSource}`,
		substationLine,
		substationCandidatesLine,
		roadLine,
		farmlandPreAssessmentText.replace(/\n/g, " / "),
		nearbyResidentialAlert,
		blockerLine,
		customerValue,
	].join(" / ");
	const actionPrelude = [
		salesPathRequest,
		missingDataRequest,
		farmlandPreAssessment.salesInputGuide,
	].join("\n\n");

	return {
		overallGrade,
		score,
		bucket,
		actionBucket,
		caseStatus,
		projectType,
		powerArea,
		landRating,
		powerRating,
		roadRating,
		subsidyRating,
		demandRating,
		quickDecision,
		quickDecisionReason,
		salesPathDeadline,
		salesPathRequest,
		missingDataRequest,
		scaleDistanceGate,
		scaleDistanceEvidenceState,
		scaleDistanceSource,
		nearestSubstationName: nearestName,
		nearestSubstationDistanceKm: distanceKm,
		nearestSubstationOperator: nearest?.substation.op ?? "",
		nearestSubstationGridStatus: gridStatus,
		substationCandidates,
		roadWidthM,
		physicalAiScore,
		salesAiScore,
		customerValue,
		blockers,
		sabcReason,
		farmlandPreAssessment,
		farmlandPreAssessmentText,
		landEvaluation: [
		`${input.name}は、${area > 0 ? `${Math.round(area).toLocaleString("ja-JP")}坪` : "面積未確認"}・所在地「${input.address || "未確認"}」を起点にした土地評価です。`,
		salesPathRequest,
		missingDataRequest,
		`2AI評価として、物理・系統AIは${physicalAiScore}点、営業・案件化AIは${salesAiScore}点。SABC統合では${overallGrade} / ${score}点です。`,
		`D規模・距離ゲート=${scaleDistanceGate} / 入力根拠=${scaleDistanceEvidenceState} / 距離出所=${scaleDistanceSource}（面積3,000坪以上・最寄り変電所直線距離2km以内を候補条件とする）`,
		farmlandPreAssessmentText,
			substationLine,
			`鳥の目で見ると、${customerValue}`,
			substationCandidatesLine,
			blockerLine,
			overallGrade === "S"
				? "変電所近接、面積、接道の条件が強いため、優先確認候補として人間確認へ回す価値があります。"
				: "案件化前に、変電所距離、接道、農転、登記、近隣住宅距離の確認を続けてください。",
		].join("\n"),
		powerEvaluation: [
			powerArea === "未確認"
				? "電力会社エリアは未確認です。"
			: `電力会社エリアは${powerArea}として評価しました。`,
			substationLine,
			substationCandidatesLine,
			distanceKm !== null && distanceKm <= 1
				? "変電所1km圏内のため、系統用蓄電池候補として最優先で系統空き・接続検討を確認してください。"
				: "変電所距離と系統空きは確定資料で再確認してください。",
		].join("\n"),
		roadEvaluation: [
			roadLine,
			roadWidthM !== null && roadWidthM >= 6
				? "6m以上の接道として、大型車進入・搬入計画の初期条件は強い判定です。"
				: roadWidthM !== null && roadWidthM >= 4
					? "4m以上の接道として一次条件は満たしますが、大型車進入は現地で確認してください。"
					: "道路幅員、道路種別、進入経路、大型車搬入可否を現地資料または道路台帳で確認してください。",
		].join("\n"),
		subsidyEvaluation:
			"未確認。補助金・制度適合は年度、用途、設備種別、自治体条件により変わるため、公式情報で確認してください。",
		demandEvaluation:
			area >= 5000
				? "推測ですが、系統用蓄電池・高圧/特高系の需要仮説を強く置けます。"
				: area >= 1500
					? "推測ですが、蓄電池・高圧系の需要仮説を置けます。"
					: "推測ですが、低圧集約、売却候補、近隣案件との組み合わせで価値を確認します。",
		nextAction:
			scaleDistanceGate !== "通過候補"
				? `${actionPrelude}\n${buildScaleDistanceGateAction(scaleDistanceGate)}`
				: overallGrade === "S"
				? `${actionPrelude}\n最寄り変電所、接道、農転/登記、近隣住宅距離を人間が確認し、案件化・仕入れ打診へ進めてください。`
				: blockers.length > 0
					? `${actionPrelude}\n変電所近接だけで進めず、先に ${blockers.join(" / ")} を解消または確認してください。`
					: `${actionPrelude}\n不足条件を整理し、接道・用途地域・農転/登記・需要地距離を確認してから再評価してください。`,
		reviewMemo: sabcReason,
	};
}

function chooseLandQuickDecision(input: {
	area: number;
	distanceKm: number | null;
	scaleDistanceGate: LandScaleDistanceGate;
	blockers: string[];
	farmlandPreAssessment: LandFarmlandPreAssessment;
}): LandQuickDecision {
	if (input.area > 0 && input.area < 300) return "行かない";
	if (input.distanceKm !== null && input.distanceKm > 5) return "行かない";
	if (input.blockers.some((item) => /未接道|進入不可|農地転用に阻害|所有者確認に阻害/.test(item))) {
		return "行かない";
	}
	if (input.scaleDistanceGate === "面積不足" && input.area < 1500) return "行かない";
	if (input.farmlandPreAssessment.rank === "低" && input.scaleDistanceGate !== "通過候補") return "行かない";
	return "行く";
}

function buildLandQuickDecisionReason(input: {
	area: number;
	distanceKm: number | null;
	scaleDistanceGate: LandScaleDistanceGate;
	blockers: string[];
	farmlandPreAssessment: LandFarmlandPreAssessment;
	powerArea: string;
}): string {
	const reasons: string[] = [];
	if (input.area >= 3000) reasons.push("面積はD候補条件に乗る");
	else if (input.area >= 1500) reasons.push("面積は高圧・蓄電池の比較候補に残る");
	else if (input.area > 0) reasons.push("面積が弱く、単独の優先順位は下がる");
	else reasons.push("面積が未確認");

	if (input.distanceKm !== null && input.distanceKm <= 2) reasons.push("変電所距離は近い");
	else if (input.distanceKm !== null && input.distanceKm <= 5) reasons.push("変電所距離は比較確認の範囲");
	else if (input.distanceKm !== null) reasons.push("変電所距離が遠い");
	else reasons.push("変電所距離は未確認");

	if (input.powerArea && input.powerArea !== "未確認") reasons.push(`電力エリアは${input.powerArea}として見られる`);
	if (input.farmlandPreAssessment.rank === "高") reasons.push("農転見込みは強め");
	if (input.farmlandPreAssessment.rank === "低") reasons.push("農転見込みは弱い");
	if (input.blockers.length > 0) reasons.push(`外れたら見るポイントは${input.blockers.slice(0, 3).join(" / ")}`);

	return `${reasons.slice(0, 4).join("。")}。`;
}

function buildLandSalesPathRequest(
	quickDecision: LandQuickDecision,
	reason: string,
	deadline: string,
): string {
	const lead =
		quickDecision === "行く"
			? "この土地は速報では「行く」。"
			: "この土地は速報では「行かない」。";
	const requestLead =
		quickDecision === "行く"
			? `70点判定に上げるため、${deadline}までに以下を埋めてください。`
			: `例外的に追う場合は、${deadline}までに以下を埋めてください。`;
	return [
		lead,
		"",
		"理由:",
		reason,
		"",
		requestLead,
		"",
		"1. 地番",
		"2. 登記地目",
		"3. 登記面積または資料面積",
		"4. 接道状況",
		"5. 現地感メモ",
	].join("\n");
}

function buildLandMissingDataRequest(
	input: LandTreasureInput,
	context: {
		powerArea: string;
		distanceKm: number | null;
		roadWidthM: number | null;
		scaleDistanceGate: LandScaleDistanceGate;
		scaleDistanceEvidenceState: "根拠確認済み" | "根拠未確認";
		farmlandPreAssessment: LandFarmlandPreAssessment;
		blockers: string[];
	},
): string {
	const areaStatus =
		input.areaTsubo !== null && input.areaTsubo > 0
			? `${Math.round(input.areaTsubo).toLocaleString("ja-JP")}坪`
			: "未入力";
	const distanceStatus =
		context.distanceKm !== null ? `候補距離=${round1(context.distanceKm)}km` : "未確認";
	const roadStatus =
		context.roadWidthM !== null
			? `幅員候補=${context.roadWidthM}m`
			: input.road
				? "入力あり。ただし幅員・道路種別は未確定"
				: "未入力";
	const blockerStatus = context.blockers.length > 0 ? context.blockers.join(" / ") : "重大な未入力阻害は未検出";
	return [
		"【今AIが欲しいデータ】",
		"目的: 速報の「行く/行かない」を70点判定へ上げ、外れた理由をAI学習ログへ残す。",
		`現状: 面積=${areaStatus} / 電力エリア=${context.powerArea || "未確認"} / 変電所=${distanceStatus} / 接道=${roadStatus} / Dゲート=${context.scaleDistanceGate} / 入力根拠=${context.scaleDistanceEvidenceState} / 農転正式確認=${context.farmlandPreAssessment.formalStatus} / 詰まり=${blockerStatus}`,
		"誰が取るか:",
		"- 営業: 地番、登記地目、登記面積または資料面積、接道状況、現地感メモ、所有者意向。",
		"- AI/管理側: 系統公開情報JSON、登記所備付地図GeoJSON、WAGRI/eMAFF認証後の農地ピン、WAJO過去結果。",
		"- 外部待ち: WAGRI/eMAFF認証、送配電会社回答、農業委員会の正式回答。",
		"大ちゃんに即出すタスク:",
		"- 費用発生、申請、電話、本人確認、契約、支払い、アカウント権限が必要なものは、AIが黙って保留せず大ちゃんタスクとして先頭に出す。",
		"- WAGRI/eMAFF、OCCTO系統情報サービス、送配電会社の有料開示・接続検討・NDAが必要な場合は、必要事項、相手先、期限、聞くことを明記して依頼する。",
		"- 大ちゃんに伝わっていないタスクは未着手と同じ扱い。本文に出したうえで、進捗ログにも残す。",
		"取れたら何が分かるか:",
		"- 地番/登記: 地目、地積、所有者、権利リスク、筆界候補。農転見込みと面積条件を補正できる。",
		"- 接道/現地感: 幅員、道路種別、大型車進入、高低差、住宅密集、施工成立、近隣説明リスクを補正できる。",
		"- 系統公開情報: 設備名、電圧、空容量、N-1電制、更新日、元URLを入れると系統見込みを補正できる。",
		"- WAGRI/eMAFF農地情報: 農地ピン、農振法区分、都市計画法区分、筆ポリゴンを入れると農転見込みを補正できる。",
		"- WAJO過去結果: 行った/行かなかった、外れ理由、農業委員会の結果を入れると次回の当たり率を上げられる。",
		"不足データ:",
		"1. 地番｜営業｜土地DB「所在地」または案件化メモ｜登記・農地ナビ・筆界確認に進むため。",
		"2. 登記地目・地積｜営業｜登記情報提供サービス/法務局資料｜農転見込みと面積補正のため。",
		"3. 接道状況（幅員/道路種別/大型車進入）｜営業｜現地メモまたは道路台帳｜施工成立と搬入可否のため。",
		"4. 現地感メモ（高低差/荒れ/住宅密集/進入）｜営業｜現地写真/メモ｜需要、施工、近隣リスクの補正のため。",
		"5. 系統公開情報（設備名/電圧/空容量/N-1/更新日/元URL）｜AI/管理側｜GRID_CAPACITY_PUBLIC_JSON_URLS｜系統見込み補正のため。",
		"6. OCCTO/送配電会社系統情報（需要、潮流、混雑、作業停止、受付状況、系統用蓄電池受付状況）｜AI/管理側。有料・申請・NDAが必要なら大ちゃんタスク化｜系統見込み・需要見込み補正のため。",
		"7. WAGRI/eMAFF農地情報（農地ピン/農振法区分/都市計画法区分/筆ポリゴン）｜AI/管理側。ただし認証確認後。電話・申請が止まる場合は大ちゃんタスク化｜農転見込み補正のため。",
		"8. WAJO過去結果（成否/外れ理由/農業委員会結果）｜管理側｜AI学習ログDB｜次回の判断補正のため。",
		"不足のまま出す速報: 予測は出す。ただし原本確認済み、系統空き確認済み、農転確認済みとは言わない。",
	].join("\n");
}

function formatJstSalesPathDeadline(daysFromNow: number): string {
	const now = new Date();
	const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + daysFromNow * 24 * 60 * 60 * 1000);
	const yyyy = jst.getUTCFullYear();
	const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(jst.getUTCDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd} 18:00`;
}

function evaluateFarmlandPreAssessment(
	input: LandTreasureInput,
	blockers: string[],
	roadWidthM: number | null,
): LandFarmlandPreAssessment {
	const combined = [
		input.farmland,
		input.farmlandType,
		input.landUse,
		input.road,
		input.registry,
	].join(" ");
	const evidence: string[] = [];
	let score = 50;

	if (/不可|不許可|転用困難/.test(input.farmland)) {
		score = 10;
		evidence.push("農地転用可否に不可・不許可系の入力あり");
	} else if (/不要|許可済|回答済|確認済|済|可能|可/.test(input.farmland)) {
		score += 30;
		evidence.push(`農地転用可否=${input.farmland}`);
	} else if (/未確認|未照会|不明/.test(input.farmland)) {
		score -= 10;
		evidence.push("農地転用可否は未確認");
	}

	if (/農業振興地域外|農振外/.test(combined)) {
		score += 15;
		evidence.push("農業振興地域外の可能性");
	}
	if (/農用地区域内/.test(combined)) {
		score -= 30;
		evidence.push("農用地区域内の可能性");
	}
	if (/第1種農地|第一種農地|甲種農地/.test(combined)) {
		score -= 30;
		evidence.push("第1種農地または甲種農地の可能性");
	}
	if (/田|畑/.test(input.farmlandType)) {
		score -= 5;
		evidence.push(`地目=${input.farmlandType}`);
	}
	if (/市街化区域|用途地域|準工業|工業|商業|住居/.test(input.landUse)) {
		score += 15;
		evidence.push(`都市計画・用途地域=${input.landUse}`);
	}
	if (/市街化調整区域/.test(input.landUse)) {
		score -= 10;
		evidence.push("市街化調整区域の可能性");
	}
	if (/未接道|進入不可|不可|なし|無し/.test(input.road) || (roadWidthM !== null && roadWidthM < 4)) {
		score -= 20;
		evidence.push("接道・搬入に阻害要因あり");
	} else if (roadWidthM !== null && roadWidthM >= 4) {
		score += 5;
		evidence.push(`接道幅員候補=${roadWidthM}m`);
	} else if (!input.road) {
		score -= 5;
		evidence.push("接道情報なし");
	}
	if (/確認済|登記済|所有者確認済/.test(input.registry)) {
		score += 5;
		evidence.push("登記確認済み");
	} else if (/所有者不明|権利未整理/.test(input.registry)) {
		score -= 20;
		evidence.push("所有者・権利に阻害要因あり");
	} else if (!input.registry || /未確認/.test(input.registry)) {
		score -= 10;
		evidence.push("登記・権利確認が未完了");
	}
	if (blockers.some((item) => /農地転用に阻害/.test(item))) {
		score = Math.min(score, 25);
	}
	if (blockers.some((item) => /農地・農転確認が未入力/.test(item))) {
		score = Math.min(score, 55);
		evidence.push("農地・農転確認が未入力");
	}

	const clampedScore = clamp(Math.round(score), 0, 100);
	const rank: LandFarmlandProspectRank = clampedScore >= 75 ? "高" : clampedScore >= 50 ? "中" : "低";
	const formalStatus = inferFarmlandFormalStatus(input.farmland, combined);
	const confidence = inferFarmlandConfidence(input, formalStatus);
	const actionBranch =
		rank === "高"
			? "案件継続・追加資料取得・農業委員会照会資料準備"
			: rank === "中"
				? "追加資料取得・2営業日以内に再判定"
				: "停止・責任者判断";
	const salesInputGuide = buildFarmlandSalesInputGuide(rank, formalStatus);

	return {
		score: clampedScore,
		rank,
		confidence,
		formalStatus,
		actionBranch,
		salesInputGuide,
		evidence: evidence.length > 0 ? evidence : ["農転判定に使える入力が不足"],
	};
}

function inferFarmlandFormalStatus(
	farmland: string,
	combined: string,
): LandFarmlandFormalStatus {
	if (/回答済|許可済|不許可|不可|不要|確認済/.test(farmland)) return "回答済み";
	if (/照会済|相談済|確認中/.test(combined)) return "照会済み";
	if (combined.trim()) return "照会準備中";
	return "未照会";
}

function inferFarmlandConfidence(
	input: LandTreasureInput,
	formalStatus: LandFarmlandFormalStatus,
): LandFarmlandConfidence {
	if (formalStatus === "回答済み") return "高";
	const filled = [
		input.farmland,
		input.farmlandType,
		input.landUse,
		input.road,
		input.registry,
		input.latitude !== null && input.longitude !== null ? "座標あり" : "",
	].filter((value) => String(value).trim()).length;
	if (filled >= 5) return "高";
	if (filled >= 3) return "中";
	return "低";
}

function buildFarmlandSalesInputGuide(
	rank: LandFarmlandProspectRank,
	formalStatus: LandFarmlandFormalStatus,
): string {
	const deadline =
		rank === "高"
			? "本日中"
			: rank === "中"
				? "2営業日以内"
				: "本日中に責任者判断";
	const nextAction =
		rank === "高"
			? "所有者、接道、系統、価格調査を並行し、農業委員会への照会資料も準備する。"
			: rank === "中"
				? "不足資料を入力し、正式回答を待たずに再判定する。"
				: "現地訪問や追加費用は原則停止し、例外理由がある場合だけ責任者判断へ送る。";
	return [
		"営業担当への入力案内:",
		"担当: 営業担当",
		"調べるもの: 地番 / 地目 / 農振法区分 / 農地区分 / 都市計画法区分 / 農業委員会相談状況 / 回答予定日",
		"入力場所: 土地DB",
		"土地DBへ入れる項目:",
		"1. 土地DB「所在地」= 都道府県 + 市区町村 + 大字/字 + 地番。住居住所だけなら末尾に「地番未確認」と追記。",
		"2. 土地DB「面積（坪）」= 数字だけ。㎡しかない場合は坪換算前の㎡値も案件化メモへ残す。",
		"3. 土地DB「農地種別」= 地目=... / 農振法区分=... / 農地区分=... / 都市計画法区分=... / 所管農業委員会=...",
		"4. 土地DB「農地転用可否」= 正式許可ではなく「未確認」または相談状況で入力。正式回答がある場合だけ「可能/不可/不要/回答済み」系にする。",
		"5. 土地DB「接道状況」= 道路名 / 幅員○m / 道路種別 / 大型車進入 可・不可・未確認。",
		"6. 土地DB「登記確認状況」= 未確認 / 確認済み / 所有者不明 / 権利未整理。",
		"7. 土地DB「近隣住宅距離（m）」= 最短距離m。未確認なら空欄のまま、近隣住宅確認欄または案件化メモへ未確認と書く。",
		"入力例: 土地DB「接道状況」= 南側市道○号 / 幅員6m / 建築基準法道路: 要確認 / 大型車進入: 可",
		"入力例: 土地DB「農地種別」= 地目=田 / 農振法区分=農用地区域外 / 農地区分=第2種農地想定 / 都市計画法区分=非線引き / 所管農業委員会=○○市農業委員会",
		"迷ったら「未確認」と入れる。営業判断ではなく、資料・聞き取り・公的画面に書いてある値だけ転記する。",
		`期限: ${deadline}`,
		`正式確認状態: ${formalStatus}`,
		`次アクション: ${nextAction}`,
		"再判定時期: 入力直後、または農業委員会への照会状況更新時",
	].join("\n");
}

function formatFarmlandPreAssessment(assessment: LandFarmlandPreAssessment): string {
	return [
		"農転事前判定:",
		`見込みスコア: ${assessment.score} / 見込みランク: ${assessment.rank} / 判定信頼度: ${assessment.confidence} / 正式確認状態: ${assessment.formalStatus}`,
		`行動分岐: ${assessment.actionBranch}`,
		`判定根拠: ${assessment.evidence.slice(0, 4).join(" / ")}`,
		"営業担当への入力案内: 入力場所: 土地DB / 土地DB「所在地」「面積（坪）」「農地種別」「農地転用可否」「接道状況」「登記確認状況」を更新。正式許可ではなく「未確認」または相談状況を入力。",
	].join("\n");
}

function findNearestSubstations(
	latitude: number | null,
	longitude: number | null,
	powerArea: string,
	limit: number,
): NearestSubstation[] {
	if (latitude === null || longitude === null) return [];
	const matched = LAND_SUBSTATIONS.filter((substation) =>
		operatorMatchesPowerArea(substation.op, powerArea),
	);
	const candidates = matched.length > 0 ? matched : LAND_SUBSTATIONS;
	return candidates
		.map((substation) => ({
			substation,
			distanceKm: haversineKm(latitude, longitude, substation.lat, substation.lng),
		}))
		.sort((a, b) => a.distanceKm - b.distanceKm)
		.slice(0, limit);
}

function formatSubstationCandidates(candidates: LandTreasureSubstationCandidate[]): string {
	if (candidates.length === 0) return "変電所候補3件: 未特定（緯度経度なし）";
	return [
		"変電所候補3件:",
		...candidates.map((candidate, index) =>
			[
				`${index + 1}. ${candidate.name}`,
				`${round1(candidate.distanceKm)}km`,
				candidate.operator,
				`系統=${candidate.gridStatus || "未確認"}`,
				candidate.voltageKv !== null ? `${candidate.voltageKv}kV` : "電圧未確認",
				`確認リンク=${candidate.confirmationUrl}`,
			].join(" / "),
		),
	].join("\n");
}

function googleMapsUrl(latitude: number, longitude: number): string {
	return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function scorePhysicalAi(input: {
	area: number;
	distanceKm: number | null;
	gridStatus: string;
	roadWidthM: number | null;
	landUse: string;
	blockers: string[];
}): number {
	let score = 0;
	score += input.area >= 5000 ? 18 : input.area >= 2400 ? 14 : input.area >= 1500 ? 10 : 5;
	score += scoreDistance(input.distanceKm);
	score += input.gridStatus === "○" ? 24 : input.gridStatus === "△" ? 12 : input.gridStatus === "×" ? -8 : 8;
	score += input.roadWidthM === null ? 8 : input.roadWidthM >= 6 ? 18 : input.roadWidthM >= 4 ? 14 : -6;
	score += input.landUse ? 5 : 0;
	score -= input.blockers.length * 7;
	return clamp(score, 0, 100);
}

function scoreSalesAi(input: {
	area: number;
	distanceKm: number | null;
	roadWidthM: number | null;
	powerArea: string;
	farmland: string;
	farmlandType: string;
	registry: string;
	blockers: string[];
}): number {
	let score = 0;
	score += input.area >= 5000 ? 34 : input.area >= 2400 ? 26 : input.area >= 1500 ? 20 : 8;
	score += input.powerArea && input.powerArea !== "未確認" ? 12 : 0;
	score += input.distanceKm !== null && input.distanceKm <= 1 ? 24 : input.distanceKm !== null && input.distanceKm <= 3 ? 18 : input.distanceKm !== null && input.distanceKm <= 5 ? 12 : 4;
	score += input.roadWidthM === null ? 6 : input.roadWidthM >= 6 ? 16 : input.roadWidthM >= 4 ? 12 : -8;
	score += /不要|済|確認済|可|可能/.test(`${input.farmland} ${input.farmlandType} ${input.registry}`) ? 14 : 6;
	score -= input.blockers.length * 9;
	return clamp(score, 0, 100);
}

function identifyBirdEyeBlockers(
	input: LandTreasureInput,
	roadWidthM: number | null,
	distanceKm: number | null,
): string[] {
	const blockers: string[] = [];
	if (distanceKm === null) {
		blockers.push("変電所距離が未確認");
	}
	if (!input.road) {
		blockers.push("接道情報が未確認");
	} else if (
		roadWidthM === null &&
		!/大型車進入可|搬入可|4m|４m|6m|６m|幅員\s*[46４６]/.test(input.road)
	) {
		blockers.push("接道幅員・大型車進入が未確認");
	}
	if (/未接道|進入不可|不可|なし|無し/.test(input.road) || (roadWidthM !== null && roadWidthM < 4)) {
		blockers.push("未接道または大型車進入不可");
	}
	if (!input.farmland && !input.farmlandType) {
		blockers.push("農地・農転確認が未入力");
	}
	if (/不可/.test(input.farmland) || /第1種農地/.test(input.farmlandType)) {
		blockers.push("農地転用に阻害要因あり");
	}
	if (!input.registry) {
		blockers.push("登記確認が未入力");
	}
	if (/所有者不明/.test(input.registry)) {
		blockers.push("登記・所有者確認に阻害要因あり");
	}
	return blockers;
}

function buildNearbyResidentialAlert(input: LandTreasureInput): string {
	if (
		(input.nearbyResidentialDistanceM !== null && input.nearbyResidentialDistanceM < 30) ||
		/30m未満/.test(input.nearbyResidentialCheck)
	) {
		return "近隣住宅注意: 近隣に住宅らしき建物あり。現地・与信時に注意。";
	}
	if (input.nearbyResidentialDistanceM === null && !input.nearbyResidentialCheck) {
		return "近隣住宅注意: 距離未確認。現地・与信時に注意。";
	}
	return "";
}

function applyBirdEyeCaps(score: number, blockers: string[]): number {
	if (blockers.length === 0) return score;
	let cap = 78;
	if (blockers.some((item) => /変電所距離/.test(item))) cap = Math.min(cap, 72);
	if (blockers.some((item) => /接道情報|接道幅員/.test(item))) cap = Math.min(cap, 69);
	if (blockers.some((item) => /農地・農転確認|登記確認/.test(item))) cap = Math.min(cap, 72);
	if (blockers.some((item) => /近隣住宅距離/.test(item))) cap = Math.min(cap, 74);
	if (blockers.some((item) => /未接道/.test(item))) cap = Math.min(cap, 58);
	if (blockers.some((item) => /農地転用/.test(item))) cap = Math.min(cap, 62);
	if (blockers.some((item) => /所有者/.test(item))) cap = Math.min(cap, 62);
	if (blockers.length >= 3) cap = Math.min(cap, 64);
	if (blockers.filter((item) => /不可|阻害|近い|未接道/.test(item)).length >= 3) {
		cap = Math.min(cap, 55);
	}
	return Math.min(score, cap);
}

function buildCustomerValueStatement(input: {
	grade: LandTreasureGrade;
	score: number;
	area: number;
	distanceKm: number | null;
	powerArea: string;
	projectType: string;
	blockers: string[];
}): string {
	const areaText = input.area > 0 ? `${Math.round(input.area).toLocaleString("ja-JP")}坪` : "面積未確認";
	const distanceText = input.distanceKm === null ? "変電所距離未確認" : `変電所約${round1(input.distanceKm)}km`;
	if (input.blockers.length > 0) {
		return `顧客に提示できる価値は「${distanceText}・${areaText}の可能性」までで、現時点では${input.blockers.join("、")}が先に潰すべきリスクです。`;
	}
	if (input.grade === "S") {
		return `顧客に提示できる価値は「${input.powerArea}エリアで${distanceText}、${areaText}、${input.projectType}として初期検討できる希少な候補地」です。`;
	}
	if (input.grade === "A") {
		return `顧客に提示できる価値は「${distanceText}と${areaText}を起点に、追加確認後に案件化を狙える候補地」です。`;
	}
	return `顧客に提示できる価値はまだ限定的です。${distanceText}と${areaText}以外の成立条件を追加確認してください。`;
}

function scoreDistance(distanceKm: number | null): number {
	if (distanceKm === null) return 8;
	if (distanceKm <= 1) return 35;
	if (distanceKm <= 3) return 28;
	if (distanceKm <= 5) return 22;
	if (distanceKm <= 10) return 12;
	if (distanceKm <= 20) return 3;
	return -12;
}

function evaluateScaleDistanceGate(
	areaTsubo: number,
	distanceKm: number | null,
): LandScaleDistanceGate {
	if (areaTsubo < 3000) return "面積不足";
	if (distanceKm === null) return "距離未確認";
	return distanceKm <= 2 ? "通過候補" : "距離超過";
}

function buildScaleDistanceGateAction(gate: LandScaleDistanceGate): string {
	if (gate === "面積不足") {
		return "D規模・距離ゲート: 面積3,000坪以上に満たないため、登記地積・農地筆ポリゴン・複数筆の合計面積を確認してから再評価してください。";
	}
	if (gate === "距離超過") {
		return "D規模・距離ゲート: 最寄り変電所までの直線距離2kmを超えるため、系統公開情報・接続検討で代替系統と事業性を確認してから再評価してください。";
	}
	return "D規模・距離ゲート: 変電所距離が未確認です。住所・地番・座標を確認し、変電所DBで直線距離を再計算してください。";
}

function choosePowerRating(distanceKm: number | null, gridStatus: string): string {
	if (distanceKm !== null && distanceKm <= 1 && gridStatus !== "×") return "◎";
	if (distanceKm !== null && distanceKm <= 5) return "○";
	if (distanceKm !== null && distanceKm <= 10) return "△";
	return gridStatus === "×" ? "×" : "△";
}

function chooseRoadRatingFromWidth(widthM: number | null, road: string): string {
	if (/不可|なし|無し|狭い|2m未満|未接道/.test(road)) return "不可";
	if (widthM === null) return road ? "要確認" : "要確認";
	if (widthM >= 4) return "可";
	return "不可";
}

function roadWidthFromText(value: string): number | null {
	const normalized = value.replace(/[０-９．]/g, (char) =>
		String.fromCharCode(char.charCodeAt(0) - 0xfee0),
	);
	const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:m|ｍ|メートル|M)/i);
	return match ? Number(match[1]) : null;
}

function operatorMatchesPowerArea(operator: string, powerArea: string): boolean {
	if (!powerArea || powerArea === "未確認") return true;
	if (/中部/.test(powerArea)) return /中部/.test(operator);
	if (/東京/.test(powerArea)) return /東京/.test(operator);
	if (/関西/.test(powerArea)) return /関西/.test(operator);
	if (/九州/.test(powerArea)) return /九州/.test(operator);
	if (/北海道/.test(powerArea)) return /北海道/.test(operator);
	if (/東北/.test(powerArea)) return /東北/.test(operator);
	if (/北陸/.test(powerArea)) return /北陸/.test(operator);
	if (/中国/.test(powerArea)) return /中国/.test(operator);
	if (/四国/.test(powerArea)) return /四国/.test(operator);
	if (/沖縄/.test(powerArea)) return /沖縄/.test(operator);
	return true;
}

function inferPowerAreaFromAddress(address: string): string {
	if (!address) return "";
	if (/大阪|京都|兵庫|奈良|滋賀|和歌山/.test(address)) return "関西電力";
	if (/東京|神奈川|埼玉|千葉|茨城|栃木|群馬|山梨|静岡県富士川以東/.test(address)) return "東京電力";
	if (/愛知|岐阜|三重|長野|静岡/.test(address)) return "中部電力";
	if (/福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島/.test(address)) return "九州電力";
	if (/北海道/.test(address)) return "北海道電力";
	if (/青森|岩手|宮城|秋田|山形|福島|新潟/.test(address)) return "東北電力";
	if (/富山|石川|福井/.test(address)) return "北陸電力";
	if (/鳥取|島根|岡山|広島|山口/.test(address)) return "中国電力";
	if (/徳島|香川|愛媛|高知/.test(address)) return "四国電力";
	if (/沖縄/.test(address)) return "沖縄電力";
	return "";
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const radiusKm = 6371;
	const dLat = toRadians(lat2 - lat1);
	const dLng = toRadians(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRadians(lat1)) *
			Math.cos(toRadians(lat2)) *
			Math.sin(dLng / 2) ** 2;
	return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
	return (value * Math.PI) / 180;
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
