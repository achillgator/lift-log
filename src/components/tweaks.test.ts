import { expect, test } from 'vitest';
import { changedCss, loadTweaks, saveTweaks, warmthCss } from './tweaks';

const defaults = { '--accent': '#1f4e5f', '--radius': '12px', '--bg': '#f4f4f2' };

test('copy values lists only changed tokens', () => {
  expect(changedCss({ '--accent': '#1f4e5f', '--radius': '16px' }, defaults)).toBe(':root {\n  --radius: 16px;\n}');
  expect(changedCss({}, defaults)).toBe('');
});

test('warmth mixes the default background', () => {
  expect(warmthCss('#f4f4f2', 0)).toBe('#f4f4f2');
  expect(warmthCss('#f4f4f2', 10)).toBe('color-mix(in srgb, #f4f4f2, #ff8a3d 5%)');
  expect(changedCss({ '--bg': '-4' }, defaults)).toContain('#3d8aff 2%');
});

test('stored values round-trip and bad JSON is ignored', () => {
  const mem = new Map<string, string>();
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  saveTweaks({ '--radius': '8px' }, storage);
  expect(loadTweaks(storage)).toEqual({ '--radius': '8px' });
  mem.set('lift-log:tweaks', '{nope');
  expect(loadTweaks(storage)).toEqual({});
  saveTweaks({}, storage);
  expect(mem.size).toBe(0);
});
