// Pure helpers for Stepper so the press-and-hold timing and rounding are testable.

/** Delay before the next repeat while a stepper button is held: slow at first, then faster. */
export function holdDelay(repeats: number): number {
  if (repeats <= 0) return 400;
  if (repeats < 5) return 150;
  if (repeats < 15) return 80;
  return 40;
}

/** Adds delta, clamps to [min, max], and drops float noise (132.5 + 2.5 stays exact). */
export function stepValue(base: number, delta: number, min = 0, max = Number.POSITIVE_INFINITY): number {
  const next = Math.round((base + delta) * 1000) / 1000;
  return Math.min(max, Math.max(min, next));
}
