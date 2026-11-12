import { describe, expect, test } from 'vitest';
import type { LoggedSet } from '../db/types';
import {
  addDays, bestE1rm, changeSinceStart, currentBodyweight, dayNumber, daysBetween, detectPRs, e1rm,
  e1rmPrDates, inRange, lbToNextTier, maxPerSession, monotonePath, monotoneTangents, nearestIndex,
  rangeStart, rollingAverage, splitGaps, stepWeight, strictReps, sumPerSession, toLocalDate,
  topSetPerSession, trophyRank, validTiers, volume, weekStart, weeklyVolume, type DatedSet, type Tiers,
} from './stats';

// Made-up sample data only.
let n = 0;
function set(p: Partial<LoggedSet> & { date?: string }): DatedSet {
  n++;
  return {
    id: `s${n}`, sessionId: 'a', exerciseId: 'ex', order: 0, setNo: 1, done: true, skipped: false, date: '2026-01-05',
    ...p,
  } as DatedSet;
}

describe('e1rm and volume', () => {
  test('e1rm uses sets of 10 reps or fewer', () => {
    expect(e1rm(150, 3)).toBe(165);
    expect(e1rm(100, 11)).toBeUndefined();
    expect(e1rm(100, 0)).toBeUndefined();
    expect(e1rm(100, 10)).toBeCloseTo(133.333, 3);
  });

  test('volume counts only done sets with weight and reps', () => {
    expect(volume([
      set({ weightLb: 100, reps: 5 }),
      set({ weightLb: 100, reps: 5, done: false }),
      set({ reps: 8 }),
    ])).toBe(500);
  });

  test('bestE1rm skips skipped and high-rep sets', () => {
    expect(bestE1rm([
      set({ weightLb: 100, reps: 12 }),
      set({ weightLb: 90, reps: 3 }),
      set({ weightLb: 200, reps: 1, skipped: true }),
    ])).toBeCloseTo(99, 9);
    expect(bestE1rm([])).toBeUndefined();
  });
});

