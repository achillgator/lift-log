// Dev-only Tweaks panel model. Values live in localStorage only (never Dexie) and apply app-wide
// through a <style> element that overrides the tokens in tokens.css.

export interface Tweak {
  token: string;
  label: string;
  type: 'color' | 'range' | 'select' | 'warmth';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  /** Used when tokens.css does not define the token yet. */
  fallback?: string;
}

export const TWEAKS: Tweak[] = [
  { token: '--font-num', label: 'Numeral font', type: 'select', fallback: 'inherit', options: [
    { value: 'inherit', label: 'SF Pro' },
    { value: 'ui-rounded, -apple-system, system-ui, sans-serif', label: 'SF Pro Rounded' },
    { value: 'ui-monospace, SFMono-Regular, monospace', label: 'SF Mono' },
  ] },
  { token: '--big-number', label: 'Big number size', type: 'range', min: 1.5, max: 4, step: 0.125, unit: 'rem' },
  { token: '--accent', label: 'Accent', type: 'color' },
  { token: '--bg', label: 'Background warmth', type: 'warmth', min: -20, max: 20, step: 1 },
  { token: '--radius', label: 'Radius', type: 'range', min: 0, max: 24, step: 1, unit: 'px' },
  { token: '--row-height', label: 'Set row height', type: 'range', min: 44, max: 72, step: 2, unit: 'px' },
  { token: '--chart-line', label: 'Chart line weight', type: 'range', min: 1, max: 6, step: 0.5, unit: 'px', fallback: '3px' },
  { token: '--motion', label: 'Motion speed', type: 'range', min: 0, max: 600, step: 25, unit: 'ms', fallback: '250ms' },
  { token: '--space', label: 'Side margin', type: 'range', min: 12, max: 24, step: 2, unit: 'px' },
  { token: '--surface', label: 'Surface', type: 'color' },
  { token: '--text', label: 'Text', type: 'color' },
  { token: '--text-2', label: 'Secondary text', type: 'color' },
  { token: '--separator', label: 'Separator', type: 'color' },
  { token: '--pr', label: 'PR color', type: 'color' },
  { token: '--danger', label: 'Destructive', type: 'color' },
  { token: '--tier-bronze', label: 'Bronze', type: 'color' },
  { token: '--tier-silver', label: 'Silver', type: 'color' },
  { token: '--tier-gold', label: 'Gold', type: 'color' },
  { token: '--tier-platinum', label: 'Platinum', type: 'color' },
  { token: '--tier-diamond', label: 'Diamond', type: 'color' },
];

export type TweakValues = Record<string, string>;
export const STORAGE_KEY = 'lift-log:tweaks';
const STYLE_ID = 'lift-log-tweaks';
const WARM = '#ff8a3d';
const COOL = '#3d8aff';

/** CSS value for the background warmth slider: mixes the default background toward warm or cool. */
export function warmthCss(baseBg: string, warmth: number): string {
  if (!warmth) return baseBg;
  const tint = warmth > 0 ? WARM : COOL;
  return `color-mix(in srgb, ${baseBg}, ${tint} ${Math.abs(warmth) / 2}%)`;
}

/** Only the changed tokens, as a :root block (what "Copy values" puts on the clipboard). */
export function changedCss(values: TweakValues, defaults: TweakValues): string {
  const lines = Object.entries(values)
    .filter(([token, v]) => v !== '' && v !== defaults[token])
    .map(([token, v]) => `  ${token}: ${cssValue(token, v, defaults)};`);
  return lines.length ? `:root {\n${lines.join('\n')}\n}` : '';
}

function cssValue(token: string, v: string, defaults: TweakValues): string {
  const tweak = TWEAKS.find((t) => t.token === token);
  return tweak?.type === 'warmth' ? warmthCss(defaults[token] ?? 'transparent', Number(v)) : v;
}

export function loadTweaks(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): TweakValues {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as TweakValues) : {};
  } catch {
    return {};
  }
}

export function saveTweaks(values: TweakValues, storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined = safeStorage()): void {
  try {
    if (Object.keys(values).length) storage?.setItem(STORAGE_KEY, JSON.stringify(values));
    else storage?.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or storage full: the tweaks just won't persist.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Current token values without any tweak applied. */
export function readDefaults(): TweakValues {
  const style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (style) style.disabled = true;
  const computed = getComputedStyle(document.documentElement);
  const out: TweakValues = {};
  for (const t of TWEAKS) {
    const v = computed.getPropertyValue(t.token).trim();
    out[t.token] = t.type === 'warmth' ? v || '#ffffff' : v || t.fallback || '';
  }
  if (style) style.disabled = false;
  return out;
}

/** Writes the overrides into one <style> element; called on startup and on every change. */
export function applyTweaks(values: TweakValues = loadTweaks(), defaults?: TweakValues): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!Object.keys(values).length) {
    style?.remove();
    return;
  }
  const base = defaults ?? readDefaults();
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.append(style);
  }
  style.textContent = changedCss(values, base).replace(':root', ':root:root');
}
