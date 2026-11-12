// Training calendar (v2). Pure functions that read the editable calendar rows and adjust the
// planned routine for a date. No dates live in code: every date comes from a calendar row.
//
// Row meanings (CalendarEntry):
// - phase:  a named block from startDate to endDate (open-ended without one). Drives the banner.
// - test:   a test day on startDate (through endDate when set). routineId, when set, replaces the
//           day's routine; otherwise the planned routine is kept and marked as a test.
// - deload: lighter week(s). pct lighter (default from settings.rules.deloadPct) and fewerSets
//           (default 1). Without everyWeeks it covers startDate..endDate (7 days when no endDate).
//           With everyWeeks it repeats: 7 days starting every N weeks from startDate, until endDate.
// - swap:   on startDate's weekday, every everyWeeks weeks (default 1) from startDate until endDate,
//           routineId replaces whatever routine that day would have had.
// Precedence on one day: test beats swap beats the weekday routine; deloads skip test days.
import type { CalendarEntry, LoggedSet, Routine, RoutineItem } from '../../db/types';
import { addDays, compareDates, diffDays, formatShort, isIsoDate, weekday } from './dates';

export const DEFAULT_FEWER_SETS = 1;

export interface DeloadRule {
  pct: number;
  fewerSets: number;
}

export interface PhaseInfo {
  entry: CalendarEntry;
  /** 1-based week of the phase holding the date. */
  week: number;
  /** Total weeks when the phase has an end date. */
  totalWeeks?: number;
  /** Days left after today, when the phase has an end date. */
  daysLeft?: number;
}

export interface DayPlan {
  date: string;
  /** The routine to do, after test days and swaps. Undefined means nothing planned. */
  routine?: Routine;
  /** Why this routine: its weekday, a swap row, a test row, or nothing planned. */
  source: 'weekday' | 'swap' | 'test' | 'none';
  isTest: boolean;
  test?: CalendarEntry;
  swap?: CalendarEntry;
  /** The weekday routine that a test or swap replaced. */
  replaced?: Routine;
  deload?: DeloadRule & { entry: CalendarEntry };
  phase?: PhaseInfo;
}

function inSpan(date: string, start: string, end: string | undefined): boolean {
  return compareDates(date, start) >= 0 && (end === undefined || compareDates(date, end) <= 0);
}

/** Whether a calendar row applies on `date`, using the row meanings above. */
export function occursOn(entry: CalendarEntry, date: string): boolean {
  const { startDate: start, endDate: end } = entry;
  if (compareDates(date, start) < 0) return false;
  if (end !== undefined && compareDates(date, end) > 0) return false;
  const diff = diffDays(start, date);
  switch (entry.type) {
    case 'phase':
      return true;
    case 'test':
      return inSpan(date, start, end ?? start);
    case 'swap':
      return diff % (7 * Math.max(1, entry.everyWeeks ?? 1)) === 0;
    case 'deload':
      if (entry.everyWeeks && entry.everyWeeks >= 1) return diff % (7 * entry.everyWeeks) < 7;
      return inSpan(date, start, end ?? addDays(start, 6));
  }
}

/** The latest-starting row of a type that applies on `date` (later rows override earlier ones). */
function latest(entries: CalendarEntry[], type: CalendarEntry['type'], date: string): CalendarEntry | undefined {
  let found: CalendarEntry | undefined;
  for (const e of entries) {
    if (e.type !== type || !occursOn(e, date)) continue;
    if (!found || compareDates(e.startDate, found.startDate) >= 0) found = e;
  }
  return found;
}

export function phaseOn(entries: CalendarEntry[], date: string): PhaseInfo | undefined {
  const entry = latest(entries, 'phase', date);
  if (!entry) return undefined;
  const week = Math.floor(diffDays(entry.startDate, date) / 7) + 1;
  if (!entry.endDate) return { entry, week };
  return {
    entry,
    week,
    totalWeeks: Math.ceil((diffDays(entry.startDate, entry.endDate) + 1) / 7),
    daysLeft: diffDays(date, entry.endDate),
  };
}

export function deloadOn(entries: CalendarEntry[], date: string, defaultPct: number): (DeloadRule & { entry: CalendarEntry }) | undefined {
  const entry = latest(entries, 'deload', date);
  if (!entry) return undefined;
  return { entry, pct: entry.pct ?? defaultPct, fewerSets: entry.fewerSets ?? DEFAULT_FEWER_SETS };
}

/**
 * The plan for one date. `weekdayRoutine` is the routine the date gets without the calendar
 * (the routine assigned to that weekday). `routines` resolves routineId on test and swap rows;
 * archived or missing routines are ignored, so a deleted routine never breaks a day.
 */
