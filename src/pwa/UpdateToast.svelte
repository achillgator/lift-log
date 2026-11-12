<script lang="ts">
  import { registerPwa } from './register';

  let updated = $state(false);
  $effect(() => registerPwa(() => (updated = true)));
</script>

{#if updated}
  <div class="toast" role="status">
    <button type="button" onclick={() => location.reload()}>Updated – tap to reload</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed; left: var(--space); right: var(--space); z-index: 100;
    bottom: calc(env(safe-area-inset-bottom) + 49px + var(--space));
    display: flex; justify-content: center; pointer-events: none;
  }
  button {
    pointer-events: auto; min-height: 44px; padding: 0 var(--space);
    background: var(--surface); color: var(--text); border: 1px solid var(--separator);
    border-radius: var(--radius); font: inherit;
  }
</style>
