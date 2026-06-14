import assert from "node:assert/strict";
import { processLandEvaluationForTest } from "./index";

function titleProp(value: string) {
	return { type: "title", title: [{ plain_text: value }] };
}

function richTextProp(value: string) {
	return { type: "rich_text", rich_text: [{ plain_text: value }] };
}

function numberProp(value: number) {
	return { type: "number", number: value };
}

function selectProp(value: string) {
	return { type: "select", select: { name: value } };
}

function dateProp() {
	return { type: "date", date: null };
}

function relationProp() {
	return { type: "relation", relation: [] };
}

function highValueLandPage() {
	return {
		id: "land-treasure-1",
		properties: {
			土地名称: titleProp("【TDD】中部・変電所近接 6000坪"),
			所在地: richTextProp("岐阜県土岐市 土岐津町 テスト用地"),
			"面積（坪）": numberProp(6000),
			緯度: numberProp(35.3556),
			経度: numberProp(137.1801),
			電力会社エリア: selectProp("中部電力"),
			用途地域: richTextProp("準工業地域"),
			接道状況: richTextProp("南側6m公道に接道。大型車進入可。"),
			農地転用可否: selectProp("不要"),
			登記確認状況: selectProp("確認済み"),
			"変電所距離（km）": numberProp(0.1),
			"近隣住宅距離（m）": numberProp(120),
			近隣住宅確認: selectProp("30m以上"),
			送電線の有無: selectProp("近接あり"),
			処理ステータス: selectProp("未処理"),
			案件化状態: selectProp("未案件化"),
			AIアクションバケット: selectProp("継続監視"),
			総合評価: selectProp("C"),
			AI総合スコア: numberProp(0),
			AI案件種別: selectProp("未判定"),
			土地評価: selectProp("△"),
			"電力評価（仮説）": selectProp("△"),
			電力評価: selectProp("△"),
			AI接道評価: selectProp("要確認"),
			AI補助金評価: selectProp("要確認"),
			需要評価: selectProp("不明"),
			案件化メモ: richTextProp(""),
			一次AI受付メモ: richTextProp(""),
			次アクション: richTextProp(""),
			AI更新日時: dateProp(),
			Webhook引き継ぎステータス: selectProp("待機"),
			Webhook引き継ぎメモ: richTextProp(""),
			設計上の弱点: richTextProp(""),
			AI学習ログ: relationProp(),
		},
	};
}

function nearSubstationButBlockedPage() {
	return {
		id: "land-blocked-1",
		properties: {
			土地名称: titleProp("【TDD】近いだけで危ない土地"),
			所在地: richTextProp("岐阜県土岐市 土岐津町 テスト用地"),
			"面積（坪）": numberProp(6000),
			緯度: numberProp(35.3556),
			経度: numberProp(137.1801),
			電力会社エリア: selectProp("中部電力"),
			用途地域: selectProp("市街化調整区域"),
			接道状況: richTextProp("未接道。大型車進入不可。"),
			農地転用可否: selectProp("不可"),
			登記確認状況: selectProp("所有者不明"),
			"変電所距離（km）": numberProp(0.1),
			"近隣住宅距離（m）": numberProp(10),
			近隣住宅確認: selectProp("30m未満"),
			送電線の有無: selectProp("近接あり"),
			処理ステータス: selectProp("未処理"),
			案件化状態: selectProp("未案件化"),
			AIアクションバケット: selectProp("継続監視"),
			総合評価: selectProp("C"),
			AI総合スコア: numberProp(0),
			AI案件種別: selectProp("未判定"),
			土地評価: selectProp("△"),
			"電力評価（仮説）": selectProp("△"),
			電力評価: selectProp("△"),
			AI接道評価: selectProp("要確認"),
			AI補助金評価: selectProp("要確認"),
			需要評価: selectProp("不明"),
			案件化メモ: richTextProp(""),
			一次AI受付メモ: richTextProp(""),
			次アクション: richTextProp(""),
			AI更新日時: dateProp(),
			Webhook引き継ぎステータス: selectProp("待機"),
			Webhook引き継ぎメモ: richTextProp(""),
			設計上の弱点: richTextProp(""),
			AI学習ログ: relationProp(),
		},
	};
}

function addressOnlyPage() {
	return {
		id: "land-address-only-1",
		properties: {
			土地名称: titleProp("【TDD】住所だけの土地"),
			所在地: richTextProp("岐阜県土岐市土岐津町"),
			"面積（坪）": numberProp(6000),
			処理ステータス: selectProp("未処理"),
			案件化状態: selectProp("未案件化"),
			AIアクションバケット: selectProp("継続監視"),
			総合評価: selectProp("C"),
			AI総合スコア: numberProp(0),
			AI案件種別: selectProp("未判定"),
			土地評価: selectProp("△"),
			"電力評価（仮説）": selectProp("△"),
			電力評価: selectProp("△"),
			AI接道評価: selectProp("要確認"),
			AI補助金評価: selectProp("要確認"),
			需要評価: selectProp("不明"),
			案件化メモ: richTextProp(""),
			一次AI受付メモ: richTextProp(""),
			次アクション: richTextProp(""),
			AI更新日時: dateProp(),
			Webhook引き継ぎステータス: selectProp("待機"),
			Webhook引き継ぎメモ: richTextProp(""),
			設計上の弱点: richTextProp(""),
			AI学習ログ: relationProp(),
		},
	};
}

