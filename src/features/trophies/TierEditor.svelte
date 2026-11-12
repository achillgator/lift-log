<!--
  Trophy tier editor for Settings (self-contained: loads and saves through api).
  Five thresholds (x bodyweight) per main lift. A valid change saves immediately; an invalid one
  shows why and is not saved. Reset restores the SPEC defaults, with Undo.
-->
<script lang="ts">
  import { api, type Exercise, type TrophyTiers } from '../../db';
  import { TIER_NAMES, validTiers, type Tiers } from '../../lib/stats';
  import { load } from '../progress/load';
  import { DEFAULT_TIERS, mainLiftOf, sortMainLifts, tiersFor } from './trophy';

  const TIER_VARS = ['--tier-bronze', '--tier-silver', '--tier-gold', '--tier-platinum', '--tier-diamond'];

  const data = load(async () => {
    const [exercises, settings] = await Promise.all([api.listExercises(), api.getSettings()]);
    return { lifts: sortMainLifts(exercises.filter((e) => e.isMain)), stored: settings.trophyTiers ?? {} };
  });

  // Text being edited, keyed by `${exerciseId}:${index}`; cleared once saved.
  let drafts: Record<string, string> = $state({});
  let errors: Record<string, string> = $state({});
  let undo: { exerciseId: string; key: string; previous: Tiers | undefined } | undefined = $state();
  let saveError = $state('');

  function current(ex: Exercise, stored: TrophyTiers) {
    return tiersFor(ex, stored);
  }

  async function write(stored: TrophyTiers, key: string, tiers: Tiers | undefined) {
    const next = { ...stored };
    if (tiers) next[key] = tiers;
    else delete next[key];
    try {
      await api.updateSettings({ trophyTiers: next });
      saveError = '';
      return true;
    } catch (e) {
      saveError = `Couldn't save tiers. Your other settings are safe. Try again. (${e instanceof Error ? e.message : String(e)})`;
      return false;
    }
  }

  async function edit(ex: Exercise, stored: TrophyTiers, index: number, text: string) {
    const found = current(ex, stored);
    const base: number[] = [...(found?.tiers ?? [1, 1.25, 1.5, 1.75, 2])];
    const v = Number(text.replace(',', '.'));
    base[index] = v;
    drafts[`${ex.id}:${index}`] = text;
    if (!validTiers(base)) {
      errors[ex.id] = 'Each tier must be a number above 0 and higher than the one before it.';
      return;
    }
    delete errors[ex.id];
    undo = undefined;
    if (await write(stored, found?.key ?? ex.id, base)) {
      for (let i = 0; i < 5; i++) delete drafts[`${ex.id}:${i}`];
    }
  }

  async function reset(ex: Exercise, stored: TrophyTiers) {
    const slug = mainLiftOf(ex.name);
    const found = current(ex, stored);
    if (!slug || !found) return;
    const previous = found.isDefault ? undefined : found.tiers;
    for (let i = 0; i < 5; i++) delete drafts[`${ex.id}:${i}`];
    delete errors[ex.id];
    if (await write(stored, found.key, DEFAULT_TIERS[slug])) undo = { exerciseId: ex.id, key: found.key, previous };
  }

  async function undoReset(stored: TrophyTiers) {
    if (!undo) return;
    const u = undo;
    undo = undefined;
    await write(stored, u.key, u.previous);
  }

  const same = (a: readonly number[], b: readonly number[]) => a.every((v, i) => v === b[i]);
</script>

<section class="tiers" aria-labelledby="tier-editor-title">
  <h2 id="tier-editor-title">Trophy tiers</h2>
  <p class="note">Best e1RM ÷ bodyweight needed for each tier. Rough rules of thumb, not population data.</p>

  {#if data.value.status === 'error'}
    <p class="error" role="alert">Couldn't load trophy tiers. Your data is still saved on this device. Close and reopen the app to try again.</p>
  {:else if data.value.status === 'ok'}
    {@const stored = data.value.data.stored}
    {#if !data.value.data.lifts.length}
      <p class="note">No main lifts yet. Mark a lift as main to give it a trophy and tiers.</p>
    {/if}
    {#each data.value.data.lifts as ex (ex.id)}
      {@const found = current(ex, stored)}
      {@const slug = mainLiftOf(ex.name)}
      <div class="group">
        <div class="lift">
          <h3>{ex.name}</h3>
          {#if slug && found && !same(found.tiers, DEFAULT_TIERS[slug])}
            <button type="button" class="link" onclick={() => reset(ex, stored)}>Reset</button>
          {/if}
        </div>
        {#each TIER_NAMES as tier, i}
          <label class="row">
            <span class="tier"><span class="dot" style:background="var({TIER_VARS[i]})"></span>{tier}</span>
            <span class="field">
              <input
                class="num"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                value={drafts[`${ex.id}:${i}`] ?? (found ? found.tiers[i].toFixed(2) : '')}
                aria-invalid={!!errors[ex.id]}
                onchange={(e) => edit(ex, stored, i, e.currentTarget.value)}
              />
              <span class="unit">× bw</span>
            </span>
          </label>
        {/each}
        {#if errors[ex.id]}<p class="error" role="alert">{errors[ex.id]}</p>{/if}
        {#if undo?.exerciseId === ex.id}
          <p class="undo" role="status">Reset {ex.name} to defaults. <button type="button" class="link" onclick={() => undoReset(stored)}>Undo</button></p>
        {/if}
      </div>
    {/each}
    {#if saveError}<p class="error" role="alert">{saveError}</p>{/if}
  {/if}
</section>

<style>
  h2 { font-size: 1.0625rem; font-weight: 600; margin: 0 0 4px; }
  .note { margin: 0 0 12px; color: var(--text-2); font-size: 0.8125rem; }
  .group { background: var(--surface); border-radius: var(--radius); margin-bottom: 16px; overflow: hidden; }
  .lift { display: flex; align-items: center; justify-content: space-between; padding: 10px var(--space) 4px; }
  h3 { font-size: 0.9375rem; font-weight: 600; margin: 0; }
  .row {
    display: flex; align-items: center; justify-content: space-between; min-height: 44px; margin-left: var(--space);
    padding-right: var(--space); border-top: 1px solid var(--separator);
  }
  .tier { display: flex; align-items: center; gap: 8px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .field { display: flex; align-items: baseline; gap: 4px; }
  input {
    width: 4.5ch; border: 0; background: none; color: var(--text); text-align: right; padding: 8px 0;
    font: inherit; font-size: 1rem;
  }
  input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  input[aria-invalid='true'] { color: var(--danger); }
  .unit { color: var(--text-2); font-size: 0.875rem; }
  .link { min-height: 44px; padding: 0 4px; border: 0; background: none; color: var(--accent); font: inherit; font-size: 0.9375rem; font-weight: 600; }
  .link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .error { margin: 0; padding: 8px var(--space); color: var(--danger); font-size: 0.8125rem; }
  .undo { margin: 0; padding: 0 var(--space); display: flex; align-items: center; justify-content: space-between; color: var(--text-2); font-size: 0.875rem; border-top: 1px solid var(--separator); }
</style>
