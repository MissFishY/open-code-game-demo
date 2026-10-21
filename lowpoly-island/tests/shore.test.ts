import { describe, expect, it } from 'vitest';
import { canMoveTo, canStand } from '../src/systems/CollisionSystem';
import { heightAt, slopeAt, waterDepthAt } from '../src/world/terrain';
import { WORLD } from '../src/config';

const MAX_WADE = 1.1;

/** The rule set the player is subject to while on foot. */
function optionsAt(x: number, z: number, canSwim = false) {
  return {
    currentDepth: waterDepthAt(x, z),
    currentGround: heightAt(x, z),
    maxWadeDepth: MAX_WADE,
    maxSlope: 0.72,
    canSwim,
    swimming: false,
  };
}

describe('the shoreline', () => {
  it('has a wide band of wadeable shallows', () => {
    const shore = WORLD.islandRadius * 1.02;
    let wadeable = 0;
    for (let step = 0; step < 60; step++) {
      const x = shore + step * 0.25;
      if (waterDepthAt(x, 0) > MAX_WADE) break;
      wadeable = step * 0.25;
    }
    // Several metres of shallow water to walk in and out of.
    expect(wadeable).toBeGreaterThanOrEqual(2.5);
  });

  it('blocks the player from walking into water that is too deep', () => {
    const shore = WORLD.islandRadius * 1.02;
    // Find a spot that is over the wade limit.
    let deepX = 0;
    for (let step = 0; step < 60; step++) {
      const x = shore + step * 0.25;
      if (waterDepthAt(x, 0) > MAX_WADE) {
        deepX = x;
        break;
      }
    }
    expect(deepX).toBeGreaterThan(0);
    expect(canStand(deepX, 0, 0.72, MAX_WADE)).toBe(false);
    // And from the last wadeable spot, stepping out is refused.
    const edge = deepX - 0.25;
    expect(canMoveTo(deepX, 0, optionsAt(edge, 0))).toBe(false);
  });

  it('always lets a wading player step back towards the shore', () => {
    const shore = WORLD.islandRadius * 1.02;
    for (let step = 0; step < 60; step++) {
      const x = shore + step * 0.25;
      if (waterDepthAt(x, 0) <= 0) continue;
      // Walking back to shallower water is always allowed.
      expect(canMoveTo(x - 0.107, 0, optionsAt(x, 0))).toBe(true);
    }
  });

  it('always lets a player who got too deep get out', () => {
    const shore = WORLD.islandRadius * 1.02;
    for (let step = 0; step < 60; step++) {
      const x = shore + step * 0.25;
      const depth = waterDepthAt(x, 0);
      if (depth <= MAX_WADE) continue;
      // Deeper than the wade limit: you may only move where it is no deeper.
      expect(canMoveTo(x - 0.107, 0, optionsAt(x, 0))).toBe(true);
    }
  });

  it('keeps the sea floor from plunging straight down', () => {
    const shore = WORLD.islandRadius * 1.02;
    // The slope just past the waterline should be gentle.
    const drop = heightAt(shore, 0) - heightAt(shore + 2, 0);
    const slope = Math.atan2(drop, 2);
    expect(slope).toBeLessThan(0.45);
    // And it does get deep further out.
    expect(slopeAt(shore + 12, 0)).toBeGreaterThan(0.2);
  });
});
