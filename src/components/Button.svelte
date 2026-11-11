<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'plain' | 'danger';
    size?: 'regular' | 'small';
    block?: boolean;
    children: Snippet;
  }
  let { variant = 'secondary', size = 'regular', block = false, type = 'button', children, ...rest }: Props = $props();
</script>

<button {type} class="btn {variant} {size}" class:block {...rest}>{@render children()}</button>

<style>
  .btn {
    min-height: 44px;
    min-width: 44px;
    padding: 0 var(--space);
    border: 0;
    border-radius: var(--radius);
    font: inherit;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: transform calc(var(--motion, 250ms) * 0.5) ease-out, opacity calc(var(--motion, 250ms) * 0.5);
  }
  .btn:active:not(:disabled) { transform: scale(0.97); }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .primary { background: var(--accent); color: var(--bg); }
  .secondary { background: var(--surface-2); color: var(--text); }
  .plain { background: transparent; color: var(--accent); }
  .danger { background: transparent; color: var(--danger); }
  .small { padding: 0 12px; font-size: 0.9375rem; }
  .block { display: flex; width: 100%; }
</style>
