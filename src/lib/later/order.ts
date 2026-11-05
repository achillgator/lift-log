// Reordering for rows that carry an `order` field (habits, and anything else sorted by hand).

export function byOrder<T extends { order: number }>(a: T, b: T): number {
  return a.order - b.order;
}

/**
 * Moves the item at `from` to `to` and renumbers every item 0..n-1.
 * Returns only the items whose order changed, so the caller saves the fewest rows.
 */
export function moveItem<T extends { order: number }>(items: T[], from: number, to: number): { list: T[]; changed: T[] } {
  const sorted = [...items].sort(byOrder);
  if (from < 0 || from >= sorted.length) return { list: sorted, changed: [] };
  const target = Math.max(0, Math.min(sorted.length - 1, to));
  const [moved] = sorted.splice(from, 1);
  sorted.splice(target, 0, moved);
  const changed: T[] = [];
  const list = sorted.map((item, i) => {
    if (item.order === i) return item;
    const next = { ...item, order: i };
    changed.push(next);
    return next;
  });
  return { list, changed };
}

/** The order value for a new row placed after every existing one. */
export function nextOrder(items: { order: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.order + 1), 0);
}
