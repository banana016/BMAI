import * as XLSX from "xlsx";

/**
 * Builds a fully-fabricated, realistic-scale 7-sheet workbook matching the
 * real "스토어분석양식" schema, for regression tests that must run in every
 * environment (CI included) without a real customer file. No real store
 * name, URL, reviewer handle, order number, or review text appears anywhere
 * here — every value is generated from a seeded PRNG or a fixed fake string.
 */

// Deterministic PRNG (mulberry32) so the fixture — and any test asserting
// exact numbers against it — is stable across runs and machines.
function mulberry32(seed: number): () => number {
  let s = seed;
  return function random() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fillerRows(count: number): unknown[][] {
  return Array.from({ length: count }, () => []);
}

export const FIXTURE_STORE_NAME = "테스트 스토어";
export const FIXTURE_FILE_NAME = `스토어분석양식(${FIXTURE_STORE_NAME}).xlsx`;
export const FIXTURE_STORE_URL = "https://example.com/fake-anonymized-store";

export const FIXTURE_SALES_DAYS = 90;
export const FIXTURE_SALES_START = "2025-01-01";
export const FIXTURE_SALES_END = addDaysIso(FIXTURE_SALES_START, FIXTURE_SALES_DAYS - 1);

export const FIXTURE_ADS_DAYS = 60;
export const FIXTURE_ADS_START = "2025-02-01";
export const FIXTURE_ADS_END = addDaysIso(FIXTURE_ADS_START, FIXTURE_ADS_DAYS - 1);

export const FIXTURE_CUSTOMER_WEEKS = 12;

const TRAFFIC_CHANNELS = ["네이버 검색", "네이버 광고", "네이버 서비스", "직유입", "네이버 외부"];
const SEARCH_KEYWORDS = ["테스트키워드1", "테스트키워드2", "테스트키워드3", "테스트키워드4", "테스트키워드5"];
const FAKE_PRODUCT_NAMES = Array.from({ length: 15 }, (_, i) => `테스트 상품 ${i + 1}`);

const REVIEW_SENTENCES_GOOD = [
  "배송이 빨라서 좋았어요.",
  "품질이 기대 이상이라 만족합니다.",
  "재구매 의사 있습니다.",
  "포장이 꼼꼼해서 좋았습니다.",
  "설명한 것과 동일해요.",
];
const REVIEW_SENTENCES_BAD = [
  "생각보다 품질이 아쉬워요.",
  "배송이 너무 늦었습니다.",
  "설명과 실제 제품이 달라요.",
  "마감 처리가 부족합니다.",
  "가격 대비 별로예요.",
];

export function buildAnonymizedWorkbook(): XLSX.WorkBook {
  const rng = mulberry32(42);
  const wb = XLSX.utils.book_new();

  // 1. 스토어 오버뷰
  const overviewAoa: unknown[][] = [[], [null, null, null, null, null, null, null, null, null, "스토어 url", FIXTURE_STORE_URL]];
  const overviewWs = XLSX.utils.aoa_to_sheet(overviewAoa);
  overviewWs["K2"] = { t: "s", v: FIXTURE_STORE_URL, l: { Target: FIXTURE_STORE_URL } };
  XLSX.utils.book_append_sheet(wb, overviewWs, "스토어 오버뷰");

  // 2. 판매분석 — header at row 20 (index 19), 전체 + one channel row per day
  const salesHeader = ["날짜", "채널", "상품결제건수", "판매금액(총)", "판매금액(순)", "상품결제단가", "방문수", "구매전환율"];
  const salesRows: unknown[][] = [];
  for (let i = 0; i < FIXTURE_SALES_DAYS; i++) {
    const date = new Date(`${addDaysIso(FIXTURE_SALES_START, i)}T00:00:00Z`);
    const visits = randInt(rng, 150, 500);
    const orders = randInt(rng, Math.round(visits * 0.03), Math.round(visits * 0.12));
    const aov = randInt(rng, 12000, 28000);
    const gross = orders * aov;
    const net = Math.round(gross * 0.92);
    const conversionRate = Number(((orders / visits) * 100).toFixed(1));
    for (const channel of ["전체", "테스트 스토어(999999999)"]) {
      salesRows.push([date, channel, orders, gross, net, aov, visits, conversionRate]);
    }
  }
  const salesWs = XLSX.utils.aoa_to_sheet([...fillerRows(19), salesHeader, ...salesRows]);
  XLSX.utils.book_append_sheet(wb, salesWs, "판매분석");

  // 3. 방문분석 — header at row 21 (index 20), 전체 + N leaf channel rows per day
  const trafficHeader = [
    "날짜",
    "경로(1단계)",
    "경로(2단계)",
    "경로(3단계)",
    "마케팅링크 여부",
    "방문수",
    "상품결제건수",
    "구매전환율",
    "판매금액(총)",
    "상품결제단가",
  ];
  const trafficRows: unknown[][] = [];
  for (let i = 0; i < FIXTURE_SALES_DAYS; i++) {
    const date = new Date(`${addDaysIso(FIXTURE_SALES_START, i)}T00:00:00Z`);
    let totalVisits = 0;
    let totalOrders = 0;
    let totalSales = 0;
    const leaves: unknown[][] = [];
    for (const channel of TRAFFIC_CHANNELS) {
      const visits = randInt(rng, 20, 120);
      const orders = randInt(rng, 0, Math.round(visits * 0.1));
      const aov = randInt(rng, 12000, 28000);
      const sales = orders * aov;
      const cr = visits > 0 ? Number(((orders / visits) * 100).toFixed(1)) : 0;
      totalVisits += visits;
      totalOrders += orders;
      totalSales += sales;
      leaves.push([date, channel, "전체", "전체", "N", visits, orders, cr, sales, orders > 0 ? Math.round(sales / orders) : 0]);
    }
    const totalCr = totalVisits > 0 ? Number(((totalOrders / totalVisits) * 100).toFixed(1)) : 0;
    trafficRows.push([
      date,
      "전체",
      "전체",
      "전체",
      "전체",
      totalVisits,
      totalOrders,
      totalCr,
      totalSales,
      totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
    ]);
    trafficRows.push(...leaves);
  }
  const trafficWs = XLSX.utils.aoa_to_sheet([...fillerRows(20), trafficHeader, ...trafficRows]);
  XLSX.utils.book_append_sheet(wb, trafficWs, "방문분석");

  // 4. 검색분석 — header at row 17 (index 16)
  const searchHeader = ["날짜", "검색어", "방문수", "상품결제건수", "구매전환율", "판매금액(총)", "상품결제단가"];
  const searchRows: unknown[][] = [];
  for (let i = 0; i < FIXTURE_SALES_DAYS; i++) {
    const date = new Date(`${addDaysIso(FIXTURE_SALES_START, i)}T00:00:00Z`);
    let totalVisits = 0;
    let totalOrders = 0;
    let totalSales = 0;
    const leaves: unknown[][] = [];
    for (const keyword of SEARCH_KEYWORDS) {
      const visits = randInt(rng, 5, 60);
      const orders = randInt(rng, 0, Math.round(visits * 0.15));
      const aov = randInt(rng, 12000, 28000);
      const sales = orders * aov;
      const cr = visits > 0 ? Number(((orders / visits) * 100).toFixed(1)) : 0;
      totalVisits += visits;
      totalOrders += orders;
      totalSales += sales;
      leaves.push([date, keyword, visits, orders, cr, sales, orders > 0 ? Math.round(sales / orders) : 0]);
    }
    const totalCr = totalVisits > 0 ? Number(((totalOrders / totalVisits) * 100).toFixed(1)) : 0;
    searchRows.push([
      date,
      "전체",
      totalVisits,
      totalOrders,
      totalCr,
      totalSales,
      totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
    ]);
    searchRows.push(...leaves);
  }
  const searchWs = XLSX.utils.aoa_to_sheet([...fillerRows(16), searchHeader, ...searchRows]);
  XLSX.utils.book_append_sheet(wb, searchWs, "검색분석");

  // 5. 고객분석 — header at row 15 (index 14), 3 rows per week
  const customersHeader = [
    "날짜",
    "고객분류",
    "방문고객수",
    "방문고객수비중",
    "결제고객수",
    "결제고객수비중",
    "구매전환율(고객)",
    "판매금액(총)",
    "판매금액(총)비중",
    "객단가",
  ];
  const customersRows: unknown[][] = [];
  for (let w = 0; w < FIXTURE_CUSTOMER_WEEKS; w++) {
    const weekStart = addDaysIso(FIXTURE_SALES_START, w * 7);
    const weekEnd = addDaysIso(FIXTURE_SALES_START, w * 7 + 6);
    const label = `${weekStart}~${weekEnd}`;
    const totalVisitors = randInt(rng, 800, 2500);
    const newVisitors = Math.round(totalVisitors * 0.92);
    const returningVisitors = totalVisitors - newVisitors;
    const totalPayers = randInt(rng, 40, 200);
    const newPayers = Math.round(totalPayers * 0.9);
    const returningPayers = totalPayers - newPayers;
    const aov = randInt(rng, 15000, 25000);
    const newSales = newPayers * aov;
    const returningSales = returningPayers * aov;
    const totalSales = newSales + returningSales;

    customersRows.push([label, "전체합산", totalVisitors, "-", totalPayers, "-", Number(((totalPayers / totalVisitors) * 100).toFixed(1)), totalSales, "-", aov]);
    customersRows.push([
      label,
      "신규",
      newVisitors,
      Number(((newVisitors / totalVisitors) * 100).toFixed(1)),
      newPayers,
      Number(((newPayers / totalPayers) * 100).toFixed(1)),
      Number(((newPayers / newVisitors) * 100).toFixed(1)),
      newSales,
      Number(((newSales / totalSales) * 100).toFixed(1)),
      aov,
    ]);
    customersRows.push([
      label,
      "재구매",
      returningVisitors,
      Number(((returningVisitors / totalVisitors) * 100).toFixed(1)),
      returningPayers,
      Number(((returningPayers / totalPayers) * 100).toFixed(1)),
      returningVisitors > 0 ? Number(((returningPayers / returningVisitors) * 100).toFixed(1)) : 0,
      returningSales,
      Number(((returningSales / totalSales) * 100).toFixed(1)),
      aov,
    ]);
  }
  const customersWs = XLSX.utils.aoa_to_sheet([...fillerRows(14), customersHeader, ...customersRows]);
  XLSX.utils.book_append_sheet(wb, customersWs, "고객분석");

  // 6. 리뷰관리 — header at row 22 (index 21)
  const reviewsHeader = [
    "상품번호",
    "상품명",
    "리뷰구분",
    "구매자평점",
    "포토/영상",
    "리뷰상세내용",
    "리뷰도움수",
    "등록자",
    "리뷰등록일",
    "답글여부",
    "답글등록일시",
    "상품주문번호",
  ];
  const reviewsRows: unknown[][] = [];
  const reviewCount = 150;
  for (let i = 0; i < reviewCount; i++) {
    const productIndex = randInt(rng, 0, FAKE_PRODUCT_NAMES.length - 1);
    const productId = String(1_000_000 + productIndex);
    const isLowRating = rng() < 0.15;
    const rating = isLowRating ? randInt(rng, 1, 3) : randInt(rng, 4, 5);
    const sentencePool = isLowRating ? REVIEW_SENTENCES_BAD : REVIEW_SENTENCES_GOOD;
    const content = sentencePool[randInt(rng, 0, sentencePool.length - 1)];
    const hasPhoto = rng() < 0.5;
    const reviewDate = new Date(`${addDaysIso(FIXTURE_SALES_START, randInt(rng, 0, FIXTURE_SALES_DAYS - 1))}T12:00:00Z`);
    const hasReply = rng() < 0.85;
    const replyDate = hasReply ? new Date(reviewDate.getTime() + randInt(rng, 1, 3) * 86_400_000) : null;

    reviewsRows.push([
      productId,
      FAKE_PRODUCT_NAMES[productIndex],
      "일반",
      rating,
      hasPhoto ? "https://example.com/fake-photo.jpg" : null,
      content,
      randInt(rng, 0, 10),
      `fakeuser${i}****`,
      reviewDate,
      hasReply ? "Y" : "N",
      replyDate,
      `TEST-ORDER-${String(i).padStart(6, "0")}`,
    ]);
  }
  const reviewsWs = XLSX.utils.aoa_to_sheet([...fillerRows(21), reviewsHeader, ...reviewsRows]);
  XLSX.utils.book_append_sheet(wb, reviewsWs, "리뷰관리");

  // 7. 광고관리 — row 16 is a description row, real header at row 17 (index 16)
  const adsDescriptionRow = ["계정 보고서(테스트용 가짜 데이터)"];
  const adsHeader = [
    "일별",
    "노출수",
    "클릭수",
    "클릭률(%)",
    "평균 CPC",
    "총비용",
    "총 전환수",
    "직접전환수",
    "간접전환수",
    "총 전환율(%)",
    "총 전환매출액(원)",
    "직접전환매출액(원)",
    "간접전환매출액(원)",
    "총 전환당비용(원)",
    "총 광고수익률(%)",
    "구매완료 전환수",
    "구매완료 전환매출액(원)",
    "구매완료 광고수익률(%)",
  ];
  const adsRows: unknown[][] = [];
  for (let i = 0; i < FIXTURE_ADS_DAYS; i++) {
    const date = new Date(`${addDaysIso(FIXTURE_ADS_START, i)}T00:00:00Z`);
    const impressions = randInt(rng, 5000, 30000);
    const clicks = randInt(rng, Math.round(impressions * 0.005), Math.round(impressions * 0.02));
    const avgCpc = randInt(rng, 500, 1500);
    const cost = clicks * avgCpc;
    const purchaseConversions = randInt(rng, 0, Math.round(clicks * 0.1));
    const purchaseAov = randInt(rng, 15000, 25000);
    const purchaseSales = purchaseConversions * purchaseAov;
    const totalConversions = purchaseConversions + randInt(rng, 0, 3);
    const totalSales = purchaseSales + randInt(rng, 0, 2) * purchaseAov;

    adsRows.push([
      date,
      impressions,
      clicks,
      Number(((clicks / impressions) * 100).toFixed(2)),
      avgCpc,
      cost,
      totalConversions,
      purchaseConversions,
      totalConversions - purchaseConversions,
      Number(((totalConversions / clicks) * 100).toFixed(2)),
      totalSales,
      purchaseSales,
      totalSales - purchaseSales,
      totalConversions > 0 ? Math.round(cost / totalConversions) : 0,
      cost > 0 ? Number(((totalSales / cost) * 100).toFixed(2)) : 0,
      purchaseConversions,
      purchaseSales,
      cost > 0 ? Number(((purchaseSales / cost) * 100).toFixed(2)) : 0,
    ]);
  }
  const adsWs = XLSX.utils.aoa_to_sheet([adsDescriptionRow, ...fillerRows(15), adsHeader, ...adsRows]);
  XLSX.utils.book_append_sheet(wb, adsWs, "광고관리");

  return wb;
}

export function workbookToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as unknown as ArrayBuffer;
}
