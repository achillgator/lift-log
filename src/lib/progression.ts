// Progression rules from SPEC.md, as pure functions. Nothing here reads the database.
import type { Exercise, ExerciseKind, LoggedSet, Routine, RoutineItem } from '../db/types';
import { startOfWeek, addDays, weeksBetween } from './dates';

/** Default increment and rounding per exercise, used by the seed and by new exercises. */
export const DEFAULT_ROUND_LB: Record<ExerciseKind, number> = {
  barbell: 5, dumbbell: 2.5, bodyweight: 2.5, hold: 0, run: 0, checklist: 0,
};
export const DEFAULT_INCREMENT_LB: Record<ExerciseKind, number> = {
  barbell: 5, dumbbell: 2.5, bodyweight: 0, hold: 0, run: 0, checklist: 0,
};

/** Rounds to the nearest multiple of step (barbell 5, dumbbell 2.5). A step of 0 or less only trims float noise. */
export function roundTo(weightLb: number, stepLb: number): number {
  const rounded = stepLb > 0 ? Math.round(weightLb / stepLb) * stepLb : weightLb;
  return Math.round(rounded * 100) / 100;
}

/** The rep range for an item: the routine item's reps..repsMax, else the exercise's repMin..repMax. */
export function repRange(exercise: Exercise, item: RoutineItem): { min: number; max: number } | undefined {
  if (item.repsMax !== undefined && item.repsMax > item.reps) return { min: item.reps, max: item.repsMax };
  if (exercise.repMin !== undefined && exercise.repMax !== undefined && exercise.repMax > exercise.repMin) {
    return { min: exercise.repMin, max: exercise.repMax };
  }
  return undefined;
}

/** True when every set was done (not skipped) with at least its target reps. */
export function hitAllReps(sets: LoggedSet[]): boolean {
  return sets.length > 0 && sets.every((s) => s.done && !s.skipped && (s.reps ?? 0) >= (s.targetReps ?? 0));
}

/** The working weight of a performance: heaviest done set, else heaviest target (all skipped). */
export function workingWeight(sets: LoggedSet[]): number | undefined {
  const max = (xs: (number | undefined)[]) => {
    const nums = xs.filter((x): x is number => typeof x === 'number');
    return nums.length ? Math.max(...nums) : undefined;
  };
  return max(sets.filter((s) => s.done && !s.skipped).map((s) => s.weightLb)) ?? max(sets.map((s) => s.targetWeightLb));
}

/** One exercise's sets from the last finished session, plus that session's effort. */
export interface LastPerformance { sets: LoggedSet[]; effort?: number; }
export interface Target { weightLb?: number; reps: number; }

export interface NextTargetInput {
  exercise: Exercise;
  item: RoutineItem;
  /** Last performance of this exercise in the same routine (or anywhere, with sameRoutine false). */
  last?: LastPerformance;
  /** False when `last` came from another routine: the weight is held, never increased. */
  sameRoutine?: boolean;
  autoIncreaseGlobal: boolean;
  maxEffort: number;
}

/**
 * Next target for one exercise.
 * Fixed reps: last weight + incrementLb when auto-increase is on (global and per exercise), every set hit its
 * target reps, and effort <= maxEffort (no effort = fine); otherwise hold.
 * Rep range: same gate, but first add one rep per session until the target is repMax, then add
 * incrementLb and reset to repMin. A bodyweight lift with no weight stays at repMax.
 */
export function nextTarget({ exercise, item, last, sameRoutine = true, autoIncreaseGlobal, maxEffort }: NextTargetInput): Target {
  const range = repRange(exercise, item);
  if (!last || last.sets.length === 0) return { reps: range?.min ?? item.reps };

  const lastWeight = workingWeight(last.sets);
  const effortOk = last.effort === undefined || last.effort <= maxEffort;
  const progress = sameRoutine && autoIncreaseGlobal && exercise.autoIncrease && effortOk && hitAllReps(last.sets);
  const heavier = lastWeight === undefined ? undefined : roundTo(lastWeight + exercise.incrementLb, exercise.roundToLb);

  if (!range) return { weightLb: progress ? heavier : lastWeight, reps: item.reps };

  const targets = last.sets.map((s) => s.targetReps).filter((r): r is number => typeof r === 'number');
  const lastReps = Math.min(range.max, Math.max(range.min, targets.length ? Math.max(...targets) : range.min));
  if (!progress) return { weightLb: lastWeight, reps: lastReps };
  if (lastReps < range.max) return { weightLb: lastWeight, reps: lastReps + 1 };
  if (heavier === undefined || exercise.incrementLb <= 0) return { weightLb: lastWeight, reps: range.max };
  return { weightLb: heavier, reps: range.min };
}

/** Derived lift: pct percent (e.g. 80) of the source's latest weight, rounded to the exercise's step. */
export function derivedWeight(sourceWeightLb: number | undefined, pct: number, roundToLb: number): number | undefined {
  if (sourceWeightLb === undefined || !(pct > 0)) return undefined;
  return roundTo((sourceWeightLb * pct) / 100, roundToLb);
}

/** One finished session's result for one exercise, for the stall rule. */
export interface ExerciseOutcome { date: string; hitAll: boolean; weightLb?: number; }

export interface Stall { stalled: boolean; weeks: number; lastWeightLb?: number; suggestedWeightLb?: number; }

/**
 * Stall rule: the exercise missed reps `stallWeeks` weeks running. Weeks run Monday to Sunday; a week counts
 * as missed when the exercise's last session that week missed reps. The weeks must be consecutive and end
 * with the most recent session's week. The suggestion is the last weight minus deloadPct, rounded.
 */
export function stallStatus(outcomes: ExerciseOutcome[], stallWeeks: number, deloadPct: number, roundToLb: number): Stall {
  if (outcomes.length === 0 || stallWeeks < 1) return { stalled: false, weeks: 0 };
  const sorted = [...outcomes].sort((a, b) => a.date.localeCompare(b.date));
  const lastByWeek = new Map<string, ExerciseOutcome>();
  for (const o of sorted) lastByWeek.set(startOfWeek(o.date), o);

  const latest = sorted[sorted.length - 1];
  let week = startOfWeek(latest.date);
  let weeks = 0;
  while (weeks < stallWeeks) {
    const o = lastByWeek.get(week);
    if (!o || o.hitAll) break;
    weeks++;
    week = addDays(week, -7);
  }
  const lastWeightLb = latest.weightLb;
  const stalled = weeks >= stallWeeks;
  return {
    stalled, weeks, lastWeightLb,
    suggestedWeightLb: stalled && lastWeightLb !== undefined ? roundTo(lastWeightLb * (1 - deloadPct / 100), roundToLb) : undefined,
  };
}

/**
 * Planned run distance on a date: startMi until fromDate, then + stepMi every `everyWeeks` weeks, never past capMi.
 */
export function runDistanceMi(p: NonNullable<Routine['distanceProgression']>, date: string): number {
  if (date < p.fromDate || !(p.everyWeeks > 0)) return p.startMi;
  const steps = Math.floor(weeksBetween(p.fromDate, date) / p.everyWeeks);
  const raw = p.startMi + steps * p.stepMi;
  const capped = p.stepMi >= 0 ? Math.min(p.capMi, raw) : Math.max(p.capMi, raw);
  return Math.round(capped * 100) / 100;
}