export function planDay(
  date: string,
  entries: CalendarEntry[],
  routines: Routine[],
  weekdayRoutine: Routine | undefined,
  defaultDeloadPct: number,
): DayPlan {
  const byId = new Map(routines.filter((r) => !r.archived).map((r) => [r.id, r]));
  const plan: DayPlan = { date, routine: weekdayRoutine, source: weekdayRoutine ? 'weekday' : 'none', isTest: !!weekdayRoutine?.isTest };

  const swap = latest(entries, 'swap', date);
  const swapRoutine = swap?.routineId ? byId.get(swap.routineId) : undefined;
  if (swap && swapRoutine) {
    plan.swap = swap;
    plan.replaced = weekdayRoutine;
    plan.routine = swapRoutine;
    plan.source = 'swap';
    plan.isTest = !!swapRoutine.isTest;
  }

  const test = latest(entries, 'test', date);
  if (test) {
    const testRoutine = test.routineId ? byId.get(test.routineId) : undefined;
    plan.test = test;
    plan.isTest = true;
    if (testRoutine) {
      plan.replaced ??= weekdayRoutine;
      plan.routine = testRoutine;
      plan.source = 'test';
    }
  }

  if (!plan.isTest) plan.deload = deloadOn(entries, date, defaultDeloadPct);
  plan.phase = phaseOn(entries, date);
  return plan;
}

/** Sets after a deload: never below one. */
export function deloadSetCount(sets: number, fewerSets: number): number {
  return Math.max(1, sets - Math.max(0, fewerSets));
}

/**
 * A weight `pct` percent lighter, rounded to `roundToLb`. Always lighter than the input when the
 * input is above one rounding step, so a deload never rounds back up to the normal weight.
 */
export function deloadWeight(weightLb: number, pct: number, roundToLb: number): number {
  if (!(weightLb > 0) || !(pct > 0)) return weightLb;
  const step = roundToLb > 0 ? roundToLb : 1;
  const raw = weightLb * (1 - pct / 100);
  let out = Math.round(raw / step) * step;
  if (out >= weightLb) out = Math.floor((weightLb - 1e-9) / step) * step;
  return Math.max(0, Math.round(out * 1000) / 1000);
}

/** A copy of the routine with one fewer set (or `fewerSets`) per item. Weights are set per session. */
export function deloadRoutine(routine: Routine, rule: DeloadRule): Routine {
  return { ...routine, items: routine.items.map((item: RoutineItem) => ({ ...item, sets: deloadSetCount(item.sets, rule.fewerSets) })) };
}

/**
 * Applies a deload to pre-filled session sets: drops the last `fewerSets` sets of each exercise
 * (keeping at least one) and lowers target weights. `roundToLb` gives each exercise's rounding.
 */
export function deloadSets(sets: LoggedSet[], rule: DeloadRule, roundToLb: (exerciseId: string) => number): LoggedSet[] {
  const byExercise = new Map<string, LoggedSet[]>();
  for (const s of sets) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
  const keep = new Set<string>();
  for (const list of byExercise.values()) {
    const sorted = [...list].sort((a, b) => a.setNo - b.setNo);
    sorted.slice(0, deloadSetCount(sorted.length, rule.fewerSets)).forEach((s) => keep.add(s.id));
  }
  return sets
    .filter((s) => keep.has(s.id))
    .map((s) => (s.targetWeightLb ? { ...s, targetWeightLb: deloadWeight(s.targetWeightLb, rule.pct, roundToLb(s.exerciseId)) } : { ...s }));
}

/** Banner lines for Home: "Strength block · Week 3 of 6" and badges such as "Deload week". */
export function bannerFor(plan: DayPlan): { title?: string; badges: string[] } {
  const badges: string[] = [];
  if (plan.isTest) badges.push(plan.test?.name ? plan.test.name : 'Test day');
  if (plan.deload) badges.push(`Deload: ${plan.deload.pct}% lighter${plan.deload.fewerSets > 0 ? `, ${plan.deload.fewerSets} fewer set${plan.deload.fewerSets === 1 ? '' : 's'}` : ''}`);
  if (plan.swap && plan.routine) badges.push(`Swapped in: ${plan.routine.name}`);
  const p = plan.phase;
  const title = p ? `${p.entry.name} · Week ${p.week}${p.totalWeeks ? ` of ${p.totalWeeks}` : ''}` : undefined;
  return { title, badges };
}

/** Test days and deload starts in the next `days` days (today excluded), soonest first. */
export function upcoming(entries: CalendarEntry[], today: string, days = 14): { date: string; entry: CalendarEntry; label: string }[] {
  const out: { date: string; entry: CalendarEntry; label: string }[] = [];
  for (let i = 1; i <= days; i++) {
    const date = addDays(today, i);
    for (const e of entries) {
      if (e.type === 'test' && occursOn(e, date) && !occursOn(e, addDays(date, -1))) {
        out.push({ date, entry: e, label: `${e.name || 'Test day'} · ${formatShort(date)}` });
      }
      if (e.type === 'deload' && occursOn(e, date) && !occursOn(e, addDays(date, -1))) {
        out.push({ date, entry: e, label: `${e.name || 'Deload'} starts ${formatShort(date)}` });
      }
    }
  }
  return out;
}

