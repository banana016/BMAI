import type { CoreKpiKey, KpiSummary } from "@/types/dashboard";
import type { Insight } from "@/types/insight";
import { COMPOSITE_WEIGHTS } from "../scoring/config";
import { computeImprovementPotential } from "./priority";
import { evidence, formatPct } from "./evidence";
import type { InsightContext } from "./context";

// Thresholds are this project's own reasonable defaults for "meaningfully
// changed" vs "held steady" — design doc 3.6 names the rule shapes (유입↓,
// 전환율 유지, ...) but not the exact cutoffs, so these are kept as named
// constants rather than buried magic numbers.
const MEANINGFUL_DROP = -0.1;
const MEANINGFUL_RISE = 0.1;
const FLAT_BAND = 0.05;

function isFlat(rate: number | null): boolean {
  return rate !== null && Math.abs(rate) <= FLAT_BAND;
}
function isDrop(rate: number | null, threshold = MEANINGFUL_DROP): boolean {
  return rate !== null && rate <= threshold;
}
function isRise(rate: number | null, threshold = MEANINGFUL_RISE): boolean {
  return rate !== null && rate >= threshold;
}

function getKpi(kpis: KpiSummary[], key: CoreKpiKey): KpiSummary {
  const found = kpis.find((k) => k.key === key);
  if (!found) throw new Error(`missing KPI summary for ${key}`);
  return found;
}

/** 유입↓, 전환율 유지, 객단가 유지 → 유입 회복 우선 (design doc 3.6). */
function trafficRecoveryRule(ctx: InsightContext): Insight | null {
  const traffic = getKpi(ctx.summary.kpis, "traffic");
  const conversion = getKpi(ctx.summary.kpis, "conversionRate");
  const aov = getKpi(ctx.summary.kpis, "aov");

  if (!isDrop(traffic.changeRate) || !isFlat(conversion.changeRate) || !isFlat(aov.changeRate)) return null;
  if (traffic.current === null || traffic.previous === null) return null;

  const potential = computeImprovementPotential({
    kpiWeight: COMPOSITE_WEIGHTS.traffic,
    currentScore: traffic.score ?? 50,
    dataConfidence: 1,
    feasibility: 0.6,
  });

  return {
    title: "유입 감소가 매출 하락을 이끌고 있습니다",
    finding: `선택 기간 유입량이 직전기간 대비 ${formatPct(traffic.changeRate)} 감소했습니다.`,
    evidence: [
      evidence("유입량", traffic.current, traffic.previous, "판매분석 방문수(SUM)"),
      evidence("구매전환율", conversion.current ?? 0, conversion.previous, "판매분석 구매전환율"),
      evidence("객단가", aov.current ?? 0, aov.previous, "판매분석 판매금액(총)/결제건수"),
    ],
    diagnosis:
      "구매전환율과 객단가는 직전기간과 비슷한 수준으로 유지된 반면 유입량만 뚜렷이 줄어, 매출 변화의 주된 요인이 유입 감소인 것으로 확인됩니다.",
    action: "유입경로 탭에서 채널별 방문수 추이를 확인해, 감소폭이 큰 채널의 노출·마케팅 운영을 우선 점검하세요.",
    confidence: "high",
    priority: potential.priority,
  };
}

