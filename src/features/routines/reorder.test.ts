import { expect, test } from 'vitest';
import { move, nextOrder, renumber } from './reorder';

test('move swaps neighbours and ignores moves past the ends', () => {
  expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  expect(move(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
  expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
});

test('renumber returns only changed rows', () => {
  const rows = [{ id: 'b', order: 1 }, { id: 'a', order: 0 }, { id: 'c', order: 2 }];
  expect(renumber(rows)).toEqual([{ id: 'b', order: 0 }, { id: 'a', order: 1 }]);
  expect(nextOrder(rows)).toBe(3);
  expect(nextOrder([])).toBe(0);
});
