import { expect, test } from 'vitest';
import type { QuickAdd } from '../../db/types';
import { quickAddDetail, quickAddKind, toLines, withKind } from './quickadd';

const q: QuickAdd = { id: 'q', name: 'Sample', order: 0, source: { lines: ['a', 'b'] } };

test('kind, detail and switching kind', () => {
  expect(quickAddKind(q)).toBe('lines');
  expect(quickAddDetail(q)).toBe('2 checklist lines');
  const r = withKind(q, 'routine', 'r1');
  expect(r.source).toEqual({ routineId: 'r1' });
  expect(quickAddDetail(withKind(q, 'items'))).toBe('0 exercises');
  expect(withKind(q, 'lines')).toBe(q);
});

test('checklist lines drop blanks', () => {
  expect(toLines(' 5 min easy cardio \n\n Stretch ')).toEqual(['5 min easy cardio', 'Stretch']);
});
