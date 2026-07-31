export type ImprovementBand = "매우 높음" | "높음" | "보통" | "낮음";

export interface ImprovementPotentialInput {
  /** The KPI's composite weight (design doc 3.2's 15-25 scale), or a fixed proxy weight for rules not tied to a core KPI. */
  kpiWeight: number;
  /** 0-100 KPI health score if one exists; pass 50 (neutral) when there's no direct KPI score to anchor to. */
  currentScore: number;
  /** 0-1 — how much the underlying sample size/data quality is trusted. */
  dataConfidence: number;
  /** 0-1 — how tractable the recommended action is to actually execute. */
  feasibility: number;
}

export interface ImprovementPotentialResult {
  /** 0-100 scale, matching design doc 3.4's band thresholds directly. */
  potential: number;
  band: ImprovementBand;
  /** Weight-adjusted ranking number — use this (not `potential`) to sort/select TOP 3. */
  priority: number;
}

function clamp(min: number, max: number, v: number): number {
  return Math.min(max, Math.max(min, v));
}

function bandFor(potential: number): ImprovementBand {
  if (potential >= 75) return "매우 높음";
  if (potential >= 50) return "높음";
  if (potential >= 25) return "보통";
  return "낮음";
}

/**
 * 개선 잠재력 = KPI 가중치 × (100-현재점수) × 데이터 신뢰도 × 실행가능성 (design doc 3.4).
 * The doc's literal product of a 15-25 weight and a 0-100 gap would blow past
 * 100, so `potential` (the band-eligible 0-100 number) drops the weight and
 * uses only (100-score) × confidence × feasibility; `kpiWeight` instead scales
 * `priority`, the number actually used to rank/select insights. Both are
 * returned so the UI can show the banded potential honestly alongside the
 * weight-adjusted ordering.
 */
export function computeImprovementPotential({
  kpiWeight,
  currentScore,
  dataConfidence,
  feasibility,
}: ImprovementPotentialInput): ImprovementPotentialResult {
  const potential = clamp(0, 100, (100 - currentScore) * dataConfidence * feasibility);
  const priority = potential * (kpiWeight / 20);
  return { potential, band: bandFor(potential), priority };
}
