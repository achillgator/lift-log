<!--
  One exercise's chart, by kind:
  barbell/dumbbell: top set weight per session + best e1RM per session (PR sessions marked);
  bodyweight (e.g. pull-ups): strict reps per session; hold (e.g. dead hang): longest hold per session.
-->
<script lang="ts">
  import type { Exercise } from '../../db';
  import {
    e1rmPrDates, inRange, maxPerSession, strictReps, sumPerSession, topSetPerSession,
    type DatedSet, type Range,
  } from '../../lib/stats';
  import ChartCard from './ChartCard.svelte';
  import LineChart, { type ChartSeries } from './LineChart.svelte';
  import { formatSeconds, rangeWords, windowFor } from './chartData';

  interface Props { exercise: Exercise; history: DatedSet[]; range: Range; today: string; highlight?: boolean; }
  let { exercise, history, range, today, highlight = false }: Props = $props();

  const weighted = $derived(exercise.kind === 'barbell' || exercise.kind === 'dumbbell');
  const name = $derived(exercise.name);

  const bests = $derived(weighted ? topSetPerSession(history) : []);
  const prDates = $derived(e1rmPrDates(bests));
  const simple = $derived(
    weighted ? [] : exercise.kind === 'hold' ? maxPerSession(history, (s) => s.holdSec) : sumPerSession(history, strictReps),
  );

  const allDates = $derived(weighted ? bests.map((b) => b.date) : simple.map((p) => p.date));
  const shownBests = $derived(inRange(bests, range, today));
  const shownSimple = $derived(inRange(simple, range, today));
  const shownCount = $derived(weighted ? shownBests.length : shownSimple.length);
  const win = $derived(windowFor(range, today, allDates));

  const title = $derived(
    weighted ? name : exercise.kind === 'hold' ? `${name} · longest hold` : `${name} · strict reps`,
  );
  const fmt = (v: number) => (exercise.kind === 'hold' ? formatSeconds(v) : String(Math.round(v)));
  const what = $derived(weighted ? 'sets' : exercise.kind === 'hold' ? 'holds' : 'sets');

  const empty = $derived(
    !allDates.length
      ? weighted
        ? `No ${name} sets yet. Log a session with ${name} to see your top set and e1RM.`
        : exercise.kind === 'hold'
          ? `No ${name} holds yet. Log ${name} to see your longest hold.`
          : `No ${name} sets yet. Log ${name} to see your strict reps.`
      : !shownCount
        ? `No ${name} ${what} ${rangeWords(range)}. Log ${name}, or switch to All.`
        : undefined,
  );

  const series = $derived.by((): ChartSeries[] => {
    if (!weighted) return [{ key: 'v', tone: 'main', points: shownSimple.map((p) => ({ date: p.date, value: p.value })) }];
    return [
      { key: 'top', tone: 'secondary', points: shownBests.map((b) => ({ date: b.date, value: b.topWeightLb })) },
      {
        key: 'e1rm', tone: 'main', markers: prDates,
        points: shownBests.filter((b) => b.e1rm !== undefined).map((b) => ({ date: b.date, value: b.e1rm! })),
      },
    ];
  });

  function weightedLines(date: string): string[] {
    const b = bests.find((x) => x.date === date);
    if (!b) return [];
    const lines = [`Top set ${b.topWeightLb} × ${b.topReps}`];
    if (b.e1rm !== undefined) lines.push(`e1RM ${Math.round(b.e1rm)} lb`);
    if (prDates.includes(date)) lines.push('PR');
    return lines;
  }
  function simpleLines(date: string): string[] {
    const p = simple.find((x) => x.date === date);
    if (!p) return [];
    return [exercise.kind === 'hold' ? `Longest ${formatSeconds(p.value)}` : `${p.value} strict reps`];
  }
  const describe = (date: string) => (weighted ? weightedLines(date) : simpleLines(date));
  const summary = $derived.by(() => {
    if (weighted) {
      const best = Math.max(...shownBests.map((b) => b.e1rm ?? 0));
      const last = shownBests[shownBests.length - 1];
      return last ? [`Latest top set ${last.topWeightLb} × ${last.topReps}`, ...(best > 0 ? [`Best e1RM ${Math.round(best)} lb`] : [])] : [];
    }
    const last = shownSimple[shownSimple.length - 1];
    const best = Math.max(...shownSimple.map((p) => p.value));
    return last ? [`Latest ${fmt(last.value)}`, `Best ${fmt(best)}`] : [];
  });
</script>

<ChartCard {title} {empty} {highlight} id="lift-{exercise.id}">
  <LineChart
    {series}
    from={win.from}
    to={win.to}
    {today}
    {describe}
    {summary}
    yFormat={fmt}
    label="{title} chart. Use arrow keys to step through sessions."
    animateKey={range}
  />
  {#if weighted}
    <p class="legend"><span class="key main"></span>e1RM <span class="key secondary"></span>Top set <span class="key pr"></span>PR</p>
  {/if}
</ChartCard>

<style>
  .legend { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: 0.75rem; color: var(--text-2); }
  .key { display: inline-block; width: 12px; height: 3px; border-radius: 2px; margin-left: 6px; }
  .key:first-child { margin-left: 0; }
  .key.main { background: var(--accent); }
  .key.secondary { background: var(--text-2); height: 1.5px; }
  .key.pr { width: 8px; height: 8px; border-radius: 50%; background: var(--pr); }
</style>
