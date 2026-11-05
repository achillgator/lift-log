<script lang="ts">
  // Preview an import (backup or program), then merge or replace. Replace is the one bulk
  // destructive action here, so it asks to confirm.
  import type { ImportMode, ImportPreview } from '../../db/types';
  import Sheet from '../../components/Sheet.svelte';
  import Button from '../../components/Button.svelte';
  import Banner from '../../components/Banner.svelte';
  import ListGroup from '../../components/ListGroup.svelte';
  import { describeCounts } from './settings';

  interface Props {
    title: string;
    fileName: string;
    preview: ImportPreview;
    replaceWarning: string;
    onimport: (mode: ImportMode) => Promise<void>;
    onclose: () => void;
  }
  let { title, fileName, preview, replaceWarning, onimport, onclose }: Props = $props();
  let confirming = $state(false);
  let busy = $state(false);

  async function run(mode: ImportMode) {
    busy = true;
    try {
      await onimport(mode);
    } finally {
      busy = false;
    }
  }
</script>

<Sheet {title} {onclose}>
  <p class="footnote file">{fileName}</p>
  {#if preview.valid}
    <Banner title="File looks good" message={describeCounts(preview)} />
  {:else}
    <Banner tone="danger" title="Can't import this file" message="Nothing was changed. Check that it is a Lift Log file and try again." />
  {/if}
  {#if preview.errors.length}
    <ListGroup header="Problems">
      {#each preview.errors as e, i (i)}<p class="err">{e}</p>{/each}
    </ListGroup>
  {/if}

  {#if preview.valid}
    {#if confirming}
      <div class="confirm" role="alertdialog" aria-label="Confirm replace">
        <p><strong>Replace?</strong> {replaceWarning}</p>
        <div class="row-gap">
          <Button onclick={() => (confirming = false)}>Cancel</Button>
          <Button variant="primary" disabled={busy} onclick={() => run('replace')}>Replace</Button>
        </div>
      </div>
    {:else}
      <div class="stack">
        <Button variant="primary" block disabled={busy} onclick={() => run('merge')}>Merge with what's here</Button>
        <Button variant="danger" block disabled={busy} onclick={() => (confirming = true)}>Replace…</Button>
      </div>
    {/if}
  {/if}
</Sheet>

<style>
  .file { margin-bottom: 12px; word-break: break-all; }
  .err { margin: 0; padding: 10px var(--space); border-top: 1px solid var(--separator); color: var(--danger); font-size: 0.9375rem; }
  .err:first-child { border-top: 0; }
  .confirm { padding: var(--space); background: var(--surface); border-radius: var(--radius); }
  .confirm p { margin: 0 0 12px; }
</style>
