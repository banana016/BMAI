import type { ScenarioAssumptions, ScenarioBaseline, ScenarioResult } from "@/types/simulation";

/**
 * Pure arithmetic per design doc 3.7 — a user-adjustable "what if" scenario,
 * never a forecast. Callers must present the result as such (see doc: "결과는
 * 예측이 아니라 사용자가 입력한 가정에 따른 단순 시나리오임을 표시한다").
 *
 * 예상 매출 = (가정 유입 × 가정 전환율 × 가정 객단가) + (광고 슬라이더로 인한
 * 구매완료 광고매출 증분). 유입/전환율/객단가는 이미 광고 유입·구매를 포함한
 * 전체 값이므로, 광고 슬라이더를 기준값 그대로 두면 증분이 0이 되어 이중계산
 * 없이 기존 계산과 동일하다. 광고비/ROAS를 조정했을 때만 그 변화분(개선되면
 * +, 악화되면 -)이 총 예상 매출에 반영된다.
 */
export function computeScenario(baseline: ScenarioBaseline, assumptions: ScenarioAssumptions): ScenarioResult {
  const organicProjectedSales = assumptions.traffic * assumptions.conversionRate * assumptions.aov;
  const baselineAdSales = (baseline.adCost * baseline.roas) / 100;
  const projectedAdSales = (assumptions.adCost * assumptions.roas) / 100;
  const adSalesDelta = projectedAdSales - baselineAdSales;

  const projectedSales = organicProjectedSales + adSalesDelta;
  const projectedIncrementalSales = projectedSales - baseline.currentSales;

  return { projectedSales, projectedIncrementalSales, projectedAdSales };
}

export function scenarioFromBaseline(baseline: ScenarioBaseline): ScenarioAssumptions {
  return {
    traffic: baseline.traffic,
    conversionRate: baseline.conversionRate,
    aov: baseline.aov,
    adCost: baseline.adCost,
    roas: baseline.roas,
  };
}
