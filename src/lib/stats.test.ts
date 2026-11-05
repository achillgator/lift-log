import { expect, test } from 'vitest';
import { e1rm } from './stats';

test('e1rm uses sets of 10 reps or fewer', () => {
  expect(e1rm(150, 3)).toBe(165);
  expect(e1rm(100, 11)).toBeUndefined();
});
