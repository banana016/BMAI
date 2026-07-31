import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import * as XLSX from "xlsx";
import { normalizeSalesRows } from "@/lib/normalize/sales";
import { normalizeAdRows } from "@/lib/normalize/ads";
import { normalizeCustomerRows } from "@/lib/normalize/customers";
import { normalizeReviewRows } from "@/lib/normalize/reviews";
import { buildDashboardSummary } from "@/lib/scoring/dashboard";
import { buildInsightContext } from "@/lib/insights/context";
import { generateInsights } from "@/lib/insights/rules";

const fixturePath = process.env.NAVERSTORE_FIXTURE_XLSX_PATH;
const hasFixture = !!fixturePath && existsSync(fixturePath);

describe.skipIf(!hasFixture)("generateInsights against a real fixture file", () => {
  it("runs end-to-end without error and produces well-formed insights", () => {
    const buffer = readFileSync(fixturePath as string);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

    const salesRows = normalizeSalesRows(workbook).rows;
    const adRows = normalizeAdRows(workbook).rows;
    const customerRows = normalizeCustomerRows(workbook).rows;
    const reviewRows = normalizeReviewRows(workbook).rows;

    const range = { start: "2026-06-01", end: "2026-06-30" };
    const summary = buildDashboardSummary(salesRows, adRows, range);
    const ctx = buildInsightContext(summary, adRows, customerRows, reviewRows);
    const insights = generateInsights(ctx);

    for (const insight of insights) {
      expect(insight.title.length).toBeGreaterThan(0);
      expect(insight.finding.length).toBeGreaterThan(0);
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.diagnosis.length).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(insight.confidence);
      expect(Number.isFinite(insight.priority)).toBe(true);
      // No fabricated numbers: every evidence value must be a finite number.
      for (const e of insight.evidence) {
        expect(Number.isFinite(e.current)).toBe(true);
        if (e.comparison !== undefined) expect(Number.isFinite(e.comparison)).toBe(true);
      }
    }

    for (let i = 1; i < insights.length; i++) {
      expect(insights[i - 1].priority).toBeGreaterThanOrEqual(insights[i].priority);
    }
  });
});
