import { describe, expect, test } from 'vitest';
import { exerciseByName, logRoutine, makeApi } from './test-helpers';
import { SETTINGS_KEY } from './schema';

describe('first-launch seed', () => {
  test('seeds the generic library, one example routine, one quick-add and default settings', async () => {
    const { api } = makeApi();
    const names = (await api.listExercises()).map((e) => e.name).sort();
    expect(names).toEqual([
      'Bench press', 'Dead hang', 'Deadlift', 'Hammer curl', 'Hanging leg raise', 'Incline DB curl', 'Overhead press',
      'Pause squat', 'Pull-up drop set', 'Pull-up negative', 'Row', 'Run', 'Squat',
    ].sort());
    const main = (await api.listExercises()).filter((e) => e.isMain).map((e) => e.name).sort();
    expect(main).toEqual(['Bench press', 'Deadlift', 'Overhead press', 'Squat']);
    expect((await exerciseByName(api, 'Deadlift')).incrementLb).toBe(10);
    expect((await exerciseByName(api, 'Hammer curl'))).toMatchObject({ incrementLb: 2.5, roundToLb: 2.5 });

    const routines = await api.listRoutines();
    expect(routines).toHaveLength(1);
    expect(routines[0].name).toBe('Example · Full body');
    expect(routines[0].weekday).toBeUndefined();
    expect(routines[0].items.map((i) => [i.sets, i.reps])).toEqual([[3, 5], [3, 5], [3, 8]]);

    const qa = await api.listQuickAdds();
    expect(qa).toHaveLength(1);
    expect(qa[0]).toMatchObject({ name: 'Warm-up', source: { lines: ['5 min easy cardio', 'Dynamic stretching', '2 ramp-up sets'] } });

    const settings = await api.getSettings();
    expect(settings).toMatchObject({ autoIncreaseGlobal: true, unit: 'lb', rules: { stallWeeks: 2, deloadPct: 10, maxEffort: 8 } });
    const squat = await exerciseByName(api, 'Squat');
    expect(settings.trophyTiers[squat.id]).toEqual([1, 1.25, 1.5, 1.75, 2]);
    expect(Object.keys(settings.trophyTiers)).toHaveLength(4);

    expect(await api.listSessions()).toEqual([]);
    expect(await api.listHabits()).toEqual([]);
    expect(await api.listBodyweight()).toEqual([]);
  });

  test('getSettings fills defaults when nothing is stored', async () => {
    const { api, db } = makeApi({}, { seeded: false });
    expect(await db.settings.get(SETTINGS_KEY)).toBeUndefined();
    expect((await api.getSettings()).rules.maxEffort).toBe(8);
    await api.updateSettings({ autoIncreaseGlobal: false });
    expect(await api.getSettings()).toMatchObject({ autoIncreaseGlobal: false, unit: 'lb' });
  });
});

