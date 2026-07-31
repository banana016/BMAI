export interface DateRange {
  start: string;
  end: string;
}

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

export function daysInRange(range: DateRange): number {
  const diff = toDate(range.end).getTime() - toDate(range.start).getTime();
  return Math.round(diff / 86_400_000) + 1;
}

/** The immediately preceding period of the same length ("직전 동일기간"). */
export function previousPeriod(range: DateRange): DateRange {
  const length = daysInRange(range);
  const prevEnd = addDays(toDate(range.start), -1);
  const prevStart = addDays(prevEnd, -(length - 1));
  return { start: toIso(prevStart), end: toIso(prevEnd) };
}

/** Intersects a range with the sheet's actual available range; null if disjoint. */
export function clampToAvailable(range: DateRange, available: DateRange): DateRange | null {
  const start = range.start > available.start ? range.start : available.start;
  const end = range.end < available.end ? range.end : available.end;
  if (start > end) return null;
  return { start, end };
}

/** Default "최근 완료 30일" anchored on the latest available date, clamped to what's actually there. */
export function defaultRecentPeriod(available: DateRange, days = 30): DateRange {
  const start = toIso(addDays(toDate(available.end), -(days - 1)));
  return clampToAvailable({ start, end: available.end }, available) ?? available;
}

export function isWithinRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}