/** 유입↑, 매출↓/정체, 전환율↓ → 전환 개선 우선 (design doc 3.6). */
function conversionRecoveryRule(ctx: InsightContext): Insight | null {
  const traffic = getKpi(ctx.summary.kpis, "traffic");
  const netSales = getKpi(ctx.summary.kpis, "netSales");
  const conversion = getKpi(ctx.summary.kpis, "conversionRate");

  const salesFlatOrDown = netSales.changeRate !== null && netSales.changeRate <= FLAT_BAND;
  if (!isRise(traffic.changeRate) || !salesFlatOrDown || !isDrop(conversion.changeRate)) return null;
  if (conversion.current === null || conversion.previous === null) return null;

  const potential = computeImprovementPotential({
    kpiWeight: COMPOSITE_WEIGHTS.conversionRate,
    currentScore: conversion.score ?? 50,
    dataConfidence: 1,
    feasibility: 0.6,
  });

  return {
    title: "유입은 늘었지만 전환이 따라가지 못하고 있습니다",
    finding: `유입량은 직전기간 대비 ${formatPct(traffic.changeRate)} 증가했지만, 매출은 ${formatPct(netSales.changeRate)}로 정체·하락했습니다.`,
    evidence: [
      evidence("유입량", traffic.current ?? 0, traffic.previous, "판매분석 방문수(SUM)"),
      evidence("매출액", netSales.current ?? 0, netSales.previous, "판매분석 판매금액(순)(SUM)"),
      evidence("구매전환율", conversion.current, conversion.previous, "판매분석 구매전환율"),
    ],
    diagnosis: "유입 증가분이 매출로 이어지지 못한 원인은 구매전환율 하락으로 확인됩니다.",
    action: "전환율이 낮아진 기간의 상품 상세페이지, 가격, 옵션 구성과 재고/품절 여부를 점검하세요.",
    confidence: "high",
    priority: potential.priority,
  };
}

/** 전환율 유지, 객단가↓ → 세트/옵션/추가구매 전략 검토 (design doc 3.6). */
function aovOptionRule(ctx: InsightContext): Insight | null {
  const conversion = getKpi(ctx.summary.kpis, "conversionRate");
  const aov = getKpi(ctx.summary.kpis, "aov");

  if (!isFlat(conversion.changeRate) || !isDrop(aov.changeRate)) return null;
  if (aov.current === null || aov.previous === null) return null;

  const potential = computeImprovementPotential({
    kpiWeight: COMPOSITE_WEIGHTS.aov,
    currentScore: aov.score ?? 50,
    dataConfidence: 1,
    feasibility: 0.6,
  });

  return {
    title: "구매 건당 단가가 낮아지고 있습니다",
    finding: `구매전환율은 직전기간과 비슷하지만 객단가가 ${formatPct(aov.changeRate)} 하락했습니다.`,
    evidence: [
      evidence("객단가", aov.current, aov.previous, "판매분석 판매금액(총)/결제건수"),
      evidence("구매전환율", conversion.current ?? 0, conversion.previous, "판매분석 구매전환율"),
    ],
    diagnosis: "전환율 변화로는 설명되지 않는 매출 영향이 객단가 하락에서 확인됩니다.",
    action: "세트 상품, 옵션 구성, 추가구매(업셀·크로스셀) 노출을 점검하세요.",
    confidence: "high",
    priority: potential.priority,
  };
}

/** CPC↑, CTR↓ → 광고 키워드·소재 적합성 점검 (design doc 3.6). */
function adCreativeRule(ctx: InsightContext): Insight | null {
  const { adFunnelCurrent: cur, adFunnelPrevious: prev } = ctx;
  if (cur.avgCpc === null || prev.avgCpc === null || prev.avgCpc === 0) return null;
  if (cur.ctr === null || prev.ctr === null || prev.ctr === 0) return null;

  const cpcChange = (cur.avgCpc - prev.avgCpc) / Math.abs(prev.avgCpc);
  const ctrChange = (cur.ctr - prev.ctr) / Math.abs(prev.ctr);
  if (!isRise(cpcChange) || !isDrop(ctrChange)) return null;

  const potential = computeImprovementPotential({
    kpiWeight: COMPOSITE_WEIGHTS.purchaseRoas,
    currentScore: 50,
    dataConfidence: 1,
    feasibility: 0.8,
  });

  return {
    title: "광고 효율이 떨어지고 있습니다 (CPC 상승·CTR 하락)",
    finding: `평균 CPC가 직전기간 대비 ${formatPct(cpcChange)} 상승하고, CTR은 ${formatPct(ctrChange)} 하락했습니다.`,
    evidence: [
      evidence("평균 CPC", cur.avgCpc, prev.avgCpc, "광고관리 총비용/클릭수"),
      evidence("CTR", cur.ctr, prev.ctr, "광고관리 클릭수/노출수"),
    ],
    diagnosis: "같은 클릭을 얻는 데 더 많은 비용이 들고 있고, 클릭률 자체도 낮아져 광고 효율이 저하된 것으로 확인됩니다.",
    action: "성과가 낮아진 키워드·소재를 교체하거나 입찰 전략을 재점검하세요.",
    confidence: "high",
    priority: potential.priority,
  };
}

