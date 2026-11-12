<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';

  interface Props { message: string; actionLabel?: string; onaction?: () => void; children?: Snippet; }
  let { message, actionLabel, onaction, children }: Props = $props();
</script>

<div class="empty">
  <p>{message}</p>
  {#if actionLabel && onaction}<Button variant="primary" onclick={onaction}>{actionLabel}</Button>{/if}
  {#if children}{@render children()}{/if}
</div>

<style>
  .empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px var(--space); text-align: center; }
  p { margin: 0; color: var(--text-2); }
</style>
