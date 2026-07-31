import type { NormalizedAdRow, NormalizedSalesRow } from "@/types/normalized";
import type { DashboardSummary, KpiSummary, KpiTargets } from "@/types/dashboard";
import { computeCoreKpis } from "../metrics/core-kpis";
import { previousPeriod, type DateRange } from "../metrics/period";
import { computeCompositeScore, scoreKpi } from "./score";
import { COMPOSITE_WEIGHTS, KPI_LABELS, KPI_ORDER, KPI_UNITS } from "./config";

/**
 * Assembles the 5 core KPIs for the selected period against the immediately
 * preceding period of equal length. Prior-year comparison is intentionally
 * absent — see design doc 0.3 (no prior-year data in this workbook) and 3.1.
 */
export function buildDashboardSummary(
  salesRows: NormalizedSalesRow[],
  adRows: NormalizedAdRow[],
  currentRange: DateRange,
  targets: KpiTargets = {}
): DashboardSummary {
  const current = computeCoreKpis(salesRows, adRows, currentRange);
  const previousRange = previousPeriod(currentRange);
  const previous = computeCoreKpis(salesRows, adRows, previousRange);

  const kpis: KpiSummary[] = KPI_ORDER.map((key) => {
    const currentValue = current[key];
    const previousValue = previous[key];
    const target = targets[key] ?? null;
    const changeRate =
      currentValue !== null && previousValue !== null && previousValue !== 0
        ? (currentValue - previousValue) / Math.abs(previousValue)
        : null;

    const result = scoreKpi({ current: currentValue, target, previous: previousValue });

    return {
      key,
      label: KPI_LABELS[key],
      current: currentValue,
      previous: previousValue,
      target,
      changeRate,
      score: result.score,
      tag: result.tag,
      color: result.color,
      unit: KPI_UNITS[key],
    };
  });

  const { score: compositeScore, dataCompleteness } = computeCompositeScore(
    kpis.map((k) => ({ key: k.key, weight: COMPOSITE_WEIGHTS[k.key], score: k.score }))
  );

  return { currentRange, previousRange, kpis, compositeScore, dataCompleteness };
}
