<script lang="ts">
  import { api } from '../../db';
  import type { ImportMode, ImportPreview, Settings, StorageStatus } from '../../db/types';
  import { currentRoute, onRouteChange } from '../../lib/router';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import Switch from '../../components/Switch.svelte';
  import Banner from '../../components/Banner.svelte';
  import { formatBytes, formatDate, toISODate } from '../../components/format';
  import { query } from '../../components/query.svelte';
  import { showError, toasts } from '../../components/toasts.svelte';
  import RoutineList from '../routines/RoutineList.svelte';
  import RoutineEditor from '../routines/RoutineEditor.svelte';
  import QuickAddList from '../routines/QuickAddList.svelte';
  import QuickAddEditor from '../routines/QuickAddEditor.svelte';
  import ExerciseList from './ExerciseList.svelte';
  import ExerciseEditor from './ExerciseEditor.svelte';
  import WorkingWeights from './WorkingWeights.svelte';
  import Maxes from './Maxes.svelte';
  import TierEditor from '../trophies/TierEditor.svelte';
  import PasteLog from './PasteLog.svelte';
  import ImportSheet from './ImportSheet.svelte';
  import { exportBackup, exportProgramFile, exportSetsCsv } from './files';

  // Sub-pages live under #/settings/<page>/<id>.
  let route = $state(currentRoute());
  $effect(() => onRouteChange((next) => (route = next)));
  const parts = $derived(route.split('/'));
  const page = $derived(parts[1] ?? '');
  const id = $derived(parts[2]);

  const settings = query<Settings | undefined>(() => api.getSettings(), undefined);
  let storage = $state<StorageStatus | undefined>();
  let storageError = $state(false);
  let autoOverride = $state<boolean | undefined>();
  let importing = $state<{ kind: 'backup' | 'program'; file: File; preview: ImportPreview } | undefined>();
  let backupInput = $state<HTMLInputElement>();
  let programInput = $state<HTMLInputElement>();

  $effect(() => {
    if (page) return;
    api.storageStatus().then((s) => (storage = s), () => (storageError = true));
  });

  async function setAuto(on: boolean) {
    autoOverride = on;
    try {
      await api.updateSettings({ autoIncreaseGlobal: on });
    } catch (err) {
      autoOverride = undefined;
      showError("Couldn't change auto-increase.", err);
    }
  }

  async function run(what: string, fn: () => Promise<boolean>, done: string) {
    try {
      if (await fn()) toasts.show(done);
    } catch (err) {
      showError(`Couldn't ${what}.`, err);
    }
  }

  async function pick(kind: 'backup' | 'program', e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const preview = kind === 'backup' ? await api.previewImport(file) : await api.previewProgram(file);
      importing = { kind, file, preview };
    } catch (err) {
      showError("Couldn't read that file.", err, 'Nothing was changed. Pick a Lift Log file and try again.');
    }
  }

  async function doImport(mode: ImportMode) {
    if (!importing) return;
    const { kind, file } = importing;
    try {
      if (kind === 'backup') await api.importJson(file, mode);
      else await api.importProgram(file, mode);
      importing = undefined;
      toasts.show(`${kind === 'backup' ? 'Backup' : 'Program'} imported (${mode}).`);
    } catch (err) {
      showError('Import failed.', err, 'Your existing data was not changed by this import; try again.');
    }
  }

  const lastExport = $derived(settings.value?.lastExportAt ? formatDate(toISODate(new Date(settings.value.lastExportAt))) : 'Never');
  const storageText = $derived(
    storageError ? 'Unknown' : storage ? `${storage.persisted ? 'Kept' : 'May be cleared'} · ${formatBytes(storage.usageBytes)} used` : '…',
  );
</script>

