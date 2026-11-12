// Full JSON backup and CSV export: building, validating and summarizing. Photos are never included.
import type {
  Bodyweight, CalendarEntry, Exercise, Habit, HabitLog, LoggedSet, Max, QuickAdd, Routine, Session, Settings,
} from '../db/types';
import { today } from './dates';
import { checkRows, checkUniqueIds, isObject, parseJson, push, type FieldSpec } from './validate';

export const BACKUP_KIND = 'lift-log-backup';

export interface BackupData {
  exercises: Exercise[]; routines: Routine[]; quickAdds: QuickAdd[]; sessions: Session[]; sets: LoggedSet[];
  maxes: Max[]; bodyweight: Bodyweight[]; habits: Habit[]; habitLogs: HabitLog[]; calendar: CalendarEntry[];
  settings?: Settings;
}
export interface BackupFile { kind: typeof BACKUP_KIND; schemaVersion: number; exportedAt: number; data: BackupData; }

export const BACKUP_TABLES = [
  'exercises', 'routines', 'quickAdds', 'sessions', 'sets', 'maxes', 'bodyweight', 'habits', 'habitLogs', 'calendar',
] as const;

export const ROW_SPECS: Record<(typeof BACKUP_TABLES)[number], FieldSpec> = {
  exercises: { id: 'string', name: 'string', kind: 'string', incrementLb: 'number', roundToLb: 'number', autoIncrease: 'boolean', isMain: 'boolean', archived: 'boolean', repMin: 'number?', repMax: 'number?', derivedFrom: 'object?' },
  routines: { id: 'string', name: 'string', order: 'number', archived: 'boolean', items: 'array', weekday: 'number?', distanceProgression: 'object?' },
  quickAdds: { id: 'string', name: 'string', order: 'number', source: 'object' },
  sessions: { id: 'string', date: 'date', status: 'string', startedAt: 'number', painFlag: 'boolean', note: 'string', routineId: 'string?', durationMin: 'number?', effort: 'number?' },
  sets: { id: 'string', sessionId: 'string', exerciseId: 'string', order: 'number', setNo: 'number', done: 'boolean', skipped: 'boolean', weightLb: 'number?', reps: 'number?' },
  maxes: { id: 'string', exerciseId: 'string', date: 'date', weightLb: 'number', tested: 'boolean' },
  bodyweight: { id: 'string', date: 'date', weightLb: 'number' },
  habits: { id: 'string', name: 'string', order: 'number', archived: 'boolean' },
  habitLogs: { date: 'date', habitId: 'string', done: 'boolean' },
  calendar: { id: 'string', type: 'string', name: 'string', startDate: 'date', endDate: 'date?' },
};

const EXERCISE_KINDS = ['barbell', 'dumbbell', 'bodyweight', 'hold', 'run', 'checklist'];

export function buildBackup(data: BackupData, schemaVersion: number, exportedAt: number): BackupFile {
  return { kind: BACKUP_KIND, schemaVersion, exportedAt, data };
}

export function backupCounts(data: Partial<BackupData>): Record<string, number> {
  return Object.fromEntries(BACKUP_TABLES.map((t) => [t, data[t]?.length ?? 0]));
}

/** Checks exercise kinds, session statuses and routine items. Shared with the program file. */
export function checkDomain(data: { exercises?: Exercise[]; routines?: Routine[]; sessions?: Session[] }, errors: string[]): void {
  data.exercises?.forEach((e, i) => {
    if (!EXERCISE_KINDS.includes(e.kind)) push(errors, `exercises #${i + 1}: unknown kind "${String(e.kind)}"`);
  });
  data.routines?.forEach((r, i) => {
    r.items.forEach((item, j) => {
      if (!isObject(item) || typeof item.exerciseId !== 'string' || typeof item.sets !== 'number' || typeof item.reps !== 'number') {
        push(errors, `routines #${i + 1} item ${j + 1}: needs exerciseId, sets and reps`);
      }
    });
  });
  data.sessions?.forEach((s, i) => {
    if (s.status !== 'draft' && s.status !== 'done') push(errors, `sessions #${i + 1}: status should be draft or done`);
  });
}

