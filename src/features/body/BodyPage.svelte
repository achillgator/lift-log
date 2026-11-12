<!--
  The bodyweight page: stepper entry and the bodyweight chart. Used as the Progress → Body segment;
  can also be mounted on its own route. Pass `range` to drive it from a parent's range control,
  or leave it out to show its own 4W/3M/All control.
-->
<script lang="ts">
  import { api } from '../../db';
  import { toLocalDate, type Range } from '../../lib/stats';
  import Segmented from '../progress/Segmented.svelte';
  import LoadError from '../progress/LoadError.svelte';
  import { RANGES } from '../progress/chartData';
  import { load } from '../progress/load';
  import BodyweightChart from './BodyweightChart.svelte';
  import BodyweightEntry from './BodyweightEntry.svelte';

  interface Props { range?: Range; today?: string; }
  let { range, today = toLocalDate(new Date()) }: Props = $props();

  let ownRange: Range = $state('3M');
  const shownRange = $derived(range ?? ownRange);
  const data = load(() => api.listBodyweight());
</script>

{#if data.value.status === 'error'}
  <LoadError what="your weigh-ins" message={data.value.message} />
{:else if data.value.status === 'ok'}
  <BodyweightEntry entries={data.value.data} {today} />
  {#if range === undefined}
    <div class="range"><Segmented options={RANGES} value={ownRange} label="Chart range" onchange={(r) => (ownRange = r)} /></div>
  {/if}
  <BodyweightChart entries={data.value.data} range={shownRange} {today} />
{/if}

<style>
  .range { margin-bottom: 12px; }
</style>
