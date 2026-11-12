import { expect, test } from 'vitest';
import type { Exercise } from '../../db/types';
import type { DatedSet } from '../../lib/stats';
import { buildTrophy, DEFAULT_TIERS, isTierUp, mainLiftOf, sortMainLifts, tiersFor } from './trophy';

// Made-up sample data only.
const ex = (id: string, name: string): Exercise => ({
  id, name, kind: 'barbell', incrementLb: 5, roundToLb: 5, autoIncrease: true, isMain: true, archived: false,
});
const set = (weightLb: number, reps: number, date = '2026-01-05'): DatedSet => ({
  id: `${weightLb}-${reps}-${date}`, sessionId: date, exerciseId: 'sq', order: 0, setNo: 1, weightLb, reps, done: true, skipped: false, date,
});

test('main lift names match exactly', () => {
  expect(mainLiftOf('Squat')).toBe('squat');
  expect(mainLiftOf(' Bench Press ')).toBe('bench');
  expect(mainLiftOf('Overhead press')).toBe('ohp');
  expect(mainLiftOf('Pause squat')).toBeUndefined();
});

test('tiers come from settings by id, name or slug, else SPEC defaults', () => {
  const squat = ex('sq', 'Squat');
  const custom: [number, number, number, number, number] = [1.1, 1.3, 1.5, 1.7, 1.9];
  expect(tiersFor(squat, { sq: custom })).toEqual({ key: 'sq', tiers: custom, isDefault: false });
  expect(tiersFor(squat, { Squat: custom })?.key).toBe('Squat');
  expect(tiersFor(squat, { squat: custom })?.key).toBe('squat');
  expect(tiersFor(squat, {})).toEqual({ key: 'sq', tiers: DEFAULT_TIERS.squat, isDefault: true });
  // Invalid stored tiers are ignored.
  expect(tiersFor(squat, { sq: [2, 1, 1, 1, 1] })?.isDefault).toBe(true);
  expect(tiersFor(ex('x', 'Front squat'), {})).toBeUndefined();
});

test('sortMainLifts puts squat, bench, deadlift, OHP first', () => {
  const names = sortMainLifts([ex('a', 'Overhead press'), ex('b', 'Zercher'), ex('c', 'Deadlift'), ex('d', 'Squat'), ex('e', 'Bench press')]).map((e) => e.name);
  expect(names).toEqual(['Squat', 'Bench press', 'Deadlift', 'Overhead press', 'Zercher']);
});

test('buildTrophy ranks with the 7-day average bodyweight', () => {
  const t = buildTrophy(ex('sq', 'Squat'), [set(150, 5), set(170, 2)], [{ date: '2026-01-04', weightLb: 140 }, { date: '2026-01-06', weightLb: 150 }], {}, '2026-01-07');
  expect(t.e1rm).toBeCloseTo(181.333, 3);
  expect(t.bodyweight).toEqual({ lb: 145, source: 'average' });
  expect(t.rank?.tierName).toBe('Silver'); // 1.25x
  expect(t.rank?.next?.name).toBe('Gold');
  expect(t.rank?.next?.lbToGo).toBe(37); // 1.5 x 145 = 217.5 - 181.33
});

test('buildTrophy without bodyweight or sets has no rank', () => {
  expect(buildTrophy(ex('sq', 'Squat'), [set(150, 5)], [], {}, '2026-01-07').rank).toBeUndefined();
  const none = buildTrophy(ex('sq', 'Squat'), [], [{ date: '2026-01-06', weightLb: 150 }], {}, '2026-01-07');
  expect(none.e1rm).toBeUndefined();
  expect(none.rank).toBeUndefined();
});

test('tier-up only after a lower tier was seen', () => {
  expect(isTierUp({}, 'sq', 2)).toBe(false);
  expect(isTierUp({ sq: 1 }, 'sq', 2)).toBe(true);
  expect(isTierUp({ sq: 2 }, 'sq', 2)).toBe(false);
  expect(isTierUp({ sq: -1 }, 'sq', 0)).toBe(true);
});
