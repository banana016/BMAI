"use client";

import { useSessionLog } from "@/lib/audit/use-session-log";
import { clearEvents } from "@/lib/audit/session-log";

export function SessionAuditLog() {
  const events = useSessionLog();

  return (
    <details className="rounded-lg border border-zinc-200 bg-white p-4 text-sm print:hidden dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
        세션 활동 기록 ({events.length})
      </summary>
      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
        이 브라우저 탭에서만 유지되는 기록이며 새로고침하면 사라집니다. 서버로 전송되지 않으며, 실제 접근
        제어·서버 감사 로그는 이 브라우저 전용 버전에는 포함되어 있지 않습니다.
      </p>
      {events.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">기록된 활동이 없습니다.</p>
      ) : (
        <>
          <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
            {events.map((e, i) => (
              <li key={i}>
                <span className="text-zinc-400 dark:text-zinc-500">
                  {new Date(e.timestamp).toLocaleTimeString("ko-KR")}
                </span>{" "}
                — {e.action}
                {e.detail ? ` (${e.detail})` : ""}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => clearEvents()}
            className="mt-2 text-xs text-blue-600 underline dark:text-blue-400"
          >
            기록 지우기
          </button>
        </>
      )}
    </details>
  );
}
