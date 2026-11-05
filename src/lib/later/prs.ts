// PR feed (v1.1): personal records found in logged sets, newest first.
import type { Exercise, ExerciseKind, LoggedSet } from '../../db/types';
import { e1rm } from '../stats';
import { compareDates } from './dates';

export type PrKind = 'weight' | 'e1rm' | 'reps' | 'hold' | 'distance' | 'fastest';

export interface PrEvent {
  date: string;
  exerciseId: string;
  kind: PrKind;
  /** lb for weight and e1rm, reps, seconds for hold and fastest, metres for distance. */
  value: number;
  /** The record it beat. */
  previous: number;
  set: LoggedSet & { date: string };
}

type DatedSet = LoggedSet & { date: string };

interface Metric {
  kind: PrKind;
  /** The value of a set, or undefined when the set does not count for this metric. */
  of(set: DatedSet): number | undefined;
  /** Metrics compared only between sets with the same key (fastest time at the same distance). */
  key?(set: DatedSet): string | undefined;
  lowerIsBetter?: boolean;
}

const positive = (n: number | undefined) => (n !== undefined && n > 0 ? n : undefined);

const METRICS: Record<ExerciseKind, Metric[]> = {
  barbell: [
    { kind: 'weight', of: (s) => (s.reps && s.reps > 0 ? positive(s.weightLb) : undefined) },
    { kind: 'e1rm', of: (s) => (s.weightLb && s.reps ? e1rm(s.weightLb, s.reps) : undefined) },
  ],
  dumbbell: [],
  bodyweight: [{ kind: 'reps', of: (s) => positive(s.strictReps ?? s.reps) }],
  hold: [{ kind: 'hold', of: (s) => positive(s.holdSec) }],
  run: [
    { kind: 'distance', of: (s) => positive(s.distanceM) },
    {
      kind: 'fastest',
      of: (s) => (s.distanceM ? positive(s.timeSec) : undefined),
      key: (s) => (s.distanceM ? String(s.distanceM) : undefined),
      lowerIsBetter: true,
    },
  ],
  checklist: [],
};
METRICS.dumbbell = METRICS.barbell;

/**
 * PRs for one exercise. A PR is the best set of a day that beats every earlier day.
 * The first day logged sets the baseline and is never a PR. Skipped and not-done sets never count.
 */
export function findPrs(exercise: Pick<Exercise, 'id' | 'kind'>, history: DatedSet[]): PrEvent[] {
  const sets = history.filter((s) => s.done && !s.skipped).sort((a, b) => compareDates(a.date, b.date) || a.order - b.order || a.setNo - b.setNo);
  const events: PrEvent[] = [];

  for (const metric of METRICS[exercise.kind] ?? []) {
    const better = (a: number, b: number) => (metric.lowerIsBetter ? a < b : a > b);
    const records = new Map<string, number>();
    let i = 0;
    while (i < sets.length) {
      const date = sets[i].date;
      const dayBest = new Map<string, { value: number; set: DatedSet }>();
      for (; i < sets.length && sets[i].date === date; i++) {
        const set = sets[i];
        const value = metric.of(set);
        const key = metric.key ? metric.key(set) : '';
        if (value === undefined || key === undefined) continue;
        const cur = dayBest.get(key);
        if (!cur || better(value, cur.value)) dayBest.set(key, { value, set });
      }
      for (const [key, { value, set }] of dayBest) {
        const record = records.get(key);
        if (record !== undefined && better(value, record)) {
          events.push({ date, exerciseId: exercise.id, kind: metric.kind, value, previous: record, set });
        }
        if (record === undefined || better(value, record)) records.set(key, value);
      }
    }
  }
  return events;
}

/**
 * PRs across exercises, newest first. Archived exercises keep their PRs. When one set is both
 * the heaviest and the best e1RM, the feed shows it once, as the weight PR.
 */
export function prFeed(entries: { exercise: Pick<Exercise, 'id' | 'kind' | 'name'>; history: DatedSet[] }[], limit = 50): PrEvent[] {
  const names = new Map(entries.map((e) => [e.exercise.id, e.exercise.name]));
  return entries
    .flatMap((e) => {
      const prs = findPrs(e.exercise, e.history);
      const weightSets = new Set(prs.filter((p) => p.kind === 'weight').map((p) => p.set.id));
      return prs.filter((p) => !(p.kind === 'e1rm' && weightSets.has(p.set.id)));
    })
    .sort((a, b) => compareDates(b.date, a.date) || (names.get(a.exerciseId) ?? '').localeCompare(names.get(b.exerciseId) ?? '') || a.kind.localeCompare(b.kind))
    .slice(0, limit);
}

/** One line per PR, e.g. "225 lb × 3" or "Best e1RM 248 lb (was 240)". */
export function describePr(pr: PrEvent): { title: string; detail: string } {
  const lb = (n: number) => `${Math.round(n * 10) / 10} lb`;
  const s = pr.set;
  switch (pr.kind) {
    case 'weight':
      return { title: `Heaviest: ${lb(pr.value)} × ${s.reps}`, detail: `was ${lb(pr.previous)}` };
    case 'e1rm':
      return { title: `Best e1RM: ${lb(Math.round(pr.value))}`, detail: `${lb(s.weightLb ?? 0)} × ${s.reps}, was ${lb(Math.round(pr.previous))}` };
    case 'reps':
      return { title: `Most reps: ${pr.value}`, detail: `was ${pr.previous}` };
    case 'hold':
      return { title: `Longest hold: ${formatSeconds(pr.value)}`, detail: `was ${formatSeconds(pr.previous)}` };
    case 'distance':
      return { title: `Longest: ${formatDistance(pr.value)}`, detail: `was ${formatDistance(pr.previous)}` };
    case 'fastest':
      return { title: `Fastest ${formatDistance(s.distanceM ?? 0)}: ${formatSeconds(pr.value)}`, detail: `was ${formatSeconds(pr.previous)}` };
  }
}

export function formatSeconds(sec: number): string {
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s} s`;
}

/** Metres shown as m below a mile, miles above. */
export function formatDistance(m: number): string {
  const mi = m / 1609.344;
  return mi >= 1 ? `${Math.round(mi * 100) / 100} mi` : `${Math.round(m)} m`;
}
