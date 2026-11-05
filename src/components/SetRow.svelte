<script lang="ts">
  import Check from 'lucide-svelte/icons/check';
  import Ellipsis from 'lucide-svelte/icons/ellipsis';
  import type { ExerciseKind, LoggedSet } from '../db/types';
  import Button from './Button.svelte';
  import Stepper from './Stepper.svelte';
  import { formatClock, formatLb, metersToMiles, milesToMeters, parseClock } from './format';
  import { doneAsPlanned, setState, setSummary, toggleSet, typoGuard } from './setrow';

  interface Props {
    set: LoggedSet;
    kind?: ExerciseKind;
    /** Weight stepper step in lb (the exercise's rounding). */
    weightStep?: number;
    /** Start with the editor open (kitchen sink, tests). */
    expanded?: boolean;
    onchange?: (next: LoggedSet) => void;
    onskip?: () => void;
    onremove?: () => void;
  }
  let { set, kind = 'barbell', weightStep = 5, expanded = false, onchange, onskip, onremove }: Props = $props();

  // svelte-ignore state_referenced_locally
  let open = $state(expanded);
  let keptWeight = $state<number | undefined>();

  const state = $derived(setState(set, kind));
  const summary = $derived(setSummary(set, kind));
  const weighted = $derived(kind === 'barbell' || kind === 'dumbbell');
  const suggestion = $derived(weighted && !set.skipped && set.weightLb !== keptWeight ? typoGuard(set.weightLb, set.targetWeightLb, weightStep) : undefined);
  const stateLabel = { planned: 'Planned', done: 'Done', edited: 'Done, edited', skipped: 'Skipped' } as const;

  // Changing a value means the set happened with that value, so it becomes done.
  function patch(p: Partial<LoggedSet>) {
    onchange?.({ ...doneAsPlanned(set, kind), ...p });
  }
</script>

<div class="setrow {state}">
  <div class="main">
    <button
      type="button"
      class="toggle"
      aria-pressed={set.done}
      aria-label="Set {set.setNo}: {summary}. {stateLabel[state]}. Tap to {set.done ? 'mark not done' : 'mark done as planned'}."
      onclick={() => onchange?.(toggleSet(set, kind))}
    >
      <span class="check" aria-hidden="true">
        {#if set.done}<Check size={18} strokeWidth={3} />{:else}{set.setNo}{/if}
      </span>
      <span class="summary num">{summary}</span>
      {#if state === 'edited'}<span class="tag">Edited</span>{/if}
      {#if state === 'skipped'}<span class="tag">Skipped</span>{/if}
    </button>
    <button type="button" class="more" aria-expanded={open} aria-label="Edit set {set.setNo}" onclick={() => (open = !open)}>
      <Ellipsis size={20} aria-hidden="true" />
    </button>
  </div>

  {#if suggestion !== undefined}
    <div class="guard" role="status">
      <span>Did you mean {formatLb(suggestion)} lb?</span>
      <Button size="small" variant="plain" onclick={() => patch({ weightLb: suggestion })}>Use {formatLb(suggestion)}</Button>
      <Button size="small" variant="plain" onclick={() => (keptWeight = set.weightLb)}>Keep</Button>
    </div>
  {/if}

  {#if open}
    <div class="editor">
      {#if kind === 'barbell' || kind === 'dumbbell'}
        <Stepper label="Weight" unit="lb" step={weightStep} value={set.weightLb} placeholder={set.targetWeightLb} format={formatLb} onchange={(v) => patch({ weightLb: v })} />
        <Stepper label="Reps" step={1} value={set.reps} placeholder={set.targetReps} onchange={(v) => patch({ reps: v })} />
      {:else if kind === 'bodyweight'}
        <Stepper label="Reps" step={1} value={set.reps} placeholder={set.targetReps} onchange={(v) => patch({ reps: v })} />
        {#if set.strictReps !== undefined}
          <Stepper label="Strict reps" step={1} value={set.strictReps} onchange={(v) => patch({ strictReps: v })} />
        {/if}
        <Stepper label="Added weight" unit="lb" step={weightStep} value={set.weightLb} placeholder={0} format={formatLb} onchange={(v) => patch({ weightLb: v })} />
      {:else if kind === 'hold'}
        <Stepper label="Seconds" unit="s" step={5} value={set.holdSec} placeholder={set.targetReps} onchange={(v) => patch({ holdSec: v })} />
      {:else if kind === 'run'}
        <Stepper label="Distance" unit="mi" step={0.1} value={metersToMiles(set.distanceM)} onchange={(v) => patch({ distanceM: milesToMeters(v) })} />
        <Stepper label="Time" step={5} value={set.timeSec} format={formatClock} parse={parseClock} onchange={(v) => patch({ timeSec: v })} />
      {/if}
      <div class="actions">
        {#if onskip}
          <Button size="small" variant="plain" onclick={onskip}>{set.skipped ? 'Unskip' : 'Skip set'}</Button>
        {/if}
        {#if onremove}
          <Button size="small" variant="danger" onclick={onremove}>Remove set</Button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .setrow { border-top: 1px solid var(--separator); }
  .main { display: flex; align-items: center; min-height: var(--row-height); }
  .toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: var(--row-height);
    padding: 0 0 0 var(--space);
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .check {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-2);
    border: 2px solid var(--separator);
    transition: background calc(var(--motion, 250ms) * 0.3), border-color calc(var(--motion, 250ms) * 0.3);
  }
  .toggle:active .check { transform: scale(0.9); }
  .summary { flex: 1; font-family: var(--font-num, inherit); font-weight: 600; }
  .planned .summary { color: var(--text-2); font-weight: 400; }
  .done .check, .edited .check { background: var(--accent); border-color: var(--accent); color: var(--bg); }
  .skipped .summary { text-decoration: line-through; color: var(--text-2); font-weight: 400; }
  .skipped .check { border-style: dashed; }
  .tag { font-size: 0.75rem; color: var(--text-2); padding-right: 4px; }
  .edited .tag { color: var(--accent); }
  .more {
    flex: none;
    width: 44px;
    height: 44px;
    margin-right: 4px;
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--text-2);
    border-radius: var(--radius);
    cursor: pointer;
  }
  .guard {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    padding: 0 var(--space) 8px calc(var(--space) + 40px);
    color: var(--danger);
    font-size: 0.9375rem;
  }
  .editor {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 var(--space) 12px calc(var(--space) + 40px);
  }
  .actions { display: flex; gap: 4px; width: 100%; }
</style>
