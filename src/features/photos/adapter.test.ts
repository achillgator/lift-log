import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { describe, expect, test } from 'vitest';
import type { Photo } from '../../db/types';
import { createApiPhotoStore, createDexiePhotoStore, createMemoryPhotoStore, type PhotoStore } from './adapter';

const photo = (id: string, date: string, pose: Photo['pose']): Photo => ({
  id, date, pose, image: new Blob([`image ${id}`], { type: 'image/jpeg' }), thumb: new Blob([`thumb ${id}`], { type: 'image/jpeg' }),
});

async function exercise(store: PhotoStore) {
  await store.save(photo('a', '2000-01-03', 'front'));
  await store.save(photo('b', '2000-02-07', 'side'));
  await store.save(photo('c', '2000-02-07', 'front'));
  expect((await store.list()).map((p) => p.id)).toEqual(['c', 'b', 'a']);
  await store.save({ ...photo('a', '2000-01-03', 'back') });
  expect((await store.list()).find((p) => p.id === 'a')?.pose).toBe('back');
  await store.remove('b');
  expect((await store.list()).map((p) => p.id)).toEqual(['c', 'a']);
}

describe('photo stores', () => {
  test('memory', async () => {
    await exercise(createMemoryPhotoStore());
  });

  test('dexie keeps blobs', async () => {
    const db = new Dexie(`photos-test-${Math.random()}`);
    db.version(1).stores({ photos: 'id, date, [date+pose]' });
    const table = db.table('photos') as Table<Photo, string>;
    const store = createDexiePhotoStore(table);
    await exercise(store);
    const [first] = await store.list();
    expect(first.image.size).toBeGreaterThan(0);
    db.close();
  });

  test('api', async () => {
    const mem = createMemoryPhotoStore();
    await exercise(createApiPhotoStore({ listPhotos: mem.list, savePhoto: mem.save, deletePhoto: mem.remove }));
  });
});
