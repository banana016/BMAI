import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { normalizeSalesRows, filterChannelTotal } from "@/lib/normalize/sales";
import { normalizeTrafficRows, filterOverallTraffic, groupByTopLevelChannel } from "@/lib/normalize/traffic";
import { normalizeSearchRows, filterKeywordRows, rankKeywordsByConversion } from "@/lib/normalize/search";
import { normalizeCustomerRows, filterCustomerType } from "@/lib/normalize/customers";
import { normalizeReviewRows } from "@/lib/normalize/reviews";
import { normalizeAdRows } from "@/lib/normalize/ads";
import { parseMoney, parsePercentToRatio } from "@/lib/normalize/number";

function fillerRows(count: number): unknown[][] {
  return Array.from({ length: count }, () => []);
}

function buildWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const salesHeader = ["날짜", "채널", "상품결제건수", "판매금액(총)", "판매금액(순)", "상품결제단가", "방문수", "구매전환율"];
  const salesRows = [
    [new Date(Date.UTC(2026, 3, 1)), "전체", 10, 100000, 95000, 10000, 200, 5],
    [new Date(Date.UTC(2026, 3, 1)), "테스트 스토어(123)", 10, 100000, 95000, 10000, 200, 5],
    [new Date(Date.UTC(2026, 3, 2)), "전체", 12, 120000, 114000, 10000, 220, 5.5],
    [new Date(Date.UTC(2026, 3, 2)), "테스트 스토어(123)", 12, 120000, 114000, 10000, 220, 5.5],
  ];
  const salesWs = XLSX.utils.aoa_to_sheet([...fillerRows(19), salesHeader, ...salesRows]);
  XLSX.utils.book_append_sheet(wb, salesWs, "판매분석");

  const trafficHeader = ["날짜", "경로(1단계)", "경로(2단계)", "경로(3단계)", "방문수", "상품결제건수", "구매전환율", "판매금액(총)"];
  const trafficRows = [
    [new Date(Date.UTC(2026, 3, 3)), "전체", "전체", "전체", 200, 10, 5, 100000],
    [new Date(Date.UTC(2026, 3, 3)), "네이버 검색", "통합검색", "기타", 120, 6, 5, 60000],
    [new Date(Date.UTC(2026, 3, 3)), "직유입", "-", "-", 80, 4, 5, 40000],
  ];
  const trafficWs = XLSX.utils.aoa_to_sheet([...fillerRows(20), trafficHeader, ...trafficRows]);
  XLSX.utils.book_append_sheet(wb, trafficWs, "방문분석");

  const searchHeader = ["날짜", "검색어", "방문수", "상품결제건수", "구매전환율", "판매금액(총)", "상품결제단가"];
  const searchRows = [
    [new Date(Date.UTC(2026, 2, 1)), "전체", 51, 3, 5.9, 30000, 10000],
    [new Date(Date.UTC(2026, 2, 1)), "클리오네", 50, 3, 6, 30000, 10000],
    [new Date(Date.UTC(2026, 2, 1)), "희귀검색어", 1, 1, 100, 10000, 10000],
  ];
  const searchWs = XLSX.utils.aoa_to_sheet([...fillerRows(16), searchHeader, ...searchRows]);
  XLSX.utils.book_append_sheet(wb, searchWs, "검색분석");

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
  const customersRows = [
    ["2026-04-27~2026-05-03", "전체합산", 100, "-", 10, "-", 10, 100000, "-", 10000],
    ["2026-04-27~2026-05-03", "신규", 90, 90, 8, 80, 8.9, 80000, 80, 10000],
    ["2026-04-27~2026-05-03", "재구매", 10, 10, 2, 20, 20, 20000, 20, 10000],
  ];
  const customersWs = XLSX.utils.aoa_to_sheet([...fillerRows(14), customersHeader, ...customersRows]);
  XLSX.utils.book_append_sheet(wb, customersWs, "고객분석");

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
  const reviewsRows = [
    [
      1001,
      "테스트 상품",
      "일반",
      5,
      null,
      "좋아요",
      2,
      "abc****",
      new Date(Date.UTC(2026, 0, 30)),
      "Y",
      new Date(Date.UTC(2026, 0, 31)),
      "ORDER-SECRET-0001",
    ],
  ];
  const reviewsWs = XLSX.utils.aoa_to_sheet([...fillerRows(21), reviewsHeader, ...reviewsRows]);
  XLSX.utils.book_append_sheet(wb, reviewsWs, "리뷰관리");

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
  const adsRows = [
    [
      new Date(Date.UTC(2026, 4, 1)),
      1000,
      50,
      5,
      500,
      25000,
      3,
      2,
      1,
      6,
      70000,
      50000,
      20000,
      8333,
      280,
      2,
      60000,
      240,
    ],
  ];
  const adsWs = XLSX.utils.aoa_to_sheet([...fillerRows(16), adsHeader, ...adsRows]);
  XLSX.utils.book_append_sheet(wb, adsWs, "광고관리");

  return wb;
}

