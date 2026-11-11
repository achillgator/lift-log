// Display formatting for progress, trophies and body. Dates like "Fri Oct 17".
import { dayNumber } from '../../lib/stats';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d, weekday: DAYS[(dayNumber(date) + 4) % 7] };
}

/** "Fri Oct 17"; adds the year when it is not `today`'s year. */
export function formatDate(date: string, today?: string): string {
  const { y, m, d, weekday } = parts(date);
  const base = `${weekday} ${MONTHS[m - 1]} ${d}`;
  return today && today.slice(0, 4) !== String(y) ? `${base}, ${y}` : base;
}

/** "Oct 17" for axis labels; "Oct 17 ’25" outside `today`'s year. */
export function formatShortDate(date: string, today?: string): string {
  const { y, m, d } = parts(date);
  const base = `${MONTHS[m - 1]} ${d}`;
  return today && today.slice(0, 4) !== String(y) ? `${base} ’${String(y).slice(2)}` : base;
}

export function formatLb(lb: number, decimals = 0): string {
  return `${lb.toFixed(decimals)} lb`;
}

/** "+1.4 lb" / "−0.6 lb" with a real minus sign. */
export function formatSignedLb(lb: number, decimals = 1): string {
  const v = Math.abs(lb) < 0.05 ? 0 : lb;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '±';
  return `${sign}${Math.abs(v).toFixed(decimals)} lb`;
}

/** Seconds as "m:ss" (or "h:mm:ss"). */
export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export const METERS_PER_MILE = 1609.344;

export function formatMiles(mi: number): string {
  return `${mi.toFixed(2)} mi`;
}

export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}× bw`;
}
