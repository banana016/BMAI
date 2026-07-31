interface PrintReportHeaderProps {
  storeName: string | null;
  currentRange: { start: string; end: string };
}

/** Shown only in the printed/PDF output — a title block the on-screen dashboard doesn't need. */
export function PrintReportHeader({ storeName, currentRange }: PrintReportHeaderProps) {
  return (
    <div className="hidden print:block print:mb-4">
      <h1 className="text-xl font-bold">스마트스토어 경영진단 리포트</h1>
      <p className="text-sm text-zinc-600">
        {storeName ?? "스토어명 미확인"} · 분석 기간 {currentRange.start} ~ {currentRange.end} · 출력일{" "}
        {new Date().toLocaleDateString("ko-KR")}
      </p>
    </div>
  );
}
