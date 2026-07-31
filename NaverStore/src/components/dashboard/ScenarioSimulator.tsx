"use client";

import { useMemo, useState } from "react";
import type { ScenarioAssumptions, ScenarioBaseline } from "@/types/simulation";
import { computeScenario, scenarioFromBaseline } from "@/lib/simulation/scenario";
import { formatByUnit } from "./format";

interface ScenarioSimulatorProps {
  baseline: ScenarioBaseline;
}

interface SliderConfig {
  key: keyof ScenarioAssumptions;
  label: string;
  unit: "currency" | "count" | "ratio" | "percent";
  min: number;
  max: number;
  step: number;
}

function buildSliderConfigs(baseline: ScenarioBaseline): SliderConfig[] {
  return [
    { key: "traffic", label: "유입(방문수)", unit: "count", min: 0, max: Math.max(1, baseline.traffic * 2), step: 1 },
    { key: "conversionRate", label: "구매전환율", unit: "ratio", min: 0, max: Math.min(1, Math.max(0.02, baseline.conversionRate * 3)), step: 0.001 },
    { key: "aov", label: "객단가", unit: "currency", min: 0, max: Math.max(1000, baseline.aov * 2), step: 100 },
    { key: "adCost", label: "광고비", unit: "currency", min: 0, max: Math.max(10000, baseline.adCost * 2), step: 1000 },
    { key: "roas", label: "구매완료 광고 ROAS", unit: "percent", min: 0, max: Math.max(500, baseline.roas * 2), step: 1 },
  ];
}

export function ScenarioSimulator({ baseline }: ScenarioSimulatorProps) {
  const [assumptions, setAssumptions] = useState<ScenarioAssumptions>(() => scenarioFromBaseline(baseline));
  const sliders = useMemo(() => buildSliderConfigs(baseline), [baseline]);

  const result = useMemo(() => computeScenario(baseline, assumptions), [baseline, assumptions]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">개선 시뮬레이션</p>
      <p className="mb-4 text-xs text-zinc-400 dark:text-zinc-500">
        아래 결과는 예측이 아니라, 슬라이더로 입력한 가정에 따라 계산된 단순 시나리오입니다. 예상 매출 = 유입×전환율×객단가
        + (광고비·ROAS를 기준값에서 바꿨을 때 늘거나 준 구매완료 광고매출만큼의 증감분).
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sliders.map((s) => (
          <label key={s.key} className="flex flex-col gap-1 text-sm">
            <span className="flex justify-between text-zinc-700 dark:text-zinc-300">
              <span>{s.label}</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatByUnit(assumptions[s.key], s.unit)}</span>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={assumptions[s.key]}
              onChange={(e) => setAssumptions((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))}
            />
          </label>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">예상 매출</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {formatByUnit(result.projectedSales, "currency")}
          </p>
        </div>
        <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">예상 추가매출 (현재 기준 매출 대비)</p>
          <p
            className={`text-lg font-semibold ${
              result.projectedIncrementalSales >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.projectedIncrementalSales >= 0 ? "+" : ""}
            {formatByUnit(result.projectedIncrementalSales, "currency")}
          </p>
        </div>
        <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">예상 구매완료 광고매출</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {formatByUnit(result.projectedAdSales, "currency")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAssumptions(scenarioFromBaseline(baseline))}
        className="mt-4 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        현재 기준값으로 초기화
      </button>
    </div>
  );
}
