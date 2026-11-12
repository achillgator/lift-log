<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  interface Props extends Omit<HTMLInputAttributes, 'value'> { label: string; value?: string | number; hideLabel?: boolean; oncommit?: (value: string) => void; }
  let { label, value = $bindable(''), hideLabel = false, oncommit, ...rest }: Props = $props();
</script>

<label class="field">
  <span class:visually-hidden={hideLabel}>{label}</span>
  <input bind:value onchange={(e) => oncommit?.((e.currentTarget as HTMLInputElement).value)} {...rest} />
</label>

<style>
  .field { display: flex; flex-direction: column; gap: 4px; }
  span { font-size: 0.8125rem; color: var(--text-2); }
  input {
    min-height: 44px;
    box-sizing: border-box;
    width: 100%;
    padding: 0 12px;
    border: 1px solid var(--separator);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: max(16px, 1rem);
  }
</style>
