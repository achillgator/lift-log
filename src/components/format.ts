// Display helpers shared by the screens. Dates are local YYYY-MM-DD strings; weights are lb.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const METERS_PER_MILE = 1609.344;

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** "Fri Oct 17" */
export function formatDate(iso: string): string {
  const d = parseDate(iso);
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function weekdayName(weekday: number, short = false): string {
  const name = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday] ?? '';
  return short ? name.slice(0, 3) : name;
}

/** The seven dates (Sunday to Saturday) of the week that holds `iso`. */
export function weekOf(iso: string): string[] {
  const start = addDays(iso, -parseDate(iso).getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 135 -> "135", 132.5 -> "132.5" */
export function formatLb(lb: number | undefined): string {
  if (lb === undefined || Number.isNaN(lb)) return '–';
  return String(Math.round(lb * 100) / 100);
}

/** 95 -> "1:35" */
export function formatClock(sec: number | undefined): string {
  if (sec === undefined) return '–';
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "1:35" -> 95, "95" -> 95 */
export function parseClock(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    const mins = Number(m || 0);
    const secs = Number(s || 0);
    if (!Number.isFinite(mins) || !Number.isFinite(secs)) return undefined;
    return Math.round(mins * 60 + secs);
  }
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

export function metersToMiles(m: number | undefined): number | undefined {
  return m === undefined ? undefined : Math.round((m / METERS_PER_MILE) * 100) / 100;
}

export function milesToMeters(mi: number): number {
  return Math.round(mi * METERS_PER_MILE);
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/** 1234567 -> "1,234,567" */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
