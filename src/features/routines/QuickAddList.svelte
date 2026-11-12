<script lang="ts">
  import ArrowUp from 'lucide-svelte/icons/arrow-up';
  import ArrowDown from 'lucide-svelte/icons/arrow-down';
  import { api } from '../../db';
  import type { QuickAdd } from '../../db/types';
  import { go } from '../../lib/router';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import Button from '../../components/Button.svelte';
  import Banner from '../../components/Banner.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { query } from '../../components/query.svelte';
  import { showError } from '../../components/toasts.svelte';
  import BackHeader from './BackHeader.svelte';
  import { move, nextOrder, renumber } from './reorder';
  import { quickAddDetail } from './quickadd';

  const quickAdds = query<QuickAdd[]>(() => api.listQuickAdds(), []);
  let local = $state<QuickAdd[] | undefined>();
  const list = $derived(local ?? [...quickAdds.value].sort((a, b) => a.order - b.order));

  async function reorder(i: number, dir: -1 | 1) {
    const next = move(list, i, dir);
    local = next.map((q, k) => ({ ...q, order: k }));
    try {
      for (const q of renumber(next)) await api.saveQuickAdd(q);
    } catch (err) {
      showError("Couldn't reorder quick-adds.", err);
    }
    local = undefined;
  }

  async function create() {
    const q: QuickAdd = { id: crypto.randomUUID(), name: 'New quick-add', order: nextOrder(quickAdds.value), source: { lines: [] } };
    try {
      await api.saveQuickAdd(q);
      go(`settings/quick-adds/${q.id}`);
    } catch (err) {
      showError("Couldn't create the quick-add.", err);
    }
  }
</script>

<div class="screen">
  <BackHeader href="#/settings" label="Settings" />
  <h1 class="title-large">Quick-adds</h1>
  {#if quickAdds.error}<Banner tone="danger" title="Couldn't load quick-adds" message="Nothing was lost. Try again in a moment. ({quickAdds.error})" />{/if}
  {#if list.length}
    <ListGroup footer="A quick-add drops a routine, exercises or a checklist into the current log.">
      {#each list as q, i (q.id)}
        <div class="reorder-row">
          <div class="grow"><ListRow label={q.name} detail={quickAddDetail(q)} href="#/settings/quick-adds/{q.id}" /></div>
          <span class="order">
            <button type="button" aria-label="Move {q.name} up" disabled={i === 0} onclick={() => reorder(i, -1)}><ArrowUp size={18} aria-hidden="true" /></button>
            <button type="button" aria-label="Move {q.name} down" disabled={i === list.length - 1} onclick={() => reorder(i, 1)}><ArrowDown size={18} aria-hidden="true" /></button>
          </span>
        </div>
      {/each}
    </ListGroup>
  {:else if quickAdds.loaded}
    <EmptyState message="No quick-adds yet. Make one for blocks you add often, like a warm-up." />
  {/if}
  <Button variant="primary" block onclick={create}>New quick-add</Button>
</div>

<style>
  .reorder-row { display: flex; align-items: center; border-top: 1px solid var(--separator); }
  .reorder-row :global(.row) { border-top: 0; }
  .grow { flex: 1; min-width: 0; }
  .order { display: flex; padding-right: 4px; }
  .order button { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: none; color: var(--accent); cursor: pointer; }
  .order button:disabled { color: var(--text-2); opacity: 0.4; }
</style>
