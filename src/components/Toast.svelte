<script lang="ts">
  interface Props { message: string; tone?: 'default' | 'error'; onundo?: () => void; ondismiss?: () => void; }
  let { message, tone = 'default', onundo, ondismiss }: Props = $props();
</script>

<div class="toast {tone}" role={tone === 'error' ? 'alert' : 'status'}>
  <span class="msg">{message}</span>
  {#if onundo}<button type="button" class="act" onclick={onundo}>Undo</button>{/if}
  {#if ondismiss}<button type="button" class="act close" aria-label="Dismiss" onclick={ondismiss}>OK</button>{/if}
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 4px 4px var(--space);
    border-radius: var(--radius);
    background: var(--text);
    color: var(--bg);
    font-size: 0.9375rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
  }
  .error { background: var(--danger); color: #fff; }
  .msg { flex: 1; padding: 8px 0; }
  .act { min-height: 44px; min-width: 44px; padding: 0 12px; border: 0; background: none; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
  .close { font-weight: 400; opacity: 0.8; }
</style>
