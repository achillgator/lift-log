<!-- Progress: training-days heatmap, shaded by done sets per day (v1.1). Tap or drag to read a day. -->
<script lang="ts">
  import { api } from '../../db';
  import { live } from '../../db/live.svelte';
  import { buildHeatmap, countByDate, heatmapSummary } from '../../lib/later/heatmap';
  import { formatShort, monthShort, todayLocal } from '../../lib/later/dates';

  let { weeks = 26, today = todayLocal(), weekStart = 0 }: { weeks?: number; today?: string; weekStart?: number } = $props();

  // Done sets with dates. setHistory per exercise covers every finished session.
  const sets = live(async () => {
    const exercises = await api.listExercises(true);
    const histories = await Promise.all(exercises.map((e) => api.setHistory(e.id)));
    return histories.flat().filter((s) => s.done && !s.skipped);
  }, [] as { date: string }[]);

  const grid = $derived(buildHeatmap(countByDate(sets.value), { endDate: today, weeks, weekStart }));
  const summary = $derived(heatmapSummary(grid));

  const CELL = 11;
  const GAP = 2;
  const TOP = 14;
  const width = $derived(grid.length * (CELL + GAP) - GAP);
  const height = TOP + 7 * (CELL + GAP) - GAP;

  let picked = $state<{ date: string; value: number } | undefined>();
  let svg: SVGSVGElement | undefined = $state();

  function pick(event: PointerEvent) {
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * width;
    const y = ((event.clientY - box.top) / box.height) * height - TOP;
    const col = Math.floor(x / (CELL + GAP));
    const row = Math.floor(y / (CELL + GAP));
    const cell = grid[col]?.cells[row];
    if (cell?.inRange) picked = { date: cell.date, value: cell.value };
  }

  const opacity = [0, 0.25, 0.5, 0.75, 1];
</script>

<figure>
  <figcaption>
    {#if picked}
      <span class="num">{formatShort(picked.date)} · {picked.value === 0 ? 'Rest' : `${picked.value} set${picked.value === 1 ? '' : 's'}`}</span>
    {:else if summary.activeDays === 0}
      Finish a workout to fill in the calendar.
    {:else}
      <span class="num">{summary.activeDays} training day{summary.activeDays === 1 ? '' : 's'} in {grid.length} weeks</span>
    {/if}
  </figcaption>
  <svg
    bind:this={svg}
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label="Training calendar: {summary.activeDays} training days in the last {grid.length} weeks"
    onpointerdown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
    onpointermove={(e) => e.buttons && pick(e)}
  >
    {#each grid as week, col (week.start)}
      {#if week.monthStart}
        <text x={col * (CELL + GAP)} y={9} class="month">{monthShort(week.monthStart)}</text>
      {/if}
      {#each week.cells as cell, row (cell.date)}
        {#if cell.inRange}
          <rect
            x={col * (CELL + GAP)}
            y={TOP + row * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx="2.5"
            class:empty={cell.level === 0}
            class:picked={picked?.date === cell.date}
            fill-opacity={cell.level === 0 ? 1 : opacity[cell.level]}
          />
        {/if}
      {/each}
    {/each}
  </svg>
</figure>

<style>
  figure { margin: 0; }
  figcaption { font-size: 0.875rem; color: var(--text-2); min-height: 1.4em; margin-bottom: 8px; }
  svg { width: 100%; height: auto; display: block; touch-action: none; user-select: none; }
  rect { fill: var(--accent); }
  rect.empty { fill: var(--surface-2); }
  rect.picked { stroke: var(--text); stroke-width: 1.5; }
  .month { font-size: 8px; fill: var(--text-2); }
  .num { font-variant-numeric: tabular-nums; }
</style>
