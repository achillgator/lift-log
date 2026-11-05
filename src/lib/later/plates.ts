// Plate calculator (v1.1): plates per side for a target barbell weight.

export const DEFAULT_BAR_LB = 45;

export interface PlateLoad {
  /** Plates for ONE side, heaviest first. */
  perSide: number[];
  /** What the bar actually weighs when loaded this way. */
  totalLb: number;
  /** Target minus total: 0 when exact, positive when the plates fall short. */
  shortLb: number;
  /** True when the target is below the empty bar. */
  belowBar: boolean;
}

// Plate weights are multiples of 0.05 lb in practice (0.25, 1.25, 2.5 ...). Work in those units so
// floating point never leaves 0.0000001 lb behind.
const UNIT = 20;
const toUnits = (lb: number) => Math.round(lb * UNIT);

/**
 * Unique plate weights from the Settings list, heaviest first. The list may repeat a weight
 * (one entry per plate owned); repeats are counted by `plateCounts`.
 */
export function plateSizes(platesOwned: number[]): number[] {
  return [...new Set(platesOwned.filter((p) => Number.isFinite(p) && p > 0))].sort((a, b) => b - a);
}

/** How many plates of each weight the Settings list holds. */
export function plateCounts(platesOwned: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const p of platesOwned) if (Number.isFinite(p) && p > 0) counts.set(p, (counts.get(p) ?? 0) + 1);
  return counts;
}

/**
 * The fewest plates per side that reach `targetLb` exactly, or the closest load below it.
 * `pairsPerSize` optionally caps how many of each plate fit on one side; without it every
 * size is unlimited. Ties prefer heavier plates first.
 */
export function platesPerSide(
  targetLb: number,
  barLb: number,
  sizes: number[],
  pairsPerSize?: Map<number, number>,
): PlateLoad {
  if (!(targetLb >= barLb)) return { perSide: [], totalLb: barLb, shortLb: Math.max(0, targetLb - barLb), belowBar: targetLb < barLb };

  const plates = plateSizes(sizes);
  const goal = Math.floor(toUnits((targetLb - barLb) / 2));

  // best[a] = shortest plate list summing to exactly a units, heaviest first.
  const best: (number[] | undefined)[] = new Array(goal + 1);
  best[0] = [];
  for (const plate of plates) {
    const w = toUnits(plate);
    if (w <= 0 || w > goal) continue;
    if (!pairsPerSize) {
      // Unlimited plates: sweep low to high so a plate can be reused.
      for (let a = w; a <= goal; a++) {
        const prev = best[a - w];
        if (prev && isBetter([...prev, plate], best[a])) best[a] = [...prev, plate];
      }
      continue;
    }
    // Limited plates: add one more of this plate per pass, sweeping high to low so a pass
    // never builds on a list it just extended.
    const cap = pairsPerSize.get(plate) ?? 0;
    for (let k = 0; k < cap; k++) {
      let changed = false;
      for (let a = goal; a >= w; a--) {
        const prev = best[a - w];
        if (!prev || count(prev, plate) !== k) continue;
        const next = [...prev, plate];
        if (isBetter(next, best[a])) {
          best[a] = next;
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  let a = goal;
  while (a > 0 && !best[a]) a--;
  const perSide = best[a] ?? [];
  const totalLb = round(barLb + 2 * perSide.reduce((s, p) => s + p, 0));
  return { perSide, totalLb, shortLb: round(targetLb - totalLb), belowBar: false };
}

function isBetter(next: number[], current: number[] | undefined): boolean {
  if (!current) return true;
  if (next.length !== current.length) return next.length < current.length;
  for (let i = 0; i < next.length; i++) if (next[i] !== current[i]) return next[i] > current[i];
  return false;
}

function count(list: number[], plate: number): number {
  return list.reduce((n, p) => (p === plate ? n + 1 : n), 0);
}

function round(lb: number): number {
  return Math.round(lb * UNIT) / UNIT;
}

/** "45 · 25 · 2.5" style label for one side. */
export function describeSide(perSide: number[]): string {
  return perSide.map((p) => String(p)).join(' · ');
}

/** Groups a side into [weight, count] pairs, heaviest first, for "2 × 45" display. */
export function groupPlates(perSide: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of perSide) {
    const last = out[out.length - 1];
    if (last && last[0] === p) last[1]++;
    else out.push([p, 1]);
  }
  return out;
}
