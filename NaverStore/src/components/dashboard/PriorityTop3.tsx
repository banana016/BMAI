"use client";

import { useState } from "react";
import type { Insight } from "@/types/insight";

interface PriorityTop3Props {
  insights: Insight[];
}

interface EditableFields {
  title: string;
  action: string;
}

/**
 * Keyed by insight.title rather than array index, so an edit stays attached
 * to "that insight" across re-renders and doesn't silently carry over onto a
 * different insight that happens to land in the same slot after a period
 * change. Edits are session-only (component state), matching the rest of
 * the dashboard's target-input/local-state pattern — nothing is persisted.
 */
export function PriorityTop3({ insights }: PriorityTop3Props) {
  const top3 = insights.slice(0, 3);
  const [edits, setEdits] = useState<Record<string, EditableFields>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);

  if (top3.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">우선 해결 과제 TOP 3</p>
      <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
        영향도(개선 잠재력)와 실행 용이성을 함께 반영한 순위입니다. 필요하면 직접 수정할 수 있습니다.
      </p>
      <ol className="flex flex-col gap-3">
        {top3.map((insight, i) => {
          const key = insight.title;
          const edited = edits[key];
          const displayed = edited ?? { title: insight.title, action: insight.action };
          const isEditing = editingKey === key;

          return (
            <li key={key} className="flex gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {i + 1}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={displayed.title}
                      onChange={(e) =>
                        setEdits((prev) => ({ ...prev, [key]: { ...displayed, title: e.target.value } }))
                      }
                      className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
                    />
                    <textarea
                      value={displayed.action}
                      onChange={(e) =>
                        setEdits((prev) => ({ ...prev, [key]: { ...displayed, action: e.target.value } }))
                      }
                      rows={2}
                      className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                    />
                    <div className="flex gap-3 print:hidden">
                      <button
                        type="button"
                        onClick={() => setEditingKey(null)}
                        className="text-xs text-blue-600 underline dark:text-blue-400"
                      >
                        완료
                      </button>
                      {edited && (
                        <button
                          type="button"
                          onClick={() =>
                            setEdits((prev) => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            })
                          }
                          className="text-xs text-zinc-400 underline dark:text-zinc-500"
                        >
                          자동 생성 값으로 복원
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {displayed.title}
                      {edited && (
                        <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          수정됨
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{displayed.action}</p>
                    <button
                      type="button"
                      onClick={() => setEditingKey(key)}
                      className="self-start text-xs text-blue-600 underline print:hidden dark:text-blue-400"
                    >
                      수정
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
