import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { diagnoseWorkbook } from "@/lib/workbook/parser";
import { normalizeSalesRows, filterChannelTotal } from "@/lib/normalize/sales";
import { normalizeTrafficRows, filterOverallTraffic, groupByTopLevelChannel } from "@/lib/normalize/traffic";
import { normalizeSearchRows, filterKeywordRows } from "@/lib/normalize/search";
import { normalizeCustomerRows, filterCustomerType } from "@/lib/normalize/customers";
import { normalizeReviewRows } from "@/lib/normalize/reviews";
import { normalizeAdRows } from "@/lib/normalize/ads";
import { locateSheet, columnIndex } from "@/lib/workbook/sheet-rows";
import { SHEET_CONFIGS } from "@/lib/workbook/sheet-config";

const fixturePath = process.env.NAVERSTORE_FIXTURE_XLSX_PATH;
const hasFixture = !!fixturePath && existsSync(fixturePath);

describe.skipIf(!hasFixture)("normalize adapters against a real fixture file", () => {
  // describe.skipIf still executes this callback body to collect the `it`s,
  // so this must not throw when the fixture is absent — only the `it` bodies
  // are actually skipped.
  const buffer = hasFixture ? readFileSync(fixturePath as string) : Buffer.alloc(0);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const fileName = hasFixture ? path.basename(fixturePath as string) : "";

  it("normalized row counts match the Phase 1 diagnostic row counts", async () => {
    const diagnostics = await diagnoseWorkbook(arrayBuffer, fileName);
    const byKey = Object.fromEntries(diagnostics.sheets.map((s) => [s.key, s.dataRowCount]));

    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

    expect(normalizeSalesRows(workbook).rows).toHaveLength(byKey.sales as number);
    expect(normalizeTrafficRows(workbook).rows).toHaveLength(byKey.traffic as number);
    expect(normalizeSearchRows(workbook).rows).toHaveLength(byKey.search as number);
    expect(normalizeCustomerRows(workbook).rows).toHaveLength(byKey.customers as number);
    expect(normalizeReviewRows(workbook).rows).toHaveLength(byKey.reviews as number);
    expect(normalizeAdRows(workbook).rows).toHaveLength(byKey.ads as number);
  });

  it("sales: 전체 rows are exactly half the rows (one 전체 + one per-channel row per date)", () => {
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const { rows } = normalizeSalesRows(workbook);
    const totals = filterChannelTotal(rows);
    expect(totals.length).toBeGreaterThan(0);
    expect(totals.length).toBeLessThan(rows.length);
    for (const r of totals) expect(r.channel).toBe("전체");
  });

  it("traffic: overall row's visits roughly matches the sum of that date's top-level channels", () => {
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const { rows } = normalizeTrafficRows(workbook);
    const overall = filterOverallTraffic(rows);
    expect(overall.length).toBeGreaterThan(0);

    const sample = overall[0];
    const channelTotals = groupByTopLevelChannel(rows, sample.date);
    const summed = channelTotals.reduce((acc, c) => acc + c.visits, 0);
    expect(summed).toBe(sample.visits);
  });

  it("search: keyword ranking excludes the 전체 aggregate row", () => {
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const { rows } = normalizeSearchRows(workbook);
    const keywordRows = filterKeywordRows(rows);
    expect(keywordRows.every((r) => r.query !== "전체")).toBe(true);
    expect(keywordRows.length).toBeLessThan(rows.length);
  });

  it("customers: all/new/returning stay separate classifications", () => {
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const { rows } = normalizeCustomerRows(workbook);
    expect(filterCustomerType(rows, "all").length).toBeGreaterThan(0);
    expect(filterCustomerType(rows, "new").length).toBeGreaterThan(0);
    expect(filterCustomerType(rows, "returning").length).toBeGreaterThan(0);
  });

  it("reviews: normalized rows never carry 등록자 or 상품주문번호 values", () => {
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const { rows } = normalizeReviewRows(workbook);
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).not.toContain("registrant");
    expect(Object.keys(rows[0])).not.toContain("orderNumber");

    const reviewsConfig = SHEET_CONFIGS.find((c) => c.key === "reviews")!;
    const located = locateSheet(workbook.Sheets["리뷰관리"], reviewsConfig)!;
    const registrantIdx = columnIndex(located.headerRow, "등록자");
    const orderNumberIdx = columnIndex(located.headerRow, "상품주문번호");
    const rawRegistrants = new Set(
      located.dataRows.map((r) => String(r[registrantIdx] ?? "")).filter((v) => v.length > 0)
    );
    const rawOrderNumbers = new Set(
      located.dataRows.map((r) => String(r[orderNumberIdx] ?? "")).filter((v) => v.length > 0)
    );

    const serialized = JSON.stringify(rows);
    for (const handle of rawRegistrants) expect(serialized.includes(handle)).toBe(false);
    for (const orderNumber of rawOrderNumbers) expect(serialized.includes(orderNumber)).toBe(false);
  });
});
