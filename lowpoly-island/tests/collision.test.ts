import { describe, expect, it } from 'vitest';
import {
  canStand,
  clampToWorld,
  moveWithSliding,
  resolveCircleCollisions,
  type CircleCollider,
} from '../src/systems/CollisionSystem';
import { heightAt } from '../src/world/terrain';
import { WORLD } from '../src/config';

const always = () => true;
const never = () => false;

describe('resolveCircleCollisions', () => {
  it('leaves a circle that does not overlap anything', () => {
    const colliders: CircleCollider[] = [{ x: 10, z: 10, radius: 1 }];
    const result = resolveCircleCollisions(0, 0, 0.5, colliders);
    expect(result.x).toBeCloseTo(0, 6);
    expect(result.z).toBeCloseTo(0, 6);
  });

  it('pushes a circle out of an obstacle', () => {
    const colliders: CircleCollider[] = [{ x: 0, z: 0, radius: 1 }];
    const result = resolveCircleCollisions(0.5, 0, 0.5, colliders);
    const distance = Math.hypot(result.x, result.z);
    expect(distance).toBeGreaterThanOrEqual(1.49);
    expect(distance).toBeLessThanOrEqual(1.51);
  });

  it('pushes a centred circle towards the side it came from', () => {
    const colliders: CircleCollider[] = [{ x: 0, z: 0, radius: 1 }];
    const result = resolveCircleCollisions(0, 0, 0.5, colliders, { x: -3, z: 0 });
    expect(result.x).toBeCloseTo(-1.5, 3);
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(1.5, 3);
  });

  it('resolves a circle sitting exactly in the centre', () => {
    const colliders: CircleCollider[] = [{ x: 0, z: 0, radius: 1 }];
    const result = resolveCircleCollisions(0, 0, 0.5, colliders);
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(1.5, 3);
  });

  it('separates two overlapping obstacles deterministically', () => {
    const colliders: CircleCollider[] = [
      { x: -0.4, z: 0, radius: 1 },
      { x: 0.4, z: 0, radius: 1 },
    ];
    const a = resolveCircleCollisions(0, 0, 0.5, colliders);
    const b = resolveCircleCollisions(0, 0, 0.5, colliders);
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.z).toBeCloseTo(b.z, 6);
  });
});

describe('moveWithSliding', () => {
  it('moves freely when nothing is in the way', () => {
    const result = moveWithSliding(0, 0, 1, 0, 0.5, [], always);
    expect(result.blocked).toBe(false);
    expect(result.x).toBeCloseTo(1, 6);
  });

  it('slides along an obstacle instead of stopping dead', () => {
    // A rock 2 units ahead: the player can advance until touching it.
    const colliders: CircleCollider[] = [{ x: 2, z: 0, radius: 1 }];
    const result = moveWithSliding(0, 0, 1, 0, 0.5, colliders, always);
    expect(result.blocked).toBe(true);
    // The movement was reduced but not zero.
    expect(result.x).toBeLessThan(1);
    expect(result.x).toBeGreaterThan(0.2);
  });

  it('slides sideways when walking diagonally into an obstacle', () => {
    const colliders: CircleCollider[] = [{ x: 2, z: 0.2, radius: 1 }];
    const result = moveWithSliding(0, 0, 1, 0, 0.5, colliders, always);
    // The player is pushed off the straight line instead of stopping.
    expect(Math.abs(result.z)).toBeGreaterThan(0.01);
    expect(result.x).toBeGreaterThan(0.1);
  });

  it('never ends up inside an obstacle', () => {
    const colliders: CircleCollider[] = [{ x: 2, z: 0, radius: 1 }];
    for (let step = 0; step < 40; step++) {
      const from = step * 0.05;
      const result = moveWithSliding(from, 0, from + 0.05, 0, 0.5, colliders, always);
      const distance = Math.hypot(result.x - 2, result.z);
      expect(distance).toBeGreaterThanOrEqual(1.5 - 1e-6);
    }
  });

  it('stays put when the destination is not walkable', () => {
    const result = moveWithSliding(0, 0, 5, 5, 0.5, [], never);
    expect(result.blocked).toBe(true);
    expect(result.x).toBe(0);
    expect(result.z).toBe(0);
  });
});

describe('terrain rules', () => {
  it('allows standing on the village green', () => {
    expect(canStand(0, 0, 0.72, 1.1)).toBe(true);
  });

  it('does not allow standing in the middle of the lake', () => {
    expect(canStand(WORLD.lake.x, WORLD.lake.z, 0.72, 1.1)).toBe(false);
  });

  it('does not allow standing in deep ocean', () => {
    const far = WORLD.islandRadius * 1.4;
    expect(canStand(far, far, 0.72, 1.1)).toBe(false);
  });

  it('keeps the player inside the world bounds', () => {
    const clamped = clampToWorld(500, 0);
    expect(Math.hypot(clamped.x, clamped.z)).toBeLessThanOrEqual(WORLD.islandRadius + 2);
  });

  it('has ground below the spawn point', () => {
    expect(heightAt(0, 0)).toBeGreaterThan(0);
  });
});
