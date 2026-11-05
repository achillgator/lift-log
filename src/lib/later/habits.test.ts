import { describe, expect, test } from 'vitest';
import type { Habit, HabitLog } from '../../db/types';
import { activeHabits, habitNameError, habitStreak, newHabit, unarchiveHabit } from './habits';

const log = (date: string, done = true, habitId = 'h1'): HabitLog => ({ date, habitId, done });

describe('habitStreak', () => {
  test('no logs', () => {
    expect(habitStreak([], 'h1', '2000-01-10')).toEqual({ current: 0, best: 0, doneToday: false });
  });

  test('counts a run that includes today', () => {
    const logs = [log('2000-01-08'), log('2000-01-09'), log('2000-01-10')];
    expect(habitStreak(logs, 'h1', '2000-01-10')).toEqual({ current: 3, best: 3, doneToday: true });
  });

  test('today still open keeps yesterday\'s streak', () => {
    const logs = [log('2000-01-08'), log('2000-01-09')];
    expect(habitStreak(logs, 'h1', '2000-01-10')).toEqual({ current: 2, best: 2, doneToday: false });
  });

  test('a missed day breaks the current streak but keeps the best', () => {
    const logs = [log('2000-01-01'), log('2000-01-02'), log('2000-01-03'), log('2000-01-04'), log('2000-01-07'), log('2000-01-09')];
    expect(habitStreak(logs, 'h1', '2000-01-09')).toEqual({ current: 1, best: 4, doneToday: true });
    expect(habitStreak(logs, 'h1', '2000-01-10')).toEqual({ current: 1, best: 4, doneToday: false });
    expect(habitStreak(logs, 'h1', '2000-01-11').current).toBe(0);
  });

  test('done: false logs, other habits and future dates do not count', () => {
    const logs = [log('2000-01-09'), log('2000-01-10', false), log('2000-01-10', true, 'h2'), log('2000-01-11')];
    expect(habitStreak(logs, 'h1', '2000-01-10')).toEqual({ current: 1, best: 1, doneToday: false });
  });

  test('streaks run across month ends', () => {
    const logs = [log('2000-01-31'), log('2000-02-01')];
    expect(habitStreak(logs, 'h1', '2000-02-01').current).toBe(2);
  });
});

describe('habit editing', () => {
  const habits: Habit[] = [
    { id: 'a', name: 'Stretch', order: 1, archived: false },
    { id: 'b', name: 'Read', order: 0, archived: false },
    { id: 'c', name: 'Old', order: 2, archived: true },
  ];

  test('names are required, short and unique among active habits', () => {
    expect(habitNameError('  ', habits)).toBe('Enter a name.');
    expect(habitNameError('x'.repeat(41), habits)).toMatch(/under/);
    expect(habitNameError(' stretch ', habits)).toMatch(/exists/);
    expect(habitNameError('Stretch', habits, 'a')).toBeUndefined();
    expect(habitNameError('Old', habits)).toBeUndefined();
  });

  test('newHabit goes last and trims', () => {
    expect(newHabit('  Walk ', habits, 'id1')).toEqual({ id: 'id1', name: 'Walk', order: 3, archived: false });
  });

  test('activeHabits sorts and hides archived', () => {
    expect(activeHabits(habits).map((h) => h.id)).toEqual(['b', 'a']);
  });

  test('unarchive puts the habit after the active ones', () => {
    expect(unarchiveHabit(habits[2], habits)).toEqual({ id: 'c', name: 'Old', order: 2, archived: false });
  });
});