/** 구매완료 ROAS↓, CPC 유지, 광고 전환율↓ → 랜딩/상품 경쟁력 가설 (design doc 3.6) — a hypothesis, not a confirmed diagnosis. */
function landingCompetitivenessHypothesisRule(ctx: InsightContext): Insight | null {
  const purchaseRoas = getKpi(ctx.summary.kpis, "purchaseRoas");
  const { adFunnelCurrent: cur, adFunnelPrevious: prev } = ctx;

  if (!isDrop(purchaseRoas.changeRate)) return null;
  if (cur.avgCpc === null || prev.avgCpc === null || prev.avgCpc === 0) return null;
  const cpcChange = (cur.avgCpc - prev.avgCpc) / Math.abs(prev.avgCpc);
  if (!isFlat(cpcChange)) return null;

  if (cur.clicks === null || cur.clicks === 0 || cur.purchaseConversions === null) return null;
  if (prev.clicks === null || prev.clicks === 0 || prev.purchaseConversions === null) return null;
  const curAdConversion = cur.purchaseConversions / cur.clicks;
  const prevAdConversion = prev.purchaseConversions / prev.clicks;
  if (prevAdConversion === 0) return null;
  const adConversionChange = (curAdConversion - prevAdConversion) / Math.abs(prevAdConversion);
  if (!isDrop(adConversionChange)) return null;

  const potential = computeImprovementPotential({
    kpiWeight: COMPOSITE_WEIGHTS.purchaseRoas,
    currentScore: purchaseRoas.score ?? 50,
    dataConfidence: 0.7, // a hypothesis, not a confirmed cause — lower confidence weighting
    feasibility: 0.4,
  });

  return {
    title: "광고 ROAS 하락 원인이 광고 외부에 있을 수 있습니다",
    finding: `구매완료 ROAS가 ${formatPct(purchaseRoas.changeRate)} 하락했지만, 평균 CPC는 직전기간과 비슷한 수준입니다.`,
    evidence: [
      evidence("구매완료 광고 ROAS", purchaseRoas.current ?? 0, purchaseRoas.previous, "광고관리 SUM(구매완료 전환매출)/SUM(총비용)"),
      evidence("평균 CPC", cur.avgCpc, prev.avgCpc, "광고관리 총비용/클릭수"),
      evidence("광고 전환율(클릭 대비 구매완료)", curAdConversion, prevAdConversion, "광고관리 구매완료 전환수/클릭수"),
    ],
    diagnosis: "광고비 단가(CPC)는 유지되었지만 구매완료 ROAS와 클릭 대비 구매완료 전환율이 함께 하락했습니다.",
    hypothesis:
      "광고 운영 자체보다 랜딩 페이지 또는 상품 경쟁력 저하가 원인일 가능성이 있습니다. 이는 확인된 사실이 아닌 가설이며, 상세페이지·가격·리뷰를 직접 점검해 검증이 필요합니다.",
    action: "상품 상세페이지 구성, 가격 경쟁력, 최근 리뷰 반응을 점검해 가설을 검증하세요.",
    confidence: "medium",
    priority: potential.priority,
  };
}

