import { expect, test } from 'vitest';
import { holdDelay, stepValue } from './stepper';

test('holding speeds up and never stalls', () => {
  const delays = [0, 1, 5, 15, 100].map(holdDelay);
  expect(delays).toEqual([400, 150, 80, 40, 40]);
});

test('stepping clamps and avoids float drift', () => {
  expect(stepValue(132.5, 2.5)).toBe(135);
  expect(stepValue(0.1, 0.2)).toBe(0.3);
  expect(stepValue(5, -10, 0)).toBe(0);
  expect(stepValue(10, 5, 0, 12)).toBe(12);
});
