<!-- Lifts segment: weekly volume, then one chart per lift (main lifts first), pull-ups and holds. -->
<script lang="ts">
  import { api, type Exercise } from '../../db';
  import { weekStart, weeklyVolume, rangeStart, type DatedSet, type Range } from '../../lib/stats';
  import BarChart from './BarChart.svelte';
  import ChartCard from './ChartCard.svelte';
  import ExerciseChart from './ExerciseChart.svelte';
  import LoadError from './LoadError.svelte';
  import { formatNumber, rangeWords } from './chartData';
  import { formatDate } from './format';
  import { load } from './load';

  interface Props { range: Range; today: string; focusId?: string; }
  let { range, today, focusId }: Props = $props();

  const KIND_ORDER: Record<string, number> = { barbell: 0, dumbbell: 1, bodyweight: 2, hold: 3 };

  const data = load(async () => {
    const exercises = (await api.listExercises(true)).filter((e) => e.kind in KIND_ORDER);
    const histories = await Promise.all(exercises.map((e) => api.setHistory(e.id)));
    return exercises
      .map((exercise, i): { exercise: Exercise; history: DatedSet[] } => ({ exercise, history: histories[i] }))
      .filter((r) => !r.exercise.archived || r.history.length > 0)
      .sort((a, b) => Number(b.exercise.isMain) - Number(a.exercise.isMain) || KIND_ORDER[a.exercise.kind] - KIND_ORDER[b.exercise.kind]);
  });

  const rows = $derived(data.value.status === 'ok' ? data.value.data : []);
  const weeks = $derived(
    weeklyVolume(rows.filter((r) => KIND_ORDER[r.exercise.kind] <= 1).flatMap((r) => r.history)),
  );
  const shownWeeks = $derived.by(() => {
    const from = rangeStart(range, today);
    return from ? weeks.filter((w) => w.week >= weekStart(from)) : weeks;
  });
  const bars = $derived(shownWeeks.map((w) => ({ date: w.week, value: w.volumeLb })));
  const volumeEmpty = $derived(
    !weeks.length
      ? 'No weighted sets yet. Finish a workout with a barbell or dumbbell lift to see weekly volume.'
      : !shownWeeks.some((w) => w.volumeLb > 0)
        ? `No weighted sets ${rangeWords(range)}. Log a workout, or switch to All.`
        : undefined,
  );
  const lb = (v: number) => `${formatNumber(v)} lb`;
  const volumeSummary = $derived.by(() => {
    const last = shownWeeks[shownWeeks.length - 1];
    if (!last) return [];
    const avg = shownWeeks.reduce((s, w) => s + w.volumeLb, 0) / shownWeeks.length;
    return [`This week ${lb(weekStart(today) === last.week ? last.volumeLb : 0)}`, `Average ${lb(avg)}`];
  });

</script>

{#if data.value.status === 'error'}
  <LoadError what="your lifts" message={data.value.message} />
{:else if data.value.status === 'ok'}
  <ChartCard title="Weekly volume" empty={volumeEmpty}>
    <BarChart
      {bars}
      {today}
      summary={volumeSummary}
      describe={(i) => [`Week of ${formatDate(bars[i].date, today)}`, lb(bars[i].value)]}
      yFormat={(v) => `${formatNumber(v / 1000, 1)}k`}
      label="Weekly volume chart. Use arrow keys to step through weeks."
      animateKey={range}
    />
  </ChartCard>

  {#if !rows.length}
    <ChartCard title="Lifts" empty="No exercises yet. Add one in Settings, then log a session to see it here." />
  {/if}
  {#each rows as row (row.exercise.id)}
    <ExerciseChart exercise={row.exercise} history={row.history} {range} {today} highlight={row.exercise.id === focusId} />
  {/each}
{/if}
