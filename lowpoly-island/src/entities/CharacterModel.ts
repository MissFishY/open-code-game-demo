/**
 * Low-poly humanoid rig built from boxes.
 *
 * Shared by the player and the NPCs. Limbs are parented to pivot groups so
 * they can be rotated about the hip / shoulder.
 */

import * as THREE from 'three';

export interface CharacterColors {
  skin: number;
  shirt: number;
  pants: number;
  hair: number;
}

export interface CharacterRig {
  root: THREE.Group;
  /** Rotates the whole upper body (used for head look-at). */
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  /** Meshes that wear the shirt colour, so outfits can restyle them. */
  shirt: THREE.Mesh[];
  /** Meshes that wear the trousers colour. */
  pants: THREE.Mesh[];
  /** Meshes that wear the skin colour. */
  skin: THREE.Mesh[];
}

function box(
  width: number,
  height: number,
  depth: number,
  color: number,
  yOffset = 0,
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = yOffset;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Recolours a list of meshes. */
export function tintMeshes(meshes: readonly THREE.Mesh[], color: number): void {
  for (const mesh of meshes) {
    const material = mesh.material as THREE.MeshLambertMaterial;
    material.color.setHex(color);
  }
}

export function createCharacterRig(colors: CharacterColors): CharacterRig {
  const root = new THREE.Group();

  const shirtMeshes: THREE.Mesh[] = [];
  const pantsMeshes: THREE.Mesh[] = [];
  const skinMeshes: THREE.Mesh[] = [];

  // --- Torso -------------------------------------------------------------
  const torso = new THREE.Group();
  torso.position.y = 0.92;
  root.add(torso);

  const chest = box(0.56, 0.66, 0.3, colors.shirt, 0.3);
  torso.add(chest);
  shirtMeshes.push(chest);

  const hips = box(0.5, 0.22, 0.3, colors.pants, -0.1);
  torso.add(hips);
  pantsMeshes.push(hips);

  // --- Head --------------------------------------------------------------
  const head = new THREE.Group();
  head.position.y = 0.72;
  torso.add(head);

  const skull = box(0.4, 0.4, 0.38, colors.skin, 0.18);
  head.add(skull);
  skinMeshes.push(skull);

  const hair = box(0.44, 0.16, 0.42, colors.hair, 0.36);
  head.add(hair);

  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.02), eyeMaterial);
    eye.position.set(side * 0.1, 0.2, 0.2);
    head.add(eye);
  }

  // --- Arms --------------------------------------------------------------
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.36, 0.54, 0);
  torso.add(leftArm);
  const leftArmMesh = box(0.15, 0.58, 0.15, colors.shirt, -0.29);
  leftArm.add(leftArmMesh);
  shirtMeshes.push(leftArmMesh);
  const leftHand = box(0.14, 0.12, 0.14, colors.skin, -0.6);
  leftArm.add(leftHand);
  skinMeshes.push(leftHand);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.36, 0.54, 0);
  torso.add(rightArm);
  const rightArmMesh = box(0.15, 0.58, 0.15, colors.shirt, -0.29);
  rightArm.add(rightArmMesh);
  shirtMeshes.push(rightArmMesh);
  const rightHand = box(0.14, 0.12, 0.14, colors.skin, -0.6);
  rightArm.add(rightHand);
  skinMeshes.push(rightHand);

  // --- Legs --------------------------------------------------------------
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, -0.1, 0);
  torso.add(leftLeg);
  const leftLegMesh = box(0.19, 0.72, 0.19, colors.pants, -0.36);
  leftLeg.add(leftLegMesh);
  pantsMeshes.push(leftLegMesh);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, -0.1, 0);
  torso.add(rightLeg);
  const rightLegMesh = box(0.19, 0.72, 0.19, colors.pants, -0.36);
  rightLeg.add(rightLegMesh);
  pantsMeshes.push(rightLegMesh);

  return {
    root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    shirt: shirtMeshes,
    pants: pantsMeshes,
    skin: skinMeshes,
  };
}
