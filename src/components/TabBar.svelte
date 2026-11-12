<script lang="ts">
  import type { Component } from 'svelte';
  interface Tab { id: string; label: string; icon?: Component<{ size?: number; 'aria-hidden'?: string }> }
  interface Props { tabs: Tab[]; active: string; onselect: (id: string) => void; }
  let { tabs, active, onselect }: Props = $props();
</script>

<nav class="tabbar" aria-label="Main">
  {#each tabs as tab (tab.id)}
    <button type="button" aria-current={tab.id === active ? 'page' : undefined} onclick={() => onselect(tab.id)}>
      {#if tab.icon}<tab.icon size={24} aria-hidden="true" />{/if}
      <span>{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    display: flex;
    padding-bottom: env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    backdrop-filter: blur(20px) saturate(180%);
    border-top: 1px solid var(--separator);
  }
  button {
    flex: 1;
    min-height: 49px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 0;
    background: none;
    color: var(--text-2);
    font: inherit;
    font-size: 0.625rem;
    font-weight: 500;
    cursor: pointer;
  }
  button[aria-current='page'] { color: var(--accent); }
</style>
