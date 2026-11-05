import { describe, expect, test } from 'vitest';
import type { CalendarEntry, LoggedSet, Routine } from '../../db/types';
import {
  bannerFor, calendarEntryErrors, deloadRoutine, deloadSetCount, deloadSets, deloadWeight, newCalendarEntry,
  occursOn, phaseOn, planDay, sortEntries, upcoming,
} from './calendar';

// Made-up rows. 2000-01-03 is a Monday.
const routine = (id: string, extra: Partial<Routine> = {}): Routine => ({
  id, name: id, order: 0, archived: false, items: [{ exerciseId: 'sq', sets: 3, reps: 5 }, { exerciseId: 'bp', sets: 1, reps: 5 }], ...extra,
});
const A = routine('A', { weekday: 1 });
const B = routine('B');
const T = routine('T', { isTest: true });
const routines = [A, B, T];
const entry = (e: Partial<CalendarEntry> & Pick<CalendarEntry, 'type' | 'startDate'>): CalendarEntry => ({ id: Math.random().toString(36), name: e.type, ...e });

describe('occursOn', () => {
  test('phase covers its span, open-ended without an end date', () => {
    const p = entry({ type: 'phase', startDate: '2000-01-03', endDate: '2000-01-30' });
    expect(occursOn(p, '2000-01-02')).toBe(false);
    expect(occursOn(p, '2000-01-03')).toBe(true);
    expect(occursOn(p, '2000-01-30')).toBe(true);
    expect(occursOn(p, '2000-01-31')).toBe(false);
    expect(occursOn(entry({ type: 'phase', startDate: '2000-01-03' }), '2001-01-01')).toBe(true);
  });

  test('test is one day unless it has an end date', () => {
    expect(occursOn(entry({ type: 'test', startDate: '2000-01-07' }), '2000-01-07')).toBe(true);
    expect(occursOn(entry({ type: 'test', startDate: '2000-01-07' }), '2000-01-08')).toBe(false);
    expect(occursOn(entry({ type: 'test', startDate: '2000-01-07', endDate: '2000-01-08' }), '2000-01-08')).toBe(true);
  });

  test('deload is a week, or repeats every N weeks', () => {
    const once = entry({ type: 'deload', startDate: '2000-01-03' });
    expect(occursOn(once, '2000-01-09')).toBe(true);
    expect(occursOn(once, '2000-01-10')).toBe(false);
    const every4 = entry({ type: 'deload', startDate: '2000-01-24', everyWeeks: 4, endDate: '2000-03-31' });
    expect(occursOn(every4, '2000-01-24')).toBe(true);
    expect(occursOn(every4, '2000-01-30')).toBe(true);
    expect(occursOn(every4, '2000-01-31')).toBe(false);
    expect(occursOn(every4, '2000-02-21')).toBe(true);
    expect(occursOn(every4, '2000-03-20')).toBe(true);
    expect(occursOn(every4, '2000-04-17')).toBe(false); // past the end date
  });

  test('swap repeats on its weekday every N weeks', () => {
    const s = entry({ type: 'swap', startDate: '2000-01-03', everyWeeks: 2, routineId: 'B' });
    expect(occursOn(s, '2000-01-03')).toBe(true);
    expect(occursOn(s, '2000-01-10')).toBe(false);
    expect(occursOn(s, '2000-01-17')).toBe(true);
    expect(occursOn(s, '2000-01-18')).toBe(false);
    expect(occursOn(entry({ type: 'swap', startDate: '2000-01-03' }), '2000-01-10')).toBe(true);
  });
});

