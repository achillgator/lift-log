// Every tab screen sits in the shared .screen wrapper (global.css), which gives the side margins
// and safe areas. Server-rendered, so no data loads: queries only run in effects.
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import HomeScreen from './home/HomeScreen.svelte';
import ProgressScreen from './progress/ProgressScreen.svelte';
import HistoryScreen from './history/HistoryScreen.svelte';
import SettingsScreen from './settings/SettingsScreen.svelte';

afterEach(() => vi.unstubAllGlobals());

/** The rendered markup without Svelte's hydration comments. */
function markup(screen: Component, hash: string): string {
  vi.stubGlobal('location', { hash });
  return render(screen).body.replace(/<!--[^]*?-->/g, '').trim();
}

test.each([
  ['Home', HomeScreen, '#/home'],
  ['Progress · Lifts', ProgressScreen, '#/progress/lifts'],
  ['Progress · Runs', ProgressScreen, '#/progress/runs'],
  ['Progress · Body', ProgressScreen, '#/progress/body'],
  ['History', HistoryScreen, '#/history'],
  ['Settings', SettingsScreen, '#/settings'],
] as const)('%s renders inside the .screen wrapper', (_name, screen, hash) => {
  expect(markup(screen as Component, hash)).toMatch(/^<div class="screen[\s"]/);
});
