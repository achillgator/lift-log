// Moving rows up and down in editable lists (routines, quick-adds, routine items).

/** Returns a copy with the item at `index` moved one place up (-1) or down (+1). */
export function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Re-numbers `order` to match list position; returns only the rows whose order changed. */
export function renumber<T extends { order: number }>(list: T[]): T[] {
  return list.flatMap((item, i) => (item.order === i ? [] : [{ ...item, order: i }]));
}

export function nextOrder(list: { order: number }[]): number {
  return list.reduce((max, x) => Math.max(max, x.order), -1) + 1;
}
