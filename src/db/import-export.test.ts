import { describe, expect, test } from 'vitest';
import { exerciseByName, logRoutine, makeApi } from './test-helpers';

const blob = (text: string) => new Blob([text]);
const text = async (b: Blob) => b.text();

describe('JSON backup', () => {
  test('export includes every table but photos, and sets lastExportAt', async () => {
    const { api, db } = makeApi();
    const [routine] = await api.listRoutines();
    await logRoutine(api, '2024-03-04', routine.id);
    await api.logBodyweight('2024-03-04', 170);
    await db.photos.add({ id: 'p', date: '2024-03-04', pose: 'front', image: new Blob(['x']), thumb: new Blob(['x']) });
    expect((await api.getSettings()).lastExportAt).toBeUndefined();

    const file = JSON.parse(await text(await api.exportJson()));
    expect(file).toMatchObject({ kind: 'lift-log-backup', schemaVersion: 1 });
    expect(typeof file.exportedAt).toBe('number');
    expect(file.data.sessions).toHaveLength(1);
    expect(file.data.sets).toHaveLength(9);
    expect(file.data.bodyweight).toHaveLength(1);
    expect(file.data.photos).toBeUndefined();
    expect(file.data.settings.unit).toBe('lb');
    expect((await api.getSettings()).lastExportAt).toBeGreaterThan(0);
  });

  test('replace restores an exact copy on a fresh device and keeps its photos', async () => {
    const a = makeApi();
    const [routine] = await a.api.listRoutines();
    await logRoutine(a.api, '2024-03-04', routine.id);
    await a.api.logBodyweight('2024-03-04', 170);
    await a.api.setHabitDone('2024-03-04', 'h', true);
    const backup = await a.api.exportJson();

    const b = makeApi();
    await b.db.photos.add({ id: 'p', date: '2024-03-04', pose: 'front', image: new Blob(['x']), thumb: new Blob(['x']) });
    const preview = await b.api.previewImport(backup);
    expect(preview).toMatchObject({ valid: true, errors: [] });
    expect(preview.counts).toMatchObject({ exercises: 13, routines: 1, sessions: 1, sets: 9, bodyweight: 1, habitLogs: 1 });

    await b.api.importJson(backup, 'replace');
    expect(await b.api.listExercises()).toEqual(await a.api.listExercises());
    expect(await b.api.listSessions()).toEqual(await a.api.listSessions());
    expect(await b.api.listHabitLogs()).toEqual(await a.api.listHabitLogs());
    expect((await b.api.getSettings()).trophyTiers).toEqual((await a.api.getSettings()).trophyTiers);
    expect(await b.db.photos.count()).toBe(1);
  });

  test('merge adds rows, lets the file win on the same id or date, and keeps device settings', async () => {
    const a = makeApi();
    await a.api.logBodyweight('2024-03-01', 170);
    await a.api.saveMax({ id: 'shared', exerciseId: 'e', date: '2024-01-01', weightLb: 200, tested: true });
    const backup = await a.api.exportJson();

    const b = makeApi();
    await b.api.logBodyweight('2024-03-01', 999);
    await b.api.logBodyweight('2024-03-02', 171);
    await b.api.saveMax({ id: 'shared', exerciseId: 'e', date: '2024-01-01', weightLb: 1, tested: false });
    await b.api.updateSettings({ autoIncreaseGlobal: false });
    await b.api.importJson(backup, 'merge');

    expect((await b.api.listBodyweight()).map((x) => [x.date, x.weightLb])).toEqual([['2024-03-01', 170], ['2024-03-02', 171]]);
    expect((await b.api.listMaxes())[0].weightLb).toBe(200);
    expect((await b.api.getSettings()).autoIncreaseGlobal).toBe(false);
    expect((await b.api.listExercises()).length).toBe(26); // both seeds: different ids
  });

  test('an invalid file changes nothing', async () => {
    const { api } = makeApi();
    const before = await api.listExercises(true);
    const bad = blob(JSON.stringify({ kind: 'lift-log-backup', schemaVersion: 1, data: { sessions: [{ id: 1 }] } }));
    const preview = await api.previewImport(bad);
    expect(preview.valid).toBe(false);
    expect(preview.errors.length).toBeGreaterThan(0);
    await expect(api.importJson(bad, 'replace')).rejects.toThrow(/nothing was changed/);
    expect(await api.listExercises(true)).toEqual(before);
  });
});

