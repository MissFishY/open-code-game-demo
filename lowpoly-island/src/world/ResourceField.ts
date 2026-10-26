/**
 * Scatterable resource props: trees, rocks, bushes, reeds, flowers and
 * aether crystals.
 *
 * Everything is rendered with `InstancedMesh` so a few hundred props cost
 * only a handful of draw calls. Each prop is also a *resource node* that can
 * be harvested; harvesting is recorded in the save file by node id.
 */

import * as THREE from 'three';
import { WORLD, WORLD_LAYOUT } from '../config';
import { Rng } from '../utils/rng';
import { forestDensity, heightAt, slopeAt, waterDepthAt } from './terrain';
import {
  createBroadleaf,
  createBush,
  createConifer,
  createCrystal,
  createFlower,
  createGrassTuft,
  createReed,
  createRock,
  createShellProp,
  type PropGeometry,
} from './PropBuilder';
import { FOLIAGE, MADE, PALETTE, SHELL } from './palette';
import type { CircleCollider } from '../systems/CollisionSystem';

export type ResourceKind =
  | 'wood'
  | 'stone'
  | 'fiber'
  | 'berry'
  | 'flower'
  | 'crystal'
  | 'shell'
  | 'deepshell';

export interface NodePart {
  mesh: THREE.InstancedMesh;
  index: number;
  /** Scale of this part when the node is fully depleted. */
  emptyScale: THREE.Vector3;
  /** Scale of this part when the node is partially depleted. */
  partialScale: THREE.Vector3;
}

export interface ResourceNode {
  id: string;
  kind: ResourceKind;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
  amount: number;
  maxAmount: number;
  harvested: boolean;
  label: string;
  parts: NodePart[];
  /** Collider that blocks movement, if any. */
  collider?: CircleCollider;
}

export interface Placement {
  kind: ResourceKind;
  x: number;
  z: number;
  y: number;
  rotationY: number;
  scale: number;
  amount: number;
  variant: number;
}

const LABEL_BY_KIND: Record<ResourceKind, string> = {
  wood: '砍树',
  stone: '挖石头',
  fiber: '割芦苇',
  berry: '摘浆果',
  flower: '摘野花',
  crystal: '取以太水晶',
  shell: '捡海贝',
  deepshell: '潜水捡深海螺',
};

const YIELD_BY_KIND: Record<ResourceKind, string> = {
  wood: 'wood',
  stone: 'stone',
  fiber: 'fiber',
  berry: 'berry',
  flower: 'flower',
  crystal: 'crystal',
  shell: 'shell',
  deepshell: 'deepshell',
};

/** How close a prop may be to the player spawn / an NPC. */
function isReservedArea(x: number, z: number, radius: number): boolean {
  const spawn = WORLD_LAYOUT.spawn;
  if (Math.hypot(x - spawn.x, z - spawn.z) < WORLD_LAYOUT.villageClearRadius + radius) {
    return true;
  }
  // Keep the build site and the workbench clear of scattered props.
  for (const spot of [WORLD_LAYOUT.buildSite, WORLD_LAYOUT.workbench]) {
    if (Math.hypot(x - spot.x, z - spot.z) < 3.5 + radius) return true;
  }
  for (const spot of Object.values(WORLD_LAYOUT.npcSpots)) {
    if (Math.hypot(x - spot.x, z - spot.z) < 4 + radius) return true;
  }
  return false;
}

/**
 * Scatters props on a jittered grid and keeps the ones that pass `accept`.
 *
 * `minDistance` enforces a minimum spacing between accepted points, which
 * keeps props from overlapping into unreadable clumps.
 */
