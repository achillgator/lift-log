import { describe, expect, test } from 'vitest';
import { addDays, formatClock, formatDate, formatLb, metersToMiles, milesToMeters, parseClock, weekOf } from './format';

describe('dates', () => {
  test('formats like "Fri Oct 17"', () => {
    expect(formatDate('2025-10-17')).toBe('Fri Oct 17');
  });
  test('adds days across a month end', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  test('week runs Sunday to Saturday', () => {
    const week = weekOf('2026-11-05');
    expect(week[0]).toBe('2026-11-01');
    expect(week[6]).toBe('2026-11-07');
  });
});

describe('numbers', () => {
  test('weights drop trailing zeros', () => {
    expect(formatLb(135)).toBe('135');
    expect(formatLb(132.5)).toBe('132.5');
    expect(formatLb(undefined)).toBe('–');
  });
  test('clock round-trips', () => {
    expect(formatClock(95)).toBe('1:35');
    expect(parseClock('1:35')).toBe(95);
    expect(parseClock('40')).toBe(40);
    expect(parseClock('x')).toBeUndefined();
  });
  test('miles convert both ways', () => {
    expect(metersToMiles(milesToMeters(2.5))).toBe(2.5);
  });
});
