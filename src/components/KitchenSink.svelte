<script lang="ts">
  // #/kitchen-sink: every primitive in every state, with made-up data. Reached from Settings → Components.
  import type { LoggedSet } from '../db/types';
  import Banner from './Banner.svelte';
  import Button from './Button.svelte';
  import EmptyState from './EmptyState.svelte';
  import ListGroup from './ListGroup.svelte';
  import ListRow from './ListRow.svelte';
  import SegmentedControl from './SegmentedControl.svelte';
  import SetRow from './SetRow.svelte';
  import Sheet from './Sheet.svelte';
  import Stepper from './Stepper.svelte';
  import Switch from './Switch.svelte';
  import TabBar from './TabBar.svelte';
  import TextField from './TextField.svelte';
  import Toast from './Toast.svelte';
  import TweaksPanel from './TweaksPanel.svelte';
  import { toasts } from './toasts.svelte';
  import House from 'lucide-svelte/icons/house';
  import ChartLine from 'lucide-svelte/icons/chart-line';
  import History from 'lucide-svelte/icons/history';
  import Settings from 'lucide-svelte/icons/settings';

  // Made-up sample sets (CLAUDE.md rule 11).
  const base: LoggedSet = { id: 'k', sessionId: 'demo', exerciseId: 'demo', order: 0, setNo: 1, targetWeightLb: 95, targetReps: 8, done: false, skipped: false };
  let sets = $state<LoggedSet[]>([
    { ...base, id: 'k1', setNo: 1 },
    { ...base, id: 'k2', setNo: 2, done: true, weightLb: 95, reps: 8 },
    { ...base, id: 'k3', setNo: 3, done: true, weightLb: 100, reps: 6 },
    { ...base, id: 'k4', setNo: 4, skipped: true },
    { ...base, id: 'k5', setNo: 5, done: true, weightLb: 950, reps: 8 },
  ]);
  const others: { label: string; kind: 'bodyweight' | 'hold' | 'run' | 'checklist'; set: LoggedSet }[] = [
    { label: 'Bodyweight, strict + banded', kind: 'bodyweight', set: { ...base, id: 'o1', targetWeightLb: undefined, targetReps: 10, reps: 10, strictReps: 6, done: true } },
    { label: 'Hold', kind: 'hold', set: { ...base, id: 'o2', targetWeightLb: undefined, targetReps: 40 } },
    { label: 'Run', kind: 'run', set: { ...base, id: 'o3', targetWeightLb: undefined, targetReps: undefined, distanceM: 3219, timeSec: 1290, done: true } },
    { label: 'Checklist', kind: 'checklist', set: { ...base, id: 'o4', targetWeightLb: undefined, targetReps: undefined } },
  ];

  let weight = $state<number | undefined>(62.5);
  let reps = $state<number | undefined>();
  let range = $state<'4w' | '3m' | 'all'>('3m');
  let effort = $state<number | undefined>(7);
  let on = $state(true);
  let name = $state('Sample routine');
  let bottomOpen = $state(false);
  let fullOpen = $state(false);
  let tab = $state('home');
</script>

