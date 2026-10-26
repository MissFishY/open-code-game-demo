/**
 * Low-poly prop geometries.
 *
 * All shapes are built from Three.js primitives with few segments so the
 * result keeps a chunky, faceted look. A prop can consist of several parts
 * (e.g. a tree = trunk + canopy), each of which can be scaled independently
 * when the prop is harvested.
 *
 * Every part is painted vertex by vertex instead of being filled with one
 * flat colour: the little wander in hue and lightness is what makes the
 * shapes read as brush work rather than as plastic. Colours come from
 * `palette.ts`, so the whole island can be retuned in one place.
 */

import * as THREE from 'three';
import { Rng } from '../utils/rng';
import { FOLIAGE, JITTER, MADE, PALETTE, SHELL } from './palette';

export interface PropPart {
  geometry: THREE.BufferGeometry;
  /** Scale applied to this part when the prop is fully depleted. */
  emptyScale: [number, number, number];
  /** Scale applied to this part when it is partially depleted. */
  partialScale: [number, number, number];
}

export interface PropGeometry {
  parts: PropPart[];
  /** Height of the prop in world units (for placing it on the terrain). */
  height: number;
  /** Radius of the collision circle, 0 when the prop does not block. */
  colliderRadius: number;
}

const FULL: [number, number, number] = [1, 1, 1];
const GONE: [number, number, number] = [0, 0, 0];

// ------------------------------------------------------------------ painting

/**
 * Paints a geometry with a base colour that drifts a little per vertex.
 *
 * The drift is a hash of the vertex position plus a seeded random term, so
 * two neighbouring triangles never share exactly the same tone — the same
 * trick a painter uses when filling a shape with a brush instead of a
 * bucket.
 */
export function paintGeometry(
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
  jitter = JITTER,
  seed = 1,
): void {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const base = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const rng = new Rng(seed);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const n =
      Math.sin(x * 3.1 + y * 2.3 + z * 1.7) * 0.5 +
      Math.sin(x * 7.7 - z * 5.3 + y * 4.1) * 0.3 +
      rng.float(-1, 1) * 0.2;
    const c = new THREE.Color().setHSL(
      hsl.h,
      Math.min(1, Math.max(0, hsl.s + n * jitter * 0.5)),
      Math.min(1, Math.max(0, hsl.l + n * jitter * 0.35)),
    );
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** Flattens a few painted pieces into one geometry (one draw call). */
function mergePieces(pieces: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  for (const piece of pieces) {
    const geometry = piece.index ? piece.toNonIndexed() : piece;
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const color = geometry.getAttribute('color');
    for (let i = 0; i < position.count; i++) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      if (color) colors.push(color.getX(i), color.getY(i), color.getZ(i));
      else colors.push(1, 1, 1);
    }
    if (geometry !== piece) geometry.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return merged;
}

// -------------------------------------------------------------------- stones

/**
 * A stable number for one corner of a shape.
 *
 * Polyhedra keep a separate vertex for every face, so each corner exists
 * three times. Pushing the copies around on their own tears the shape open
 * and the grass shows through; hashing the corner's own coordinates means
 * every copy moves the same way, so the shape stays whole.
 */
function cornerNoise(x: number, y: number, z: number, seed: number): number {
  let h = 2166136261 ^ seed;
  for (const v of [Math.round(x * 1000), Math.round(y * 1000), Math.round(z * 1000)]) {
    h = Math.imul(h ^ (v & 0xffff), 16777619);
    h = Math.imul(h ^ ((v >> 16) & 0xffff), 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967295;
}

/**
 * Pushes every corner of a shape in or out without tearing it apart.
 *
 * `flatBottom` is a fraction of the lowest point: at 0.6 the bottom is
 * sliced off, so a stone sits on the ground instead of balancing on a point.
 */
function wobbleCorners(
  geometry: THREE.BufferGeometry,
  amount: number,
  seed: number,
  flattenY = 1,
  flatBottom = 0,
): void {
  const position = geometry.getAttribute('position');
  const cache = new Map<string, number>();
  let lowest = 0;
  for (let i = 0; i < position.count; i++) lowest = Math.min(lowest, position.getY(i));
  const floor = lowest * flatBottom;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
    let wobble = cache.get(key);
    if (wobble === undefined) {
      wobble = 1 + (cornerNoise(x, y, z, seed) * 2 - 1) * amount;
      cache.set(key, wobble);
    }
    position.setXYZ(i, x * wobble, Math.max(y * wobble * flattenY, floor), z * wobble);
  }
  position.needsUpdate = true;
}

/** Drops a geometry so that its lowest point rests just under y = 0. */
function sitOnGround(geometry: THREE.BufferGeometry, sink = 0.03): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;
  geometry.translate(0, -box.min.y - sink, 0);
}

// --------------------------------------------------------------------- trees

/**
 * The crown of a deciduous tree: a few soft lumps gathered around the middle
 * rather than spread over a circle, and nudged back so the crown's own centre
 * of mass sits over the trunk.
 */
function blobCrown(radius: number, color: number, seed: number, lumps = 3): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const pieces: THREE.BufferGeometry[] = [];
  const placed: { x: number; z: number; r: number; geometry: THREE.BufferGeometry }[] = [];

  for (let i = 0; i < lumps; i++) {
    const r = radius * rng.float(0.58, 0.84);
    const geometry = new THREE.IcosahedronGeometry(r, 1);
    const angle = (i / lumps) * Math.PI * 2 + rng.float(-0.3, 0.3);
    const spread = i === 0 ? 0 : radius * rng.float(0.24, 0.36);
    const x = Math.cos(angle) * spread;
    const z = Math.sin(angle) * spread;
    const y = rng.float(-0.18, 0.22) * radius;
    geometry.translate(x, y, z);
    paintGeometry(geometry, color, JITTER, seed + i * 31);
    pieces.push(geometry);
    placed.push({ x, z, r, geometry });
  }

  // Put the crown's centre of mass back over the trunk.
  let mass = 0;
  let cx = 0;
  let cz = 0;
  for (const blob of placed) {
    const m = blob.r ** 3;
    mass += m;
    cx += blob.x * m;
    cz += blob.z * m;
  }
  const shiftX = cx / mass;
  const shiftZ = cz / mass;

  const merged = mergePieces(pieces);
  for (const piece of pieces) piece.dispose();
  merged.translate(-shiftX, 0, -shiftZ);
  return merged;
}

