import { describe, expect, it } from "vitest";
import type { CoreKpiKey, DashboardSummary, KpiSummary } from "@/types/dashboard";
import type { AdFunnelSummary } from "@/lib/analysis/ads";
import type { ReviewSummary, ProductProblemSummary } from "@/lib/analysis/reviews";
import type { InsightContext } from "@/lib/insights/context";
import { generateInsights } from "@/lib/insights/rules";
import { KPI_LABELS, KPI_UNITS } from "@/lib/scoring/config";

function kpi(key: CoreKpiKey, current: number, previous: number, changeRate: number, score = 70): KpiSummary {
  return {
    key,
    label: KPI_LABELS[key],
    current,
    previous,
    target: null,
    changeRate,
    score,
    tag: "주의",
    color: "#F59E0B",
    unit: KPI_UNITS[key],
  };
}

function baseSummary(overrides: Partial<Record<CoreKpiKey, KpiSummary>> = {}): DashboardSummary {
  const kpis: KpiSummary[] = [
    overrides.netSales ?? kpi("netSales", 10_000_000, 10_000_000, 0),
    overrides.traffic ?? kpi("traffic", 10_000, 10_000, 0),
    overrides.conversionRate ?? kpi("conversionRate", 0.05, 0.05, 0),
    overrides.aov ?? kpi("aov", 20_000, 20_000, 0),
    overrides.purchaseRoas ?? kpi("purchaseRoas", 250, 250, 0),
  ];
  return {
    currentRange: { start: "2026-06-01", end: "2026-06-30" },
    previousRange: { start: "2026-05-02", end: "2026-05-31" },
    kpis,
    compositeScore: 70,
    dataCompleteness: 100,
  };
}

function adFunnel(overrides: Partial<AdFunnelSummary> = {}): AdFunnelSummary {
  return {
    impressions: 100_000,
    clicks: 1000,
    ctr: 0.01,
    avgCpc: 1000,
    cost: 1_000_000,
    purchaseConversions: 50,
    purchaseConversionSales: 2_500_000,
    purchaseRoas: 250,
    ...overrides,
  };
}

function reviewSummary(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    count: 50,
    averageRating: 4.5,
    lowRatingShare: 0.05,
    photoShare: 0.5,
    replyRate: 0.9,
    averageReplyDays: 1,
    ...overrides,
  };
}

function baseContext(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    summary: baseSummary(),
    adFunnelCurrent: adFunnel(),
    adFunnelPrevious: adFunnel(),
    reviewSummaryCurrent: reviewSummary(),
    productProblems: [],
    returningSalesShareCurrent: 0.1,
    returningSalesSharePrevious: 0.1,
    ...overrides,
  };
}

