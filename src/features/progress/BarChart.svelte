<!--
  Hand-rolled SVG bar chart for weekly values (one bar per week, zero weeks shown as a stub).
  Tap-and-drag (or arrow keys) to scrub; the readout shows the week and value.
-->
<script lang="ts">
  import { nearestIndex } from '../../lib/stats';
  import { formatShortDate } from './format';

  interface Props {
    bars: { date: string; value: number }[];
    today: string;
    describe: (index: number) => string[];
    summary: string[];
    yFormat?: (v: number) => string;
    label: string;
    height?: number;
    animateKey?: string;
  }

  let { bars, today, describe, summary, yFormat = (v) => String(Math.round(v)), label, height = 148, animateKey = '' }: Props = $props();

  let width = $state(0);
  let active: number | undefined = $state();
  const pad = { top: 20, right: 8, bottom: 22, left: 8 };

  const max = $derived(Math.max(1, ...bars.map((b) => b.value)));
  const plotW = $derived(Math.max(1, width - pad.left - pad.right));
  const plotH = $derived(height - pad.top - pad.bottom);
  const slot = $derived(plotW / Math.max(1, bars.length));
  const barW = $derived(Math.max(2, Math.min(28, slot * 0.7)));
  const xs = $derived(bars.map((_, i) => pad.left + slot * (i + 0.5)));
  const readout = $derived(active !== undefined ? describe(active) : summary);

  let svg: SVGSVGElement | undefined = $state();
  let dragging = false;
  function at(clientX: number) {
    if (!svg || !bars.length) return;
    active = nearestIndex(xs, clientX - svg.getBoundingClientRect().left);
  }
  function down(e: PointerEvent) {
    dragging = true;
    svg?.setPointerCapture(e.pointerId);
    at(e.clientX);
  }
  function up() {
    dragging = false;
    active = undefined;
  }
  function key(e: KeyboardEvent) {
    if (!bars.length) return;
    const i = active ?? bars.length;
    if (e.key === 'ArrowLeft') active = Math.max(0, i - 1);
    else if (e.key === 'ArrowRight') active = Math.min(bars.length - 1, active === undefined ? bars.length - 1 : i + 1);
    else if (e.key === 'Escape') active = undefined;
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
      aria-valuemax={Math.max(0, bars.length - 1)}
      aria-valuenow={active ?? bars.length - 1}
      aria-valuetext={readout.join(', ')}
      onpointerdown={down}
      onpointermove={(e) => dragging && at(e.clientX)}
      onpointerup={up}
      onpointercancel={up}
      onkeydown={key}
      onblur={() => (active = undefined)}
    >
      <line class="axis" x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} />
      {#if bars.length}
        <text class="tick" x={pad.left} y={height - 6}>{formatShortDate(bars[0].date, today)}</text>
        <text class="tick" x={width - pad.right} y={height - 6} text-anchor="end">{formatShortDate(bars[bars.length - 1].date, today)}</text>
      {/if}
      <text class="tick" x={width - pad.right} y={pad.top - 8} text-anchor="end">{yFormat(max)}</text>
      {#key animateKey + width}
        {#each bars as bar, i}
          {@const h = Math.max(bar.value > 0 ? 2 : 1, (bar.value / max) * plotH)}
          <rect
            class="bar"
            class:zero={bar.value === 0}
            class:on={active === i}
            x={xs[i] - barW / 2}
            y={height - pad.bottom - h}
            width={barW}
            height={h}
            rx={Math.min(3, barW / 2)}
            style:animation-delay="{Math.min(i * 18, 400)}ms"
          />
        {/each}
      {/key}
    </svg>
  {/if}
</div>

<style>
  .readout { display: flex; flex-wrap: wrap; gap: 4px 12px; min-height: 2.6em; align-content: flex-start; font-size: 0.8125rem; color: var(--text-2); }
  .readout .lead { color: var(--text); font-weight: 600; }
  svg { display: block; touch-action: pan-y; user-select: none; -webkit-user-select: none; overflow: visible; }
  svg:focus { outline: none; }
  svg:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  .axis { stroke: var(--separator); stroke-width: 1; }
  .tick { fill: var(--text-2); font-size: 11px; font-variant-numeric: tabular-nums; }
  .bar { fill: var(--accent); opacity: 0.85; transform-box: fill-box; transform-origin: bottom; animation: grow 500ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  .bar.zero { fill: var(--separator); }
  .bar.on { opacity: 1; fill: var(--text); }
  @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .bar { animation: fade 200ms ease-out both; animation-delay: 0ms !important; }
  }
</style>
