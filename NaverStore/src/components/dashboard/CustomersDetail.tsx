"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NormalizedCustomerRow } from "@/types/normalized";
import type { DateRange } from "@/lib/metrics/period";
import { computeCustomerWeeklyTrend } from "@/lib/analysis/customers";
import { formatByUnit } from "./format";

interface CustomersDetailProps {
  rows: NormalizedCustomerRow[];
  range: DateRange;
}

export function CustomersDetail({ rows, range }: CustomersDetailProps) {
  const weekly = computeCustomerWeeklyTrend(rows, range);
  const chartData = weekly.map((w) => ({
    ...w,
    returningSalesSharePercent: w.returningSalesShare !== null ? w.returningSalesShare * 100 : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">주간 신규/재구매 방문고객수 및 재구매 매출 비중</p>
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          선택한 기간과 겹치는 주간 코호트만 표시합니다. 신규+재구매를 합산해 전체와 비교하지 않습니다.
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="newVisitors" fill="#2563EB" name="신규 방문고객수" />
              <Bar yAxisId="left" dataKey="returningVisitors" fill="#16A34A" name="재구매 방문고객수" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="returningSalesSharePercent"
                stroke="#F59E0B"
                dot={{ r: 3 }}
                name="재구매 매출비중(%)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-2">주간</th>
              <th className="px-3 py-2">신규 방문고객수</th>
              <th className="px-3 py-2">재구매 방문고객수</th>
              <th className="px-3 py-2">재구매 매출</th>
              <th className="px-3 py-2">재구매 매출비중</th>
            </tr>
          </thead>
          <tbody>
            {weekly.map((w) => (
              <tr key={w.weekStart} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                  {w.weekStart} ~ {w.weekEnd}
                </td>
                <td className="px-3 py-2">{formatByUnit(w.newVisitors, "count")}</td>
                <td className="px-3 py-2">{formatByUnit(w.returningVisitors, "count")}</td>
                <td className="px-3 py-2">{formatByUnit(w.returningSales, "currency")}</td>
                <td className="px-3 py-2">{formatByUnit(w.returningSalesShare, "ratio")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
