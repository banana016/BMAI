/**
 * Amounts/counts: "-" and blank cells are genuine missing data, not zero
 * (design doc 2.1) — they must stay null rather than being coerced to 0.
 */
export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = String(value).trim();
  if (trimmed === "" || trimmed === "-") return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export const parseCount = parseMoney;

/**
 * The workbook stores percentages as the bare number before the `%` sign
 * (10.4 means 10.4%). Internal values are ratios, so this divides by 100.
 */
export function parsePercentToRatio(value: unknown): number | null {
  const n = parseMoney(value);
  return n === null ? null : n / 100;
}

export function parseText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" || trimmed === "-" ? null : trimmed;
}