function scatter(
  rng: Rng,
  cell: number,
  radius: number,
  accept: (x: number, z: number) => boolean,
  minDistance = 0,
): Array<{ x: number; z: number }> {
  const points: Array<{ x: number; z: number }> = [];
  const limit = WORLD.islandRadius * 1.05;
  const steps = Math.ceil(limit / cell);

  // Spatial hash of the accepted points, used for the spacing check.
  const buckets = new Map<string, Array<{ x: number; z: number }>>();
  const bucketKey = (i: number, j: number) => `${i},${j}`;
  const bucketSize = Math.max(cell, minDistance || cell);
  const searchRange = Math.max(1, Math.ceil(minDistance / bucketSize));

  for (let gx = -steps; gx <= steps; gx++) {
    for (let gz = -steps; gz <= steps; gz++) {
      const x = (gx + rng.float(0.15, 0.85)) * cell;
      const z = (gz + rng.float(0.15, 0.85)) * cell;
      if (Math.hypot(x, z) > radius) continue;
      if (!accept(x, z)) continue;

      if (minDistance > 0) {
        const bi = Math.floor(x / bucketSize);
        const bj = Math.floor(z / bucketSize);
        let tooClose = false;
        for (let i = bi - searchRange; i <= bi + searchRange && !tooClose; i++) {
          for (let j = bj - searchRange; j <= bj + searchRange && !tooClose; j++) {
            const bucket = buckets.get(bucketKey(i, j));
            if (!bucket) continue;
            for (const point of bucket) {
              if (Math.hypot(point.x - x, point.z - z) < minDistance) {
                tooClose = true;
                break;
              }
            }
          }
        }
        if (tooClose) continue;
      }

      points.push({ x, z });
      const bi = Math.floor(x / bucketSize);
      const bj = Math.floor(z / bucketSize);
      const key = bucketKey(bi, bj);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = [];
        buckets.set(key, bucket);
      }
      bucket.push({ x, z });
    }
  }
  return points;
}

/** Decides where every prop of the island lives. Pure and deterministic. */
export function planPlacements(seed = WORLD.seed): Placement[] {
  const rng = new Rng(seed);
  const placements: Placement[] = [];

  // ---- Trees (wood) -----------------------------------------------------
  const treeSpots = scatter(rng, 3.6, WORLD.islandRadius, (x, z) => {
    const h = heightAt(x, z);
    if (h < 1.3 || h > 9.5) return false;
    if (slopeAt(x, z) > 0.36) return false;
    if (isReservedArea(x, z, 2.2)) return false;
    const density = forestDensity(x, z);
    return density > 0.04 && rng.next() < density * 0.95;
  }, 3.0);
  for (const spot of treeSpots) {
    placements.push({
      kind: 'wood',
      x: spot.x,
      z: spot.z,
      y: heightAt(spot.x, spot.z),
      rotationY: rng.float(0, Math.PI * 2),
      scale: rng.float(0.78, 1.3),
      amount: 1,
      variant: rng.bool(0.58) ? 0 : 1,
    });
  }

  // ---- Rocks (stone) ----------------------------------------------------
  const rockSpots = scatter(rng, 5.2, WORLD.islandRadius, (x, z) => {
    const h = heightAt(x, z);
    if (h < 0.55 || h > 13) return false;
    if (slopeAt(x, z) > 0.62) return false;
    if (isReservedArea(x, z, 1.6)) return false;
    return rng.next() < 0.55;
  }, 2.2);
  for (const spot of rockSpots) {
    placements.push({
      kind: 'stone',
      x: spot.x,
      z: spot.z,
      y: heightAt(spot.x, spot.z),
      rotationY: rng.float(0, Math.PI * 2),
      scale: rng.float(0.7, 1.5),
      amount: 2,
      variant: 0,
    });
  }

  // ---- Bushes (berries) -------------------------------------------------
  const bushSpots = scatter(rng, 4.4, WORLD.islandRadius, (x, z) => {
    const h = heightAt(x, z);
    if (h < 1.0 || h > 7.5) return false;
    if (slopeAt(x, z) > 0.3) return false;
    if (isReservedArea(x, z, 1.2)) return false;
    return forestDensity(x, z) > 0.08 && rng.next() < 0.6;
  }, 2.4);
  for (const spot of bushSpots) {
    placements.push({
      kind: 'berry',
      x: spot.x,
      z: spot.z,
      y: heightAt(spot.x, spot.z),
      rotationY: rng.float(0, Math.PI * 2),
      scale: rng.float(0.8, 1.25),
      amount: 2,
      variant: 0,
    });
  }

  // ---- Reeds (fiber) ----------------------------------------------------
  const lake = WORLD.lake;
  const reedSpots = scatter(rng, 3.0, WORLD.islandRadius, (x, z) => {
    const depth = waterDepthAt(x, z);
    if (depth < -0.9 || depth > 1.1) return false;
    const lakeDistance = Math.hypot(x - lake.x, z - lake.z);
    const nearLake = lakeDistance < lake.radius * 2.0;
    const shoreDistance = Math.hypot(x, z);
    const nearShore = shoreDistance > WORLD.islandRadius * 0.72;
    if (!nearLake && !nearShore) return false;
    if (isReservedArea(x, z, 1.0)) return false;
    return rng.next() < 0.55;
  }, 1.8);
  for (const spot of reedSpots) {
    placements.push({
      kind: 'fiber',
      x: spot.x,
      z: spot.z,
      y: heightAt(spot.x, spot.z),
      rotationY: rng.float(0, Math.PI * 2),
      scale: rng.float(0.75, 1.35),
      amount: 1,
      variant: 0,
    });
  }

  // ---- Flowers ----------------------------------------------------------
  const flowerSpots = scatter(rng, 3.2, WORLD.islandRadius, (x, z) => {
    const h = heightAt(x, z);
    if (h < 1.0 || h > 6.5) return false;
    if (slopeAt(x, z) > 0.24) return false;
    if (isReservedArea(x, z, 0.8)) return false;
    return forestDensity(x, z) < 0.4 && rng.next() < 0.5;
  }, 1.2);
  for (const spot of flowerSpots) {
    placements.push({
      kind: 'flower',
      x: spot.x,
      z: spot.z,
      y: heightAt(spot.x, spot.z),
      rotationY: rng.float(0, Math.PI * 2),
      scale: rng.float(0.8, 1.3),
      amount: 1,
      variant: 0,
    });
  }

  // ---- Sea shells (tide line) -------------------------------------------
  const shellSpots = scatter(rng, 4.5, WORLD.islandRadius * 1.02, (x, z) => {
    const h = heightAt(x, z);
    // Right at the waterline, where the sand is wet.
    if (h < -0.35 || h > 0.55) return false;
    if (isReservedArea(x, z, 1.0)) return false;
    return rng.next() < 0.45;
  }, 2.5);
  for (const spot of shellSpots) {
    placements.push({
      kind: 'shell',
      x: spot.x,
      z: spot.z,
      y: heightAt(spot.x, spot.z),
      rotationY: rng.float(0, Math.PI * 2),
      scale: rng.float(0.85, 1.3),
      amount: 1,
      variant: 0,
    });
  }

  // ---- Deep shells (under water) ----------------------------------------
  const deepSpots = scatter(rng, 5.5, WORLD.islandRadius * 1.22, (x, z) => {
    const depth = waterDepthAt(x, z);
    // Deep enough to need a swimmer, not so deep it is pitch black.
    if (depth < 2.3 || depth > 5.6) return false;
    // Keep them in the lake, or in the sea but close enough to the beach that
    // the sea floor is still under the visible terrain.
    const inLake = Math.hypot(x - lake.x, z - lake.z) < lake.radius;
    if (!inLake && Math.hypot(x, z) > WORLD.islandRadius * 1.25) return false;
    if (isReservedArea(x, z, 1.0)) return false;
    return rng.next() < 0.6;
  }, 3.0);
  for (const spot of deepSpots) {
    placements.push({
      kind: 'deepshell',
      x: spot.x,
      z: spot.z,
      y: heightAt(spot.x, spot.z),
      rotationY: rng.float(0, Math.PI * 2),
      scale: rng.float(0.9, 1.4),
      amount: 1,
      variant: 0,
    });
  }

  // ---- Aether crystals (quest items) -----------------------------------  // Fixed anchors keep the quest reliable; each is nudged to valid ground.
  const crystalAnchors: Array<[number, number]> = [
    [-36, 30],
    [30, -44],
    [46, 6],
    [4, -52],
    [-48, -20],
  ];
  for (const [ax, az] of crystalAnchors) {
    const spot = findValidCrystalSpot(ax, az, rng);
    if (!spot) continue;
    placements.push({
      kind: 'crystal',
      x: spot.x,
      z: spot.z,
      y: heightAt(spot.x, spot.z),
      rotationY: rng.float(0, Math.PI * 2),
      scale: 1,
      amount: 1,
      variant: 0,
    });
  }

  return placements;
}

