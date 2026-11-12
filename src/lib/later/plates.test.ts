import { describe, expect, test } from 'vitest';
import { groupPlates, plateCounts, platesPerSide, plateSizes } from './plates';

const standard = [45, 35, 25, 10, 5, 2.5];

describe('platesPerSide', () => {
  test('standard loads', () => {
    expect(platesPerSide(135, 45, standard).perSide).toEqual([45]);
    expect(platesPerSide(225, 45, standard).perSide).toEqual([45, 45]);
    expect(platesPerSide(185, 45, standard).perSide).toEqual([45, 25]);
    expect(platesPerSide(155, 45, standard).perSide).toEqual([45, 10]);
    expect(platesPerSide(100, 45, standard).perSide).toEqual([25, 2.5]);
  });

  test('empty bar and below bar', () => {
    expect(platesPerSide(45, 45, standard)).toEqual({ perSide: [], totalLb: 45, shortLb: 0, belowBar: false });
    expect(platesPerSide(30, 45, standard)).toMatchObject({ perSide: [], totalLb: 45, belowBar: true });
  });

  test('falls short to the closest load below when exact is impossible', () => {
    const r = platesPerSide(137, 45, standard);
    expect(r.perSide).toEqual([45]);
    expect(r.totalLb).toBe(135);
    expect(r.shortLb).toBe(2);
  });

  test('finds exact loads greedy would miss', () => {
    // 40 per side with 25 and 20 plates: greedy takes 25 and gets stuck; 20 + 20 is exact.
    expect(platesPerSide(125, 45, [25, 20]).perSide).toEqual([20, 20]);
  });

  test('fractional plates without float drift', () => {
    const r = platesPerSide(47.5, 45, [1.25]);
    expect(r.perSide).toEqual([1.25]);
    expect(r.totalLb).toBe(47.5);
    expect(r.shortLb).toBe(0);
  });

  test('respects limited pairs', () => {
    const pairs = new Map([[45, 1], [25, 2], [10, 1]]);
    const r = platesPerSide(225, 45, [45, 25, 10], pairs);
    // 90 per side wanted; best with one 45, two 25s and one 10 is 45+25+10 = 80... or 45+25+25 = 95 > 90.
    expect(r.perSide).toEqual([45, 25, 10]);
    expect(r.totalLb).toBe(205);
    expect(r.shortLb).toBe(20);
  });

  test('other bar weights', () => {
    expect(platesPerSide(95, 35, standard).perSide).toEqual([25, 5]);
  });
});

test('plateSizes and plateCounts', () => {
  expect(plateSizes([2.5, 45, 45, 0, -5, 10])).toEqual([45, 10, 2.5]);
  expect(plateCounts([45, 45, 10]).get(45)).toBe(2);
});

test('groupPlates', () => {
  expect(groupPlates([45, 45, 10, 2.5])).toEqual([[45, 2], [10, 1], [2.5, 1]]);
});

test('heavy targets stay fast', () => {
  const t = performance.now();
  expect(platesPerSide(1000, 45, [45, 35, 25, 10, 5, 2.5, 1.25]).shortLb).toBe(0);
  expect(performance.now() - t).toBeLessThan(500);
});
