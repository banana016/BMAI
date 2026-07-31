"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiagnosticSeverity, WorkbookDiagnosticsResult } from "@/types/workbook";
import type {
  NormalizedAdRow,
  NormalizedCustomerRow,
  NormalizedReviewRow,
  NormalizedSalesRow,
  NormalizedSearchRow,
  NormalizedTrafficRow,
} from "@/types/normalized";
import type { DateRange } from "@/lib/metrics/period";
import type { WorkerRequest, WorkerResponse, WorkerStage } from "@/workers/workbook-worker";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { logEvent } from "@/lib/audit/session-log";
import { SessionAuditLog } from "./SessionAuditLog";

type Status = "idle" | "parsing" | "done";

interface DashboardData {
  storeName: string | null;
  salesRows: NormalizedSalesRow[];
  trafficRows: NormalizedTrafficRow[];
  searchRows: NormalizedSearchRow[];
  customerRows: NormalizedCustomerRow[];
  reviewRows: NormalizedReviewRow[];
  adRows: NormalizedAdRow[];
  availableRange: DateRange;
}

const STATUS_STYLES: Record<DiagnosticSeverity, { label: string; className: string }> = {
  success: { label: "검증 성공", className: "border-green-600 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300" },
  warning: { label: "경고와 함께 통과", className: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  error: { label: "검증 실패", className: "border-red-600 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

const STAGE_LABELS: Record<WorkerStage, string> = {
  reading: "파일 읽는 중",
  diagnosing: "구조 검증 중",
  normalizing: "데이터 정규화 중",
};
const STAGE_ORDER: WorkerStage[] = ["reading", "diagnosing", "normalizing"];

// Parsing/normalizing runs off the main thread (see workbook-worker.ts), so
// large files don't freeze the UI. This threshold only controls whether we
// warn the user it may take a while — it never blocks the upload.
const LARGE_FILE_WARNING_BYTES = 30 * 1024 * 1024;

function formatDateRange(range: { min: string; max: string } | null): string {
  if (!range) return "-";
  return range.min === range.max ? range.min : `${range.min} ~ ${range.max}`;
}

export function WorkbookUploader() {
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState<WorkerStage | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<WorkbookDiagnosticsResult | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setStatus("parsing");
    setStage(null);
    setFatalError(null);
    setResult(null);
    setDashboardData(null);
    setSizeWarning(
      file.size > LARGE_FILE_WARNING_BYTES ? "파일 용량이 커서 분석에 다소 시간이 걸릴 수 있습니다." : null
    );

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setStatus("done");
      setResult({
        fileName: file.name,
        storeName: null,
        storeNameSource: null,
        overview: null,
        sheets: [],
        overallStatus: "error",
        errors: [".xlsx 형식의 파일만 업로드할 수 있습니다."],
        warnings: [],
      });
      return;
    }

    try {
      const buffer = await file.arrayBuffer();

      workerRef.current?.terminate();
      const worker = new Worker(new URL("../../workers/workbook-worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;

      const response = await new Promise<Exclude<WorkerResponse, { type: "progress" }>>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          if (event.data.type === "progress") {
            setStage(event.data.stage);
          } else {
            resolve(event.data);
          }
        };
        worker.onerror = (event) => reject(new Error(event.message || "워커에서 오류가 발생했습니다."));
        const request: WorkerRequest = { arrayBuffer: buffer, fileName: file.name };
        worker.postMessage(request, [buffer]);
      });

      if (response.type === "error") {
        setFatalError(response.message);
        logEvent("업로드 실패", file.name);
        return;
      }

      setResult(response.diagnostics);
      logEvent("파일 업로드", `${file.name} · ${response.diagnostics.overallStatus}`);
      const salesDateRange = response.diagnostics.sheets.find((s) => s.key === "sales")?.dateRange;
      if (response.normalized && salesDateRange) {
        setDashboardData({
          storeName: response.diagnostics.storeName,
          ...response.normalized,
          availableRange: { start: salesDateRange.min, end: salesDateRange.max },
        });
      }
    } catch (e) {
      setFatalError(e instanceof Error ? e.message : String(e));
      logEvent("업로드 실패", file.name);
    } finally {
      setStatus("done");
      setStage(null);
      workerRef.current?.terminate();
      workerRef.current = null;
    }
  }, []);

  const handleClearSession = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus("idle");
    setStage(null);
    setResult(null);
    setDashboardData(null);
    setFatalError(null);
    setSizeWarning(null);
    logEvent("세션 데이터 지우기");
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition-colors print:hidden ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
        }`}
      >
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          스마트스토어 분석 엑셀 파일을 여기로 끌어다 놓으세요
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          .xlsx 형식만 지원합니다. 파일은 서버로 전송되지 않고 브라우저에서만 분석됩니다.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          분석 데이터 업로드하기
        </button>
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={onInputChange} />
      </div>

      {sizeWarning && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {sizeWarning}
        </div>
      )}

      {status === "parsing" && (
        <div className="flex flex-col items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <ol className="flex gap-3">
            {STAGE_ORDER.map((s, i) => (
              <li key={s} className={stage === s ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>
                {i > 0 && <span className="mr-3 text-zinc-300 dark:text-zinc-600">→</span>}
                {STAGE_LABELS[s]}
              </li>
            ))}
          </ol>
        </div>
      )}

      {fatalError && (
        <div className="rounded-lg border border-red-600 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          예상치 못한 오류가 발생했습니다: {fatalError}
        </div>
      )}

      {result && (
        <div className="print:hidden">
          <DiagnosticsPreview result={result} />
        </div>
      )}

      {(result || dashboardData) && (
        <button
          type="button"
          onClick={handleClearSession}
          className="self-start rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 print:hidden dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          세션 데이터 지우기
        </button>
      )}

      {dashboardData && (
        <Dashboard
          storeName={dashboardData.storeName}
          salesRows={dashboardData.salesRows}
          trafficRows={dashboardData.trafficRows}
          searchRows={dashboardData.searchRows}
          customerRows={dashboardData.customerRows}
          reviewRows={dashboardData.reviewRows}
          adRows={dashboardData.adRows}
          availableRange={dashboardData.availableRange}
        />
      )}

      <SessionAuditLog />
    </div>
  );
}

function DiagnosticsPreview({ result }: { result: WorkbookDiagnosticsResult }) {
  const statusStyle = STATUS_STYLES[result.overallStatus];

  return (
    <div className="flex flex-col gap-6">
      <div className={`rounded-lg border p-4 text-sm font-medium ${statusStyle.className}`}>
        {statusStyle.label} — {result.fileName}
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="mb-2 text-sm font-semibold text-red-800 dark:text-red-300">오류</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">경고</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {(result.storeName || result.overview) && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">스토어 정보</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {result.overview?.heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.overview.heroImage.dataUrl}
                alt="스토어 대표 화면"
                className="w-full max-w-xs rounded-md border border-zinc-200 dark:border-zinc-700"
              />
            )}
            <div className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              <p>
                <span className="font-medium">스토어명: </span>
                {result.storeName ?? "확인 불가"}
              </p>
              <p>
                <span className="font-medium">스토어 URL: </span>
                {result.overview?.storeUrl ? (
                  <a
                    href={result.overview.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline dark:text-blue-400"
                  >
                    {result.overview.storeUrl}
                  </a>
                ) : (
                  "확인 불가"
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {result.sheets.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <tr>
                <th className="px-3 py-2">시트</th>
                <th className="px-3 py-2">발견</th>
                <th className="px-3 py-2">헤더 행</th>
                <th className="px-3 py-2">데이터 행 수</th>
                <th className="px-3 py-2">데이터 기간</th>
                <th className="px-3 py-2">필수 열 누락</th>
              </tr>
            </thead>
            <tbody>
              {result.sheets.map((s) => (
                <tr key={s.key} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{s.expectedName}</td>
                  <td className="px-3 py-2">{s.found ? "O" : "X"}</td>
                  <td className="px-3 py-2">
                    {s.headerRow ?? "-"}
                    {s.headerRowIsFallback && s.headerRow ? " (추정)" : ""}
                  </td>
                  <td className="px-3 py-2">{s.dataRowCount ?? "-"}</td>
                  <td className="px-3 py-2">{formatDateRange(s.dateRange)}</td>
                  <td className="px-3 py-2">
                    {s.requiredColumnsChecked
                      ? s.missingRequiredColumns.length > 0
                        ? s.missingRequiredColumns.join(", ")
                        : "없음"
                      : "검증 대상 아님"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
