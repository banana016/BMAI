import type { InsightEvidence } from "@/types/insight";

/** Builds one evidence entry, skipping `comparison` entirely when there's nothing to compare against (never fabricate a 0). */
export function evidence(
  metric: string,
  current: number,
  comparison: number | null | undefined,
  source: string
): InsightEvidence {
  return comparison === null || comparison === undefined ? { metric, current, source } : { metric, current, comparison, source };
}

export function formatPct(rate: number | null): string {
  if (rate === null) return "-";
  const pct = (rate * 100).toFixed(1);
  return `${rate >= 0 ? "+" : ""}${pct}%`;
}
