import { expect, test } from 'vitest';
import type { Session } from '../../db/types';
import { byMonth, newestFirst, sessionDetail } from './history';

const s = (id: string, date: string, startedAt = 0, extra: Partial<Session> = {}): Session => ({ id, date, startedAt, status: 'done', painFlag: false, note: '', ...extra });

test('newest first, later start breaks ties on the same day', () => {
  expect(newestFirst([s('a', '2026-10-01'), s('b', '2026-11-02', 1), s('c', '2026-11-02', 2)]).map((x) => x.id)).toEqual(['c', 'b', 'a']);
});

test('grouped by month', () => {
  const groups = byMonth([s('a', '2026-10-31'), s('b', '2026-11-02'), s('c', '2026-11-20')]);
  expect(groups.map((g) => g.month)).toEqual(['November 2026', 'October 2026']);
  expect(groups[0].sessions.map((x) => x.id)).toEqual(['c', 'b']);
});

test('detail line', () => {
  expect(sessionDetail(s('a', '2026-11-02', 0, { durationMin: 45, effort: 7, painFlag: true }))).toBe('45 min · Effort 7 · Pain flagged');
});
