<script lang="ts">
  // Every change saves the whole routine at once; there is no Save button.
  import { api } from '../../db';
  import type { Exercise, Routine } from '../../db/types';
  import { go } from '../../lib/router';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import TextField from '../../components/TextField.svelte';
  import Switch from '../../components/Switch.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { formatLb, todayISO, weekdayName } from '../../components/format';
  import { query } from '../../components/query.svelte';
  import { showError, toasts } from '../../components/toast.svelte';
  import BackHeader from './BackHeader.svelte';
  import ItemsEditor from './ItemsEditor.svelte';

  interface Props { id: string; }
  let { id }: Props = $props();

  const routines = query<Routine[]>(() => api.listRoutines(true), []);
  const exercises = query<Exercise[]>(() => api.listExercises(), []);
  let edits = $state<Routine | undefined>();
  const routine = $derived(edits ?? routines.value.find((r) => r.id === id));

  async function save(patch: Partial<Routine>) {
    if (!routine) return;
    const next = { ...$state.snapshot(routine), ...patch } as Routine;
    if (next.weekday === undefined) delete next.weekday;
    if (next.distanceProgression === undefined) delete next.distanceProgression;
    edits = next;
    try {
      await api.saveRoutine(next);
    } catch (err) {
      showError("Couldn't save the routine.", err);
    }
  }

  async function remove() {
    if (!routine) return;
    const name = routine.name;
    await save({ archived: true });
    go('settings/routines');
    toasts.show(`${name} deleted. Logged workouts keep it.`, {
      undo: async () => {
        await api.saveRoutine({ ...($state.snapshot(routine) as Routine), archived: false });
        go(`settings/routines/${id}`);
      },
    });
  }

  const progression = $derived(routine?.distanceProgression);
  function setProgression(patch: Partial<NonNullable<Routine['distanceProgression']>>) {
    if (progression) save({ distanceProgression: { ...progression, ...patch } });
  }
</script>

<div class="screen">
  <BackHeader href="#/settings/routines" label="Routines" />
  {#if routine}
    <h1 class="title-large">{routine.name}</h1>
    <ListGroup>
      <div class="pad"><TextField label="Name" value={routine.name} oncommit={(v) => v.trim() && save({ name: v.trim() })} /></div>
      <div class="pad">
        <label class="field">
          <span class="footnote">Weekday</span>
          <select value={routine.weekday ?? ''} onchange={(e) => save({ weekday: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })}>
            <option value="">No weekday</option>
            {#each [0, 1, 2, 3, 4, 5, 6] as d (d)}<option value={d}>{weekdayName(d)}</option>{/each}
          </select>
        </label>
      </div>
      <ListRow label="Test routine" detail="For timed or max tests">
        {#snippet trailing()}<Switch label="Test routine" checked={!!routine.isTest} onchange={(v) => save({ isTest: v || undefined })} />{/snippet}
      </ListRow>
    </ListGroup>

    <ItemsEditor items={routine.items} exercises={exercises.value} onchange={(items) => save({ items })} />

    <ListGroup header="Run distance progression" footer="Adds distance every few weeks from the start date, up to the cap.">
      <ListRow label="Progress run distance">
        {#snippet trailing()}
          <Switch
            label="Progress run distance"
            checked={!!progression}
            onchange={(on) => save({ distanceProgression: on ? { startMi: 1, stepMi: 0.25, everyWeeks: 2, fromDate: todayISO(), capMi: 3 } : undefined })}
          />
        {/snippet}
      </ListRow>
      {#if progression}
        <ListRow label="Start">{#snippet trailing()}<Stepper label="Start distance" unit="mi" step={0.25} format={formatLb} value={progression.startMi} onchange={(v) => setProgression({ startMi: v })} />{/snippet}</ListRow>
        <ListRow label="Step">{#snippet trailing()}<Stepper label="Step distance" unit="mi" step={0.05} format={formatLb} value={progression.stepMi} onchange={(v) => setProgression({ stepMi: v })} />{/snippet}</ListRow>
        <ListRow label="Every">{#snippet trailing()}<Stepper label="Every N weeks" unit="wk" min={1} value={progression.everyWeeks} onchange={(v) => setProgression({ everyWeeks: v })} />{/snippet}</ListRow>
        <ListRow label="Cap">{#snippet trailing()}<Stepper label="Distance cap" unit="mi" step={0.25} format={formatLb} value={progression.capMi} onchange={(v) => setProgression({ capMi: v })} />{/snippet}</ListRow>
        <div class="pad"><TextField label="From date" type="date" value={progression.fromDate} oncommit={(v) => v && setProgression({ fromDate: v })} /></div>
      {/if}
    </ListGroup>

    <Button variant="danger" block onclick={remove}>Delete routine</Button>
  {:else if routines.loaded}
    <EmptyState message="This routine no longer exists." actionLabel="Back to routines" onaction={() => go('settings/routines')} />
  {/if}
</div>

<style>
  .pad { padding: 8px var(--space); border-top: 1px solid var(--separator); }
  .pad:first-child { border-top: 0; }
  .field { display: flex; flex-direction: column; gap: 4px; }
</style>
