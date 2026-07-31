export interface ScenarioAssumptions {
  traffic: number;
  /** Ratio (0.05 = 5%). */
  conversionRate: number;
  aov: number;
  adCost: number;
  /** Percent-scale number (250 = 250%), matching the rest of the app's ROAS convention. */
  roas: number;
}

export interface ScenarioBaseline {
  traffic: number;
  conversionRate: number;
  aov: number;
  /** 현재 기준 매출 — the period's actual net sales, for computing incremental sales against. */
  currentSales: number;
  adCost: number;
  roas: number;
}

export interface ScenarioResult {
  /** 예상 매출 = 가정 유입 × 가정 전환율 × 가정 객단가 (design doc 3.7). */
  projectedSales: number;
  /** 예상 추가매출 = 예상 매출 - 현재 기준 매출. */
  projectedIncrementalSales: number;
  /** 예상 구매완료 광고매출 = 가정 광고비 × 가정 ROAS ÷ 100. */
  projectedAdSales: number;
}
