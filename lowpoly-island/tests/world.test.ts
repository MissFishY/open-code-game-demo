import { describe, expect, it } from 'vitest';
import { planPlacements } from '../src/world/ResourceField';
import { heightAt, isUnderwater, slopeAt, waterDepthAt } from '../src/world/terrain';
import { Rng, hashString } from '../src/utils/rng';
import { fbm2D, valueNoise2D } from '../src/utils/noise';

describe('world placement', () => {
  const placements = planPlacements();

  it('is deterministic for a given seed', () => {
    const second = planPlacements();
    expect(second).toHaveLength(placements.length);
    expect(second[0]).toEqual(placements[0]);
    expect(second[placements.length - 1]).toEqual(placements[placements.length - 1]);
  });

  it('places every kind of resource', () => {
    const kinds = new Set(placements.map((placement) => placement.kind));
    for (const kind of ['wood', 'stone', 'fiber', 'berry', 'flower', 'crystal'] as const) {
      expect(kinds.has(kind)).toBe(true);
    }
  });

  it('places enough crystals for the quest', () => {
    const crystals = placements.filter((placement) => placement.kind === 'crystal');
    expect(crystals.length).toBeGreaterThanOrEqual(3);
  });

  it('never places a solid prop underwater', () => {
    for (const placement of placements) {
      // Reeds grow at the waterline and deep shells live under it;
      // everything else is dry land.
      if (placement.kind === 'fiber' || placement.kind === 'deepshell') continue;
      expect(isUnderwater(placement.x, placement.z)).toBe(false);
    }
  });

  it('places reeds in shallow water only', () => {
    for (const placement of placements) {
      if (placement.kind !== 'fiber') continue;
      const depth = waterDepthAt(placement.x, placement.z);
      expect(depth).toBeLessThanOrEqual(1.2);
      expect(depth).toBeGreaterThanOrEqual(-1);
    }
  });

  it('places props on the ground surface', () => {
    for (const placement of placements) {
      expect(placement.y).toBeCloseTo(heightAt(placement.x, placement.z), 5);
    }
  });

  it('keeps the village clear of trees', () => {
    for (const placement of placements) {
      if (placement.kind !== 'wood') continue;
      const distance = Math.hypot(placement.x, placement.z);
      expect(distance).toBeGreaterThan(8);
    }
  });

  it('does not stack reeds on top of each other', () => {
    const reeds = placements.filter((placement) => placement.kind === 'fiber');
    expect(reeds.length).toBeGreaterThan(10);

    // Grid-accelerated nearest neighbour check.
    const cell = 2;
    const grid = new Map<string, Array<{ x: number; z: number }>>();
    const key = (i: number, j: number) => `${i},${j}`;

    for (const reed of reeds) {
      const bi = Math.floor(reed.x / cell);
      const bj = Math.floor(reed.z / cell);
      for (let i = bi - 1; i <= bi + 1; i++) {
        for (let j = bj - 1; j <= bj + 1; j++) {
          const bucket = grid.get(key(i, j));
          if (!bucket) continue;
          for (const other of bucket) {
            const distance = Math.hypot(other.x - reed.x, other.z - reed.z);
            expect(distance).toBeGreaterThan(1.5);
          }
        }
      }
      const bucketKey = key(bi, bj);
      let bucket = grid.get(bucketKey);
      if (!bucket) {
        bucket = [];
        grid.set(bucketKey, bucket);
      }
      bucket.push({ x: reed.x, z: reed.z });
    }
  });

  it('keeps crystals on reasonably flat ground', () => {
    for (const placement of placements) {
      if (placement.kind !== 'crystal') continue;
      expect(slopeAt(placement.x, placement.z)).toBeLessThan(0.5);
    }
  });
});

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('stays inside the requested range', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 500; i++) {
      const value = rng.float(-3, 7);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(7);
      const int = rng.int(2, 5);
      expect(int).toBeGreaterThanOrEqual(2);
      expect(int).toBeLessThanOrEqual(5);
      expect(Number.isInteger(int)).toBe(true);
    }
  });

  it('picks elements from an array', () => {
    const rng = new Rng(7);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(rng.pick(items));
    }
    expect(() => rng.pick([])).toThrow();
  });
});

describe('noise', () => {
  it('stays within [0, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const value = valueNoise2D(i * 0.37, i * 0.91, 5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('fBm stays within [0, 1] and is smooth', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.21;
      const value = fbm2D(x, x * 0.5, 3, 4);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    // Neighbouring samples should be close — no sharp discontinuities.
    const a = fbm2D(10, 10, 3, 4);
    const b = fbm2D(10.05, 10, 3, 4);
    expect(Math.abs(a - b)).toBeLessThan(0.1);
  });

  it('hashes strings stably', () => {
    expect(hashString('island')).toBe(hashString('island'));
    expect(hashString('island')).not.toBe(hashString('islands'));
  });
});
