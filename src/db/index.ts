import { LiftLogDb, DB_NAME } from './schema';
import { createApi } from './dexie-api';
import { seed } from './seed';
import type { LiftLogApi } from './api';

// The one app database. It is seeded with generic data the first time it is created.
// Screens use `api` only; they never import Dexie or the database.
export const api: LiftLogApi = createApi(new LiftLogDb(DB_NAME, { populate: seed }));
export type { LiftLogApi } from './api';
export * from './types';
