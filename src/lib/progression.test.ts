import { describe, expect, test } from 'vitest';
import type { Exercise, LoggedSet, RoutineItem } from '../db/types';
import {
  derivedWeight, hitAllReps, nextTarget, repRange, roundTo, runDistanceMi, stallStatus, workingWeight,
} from './progression';
import { planItem } from './prefill';

const ex = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'ex', name: 'Test lift', kind: 'barbell', incrementLb: 5, roundToLb: 5, autoIncrease: true, isMain: false, archived: false, ...over,
});
const item = (over: Partial<RoutineItem> = {}): RoutineItem => ({ exerciseId: 'ex', sets: 3, reps: 5, ...over });
const set = (weightLb: number | undefined, reps: number, targetReps: number, over: Partial<LoggedSet> = {}): LoggedSet => ({
  id: crypto.randomUUID(), sessionId: 's', exerciseId: 'ex', order: 0, setNo: 1,
  targetWeightLb: weightLb, targetReps, weightLb, reps, done: true, skipped: false, ...over,
});
const sets = (n: number, w: number | undefined, reps: number, target: number) => Array.from({ length: n }, () => set(w, reps, target));
const on = { autoIncreaseGlobal: true, maxEffort: 8 };

describe('rounding', () => {
  test('rounds to the plate step and trims float noise', () => {
    expect(roundTo(137.4, 5)).toBe(135);
    expect(roundTo(137.5, 5)).toBe(140);
    expect(roundTo(26.1, 2.5)).toBe(25);
    expect(roundTo(26.3, 2.5)).toBe(27.5);
    expect(roundTo(0.1 + 0.2, 0)).toBe(0.3);
  });
});

describe('helpers', () => {
  test('hitAllReps needs every set done, unskipped and at target', () => {
    expect(hitAllReps(sets(3, 100, 5, 5))).toBe(true);
    expect(hitAllReps([...sets(2, 100, 5, 5), set(100, 4, 5)])).toBe(false);
    expect(hitAllReps([...sets(2, 100, 5, 5), set(100, 5, 5, { skipped: true, done: false })])).toBe(false);
    expect(hitAllReps([])).toBe(false);
  });

  test('workingWeight is the heaviest done set, else the heaviest target', () => {
    expect(workingWeight([set(100, 5, 5), set(110, 5, 5)])).toBe(110);
    expect(workingWeight([set(100, 0, 5, { done: false, skipped: true })])).toBe(100);
    expect(workingWeight([set(undefined, 8, 8)])).toBeUndefined();
  });

  test('repRange prefers the routine item, then the exercise', () => {
    expect(repRange(ex(), item())).toBeUndefined();
    expect(repRange(ex({ repMin: 8, repMax: 12 }), item())).toEqual({ min: 8, max: 12 });
    expect(repRange(ex({ repMin: 8, repMax: 12 }), item({ reps: 6, repsMax: 10 }))).toEqual({ min: 6, max: 10 });
  });
});

