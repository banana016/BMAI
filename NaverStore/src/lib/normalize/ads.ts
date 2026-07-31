import * as XLSX from "xlsx";
import type { NormalizedAdRow } from "@/types/normalized";
import { SHEET_CONFIGS } from "../workbook/sheet-config";
import { findSheetByName, locateSheet, resolveColumnIndex, rowHasContent } from "../workbook/sheet-rows";
import { parseFlexibleDateCell } from "../workbook/date-utils";
import { parseMoney, parsePercentToRatio } from "./number";

const CONFIG = SHEET_CONFIGS.find((c) => c.key === "ads")!;

export interface NormalizeAdsResult {
  rows: NormalizedAdRow[];
  warnings: string[];
}

export function normalizeAdRows(workbook: XLSX.WorkBook): NormalizeAdsResult {
  const sheetName = findSheetByName(workbook, CONFIG.expectedName);
  if (!sheetName) return { rows: [], warnings: [`"${CONFIG.expectedName}" 시트를 찾을 수 없습니다.`] };

  const located = locateSheet(workbook.Sheets[sheetName], CONFIG);
  if (!located) return { rows: [], warnings: [`${CONFIG.expectedName}: 헤더를 찾을 수 없습니다.`] };

  const { headerRow, dataRows, warnings } = located;
  const col = (name: string) => resolveColumnIndex(headerRow, name)?.index ?? -1;
  const idx = {
    date: col("일별"),
    impressions: col("노출수"),
    clicks: col("클릭수"),
    ctr: col("클릭률(%)"),
    avgCpc: col("평균 CPC"),
    cost: col("총비용"),
    totalConversions: col("총 전환수"),
    directConversions: col("직접전환수"),
    indirectConversions: col("간접전환수"),
    totalConversionRate: col("총 전환율(%)"),
    totalConversionSales: col("총 전환매출액(원)"),
    directConversionSales: col("직접전환매출액(원)"),
    indirectConversionSales: col("간접전환매출액(원)"),
    totalCostPerConversion: col("총 전환당비용(원)"),
    totalRoas: col("총 광고수익률(%)"),
    purchaseConversions: col("구매완료 전환수"),
    purchaseConversionSales: col("구매완료 전환매출액(원)"),
    purchaseRoas: col("구매완료 광고수익률(%)"),
  };

  const rows: NormalizedAdRow[] = [];
  for (const row of dataRows) {
    if (!rowHasContent(row)) continue;
    const parsedDate = parseFlexibleDateCell(row[idx.date]);
    if (!parsedDate) continue;

    rows.push({
      date: parsedDate.iso,
      impressions: parseMoney(row[idx.impressions]),
      clicks: parseMoney(row[idx.clicks]),
      ctr: parsePercentToRatio(row[idx.ctr]),
      avgCpc: parseMoney(row[idx.avgCpc]),
      cost: parseMoney(row[idx.cost]),
      totalConversions: parseMoney(row[idx.totalConversions]),
      directConversions: parseMoney(row[idx.directConversions]),
      indirectConversions: parseMoney(row[idx.indirectConversions]),
      totalConversionRate: parsePercentToRatio(row[idx.totalConversionRate]),
      totalConversionSales: parseMoney(row[idx.totalConversionSales]),
      directConversionSales: parseMoney(row[idx.directConversionSales]),
      indirectConversionSales: parseMoney(row[idx.indirectConversionSales]),
      totalCostPerConversion: parseMoney(row[idx.totalCostPerConversion]),
      totalRoas: parsePercentToRatio(row[idx.totalRoas]),
      purchaseConversions: parseMoney(row[idx.purchaseConversions]),
      purchaseConversionSales: parseMoney(row[idx.purchaseConversionSales]),
      purchaseRoas: parsePercentToRatio(row[idx.purchaseRoas]),
    });
  }

  return { rows, warnings };
}
