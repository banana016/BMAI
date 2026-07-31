"use client";

import type { DateRange } from "@/lib/metrics/period";

interface PeriodSelectorProps {
  range: DateRange;
  available: DateRange;
  onChange: (range: DateRange) => void;
}

export function PeriodSelector({ range, available, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        시작일
        <input
          type="date"
          value={range.start}
          min={available.start}
          max={range.end}
          onChange={(e) => onChange({ ...range, start: e.target.value })}
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        종료일
        <input
          type="date"
          value={range.end}
          min={range.start}
          max={available.end}
          onChange={(e) => onChange({ ...range, end: e.target.value })}
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
        />
      </label>
      <p className="pb-1 text-xs text-zinc-400 dark:text-zinc-500">
        가용 데이터 기간: {available.start} ~ {available.end}
      </p>
    </div>
  );
}
