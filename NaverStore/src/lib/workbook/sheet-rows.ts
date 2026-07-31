import * as XLSX from "xlsx";
import { rowMatchesHeaderTokens, type SheetConfig } from "./sheet-config";

export type AoaRow = unknown[];

export function rowHasContent(row: AoaRow | undefined): boolean {
  return !!row && row.some((c) => c !== null && c !== undefined && String(c).trim() !== "");
}

export function findSheetByName(workbook: XLSX.WorkBook, expectedName: string): string | undefined {
  const normalizedTarget = expectedName.normalize("NFC");
  return workbook.SheetNames.find((n) => n.normalize("NFC") === normalizedTarget);
}

export function sheetToAoa(ws: XLSX.WorkSheet): AoaRow[] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as AoaRow[];
}

/**
 * SheetJS trims the exported array-of-arrays to the sheet's used range, so
 * aoa[0] is not necessarily spreadsheet row 1 — it's whatever row the used
 * range actually starts at (often the header itself, or one description row
 * above it). This is the 0-indexed spreadsheet row that aoa[0] corresponds to.
 */
export function sheetRowOffset(ws: XLSX.WorkSheet): number {
  return ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"] as string).s.r : 0;
}

export function lastContentRowIndex(aoa: AoaRow[], fromIndex: number): number {
  let last = fromIndex;
  for (let i = fromIndex + 1; i < aoa.length; i++) {
    if (rowHasContent(aoa[i])) last = i;
  }
  return last;
}

export function columnIndex(headerRow: AoaRow, headerText: string): number {
  return headerRow.findIndex((c) => String(c ?? "").trim() === headerText);
}

export interface HeaderLocation {
  rowIndex: number | null;
  isFallback: boolean;
  warnings: string[];
}

const HEADER_SCAN_FALLBACK_ROWS = 60;

export function locateHeaderRow(aoa: AoaRow[], config: SheetConfig, rowOffset: number): HeaderLocation {
  const warnings: string[] = [];

  const fastIdx = config.expectedHeaderRow - 1 - rowOffset;
  if (fastIdx >= 0) {
    const fastMatch = rowMatchesHeaderTokens(aoa[fastIdx], config.headerTokens, config.matchThreshold);
    if (fastMatch.matches) {
      return { rowIndex: fastIdx, isFallback: false, warnings };
    }
  }

  const [start, end] = config.headerSearchWindow;
  const windowStart = Math.max(0, start - 1 - rowOffset);
  const windowEnd = Math.min(end - 1 - rowOffset, aoa.length - 1, HEADER_SCAN_FALLBACK_ROWS - 1);
  for (let r = windowStart; r <= windowEnd; r++) {
    if (r === fastIdx) continue;
    const match = rowMatchesHeaderTokens(aoa[r], config.headerTokens, config.matchThreshold);
    if (match.matches) {
      warnings.push(
        `${config.expectedName}: 예상 헤더 행(${config.expectedHeaderRow})이 아닌 ${r + rowOffset + 1}행에서 헤더를 찾았습니다.`
      );
      return { rowIndex: r, isFallback: true, warnings };
    }
  }

  // Last resort: the used range often starts right at (or just above) the
  // header, so scan from the very top of the sheet's data regardless of the
  // configured window.
  const wideEnd = Math.min(HEADER_SCAN_FALLBACK_ROWS - 1, aoa.length - 1);
  for (let r = 0; r <= wideEnd; r++) {
    if (r === fastIdx || (r >= windowStart && r <= windowEnd)) continue;
    const match = rowMatchesHeaderTokens(aoa[r], config.headerTokens, config.matchThreshold);
    if (match.matches) {
      warnings.push(
        `${config.expectedName}: 예상 헤더 행(${config.expectedHeaderRow})이 아닌 ${r + rowOffset + 1}행에서 헤더를 찾았습니다.`
      );
      return { rowIndex: r, isFallback: true, warnings };
    }
  }

  if (fastIdx >= 0 && rowHasContent(aoa[fastIdx])) {
    warnings.push(
      `${config.expectedName}: 헤더 문자열을 확인하지 못해 기본 헤더 행(${config.expectedHeaderRow})을 그대로 사용합니다.`
    );
    return { rowIndex: fastIdx, isFallback: true, warnings };
  }

  if (rowHasContent(aoa[0])) {
    warnings.push(`${config.expectedName}: 헤더 문자열을 확인하지 못해 시트의 첫 데이터 행을 헤더로 간주합니다.`);
    return { rowIndex: 0, isFallback: true, warnings };
  }

  return {
    rowIndex: null,
    isFallback: true,
    warnings: [`${config.expectedName}: 헤더 행을 찾을 수 없습니다 (예상: ${config.expectedHeaderRow}행 부근).`],
  };
}

export interface LocatedSheet {
  aoa: AoaRow[];
  rowOffset: number;
  headerRowIndex: number;
  headerRow: AoaRow;
  /** Data rows trimmed to the last row with any content (no trailing blanks). */
  dataRows: AoaRow[];
  headerRowIsFallback: boolean;
  warnings: string[];
}

/** Locates the header row and returns it together with the trimmed data rows below it. */
export function locateSheet(ws: XLSX.WorkSheet, config: SheetConfig): LocatedSheet | null {
  const aoa = sheetToAoa(ws);
  const rowOffset = sheetRowOffset(ws);
  const loc = locateHeaderRow(aoa, config, rowOffset);
  if (loc.rowIndex === null) return null;

  const headerRowIndex = loc.rowIndex;
  const lastRowIndex = lastContentRowIndex(aoa, headerRowIndex);

  return {
    aoa,
    rowOffset,
    headerRowIndex,
    headerRow: aoa[headerRowIndex] ?? [],
    dataRows: aoa.slice(headerRowIndex + 1, lastRowIndex + 1),
    headerRowIsFallback: loc.isFallback,
    warnings: loc.warnings,
  };
}
