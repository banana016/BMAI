import { describe, expect, it } from "vitest";
import type {
  NormalizedAdRow,
  NormalizedCustomerRow,
  NormalizedReviewRow,
  NormalizedSearchRow,
  NormalizedTrafficRow,
} from "@/types/normalized";
import { computeChannelBreakdown, computeDailyOverallTraffic } from "@/lib/analysis/traffic";
import { assignQuadrants, computeKeywordRankingForRange } from "@/lib/analysis/search";
import { computeAdFunnel, computeDailyRoasTrend } from "@/lib/analysis/ads";
import { computeCustomerWeeklyTrend } from "@/lib/analysis/customers";
import { computeProductProblems, computeRatingDistribution, computeReviewSummary } from "@/lib/analysis/reviews";

const RANGE = { start: "2026-06-01", end: "2026-06-02" };

function trafficRow(overrides: Partial<NormalizedTrafficRow>): NormalizedTrafficRow {
  return {
    date: "2026-06-01",
    sourceL1: "전체",
    sourceL2: "전체",
    sourceL3: "전체",
    isMarketingLink: null,
    visits: 0,
    orders: 0,
    conversionRate: null,
    sales: 0,
    aov: null,
    ...overrides,
  };
}

describe("analysis/traffic", () => {
  const rows: NormalizedTrafficRow[] = [
    trafficRow({ date: "2026-06-01", sourceL1: "전체", sourceL2: "전체", sourceL3: "전체", visits: 300, orders: 15, sales: 150000 }),
    trafficRow({ date: "2026-06-01", sourceL1: "네이버 검색", sourceL2: "통합검색", sourceL3: "기타", visits: 200, orders: 10, sales: 100000 }),
    trafficRow({ date: "2026-06-01", sourceL1: "직유입", sourceL2: "-", sourceL3: "-", visits: 100, orders: 5, sales: 50000 }),
    trafficRow({ date: "2026-06-02", sourceL1: "전체", sourceL2: "전체", sourceL3: "전체", visits: 400, orders: 20, sales: 200000 }),
    trafficRow({ date: "2026-06-02", sourceL1: "네이버 검색", sourceL2: "통합검색", sourceL3: "기타", visits: 400, orders: 20, sales: 200000 }),
  ];

  it("channel breakdown excludes 전체 and sums leaves without double counting", () => {
    const channels = computeChannelBreakdown(rows, RANGE);
    expect(channels.every((c) => c.sourceL1 !== "전체")).toBe(true);
    const totalVisits = channels.reduce((s, c) => s + c.visits, 0);
    const overallVisits = computeDailyOverallTraffic(rows, RANGE).reduce((s, d) => s + d.visits, 0);
    expect(totalVisits).toBe(overallVisits);
  });

  it("daily overall trend is sorted by date and isolates the (전체,전체,전체) row", () => {
    const daily = computeDailyOverallTraffic(rows, RANGE);
    expect(daily.map((d) => d.date)).toEqual(["2026-06-01", "2026-06-02"]);
    expect(daily[0].visits).toBe(300);
    expect(daily[1].visits).toBe(400);
  });
});

function searchRow(overrides: Partial<NormalizedSearchRow>): NormalizedSearchRow {
  return { date: "2026-06-01", query: "전체", visits: 0, orders: 0, conversionRate: null, sales: 0, aov: null, ...overrides };
}

describe("analysis/search", () => {
  const rows: NormalizedSearchRow[] = [
    searchRow({ query: "전체", visits: 200, orders: 12 }),
    searchRow({ query: "인기키워드", visits: 100, orders: 10 }), // 10% conversion, high visits
    searchRow({ query: "틈새키워드", visits: 50, orders: 1 }), // 2% conversion, low-ish visits
    searchRow({ query: "초저조회", visits: 2, orders: 2 }), // 100% conversion but tiny volume
  ];

  it("excludes the 전체 total row and filters by minVisits", () => {
    const ranking = computeKeywordRankingForRange(rows, RANGE, 10);
    expect(ranking.map((r) => r.query).sort()).toEqual(["인기키워드", "틈새키워드"]);
    expect(ranking.find((r) => r.query === "초저조회")).toBeUndefined();
  });

  it("assigns quadrants around the median of the ranked set", () => {
    const ranking = computeKeywordRankingForRange(rows, RANGE, 10);
    const { points } = assignQuadrants(ranking);
    const popular = points.find((p) => p.query === "인기키워드")!;
    const niche = points.find((p) => p.query === "틈새키워드")!;
    expect(popular.quadrant).toBe("고유입-고전환");
    expect(niche.quadrant).toBe("저유입-저전환");
  });
});

function adRow(overrides: Partial<NormalizedAdRow>): NormalizedAdRow {
  return {
    date: "2026-06-01",
    impressions: 0,
    clicks: 0,
    ctr: null,
    avgCpc: null,
    cost: 0,
    totalConversions: null,
    directConversions: null,
    indirectConversions: null,
    totalConversionRate: null,
    totalConversionSales: null,
    directConversionSales: null,
    indirectConversionSales: null,
    totalCostPerConversion: null,
    totalRoas: null,
    purchaseConversions: 0,
    purchaseConversionSales: 0,
    purchaseRoas: null,
    ...overrides,
  };
}

