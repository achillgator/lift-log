<script lang="ts">
  import Sheet from '../../components/Sheet.svelte';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import TextField from '../../components/TextField.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import type { Exercise } from '../../db/types';

  interface Props { title: string; exercises: Exercise[]; exclude?: string; onpick: (id: string) => void; onclose: () => void; }
  let { title, exercises, exclude, onpick, onclose }: Props = $props();
  let search = $state('');
  const shown = $derived(
    exercises
      .filter((e) => !e.archived && e.id !== exclude && e.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
</script>

<Sheet {title} {onclose}>
  <div class="search"><TextField label="Search exercises" hideLabel placeholder="Search" type="search" bind:value={search} /></div>
  {#if shown.length}
    <ListGroup>
      {#each shown as e (e.id)}
        <ListRow label={e.name} detail={e.kind} onclick={() => onpick(e.id)} chevron={false} />
      {/each}
    </ListGroup>
  {:else}
    <EmptyState message={search ? 'No exercise matches that name. Add it in Settings → Exercises.' : 'No exercises yet. Add one in Settings → Exercises.'} />
  {/if}
</Sheet>

<style>
  .search { margin-bottom: 12px; }
</style>
