"use client";

import { logEvent } from "@/lib/audit/session-log";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        logEvent("인쇄/PDF 저장");
        window.print();
      }}
      className="print:hidden rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      인쇄 / PDF로 저장
    </button>
  );
}
