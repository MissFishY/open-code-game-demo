/**
 * Terrain definition.
 *
 * The terrain is described by a *pure analytic height function* rather than by
 * a baked heightmap. That has two big advantages:
 *
 *  1. Collision can sample the exact ground height anywhere at any time,
 *     with no raycasting and no risk of drifting away from the visual mesh.
 *  2. The world is fully deterministic — the same seed always produces the
 *     same island, which is what makes save/load of harvested resources work.
 *
 * This module deliberately has **no Three.js import** so it can be unit tested
 * in plain Node.
 */

import { WORLD } from '../config';
import { signedFbm2D, fbm2D } from '../utils/noise';
import { clamp, clamp01, lerp, smoothstep } from '../utils/math';

export interface Hill {
  x: number;
  z: number;
  height: number;
  radius: number;
}

/** Hills that make up the island's relief. */
export const HILLS: readonly Hill[] = [
  { x: 26, z: -18, height: 13, radius: 20 },
  { x: -12, z: -34, height: 9, radius: 16 },
  { x: 20, z: 28, height: 6.5, radius: 13 },
  { x: 40, z: 16, height: 7, radius: 14 },
  { x: -44, z: -6, height: 5, radius: 12 },
  { x: 6, z: 44, height: 4.5, radius: 12 },
];

/** Base elevation of the island plateau. */
const BASE_ELEVATION = 2.4;
/** Amplitude of the rolling noise that breaks up the plateau. */
const NOISE_AMPLITUDE = 2.6;
/** The plateau fades to zero between these normalised radii. */
const FALLOFF_START = 0.5;
const FALLOFF_END = 1.04;

/**
 * 1 in the middle of the island, 0 past the shoreline.
 * Multiplied with the elevation so the island sinks into the sea.
 */
export function islandMask(x: number, z: number): number {
  const d = Math.hypot(x, z) / WORLD.islandRadius;
  return 1 - smoothstep(FALLOFF_START, FALLOFF_END, d);
}

/** Smooth radial bump used to build the hills: ~1 at the centre, ~0 at `radius`. */
function bump(distance: number, radius: number): number {
  const t = distance / radius;
  return Math.exp(-2.3 * t * t);
}

/**
 * Ground height (world Y) at the given XZ position.
 * This is the single source of truth for both rendering and collision.
 */
export function heightAt(x: number, z: number): number {
  const mask = islandMask(x, z);

  const noise = signedFbm2D(x * 0.03, z * 0.03, WORLD.seed, 4);
  let height = BASE_ELEVATION + noise * NOISE_AMPLITUDE;

  for (const hill of HILLS) {
    const d = Math.hypot(x - hill.x, z - hill.z);
    height += hill.height * bump(d, hill.radius);
  }

  // Flatten the island towards the sea.
  height *= mask;

  // Continue the sea floor downwards past the shoreline so the ocean reads as
  // deep water instead of a flat puddle.
  //
  // The first stretch is deliberately gentle: a wide, shallow beach that can
  // be waded into and out of. The shelf only drops away steeply further out,
  // once the water is already too deep to stand in.
  const d = Math.hypot(x, z) / WORLD.islandRadius;
  height -= smoothstep(FALLOFF_END, 1.15, d) * 1.8 + smoothstep(1.15, 1.45, d) * 16.2;

  // Carve the inland lake: blend the terrain down to a flat lake bed.
  const lake = WORLD.lake;
  const lakeDistance = Math.hypot(x - lake.x, z - lake.z);
  const lakeT = 1 - smoothstep(0.55, 1.0, lakeDistance / lake.radius);
  if (lakeT > 0) {
    height = lerp(height, -lake.depth, lakeT);
  }

  return height;
}

