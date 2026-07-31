import type { Insight } from "@/types/insight";

interface PriorityTop3Props {
  insights: Insight[];
}

export function PriorityTop3({ insights }: PriorityTop3Props) {
  const top3 = insights.slice(0, 3);

  if (top3.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">우선 해결 과제 TOP 3</p>
      <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
        영향도(개선 잠재력)와 실행 용이성을 함께 반영한 순위입니다.
      </p>
      <ol className="flex flex-col gap-3">
        {top3.map((insight, i) => (
          <li key={i} className="flex gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{insight.title}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{insight.action}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
