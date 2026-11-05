import type { LiftLogApi } from './api';

// Replaced by the Dexie implementation. Until then, any call fails with a clear message.
export const api = new Proxy({} as LiftLogApi, {
  get(_, name) {
    return () => Promise.reject(new Error(`api.${String(name)} is not implemented yet`));
  },
});
export type { LiftLogApi } from './api';
export * from './types';
