import { expect, test } from 'vitest';
import { moveItem, nextOrder } from './order';

const rows = [
  { id: 'a', order: 0 },
  { id: 'b', order: 1 },
  { id: 'c', order: 2 },
];

test('moveItem renumbers and returns only changed rows', () => {
  const { list, changed } = moveItem(rows, 2, 0);
  expect(list.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  expect(list.map((r) => r.order)).toEqual([0, 1, 2]);
  expect(changed.map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
  expect(rows[0].order).toBe(0); // input untouched
});

test('moveItem by one swaps two rows', () => {
  const { list, changed } = moveItem(rows, 0, 1);
  expect(list.map((r) => r.id)).toEqual(['b', 'a', 'c']);
  expect(changed.map((r) => r.id).sort()).toEqual(['a', 'b']);
});

test('moveItem clamps and ignores bad indexes', () => {
  expect(moveItem(rows, 0, 99).list.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  expect(moveItem(rows, 5, 0).changed).toEqual([]);
});

test('moveItem fixes gaps in order values', () => {
  const gappy = [{ id: 'x', order: 3 }, { id: 'y', order: 7 }];
  const { list, changed } = moveItem(gappy, 0, 0);
  expect(list.map((r) => r.order)).toEqual([0, 1]);
  expect(changed).toHaveLength(2);
});

test('nextOrder', () => {
  expect(nextOrder([])).toBe(0);
  expect(nextOrder(rows)).toBe(3);
});
