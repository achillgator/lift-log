<!--
  Bodyweight chart per SPEC: 7-day rolling average (3 px, accent, monotone-cubic between real
  averages only). "Show weigh-ins" (remembered on this device) adds a 1 px line and small dots of the
  actual entries at 25% opacity behind it. Scrub shows date + weigh-in + average; change since the
  start of the range sits above.
-->
<script lang="ts">
  import type { Bodyweight } from '../../db';
  import { changeSinceStart, inRange, rollingAverage, type Range } from '../../lib/stats';
  import ChartCard from '../progress/ChartCard.svelte';
  import LineChart, { type ChartSeries } from '../progress/LineChart.svelte';
  import { rangeWords, windowFor } from '../progress/chartData';
  import { formatDate, formatSignedLb } from '../progress/format';

  interface Props { entries: Bodyweight[]; range: Range; today: string; }
  let { entries, range, today }: Props = $props();

  const PREF = 'lift-log:show-weigh-ins';
  let showWeighIns = $state(readPref());
  function readPref(): boolean {
    try {
      return localStorage.getItem(PREF) === '1';
    } catch {
      return false;
    }
  }
  function toggle() {
    showWeighIns = !showWeighIns;
    try {
      localStorage.setItem(PREF, showWeighIns ? '1' : '0');
    } catch {
      // Private mode or blocked storage: the toggle still works for this visit.
    }
  }

  const all = $derived(rollingAverage(entries.filter((e) => e.date <= today)));
  const shown = $derived(inRange(all, range, today));
  const change = $derived(changeSinceStart(shown));
  const win = $derived(windowFor(range, today, all.map((p) => p.date)));
  const series = $derived.by((): ChartSeries[] => {
    const avg: ChartSeries = { key: 'avg', tone: 'main', points: shown.map((p) => ({ date: p.date, value: p.avgLb })) };
    if (!showWeighIns) return [avg];
    return [{ key: 'raw', tone: 'faint', points: shown.map((p) => ({ date: p.date, value: p.weightLb })) }, avg];
  });
  const empty = $derived(
    !all.length
      ? "No weigh-ins yet. Log today's weight above to start your chart."
      : !shown.length
        ? `No weigh-ins ${rangeWords(range)}. Log today's weight above, or switch to All.`
        : undefined,
  );
  const lb = (v: number) => `${v.toFixed(1)} lb`;
  const last = $derived(shown.at(-1));
  const summary = $derived(last ? [`7-day average ${lb(last.avgLb)}`, `Latest weigh-in ${lb(last.weightLb)}`] : []);
  function describe(date: string): string[] {
    const p = all.find((x) => x.date === date);
    return p ? [`Weigh-in ${lb(p.weightLb)}`, `Average ${lb(p.avgLb)}`] : [];
  }
</script>

<ChartCard title="Bodyweight" {empty}>
  <p class="change num">
    {#if change !== undefined}
      <strong>{formatSignedLb(change)}</strong> since {formatDate(shown[0].date, today)}
    {:else}
      Log another weigh-in to see change since start.
    {/if}
  </p>
  <LineChart
    {series}
    from={win.from}
    to={win.to}
    {today}
    {describe}
    {summary}
    yFormat={(v) => v.toFixed(1)}
    label="Bodyweight chart, 7-day average. Use arrow keys to step through weigh-ins."
    animateKey={range}
  />
</ChartCard>
<label class="toggle">
  <span>Show weigh-ins</span>
  <input type="checkbox" role="switch" checked={showWeighIns} onchange={toggle} />
</label>

<style>
  .change { margin: 0 0 8px; color: var(--text-2); font-size: 0.9375rem; }
  .change strong { color: var(--text); font-size: 1.375rem; font-weight: 700; letter-spacing: -0.01em; margin-right: 4px; }
  .toggle {
    display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 var(--space);
    background: var(--surface); border-radius: var(--radius); margin: -4px 0 12px;
  }
  input { width: 22px; height: 22px; accent-color: var(--accent); }
  input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
