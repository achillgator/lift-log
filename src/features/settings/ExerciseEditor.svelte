<script lang="ts">
  import { api } from '../../db';
  import type { Exercise, ExerciseKind, Routine } from '../../db/types';
  import { go } from '../../lib/router';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import TextField from '../../components/TextField.svelte';
  import Switch from '../../components/Switch.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { formatLb } from '../../components/format';
  import { query } from '../../components/query.svelte';
  import { showError, toasts } from '../../components/toast.svelte';
  import BackHeader from '../routines/BackHeader.svelte';

  interface Props { id: string; }
  let { id }: Props = $props();

  const exercises = query<Exercise[]>(() => api.listExercises(true), []);
  const routines = query<Routine[]>(() => api.listRoutines(), []);
  let edits = $state<Exercise | undefined>();
  const exercise = $derived(edits ?? exercises.value.find((e) => e.id === id));
  const kinds: ExerciseKind[] = ['barbell', 'dumbbell', 'bodyweight', 'hold', 'run', 'checklist'];

  async function save(patch: Partial<Exercise>) {
    if (!exercise) return;
    const next = { ...$state.snapshot(exercise), ...patch } as Exercise;
    for (const k of ['repMin', 'repMax', 'derivedFrom'] as const) if (next[k] === undefined) delete next[k];
    edits = next;
    try {
      await api.saveExercise(next);
    } catch (err) {
      showError("Couldn't save the exercise.", err);
    }
  }

  async function archive() {
    if (!exercise) return;
    const name = exercise.name;
    await save({ archived: true });
    go('settings/exercises');
    toasts.show(`${name} archived. Its history is kept.`, {
      undo: async () => {
        await api.saveExercise({ ...($state.snapshot(exercise) as Exercise), archived: false });
        go(`settings/exercises/${id}`);
      },
    });
  }

  const derived = $derived(exercise?.derivedFrom);
</script>

<div class="screen">
  <BackHeader href="#/settings/exercises" label="Exercises" />
  {#if exercise}
    <h1 class="title-large">{exercise.name}</h1>
    {#if exercise.archived}<p class="footnote">Archived. <button type="button" class="link" onclick={() => save({ archived: false })}>Restore</button></p>{/if}
    <ListGroup>
      <div class="pad"><TextField label="Name" value={exercise.name} oncommit={(v) => v.trim() && save({ name: v.trim() })} /></div>
      <div class="pad">
        <label class="field">
          <span class="footnote">Kind</span>
          <select value={exercise.kind} onchange={(e) => save({ kind: e.currentTarget.value as ExerciseKind })}>
            {#each kinds as k (k)}<option value={k}>{k}</option>{/each}
          </select>
        </label>
      </div>
      <ListRow label="Main lift" detail="Gets a trophy on Home">
        {#snippet trailing()}<Switch label="Main lift" checked={exercise.isMain} onchange={(v) => save({ isMain: v })} />{/snippet}
      </ListRow>
    </ListGroup>

    <ListGroup header="Progression" footer="When on, the next target goes up by the increment after every set hits its reps (and effort was 8 or less).">
      <ListRow label="Auto-increase">
        {#snippet trailing()}<Switch label="Auto-increase" checked={exercise.autoIncrease} onchange={(v) => save({ autoIncrease: v })} />{/snippet}
      </ListRow>
      <ListRow label="Increment">
        {#snippet trailing()}<Stepper label="Increment" unit="lb" step={2.5} min={0} format={formatLb} value={exercise.incrementLb} onchange={(v) => save({ incrementLb: v })} />{/snippet}
      </ListRow>
      <ListRow label="Round to">
        {#snippet trailing()}<Stepper label="Round to" unit="lb" step={2.5} min={0} format={formatLb} value={exercise.roundToLb} onchange={(v) => save({ roundToLb: v })} />{/snippet}
      </ListRow>
      <ListRow label="Rep range" detail="Add reps up to the top, then weight">
        {#snippet trailing()}
          <Switch label="Rep range" checked={exercise.repMin !== undefined} onchange={(on) => save(on ? { repMin: 8, repMax: 12 } : { repMin: undefined, repMax: undefined })} />
        {/snippet}
      </ListRow>
      {#if exercise.repMin !== undefined}
        <ListRow label="From">{#snippet trailing()}<Stepper label="Minimum reps" min={1} value={exercise.repMin} onchange={(v) => save({ repMin: v })} />{/snippet}</ListRow>
        <ListRow label="To">{#snippet trailing()}<Stepper label="Maximum reps" min={exercise.repMin ?? 1} value={exercise.repMax} onchange={(v) => save({ repMax: v })} />{/snippet}</ListRow>
      {/if}
    </ListGroup>

    <ListGroup header="Derived weight" footer="A percent of another exercise's latest weight in a routine, rounded.">
      <ListRow label="Follow another lift">
        {#snippet trailing()}
          <Switch
            label="Follow another lift"
            checked={!!derived}
            onchange={(on) => {
              const source = exercises.value.find((e) => e.id !== id && !e.archived);
              save({ derivedFrom: on && source ? { exerciseId: source.id, routineId: routines.value[0]?.id ?? '', pct: 80 } : undefined });
            }}
          />
        {/snippet}
      </ListRow>
      {#if derived}
        <div class="pad">
          <label class="field">
            <span class="footnote">Source exercise</span>
            <select value={derived.exerciseId} onchange={(e) => save({ derivedFrom: { ...derived, exerciseId: e.currentTarget.value } })}>
              {#each exercises.value.filter((e) => e.id !== id && !e.archived) as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
            </select>
          </label>
        </div>
        <div class="pad">
          <label class="field">
            <span class="footnote">Source routine</span>
            <select value={derived.routineId} onchange={(e) => save({ derivedFrom: { ...derived, routineId: e.currentTarget.value } })}>
              {#each routines.value as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
            </select>
          </label>
        </div>
        <ListRow label="Percent">
          {#snippet trailing()}<Stepper label="Percent of source" unit="%" step={5} min={5} max={200} value={derived.pct} onchange={(v) => save({ derivedFrom: { ...derived, pct: v } })} />{/snippet}
        </ListRow>
      {/if}
    </ListGroup>

    {#if !exercise.archived}<Button variant="danger" block onclick={archive}>Archive exercise</Button>{/if}
  {:else if exercises.loaded}
    <EmptyState message="This exercise no longer exists." actionLabel="Back to exercises" onaction={() => go('settings/exercises')} />
  {/if}
</div>

<style>
  .pad { padding: 8px var(--space); border-top: 1px solid var(--separator); }
  .pad:first-child { border-top: 0; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .link { min-height: 44px; border: 0; background: none; color: var(--accent); font: inherit; cursor: pointer; }
</style>
