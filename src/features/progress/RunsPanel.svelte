<!--
  Runs segment: distance per session for each routine, then timed test runs (time per session for
  each routine marked as a test). Runs and interval reps are sets of a run-kind exercise.
-->
<script lang="ts">
  import { api, type Routine } from '../../db';
  import { inRange, type DatedSet, type Range } from '../../lib/stats';
  import ChartCard from './ChartCard.svelte';
  import LineChart from './LineChart.svelte';
  import LoadError from './LoadError.svelte';
  import { rangeWords, windowFor } from './chartData';
  import { formatDuration, formatMiles, METERS_PER_MILE } from './format';
  import { load } from './load';

  interface Props { range: Range; today: string; }
  let { range, today }: Props = $props();

  interface RunSession { sessionId: string; date: string; routineId?: string; miles: number; timeSec: number; }
  interface Group { key: string; title: string; routine?: Routine; runs: RunSession[]; }

  const data = load(async () => {
    const [exercises, sessions, routines] = await Promise.all([
      api.listExercises(true), api.listSessions('done'), api.listRoutines(true),
    ]);
    const runIds = new Set(exercises.filter((e) => e.kind === 'run').map((e) => e.id));
    const sets: DatedSet[] = (await Promise.all([...runIds].map((id) => api.setHistory(id)))).flat();
    return { runIds, sessions, routines, sets };
  });

  const groups = $derived.by(() => {
    if (data.value.status !== 'ok') return { distance: [] as Group[], tests: [] as Group[] };
    const { runIds, sessions, routines, sets } = data.value.data;
    const routineOf = new Map(sessions.map((s) => [s.id, s.routineId]));
    const bySession = new Map<string, RunSession>();
    for (const s of sets) {
      if (!s.done || s.skipped) continue;
      const row = bySession.get(s.sessionId) ?? { sessionId: s.sessionId, date: s.date, routineId: routineOf.get(s.sessionId), miles: 0, timeSec: 0 };
      row.miles += (s.distanceM ?? 0) / METERS_PER_MILE;
      row.timeSec += s.timeSec ?? 0;
      bySession.set(s.sessionId, row);
    }
    const runs = [...bySession.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    const byRoutine = new Map<string, RunSession[]>();
    for (const r of runs) {
      const key = r.routineId && routines.some((x) => x.id === r.routineId) ? r.routineId : '';
      byRoutine.set(key, [...(byRoutine.get(key) ?? []), r]);
    }
    const hasRunItem = (r: Routine) => r.items.some((i) => runIds.has(i.exerciseId));
    const relevant = routines
      .filter((r) => byRoutine.has(r.id) || (!r.archived && hasRunItem(r)))
      .sort((a, b) => a.order - b.order);
    const toGroup = (r: Routine): Group => ({ key: r.id, title: r.name, routine: r, runs: byRoutine.get(r.id) ?? [] });
    const distance = relevant.filter((r) => !r.isTest).map(toGroup);
    if (byRoutine.has('')) distance.push({ key: '', title: 'Other runs', runs: byRoutine.get('')! });
    const tests = routines.filter((r) => r.isTest && (byRoutine.has(r.id) || !r.archived)).sort((a, b) => a.order - b.order).map(toGroup);
    return { distance, tests };
  });

  function card(g: Group, metric: 'miles' | 'time') {
    const valued = g.runs.filter((r) => (metric === 'miles' ? r.miles > 0 : r.timeSec > 0));
    const shown = inRange(valued, range, today);
    const value = (r: RunSession) => (metric === 'miles' ? r.miles : r.timeSec);
    const fmt = (v: number) => (metric === 'miles' ? formatMiles(v) : formatDuration(v));
    const empty = !valued.length
      ? metric === 'miles'
        ? `No ${g.title} runs yet. Log ${g.title} to see your distance.`
        : `No ${g.title} results yet. Log ${g.title} with a time to see your results.`
      : !shown.length
        ? `No ${g.title} runs ${rangeWords(range)}. Log ${g.title}, or switch to All.`
        : undefined;
    const last = shown[shown.length - 1];
    const best = shown.length ? (metric === 'miles' ? Math.max(...shown.map(value)) : Math.min(...shown.map(value))) : 0;
    return {
      empty,
      win: windowFor(range, today, valued.map((r) => r.date)),
      series: [{ key: 'v', tone: 'main' as const, points: shown.map((r) => ({ date: r.date, value: value(r) })) }],
      summary: last ? [`Latest ${fmt(value(last))}`, `${metric === 'miles' ? 'Longest' : 'Fastest'} ${fmt(best)}`] : [],
      describe: (date: string) => {
        const r = valued.find((x) => x.date === date);
        if (!r) return [];
        return metric === 'miles'
          ? [formatMiles(r.miles), ...(r.timeSec ? [formatDuration(r.timeSec)] : [])]
          : [formatDuration(r.timeSec), ...(r.miles ? [formatMiles(r.miles)] : [])];
      },
      fmt,
    };
  }
</script>

{#if data.value.status === 'error'}
  <LoadError what="your runs" message={data.value.message} />
{:else if data.value.status === 'ok'}
  <h3 class="group">Distance by routine</h3>
  {#if !groups.distance.length}
    <ChartCard title="Run distance" empty="No runs logged yet. Log a run to see distance by routine." />
  {/if}
  {#each groups.distance as g (g.key)}
    {@const c = card(g, 'miles')}
    <ChartCard title={g.title} empty={c.empty}>
      <LineChart series={c.series} from={c.win.from} to={c.win.to} {today} describe={c.describe} summary={c.summary}
        yFormat={(v) => v.toFixed(1)} label="{g.title} distance chart. Use arrow keys to step through runs." animateKey={range} />
    </ChartCard>
  {/each}

  <h3 class="group">Timed test runs</h3>
  {#if !groups.tests.length}
    <ChartCard title="Test runs" empty="No test routines yet. Mark a run routine as a test in its editor to chart your times." />
  {/if}
  {#each groups.tests as g (g.key)}
    {@const c = card(g, 'time')}
    <ChartCard title={g.title} empty={c.empty}>
      <LineChart series={c.series} from={c.win.from} to={c.win.to} {today} describe={c.describe} summary={c.summary}
        yFormat={c.fmt} label="{g.title} time chart. Use arrow keys to step through tests." animateKey={range} />
    </ChartCard>
  {/each}
{/if}

<style>
  .group { font-size: 0.8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; color: var(--text-2); margin: 16px 4px 8px; }
  .group:first-child { margin-top: 4px; }
</style>
