// Reactive loading through api only. Wraps the shared live() helper so a failing query
// becomes an error state the screen can explain, instead of an unhandled rejection.
import { live } from '../../db/live.svelte';

export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'error'; message: string };

/** Call during component init. Re-runs whenever the tables the query read change. */
export function load<T>(query: () => Promise<T>): { readonly value: Loaded<T> } {
  return live<Loaded<T>>(async () => {
    try {
      return { status: 'ok', data: await query() };
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  }, { status: 'loading' });
}
