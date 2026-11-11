<script lang="ts">
  import { api } from '../../db';
  import type { Exercise, Settings } from '../../db/types';
  import { go } from '../../lib/router';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import Switch from '../../components/Switch.svelte';
  import Button from '../../components/Button.svelte';
  import Banner from '../../components/Banner.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { query } from '../../components/query.svelte';
  import { showError } from '../../components/toasts.svelte';
  import BackHeader from '../routines/BackHeader.svelte';

  const exercises = query<Exercise[]>(() => api.listExercises(), []);
  const settings = query<Settings | undefined>(() => api.getSettings(), undefined);
  let overrides = $state<Record<string, boolean>>({});
  const sorted = $derived([...exercises.value].sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name)));

  async function setAuto(e: Exercise, on: boolean) {
    overrides[e.id] = on;
    try {
      await api.saveExercise({ ...e, autoIncrease: on });
    } catch (err) {
      delete overrides[e.id];
      showError(`Couldn't change auto-increase for ${e.name}.`, err);
    }
  }

  async function create() {
    const e: Exercise = { id: crypto.randomUUID(), name: 'New exercise', kind: 'barbell', incrementLb: 5, roundToLb: 5, autoIncrease: true, isMain: false, archived: false };
    try {
      await api.saveExercise(e);
      go(`settings/exercises/${e.id}`);
    } catch (err) {
      showError("Couldn't create the exercise.", err);
    }
  }
</script>

<div class="screen">
  <BackHeader href="#/settings" label="Settings" />
  <h1 class="title-large">Exercises</h1>
  {#if exercises.error}<Banner tone="danger" title="Couldn't load exercises" message="Nothing was lost. Try again in a moment. ({exercises.error})" />{/if}
  {#if settings.value && !settings.value.autoIncreaseGlobal}
    <Banner title="Auto-increase is off for everything" message="Turn it on in Settings to use these switches." />
  {/if}
  {#if sorted.length}
    <ListGroup header="Auto-increase per exercise" footer="Tap a name to edit it. Main lifts get a trophy.">
      {#each sorted as e (e.id)}
        <div class="ex-row">
          <div class="grow"><ListRow label={e.name} detail="{e.kind}{e.isMain ? ' · main lift' : ''} · +{e.incrementLb} lb" href="#/settings/exercises/{e.id}" /></div>
          <Switch label="Auto-increase {e.name}" checked={overrides[e.id] ?? e.autoIncrease} onchange={(on) => setAuto(e, on)} />
        </div>
      {/each}
    </ListGroup>
  {:else if exercises.loaded}
    <EmptyState message="No exercises yet. Add the first one." />
  {/if}
  <Button variant="primary" block onclick={create}>New exercise</Button>
</div>

<style>
  .ex-row { display: flex; align-items: center; padding-right: var(--space); border-top: 1px solid var(--separator); }
  .ex-row :global(.row) { border-top: 0; }
  .grow { flex: 1; min-width: 0; }
</style>