/** Problems with a row before it is saved. Empty when the row is fine. */
export function calendarEntryErrors(entry: CalendarEntry, routines: Routine[]): string[] {
  const errors: string[] = [];
  const ids = new Set(routines.filter((r) => !r.archived).map((r) => r.id));
  if (!entry.name.trim()) errors.push('Enter a name.');
  if (!isIsoDate(entry.startDate)) errors.push('Pick a start date.');
  if (entry.endDate !== undefined) {
    if (!isIsoDate(entry.endDate)) errors.push('The end date is not a valid date.');
    else if (isIsoDate(entry.startDate) && compareDates(entry.endDate, entry.startDate) < 0) errors.push('The end date is before the start date.');
  }
  if (entry.everyWeeks !== undefined && !(Number.isInteger(entry.everyWeeks) && entry.everyWeeks >= 1 && entry.everyWeeks <= 52)) {
    errors.push('Repeat every 1 to 52 weeks.');
  }
  if (entry.type === 'deload') {
    if (entry.pct !== undefined && !(entry.pct > 0 && entry.pct <= 50)) errors.push('Make the deload 1 to 50% lighter.');
    if (entry.fewerSets !== undefined && !(Number.isInteger(entry.fewerSets) && entry.fewerSets >= 0 && entry.fewerSets <= 5)) {
      errors.push('Drop 0 to 5 sets.');
    }
  }
  if (entry.type === 'swap' && !(entry.routineId && ids.has(entry.routineId))) errors.push('Pick the routine to swap in.');
  if (entry.type === 'test' && entry.routineId && !ids.has(entry.routineId)) errors.push('That test routine no longer exists.');
  return errors;
}

/** A new row with sensible defaults, starting on `startDate`. */
export function newCalendarEntry(type: CalendarEntry['type'], startDate: string, id: string, defaultDeloadPct: number): CalendarEntry {
  switch (type) {
    case 'phase':
      return { id, type, name: '', startDate, endDate: addDays(startDate, 7 * 6 - 1) };
    case 'test':
      return { id, type, name: 'Test day', startDate };
    case 'deload':
      return { id, type, name: 'Deload week', startDate, endDate: addDays(startDate, 6), pct: defaultDeloadPct, fewerSets: DEFAULT_FEWER_SETS };
    case 'swap':
      return { id, type, name: '', startDate, everyWeeks: 2 };
  }
}

/** Rows sorted for the editor: by type, then start date. */
export function sortEntries(entries: CalendarEntry[]): CalendarEntry[] {
  const rank = { phase: 0, test: 1, deload: 2, swap: 3 } as const;
  return [...entries].sort((a, b) => rank[a.type] - rank[b.type] || compareDates(a.startDate, b.startDate) || a.name.localeCompare(b.name));
}

const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/** One-line summary of a row for the editor list. */
export function describeEntry(entry: CalendarEntry, routines: Routine[]): string {
  const name = (id?: string) => routines.find((r) => r.id === id)?.name;
  const span = entry.endDate ? `${formatShort(entry.startDate)} – ${formatShort(entry.endDate)}` : `From ${formatShort(entry.startDate)}`;
  const until = entry.endDate ? ` until ${formatShort(entry.endDate)}` : '';
  switch (entry.type) {
    case 'phase': {
      const weeks = entry.endDate ? Math.ceil((diffDays(entry.startDate, entry.endDate) + 1) / 7) : undefined;
      return weeks ? `${span} · ${weeks} week${weeks === 1 ? '' : 's'}` : span;
    }
    case 'test': {
      const when = entry.endDate && entry.endDate !== entry.startDate ? span : formatShort(entry.startDate);
      return `${when} · ${name(entry.routineId) ?? 'Planned routine'}`;
    }
    case 'deload': {
      const pct = entry.pct !== undefined ? `${entry.pct}% lighter` : 'Default % lighter';
      const sets = entry.fewerSets ?? DEFAULT_FEWER_SETS;
      const rule = `${pct}, ${sets} fewer set${sets === 1 ? '' : 's'}`;
      if (entry.everyWeeks) return `Every ${entry.everyWeeks} weeks from ${formatShort(entry.startDate)}${until} · ${rule}`;
      return `${formatShort(entry.startDate)} – ${formatShort(entry.endDate ?? addDays(entry.startDate, 6))} · ${rule}`;
    }
    case 'swap': {
      const every = entry.everyWeeks ?? 1;
      const day = DAY_NAMES[weekday(entry.startDate)];
      const cadence = every === 1 ? `${day}` : `${day} every ${every} weeks`;
      return `${name(entry.routineId) ?? 'Missing routine'} on ${cadence} from ${formatShort(entry.startDate)}${until}`;
    }
  }
}
