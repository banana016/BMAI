"use client";

import { useMemo, useState } from "react";
import type {
  NormalizedAdRow,
  NormalizedCustomerRow,
  NormalizedReviewRow,
  NormalizedSalesRow,
  NormalizedSearchRow,
  NormalizedTrafficRow,
} from "@/types/normalized";
import type { CoreKpiKey, KpiTargets } from "@/types/dashboard";
import { defaultRecentPeriod, type DateRange } from "@/lib/metrics/period";
import { buildDashboardSummary } from "@/lib/scoring/dashboard";
import { KPI_ORDER, KPI_UNITS } from "@/lib/scoring/config";
import { parseTargetInput } from "./format";
import { PeriodSelector } from "./PeriodSelector";
import { KpiCard } from "./KpiCard";
import { HealthScore } from "./HealthScore";
import { KpiRadar } from "./KpiRadar";
import { TrafficDetail } from "./TrafficDetail";
import { SearchDetail } from "./SearchDetail";
import { AdsDetail } from "./AdsDetail";
import { CustomersDetail } from "./CustomersDetail";
import { ReviewsDetail } from "./ReviewsDetail";
import { buildInsightContext } from "@/lib/insights/context";
import { generateInsights } from "@/lib/insights/rules";
import { PriorityTop3 } from "./PriorityTop3";
import { InsightPanel } from "./InsightPanel";

interface DashboardProps {
  salesRows: NormalizedSalesRow[];
  trafficRows: NormalizedTrafficRow[];
  searchRows: NormalizedSearchRow[];
  customerRows: NormalizedCustomerRow[];
  reviewRows: NormalizedReviewRow[];
  adRows: NormalizedAdRow[];
  availableRange: DateRange;
}

const DETAIL_TABS = [
  { key: "traffic", label: "유입경로" },
  { key: "search", label: "검색어" },
  { key: "ads", label: "광고" },
  { key: "customers", label: "고객" },
  { key: "reviews", label: "리뷰" },
] as const;

type DetailTabKey = (typeof DETAIL_TABS)[number]["key"];

export function Dashboard({
  salesRows,
  trafficRows,
  searchRows,
  customerRows,
  reviewRows,
  adRows,
  availableRange,
}: DashboardProps) {
  const [range, setRange] = useState<DateRange>(() => defaultRecentPeriod(availableRange, 30));
  const [targetInputs, setTargetInputs] = useState<Partial<Record<CoreKpiKey, string>>>({});
  const [activeTab, setActiveTab] = useState<DetailTabKey>("traffic");

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

  const insights = useMemo(() => {
    const context = buildInsightContext(summary, adRows, customerRows, reviewRows);
    return generateInsights(context);
  }, [summary, adRows, customerRows, reviewRows]);

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

      <div>
        <div className="mb-4 flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800">
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium ${
                activeTab === tab.key
                  ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "traffic" && <TrafficDetail rows={trafficRows} range={range} />}
        {activeTab === "search" && <SearchDetail rows={searchRows} range={range} />}
        {activeTab === "ads" && <AdsDetail rows={adRows} range={range} />}
        {activeTab === "customers" && <CustomersDetail rows={customerRows} range={range} />}
        {activeTab === "reviews" && <ReviewsDetail rows={reviewRows} range={range} />}
      </div>

      <PriorityTop3 insights={insights} />

      <div>
        <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">인사이트 패널</p>
        <InsightPanel insights={insights} />
      </div>
    </div>
  );
}
