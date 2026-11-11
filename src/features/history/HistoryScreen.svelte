<script lang="ts">
  // Finished workouts, newest first. Tapping one opens it in the Log sheet (same SetRow) to edit.
  import { api } from '../../db';
  import type { Routine, Session } from '../../db/types';
  import { go } from '../../lib/router';
  import Banner from '../../components/Banner.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import { formatDate } from '../../components/format';
  import { query } from '../../components/query.svelte';
  import { byMonth, sessionDetail } from './history';

  const sessions = query<Session[]>(() => api.listSessions('done'), []);
  const routines = query<Routine[]>(() => api.listRoutines(true), []);
  const months = $derived(byMonth(sessions.value));
  const routineName = (id?: string) => (id ? routines.value.find((r) => r.id === id)?.name : undefined) ?? 'Workout';
</script>

<div class="screen">
  <h1 class="title-large">History</h1>

  {#if sessions.error}
    <Banner tone="danger" title="Couldn't load your history" message="Nothing was lost. Close and reopen the app; if it keeps happening, export a backup in Settings. ({sessions.error})" />
  {:else if sessions.loaded && !months.length}
    <EmptyState message="No finished workouts yet. Log today's from Home." actionLabel="Go to Home" onaction={() => go('home')} />
  {/if}

  {#each months as m (m.month)}
    <ListGroup header={m.month}>
      {#each m.sessions as s (s.id)}
        <ListRow label="{formatDate(s.date)} · {routineName(s.routineId)}" detail={sessionDetail(s) || undefined} href="#/log/{s.id}" />
      {/each}
    </ListGroup>
  {/each}
</div>
