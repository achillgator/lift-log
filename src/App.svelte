<script lang="ts">
  import { currentRoute, onRouteChange, go } from './lib/router';
  import HomeScreen from './features/home/HomeScreen.svelte';
  import ProgressScreen from './features/progress/ProgressScreen.svelte';
  import HistoryScreen from './features/history/HistoryScreen.svelte';
  import SettingsScreen from './features/settings/SettingsScreen.svelte';
  import KitchenSink from './components/KitchenSink.svelte';
  import TabBar from './components/TabBar.svelte';
  import ToastHost from './components/ToastHost.svelte';
  import { applyTweaks } from './components/tweaks';
  import House from 'lucide-svelte/icons/house';
  import ChartLine from 'lucide-svelte/icons/chart-line';
  import History from 'lucide-svelte/icons/history';
  import Settings from 'lucide-svelte/icons/settings';

  const tabs = [
    { route: 'home', label: 'Home', screen: HomeScreen, icon: House },
    { route: 'progress', label: 'Progress', screen: ProgressScreen, icon: ChartLine },
    { route: 'history', label: 'History', screen: HistoryScreen, icon: History },
    { route: 'settings', label: 'Settings', screen: SettingsScreen, icon: Settings },
  ];

  // Dev-only Tweaks panel values (localStorage) apply app-wide from the first frame.
  applyTweaks();

  let route = $state(currentRoute());
  $effect(() => onRouteChange((next) => (route = next)));
  const kitchenSink = $derived(route === 'kitchen-sink');
  const active = $derived(kitchenSink ? tabs[3] : (tabs.find((t) => route.startsWith(t.route)) ?? tabs[0]));
</script>

<main>
  {#if kitchenSink}<KitchenSink />{:else}<active.screen />{/if}
</main>
<TabBar
  tabs={tabs.map((t) => ({ id: t.route, label: t.label, icon: t.icon }))}
  active={active.route}
  onselect={(id) => go(id)}
/>
<ToastHost />
