import { describe, expect, test } from 'vitest';
import type { LoggedSet } from '../db/types';
import { doneAsPlanned, setState, setSummary, toggleSet, typoGuard } from './setrow';

const planned: LoggedSet = {
  id: 's1', sessionId: 'x', exerciseId: 'e', order: 0, setNo: 1,
  targetWeightLb: 135, targetReps: 5, done: false, skipped: false,
};

describe('set states', () => {
  test('planned, done, edited, skipped', () => {
    expect(setState(planned)).toBe('planned');
    expect(setState(doneAsPlanned(planned))).toBe('done');
    expect(setState({ ...doneAsPlanned(planned), reps: 4 })).toBe('edited');
    expect(setState({ ...planned, skipped: true })).toBe('skipped');
  });
  test('holds compare seconds with the planned seconds', () => {
    const hold = { ...planned, targetWeightLb: undefined, targetReps: 30 };
    expect(doneAsPlanned(hold, 'hold').holdSec).toBe(30);
    expect(setState({ ...hold, done: true, holdSec: 25 }, 'hold')).toBe('edited');
  });
  test('tapping toggles and keeps entered values', () => {
    const edited = { ...doneAsPlanned(planned), weightLb: 140 };
    const undone = toggleSet(edited);
    expect(undone.done).toBe(false);
    expect(undone.weightLb).toBe(140);
    expect(toggleSet(undone).weightLb).toBe(140);
  });
  test('tapping a skipped set un-skips it', () => {
    expect(toggleSet({ ...planned, skipped: true }).skipped).toBe(false);
  });
});

describe('summary', () => {
  test('shows the plan until done, then the actual values', () => {
    expect(setSummary(planned)).toBe('135 lb × 5');
    expect(setSummary({ ...planned, done: true, weightLb: 140, reps: 3 })).toBe('140 lb × 3');
    expect(setSummary({ ...planned, done: true, reps: 8, strictReps: 5, targetWeightLb: undefined, weightLb: undefined }, 'bodyweight')).toBe('8 reps (5 strict)');
    expect(setSummary({ ...planned, distanceM: 1609, timeSec: 600 }, 'run')).toBe('1 mi · 10:00');
  });
});

describe('typo guard', () => {
  test('ignores normal weights', () => {
    expect(typoGuard(140, 135)).toBeUndefined();
    expect(typoGuard(200, 135)).toBeUndefined();
    expect(typoGuard(undefined, 135)).toBeUndefined();
  });
  test('an extra digit suggests the shorter number', () => {
    expect(typoGuard(1350, 135)).toBe(135);
    expect(typoGuard(600, undefined)).toBe(60);
  });
  test('far over the target suggests the target', () => {
    expect(typoGuard(225, 135)).toBe(135);
  });
});