<div class="screen">
  <div class="screen-head"><a class="back" href="#/settings">‹ Settings</a></div>
  <h1 class="title-large">Components</h1>
  <p class="footnote intro">Every primitive in every state, with made-up data. Dev only.</p>

  <TweaksPanel />

  <ListGroup header="Button">
    <div class="pad row-gap">
      <Button variant="primary">Primary</Button>
      <Button>Secondary</Button>
      <Button variant="plain">Plain</Button>
      <Button variant="danger">Delete</Button>
      <Button variant="primary" disabled>Disabled</Button>
      <Button size="small">Small</Button>
      <Button variant="primary" block>Block</Button>
    </div>
  </ListGroup>

  <ListGroup header="Stepper (press and hold to speed up)">
    <div class="pad row-gap">
      <Stepper label="Weight" unit="lb" step={2.5} bind:value={weight} />
      <Stepper label="Reps" placeholder={8} bind:value={reps} />
      <Stepper label="Disabled" value={3} disabled />
    </div>
  </ListGroup>

  <ListGroup header="SetRow: planned, done, edited, skipped, typo guard">
    {#each sets as s, i (s.id)}
      <SetRow
        set={s}
        weightStep={2.5}
        onchange={(next) => (sets[i] = next)}
        onskip={() => (sets[i] = { ...s, skipped: !s.skipped, done: false })}
        onremove={() => toasts.show('Set removed', { undo: () => {} })}
      />
    {/each}
  </ListGroup>

  <ListGroup header="SetRow: other kinds">
    {#each others as o (o.set.id)}
      <SetRow set={o.set} kind={o.kind} />
    {/each}
  </ListGroup>

  <ListGroup header="SetRow: editor open">
    <SetRow set={{ ...base, id: 'e1', setNo: 2 }} expanded onskip={() => {}} onremove={() => {}} />
  </ListGroup>

  <ListGroup header="ListRow" footer="A footer explains the group in one sentence.">
    <ListRow label="Plain row" value="42" />
    <ListRow label="With detail" detail="Second line of detail" onclick={() => {}} />
    <ListRow label="Link row" href="#/kitchen-sink" value="3" />
    <ListRow label="Accent action" tone="accent" onclick={() => {}} chevron={false} />
    <ListRow label="Destructive action" tone="danger" onclick={() => {}} chevron={false} />
    <ListRow label="With a switch">
      {#snippet trailing()}<Switch label="With a switch" bind:checked={on} />{/snippet}
    </ListRow>
    <ListRow label="Disabled switch">
      {#snippet trailing()}<Switch label="Disabled switch" disabled />{/snippet}
    </ListRow>
  </ListGroup>

  <ListGroup header="SegmentedControl">
    <div class="pad stack">
      <SegmentedControl label="Range" bind:value={range} options={[{ value: '4w', label: '4W' }, { value: '3m', label: '3M' }, { value: 'all', label: 'All' }]} />
      <SegmentedControl label="Effort" bind:value={effort} options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} />
    </div>
  </ListGroup>

  <ListGroup header="TextField">
    <div class="pad stack">
      <TextField label="Name" bind:value={name} />
      <TextField label="Calories" inputmode="numeric" placeholder="Optional" />
    </div>
  </ListGroup>

  <h3 class="label">Banner</h3>
  <Banner title="Back up your log" message="Last export was 9 days ago." actionLabel="Export" onaction={() => {}} ondismiss={() => {}} />
  <Banner tone="warning" title="Missed reps two weeks running" message="Try 10% lighter next time?" actionLabel="Accept" onaction={() => {}} ondismiss={() => {}} />
  <Banner tone="danger" title="Couldn't read that file" message="Nothing was imported. Your data is safe." />

  <ListGroup header="EmptyState">
    <EmptyState message="No workouts yet." actionLabel="Log today" onaction={() => {}} />
  </ListGroup>

  <h3 class="label">Toast</h3>
  <div class="stack toasts">
    <Toast message="Set removed" onundo={() => {}} ondismiss={() => {}} />
    <Toast message="Workout saved" />
    <Toast tone="error" message="Couldn't save that set. Data already saved is safe. Try again." ondismiss={() => {}} />
    <Button onclick={() => toasts.show('Sample toast with Undo', { undo: () => toasts.show('Undone') })}>Show a live toast</Button>
  </div>

  <h3 class="label">TabBar</h3>
  <div class="tabbar-demo">
    <TabBar
      active={tab}
      onselect={(id) => (tab = id)}
      tabs={[
        { id: 'home', label: 'Home', icon: House },
        { id: 'progress', label: 'Progress', icon: ChartLine },
        { id: 'history', label: 'History', icon: History },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]}
    />
  </div>

  <h3 class="label">Sheet</h3>
  <div class="row-gap">
    <Button onclick={() => (bottomOpen = true)}>Open bottom sheet</Button>
    <Button onclick={() => (fullOpen = true)}>Open full sheet</Button>
  </div>
  <div class="big">
    <span class="big-number">1,240</span>
    <span class="footnote">Big number (lb, made up)</span>
  </div>
</div>

{#if bottomOpen}
  <Sheet title="Add exercise" onclose={() => (bottomOpen = false)}>
    <p>Drag the handle down, tap the backdrop or press Escape to close.</p>
    <ListGroup>
      <ListRow label="Sample exercise A" onclick={() => (bottomOpen = false)} />
      <ListRow label="Sample exercise B" onclick={() => (bottomOpen = false)} />
    </ListGroup>
  </Sheet>
{/if}
{#if fullOpen}
  <Sheet title="Sample log" variant="full" onclose={() => (fullOpen = false)}>
    {#snippet trailing()}<Button size="small" variant="primary" onclick={() => (fullOpen = false)}>Finish</Button>{/snippet}
    <EmptyState message="A full-screen sheet, like the Log sheet." />
  </Sheet>
{/if}

<style>
  .back { display: inline-flex; align-items: center; min-height: 44px; color: var(--accent); text-decoration: none; }
  .intro { margin-bottom: 24px; }
  .pad { padding: 12px var(--space); }
  .label { margin: 0 0 8px; padding: 0 var(--space); font-size: 0.8125rem; font-weight: 400; text-transform: uppercase; color: var(--text-2); }
  .toasts { margin-bottom: 24px; }
  /* Show the tab bar in place instead of fixed to the screen bottom. */
  .tabbar-demo { position: relative; height: 56px; margin-bottom: 24px; transform: translateZ(0); overflow: hidden; border-radius: var(--radius); }
  .big { display: flex; flex-direction: column; margin-top: 24px; }
</style>