{#key route}
  {#if page === 'routines' && id}<RoutineEditor {id} />
  {:else if page === 'routines'}<RoutineList />
  {:else if page === 'quick-adds' && id}<QuickAddEditor {id} />
  {:else if page === 'quick-adds'}<QuickAddList />
  {:else if page === 'exercises' && id}<ExerciseEditor {id} />
  {:else if page === 'exercises'}<ExerciseList />
  {:else if page === 'weights'}<WorkingWeights />
  {:else if page === 'maxes'}<Maxes />
  {:else if page === 'paste-log'}<PasteLog />
  {:else}
    <div class="screen">
      <h1 class="title-large">Settings</h1>
      {#if settings.error}
        <Banner tone="danger" title="Couldn't load settings" message="Nothing was lost. Close and reopen the app. ({settings.error})" />
      {/if}

      <ListGroup header="Training">
        <ListRow label="Routines" href="#/settings/routines" />
        <ListRow label="Exercises" detail="Including auto-increase per exercise" href="#/settings/exercises" />
        <ListRow label="Quick-adds" href="#/settings/quick-adds" />
        <ListRow label="Auto-increase" detail="Raise targets after a successful workout">
          {#snippet trailing()}
            <Switch label="Auto-increase" checked={autoOverride ?? settings.value?.autoIncreaseGlobal ?? false} disabled={!settings.value} onchange={setAuto} />
          {/snippet}
        </ListRow>
        <ListRow label="Working weights" href="#/settings/weights" />
        <ListRow label="Tested maxes" href="#/settings/maxes" />
      </ListGroup>

      <TierEditor />

      <ListGroup header="Backup" footer="Last backup: {lastExport}. Backups stay on this device until you save them somewhere, like Files or iCloud Drive.">
        <ListRow label="Export backup (JSON)" tone="accent" chevron={false} onclick={() => run('export the backup', exportBackup, 'Backup exported.')} />
        <ListRow label="Export sets (CSV)" tone="accent" chevron={false} onclick={() => run('export the CSV', exportSetsCsv, 'CSV exported.')} />
        <ListRow label="Import backup…" tone="accent" chevron={false} onclick={() => backupInput?.click()} />
        <ListRow label="Paste log" href="#/settings/paste-log" />
      </ListGroup>

      <ListGroup header="Program" footer="A program file holds routines, exercises, quick-adds and rules, never your logged workouts.">
        <ListRow label="Export program" tone="accent" chevron={false} onclick={() => run('export the program', exportProgramFile, 'Program exported.')} />
        <ListRow label="Import program…" tone="accent" chevron={false} onclick={() => programInput?.click()} />
      </ListGroup>

      <ListGroup header="Storage">
        <ListRow label="Data on this device" detail={storageText} />
        {#if storage?.quotaBytes}<ListRow label="Space available" value={formatBytes(storage.quotaBytes)} />{/if}
      </ListGroup>

      <a class="components" href="#/kitchen-sink">Components</a>
    </div>
  {/if}
{/key}

<input bind:this={backupInput} class="visually-hidden" type="file" accept=".json,application/json" tabindex="-1" aria-hidden="true" onchange={(e) => pick('backup', e)} />
<input bind:this={programInput} class="visually-hidden" type="file" accept=".json,application/json" tabindex="-1" aria-hidden="true" onchange={(e) => pick('program', e)} />

{#if importing}
  <ImportSheet
    title={importing.kind === 'backup' ? 'Import backup' : 'Import program'}
    fileName={importing.file.name}
    preview={importing.preview}
    replaceWarning={importing.kind === 'backup'
      ? 'This replaces every workout, set, max and setting on this device with the file. Export a backup first if you might want them back.'
      : 'Current routines and exercises are archived (not deleted) and replaced by the program. Logged workouts are not touched.'}
    onimport={doImport}
    onclose={() => (importing = undefined)}
  />
{/if}

<style>
  .components { display: block; width: fit-content; margin: 8px auto 0; padding: 12px; min-height: 44px; color: var(--text-2); font-size: 0.8125rem; text-decoration: none; }
</style>
