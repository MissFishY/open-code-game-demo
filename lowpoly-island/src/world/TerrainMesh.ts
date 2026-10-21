/**
 * Builds the low-poly terrain mesh from the analytic height function.
 *
 * The mesh is non-indexed so every triangle gets its own flat normal — that
 * is what gives the faceted look. Colours are baked per triangle based on
 * altitude, slope and a little noise.
 */

import * as THREE from 'three';
import { WORLD } from '../config';
import { colorAt, heightAt } from './terrain';

export interface TerrainMeshResult {
  mesh: THREE.Mesh;
  /** Height grid, useful for quick lookups. */
  heights: Float32Array;
  segments: number;
  extent: number;
}

export function buildTerrainMesh(segments = WORLD.terrainSegments): TerrainMeshResult {
  const extent = WORLD.terrainExtent;
  const step = (extent * 2) / segments;
  const vertexCount = segments + 1;

  // Precompute the height grid — far cheaper than sampling per vertex.
  const heights = new Float32Array(vertexCount * vertexCount);
  for (let iz = 0; iz < vertexCount; iz++) {
    const z = -extent + iz * step;
    for (let ix = 0; ix < vertexCount; ix++) {
      const x = -extent + ix * step;
      heights[iz * vertexCount + ix] = heightAt(x, z);
    }
  }

  const triangleCount = segments * segments * 2;
  const positions = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);
  const colors = new Float32Array(triangleCount * 9);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();

  let pointer = 0;

  const emitTriangle = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3) => {
    ab.subVectors(p1, p0);
    ac.subVectors(p2, p0);
    faceNormal.crossVectors(ab, ac).normalize();

    const centreX = (p0.x + p1.x + p2.x) / 3;
    const centreZ = (p0.z + p1.z + p2.z) / 3;
    const centreY = (p0.y + p1.y + p2.y) / 3;
    const slope = Math.acos(Math.min(1, Math.max(-1, faceNormal.y)));

    const color = colorAt(centreX, centreZ, slope, centreY);

    for (const p of [p0, p1, p2]) {
      positions[pointer] = p.x;
      positions[pointer + 1] = p.y;
      positions[pointer + 2] = p.z;
      normals[pointer] = faceNormal.x;
      normals[pointer + 1] = faceNormal.y;
      normals[pointer + 2] = faceNormal.z;
      colors[pointer] = color.r;
      colors[pointer + 1] = color.g;
      colors[pointer + 2] = color.b;
      pointer += 3;
    }
  };

  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const x0 = -extent + ix * step;
      const z0 = -extent + iz * step;
      const x1 = x0 + step;
      const z1 = z0 + step;

      const h00 = heights[iz * vertexCount + ix] as number;
      const h10 = heights[iz * vertexCount + ix + 1] as number;
      const h01 = heights[(iz + 1) * vertexCount + ix] as number;
      const h11 = heights[(iz + 1) * vertexCount + ix + 1] as number;

      a.set(x0, h00, z0);
      b.set(x1, h10, z0);
      c.set(x1, h11, z1);
      // Wound counter-clockwise when seen from above so the face normals
      // point up (and the triangles are not back-face culled).
      emitTriangle(a, c, b);

      a.set(x0, h00, z0);
      b.set(x1, h11, z1);
      c.set(x0, h01, z1);
      emitTriangle(a, c, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  return { mesh, heights, segments, extent };
}
