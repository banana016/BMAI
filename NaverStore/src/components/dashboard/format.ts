import type { KpiUnit } from "@/types/dashboard";

export function formatByUnit(value: number | null, unit: KpiUnit): string {
  if (value === null) return "-";
  switch (unit) {
    case "currency":
      return `${Math.round(value).toLocaleString("ko-KR")}원`;
    case "count":
      return Math.round(value).toLocaleString("ko-KR");
    case "ratio":
      return `${(value * 100).toFixed(1)}%`;
    case "percent":
      return `${value.toFixed(1)}%`;
  }
}

export function formatChangeRate(value: number | null): string {
  if (value === null) return "직전기간 비교 불가";
  const pct = (value * 100).toFixed(1);
  return `직전기간 대비 ${value >= 0 ? "+" : ""}${pct}%`;
}

/** Converts a user-facing target input (typed in the KPI's display unit) to the KPI's internal scale. */
export function parseTargetInput(raw: string, unit: KpiUnit): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return unit === "ratio" ? n / 100 : n;
}

/** Inverse of parseTargetInput, for re-populating an input from a stored internal target. */
export function targetToInputValue(value: number | null, unit: KpiUnit): string {
  if (value === null || value === undefined) return "";
  return unit === "ratio" ? String(value * 100) : String(value);
}