describe('planDay', () => {
  test('no calendar: weekday routine as is', () => {
    expect(planDay('2000-01-03', [], routines, A, 10)).toMatchObject({ routine: A, source: 'weekday', isTest: false });
    expect(planDay('2000-01-04', [], routines, undefined, 10)).toMatchObject({ routine: undefined, source: 'none' });
  });

  test('swap replaces the weekday routine on its weeks', () => {
    const rows = [entry({ type: 'swap', startDate: '2000-01-03', everyWeeks: 2, routineId: 'B' })];
    expect(planDay('2000-01-03', rows, routines, A, 10)).toMatchObject({ routine: B, source: 'swap', replaced: A });
    expect(planDay('2000-01-10', rows, routines, A, 10)).toMatchObject({ routine: A, source: 'weekday' });
  });

  test('swap can fill a day with no routine', () => {
    const rows = [entry({ type: 'swap', startDate: '2000-01-08', routineId: 'B' })];
    expect(planDay('2000-01-08', rows, routines, undefined, 10)).toMatchObject({ routine: B, source: 'swap' });
  });

  test('swap to an archived or missing routine is ignored', () => {
    const rows = [entry({ type: 'swap', startDate: '2000-01-03', routineId: 'gone' })];
    expect(planDay('2000-01-03', rows, routines, A, 10)).toMatchObject({ routine: A, source: 'weekday' });
    const archived = [A, { ...B, archived: true }];
    expect(planDay('2000-01-03', [entry({ type: 'swap', startDate: '2000-01-03', routineId: 'B' })], archived, A, 10).routine).toBe(A);
  });

  test('test day beats swap and skips the deload', () => {
    const rows = [
      entry({ type: 'swap', startDate: '2000-01-03', routineId: 'B' }),
      entry({ type: 'deload', startDate: '2000-01-03' }),
      entry({ type: 'test', startDate: '2000-01-03', routineId: 'T', name: 'Max test' }),
    ];
    const plan = planDay('2000-01-03', rows, routines, A, 10);
    expect(plan).toMatchObject({ routine: T, source: 'test', isTest: true, replaced: A });
    expect(plan.deload).toBeUndefined();
    expect(bannerFor(plan).badges).toEqual(['Max test', 'Swapped in: T']);
  });

  test('test day without a routine keeps the plan and marks it', () => {
    const plan = planDay('2000-01-03', [entry({ type: 'test', startDate: '2000-01-03' })], routines, A, 10);
    expect(plan).toMatchObject({ routine: A, source: 'weekday', isTest: true });
  });

  test('deload uses its own numbers or the settings default', () => {
    const own = planDay('2000-01-03', [entry({ type: 'deload', startDate: '2000-01-03', pct: 20, fewerSets: 2 })], routines, A, 10);
    expect(own.deload).toMatchObject({ pct: 20, fewerSets: 2 });
    const dflt = planDay('2000-01-03', [entry({ type: 'deload', startDate: '2000-01-03' })], routines, A, 15);
    expect(dflt.deload).toMatchObject({ pct: 15, fewerSets: 1 });
    expect(bannerFor(dflt).badges).toEqual(['Deload: 15% lighter, 1 fewer set']);
  });

  test('later rows override earlier overlapping rows', () => {
    const rows = [
      entry({ type: 'phase', startDate: '2000-01-03', name: 'Base' }),
      entry({ type: 'phase', startDate: '2000-02-07', endDate: '2000-03-19', name: 'Peak' }),
    ];
    expect(planDay('2000-01-20', rows, routines, A, 10).phase?.entry.name).toBe('Base');
    expect(planDay('2000-02-15', rows, routines, A, 10).phase?.entry.name).toBe('Peak');
  });
});

describe('phase banner', () => {
  const p = entry({ type: 'phase', startDate: '2000-01-03', endDate: '2000-02-13', name: 'Strength block' });

  test('week numbers and days left', () => {
    expect(phaseOn([p], '2000-01-03')).toMatchObject({ week: 1, totalWeeks: 6, daysLeft: 41 });
    expect(phaseOn([p], '2000-01-10')).toMatchObject({ week: 2 });
    expect(phaseOn([p], '2000-02-13')).toMatchObject({ week: 6, daysLeft: 0 });
    expect(phaseOn([p], '2000-02-14')).toBeUndefined();
  });

  test('banner title', () => {
    expect(bannerFor(planDay('2000-01-17', [p], routines, A, 10))).toEqual({ title: 'Strength block · Week 3 of 6', badges: [] });
    const open = entry({ type: 'phase', startDate: '2000-01-03', name: 'Base' });
    expect(bannerFor(planDay('2000-01-17', [open], routines, A, 10)).title).toBe('Base · Week 3');
    expect(bannerFor(planDay('2000-01-17', [], routines, A, 10))).toEqual({ title: undefined, badges: [] });
  });
});

describe('deload math', () => {
  test('one fewer set, never below one', () => {
    expect(deloadSetCount(3, 1)).toBe(2);
    expect(deloadSetCount(1, 1)).toBe(1);
    expect(deloadSetCount(3, 0)).toBe(3);
    expect(deloadSetCount(3, -2)).toBe(3);
  });

  test('percent lighter, rounded, and always lighter', () => {
    expect(deloadWeight(200, 10, 5)).toBe(180);
    expect(deloadWeight(135, 10, 5)).toBe(120); // 121.5 rounds to 120
    expect(deloadWeight(25, 10, 2.5)).toBe(22.5);
    expect(deloadWeight(10, 5, 5)).toBe(5); // 9.5 would round back up to 10
    expect(deloadWeight(0, 10, 5)).toBe(0);
    expect(deloadWeight(100, 0, 5)).toBe(100);
  });

  test('deloadRoutine drops sets and leaves the original alone', () => {
    const out = deloadRoutine(A, { pct: 10, fewerSets: 1 });
    expect(out.items.map((i) => i.sets)).toEqual([2, 1]);
    expect(A.items.map((i) => i.sets)).toEqual([3, 1]);
  });

  test('deloadSets drops the last sets per exercise and lowers targets', () => {
    const s = (id: string, exerciseId: string, setNo: number, targetWeightLb?: number): LoggedSet => ({
      id, sessionId: 'x', exerciseId, order: 0, setNo, targetWeightLb, targetReps: 5, done: false, skipped: false,
    });
    const sets = [s('1', 'sq', 1, 200), s('2', 'sq', 2, 200), s('3', 'sq', 3, 200), s('4', 'curl', 1, 25), s('5', 'hang', 1)];
    const out = deloadSets(sets, { pct: 10, fewerSets: 1 }, (id) => (id === 'curl' ? 2.5 : 5));
    expect(out.map((x) => [x.id, x.targetWeightLb])).toEqual([['1', 180], ['2', 180], ['4', 22.5], ['5', undefined]]);
    expect(sets[0].targetWeightLb).toBe(200);
  });
});

