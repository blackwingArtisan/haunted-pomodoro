/**
 * Calendar-day helpers. A day key is `YYYY-MM-DD` in the viewer's local time zone, so a session
 * finished at 11:50 pm counts for the day the person actually lived it.
 */
export type DayKey = string;

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dayKey(ms: number): DayKey {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string') return false;
  const match = DAY_KEY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d);
}

function utcDayNumber(key: DayKey): number {
  const match = DAY_KEY.exec(key);
  if (!match) throw new Error(`Not a day key: ${key}`);
  const [, y, m, d] = match;
  return Math.round(Date.UTC(Number(y), Number(m) - 1, Number(d)) / 86_400_000);
}

/** Whole calendar days from `a` to `b` (positive when `b` is later). Immune to daylight-saving shifts. */
export function daysBetween(a: DayKey, b: DayKey): number {
  return utcDayNumber(b) - utcDayNumber(a);
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = new Date((utcDayNumber(key) + days) * 86_400_000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The `count` day keys ending on `end`, oldest first. */
export function lastDays(end: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, i) => addDays(end, i - count + 1));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function weekdayName(key: DayKey): string {
  const date = new Date(utcDayNumber(key) * 86_400_000);
  return WEEKDAYS[date.getUTCDay()] ?? '';
}
