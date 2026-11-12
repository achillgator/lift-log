// Pure progress math shared by the log, finish, progress, trophy and body screens.
// No Dexie, no DOM, no clock: callers pass "today" in, so every function is testable.
import type { LoggedSet } from '../db/types';

/** A logged set joined with its session's local date, as returned by api.setHistory. */
export type DatedSet = LoggedSet & { date: string };

// ---------------------------------------------------------------------------
// e1RM and volume
// ---------------------------------------------------------------------------

/** Estimated 1RM: weight x (1 + reps/30), from sets of 10 reps or fewer. */
export function e1rm(weightLb: number, reps: number): number | undefined {
  if (reps < 1 || reps > 10) return undefined;
  return weightLb * (1 + reps / 30);
}

/** Total lb moved by done sets. */
export function volume(sets: LoggedSet[]): number {
  return sets.reduce((sum, s) => (s.done && s.weightLb && s.reps ? sum + s.weightLb * s.reps : sum), 0);
}

/** e1RM of one logged set, or undefined when it is not done or has no weight/reps or more than 10 reps. */
export function setE1rm(s: LoggedSet): number | undefined {
  if (!s.done || s.skipped || !s.weightLb || !s.reps) return undefined;
  return e1rm(s.weightLb, s.reps);
}

/** Best e1RM across sets, or undefined when no set qualifies. */
export function bestE1rm(sets: LoggedSet[]): number | undefined {
  let best: number | undefined;
  for (const s of sets) {
    const v = setE1rm(s);
    if (v !== undefined && (best === undefined || v > best)) best = v;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Dates (local YYYY-MM-DD). Day arithmetic goes through UTC so DST never shifts a day.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Whole-day number for a YYYY-MM-DD date (days since 1970-01-01). */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** YYYY-MM-DD for a day number. */
export function fromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromDayNumber(dayNumber(date) + days);
}

export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/** Local YYYY-MM-DD for a Date (the caller passes `new Date()` for today). */
export function toLocalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday of the week that contains `date`. */
export function weekStart(date: string): string {
  const day = dayNumber(date);
  const weekday = (day + 3) % 7; // 1970-01-01 was a Thursday; 0 = Monday
  return fromDayNumber(day - weekday);
}

// ---------------------------------------------------------------------------
// Per-session summaries
// ---------------------------------------------------------------------------

export interface SessionBest {
  sessionId: string;
  date: string;
  /** Heaviest done set (ties go to more reps). */
  topWeightLb: number;
  topReps: number;
  /** Best e1RM in the session; undefined when every set had more than 10 reps. */
  e1rm?: number;
}

/** Top set and best e1RM for each session, oldest first. Sets without weight or reps are ignored. */
export function topSetPerSession(history: DatedSet[]): SessionBest[] {
  const bySession = new Map<string, SessionBest>();
  for (const s of history) {
    if (!s.done || s.skipped || !s.weightLb || !s.reps) continue;
    let best = bySession.get(s.sessionId);
    if (!best) {
      best = { sessionId: s.sessionId, date: s.date, topWeightLb: s.weightLb, topReps: s.reps };
      bySession.set(s.sessionId, best);
    } else if (s.weightLb > best.topWeightLb || (s.weightLb === best.topWeightLb && s.reps > best.topReps)) {
      best.topWeightLb = s.weightLb;
      best.topReps = s.reps;
    }
    const est = e1rm(s.weightLb, s.reps);
    if (est !== undefined && (best.e1rm === undefined || est > best.e1rm)) best.e1rm = est;
  }
  return [...bySession.values()].sort(byDate);
}

export interface SessionValue { sessionId: string; date: string; value: number; }

/** Sum of a per-set number for each session (e.g. strict reps, distance), oldest first. Sessions summing to 0 are dropped. */
export function sumPerSession(history: DatedSet[], pick: (s: LoggedSet) => number | undefined): SessionValue[] {
  const map = new Map<string, SessionValue>();
  for (const s of history) {
    if (!s.done || s.skipped) continue;
    const v = pick(s);
    if (!v) continue;
    const row = map.get(s.sessionId) ?? { sessionId: s.sessionId, date: s.date, value: 0 };
    row.value += v;
    map.set(s.sessionId, row);
  }
  return [...map.values()].filter((r) => r.value > 0).sort(byDate);
}

/** Largest per-set number for each session (e.g. longest hold), oldest first. */
export function maxPerSession(history: DatedSet[], pick: (s: LoggedSet) => number | undefined): SessionValue[] {
  const map = new Map<string, SessionValue>();
  for (const s of history) {
    if (!s.done || s.skipped) continue;
    const v = pick(s);
    if (!v) continue;
    const row = map.get(s.sessionId);
    if (!row) map.set(s.sessionId, { sessionId: s.sessionId, date: s.date, value: v });
    else if (v > row.value) row.value = v;
  }
  return [...map.values()].sort(byDate);
}

/** Strict reps for a bodyweight set: strictReps when logged (assisted drop sets), else reps. */
export function strictReps(s: LoggedSet): number | undefined {
  return s.strictReps ?? s.reps;
}

// ---------------------------------------------------------------------------
// PR detection
// ---------------------------------------------------------------------------

export type PrKind = 'e1rm' | 'weight' | 'reps' | 'hold';

export interface PersonalRecord {
  setId: string;
  exerciseId: string;
  kind: PrKind;
  value: number;
  /** Best before this set, or undefined for the first ever. */
  previous?: number;
}

/**
 * Which sets in `current` beat every set in `previous` for the same exercise.
 * Weighted sets: best e1RM and heaviest weight. Unweighted sets: most strict reps in a set.
 * Holds: longest hold. A first-ever set is not a PR (there is nothing to beat).
 * Within `current`, only the best set per exercise and kind is reported.
 */
export function detectPRs(previous: LoggedSet[], current: LoggedSet[]): PersonalRecord[] {
  const metrics: { kind: PrKind; of: (s: LoggedSet) => number | undefined }[] = [
    { kind: 'e1rm', of: setE1rm },
    { kind: 'weight', of: (s) => (s.done && !s.skipped && s.weightLb && s.reps ? s.weightLb : undefined) },
    { kind: 'reps', of: (s) => (s.done && !s.skipped && !s.weightLb && !s.holdSec && !s.distanceM ? strictReps(s) || undefined : undefined) },
    { kind: 'hold', of: (s) => (s.done && !s.skipped && s.holdSec ? s.holdSec : undefined) },
  ];
  const out: PersonalRecord[] = [];
  const exerciseIds = [...new Set(current.map((s) => s.exerciseId))];
  for (const exerciseId of exerciseIds) {
    const before = previous.filter((s) => s.exerciseId === exerciseId);
    const now = current.filter((s) => s.exerciseId === exerciseId);
    for (const { kind, of } of metrics) {
      const prevBest = maxOf(before.map(of));
      if (prevBest === undefined) continue;
      let best: { set: LoggedSet; value: number } | undefined;
      for (const s of now) {
        const v = of(s);
        if (v !== undefined && v > prevBest && (!best || v > best.value)) best = { set: s, value: v };
      }
      if (best) out.push({ setId: best.set.id, exerciseId, kind, value: best.value, previous: prevBest });
    }
  }
  return out;
}

/** Dates (oldest first) on which a session set a new best e1RM, for marking PRs on a chart. */
export function e1rmPrDates(bests: SessionBest[]): string[] {
  const out: string[] = [];
  let best = -Infinity;
  for (const b of bests) {
    if (b.e1rm === undefined) continue;
    if (b.e1rm > best) {
      if (best !== -Infinity) out.push(b.date);
      best = b.e1rm;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weekly volume
// ---------------------------------------------------------------------------

export interface WeekVolume { week: string; volumeLb: number; }

/**
 * Lb moved per Monday-start week, oldest first. Weeks between the first and last week with no
 * training are included as 0 so a bar chart shows the gap honestly.
 */
export function weeklyVolume(sets: DatedSet[]): WeekVolume[] {
  const map = new Map<string, number>();
  for (const s of sets) {
    const v = volume([s]);
    if (!v) continue;
    const w = weekStart(s.date);
    map.set(w, (map.get(w) ?? 0) + v);
  }
  if (!map.size) return [];
  const weeks = [...map.keys()].sort();
  const out: WeekVolume[] = [];
  for (let w = weeks[0]; w <= weeks[weeks.length - 1]; w = addDays(w, 7)) {
    out.push({ week: w, volumeLb: map.get(w) ?? 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bodyweight
// ---------------------------------------------------------------------------

export interface WeighIn { date: string; weightLb: number; }
export interface AveragedWeighIn extends WeighIn { avgLb: number; }

/**
 * 7-day rolling average at each weigh-in: the mean of every weigh-in from date-6 through date.
 * One point per real weigh-in, so a chart of it never invents values.
 */
export function rollingAverage(entries: WeighIn[], days = 7): AveragedWeighIn[] {
  const sorted = [...entries].sort(byDate);
  const out: AveragedWeighIn[] = [];
  let start = 0;
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].weightLb;
    const day = dayNumber(sorted[i].date);
    while (dayNumber(sorted[start].date) <= day - days) sum -= sorted[start++].weightLb;
    out.push({ date: sorted[i].date, weightLb: sorted[i].weightLb, avgLb: sum / (i - start + 1) });
  }
  return out;
}

export interface CurrentBodyweight { lb: number; source: 'average' | 'latest'; }

/**
 * Bodyweight for ranking on `today`: the average of weigh-ins in the last 7 days (today-6..today);
 * if there are none, the latest weigh-in on or before today; if none at all, undefined.
 */
export function currentBodyweight(entries: WeighIn[], today: string, days = 7): CurrentBodyweight | undefined {
  const past = entries.filter((e) => e.date <= today);
  if (!past.length) return undefined;
  const from = addDays(today, -(days - 1));
  const recent = past.filter((e) => e.date >= from);
  if (recent.length) return { lb: recent.reduce((s, e) => s + e.weightLb, 0) / recent.length, source: 'average' };
  const latest = past.reduce((a, b) => (b.date > a.date ? b : a));
  return { lb: latest.weightLb, source: 'latest' };
}

/** Change in rolling average from the first to the last point, or undefined with fewer than 2 points. */
export function changeSinceStart(points: AveragedWeighIn[]): number | undefined {
  if (points.length < 2) return undefined;
  return points[points.length - 1].avgLb - points[0].avgLb;
}

/** Next bodyweight stepper value: 0.2 lb steps without float drift. */
export function stepWeight(value: number, steps: number, stepLb = 0.2): number {
  return Math.round((value + steps * stepLb) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Trophies
// ---------------------------------------------------------------------------

export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] as const;
export type TierName = (typeof TIER_NAMES)[number];
export type Tiers = [number, number, number, number, number];

export interface TrophyRank {
  ratio: number;
  /** -1 = Unranked (below Bronze), 0..4 = Bronze..Diamond. */
  tier: number;
  tierName: TierName | 'Unranked';
  next?: { tier: number; name: TierName; ratio: number; lbToGo: number };
  /** 0..1 progress from the current tier threshold (0 when unranked) to the next one; 1 at Diamond. */
  progress: number;
}

/** Tier from best e1RM / bodyweight against five ascending x-bodyweight thresholds. */
export function trophyRank(e1rmLb: number, bodyweightLb: number, tiers: Tiers): TrophyRank {
  const ratio = e1rmLb / bodyweightLb;
  let tier = -1;
  for (let i = 0; i < tiers.length; i++) if (ratio >= tiers[i]) tier = i;
  const tierName = tier < 0 ? 'Unranked' : TIER_NAMES[tier];
  if (tier === tiers.length - 1) return { ratio, tier, tierName, progress: 1 };
  const nextRatio = tiers[tier + 1];
  const floor = tier < 0 ? 0 : tiers[tier];
  return {
    ratio,
    tier,
    tierName,
    next: { tier: tier + 1, name: TIER_NAMES[tier + 1], ratio: nextRatio, lbToGo: lbToNextTier(e1rmLb, bodyweightLb, nextRatio) },
    progress: clamp((ratio - floor) / (nextRatio - floor), 0, 1),
  };
}

/** Whole lb of e1RM still needed to reach `targetRatio` x bodyweight (at least 1 while short of it). */
export function lbToNextTier(e1rmLb: number, bodyweightLb: number, targetRatio: number): number {
  const gap = targetRatio * bodyweightLb - e1rmLb;
  return gap <= 0 ? 0 : Math.max(1, Math.ceil(gap - 1e-9));
}

/** True when the five thresholds are positive and strictly ascending. */
export function validTiers(t: number[]): t is Tiers {
  return t.length === 5 && t.every((v, i) => Number.isFinite(v) && v > 0 && (i === 0 || v > t[i - 1]));
}

// ---------------------------------------------------------------------------
// Chart geometry
// ---------------------------------------------------------------------------

export interface Pt { x: number; y: number; }

/**
 * SVG path through the points with monotone cubic (Fritsch-Carlson) smoothing.
 * The curve passes through every point and never overshoots between neighbours, so it never
 * shows a value that was not between two real ones. Points must be sorted by x.
 */
export function monotonePath(pts: Pt[]): string {
  const n = pts.length;
  if (n === 0) return '';
  const f = (v: number) => +v.toFixed(2);
  if (n === 1) return `M${f(pts[0].x)},${f(pts[0].y)}`;
  if (n === 2) return `M${f(pts[0].x)},${f(pts[0].y)}L${f(pts[1].x)},${f(pts[1].y)}`;
  const t = monotoneTangents(pts);
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (pts[i + 1].x - pts[i].x) / 3;
    d += `C${f(pts[i].x + h)},${f(pts[i].y + h * t[i])},${f(pts[i + 1].x - h)},${f(pts[i + 1].y - h * t[i + 1])},${f(pts[i + 1].x)},${f(pts[i + 1].y)}`;
  }
  return d;
}

/** Fritsch-Carlson tangents (dy/dx at each point). Exported for tests. */
export function monotoneTangents(pts: Pt[]): number[] {
  const n = pts.length;
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    slope.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx);
  }
  const t = new Array<number>(n);
  t[0] = slope[0];
  t[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / slope[i];
    const b = t[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * slope[i];
      t[i + 1] = k * b * slope[i];
    }
  }
  return t;
}

/**
 * Splits a date-sorted series into runs wherever two neighbours are more than `maxGapDays` apart
 * (default: breaks over 3 weeks), so a chart never draws a line across a break.
 */
export function splitGaps<T extends { date: string }>(points: T[], maxGapDays = 21): T[][] {
  const out: T[][] = [];
  for (const p of points) {
    const run = out[out.length - 1];
    if (run && daysBetween(run[run.length - 1].date, p.date) <= maxGapDays) run.push(p);
    else out.push([p]);
  }
  return out;
}

export type Range = '4W' | '3M' | 'All';

/** First date shown for a range ending today, or undefined for All. 4W = 28 days, 3M = 3 calendar months. */
export function rangeStart(range: Range, today: string): string | undefined {
  if (range === '4W') return addDays(today, -27);
  if (range === '3M') {
    const [y, m, d] = today.split('-').map(Number);
    const target = new Date(Date.UTC(y, m - 4, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, lastDay));
    return addDays(target.toISOString().slice(0, 10), 1);
  }
  return undefined;
}

/** Points on or after the range start. */
export function inRange<T extends { date: string }>(points: T[], range: Range, today: string): T[] {
  const from = rangeStart(range, today);
  return from ? points.filter((p) => p.date >= from) : points;
}

/** Index of the point whose x is nearest to `x` (points sorted by x), or -1 when empty. */
export function nearestIndex(xs: number[], x: number): number {
  if (!xs.length) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
}

// ---------------------------------------------------------------------------

function byDate<T extends { date: string }>(a: T, b: T): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

function maxOf(values: (number | undefined)[]): number | undefined {
  let best: number | undefined;
  for (const v of values) if (v !== undefined && (best === undefined || v > best)) best = v;
  return best;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
