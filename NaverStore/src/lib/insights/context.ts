import type {
  NormalizedAdRow,
  NormalizedCustomerRow,
  NormalizedReviewRow,
} from "@/types/normalized";
import type { DashboardSummary } from "@/types/dashboard";
import { computeAdFunnel, type AdFunnelSummary } from "../analysis/ads";
import { computeCustomerWeeklyTrend } from "../analysis/customers";
import {
  computeProductProblems,
  computeReviewSummary,
  filterReviewsByRange,
  type ProductProblemSummary,
  type ReviewSummary,
} from "../analysis/reviews";

export interface InsightContext {
  summary: DashboardSummary;
  adFunnelCurrent: AdFunnelSummary;
  adFunnelPrevious: AdFunnelSummary;
  reviewSummaryCurrent: ReviewSummary;
  productProblems: ProductProblemSummary[];
  returningSalesShareCurrent: number | null;
  returningSalesSharePrevious: number | null;
}

function averageReturningSalesShare(
  customerRows: NormalizedCustomerRow[],
  range: { start: string; end: string }
): number | null {
  const weekly = computeCustomerWeeklyTrend(customerRows, range);
  const shares = weekly.map((w) => w.returningSalesShare).filter((v): v is number => v !== null);
  if (shares.length === 0) return null;
  return shares.reduce((a, b) => a + b, 0) / shares.length;
}

/** Assembles everything the Phase 5 rule engine needs from data already produced by Phase 3/4. */
export function buildInsightContext(
  summary: DashboardSummary,
  adRows: NormalizedAdRow[],
  customerRows: NormalizedCustomerRow[],
  reviewRows: NormalizedReviewRow[]
): InsightContext {
  const reviewsInRange = filterReviewsByRange(reviewRows, summary.currentRange);

  return {
    summary,
    adFunnelCurrent: computeAdFunnel(adRows, summary.currentRange),
    adFunnelPrevious: computeAdFunnel(adRows, summary.previousRange),
    reviewSummaryCurrent: computeReviewSummary(reviewsInRange),
    productProblems: computeProductProblems(reviewsInRange, 2),
    returningSalesShareCurrent: averageReturningSalesShare(customerRows, summary.currentRange),
    returningSalesSharePrevious: averageReturningSalesShare(customerRows, summary.previousRange),
  };
}
