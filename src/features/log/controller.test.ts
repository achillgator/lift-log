import { beforeEach, describe, expect, test } from 'vitest';
import { LogController, type Notifier } from './controller.svelte';
import { createFakeApi } from './fakeApi';
import { doneAsPlanned } from '../../components/setrow';

let api: ReturnType<typeof createFakeApi>;
let notes: { message: string; undo?: () => unknown }[];
let errors: string[];
const notify: Notifier = {
  show: (message, opts) => void notes.push({ message, undo: opts?.undo }),
  error: (what) => void errors.push(what),
};

async function open(routineId?: string) {
  const s = await api.startSession('2026-11-05', routineId);
  const c = new LogController(api, s.id, notify);
  await c.load();
  return c;
}

const stored = (id: string) => api.sets.get(id);

beforeEach(() => {
  api = createFakeApi();
  notes = [];
  errors = [];
});

describe('log sheet', () => {
  test('opens pre-filled from the routine, grouped per exercise', async () => {
    const c = await open('full');
    expect(c.title).toBe('Example · Full body');
    expect(c.groups.map((g) => c.name(g.exerciseId))).toEqual(['Squat', 'Bench press', 'Row']);
    expect(c.groups[0].sets).toHaveLength(3);
    expect(c.groups[0].sets[0]).toMatchObject({ targetWeightLb: 95, targetReps: 5, done: false });
  });

  test('a set tap is saved at once', async () => {
    const c = await open('full');
    const first = c.sets[0];
    await c.save(doneAsPlanned(first));
    expect(stored(first.id)).toMatchObject({ done: true, weightLb: 95, reps: 5 });
  });

  test('a draft reloads exactly as it was left', async () => {
    const c = await open('full');
    await c.save({ ...doneAsPlanned(c.sets[1]), weightLb: 100 });
    const again = new LogController(api, c.session!.id, notify);
    await again.load();
    expect(again.sets[1]).toMatchObject({ done: true, weightLb: 100 });
  });

  test('tapping an exercise marks every set and Undo restores them', async () => {
    const c = await open('full');
    await c.tapExercise('bench');
    const bench = c.sets.filter((s) => s.exerciseId === 'bench');
    expect(bench.every((s) => stored(s.id)?.done)).toBe(true);
    await notes.at(-1)!.undo!();
    expect(bench.every((s) => !stored(s.id)?.done)).toBe(true);
  });

  test('skip, add and remove sets, with Undo for remove', async () => {
    const c = await open('full');
    const row = c.groups[2].sets;
    await c.toggleSkip(row[0]);
    expect(stored(row[0].id)?.skipped).toBe(true);
    await c.addSet('row');
    expect(c.groups[2].sets.map((s) => s.setNo)).toEqual([1, 2, 3, 4]);
    await c.removeSet(row[1]);
    expect(stored(row[1].id)).toBeUndefined();
    await notes.at(-1)!.undo!();
    expect(stored(row[1].id)).toBeDefined();
    expect(c.groups[2].sets).toHaveLength(4);
  });

  test('swap exercise with Undo', async () => {
    const c = await open('full');
    await c.swap('squat', 'hang');
    expect(c.groups[0].exerciseId).toBe('hang');
    await notes.at(-1)!.undo!();
    expect(c.groups[0].exerciseId).toBe('squat');
  });

  test('start empty, then add an exercise and a quick-add', async () => {
    const c = await open();
    expect(c.sets).toHaveLength(0);
    await c.addExercise('row');
    expect(c.sets).toHaveLength(1);
    await c.applyQuickAdd('arms');
    expect(c.groups.map((g) => g.exerciseId)).toEqual(['row', 'curl']);
    await notes.at(-1)!.undo!();
    expect(c.groups.map((g) => g.exerciseId)).toEqual(['row']);
  });

  test('a failed write says so and the screen goes back to what is stored', async () => {
    const c = await open('full');
    api.saveSet = async () => { throw new Error('disk full'); };
    await c.save(doneAsPlanned(c.sets[0]));
    expect(errors).toEqual(["Couldn't save that change."]);
    expect(c.sets[0].done).toBe(false);
  });

  test('discarding a workout can be undone', async () => {
    const c = await open('full');
    await c.discard();
    expect(api.sessions.size).toBe(0);
    await notes.at(-1)!.undo!();
    expect(api.sessions.size).toBe(1);
  });
});
