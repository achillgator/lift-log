// Calendar heatmap (v1.1): weeks as columns, weekdays as rows, shaded by training on each day.
import { addDays, compareDates, diffDays, startOfWeek } from './dates';

export interface HeatCell {
  date: string;
  value: number;
  /** 0 = nothing, 1..4 = light to strong. */
  level: 0 | 1 | 2 | 3 | 4;
  /** Inside the requested range (cells past the end date are blank padding). */
  inRange: boolean;
}

export interface HeatWeek {
  start: string;
  /** Month label shown above this column, when a new month starts in it. */
  monthStart?: string;
  cells: HeatCell[];
}

export interface HeatmapOptions {
  /** Last day shown, usually today. */
  endDate: string;
  weeks: number;
  /** 0 = Sunday-first columns, 1 = Monday-first. */
  weekStart?: number;
}

/** Done sets per date, from rows that each carry a date (one row per set). */
export function countByDate(rows: { date: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.date, (counts.get(r.date) ?? 0) + 1);
  return counts;
}

/**
 * Level thresholds split by the quartiles of the non-zero values, so one heavy day
 * does not wash out the rest. Returns the upper bounds for levels 1..3.
 */
export function levelThresholds(values: number[]): [number, number, number] {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [0, 0, 0];
  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))];
  return [q(0.25), q(0.5), q(0.75)];
}

export function levelFor(value: number, t: [number, number, number]): HeatCell['level'] {
  if (value <= 0) return 0;
  if (value <= t[0]) return 1;
  if (value <= t[1]) return 2;
  if (value <= t[2]) return 3;
  return 4;
}

/** The grid for the `weeks` weeks ending at the week holding `endDate`. */
export function buildHeatmap(values: Map<string, number>, opts: HeatmapOptions): HeatWeek[] {
  const weekStart = opts.weekStart ?? 0;
  const lastWeek = startOfWeek(opts.endDate, weekStart);
  const firstWeek = addDays(lastWeek, -7 * (Math.max(1, opts.weeks) - 1));

  const inRangeValues: number[] = [];
  for (const [date, v] of values) {
    if (compareDates(date, firstWeek) >= 0 && compareDates(date, opts.endDate) <= 0) inRangeValues.push(v);
  }
  const t = levelThresholds(inRangeValues);

  const weeks: HeatWeek[] = [];
  for (let start = firstWeek; diffDays(start, lastWeek) >= 0; start = addDays(start, 7)) {
    const cells: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const inRange = compareDates(date, opts.endDate) <= 0;
      const value = inRange ? values.get(date) ?? 0 : 0;
      cells.push({ date, value, level: inRange ? levelFor(value, t) : 0, inRange });
    }
    // The first column always gets a label; later ones only when the 1st of a month falls in them.
    const first = cells.find((c) => c.inRange && c.date.endsWith('-01'));
    weeks.push({ start, monthStart: weeks.length === 0 ? start : first?.date, cells });
  }
  return weeks;
}

/** Days and weeks with any training in the grid, for the caption. */
export function heatmapSummary(weeks: HeatWeek[]): { activeDays: number; activeWeeks: number } {
  let activeDays = 0;
  let activeWeeks = 0;
  for (const w of weeks) {
    const n = w.cells.filter((c) => c.value > 0).length;
    activeDays += n;
    if (n > 0) activeWeeks++;
  }
  return { activeDays, activeWeeks };
}
