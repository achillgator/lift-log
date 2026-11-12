<!--
  Hand-rolled SVG line chart. Time on x (one day = one unit), values on y.
  Monotone-cubic between real points only; lines break across gaps over 3 weeks.
  Tap-and-drag (or arrow keys) to scrub; the readout above the plot shows the date and values.
-->
<script lang="ts" module>
  export interface ChartPoint { date: string; value: number; }
  export interface ChartSeries {
    key: string;
    points: ChartPoint[];
    /** main: accent, 3 px. secondary: secondary text color, 1.5 px with dots. faint: 1 px + small dots at 25% opacity. */
    tone: 'main' | 'secondary' | 'faint';
    /** Dates to mark in the PR color (main series only). */
    markers?: string[];
  }
</script>

<script lang="ts">
  import { dayNumber, monotonePath, nearestIndex, splitGaps } from '../../lib/stats';
  import { formatDate, formatShortDate } from './format';

  interface Props {
    series: ChartSeries[];
    /** x-domain start and end (YYYY-MM-DD). */
    from: string;
    to: string;
    today: string;
    /** Readout lines for a scrubbed date. */
    describe: (date: string) => string[];
    /** Readout lines when not scrubbing (latest value). */
    summary: string[];
    yFormat?: (v: number) => string;
    label: string;
    height?: number;
    /** Changes re-run the draw-in animation. */
    animateKey?: string;
  }

  let { series, from, to, today, describe, summary, yFormat = (v) => String(Math.round(v)), label, height = 168, animateKey = '' }: Props = $props();

  let width = $state(0);
  let scrubDate: string | undefined = $state();

  const pad = { top: 20, right: 8, bottom: 22, left: 8 };

  const allPoints = $derived(series.flatMap((s) => s.points));
  const x0 = $derived(dayNumber(from));
  const x1 = $derived(Math.max(dayNumber(to), x0 + 1));
  const yDomain = $derived.by(() => {
    const vs = allPoints.map((p) => p.value);
    let lo = Math.min(...vs);
    let hi = Math.max(...vs);
    if (!Number.isFinite(lo)) return [0, 1];
    if (hi === lo) {
      const d = Math.max(Math.abs(hi) * 0.05, 1);
      lo -= d;
      hi += d;
    }
    const p = (hi - lo) * 0.1;
    return [lo - p, hi + p];
  });

  const plotW = $derived(Math.max(1, width - pad.left - pad.right));
  const plotH = $derived(height - pad.top - pad.bottom);
  const xOf = (date: string) => pad.left + ((dayNumber(date) - x0) / (x1 - x0)) * plotW;
  const yOf = (v: number) => pad.top + (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotH;

  const drawn = $derived(
    series.map((s) => ({
      ...s,
      runs: splitGaps(s.points).map((run) => ({
        d: monotonePath(run.map((p) => ({ x: xOf(p.date), y: yOf(p.value) }))),
        single: run.length === 1 ? run[0] : undefined,
      })),
      dots: s.points.map((p) => ({ x: xOf(p.date), y: yOf(p.value), marker: s.markers?.includes(p.date) ?? false })),
    })),
  );

  const dates = $derived([...new Set(allPoints.map((p) => p.date))].sort());
  const xs = $derived(dates.map(xOf));
  const scrubX = $derived(scrubDate ? xOf(scrubDate) : 0);
  const scrubDots = $derived(
    scrubDate
      ? series.flatMap((s) => s.points.filter((p) => p.date === scrubDate).map((p) => ({ tone: s.tone, y: yOf(p.value) })))
      : [],
  );
  const readout = $derived(scrubDate ? [formatDate(scrubDate, today), ...describe(scrubDate)] : summary);

  let svg: SVGSVGElement | undefined = $state();
  let dragging = false;

  function scrubAt(clientX: number) {
    if (!svg || !dates.length) return;
    const rect = svg.getBoundingClientRect();
    scrubDate = dates[nearestIndex(xs, clientX - rect.left)];
  }
  function down(e: PointerEvent) {
    dragging = true;
    svg?.setPointerCapture(e.pointerId);
    scrubAt(e.clientX);
  }
  function move(e: PointerEvent) {
    if (dragging) scrubAt(e.clientX);
  }
  function up() {
    dragging = false;
    scrubDate = undefined;
  }
  function key(e: KeyboardEvent) {
    if (!dates.length) return;
    const i = scrubDate ? dates.indexOf(scrubDate) : dates.length;
    if (e.key === 'ArrowLeft') scrubDate = dates[Math.max(0, i - 1)];
    else if (e.key === 'ArrowRight') scrubDate = dates[Math.min(dates.length - 1, scrubDate ? i + 1 : dates.length - 1)];
    else if (e.key === 'Escape') scrubDate = undefined;
    else return;
    e.preventDefault();
  }
</script>

<div class="readout num" aria-live="polite">
  {#each readout as line, i}<span class:lead={i === 0}>{line}</span>{/each}
</div>
<div class="plot" bind:clientWidth={width} style:height="{height}px">
  {#if width > 0}
    <svg
      bind:this={svg}
      {width}
      {height}
      role="slider"
      tabindex="0"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, dates.length - 1)}
      aria-valuenow={scrubDate ? dates.indexOf(scrubDate) : dates.length - 1}
      aria-valuetext={readout.join(', ')}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
      onkeydown={key}
      onblur={() => (scrubDate = undefined)}
    >
      <line class="axis" x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} />
      <text class="tick" x={pad.left} y={height - 6}>{formatShortDate(from, today)}</text>
      <text class="tick" x={width - pad.right} y={height - 6} text-anchor="end">{formatShortDate(to, today)}</text>
      <text class="tick" x={width - pad.right} y={pad.top - 8} text-anchor="end">{yFormat(yDomain[1])}</text>
      <text class="tick" x={width - pad.right} y={height - pad.bottom - 4} text-anchor="end">{yFormat(yDomain[0])}</text>

      {#key animateKey + width}
        {#each drawn as s (s.key)}
          <g class="series {s.tone}">
            {#each s.runs as run}
              {#if run.single}
                <circle class="dot lone" cx={xOf(run.single.date)} cy={yOf(run.single.value)} r={s.tone === 'main' ? 3.5 : 2.5} />
              {:else}
                <path class="line draw" d={run.d} pathLength="1" />
              {/if}
            {/each}
            {#if s.tone !== 'main'}
              {#each s.dots as dot}<circle class="dot" cx={dot.x} cy={dot.y} r={s.tone === 'faint' ? 2 : 2.5} />{/each}
            {/if}
            {#each s.dots.filter((d) => d.marker) as dot}<circle class="pr" cx={dot.x} cy={dot.y} r="4" />{/each}
          </g>
        {/each}
      {/key}

      {#if scrubDate}
        <line class="rule" x1={scrubX} x2={scrubX} y1={pad.top} y2={height - pad.bottom} />
        {#each scrubDots as dot}<circle class="scrub-dot {dot.tone}" cx={scrubX} cy={dot.y} r="5" />{/each}
      {/if}
    </svg>
  {/if}
</div>

<style>
  .readout { display: flex; flex-wrap: wrap; gap: 4px 12px; min-height: 2.6em; align-content: flex-start; font-size: 0.8125rem; color: var(--text-2); }
  .readout .lead { color: var(--text); font-weight: 600; }
  .plot { position: relative; }
  svg { display: block; touch-action: pan-y; user-select: none; -webkit-user-select: none; overflow: visible; }
  svg:focus { outline: none; }
  svg:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  .axis { stroke: var(--separator); stroke-width: 1; }
  .tick { fill: var(--text-2); font-size: 11px; font-variant-numeric: tabular-nums; }
  .line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .main .line { stroke: var(--accent); stroke-width: 3; }
  .main .dot { fill: var(--accent); }
  .secondary .line { stroke: var(--text-2); stroke-width: 1.5; }
  .secondary .dot { fill: var(--text-2); }
  .faint { opacity: 0.25; }
  .faint .line { stroke: var(--text); stroke-width: 1; }
  .faint .dot { fill: var(--text); }
  .pr { fill: var(--pr); stroke: var(--surface); stroke-width: 1.5; }
  .rule { stroke: var(--text-2); stroke-width: 1; }
  .scrub-dot { fill: var(--surface); stroke-width: 2; stroke: var(--text-2); }
  .scrub-dot.main { stroke: var(--accent); }
  .scrub-dot.faint { stroke: var(--text-2); }

  .draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .dot, .pr { animation: fade 300ms ease-out 450ms both; }
  .faint .dot { animation-delay: 0ms; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .draw { stroke-dasharray: none; stroke-dashoffset: 0; animation: fade 200ms ease-out both; }
    .dot, .pr { animation: fade 200ms ease-out both; }
  }
</style>
