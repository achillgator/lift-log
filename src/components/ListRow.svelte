<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';

  interface Props {
    label: string;
    detail?: string;
    value?: string;
    href?: string;
    onclick?: () => void;
    chevron?: boolean;
    tone?: 'default' | 'accent' | 'danger';
    /** A trailing control such as a Switch or Stepper. */
    trailing?: Snippet;
  }
  let { label, detail, value, href, onclick, chevron = !!(href || onclick), tone = 'default', trailing }: Props = $props();
</script>

{#snippet content()}
  <span class="text">
    <span class="label">{label}</span>
    {#if detail}<span class="detail">{detail}</span>{/if}
  </span>
  {#if value}<span class="value num">{value}</span>{/if}
  {#if trailing}{@render trailing()}{/if}
  {#if chevron}<ChevronRight size={18} aria-hidden="true" class="chev" />{/if}
{/snippet}

{#if href}
  <a class="row {tone} interactive" {href}>{@render content()}</a>
{:else if onclick}
  <button type="button" class="row {tone} interactive" {onclick}>{@render content()}</button>
{:else}
  <div class="row {tone}">{@render content()}</div>
{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
    min-height: max(44px, var(--row-height));
    padding: 6px var(--space);
    border: 0;
    border-top: 1px solid var(--separator);
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    text-decoration: none;
  }
  .interactive { cursor: pointer; }
  .interactive:active { background: var(--surface-2); }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .label { overflow: hidden; text-overflow: ellipsis; }
  .detail { font-size: 0.8125rem; color: var(--text-2); }
  .value { color: var(--text-2); }
  .accent .label { color: var(--accent); }
  .danger .label { color: var(--danger); }
  .row :global(.chev) { color: var(--text-2); flex: none; }
</style>