/** Approximate surface normal, derived from finite differences of `heightAt`. */
export function normalAt(x: number, z: number, epsilon = 0.6): { x: number; y: number; z: number } {
  const hL = heightAt(x - epsilon, z);
  const hR = heightAt(x + epsilon, z);
  const hD = heightAt(x, z - epsilon);
  const hU = heightAt(x, z + epsilon);

  const nx = hL - hR;
  const nz = hD - hU;
  const ny = 2 * epsilon;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

/** Slope of the ground in radians (0 = flat). */
export function slopeAt(x: number, z: number): number {
  const n = normalAt(x, z);
  return Math.acos(clamp(n.y, -1, 1));
}

/** True when the position is below the water surface. */
export function isUnderwater(x: number, z: number): boolean {
  return heightAt(x, z) < WORLD.waterLevel;
}

/** True when the position is walkable land (dry and not absurdly steep). */
export function isLand(x: number, z: number, maxSlope = 0.72): boolean {
  const h = heightAt(x, z);
  if (h < WORLD.waterLevel + 0.05) return false;
  return slopeAt(x, z) <= maxSlope;
}

/** Water depth at a position (0 when dry). */
export function waterDepthAt(x: number, z: number): number {
  return Math.max(0, WORLD.waterLevel - heightAt(x, z));
}

export type TerrainKind = 'sand' | 'grass' | 'forest' | 'rock' | 'underwater';

/** Classifies the terrain for colouring / logic purposes. */
export function terrainKindAt(x: number, z: number): TerrainKind {
  const h = heightAt(x, z);
  if (h < WORLD.waterLevel) return 'underwater';
  if (h < 0.85) return 'sand';
  if (h > 7.5 && slopeAt(x, z) > 0.42) return 'rock';
  return 'grass';
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const COLORS = {
  wetSand: { r: 0.71, g: 0.63, b: 0.45 },
  sand: { r: 0.88, g: 0.8, b: 0.56 },
  grassLow: { r: 0.44, g: 0.6, b: 0.27 },
  grassHigh: { r: 0.52, g: 0.66, b: 0.33 },
  forest: { r: 0.29, g: 0.47, b: 0.24 },
  rock: { r: 0.5, g: 0.5, b: 0.5 },
  rockDark: { r: 0.38, g: 0.39, b: 0.4 },
} satisfies Record<string, Rgb>;

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

/**
 * Colour of the ground at a position, used to build the vertex-coloured
 * terrain mesh. Slight noise keeps the flat-shaded facets from looking
 * too uniform.
 *
 * `height` can be supplied when the caller already knows the elevation
 * (the terrain mesh builder works on a precomputed height grid).
 */
export function colorAt(x: number, z: number, slope = 0, height?: number): Rgb {
  const h = height ?? heightAt(x, z);
  const tint = fbm2D(x * 0.12, z * 0.12, WORLD.seed + 91, 3);

  if (h < WORLD.waterLevel - 0.15) {
    return mixRgb(COLORS.wetSand, COLORS.sand, clamp01((h + 2.2) / 2.2) * 0.6 + tint * 0.15);
  }
  if (h < 0.85) {
    return mixRgb(COLORS.wetSand, COLORS.sand, clamp01((h - WORLD.waterLevel) / 0.85));
  }

  const altitude = clamp01((h - 0.85) / 6.5);
  let color = mixRgb(COLORS.grassLow, COLORS.grassHigh, altitude * 0.6 + tint * 0.4);

  // Steep faces expose rock.
  if (slope > 0.38) {
    const rockT = clamp01((slope - 0.38) / 0.45);
    color = mixRgb(color, mixRgb(COLORS.rockDark, COLORS.rock, tint), rockT);
  }
  return color;
}

/**
 * 0..1 density of tree cover. Used to cluster trees naturally and to darken
 * the ground where the canopy is thick.
 */
export function forestDensity(x: number, z: number): number {
  const n = fbm2D(x * 0.045, z * 0.045, WORLD.seed + 777, 3);
  const h = heightAt(x, z);
  if (h < 1.0 || h > 9.5) return 0;
  // Trees avoid the highest peaks and the wet shore.
  const altitudeFade = 1 - smoothstep(6.5, 9.5, h);
  const shoreFade = smoothstep(1.0, 2.4, h);
  return clamp01((n - 0.42) * 2.4) * altitudeFade * shoreFade;
}
