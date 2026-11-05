import { liveQuery } from 'dexie';

/** Exposes a Dexie live query as Svelte 5 state. Call inside a component so the effect cleans up. */
export function live<T>(query: () => Promise<T>, initial: T): { readonly value: T } {
  let value = $state(initial);
  $effect(() => {
    const sub = liveQuery(query).subscribe({ next: (next) => (value = next) });
    return () => sub.unsubscribe();
  });
  return { get value() { return value; } };
}
