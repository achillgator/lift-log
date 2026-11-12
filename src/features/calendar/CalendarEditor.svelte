<!-- Settings → Calendar (v2): phases, test days, deload weeks and repeating routine swaps as editable rows. -->
<script lang="ts">
  import Plus from 'lucide-svelte/icons/plus';
  import { api, type CalendarEntry } from '../../db';
  import { live } from '../../db/live.svelte';
  import { calendarEntryErrors, describeEntry, newCalendarEntry, sortEntries } from '../../lib/later/calendar';
  import { todayLocal } from '../../lib/later/dates';

  let { today = todayLocal() }: { today?: string } = $props();

  const entries = live(() => api.listCalendar(), []);
  const routines = live(() => api.listRoutines(), []);
  const settings = live(() => api.getSettings(), undefined);
  const defaultPct = $derived(settings.value?.rules.deloadPct ?? 10);

  const SECTIONS: { type: CalendarEntry['type']; title: string; add: string; empty: string }[] = [
    { type: 'phase', title: 'Phases', add: 'Add phase', empty: 'Name a block of weeks to see it on Home.' },
    { type: 'test', title: 'Test days', add: 'Add test day', empty: 'Mark a day to test your maxes.' },
    { type: 'deload', title: 'Deload weeks', add: 'Add deload', empty: 'Plan a lighter week with fewer sets.' },
    { type: 'swap', title: 'Routine swaps', add: 'Add swap', empty: 'Swap in a routine every few weeks.' },
  ];
  // Every end date is optional; see the row meanings in src/lib/later/calendar.ts.
  const LABELS: Record<CalendarEntry['type'], { start: string; end: string }> = {
    phase: { start: 'Starts', end: 'Ends' },
    test: { start: 'Date', end: 'Last day' },
    deload: { start: 'Starts', end: 'Ends' },
    swap: { start: 'First day', end: 'Last day' },
  };

  let draft = $state<CalendarEntry | undefined>();
  let isNew = $state(false);
  let repeat = $state(false);
  let errors = $state<string[]>([]);
  let failure = $state('');
  let undo = $state<{ label: string; run: () => Promise<void> } | undefined>();
  let undoTimer: ReturnType<typeof setTimeout> | undefined;

  const sorted = $derived(sortEntries(entries.value));

  function open(entry: CalendarEntry, fresh: boolean) {
    draft = { ...$state.snapshot(entry) } as CalendarEntry;
    isNew = fresh;
    repeat = entry.type === 'deload' && !!entry.everyWeeks;
    errors = [];
    failure = '';
  }

  function add(type: CalendarEntry['type']) {
    open(newCalendarEntry(type, today, crypto.randomUUID(), defaultPct), true);
  }

  const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));

  function cleaned(d: CalendarEntry): CalendarEntry {
    const out: CalendarEntry = { id: d.id, type: d.type, name: d.name.trim(), startDate: d.startDate };
    if (d.endDate) out.endDate = d.endDate;
    if (d.routineId) out.routineId = d.routineId;
    if (d.type === 'deload') {
      out.pct = num(d.pct);
      out.fewerSets = num(d.fewerSets);
      if (repeat) out.everyWeeks = num(d.everyWeeks) ?? 4;
    }
    if (d.type === 'swap') out.everyWeeks = num(d.everyWeeks) ?? 1;
    return out;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!draft) return;
    const row = cleaned(draft);
    errors = calendarEntryErrors(row, routines.value);
    if (errors.length) return;
    try {
      await api.saveCalendarEntry(row);
      draft = undefined;
    } catch {
      failure = 'Could not save this row. Nothing else changed. Try again.';
    }
  }

  async function remove() {
    if (!draft || isNew) return void (draft = undefined);
    const original = $state.snapshot(entries.value.find((e) => e.id === draft!.id)) as CalendarEntry | undefined;
    try {
      await api.deleteCalendarEntry(draft.id);
    } catch {
      failure = 'Could not delete this row. It is still saved. Try again.';
      return;
    }
    draft = undefined;
    if (original) {
      clearTimeout(undoTimer);
      undo = { label: `Deleted ${original.name || 'row'}`, run: () => api.saveCalendarEntry(original) };
      undoTimer = setTimeout(() => (undo = undefined), 6000);
    }
  }

  async function runUndo() {
    const u = undo;
    undo = undefined;
    clearTimeout(undoTimer);
    await u?.run().catch(() => (failure = 'Could not restore the row. Add it again.'));
  }
</script>

