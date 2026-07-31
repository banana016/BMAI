"use client";

import { useCallback, useRef, useState } from "react";
import type { DiagnosticSeverity, WorkbookDiagnosticsResult } from "@/types/workbook";
import type { NormalizedAdRow, NormalizedSalesRow } from "@/types/normalized";
import type { DateRange } from "@/lib/metrics/period";
import { Dashboard } from "@/components/dashboard/Dashboard";

type Status = "idle" | "parsing" | "done";

interface DashboardData {
  salesRows: NormalizedSalesRow[];
  adRows: NormalizedAdRow[];
  availableRange: DateRange;
}

const STATUS_STYLES: Record<DiagnosticSeverity, { label: string; className: string }> = {
  success: { label: "검증 성공", className: "border-green-600 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300" },
  warning: { label: "경고와 함께 통과", className: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  error: { label: "검증 실패", className: "border-red-600 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

function formatDateRange(range: { min: string; max: string } | null): string {
  if (!range) return "-";
  return range.min === range.max ? range.min : `${range.min} ~ ${range.max}`;
}

export function WorkbookUploader() {
  const [status, setStatus] = useState<Status>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<WorkbookDiagnosticsResult | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setStatus("parsing");
    setFatalError(null);
    setResult(null);
    setDashboardData(null);

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
      const { diagnoseWorkbook } = await import("@/lib/workbook/parser");
      const buffer = await file.arrayBuffer();
      const diagnostics = await diagnoseWorkbook(buffer, file.name);
      setResult(diagnostics);

      const salesDateRange = diagnostics.sheets.find((s) => s.key === "sales")?.dateRange;
      if (diagnostics.overallStatus !== "error" && salesDateRange) {
        const [XLSX, { normalizeSalesRows }, { normalizeAdRows }] = await Promise.all([
          import("xlsx"),
          import("@/lib/normalize/sales"),
          import("@/lib/normalize/ads"),
        ]);
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        setDashboardData({
          salesRows: normalizeSalesRows(workbook).rows,
          adRows: normalizeAdRows(workbook).rows,
          availableRange: { start: salesDateRange.min, end: salesDateRange.max },
        });
      }
    } catch (e) {
      setFatalError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus("done");
    }
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
        className={`flex flex-col items-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
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

      {status === "parsing" && (
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">파일을 검증하는 중입니다...</p>
      )}

      {fatalError && (
        <div className="rounded-lg border border-red-600 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          예상치 못한 오류가 발생했습니다: {fatalError}
        </div>
      )}

      {result && <DiagnosticsPreview result={result} />}

      {dashboardData && (
        <Dashboard
          salesRows={dashboardData.salesRows}
          adRows={dashboardData.adRows}
          availableRange={dashboardData.availableRange}
        />
      )}
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
