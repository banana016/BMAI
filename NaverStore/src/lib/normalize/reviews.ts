import * as XLSX from "xlsx";
import type { NormalizedReviewRow } from "@/types/normalized";
import { SHEET_CONFIGS } from "../workbook/sheet-config";
import { findSheetByName, locateSheet, resolveColumnIndex, rowHasContent } from "../workbook/sheet-rows";
import { parseFlexibleDateCell } from "../workbook/date-utils";
import { parseMoney, parseText } from "./number";

const CONFIG = SHEET_CONFIGS.find((c) => c.key === "reviews")!;

export interface NormalizeReviewsResult {
  rows: NormalizedReviewRow[];
  warnings: string[];
}

/**
 * 등록자(reviewer handle) and 상품주문번호(order number) exist in the raw
 * sheet but are never read into NormalizedReviewRow — they don't reach the
 * normalized model or anything downstream of it (design doc 2.7).
 */
export function normalizeReviewRows(workbook: XLSX.WorkBook): NormalizeReviewsResult {
  const sheetName = findSheetByName(workbook, CONFIG.expectedName);
  if (!sheetName) return { rows: [], warnings: [`"${CONFIG.expectedName}" 시트를 찾을 수 없습니다.`] };

  const located = locateSheet(workbook.Sheets[sheetName], CONFIG);
  if (!located) return { rows: [], warnings: [`${CONFIG.expectedName}: 헤더를 찾을 수 없습니다.`] };

  const { headerRow, dataRows, warnings } = located;
  const col = (name: string) => resolveColumnIndex(headerRow, name)?.index ?? -1;
  const idx = {
    productId: col("상품번호"),
    productName: col("상품명"),
    rating: col("구매자평점"),
    photo: col("포토/영상"),
    content: col("리뷰상세내용"),
    helpfulCount: col("리뷰도움수"),
    reviewDate: col("리뷰등록일"),
    hasReply: col("답글여부"),
    replyDate: col("답글등록일시"),
  };

  const rows: NormalizedReviewRow[] = [];
  for (const row of dataRows) {
    if (!rowHasContent(row)) continue;

    rows.push({
      productId: String(row[idx.productId] ?? "").trim(),
      productName: String(row[idx.productName] ?? "").trim(),
      rating: parseMoney(row[idx.rating]),
      hasPhoto: parseText(row[idx.photo]) !== null,
      content: parseText(row[idx.content]),
      helpfulCount: parseMoney(row[idx.helpfulCount]),
      reviewDate: parseFlexibleDateCell(row[idx.reviewDate])?.iso ?? null,
      hasReply: parseText(row[idx.hasReply]) === "Y",
      replyDate: parseFlexibleDateCell(row[idx.replyDate])?.iso ?? null,
    });
  }

  return { rows, warnings };
}
