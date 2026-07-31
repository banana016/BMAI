export type SheetKey =
  | "overview"
  | "sales"
  | "traffic"
  | "search"
  | "customers"
  | "reviews"
  | "ads";

export type DiagnosticSeverity = "success" | "warning" | "error";

export interface DateRange {
  min: string;
  max: string;
}

export interface SheetDiagnostic {
  key: SheetKey;
  expectedName: string;
  found: boolean;
  headerRow: number | null;
  headerRowIsFallback: boolean;
  dataStartRow: number | null;
  dataRowCount: number | null;
  dateRange: DateRange | null;
  requiredColumnsChecked: boolean;
  missingRequiredColumns: string[];
  warnings: string[];
  errors: string[];
}

export interface StoreOverviewImage {
  dataUrl: string;
  mimeType: string;
  anchorRow: number;
}

export interface StoreOverview {
  storeUrl: string | null;
  storeUrlSource: "hyperlink" | "cell-value" | null;
  heroImage: StoreOverviewImage | null;
  sellerCenterImage: StoreOverviewImage | null;
  warnings: string[];
}

export interface WorkbookDiagnosticsResult {
  fileName: string;
  storeName: string | null;
  storeNameSource: "filename" | null;
  overview: StoreOverview | null;
  sheets: SheetDiagnostic[];
  overallStatus: DiagnosticSeverity;
  errors: string[];
  warnings: string[];
}
