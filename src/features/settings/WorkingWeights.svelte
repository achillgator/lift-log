<script lang="ts">
  // Current working weight per exercise: the last weight lifted, from finished workouts.
  import { api } from '../../db';
  import type { Exercise } from '../../db/types';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import Banner from '../../components/Banner.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { formatDate, formatLb } from '../../components/format';
  import { query } from '../../components/query.svelte';
  import BackHeader from '../routines/BackHeader.svelte';
  import { latestWeights, type WorkingWeight } from './settings';

  const weights = query<WorkingWeight[]>(async () => {
    const exercises: Exercise[] = await api.listExercises();
    const weighted = exercises.filter((e) => e.kind === 'barbell' || e.kind === 'dumbbell' || e.kind === 'bodyweight');
    const histories = await Promise.all(weighted.map((e) => api.setHistory(e.id)));
    return latestWeights(weighted, histories);
  }, []);
</script>

<div class="screen">
  <BackHeader href="#/settings" label="Settings" />
  <h1 class="title-large">Working weights</h1>
  {#if weights.error}<Banner tone="danger" title="Couldn't load working weights" message="Nothing was lost. Try again in a moment. ({weights.error})" />{/if}
  {#if weights.value.length}
    <ListGroup footer="The last weight you lifted. Next targets build on it; log a set to change it.">
      {#each weights.value as w (w.exercise.id)}
        <ListRow label={w.exercise.name} detail={w.date ? `${formatDate(w.date)} · ${w.reps} reps` : 'Not logged yet'} value={w.weightLb !== undefined ? `${formatLb(w.weightLb)} lb` : '–'} />
      {/each}
    </ListGroup>
  {:else if weights.loaded}
    <EmptyState message="No weighted exercises yet. Add one in Exercises." />
  {/if}
</div>
