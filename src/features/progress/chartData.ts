// Small helpers shared by the progress, body and trophy charts.
import { rangeStart, type Range } from '../../lib/stats';

export const RANGES = ['4W', '3M', 'All'] as const satisfies readonly Range[];

/** x-domain for a range: range start (or the first data date for All) through today. */
export function windowFor(range: Range, today: string, dates: string[]): { from: string; to: string } {
  const first = dates.length ? dates.reduce((a, b) => (b < a ? b : a)) : today;
  return { from: rangeStart(range, today) ?? (first < today ? first : today), to: today };
}

/** "in the last 4 weeks" etc., for empty states. */
export function rangeWords(range: Range): string {
  return range === '4W' ? 'in the last 4 weeks' : range === '3M' ? 'in the last 3 months' : 'yet';
}

export function formatNumber(v: number, decimals = 0): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Seconds as "45 s" under a minute, else "m:ss". */
export function formatSeconds(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
}
