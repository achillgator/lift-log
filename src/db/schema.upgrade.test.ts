import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { LATEST_VERSION, SCHEMA_VERSIONS, TABLES } from './schema';
import { countAll, openAtVersion, uniqueDbName, upgradeTest } from './upgrade-harness';

// Made-up rows shaped like schema v1.
async function writeV1(db: Awaited<ReturnType<typeof openAtVersion>>) {
  await db.exercises.add({ id: 'ex-1', name: 'Test lift', kind: 'barbell', incrementLb: 5, roundToLb: 5, autoIncrease: true, isMain: true, archived: false });
  await db.routines.add({ id: 'rt-1', name: 'Test routine', order: 0, archived: false, items: [{ exerciseId: 'ex-1', sets: 3, reps: 5 }] });
  await db.sessions.add({ id: 'se-1', date: '2020-01-06', routineId: 'rt-1', status: 'done', startedAt: 1, painFlag: false, note: '' });
  await db.sets.add({ id: 'st-1', sessionId: 'se-1', exerciseId: 'ex-1', order: 0, setNo: 1, weightLb: 100, reps: 5, done: true, skipped: false });
  await db.bodyweight.add({ id: 'bw-1', date: '2020-01-06', weightLb: 150 });
  await db.habitLogs.add({ date: '2020-01-06', habitId: 'h-1', done: true });
}

describe('schema', () => {
  test('versions are strictly increasing and the latest version declares every table', () => {
    const versions = SCHEMA_VERSIONS.map((v) => v.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(LATEST_VERSION).toBe(versions[versions.length - 1]);
  });

  test('v1 creates all tables from SPEC', async () => {
    const db = await openAtVersion(uniqueDbName(), 1);
    expect(db.tables.map((t) => t.name).sort()).toEqual([...TABLES].sort());
    db.close();
  });

  test('no version ever drops a table that an earlier version declared', () => {
    const seen = new Set<string>();
    for (const v of SCHEMA_VERSIONS) {
      for (const [table, def] of Object.entries(v.stores)) {
        if (seen.has(table)) expect(def, `v${v.version} drops ${table}`).not.toBeNull();
        seen.add(table);
      }
    }
  });

  // Harness self-test: v1 -> latest keeps every row. When v2 lands, add a v1 -> v2 test next to this
  // one that also checks the new fields' defaults.
  test('upgrade from v1 to latest keeps all data', async () => {
    await upgradeTest({
      from: 1,
      write: writeV1,
      check: async (db) => {
        const counts = await countAll(db);
        expect(counts).toMatchObject({ exercises: 1, routines: 1, sessions: 1, sets: 1, bodyweight: 1, habitLogs: 1 });
        expect(await db.sets.get('st-1')).toMatchObject({ weightLb: 100, reps: 5, done: true });
        expect(await db.habitLogs.get(['2020-01-06', 'h-1'])).toMatchObject({ done: true });
      },
    });
  });
});
