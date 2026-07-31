"use client";

import { useMemo, useState } from "react";
import type { NormalizedAdRow, NormalizedSalesRow } from "@/types/normalized";
import type { CoreKpiKey, KpiTargets } from "@/types/dashboard";
import { defaultRecentPeriod, type DateRange } from "@/lib/metrics/period";
import { buildDashboardSummary } from "@/lib/scoring/dashboard";
import { KPI_ORDER, KPI_UNITS } from "@/lib/scoring/config";
import { parseTargetInput } from "./format";
import { PeriodSelector } from "./PeriodSelector";
import { KpiCard } from "./KpiCard";
import { HealthScore } from "./HealthScore";
import { KpiRadar } from "./KpiRadar";

interface DashboardProps {
  salesRows: NormalizedSalesRow[];
  adRows: NormalizedAdRow[];
  availableRange: DateRange;
}

export function Dashboard({ salesRows, adRows, availableRange }: DashboardProps) {
  const [range, setRange] = useState<DateRange>(() => defaultRecentPeriod(availableRange, 30));
  const [targetInputs, setTargetInputs] = useState<Partial<Record<CoreKpiKey, string>>>({});

  const targets: KpiTargets = useMemo(() => {
    const result: KpiTargets = {};
    for (const key of KPI_ORDER) {
      const raw = targetInputs[key];
      if (raw === undefined) continue;
      const parsed = parseTargetInput(raw, KPI_UNITS[key]);
      if (parsed !== undefined) result[key] = parsed;
    }
    return result;
  }, [targetInputs]);

  const summary = useMemo(
    () => buildDashboardSummary(salesRows, adRows, range, targets),
    [salesRows, adRows, range, targets]
  );

  return (
    <div className="flex flex-col gap-6">
      <PeriodSelector range={range} available={availableRange} onChange={setRange} />

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        직전 동일기간: {summary.previousRange.start} ~ {summary.previousRange.end} (전년동기 비교는 이 파일에 데이터가
        없어 제공하지 않습니다)
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HealthScore score={summary.compositeScore} dataCompleteness={summary.dataCompleteness} />
        {summary.kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            kpi={kpi}
            targetInput={targetInputs[kpi.key] ?? ""}
            onTargetInputChange={(raw) => setTargetInputs((prev) => ({ ...prev, [kpi.key]: raw }))}
          />
        ))}
      </div>

      <KpiRadar kpis={summary.kpis} />
    </div>
  );
}
