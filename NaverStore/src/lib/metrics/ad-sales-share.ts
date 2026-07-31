export interface AdSalesSplit {
  organicSales: number;
  adSales: number;
  /** 0-100, organicShare + adShare === 100 (share of total net sales, not a ratio-to-organic). */
  organicShare: number;
  adShare: number;
}

/**
 * Splits net sales into 자연매출(organic) vs 광고연계매출(ad-attributed) as a
 * share of the SAME total (organicShare + adShare = 100), so it reads as an
 * intuitive "X% : Y%" split rather than a ratio that can exceed 100%.
 */
export function computeAdSalesSplit(netSales: number | null, adAttributedSales: number | null): AdSalesSplit | null {
  if (netSales === null || adAttributedSales === null) return null;
  const organicSales = netSales - adAttributedSales;
  if (organicSales < 0 || netSales <= 0) return null;

  return {
    organicSales,
    adSales: adAttributedSales,
    organicShare: (organicSales / netSales) * 100,
    adShare: (adAttributedSales / netSales) * 100,
  };
}
