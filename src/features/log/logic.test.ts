import { describe, expect, test } from 'vitest';
import type { LoggedSet } from '../../db/types';
import { defaultDuration, findPrs, firstSet, groupByExercise, setAfter, summarize, swapExercise, tapExercise } from './logic';

const mk = (p: Partial<LoggedSet>): LoggedSet => ({
  id: Math.random().toString(36), sessionId: 'today', exerciseId: 'a', order: 0, setNo: 1,
  targetWeightLb: 100, targetReps: 5, done: false, skipped: false, ...p,
});

describe('grouping', () => {
  test('keeps session order and set numbers', () => {
    const sets = [mk({ exerciseId: 'b', order: 1, setNo: 2 }), mk({ exerciseId: 'a', order: 0, setNo: 2 }), mk({ exerciseId: 'b', order: 1, setNo: 1 }), mk({ exerciseId: 'a', setNo: 1 })];
    const groups = groupByExercise(sets);
    expect(groups.map((g) => g.exerciseId)).toEqual(['a', 'b']);
    expect(groups[1].sets.map((s) => s.setNo)).toEqual([1, 2]);
  });
});

describe('adding sets and exercises', () => {
  test('add set copies the last set, using what was actually lifted', () => {
    const last = mk({ setNo: 3, order: 2, done: true, weightLb: 105, reps: 5 });
    const next = setAfter([mk({}), last], 'today', 'a');
    expect(next).toMatchObject({ setNo: 4, order: 2, targetWeightLb: 105, targetReps: 5, done: false });
  });
  test('a new exercise goes last and is planned from its previous set', () => {
    const s = firstSet([mk({ order: 0 }), mk({ order: 3 })], 'today', 'c', { weightLb: 40, reps: 10 });
    expect(s).toMatchObject({ order: 4, setNo: 1, exerciseId: 'c', targetWeightLb: 40, targetReps: 10 });
  });
});

describe('tapping an exercise', () => {
  test('marks open sets done as planned and leaves skipped ones', () => {
    const group = [mk({ setNo: 1, done: true, weightLb: 100, reps: 4 }), mk({ setNo: 2 }), mk({ setNo: 3, skipped: true })];
    const changed = tapExercise(group, 'barbell');
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ setNo: 2, done: true, weightLb: 100, reps: 5 });
  });
  test('clears when everything is already done', () => {
    const changed = tapExercise([mk({ done: true }), mk({ done: true, setNo: 2 })], 'barbell');
    expect(changed.every((s) => !s.done)).toBe(true);
  });
  test('swap keeps the sets and changes the exercise', () => {
    expect(swapExercise([mk({}), mk({ setNo: 2 })], 'z').map((s) => s.exerciseId)).toEqual(['z', 'z']);
  });
});

describe('finish summary', () => {
  test('volume, set counts and duration', () => {
    const sets = [mk({ done: true, weightLb: 100, reps: 5 }), mk({ done: true, weightLb: 100, reps: 3 }), mk({ skipped: true })];
    expect(summarize(sets)).toEqual({ volumeLb: 800, doneSets: 2, skippedSets: 1 });
    expect(defaultDuration(0, 45 * 60_000 + 20_000)).toBe(45);
    expect(defaultDuration(1000, 1000)).toBe(1);
  });
  test('a PR beats the best earlier e1RM; a first-ever session is not a PR', () => {
    const today = [mk({ done: true, weightLb: 110, reps: 5 }), mk({ exerciseId: 'new', done: true, weightLb: 50, reps: 5 })];
    const history = { a: [{ sessionId: 'old', done: true, weightLb: 100, reps: 5 }] };
    const prs = findPrs(today, history);
    expect(prs).toHaveLength(1);
    expect(prs[0].exerciseId).toBe('a');
    expect(prs[0].e1rm).toBeCloseTo(110 * (1 + 5 / 30));
  });
  test('sets over 10 reps never count toward a PR', () => {
    expect(findPrs([mk({ done: true, weightLb: 100, reps: 12 })], { a: [{ sessionId: 'old', done: true, weightLb: 50, reps: 5 }] })).toEqual([]);
  });
});
