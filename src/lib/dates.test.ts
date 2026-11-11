import { describe, expect, test } from 'vitest';
import {
  addDays, daysBetween, formatDate, isValidDate, localNoon, parseLocalDate, startOfWeek, toLocalDate, weekday, weeksBetween,
} from './dates';

describe('dates', () => {
  test('toLocalDate uses local time, not UTC', () => {
    expect(toLocalDate(new Date(2024, 0, 5, 23, 30))).toBe('2024-01-05');
    expect(toLocalDate(new Date(2024, 0, 5, 0, 5))).toBe('2024-01-05');
  });

  test('isValidDate rejects bad shapes and impossible days', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(isValidDate('2024-13-01')).toBe(false);
    expect(isValidDate('2024-1-01')).toBe(false);
    expect(isValidDate('yesterday')).toBe(false);
  });

  test('parseLocalDate gives local midnight and throws on bad input', () => {
    const d = parseLocalDate('2024-03-10');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2024, 2, 10, 0]);
    expect(() => parseLocalDate('2024-02-30')).toThrow(/Invalid date/);
    expect(new Date(localNoon('2024-03-10')).getHours()).toBe(12);
  });

  test('addDays and daysBetween cross months, years and leap days', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
    expect(daysBetween('2024-03-09', '2024-03-11')).toBe(2); // across a US DST change
    expect(daysBetween('2024-03-11', '2024-03-09')).toBe(-2);
  });

  test('weeksBetween rounds down', () => {
    expect(weeksBetween('2024-01-01', '2024-01-07')).toBe(0);
    expect(weeksBetween('2024-01-01', '2024-01-08')).toBe(1);
    expect(weeksBetween('2024-01-01', '2024-01-29')).toBe(4);
  });

  test('weekday and startOfWeek (Monday)', () => {
    expect(weekday('2024-03-04')).toBe(1); // Monday
    expect(weekday('2024-03-10')).toBe(0); // Sunday
    expect(startOfWeek('2024-03-10')).toBe('2024-03-04');
    expect(startOfWeek('2024-03-04')).toBe('2024-03-04');
    expect(startOfWeek('2024-03-06')).toBe('2024-03-04');
  });

  test('formatDate reads like "Fri Oct 17" and adds the year when it differs', () => {
    expect(formatDate('2025-10-17', '2025-01-01')).toBe('Fri Oct 17');
    expect(formatDate('2024-10-17', '2025-01-01')).toBe('Thu Oct 17, 2024');
  });
});