describe("generateInsights", () => {
  it("produces nothing when every signal is flat", () => {
    expect(generateInsights(baseContext())).toEqual([]);
  });

  it("fires the traffic-recovery rule when traffic drops but conversion/aov hold steady", () => {
    const ctx = baseContext({
      summary: baseSummary({
        traffic: kpi("traffic", 7_000, 10_000, -0.3),
        conversionRate: kpi("conversionRate", 0.051, 0.05, 0.02),
        aov: kpi("aov", 20_200, 20_000, 0.01),
      }),
    });
    const insights = generateInsights(ctx);
    const found = insights.find((i) => i.title.includes("유입 감소"));
    expect(found).toBeDefined();
    expect(found!.diagnosis).toContain("유입 감소");
    expect(found!.hypothesis).toBeUndefined();
    expect(found!.evidence.find((e) => e.metric === "유입량")).toEqual({
      metric: "유입량",
      current: 7_000,
      comparison: 10_000,
      source: "판매분석 방문수(SUM)",
    });
  });

  it("fires the conversion-recovery rule when traffic rises but sales stall due to falling conversion", () => {
    const ctx = baseContext({
      summary: baseSummary({
        traffic: kpi("traffic", 13_000, 10_000, 0.3),
        netSales: kpi("netSales", 9_900_000, 10_000_000, -0.01),
        conversionRate: kpi("conversionRate", 0.04, 0.05, -0.2),
      }),
    });
    const insights = generateInsights(ctx);
    expect(insights.find((i) => i.title.includes("전환이 따라가지"))).toBeDefined();
  });

  it("fires the AOV/option rule when conversion holds but AOV drops", () => {
    const ctx = baseContext({
      summary: baseSummary({
        conversionRate: kpi("conversionRate", 0.0505, 0.05, 0.01),
        aov: kpi("aov", 17_000, 20_000, -0.15),
      }),
    });
    const insights = generateInsights(ctx);
    expect(insights.find((i) => i.title.includes("구매 건당 단가"))).toBeDefined();
  });

  it("fires the ad-creative rule when CPC rises and CTR falls", () => {
    const ctx = baseContext({
      adFunnelCurrent: adFunnel({ avgCpc: 1300, ctr: 0.007 }),
      adFunnelPrevious: adFunnel({ avgCpc: 1000, ctr: 0.01 }),
    });
    const insights = generateInsights(ctx);
    expect(insights.find((i) => i.title.includes("CPC 상승"))).toBeDefined();
  });

  it("fires the landing-competitiveness hypothesis rule and clearly labels it as unverified", () => {
    const ctx = baseContext({
      summary: baseSummary({ purchaseRoas: kpi("purchaseRoas", 200, 250, -0.2) }),
      adFunnelCurrent: adFunnel({ avgCpc: 1010, clicks: 1000, purchaseConversions: 30 }),
      adFunnelPrevious: adFunnel({ avgCpc: 1000, clicks: 1000, purchaseConversions: 50 }),
    });
    const insights = generateInsights(ctx);
    const found = insights.find((i) => i.title.includes("광고 외부"));
    expect(found).toBeDefined();
    expect(found!.confidence).toBe("medium");
    expect(found!.hypothesis).toBeDefined();
    expect(found!.hypothesis).toContain("가설");
  });

  it("fires the low-rating-product rule only when a product has repeated low ratings", () => {
    const problems: ProductProblemSummary[] = [
      {
        productId: "p1",
        productName: "문제상품",
        reviewCount: 10,
        averageRating: 2.4,
        lowRatingCount: 6,
        topComplaintWords: ["접착력", "떨어져요"],
      },
    ];
    const ctx = baseContext({
      reviewSummaryCurrent: reviewSummary({ lowRatingShare: 0.2, count: 50 }),
      productProblems: problems,
    });
    const insights = generateInsights(ctx);
    const found = insights.find((i) => i.title.includes("저평점 리뷰가 반복"));
    expect(found).toBeDefined();
    expect(found!.hypothesis).toContain("접착력");
    expect(found!.hypothesis).toContain("빈도 집계");
  });

  it("fires the returning-customer rule when 재구매 매출 비중 drops meaningfully", () => {
    const ctx = baseContext({ returningSalesShareCurrent: 0.07, returningSalesSharePrevious: 0.1 });
    const insights = generateInsights(ctx);
    expect(insights.find((i) => i.title.includes("재구매 고객"))).toBeDefined();
  });

  it("sorts fired insights by priority, highest first", () => {
    const ctx = baseContext({
      summary: baseSummary({
        traffic: kpi("traffic", 7_000, 10_000, -0.3),
        conversionRate: kpi("conversionRate", 0.051, 0.05, 0.02),
        aov: kpi("aov", 20_200, 20_000, 0.01),
      }),
      returningSalesShareCurrent: 0.07,
      returningSalesSharePrevious: 0.1,
    });
    const insights = generateInsights(ctx);
    expect(insights.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < insights.length; i++) {
      expect(insights[i - 1].priority).toBeGreaterThanOrEqual(insights[i].priority);
    }
  });
});
