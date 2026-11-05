<!-- Progress photos (v2): add front/side/back, grid by date, compare two dates, zip export. -->
<script lang="ts">
  import Camera from 'lucide-svelte/icons/camera';
  import type { Photo } from '../../db/types';
  import type { PhotoStore } from './adapter';
  import { createBlobUrls } from './blobUrls';
  import { compressPhoto } from './compress';
  import { buildPhotoZip } from './exportZip';
  import { shareOrDownload } from './share';
  import PhotoCompare from './PhotoCompare.svelte';
  import { findPhoto, formatBytes, groupByDate, photoBytes, POSE_LABELS, POSES } from '../../lib/later/photos';
  import { formatShort, todayLocal } from '../../lib/later/dates';

  let { store, today = todayLocal() }: { store: PhotoStore; today?: string } = $props();

  // Raw state: Blobs and rows go back to IndexedDB as they are, never as proxies.
  let photos = $state.raw<Photo[]>([]);
  let loaded = $state(false);
  // svelte-ignore state_referenced_locally
  let date = $state(today);
  let busy = $state('');
  let error = $state('');
  let notice = $state('');
  let viewing = $state.raw<Photo | undefined>();
  let comparing = $state(false);
  let exportFile = $state.raw<File | undefined>();
  let undo = $state.raw<{ label: string; run: () => Promise<void> } | undefined>();
  let undoTimer: ReturnType<typeof setTimeout> | undefined;

  const urls = createBlobUrls();
  const days = $derived(groupByDate(photos));
  const bytes = $derived(photoBytes(photos));

  async function reload() {
    try {
      photos = await store.list();
      urls.keepOnly(photos.flatMap((p) => [p.thumb, p.image]));
    } catch {
      error = 'Could not read your photos. They are still on this device. Close and reopen the app.';
    }
    loaded = true;
  }

  $effect(() => {
    void store;
    reload();
    return () => urls.clear();
  });

  function showUndo(label: string, run: () => Promise<void>) {
    clearTimeout(undoTimer);
    undo = { label, run };
    undoTimer = setTimeout(() => (undo = undefined), 6000);
  }

  async function runUndo() {
    const u = undo;
    undo = undefined;
    clearTimeout(undoTimer);
    try {
      await u?.run();
    } catch {
      error = 'Could not undo. Your photos are safe.';
    }
    await reload();
  }

  async function pick(pose: Photo['pose'], input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    error = '';
    notice = '';
    exportFile = undefined;
    busy = `Saving ${POSE_LABELS[pose].toLowerCase()} photo…`;
    try {
      const { image, thumb } = await compressPhoto(file);
      const existing = findPhoto(photos, date, pose);
      const next: Photo = { id: crypto.randomUUID(), date, pose, image, thumb };
      await store.save(next);
      if (existing) {
        await store.remove(existing.id);
        showUndo(`Replaced the ${pose} photo for ${formatShort(date)}`, async () => {
          await store.save(existing);
          await store.remove(next.id);
        });
      }
    } catch (e) {
      error = `${e instanceof Error ? e.message : 'Could not save that photo.'} Your other photos are safe.`;
    } finally {
      busy = '';
    }
    await reload();
  }

  async function remove(photo: Photo) {
    viewing = undefined;
    exportFile = undefined;
    try {
      await store.remove(photo.id);
      showUndo(`Deleted the ${photo.pose} photo for ${formatShort(photo.date)}`, () => store.save(photo));
    } catch {
      error = 'Could not delete that photo. It is still saved.';
    }
    await reload();
  }

  async function prepareExport() {
    error = '';
    notice = '';
    busy = 'Preparing export…';
    try {
      exportFile = await buildPhotoZip(photos, todayLocal());
    } catch (e) {
      error = `${e instanceof Error ? e.message : 'Could not build the export.'} Your photos are safe.`;
    } finally {
      busy = '';
    }
  }

  async function share() {
    if (!exportFile) return;
    const result = await shareOrDownload(exportFile);
    if (result !== 'cancelled') {
      notice = result === 'shared' ? 'Export shared.' : `Downloaded ${exportFile.name}.`;
      exportFile = undefined;
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') viewing = undefined;
  }
</script>

<svelte:window onkeydown={keydown} />

{#if comparing}
  <PhotoCompare {photos} onclose={() => (comparing = false)} />
{:else}
  <section aria-labelledby="photos-title">
    <header>
      <h2 id="photos-title">Photos</h2>
      {#if days.length > 1}<button class="text" onclick={() => (comparing = true)}>Compare</button>{/if}
    </header>
    <p class="note">Photos stay on this device and are left out of the backup file. Export them separately.</p>

    <div class="group add">
      <label class="date">
        <span>Date</span>
        <input type="date" bind:value={date} max={today} />
      </label>
      <div class="poses">
        {#each POSES as pose}
          <label class="pose" class:disabled={!!busy}>
            <Camera size={18} aria-hidden="true" />
            <span>{POSE_LABELS[pose]}</span>
            <input class="sr" type="file" accept="image/*" disabled={!!busy} onchange={(e) => pick(pose, e.currentTarget)} />
          </label>
        {/each}
      </div>
    </div>

    {#if busy}<p class="status" role="status">{busy}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if notice}<p class="status" role="status">{notice}</p>{/if}

    {#if loaded && days.length === 0}
      <p class="empty">Add a front, side or back photo to start.</p>
    {:else}
      {#each days as day (day.date)}
        <h3>{formatShort(day.date)}</h3>
        <div class="grid">
          {#each POSES as pose}
            {@const photo = day.poses[pose]}
            {#if photo}
              <button class="thumb" onclick={() => (viewing = photo)} aria-label="Open {pose} photo, {formatShort(day.date)}">
                <img src={urls.get(photo.thumb)} alt="" loading="lazy" />
              </button>
            {:else}
              <div class="thumb missing" aria-hidden="true">{POSE_LABELS[pose]}</div>
            {/if}
          {/each}
        </div>
      {/each}

      {#if photos.length > 0}
        <div class="export">
          <span class="note num">{photos.length} photo{photos.length === 1 ? '' : 's'} · {formatBytes(bytes)}</span>
          {#if exportFile}
            <button class="primary" onclick={share}>Share {exportFile.name}</button>
          {:else}
            <button class="text" disabled={!!busy} onclick={prepareExport}>Export photos</button>
          {/if}
        </div>
      {/if}
    {/if}
  </section>
{/if}

{#if viewing}
  <div class="viewer" role="dialog" aria-modal="true" aria-label="{POSE_LABELS[viewing.pose]} photo, {formatShort(viewing.date)}">
    <img src={urls.get(viewing.image)} alt="{POSE_LABELS[viewing.pose]} photo, {formatShort(viewing.date)}" />
    <div class="bar">
      <button class="text danger" onclick={() => viewing && remove(viewing)}>Delete</button>
      <span>{POSE_LABELS[viewing.pose]} · {formatShort(viewing.date)}</span>
      <button class="text" onclick={() => (viewing = undefined)}>Close</button>
    </div>
  </div>
{/if}

{#if undo}
  <div class="undo" role="status"><span>{undo.label}</span><button class="text" onclick={runUndo}>Undo</button></div>
{/if}

<style>
  header { display: flex; align-items: baseline; justify-content: space-between; }
  h2 { font-size: 1.25rem; margin: 0 0 4px; }
  h3 { font-size: 0.8125rem; font-weight: 600; color: var(--text-2); margin: 20px 0 6px; }
  .note { color: var(--text-2); font-size: 0.875rem; margin: 0 0 12px; }
  .group { background: var(--surface); border-radius: var(--radius); overflow: hidden; }
  .date { display: flex; align-items: center; justify-content: space-between; min-height: var(--row-height); padding: 0 16px; border-bottom: 1px solid var(--separator); }
  .date input { border: 0; background: none; color: var(--text); font: inherit; font-size: 1rem; min-height: 44px; text-align: right; }
  .poses { display: grid; grid-template-columns: repeat(3, 1fr); }
  .pose { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 52px; color: var(--accent); }
  .pose + .pose { border-left: 1px solid var(--separator); }
  .pose:active { background: var(--surface-2); }
  .pose:focus-within { outline: 2px solid var(--accent); outline-offset: -2px; }
  .pose.disabled { color: var(--text-2); }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .thumb { aspect-ratio: 3 / 4; padding: 0; border: 0; border-radius: 8px; overflow: hidden; background: var(--surface-2); }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .missing { display: grid; place-items: center; color: var(--text-2); font-size: 0.75rem; opacity: 0.6; }
  .export { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 20px; }
  .export .note { margin: 0; }
  .status { color: var(--text-2); font-size: 0.875rem; }
  .error { color: var(--danger); font-size: 0.875rem; }
  .empty { color: var(--text-2); }
  .text { min-height: 44px; padding: 0 8px; border: 0; background: none; color: var(--accent); font: inherit; }
  .text:disabled { color: var(--text-2); }
  .text.danger { color: var(--danger); }
  .primary { min-height: 44px; padding: 0 16px; border: 0; border-radius: 10px; background: var(--accent); color: var(--surface); font: inherit; font-weight: 600; }
  .primary:active, .text:active { transform: scale(0.97); }
  .viewer {
    position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; background: var(--bg);
    padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
  }
  .viewer img { flex: 1; min-height: 0; width: 100%; object-fit: contain; }
  .viewer .bar { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; }
  .undo {
    position: fixed; left: 16px; right: 16px; bottom: calc(72px + env(safe-area-inset-bottom)); z-index: 30;
    display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 4px 16px;
    background: var(--text); color: var(--bg); border-radius: var(--radius);
  }
  .undo .text { color: var(--bg); font-weight: 600; }
  .num { font-variant-numeric: tabular-nums; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); opacity: 0; }
  @media (prefers-reduced-motion: reduce) { .primary:active, .text:active { transform: none; } }
</style>