/** Conifer: a tapered trunk under three soft tiers of needles. */
export function createConifer(
  trunkColor: number = FOLIAGE.trunk,
  leafColor: number = FOLIAGE.conifer,
): PropGeometry {
  const trunk = new THREE.CylinderGeometry(0.17, 0.3, 2.3, 6);
  trunk.translate(0, 1.15, 0);
  paintGeometry(trunk, trunkColor, JITTER, 11);

  const tiers: THREE.BufferGeometry[] = [];
  const spec = [
    { r: 1.42, h: 1.75, y: 2.25 },
    { r: 1.12, h: 1.5, y: 3.05 },
    { r: 0.78, h: 1.2, y: 3.8 },
  ];
  spec.forEach((tier, i) => {
    const cone = new THREE.ConeGeometry(tier.r, tier.h, 7);
    wobbleCorners(cone, 0.05, 120 + i, 1, 0);
    cone.translate(0, tier.y, 0);
    paintGeometry(cone, leafColor, JITTER * 1.2, 220 + i);
    tiers.push(cone);
  });

  return {
    parts: [
      // The trunk stays as a stump when the tree is chopped down.
      { geometry: trunk, emptyScale: [1, 0.28, 1], partialScale: FULL },
      { geometry: mergePieces(tiers), emptyScale: GONE, partialScale: FULL },
    ],
    height: 4.4,
    colliderRadius: 0.42,
  };
}

/** Broadleaf tree: a trunk with a lumpy crown. */
export function createBroadleaf(
  trunkColor: number = FOLIAGE.trunk,
  leafColor: number = FOLIAGE.broadleaf,
): PropGeometry {
  const trunk = new THREE.CylinderGeometry(0.2, 0.33, 2.1, 6);
  trunk.translate(0, 1.05, 0);
  paintGeometry(trunk, trunkColor, JITTER, 21);

  const crown = blobCrown(1.28, leafColor, 33, 3);
  crown.translate(0, 2.62, 0);

  return {
    parts: [
      { geometry: trunk, emptyScale: [1, 0.3, 1], partialScale: FULL },
      { geometry: crown, emptyScale: GONE, partialScale: FULL },
    ],
    height: 3.9,
    colliderRadius: 0.42,
  };
}

// --------------------------------------------------------------- rocks, bush

