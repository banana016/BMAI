import type { NormalizedCustomerRow } from "@/types/normalized";
import { filterCustomerType } from "../normalize/customers";
import type { DateRange } from "../metrics/period";

export interface CustomerWeekPoint {
  weekStart: string;
  weekEnd: string;
  newVisitors: number | null;
  returningVisitors: number | null;
  newSales: number | null;
  returningSales: number | null;
  /** Straight from the 재구매 row's own 판매금액(총)비중 — never derived from new+returning (design doc 2.6). */
  returningSalesShare: number | null;
}

function weekOverlapsRange(week: { weekStart: string; weekEnd: string }, range: DateRange): boolean {
  return week.weekStart <= range.end && week.weekEnd >= range.start;
}

/**
 * Pairs up 신규/재구매 rows by week. Weeks are only included if the caller
 * doesn't pass a range, or if the week overlaps it at all — cohort weeks
 * rarely align with an arbitrary daily picker, so full-containment would
 * frequently show nothing.
 */
export function computeCustomerWeeklyTrend(rows: NormalizedCustomerRow[], range?: DateRange): CustomerWeekPoint[] {
  const scoped = range ? rows.filter((r) => weekOverlapsRange(r, range)) : rows;
  const newRows = filterCustomerType(scoped, "new");
  const returningRows = filterCustomerType(scoped, "returning");

  const weeks = new Map<string, CustomerWeekPoint>();
  for (const r of newRows) {
    weeks.set(r.weekStart, {
      weekStart: r.weekStart,
      weekEnd: r.weekEnd,
      newVisitors: r.visitors,
      newSales: r.sales,
      returningVisitors: null,
      returningSales: null,
      returningSalesShare: null,
    });
  }
  for (const r of returningRows) {
    const existing = weeks.get(r.weekStart) ?? {
      weekStart: r.weekStart,
      weekEnd: r.weekEnd,
      newVisitors: null,
      newSales: null,
      returningVisitors: null,
      returningSales: null,
      returningSalesShare: null,
    };
    existing.returningVisitors = r.visitors;
    existing.returningSales = r.sales;
    existing.returningSalesShare = r.salesShare;
    weeks.set(r.weekStart, existing);
  }

  return [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
