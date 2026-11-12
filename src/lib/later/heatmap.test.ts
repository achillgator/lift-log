import { describe, expect, test } from 'vitest';
import { buildHeatmap, countByDate, heatmapSummary, levelFor, levelThresholds } from './heatmap';

describe('heatmap', () => {
  test('countByDate', () => {
    const counts = countByDate([{ date: '2000-01-01' }, { date: '2000-01-01' }, { date: '2000-01-03' }]);
    expect(counts.get('2000-01-01')).toBe(2);
    expect(counts.get('2000-01-03')).toBe(1);
  });

  test('levels follow quartiles of active days', () => {
    const t = levelThresholds([0, 4, 8, 12, 16]);
    expect(t).toEqual([4, 8, 12]);
    expect(levelFor(0, t)).toBe(0);
    expect(levelFor(3, t)).toBe(1);
    expect(levelFor(8, t)).toBe(2);
    expect(levelFor(12, t)).toBe(3);
    expect(levelFor(40, t)).toBe(4);
  });

  test('one value only still shows as the strongest it can be among equals', () => {
    const t = levelThresholds([9]);
    expect(levelFor(9, t)).toBe(1);
  });

  test('grid shape and range', () => {
    // 2000-01-05 is a Wednesday.
    const values = new Map([['2000-01-05', 10], ['2000-01-03', 5], ['1999-01-01', 50]]);
    const weeks = buildHeatmap(values, { endDate: '2000-01-05', weeks: 3 });
    expect(weeks).toHaveLength(3);
    expect(weeks[0].start).toBe('1999-12-19');
    expect(weeks[2].start).toBe('2000-01-02');
    expect(weeks.every((w) => w.cells.length === 7)).toBe(true);
    const last = weeks[2].cells;
    expect(last[1]).toMatchObject({ date: '2000-01-03', value: 5, inRange: true });
    expect(last[3]).toMatchObject({ date: '2000-01-05', value: 10, inRange: true });
    expect(last[4]).toMatchObject({ date: '2000-01-06', value: 0, level: 0, inRange: false });
    // The out-of-range heavy day does not set the scale.
    expect(last[3].level).toBe(4);
  });

  test('month labels mark the column where a month begins', () => {
    const weeks = buildHeatmap(new Map(), { endDate: '2000-01-05', weeks: 3 });
    expect(weeks[0].monthStart).toBe('1999-12-19');
    // 2000-01-01 is a Saturday, the last day of the second column.
    expect(weeks[1].monthStart).toBe('2000-01-01');
    expect(weeks[2].monthStart).toBeUndefined();
  });

  test('Monday-first weeks', () => {
    const weeks = buildHeatmap(new Map(), { endDate: '2000-01-05', weeks: 1, weekStart: 1 });
    expect(weeks[0].start).toBe('2000-01-03');
  });

  test('summary', () => {
    const weeks = buildHeatmap(new Map([['2000-01-03', 1], ['2000-01-04', 2], ['1999-12-20', 1]]), { endDate: '2000-01-05', weeks: 3 });
    expect(heatmapSummary(weeks)).toEqual({ activeDays: 3, activeWeeks: 2 });
  });
});
