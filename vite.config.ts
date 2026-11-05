import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base must never change: the URL is where each person's data lives.
export default defineConfig({
  base: '/lift-log/',
  plugins: [svelte()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
