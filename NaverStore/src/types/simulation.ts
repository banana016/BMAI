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
  /**
   * 예상 매출 = (가정 유입 × 가정 전환율 × 가정 객단가) + 광고 슬라이더로 인한
   * 구매완료 광고매출 증분(기준 대비). 광고비/ROAS를 기준값 그대로 두면 증분이
   * 0이라 유입×전환율×객단가와 동일 — design doc 3.7의 기본 식을 그대로 따르되,
   * 광고 슬라이더 변화가 총 매출에 반영되도록 확장한 것.
   */
  projectedSales: number;
  /** 예상 추가매출 = 예상 매출 - 현재 기준 매출. */
  projectedIncrementalSales: number;
  /** 예상 구매완료 광고매출 = 가정 광고비 × 가정 ROAS ÷ 100. */
  projectedAdSales: number;
}
