"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NormalizedTrafficRow } from "@/types/normalized";
import type { DateRange } from "@/lib/metrics/period";
import { computeChannelBreakdown, computeDailyOverallTraffic } from "@/lib/analysis/traffic";
import { formatByUnit } from "./format";

interface TrafficDetailProps {
  rows: NormalizedTrafficRow[];
  range: DateRange;
}

export function TrafficDetail({ rows, range }: TrafficDetailProps) {
  const channels = computeChannelBreakdown(rows, range);
  const daily = computeDailyOverallTraffic(rows, range);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">전체 방문수 추이</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="visits" stroke="#2563EB" dot={false} name="방문수" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">유입경로별 방문수 (상위 채널)</p>
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          하위 경로를 상위 채널로 합산한 값입니다. 채널 간 합산 시 중복이 없도록 리프(leaf) 경로만 집계합니다.
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channels}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sourceL1" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="visits" fill="#2563EB" name="방문수" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-2">채널</th>
              <th className="px-3 py-2">방문수</th>
              <th className="px-3 py-2">주문수</th>
              <th className="px-3 py-2">매출</th>
              <th className="px-3 py-2">전환율</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.sourceL1} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{c.sourceL1}</td>
                <td className="px-3 py-2">{formatByUnit(c.visits, "count")}</td>
                <td className="px-3 py-2">{formatByUnit(c.orders, "count")}</td>
                <td className="px-3 py-2">{formatByUnit(c.sales, "currency")}</td>
                <td className="px-3 py-2">{formatByUnit(c.conversionRate, "ratio")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
