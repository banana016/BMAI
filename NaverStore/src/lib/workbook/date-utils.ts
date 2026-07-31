export interface ParsedDateValue {
  /** ISO yyyy-mm-dd. For range values (weekly cohorts) this is the range start. */
  iso: string;
  /** Present only for "yyyy-mm-dd~yyyy-mm-dd" weekly range values. */
  isoEnd?: string;
}

const RANGE_PATTERN = /^(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})$/;
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DOT_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})\.(?:\s+\d{2}:\d{2}:\d{2})?$/;

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Handles the three date shapes seen across sheets: native Excel dates
 * (already resolved to JS Date by SheetJS), "yyyy.mm.dd." (+ optional time)
 * text cells, and "yyyy-mm-dd~yyyy-mm-dd" weekly range text used by 고객분석.
 */
export function parseFlexibleDateCell(value: unknown): ParsedDateValue | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { iso: toIsoDate(value) };
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const rangeMatch = trimmed.match(RANGE_PATTERN);
  if (rangeMatch) {
    return { iso: rangeMatch[1], isoEnd: rangeMatch[2] };
  }

  const isoMatch = trimmed.match(ISO_PATTERN);
  if (isoMatch) {
    return { iso: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` };
  }

  const dotMatch = trimmed.match(DOT_PATTERN);
  if (dotMatch) {
    return { iso: `${dotMatch[1]}-${dotMatch[2]}-${dotMatch[3]}` };
  }

  return null;
}

export class DateRangeAccumulator {
  private min: string | null = null;
  private max: string | null = null;

  add(value: unknown): void {
    const parsed = parseFlexibleDateCell(value);
    if (!parsed) return;
    const lowCandidate = parsed.iso;
    const highCandidate = parsed.isoEnd ?? parsed.iso;
    if (this.min === null || lowCandidate < this.min) this.min = lowCandidate;
    if (this.max === null || highCandidate > this.max) this.max = highCandidate;
  }

  get range(): { min: string; max: string } | null {
    if (this.min === null || this.max === null) return null;
    return { min: this.min, max: this.max };
  }
}
