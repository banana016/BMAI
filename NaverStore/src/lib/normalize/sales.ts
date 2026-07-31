import * as XLSX from "xlsx";
import type { NormalizedSalesRow } from "@/types/normalized";
import { SHEET_CONFIGS } from "../workbook/sheet-config";
import { findSheetByName, locateSheet, resolveColumnIndex, rowHasContent } from "../workbook/sheet-rows";
import { parseFlexibleDateCell } from "../workbook/date-utils";
import { parseMoney, parsePercentToRatio } from "./number";

const CONFIG = SHEET_CONFIGS.find((c) => c.key === "sales")!;

export interface NormalizeSalesResult {
  rows: NormalizedSalesRow[];
  warnings: string[];
}

export function normalizeSalesRows(workbook: XLSX.WorkBook): NormalizeSalesResult {
  const sheetName = findSheetByName(workbook, CONFIG.expectedName);
  if (!sheetName) return { rows: [], warnings: [`"${CONFIG.expectedName}" 시트를 찾을 수 없습니다.`] };

  const located = locateSheet(workbook.Sheets[sheetName], CONFIG);
  if (!located) return { rows: [], warnings: [`${CONFIG.expectedName}: 헤더를 찾을 수 없습니다.`] };

  const { headerRow, dataRows, warnings } = located;
  const col = (name: string) => resolveColumnIndex(headerRow, name)?.index ?? -1;
  const idx = {
    date: col("날짜"),
    channel: col("채널"),
    orders: col("상품결제건수"),
    refunds: col("환불건수"),
    grossSales: col("판매금액(총)"),
    netSales: col("판매금액(순)"),
    aov: col("상품결제단가"),
    refundAmount: col("환불금액"),
    units: col("결제상품수량"),
    traffic: col("방문수"),
    conversionRate: col("구매전환율"),
    shipping: col("배송비"),
    totalDiscount: col("전체 할인액"),
    sellerProductDiscount: col("판매자 부담 상품할인액"),
    naverProductDiscount: col("네이버 부담 상품할인액"),
    sellerOrderDiscount: col("판매자 부담 주문할인액"),
    naverOrderDiscount: col("네이버 부담 주문할인액"),
  };

  const rows: NormalizedSalesRow[] = [];
  for (const row of dataRows) {
    if (!rowHasContent(row)) continue;
    const parsedDate = parseFlexibleDateCell(row[idx.date]);
    if (!parsedDate) continue;

    rows.push({
      date: parsedDate.iso,
      channel: String(row[idx.channel] ?? "").trim(),
      orders: parseMoney(row[idx.orders]),
      refunds: parseMoney(row[idx.refunds]),
      grossSales: parseMoney(row[idx.grossSales]),
      netSales: parseMoney(row[idx.netSales]),
      aov: parseMoney(row[idx.aov]),
      refundAmount: parseMoney(row[idx.refundAmount]),
      units: parseMoney(row[idx.units]),
      traffic: parseMoney(row[idx.traffic]),
      conversionRate: parsePercentToRatio(row[idx.conversionRate]),
      shipping: parseMoney(row[idx.shipping]),
      discounts: {
        totalDiscount: parseMoney(row[idx.totalDiscount]),
        sellerProductDiscount: parseMoney(row[idx.sellerProductDiscount]),
        naverProductDiscount: parseMoney(row[idx.naverProductDiscount]),
        sellerOrderDiscount: parseMoney(row[idx.sellerOrderDiscount]),
        naverOrderDiscount: parseMoney(row[idx.naverOrderDiscount]),
      },
    });
  }

  return { rows, warnings };
}

/**
 * 판매분석 carries one "전체" (store total) row and one per-channel row for
 * every date. KPI aggregation must only sum the "전체" rows — summing every
 * row double counts (design doc 2.3).
 */
export function filterChannelTotal(rows: NormalizedSalesRow[]): NormalizedSalesRow[] {
  return rows.filter((r) => r.channel === "전체");
}
