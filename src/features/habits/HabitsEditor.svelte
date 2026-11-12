<!-- Settings or a sheet: add, rename, reorder and archive habits (v1.1). Every change saves at once. -->
<script lang="ts">
  import ChevronUp from 'lucide-svelte/icons/chevron-up';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import Archive from 'lucide-svelte/icons/archive';
  import { api, type Habit } from '../../db';
  import { live } from '../../db/live.svelte';
  import { activeHabits, habitNameError, HABIT_NAME_MAX, newHabit, unarchiveHabit } from '../../lib/later/habits';
  import { moveItem } from '../../lib/later/order';

  const all = live(() => api.listHabits(true), []);
  const active = $derived(activeHabits(all.value));
  const archived = $derived(all.value.filter((h) => h.archived).sort((a, b) => a.name.localeCompare(b.name)));

  let draft = $state('');
  let addError = $state('');
  let renameErrors = $state<Record<string, string>>({});
  let error = $state('');
  let undo = $state<{ label: string; run: () => Promise<void> } | undefined>();
  let undoTimer: ReturnType<typeof setTimeout> | undefined;

  async function save(...habits: Habit[]) {
    error = '';
    try {
      for (const h of habits) await api.saveHabit($state.snapshot(h) as Habit);
    } catch {
      error = 'Could not save the change. Your habits and logs are safe. Try again.';
      throw new Error('save failed');
    }
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    addError = habitNameError(draft, all.value) ?? '';
    if (addError) return;
    await save(newHabit(draft, active, crypto.randomUUID())).then(() => (draft = '')).catch(() => {});
  }

  async function rename(habit: Habit, input: HTMLInputElement) {
    const name = input.value.trim();
    if (name === habit.name) return;
    const problem = habitNameError(name, all.value, habit.id);
    renameErrors[habit.id] = problem ?? '';
    if (problem) return;
    await save({ ...habit, name }).catch(() => (input.value = habit.name));
  }

  async function move(index: number, by: number) {
    const { changed } = moveItem(active, index, index + by);
    await save(...changed).catch(() => {});
  }

  function showUndo(label: string, run: () => Promise<void>) {
    clearTimeout(undoTimer);
    undo = { label, run };
    undoTimer = setTimeout(() => (undo = undefined), 6000);
  }

  async function archive(habit: Habit) {
    await save({ ...habit, archived: true })
      .then(() => showUndo(`Archived ${habit.name}`, () => save({ ...habit })))
      .catch(() => {});
  }

  async function restore(habit: Habit) {
    await save(unarchiveHabit(habit, all.value)).catch(() => {});
  }

  async function runUndo() {
    const u = undo;
    undo = undefined;
    clearTimeout(undoTimer);
    await u?.run().catch(() => {});
  }
</script>

<section aria-labelledby="habit-editor-title">
  <h2 id="habit-editor-title">Habits</h2>
  <p class="note">Logs stay when you archive a habit. Restore it any time.</p>

  {#if active.length === 0}
    <p class="empty">No habits yet. Add one below.</p>
  {:else}
    <ul class="group">
      {#each active as habit, i (habit.id)}
        <li>
          <div class="row">
            <input
              aria-label="Name of {habit.name}"
              value={habit.name}
              maxlength={HABIT_NAME_MAX}
              enterkeyhint="done"
              onblur={(e) => rename(habit, e.currentTarget)}
              onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            <button class="icon" aria-label="Move {habit.name} up" disabled={i === 0} onclick={() => move(i, -1)}><ChevronUp size={20} /></button>
            <button class="icon" aria-label="Move {habit.name} down" disabled={i === active.length - 1} onclick={() => move(i, 1)}><ChevronDown size={20} /></button>
            <button class="icon" aria-label="Archive {habit.name}" onclick={() => archive(habit)}><Archive size={20} /></button>
          </div>
          {#if renameErrors[habit.id]}<p class="error" role="alert">{renameErrors[habit.id]}</p>{/if}
        </li>
      {/each}
    </ul>
  {/if}

  <form class="group add" onsubmit={add}>
    <input aria-label="New habit name" placeholder="New habit" bind:value={draft} maxlength={HABIT_NAME_MAX} enterkeyhint="done" />
    <button type="submit" class="text" disabled={!draft.trim()}>Add</button>
  </form>
  {#if addError}<p class="error" role="alert">{addError}</p>{/if}

  {#if archived.length > 0}
    <h3>Archived</h3>
    <ul class="group">
      {#each archived as habit (habit.id)}
        <li class="row">
          <span class="name">{habit.name}</span>
          <button class="text" onclick={() => restore(habit)}>Restore</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if undo}
    <div class="undo" role="status">
      <span>{undo.label}</span>
      <button class="text" onclick={runUndo}>Undo</button>
    </div>
  {/if}
</section>

<style>
  h2 { font-size: 1.25rem; margin: 0 0 4px; }
  h3 { font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.02em; color: var(--text-2); margin: 24px 0 8px; font-weight: 600; }
  .note, .empty { color: var(--text-2); font-size: 0.875rem; margin: 0 0 12px; }
  .group { list-style: none; margin: 0 0 12px; padding: 0; background: var(--surface); border-radius: var(--radius); overflow: hidden; }
  .group > li + li { border-top: 1px solid var(--separator); }
  .row, .add { display: flex; align-items: center; min-height: var(--row-height); padding: 0 4px 0 16px; gap: 4px; }
  input { flex: 1; min-width: 0; min-height: 44px; border: 0; background: none; color: var(--text); font: inherit; font-size: 1rem; }
  .name { flex: 1; }
  .icon { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: none; color: var(--text-2); border-radius: 8px; }
  .icon:disabled { opacity: 0.3; }
  .icon:active:not(:disabled), .text:active { transform: scale(0.96); }
  .text { min-height: 44px; padding: 0 12px; border: 0; background: none; color: var(--accent); font: inherit; }
  .text:disabled { color: var(--text-2); }
  .error { color: var(--danger); font-size: 0.875rem; margin: 4px 16px 8px; }
  .undo {
    position: sticky; bottom: 16px; display: flex; align-items: center; justify-content: space-between;
    margin-top: 16px; padding: 4px 4px 4px 16px; background: var(--text); color: var(--bg); border-radius: var(--radius);
  }
  .undo .text { color: var(--bg); font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { .icon:active, .text:active { transform: none; } }
</style>
