import { expect, test } from 'vitest';
import { needsBackup, weekStrip } from './home';

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 5, 12);

test('backup banner after 7 days, or after the first workout if never exported', () => {
  expect(needsBackup(now - 3 * DAY, true, now)).toBe(false);
  expect(needsBackup(now - 8 * DAY, true, now)).toBe(true);
  expect(needsBackup(undefined, false, now)).toBe(false);
  expect(needsBackup(undefined, true, now)).toBe(true);
});

test('week strip marks today, finished days and planned weekdays', () => {
  const strip = weekStrip(
    '2026-11-05',
    [{ date: '2026-11-03', status: 'done' }, { date: '2026-11-04', status: 'draft' }],
    [{ weekday: 1, archived: false }, { weekday: 5, archived: true }],
  );
  expect(strip.map((d) => d.letter).join('')).toBe('SMTWTFS');
  expect(strip.find((d) => d.isToday)?.date).toBe('2026-11-05');
  expect(strip.filter((d) => d.done).map((d) => d.date)).toEqual(['2026-11-03']);
  expect(strip.filter((d) => d.planned).map((d) => d.date)).toEqual(['2026-11-02']);
});
