import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { api } from './index';

test('the exported api opens the app database and seeds it once', async () => {
  const first = await api.listExercises();
  expect(first).toHaveLength(13);
  expect(await api.listRoutines()).toHaveLength(1);
  // A second call reads the same rows: no second seed.
  expect((await api.listExercises()).map((e) => e.id)).toEqual(first.map((e) => e.id));
});