/** Searches near an anchor for a spot where a crystal can stand. */
function findValidCrystalSpot(
  ax: number,
  az: number,
  rng: Rng,
): { x: number; z: number } | null {
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = rng.float(0, Math.PI * 2);
    const distance = attempt === 0 ? 0 : rng.float(2, 14);
    const x = ax + Math.cos(angle) * distance;
    const z = az + Math.sin(angle) * distance;
    const h = heightAt(x, z);
    if (h < 1.0) continue;
    if (slopeAt(x, z) > 0.5) continue;
    if (isReservedArea(x, z, 2)) continue;
    return { x, z };
  }
  return null;
}

/** Creates the instanced meshes and the resource node table. */
export class ResourceField {
  readonly group = new THREE.Group();
  readonly nodes = new Map<string, ResourceNode>();
  readonly colliders: CircleCollider[] = [];

  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scaleVector = new THREE.Vector3();
  private readonly positionVector = new THREE.Vector3();
  private readonly euler = new THREE.Euler();

  constructor(placements: readonly Placement[]) {
    this.group.name = 'resources';
    this.build(placements);
  }

  private build(placements: readonly Placement[]): void {
    // Group placements by (kind, variant) so each group becomes one set of
    // instanced meshes (one per prop part).
    const groups = new Map<string, Placement[]>();
    for (const placement of placements) {
      const key = `${placement.kind}:${placement.variant}`;
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      list.push(placement);
    }

    let counter = 0;
    for (const [key, list] of groups) {
      const [kind, variantText] = key.split(':');
      const variant = Number(variantText ?? '0');
      const resourceKind = kind as ResourceKind;

      const definition = this.definitionFor(resourceKind, variant);
      const material = this.materialFor(resourceKind);

      const meshes = definition.parts.map((part, partIndex) => {
        const mesh = new THREE.InstancedMesh(part.geometry, material, list.length);
        mesh.name = `${key}-${partIndex}-${counter++}`;
        mesh.castShadow = resourceKind === 'wood' || resourceKind === 'stone';
        mesh.receiveShadow = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(mesh);
        return mesh;
      });

      const tint = new THREE.Color();
      list.forEach((placement, index) => {
        const node: ResourceNode = {
          id: `node-${placement.kind}-${index}-${Math.round(placement.x * 10)}-${Math.round(placement.z * 10)}`,
          kind: resourceKind,
          x: placement.x,
          y: placement.y,
          z: placement.z,
          rotationY: placement.rotationY,
          scale: placement.scale,
          amount: placement.amount,
          maxAmount: placement.amount,
          harvested: false,
          label: LABEL_BY_KIND[resourceKind],
          parts: [],
        };

        definition.parts.forEach((part, partIndex) => {
          const mesh = meshes[partIndex];
          if (!mesh) return;
          const nodePart: NodePart = {
            mesh,
            index,
            emptyScale: new THREE.Vector3(...part.emptyScale),
            partialScale: new THREE.Vector3(...part.partialScale),
          };
          node.parts.push(nodePart);
          this.writeMatrix(node, nodePart, 1, 1, 1);
        });

        // A near-white tint multiplies the painted vertex colours, so two
        // trees of the same kind no longer look stamped from one template.
        if (resourceKind !== 'crystal') {
          const noise = Math.sin(placement.x * 12.9898 + placement.z * 78.233) * 43758.5453;
          const t = 0.94 + (noise - Math.floor(noise)) * 0.11;
          tint.setRGB(t, t * 0.995, t * 0.975);
          for (const mesh of meshes) mesh.setColorAt(index, tint);
        }

        if (definition.colliderRadius > 0) {
          node.collider = {
            x: placement.x,
            z: placement.z,
            radius: definition.colliderRadius * placement.scale,
            tag: resourceKind,
          };
          this.colliders.push(node.collider);
        }

        this.nodes.set(node.id, node);
      });

      for (const mesh of meshes) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
  }

  private definitionFor(kind: ResourceKind, variant: number): PropGeometry {
    switch (kind) {
      case 'wood':
        return variant === 0
          ? createConifer(FOLIAGE.trunk, FOLIAGE.conifer)
          : createBroadleaf(FOLIAGE.trunk, FOLIAGE.broadleaf);
      case 'stone':
        return createRock(PALETTE.rock);
      case 'berry':
        return createBush(FOLIAGE.bush);
      case 'fiber':
        return createReed(MADE.reed);
      case 'flower':
        return createFlower(FOLIAGE.flower);
      case 'crystal':
        return createCrystal(MADE.crystal);
      case 'shell':
        return createShellProp(SHELL.scallop, 'scallop');
      case 'deepshell':
        return createShellProp(SHELL.deep, 'conch');
    }
  }

  private materialFor(kind: ResourceKind): THREE.Material {
    const vertexColors = true;
    if (kind === 'crystal') {
      return new THREE.MeshLambertMaterial({
        vertexColors,
        flatShading: true,
        emissive: new THREE.Color(0x2a6f6a),
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.94,
      });
    }
    if (kind === 'shell' || kind === 'deepshell') {
      // The scallop is a single sheet, so it has to be drawn from both sides.
      return new THREE.MeshLambertMaterial({ vertexColors, flatShading: true, side: THREE.DoubleSide });
    }
    return new THREE.MeshLambertMaterial({ vertexColors, flatShading: true });
  }

  private writeMatrix(
    node: ResourceNode,
    part: NodePart,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
  ): void {
    this.positionVector.set(node.x, node.y, node.z);
    this.euler.set(0, node.rotationY, 0);
    this.quaternion.setFromEuler(this.euler);
    this.scaleVector.set(
      node.scale * scaleX,
      node.scale * scaleY,
      node.scale * scaleZ,
    );
    this.matrix.compose(this.positionVector, this.quaternion, this.scaleVector);
    part.mesh.setMatrixAt(part.index, this.matrix);
  }

  /** Applies the visual state that matches the node's remaining amount. */
  private refreshNodeVisual(node: ResourceNode): void {
    const depleted = node.amount <= 0;
    const partial = !depleted && node.amount < node.maxAmount;

    for (const part of node.parts) {
      const template = depleted ? part.emptyScale : partial ? part.partialScale : null;
      const sx = template ? template.x : 1;
      const sy = template ? template.y : 1;
      const sz = template ? template.z : 1;
      this.writeMatrix(node, part, sx, sy, sz);
      part.mesh.instanceMatrix.needsUpdate = true;
    }

    if (node.collider) {
      node.collider.radius = depleted
        ? Math.max(0.2, node.collider.radius * 0.4)
        : node.collider.radius;
    }
  }

  /**
   * Harvests one unit from a node.
   * @returns the item id and amount gained, or null when nothing was gained.
   */
  harvest(node: ResourceNode): { item: string; qty: number } | null {
    if (node.amount <= 0) return null;
    node.amount -= 1;
    node.harvested = node.amount <= 0;
    this.refreshNodeVisual(node);
    return { item: YIELD_BY_KIND[node.kind], qty: 1 };
  }

  /** Restores a node to its untouched state (used when loading a save). */
  restore(node: ResourceNode): void {
    node.amount = node.maxAmount;
    node.harvested = false;
    const originalRadius = node.collider?.radius;
    void originalRadius;
    this.refreshNodeVisual(node);
  }

  /** Marks a node as fully harvested without changing the item amount. */
  markHarvested(node: ResourceNode): void {
    node.amount = 0;
    node.harvested = true;
    this.refreshNodeVisual(node);
  }

  /** Ids of all nodes that have been fully harvested. */
  get harvestedIds(): string[] {
    const ids: string[] = [];
    for (const node of this.nodes.values()) {
      if (node.harvested) ids.push(node.id);
    }
    return ids;
  }

  /** Nearest harvestable node within `range` of the given point. */
  nearest(x: number, z: number, range: number): ResourceNode | null {
    let best: ResourceNode | null = null;
    let bestDistance = range;
    for (const node of this.nodes.values()) {
      if (node.amount <= 0) continue;
      const distance = Math.hypot(node.x - x, node.z - z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = node;
      }
    }
    return best;
  }

  /** Animated glow for crystal props. */
  update(elapsed: number): void {
    for (const node of this.nodes.values()) {
      if (node.kind !== 'crystal' || node.amount <= 0) continue;
      const part = node.parts[0];
      if (!part) continue;
      const pulse = 1 + Math.sin(elapsed * 2.2 + node.x) * 0.07;
      this.positionVector.set(node.x, node.y, node.z);
      this.euler.set(0, node.rotationY + elapsed * 0.35, 0);
      this.quaternion.setFromEuler(this.euler);
      const s = node.scale * pulse;
      this.scaleVector.set(s, s, s);
      this.matrix.compose(this.positionVector, this.quaternion, this.scaleVector);
      part.mesh.setMatrixAt(part.index, this.matrix);
      part.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Scatter of decorative grass tufts (not resources). */
  static addGrass(group: THREE.Group, seed = WORLD.seed + 7): void {
    const rng = new Rng(seed);
    const geometry = createGrassTuft(FOLIAGE.grass);
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    const spots = scatter(rng, 1.05, WORLD.islandRadius * 0.96, (x, z) => {
      const h = heightAt(x, z);
      if (h < 0.75) return false;
      if (slopeAt(x, z) > 0.4) return false;
      return rng.next() < 0.62;
    }, 0.7);

    const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
    mesh.name = 'grass';
    mesh.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const euler = new THREE.Euler();
    const tint = new THREE.Color();

    spots.forEach((spot, index) => {
      position.set(spot.x, heightAt(spot.x, spot.z), spot.z);
      euler.set(0, rng.float(0, Math.PI * 2), 0);
      quaternion.setFromEuler(euler);
      const s = rng.float(0.6, 1.25);
      scale.set(s, s * rng.float(0.7, 1.3), s);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);

      // Near-white, so the blades keep the colour they were painted with.
      const t = rng.float(0.9, 1.06);
      tint.setRGB(t, t * rng.float(0.98, 1.02), t * rng.float(0.95, 1.0));
      mesh.setColorAt(index, tint);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}
