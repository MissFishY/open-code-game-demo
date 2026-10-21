import { describe, expect, it } from 'vitest';
import { canMoveTo } from '../src/systems/CollisionSystem';
import { WORLD } from '../src/config';
import { heightAt, waterDepthAt } from '../src/world/terrain';

const MAX_WADE = 1.1;
const MAX_SLOPE = 0.72;

/** The options for a player standing on dry land. */
function onLand(overrides: Partial<Parameters<typeof canMoveTo>[2]> = {}) {
  return {
    currentDepth: 0,
    currentGround: 2,
    maxWadeDepth: MAX_WADE,
    maxSlope: MAX_SLOPE,
    canSwim: false,
    swimming: false,
    ...overrides,
  };
}

describe('water movement rules', () => {
  const lake = WORLD.lake;

  it('the lake really is too deep to wade into', () => {
    expect(waterDepthAt(lake.x, lake.z)).toBeGreaterThan(MAX_WADE);
  });

  it('stops a swimmer-less player from walking into deep water', () => {
    expect(canMoveTo(lake.x, lake.z, onLand())).toBe(false);
  });

  it('lets a player with a swimsuit go into deep water', () => {
    expect(canMoveTo(lake.x, lake.z, onLand({ canSwim: true }))).toBe(true);
  });

  it('always lets a player in deep water move back towards the shore', () => {
    // The player is standing on the lake floor.
    const currentDepth = waterDepthAt(lake.x, lake.z);
    const currentGround = heightAt(lake.x, lake.z);

    // Walk one step towards the middle of the island, which is shallower.
    const dx = 0 - lake.x;
    const dz = 0 - lake.z;
    const length = Math.hypot(dx, dz);
    const x = lake.x + (dx / length) * 1.2;
    const z = lake.z + (dz / length) * 1.2;

    expect(waterDepthAt(x, z)).toBeLessThan(currentDepth);
    expect(
      canMoveTo(x, z, onLand({ currentDepth, currentGround })),
    ).toBe(true);
  });

  it('always lets a player in deep water move where the water is no deeper', () => {
    // The player is standing on the flat bed in the middle of the lake.
    const currentDepth = waterDepthAt(lake.x, lake.z);
    const currentGround = heightAt(lake.x, lake.z);

    // Walk one step in any direction: the bed is flat, so the depth is the
    // same — and that must still be allowed, or the player is stuck.
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = lake.x + Math.cos(angle) * 0.3;
      const z = lake.z + Math.sin(angle) * 0.3;
      expect(
        canMoveTo(x, z, onLand({ currentDepth, currentGround })),
      ).toBe(true);
    }
  });

  it('never traps the player: from any spot in the lake there is a way out', () => {
    const options = onLand({
      currentGround: heightAt(lake.x, lake.z),
      currentDepth: waterDepthAt(lake.x, lake.z),
    });

    // At least one direction must lead somewhere the player may go.
    let allowed = 0;
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const x = lake.x + Math.cos(angle) * 1;
      const z = lake.z + Math.sin(angle) * 1;
      if (canMoveTo(x, z, options)) allowed++;
    }
    expect(allowed).toBeGreaterThan(0);
  });

  it('does not let a swimmer-less player walk any deeper', () => {
    // Standing on the slope that goes down into the lake.
    const from = { x: lake.x + lake.radius * 0.8, z: lake.z };
    const currentDepth = waterDepthAt(from.x, from.z);
    const currentGround = heightAt(from.x, from.z);
    if (currentDepth <= MAX_WADE) return; // not deep enough to test

    // Straight out into the middle of the lake is deeper.
    const deeper = { x: lake.x, z: lake.z };
    if (waterDepthAt(deeper.x, deeper.z) > currentDepth) {
      expect(
        canMoveTo(deeper.x, deeper.z, onLand({ currentDepth, currentGround })),
      ).toBe(false);
    }
  });

  it('lets a swimming player go anywhere', () => {
    expect(canMoveTo(lake.x, lake.z, onLand({ swimming: true }))).toBe(true);
    expect(canMoveTo(500, 500, onLand({ swimming: true }))).toBe(true);
  });

  it('still blocks swimming-less players from the open sea', () => {
    // A point well out to sea, past the shelf.
    const x = WORLD.islandRadius * 1.15;
    expect(waterDepthAt(x, 0)).toBeGreaterThan(MAX_WADE);
    expect(canMoveTo(x, 0, onLand())).toBe(false);
    expect(canMoveTo(x, 0, onLand({ canSwim: true }))).toBe(true);
  });

  it('keeps the normal slope rule on dry land', () => {
    // Flat ground in the village is fine.
    expect(canMoveTo(0.5, 0.5, onLand())).toBe(true);
  });
});
