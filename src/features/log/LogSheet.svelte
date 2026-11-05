<script lang="ts">
  // The Log: a full-screen sheet over the tabs. Reached at #/log/<sessionId>, so a reload restores it.
  import Ellipsis from 'lucide-svelte/icons/ellipsis';
  import Plus from 'lucide-svelte/icons/plus';
  import { api } from '../../db';
  import Sheet from '../../components/Sheet.svelte';
  import SetRow from '../../components/SetRow.svelte';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import Button from '../../components/Button.svelte';
  import Banner from '../../components/Banner.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { formatDate } from '../../components/format';
  import { showError, toasts } from '../../components/toast.svelte';
  import { LogController } from './controller.svelte';
  import ExercisePicker from './ExercisePicker.svelte';
  import FinishSheet from './FinishSheet.svelte';

  interface Props { sessionId: string; onclose: () => void; }
  let { sessionId, onclose }: Props = $props();

  // svelte-ignore state_referenced_locally
  const log = new LogController(api, sessionId, {
    show: (message, opts) => toasts.show(message, opts),
    error: (what, err) => showError(what, err),
  });
  log.load();

  let menuFor = $state<string | undefined>();
  let swapFor = $state<string | undefined>();
  let adding = $state(false);
  let quickAdding = $state(false);
  let finishing = $state(false);

  const editing = $derived(log.session?.status === 'done');

  function close() {
    if (!editing && log.sets.some((s) => s.done)) toasts.show('Draft saved. Resume it from Home.');
    onclose();
  }

  async function discard() {
    if (await log.discard(() => (location.hash = `#/log/${sessionId}`))) onclose();
  }
</script>

<Sheet variant="full" title={log.title} onclose={close}>
  {#snippet trailing()}
    {#if log.session}
      <Button size="small" variant="primary" onclick={() => (finishing = true)}>{editing ? 'Done' : 'Finish'}</Button>
    {/if}
  {/snippet}

  {#if log.session}
    <p class="footnote sub">{formatDate(log.session.date)} · {editing ? 'Editing a finished workout. Changes save as you go.' : 'Every tap is saved.'}</p>
  {/if}

  {#if log.loadError}
    <Banner tone="danger" title="Couldn't open this workout" message="{log.loadError} Other workouts are safe. Close this and try again from Home or History." />
  {:else if log.loaded && log.session}
    {#each log.groups as group (group.exerciseId)}
      {@const ex = log.exercise(group.exerciseId)}
      <ListGroup>
        <div class="ex-head">
          <button type="button" class="ex-name" onclick={() => log.tapExercise(group.exerciseId)} aria-label="{log.name(group.exerciseId)}: mark every set done as planned">
            {log.name(group.exerciseId)}
          </button>
          <button type="button" class="icon-btn" aria-label="More for {log.name(group.exerciseId)}" onclick={() => (menuFor = group.exerciseId)}>
            <Ellipsis size={20} aria-hidden="true" />
          </button>
        </div>
        {#each group.sets as set (set.id)}
          <SetRow
            {set}
            kind={ex?.kind}
            weightStep={ex?.roundToLb || 5}
            onchange={(next) => log.save(next)}
            onskip={() => log.toggleSkip(set)}
            onremove={() => log.removeSet(set)}
          />
        {/each}
        <button type="button" class="add-set" onclick={() => log.addSet(group.exerciseId)}><Plus size={18} aria-hidden="true" /> Add set</button>
      </ListGroup>
    {:else}
      <EmptyState message="No exercises yet. Add one, or add a quick-add block." />
    {/each}

    <div class="row-gap tools">
      <Button onclick={() => (adding = true)}><Plus size={18} aria-hidden="true" /> Exercise</Button>
      <Button onclick={() => (quickAdding = true)}><Plus size={18} aria-hidden="true" /> Quick-add</Button>
    </div>

    <div class="danger-zone">
      <Button variant="danger" onclick={discard}>{editing ? 'Delete workout' : 'Discard workout'}</Button>
    </div>
  {/if}
</Sheet>

{#if menuFor}
  {@const id = menuFor}
  <Sheet title={log.name(id)} onclose={() => (menuFor = undefined)}>
    <ListGroup>
      <ListRow label="Add set" chevron={false} onclick={() => { menuFor = undefined; log.addSet(id); }} />
      <ListRow label="Swap exercise" onclick={() => { menuFor = undefined; swapFor = id; }} />
      <ListRow label="Remove exercise" tone="danger" chevron={false} onclick={() => { menuFor = undefined; log.removeExercise(id); }} />
    </ListGroup>
  </Sheet>
{/if}

{#if swapFor}
  {@const from = swapFor}
  <ExercisePicker title="Swap {log.name(from)}" exercises={log.exercises} exclude={from} onclose={() => (swapFor = undefined)} onpick={(to) => { swapFor = undefined; log.swap(from, to); }} />
{/if}

{#if adding}
  <ExercisePicker title="Add exercise" exercises={log.exercises} onclose={() => (adding = false)} onpick={(id) => { adding = false; log.addExercise(id); }} />
{/if}

{#if quickAdding}
  <Sheet title="Quick-add" onclose={() => (quickAdding = false)}>
    {#if log.quickAdds.length}
      <ListGroup>
        {#each log.quickAdds as q (q.id)}
          <ListRow label={q.name} chevron={false} onclick={() => { quickAdding = false; log.applyQuickAdd(q.id); }} />
        {/each}
      </ListGroup>
    {:else}
      <EmptyState message="No quick-adds yet. Make one in Settings → Quick-adds." />
    {/if}
  </Sheet>
{/if}

{#if finishing && log.session}
  <FinishSheet session={log.session} sets={log.sets} name={(id) => log.name(id)} onclose={() => (finishing = false)} ondone={() => { finishing = false; onclose(); }} />
{/if}

<style>
  .sub { margin: 0 0 16px; }
  .ex-head { display: flex; align-items: center; min-height: var(--row-height); }
  .ex-name {
    flex: 1;
    min-height: 44px;
    padding: 0 var(--space);
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 1.0625rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .icon-btn { width: 44px; height: 44px; margin-right: 4px; display: grid; place-items: center; border: 0; background: none; color: var(--text-2); cursor: pointer; }
  .add-set {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 0 var(--space);
    border: 0;
    border-top: 1px solid var(--separator);
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }
  .tools { margin-bottom: 32px; }
  .danger-zone { display: flex; justify-content: center; padding-bottom: 32px; }
</style>
