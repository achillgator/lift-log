<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props { header?: string; footer?: string; headerAction?: Snippet; children: Snippet; }
  let { header, footer, headerAction, children }: Props = $props();
</script>

<section class="group">
  {#if header || headerAction}
    <div class="head"><h3>{header ?? ''}</h3>{#if headerAction}{@render headerAction()}{/if}</div>
  {/if}
  <div class="rows">{@render children()}</div>
  {#if footer}<p class="foot">{footer}</p>{/if}
</section>

<style>
  .group { margin: 0 0 24px; }
  .head { display: flex; align-items: center; justify-content: space-between; min-height: 32px; padding: 0 var(--space); }
  h3 { margin: 0; font-size: 0.8125rem; font-weight: 400; text-transform: uppercase; letter-spacing: 0.02em; color: var(--text-2); }
  .rows { background: var(--surface); border-radius: var(--radius); overflow: hidden; }
  /* The first row in a group has no top hairline. */
  .rows > :global(:first-child) { border-top: 0; }
  .foot { margin: 6px var(--space) 0; font-size: 0.8125rem; color: var(--text-2); }
</style>
