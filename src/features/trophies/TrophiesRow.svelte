<!--
  Trophies row for Home (self-contained: loads its own data through api).
  One card per main lift: tier glyph in the tier color, tier name, best e1RM, e1RM/bodyweight ratio,
  and a bar with "N lb to <next tier>". Tap a card to open that lift's chart. A tier-up gets one short
  shimmer the first time this device shows it.
-->
<script lang="ts">
  import { api } from '../../db';
  import { go } from '../../lib/router';
  import { toLocalDate } from '../../lib/stats';
  import { load } from '../progress/load';
  import TrophyGlyph from './TrophyGlyph.svelte';
  import { buildTrophy, isTierUp, sortMainLifts, type TrophyView } from './trophy';

  const TIER_VARS = ['--tier-bronze', '--tier-silver', '--tier-gold', '--tier-platinum', '--tier-diamond'];
  const SEEN = 'lift-log:trophy-tiers-seen';
  const today = toLocalDate(new Date());

  const data = load(async () => {
    const [exercises, settings, weighIns] = await Promise.all([api.listExercises(), api.getSettings(), api.listBodyweight()]);
    const mains = sortMainLifts(exercises.filter((e) => e.isMain));
    const histories = await Promise.all(mains.map((e) => api.setHistory(e.id)));
    return mains.map((e, i) => buildTrophy(e, histories[i], weighIns, settings.trophyTiers, today));
  });

  // Tier-ups: compare with the tiers last shown on this device (a UI pref, so localStorage is fine).
  let shimmer: Record<string, boolean> = $state({});
  $effect(() => {
    if (data.value.status !== 'ok') return;
    let seen: Record<string, number> = {};
    try {
      seen = JSON.parse(localStorage.getItem(SEEN) ?? '{}');
    } catch {
      seen = {};
    }
    const next = { ...seen };
    const ups: Record<string, boolean> = {};
    for (const t of data.value.data) {
      if (!t.rank) continue;
      if (isTierUp(seen, t.exerciseId, t.rank.tier)) ups[t.exerciseId] = true;
      next[t.exerciseId] = t.rank.tier;
    }
    shimmer = ups;
    try {
      localStorage.setItem(SEEN, JSON.stringify(next));
    } catch {
      // Storage blocked: no shimmer memory this visit.
    }
  });

  const color = (t: TrophyView) => (t.rank && t.rank.tier >= 0 ? `var(${TIER_VARS[t.rank.tier]})` : 'var(--text-2)');
</script>

{#if data.value.status === 'error'}
  <p class="error" role="alert">Couldn't load trophies. Your data is still saved on this device. Close and reopen the app to try again.</p>
{:else if data.value.status === 'ok'}
  {#if !data.value.data.length}
    <p class="empty">No main lifts yet. Mark a lift as main in Settings to give it a trophy.</p>
  {:else}
    <ul class="row" aria-label="Trophies">
      {#each data.value.data as t (t.exerciseId)}
        <li class="card" class:shimmer={shimmer[t.exerciseId]} style:--tier={color(t)}>
          <button type="button" class="open" onclick={() => go(`progress/lift/${encodeURIComponent(t.exerciseId)}`)}
            aria-label="{t.name}: {t.rank?.tierName ?? (t.e1rm === undefined ? 'no sets yet' : 'not ranked')}. Open chart.">
            <span class="top">
              <span class="glyph"><TrophyGlyph size={22} /></span>
              <span class="tier">{t.rank?.tierName ?? (t.e1rm === undefined ? 'No sets' : '—')}</span>
            </span>
            <span class="name">{t.name}</span>
            {#if t.e1rm !== undefined}
              <span class="big num">{Math.round(t.e1rm)}<span class="unit"> lb e1RM</span></span>
            {:else}
              <span class="hint">Log {t.name} to rank</span>
            {/if}
            {#if t.rank}
              <span class="ratio num">{t.rank.ratio.toFixed(2)}× bodyweight</span>
              <span class="bar" aria-hidden="true"><span class="fill" style:width="{Math.round(t.rank.progress * 100)}%"></span></span>
              <span class="next num">{t.rank.next ? `${t.rank.next.lbToGo} lb to ${t.rank.next.name}` : 'Top tier'}</span>
            {:else if t.e1rm !== undefined && !t.tiers}
              <span class="hint">No tiers set</span>
            {/if}
          </button>
          {#if t.e1rm !== undefined && !t.bodyweight}
            <button type="button" class="add-bw" onclick={() => go('progress/body')}>Add bodyweight to rank</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .row {
    display: flex; gap: 10px; list-style: none; margin: 0 calc(-1 * var(--space)); padding: 2px var(--space) 6px;
    overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding: 0 var(--space); -webkit-overflow-scrolling: touch; scrollbar-width: none;
  }
  .row::-webkit-scrollbar { display: none; }
  .card {
    position: relative; flex: 0 0 158px; scroll-snap-align: start; display: flex; flex-direction: column;
    background: var(--surface); border-radius: var(--radius); overflow: hidden;
  }
  .open {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px; flex: 1; width: 100%; min-height: 44px;
    padding: 12px; border: 0; background: none; color: var(--text); font: inherit; text-align: left;
    -webkit-touch-callout: none; user-select: none; transition: transform 150ms;
  }
  .open:active { transform: scale(0.97); }
  .open:focus-visible, .add-bw:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: var(--radius); }
  .top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .glyph { display: flex; color: var(--tier); }
  .tier { font-size: 0.8125rem; font-weight: 600; }
  .name { font-size: 0.8125rem; color: var(--text-2); }
  .big { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; }
  .unit { font-size: 0.75rem; font-weight: 500; color: var(--text-2); letter-spacing: 0; }
  .ratio, .next, .hint { font-size: 0.75rem; color: var(--text-2); }
  .bar { display: block; width: 100%; height: 4px; margin: 6px 0 4px; background: var(--surface-2); border-radius: 2px; overflow: hidden; }
  .fill { display: block; height: 100%; background: var(--tier); border-radius: 2px; }
  .add-bw {
    min-height: 44px; margin: 0; padding: 0 12px; border: 0; border-top: 1px solid var(--separator); background: none;
    color: var(--accent); font: inherit; font-size: 0.8125rem; font-weight: 600; text-align: left;
  }
  .empty, .error { margin: 0; color: var(--text-2); font-size: 0.9375rem; }
  .error { color: var(--danger); }

  /* Tier-up: one short pass of a solid translucent band (no gradient), then the glyph settles. */
  .shimmer::after {
    content: ''; position: absolute; inset: -20% auto -20% 0; width: 40%; pointer-events: none;
    background: rgb(255 255 255 / 0.35); transform: translateX(-150%) skewX(-20deg);
    animation: sweep 900ms cubic-bezier(0.22, 1, 0.36, 1) 300ms 1 both;
  }
  .shimmer .glyph { animation: pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 300ms 1 both; }
  @keyframes sweep { to { transform: translateX(400%) skewX(-20deg); } }
  @keyframes pop { 50% { transform: scale(1.18); } }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .shimmer::after { display: none; }
    .shimmer .glyph, .shimmer .tier { animation: fade 400ms ease-out 1 both; }
  }
  @media (prefers-color-scheme: dark) {
    .shimmer::after { background: rgb(255 255 255 / 0.12); }
  }
</style>
