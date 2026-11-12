// Dexie implementation of LiftLogApi. Screens use the `api` instance exported from src/db.
import type { LiftLogApi } from './api';
import type {
  Exercise, ExerciseKind, ImportPreview, LoggedSet, Routine, RoutineItem, Session, Settings, StallStatus, StorageStatus,
} from './types';
import { LATEST_VERSION, SETTINGS_KEY, type LiftLogDb } from './schema';
import { defaultSettings } from './seed';
import { localNoon, weekday } from '../lib/dates';
import {
  DEFAULT_INCREMENT_LB, DEFAULT_ROUND_LB, hitAllReps, stallStatus, workingWeight, type LastPerformance,
} from '../lib/progression';
import { planItem } from '../lib/prefill';
import { BACKUP_TABLES, backupCounts, buildBackup, parseBackup, setsToCsv, type BackupData } from '../lib/backup';
import { buildProgram, parseProgram, programCounts } from '../lib/program';
import { LEGACY_EXERCISES, LEGACY_ROUTINE_NAME, parsePasteLog } from '../lib/paste-log';

export interface ApiEnv {
  now?: () => number;
  /** The StorageManager to use; defaults to navigator.storage. */
  storage?: () => Partial<StorageManager> | undefined;
}

const uuid = () => crypto.randomUUID();
const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
const sessionNewestFirst = (a: Session, b: Session) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt;
const json = (value: unknown) => new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });

/** Removes keys whose value is undefined, so rows don't carry empty fields. */
function compact<T extends object>(row: T): T {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)) as T;
}

export type DexieLiftLogApi = LiftLogApi & { readonly db: LiftLogDb };

