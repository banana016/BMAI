import * as XLSX from "xlsx";
import type {
  DiagnosticSeverity,
  SheetDiagnostic,
  StoreOverview,
  WorkbookDiagnosticsResult,
} from "@/types/workbook";
import { extractStoreNameFromFileName } from "./file-name";
import { OVERVIEW_SHEET_NAME, SHEET_CONFIGS, normalizeHeaderCell, type SheetConfig } from "./sheet-config";
import { DateRangeAccumulator, parseFlexibleDateCell } from "./date-utils";
import { extractOverviewImages } from "./image-extractor";
import { findSheetByName, locateSheet, type AoaRow } from "./sheet-rows";

function locateDateColumnIndex(
  headerRow: AoaRow,
  dataRows: AoaRow[],
  candidates: string[]
): { index: number | null } {
  for (const candidate of candidates) {
    const idx = headerRow.findIndex((c) => normalizeHeaderCell(c) === candidate);
    if (idx !== -1) return { index: idx };
  }

  const sampleRows = dataRows.slice(0, 30);
  const colCount = Math.max(headerRow.length, ...sampleRows.map((r) => r.length), 0);
  for (let c = 0; c < colCount; c++) {
    let matches = 0;
    let total = 0;
    for (const row of sampleRows) {
      const cell = row?.[c];
      if (cell === null || cell === undefined || String(cell).trim() === "") continue;
      total++;
      if (parseFlexibleDateCell(cell)) matches++;
    }
    if (total > 0 && matches / total >= 0.6) return { index: c };
  }
  return { index: null };
}

function diagnoseSheet(ws: XLSX.WorkSheet, config: SheetConfig): SheetDiagnostic {
  const errors: string[] = [];
  const located = locateSheet(ws, config);

  if (located === null) {
    errors.push(`${config.expectedName} 시트에서 헤더를 확인할 수 없습니다.`);
    return {
      key: config.key,
      expectedName: config.expectedName,
      found: true,
      headerRow: null,
      headerRowIsFallback: true,
      dataStartRow: null,
      dataRowCount: null,
      dateRange: null,
      requiredColumnsChecked: false,
      missingRequiredColumns: [],
      warnings: [],
      errors,
    };
  }

  const warnings: string[] = [...located.warnings];
  const { headerRow, headerRowIndex, rowOffset, dataRows } = located;
  const dataRowCount = dataRows.length;
  if (dataRowCount === 0) warnings.push(`${config.expectedName}: 데이터 행이 없습니다.`);

  const dateLoc = locateDateColumnIndex(headerRow, dataRows, config.dateColumnCandidates);
  let dateRange: { min: string; max: string } | null = null;
  if (dateLoc.index !== null) {
    const acc = new DateRangeAccumulator();
    for (const row of dataRows) {
      acc.add(row?.[dateLoc.index]);
    }
    dateRange = acc.range;
    if (!dateRange) warnings.push(`${config.expectedName}: 날짜 열을 찾았지만 유효한 날짜 값이 없습니다.`);
  } else {
    warnings.push(`${config.expectedName}: 날짜 열을 확인하지 못했습니다.`);
  }

  let missingRequiredColumns: string[] = [];
  const requiredColumnsChecked = !!config.requiredColumns;
  if (config.requiredColumns) {
    const headerCellSet = new Set(headerRow.map(normalizeHeaderCell));
    missingRequiredColumns = config.requiredColumns.filter((c) => !headerCellSet.has(c));
    if (missingRequiredColumns.length > 0) {
      errors.push(`${config.expectedName}: 필수 열 누락 - ${missingRequiredColumns.join(", ")}`);
    }
  }

  return {
    key: config.key,
    expectedName: config.expectedName,
    found: true,
    headerRow: headerRowIndex + rowOffset + 1,
    headerRowIsFallback: located.headerRowIsFallback,
    dataStartRow: headerRowIndex + rowOffset + 2,
    dataRowCount,
    dateRange,
    requiredColumnsChecked,
    missingRequiredColumns,
    warnings,
    errors,
  };
}

