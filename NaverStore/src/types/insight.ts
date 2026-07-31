export interface InsightEvidence {
  metric: string;
  current: number;
  comparison?: number;
  source: string;
}

export type InsightConfidence = "high" | "medium" | "low";

/** Matches design doc 3.5's structure exactly — do not add fields without updating the doc's contract. */
export interface Insight {
  title: string;
  finding: string;
  evidence: InsightEvidence[];
  /** Confirmed fact, backed only by evidence actually present. */
  diagnosis: string;
  /** An unverified candidate cause — must read as a hypothesis, never asserted as fact. */
  hypothesis?: string;
  action: string;
  /** Only set when backed by an actual formula (design doc 3.5 rule 6) — Phase 5 never fabricates this. */
  expectedImpact?: string;
  confidence: InsightConfidence;
  priority: number;
}
