import { describe, expect, it } from "vitest";
import {
  buildAnonymizedWorkbook,
  workbookToArrayBuffer,
  FIXTURE_FILE_NAME,
  FIXTURE_STORE_NAME,
  FIXTURE_STORE_URL,
  FIXTURE_SALES_START,
  FIXTURE_SALES_END,
  FIXTURE_SALES_DAYS,
} from "./fixtures/anonymized-workbook";
import { diagnoseWorkbook } from "@/lib/workbook/parser";
import { normalizeSalesRows, filterChannelTotal } from "@/lib/normalize/sales";
import { normalizeTrafficRows, filterOverallTraffic, groupByTopLevelChannel } from "@/lib/normalize/traffic";
import { normalizeSearchRows, filterKeywordRows } from "@/lib/normalize/search";
import { normalizeCustomerRows } from "@/lib/normalize/customers";
import { normalizeReviewRows } from "@/lib/normalize/reviews";
import { normalizeAdRows } from "@/lib/normalize/ads";
import { buildDashboardSummary } from "@/lib/scoring/dashboard";
import { buildInsightContext } from "@/lib/insights/context";
import { generateInsights } from "@/lib/insights/rules";
import { computeScenario, scenarioFromBaseline } from "@/lib/simulation/scenario";
import { buildRoadmap } from "@/lib/simulation/roadmap";

/**
 * This suite runs unconditionally in every environment (including CI) —
 * unlike the *.real-fixture.test.ts files, it never depends on
 * NAVERSTORE_FIXTURE_XLSX_PATH or a real customer file. It exercises the
 * full pipeline end-to-end against a fully fabricated, realistic-scale
 * workbook, catching structural regressions that small synthetic unit tests
 * might miss (e.g. row-count drift, dedup invariants breaking at scale).
 */
