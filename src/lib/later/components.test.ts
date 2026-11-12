// The later-release components are not wired into the app yet, so `npm run build` never sees them.
// This compiles each one so a broken component still fails `npm test`.
import { compile } from 'svelte/compiler';
import { expect, test } from 'vitest';

const sources = import.meta.glob<string>('../../features/{habits,heatmap,plates,prs,calendar,photos}/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const files = Object.entries(sources);

test('there are components to check', () => {
  expect(files.length).toBeGreaterThan(0);
});

test.each(files)('%s compiles without warnings', (file, source) => {
  const result = compile(source, { filename: file, generate: 'client' });
  expect(result.warnings.map((w) => `${w.code}: ${w.message}`)).toEqual([]);
});