/** Angular rock, slightly squashed, with a flat base to sit on. */
export function createRock(color: number = PALETTE.rock): PropGeometry {
  const geometry = new THREE.DodecahedronGeometry(0.9, 0);
  geometry.scale(1.12, 0.8, 0.98);
  wobbleCorners(geometry, 0.17, 7, 1, 0.6);
  geometry.computeVertexNormals();
  paintGeometry(geometry, color, JITTER, 41);
  sitOnGround(geometry, 0.04);

  return {
    parts: [{ geometry, emptyScale: [0.35, 0.35, 0.35], partialScale: [0.7, 0.7, 0.7] }],
    height: 1.1,
    colliderRadius: 0.8,
  };
}

/** Berry bush: a low, soft mound with a flattened base. */
export function createBush(color: number = FOLIAGE.bush): PropGeometry {
  const geometry = new THREE.IcosahedronGeometry(0.82, 1);
  wobbleCorners(geometry, 0.12, 19, 0.88, 0.5);
  geometry.computeVertexNormals();
  paintGeometry(geometry, color, JITTER, 53);
  geometry.scale(1.1, 0.95, 1.1);
  sitOnGround(geometry, 0.03);

  return {
    parts: [{ geometry, emptyScale: [0.45, 0.45, 0.45], partialScale: [0.72, 0.72, 0.72] }],
    height: 1.3,
    colliderRadius: 0,
  };
}

/** Reed cluster near the water: tall, thin, a little wind-blown. */
export function createReed(color: number = MADE.reed): PropGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const rng = new Rng(71);
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.ConeGeometry(0.075, rng.float(1.1, 1.75), 4, 1, true);
    blade.translate(0, 0.65, 0);
    blade.rotateX(rng.float(-0.12, 0.12));
    blade.rotateZ(rng.float(-0.14, 0.14));
    blade.translate(rng.float(-0.2, 0.2), 0, rng.float(-0.2, 0.2));
    paintGeometry(blade, color, JITTER, 310 + i);
    pieces.push(blade);
  }
  const geometry = mergePieces(pieces);
  for (const piece of pieces) piece.dispose();

  return {
    parts: [{ geometry, emptyScale: GONE, partialScale: [0.55, 0.55, 0.55] }],
    height: 1.7,
    colliderRadius: 0,
  };
}

// --------------------------------------------------------------------- grass

/**
 * Grass tuft: four blades, each a single triangle.
 *
 * All blades are wound the same way — a tuft whose triangles face opposite
 * directions turns half of itself into dark slivers when the sun is low.
 */
