/**
 * Low-poly prop geometries.
 *
 * All shapes are built from Three.js primitives with few segments so the
 * result keeps a chunky, faceted look. A prop can consist of several parts
 * (e.g. a tree = trunk + canopy), each of which can be scaled independently
 * when the prop is harvested.
 */

import * as THREE from 'three';

export interface PropPart {
  geometry: THREE.BufferGeometry;
  /** Scale applied to this part when the prop is fully depleted. */
  emptyScale: [number, number, number];
  /** Scale applied to this part when the prop is partially depleted. */
  partialScale: [number, number, number];
}

export interface PropGeometry {
  parts: PropPart[];
  /** Height of the prop in world units (for placing it on the terrain). */
  height: number;
  /** Radius of the collision circle, 0 when the prop does not block. */
  colliderRadius: number;
}

function withColor(
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
): THREE.BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const FULL: [number, number, number] = [1, 1, 1];

/** Conifer: a tapered trunk with a cone canopy. */
export function createConifer(
  trunkColor = 0x6d4c41,
  leafColor = 0x2e7d32,
): PropGeometry {
  const trunk = withColor(new THREE.CylinderGeometry(0.18, 0.3, 2.4, 6), trunkColor);
  trunk.translate(0, 1.2, 0);

  const canopy = withColor(new THREE.ConeGeometry(1.5, 3.6, 7), leafColor);
  canopy.translate(0, 3.2, 0);

  return {
    parts: [
      // The trunk stays as a stump when the tree is chopped down.
      { geometry: trunk, emptyScale: [1, 0.28, 1], partialScale: FULL },
      { geometry: canopy, emptyScale: [0, 0, 0], partialScale: FULL },
    ],
    height: 4.4,
    colliderRadius: 0.42,
  };
}

/** Broadleaf tree: a trunk with a lumpy canopy. */
export function createBroadleaf(
  trunkColor = 0x795548,
  leafColor = 0x388e3c,
): PropGeometry {
  const trunk = withColor(new THREE.CylinderGeometry(0.22, 0.34, 2.2, 6), trunkColor);
  trunk.translate(0, 1.1, 0);

  const canopy = withColor(new THREE.IcosahedronGeometry(1.45, 0), leafColor);
  canopy.scale(1.05, 0.9, 1.05);
  canopy.translate(0, 2.9, 0);

  return {
    parts: [
      { geometry: trunk, emptyScale: [1, 0.3, 1], partialScale: FULL },
      { geometry: canopy, emptyScale: [0, 0, 0], partialScale: FULL },
    ],
    height: 3.9,
    colliderRadius: 0.42,
  };
}

/** Angular rock, slightly squashed. */
export function createRock(color = 0x8d8d8d): PropGeometry {
  const geometry = withColor(new THREE.DodecahedronGeometry(0.9, 0), color);
  geometry.scale(1.15, 0.78, 1.05);
  geometry.translate(0, 0.55, 0);
  return {
    parts: [{ geometry, emptyScale: [0.35, 0.35, 0.35], partialScale: [0.7, 0.7, 0.7] }],
    height: 1.1,
    colliderRadius: 0.8,
  };
}

/** Berry bush. */
export function createBush(color = 0x33691e): PropGeometry {
  const geometry = withColor(new THREE.IcosahedronGeometry(0.85, 0), color);
  geometry.scale(1.1, 0.85, 1.1);
  geometry.translate(0, 0.62, 0);
  return {
    parts: [{ geometry, emptyScale: [0.45, 0.45, 0.45], partialScale: [0.72, 0.72, 0.72] }],
    height: 1.3,
    colliderRadius: 0,
  };
}

/** Reed cluster near the water. */
export function createReed(color = 0xb9b45a): PropGeometry {
  const geometry = withColor(new THREE.ConeGeometry(0.45, 1.7, 4, 1, true), color);
  geometry.translate(0, 0.85, 0);
  return {
    parts: [{ geometry, emptyScale: [0, 0, 0], partialScale: [0.55, 0.55, 0.55] }],
    height: 1.7,
    colliderRadius: 0,
  };
}

/** Grass tuft: a small cluster of thin blades. */
export function createGrassTuft(color = 0x6aa844): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  // One blade: a narrow four-sided spike.
  const addBlade = (angle: number, height: number, width: number, lean: number): void => {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const sx = -dz * width;
    const sz = dx * width;
    const apexX = dx * lean;
    const apexZ = dz * lean;

    const base = [
      [-sx, 0, -sz],
      [sx, 0, sz],
      [sx, 0, -sz],
      [-sx, 0, sz],
    ];

    for (let i = 0; i < 4; i++) {
      const a = base[i] as number[];
      const b = base[(i + 1) % 4] as number[];
      positions.push(a[0] as number, a[1] as number, a[2] as number);
      positions.push(b[0] as number, b[1] as number, b[2] as number);
      positions.push(apexX, height, apexZ);

      // Face normal (blades are flat, so the normal is horizontal-ish).
      const ex = (b[0] as number) - (a[0] as number);
      const ez = (b[2] as number) - (a[2] as number);
      const len = Math.hypot(ex, ez) || 1;
      const nx = -ez / len;
      const nz = ex / len;

      for (let v = 0; v < 3; v++) {
        colors.push(c.r, c.g, c.b);
        normals.push(nx, 0.45, nz);
      }
    }
  };

  addBlade(0.2, 0.46, 0.045, 0.1);
  addBlade(1.9, 0.38, 0.04, -0.08);
  addBlade(3.6, 0.5, 0.05, 0.06);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

/** Small flower: a stem with a coloured head. */
export function createFlower(petalColor = 0xf48fb1): PropGeometry {
  const stem = withColor(new THREE.CylinderGeometry(0.035, 0.045, 0.45, 4), 0x3f7d28);
  stem.translate(0, 0.22, 0);

  const head = withColor(new THREE.OctahedronGeometry(0.16, 0), petalColor);
  head.scale(1, 0.6, 1);
  head.translate(0, 0.5, 0);

  return {
    parts: [
      { geometry: stem, emptyScale: [0, 0, 0], partialScale: [0, 0, 0] },
      { geometry: head, emptyScale: [0, 0, 0], partialScale: [0, 0, 0] },
    ],
    height: 0.6,
    colliderRadius: 0,
  };
}

/** A small sea shell, found along the shoreline. */
export function createShellProp(color = 0xf0d9c0): PropGeometry {
  // A partial sphere reads as a spiral shell from a distance.
  const geometry = withColor(new THREE.SphereGeometry(0.17, 7, 4, 0, Math.PI * 1.7), color);
  geometry.scale(1, 0.55, 1);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0.06, 0);
  return {
    parts: [{ geometry, emptyScale: [0, 0, 0], partialScale: [0, 0, 0] }],
    height: 0.14,
    colliderRadius: 0,
  };
}

/** Aether crystal: a stretched octahedron. */
export function createCrystal(color = 0x53e0e6): PropGeometry {
  const geometry = withColor(new THREE.OctahedronGeometry(0.55, 0), color);
  geometry.scale(0.7, 1.9, 0.7);
  geometry.translate(0, 1.0, 0);
  return {
    parts: [{ geometry, emptyScale: [0, 0, 0], partialScale: [0, 0, 0] }],
    height: 2.0,
    colliderRadius: 0.45,
  };
}