describe('editor helpers', () => {
  test('upcoming lists test days and deload starts', () => {
    const rows = [
      entry({ type: 'test', startDate: '2000-01-07', name: 'Max test' }),
      entry({ type: 'deload', startDate: '2000-01-10', name: 'Deload week' }),
      entry({ type: 'test', startDate: '2000-03-01' }),
    ];
    expect(upcoming(rows, '2000-01-03', 14).map((u) => u.label)).toEqual(['Max test · Fri Jan 7', 'Deload week starts Mon Jan 10']);
    expect(upcoming(rows, '2000-01-11', 14)).toEqual([]); // already inside the deload
  });

  test('validation', () => {
    const ok = newCalendarEntry('deload', '2000-01-03', 'id', 10);
    expect(calendarEntryErrors(ok, routines)).toEqual([]);
    expect(calendarEntryErrors({ ...ok, name: ' ' }, routines)).toEqual(['Enter a name.']);
    expect(calendarEntryErrors({ ...ok, endDate: '2000-01-01' }, routines)).toEqual(['The end date is before the start date.']);
    expect(calendarEntryErrors({ ...ok, pct: 80, fewerSets: 1.5 }, routines)).toEqual(['Make the deload 1 to 50% lighter.', 'Drop 0 to 5 sets.']);
    expect(calendarEntryErrors({ ...ok, startDate: '2000-02-30' }, routines)).toEqual(['Pick a start date.']);
    const swap = { ...newCalendarEntry('swap', '2000-01-03', 'id', 10), name: 'Swap' };
    expect(calendarEntryErrors(swap, routines)).toEqual(['Pick the routine to swap in.']);
    expect(calendarEntryErrors({ ...swap, routineId: 'B', everyWeeks: 0 }, routines)).toEqual(['Repeat every 1 to 52 weeks.']);
    expect(calendarEntryErrors({ ...newCalendarEntry('test', '2000-01-03', 'id', 10), routineId: 'gone' }, routines)).toEqual(['That test routine no longer exists.']);
  });

  test('new rows get defaults', () => {
    expect(newCalendarEntry('phase', '2000-01-03', 'p', 10)).toMatchObject({ endDate: '2000-02-13' });
    expect(newCalendarEntry('deload', '2000-01-03', 'd', 12)).toMatchObject({ endDate: '2000-01-09', pct: 12, fewerSets: 1 });
    expect(newCalendarEntry('swap', '2000-01-03', 's', 10)).toMatchObject({ everyWeeks: 2 });
  });

  test('sortEntries groups by type then date', () => {
    const rows = [
      entry({ type: 'swap', startDate: '2000-01-01' }),
      entry({ type: 'phase', startDate: '2000-02-01' }),
      entry({ type: 'phase', startDate: '2000-01-01' }),
    ];
    expect(sortEntries(rows).map((r) => `${r.type}:${r.startDate}`)).toEqual(['phase:2000-01-01', 'phase:2000-02-01', 'swap:2000-01-01']);
  });
});

test('describeEntry', async () => {
  const { describeEntry } = await import('./calendar');
  expect(describeEntry(entry({ type: 'phase', startDate: '2000-01-03', endDate: '2000-02-13' }), routines)).toBe('Mon Jan 3 – Sun Feb 13 · 6 weeks');
  expect(describeEntry(entry({ type: 'phase', startDate: '2000-01-03' }), routines)).toBe('From Mon Jan 3');
  expect(describeEntry(entry({ type: 'test', startDate: '2000-01-07', routineId: 'T' }), routines)).toBe('Fri Jan 7 · T');
  expect(describeEntry(entry({ type: 'test', startDate: '2000-01-07' }), routines)).toBe('Fri Jan 7 · Planned routine');
  expect(describeEntry(entry({ type: 'deload', startDate: '2000-01-03', pct: 10, fewerSets: 1 }), routines)).toBe('Mon Jan 3 – Sun Jan 9 · 10% lighter, 1 fewer set');
  expect(describeEntry(entry({ type: 'deload', startDate: '2000-01-24', everyWeeks: 4, pct: 10 }), routines)).toBe('Every 4 weeks from Mon Jan 24 · 10% lighter, 1 fewer set');
  expect(describeEntry(entry({ type: 'swap', startDate: '2000-01-03', everyWeeks: 2, routineId: 'B' }), routines)).toBe('B on Mondays every 2 weeks from Mon Jan 3');
  expect(describeEntry(entry({ type: 'swap', startDate: '2000-01-08', routineId: 'B', endDate: '2000-03-25' }), routines)).toBe('B on Saturdays from Sat Jan 8 until Sat Mar 25');
});
