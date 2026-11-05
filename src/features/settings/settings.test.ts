import { expect, test } from 'vitest';
import type { Exercise, LoggedSet } from '../../db/types';
import { describeCounts, latestWeights } from './settings';

const ex = (id: string, name: string, isMain = false): Exercise => ({ id, name, kind: 'barbell', incrementLb: 5, roundToLb: 5, autoIncrease: true, isMain, archived: false });
const set = (date: string, weightLb: number, done = true): LoggedSet & { date: string } => ({ id: date, sessionId: date, exerciseId: 'x', order: 0, setNo: 1, weightLb, reps: 5, done, skipped: false, date });

test('working weight is the last done set; main lifts first', () => {
  const rows = latestWeights([ex('a', 'Row'), ex('b', 'Bench', true)], [[set('2026-10-01', 50), set('2026-10-08', 55)], []]);
  expect(rows.map((r) => r.exercise.name)).toEqual(['Bench', 'Row']);
  expect(rows[1]).toMatchObject({ weightLb: 55, date: '2026-10-08' });
  expect(rows[0].weightLb).toBeUndefined();
});

test('import counts read naturally', () => {
  expect(describeCounts({ valid: true, errors: [], counts: { sessions: 1, sets: 12, maxes: 0 } })).toBe('1 session · 12 sets');
  expect(describeCounts({ valid: true, errors: [], counts: {} })).toBe('Nothing to import');
});
