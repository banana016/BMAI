import { TAG_COLORS, tagForScore } from "@/lib/scoring/score";

interface HealthScoreProps {
  score: number | null;
  dataCompleteness: number;
}

export function HealthScore({ score, dataCompleteness }: HealthScoreProps) {
  const tag = score === null ? "기준 필요" : tagForScore(score);
  const color = TAG_COLORS[tag];

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">종합 건강도</p>
      <p className="text-4xl font-bold" style={{ color }}>
        {score === null ? "-" : score.toFixed(0)}
      </p>
      <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        {tag}
      </span>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">데이터 완전성 {dataCompleteness}%</p>
    </div>
  );
}
