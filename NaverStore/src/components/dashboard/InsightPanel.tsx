import type { Insight, InsightConfidence } from "@/types/insight";

interface InsightPanelProps {
  insights: Insight[];
}

const CONFIDENCE_LABEL: Record<InsightConfidence, string> = {
  high: "확신도 높음",
  medium: "확신도 보통",
  low: "확신도 낮음",
};

const CONFIDENCE_CLASS: Record<InsightConfidence, string> = {
  high: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function formatEvidenceValue(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("ko-KR") : value.toFixed(2);
}

export function InsightPanel({ insights }: InsightPanelProps) {
  if (insights.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        선택한 기간에는 규칙에 해당하는 이상 신호가 발견되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {insights.map((insight, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">{insight.title}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_CLASS[insight.confidence]}`}>
              {CONFIDENCE_LABEL[insight.confidence]}
            </span>
          </div>

          <p className="text-sm text-zinc-700 dark:text-zinc-300">{insight.finding}</p>

          <div className="rounded-md bg-zinc-50 p-3 text-xs dark:bg-zinc-800/50">
            <p className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">근거 데이터</p>
            <ul className="space-y-0.5 text-zinc-600 dark:text-zinc-300">
              {insight.evidence.map((e, j) => (
                <li key={j}>
                  {e.metric}: {formatEvidenceValue(e.current)}
                  {e.comparison !== undefined && ` (직전 ${formatEvidenceValue(e.comparison)})`}
                  <span className="text-zinc-400"> — {e.source}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-sm">
            <p>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">확인된 사실: </span>
              <span className="text-zinc-700 dark:text-zinc-300">{insight.diagnosis}</span>
            </p>
            {insight.hypothesis && (
              <p className="mt-1">
                <span className="font-medium text-amber-700 dark:text-amber-400">가설(미검증): </span>
                <span className="text-zinc-700 dark:text-zinc-300">{insight.hypothesis}</span>
              </p>
            )}
          </div>

          <p className="text-sm">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">실행 제안: </span>
            <span className="text-zinc-700 dark:text-zinc-300">{insight.action}</span>
          </p>

          {insight.expectedImpact && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">기대효과: {insight.expectedImpact}</p>
          )}
        </div>
      ))}
    </div>
  );
}