export function createGrassTuft(color: number = FOLIAGE.grass): THREE.BufferGeometry {
  const base = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const rng = new Rng(97);
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  const addBlade = (angle: number, height: number, width: number, lean: number): void => {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const px = -dz * width * 0.5;
    const pz = dx * width * 0.5;
    const tipX = dx * lean;
    const tipZ = dz * lean;

    const v0 = [-px, 0, -pz];
    const v1 = [px, 0, pz];
    const v2 = [tipX, height, tipZ];
    const up =
      (v1[0]! - v0[0]!) * (v2[2]! - v0[2]!) - (v1[2]! - v0[2]!) * (v2[0]! - v0[0]!);
    if (up > 0) {
      positions.push(v0[0]!, v0[1]!, v0[2]!, v1[0]!, v1[1]!, v1[2]!, v2[0]!, v2[1]!, v2[2]!);
    } else {
      positions.push(v0[0]!, v0[1]!, v0[2]!, v2[0]!, v2[1]!, v2[2]!, v1[0]!, v1[1]!, v1[2]!);
    }

    const shade = 0.82 + rng.float(0, 0.35);
    const c = new THREE.Color().setHSL(hsl.h, hsl.s, Math.min(1, hsl.l * shade));
    for (let i = 0; i < 3; i++) {
      colors.push(c.r, c.g, c.b);
      // Blades are lit from above, not from the side.
      normals.push(0, 1, 0);
    }
  };

  addBlade(0.2, 0.46, 0.05, 0.1);
  addBlade(1.9, 0.38, 0.045, -0.08);
  addBlade(3.6, 0.5, 0.05, 0.06);
  addBlade(5.0, 0.33, 0.04, 0.12);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

// ------------------------------------------------------------ flowers, shells

/** Small flower: a thin stem with a soft head. */
export function createFlower(petalColor: number = FOLIAGE.flower): PropGeometry {
  const stem = new THREE.CylinderGeometry(0.03, 0.04, 0.42, 5);
  stem.translate(0, 0.21, 0);
  paintGeometry(stem, FOLIAGE.flowerStem, JITTER, 61);

  const head = new THREE.OctahedronGeometry(0.14, 0);
  head.scale(1, 0.72, 1);
  head.translate(0, 0.46, 0);
  paintGeometry(head, petalColor, JITTER, 67);

  return {
    parts: [
      { geometry: mergePieces([stem, head]), emptyScale: GONE, partialScale: GONE },
    ],
    height: 0.6,
    colliderRadius: 0,
  };
}

/** A scallop: one fan-shaped piece, ribbed, lying flat on the sand. */
function buildScallop(color: number): THREE.BufferGeometry {
  const segments = 16;
  const rings = 3;
  const spread = 1.02;
  const radius = 0.36;
  const positions: number[] = [];

  for (let r = 0; r <= rings; r++) {
    for (let s = 0; s <= segments; s++) {
      const angle = -spread + (s / segments) * spread * 2;
      const out = radius * (r / rings);
      const rib = 0.018 * (0.5 + 0.5 * Math.cos(angle * 12)) * (r / rings);
      const dome = 0.06 * (1 - (r / rings) * (r / rings));
      positions.push(Math.sin(angle) * out, 0.012 + dome + rib, Math.cos(angle) * out);
    }
  }

  const indices: number[] = [];
  const row = segments + 1;
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a0 = r * row + s;
      const a1 = a0 + 1;
      const b0 = (r + 1) * row + s;
      const b1 = b0 + 1;
      indices.push(a0, b0, a1, a1, b0, b1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  paintGeometry(geometry, color, JITTER, 870);
  geometry.scale(0.5, 0.5, 0.5);

  // A hinge where the two halves of the shell would have met.
  const hinge = new THREE.CylinderGeometry(0.045, 0.045, 0.13, 6);
  hinge.rotateZ(Math.PI / 2);
  hinge.translate(0, 0.006, -0.005);
  paintGeometry(hinge, 0xdcc6ab, JITTER, 871);

  const merged = mergePieces([geometry, hinge]);
  geometry.dispose();
  hinge.dispose();
  return merged;
}

/** A conch: a tube that spirals up and narrows to a point. */
function buildConch(color: number): THREE.BufferGeometry {
  const turns = 2.6;
  const steps = 56;
  const sides = 7;
  const point = (t: number): THREE.Vector3 => {
    const angle = t * Math.PI * 2 * turns;
    const spiral = 0.17 * (1 - 0.62 * t) + 0.02;
    return new THREE.Vector3(Math.cos(angle) * spiral, 0.02 + t * 0.3, Math.sin(angle) * spiral);
  };

  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const centre = point(t);
    const ahead = point(Math.min(1, t + 0.01));
    const behind = point(Math.max(0, t - 0.01));
    const tangent = ahead.clone().sub(behind).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    const tube = 0.118 * (1 - 0.84 * t) + 0.008;
    for (let j = 0; j < sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const offset = normal
        .clone()
        .multiplyScalar(Math.cos(angle) * tube)
        .add(binormal.clone().multiplyScalar(Math.sin(angle) * tube));
      positions.push(centre.x + offset.x, centre.y + offset.y, centre.z + offset.z);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + ((j + 1) % sides);
      const c = (i + 1) * sides + j;
      const d = (i + 1) * sides + ((j + 1) % sides);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  paintGeometry(geometry, color, JITTER, 880);
  geometry.scale(0.62, 0.62, 0.62);

  const merged = mergePieces([geometry]);
  geometry.dispose();
  return merged;
}

/**
 * A small sea shell, found along the shoreline. Two species, so a player can
 * tell at a glance which one is lying on the sand.
 */
export function createShellProp(
  color: number = SHELL.scallop,
  kind: 'scallop' | 'conch' = 'scallop',
): PropGeometry {
  const geometry = kind === 'conch' ? buildConch(color) : buildScallop(color);
  return {
    parts: [{ geometry, emptyScale: GONE, partialScale: GONE }],
    height: kind === 'conch' ? 0.22 : 0.14,
    colliderRadius: 0,
  };
}

/** Aether crystal: a stretched octahedron. */
export function createCrystal(color: number = MADE.crystal): PropGeometry {
  const geometry = new THREE.OctahedronGeometry(0.55, 0);
  geometry.scale(0.7, 1.9, 0.7);
  geometry.translate(0, 1.0, 0);
  paintGeometry(geometry, color, JITTER * 0.7, 91);

  return {
    parts: [{ geometry, emptyScale: GONE, partialScale: GONE }],
    height: 2.0,
    colliderRadius: 0.45,
  };
}
