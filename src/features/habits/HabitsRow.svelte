<!-- Home: today's habits as toggles with streaks (v1.1). Not wired yet; see the PR for wiring steps. -->
<script lang="ts">
  import Check from 'lucide-svelte/icons/check';
  import { api } from '../../db';
  import { live } from '../../db/live.svelte';
  import { activeHabits, habitStreaks } from '../../lib/later/habits';
  import { todayLocal } from '../../lib/later/dates';

  let { today = todayLocal(), onedit }: { today?: string; onedit?: () => void } = $props();

  const habits = live(() => api.listHabits(), []);
  // Full history: a few rows per day, and best streaks need all of it.
  const logs = live(() => api.listHabitLogs(undefined, today), []);

  // Taps show at once; the live query catches up after the write.
  let pending = $state<Record<string, boolean>>({});
  let error = $state('');

  const rows = $derived(activeHabits(habits.value));
  const streaks = $derived(habitStreaks(rows, logs.value, today));
  const isDone = (id: string) => pending[id] ?? streaks[id]?.doneToday ?? false;

  async function toggle(id: string) {
    const next = !isDone(id);
    pending[id] = next;
    error = '';
    try {
      await api.setHabitDone(today, id, next);
    } catch {
      pending[id] = !next;
      error = 'Could not save that tap. Your other habits are safe. Try again.';
      return;
    }
    // Hold the optimistic value until the live query has caught up.
    setTimeout(() => delete pending[id], 1000);
  }

  function streakLabel(id: string): string {
    const s = streaks[id];
    if (!s) return '';
    const current = s.current + (isDone(id) && !s.doneToday ? 1 : 0) - (!isDone(id) && s.doneToday ? 1 : 0);
    return current > 0 ? `${current} day${current === 1 ? '' : 's'}` : '';
  }
</script>

<section aria-labelledby="habits-title">
  <header>
    <h2 id="habits-title">Habits</h2>
    {#if onedit && rows.length > 0}<button class="link" onclick={onedit}>Edit</button>{/if}
  </header>

  {#if rows.length === 0}
    <p class="empty">No habits yet.</p>
    {#if onedit}<button class="link" onclick={onedit}>Add a habit</button>{/if}
  {:else}
    <ul>
      {#each rows as habit (habit.id)}
        {@const done = isDone(habit.id)}
        {@const streak = streakLabel(habit.id)}
        <li>
          <button class="habit" class:done aria-pressed={done} onclick={() => toggle(habit.id)}>
            <span class="tick" aria-hidden="true">{#if done}<Check size={16} strokeWidth={2.5} />{/if}</span>
            <span class="name">{habit.name}</span>
            {#if streak}<span class="streak num" aria-label="Streak {streak}">{streak}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  header { display: flex; align-items: baseline; justify-content: space-between; }
  h2 { font-size: 1.25rem; margin: 0 0 8px; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
  li { flex: none; }
  .habit {
    display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px;
    border: 1px solid var(--separator); border-radius: 999px; background: var(--surface); color: var(--text);
    font: inherit; font-size: 0.9375rem; -webkit-touch-callout: none; user-select: none;
  }
  .habit:active { transform: scale(0.97); }
  .habit.done { background: var(--accent); border-color: var(--accent); color: var(--surface); }
  .tick { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid currentColor; display: grid; place-items: center; flex: none; }
  .done .tick { border-color: transparent; }
  .streak { font-size: 0.8125rem; opacity: 0.8; }
  .link { background: none; border: 0; color: var(--accent); font: inherit; min-height: 44px; padding: 0 4px; }
  .empty { color: var(--text-2); margin: 0; }
  .error { color: var(--danger); font-size: 0.875rem; }
  .num { font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: reduce) { .habit:active { transform: none; } }
</style>
