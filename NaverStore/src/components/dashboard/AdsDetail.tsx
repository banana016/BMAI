"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NormalizedAdRow } from "@/types/normalized";
import type { DateRange } from "@/lib/metrics/period";
import { computeAdFunnel, computeDailyRoasTrend } from "@/lib/analysis/ads";
import { formatByUnit } from "./format";

interface AdsDetailProps {
  rows: NormalizedAdRow[];
  range: DateRange;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

export function AdsDetail({ rows, range }: AdsDetailProps) {
  const funnel = computeAdFunnel(rows, range);
  const trend = computeDailyRoasTrend(rows, range);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">광고 퍼널 (노출 → 클릭 → 구매완료)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="노출수" value={formatByUnit(funnel.impressions, "count")} />
          <StatTile label="클릭수" value={formatByUnit(funnel.clicks, "count")} />
          <StatTile label="CTR" value={formatByUnit(funnel.ctr, "ratio")} />
          <StatTile label="평균 CPC" value={formatByUnit(funnel.avgCpc, "currency")} />
          <StatTile label="총비용" value={formatByUnit(funnel.cost, "currency")} />
          <StatTile label="구매완료 전환수" value={formatByUnit(funnel.purchaseConversions, "count")} />
          <StatTile label="구매완료 전환매출" value={formatByUnit(funnel.purchaseConversionSales, "currency")} />
          <StatTile label="구매완료 광고 ROAS" value={formatByUnit(funnel.purchaseRoas, "percent")} />
        </div>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          ROAS = 기간 SUM(구매완료 전환매출액) ÷ SUM(총비용) × 100 (일별 R열 평균이 아닌 기간 합산 기준).
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">일별 구매완료 ROAS 추이 (검산용)</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              <Line type="monotone" dataKey="purchaseRoas" stroke="#DC2626" dot={false} name="일별 ROAS(%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