describe('CSV export', () => {
  test('one row per set with names, and does not count as a backup', async () => {
    const { api } = makeApi();
    const [routine] = await api.listRoutines();
    await logRoutine(api, '2024-03-04', routine.id);
    const csv = await text(await api.exportCsv());
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(10);
    expect(lines[1]).toMatch(/^2024-03-04,Example · Full body,Squat,done,1,/);
    expect((await api.getSettings()).lastExportAt).toBeUndefined();
  });
});

describe('program file import and export', () => {
  test('replace archives old routines and exercises and never touches logged data', async () => {
    const source = makeApi();
    const squat = await exerciseByName(source.api, 'Squat');
    await source.api.saveRoutine({ id: 'new-plan', name: 'New plan', order: 0, archived: false, items: [{ exerciseId: squat.id, sets: 5, reps: 3 }] });
    await source.api.saveHabit({ id: 'hb', name: 'Stretch', order: 0, archived: false });
    await source.api.updateSettings({ rules: { stallWeeks: 3, deloadPct: 15, maxEffort: 7 } });
    const program = await source.api.exportProgram();
    const parsed = JSON.parse(await text(program));
    expect(parsed.kind).toBe('lift-log-program');
    expect(parsed.sessions).toBeUndefined();

    const device = makeApi();
    const [oldRoutine] = await device.api.listRoutines();
    const { session } = await logRoutine(device.api, '2024-03-04', oldRoutine.id);
    await device.api.logBodyweight('2024-03-04', 170);
    await device.api.saveMax({ id: 'm', exerciseId: 'e', date: '2024-03-04', weightLb: 200, tested: true });
    await device.api.saveHabit({ id: 'old-habit', name: 'Old', order: 0, archived: false });
    await device.api.setHabitDone('2024-03-04', 'old-habit', true);
    const setsBefore = await device.api.listSets(session.id);

    const preview = await device.api.previewProgram(program);
    expect(preview).toMatchObject({ valid: true, counts: { exercises: 13, routines: 2, quickAdds: 1, habits: 1, calendar: 0 } });
    await device.api.importProgram(program, 'replace');

    const all = await device.api.listRoutines(true);
    expect(all.find((r) => r.id === oldRoutine.id)?.archived).toBe(true);
    expect((await device.api.listRoutines()).map((r) => r.name).sort()).toEqual(['Example · Full body', 'New plan']);
    expect((await device.api.listExercises(true)).filter((e) => e.archived)).toHaveLength(13); // device's own seed, archived
    expect(await device.api.listExercises()).toHaveLength(13); // the file's
    expect((await device.api.listHabits()).map((h) => h.name)).toEqual(['Stretch']);
    expect((await device.api.listHabits(true))).toHaveLength(2);
    expect((await device.api.getSettings()).rules).toEqual({ stallWeeks: 3, deloadPct: 15, maxEffort: 7 });

    expect(await device.api.listSets(session.id)).toEqual(setsBefore);
    expect(await device.api.getSession(session.id)).toMatchObject({ status: 'done' });
    expect(await device.api.listBodyweight()).toHaveLength(1);
    expect(await device.api.listMaxes()).toHaveLength(1);
    expect(await device.api.listHabitLogs()).toHaveLength(1);
  });

  test('merge adds the file rows and keeps device settings', async () => {
    const source = makeApi();
    await source.api.updateSettings({ autoIncreaseGlobal: false });
    const program = await source.api.exportProgram();
    const device = makeApi();
    await device.api.importProgram(program, 'merge');
    expect(await device.api.listRoutines()).toHaveLength(2);
    expect((await device.api.getSettings()).autoIncreaseGlobal).toBe(true);
    expect(Object.keys((await device.api.getSettings()).trophyTiers)).toHaveLength(8);
  });

  test('an invalid program changes nothing', async () => {
    const { api } = makeApi();
    const bad = blob(JSON.stringify({ kind: 'lift-log-program', version: 1, routines: [{ id: 'r', name: 'R', order: 0, archived: false, items: [{ exerciseId: 'nope', sets: 1, reps: 1 }] }] }));
    expect((await api.previewProgram(bad)).errors).toEqual(['Routine R: exercise nope is not in the file']);
    await expect(api.importProgram(bad, 'replace')).rejects.toThrow(/nothing was changed/);
    expect(await api.listRoutines()).toHaveLength(1);
  });
});

