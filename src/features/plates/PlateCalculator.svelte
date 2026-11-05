<!-- Plate calculator (v1.1): plates per side for a target weight, from Settings → plates owned. -->
<script lang="ts">
  import { api } from '../../db';
  import { live } from '../../db/live.svelte';
  import { DEFAULT_BAR_LB, groupPlates, platesPerSide } from '../../lib/later/plates';

  let { targetLb = 135, barLb }: { targetLb?: number; barLb?: number } = $props();

  // The bar weight is a per-device UI preference until Settings has a field for it (see PR).
  const BAR_KEY = 'lift-log.plates.barLb';
  const BARS = [45, 35, 15];
  function savedBar(): number {
    try {
      const n = Number(localStorage.getItem(BAR_KEY));
      return n > 0 ? n : DEFAULT_BAR_LB;
    } catch {
      return DEFAULT_BAR_LB;
    }
  }

  // svelte-ignore state_referenced_locally
  let target = $state(targetLb);
  // svelte-ignore state_referenced_locally
  let bar = $state(barLb ?? savedBar());

  const settings = live(() => api.getSettings().then((s) => s.platesOwned), undefined as number[] | undefined);
  const plates = $derived(settings.value ?? []);
  const load = $derived(platesPerSide(target, bar, plates));
  const groups = $derived(groupPlates(load.perSide));
  const heaviest = $derived(Math.max(...plates, 1));

  function setBar(n: number) {
    bar = n;
    try { localStorage.setItem(BAR_KEY, String(n)); } catch { /* private mode: keep it for this visit */ }
  }

  function step(by: number) {
    target = Math.max(0, Math.round((target + by) * 2) / 2);
  }
</script>

<section aria-labelledby="plates-title">
  <h2 id="plates-title">Plates</h2>

  <div class="target">
    <button class="step" aria-label="5 lb less" onclick={() => step(-5)}>−</button>
    <label>
      <span class="sr">Target weight in lb</span>
      <input class="num big" type="number" inputmode="decimal" min="0" step="2.5" bind:value={target} />
      <span class="unit">lb</span>
    </label>
    <button class="step" aria-label="5 lb more" onclick={() => step(5)}>+</button>
  </div>

  <div class="bars" role="radiogroup" aria-label="Bar weight">
    {#each BARS as b}
      <button role="radio" aria-checked={bar === b} class:on={bar === b} onclick={() => setBar(b)}><span class="num">{b}</span> lb bar</button>
    {/each}
  </div>

  {#if settings.value && plates.length === 0}
    <p class="empty">Add the plates you own in Settings to see what to load.</p>
  {:else if load.belowBar}
    <p class="empty">That is less than the <span class="num">{bar}</span> lb bar.</p>
  {:else}
    <svg class="drawing" viewBox="0 0 200 64" aria-hidden="true">
      <rect x="0" y="29" width="200" height="6" class="sleeve" />
      {#each load.perSide as plate, i}
        {@const h = 18 + 44 * (plate / heaviest)}
        <rect x={60 + i * 11} y={32 - h / 2} width="9" height={h} rx="2" class="plate" />
      {/each}
    </svg>

    <p class="per-side">
      {#if groups.length === 0}
        Empty bar
      {:else}
        Each side:
        {#each groups as [plate, count], i}
          {#if i > 0}<span class="dot"> · </span>{/if}<span class="num">{count > 1 ? `${count} × ${plate}` : plate}</span>
        {/each}
      {/if}
    </p>
    <p class="result num">
      {#if load.shortLb === 0}
        Loads {load.totalLb} lb exactly.
      {:else}
        Closest: {load.totalLb} lb, {load.shortLb} lb short.
      {/if}
    </p>
  {/if}
</section>

<style>
  h2 { font-size: 1.25rem; margin: 0 0 12px; }
  .target { display: flex; align-items: center; justify-content: center; gap: 12px; }
  label { display: flex; align-items: baseline; gap: 4px; }
  .big { width: 5ch; font-size: var(--big-number); font-weight: 700; text-align: center; border: 0; background: none; color: var(--text); }
  .unit { color: var(--text-2); }
  .step {
    width: 44px; height: 44px; border-radius: 50%; border: 0; background: var(--surface-2); color: var(--text);
    font-size: 1.5rem; line-height: 1; -webkit-touch-callout: none;
  }
  .step:active, .bars button:active { transform: scale(0.96); }
  .bars { display: flex; gap: 4px; margin: 12px 0; background: var(--surface-2); border-radius: 10px; padding: 2px; }
  .bars button { flex: 1; min-height: 44px; border: 0; border-radius: 8px; background: none; color: var(--text); font: inherit; font-size: 0.8125rem; }
  .bars button.on { background: var(--surface); font-weight: 600; }
  .drawing { width: 100%; height: auto; display: block; margin: 8px 0; }
  .sleeve { fill: var(--separator); }
  .plate { fill: var(--accent); }
  .per-side { font-size: 1.0625rem; font-weight: 600; margin: 0; }
  .dot { color: var(--text-2); }
  .result { color: var(--text-2); margin: 4px 0 0; }
  .empty { color: var(--text-2); }
  .num { font-variant-numeric: tabular-nums; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  @media (prefers-reduced-motion: reduce) { .step:active, .bars button:active { transform: none; } }
</style>
