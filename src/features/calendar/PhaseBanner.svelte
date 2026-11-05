<!-- Home: the current phase, today's test or deload, and what is coming up (v2). Shows nothing when the calendar is empty. -->
<script lang="ts">
  import { api } from '../../db';
  import { live } from '../../db/live.svelte';
  import { bannerFor, planDay, upcoming } from '../../lib/later/calendar';
  import { todayLocal } from '../../lib/later/dates';

  let { today = todayLocal() }: { today?: string } = $props();

  const data = live(async () => {
    const [entries, routines, weekdayRoutine, settings] = await Promise.all([
      api.listCalendar(),
      api.listRoutines(),
      api.routineForDate(today),
      api.getSettings(),
    ]);
    const plan = planDay(today, entries, routines, weekdayRoutine, settings.rules.deloadPct);
    return { banner: bannerFor(plan), next: upcoming(entries, today, 14)[0] };
  }, undefined);

  const banner = $derived(data.value?.banner);
  const next = $derived(data.value?.next);
  const show = $derived(!!(banner?.title || banner?.badges.length || next));
</script>

{#if show && banner}
  <aside class="banner" aria-label="Training calendar">
    {#if banner.title}<p class="title">{banner.title}</p>{/if}
    {#if banner.badges.length}
      <ul class="badges">
        {#each banner.badges as badge}<li>{badge}</li>{/each}
      </ul>
    {/if}
    {#if next}<p class="next num">Next: {next.label}</p>{/if}
  </aside>
{/if}

<style>
  .banner { background: var(--surface); border-radius: var(--radius); padding: 12px 16px; }
  .title { margin: 0; font-weight: 600; }
  .badges { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .badges li { font-size: 0.8125rem; padding: 3px 10px; border-radius: 999px; background: var(--surface-2); color: var(--text); }
  .next { margin: 6px 0 0; font-size: 0.875rem; color: var(--text-2); }
  .num { font-variant-numeric: tabular-nums; }
</style>