<section aria-labelledby="calendar-title">
  <h2 id="calendar-title">Calendar</h2>
  <p class="note">Rows here change what Home plans for each day. Logged workouts never change.</p>

  {#each SECTIONS as section (section.type)}
    {@const rows = sorted.filter((e) => e.type === section.type)}
    <h3>{section.title}</h3>
    <ul class="group">
      {#each rows as row (row.id)}
        <li>
          <button class="row" aria-expanded={draft?.id === row.id} onclick={() => open(row, false)}>
            <span class="name">{row.name || 'Untitled'}</span>
            <span class="sub num">{describeEntry(row, routines.value)}</span>
          </button>
        </li>
      {:else}
        <li class="empty">{section.empty}</li>
      {/each}
      <li>
        <button class="row add" onclick={() => add(section.type)}><Plus size={18} aria-hidden="true" /> {section.add}</button>
      </li>
    </ul>

    {#if draft && draft.type === section.type}
      {@const labels = LABELS[draft.type]}
      <form class="group form" novalidate onsubmit={save} aria-label="{isNew ? 'New' : 'Edit'} {section.title.toLowerCase()}">
        <label><span>Name</span><input bind:value={draft.name} placeholder={draft.type === 'phase' ? 'Base block' : 'Name'} maxlength="40" /></label>
        <label><span>{labels.start}</span><input type="date" bind:value={draft.startDate} /></label>
        <label>
          <span>{labels.end} (optional)</span>
          <input type="date" bind:value={draft.endDate} min={draft.startDate} />
        </label>

        {#if draft.type === 'test'}
          <label>
            <span>Routine</span>
            <select bind:value={draft.routineId}>
              <option value={undefined}>Keep the planned routine</option>
              {#each routines.value as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
            </select>
          </label>
        {/if}

        {#if draft.type === 'deload'}
          <label><span>Percent lighter</span><input type="number" inputmode="decimal" min="1" max="50" bind:value={draft.pct} /></label>
          <label>
            <span>Fewer sets</span>
            <select bind:value={draft.fewerSets}>
              {#each [0, 1, 2, 3] as n}<option value={n}>{n}</option>{/each}
            </select>
          </label>
          <label class="check"><input type="checkbox" bind:checked={repeat} /><span>Repeat every few weeks</span></label>
          {#if repeat}
            <label><span>Every (weeks)</span><input type="number" inputmode="numeric" min="1" max="52" bind:value={draft.everyWeeks} placeholder="4" /></label>
          {/if}
        {/if}

        {#if draft.type === 'swap'}
          <label>
            <span>Routine to swap in</span>
            <select bind:value={draft.routineId}>
              <option value={undefined} disabled>Pick a routine</option>
              {#each routines.value as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
            </select>
          </label>
          <label><span>Every (weeks)</span><input type="number" inputmode="numeric" min="1" max="52" bind:value={draft.everyWeeks} /></label>
        {/if}

        {#if errors.length}
          <ul class="errors" role="alert">{#each errors as e}<li>{e}</li>{/each}</ul>
        {/if}
        <div class="actions">
          <button type="button" class="text danger" onclick={remove}>{isNew ? 'Cancel' : 'Delete'}</button>
          {#if !isNew}<button type="button" class="text" onclick={() => (draft = undefined)}>Close</button>{/if}
          <button type="submit" class="primary">Save</button>
        </div>
      </form>
    {/if}
  {/each}

  {#if failure}<p class="error" role="alert">{failure}</p>{/if}
  {#if undo}
    <div class="undo" role="status"><span>{undo.label}</span><button class="text" onclick={runUndo}>Undo</button></div>
  {/if}
</section>

<style>
  h2 { font-size: 1.25rem; margin: 0 0 4px; }
  h3 { font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.02em; color: var(--text-2); margin: 24px 0 8px 16px; font-weight: 600; }
  .note { color: var(--text-2); font-size: 0.875rem; margin: 0; }
  .group { list-style: none; margin: 0; padding: 0; background: var(--surface); border-radius: var(--radius); overflow: hidden; }
  .group > li + li { border-top: 1px solid var(--separator); }
  .row {
    display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; width: 100%;
    min-height: var(--row-height); padding: 8px 16px; border: 0; background: none; color: var(--text); font: inherit; text-align: left;
  }
  .row:active { background: var(--surface-2); }
  .row.add { flex-direction: row; align-items: center; gap: 6px; color: var(--accent); }
  .name { font-weight: 600; }
  .sub { font-size: 0.8125rem; color: var(--text-2); }
  .empty { padding: 12px 16px; color: var(--text-2); font-size: 0.875rem; }
  .form { margin-top: 8px; padding: 4px 0; }
  .form label { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 0 16px; }
  .form label + label { border-top: 1px solid var(--separator); }
  .form label span { flex: none; }
  .form input:not([type='checkbox']), .form select {
    min-width: 0; flex: 1; text-align: right; border: 0; background: none; color: var(--text); font: inherit; font-size: 1rem; min-height: 44px;
  }
  .check { justify-content: flex-start !important; }
  .check input { width: 22px; height: 22px; accent-color: var(--accent); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--separator); }
  .text { min-height: 44px; padding: 0 12px; border: 0; background: none; color: var(--accent); font: inherit; }
  .text.danger { color: var(--danger); margin-right: auto; }
  .primary { min-height: 44px; padding: 0 20px; border: 0; border-radius: 10px; background: var(--accent); color: var(--surface); font: inherit; font-weight: 600; }
  .primary:active, .text:active { transform: scale(0.97); }
  .errors { color: var(--danger); font-size: 0.875rem; margin: 4px 16px; padding-left: 18px; }
  .error { color: var(--danger); font-size: 0.875rem; }
  .undo {
    position: sticky; bottom: 16px; display: flex; align-items: center; justify-content: space-between;
    margin-top: 16px; padding: 4px 4px 4px 16px; background: var(--text); color: var(--bg); border-radius: var(--radius);
  }
  .undo .text { color: var(--bg); font-weight: 600; }
  .num { font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: reduce) { .primary:active, .text:active { transform: none; } }
</style>
