import { expect, test } from 'vitest';
import { formatDate, formatDuration, formatShortDate, formatSignedLb } from './format';
import { formatSeconds, windowFor } from './chartData';

test('dates read like "Fri Oct 17"', () => {
  expect(formatDate('2025-10-17')).toBe('Fri Oct 17');
  expect(formatDate('2025-10-17', '2026-01-02')).toBe('Fri Oct 17, 2025');
  expect(formatDate('2026-01-01', '2026-01-02')).toBe('Thu Jan 1');
  expect(formatShortDate('2025-12-30', '2026-01-02')).toBe('Dec 30 ’25');
});

test('numbers', () => {
  expect(formatSignedLb(1.44)).toBe('+1.4 lb');
  expect(formatSignedLb(-0.6)).toBe('−0.6 lb');
  expect(formatSignedLb(0.01)).toBe('±0.0 lb');
  expect(formatDuration(754)).toBe('12:34');
  expect(formatDuration(3725)).toBe('1:02:05');
  expect(formatSeconds(45)).toBe('45 s');
  expect(formatSeconds(75)).toBe('1:15');
});

test('chart window', () => {
  expect(windowFor('All', '2026-03-01', ['2026-02-01', '2026-01-15'])).toEqual({ from: '2026-01-15', to: '2026-03-01' });
  expect(windowFor('All', '2026-03-01', [])).toEqual({ from: '2026-03-01', to: '2026-03-01' });
  expect(windowFor('4W', '2026-03-28', [])).toEqual({ from: '2026-03-01', to: '2026-03-28' });
});
