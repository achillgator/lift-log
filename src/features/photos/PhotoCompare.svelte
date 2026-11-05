<!-- Side-by-side compare of one pose on two dates (v2). -->
<script lang="ts">
  import type { Photo } from '../../db/types';
  import { createBlobUrls } from './blobUrls';
  import { compareDefaults, datesWithPose, findPhoto, POSE_LABELS, POSES } from '../../lib/later/photos';
  import { diffDays, formatShort } from '../../lib/later/dates';

  let { photos, onclose }: { photos: Photo[]; onclose?: () => void } = $props();

  // Start on the pose with the most dates.
  // svelte-ignore state_referenced_locally
  let pose = $state<Photo['pose']>([...POSES].sort((a, b) => datesWithPose(photos, b).length - datesWithPose(photos, a).length)[0]);
  const dates = $derived(datesWithPose(photos, pose));
  let before = $state<string | undefined>();
  let after = $state<string | undefined>();

  // New pose: reset to its oldest and newest dates.
  $effect(() => {
    const d = compareDefaults(dates);
    before = d.before;
    after = d.after;
  });

  const urls = createBlobUrls();
  $effect(() => () => urls.clear());

  const left = $derived(findPhoto(photos, before, pose));
  const right = $derived(findPhoto(photos, after, pose));
  const gap = $derived(before && after ? Math.abs(diffDays(before, after)) : 0);
  const gapLabel = $derived(gap >= 14 ? `${Math.round(gap / 7)} weeks apart` : gap > 0 ? `${gap} day${gap === 1 ? '' : 's'} apart` : '');
</script>

<section aria-labelledby="compare-title">
  <header>
    <h2 id="compare-title">Compare</h2>
    {#if onclose}<button class="text" onclick={onclose}>Done</button>{/if}
  </header>

  <div class="segmented" role="radiogroup" aria-label="Pose">
    {#each POSES as p}
      <button role="radio" aria-checked={pose === p} class:on={pose === p} onclick={() => (pose = p)}>{POSE_LABELS[p]}</button>
    {/each}
  </div>

  {#if dates.length < 2}
    <p class="empty">Add {POSE_LABELS[pose].toLowerCase()} photos on two dates to compare them.</p>
  {:else}
    <div class="pair">
      {#each [{ label: 'Before', photo: left }, { label: 'After', photo: right }] as side, i}
        <figure>
          {#if side.photo}
            <img src={urls.get(side.photo.image)} alt="{POSE_LABELS[pose]} photo, {formatShort(side.photo.date)}" />
          {/if}
          <figcaption>
            <label>
              <span class="sr">{side.label} date</span>
              {#if i === 0}
                <select bind:value={before}>{#each dates as d}<option value={d}>{formatShort(d)}</option>{/each}</select>
              {:else}
                <select bind:value={after}>{#each dates as d}<option value={d}>{formatShort(d)}</option>{/each}</select>
              {/if}
            </label>
          </figcaption>
        </figure>
      {/each}
    </div>
    {#if gapLabel}<p class="gap num">{gapLabel}</p>{/if}
  {/if}
</section>

<style>
  header { display: flex; align-items: baseline; justify-content: space-between; }
  h2 { font-size: 1.25rem; margin: 0 0 12px; }
  .segmented { display: flex; gap: 2px; background: var(--surface-2); border-radius: 10px; padding: 2px; margin-bottom: 12px; }
  .segmented button { flex: 1; min-height: 44px; border: 0; border-radius: 8px; background: none; color: var(--text); font: inherit; font-size: 0.9375rem; }
  .segmented button.on { background: var(--surface); font-weight: 600; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  figure { margin: 0; }
  img { display: block; width: 100%; aspect-ratio: 3 / 4; object-fit: cover; border-radius: var(--radius); background: var(--surface-2); }
  select { width: 100%; min-height: 44px; margin-top: 4px; border: 0; background: none; color: var(--text); font: inherit; font-size: 1rem; text-align: center; }
  .gap { text-align: center; color: var(--text-2); font-size: 0.875rem; margin: 8px 0 0; }
  .empty { color: var(--text-2); }
  .text { min-height: 44px; padding: 0 8px; border: 0; background: none; color: var(--accent); font: inherit; }
  .num { font-variant-numeric: tabular-nums; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
