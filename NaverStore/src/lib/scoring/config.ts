import type { CoreKpiKey, KpiUnit } from "@/types/dashboard";

/** 종합점수 weights per design doc 3.2. */
export const COMPOSITE_WEIGHTS: Record<CoreKpiKey, number> = {
  netSales: 25,
  traffic: 20,
  conversionRate: 20,
  aov: 15,
  purchaseRoas: 20,
};

export const KPI_LABELS: Record<CoreKpiKey, string> = {
  netSales: "매출액",
  traffic: "유입량",
  conversionRate: "구매전환율",
  aov: "객단가",
  purchaseRoas: "구매완료 광고 ROAS",
};

export const KPI_ORDER: CoreKpiKey[] = ["netSales", "traffic", "conversionRate", "aov", "purchaseRoas"];

export const KPI_UNITS: Record<CoreKpiKey, KpiUnit> = {
  netSales: "currency",
  traffic: "count",
  conversionRate: "ratio",
  aov: "currency",
  purchaseRoas: "percent",
};
