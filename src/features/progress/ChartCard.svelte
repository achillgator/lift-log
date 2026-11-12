<!-- One chart group: title, then either the chart or an empty state that names the next action. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props { title: string; empty?: string; id?: string; highlight?: boolean; children?: Snippet; }
  let { title, empty, id, highlight = false, children }: Props = $props();
</script>

<section class="card" class:highlight {id} aria-label={title}>
  <h2>{title}</h2>
  {#if empty}
    <p class="empty">{empty}</p>
  {:else}
    {@render children?.()}
  {/if}
</section>

<style>
  .card { background: var(--surface); border-radius: var(--radius); padding: 12px var(--space) 10px; margin: 0 0 12px; scroll-margin-top: 12px; transition: box-shadow 300ms; }
  .card.highlight { box-shadow: 0 0 0 2px var(--accent); }
  h2 { font-size: 1.0625rem; font-weight: 600; margin: 0 0 4px; }
  .empty { margin: 4px 0 6px; color: var(--text-2); font-size: 0.9375rem; }
</style>
