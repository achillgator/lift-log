<!--
  Progress tab: Lifts · Runs · Body, one 4W/3M/All range for every chart.
  Routes: #/progress, #/progress/lifts, #/progress/runs, #/progress/body,
  #/progress/lift/<exerciseId> (Lifts, scrolled to that lift's chart; used by trophies).
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { currentRoute, go, onRouteChange } from '../../lib/router';
  import { toLocalDate, type Range } from '../../lib/stats';
  import BodyPage from '../body/BodyPage.svelte';
  import LiftsPanel from './LiftsPanel.svelte';
  import RunsPanel from './RunsPanel.svelte';
  import Segmented from './Segmented.svelte';
  import { RANGES } from './chartData';

  const SEGMENTS = ['Lifts', 'Runs', 'Body'] as const;
  type Segment = (typeof SEGMENTS)[number];

  let route = $state(currentRoute());
  $effect(() => onRouteChange((next) => (route = next)));

  const parts = $derived(route.split('/'));
  const focusId = $derived(parts[1] === 'lift' ? decodeURIComponent(parts[2] ?? '') : undefined);
  const segment: Segment = $derived(parts[1] === 'runs' ? 'Runs' : parts[1] === 'body' ? 'Body' : 'Lifts');

  const RANGE_PREF = 'lift-log:progress-range';
  let range: Range = $state(readRange());
  function readRange(): Range {
    try {
      const v = localStorage.getItem(RANGE_PREF);
      return (RANGES as readonly string[]).includes(v ?? '') ? (v as Range) : '3M';
    } catch {
      return '3M';
    }
  }
  function setRange(r: Range) {
    range = r;
    try {
      localStorage.setItem(RANGE_PREF, r);
    } catch {
      // Storage blocked: the range still applies for this visit.
    }
  }

  // Today is read once per visit to the tab; dates are local YYYY-MM-DD.
  const today = toLocalDate(new Date());

  // Scroll a focused lift's chart into view once it has rendered.
  $effect(() => {
    if (!focusId) return;
    const id = `lift-${focusId}`;
    let tries = 0;
    const find = async () => {
      await tick();
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      else if (tries++ < 20) setTimeout(find, 50);
    };
    find();
  });
</script>

<header>
  <h1>Progress</h1>
  <Segmented options={SEGMENTS} value={segment} label="Progress section" onchange={(s) => go(`progress/${s.toLowerCase()}`)} />
  <div class="range">
    <Segmented options={RANGES} value={range} label="Chart range" onchange={setRange} />
  </div>
</header>

{#if segment === 'Lifts'}
  <LiftsPanel {range} {today} {focusId} />
{:else if segment === 'Runs'}
  <RunsPanel {range} {today} />
{:else}
  <BodyPage {range} {today} />
{/if}

<style>
  header { margin-bottom: 12px; }
  h1 { font-size: 2.125rem; font-weight: 700; letter-spacing: -0.02em; margin: 8px 0 12px; }
  .range { margin-top: 8px; }
</style>
