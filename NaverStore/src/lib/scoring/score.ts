export type ScoreTag = "양호" | "주의" | "개선 필요" | "기준 필요";

export const TAG_COLORS: Record<ScoreTag, string> = {
  양호: "#16A34A",
  주의: "#F59E0B",
  "개선 필요": "#DC2626",
  "기준 필요": "#64748B",
};

const TARGET_WEIGHT = 40;
const TREND_WEIGHT = 35;
// 전년동기 weight (25) is never assignable — this file has no prior-year data
// (design doc 0.3 / 3.1), so it's permanently excluded rather than redistributed
// from a component that could ever be present.

function clamp(min: number, max: number, v: number): number {
  return Math.min(max, Math.max(min, v));
}

export function tagForScore(score: number): ScoreTag {
  if (score >= 80) return "양호";
  if (score >= 60) return "주의";
  return "개선 필요";
}

export interface ScoreInputs {
  current: number | null;
  /** User-entered goal for this KPI, in the same unit/scale as `current`. */
  target?: number | null;
  /** Value for the previous equivalent-length period ("직전 동일기간"). */
  previous?: number | null;
  /** False for metrics like refund rate where lower is better. Defaults to true. */
  higherIsBetter?: boolean;
}

export interface KpiScoreResult {
  score: number | null;
  tag: ScoreTag;
  color: string;
  components: { target?: number; trend?: number };
}

const NO_SCORE: KpiScoreResult = { score: null, tag: "기준 필요", color: TAG_COLORS["기준 필요"], components: {} };

/**
 * KPI 점수 = 목표달성 점수×40% + 직전기간 변화 점수×35% (+ 전년동기, always
 * absent here). Whichever component is missing drops out and the remaining
 * weight is renormalized to 100%, per design doc 3.2. If neither is
 * available the KPI shows no score at all ("기준 필요").
 */
export function scoreKpi({ current, target, previous, higherIsBetter = true }: ScoreInputs): KpiScoreResult {
  if (current === null) return NO_SCORE;

  const components: { target?: number; trend?: number } = {};
  let totalWeight = 0;
  let weightedSum = 0;

  if (target !== undefined && target !== null && target !== 0) {
    const achievement = higherIsBetter ? current / target : target / current;
    const targetScore = clamp(0, 100, achievement * 100);
    components.target = targetScore;
    totalWeight += TARGET_WEIGHT;
    weightedSum += targetScore * TARGET_WEIGHT;
  }

  if (previous !== undefined && previous !== null && previous !== 0) {
    let changeRate = (current - previous) / Math.abs(previous);
    if (!higherIsBetter) changeRate = -changeRate;
    const trendScore = clamp(0, 100, 50 + changeRate * 100);
    components.trend = trendScore;
    totalWeight += TREND_WEIGHT;
    weightedSum += trendScore * TREND_WEIGHT;
  }

  if (totalWeight === 0) return { ...NO_SCORE, components };

  const score = weightedSum / totalWeight;
  const tag = tagForScore(score);
  return { score, tag, color: TAG_COLORS[tag], components };
}

export interface CompositeKpiInput {
  key: string;
  weight: number;
  score: number | null;
}

export interface CompositeScoreResult {
  score: number | null;
  /** Percentage of the composite's base weight backed by a scored KPI. */
  dataCompleteness: number;
}

/** Missing KPIs are excluded and the remaining weights renormalized, per design doc 3.2. */
export function computeCompositeScore(inputs: CompositeKpiInput[]): CompositeScoreResult {
  const totalBaseWeight = inputs.reduce((sum, i) => sum + i.weight, 0);
  const usable = inputs.filter((i) => i.score !== null);
  const usableWeight = usable.reduce((sum, i) => sum + i.weight, 0);
  const dataCompleteness = totalBaseWeight > 0 ? Math.round((usableWeight / totalBaseWeight) * 100) : 0;

  if (usable.length === 0) return { score: null, dataCompleteness };

  const weightedSum = usable.reduce((sum, i) => sum + (i.score as number) * i.weight, 0);
  return { score: weightedSum / usableWeight, dataCompleteness };
}
