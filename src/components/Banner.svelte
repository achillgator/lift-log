<script lang="ts">
  import X from 'lucide-svelte/icons/x';
  import Button from './Button.svelte';

  interface Props {
    title: string;
    message?: string;
    tone?: 'info' | 'warning' | 'danger';
    actionLabel?: string;
    onaction?: () => void;
    ondismiss?: () => void;
  }
  let { title, message, tone = 'info', actionLabel, onaction, ondismiss }: Props = $props();
</script>

<div class="banner {tone}" role={tone === 'danger' ? 'alert' : 'status'}>
  <div class="text">
    <strong>{title}</strong>
    {#if message}<span>{message}</span>{/if}
  </div>
  {#if actionLabel && onaction}<Button size="small" variant="plain" onclick={onaction}>{actionLabel}</Button>{/if}
  {#if ondismiss}
    <button type="button" class="dismiss" aria-label="Dismiss" onclick={ondismiss}><X size={18} aria-hidden="true" /></button>
  {/if}
</div>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 4px 8px var(--space);
    margin-bottom: 16px;
    background: var(--surface);
    border-radius: var(--radius);
    border-left: 4px solid var(--accent);
  }
  .warning { border-left-color: var(--pr); }
  .danger { border-left-color: var(--danger); }
  .text { flex: 1; display: flex; flex-direction: column; gap: 2px; font-size: 0.9375rem; }
  .text span { color: var(--text-2); }
  .dismiss { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: none; color: var(--text-2); cursor: pointer; }
</style>