describe('dates', () => {
  test('day arithmetic survives month, year and DST edges', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59);
    expect(dayNumber('1970-01-02')).toBe(1);
  });

  test('weekStart is the Monday of the week', () => {
    expect(weekStart('2026-01-05')).toBe('2026-01-05'); // Monday
    expect(weekStart('2026-01-11')).toBe('2026-01-05'); // Sunday
    expect(weekStart('2026-01-07')).toBe('2026-01-05');
  });

  test('toLocalDate pads', () => {
    expect(toLocalDate(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

describe('per-session summaries', () => {
  test('top set is the heaviest, ties go to more reps; e1RM is the best in the session', () => {
    const rows = topSetPerSession([
      set({ sessionId: 'b', date: '2026-01-08', weightLb: 100, reps: 5 }),
      set({ sessionId: 'a', date: '2026-01-05', weightLb: 95, reps: 5 }),
      set({ sessionId: 'a', date: '2026-01-05', weightLb: 100, reps: 3 }),
      set({ sessionId: 'a', date: '2026-01-05', weightLb: 100, reps: 4 }),
      set({ sessionId: 'a', date: '2026-01-05', weightLb: 80, reps: 10 }),
      set({ sessionId: 'b', date: '2026-01-08', weightLb: 200, reps: 1, done: false }),
    ]);
    expect(rows.map((r) => r.sessionId)).toEqual(['a', 'b']);
    expect(rows[0]).toMatchObject({ topWeightLb: 100, topReps: 4 });
    expect(rows[0].e1rm).toBeCloseTo(113.333, 3);
    expect(rows[1]).toMatchObject({ topWeightLb: 100, topReps: 5 });
  });

  test('top set without a qualifying e1RM keeps e1rm undefined', () => {
    const [row] = topSetPerSession([set({ weightLb: 50, reps: 15 })]);
    expect(row.topWeightLb).toBe(50);
    expect(row.e1rm).toBeUndefined();
  });

  test('sum and max per session', () => {
    const hist = [
      set({ sessionId: 'a', date: '2026-01-05', reps: 8, strictReps: 3 }),
      set({ sessionId: 'a', date: '2026-01-05', reps: 8, strictReps: 2 }),
      set({ sessionId: 'b', date: '2026-01-07', reps: 6 }),
      set({ sessionId: 'c', date: '2026-01-09', holdSec: 30 }),
      set({ sessionId: 'c', date: '2026-01-09', holdSec: 45 }),
    ];
    expect(sumPerSession(hist, strictReps).map((r) => r.value)).toEqual([5, 6]);
    expect(maxPerSession(hist, (s) => s.holdSec)).toEqual([{ sessionId: 'c', date: '2026-01-09', value: 45 }]);
  });
});

describe('PR detection', () => {
  test('beats on e1RM and on weight are reported once per kind', () => {
    const prev = [set({ weightLb: 100, reps: 5 })];
    const now = [
      set({ id: 'x1', weightLb: 105, reps: 3 }), // heavier, e1RM 115.5 < 116.67
      set({ id: 'x2', weightLb: 100, reps: 6 }), // e1RM 120
      set({ id: 'x3', weightLb: 102, reps: 5 }), // heavier, e1RM 119
    ];
    const prs = detectPRs(prev, now);
    expect(prs.find((p) => p.kind === 'e1rm')).toMatchObject({ setId: 'x2', value: 120 });
    expect(prs.find((p) => p.kind === 'weight')).toMatchObject({ setId: 'x1', value: 105, previous: 100 });
    expect(prs).toHaveLength(2);
  });

  test('ties are not PRs and a first-ever set is not a PR', () => {
    expect(detectPRs([set({ weightLb: 100, reps: 5 })], [set({ weightLb: 100, reps: 5 })])).toEqual([]);
    expect(detectPRs([], [set({ weightLb: 100, reps: 5 })])).toEqual([]);
  });

  test('unweighted reps and holds', () => {
    const prs = detectPRs(
      [set({ exerciseId: 'pu', reps: 8, strictReps: 3 }), set({ exerciseId: 'hang', holdSec: 40 })],
      [set({ id: 'p', exerciseId: 'pu', reps: 8, strictReps: 4 }), set({ id: 'h', exerciseId: 'hang', holdSec: 41 })],
    );
    expect(prs).toEqual([
      { setId: 'p', exerciseId: 'pu', kind: 'reps', value: 4, previous: 3 },
      { setId: 'h', exerciseId: 'hang', kind: 'hold', value: 41, previous: 40 },
    ]);
  });

  test('exercises do not compare against each other', () => {
    expect(detectPRs([set({ exerciseId: 'a', weightLb: 300, reps: 1 })], [set({ exerciseId: 'b', weightLb: 100, reps: 1 })])).toEqual([]);
  });

  test('e1rmPrDates marks sessions that set a new best after the first', () => {
    expect(e1rmPrDates([
      { sessionId: '1', date: '2026-01-01', topWeightLb: 0, topReps: 0, e1rm: 100 },
      { sessionId: '2', date: '2026-01-03', topWeightLb: 0, topReps: 0, e1rm: 99 },
      { sessionId: '3', date: '2026-01-05', topWeightLb: 0, topReps: 0 },
      { sessionId: '4', date: '2026-01-07', topWeightLb: 0, topReps: 0, e1rm: 101 },
    ])).toEqual(['2026-01-07']);
  });
});

describe('weekly volume', () => {
  test('groups by Monday week and fills empty weeks with 0', () => {
    expect(weeklyVolume([
      set({ date: '2026-01-05', weightLb: 100, reps: 5 }),
      set({ date: '2026-01-11', weightLb: 50, reps: 10 }),
      set({ date: '2026-01-21', weightLb: 100, reps: 1 }),
      set({ date: '2026-01-22', weightLb: 100, reps: 1, done: false }),
    ])).toEqual([
      { week: '2026-01-05', volumeLb: 1000 },
      { week: '2026-01-12', volumeLb: 0 },
      { week: '2026-01-19', volumeLb: 100 },
    ]);
    expect(weeklyVolume([])).toEqual([]);
  });
});

describe('bodyweight', () => {
  const w = (date: string, weightLb: number) => ({ date, weightLb });

  test('rolling average covers the 7 days ending on each weigh-in', () => {
    const avg = rollingAverage([w('2026-01-08', 152), w('2026-01-01', 150), w('2026-01-02', 151)]);
    expect(avg.map((a) => a.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-08']);
    expect(avg[0].avgLb).toBe(150);
    expect(avg[1].avgLb).toBe(150.5);
    // Jan 8 window is Jan 2..Jan 8, so Jan 1 drops out.
    expect(avg[2].avgLb).toBe(151.5);
    expect(avg[2].weightLb).toBe(152);
  });

  test('current bodyweight averages the last 7 days, else falls back to the latest weigh-in', () => {
    const entries = [w('2026-01-01', 160), w('2026-01-10', 150), w('2026-01-12', 152), w('2026-01-20', 999)];
    expect(currentBodyweight(entries, '2026-01-14')).toEqual({ lb: 151, source: 'average' });
    expect(currentBodyweight(entries, '2026-01-16')).toEqual({ lb: 151, source: 'average' }); // window Jan 10..16
    expect(currentBodyweight(entries, '2026-01-17')).toEqual({ lb: 152, source: 'average' }); // Jan 10 drops out
    expect(currentBodyweight(entries, '2026-01-19')).toEqual({ lb: 152, source: 'latest' });
    expect(currentBodyweight([], '2026-01-19')).toBeUndefined();
    expect(currentBodyweight([w('2026-02-01', 150)], '2026-01-19')).toBeUndefined();
  });

  test('change since start uses the averages', () => {
    expect(changeSinceStart(rollingAverage([w('2026-01-01', 150)]))).toBeUndefined();
    expect(changeSinceStart([{ date: 'a', weightLb: 0, avgLb: 150 }, { date: 'b', weightLb: 0, avgLb: 148.5 }])).toBe(-1.5);
  });

  test('stepper moves in 0.2 lb steps without drift', () => {
    let v = 150;
    for (let i = 0; i < 7; i++) v = stepWeight(v, 1);
    expect(v).toBe(151.4);
    expect(stepWeight(150.1, -1)).toBe(149.9);
  });
});

describe('trophies', () => {
  const squat: Tiers = [1, 1.25, 1.5, 1.75, 2];

  test('tier from e1RM / bodyweight with lb to the next tier', () => {
    const r = trophyRank(200, 150, squat); // ratio 1.333
    expect(r.tierName).toBe('Silver');
    expect(r.tier).toBe(1);
    expect(r.ratio).toBeCloseTo(1.3333, 4);
    expect(r.next).toEqual({ tier: 2, name: 'Gold', ratio: 1.5, lbToGo: 25 });
    expect(r.progress).toBeCloseTo(1 / 3, 5);
  });

  test('below Bronze is Unranked and progresses from 0', () => {
    const r = trophyRank(100, 150, squat);
    expect(r.tierName).toBe('Unranked');
    expect(r.tier).toBe(-1);
    expect(r.next?.name).toBe('Bronze');
    expect(r.next?.lbToGo).toBe(50);
    expect(r.progress).toBeCloseTo(2 / 3, 5);
  });

  test('exactly on a threshold reaches it; Diamond has no next tier', () => {
    expect(trophyRank(150, 150, squat).tierName).toBe('Bronze');
    const top = trophyRank(400, 150, squat);
    expect(top.tierName).toBe('Diamond');
    expect(top.next).toBeUndefined();
    expect(top.progress).toBe(1);
  });

  test('lb to next tier rounds up to whole lb and never shows 0 while short', () => {
    expect(lbToNextTier(149.6, 150, 1)).toBe(1);
    expect(lbToNextTier(140.2, 150, 1)).toBe(10);
    expect(lbToNextTier(150, 150, 1)).toBe(0);
  });

  test('tier thresholds must be five ascending positives', () => {
    expect(validTiers([1, 1.25, 1.5, 1.75, 2])).toBe(true);
    expect(validTiers([1, 1, 1.5, 1.75, 2])).toBe(false);
    expect(validTiers([1, 1.25, 1.5, 1.75])).toBe(false);
    expect(validTiers([0, 1.25, 1.5, 1.75, 2])).toBe(false);
    expect(validTiers([1, 1.25, NaN, 1.75, 2])).toBe(false);
  });
});

describe('chart geometry', () => {
  test('monotone path passes through every point', () => {
    expect(monotonePath([])).toBe('');
    expect(monotonePath([{ x: 1, y: 2 }])).toBe('M1,2');
    expect(monotonePath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe('M0,0L10,5');
    const d = monotonePath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 10 }, { x: 30, y: 0 }]);
    expect(d.startsWith('M0,0C')).toBe(true);
    expect(d).toContain(',10,10C');
    expect(d).toContain(',20,10C');
    expect(d.endsWith(',30,0')).toBe(true);
  });

  test('monotone curve never leaves the range of its two neighbours', () => {
    const pts = [{ x: 0, y: 10 }, { x: 1, y: 80 }, { x: 2, y: 81 }, { x: 5, y: 20 }, { x: 6, y: 20 }, { x: 9, y: 100 }];
    const t = monotoneTangents(pts);
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      const h = b.x - a.x;
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      for (let k = 0; k <= 50; k++) {
        const s = k / 50;
        const y = (2 * s ** 3 - 3 * s ** 2 + 1) * a.y + (s ** 3 - 2 * s ** 2 + s) * h * t[i]
          + (-2 * s ** 3 + 3 * s ** 2) * b.y + (s ** 3 - s ** 2) * h * t[i + 1];
        expect(y).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(y).toBeLessThanOrEqual(hi + 1e-9);
      }
    }
    // A local peak and a flat run get zero tangents.
    expect(t[2]).toBe(0);
    expect(t[4]).toBe(0);
  });

  test('gaps over 3 weeks split the series', () => {
    const pts = ['2026-01-01', '2026-01-22', '2026-02-13', '2026-02-14'].map((date) => ({ date }));
    expect(splitGaps(pts).map((r) => r.map((p) => p.date))).toEqual([
      ['2026-01-01', '2026-01-22'],
      ['2026-02-13', '2026-02-14'],
    ]);
    expect(splitGaps([])).toEqual([]);
  });

  test('ranges', () => {
    expect(rangeStart('4W', '2026-03-28')).toBe('2026-03-01');
    expect(rangeStart('3M', '2026-05-31')).toBe('2026-03-01');
    expect(rangeStart('3M', '2026-11-05')).toBe('2026-08-06');
    expect(rangeStart('All', '2026-11-05')).toBeUndefined();
    const pts = [{ date: '2026-01-01' }, { date: '2026-03-02' }];
    expect(inRange(pts, '4W', '2026-03-28')).toEqual([{ date: '2026-03-02' }]);
    expect(inRange(pts, 'All', '2026-03-28')).toHaveLength(2);
  });

  test('nearestIndex', () => {
    expect(nearestIndex([], 3)).toBe(-1);
    expect(nearestIndex([0, 10, 20], 4)).toBe(0);
    expect(nearestIndex([0, 10, 20], 6)).toBe(1);
    expect(nearestIndex([0, 10, 20], 99)).toBe(2);
    expect(nearestIndex([0, 10, 20], -5)).toBe(0);
  });
});
