// Reactive reads through the shared live() helper, with the error kept instead of thrown,
// so a screen can say what failed and still show its empty state.
import { live } from '../db/live.svelte';
import { errorMessage } from './format';

export function query<T>(fn: () => Promise<T>, initial: T): { readonly value: T; readonly error: string | undefined; readonly loaded: boolean } {
  let error = $state<string | undefined>();
  let loaded = $state(false);
  const result = live(
    () =>
      fn().then(
        (v) => {
          error = undefined;
          loaded = true;
          return v;
        },
        (e) => {
          error = errorMessage(e);
          loaded = true;
          return initial;
        },
      ),
    initial,
  );
  return {
    get value() { return result.value; },
    get error() { return error; },
    get loaded() { return loaded; },
  };
}
