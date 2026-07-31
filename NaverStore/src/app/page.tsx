import { WorkbookUploader } from "@/components/upload/WorkbookUploader";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col items-center gap-2 pb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          스마트스토어 경영진단 대시보드
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          네이버 스마트스토어 분석 엑셀 파일을 업로드하면 스토어 정보와 시트 구조를 검증합니다.
        </p>
      </div>
      <WorkbookUploader />
    </div>
  );
}
