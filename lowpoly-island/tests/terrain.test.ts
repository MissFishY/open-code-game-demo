import { describe, expect, it } from 'vitest';
import {
  HILLS,
  colorAt,
  forestDensity,
  heightAt,
  isLand,
  isUnderwater,
  normalAt,
  slopeAt,
  terrainKindAt,
  waterDepthAt,
} from '../src/world/terrain';
import { WORLD } from '../src/config';

describe('terrain height function', () => {
  it('is deterministic — the same coordinate always has the same height', () => {
    for (const [x, z] of [
      [0, 0],
      [12.5, -30.25],
      [-44, 19],
      [61, 61],
    ] as const) {
      expect(heightAt(x, z)).toBe(heightAt(x, z));
    }
  });

  it('returns land in the middle of the island and water outside it', () => {
    expect(heightAt(0, 0)).toBeGreaterThan(WORLD.waterLevel);
    expect(isLand(0, 0)).toBe(true);

    const farX = WORLD.islandRadius * 1.6;
    expect(isUnderwater(farX, farX)).toBe(true);
    expect(heightAt(farX, farX)).toBeLessThan(WORLD.waterLevel);
  });

  it('has a coherent lake: deep in the middle, land around the shore', () => {
    const lake = WORLD.lake;
    const centre = heightAt(lake.x, lake.z);
    expect(centre).toBeLessThan(-1);

    // A ring around the lake should be dry land.
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
      const x = lake.x + Math.cos(angle) * lake.radius * 1.25;
      const z = lake.z + Math.sin(angle) * lake.radius * 1.25;
      expect(heightAt(x, z)).toBeGreaterThan(WORLD.waterLevel);
    }
  });

  it('keeps the shoreline continuous — a ring around the island is walkable land', () => {
    // Walk outwards from the centre: land first, then water, and never
    // land again further out.
    let sawWater = false;
    for (let r = 0; r < WORLD.islandRadius * 1.4; r += 1) {
      const h = heightAt(r, 0);
      if (h < WORLD.waterLevel) {
        sawWater = true;
      } else if (sawWater) {
        // Land re-appearing outside the island would be an isolated island.
        expect(r).toBeLessThan(WORLD.islandRadius * 1.2);
      }
    }
    expect(sawWater).toBe(true);
  });

  it('produces hills that actually raise the ground', () => {
    for (const hill of HILLS) {
      const top = heightAt(hill.x, hill.z);
      const nearby = heightAt(hill.x + hill.radius * 1.6, hill.z);
      expect(top).toBeGreaterThan(nearby);
    }
  });

  it('has a bounded gradient so the player cannot fall through the world', () => {
    let maxStep = 0;
    for (let i = 0; i < 400; i++) {
      const x = (i % 20) * 7 - 70;
      const z = Math.floor(i / 20) * 7 - 70;
      const step = Math.abs(heightAt(x + 0.5, z) - heightAt(x, z));
      maxStep = Math.max(maxStep, step);
    }
    expect(maxStep).toBeLessThan(3);
  });

  it('reports normals that point upwards', () => {
    const normal = normalAt(10, 10);
    expect(normal.y).toBeGreaterThan(0);
    const length = Math.hypot(normal.x, normal.y, normal.z);
    expect(length).toBeCloseTo(1, 5);
  });

  it('reports slope in a sane range', () => {
    expect(slopeAt(0, 0)).toBeGreaterThanOrEqual(0);
    expect(slopeAt(0, 0)).toBeLessThanOrEqual(Math.PI / 2);
  });
});

describe('terrain classification', () => {
  it('labels the lake as underwater and the village as grass', () => {
    expect(terrainKindAt(WORLD.lake.x, WORLD.lake.z)).toBe('underwater');
    expect(terrainKindAt(0, 0)).toBe('grass');
  });

  it('produces valid colours', () => {
    for (const [x, z] of [
      [0, 0],
      [30, -20],
      [-26, 22],
      [70, 70],
    ] as const) {
      const color = colorAt(x, z, slopeAt(x, z));
      for (const channel of [color.r, color.g, color.b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps forest density between 0 and 1', () => {
    for (let i = 0; i < 200; i++) {
      const x = ((i * 37) % 100) - 50;
      const z = ((i * 53) % 100) - 50;
      const density = forestDensity(x, z);
      expect(density).toBeGreaterThanOrEqual(0);
      expect(density).toBeLessThanOrEqual(1);
    }
  });

  it('reports water depth of zero on dry land', () => {
    expect(waterDepthAt(0, 0)).toBe(0);
    expect(waterDepthAt(WORLD.lake.x, WORLD.lake.z)).toBeGreaterThan(1);
  });
});
