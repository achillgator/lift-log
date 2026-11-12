import { describe, expect, test } from 'vitest';
import { addDays, diffDays, formatShort, isIsoDate, startOfWeek, todayLocal, weekday } from './dates';

describe('dates', () => {
  test('addDays crosses months, years and leap days', () => {
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
    expect(addDays('2000-02-29', 1)).toBe('2000-03-01');
    expect(addDays('1999-12-31', 1)).toBe('2000-01-01');
    expect(addDays('2000-01-01', -1)).toBe('1999-12-31');
  });

  test('diffDays is whole days', () => {
    expect(diffDays('2000-01-01', '2000-01-08')).toBe(7);
    expect(diffDays('2000-01-08', '2000-01-01')).toBe(-7);
    expect(diffDays('2000-03-25', '2000-04-05')).toBe(11);
  });

  test('weekday and startOfWeek', () => {
    expect(weekday('2000-01-01')).toBe(6); // a Saturday
    expect(startOfWeek('2000-01-01')).toBe('1999-12-26');
    expect(startOfWeek('2000-01-01', 1)).toBe('1999-12-27');
    expect(startOfWeek('1999-12-26')).toBe('1999-12-26');
  });

  test('formatShort matches the app style', () => {
    expect(formatShort('2000-01-07')).toBe('Fri Jan 7');
  });

  test('isIsoDate rejects bad dates', () => {
    expect(isIsoDate('2000-02-29')).toBe(true);
    expect(isIsoDate('2001-02-29')).toBe(false);
    expect(isIsoDate('2000-1-1')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  test('todayLocal uses local fields', () => {
    expect(todayLocal(new Date(2000, 0, 5, 23, 59))).toBe('2000-01-05');
  });
});
