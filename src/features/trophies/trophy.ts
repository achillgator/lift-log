// Pure trophy model: which tiers apply to a lift, and what its card shows. Tested in trophy.test.ts.
import type { Exercise, TrophyTiers } from '../../db/types';
import {
  bestE1rm, currentBodyweight, trophyRank, validTiers,
  type CurrentBodyweight, type DatedSet, type Tiers, type TrophyRank, type WeighIn,
} from '../../lib/stats';

export type MainLift = 'squat' | 'bench' | 'deadlift' | 'ohp';

/** SPEC defaults (x bodyweight for Bronze..Diamond). Rough rules of thumb, not population data. */
export const DEFAULT_TIERS: Record<MainLift, Tiers> = {
  squat: [1.0, 1.25, 1.5, 1.75, 2.0],
  bench: [0.75, 1.0, 1.25, 1.5, 1.75],
  deadlift: [1.25, 1.5, 1.75, 2.0, 2.5],
  ohp: [0.5, 0.6, 0.75, 0.9, 1.05],
};

const ORDER: MainLift[] = ['squat', 'bench', 'deadlift', 'ohp'];
const NAMES: Record<string, MainLift> = {
  squat: 'squat', 'back squat': 'squat',
  bench: 'bench', 'bench press': 'bench',
  deadlift: 'deadlift',
  ohp: 'ohp', 'overhead press': 'ohp',
};

/** Which SPEC main lift an exercise is, by exact (case-insensitive) name; "pause squat" is not "squat". */
export function mainLiftOf(name: string): MainLift | undefined {
  return NAMES[name.trim().toLowerCase()];
}

/**
 * Tiers for a lift. The contract does not say how settings.trophyTiers is keyed, so this accepts the
 * exercise id, the exercise name, or the lift slug (squat, bench, deadlift, ohp), in that order, and
 * falls back to the SPEC defaults for the four main lifts. `key` is where an edit should be saved.
 */
export function tiersFor(ex: Exercise, stored: TrophyTiers | undefined): { key: string; tiers: Tiers; isDefault: boolean } | undefined {
  const slug = mainLiftOf(ex.name);
  const keys = [ex.id, ex.name, ex.name.toLowerCase(), slug].filter((k): k is string => !!k);
  for (const key of keys) {
    const t = stored?.[key];
    if (t && validTiers([...t])) return { key, tiers: t, isDefault: false };
  }
  if (slug) return { key: ex.id, tiers: DEFAULT_TIERS[slug], isDefault: true };
  return undefined;
}

/** Main lifts in SPEC order (squat, bench, deadlift, OHP), then any other main lifts by name. */
export function sortMainLifts<T extends { name: string }>(lifts: T[]): T[] {
  const rank = (n: string) => {
    const i = ORDER.indexOf(mainLiftOf(n) as MainLift);
    return i < 0 ? ORDER.length : i;
  };
  return [...lifts].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

export interface TrophyView {
  exerciseId: string;
  name: string;
  /** Best e1RM ever (sets of 10 reps or fewer); undefined before any qualifying set. */
  e1rm?: number;
  bodyweight?: CurrentBodyweight;
  tiers?: Tiers;
  /** Undefined when there is no e1RM, no bodyweight or no tiers. */
  rank?: TrophyRank;
}

export function buildTrophy(
  ex: Exercise, history: DatedSet[], weighIns: WeighIn[], stored: TrophyTiers | undefined, today: string,
): TrophyView {
  const e1rm = bestE1rm(history);
  const bodyweight = currentBodyweight(weighIns, today);
  const tiers = tiersFor(ex, stored)?.tiers;
  const rank = e1rm !== undefined && bodyweight && tiers ? trophyRank(e1rm, bodyweight.lb, tiers) : undefined;
  return { exerciseId: ex.id, name: ex.name, e1rm, bodyweight, tiers, rank };
}

/** True when `tier` is higher than the last tier this device showed for the lift (first sighting is not a tier-up). */
export function isTierUp(seen: Record<string, number>, exerciseId: string, tier: number): boolean {
  return exerciseId in seen && tier > seen[exerciseId];
}