describe('paste log', () => {
  const log = [
    '# made-up sample',
    '2023-04-03 squat 3x5@95; bench 5@65, 5@65, 4@65; hang 30,25,20',
    '2023-04-05 deadlift 1x5@135; curl 2x10@20',
  ].join('\n');

  test('preview counts sessions and sets without saving', async () => {
    const { api } = makeApi();
    expect(await api.previewPasteLog(log)).toEqual({ valid: true, errors: [], counts: { sessions: 2, sets: 12, skipped: 0 } });
    expect(await api.listSessions()).toEqual([]);
    expect((await api.previewPasteLog('   ')).valid).toBe(false);
  });

  test('saves done sessions under an archived "Legacy 5x5" routine with mapped exercises', async () => {
    const { api } = makeApi();
    await api.savePasteLog(log);
    const legacy = (await api.listRoutines(true)).find((r) => r.name === 'Legacy 5x5')!;
    expect(legacy.archived).toBe(true);
    const sessions = await api.listSessions('done');
    expect(sessions.map((s) => s.date)).toEqual(['2023-04-05', '2023-04-03']);
    expect(sessions.every((s) => s.routineId === legacy.id)).toBe(true);

    const squat = await exerciseByName(api, 'Squat');
    expect((await api.setHistory(squat.id)).map((s) => [s.weightLb, s.reps])).toEqual([[95, 5], [95, 5], [95, 5]]);
    const hang = await exerciseByName(api, 'Dead hang');
    expect((await api.setHistory(hang.id)).map((s) => s.holdSec)).toEqual([30, 25, 20]);
    const curl = await exerciseByName(api, 'Curl (legacy)');
    expect(curl).toMatchObject({ kind: 'dumbbell', archived: false });
    expect(await api.setHistory(curl.id)).toHaveLength(2);
    expect((await api.listExercises()).filter((e) => e.name === 'Squat')).toHaveLength(1);

    // The example routine's next squat starts from the legacy weight, held.
    const [example] = await api.listRoutines();
    const next = await api.startSession('2023-04-10', example.id);
    expect((await api.listSets(next.id)).find((s) => s.exerciseId === squat.id)?.targetWeightLb).toBe(95);
  });

  test('pasting the same dates again adds nothing', async () => {
    const { api } = makeApi();
    await api.savePasteLog(log);
    expect((await api.previewPasteLog(log)).counts).toEqual({ sessions: 0, sets: 0, skipped: 2 });
    await api.savePasteLog(log);
    expect(await api.listSessions()).toHaveLength(2);
  });

  test('any malformed line means nothing is saved', async () => {
    const { api } = makeApi();
    const bad = `${log}\n2023-04-07 press 3x5@60`;
    const preview = await api.previewPasteLog(bad);
    expect(preview.valid).toBe(false);
    expect(preview.errors).toEqual(['Line 4: unknown exercise "press" (use squat, bench, deadlift, curl, hang)']);
    await expect(api.savePasteLog(bad)).rejects.toThrow(/Line 4/);
    expect(await api.listSessions()).toEqual([]);
  });
});