function mieGridCapacityAddressOnlyPage() {
	const page = addressOnlyPage();
	return {
		...page,
		id: "land-mie-grid-capacity-bundled-1",
		properties: {
			...page.properties,
			土地名称: titleProp("【TDD】三重県鈴鹿市・公式系統公表値候補"),
			所在地: richTextProp("三重県鈴鹿市神戸"),
			緯度: numberProp(34.906456),
			経度: numberProp(136.570953),
			電力会社エリア: selectProp("中部電力"),
		},
	};
}

async function main() {
	const updates: Array<Record<string, unknown>> = [];
	const createdPages: Array<Record<string, unknown>> = [];
	let activePage = highValueLandPage();
	const originalFetch = globalThis.fetch;
	const originalGoogleKey = process.env.GOOGLE_MAPS_API_KEY;
	const originalGoogleApiKey = process.env.GOOGLE_API_KEY;
	const originalWagriToken = process.env.WAGRI_ACCESS_TOKEN;
	const originalWagriApiToken = process.env.WAGRI_API_TOKEN;
	const originalWagriTokenAlt = process.env.WAGRI_TOKEN;
	const originalReinfolibKey = process.env.REINFOLIB_API_KEY;
	const originalRealEstateLibraryApiKey = process.env.REAL_ESTATE_LIBRARY_API_KEY;
	const originalMlitReinfolibApiKey = process.env.MLIT_REINFOLIB_API_KEY;
	const originalMojChizuGeoJsonUrls = process.env.MOJ_CHIZU_GEOJSON_URLS;
	const originalMojChizuGeoJsonUrl = process.env.MOJ_CHIZU_GEOJSON_URL;
	const originalGsiRoadTileEnabled = process.env.GSI_ROAD_TILE_ENABLED;
	const originalGridCapacityPublicUrls = process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
	const originalGridCapacityPublicUrl = process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
	const originalGridCapacityPublicJson = process.env.GRID_CAPACITY_PUBLIC_JSON;
	process.env.GSI_ROAD_TILE_ENABLED = "0";
	const notion = {
		pages: {
			retrieve: async () => activePage,
			update: async (args: Record<string, unknown>) => {
				updates.push(args);
				return { id: args.page_id };
			},
			create: async (args: Record<string, unknown>) => {
				createdPages.push(args);
				return { id: "learning-log-1" };
			},
		},
	};

	const result = await processLandEvaluationForTest(
		{ pageId: "land-treasure-1", dryRun: false },
		notion as never,
	);

	assert.equal(result.action, "evaluated");
	assert.equal(result.overallGrade, "S");
	assert.equal(result.bucket, "即アタック");
	assert.ok(result.score >= 90);

	const finalUpdate = updates.at(-1)?.properties as Record<string, unknown>;
	assert.deepEqual(finalUpdate.総合評価, { select: { name: "S" } });
	assert.deepEqual(finalUpdate.AI総合スコア, { number: result.score });

	const memo = JSON.stringify(finalUpdate.案件化メモ ?? {});
	assert.match(memo, /最寄り変電所/);
	assert.match(memo, /変電所候補3件/);
	assert.match(memo, /1\..*変電所.*km/);
	assert.match(memo, /2\..*変電所.*km/);
	assert.match(memo, /3\..*変電所.*km/);
	assert.match(memo, /確認リンク/);
	assert.match(memo, /google\.com\/maps\/search/);
	assert.match(memo, /土岐津変電所/);
	assert.match(memo, /2AI/);
	assert.match(memo, /接道/);
	assert.match(memo, /顧客に提示できる価値/);
	assert.match(memo, /鳥の目/);
	assert.match(memo, /農転事前判定/);
	assert.match(memo, /見込みランク: 高/);
	assert.match(memo, /正式確認状態: 回答済み/);
	assert.match(memo, /営業担当への入力案内/);

	assert.equal(createdPages.length, 1);
	const learningLog = createdPages[0]!.properties as Record<string, unknown>;
	assert.match(JSON.stringify(learningLog.判定根拠), /2AI/);
	assert.match(JSON.stringify(learningLog.判定根拠), /SABC/);

	activePage = nearSubstationButBlockedPage();
	const blockedResult = await processLandEvaluationForTest(
		{ pageId: "land-blocked-1", dryRun: false },
		notion as never,
	);
	assert.notEqual(blockedResult.overallGrade, "S");
	assert.notEqual(blockedResult.bucket, "即アタック");
	const blockedMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(blockedMemo, /変電所だけでは/);
	assert.match(blockedMemo, /未接道/);
	assert.match(blockedMemo, /農転|農地/);
	assert.match(blockedMemo, /近隣住宅/);
	assert.match(blockedMemo, /農転事前判定/);
	assert.match(blockedMemo, /見込みランク: 低/);
	assert.match(blockedMemo, /停止・責任者判断/);

	delete process.env.GOOGLE_MAPS_API_KEY;
	delete process.env.GOOGLE_API_KEY;
	delete process.env.WAGRI_ACCESS_TOKEN;
	delete process.env.WAGRI_API_TOKEN;
	delete process.env.WAGRI_TOKEN;
	delete process.env.REINFOLIB_API_KEY;
	delete process.env.REAL_ESTATE_LIBRARY_API_KEY;
	delete process.env.MLIT_REINFOLIB_API_KEY;
	delete process.env.MOJ_CHIZU_GEOJSON_URLS;
	delete process.env.MOJ_CHIZU_GEOJSON_URL;
	process.env.GSI_ROAD_TILE_ENABLED = "0";
	delete process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
	delete process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
	delete process.env.GRID_CAPACITY_PUBLIC_JSON;
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("msearch.gsi.go.jp/address-search/AddressSearch")) {
			return new Response(
				JSON.stringify([
					{
						geometry: { type: "Point", coordinates: [137.1801, 35.3556] },
						properties: { title: "岐阜県土岐市土岐津町" },
					},
				]),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		return new Response("{}", { status: 404 });
	}) as typeof fetch;
	activePage = { ...addressOnlyPage(), id: "land-initial-input-only-10" };
	const initialInputOnlyResult = await processLandEvaluationForTest(
		{ pageId: "land-initial-input-only-10", dryRun: false },
		notion as never,
	);
	assert.equal(initialInputOnlyResult.score, 18);
	assert.equal(initialInputOnlyResult.overallGrade, "C");
	assert.notEqual(initialInputOnlyResult.bucket, "即アタック");
	const initialInputOnlyMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(initialInputOnlyMemo, /初回入力ゲート: 18\/100/);
	assert.match(initialInputOnlyMemo, /国土地理院住所検索/);
	assert.match(initialInputOnlyMemo, /面積: 10\/15/);
	assert.match(initialInputOnlyMemo, /接道: 0\/15/);
	assert.match(initialInputOnlyMemo, /系統情報: 0\/15/);
	assert.match(initialInputOnlyMemo, /変電所・連系点からの距離: 8\/10/);
	assert.match(initialInputOnlyMemo, /農地転用: 0\/20/);
	assert.match(initialInputOnlyMemo, /ハザード: 0\/10/);
	assert.match(initialInputOnlyMemo, /地目・用地: 0\/15/);
	assert.match(initialInputOnlyMemo, /自動取得証拠: 変電所・連系点からの距離=住所ジオコードから最寄り変電所候補算出/);

	delete process.env.GSI_ROAD_TILE_ENABLED;
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("msearch.gsi.go.jp/address-search/AddressSearch")) {
			return new Response(
				JSON.stringify([
					{
						geometry: { type: "Point", coordinates: [137.1801, 35.3556] },
						properties: { title: "岐阜県土岐市土岐津町" },
					},
				]),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/experimental_rdcl/")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "LineString",
								coordinates: [
									[137.1799, 35.3553],
									[137.1804, 35.3558],
								],
							},
							properties: {
								name: "市道テスト線",
								rdCtg: "市町村道等",
								rnkWidth: "5.5m以上13m未満",
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		return new Response("{}", { status: 404 });
	}) as typeof fetch;
	activePage = { ...addressOnlyPage(), id: "land-gsi-road-material-26" };
	const gsiRoadMaterialResult = await processLandEvaluationForTest(
		{ pageId: "land-gsi-road-material-26", dryRun: false },
		notion as never,
	);
	assert.equal(gsiRoadMaterialResult.score, 26);
	const gsiRoadMaterialMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(gsiRoadMaterialMemo, /初回入力ゲート: 26\/100/);
	assert.match(gsiRoadMaterialMemo, /接道: 8\/15/);
	assert.match(gsiRoadMaterialMemo, /国土地理院道路中心線/);
	assert.match(gsiRoadMaterialMemo, /道路台帳で確認/);

	process.env.GOOGLE_MAPS_API_KEY = "test-google-key";
	process.env.WAGRI_ACCESS_TOKEN = "test-wagri-token";
	process.env.REINFOLIB_API_KEY = "test-reinfolib-key";
	process.env.REINFOLIB_LAND_PRICE_YEAR = "2025";
	process.env.REINFOLIB_TRANSACTION_YEAR = "2025";
	process.env.MOJ_CHIZU_GEOJSON_URLS = "https://mock.local/moj-chizu-toki.geojson";
	process.env.GSI_ROAD_TILE_ENABLED = "1";
	process.env.GRID_CAPACITY_PUBLIC_JSON_URLS = "https://mock.local/grid-capacity-chubu.json";
	const fetchedUrls: string[] = [];
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = String(input);
		fetchedUrls.push(url);
		if (url.includes("/geocode/")) {
			return new Response(
				JSON.stringify({
					results: [
						{
							geometry: {
								location: { lat: 35.3556, lng: 137.1801 },
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/nearestRoads")) {
			return new Response(
				JSON.stringify({ snappedPoints: [{ placeId: "mock-road-place-1" }] }),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("places.googleapis.com/v1/places:searchNearby")) {
			return new Response(
				JSON.stringify({
					places: [
						{
							displayName: { text: "土岐市立テスト小学校" },
							primaryType: "school",
							formattedAddress: "岐阜県土岐市土岐津町テスト1",
							location: { latitude: 35.356, longitude: 137.1806 },
							googleMapsUri: "https://maps.google.com/?cid=school",
						},
						{
							displayName: { text: "土岐テスト病院" },
							primaryType: "hospital",
							formattedAddress: "岐阜県土岐市土岐津町テスト2",
							location: { latitude: 35.3548, longitude: 137.1794 },
							googleMapsUri: "https://maps.google.com/?cid=hospital",
						},
						{
							displayName: { text: "土岐市駅" },
							primaryType: "train_station",
							formattedAddress: "岐阜県土岐市泉町",
							location: { latitude: 35.359, longitude: 137.182 },
							googleMapsUri: "https://maps.google.com/?cid=station",
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/experimental_rdcl/")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "LineString",
								coordinates: [
									[137.1799, 35.3553],
									[137.1804, 35.3558],
								],
							},
							properties: {
								name: "市道テスト線",
								rdCtg: "市町村道等",
								rnkWidth: "5.5m以上13m未満",
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/farmland/AgriculturalLand/SearchByLongitudeLatitude")) {
			return new Response(
				JSON.stringify([
					{
						CityCode: "212121",
						Latitude: 35.35561,
						Longitude: 137.18009,
						Address: "岐阜県土岐市土岐津町字テスト123",
						LandCategory: "田",
						Area: 6100,
						AgriculturalVibrationMethodClassification: "農業振興地域内・農用地区域内",
						CityPlanningActClassification: "市街化調整区域",
						IntentionOwnerAgriculturalLand: "非公表",
						RightClassification: "賃借権等の設定がない",
						IsIdleAgriculturalLand: "調査中",
						JurisdictionAgricultureCommitteeName: "土岐市農業委員会",
					},
				]),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/farmland/FieldPolygonID3/Get")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "Polygon",
								coordinates: [
									[
										[137.1797, 35.3552],
										[137.1805, 35.3552],
										[137.1805, 35.356],
										[137.1797, 35.356],
										[137.1797, 35.3552],
									],
								],
							},
							properties: {
								FieldPolygonId: "WAGRI-FP-123",
								CityCode: "21212",
								Area: 6120,
								LandCategory: "田",
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/XPT002")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: { type: "Point", coordinates: [137.1802, 35.3555] },
							properties: {
								city_code: "21212",
								target_year_name_ja: "令和7年1月1日",
								use_category_name_ja: "工業地",
								location_number_ja: "岐阜県土岐市土岐津町テスト123",
								u_current_years_price_ja: "32,000(円/㎡)",
								year_on_year_change_rate: "1.2",
								front_road_name_ja: "市道",
								front_road_width: 600,
								area_division_name_ja: "市街化区域",
								regulations_use_category_name_ja: "準工業地域",
								u_regulations_building_coverage_ratio_ja: "60(%)",
								u_regulations_floor_area_ratio_ja: "200(%)",
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
			if (url.includes("/XKT002")) {
				return new Response(
					JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "Polygon",
								coordinates: [
									[
										[137.179, 35.354],
										[137.182, 35.354],
										[137.182, 35.357],
										[137.179, 35.357],
										[137.179, 35.354],
									],
								],
							},
							properties: {
								city_code: "21212",
								city_name: "土岐市",
								use_area_ja: "準工業地域",
								u_building_coverage_ratio_ja: "60%",
								u_floor_area_ratio_ja: "200%",
							},
						},
					],
				}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			if (url.includes("sonicweb-asp.jp/city_suzuka/api/feature/")) {
				return new Response(JSON.stringify([]), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			if (url.includes("/XKT026")) {
				return new Response(
					JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "Polygon",
								coordinates: [
									[
										[137.179, 35.354],
										[137.182, 35.354],
										[137.182, 35.357],
										[137.179, 35.357],
										[137.179, 35.354],
									],
								],
							},
							properties: {
								A31a_202: "庄内川水系テスト川",
								A31a_205: 1,
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("/XKT016") || url.includes("/XKT029")) {
			return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
		if (url.includes("/XIT001")) {
			return new Response(
				JSON.stringify({
					data: [
						{
							Type: "宅地(土地)",
							MunicipalityCode: "21212",
							Municipality: "土岐市",
							DistrictName: "土岐津町",
							TradePrice: "58000000",
							Area: "1700",
							UnitPrice: "34100",
							CityPlanning: "準工業地域",
							Breadth: "6",
							Period: "2025年第1四半期",
							PriceCategory: "不動産取引価格情報",
						},
						{
							Type: "宅地(土地)",
							MunicipalityCode: "21212",
							Municipality: "土岐市",
							DistrictName: "泉町",
							TradePrice: "36000000",
							Area: "1200",
							UnitPrice: "30000",
							CityPlanning: "工業地域",
							Breadth: "5",
							Period: "2025年第1四半期",
							PriceCategory: "不動産取引価格情報",
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("moj-chizu-toki.geojson")) {
			return new Response(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: {
								type: "Polygon",
								coordinates: [
									[
										[137.179, 35.354],
										[137.182, 35.354],
										[137.182, 35.357],
										[137.179, 35.357],
										[137.179, 35.354],
									],
								],
							},
							properties: {
								市区町村名: "土岐市",
								大字: "土岐津町",
								小字: "テスト",
								地番: "123",
								地図種類: "14条地図",
								精度区分: "高精度",
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url.includes("grid-capacity-chubu.json")) {
			return new Response(
				JSON.stringify({
					data: [
						{
							powerArea: "中部電力",
							operator: "中部電力パワーグリッド",
							facilityName: "土岐津変電所",
							voltageKv: 77,
							availableCapacityMw: 12.5,
							status: "空容量候補あり",
							nMinusOne: "N-1電制は接続検討で確認",
							updatedAt: "2026-06-01",
							sourceUrl: "https://powergrid.chuden.co.jp/goannai/hatsuden_kouri/takuso_kyokyu/rule/map/",
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		return new Response("{}", { status: 404 });
	}) as typeof fetch;
	activePage = addressOnlyPage();
	const addressOnlyResult = await processLandEvaluationForTest(
		{ pageId: "land-address-only-1", dryRun: false },
		notion as never,
	);
	assert.notEqual(addressOnlyResult.overallGrade, "S");
	assert.notEqual(addressOnlyResult.bucket, "即アタック");
	assert.ok(addressOnlyResult.score < 65);
	assert.equal(addressOnlyResult.score, 60);
	const addressOnlyMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(addressOnlyMemo, /初回入力ゲート: 60\/100/);
	assert.match(addressOnlyMemo, /面積: 10\/15/);
	assert.match(addressOnlyMemo, /接道: 8\/15/);
	assert.match(addressOnlyMemo, /系統情報: 6\/15/);
	assert.match(addressOnlyMemo, /変電所・連系点からの距離: 8\/10/);
	assert.match(addressOnlyMemo, /農地転用: 12\/20/);
	assert.match(addressOnlyMemo, /ハザード: 6\/10/);
	assert.match(addressOnlyMemo, /地目・用地: 10\/15/);
	assert.match(addressOnlyMemo, /Google Geocoding API/);
	assert.match(addressOnlyMemo, /Google Roads/);
	assert.match(addressOnlyMemo, /Google Maps/);
	assert.match(addressOnlyMemo, /Google Places API/);
	assert.match(addressOnlyMemo, /周辺施設候補/);
	assert.match(addressOnlyMemo, /学校候補/);
	assert.match(addressOnlyMemo, /病院候補/);
	assert.match(addressOnlyMemo, /駅候補/);
	assert.match(addressOnlyMemo, /近隣説明リスク/);
	assert.match(addressOnlyMemo, /住宅密集判定ではない/);
	assert.match(addressOnlyMemo, /現地確認/);
	assert.match(addressOnlyMemo, /国土地理院道路候補/);
	assert.match(addressOnlyMemo, /道路中心線/);
	assert.match(addressOnlyMemo, /市道テスト線/);
	assert.match(addressOnlyMemo, /5\.5m以上13m未満/);
	assert.match(addressOnlyMemo, /幅員推定/);
	assert.match(addressOnlyMemo, /道路台帳で確認/);
	assert.match(addressOnlyMemo, /道路台帳確認先/);
	assert.match(addressOnlyMemo, /土岐市.*道路管理課|土岐市.*建築指導課|土岐市.*土木事務所/);
	assert.match(addressOnlyMemo, /建築基準法道路/);
	assert.match(addressOnlyMemo, /google\.com\/search/);
	assert.match(addressOnlyMemo, /不動産情報ライブラリ接続/);
	assert.match(addressOnlyMemo, /地価公示・地価調査/);
	assert.match(addressOnlyMemo, /32,000円\/㎡/);
	assert.match(addressOnlyMemo, /参考価格レンジ/);
	assert.match(addressOnlyMemo, /売買価格確定ではない/);
	assert.match(addressOnlyMemo, /用途地域: 準工業地域/);
	assert.match(addressOnlyMemo, /建蔽率: 60%/);
	assert.match(addressOnlyMemo, /容積率: 200%/);
	assert.match(addressOnlyMemo, /洪水浸水想定区域/);
	assert.match(addressOnlyMemo, /同一市区町村の取引事例候補/);
	assert.match(addressOnlyMemo, /登記所備付地図データ接続/);
	assert.match(addressOnlyMemo, /地番候補/);
	assert.match(addressOnlyMemo, /土岐市/);
	assert.match(addressOnlyMemo, /土岐津町/);
	assert.match(addressOnlyMemo, /123/);
	assert.match(addressOnlyMemo, /筆界候補/);
	assert.match(addressOnlyMemo, /登記確認済みではない/);
	assert.match(addressOnlyMemo, /農地ナビ接続/);
	assert.match(addressOnlyMemo, /WAGRI農地API/);
	assert.match(addressOnlyMemo, /ID付与済み筆ポリゴン取得API v3/);
	assert.match(addressOnlyMemo, /農地筆ポリゴン候補/);
	assert.match(addressOnlyMemo, /WAGRI-FP-123/);
	assert.match(addressOnlyMemo, /農地区画形状候補/);
	assert.match(addressOnlyMemo, /地目: 田/);
	assert.match(addressOnlyMemo, /農振法区分: 農業振興地域内・農用地区域内/);
	assert.match(addressOnlyMemo, /都市計画法区分: 市街化調整区域/);
	assert.match(addressOnlyMemo, /所管農業委員会: 土岐市農業委員会/);
	assert.ok(
		fetchedUrls.some(
			(url) =>
				url.startsWith("https://api.wagri2.net/basic/farmland/AgriculturalLand/SearchByLongitudeLatitude?") &&
				url.includes("minLatitude=") &&
				url.includes("maxLatitude=") &&
				url.includes("minLongitude=") &&
				url.includes("maxLongitude="),
		),
	);
	assert.match(addressOnlyMemo, /系統空き確認/);
	assert.match(addressOnlyMemo, /資源エネルギー庁/);
	assert.match(addressOnlyMemo, /OCCTO|電力広域的運営推進機関/);
	assert.match(addressOnlyMemo, /中部電力パワーグリッド/);
	assert.match(addressOnlyMemo, /系統空容量・予想潮流マッピング/);
	assert.match(addressOnlyMemo, /公表値候補/);
	assert.match(addressOnlyMemo, /土岐津変電所/);
	assert.match(addressOnlyMemo, /12\.5MW/);
	assert.match(addressOnlyMemo, /接続可否確定ではない/);
	assert.match(addressOnlyMemo, /接続検討/);
	assert.match(addressOnlyMemo, /農転事前判定/);
	assert.match(addressOnlyMemo, /見込みスコア/);
	assert.match(addressOnlyMemo, /正式確認状態: 照会準備中/);
	assert.match(addressOnlyMemo, /営業担当への入力案内/);
	assert.match(addressOnlyMemo, /入力場所: 土地DB/);
	assert.match(addressOnlyMemo, /土地DB「所在地」/);
	assert.match(addressOnlyMemo, /土地DB「面積（坪）」/);
	assert.match(addressOnlyMemo, /土地DB「農地種別」/);
	assert.match(addressOnlyMemo, /農振法区分=/);
	assert.match(addressOnlyMemo, /都市計画法区分=/);
	assert.match(addressOnlyMemo, /土地DB「農地転用可否」/);
	assert.match(addressOnlyMemo, /土地DB「接道状況」/);
	assert.match(addressOnlyMemo, /土地DB「登記確認状況」/);
	assert.match(addressOnlyMemo, /入力例: 土地DB「接道状況」=/);
	assert.match(addressOnlyMemo, /迷ったら「未確認」/);
	assert.match(addressOnlyMemo, /再判定時期/);
	assert.match(addressOnlyMemo, /接道幅員|大型車進入/);
	assert.doesNotMatch(addressOnlyMemo, /農転確認が未入力/);
	assert.match(addressOnlyMemo, /登記確認が未入力/);
	assert.match(addressOnlyMemo, /土地スカウト|一次評価|本評価不可/);
	assert.match(addressOnlyMemo, /今日やること/);
	assert.match(addressOnlyMemo, /地番/);
	assert.match(addressOnlyMemo, /登記情報提供サービス/);
	assert.match(addressOnlyMemo, /農業委員会/);
	assert.match(addressOnlyMemo, /道路台帳/);
	assert.match(addressOnlyMemo, /送配電会社|空き容量/);
	assert.match(addressOnlyMemo, /見送り理由候補/);
	assert.match(addressOnlyMemo, /近隣説明リスク/);
	assert.match(addressOnlyMemo, /営業トーク/);
	assert.match(addressOnlyMemo, /確認先/);
	assert.match(addressOnlyMemo, /不動産情報ライブラリ/);
	assert.match(addressOnlyMemo, /eMAFF農地ナビ/);
	assert.match(addressOnlyMemo, /登記情報提供サービス/);
	assert.match(addressOnlyMemo, /登記所備付地図/);
	assert.match(addressOnlyMemo, /OCCTO|電力広域的運営推進機関/);

	delete process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
	delete process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
	process.env.GRID_CAPACITY_PUBLIC_JSON = JSON.stringify({
		data: [
			{
				powerArea: "中部電力",
				operator: "中部電力パワーグリッド",
				facilityName: "遠方変電所",
				voltageKv: 77,
				availableCapacityMw: 1,
				status: "公表値候補。テスト用遠方設備。",
				nMinusOne: "接続検討で確認。",
				updatedAt: "2026-06-08",
				sourceUrl: "https://gridmap.powergrid.chuden.co.jp/geo_data/KRSIH013",
				mapCoordinates: { lat: 34.0, lon: 136.0 },
			},
			{
				powerArea: "中部電力",
				operator: "中部電力パワーグリッド",
				facilityName: "神戸変電所",
				voltageKv: 77,
				availableCapacityMw: 38,
				status: "公表値候補。中部電力PG公式CSVから取得。",
				nMinusOne: "不可 #3。接続検討で確認。",
				updatedAt: "2026-06-08",
				sourceUrl: "https://gridmap.powergrid.chuden.co.jp/geo_data/KRSIH013",
				mapCoordinates: { lat: 35.3557, lon: 137.1802 },
			},
		],
	});
	activePage = addressOnlyPage();
	const inlineGridCapacityResult = await processLandEvaluationForTest(
		{ pageId: "land-inline-grid-capacity-json-1", dryRun: false },
		notion as never,
	);
	assert.equal(inlineGridCapacityResult.score, 60);
	const inlineGridCapacityMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(inlineGridCapacityMemo, /系統空き確認/);
	assert.match(inlineGridCapacityMemo, /神戸変電所/);
	assert.match(inlineGridCapacityMemo, /38MW/);
	assert.match(inlineGridCapacityMemo, /公表値候補/);
	assert.match(inlineGridCapacityMemo, /接続可否確定ではない/);
	assert.match(inlineGridCapacityMemo, /gridmap\.powergrid\.chuden\.co\.jp\/geo_data\/KRSIH013/);
	assert.ok(inlineGridCapacityMemo.indexOf("神戸変電所") < inlineGridCapacityMemo.indexOf("遠方変電所"));

	process.env.GRID_CAPACITY_PUBLIC_JSON = JSON.stringify({
		data: [
			{
				powerArea: "中部電力",
				prefecture: "三重県",
				operator: "中部電力パワーグリッド",
				facilityName: "神戸変電所",
				voltageKv: 77,
				availableCapacityMw: 38,
				status: "公表値候補。中部電力PG公式CSVから取得。",
				nMinusOne: "不可 #3。接続検討で確認。",
				updatedAt: "2026-06-08",
				sourceUrl: "https://gridmap.powergrid.chuden.co.jp/geo_data/KRSIH013",
				mapCoordinates: { lat: 34.884053, lon: 136.575398 },
			},
		],
	});
	activePage = addressOnlyPage();
	await processLandEvaluationForTest(
		{ pageId: "land-grid-capacity-prefecture-mismatch-1", dryRun: false },
		notion as never,
	);
	const prefectureMismatchMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.doesNotMatch(prefectureMismatchMemo, /神戸変電所/);
	assert.match(prefectureMismatchMemo, /公表値候補0件|公表値候補未取得/);

	delete process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
	delete process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
	delete process.env.GRID_CAPACITY_PUBLIC_JSON;
	activePage = mieGridCapacityAddressOnlyPage();
	await processLandEvaluationForTest(
		{ pageId: "land-mie-grid-capacity-bundled-1", dryRun: false },
		notion as never,
	);
	const bundledGridCapacityMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.doesNotMatch(bundledGridCapacityMemo, /公表値候補未取得/);
	assert.match(bundledGridCapacityMemo, /神戸変電所/);
	assert.match(bundledGridCapacityMemo, /38MW/);
	assert.match(bundledGridCapacityMemo, /入力地点から約2\.52km/);
	assert.match(bundledGridCapacityMemo, /中部電力パワーグリッド/);
	assert.match(bundledGridCapacityMemo, /gridmap\.powergrid\.chuden\.co\.jp\/geo_data\/KRSIH013/);
	assert.match(bundledGridCapacityMemo, /更新=2026-06-08/);
	assert.match(bundledGridCapacityMemo, /接続可否確定ではない/);
	assert.match(bundledGridCapacityMemo, /鈴鹿市公式地理情報/);
	assert.match(bundledGridCapacityMemo, /対象点包含ヒット0件/);
	assert.match(bundledGridCapacityMemo, /農転可否・用途地域確定ではない/);

	const addressOnlyFinalUpdate = updates.at(-1)?.properties as Record<string, unknown>;
	assert.deepEqual(addressOnlyFinalUpdate.処理ステータス, { select: { name: "要確認" } });
	assert.deepEqual(addressOnlyFinalUpdate.案件化状態, { select: { name: "未案件化" } });
	assert.deepEqual(addressOnlyFinalUpdate.総合評価, { select: { name: "C" } });
	assert.doesNotMatch(addressOnlyMemo, /この土地、?1億|判定が全部出た|即アタック|農転不可|危険|接道OK/);

	activePage = {
		...highValueLandPage(),
		id: "land-missing-official-evidence-1",
		properties: {
			...highValueLandPage().properties,
			土地名称: titleProp("【TDD】系統近接だが公的確認なし"),
			農地転用可否: selectProp("未確認"),
			農地種別: richTextProp(""),
			登記確認状況: selectProp("未確認"),
			接道状況: richTextProp("近接道路候補あり。幅員は道路台帳で確認。"),
		},
	};
	const missingOfficialResult = await processLandEvaluationForTest(
		{ pageId: "land-missing-official-evidence-1", dryRun: false },
		notion as never,
	);
	assert.equal(missingOfficialResult.action, "needs-review");
	assert.equal(missingOfficialResult.overallGrade, "C");
	assert.notEqual(missingOfficialResult.bucket, "即アタック");
	assert.ok(missingOfficialResult.score <= 45);
	const missingOfficialMemo = JSON.stringify(updates.at(-1)?.properties ?? {});
	assert.match(missingOfficialMemo, /本評価不可|公的確認|調査指示/);
	assert.match(missingOfficialMemo, /農地・農転/);
	assert.match(missingOfficialMemo, /登記/);
	assert.match(missingOfficialMemo, /道路台帳|接道/);
	assert.match(missingOfficialMemo, /確認先/);
	assert.match(missingOfficialMemo, /不動産情報ライブラリ/);
	assert.match(missingOfficialMemo, /eMAFF農地ナビ/);
	assert.match(missingOfficialMemo, /登記情報提供サービス/);
	assert.match(missingOfficialMemo, /OCCTO|電力広域的運営推進機関/);
	assert.match(missingOfficialMemo, /農転事前判定/);
	assert.match(missingOfficialMemo, /見込みランク: 中|見込みランク: 低/);
	assert.match(missingOfficialMemo, /営業担当への入力案内/);
	assert.match(missingOfficialMemo, /担当: 営業担当/);
	assert.match(missingOfficialMemo, /土地DB「農地種別」/);
	assert.match(missingOfficialMemo, /土地DB「農地転用可否」/);
	assert.match(missingOfficialMemo, /土地DB「接道状況」/);
	assert.match(missingOfficialMemo, /正式許可ではなく「未確認」または相談状況/);
	assert.doesNotMatch(missingOfficialMemo, /農転不可|危険|1億|判定が全部出た/);

	globalThis.fetch = originalFetch;
	if (originalGoogleKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
	else process.env.GOOGLE_MAPS_API_KEY = originalGoogleKey;
	if (originalGoogleApiKey === undefined) delete process.env.GOOGLE_API_KEY;
	else process.env.GOOGLE_API_KEY = originalGoogleApiKey;
	if (originalWagriToken === undefined) delete process.env.WAGRI_ACCESS_TOKEN;
	else process.env.WAGRI_ACCESS_TOKEN = originalWagriToken;
	if (originalWagriApiToken === undefined) delete process.env.WAGRI_API_TOKEN;
	else process.env.WAGRI_API_TOKEN = originalWagriApiToken;
	if (originalWagriTokenAlt === undefined) delete process.env.WAGRI_TOKEN;
	else process.env.WAGRI_TOKEN = originalWagriTokenAlt;
	if (originalReinfolibKey === undefined) delete process.env.REINFOLIB_API_KEY;
	else process.env.REINFOLIB_API_KEY = originalReinfolibKey;
	if (originalRealEstateLibraryApiKey === undefined) delete process.env.REAL_ESTATE_LIBRARY_API_KEY;
	else process.env.REAL_ESTATE_LIBRARY_API_KEY = originalRealEstateLibraryApiKey;
	if (originalMlitReinfolibApiKey === undefined) delete process.env.MLIT_REINFOLIB_API_KEY;
	else process.env.MLIT_REINFOLIB_API_KEY = originalMlitReinfolibApiKey;
	delete process.env.REINFOLIB_LAND_PRICE_YEAR;
	delete process.env.REINFOLIB_TRANSACTION_YEAR;
	if (originalMojChizuGeoJsonUrls === undefined) delete process.env.MOJ_CHIZU_GEOJSON_URLS;
	else process.env.MOJ_CHIZU_GEOJSON_URLS = originalMojChizuGeoJsonUrls;
	if (originalMojChizuGeoJsonUrl === undefined) delete process.env.MOJ_CHIZU_GEOJSON_URL;
	else process.env.MOJ_CHIZU_GEOJSON_URL = originalMojChizuGeoJsonUrl;
	if (originalGsiRoadTileEnabled === undefined) delete process.env.GSI_ROAD_TILE_ENABLED;
	else process.env.GSI_ROAD_TILE_ENABLED = originalGsiRoadTileEnabled;
	if (originalGridCapacityPublicUrls === undefined) delete process.env.GRID_CAPACITY_PUBLIC_JSON_URLS;
	else process.env.GRID_CAPACITY_PUBLIC_JSON_URLS = originalGridCapacityPublicUrls;
	if (originalGridCapacityPublicUrl === undefined) delete process.env.GRID_CAPACITY_PUBLIC_JSON_URL;
	else process.env.GRID_CAPACITY_PUBLIC_JSON_URL = originalGridCapacityPublicUrl;
	if (originalGridCapacityPublicJson === undefined) delete process.env.GRID_CAPACITY_PUBLIC_JSON;
	else process.env.GRID_CAPACITY_PUBLIC_JSON = originalGridCapacityPublicJson;
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
