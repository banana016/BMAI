import type { NormalizedTrafficRow } from "@/types/normalized";
import { filterOverallTraffic, groupByTopLevelChannel } from "../normalize/traffic";
import { isWithinRange, type DateRange } from "../metrics/period";

export interface ChannelBreakdownRow {
  sourceL1: string;
  visits: number;
  orders: number;
  sales: number;
  conversionRate: number | null;
}

/**
 * Ranks top-level channels (경로(1단계) != 전체) by visits for the given
 * range. Relies on groupByTopLevelChannel's leaf-summing, which already
 * avoids double counting sub-paths (design doc 2.4).
 */
export function computeChannelBreakdown(rows: NormalizedTrafficRow[], range: DateRange): ChannelBreakdownRow[] {
  const inRange = rows.filter((r) => isWithinRange(r.date, range));
  const totals = groupByTopLevelChannel(inRange);
  return totals
    .map((c) => ({
      sourceL1: c.sourceL1,
      visits: c.visits,
      orders: c.orders,
      sales: c.sales,
      conversionRate: c.visits > 0 ? c.orders / c.visits : null,
    }))
    .sort((a, b) => b.visits - a.visits);
}

export interface DailyOverallTraffic {
  date: string;
  visits: number;
  orders: number;
  sales: number;
}

/** Daily trend of the (전체,전체,전체) row — the store's overall traffic, not a channel sum. */
export function computeDailyOverallTraffic(rows: NormalizedTrafficRow[], range: DateRange): DailyOverallTraffic[] {
  return filterOverallTraffic(rows)
    .filter((r) => isWithinRange(r.date, range))
    .map((r) => ({ date: r.date, visits: r.visits ?? 0, orders: r.orders ?? 0, sales: r.sales ?? 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
