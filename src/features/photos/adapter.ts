// The photos feature reads and writes only through this interface, so it does not care whether
// photos come from Dexie directly or from new `api` methods. See the PR for the api additions.
import type { Table } from 'dexie';
import type { Photo } from '../../db/types';
import { compareDates } from '../../lib/later/dates';

export interface PhotoStore {
  /** All photos, newest date first. Blobs from IndexedDB are read lazily, so this stays light. */
  list(): Promise<Photo[]>;
  /** Saves or replaces by id. */
  save(photo: Photo): Promise<void>;
  remove(id: string): Promise<void>;
}

const newestFirst = (a: Photo, b: Photo) => compareDates(b.date, a.date) || a.pose.localeCompare(b.pose);

/** Dexie access to the `photos` table (schema: `photos: 'id, date, [date+pose]'`). */
export function createDexiePhotoStore(table: Table<Photo, string>): PhotoStore {
  return {
    async list() {
      return (await table.toArray()).sort(newestFirst);
    },
    async save(photo) {
      await table.put(photo);
    },
    async remove(id) {
      await table.delete(id);
    },
  };
}

/** The `api` additions this feature needs (proposed in the PR). */
export interface PhotoApi {
  listPhotos(): Promise<Photo[]>;
  savePhoto(photo: Photo): Promise<void>;
  deletePhoto(id: string): Promise<unknown>;
}

/** Uses the proposed api methods once src/db has them. */
export function createApiPhotoStore(api: PhotoApi): PhotoStore {
  return {
    async list() {
      return (await api.listPhotos()).sort(newestFirst);
    },
    save: (photo) => api.savePhoto(photo),
    async remove(id) {
      await api.deletePhoto(id);
    },
  };
}

/** In-memory store for tests and the kitchen-sink page. Nothing persists. */
export function createMemoryPhotoStore(initial: Photo[] = []): PhotoStore {
  const rows = new Map(initial.map((p) => [p.id, p]));
  return {
    async list() {
      return [...rows.values()].sort(newestFirst);
    },
    async save(photo) {
      rows.set(photo.id, photo);
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}
