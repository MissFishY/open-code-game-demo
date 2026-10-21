/**
 * Collision helpers.
 *
 * The player is modelled as a vertical circle (capsule approximation) on the
 * XZ plane. Terrain collision is analytic — we sample the height function
 * directly — and static obstacles are simple circles.
 *
 * Pure functions only, so the whole thing can be unit tested without a renderer.
 */

import { heightAt, normalAt, slopeAt, waterDepthAt } from '../world/terrain';
import { WORLD } from '../config';
import { clamp } from '../utils/math';

export { waterDepthAt };

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
  /** Optional tag so callers can ignore certain obstacles. */
  tag?: string;
}

/** Uniform spatial hash for fast broad-phase queries. */
export class SpatialHash {
  private cells = new Map<string, CircleCollider[]>();

  constructor(private readonly cellSize = 10) {}

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  insert(collider: CircleCollider): void {
    const cx = Math.floor(collider.x / this.cellSize);
    const cz = Math.floor(collider.z / this.cellSize);
    const key = this.key(cx, cz);
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(collider);
  }

  /** All colliders whose cell overlaps the query circle. */
  query(x: number, z: number, radius: number): CircleCollider[] {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minZ = Math.floor((z - radius) / this.cellSize);
    const maxZ = Math.floor((z + radius) / this.cellSize);

    const out: CircleCollider[] = [];
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = this.cells.get(this.key(cx, cz));
        if (!bucket) continue;
        for (const c of bucket) out.push(c);
      }
    }
    return out;
  }

  /** Removes a collider again. */
  remove(collider: CircleCollider): void {
    const cx = Math.floor(collider.x / this.cellSize);
    const cz = Math.floor(collider.z / this.cellSize);
    const bucket = this.cells.get(this.key(cx, cz));
    if (!bucket) return;
    const index = bucket.indexOf(collider);
    if (index >= 0) bucket.splice(index, 1);
  }
}

/**
 * Pushes a circle out of every overlapping collider.
 * Returns the corrected position.
 *
 * `reference` is the position the circle came from. It is used to decide
 * which side to push a circle out on when it ends up exactly in the centre
 * of a collider, which is what makes sliding along obstacles feel right.
 */
export function resolveCircleCollisions(
  x: number,
  z: number,
  radius: number,
  colliders: readonly CircleCollider[],
  reference?: { x: number; z: number },
): { x: number; z: number } {
  let px = x;
  let pz = z;

  for (const collider of colliders) {
    const dx = px - collider.x;
    const dz = pz - collider.z;
    const minDistance = radius + collider.radius;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= minDistance * minDistance) continue;

    const distance = Math.sqrt(distanceSq);
    if (distance > 1e-5) {
      const push = (minDistance - distance) / distance;
      px += dx * push;
      pz += dz * push;
    } else {
      // Dead centre: push towards the side the circle came from.
      let rx = (reference?.x ?? px) - collider.x;
      let rz = (reference?.z ?? pz) - collider.z;
      let length = Math.hypot(rx, rz);
      if (length < 1e-5) {
        rx = -1;
        rz = 0;
        length = 1;
      }
      px = collider.x + (rx / length) * minDistance;
      pz = collider.z + (rz / length) * minDistance;
    }
  }

  return { x: px, z: pz };
}

/** True when the terrain at (x, z) is not steeper than the given limit. */
export function isSlopeWalkable(x: number, z: number, maxSlope: number): boolean {
  return slopeAt(x, z) <= maxSlope;
}

/**
 * True when the player is allowed to stand at (x, z).
 * Too steep, or deeper than the wading limit, is not allowed.
 */
export function canStand(
  x: number,
  z: number,
  maxSlope: number,
  maxWadeDepth: number,
): boolean {
  if (!isSlopeWalkable(x, z, maxSlope)) return false;
  return waterDepthAt(x, z) <= maxWadeDepth;
}

export interface MovementRuleOptions {
  /** Water depth at the player's current position. */
  currentDepth: number;
  /** Ground height at the player's current position. */
  currentGround: number;
  /** How deep the player can wade. */
  maxWadeDepth: number;
  /** The steepest slope the player can walk up. */
  maxSlope: number;
  /** True when the player owns something that lets them swim. */
  canSwim: boolean;
  /** True when the player is currently swimming. */
  swimming: boolean;
}

