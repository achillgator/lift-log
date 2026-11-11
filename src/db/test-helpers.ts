// Test-only helpers: a fresh seeded database per test, with a controllable clock and storage.
import 'fake-indexeddb/auto';
import { LiftLogDb } from './schema';
import { createApi, type ApiEnv } from './dexie-api';
import { seed } from './seed';
import { uniqueDbName } from './upgrade-harness';
import type { Exercise, LoggedSet, Session } from './types';

export function makeApi(env: ApiEnv = {}, opts: { seeded?: boolean } = {}) {
  const db = new LiftLogDb(uniqueDbName('api'), { populate: opts.seeded === false ? undefined : seed });
  let clock = 1_700_000_000_000;
  const api = createApi(db, { now: () => clock++, storage: () => undefined, ...env });
  return { api, db };
}

export async function exerciseByName(api: ReturnType<typeof makeApi>['api'], name: string): Promise<Exercise> {
  const ex = (await api.listExercises(true)).find((e) => e.name === name);
  if (!ex) throw new Error(`No exercise ${name}`);
  return ex;
}

/** Starts a session, marks every set done as planned (optionally overriding reps), and finishes it. */
export async function logRoutine(
  api: ReturnType<typeof makeApi>['api'], date: string, routineId: string,
  opts: { reps?: (set: LoggedSet) => number | undefined; effort?: number } = {},
): Promise<{ session: Session; sets: LoggedSet[] }> {
  const session = await api.startSession(date, routineId);
  const sets = await api.listSets(session.id);
  for (const s of sets) await api.saveSet({ ...s, done: true, reps: opts.reps ? opts.reps(s) : s.reps });
  await api.finishSession(session.id, { durationMin: 45, effort: opts.effort });
  return { session, sets: await api.listSets(session.id) };
}
