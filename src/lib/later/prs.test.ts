import { describe, expect, test } from 'vitest';
import type { LoggedSet } from '../../db/types';
import { describePr, findPrs, formatDistance, formatSeconds, prFeed } from './prs';

let n = 0;
function set(date: string, fields: Partial<LoggedSet>): LoggedSet & { date: string } {
  n++;
  return { id: `s${n}`, sessionId: `x-${date}`, exerciseId: 'e', order: 0, setNo: n, done: true, skipped: false, date, ...fields };
}

describe('findPrs', () => {
  const lift = { id: 'e', kind: 'barbell' as const };

  test('the first day is a baseline, not a PR', () => {
    expect(findPrs(lift, [set('2000-01-01', { weightLb: 100, reps: 5 })])).toEqual([]);
  });

  test('heavier weight and better e1RM', () => {
    const prs = findPrs(lift, [
      set('2000-01-01', { weightLb: 100, reps: 5 }),
      set('2000-01-03', { weightLb: 105, reps: 5 }),
      set('2000-01-03', { weightLb: 105, reps: 3 }),
    ]);
    expect(prs.map((p) => [p.kind, p.value, p.previous])).toEqual([['weight', 105, 100], ['e1rm', expect.any(Number), expect.any(Number)]]);
    expect(prs[1].value).toBeCloseTo(122.5);
    expect(prs[1].previous).toBeCloseTo(116.67, 2);
    expect(prs[0].set.reps).toBe(5);
  });

  test('more reps at the same weight is an e1RM PR only', () => {
    const prs = findPrs(lift, [set('2000-01-01', { weightLb: 100, reps: 5 }), set('2000-01-02', { weightLb: 100, reps: 6 })]);
    expect(prs.map((p) => p.kind)).toEqual(['e1rm']);
  });

  test('sets over 10 reps never make an e1RM PR', () => {
    const prs = findPrs(lift, [set('2000-01-01', { weightLb: 100, reps: 5 }), set('2000-01-02', { weightLb: 100, reps: 15 })]);
    expect(prs).toEqual([]);
  });

  test('skipped and not-done sets do not count', () => {
    const prs = findPrs(lift, [
      set('2000-01-01', { weightLb: 100, reps: 5 }),
      set('2000-01-02', { weightLb: 200, reps: 5, skipped: true }),
      set('2000-01-02', { weightLb: 200, reps: 5, done: false }),
    ]);
    expect(prs).toEqual([]);
  });

  test('a later day must beat the best so far, not just the previous day', () => {
    const prs = findPrs(lift, [
      set('2000-01-01', { weightLb: 120, reps: 1 }),
      set('2000-01-02', { weightLb: 100, reps: 1 }),
      set('2000-01-03', { weightLb: 110, reps: 1 }),
    ]);
    expect(prs.filter((p) => p.kind === 'weight')).toEqual([]);
  });

  test('bodyweight reps use strict reps when logged', () => {
    const prs = findPrs({ id: 'e', kind: 'bodyweight' }, [
      set('2000-01-01', { reps: 8, strictReps: 4 }),
      set('2000-01-02', { reps: 8, strictReps: 5 }),
    ]);
    expect(prs.map((p) => [p.kind, p.value, p.previous])).toEqual([['reps', 5, 4]]);
  });

  test('holds', () => {
    const prs = findPrs({ id: 'e', kind: 'hold' }, [set('2000-01-01', { holdSec: 30 }), set('2000-01-02', { holdSec: 45 })]);
    expect(prs.map((p) => [p.kind, p.value])).toEqual([['hold', 45]]);
  });

  test('runs: longest distance, and fastest time compared only at the same distance', () => {
    const prs = findPrs({ id: 'e', kind: 'run' }, [
      set('2000-01-01', { distanceM: 400, timeSec: 100 }),
      set('2000-01-02', { distanceM: 800, timeSec: 220 }),
      set('2000-01-03', { distanceM: 400, timeSec: 95 }),
    ]);
    expect(prs.map((p) => [p.kind, p.value, p.previous])).toEqual([
      ['distance', 800, 400],
      ['fastest', 95, 100],
    ]);
  });
});

test('prFeed sorts newest first and limits', () => {
  const a = { id: 'a', kind: 'barbell' as const, name: 'Squat' };
  const b = { id: 'b', kind: 'hold' as const, name: 'Dead hang' };
  const feed = prFeed([
    { exercise: a, history: [set('2000-01-01', { weightLb: 100, reps: 1 }), set('2000-01-05', { weightLb: 110, reps: 1 })] },
    { exercise: b, history: [set('2000-01-01', { holdSec: 10 }), set('2000-01-09', { holdSec: 20 })] },
  ]);
  // The squat set is both heaviest and best e1RM, so it shows once.
  expect(feed.map((p) => [p.date, p.exerciseId, p.kind])).toEqual([
    ['2000-01-09', 'b', 'hold'],
    ['2000-01-05', 'a', 'weight'],
  ]);
  expect(prFeed([{ exercise: a, history: [set('2000-01-01', { weightLb: 1, reps: 1 }), set('2000-01-02', { weightLb: 2, reps: 1 })] }], 1)).toHaveLength(1);
});

test('describePr and formatting', () => {
  const [pr] = findPrs({ id: 'e', kind: 'barbell' }, [set('2000-01-01', { weightLb: 100, reps: 3 }), set('2000-01-02', { weightLb: 105, reps: 3 })]);
  expect(describePr(pr)).toEqual({ title: 'Heaviest: 105 lb × 3', detail: 'was 100 lb' });
  expect(formatSeconds(45)).toBe('45 s');
  expect(formatSeconds(125)).toBe('2:05');
  expect(formatDistance(400)).toBe('400 m');
  expect(formatDistance(3218.688)).toBe('2 mi');
});

test('prFeed keeps an e1RM PR from a different set than the weight PR', () => {
  const a = { id: 'a', kind: 'barbell' as const, name: 'Bench' };
  const feed = prFeed([{ exercise: a, history: [
    set('2000-01-01', { weightLb: 100, reps: 5 }),
    set('2000-01-02', { weightLb: 105, reps: 1 }),
    set('2000-01-02', { weightLb: 95, reps: 10 }),
  ] }]);
  expect(feed.map((p) => [p.kind, p.set.weightLb])).toEqual([['e1rm', 95], ['weight', 105]]);
});
