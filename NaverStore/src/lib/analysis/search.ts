import type { NormalizedSearchRow } from "@/types/normalized";
import { rankKeywordsByConversion, type KeywordRanking } from "../normalize/search";
import { isWithinRange, type DateRange } from "../metrics/period";

export function computeKeywordRankingForRange(
  rows: NormalizedSearchRow[],
  range: DateRange,
  minVisits = 10
): KeywordRanking[] {
  const inRange = rows.filter((r) => isWithinRange(r.date, range));
  return rankKeywordsByConversion(inRange, minVisits);
}

export type QuadrantLabel = "고유입-고전환" | "고유입-저전환" | "저유입-고전환" | "저유입-저전환";

export interface KeywordQuadrantPoint extends KeywordRanking {
  quadrant: QuadrantLabel;
}

export interface QuadrantResult {
  points: KeywordQuadrantPoint[];
  visitsMedian: number;
  conversionMedian: number;
}

function median(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid];
}

/**
 * Splits keywords into 4 quadrants (유입×전환) around the median of each axis
 * within this ranking set — not a fixed threshold, since "high" traffic/
 * conversion is relative to this store's own keyword mix.
 */
export function assignQuadrants(rankings: KeywordRanking[]): QuadrantResult {
  if (rankings.length === 0) return { points: [], visitsMedian: 0, conversionMedian: 0 };

  const visitsMedian = median([...rankings].map((r) => r.visits).sort((a, b) => a - b));
  const conversionMedian = median([...rankings].map((r) => r.conversionRate).sort((a, b) => a - b));

  const points = rankings.map((r) => {
    const highVisits = r.visits >= visitsMedian;
    const highConversion = r.conversionRate >= conversionMedian;
    const quadrant: QuadrantLabel =
      highVisits && highConversion
        ? "고유입-고전환"
        : highVisits
          ? "고유입-저전환"
          : highConversion
            ? "저유입-고전환"
            : "저유입-저전환";
    return { ...r, quadrant };
  });

  return { points, visitsMedian, conversionMedian };
}
