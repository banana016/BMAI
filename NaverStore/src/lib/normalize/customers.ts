import * as XLSX from "xlsx";
import type { CustomerType, NormalizedCustomerRow } from "@/types/normalized";
import { SHEET_CONFIGS } from "../workbook/sheet-config";
import { findSheetByName, locateSheet, resolveColumnIndex, rowHasContent } from "../workbook/sheet-rows";
import { parseFlexibleDateCell } from "../workbook/date-utils";
import { parseMoney, parsePercentToRatio } from "./number";

const CONFIG = SHEET_CONFIGS.find((c) => c.key === "customers")!;

const CUSTOMER_TYPE_MAP: Record<string, CustomerType> = {
  전체합산: "all",
  신규: "new",
  재구매: "returning",
};

export interface NormalizeCustomersResult {
  rows: NormalizedCustomerRow[];
  warnings: string[];
}

export function normalizeCustomerRows(workbook: XLSX.WorkBook): NormalizeCustomersResult {
  const sheetName = findSheetByName(workbook, CONFIG.expectedName);
  if (!sheetName) return { rows: [], warnings: [`"${CONFIG.expectedName}" 시트를 찾을 수 없습니다.`] };

  const located = locateSheet(workbook.Sheets[sheetName], CONFIG);
  if (!located) return { rows: [], warnings: [`${CONFIG.expectedName}: 헤더를 찾을 수 없습니다.`] };

  const { headerRow, dataRows, warnings } = located;
  const col = (name: string) => resolveColumnIndex(headerRow, name)?.index ?? -1;
  const idx = {
    date: col("날짜"),
    type: col("고객분류"),
    visitors: col("방문고객수"),
    visitorsShare: col("방문고객수비중"),
    payers: col("결제고객수"),
    payersShare: col("결제고객수비중"),
    conversionRate: col("구매전환율(고객)"),
    sales: col("판매금액(총)"),
    salesShare: col("판매금액(총)비중"),
    aov: col("객단가"),
  };

  const rows: NormalizedCustomerRow[] = [];
  for (const row of dataRows) {
    if (!rowHasContent(row)) continue;
    const parsedDate = parseFlexibleDateCell(row[idx.date]);
    if (!parsedDate || !parsedDate.isoEnd) continue;

    const rawType = String(row[idx.type] ?? "").trim();
    const customerType = CUSTOMER_TYPE_MAP[rawType];
    if (!customerType) {
      warnings.push(`${CONFIG.expectedName}: 알 수 없는 고객분류 값 "${rawType}"을 건너뜁니다.`);
      continue;
    }

    rows.push({
      weekStart: parsedDate.iso,
      weekEnd: parsedDate.isoEnd,
      customerType,
      visitors: parseMoney(row[idx.visitors]),
      visitorsShare: parsePercentToRatio(row[idx.visitorsShare]),
      payers: parseMoney(row[idx.payers]),
      payersShare: parsePercentToRatio(row[idx.payersShare]),
      conversionRate: parsePercentToRatio(row[idx.conversionRate]),
      sales: parseMoney(row[idx.sales]),
      salesShare: parsePercentToRatio(row[idx.salesShare]),
      aov: parseMoney(row[idx.aov]),
    });
  }

  return { rows, warnings };
}

/**
 * "all" already includes both new and returning customers for that week —
 * never sum all three classifications together or new+returning double
 * counts against "all" (design doc 2.6).
 */
export function filterCustomerType(rows: NormalizedCustomerRow[], type: CustomerType): NormalizedCustomerRow[] {
  return rows.filter((r) => r.customerType === type);
}
