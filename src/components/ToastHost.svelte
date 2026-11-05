<script lang="ts">
  import Toast from './Toast.svelte';
  import { dim } from './motion';
  import { toasts } from './toast.svelte';
</script>

<div class="host" aria-live="polite">
  {#each toasts.items as item (item.id)}
    <div transition:dim>
      <Toast
        message={item.message}
        tone={item.tone}
        onundo={item.undo ? () => toasts.undo(item.id) : undefined}
        ondismiss={() => toasts.dismiss(item.id)}
      />
    </div>
  {/each}
</div>

<style>
  .host {
    position: fixed;
    left: var(--space);
    right: var(--space);
    bottom: calc(64px + env(safe-area-inset-bottom));
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }
  .host > :global(*) { pointer-events: auto; }
</style>