/**
 * Decides whether the player may move to a spot.
 *
 * The important rule is that the player must never be able to get *stuck*:
 *
 *  - Water deeper than the wading limit is a wall for a swimmer-less player,
 *    so they can never walk into the sea and drown on the bottom.
 *  - But if they somehow end up in deep water, they may always move where
 *    the water is no deeper than it is now — that guarantees there is a way
 *    out, even across a flat lake bed.
 *  - A player who can swim is never stopped by the depth of the water.
 */
export function canMoveTo(x: number, z: number, options: MovementRuleOptions): boolean {
  // While swimming the terrain rules do not apply at all.
  if (options.swimming) return true;

  const newDepth = waterDepthAt(x, z);
  if (newDepth > options.maxWadeDepth) {
    // Too deep to wade. Swimmers may go in; everybody else may only move
    // where the water is no deeper than it is now.
    if (options.canSwim) return true;
    return (
      options.currentDepth > options.maxWadeDepth &&
      newDepth <= options.currentDepth + 1e-3
    );
  }

  if (!canStand(x, z, options.maxSlope, options.maxWadeDepth)) {
    // Going downhill is always allowed so the player never gets stuck.
    return heightAt(x, z) < options.currentGround + 0.02;
  }
  return true;
}

/**
 * Moves a circle from `from` to `to`, sliding along obstacles.
 *
 * The move is performed in small sub-steps, each of which is resolved against
 * the colliders. Because every sub-step is pushed out of any overlap, the
 * player naturally slides around trees and rocks instead of stopping dead in
 * front of them.
 */
export function moveWithSliding(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  radius: number,
  colliders: readonly CircleCollider[],
  canStandAt: (x: number, z: number) => boolean,
): { x: number; z: number; blocked: boolean } {
  const intended = Math.hypot(toX - fromX, toZ - fromZ);
  if (intended < 1e-6) {
    return { x: fromX, z: fromZ, blocked: false };
  }

  // Sub-steps small enough that the player never tunnels through a collider.
  const maxStep = Math.max(radius * 0.75, 0.12);
  const steps = Math.min(8, Math.max(1, Math.ceil(intended / maxStep)));

  let x = fromX;
  let z = fromZ;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const targetX = fromX + (toX - fromX) * t;
    const targetZ = fromZ + (toZ - fromZ) * t;

    if (canStandAt(targetX, targetZ)) {
      const resolved = resolveCircleCollisions(targetX, targetZ, radius, colliders, { x, z });
      x = resolved.x;
      z = resolved.z;
      continue;
    }

    // The terrain blocks the straight line — try each axis on its own so the
    // player can still slide along the edge of a slope.
    if (canStandAt(targetX, z)) {
      const resolved = resolveCircleCollisions(targetX, z, radius, colliders, { x, z });
      x = resolved.x;
      z = resolved.z;
    }
    if (canStandAt(x, targetZ)) {
      const resolved = resolveCircleCollisions(x, targetZ, radius, colliders, { x, z });
      x = resolved.x;
      z = resolved.z;
    }
  }

  const travelled = Math.hypot(x - fromX, z - fromZ);
  return { x, z, blocked: travelled < intended - 1e-3 };
}

/** Clamps a point to the island's shoreline (used to keep the player in bounds). */
export function clampToWorld(x: number, z: number, margin = 2): { x: number; z: number } {
  const limit = WORLD.islandRadius + margin;
  const d = Math.hypot(x, z);
  if (d <= limit || d === 0) return { x, z };
  const scale = limit / d;
  return { x: x * scale, z: z * scale };
}

/** Downhill direction on the terrain, used to make the player slide on slopes. */
export function downhillVector(x: number, z: number): { x: number; z: number } {
  const n = normalAt(x, z);
  const len = Math.hypot(n.x, n.z);
  if (len < 1e-5) return { x: 0, z: 0 };
  return { x: -n.x / len, z: -n.z / len };
}

/** Slope in radians at a position, clamped to [0, PI/2]. */
export function slopeRadians(x: number, z: number): number {
  return clamp(slopeAt(x, z), 0, Math.PI / 2);
}
