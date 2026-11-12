// Pure rules behind SetRow, shared by logging, editing and history.
import type { ExerciseKind, LoggedSet } from '../db/types';
import { formatClock, formatLb, metersToMiles } from './format';

export type SetState = 'planned' | 'done' | 'edited' | 'skipped';

export const WEIGHTED: ExerciseKind[] = ['barbell', 'dumbbell'];

/** Holds have no target field in the contract, so their planned seconds live in targetReps. */
export function setState(set: LoggedSet, kind: ExerciseKind = 'barbell'): SetState {
  if (set.skipped) return 'skipped';
  if (!set.done) return 'planned';
  const differs = (actual: number | undefined, target: number | undefined) =>
    target !== undefined && actual !== undefined && actual !== target;
  if (kind === 'hold') return differs(set.holdSec, set.targetReps) ? 'edited' : 'done';
  if (kind === 'run' || kind === 'checklist') return 'done';
  return differs(set.weightLb, set.targetWeightLb) || differs(set.reps, set.targetReps) ? 'edited' : 'done';
}

/** "Done as planned": fills any missing actual value from its target and marks the set done. */
export function doneAsPlanned(set: LoggedSet, kind: ExerciseKind = 'barbell'): LoggedSet {
  const next: LoggedSet = { ...set, done: true, skipped: false };
  if (kind === 'hold') next.holdSec = set.holdSec ?? set.targetReps;
  else if (kind !== 'run' && kind !== 'checklist') {
    next.weightLb = set.weightLb ?? set.targetWeightLb;
    next.reps = set.reps ?? set.targetReps;
  }
  return next;
}

/** Tap on a set: done as planned, or back to not done (values the person entered are kept). */
export function toggleSet(set: LoggedSet, kind: ExerciseKind = 'barbell'): LoggedSet {
  return set.done ? { ...set, done: false } : doneAsPlanned(set, kind);
}

/** One-line description of a set: what was done, or what is planned. */
export function setSummary(set: LoggedSet, kind: ExerciseKind = 'barbell'): string {
  const planned = !set.done;
  const w = planned ? set.weightLb ?? set.targetWeightLb : set.weightLb;
  const r = planned ? set.reps ?? set.targetReps : set.reps;
  switch (kind) {
    case 'hold':
      return `${set.holdSec ?? set.targetReps ?? '–'} s`;
    case 'run': {
      const mi = metersToMiles(set.distanceM);
      return `${mi === undefined ? '–' : mi} mi · ${formatClock(set.timeSec)}`;
    }
    case 'checklist':
      return set.done ? 'Done' : 'To do';
    case 'bodyweight': {
      const strict = set.strictReps !== undefined ? ` (${set.strictReps} strict)` : '';
      const added = w ? ` +${formatLb(w)} lb` : '';
      return `${r ?? '–'} reps${strict}${added}`;
    }
    default:
      return `${formatLb(w)} lb × ${r ?? '–'}`;
  }
}

/**
 * Typo guard: a weight over 1.5x the target or over 500 lb gets an inline "Did you mean...?".
 * Suggests the weight with one digit fewer when that lands near the target, else the target.
 */
export function typoGuard(weightLb: number | undefined, targetLb: number | undefined, roundToLb = 5): number | undefined {
  if (weightLb === undefined) return undefined;
  const hasTarget = targetLb !== undefined && targetLb > 0;
  if (!(weightLb > 500 || (hasTarget && weightLb > targetLb * 1.5))) return undefined;
  const round = (n: number) => (roundToLb > 0 ? Math.round(n / roundToLb) * roundToLb : n);
  const shifted = round(weightLb / 10);
  let guess = shifted;
  if (hasTarget && Math.abs(shifted - targetLb) > targetLb * 0.5) guess = targetLb;
  return guess > 0 && guess !== weightLb ? guess : undefined;
}