describe('nextTarget: auto-increase', () => {
  test('no history: no weight, plan reps', () => {
    expect(nextTarget({ exercise: ex(), item: item(), ...on })).toEqual({ reps: 5 });
  });

  test('adds the increment when every set hit and effort is fine', () => {
    expect(nextTarget({ exercise: ex(), item: item(), last: { sets: sets(3, 135, 5, 5), effort: 8 }, ...on })).toEqual({ weightLb: 140, reps: 5 });
    expect(nextTarget({ exercise: ex(), item: item(), last: { sets: sets(3, 135, 5, 5) }, ...on }).weightLb).toBe(140);
    expect(nextTarget({ exercise: ex({ incrementLb: 10 }), item: item(), last: { sets: sets(3, 225, 5, 5) }, ...on }).weightLb).toBe(235);
  });

  test('holds on a missed rep, effort > 8, either switch off, or history from another routine', () => {
    const last = { sets: [...sets(2, 135, 5, 5), set(135, 4, 5)] };
    expect(nextTarget({ exercise: ex(), item: item(), last, ...on }).weightLb).toBe(135);
    expect(nextTarget({ exercise: ex(), item: item(), last: { sets: sets(3, 135, 5, 5), effort: 9 }, ...on }).weightLb).toBe(135);
    expect(nextTarget({ exercise: ex(), item: item(), last: { sets: sets(3, 135, 5, 5) }, autoIncreaseGlobal: false, maxEffort: 8 }).weightLb).toBe(135);
    expect(nextTarget({ exercise: ex({ autoIncrease: false }), item: item(), last: { sets: sets(3, 135, 5, 5) }, ...on }).weightLb).toBe(135);
    expect(nextTarget({ exercise: ex(), item: item(), last: { sets: sets(3, 135, 5, 5) }, sameRoutine: false, ...on }).weightLb).toBe(135);
  });

  test('dumbbells round to 2.5', () => {
    const db = ex({ kind: 'dumbbell', incrementLb: 2.5, roundToLb: 2.5 });
    expect(nextTarget({ exercise: db, item: item(), last: { sets: sets(3, 25, 5, 5) }, ...on }).weightLb).toBe(27.5);
  });

  test('bodyweight lifts without weight keep no weight', () => {
    const bw = ex({ kind: 'bodyweight', incrementLb: 0 });
    expect(nextTarget({ exercise: bw, item: item({ reps: 8 }), last: { sets: sets(3, undefined, 8, 8) }, ...on })).toEqual({ weightLb: undefined, reps: 8 });
  });
});

describe('nextTarget: rep ranges', () => {
  const rr = item({ reps: 8, repsMax: 12 });

  test('starts at repMin, adds a rep per success up to repMax', () => {
    expect(nextTarget({ exercise: ex(), item: rr, ...on })).toEqual({ reps: 8 });
    expect(nextTarget({ exercise: ex(), item: rr, last: { sets: sets(3, 50, 8, 8) }, ...on })).toEqual({ weightLb: 50, reps: 9 });
    expect(nextTarget({ exercise: ex(), item: rr, last: { sets: sets(3, 50, 11, 11) }, ...on })).toEqual({ weightLb: 50, reps: 12 });
  });

  test('all sets at repMax: + increment and back to repMin', () => {
    expect(nextTarget({ exercise: ex(), item: rr, last: { sets: sets(3, 50, 12, 12) }, ...on })).toEqual({ weightLb: 55, reps: 8 });
  });

  test('a miss holds weight and reps', () => {
    expect(nextTarget({ exercise: ex(), item: rr, last: { sets: [...sets(2, 50, 10, 10), set(50, 9, 10)] }, ...on })).toEqual({ weightLb: 50, reps: 10 });
  });

  test('uses the exercise range when the item has none; bodyweight stays at repMax', () => {
    const e = ex({ kind: 'bodyweight', incrementLb: 0, repMin: 6, repMax: 10 });
    expect(nextTarget({ exercise: e, item: item({ reps: 6 }), last: { sets: sets(3, undefined, 10, 10) }, ...on })).toEqual({ weightLb: undefined, reps: 10 });
    expect(nextTarget({ exercise: e, item: item({ reps: 6 }), last: { sets: sets(3, undefined, 7, 7) }, ...on })).toEqual({ weightLb: undefined, reps: 8 });
  });
});

describe('derived lifts', () => {
  test('percent of the source weight, rounded to the exercise step', () => {
    expect(derivedWeight(225, 80, 5)).toBe(180);
    expect(derivedWeight(230, 75, 5)).toBe(175); // 172.5 rounds up
    expect(derivedWeight(60, 55, 2.5)).toBe(32.5);
    expect(derivedWeight(undefined, 80, 5)).toBeUndefined();
    expect(derivedWeight(200, 0, 5)).toBeUndefined();
  });

  test('planItem uses the source weight and falls back to its own history', () => {
    const e = ex({ derivedFrom: { exerciseId: 'src', routineId: 'r', pct: 90 } });
    const base = { exercise: e, item: item({ sets: 2, reps: 3 }), date: '2024-01-01', ...on };
    expect(planItem({ ...base, sourceWeightLb: 200 }).map((s) => s.targetWeightLb)).toEqual([180, 180]);
    expect(planItem({ ...base, last: { sets: sets(2, 100, 3, 3) } }).map((s) => s.targetWeightLb)).toEqual([105, 105]);
  });
});

