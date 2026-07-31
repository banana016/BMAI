import type { ScenarioAssumptions, ScenarioBaseline, ScenarioResult } from "@/types/simulation";

/**
 * Pure arithmetic per design doc 3.7 — a user-adjustable "what if" scenario,
 * never a forecast. Callers must present the result as such (see doc: "결과는
 * 예측이 아니라 사용자가 입력한 가정에 따른 단순 시나리오임을 표시한다").
 */
export function computeScenario(baseline: ScenarioBaseline, assumptions: ScenarioAssumptions): ScenarioResult {
  const projectedSales = assumptions.traffic * assumptions.conversionRate * assumptions.aov;
  const projectedIncrementalSales = projectedSales - baseline.currentSales;
  const projectedAdSales = (assumptions.adCost * assumptions.roas) / 100;

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