describe("analysis/ads", () => {
  const rows: NormalizedAdRow[] = [
    adRow({ date: "2026-06-01", impressions: 1000, clicks: 50, cost: 10000, purchaseConversions: 2, purchaseConversionSales: 20000, purchaseRoas: 2 }),
    adRow({ date: "2026-06-02", impressions: 2000, clicks: 100, cost: 20000, purchaseConversions: 4, purchaseConversionSales: 60000, purchaseRoas: 3 }),
  ];

  it("recomputes the funnel via SUM/SUM, not an average of daily ratios", () => {
    const funnel = computeAdFunnel(rows, RANGE);
    expect(funnel.impressions).toBe(3000);
    expect(funnel.clicks).toBe(150);
    expect(funnel.ctr).toBeCloseTo(150 / 3000);
    expect(funnel.cost).toBe(30000);
    expect(funnel.purchaseConversionSales).toBe(80000);
    // SUM(80000)/SUM(30000)*100, not average of (200%, 300%) = 250%.
    expect(funnel.purchaseRoas).toBeCloseTo((80000 / 30000) * 100);
  });

  it("converts the per-row ratio to a percent-scale trend series", () => {
    const trend = computeDailyRoasTrend(rows, RANGE);
    expect(trend.map((t) => t.purchaseRoas)).toEqual([200, 300]);
  });
});

function customerRow(overrides: Partial<NormalizedCustomerRow>): NormalizedCustomerRow {
  return {
    weekStart: "2026-06-01",
    weekEnd: "2026-06-07",
    customerType: "new",
    visitors: 0,
    visitorsShare: null,
    payers: 0,
    payersShare: null,
    conversionRate: null,
    sales: 0,
    salesShare: null,
    aov: null,
    ...overrides,
  };
}

describe("analysis/customers", () => {
  const rows: NormalizedCustomerRow[] = [
    customerRow({ weekStart: "2026-06-01", weekEnd: "2026-06-07", customerType: "all", visitors: 1000 }),
    customerRow({ weekStart: "2026-06-01", weekEnd: "2026-06-07", customerType: "new", visitors: 900, sales: 80000 }),
    customerRow({ weekStart: "2026-06-01", weekEnd: "2026-06-07", customerType: "returning", visitors: 100, sales: 20000, salesShare: 0.2 }),
  ];

  it("pairs new/returning by week and reads 재구매 salesShare directly, not derived from a sum", () => {
    const weekly = computeCustomerWeeklyTrend(rows, { start: "2026-06-01", end: "2026-06-07" });
    expect(weekly).toHaveLength(1);
    expect(weekly[0].newVisitors).toBe(900);
    expect(weekly[0].returningVisitors).toBe(100);
    expect(weekly[0].returningSalesShare).toBe(0.2);
  });

  it("excludes weeks that don't overlap the requested range", () => {
    const weekly = computeCustomerWeeklyTrend(rows, { start: "2026-07-01", end: "2026-07-07" });
    expect(weekly).toHaveLength(0);
  });
});

function reviewRow(overrides: Partial<NormalizedReviewRow>): NormalizedReviewRow {
  return {
    productId: "1",
    productName: "테스트 상품",
    rating: 5,
    hasPhoto: false,
    content: null,
    helpfulCount: 0,
    reviewDate: "2026-06-01",
    hasReply: false,
    replyDate: null,
    ...overrides,
  };
}

describe("analysis/reviews", () => {
  it("computes rating distribution and summary stats", () => {
    const rows: NormalizedReviewRow[] = [
      reviewRow({ rating: 5, hasPhoto: true, hasReply: true, reviewDate: "2026-06-01", replyDate: "2026-06-03" }),
      reviewRow({ rating: 1, hasPhoto: false, hasReply: false }),
      reviewRow({ rating: 3, hasPhoto: true, hasReply: true, reviewDate: "2026-06-01", replyDate: "2026-06-02" }),
    ];
    const summary = computeReviewSummary(rows);
    expect(summary.count).toBe(3);
    expect(summary.averageRating).toBeCloseTo(3);
    expect(summary.lowRatingShare).toBeCloseTo(2 / 3);
    expect(summary.photoShare).toBeCloseTo(2 / 3);
    expect(summary.replyRate).toBeCloseTo(2 / 3);
    expect(summary.averageReplyDays).toBeCloseTo(1.5);

    const distribution = computeRatingDistribution(rows);
    expect(distribution.find((b) => b.rating === 5)?.count).toBe(1);
    expect(distribution.find((b) => b.rating === 1)?.count).toBe(1);
  });

  it("only surfaces complaint words from low-rated (<=3) reviews, and respects minReviews", () => {
    const rows: NormalizedReviewRow[] = [
      reviewRow({ productId: "p1", productName: "문제상품", rating: 1, content: "접착력이 약해서 자꾸 떨어져요" }),
      reviewRow({ productId: "p1", productName: "문제상품", rating: 2, content: "떨어져요 접착력 별로" }),
      reviewRow({ productId: "p1", productName: "문제상품", rating: 5, content: "완전 최고예요 재구매각" }),
      reviewRow({ productId: "p2", productName: "리뷰적은상품", rating: 1, content: "별로예요" }),
    ];
    const problems = computeProductProblems(rows, 2);
    expect(problems.find((p) => p.productId === "p2")).toBeUndefined(); // below minReviews
    const p1 = problems.find((p) => p.productId === "p1")!;
    expect(p1.lowRatingCount).toBe(2);
    expect(p1.topComplaintWords).toContain("떨어져요");
    expect(p1.topComplaintWords).not.toContain("재구매각"); // only from rating<=5 star review, excluded
  });
});
