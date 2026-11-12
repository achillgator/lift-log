// Motion helpers: one duration token, and plain fades when the person asks for reduced motion.
import { cubicOut } from 'svelte/easing';
import { fade, fly, type TransitionConfig } from 'svelte/transition';

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Base duration in ms from the --motion token (a Tweaks control), 250 by default. */
export function motionMs(): number {
  if (typeof document === 'undefined') return 250;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--motion').trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 250;
}

/** Slide up from below, or fade when reduced motion is on. */
export function rise(node: Element, { y = 48 }: { y?: number } = {}): TransitionConfig {
  return reducedMotion() ? fade(node, { duration: 120 }) : fly(node, { y, duration: motionMs(), easing: cubicOut });
}

export function dim(node: Element): TransitionConfig {
  return fade(node, { duration: reducedMotion() ? 120 : motionMs() });
}
