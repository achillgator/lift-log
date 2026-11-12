<script lang="ts">
  // Choose what to log: any routine, or start empty.
  import Sheet from '../../components/Sheet.svelte';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import { weekdayName } from '../../components/format';
  import type { Routine } from '../../db/types';

  interface Props { routines: Routine[]; onpick: (routineId?: string) => void; onclose: () => void; }
  let { routines, onpick, onclose }: Props = $props();
</script>

<Sheet title="Log a workout" {onclose}>
  <ListGroup>
    <ListRow label="Start empty" detail="Add exercises or a quick-add as you go" tone="accent" onclick={() => onpick(undefined)} />
  </ListGroup>
  {#if routines.length}
    <ListGroup header="Routines">
      {#each routines as r (r.id)}
        <ListRow label={r.name} detail={r.weekday !== undefined ? weekdayName(r.weekday) : undefined} onclick={() => onpick(r.id)} />
      {/each}
    </ListGroup>
  {/if}
</Sheet>