/** 저평점 리뷰 비중↑ + 특정 상품 반복 → 해당 상품 개선 과제 (design doc 3.6). */
function lowRatingProductRule(ctx: InsightContext): Insight | null {
  const rs = ctx.reviewSummaryCurrent;
  if (rs.count === 0 || rs.lowRatingShare === null || rs.lowRatingShare < 0.1) return null;

  const worst = ctx.productProblems.filter((p) => p.lowRatingCount >= 2).slice(0, 3);
  if (worst.length === 0) return null;

  const potential = computeImprovementPotential({
    kpiWeight: 15,
    currentScore: 50,
    dataConfidence: Math.min(1, rs.count / 30),
    feasibility: 0.5,
  });

  const words = worst.flatMap((p) => p.topComplaintWords).slice(0, 8);

  return {
    title: "특정 상품에서 저평점 리뷰가 반복되고 있습니다",
    finding: `선택 기간 리뷰의 ${formatPct(rs.lowRatingShare)} 가 1~3점입니다. 그중 ${worst.map((w) => w.productName).join(", ")}에서 저평점이 반복됩니다.`,
    evidence: worst.map((p) =>
      evidence(`${p.productName} 평균 평점`, p.averageRating ?? 0, undefined, "리뷰관리 구매자평점")
    ),
    diagnosis: `해당 상품들은 리뷰 ${worst.map((p) => p.reviewCount).reduce((a, b) => a + b, 0)}건 중 1~3점이 ${worst
      .map((p) => p.lowRatingCount)
      .reduce((a, b) => a + b, 0)}건으로 확인됩니다.`,
    hypothesis:
      words.length > 0
        ? `저평점 리뷰에서 자주 등장한 단어: ${words.join(", ")}. 이는 단어 빈도 집계일 뿐이며, 실제 원인은 리뷰 원문을 직접 확인해 판단해야 합니다.`
        : undefined,
    action: "해당 상품의 품질·배송·상세페이지 설명 불일치 여부를 점검하세요.",
    confidence: "medium",
    priority: potential.priority,
  };
}

/** 재구매 매출 비중↓ → CRM·재구매 주기 전략 검토 (design doc 3.6). */
function returningCustomerRule(ctx: InsightContext): Insight | null {
  const { returningSalesShareCurrent: cur, returningSalesSharePrevious: prev } = ctx;
  if (cur === null || prev === null || prev === 0) return null;

  const change = (cur - prev) / Math.abs(prev);
  if (!isDrop(change)) return null;

  const potential = computeImprovementPotential({
    kpiWeight: 15,
    currentScore: 50,
    dataConfidence: 1,
    feasibility: 0.5,
  });

  return {
    title: "재구매 고객의 매출 기여가 줄고 있습니다",
    finding: `재구매 매출 비중이 직전기간 대비 ${formatPct(change)} 감소했습니다.`,
    evidence: [evidence("재구매 매출비중", cur, prev, "고객분석 재구매 판매금액(총)비중")],
    diagnosis: "재구매 고객이 전체 매출에서 차지하는 비중이 직전기간보다 줄어든 것으로 확인됩니다.",
    action: "재구매 주기에 맞춘 CRM 메시지, 리마인드 쿠폰 등 재구매 유도 전략을 검토하세요.",
    confidence: "high",
    priority: potential.priority,
  };
}

const RULES: Array<(ctx: InsightContext) => Insight | null> = [
  trafficRecoveryRule,
  conversionRecoveryRule,
  aovOptionRule,
  adCreativeRule,
  landingCompetitivenessHypothesisRule,
  lowRatingProductRule,
  returningCustomerRule,
];

/** Runs every rule and returns only the ones that fired, ranked by priority (highest first). */
export function generateInsights(ctx: InsightContext): Insight[] {
  return RULES.map((rule) => rule(ctx))
    .filter((insight): insight is Insight => insight !== null)
    .sort((a, b) => b.priority - a.priority);
}
