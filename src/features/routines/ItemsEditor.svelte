<script lang="ts">
  // Editable exercise items, shared by the routine and quick-add editors.
  import ArrowUp from 'lucide-svelte/icons/arrow-up';
  import ArrowDown from 'lucide-svelte/icons/arrow-down';
  import X from 'lucide-svelte/icons/x';
  import Plus from 'lucide-svelte/icons/plus';
  import type { Exercise, RoutineItem } from '../../db/types';
  import ListGroup from '../../components/ListGroup.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Switch from '../../components/Switch.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { toasts } from '../../components/toast.svelte';
  import ExercisePicker from '../log/ExercisePicker.svelte';
  import { move } from './reorder';

  interface Props { items: RoutineItem[]; exercises: Exercise[]; onchange: (items: RoutineItem[]) => void; header?: string; }
  let { items, exercises, onchange, header = 'Exercises' }: Props = $props();
  let picking = $state(false);

  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Unknown exercise';
  const unit = (id: string) => (exercises.find((e) => e.id === id)?.kind === 'hold' ? 'seconds' : 'reps');

  function patch(i: number, p: Partial<RoutineItem>) {
    const next = items.map((it, k) => (k === i ? { ...it, ...p } : it));
    // Drop cleared optional fields instead of storing undefined keys.
    for (const it of next) {
      if (it.repsMax === undefined) delete it.repsMax;
      if (it.superset === undefined) delete it.superset;
    }
    onchange(next);
  }

  function remove(i: number) {
    const before = items;
    onchange(items.filter((_, k) => k !== i));
    toasts.show(`${name(before[i].exerciseId)} removed`, { undo: () => onchange(before) });
  }
</script>

<ListGroup {header}>
  {#each items as item, i (i + item.exerciseId)}
    <div class="item">
      <div class="top">
        <span class="name">{name(item.exerciseId)}</span>
        <button type="button" class="icon" aria-label="Move {name(item.exerciseId)} up" disabled={i === 0} onclick={() => onchange(move(items, i, -1))}><ArrowUp size={18} aria-hidden="true" /></button>
        <button type="button" class="icon" aria-label="Move {name(item.exerciseId)} down" disabled={i === items.length - 1} onclick={() => onchange(move(items, i, 1))}><ArrowDown size={18} aria-hidden="true" /></button>
        <button type="button" class="icon danger" aria-label="Remove {name(item.exerciseId)}" onclick={() => remove(i)}><X size={18} aria-hidden="true" /></button>
      </div>
      <div class="fields">
        <Stepper label="Sets" unit="sets" min={1} max={20} value={item.sets} onchange={(v) => patch(i, { sets: v })} />
        <Stepper label={item.repsMax !== undefined ? `Minimum ${unit(item.exerciseId)}` : unit(item.exerciseId)} unit={item.repsMax !== undefined ? 'min' : unit(item.exerciseId)} min={1} max={600} value={item.reps} onchange={(v) => patch(i, { reps: v })} />
        {#if item.repsMax !== undefined}
          <Stepper label="Maximum reps" unit="max" min={item.reps} max={600} value={item.repsMax} onchange={(v) => patch(i, { repsMax: v })} />
        {/if}
      </div>
      <div class="fields">
        <label class="inline">
          <Switch label="Rep range" checked={item.repsMax !== undefined} onchange={(on) => patch(i, { repsMax: on ? item.reps + 2 : undefined })} />
          <span>Rep range</span>
        </label>
        <div class="superset">
          <SegmentedControl
            label="Superset"
            value={item.superset ?? 'none'}
            options={[{ value: 'none', label: 'Solo' }, { value: 'a', label: 'Superset A' }, { value: 'b', label: 'Superset B' }]}
            onchange={(v) => patch(i, { superset: v === 'none' ? undefined : (v as 'a' | 'b') })}
          />
        </div>
      </div>
    </div>
  {:else}
    <EmptyState message="No exercises yet. Add the first one." />
  {/each}
  <div class="add"><Button variant="plain" onclick={() => (picking = true)}><Plus size={18} aria-hidden="true" /> Add exercise</Button></div>
</ListGroup>

{#if picking}
  <ExercisePicker
    title="Add exercise"
    {exercises}
    onclose={() => (picking = false)}
    onpick={(id) => {
      picking = false;
      onchange([...items, { exerciseId: id, sets: 3, reps: 5 }]);
    }}
  />
{/if}

<style>
  .item { padding: 8px var(--space) 12px; border-top: 1px solid var(--separator); }
  .item:first-child { border-top: 0; }
  .top { display: flex; align-items: center; }
  .name { flex: 1; font-weight: 600; }
  .icon { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: none; color: var(--accent); cursor: pointer; }
  .icon:disabled { color: var(--text-2); opacity: 0.4; }
  .icon.danger { color: var(--danger); }
  .fields { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; align-items: center; }
  .inline { display: flex; align-items: center; gap: 8px; font-size: 0.9375rem; }
  .superset { flex: 1; min-width: 200px; }
  .add { border-top: 1px solid var(--separator); padding: 0 4px; }
</style>
