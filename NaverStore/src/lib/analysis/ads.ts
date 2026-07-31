import type { NormalizedAdRow } from "@/types/normalized";
import { isWithinRange, type DateRange } from "../metrics/period";

function sumOrNull(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

export interface AdFunnelSummary {
  impressions: number | null;
  clicks: number | null;
  /** Ratio, recomputed as SUM(clicks)/SUM(impressions) over the range. */
  ctr: number | null;
  /** SUM(cost)/SUM(clicks) over the range. */
  avgCpc: number | null;
  cost: number | null;
  purchaseConversions: number | null;
  purchaseConversionSales: number | null;
  /** Percent-scale number (240 = 240%): SUM(구매완료 전환매출액)/SUM(총비용)×100 (design doc 2.8). */
  purchaseRoas: number | null;
}

export function computeAdFunnel(rows: NormalizedAdRow[], range: DateRange): AdFunnelSummary {
  const inRange = rows.filter((r) => isWithinRange(r.date, range));

  const impressions = sumOrNull(inRange.map((r) => r.impressions));
  const clicks = sumOrNull(inRange.map((r) => r.clicks));
  const cost = sumOrNull(inRange.map((r) => r.cost));
  const purchaseConversions = sumOrNull(inRange.map((r) => r.purchaseConversions));
  const purchaseConversionSales = sumOrNull(inRange.map((r) => r.purchaseConversionSales));

  const ctr = impressions !== null && clicks !== null && impressions > 0 ? clicks / impressions : null;
  const avgCpc = cost !== null && clicks !== null && clicks > 0 ? cost / clicks : null;
  const purchaseRoas =
    purchaseConversionSales !== null && cost !== null && cost > 0 ? (purchaseConversionSales / cost) * 100 : null;

  return { impressions, clicks, ctr, avgCpc, cost, purchaseConversions, purchaseConversionSales, purchaseRoas };
}

export interface DailyRoasPoint {
  date: string;
  /** Percent-scale, converted from the row's internal ratio for display consistency with computeAdFunnel. */
  purchaseRoas: number | null;
  cost: number | null;
  purchaseConversionSales: number | null;
}

/** Per-day 구매완료 광고수익률(%) values — a daily check series, not the period's official ROAS (see computeAdFunnel). */
export function computeDailyRoasTrend(rows: NormalizedAdRow[], range: DateRange): DailyRoasPoint[] {
  return rows
    .filter((r) => isWithinRange(r.date, range))
    .map((r) => ({
      date: r.date,
      purchaseRoas: r.purchaseRoas !== null ? r.purchaseRoas * 100 : null,
      cost: r.cost,
      purchaseConversionSales: r.purchaseConversionSales,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
