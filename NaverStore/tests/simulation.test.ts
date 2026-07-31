import { describe, expect, it } from "vitest";
import { computeScenario, scenarioFromBaseline } from "@/lib/simulation/scenario";
import { buildRoadmap } from "@/lib/simulation/roadmap";
import type { Insight } from "@/types/insight";
import type { ScenarioBaseline } from "@/types/simulation";

const baseline: ScenarioBaseline = {
  traffic: 10_000,
  conversionRate: 0.05,
  aov: 20_000,
  currentSales: 9_000_000, // deliberately not traffic*cr*aov, to prove incremental is diffed against this, not recomputed
  adCost: 1_000_000,
  roas: 250,
};

describe("computeScenario", () => {
  it("computes 예상 매출 = 유입 × 전환율 × 객단가", () => {
    const result = computeScenario(baseline, scenarioFromBaseline(baseline));
    expect(result.projectedSales).toBe(10_000 * 0.05 * 20_000);
  });

  it("computes 예상 추가매출 against the baseline's actual current sales, not a recomputed figure", () => {
    const result = computeScenario(baseline, scenarioFromBaseline(baseline));
    expect(result.projectedIncrementalSales).toBe(result.projectedSales - baseline.currentSales);
  });

  it("computes 예상 구매완료 광고매출 = 광고비 × ROAS ÷ 100", () => {
    const result = computeScenario(baseline, scenarioFromBaseline(baseline));
    expect(result.projectedAdSales).toBe((1_000_000 * 250) / 100);
  });

  it("reflects adjusted assumptions, not the baseline, once the user changes a slider", () => {
    const assumptions = { ...scenarioFromBaseline(baseline), traffic: 20_000 };
    const result = computeScenario(baseline, assumptions);
    expect(result.projectedSales).toBe(20_000 * 0.05 * 20_000);
    expect(result.projectedSales).not.toBe(baseline.traffic * baseline.conversionRate * baseline.aov);
  });

  it("raising the ROAS slider (adCost held at baseline) increases projected sales by the ad-sales delta", () => {
    const atBaseline = computeScenario(baseline, scenarioFromBaseline(baseline));
    const higherRoas = { ...scenarioFromBaseline(baseline), roas: 400 };
    const withHigherRoas = computeScenario(baseline, higherRoas);

    const expectedDelta = (baseline.adCost * 400) / 100 - (baseline.adCost * baseline.roas) / 100;
    expect(withHigherRoas.projectedAdSales).toBeGreaterThan(atBaseline.projectedAdSales);
    expect(withHigherRoas.projectedSales).toBeCloseTo(atBaseline.projectedSales + expectedDelta);
    expect(withHigherRoas.projectedIncrementalSales).toBeGreaterThan(atBaseline.projectedIncrementalSales);
  });

  it("lowering the ROAS slider decreases projected sales symmetrically", () => {
    const atBaseline = computeScenario(baseline, scenarioFromBaseline(baseline));
    const lowerRoas = { ...scenarioFromBaseline(baseline), roas: 100 };
    const withLowerRoas = computeScenario(baseline, lowerRoas);

    expect(withLowerRoas.projectedSales).toBeLessThan(atBaseline.projectedSales);
  });

  it("raising ad cost while holding ROAS at baseline also lifts projected sales", () => {
    const atBaseline = computeScenario(baseline, scenarioFromBaseline(baseline));
    const moreAdSpend = { ...scenarioFromBaseline(baseline), adCost: 2_000_000 };
    const withMoreSpend = computeScenario(baseline, moreAdSpend);

    expect(withMoreSpend.projectedSales).toBeGreaterThan(atBaseline.projectedSales);
  });

  it("stays exactly at the traffic×conversionRate×aov figure when ad sliders are untouched (no double counting at rest)", () => {
    const result = computeScenario(baseline, scenarioFromBaseline(baseline));
    expect(result.projectedSales).toBe(baseline.traffic * baseline.conversionRate * baseline.aov);
  });
});

function insight(title: string, action: string, priority: number): Insight {
  return {
    title,
    finding: "f",
    evidence: [{ metric: "m", current: 1, source: "s" }],
    diagnosis: "d",
    action,
    confidence: "high",
    priority,
  };
}

describe("buildRoadmap", () => {
  it("returns an empty roadmap when there are no insights", () => {
    expect(buildRoadmap([])).toEqual([]);
  });

  it("builds 30/60/90 day phases grounded in the top 3 insights' own action text", () => {
    const insights = [insight("A", "A를 조치하세요", 10), insight("B", "B를 조치하세요", 5)];
    const phases = buildRoadmap(insights);
    expect(phases.map((p) => p.days)).toEqual([30, 60, 90]);
    expect(phases[0].items).toEqual(["A를 조치하세요", "B를 조치하세요"]);
    expect(phases[1].items.every((item) => item.includes("점검"))).toBe(true);
  });

  it("only uses the top 3 insights even when more are passed", () => {
    const insights = [1, 2, 3, 4, 5].map((n) => insight(`T${n}`, `A${n}`, 10 - n));
    const phases = buildRoadmap(insights);
    expect(phases[0].items).toHaveLength(3);
  });
});
