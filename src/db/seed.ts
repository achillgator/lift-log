// First-launch seed: generic data only (SPEC "FIRST LAUNCH"). Everything here is editable or deletable in the app.
import type { Transaction } from 'dexie';
import type { Exercise, ExerciseKind, QuickAdd, Routine, Settings, TrophyTiers } from './types';
import { SETTINGS_KEY } from './schema';

const id = () => crypto.randomUUID();

export const DEFAULT_RULES: Settings['rules'] = { stallWeeks: 2, deloadPct: 10, maxEffort: 8 };
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5];

/** Tier multiples of bodyweight, Bronze..Diamond, keyed by main lift name (see trophyTiers in settings). */
export const DEFAULT_TIER_MULTIPLES: Record<string, TrophyTiers[string]> = {
  Squat: [1.0, 1.25, 1.5, 1.75, 2.0],
  'Bench press': [0.75, 1.0, 1.25, 1.5, 1.75],
  Deadlift: [1.25, 1.5, 1.75, 2.0, 2.5],
  'Overhead press': [0.5, 0.6, 0.75, 0.9, 1.05],
};

/** Settings defaults. trophyTiers is keyed by exercise id; the seed fills in the four main lifts. */
export function defaultSettings(): Settings {
  return { autoIncreaseGlobal: true, rules: { ...DEFAULT_RULES }, trophyTiers: {}, platesOwned: [...DEFAULT_PLATES_LB], unit: 'lb' };
}

type SeedExercise = [name: string, kind: ExerciseKind, incrementLb: number, roundToLb: number, isMain: boolean];

const SEED_EXERCISES: SeedExercise[] = [
  ['Squat', 'barbell', 5, 5, true],
  ['Pause squat', 'barbell', 5, 5, false],
  ['Bench press', 'barbell', 5, 5, true],
  ['Deadlift', 'barbell', 10, 5, true],
  ['Overhead press', 'barbell', 5, 5, true],
  ['Row', 'barbell', 5, 5, false],
  ['Incline DB curl', 'dumbbell', 2.5, 2.5, false],
  ['Hammer curl', 'dumbbell', 2.5, 2.5, false],
  ['Pull-up drop set', 'bodyweight', 0, 2.5, false],
  ['Pull-up negative', 'bodyweight', 0, 2.5, false],
  ['Hanging leg raise', 'bodyweight', 0, 2.5, false],
  ['Dead hang', 'hold', 0, 0, false],
  ['Run', 'run', 0, 0, false],
];

export interface SeedData {
  exercises: Exercise[]; routines: Routine[]; quickAdds: QuickAdd[]; settings: Settings;
}

export function buildSeed(): SeedData {
  const exercises: Exercise[] = SEED_EXERCISES.map(([name, kind, incrementLb, roundToLb, isMain]) => ({
    id: id(), name, kind, incrementLb, roundToLb, autoIncrease: kind === 'barbell' || kind === 'dumbbell', isMain, archived: false,
  }));
  const byName = (name: string) => exercises.find((e) => e.name === name)!.id;

  const routines: Routine[] = [{
    id: id(), name: 'Example · Full body', order: 0, archived: false,
    items: [
      { exerciseId: byName('Squat'), sets: 3, reps: 5 },
      { exerciseId: byName('Bench press'), sets: 3, reps: 5 },
      { exerciseId: byName('Row'), sets: 3, reps: 8 },
    ],
  }];
  const quickAdds: QuickAdd[] = [{
    id: id(), name: 'Warm-up', order: 0,
    source: { lines: ['5 min easy cardio', 'Dynamic stretching', '2 ramp-up sets'] },
  }];

  const settings = defaultSettings();
  for (const [name, tiers] of Object.entries(DEFAULT_TIER_MULTIPLES)) settings.trophyTiers[byName(name)] = [...tiers];
  return { exercises, routines, quickAdds, settings };
}

/** Dexie 'populate' handler: runs once when the database is first created. */
export async function seed(tx: Transaction): Promise<void> {
  const data = buildSeed();
  await tx.table('exercises').bulkAdd(data.exercises);
  await tx.table('routines').bulkAdd(data.routines);
  await tx.table('quickAdds').bulkAdd(data.quickAdds);
  await tx.table('settings').put(data.settings, SETTINGS_KEY);
}
