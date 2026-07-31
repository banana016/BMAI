"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { KpiSummary } from "@/types/dashboard";

interface KpiRadarProps {
  kpis: KpiSummary[];
}

export function KpiRadar({ kpis }: KpiRadarProps) {
  const data = kpis.map((k) => ({ subject: k.label, score: k.score ?? 0, hasScore: k.score !== null }));
  const missing = kpis.filter((k) => k.score === null);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">KPI 건강도 레이더</p>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
            <Radar name="KPI 점수" dataKey="score" stroke="#2563EB" fill="#2563EB" fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {missing.length > 0 && (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          기준 필요(목표·비교 데이터 없음): {missing.map((k) => k.label).join(", ")} — 0점으로 표시됨
        </p>
      )}
    </div>
  );
}
