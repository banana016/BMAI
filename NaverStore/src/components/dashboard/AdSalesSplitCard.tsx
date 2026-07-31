"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AdSalesSplit } from "@/lib/metrics/ad-sales-share";
import { formatByUnit } from "./format";

interface AdSalesSplitCardProps {
  split: AdSalesSplit | null;
}

const COLORS = { organic: "#16A34A", ad: "#2563EB" };

export function AdSalesSplitCard({ split }: AdSalesSplitCardProps) {
  if (split === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">자연매출 vs 광고연계매출</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">계산할 데이터가 부족합니다.</p>
      </div>
    );
  }

  const data = [
    { name: "자연매출", value: split.organicSales },
    { name: "광고연계매출", value: split.adSales },
  ];

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">자연매출 vs 광고연계매출</p>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={32} outerRadius={52} paddingAngle={2} stroke="none">
              <Cell fill={COLORS.organic} />
              <Cell fill={COLORS.ad} />
            </Pie>
            <Tooltip formatter={(value, name) => [formatByUnit(Number(value), "currency"), name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        자연매출 {split.organicShare.toFixed(1)}% : 광고연계매출 {split.adShare.toFixed(1)}%
      </p>
      <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.organic }} />
          자연 {formatByUnit(split.organicSales, "currency")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.ad }} />
          광고 {formatByUnit(split.adSales, "currency")}
        </span>
      </div>
    </div>
  );
}
