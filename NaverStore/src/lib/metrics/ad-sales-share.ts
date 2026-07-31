/**
 * 자연매출 대비 광고연계매출 비중 = 광고연계매출(구매완료 전환매출) ÷ 자연매출(전체
 * 매출 - 광고연계매출) × 100. Uses 자연매출 as the denominator (not total sales),
 * so this can exceed 100% when ad-attributed sales are the larger share.
 */
export function computeAdLinkedSalesShare(netSales: number | null, adAttributedSales: number | null): number | null {
  if (netSales === null || adAttributedSales === null) return null;
  const organicSales = netSales - adAttributedSales;
  if (organicSales <= 0) return null;
  return (adAttributedSales / organicSales) * 100;
}
