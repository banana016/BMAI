import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import * as XLSX from "xlsx";
import { normalizeTrafficRows } from "@/lib/normalize/traffic";
import { normalizeAdRows } from "@/lib/normalize/ads";
import { normalizeReviewRows } from "@/lib/normalize/reviews";
import { computeChannelBreakdown, computeDailyOverallTraffic } from "@/lib/analysis/traffic";
import { computeAdFunnel } from "@/lib/analysis/ads";
import { computeProductProblems } from "@/lib/analysis/reviews";

const fixturePath = process.env.NAVERSTORE_FIXTURE_XLSX_PATH;
const hasFixture = !!fixturePath && existsSync(fixturePath);

describe.skipIf(!hasFixture)("Phase 4 analysis against a real fixture file", () => {
  const buffer = hasFixture ? readFileSync(fixturePath as string) : Buffer.alloc(0);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const range = { start: "2026-06-01", end: "2026-06-30" };

  it("channel breakdown visits sum exactly matches the overall traffic total for the whole month", () => {
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const { rows } = normalizeTrafficRows(workbook);
    const channels = computeChannelBreakdown(rows, range);
    const overall = computeDailyOverallTraffic(rows, range);
    const channelVisits = channels.reduce((s, c) => s + c.visits, 0);
    const overallVisits = overall.reduce((s, d) => s + d.visits, 0);
    expect(channelVisits).toBe(overallVisits);
  });

  it("ad funnel matches the manually reconciled 2026-06 totals from the Phase 3 test", () => {
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const { rows } = normalizeAdRows(workbook);
    const funnel = computeAdFunnel(rows, range);
    expect(funnel.cost).toBe(5_615_586);
    expect(funnel.purchaseConversionSales).toBe(11_628_940);
    expect(funnel.purchaseRoas).toBeCloseTo((11_628_940 / 5_615_586) * 100);
  });

  it("product problem summaries never surface 등록자 or 상품주문번호 raw values", () => {
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const { rows } = normalizeReviewRows(workbook);
    const problems = computeProductProblems(rows, 2);
    expect(problems.length).toBeGreaterThan(0);
    expect(Object.keys(problems[0])).not.toContain("registrant");
    expect(Object.keys(problems[0])).not.toContain("orderNumber");
  });
});