describe('sessions', () => {
  test('startSession pre-fills sets from the routine and returns the same draft on a second call', async () => {
    const { api } = makeApi();
    const [routine] = await api.listRoutines();
    const s1 = await api.startSession('2024-03-04', routine.id);
    const s2 = await api.startSession('2024-03-04', routine.id);
    expect(s2.id).toBe(s1.id);
    const sets = await api.listSets(s1.id);
    expect(sets).toHaveLength(9);
    expect(sets.map((s) => s.targetReps)).toEqual([5, 5, 5, 5, 5, 5, 8, 8, 8]);
    expect(sets.every((s) => !s.done && s.weightLb === undefined)).toBe(true);
    expect(sets.map((s) => s.order)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
  });

  test('auto-increase: next session adds the increment when every set hit and effort <= 8', async () => {
    const { api } = makeApi();
    const [routine] = await api.listRoutines();
    const squat = await exerciseByName(api, 'Squat');
    const first = await api.startSession('2024-03-04', routine.id);
    for (const s of await api.listSets(first.id)) {
      await api.saveSet({ ...s, weightLb: s.exerciseId === squat.id ? 135 : 95, targetWeightLb: s.exerciseId === squat.id ? 135 : 95, done: true });
    }
    await api.finishSession(first.id, { durationMin: 40, effort: 7 });

    const next = await api.startSession('2024-03-06', routine.id);
    const squatSets = (await api.listSets(next.id)).filter((s) => s.exerciseId === squat.id);
    expect(squatSets.map((s) => s.targetWeightLb)).toEqual([140, 140, 140]);
    expect(squatSets.map((s) => s.weightLb)).toEqual([140, 140, 140]);
  });

  test('auto-increase holds after missed reps, high effort, or with the switch off', async () => {
    const { api } = makeApi();
    const [routine] = await api.listRoutines();
    const squat = await exerciseByName(api, 'Squat');
    const setAll = async (sessionId: string, reps?: number) => {
      for (const s of await api.listSets(sessionId)) await api.saveSet({ ...s, weightLb: 100, targetWeightLb: 100, done: true, reps: reps ?? s.reps });
    };
    const squatTarget = async (sessionId: string) => (await api.listSets(sessionId)).find((s) => s.exerciseId === squat.id)!.targetWeightLb;

    const a = await api.startSession('2024-03-04', routine.id);
    await setAll(a.id, 4);
    await api.finishSession(a.id, { durationMin: 40 });
    const b = await api.startSession('2024-03-06', routine.id);
    expect(await squatTarget(b.id)).toBe(100);

    await setAll(b.id);
    await api.finishSession(b.id, { durationMin: 40, effort: 9 });
    const c = await api.startSession('2024-03-08', routine.id);
    expect(await squatTarget(c.id)).toBe(100);

    await setAll(c.id);
    await api.finishSession(c.id, { durationMin: 40 });
    await api.updateSettings({ autoIncreaseGlobal: false });
    const d = await api.startSession('2024-03-11', routine.id);
    expect(await squatTarget(d.id)).toBe(100);
    await api.deleteSession(d.id);

    await api.updateSettings({ autoIncreaseGlobal: true });
    await api.saveExercise({ ...squat, autoIncrease: false });
    const e = await api.startSession('2024-03-11', routine.id);
    expect(await squatTarget(e.id)).toBe(100);
  });

  test('a new routine starts from the latest weight anywhere, held', async () => {
    const { api } = makeApi();
    const [routine] = await api.listRoutines();
    const squat = await exerciseByName(api, 'Squat');
    await logRoutine(api, '2024-03-04', routine.id);
    const s = (await api.listSets((await api.listSessions('done'))[0].id)).filter((x) => x.exerciseId === squat.id);
    for (const x of s) await api.saveSet({ ...x, weightLb: 150, targetWeightLb: 150 });

    await api.saveRoutine({ id: 'r2', name: 'Other', order: 1, archived: false, items: [{ exerciseId: squat.id, sets: 2, reps: 3 }] });
    const other = await api.startSession('2024-03-05', 'r2');
    expect((await api.listSets(other.id)).map((x) => x.targetWeightLb)).toEqual([150, 150]);
  });

  test('derived lifts follow their source routine, rounded', async () => {
    const { api } = makeApi();
    const [routine] = await api.listRoutines();
    const squat = await exerciseByName(api, 'Squat');
    const pause = await exerciseByName(api, 'Pause squat');
    const first = await api.startSession('2024-03-04', routine.id);
    for (const s of await api.listSets(first.id)) await api.saveSet({ ...s, weightLb: 225, done: true });
    await api.finishSession(first.id, { durationMin: 40 });

    await api.saveExercise({ ...pause, derivedFrom: { exerciseId: squat.id, routineId: routine.id, pct: 80 } });
    await api.saveRoutine({ id: 'light', name: 'Light day', order: 1, archived: false, items: [{ exerciseId: pause.id, sets: 2, reps: 3 }] });
    const light = await api.startSession('2024-03-06', 'light');
    expect((await api.listSets(light.id)).map((s) => s.targetWeightLb)).toEqual([180, 180]);
  });

  test('runs use the routine distance progression; holds use reps as seconds', async () => {
    const { api } = makeApi();
    const run = await exerciseByName(api, 'Run');
    const hang = await exerciseByName(api, 'Dead hang');
    await api.saveRoutine({
      id: 'run', name: 'Easy run', order: 1, archived: false,
      distanceProgression: { startMi: 1, stepMi: 0.5, everyWeeks: 2, fromDate: '2024-01-01', capMi: 3 },
      items: [{ exerciseId: run.id, sets: 1, reps: 1, targetTimeSec: 600 }, { exerciseId: hang.id, sets: 2, reps: 30 }],
    });
    const s = await api.startSession('2024-01-29', 'run');
    const sets = await api.listSets(s.id);
    expect(sets[0]).toMatchObject({ distanceM: 3219, timeSec: 600 }); // 2 mi after 4 weeks
    expect(sets.slice(1).map((x) => x.holdSec)).toEqual([30, 30]);
  });

  test('start empty, finish, history, delete with undo', async () => {
    const { api } = makeApi();
    const squat = await exerciseByName(api, 'Squat');
    const s = await api.startSession('2024-03-04');
    expect(await api.listSets(s.id)).toEqual([]);
    await api.saveSet({ id: 'x1', sessionId: s.id, exerciseId: squat.id, order: 0, setNo: 1, weightLb: 95, reps: 5, done: true, skipped: false });
    await api.saveSet({ id: 'x2', sessionId: s.id, exerciseId: squat.id, order: 0, setNo: 2, weightLb: 95, reps: 5, done: false, skipped: true });
    expect(await api.setHistory(squat.id)).toEqual([]);
    await api.finishSession(s.id, { durationMin: 30, calories: 200, effort: 6, note: 'felt fine' });
    expect(await api.getSession(s.id)).toMatchObject({ status: 'done', durationMin: 30, calories: 200, effort: 6, note: 'felt fine', painFlag: false });
    expect((await api.setHistory(squat.id)).map((h) => [h.id, h.date])).toEqual([['x1', '2024-03-04']]);

    const undo = await api.deleteSession(s.id);
    expect(await api.getSession(s.id)).toBeUndefined();
    expect(await api.listSets(s.id)).toEqual([]);
    await undo();
    expect(await api.getSession(s.id)).toBeDefined();
    expect(await api.listSets(s.id)).toHaveLength(2);

    const undoSet = await api.deleteSet('x1');
    expect(await api.listSets(s.id)).toHaveLength(1);
    await undoSet();
    expect(await api.listSets(s.id)).toHaveLength(2);
  });

  test('applyQuickAdd appends checklist lines, items or a routine after existing sets', async () => {
    const { api } = makeApi();
    const [routine] = await api.listRoutines();
    const [warmup] = await api.listQuickAdds();
    const s = await api.startSession('2024-03-04', routine.id);
    await api.applyQuickAdd(s.id, warmup.id);
    const sets = await api.listSets(s.id);
    expect(sets).toHaveLength(12);
    expect(sets.slice(9).map((x) => x.order)).toEqual([3, 4, 5]);
    const checklist = (await api.listExercises()).filter((e) => e.kind === 'checklist').map((e) => e.name);
    expect(checklist.sort()).toEqual(['2 ramp-up sets', '5 min easy cardio', 'Dynamic stretching']);

    // Applying it again reuses the same checklist exercises.
    await api.applyQuickAdd(s.id, warmup.id);
    expect((await api.listExercises()).filter((e) => e.kind === 'checklist')).toHaveLength(3);

    await api.saveQuickAdd({ id: 'qa-r', name: 'Whole routine', order: 1, source: { routineId: routine.id } });
    await api.applyQuickAdd(s.id, 'qa-r');
    expect(await api.listSets(s.id)).toHaveLength(24);
    await api.deleteQuickAdd('qa-r');
    expect(await api.listQuickAdds()).toHaveLength(1);
  });
});

describe('lookups and small tables', () => {
  test('routineForDate matches the weekday and skips archived routines', async () => {
    const { api } = makeApi();
    expect(await api.routineForDate('2024-03-04')).toBeUndefined();
    const [routine] = await api.listRoutines();
    await api.saveRoutine({ ...routine, weekday: 1 }); // Monday
    expect((await api.routineForDate('2024-03-04'))?.id).toBe(routine.id);
    expect(await api.routineForDate('2024-03-05')).toBeUndefined();
    await api.saveRoutine({ ...routine, weekday: 1, archived: true });
    expect(await api.routineForDate('2024-03-04')).toBeUndefined();
    expect(await api.listRoutines(true)).toHaveLength(1);
  });

  test('bodyweight keeps one entry per date', async () => {
    const { api } = makeApi();
    await api.logBodyweight('2024-03-02', 160);
    await api.logBodyweight('2024-03-01', 161);
    await api.logBodyweight('2024-03-02', 159.5);
    expect((await api.listBodyweight()).map((b) => [b.date, b.weightLb])).toEqual([['2024-03-01', 161], ['2024-03-02', 159.5]]);
    await api.deleteBodyweight('2024-03-01');
    expect(await api.listBodyweight()).toHaveLength(1);
  });

  test('maxes, habits, habit logs and calendar', async () => {
    const { api } = makeApi();
    await api.saveMax({ id: 'm1', exerciseId: 'e', date: '2024-02-01', weightLb: 200, tested: true });
    await api.saveMax({ id: 'm2', exerciseId: 'f', date: '2024-01-01', weightLb: 100, tested: false });
    expect((await api.listMaxes()).map((m) => m.id)).toEqual(['m2', 'm1']);
    expect((await api.listMaxes('e')).map((m) => m.id)).toEqual(['m1']);
    await api.deleteMax('m1');
    expect(await api.listMaxes()).toHaveLength(1);

    await api.saveHabit({ id: 'h2', name: 'Second', order: 1, archived: false });
    await api.saveHabit({ id: 'h1', name: 'First', order: 0, archived: false });
    await api.saveHabit({ id: 'h3', name: 'Old', order: 2, archived: true });
    expect((await api.listHabits()).map((h) => h.id)).toEqual(['h1', 'h2']);
    expect(await api.listHabits(true)).toHaveLength(3);
    await api.setHabitDone('2024-03-01', 'h1', true);
    await api.setHabitDone('2024-03-05', 'h1', true);
    await api.setHabitDone('2024-03-01', 'h1', false);
    expect(await api.listHabitLogs()).toHaveLength(2);
    expect(await api.listHabitLogs('2024-03-01', '2024-03-02')).toEqual([{ date: '2024-03-01', habitId: 'h1', done: false }]);

    await api.saveCalendarEntry({ id: 'c2', type: 'deload', name: 'Light week', startDate: '2024-05-01', pct: 10, fewerSets: 1 });
    await api.saveCalendarEntry({ id: 'c1', type: 'phase', name: 'Base', startDate: '2024-01-01', endDate: '2024-04-30' });
    expect((await api.listCalendar()).map((c) => c.id)).toEqual(['c1', 'c2']);
    await api.deleteCalendarEntry('c1');
    expect(await api.listCalendar()).toHaveLength(1);
  });

  test('stallStatus flags two weeks of missed reps and suggests -10%', async () => {
    const { api } = makeApi();
    const [routine] = await api.listRoutines();
    const squat = await exerciseByName(api, 'Squat');
    const miss = async (date: string) => {
      const s = await api.startSession(date, routine.id);
      for (const x of await api.listSets(s.id)) await api.saveSet({ ...x, weightLb: 200, targetWeightLb: 200, done: true, reps: x.exerciseId === squat.id ? 3 : x.reps });
      await api.finishSession(s.id, { durationMin: 40 });
    };
    await miss('2024-03-04');
    expect((await api.stallStatus(squat.id)).stalled).toBe(false);
    await miss('2024-03-11');
    expect(await api.stallStatus(squat.id)).toMatchObject({ exerciseId: squat.id, stalled: true, weeks: 2, lastWeightLb: 200, suggestedWeightLb: 180 });
    expect((await api.stallStatus(squat.id, 'other-routine')).stalled).toBe(false);
  });
});

describe('storage persistence', () => {
  const fakeStorage = (persisted: boolean, grant: boolean) => {
    const calls = { persist: 0 };
    const storage = {
      persisted: async () => persisted,
      persist: async () => { calls.persist++; persisted = grant; return grant; },
      estimate: async () => ({ usage: 1234, quota: 99999 }),
    };
    return { storage, calls };
  };

  test('requestPersistence feature-detects and never throws', async () => {
    expect(await makeApi({ storage: () => undefined }).api.requestPersistence()).toBe(false);
    expect(await makeApi({ storage: () => ({ persist: async () => { throw new Error('nope'); } }) }).api.requestPersistence()).toBe(false);
    const { storage, calls } = fakeStorage(false, true);
    expect(await makeApi({ storage: () => storage }).api.requestPersistence()).toBe(true);
    expect(calls.persist).toBe(1);
  });

  test('is requested on finishing a workout, not before', async () => {
    const { storage, calls } = fakeStorage(false, false);
    const { api } = makeApi({ storage: () => storage });
    const s = await api.startSession('2024-03-04');
    expect(calls.persist).toBe(0);
    await api.finishSession(s.id, { durationMin: 10 });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.persist).toBe(1);
  });

  test('storageStatus reports persisted, usage and photo bytes', async () => {
    const { storage } = fakeStorage(true, true);
    const { api, db } = makeApi({ storage: () => storage });
    expect(await api.storageStatus()).toEqual({ persisted: true, usageBytes: 1234, quotaBytes: 99999 });
    await db.photos.add({ id: 'p', date: '2024-01-01', pose: 'front', image: new Blob(['abcd']), thumb: new Blob(['ab']) });
    expect((await api.storageStatus()).photoBytes).toBe(6);
    expect(await makeApi({ storage: () => undefined }).api.storageStatus()).toEqual({ persisted: false });
  });
});
