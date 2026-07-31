import { describe, expect, it } from "vitest";
import { computeCompositeScore, scoreKpi, tagForScore } from "@/lib/scoring/score";
import { daysInRange, previousPeriod, clampToAvailable, defaultRecentPeriod, isWithinRange } from "@/lib/metrics/period";

describe("scoreKpi", () => {
  it("returns 기준 필요 when current itself is missing", () => {
    const result = scoreKpi({ current: null, target: 100, previous: 90 });
    expect(result.score).toBeNull();
    expect(result.tag).toBe("기준 필요");
  });

  it("returns 기준 필요 when neither target nor previous is available", () => {
    const result = scoreKpi({ current: 100 });
    expect(result.score).toBeNull();
    expect(result.tag).toBe("기준 필요");
  });

  it("uses only the target component, renormalized to 100%, when previous is missing", () => {
    // current === target -> targetScore 100 -> should be the whole score.
    const result = scoreKpi({ current: 100, target: 100 });
    expect(result.score).toBe(100);
    expect(result.components.trend).toBeUndefined();
  });

  it("uses only the trend component, renormalized to 100%, when target is missing", () => {
    // no change vs previous -> trendScore 50 -> should be the whole score.
    const result = scoreKpi({ current: 100, previous: 100 });
    expect(result.score).toBe(50);
    expect(result.components.target).toBeUndefined();
  });

  it("blends target (40%) and trend (35%) when both are available", () => {
    // current==target -> targetScore=100; no change vs previous -> trendScore=50.
    const result = scoreKpi({ current: 100, target: 100, previous: 100 });
    const expected = (100 * 40 + 50 * 35) / 75;
    expect(result.score).toBeCloseTo(expected);
  });

  it("inverts direction for lower-is-better metrics", () => {
    // current below target is *good* for a lower-is-better metric like refund rate.
    const better = scoreKpi({ current: 5, target: 10, higherIsBetter: false });
    const worse = scoreKpi({ current: 15, target: 10, higherIsBetter: false });
    expect(better.score!).toBeGreaterThan(worse.score!);
  });

  it("clamps target overachievement instead of exceeding 100", () => {
    const result = scoreKpi({ current: 1000, target: 100 });
    expect(result.score).toBe(100);
  });
});

describe("tagForScore", () => {
  it("maps score bands to the documented tags", () => {
    expect(tagForScore(80)).toBe("양호");
    expect(tagForScore(79.9)).toBe("주의");
    expect(tagForScore(60)).toBe("주의");
    expect(tagForScore(59.9)).toBe("개선 필요");
  });
});

describe("computeCompositeScore", () => {
  it("excludes unscored KPIs and renormalizes weights, reporting completeness", () => {
    const result = computeCompositeScore([
      { key: "a", weight: 25, score: 100 },
      { key: "b", weight: 20, score: null },
      { key: "c", weight: 20, score: 50 },
      { key: "d", weight: 15, score: null },
      { key: "e", weight: 20, score: 0 },
    ]);
    // usable weight = 25+20+20 = 65 of 100 total.
    expect(result.dataCompleteness).toBe(65);
    expect(result.score).toBeCloseTo((100 * 25 + 50 * 20 + 0 * 20) / 65);
  });

  it("returns null score with 0% completeness when nothing is scoreable", () => {
    const result = computeCompositeScore([
      { key: "a", weight: 25, score: null },
      { key: "b", weight: 20, score: null },
    ]);
    expect(result.score).toBeNull();
    expect(result.dataCompleteness).toBe(0);
  });
});

describe("period utilities", () => {
  it("computes the immediately preceding period of equal length", () => {
    const prev = previousPeriod({ start: "2026-06-01", end: "2026-06-30" });
    expect(prev).toEqual({ start: "2026-05-02", end: "2026-05-31" });
    expect(daysInRange(prev)).toBe(daysInRange({ start: "2026-06-01", end: "2026-06-30" }));
  });

  it("clamps a requested range to what's actually available", () => {
    const available = { start: "2026-04-01", end: "2026-07-29" };
    expect(clampToAvailable({ start: "2026-03-01", end: "2026-04-15" }, available)).toEqual({
      start: "2026-04-01",
      end: "2026-04-15",
    });
    expect(clampToAvailable({ start: "2026-01-01", end: "2026-02-01" }, available)).toBeNull();
  });

  it("defaults to the last 30 available days, not a fixed calendar window", () => {
    const available = { start: "2026-04-01", end: "2026-07-29" };
    const range = defaultRecentPeriod(available, 30);
    expect(range.end).toBe("2026-07-29");
    expect(daysInRange(range)).toBe(30);

    // A short data history shouldn't be padded past what's available.
    const shortAvailable = { start: "2026-07-20", end: "2026-07-29" };
    const shortRange = defaultRecentPeriod(shortAvailable, 30);
    expect(shortRange).toEqual(shortAvailable);
  });

  it("isWithinRange is inclusive on both ends", () => {
    const range = { start: "2026-06-01", end: "2026-06-30" };
    expect(isWithinRange("2026-06-01", range)).toBe(true);
    expect(isWithinRange("2026-06-30", range)).toBe(true);
    expect(isWithinRange("2026-05-31", range)).toBe(false);
    expect(isWithinRange("2026-07-01", range)).toBe(false);
  });
});