export function createApi(db: LiftLogDb, env: ApiEnv = {}): DexieLiftLogApi {
  const now = env.now ?? (() => Date.now());
  const storage = env.storage ?? (() => (typeof navigator !== 'undefined' ? navigator.storage : undefined));
  const rw = <T>(fn: () => Promise<T>) => db.transaction('rw', db.tables, fn);

  async function getSettings(): Promise<Settings> {
    const stored = await db.settings.get(SETTINGS_KEY);
    const base = defaultSettings();
    return stored ? { ...base, ...stored, rules: { ...base.rules, ...stored.rules } } : base;
  }

  /** Done sessions holding this exercise, newest first, each with its sets for the exercise. */
  async function performances(exerciseId: string): Promise<{ session: Session; sets: LoggedSet[] }[]> {
    const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
    const bySession = new Map<string, LoggedSet[]>();
    for (const s of sets) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
    const sessions = (await db.sessions.bulkGet([...bySession.keys()]))
      .filter((s): s is Session => !!s && s.status === 'done')
      .sort(sessionNewestFirst);
    return sessions.map((session) => ({ session, sets: bySession.get(session.id)!.sort((a, b) => a.setNo - b.setNo) }));
  }

  /** Last performance in the same routine, falling back to the latest anywhere (held, never increased). */
  async function lastPerformance(exerciseId: string, routineId?: string): Promise<{ last?: LastPerformance; sameRoutine: boolean }> {
    const all = await performances(exerciseId);
    const same = routineId ? all.find((p) => p.session.routineId === routineId) : undefined;
    const pick = same ?? all[0];
    if (!pick) return { sameRoutine: true };
    return { last: { sets: pick.sets, effort: pick.session.effort }, sameRoutine: !!same };
  }

  async function planSets(sessionId: string, items: RoutineItem[], date: string, routine: Routine | undefined, firstOrder: number): Promise<LoggedSet[]> {
    const settings = await getSettings();
    const out: LoggedSet[] = [];
    let order = firstOrder;
    for (const item of items) {
      const exercise = await db.exercises.get(item.exerciseId);
      if (!exercise) continue;
      const { last, sameRoutine } = await lastPerformance(exercise.id, routine?.id);
      let sourceWeightLb: number | undefined;
      if (exercise.derivedFrom) {
        const src = (await performances(exercise.derivedFrom.exerciseId)).find((p) => p.session.routineId === exercise.derivedFrom!.routineId);
        sourceWeightLb = src ? workingWeight(src.sets) : undefined;
      }
      const planned = planItem({
        exercise, item, routine, date, last, sameRoutine, sourceWeightLb,
        autoIncreaseGlobal: settings.autoIncreaseGlobal, maxEffort: settings.rules.maxEffort,
      });
      for (const p of planned) out.push(compact({ ...p, id: uuid(), sessionId, order }));
      order++;
    }
    return out;
  }

  async function nextOrder(sessionId: string): Promise<number> {
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    return sets.reduce((max, s) => Math.max(max, s.order + 1), 0);
  }

  async function readText(file: Blob): Promise<string> {
    return file.text();
  }

  async function findOrCreateExercise(name: string, kind: ExerciseKind): Promise<Exercise> {
    const all = await db.exercises.toArray();
    const lower = name.toLowerCase();
    const match = all.filter((e) => e.name.toLowerCase() === lower).sort((a, b) => Number(a.archived) - Number(b.archived))[0];
    if (match) return match;
    const exercise: Exercise = {
      id: uuid(), name, kind, incrementLb: DEFAULT_INCREMENT_LB[kind], roundToLb: DEFAULT_ROUND_LB[kind],
      autoIncrease: false, isMain: false, archived: false,
    };
    await db.exercises.add(exercise);
    return exercise;
  }

  const api: DexieLiftLogApi = {
    db,

    async listExercises(includeArchived = false) {
      const all = await db.exercises.toArray();
      return all.filter((e) => includeArchived || !e.archived).sort((a, b) => a.name.localeCompare(b.name));
    },
    async saveExercise(exercise) {
      await db.exercises.put(compact(exercise));
    },
    async listRoutines(includeArchived = false) {
      const all = await db.routines.toArray();
      return all.filter((r) => includeArchived || !r.archived).sort(byOrder);
    },
    async saveRoutine(routine) {
      await db.routines.put(compact(routine));
    },
    async routineForDate(date) {
      const day = weekday(date);
      const all = await db.routines.where('weekday').equals(day).toArray();
      return all.filter((r) => !r.archived).sort(byOrder)[0];
    },
    async listQuickAdds() {
      return (await db.quickAdds.toArray()).sort(byOrder);
    },
    async saveQuickAdd(quickAdd) {
      await db.quickAdds.put(quickAdd);
    },
    async deleteQuickAdd(id) {
      await db.quickAdds.delete(id);
    },

    startSession(date, routineId) {
      return rw(async () => {
        const drafts = await db.sessions.where('[date+status]').equals([date, 'draft']).toArray();
        const existing = drafts.filter((s) => s.routineId === routineId).sort((a, b) => a.startedAt - b.startedAt)[0];
        if (existing) return existing;
        const routine = routineId ? await db.routines.get(routineId) : undefined;
        if (routineId && !routine) throw new Error(`Routine ${routineId} not found`);
        const session: Session = compact({ id: uuid(), date, routineId, status: 'draft', startedAt: now(), painFlag: false, note: '' });
        const sets = routine ? await planSets(session.id, routine.items, date, routine, 0) : [];
        await db.sessions.add(session);
        await db.sets.bulkAdd(sets);
        return session;
      });
    },
    getSession(id) {
      return db.sessions.get(id);
    },
    async listSessions(status) {
      const rows = status ? await db.sessions.where('status').equals(status).toArray() : await db.sessions.toArray();
      return rows.sort(sessionNewestFirst);
    },
    async finishSession(id, input) {
      await rw(async () => {
        const session = await db.sessions.get(id);
        if (!session) throw new Error(`Session ${id} not found`);
        await db.sessions.put(compact({
          ...session, status: 'done', endedAt: now(), durationMin: input.durationMin, calories: input.calories,
          effort: input.effort, painFlag: input.painFlag ?? false, note: input.note ?? '',
        }));
      });
      // First meaningful action: ask for persistent storage. Never blocks, a false result is normal on iOS.
      void api.requestPersistence().catch(() => false);
    },
    async updateSession(session) {
      await db.sessions.put(compact(session));
    },
    deleteSession(id) {
      return rw(async () => {
        const session = await db.sessions.get(id);
        const sets = await db.sets.where('sessionId').equals(id).toArray();
        await db.sets.bulkDelete(sets.map((s) => s.id));
        await db.sessions.delete(id);
        return async () => {
          if (!session) return;
          await rw(async () => {
            await db.sessions.put(session);
            await db.sets.bulkPut(sets);
          });
        };
      });
    },
    applyQuickAdd(sessionId, quickAddId) {
      return rw(async () => {
        const session = await db.sessions.get(sessionId);
        const quickAdd = await db.quickAdds.get(quickAddId);
        if (!session) throw new Error(`Session ${sessionId} not found`);
        if (!quickAdd) throw new Error(`Quick-add ${quickAddId} not found`);
        const first = await nextOrder(sessionId);
        const src = quickAdd.source;
        let sets: LoggedSet[];
        if ('routineId' in src) {
          const routine = await db.routines.get(src.routineId);
          if (!routine) throw new Error(`Quick-add "${quickAdd.name}" points at a routine that no longer exists`);
          sets = await planSets(sessionId, routine.items, session.date, routine, first);
        } else if ('items' in src) {
          sets = await planSets(sessionId, src.items, session.date, undefined, first);
        } else {
          sets = [];
          for (const [i, line] of src.lines.entries()) {
            const exercise = await findOrCreateExercise(line, 'checklist');
            sets.push({ id: uuid(), sessionId, exerciseId: exercise.id, order: first + i, setNo: 1, done: false, skipped: false });
          }
        }
        await db.sets.bulkAdd(sets);
      });
    },

    async listSets(sessionId) {
      const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
      return sets.sort((a, b) => a.order - b.order || a.setNo - b.setNo);
    },
    async setHistory(exerciseId) {
      const perf = await performances(exerciseId);
      return perf.reverse().flatMap(({ session, sets }) =>
        sets.filter((s) => s.done && !s.skipped).sort((a, b) => a.order - b.order || a.setNo - b.setNo).map((s) => ({ ...s, date: session.date })));
    },
    async saveSet(set) {
      await db.sets.put(compact(set));
    },
    async deleteSet(id) {
      const set = await db.sets.get(id);
      await db.sets.delete(id);
      return async () => {
        if (set) await db.sets.put(set);
      };
    },

    async listMaxes(exerciseId) {
      const rows = exerciseId ? await db.maxes.where('exerciseId').equals(exerciseId).toArray() : await db.maxes.toArray();
      return rows.sort((a, b) => a.date.localeCompare(b.date));
    },
    async saveMax(max) {
      await db.maxes.put(max);
    },
    async deleteMax(id) {
      await db.maxes.delete(id);
    },
    listBodyweight() {
      return db.bodyweight.orderBy('date').toArray();
    },
    logBodyweight(date, weightLb) {
      return rw(async () => {
        const existing = await db.bodyweight.where('date').equals(date).first();
        await db.bodyweight.put({ id: existing?.id ?? uuid(), date, weightLb });
      });
    },
    async deleteBodyweight(date) {
      await db.bodyweight.where('date').equals(date).delete();
    },

    async listHabits(includeArchived = false) {
      return (await db.habits.toArray()).filter((h) => includeArchived || !h.archived).sort(byOrder);
    },
    async saveHabit(habit) {
      await db.habits.put(habit);
    },
    async listHabitLogs(fromDate, toDate) {
      if (!fromDate && !toDate) return db.habitLogs.toArray();
      return db.habitLogs.where('date').between(fromDate ?? '0000-00-00', toDate ?? '9999-99-99', true, true).toArray();
    },
    async setHabitDone(date, habitId, done) {
      await db.habitLogs.put({ date, habitId, done });
    },
    async listCalendar() {
      return db.calendar.orderBy('startDate').toArray();
    },
    async saveCalendarEntry(entry) {
      await db.calendar.put(compact(entry));
    },
    async deleteCalendarEntry(id) {
      await db.calendar.delete(id);
    },

    getSettings,
    updateSettings(patch) {
      return rw(async () => {
        const current = await getSettings();
        await db.settings.put({ ...current, ...patch }, SETTINGS_KEY);
      });
    },

    async stallStatus(exerciseId, routineId) {
      const exercise = await db.exercises.get(exerciseId);
      const settings = await getSettings();
      const perf = (await performances(exerciseId)).filter((p) => !routineId || p.session.routineId === routineId);
      const outcomes = perf.map(({ session, sets }) => ({ date: session.date, hitAll: hitAllReps(sets), weightLb: workingWeight(sets) }));
      const result = stallStatus(outcomes, settings.rules.stallWeeks, settings.rules.deloadPct, exercise?.roundToLb ?? 5);
      return compact({ exerciseId, ...result }) as StallStatus;
    },

    async exportJson() {
      const data = await db.transaction('r', db.tables, async () => {
        const out: Partial<BackupData> = {};
        for (const t of BACKUP_TABLES) (out as Record<string, unknown>)[t] = await db.table(t).toArray();
        out.settings = await getSettings();
        return out as BackupData;
      });
      const at = now();
      const blob = json(buildBackup(data, LATEST_VERSION, at));
      await api.updateSettings({ lastExportAt: at });
      return blob;
    },
    async exportCsv() {
      const [sessions, sets, exercises, routines] = await Promise.all([
        db.sessions.toArray(), db.sets.toArray(), db.exercises.toArray(), db.routines.toArray(),
      ]);
      const sessionMap = new Map(sessions.map((s) => [s.id, s]));
      const exName = new Map(exercises.map((e) => [e.id, e.name]));
      const rtName = new Map(routines.map((r) => [r.id, r.name]));
      const rows = sets.flatMap((set) => {
        const session = sessionMap.get(set.sessionId);
        if (!session) return [];
        return [{ session, set, exerciseName: exName.get(set.exerciseId) ?? '', routineName: session.routineId ? rtName.get(session.routineId) ?? '' : '' }];
      });
      return new Blob([setsToCsv(rows)], { type: 'text/csv' });
    },
    async previewImport(file) {
      const { file: parsed, errors } = parseBackup(await readText(file), LATEST_VERSION);
      return { valid: !!parsed, errors, counts: parsed ? backupCounts(parsed.data) : {} };
    },
    async importJson(file, mode) {
      const { file: parsed, errors } = parseBackup(await readText(file), LATEST_VERSION);
      if (!parsed) throw new Error(`Import failed, nothing was changed: ${errors.join('; ')}`);
      const data = parsed.data;
      await rw(async () => {
        if (mode === 'replace') {
          // Photos are never in a backup, so replace keeps them.
          for (const t of BACKUP_TABLES) await db.table(t).clear();
          await db.settings.put({ ...defaultSettings(), ...(data.settings ?? {}) }, SETTINGS_KEY);
          for (const t of BACKUP_TABLES) await db.table(t).bulkAdd(data[t]);
          return;
        }
        // Merge: incoming rows win on the same id; the device keeps its own settings.
        for (const t of BACKUP_TABLES) {
          if (t === 'bodyweight') continue;
          await db.table(t).bulkPut(data[t]);
        }
        for (const b of data.bodyweight) {
          await db.bodyweight.where('date').equals(b.date).and((x) => x.id !== b.id).delete();
          await db.bodyweight.put(b);
        }
      });
    },

    async exportProgram() {
      const data = await db.transaction('r', db.tables, async () => ({
        exercises: await db.exercises.toArray(), routines: await db.routines.toArray(),
        quickAdds: await db.quickAdds.toArray(), habits: await db.habits.toArray(),
        calendar: await db.calendar.toArray(), settings: await getSettings(),
      }));
      return json(buildProgram(data, now()));
    },
    async previewProgram(file) {
      const { file: parsed, errors } = parseProgram(await readText(file));
      return { valid: !!parsed, errors, counts: parsed ? programCounts(parsed) : {} };
    },
    async importProgram(file, mode) {
      const { file: p, errors } = parseProgram(await readText(file));
      if (!p) throw new Error(`Import failed, nothing was changed: ${errors.join('; ')}`);
      await rw(async () => {
        const settings = await getSettings();
        if (mode === 'replace') {
          // Archive, never delete: logged sessions still point at these rows.
          await db.exercises.toCollection().modify({ archived: true });
          await db.routines.toCollection().modify({ archived: true });
          await db.habits.toCollection().modify({ archived: true });
          await db.quickAdds.clear();
          await db.calendar.clear();
          await db.settings.put({
            ...settings,
            autoIncreaseGlobal: p.settings?.autoIncreaseGlobal ?? settings.autoIncreaseGlobal,
            rules: { ...settings.rules, ...p.settings?.rules },
            trophyTiers: { ...settings.trophyTiers, ...p.settings?.trophyTiers },
          }, SETTINGS_KEY);
        } else {
          // Merge keeps the device's settings and adds tiers only for lifts that have none.
          await db.settings.put({ ...settings, trophyTiers: { ...p.settings?.trophyTiers, ...settings.trophyTiers } }, SETTINGS_KEY);
        }
        await db.exercises.bulkPut(p.exercises);
        await db.routines.bulkPut(p.routines);
        await db.quickAdds.bulkPut(p.quickAdds);
        await db.habits.bulkPut(p.habits);
        await db.calendar.bulkPut(p.calendar);
      });
    },

    async previewPasteLog(text) {
      return pastePreview(text);
    },
    async savePasteLog(text) {
      const { workouts, errors } = parsePasteLog(text);
      if (errors.length) throw new Error(`Nothing was saved. Fix these lines first: ${errors.join('; ')}`);
      await rw(async () => {
        let routine = (await db.routines.toArray()).find((r) => r.name === LEGACY_ROUTINE_NAME);
        if (!routine) {
          const order = (await db.routines.toArray()).reduce((m, r) => Math.max(m, r.order + 1), 0);
          routine = { id: uuid(), name: LEGACY_ROUTINE_NAME, order, archived: true, items: [] };
          await db.routines.add(routine);
        }
        const existingDates = new Set((await db.sessions.where('routineId').equals(routine.id).toArray()).map((s) => s.date));
        const exerciseIds = new Map<string, string>();
        for (const w of workouts) {
          if (existingDates.has(w.date)) continue;
          existingDates.add(w.date);
          const session: Session = { id: uuid(), date: w.date, routineId: routine.id, status: 'done', startedAt: localNoon(w.date), painFlag: false, note: '' };
          const sets: LoggedSet[] = [];
          for (const [order, entry] of w.entries.entries()) {
            const def = LEGACY_EXERCISES[entry.key];
            if (!exerciseIds.has(entry.key)) exerciseIds.set(entry.key, (await findOrCreateExercise(def.name, def.kind)).id);
            entry.sets.forEach((s, i) => sets.push(compact({
              id: uuid(), sessionId: session.id, exerciseId: exerciseIds.get(entry.key)!, order, setNo: i + 1,
              targetWeightLb: s.weightLb, weightLb: s.weightLb, targetReps: s.reps, reps: s.reps, holdSec: s.holdSec,
              done: true, skipped: false,
            })));
          }
          await db.sessions.add(session);
          await db.sets.bulkAdd(sets);
        }
      });
    },

    async requestPersistence() {
      const s = storage();
      if (!s?.persist) return false;
      try {
        if (await s.persisted?.()) return true;
        return await s.persist();
      } catch {
        return false;
      }
    },
    async storageStatus(): Promise<StorageStatus> {
      const s = storage();
      const persisted = (await s?.persisted?.().catch(() => false)) ?? false;
      const estimate = await s?.estimate?.().catch(() => undefined);
      let photoBytes: number | undefined;
      if ((await db.photos.count()) > 0) {
        photoBytes = 0;
        await db.photos.each((p) => { photoBytes! += (p.image?.size ?? 0) + (p.thumb?.size ?? 0); });
      }
      return compact({ persisted, usageBytes: estimate?.usage, quotaBytes: estimate?.quota, photoBytes });
    },
  };

  async function pastePreview(text: string): Promise<ImportPreview> {
    const { workouts, errors } = parsePasteLog(text);
    if (workouts.length === 0 && errors.length === 0) errors.push('Nothing to import: paste one workout per line');
    const routine = (await db.routines.toArray()).find((r) => r.name === LEGACY_ROUTINE_NAME);
    const existing = new Set(routine ? (await db.sessions.where('routineId').equals(routine.id).toArray()).map((s) => s.date) : []);
    let skipped = 0;
    let sessions = 0;
    let sets = 0;
    for (const w of workouts) {
      if (existing.has(w.date)) { skipped++; continue; }
      existing.add(w.date);
      sessions++;
      sets += w.entries.reduce((n, e) => n + e.sets.length, 0);
    }
    return { valid: errors.length === 0, errors, counts: { sessions, sets, skipped } };
  }

  return api;
}

