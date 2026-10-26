/**
 * Stylised low-poly water.
 *
 * A single large plane covers both the ocean and the inland lake. A depth
 * texture (baked from the terrain height field) is sampled in the shader so
 * the water can fade from turquoise shallows to deep blue, with a foam band
 * along the shoreline.
 */

import * as THREE from 'three';
import { WORLD } from '../config';
import { FOG, WATER } from './palette';
import { heightAt } from './terrain';

const DEPTH_RANGE = 12; // metres of depth encoded into the texture

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uDepthMap;
  uniform vec2 uMapMin;
  uniform vec2 uMapSize;

  varying vec3 vWorldPosition;
  varying float vDepth;

  float waveHeight(vec2 p) {
    return sin(p.x * 0.42 + uTime * 1.25) * 0.055
         + sin(p.y * 0.33 - uTime * 0.95) * 0.045
         + sin((p.x * 0.7 + p.y * 0.5) + uTime * 0.6) * 0.03;
  }

  void main() {
    vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vec2 uv = (worldPosition.xz - uMapMin) / uMapSize;
    float depth = texture2D(uDepthMap, clamp(uv, 0.0, 1.0)).r * ${DEPTH_RANGE.toFixed(1)};
    vDepth = depth;

    // Waves fade out in the shallows so the water never pokes through the beach.
    float amplitude = smoothstep(0.0, 1.2, depth);
    float wave = waveHeight(worldPosition.xz) * amplitude;
    worldPosition.y += wave;

    vWorldPosition = worldPosition;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallowColor;
  uniform vec3 uDeepColor;
  uniform vec3 uFoamColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec3 vWorldPosition;
  varying float vDepth;

  void main() {
    float d = clamp(vDepth / ${DEPTH_RANGE.toFixed(1)}, 0.0, 1.0);
    vec3 color = mix(uShallowColor, uDeepColor, smoothstep(0.02, 0.55, d));

    // Shore foam: a soft band that breathes with the waves.
    float band = 1.0 - smoothstep(0.0, 0.42, vDepth);
    float ripple = 0.65 + 0.35 * sin(vWorldPosition.x * 2.6 + vWorldPosition.z * 2.1 + uTime * 1.8);
    color = mix(color, uFoamColor, clamp(band * ripple, 0.0, 1.0) * 0.55);

    // Fade into the horizon so the ocean does not end in a hard line.
    float viewDistance = length(cameraPosition - vWorldPosition);
    float fogFactor = smoothstep(uFogNear, uFogFar, viewDistance);
    color = mix(color, uFogColor, fogFactor);

    float alpha = mix(0.72, 0.9, d);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface WaterResult {
  mesh: THREE.Mesh;
  update(elapsed: number): void;
  dispose(): void;
}

export function buildWater(): WaterResult {
  const extent = WORLD.terrainExtent;
  const size = 700;
  const segments = 72;

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  // Bake a depth map so the shader knows how deep the water is everywhere.
  const resolution = 192;
  const data = new Uint8Array(resolution * resolution);
  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const x = -extent + (ix / (resolution - 1)) * extent * 2;
      const z = -extent + (iz / (resolution - 1)) * extent * 2;
      const h = heightAt(x, z);
      const depth = Math.max(0, (WORLD.waterLevel - h) / DEPTH_RANGE);
      data[iz * resolution + ix] = Math.round(Math.min(1, depth) * 255);
    }
  }

  const depthTexture = new THREE.DataTexture(data, resolution, resolution, THREE.RedFormat);
  depthTexture.minFilter = THREE.LinearFilter;
  depthTexture.magFilter = THREE.LinearFilter;
  depthTexture.wrapS = THREE.ClampToEdgeWrapping;
  depthTexture.wrapT = THREE.ClampToEdgeWrapping;
  depthTexture.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDepthMap: { value: depthTexture },
      uMapMin: { value: new THREE.Vector2(-extent, -extent) },
      uMapSize: { value: new THREE.Vector2(extent * 2, extent * 2) },
      uShallowColor: { value: new THREE.Color(WATER.shallow) },
      uDeepColor: { value: new THREE.Color(WATER.deep) },
      uFoamColor: { value: new THREE.Color(WATER.foam) },
      uFogColor: { value: new THREE.Color(FOG.color) },
      uFogNear: { value: FOG.near },
      uFogFar: { value: FOG.far },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'water';
  mesh.position.y = WORLD.waterLevel;
  mesh.renderOrder = 2;

  return {
    mesh,
    update(elapsed: number) {
      material.uniforms['uTime']!.value = elapsed;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      depthTexture.dispose();
    },
  };
}
