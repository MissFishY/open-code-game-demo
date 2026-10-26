/**
 * The last thing that happens to every frame.
 *
 * The scene is drawn into an off-screen target; one screen-sized quad then
 * pulls that picture through a small shader which grades the colour
 * (contrast, saturation, brightness, a warm vignette) and lays a static
 * paper grain over it. No outlines: this look has none.
 *
 * The grain is keyed to the pixel position, not to time, so it sits on the
 * screen like the tooth of a watercolour sheet instead of crawling.
 */

import * as THREE from 'three';
import { GRADE } from './palette';

export interface PostProcess {
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
  dispose: () => void;
}

const FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uTexel;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uGrain;
  uniform float uVignette;

  varying vec2 vUv;

  void main() {
    vec3 col = texture2D(tDiffuse, vUv).rgb;

    // --- colour grade ------------------------------------------------------
    col = (col - 0.5) * uContrast + 0.5;
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, uSaturation);
    col *= uBrightness;

    // --- paper grain -------------------------------------------------------
    float n = fract(sin(dot(vUv * 2048.0, vec2(12.9898, 78.233))) * 43758.5453);
    float paper = sin(vUv.x * 900.0) * sin(vUv.y * 700.0) * 0.5 + 0.5;
    col += (n - 0.5) * uGrain;
    col *= 1.0 - uGrain * 0.12 * paper;

    // --- vignette ----------------------------------------------------------
    float d = distance(vUv, vec2(0.5, 0.5));
    col *= 1.0 - uVignette * smoothstep(0.34, 0.9, d);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export function createPost(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  pixelRatio = 1,
): PostProcess {
  const target = new THREE.WebGLRenderTarget(
    Math.max(1, Math.floor(width * pixelRatio)),
    Math.max(1, Math.floor(height * pixelRatio)),
    {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
    },
  );
  target.texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: target.texture },
      uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
      uSaturation: { value: GRADE.saturation },
      uBrightness: { value: GRADE.brightness },
      uContrast: { value: GRADE.contrast },
      uGrain: { value: GRADE.grain },
      uVignette: { value: GRADE.vignette },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    render: (scene, camera) => {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCamera);
    },
    resize: (nextWidth, nextHeight, nextPixelRatio) => {
      const w = Math.max(1, Math.floor(nextWidth * nextPixelRatio));
      const h = Math.max(1, Math.floor(nextHeight * nextPixelRatio));
      target.setSize(w, h);
      material.uniforms['uTexel']!.value.set(1 / w, 1 / h);
    },
    dispose: () => {
      target.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
