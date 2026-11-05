<script lang="ts">
  import Button from './Button.svelte';
  import ListGroup from './ListGroup.svelte';
  import { toasts } from './toast.svelte';
  import { TWEAKS, applyTweaks, changedCss, loadTweaks, readDefaults, saveTweaks, type TweakValues } from './tweaks';

  const defaults: TweakValues = readDefaults();
  let values = $state<TweakValues>(loadTweaks());
  let copied = $state('');

  function current(token: string): string {
    return values[token] ?? (TWEAKS.find((t) => t.token === token)?.type === 'warmth' ? '0' : defaults[token]);
  }

  function set(token: string, value: string) {
    const next = { ...values, [token]: value };
    if (value === defaults[token] || (token === '--bg' && value === '0')) delete next[token];
    values = next;
    saveTweaks(values);
    applyTweaks(values, defaults);
  }

  function reset() {
    values = {};
    saveTweaks(values);
    applyTweaks(values, defaults);
    copied = '';
  }

  async function copy() {
    const css = changedCss(values, defaults);
    if (!css) {
      toasts.show('Nothing changed yet.');
      return;
    }
    copied = css;
    try {
      await navigator.clipboard.writeText(css);
      toasts.show('Changed values copied as CSS.');
    } catch {
      toasts.show('Clipboard unavailable: copy the CSS below.');
    }
  }

  const rangeValue = (token: string) => parseFloat(current(token)) || 0;
</script>

<ListGroup header="Tweaks (dev only)" footer="Stored in this browser only. Copy values, then lock them into tokens.css and DESIGN.md.">
  {#each TWEAKS as t (t.token)}
    <label class="tweak">
      <span class="name">{t.label}<code>{t.token}</code></span>
      {#if t.type === 'color'}
        <input type="color" value={current(t.token)} oninput={(e) => set(t.token, e.currentTarget.value)} />
      {:else if t.type === 'select'}
        <select value={current(t.token)} onchange={(e) => set(t.token, e.currentTarget.value)}>
          {#each t.options ?? [] as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
        </select>
      {:else if t.type === 'warmth'}
        <span class="range">
          <input type="range" min={t.min} max={t.max} step={t.step} value={rangeValue(t.token)} oninput={(e) => set(t.token, e.currentTarget.value)} />
          <output class="num">{current(t.token)}</output>
        </span>
      {:else}
        <span class="range">
          <input type="range" min={t.min} max={t.max} step={t.step} value={rangeValue(t.token)} oninput={(e) => set(t.token, `${e.currentTarget.value}${t.unit ?? ''}`)} />
          <output class="num">{current(t.token)}</output>
        </span>
      {/if}
    </label>
  {/each}
</ListGroup>
<div class="row-gap actions">
  <Button onclick={reset}>Reset</Button>
  <Button variant="primary" onclick={copy}>Copy values</Button>
</div>
{#if copied}<pre class="copied">{copied}</pre>{/if}

<style>
  .tweak {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 52px;
    padding: 4px var(--space);
    border-top: 1px solid var(--separator);
  }
  .tweak:first-child { border-top: 0; }
  .name { display: flex; flex-direction: column; font-size: 0.9375rem; }
  code { font-size: 0.75rem; color: var(--text-2); }
  .range { display: flex; align-items: center; gap: 8px; }
  input[type='range'] { width: 130px; min-height: 44px; accent-color: var(--accent); }
  input[type='color'] { width: 52px; height: 36px; border: 1px solid var(--separator); border-radius: 8px; background: none; padding: 2px; }
  select { width: auto; max-width: 160px; }
  output { min-width: 5ch; text-align: right; font-size: 0.8125rem; color: var(--text-2); }
  .actions { margin: -12px 0 24px; }
  .copied { padding: 12px; background: var(--surface); border-radius: var(--radius); font-size: 0.8125rem; overflow-x: auto; user-select: text; }
</style>
