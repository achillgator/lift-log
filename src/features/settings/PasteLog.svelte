<script lang="ts">
  // Paste log: paste text from notes, preview what will be saved (with line errors), then save.
  import { api } from '../../db';
  import type { ImportPreview } from '../../db/types';
  import { go } from '../../lib/router';
  import ListGroup from '../../components/ListGroup.svelte';
  import Button from '../../components/Button.svelte';
  import Banner from '../../components/Banner.svelte';
  import { showError, toasts } from '../../components/toast.svelte';
  import BackHeader from '../routines/BackHeader.svelte';
  import { describeCounts } from './settings';

  let text = $state('');
  let preview = $state<ImportPreview | undefined>();
  let previewedText = $state('');
  let busy = $state(false);

  async function check() {
    busy = true;
    try {
      preview = await api.previewPasteLog(text);
      previewedText = text;
    } catch (err) {
      showError("Couldn't read the pasted log.", err, 'Check the text and preview again.');
    } finally {
      busy = false;
    }
  }

  async function save() {
    busy = true;
    try {
      await api.savePasteLog(text);
      toasts.show(`Saved: ${preview ? describeCounts(preview) : 'pasted log'}.`);
      text = '';
      preview = undefined;
      go('history');
    } catch (err) {
      showError("Couldn't save the pasted log.", err, 'Nothing from it was saved; try again.');
    } finally {
      busy = false;
    }
  }
</script>

<div class="screen">
  <BackHeader href="#/settings" label="Settings" />
  <h1 class="title-large">Paste log</h1>
  <p class="footnote intro">Paste workouts written as text. Preview shows what will be saved before anything changes.</p>
  <textarea aria-label="Pasted log" rows="10" bind:value={text} oninput={() => (preview = undefined)} placeholder="Paste here"></textarea>
  <div class="row-gap actions">
    <Button disabled={!text.trim() || busy} onclick={check}>Preview</Button>
    <Button variant="primary" disabled={!preview?.valid || busy || text !== previewedText} onclick={save}>Save</Button>
  </div>

  {#if preview}
    {#if preview.valid}
      <Banner title="Ready to save" message={describeCounts(preview)} />
    {:else}
      <Banner tone="danger" title="Can't save this yet" message="Fix the lines below and preview again. Nothing has been saved." />
    {/if}
    {#if preview.errors.length}
      <ListGroup header="Problems">
        {#each preview.errors as e, i (i)}<p class="err">{e}</p>{/each}
      </ListGroup>
    {/if}
  {/if}
</div>

<style>
  .intro { margin-bottom: 12px; }
  textarea { font-family: ui-monospace, SFMono-Regular, monospace; user-select: text; }
  .actions { margin: 12px 0 24px; }
  .err { margin: 0; padding: 10px var(--space); border-top: 1px solid var(--separator); color: var(--danger); font-size: 0.9375rem; }
  .err:first-child { border-top: 0; }
</style>