/**
 * Parses and validates a backup file. Files from a newer app version are rejected; older ones would be
 * migrated here (none exist yet: schema version 1 is the first).
 */
export function parseBackup(text: string, currentSchemaVersion: number): { file?: BackupFile; errors: string[] } {
  const errors: string[] = [];
  const { value, error } = parseJson(text);
  if (error) return { errors: [error] };
  if (!isObject(value) || value.kind !== BACKUP_KIND) return { errors: ['Not a Lift Log backup file'] };
  if (typeof value.schemaVersion !== 'number' || value.schemaVersion < 1) return { errors: ['Missing schemaVersion'] };
  if (value.schemaVersion > currentSchemaVersion) {
    return { errors: [`This backup is from a newer version of Lift Log (schema ${value.schemaVersion}). Update the app, then import again.`] };
  }
  if (!isObject(value.data)) return { errors: ['Missing data'] };
  const data = value.data;

  for (const table of BACKUP_TABLES) {
    if (data[table] === undefined) data[table] = [];
    checkRows(table, data[table], ROW_SPECS[table], errors);
  }
  if (data.settings !== undefined && !isObject(data.settings)) push(errors, 'settings: expected an object');
  if (errors.length) return { errors };

  const typed = data as unknown as BackupData;
  checkDomain(typed, errors);
  for (const t of BACKUP_TABLES) if (t !== 'habitLogs') checkUniqueIds(t, typed[t] as { id: string }[], errors);

  const sessionIds = new Set(typed.sessions.map((s) => s.id));
  typed.sets.forEach((s, i) => {
    if (!sessionIds.has(s.sessionId)) push(errors, `sets #${i + 1}: session ${s.sessionId} is not in the file`);
  });
  const dates = new Set<string>();
  for (const b of typed.bodyweight) {
    if (dates.has(b.date)) push(errors, `bodyweight: two entries for ${b.date}`);
    dates.add(b.date);
  }
  if (errors.length) return { errors };
  return { file: value as unknown as BackupFile, errors };
}

const CSV_COLUMNS = [
  'date', 'routine', 'exercise', 'sessionStatus', 'setNo', 'targetWeightLb', 'targetReps', 'weightLb', 'reps',
  'strictReps', 'band', 'holdSec', 'distanceM', 'timeSec', 'done', 'skipped',
] as const;

export interface CsvRow { session: Session; set: LoggedSet; exerciseName: string; routineName: string; }

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV of sets, one row per set, sorted by date, session, exercise order and set number. */
export function setsToCsv(rows: CsvRow[]): string {
  const sorted = [...rows].sort((a, b) =>
    a.session.date.localeCompare(b.session.date) || a.session.startedAt - b.session.startedAt ||
    a.set.order - b.set.order || a.set.setNo - b.set.setNo);
  const lines = sorted.map(({ session, set, exerciseName, routineName }) => {
    const values: Record<(typeof CSV_COLUMNS)[number], unknown> = {
      date: session.date, routine: routineName, exercise: exerciseName, sessionStatus: session.status, setNo: set.setNo,
      targetWeightLb: set.targetWeightLb, targetReps: set.targetReps, weightLb: set.weightLb, reps: set.reps,
      strictReps: set.strictReps, band: set.band, holdSec: set.holdSec, distanceM: set.distanceM, timeSec: set.timeSec,
      done: set.done, skipped: set.skipped,
    };
    return CSV_COLUMNS.map((c) => csvCell(values[c])).join(',');
  });
  return [CSV_COLUMNS.join(','), ...lines].join('\r\n') + '\r\n';
}

/** lift-log-backup-YYYY-MM-DD.json / .csv, matched by .gitignore so exports never get committed. */
export function backupFileName(ext: 'json' | 'csv', date: string = today()): string {
  return `lift-log-backup-${date}.${ext}`;
}

/** Program file name (no personal data inside, but kept out of git with the same pattern for safety). */
export function programFileName(date: string = today()): string {
  return `lift-log-backup-program-${date}.json`;
}
