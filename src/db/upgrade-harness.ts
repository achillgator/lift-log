// Test harness for schema upgrades (CLAUDE.md non-negotiable 1). Test-only: never imported by the app.
//
// Pattern for every new schema version N:
//   1. Add { version: N, stores, upgrade } to SCHEMA_VERSIONS in schema.ts.
//   2. In schema.upgrade.test.ts, call upgradeTest({ from: N - 1, write, check }):
//      `write` fills a database opened at version N - 1 with rows shaped like that version,
//      `check` runs on the same database opened at the latest version and asserts nothing was lost
//      and new fields got their defaults.
import { LiftLogDb, LATEST_VERSION } from './schema';

let counter = 0;
export function uniqueDbName(prefix = 'lift-log-test'): string {
  counter++;
  return `${prefix}-${Date.now()}-${counter}`;
}

/** Opens a database exactly as it was at `version` (no seed). */
export async function openAtVersion(name: string, version: number): Promise<LiftLogDb> {
  const db = new LiftLogDb(name, { upToVersion: version });
  await db.open();
  return db;
}

export interface UpgradeTest {
  from: number;
  to?: number;
  write: (db: LiftLogDb) => Promise<void>;
  check: (db: LiftLogDb) => Promise<void>;
}

/** Builds a database at `from`, writes data, closes it, reopens at `to` (latest by default), then checks. */
export async function upgradeTest({ from, to = LATEST_VERSION, write, check }: UpgradeTest): Promise<void> {
  const name = uniqueDbName('upgrade');
  const old = await openAtVersion(name, from);
  await write(old);
  old.close();
  const upgraded = await openAtVersion(name, to);
  try {
    if (upgraded.verno !== to) throw new Error(`Expected version ${to}, got ${upgraded.verno}`);
    await check(upgraded);
  } finally {
    upgraded.close();
    await upgraded.delete();
  }
}

/** Every table's row count, for "nothing was lost" checks. */
export async function countAll(db: LiftLogDb): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of db.tables) out[t.name] = await t.count();
  return out;
}
