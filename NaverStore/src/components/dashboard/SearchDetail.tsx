"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { NormalizedSearchRow } from "@/types/normalized";
import type { DateRange } from "@/lib/metrics/period";
import { assignQuadrants, computeKeywordRankingForRange, type QuadrantLabel } from "@/lib/analysis/search";
import { formatByUnit } from "./format";

interface SearchDetailProps {
  rows: NormalizedSearchRow[];
  range: DateRange;
  minVisits?: number;
}

const QUADRANT_COLORS: Record<QuadrantLabel, string> = {
  "고유입-고전환": "#16A34A",
  "고유입-저전환": "#F59E0B",
  "저유입-고전환": "#2563EB",
  "저유입-저전환": "#64748B",
};

export function SearchDetail({ rows, range, minVisits = 10 }: SearchDetailProps) {
  const ranking = computeKeywordRankingForRange(rows, range, minVisits);
  const { points, visitsMedian, conversionMedian } = assignQuadrants(ranking);
  const chartData = points.map((p) => ({ ...p, conversionRatePercent: p.conversionRate * 100 }));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">검색어 4분면 (유입×전환)</p>
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          방문수 {minVisits}회 미만 키워드는 제외했습니다. 기준선은 이 목록의 중앙값입니다.
        </p>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="visits" name="방문수" tick={{ fontSize: 11 }} />
              <YAxis type="number" dataKey="conversionRatePercent" name="전환율(%)" tick={{ fontSize: 11 }} />
              <ZAxis range={[60, 60]} />
              <ReferenceLine x={visitsMedian} stroke="#94A3B8" strokeDasharray="4 4" />
              <ReferenceLine y={conversionMedian * 100} stroke="#94A3B8" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof chartData)[number];
                  return (
                    <div className="rounded border border-zinc-200 bg-white p-2 text-xs shadow dark:border-zinc-700 dark:bg-zinc-900">
                      <p className="font-medium">{p.query}</p>
                      <p>
                        방문 {p.visits} · 전환율 {p.conversionRatePercent.toFixed(1)}%
                      </p>
                      <p className="text-zinc-400">{p.quadrant}</p>
                    </div>
                  );
                }}
              />
              {(Object.keys(QUADRANT_COLORS) as QuadrantLabel[]).map((q) => (
                <Scatter
                  key={q}
                  name={q}
                  data={chartData.filter((p) => p.quadrant === q)}
                  fill={QUADRANT_COLORS[q]}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-2">검색어</th>
              <th className="px-3 py-2">방문수</th>
              <th className="px-3 py-2">주문수</th>
              <th className="px-3 py-2">전환율</th>
              <th className="px-3 py-2">분면</th>
            </tr>
          </thead>
          <tbody>
            {points.slice(0, 20).map((p) => (
              <tr key={p.query} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{p.query}</td>
                <td className="px-3 py-2">{formatByUnit(p.visits, "count")}</td>
                <td className="px-3 py-2">{formatByUnit(p.orders, "count")}</td>
                <td className="px-3 py-2">{formatByUnit(p.conversionRate, "ratio")}</td>
                <td className="px-3 py-2">{p.quadrant}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
