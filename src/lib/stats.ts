// Pure progress math shared by the log, finish and progress screens.
import type { LoggedSet } from '../db/types';

/** Estimated 1RM: weight x (1 + reps/30), from sets of 10 reps or fewer. */
export function e1rm(weightLb: number, reps: number): number | undefined {
  if (reps < 1 || reps > 10) return undefined;
  return weightLb * (1 + reps / 30);
}

/** Total lb moved by done sets. */
export function volume(sets: LoggedSet[]): number {
  return sets.reduce((sum, s) => (s.done && s.weightLb && s.reps ? sum + s.weightLb * s.reps : sum), 0);
}