describe('stall rule', () => {
  test('two consecutive weeks of misses stall and suggest -10%, rounded', () => {
    const r = stallStatus([
      { date: '2024-03-04', hitAll: false, weightLb: 185 },
      { date: '2024-03-13', hitAll: false, weightLb: 185 },
    ], 2, 10, 5);
    expect(r).toEqual({ stalled: true, weeks: 2, lastWeightLb: 185, suggestedWeightLb: 165 }); // 166.5 -> 165
  });

  test('one week, a gap week, or a hit in the latest session is not a stall', () => {
    expect(stallStatus([{ date: '2024-03-04', hitAll: false, weightLb: 100 }], 2, 10, 5).stalled).toBe(false);
    expect(stallStatus([
      { date: '2024-03-04', hitAll: false }, { date: '2024-03-18', hitAll: false },
    ], 2, 10, 5).stalled).toBe(false);
    expect(stallStatus([
      { date: '2024-03-04', hitAll: false }, { date: '2024-03-11', hitAll: false }, { date: '2024-03-13', hitAll: true },
    ], 2, 10, 5).stalled).toBe(false);
    expect(stallStatus([], 2, 10, 5)).toEqual({ stalled: false, weeks: 0 });
  });

  test('a week counts by its last session', () => {
    expect(stallStatus([
      { date: '2024-03-04', hitAll: true }, { date: '2024-03-06', hitAll: false, weightLb: 100 },
      { date: '2024-03-11', hitAll: false, weightLb: 100 },
    ], 2, 10, 5).stalled).toBe(true);
  });

  test('stallWeeks and deloadPct come from settings', () => {
    const out = [
      { date: '2024-03-04', hitAll: false, weightLb: 100 }, { date: '2024-03-11', hitAll: false, weightLb: 100 },
      { date: '2024-03-18', hitAll: false, weightLb: 100 },
    ];
    expect(stallStatus(out, 3, 20, 5)).toMatchObject({ stalled: true, suggestedWeightLb: 80 });
    expect(stallStatus(out.slice(1), 3, 20, 5).stalled).toBe(false);
  });
});

describe('run distance progression', () => {
  const p = { startMi: 1.5, stepMi: 0.25, everyWeeks: 2, fromDate: '2024-01-01', capMi: 3 };

  test('start distance before and at fromDate', () => {
    expect(runDistanceMi(p, '2023-12-01')).toBe(1.5);
    expect(runDistanceMi(p, '2024-01-01')).toBe(1.5);
    expect(runDistanceMi(p, '2024-01-14')).toBe(1.5);
  });

  test('steps every N weeks, then stops at the cap', () => {
    expect(runDistanceMi(p, '2024-01-15')).toBe(1.75);
    expect(runDistanceMi(p, '2024-02-12')).toBe(2.25); // 6 weeks = 3 steps
    expect(runDistanceMi(p, '2024-06-01')).toBe(3);
  });

  test('planItem turns miles into meters for run sets', () => {
    const run = ex({ kind: 'run', incrementLb: 0, roundToLb: 0 });
    const routine = { id: 'r', name: 'Run', order: 0, archived: false, items: [], distanceProgression: p };
    expect(planItem({ exercise: run, item: item({ sets: 1, reps: 1 }), routine, date: '2024-01-15', ...on })[0]).toMatchObject({ distanceM: 2816 });
    // Interval reps: a run item with several sets and a per-rep distance and time.
    const reps = planItem({ exercise: run, item: item({ sets: 6, reps: 1, distanceM: 400, targetTimeSec: 100 }), date: '2024-01-15', ...on });
    expect(reps).toHaveLength(6);
    expect(reps[5]).toMatchObject({ setNo: 6, distanceM: 400, timeSec: 100 });
  });
});
