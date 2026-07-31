import type { ScoreTag } from "@/lib/scoring/score";

export type CoreKpiKey = "netSales" | "traffic" | "conversionRate" | "aov" | "purchaseRoas";

export type KpiUnit = "currency" | "count" | "ratio" | "percent";

/** User-entered goals, in the same unit/scale as the corresponding KPI's `current` value. */
export type KpiTargets = Partial<Record<CoreKpiKey, number>>;

export interface KpiSummary {
  key: CoreKpiKey;
  label: string;
  current: number | null;
  previous: number | null;
  target: number | null;
  changeRate: number | null;
  score: number | null;
  tag: ScoreTag;
  color: string;
  unit: KpiUnit;
}

export interface DashboardSummary {
  currentRange: { start: string; end: string };
  previousRange: { start: string; end: string };
  kpis: KpiSummary[];
  compositeScore: number | null;
  dataCompleteness: number;
}
