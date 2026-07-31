"use client";

import { useState } from "react";

interface ConsultantNotesProps {
  storeKey: string;
}

function storageKey(storeKey: string): string {
  return `naverstore:consultant-notes:${storeKey}`;
}

function readStored(storeKey: string): { text: string; savedAt: string | null } {
  const raw = window.localStorage.getItem(storageKey(storeKey));
  if (!raw) return { text: "", savedAt: null };
  try {
    const parsed = JSON.parse(raw) as { text: string; savedAt: string };
    return { text: parsed.text, savedAt: parsed.savedAt };
  } catch {
    return { text: "", savedAt: null };
  }
}

/**
 * Persisted to this browser's localStorage only — never sent anywhere (design
 * doc 1.2 privacy stance). Callers must mount a fresh instance per store (e.g.
 * `key={storeKey}`) so switching files re-reads the right saved note instead
 * of carrying over stale state.
 */
export function ConsultantNotes({ storeKey }: ConsultantNotesProps) {
  const [{ text: initialText, savedAt: initialSavedAt }] = useState(() => readStored(storeKey));
  const [text, setText] = useState(initialText);
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);

  const handleSave = () => {
    const now = new Date().toISOString();
    window.localStorage.setItem(storageKey(storeKey), JSON.stringify({ text, savedAt: now }));
    setSavedAt(now);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">컨설턴트 코멘트</p>
      <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500 print:hidden">
        이 브라우저에만 저장되며 서버로 전송되지 않습니다.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full rounded border border-zinc-300 bg-transparent p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 print:border-none"
        placeholder="이번 진단에 대한 코멘트를 남겨보세요."
      />
      <div className="mt-2 flex items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={handleSave}
          className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          저장
        </button>
        {savedAt && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            마지막 저장: {new Date(savedAt).toLocaleString("ko-KR")}
          </span>
        )}
      </div>
    </div>
  );
}
