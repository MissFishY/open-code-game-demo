import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/Player';
import { SpatialHash } from '../src/systems/CollisionSystem';
import { heightAt, waterDepthAt } from '../src/world/terrain';
import { WORLD } from '../src/config';

const LAKE = WORLD.lake;

/** Normalised direction from the lake towards the middle of the island. */
function towardsShore(): { x: number; z: number } {
  const dx = 0 - LAKE.x;
  const dz = 0 - LAKE.z;
  const length = Math.hypot(dx, dz);
  return { x: dx / length, z: dz / length };
}

/** Walks the player in a direction until they reach dry land (or give up). */
function walkUntilDryLand(
  player: Player,
  direction: { x: number; z: number },
  maxFrames = 4000,
): number {
  const hash = new SpatialHash();
  for (let frame = 0; frame < maxFrames; frame++) {
    player.update(1 / 60, direction, false, false, hash);
    if (heightAt(player.position.x, player.position.z) > -0.2) return frame;
  }
  return maxFrames;
}

describe('the player can always get out of the water', () => {
  it('stands on the bottom of the lake when dropped in', () => {
    const player = new Player(LAKE.x, LAKE.z);
    player.canSwim = false;
    const hash = new SpatialHash();
    for (let i = 0; i < 180; i++) player.update(1 / 60, { x: 0, z: 0 }, false, false, hash);

    expect(waterDepthAt(player.position.x, player.position.z)).toBeGreaterThan(3);
    expect(player.position.y).toBeLessThan(-3);
  });

  it('walks out of the lake without a swimsuit', () => {
    const player = new Player(LAKE.x, LAKE.z);
    player.canSwim = false;
    const hash = new SpatialHash();
    for (let i = 0; i < 180; i++) player.update(1 / 60, { x: 0, z: 0 }, false, false, hash);

    const frames = walkUntilDryLand(player, towardsShore());

    expect(frames).toBeLessThan(4000);
    expect(heightAt(player.position.x, player.position.z)).toBeGreaterThan(-0.2);
  });

  it('swims out of the lake with a swimsuit and floats on the surface', () => {
    const player = new Player(LAKE.x, LAKE.z);
    player.canSwim = true;
    const hash = new SpatialHash();
    for (let i = 0; i < 180; i++) player.update(1 / 60, { x: 0, z: 0 }, false, false, hash);

    expect(player.swimming).toBe(true);
    // Floating on the surface, not walking on the bottom.
    expect(player.position.y).toBeGreaterThan(-1);

    const frames = walkUntilDryLand(player, towardsShore());
    expect(frames).toBeLessThan(4000);
    expect(heightAt(player.position.x, player.position.z)).toBeGreaterThan(-0.2);
  });

  it('stops a swimmer-less player at the edge of the sea', () => {
    const player = new Player(56, 0);
    player.canSwim = false;
    const hash = new SpatialHash();
    for (let i = 0; i < 120; i++) player.update(1 / 60, { x: 0, z: 0 }, false, false, hash);

    for (let i = 0; i < 1200; i++) {
      player.update(1 / 60, { x: 1, z: 0 }, false, false, hash);
    }
    // They got their feet wet but not their head.
    expect(waterDepthAt(player.position.x, player.position.z)).toBeLessThanOrEqual(1.15);
  });

  it('lets a swimmer cross the sea and come back', () => {
    const player = new Player(56, 0);
    player.canSwim = true;
    const hash = new SpatialHash();
    for (let i = 0; i < 120; i++) player.update(1 / 60, { x: 0, z: 0 }, false, false, hash);

    for (let i = 0; i < 1500; i++) {
      player.update(1 / 60, { x: 1, z: 0 }, false, false, hash);
    }
    expect(player.position.x).toBeGreaterThan(75);

    for (let i = 0; i < 2500; i++) {
      player.update(1 / 60, { x: -1, z: 0 }, false, false, hash);
    }
    expect(player.position.x).toBeLessThan(58);
  });
});