describe("Phase 1-6 pipeline against the always-on anonymized fixture", () => {
  const wb = buildAnonymizedWorkbook();
  const arrayBuffer = workbookToArrayBuffer(wb);

  it("Phase 1: diagnoses the workbook cleanly with no errors or warnings", async () => {
    const result = await diagnoseWorkbook(arrayBuffer, FIXTURE_FILE_NAME);
    expect(result.overallStatus).toBe("success");
    expect(result.storeName).toBe(FIXTURE_STORE_NAME);
    expect(result.overview?.storeUrl).toBe(FIXTURE_STORE_URL);
    expect(result.sheets).toHaveLength(6);
    for (const sheet of result.sheets) {
      expect(sheet.found).toBe(true);
      expect(sheet.errors).toEqual([]);
    }
    const sales = result.sheets.find((s) => s.key === "sales")!;
    expect(sales.dataRowCount).toBe(FIXTURE_SALES_DAYS * 2);
    expect(sales.dateRange).toEqual({ min: FIXTURE_SALES_START, max: FIXTURE_SALES_END });
  });

  it("Phase 2: normalized row counts match Phase 1 diagnostics for every sheet", async () => {
    const diagnostics = await diagnoseWorkbook(arrayBuffer, FIXTURE_FILE_NAME);
    const byKey = Object.fromEntries(diagnostics.sheets.map((s) => [s.key, s.dataRowCount]));
    const freshWb = buildAnonymizedWorkbook();

    expect(normalizeSalesRows(freshWb).rows).toHaveLength(byKey.sales as number);
    expect(normalizeTrafficRows(freshWb).rows).toHaveLength(byKey.traffic as number);
    expect(normalizeSearchRows(freshWb).rows).toHaveLength(byKey.search as number);
    expect(normalizeCustomerRows(freshWb).rows).toHaveLength(byKey.customers as number);
    expect(normalizeReviewRows(freshWb).rows).toHaveLength(byKey.reviews as number);
    expect(normalizeAdRows(freshWb).rows).toHaveLength(byKey.ads as number);
  });

  it("Phase 2/4: dedup invariants hold at this larger scale", () => {
    const salesRows = normalizeSalesRows(wb).rows;
    const totals = filterChannelTotal(salesRows);
    expect(totals).toHaveLength(FIXTURE_SALES_DAYS);

    const trafficRows = normalizeTrafficRows(wb).rows;
    const overall = filterOverallTraffic(trafficRows);
    expect(overall).toHaveLength(FIXTURE_SALES_DAYS);
    const sampleDate = overall[10].date;
    const channelSum = groupByTopLevelChannel(trafficRows, sampleDate).reduce((s, c) => s + c.visits, 0);
    const overallVisits = overall.find((r) => r.date === sampleDate)!.visits;
    expect(channelSum).toBe(overallVisits);

    const searchRows = normalizeSearchRows(wb).rows;
    expect(filterKeywordRows(searchRows).every((r) => r.query !== "전체")).toBe(true);
  });

  it("Phase 3: buildDashboardSummary computes a full KPI summary without error", () => {
    const salesRows = normalizeSalesRows(wb).rows;
    const adRows = normalizeAdRows(wb).rows;
    const range = { start: FIXTURE_SALES_START, end: FIXTURE_SALES_END };
    const summary = buildDashboardSummary(salesRows, adRows, range);

    expect(summary.kpis).toHaveLength(5);
    for (const kpi of summary.kpis) {
      expect(kpi.current).not.toBeNull();
    }
    expect(summary.dataCompleteness).toBeGreaterThanOrEqual(0);
  });

  it("Phase 5: the insight engine runs end-to-end and returns well-formed, priority-sorted insights", () => {
    const salesRows = normalizeSalesRows(wb).rows;
    const adRows = normalizeAdRows(wb).rows;
    const customerRows = normalizeCustomerRows(wb).rows;
    const reviewRows = normalizeReviewRows(wb).rows;
    const range = { start: FIXTURE_SALES_START, end: FIXTURE_SALES_END };
    const summary = buildDashboardSummary(salesRows, adRows, range);

    const ctx = buildInsightContext(summary, adRows, customerRows, reviewRows);
    const insights = generateInsights(ctx);
    for (let i = 1; i < insights.length; i++) {
      expect(insights[i - 1].priority).toBeGreaterThanOrEqual(insights[i].priority);
    }
    for (const insight of insights) {
      expect(insight.evidence.length).toBeGreaterThan(0);
    }
  });

  it("Phase 6: the scenario simulator and roadmap compute from real pipeline output", () => {
    const salesRows = normalizeSalesRows(wb).rows;
    const adRows = normalizeAdRows(wb).rows;
    const customerRows = normalizeCustomerRows(wb).rows;
    const reviewRows = normalizeReviewRows(wb).rows;
    const range = { start: FIXTURE_SALES_START, end: FIXTURE_SALES_END };
    const summary = buildDashboardSummary(salesRows, adRows, range);
    const ctx = buildInsightContext(summary, adRows, customerRows, reviewRows);
    const insights = generateInsights(ctx);

    const byKey = Object.fromEntries(summary.kpis.map((k) => [k.key, k]));
    const baseline = {
      traffic: byKey.traffic.current ?? 0,
      conversionRate: byKey.conversionRate.current ?? 0,
      aov: byKey.aov.current ?? 0,
      currentSales: byKey.netSales.current ?? 0,
      adCost: ctx.adFunnelCurrent.cost ?? 0,
      roas: ctx.adFunnelCurrent.purchaseRoas ?? 0,
    };
    const scenario = computeScenario(baseline, scenarioFromBaseline(baseline));
    expect(Number.isFinite(scenario.projectedSales)).toBe(true);
    expect(Number.isFinite(scenario.projectedIncrementalSales)).toBe(true);

    const roadmap = buildRoadmap(insights);
    if (insights.length > 0) {
      expect(roadmap).toHaveLength(3);
    }
  });

  it("Phase 2/4: no fabricated reviewer handle or order number ever reaches normalized output", () => {
    const reviewRows = normalizeReviewRows(wb).rows;
    const serialized = JSON.stringify(reviewRows);
    expect(serialized.includes("fakeuser")).toBe(false);
    expect(serialized.includes("TEST-ORDER-")).toBe(false);
  });
});
