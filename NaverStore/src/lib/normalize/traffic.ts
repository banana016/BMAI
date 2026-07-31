import * as XLSX from "xlsx";
import type { NormalizedTrafficRow } from "@/types/normalized";
import { SHEET_CONFIGS } from "../workbook/sheet-config";
import { columnIndex, findSheetByName, locateSheet, rowHasContent } from "../workbook/sheet-rows";
import { parseFlexibleDateCell } from "../workbook/date-utils";
import { parseMoney, parsePercentToRatio, parseText } from "./number";

const CONFIG = SHEET_CONFIGS.find((c) => c.key === "traffic")!;

export interface NormalizeTrafficResult {
  rows: NormalizedTrafficRow[];
  warnings: string[];
}

export function normalizeTrafficRows(workbook: XLSX.WorkBook): NormalizeTrafficResult {
  const sheetName = findSheetByName(workbook, CONFIG.expectedName);
  if (!sheetName) return { rows: [], warnings: [`"${CONFIG.expectedName}" 시트를 찾을 수 없습니다.`] };

  const located = locateSheet(workbook.Sheets[sheetName], CONFIG);
  if (!located) return { rows: [], warnings: [`${CONFIG.expectedName}: 헤더를 찾을 수 없습니다.`] };

  const { headerRow, dataRows, warnings } = located;
  const col = (name: string) => columnIndex(headerRow, name);
  const idx = {
    date: col("날짜"),
    l1: col("경로(1단계)"),
    l2: col("경로(2단계)"),
    l3: col("경로(3단계)"),
    marketingLink: col("마케팅링크 여부"),
    visits: col("방문수"),
    orders: col("상품결제건수"),
    conversionRate: col("구매전환율"),
    sales: col("판매금액(총)"),
    aov: col("상품결제단가"),
  };

  const rows: NormalizedTrafficRow[] = [];
  for (const row of dataRows) {
    if (!rowHasContent(row)) continue;
    const parsedDate = parseFlexibleDateCell(row[idx.date]);
    if (!parsedDate) continue;

    const marketingRaw = parseText(row[idx.marketingLink]);
    rows.push({
      date: parsedDate.iso,
      sourceL1: String(row[idx.l1] ?? "").trim(),
      sourceL2: String(row[idx.l2] ?? "").trim(),
      sourceL3: String(row[idx.l3] ?? "").trim(),
      isMarketingLink: marketingRaw === null ? null : marketingRaw === "Y",
      visits: parseMoney(row[idx.visits]),
      orders: parseMoney(row[idx.orders]),
      conversionRate: parsePercentToRatio(row[idx.conversionRate]),
      sales: parseMoney(row[idx.sales]),
      aov: parseMoney(row[idx.aov]),
    });
  }

  return { rows, warnings };
}

/** The single (전체, 전체, 전체) row per date — the store's overall traffic total. */
export function filterOverallTraffic(rows: NormalizedTrafficRow[]): NormalizedTrafficRow[] {
  return rows.filter((r) => r.sourceL1 === "전체" && r.sourceL2 === "전체" && r.sourceL3 === "전체");
}

export interface ChannelTotals {
  sourceL1: string;
  visits: number;
  orders: number;
  sales: number;
}

/**
 * The workbook has no separate "L1 subtotal" row — every non-전체 row is a
 * leaf-level path breakdown. Channel-level totals must be built by summing
 * leaves that share the same 경로(1단계); summing a subset of sub-paths on
 * top of that would double count (design doc 2.4).
 */
export function groupByTopLevelChannel(rows: NormalizedTrafficRow[], date?: string): ChannelTotals[] {
  const leaves = rows.filter((r) => r.sourceL1 !== "전체" && (date === undefined || r.date === date));
  const totals = new Map<string, ChannelTotals>();
  for (const row of leaves) {
    const existing = totals.get(row.sourceL1) ?? { sourceL1: row.sourceL1, visits: 0, orders: 0, sales: 0 };
    existing.visits += row.visits ?? 0;
    existing.orders += row.orders ?? 0;
    existing.sales += row.sales ?? 0;
    totals.set(row.sourceL1, existing);
  }
  return [...totals.values()];
}
