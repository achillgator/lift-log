<script lang="ts">
  import { currentRoute, onRouteChange, go } from './lib/router';
  import HomeScreen from './features/home/HomeScreen.svelte';
  import ProgressScreen from './features/progress/ProgressScreen.svelte';
  import HistoryScreen from './features/history/HistoryScreen.svelte';
  import SettingsScreen from './features/settings/SettingsScreen.svelte';

  const tabs = [
    { route: 'home', label: 'Home', screen: HomeScreen },
    { route: 'progress', label: 'Progress', screen: ProgressScreen },
    { route: 'history', label: 'History', screen: HistoryScreen },
    { route: 'settings', label: 'Settings', screen: SettingsScreen },
  ];

  let route = $state(currentRoute());
  $effect(() => onRouteChange((next) => (route = next)));
  const active = $derived(tabs.find((t) => route.startsWith(t.route)) ?? tabs[0]);
</script>

<main><active.screen /></main>
<nav>
  {#each tabs as tab}
    <button aria-current={tab === active ? 'page' : undefined} onclick={() => go(tab.route)}>{tab.label}</button>
  {/each}
</nav>

<style>
  main { padding: var(--space); padding-bottom: 96px; }
  nav { position: fixed; inset: auto 0 0 0; display: flex; background: var(--surface); border-top: 1px solid var(--separator); padding-bottom: env(safe-area-inset-bottom); }
  button { flex: 1; min-height: 49px; background: none; border: 0; color: var(--text-2); }
  button[aria-current] { color: var(--accent); }
</style>
