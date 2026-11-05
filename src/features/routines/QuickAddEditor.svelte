<script lang="ts">
  import { api } from '../../db';
  import type { Exercise, QuickAdd, Routine } from '../../db/types';
  import { go } from '../../lib/router';
  import ListGroup from '../../components/ListGroup.svelte';
  import TextField from '../../components/TextField.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { query } from '../../components/query.svelte';
  import { showError, toasts } from '../../components/toast.svelte';
  import BackHeader from './BackHeader.svelte';
  import ItemsEditor from './ItemsEditor.svelte';
  import { quickAddKind, toLines, withKind, type QuickAddKind } from './quickadd';

  interface Props { id: string; }
  let { id }: Props = $props();

  const quickAdds = query<QuickAdd[]>(() => api.listQuickAdds(), []);
  const routines = query<Routine[]>(() => api.listRoutines(), []);
  const exercises = query<Exercise[]>(() => api.listExercises(), []);
  let edits = $state<QuickAdd | undefined>();
  const qa = $derived(edits ?? quickAdds.value.find((q) => q.id === id));
  const kind = $derived(qa ? quickAddKind(qa) : 'lines');

  async function save(next: QuickAdd) {
    edits = next;
    try {
      await api.saveQuickAdd($state.snapshot(next) as QuickAdd);
    } catch (err) {
      showError("Couldn't save the quick-add.", err);
    }
  }

  async function remove() {
    if (!qa) return;
    const copy = $state.snapshot(qa) as QuickAdd;
    try {
      await api.deleteQuickAdd(id);
      go('settings/quick-adds');
      toasts.show(`${copy.name} deleted`, {
        undo: async () => {
          await api.saveQuickAdd(copy);
          go(`settings/quick-adds/${id}`);
        },
      });
    } catch (err) {
      showError("Couldn't delete the quick-add.", err);
    }
  }
</script>

<div class="screen">
  <BackHeader href="#/settings/quick-adds" label="Quick-adds" />
  {#if qa}
    <h1 class="title-large">{qa.name}</h1>
    <ListGroup>
      <div class="pad"><TextField label="Name" value={qa.name} oncommit={(v) => v.trim() && save({ ...qa, name: v.trim() })} /></div>
      <div class="pad">
        <SegmentedControl
          label="What it adds"
          value={kind}
          options={[{ value: 'lines', label: 'Checklist' }, { value: 'items', label: 'Exercises' }, { value: 'routine', label: 'Routine' }]}
          onchange={(k: QuickAddKind) => save(withKind(qa, k, routines.value[0]?.id))}
        />
      </div>
    </ListGroup>

    {#if 'routineId' in qa.source}
      <ListGroup header="Routine" footer="Adds every exercise of this routine to the log.">
        <div class="pad">
          <select aria-label="Routine" value={qa.source.routineId} onchange={(e) => save({ ...qa, source: { routineId: e.currentTarget.value } })}>
            {#each routines.value as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
          </select>
        </div>
      </ListGroup>
    {:else if 'items' in qa.source}
      <ItemsEditor items={qa.source.items} exercises={exercises.value} onchange={(items) => save({ ...qa, source: { items } })} />
    {:else}
      <ListGroup header="Checklist" footer="One line per item.">
        <div class="pad">
          <textarea aria-label="Checklist lines" rows="5" value={qa.source.lines.join('\n')} onchange={(e) => save({ ...qa, source: { lines: toLines(e.currentTarget.value) } })}></textarea>
        </div>
      </ListGroup>
    {/if}

    <Button variant="danger" block onclick={remove}>Delete quick-add</Button>
  {:else if quickAdds.loaded}
    <EmptyState message="This quick-add no longer exists." actionLabel="Back to quick-adds" onaction={() => go('settings/quick-adds')} />
  {/if}
</div>

<style>
  .pad { padding: 8px var(--space); border-top: 1px solid var(--separator); }
  .pad:first-child { border-top: 0; }
</style>
