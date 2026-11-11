// In-memory LiftLogApi for tests (and local screenshots) while the Dexie api is built elsewhere.
// All sample data is made up.
import type { LiftLogApi } from '../../db/api';
import type { Exercise, LoggedSet, Max, QuickAdd, Routine, Session, Settings } from '../../db/types';

const ex = (id: string, name: string, kind: Exercise['kind'] = 'barbell', isMain = false): Exercise => ({
  id, name, kind, incrementLb: 5, roundToLb: kind === 'dumbbell' ? 2.5 : 5, autoIncrease: true, isMain, archived: false,
});

export function createFakeApi(today = '2026-11-05'): LiftLogApi & { sets: Map<string, LoggedSet>; sessions: Map<string, Session> } {
  let n = 0;
  const id = (p: string) => `${p}${++n}`;
  const exercises = new Map<string, Exercise>([
    ['squat', ex('squat', 'Squat', 'barbell', true)],
    ['bench', ex('bench', 'Bench press', 'barbell', true)],
    ['row', ex('row', 'Row')],
    ['curl', ex('curl', 'Incline DB curl', 'dumbbell')],
    ['hang', ex('hang', 'Dead hang', 'hold')],
    ['run', ex('run', 'Run', 'run')],
  ]);
  const routines = new Map<string, Routine>([
    ['full', { id: 'full', name: 'Example · Full body', order: 0, archived: false, weekday: undefined, items: [
      { exerciseId: 'squat', sets: 3, reps: 5 }, { exerciseId: 'bench', sets: 3, reps: 5 }, { exerciseId: 'row', sets: 3, reps: 8 },
    ] }],
  ]);
  const quickAdds = new Map<string, QuickAdd>([
    ['warm', { id: 'warm', name: 'Warm-up', order: 0, source: { lines: ['5 min easy cardio', 'Dynamic stretching', '2 ramp-up sets'] } }],
    ['arms', { id: 'arms', name: 'Arms', order: 1, source: { items: [{ exerciseId: 'curl', sets: 2, reps: 10 }] } }],
  ]);
  const sessions = new Map<string, Session>();
  const sets = new Map<string, LoggedSet>();
  const maxes = new Map<string, Max>();
  let settings: Settings = {
    autoIncreaseGlobal: true, rules: { stallWeeks: 2, deloadPct: 10, maxEffort: 8 },
    trophyTiers: {}, platesOwned: [45, 25, 10, 5, 2.5], unit: 'lb',
  };
  const weights: Record<string, number> = { squat: 95, bench: 65, row: 55, curl: 15 };
  const blob = (text: string, type = 'application/json') => new Blob([text], { type });
  const preview = { valid: true, errors: [], counts: { sessions: 2, sets: 12 } };

  function addItems(sessionId: string, items: Routine['items']) {
    const start = Math.max(-1, ...[...sets.values()].filter((s) => s.sessionId === sessionId).map((s) => s.order)) + 1;
    items.forEach((item, i) => {
      for (let k = 1; k <= item.sets; k++) {
        const sid = id('set');
        sets.set(sid, { id: sid, sessionId, exerciseId: item.exerciseId, order: start + i, setNo: k, targetWeightLb: weights[item.exerciseId], targetReps: item.reps, done: false, skipped: false });
      }
    });
  }

  const api: LiftLogApi = {
    async listExercises(all) { return [...exercises.values()].filter((e) => all || !e.archived); },
    async saveExercise(e) { exercises.set(e.id, { ...e }); },
    async listRoutines(all) { return [...routines.values()].filter((r) => all || !r.archived).sort((a, b) => a.order - b.order); },
    async saveRoutine(r) { routines.set(r.id, structuredClone(r)); },
    async routineForDate(date) {
      const day = new Date(`${date}T12:00:00`).getDay();
      return [...routines.values()].find((r) => !r.archived && r.weekday === day);
    },
    async listQuickAdds() { return [...quickAdds.values()].sort((a, b) => a.order - b.order); },
    async saveQuickAdd(q) { quickAdds.set(q.id, structuredClone(q)); },
    async deleteQuickAdd(qid) { quickAdds.delete(qid); },
    async startSession(date, routineId) {
      const existing = [...sessions.values()].find((s) => s.status === 'draft' && s.date === date && s.routineId === routineId);
      if (existing) return existing;
      const s: Session = { id: id('session'), date, routineId, status: 'draft', startedAt: Date.now(), painFlag: false, note: '' };
      sessions.set(s.id, s);
      const r = routineId ? routines.get(routineId) : undefined;
      if (r) addItems(s.id, r.items);
      return s;
    },
    async getSession(sid) { return sessions.get(sid); },
    async listSessions(status) { return [...sessions.values()].filter((s) => !status || s.status === status); },
    async finishSession(sid, input) {
      const s = sessions.get(sid);
      if (s) sessions.set(sid, { ...s, ...input, painFlag: input.painFlag ?? false, note: input.note ?? '', status: 'done', endedAt: Date.now() });
    },
    async updateSession(s) { sessions.set(s.id, { ...s }); },
    async deleteSession(sid) {
      const s = sessions.get(sid);
      const own = [...sets.values()].filter((x) => x.sessionId === sid);
      sessions.delete(sid);
      own.forEach((x) => sets.delete(x.id));
      return async () => { if (s) sessions.set(sid, s); own.forEach((x) => sets.set(x.id, x)); };
    },
    async applyQuickAdd(sid, qid) {
      const q = quickAdds.get(qid);
      if (!q) throw new Error('Quick-add not found');
      if ('items' in q.source) addItems(sid, q.source.items);
      else if ('routineId' in q.source) addItems(sid, routines.get(q.source.routineId)?.items ?? []);
    },
    async listSets(sid) { return [...sets.values()].filter((s) => s.sessionId === sid); },
    async setHistory(eid) {
      return [...sets.values()]
        .filter((s) => s.exerciseId === eid && s.done && sessions.get(s.sessionId)?.status === 'done')
        .map((s) => ({ ...s, date: sessions.get(s.sessionId)!.date }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    async saveSet(s) { sets.set(s.id, { ...s }); },
    async deleteSet(sid) {
      const s = sets.get(sid);
      sets.delete(sid);
      return async () => { if (s) sets.set(sid, s); };
    },
    async listMaxes(eid) { return [...maxes.values()].filter((m) => !eid || m.exerciseId === eid); },
    async saveMax(m) { maxes.set(m.id, { ...m }); },
    async deleteMax(mid) { maxes.delete(mid); },
    async listBodyweight() { return []; },
    async logBodyweight() {},
    async deleteBodyweight() {},
    async listHabits() { return []; },
    async saveHabit() {},
    async listHabitLogs() { return []; },
    async setHabitDone() {},
    async listCalendar() { return []; },
    async saveCalendarEntry() {},
    async deleteCalendarEntry() {},
    async getSettings() { return structuredClone(settings); },
    async updateSettings(patch) { settings = { ...settings, ...patch }; },
    async exportJson() { return blob('{}'); },
    async exportCsv() { return blob('date,exercise\n', 'text/csv'); },
    async previewImport() { return preview; },
    async importJson() {},
    async exportProgram() { return blob('{"kind":"lift-log-program","version":1}'); },
    async previewProgram() { return { valid: true, errors: [], counts: { routines: 1, exercises: 6 } }; },
    async importProgram() {},
    async previewPasteLog(text) {
      const lines = text.split('\n').filter((l) => l.trim());
      return lines.length ? { valid: true, errors: [], counts: { sessions: 1, sets: lines.length } } : { valid: false, errors: ['Line 1: nothing to read'], counts: {} };
    },
    async savePasteLog() {},
    async requestPersistence() { return false; },
    async storageStatus() { return { persisted: false, usageBytes: 1_234_567, quotaBytes: 1_000_000_000 }; },
  };
  void today;
  return Object.assign(api, { sets, sessions });
}
