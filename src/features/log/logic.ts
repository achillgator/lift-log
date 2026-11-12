// Pure rules for the Log and Finish sheets. The sheets apply them and save each changed set at once.
import type { ExerciseKind, LoggedSet } from '../../db/types';
import { doneAsPlanned } from '../../components/setrow';
import { e1rm, volume } from '../../lib/stats';

export interface ExerciseGroup { exerciseId: string; sets: LoggedSet[] }

export function sortSets(sets: LoggedSet[]): LoggedSet[] {
  return [...sets].sort((a, b) => a.order - b.order || a.setNo - b.setNo);
}

/** Sets grouped per exercise, in session order (first appearance), each group by set number. */
export function groupByExercise(sets: LoggedSet[]): ExerciseGroup[] {
  const groups = new Map<string, LoggedSet[]>();
  for (const s of sortSets(sets)) {
    const g = groups.get(s.exerciseId);
    if (g) g.push(s);
    else groups.set(s.exerciseId, [s]);
  }
  return [...groups].map(([exerciseId, list]) => ({ exerciseId, sets: list }));
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Add set: copies the last set's plan (and its actual weight as the new target), not done. */
export function setAfter(group: LoggedSet[], sessionId: string, exerciseId: string): LoggedSet {
  const last = group[group.length - 1];
  return {
    id: newId(),
    sessionId,
    exerciseId,
    order: last?.order ?? 0,
    setNo: (last?.setNo ?? 0) + 1,
    targetWeightLb: last?.weightLb ?? last?.targetWeightLb,
    targetReps: last?.reps ?? last?.targetReps,
    done: false,
    skipped: false,
  };
}

/** First set of an exercise added during the log, planned from the last time it was done. */
export function firstSet(all: LoggedSet[], sessionId: string, exerciseId: string, previous?: Pick<LoggedSet, 'weightLb' | 'reps'>): LoggedSet {
  const order = all.reduce((max, s) => Math.max(max, s.order), -1) + 1;
  return {
    id: newId(), sessionId, exerciseId, order, setNo: 1,
    targetWeightLb: previous?.weightLb, targetReps: previous?.reps,
    done: false, skipped: false,
  };
}

/**
 * Tap on an exercise: every set not yet done (and not skipped) becomes done as planned.
 * When all are already done, the tap clears them instead. Returns only the changed sets.
 */
export function tapExercise(group: LoggedSet[], kind: ExerciseKind): LoggedSet[] {
  const open = group.filter((s) => !s.done && !s.skipped);
  if (open.length) return open.map((s) => doneAsPlanned(s, kind));
  return group.filter((s) => s.done).map((s) => ({ ...s, done: false }));
}

export function swapExercise(group: LoggedSet[], exerciseId: string): LoggedSet[] {
  return group.map((s) => ({ ...s, exerciseId }));
}

/** Default duration: minutes since the session started, at least 1. */
export function defaultDuration(startedAt: number, now = Date.now()): number {
  return Math.max(1, Math.round((now - startedAt) / 60_000));
}

export interface Pr { exerciseId: string; e1rm: number; previous: number }

function bestE1rm(sets: Pick<LoggedSet, 'weightLb' | 'reps' | 'done'>[]): number | undefined {
  let best: number | undefined;
  for (const s of sets) {
    if (!s.done || !s.weightLb || !s.reps) continue;
    const v = e1rm(s.weightLb, s.reps);
    if (v !== undefined && (best === undefined || v > best)) best = v;
  }
  return best;
}

/** A PR is a best e1RM above every earlier finished session's best for that exercise. */
export function findPrs(sets: LoggedSet[], history: Record<string, Pick<LoggedSet, 'weightLb' | 'reps' | 'done' | 'sessionId'>[]>): Pr[] {
  const prs: Pr[] = [];
  for (const g of groupByExercise(sets)) {
    const now = bestE1rm(g.sets);
    const earlier = (history[g.exerciseId] ?? []).filter((s) => s.sessionId !== g.sets[0].sessionId);
    const previous = bestE1rm(earlier);
    if (now !== undefined && previous !== undefined && now > previous + 1e-9) prs.push({ exerciseId: g.exerciseId, e1rm: now, previous });
  }
  return prs;
}

export interface Summary { volumeLb: number; doneSets: number; skippedSets: number }

export function summarize(sets: LoggedSet[]): Summary {
  return {
    volumeLb: volume(sets),
    doneSets: sets.filter((s) => s.done).length,
    skippedSets: sets.filter((s) => s.skipped).length,
  };
}
