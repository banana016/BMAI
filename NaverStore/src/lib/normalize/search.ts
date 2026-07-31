import * as XLSX from "xlsx";
import type { NormalizedSearchRow } from "@/types/normalized";
import { SHEET_CONFIGS } from "../workbook/sheet-config";
import { columnIndex, findSheetByName, locateSheet, rowHasContent } from "../workbook/sheet-rows";
import { parseFlexibleDateCell } from "../workbook/date-utils";
import { parseMoney, parsePercentToRatio } from "./number";

const CONFIG = SHEET_CONFIGS.find((c) => c.key === "search")!;

export interface NormalizeSearchResult {
  rows: NormalizedSearchRow[];
  warnings: string[];
}

export function normalizeSearchRows(workbook: XLSX.WorkBook): NormalizeSearchResult {
  const sheetName = findSheetByName(workbook, CONFIG.expectedName);
  if (!sheetName) return { rows: [], warnings: [`"${CONFIG.expectedName}" 시트를 찾을 수 없습니다.`] };

  const located = locateSheet(workbook.Sheets[sheetName], CONFIG);
  if (!located) return { rows: [], warnings: [`${CONFIG.expectedName}: 헤더를 찾을 수 없습니다.`] };

  const { headerRow, dataRows, warnings } = located;
  const col = (name: string) => columnIndex(headerRow, name);
  const idx = {
    date: col("날짜"),
    query: col("검색어"),
    visits: col("방문수"),
    orders: col("상품결제건수"),
    conversionRate: col("구매전환율"),
    sales: col("판매금액(총)"),
    aov: col("상품결제단가"),
  };

  const rows: NormalizedSearchRow[] = [];
  for (const row of dataRows) {
    if (!rowHasContent(row)) continue;
    const parsedDate = parseFlexibleDateCell(row[idx.date]);
    if (!parsedDate) continue;

    rows.push({
      date: parsedDate.iso,
      query: String(row[idx.query] ?? "").trim(),
      visits: parseMoney(row[idx.visits]),
      orders: parseMoney(row[idx.orders]),
      conversionRate: parsePercentToRatio(row[idx.conversionRate]),
      sales: parseMoney(row[idx.sales]),
      aov: parseMoney(row[idx.aov]),
    });
  }

  return { rows, warnings };
}

/** "전체" is the search channel's daily total, not a keyword — exclude it from keyword rankings (design doc 2.5). */
export function filterKeywordRows(rows: NormalizedSearchRow[]): NormalizedSearchRow[] {
  return rows.filter((r) => r.query !== "전체");
}

export interface KeywordRanking {
  query: string;
  visits: number;
  orders: number;
  conversionRate: number;
}

/**
 * Aggregates keyword rows across the period and ranks by conversion rate.
 * A minimum visit floor keeps a keyword with e.g. 1 visit / 1 order (100%
 * conversion) from outranking keywords with real volume (design doc 2.5).
 */
export function rankKeywordsByConversion(rows: NormalizedSearchRow[], minVisits = 10): KeywordRanking[] {
  const totals = new Map<string, { visits: number; orders: number }>();
  for (const row of filterKeywordRows(rows)) {
    const existing = totals.get(row.query) ?? { visits: 0, orders: 0 };
    existing.visits += row.visits ?? 0;
    existing.orders += row.orders ?? 0;
    totals.set(row.query, existing);
  }
  return [...totals.entries()]
    .filter(([, t]) => t.visits >= minVisits)
    .map(([query, t]) => ({
      query,
      visits: t.visits,
      orders: t.orders,
      conversionRate: t.visits > 0 ? t.orders / t.visits : 0,
    }))
    .sort((a, b) => b.conversionRate - a.conversionRate);
}
