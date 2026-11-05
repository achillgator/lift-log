<script lang="ts">
  // Tested maxes: real 1RM attempts, added and removed by hand.
  import X from 'lucide-svelte/icons/x';
  import { api } from '../../db';
  import type { Exercise, Max } from '../../db/types';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import Button from '../../components/Button.svelte';
  import Banner from '../../components/Banner.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Sheet from '../../components/Sheet.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Switch from '../../components/Switch.svelte';
  import TextField from '../../components/TextField.svelte';
  import { formatDate, formatLb, todayISO } from '../../components/format';
  import { query } from '../../components/query.svelte';
  import { showError, toasts } from '../../components/toast.svelte';
  import BackHeader from '../routines/BackHeader.svelte';

  const maxes = query<Max[]>(() => api.listMaxes(), []);
  const exercises = query<Exercise[]>(() => api.listExercises(true), []);
  let hidden = $state<string[]>([]);
  let adding = $state<Max | undefined>();

  const shown = $derived([...maxes.value].filter((m) => !hidden.includes(m.id)).sort((a, b) => b.date.localeCompare(a.date)));
  const name = (id: string) => exercises.value.find((e) => e.id === id)?.name ?? 'Unknown exercise';

  function startAdd() {
    const first = exercises.value.find((e) => e.isMain && !e.archived) ?? exercises.value.find((e) => !e.archived);
    if (!first) {
      toasts.show('Add an exercise first, in Settings → Exercises.');
      return;
    }
    adding = { id: crypto.randomUUID(), exerciseId: first.id, date: todayISO(), weightLb: 100, tested: true };
  }

  async function saveNew() {
    if (!adding) return;
    try {
      await api.saveMax($state.snapshot(adding) as Max);
      adding = undefined;
    } catch (err) {
      showError("Couldn't save the max.", err);
    }
  }

  async function remove(m: Max) {
    hidden = [...hidden, m.id];
    try {
      await api.deleteMax(m.id);
      toasts.show(`${name(m.exerciseId)} max removed`, {
        undo: async () => {
          await api.saveMax(m);
          hidden = hidden.filter((h) => h !== m.id);
        },
      });
    } catch (err) {
      hidden = hidden.filter((h) => h !== m.id);
      showError("Couldn't remove the max.", err);
    }
  }
</script>

<div class="screen">
  <BackHeader href="#/settings" label="Settings" />
  <h1 class="title-large">Tested maxes</h1>
  {#if maxes.error}<Banner tone="danger" title="Couldn't load maxes" message="Nothing was lost. Try again in a moment. ({maxes.error})" />{/if}
  {#if shown.length}
    <ListGroup>
      {#each shown as m (m.id)}
        <div class="max-row">
          <div class="grow"><ListRow label={name(m.exerciseId)} detail="{formatDate(m.date)}{m.tested ? ' · tested' : ' · estimated'}" value="{formatLb(m.weightLb)} lb" /></div>
          <button type="button" class="icon" aria-label="Remove {name(m.exerciseId)} max from {formatDate(m.date)}" onclick={() => remove(m)}><X size={18} aria-hidden="true" /></button>
        </div>
      {/each}
    </ListGroup>
  {:else if maxes.loaded}
    <EmptyState message="No maxes yet. Add one after a 1RM test." />
  {/if}
  <Button variant="primary" block onclick={startAdd}>Add max</Button>
</div>

{#if adding}
  <Sheet title="Add max" onclose={() => (adding = undefined)}>
    {#snippet trailing()}<Button size="small" variant="primary" onclick={saveNew}>Save</Button>{/snippet}
    <ListGroup>
      <div class="pad">
        <label class="field">
          <span class="footnote">Exercise</span>
          <select bind:value={adding.exerciseId}>
            {#each exercises.value.filter((e) => !e.archived) as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
          </select>
        </label>
      </div>
      <div class="pad"><TextField label="Date" type="date" bind:value={adding.date} /></div>
      <ListRow label="Weight">{#snippet trailing()}<Stepper label="Max weight" unit="lb" step={5} format={formatLb} bind:value={adding.weightLb} />{/snippet}</ListRow>
      <ListRow label="Tested" detail="A real 1RM attempt">{#snippet trailing()}<Switch label="Tested" bind:checked={adding.tested} />{/snippet}</ListRow>
    </ListGroup>
  </Sheet>
{/if}

<style>
  .max-row { display: flex; align-items: center; border-top: 1px solid var(--separator); }
  .max-row :global(.row) { border-top: 0; }
  .grow { flex: 1; min-width: 0; }
  .icon { width: 44px; height: 44px; margin-right: 4px; display: grid; place-items: center; border: 0; background: none; color: var(--danger); cursor: pointer; }
  .pad { padding: 8px var(--space); border-top: 1px solid var(--separator); }
  .pad:first-child { border-top: 0; }
  .field { display: flex; flex-direction: column; gap: 4px; }
</style>
