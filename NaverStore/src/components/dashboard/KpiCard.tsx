"use client";

import type { KpiSummary } from "@/types/dashboard";
import { formatByUnit, formatChangeRate } from "./format";

interface KpiCardProps {
  kpi: KpiSummary;
  targetInput: string;
  onTargetInputChange: (raw: string) => void;
}

export function KpiCard({ kpi, targetInput, onTargetInputChange }: KpiCardProps) {
  const changeIsGood = kpi.changeRate !== null && kpi.changeRate >= 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{kpi.label}</p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: kpi.color }}
        >
          {kpi.tag}
        </span>
      </div>

      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{formatByUnit(kpi.current, kpi.unit)}</p>

      <p className={`text-xs ${changeIsGood ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
        {formatChangeRate(kpi.changeRate)}
      </p>

      {kpi.score !== null && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">KPI 점수 {kpi.score.toFixed(0)}점</p>
      )}

      <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        목표
        <input
          type="text"
          inputMode="decimal"
          value={targetInput}
          onChange={(e) => onTargetInputChange(e.target.value)}
          placeholder={kpi.unit === "ratio" || kpi.unit === "percent" ? "예: 6 (=6%)" : "값 입력"}
          className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
        />
      </label>
    </div>
  );
}
