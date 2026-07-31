import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import * as XLSX from "xlsx";
import { normalizeSalesRows } from "@/lib/normalize/sales";
import { normalizeAdRows } from "@/lib/normalize/ads";
import { buildDashboardSummary } from "@/lib/scoring/dashboard";

const fixturePath = process.env.NAVERSTORE_FIXTURE_XLSX_PATH;
const hasFixture = !!fixturePath && existsSync(fixturePath);

/**
 * Golden values below were independently hand-summed from the same real
 * fixture file (SUM over 판매분석 채널=전체 rows / 광고관리 rows for
 * 2026-06-01..2026-06-30) outside of buildDashboardSummary, to catch any
 * regression in the aggregation formulas rather than just re-deriving them.
 */
describe.skipIf(!hasFixture)("buildDashboardSummary manual reconciliation against a real fixture file", () => {
  it("matches independently hand-summed totals for 2026-06", () => {
    const buffer = hasFixture ? readFileSync(fixturePath as string) : Buffer.alloc(0);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

    const { rows: salesRows } = normalizeSalesRows(workbook);
    const { rows: adRows } = normalizeAdRows(workbook);

    const range = { start: "2026-06-01", end: "2026-06-30" };
    const summary = buildDashboardSummary(salesRows, adRows, range);

    expect(summary.previousRange).toEqual({ start: "2026-05-02", end: "2026-05-31" });

    const byKey = Object.fromEntries(summary.kpis.map((k) => [k.key, k]));
    expect(byKey.netSales.current).toBe(16_999_560);
    expect(byKey.traffic.current).toBe(10_179);
    expect(byKey.conversionRate.current).toBeCloseTo(983 / 10_179);
    expect(byKey.aov.current).toBeCloseTo(18_117_740 / 983);
    expect(byKey.purchaseRoas.current).toBeCloseTo((11_628_940 / 5_615_586) * 100);

    // No targets supplied, so only the trend component (35/35 = 100%) scores each KPI.
    for (const kpi of summary.kpis) {
      expect(kpi.score).not.toBeNull();
    }
    expect(summary.dataCompleteness).toBe(100);
  });
});
