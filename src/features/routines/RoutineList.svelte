<script lang="ts">
  import ArrowUp from 'lucide-svelte/icons/arrow-up';
  import ArrowDown from 'lucide-svelte/icons/arrow-down';
  import { api } from '../../db';
  import type { Routine } from '../../db/types';
  import { go } from '../../lib/router';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import Button from '../../components/Button.svelte';
  import Banner from '../../components/Banner.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { weekdayName } from '../../components/format';
  import { query } from '../../components/query.svelte';
  import { showError } from '../../components/toast.svelte';
  import BackHeader from './BackHeader.svelte';
  import { move, nextOrder, renumber } from './reorder';

  const routines = query<Routine[]>(() => api.listRoutines(), []);
  let local = $state<Routine[] | undefined>();
  const list = $derived(local ?? [...routines.value].sort((a, b) => a.order - b.order));

  async function reorder(i: number, dir: -1 | 1) {
    const next = move(list, i, dir);
    local = next.map((r, k) => ({ ...r, order: k }));
    try {
      for (const r of renumber(next)) await api.saveRoutine(r);
    } catch (err) {
      showError("Couldn't reorder routines.", err);
    }
    local = undefined;
  }

  async function create() {
    const routine: Routine = { id: crypto.randomUUID(), name: 'New routine', order: nextOrder(routines.value), archived: false, items: [] };
    try {
      await api.saveRoutine(routine);
      go(`settings/routines/${routine.id}`);
    } catch (err) {
      showError("Couldn't create the routine.", err);
    }
  }

  const detail = (r: Routine) =>
    [r.weekday !== undefined ? weekdayName(r.weekday) : 'No weekday', `${r.items.length} exercise${r.items.length === 1 ? '' : 's'}`, r.isTest ? 'Test' : '']
      .filter(Boolean)
      .join(' · ');
</script>

<div class="screen">
  <BackHeader href="#/settings" label="Settings" />
  <h1 class="title-large">Routines</h1>
  {#if routines.error}<Banner tone="danger" title="Couldn't load routines" message="Nothing was lost. Try again in a moment. ({routines.error})" />{/if}
  {#if list.length}
    <ListGroup footer="A routine with a weekday is offered on Home that day.">
      {#each list as r, i (r.id)}
        <div class="reorder-row">
          <div class="grow"><ListRow label={r.name} detail={detail(r)} href="#/settings/routines/{r.id}" /></div>
          <span class="order">
            <button type="button" aria-label="Move {r.name} up" disabled={i === 0} onclick={() => reorder(i, -1)}><ArrowUp size={18} aria-hidden="true" /></button>
            <button type="button" aria-label="Move {r.name} down" disabled={i === list.length - 1} onclick={() => reorder(i, 1)}><ArrowDown size={18} aria-hidden="true" /></button>
          </span>
        </div>
      {/each}
    </ListGroup>
  {:else if routines.loaded}
    <EmptyState message="No routines yet. Create one to pre-fill your logs." />
  {/if}
  <Button variant="primary" block onclick={create}>New routine</Button>
</div>

<style>
  .reorder-row { display: flex; align-items: center; border-top: 1px solid var(--separator); }
  .reorder-row :global(.row) { border-top: 0; }
  .grow { flex: 1; min-width: 0; }
  .order { display: flex; padding-right: 4px; }
  .order button { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: none; color: var(--accent); cursor: pointer; }
  .order button:disabled { color: var(--text-2); opacity: 0.4; }
</style>
