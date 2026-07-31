import type { NormalizedAdRow, NormalizedSalesRow } from "@/types/normalized";
import { filterChannelTotal } from "../normalize/sales";
import { isWithinRange, type DateRange } from "./period";

function sumOrNull(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

export interface CoreKpiValues {
  netSales: number | null;
  traffic: number | null;
  orders: number | null;
  /** Ratio (0.05 = 5%), computed as SUM(orders)/SUM(traffic) — never averaged day by day. */
  conversionRate: number | null;
  /** 총 매출(grossSales) ÷ 결제건수 기준 — the doc allows either definition as long as it's labeled. */
  aov: number | null;
  adCost: number | null;
  adPurchaseSales: number | null;
  /** Percent-scale number (240 = 240%), per doc 2.8: SUM(구매완료 전환매출액)/SUM(총비용)×100, not the daily R-column average. */
  purchaseRoas: number | null;
  /** Number of 판매분석(채널=전체) rows that fell inside the range — 0 means no sales data overlaps this period at all. */
  rowCount: number;
}

export function computeCoreKpis(
  salesRows: NormalizedSalesRow[],
  adRows: NormalizedAdRow[],
  range: DateRange
): CoreKpiValues {
  const salesInRange = filterChannelTotal(salesRows).filter((r) => isWithinRange(r.date, range));
  const adsInRange = adRows.filter((r) => isWithinRange(r.date, range));

  const netSales = sumOrNull(salesInRange.map((r) => r.netSales));
  const grossSales = sumOrNull(salesInRange.map((r) => r.grossSales));
  const traffic = sumOrNull(salesInRange.map((r) => r.traffic));
  const orders = sumOrNull(salesInRange.map((r) => r.orders));
  const conversionRate = orders !== null && traffic !== null && traffic > 0 ? orders / traffic : null;
  const aov = grossSales !== null && orders !== null && orders > 0 ? grossSales / orders : null;

  const adCost = sumOrNull(adsInRange.map((r) => r.cost));
  const adPurchaseSales = sumOrNull(adsInRange.map((r) => r.purchaseConversionSales));
  const purchaseRoas =
    adPurchaseSales !== null && adCost !== null && adCost > 0 ? (adPurchaseSales / adCost) * 100 : null;

  return {
    netSales,
    traffic,
    orders,
    conversionRate,
    aov,
    adCost,
    adPurchaseSales,
    purchaseRoas,
    rowCount: salesInRange.length,
  };
}