describe("normalize/number", () => {
  it("treats '-' and blank as null, not zero", () => {
    expect(parseMoney("-")).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(0)).toBe(0);
    expect(parseMoney("1,234")).toBe(1234);
  });

  it("converts a raw percent number to an internal ratio", () => {
    expect(parsePercentToRatio("10.4")).toBeCloseTo(0.104);
    expect(parsePercentToRatio("-")).toBeNull();
  });
});

describe("normalize/sales", () => {
  const wb = buildWorkbook();

  it("normalizes rows and converts conversionRate to a ratio", () => {
    const { rows } = normalizeSalesRows(wb);
    expect(rows).toHaveLength(4);
    expect(rows[0].conversionRate).toBeCloseTo(0.05);
  });

  it("filterChannelTotal keeps only 전체 rows, avoiding double counting", () => {
    const { rows } = normalizeSalesRows(wb);
    const totals = filterChannelTotal(rows);
    expect(totals).toHaveLength(2);
    const totalOrders = totals.reduce((sum, r) => sum + (r.orders ?? 0), 0);
    // Without the filter, summing all 4 rows would double this to 44.
    expect(totalOrders).toBe(22);
  });
});

describe("normalize/traffic", () => {
  const wb = buildWorkbook();

  it("filterOverallTraffic isolates the (전체,전체,전체) row", () => {
    const { rows } = normalizeTrafficRows(wb);
    const overall = filterOverallTraffic(rows);
    expect(overall).toHaveLength(1);
    expect(overall[0].visits).toBe(200);
  });

  it("groupByTopLevelChannel sums leaf rows to match the overall total, without a separate subtotal row", () => {
    const { rows } = normalizeTrafficRows(wb);
    const channels = groupByTopLevelChannel(rows, "2026-04-03");
    const summed = channels.reduce((sum, c) => sum + c.visits, 0);
    expect(summed).toBe(200);
    expect(channels.map((c) => c.sourceL1).sort()).toEqual(["네이버 검색", "직유입"]);
  });
});

describe("normalize/search", () => {
  const wb = buildWorkbook();

  it("filterKeywordRows excludes the 전체 total row", () => {
    const { rows } = normalizeSearchRows(wb);
    const keywords = filterKeywordRows(rows);
    expect(keywords).toHaveLength(2);
    expect(keywords.every((r) => r.query !== "전체")).toBe(true);
  });

  it("rankKeywordsByConversion filters out low-visit keywords that would otherwise look artificially strong", () => {
    const { rows } = normalizeSearchRows(wb);
    const ranked = rankKeywordsByConversion(rows, 10);
    expect(ranked.map((r) => r.query)).toEqual(["클리오네"]);
    expect(ranked.find((r) => r.query === "희귀검색어")).toBeUndefined();
  });
});

describe("normalize/customers", () => {
  const wb = buildWorkbook();

  it("keeps all/new/returning as separate rows and treats '-' as null", () => {
    const { rows } = normalizeCustomerRows(wb);
    expect(rows).toHaveLength(3);
    const all = filterCustomerType(rows, "all")[0];
    expect(all.visitorsShare).toBeNull();
    expect(all.weekStart).toBe("2026-04-27");
    expect(all.weekEnd).toBe("2026-05-03");

    const returning = filterCustomerType(rows, "returning")[0];
    expect(returning.salesShare).toBeCloseTo(0.2);
  });
});

describe("normalize/reviews", () => {
  const wb = buildWorkbook();

  it("normalizes core fields and never carries 등록자 or 상품주문번호", () => {
    const { rows } = normalizeReviewRows(wb);
    expect(rows).toHaveLength(1);
    expect(rows[0].productId).toBe("1001");
    expect(rows[0].hasReply).toBe(true);
    expect(rows[0].hasPhoto).toBe(false);

    const serialized = JSON.stringify(rows);
    expect(serialized.includes("abc****")).toBe(false);
    expect(serialized.includes("ORDER-SECRET-0001")).toBe(false);
  });
});

describe("normalize/ads", () => {
  const wb = buildWorkbook();

  it("normalizes ad metrics and converts percent fields to ratios", () => {
    const { rows } = normalizeAdRows(wb);
    expect(rows).toHaveLength(1);
    expect(rows[0].cost).toBe(25000);
    expect(rows[0].purchaseConversionSales).toBe(60000);
    expect(rows[0].purchaseRoas).toBeCloseTo(2.4);
  });
});