async function diagnoseOverview(
  workbook: XLSX.WorkBook,
  arrayBuffer: ArrayBuffer
): Promise<{ overview: StoreOverview | null; errors: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheetName = findSheetByName(workbook, OVERVIEW_SHEET_NAME);
  if (!sheetName) {
    errors.push(`"${OVERVIEW_SHEET_NAME}" 시트를 찾을 수 없습니다.`);
    return { overview: null, errors };
  }
  const ws = workbook.Sheets[sheetName];

  const labelText = normalizeHeaderCell(ws["J2"]?.v);
  if (labelText !== "스토어 url") {
    warnings.push(`J2 셀 값이 "스토어 url"이 아닙니다 (실제: "${labelText || "(비어 있음)"}").`);
  }

  const urlCell = ws["K2"] as XLSX.CellObject | undefined;
  let storeUrl: string | null = null;
  let storeUrlSource: "hyperlink" | "cell-value" | null = null;
  const hyperlinkTarget = (urlCell as { l?: { Target?: string } } | undefined)?.l?.Target;
  if (hyperlinkTarget) {
    storeUrl = hyperlinkTarget;
    storeUrlSource = "hyperlink";
  } else if (urlCell?.v) {
    storeUrl = String(urlCell.v);
    storeUrlSource = "cell-value";
  } else {
    warnings.push("K2에서 스토어 URL을 찾을 수 없습니다.");
  }

  const imageResult = await extractOverviewImages(arrayBuffer, sheetName);
  warnings.push(...imageResult.warnings);
  const heroImage = imageResult.images[0] ?? null;
  const sellerCenterImage = imageResult.images[1] ?? null;
  if (!heroImage) warnings.push("대표 이미지를 추출하지 못했습니다.");
  if (!sellerCenterImage) warnings.push("판매자센터 이미지를 추출하지 못했습니다.");

  return {
    overview: { storeUrl, storeUrlSource, heroImage, sellerCenterImage, warnings },
    errors,
  };
}

export async function diagnoseWorkbook(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<WorkbookDiagnosticsResult> {
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    return {
      fileName,
      storeName: null,
      storeNameSource: null,
      overview: null,
      sheets: [],
      overallStatus: "error",
      errors: [".xlsx 형식의 파일만 지원합니다."],
      warnings: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  const { storeName, matched } = extractStoreNameFromFileName(fileName);
  if (!matched) {
    warnings.push('파일명이 "스토어분석양식(스토어명).xlsx" 형식이 아닙니다. 스토어명을 파일명에서 추출할 수 없습니다.');
  } else if (!storeName) {
    warnings.push("파일명 괄호 안에서 스토어명을 찾지 못했습니다.");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  } catch (e) {
    return {
      fileName,
      storeName,
      storeNameSource: matched ? "filename" : null,
      overview: null,
      sheets: [],
      overallStatus: "error",
      errors: [`엑셀 파일을 읽을 수 없습니다: ${e instanceof Error ? e.message : String(e)}`],
      warnings,
    };
  }

  if (workbook.SheetNames.length === 0) {
    return {
      fileName,
      storeName,
      storeNameSource: matched ? "filename" : null,
      overview: null,
      sheets: [],
      overallStatus: "error",
      errors: ["워크북에 시트가 없습니다."],
      warnings,
    };
  }

  const { overview, errors: overviewErrors } = await diagnoseOverview(workbook, arrayBuffer);
  errors.push(...overviewErrors);

  const sheets: SheetDiagnostic[] = [];
  for (const config of SHEET_CONFIGS) {
    const sheetName = findSheetByName(workbook, config.expectedName);
    if (!sheetName) {
      errors.push(`"${config.expectedName}" 시트를 찾을 수 없습니다.`);
      sheets.push({
        key: config.key,
        expectedName: config.expectedName,
        found: false,
        headerRow: null,
        headerRowIsFallback: false,
        dataStartRow: null,
        dataRowCount: null,
        dateRange: null,
        requiredColumnsChecked: false,
        missingRequiredColumns: [],
        warnings: [],
        errors: [`"${config.expectedName}" 시트를 찾을 수 없습니다.`],
      });
      continue;
    }
    const diagnostic = diagnoseSheet(workbook.Sheets[sheetName], config);
    errors.push(...diagnostic.errors);
    warnings.push(...diagnostic.warnings);
    sheets.push(diagnostic);
  }

  const overallStatus: DiagnosticSeverity = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "success";

  return {
    fileName,
    storeName,
    storeNameSource: matched ? "filename" : null,
    overview,
    sheets,
    overallStatus,
    errors,
    warnings,
  };
}
