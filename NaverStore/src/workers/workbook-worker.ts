/// <reference lib="webworker" />
import * as XLSX from "xlsx";
import { diagnoseWorkbook } from "@/lib/workbook/parser";
import { normalizeSalesRows } from "@/lib/normalize/sales";
import { normalizeTrafficRows } from "@/lib/normalize/traffic";
import { normalizeSearchRows } from "@/lib/normalize/search";
import { normalizeCustomerRows } from "@/lib/normalize/customers";
import { normalizeReviewRows } from "@/lib/normalize/reviews";
import { normalizeAdRows } from "@/lib/normalize/ads";
import type { WorkbookDiagnosticsResult } from "@/types/workbook";
import type {
  NormalizedAdRow,
  NormalizedCustomerRow,
  NormalizedReviewRow,
  NormalizedSalesRow,
  NormalizedSearchRow,
  NormalizedTrafficRow,
} from "@/types/normalized";

export interface WorkerRequest {
  arrayBuffer: ArrayBuffer;
  fileName: string;
}

export interface WorkerNormalizedRows {
  salesRows: NormalizedSalesRow[];
  trafficRows: NormalizedTrafficRow[];
  searchRows: NormalizedSearchRow[];
  customerRows: NormalizedCustomerRow[];
  reviewRows: NormalizedReviewRow[];
  adRows: NormalizedAdRow[];
}

export type WorkerStage = "reading" | "diagnosing" | "normalizing";

export type WorkerResponse =
  | { type: "progress"; stage: WorkerStage }
  | { type: "result"; diagnostics: WorkbookDiagnosticsResult; normalized: WorkerNormalizedRows | null }
  | { type: "error"; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data);
});

async function handle({ arrayBuffer, fileName }: WorkerRequest): Promise<void> {
  try {
    ctx.postMessage({ type: "progress", stage: "reading" } satisfies WorkerResponse);

    ctx.postMessage({ type: "progress", stage: "diagnosing" } satisfies WorkerResponse);
    const diagnostics = await diagnoseWorkbook(arrayBuffer, fileName);

    const salesDateRange = diagnostics.sheets.find((s) => s.key === "sales")?.dateRange;
    let normalized: WorkerNormalizedRows | null = null;

    if (diagnostics.overallStatus !== "error" && salesDateRange) {
      ctx.postMessage({ type: "progress", stage: "normalizing" } satisfies WorkerResponse);
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
      normalized = {
        salesRows: normalizeSalesRows(workbook).rows,
        trafficRows: normalizeTrafficRows(workbook).rows,
        searchRows: normalizeSearchRows(workbook).rows,
        customerRows: normalizeCustomerRows(workbook).rows,
        reviewRows: normalizeReviewRows(workbook).rows,
        adRows: normalizeAdRows(workbook).rows,
      };
    }

    ctx.postMessage({ type: "result", diagnostics, normalized } satisfies WorkerResponse);
  } catch (e) {
    ctx.postMessage({ type: "error", message: e instanceof Error ? e.message : String(e) } satisfies WorkerResponse);
  }
}
