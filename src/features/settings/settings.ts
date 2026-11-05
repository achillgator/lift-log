// Pure helpers for the Settings pages.
import type { Exercise, ImportPreview, LoggedSet } from '../../db/types';

export interface WorkingWeight { exercise: Exercise; weightLb?: number; reps?: number; date?: string }

/** Last done set per exercise (histories are oldest first, as the api returns them). */
export function latestWeights(exercises: Exercise[], histories: (LoggedSet & { date: string })[][]): WorkingWeight[] {
  return exercises
    .map((exercise, i) => {
      const last = [...(histories[i] ?? [])].reverse().find((s) => s.done && s.weightLb !== undefined);
      return { exercise, weightLb: last?.weightLb, reps: last?.reps, date: last?.date };
    })
    .sort((a, b) => Number(b.exercise.isMain) - Number(a.exercise.isMain) || a.exercise.name.localeCompare(b.exercise.name));
}

/** "2 sessions · 12 sets" from an import preview. */
export function describeCounts(preview: ImportPreview): string {
  const parts = Object.entries(preview.counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${n === 1 ? k.replace(/s$/, '') : k}`);
  return parts.length ? parts.join(' · ') : 'Nothing to import';
}
