<!-- PR feed (v1.1): personal records from logged sets, newest first, grouped by day. -->
<script lang="ts">
  import { api, type Exercise } from '../../db';
  import { live } from '../../db/live.svelte';
  import { describePr, prFeed } from '../../lib/later/prs';
  import { formatShort } from '../../lib/later/dates';

  let { limit = 30, onselect }: { limit?: number; onselect?: (exerciseId: string) => void } = $props();

  const data = live(async () => {
    const exercises = (await api.listExercises(true)).filter((e) => e.kind !== 'checklist');
    const histories = await Promise.all(exercises.map((e) => api.setHistory(e.id)));
    return { exercises, histories };
  }, { exercises: [] as Exercise[], histories: [] as Awaited<ReturnType<typeof api.setHistory>>[] });

  const names = $derived(new Map(data.value.exercises.map((e) => [e.id, e.name])));
  const feed = $derived(prFeed(data.value.exercises.map((exercise, i) => ({ exercise, history: data.value.histories[i] ?? [] })), limit));
  const days = $derived.by(() => {
    const out: { date: string; items: typeof feed }[] = [];
    for (const pr of feed) {
      const last = out[out.length - 1];
      if (last?.date === pr.date) last.items.push(pr);
      else out.push({ date: pr.date, items: [pr] });
    }
    return out;
  });
</script>

<section aria-labelledby="pr-title">
  <h2 id="pr-title">PRs</h2>
  {#if days.length === 0}
    <p class="empty">Beat an earlier session and the PR shows up here.</p>
  {:else}
    {#each days as day (day.date)}
      <h3>{formatShort(day.date)}</h3>
      <ul class="group">
        {#each day.items as pr (pr.exerciseId + pr.kind + pr.set.id)}
          {@const text = describePr(pr)}
          <li>
            <button class="row" disabled={!onselect} onclick={() => onselect?.(pr.exerciseId)}>
              <span class="name">{names.get(pr.exerciseId) ?? 'Exercise'}</span>
              <span class="title num">{text.title}</span>
              <span class="detail num">{text.detail}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/each}
  {/if}
</section>

<style>
  h2 { font-size: 1.25rem; margin: 0 0 8px; }
  h3 { font-size: 0.8125rem; font-weight: 600; color: var(--text-2); margin: 16px 0 6px 16px; }
  .group { list-style: none; margin: 0; padding: 0; background: var(--surface); border-radius: var(--radius); overflow: hidden; }
  .group > li + li { border-top: 1px solid var(--separator); }
  .row {
    display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; width: 100%; min-height: var(--row-height);
    padding: 10px 16px; border: 0; background: none; color: var(--text); font: inherit; text-align: left;
  }
  .row:disabled { opacity: 1; }
  .row:active:not(:disabled) { background: var(--surface-2); }
  .name { font-weight: 600; }
  .title { color: var(--pr); font-weight: 600; text-align: right; }
  .detail { grid-column: 2; color: var(--text-2); font-size: 0.8125rem; text-align: right; }
  .empty { color: var(--text-2); }
  .num { font-variant-numeric: tabular-nums; }
</style>
