// Local-date helpers for the later-release features. Dates are local YYYY-MM-DD strings.
// Day math runs in UTC on the date string, so daylight-saving changes never shift a day.

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toIso(fromIso(value)) === value;
}

function fromIso(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIso(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today's date on this device, as local YYYY-MM-DD. */
export function todayLocal(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(date: string, days: number): string {
  return toIso(fromIso(date) + days * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((fromIso(b) - fromIso(a)) / DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(date: string): number {
  return new Date(fromIso(date)).getUTCDay();
}

/** The first day of the week holding `date`. weekStart: 0 = Sunday, 1 = Monday. */
export function startOfWeek(date: string, weekStart = 0): string {
  return addDays(date, -((weekday(date) - weekStart + 7) % 7));
}

/** "Fri Oct 17", the app-wide date style. */
export function formatShort(date: string): string {
  const d = new Date(fromIso(date));
  return `${WEEKDAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Oct", for month labels. */
export function monthShort(date: string): string {
  return MONTHS[new Date(fromIso(date)).getUTCMonth()];
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
