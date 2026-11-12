// Builds the pre-filled sets for one routine item. Pure: the caller looks up history and passes it in.
import type { Exercise, LoggedSet, Routine, RoutineItem } from '../db/types';
import { derivedWeight, nextTarget, runDistanceMi, type LastPerformance } from './progression';
import { miToM } from './units';

export type PlannedSet = Omit<LoggedSet, 'id' | 'sessionId' | 'order'>;

export interface PlanInput {
  exercise: Exercise;
  item: RoutineItem;
  routine?: Routine;
  date: string;
  last?: LastPerformance;
  sameRoutine?: boolean;
  /** Latest working weight of the derived source, when the exercise has derivedFrom. */
  sourceWeightLb?: number;
  autoIncreaseGlobal: boolean;
  maxEffort: number;
}

/**
 * Planned sets for one item. Actual fields start equal to the targets so a tap means "done as planned".
 * - Lifts: targetWeightLb/weightLb from the progression rules (derived lifts follow their source),
 *   targetReps/reps from the plan.
 * - Holds: holdSec = the item's reps (seconds).
 * - Runs: distanceM from the routine's distance progression, else the item's distanceM; timeSec from the
 *   item's targetTimeSec. Interval reps are a run item with several sets.
 * - Checklist: empty sets to tick off.
 */
export function planItem(input: PlanInput): PlannedSet[] {
  const { exercise, item, routine, date } = input;
  const base = (setNo: number): PlannedSet => ({ exerciseId: exercise.id, setNo, done: false, skipped: false });
  const count = Math.max(1, Math.floor(item.sets));
  const sets = Array.from({ length: count }, (_, i) => base(i + 1));

  switch (exercise.kind) {
    case 'hold':
      return sets.map((s) => ({ ...s, holdSec: item.reps }));
    case 'run': {
      const distanceM = routine?.distanceProgression ? miToM(runDistanceMi(routine.distanceProgression, date)) : item.distanceM;
      return sets.map((s) => ({ ...s, distanceM, timeSec: item.targetTimeSec }));
    }
    case 'checklist':
      return sets;
    default: {
      const target = nextTarget(input);
      let weightLb = target.weightLb;
      if (exercise.derivedFrom) {
        weightLb = derivedWeight(input.sourceWeightLb, exercise.derivedFrom.pct, exercise.roundToLb) ?? weightLb;
      }
      return sets.map((s) => ({ ...s, targetWeightLb: weightLb, weightLb, targetReps: target.reps, reps: target.reps }));
    }
  }
}
