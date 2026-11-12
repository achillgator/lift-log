// Local calendar dates as 'YYYY-MM-DD' strings. Never parse these with `new Date('YYYY-MM-DD')`,
// which reads them as UTC midnight and can land on the previous day in local time.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date of a Date or epoch ms, as YYYY-MM-DD. */
export function toLocalDate(d: Date | number = new Date()): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local date. */
export function today(): string {
  return toLocalDate(new Date());
}

/** True for a real calendar date in YYYY-MM-DD form (rejects 2025-02-30). */
export function isValidDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** Local midnight of a YYYY-MM-DD date. Throws on an invalid date. */
export function parseLocalDate(s: string): Date {
  if (!isValidDate(s)) throw new Error(`Invalid date "${s}" (expected YYYY-MM-DD)`);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Epoch ms for local noon of a date: a stable timestamp that never crosses a day boundary. */
export function localNoon(s: string): number {
  const d = parseLocalDate(s);
  d.setHours(12);
  return d.getTime();
}

/** Adds whole days (negative to go back). Safe across daylight-saving changes. */
export function addDays(s: string, days: number): string {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  // Use UTC on the parsed parts so daylight saving never adds or loses an hour.
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  if (!isValidDate(a) || !isValidDate(b)) throw new Error(`Invalid date "${isValidDate(a) ? b : a}"`);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/** Whole weeks from a to b, rounded down (negative when b is before a). */
export function weeksBetween(a: string, b: string): number {
  return Math.floor(daysBetween(a, b) / 7);
}

/** Day of week, 0 = Sunday ... 6 = Saturday (same as Date#getDay and Routine.weekday). */
export function weekday(s: string): number {
  return parseLocalDate(s).getDay();
}

/** Monday of the week that holds this date. Weeks run Monday to Sunday. */
export function startOfWeek(s: string): string {
  const offset = (weekday(s) + 6) % 7;
  return addDays(s, -offset);
}

/** Display form, e.g. "Fri Oct 17". Adds the year when it is not the current one. */
export function formatDate(s: string, now: string = today()): string {
  const d = parseLocalDate(s);
  const base = `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === parseLocalDate(now).getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}
