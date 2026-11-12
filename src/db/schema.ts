// Dexie schema. Every change adds a NEW entry to SCHEMA_VERSIONS (never edit a shipped one), with an
// upgrade function when data must move, plus an upgrade test (see upgrade-harness.ts).
// Never drop or rename a table or a field that holds data.
import Dexie, { type EntityTable, type Table, type Transaction } from 'dexie';
import type {
  Bodyweight, CalendarEntry, Exercise, Habit, HabitLog, LoggedSet, Max, Photo, QuickAdd, Routine, Session, Settings,
} from './types';

export interface SchemaVersion {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => Promise<void> | void;
}

/** Only indexed fields are listed; all other fields are stored as-is. */
export const SCHEMA_VERSIONS: SchemaVersion[] = [
  {
    version: 1,
    stores: {
      exercises: 'id, name',
      routines: 'id, order, weekday',
      quickAdds: 'id, order',
      sessions: 'id, date, routineId, status, [date+status]',
      sets: 'id, sessionId, exerciseId',
      maxes: 'id, exerciseId, date',
      bodyweight: 'id, &date',
      habits: 'id, order',
      habitLogs: '[date+habitId], date, habitId',
      calendar: 'id, startDate, type',
      photos: 'id, date',
      // One row with the outbound key SETTINGS_KEY.
      settings: '',
    },
  },
];

export const LATEST_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1].version;
export const SETTINGS_KEY = 'app';
export const DB_NAME = 'lift-log';

export const TABLES = [
  'exercises', 'routines', 'quickAdds', 'sessions', 'sets', 'maxes', 'bodyweight',
  'habits', 'habitLogs', 'calendar', 'photos', 'settings',
] as const;

export class LiftLogDb extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  quickAdds!: EntityTable<QuickAdd, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sets!: EntityTable<LoggedSet, 'id'>;
  maxes!: EntityTable<Max, 'id'>;
  bodyweight!: EntityTable<Bodyweight, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitLogs!: Table<HabitLog, [string, string]>;
  calendar!: EntityTable<CalendarEntry, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  settings!: Table<Settings, string>;

  /**
   * @param upToVersion open the schema as it was at this version (for upgrade tests). Defaults to latest.
   * @param populate runs once, inside the transaction that creates the database.
   */
  constructor(name: string = DB_NAME, opts: { upToVersion?: number; populate?: (tx: Transaction) => Promise<void> | void } = {}) {
    super(name);
    const upTo = opts.upToVersion ?? LATEST_VERSION;
    for (const v of SCHEMA_VERSIONS) {
      if (v.version > upTo) break;
      const declared = this.version(v.version).stores(v.stores);
      if (v.upgrade) declared.upgrade(v.upgrade);
    }
    if (opts.populate) this.on('populate', opts.populate);
  }
}
