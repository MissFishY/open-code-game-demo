/**
 * The player character: a low-poly traveller with a simple walk cycle.
 *
 * The traveller also wears whatever the player has bought, so the wardrobe
 * has a visible payoff rather than being a numbers-only upgrade.
 */

import * as THREE from 'three';
import { createCharacterRig, tintMeshes, type CharacterRig } from './CharacterModel';
import { lerp } from '../utils/math';

const BASE_SHIRT = 0x3f6fb5;
const BASE_PANTS = 0x37474f;
const SWIM_SHIRT = 0x2f8fd8;
const WADER_PANTS = 0x3f6b4a;

export class PlayerAvatar {
  readonly root = new THREE.Group();
  private readonly rig: CharacterRig;
  private phase = 0;
  private lean = 0;

  /** Accessories that are shown or hidden depending on the outfit. */
  private readonly hat = new THREE.Group();
  private readonly necklace = new THREE.Group();
  private readonly cape = new THREE.Group();

  constructor() {
    this.rig = createCharacterRig({
      skin: 0xe0ac69,
      shirt: BASE_SHIRT,
      pants: BASE_PANTS,
      hair: 0x3b2b20,
    });
    this.root.add(this.rig.root);
    this.root.name = 'player';

    // --- Hat ---------------------------------------------------------------
    const brim = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.06, 0.62),
      new THREE.MeshLambertMaterial({ color: 0xd8b26a }),
    );
    brim.position.y = 0.42;
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.2, 0.38),
      new THREE.MeshLambertMaterial({ color: 0xc79a52 }),
    );
    crown.position.y = 0.52;
    this.hat.add(brim, crown);
    this.hat.visible = false;
    this.rig.head.add(this.hat);

    // --- Necklace ----------------------------------------------------------
    const beads = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.045, 5, 10),
      new THREE.MeshLambertMaterial({ color: 0xf0d9c0 }),
    );
    beads.rotation.x = Math.PI / 2;
    beads.position.y = 0.5;
    this.necklace.add(beads);
    this.necklace.visible = false;
    this.rig.torso.add(this.necklace);

    // --- Cape --------------------------------------------------------------
    const cape = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.7, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x4e6b3a }),
    );
    cape.position.set(0, 0.1, -0.2);
    this.cape.add(cape);
    this.cape.visible = false;
    this.rig.torso.add(this.cape);
  }

  /**
   * Restyles the traveller for the clothes they own.
   * @param owned the ids of the owned clothing
   */
  setOutfit(owned: readonly string[]): void {
    const has = (id: string): boolean => owned.includes(id);

    tintMeshes(this.rig.shirt, has('swimsuit') ? SWIM_SHIRT : BASE_SHIRT);
    tintMeshes(this.rig.pants, has('waders') ? WADER_PANTS : BASE_PANTS);

    this.hat.visible = has('fisherhat');

    this.necklace.visible = has('shellnecklace') || has('charm');
    if (this.necklace.visible) {
      const material = (this.necklace.children[0] as THREE.Mesh)
        .material as THREE.MeshLambertMaterial;
      material.color.setHex(has('charm') ? 0x53e0e6 : 0xf0d9c0);
    }

    this.cape.visible = has('seaweedcloak') || has('workcoat');
    if (this.cape.visible) {
      const material = (this.cape.children[0] as THREE.Mesh)
        .material as THREE.MeshLambertMaterial;
      material.color.setHex(has('workcoat') ? 0x6b5a3f : 0x4e6b3a);
    }
  }

  /** Places the avatar on the ground. */
  setPosition(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
  }

  /** Rotates the avatar to face a yaw angle (radians). */
  setRotation(yaw: number): void {
    this.root.rotation.y = yaw;
  }

  /**
   * Advances the walk cycle.
   * @param speed01 normalised movement speed (0 = idle, 1 = sprinting)
   */
  update(dt: number, speed01: number): void {
    const target = Math.min(1, Math.max(0, speed01));
    this.phase += dt * (4.2 + target * 7.5);
    this.lean = lerp(this.lean, target * 0.12, Math.min(1, dt * 8));

    const swing = Math.sin(this.phase) * (0.15 + target * 0.75);
    const swing2 = Math.sin(this.phase + Math.PI) * (0.15 + target * 0.75);

    this.rig.leftLeg.rotation.x = swing;
    this.rig.rightLeg.rotation.x = swing2;
    this.rig.leftArm.rotation.x = swing2 * 0.8;
    this.rig.rightArm.rotation.x = swing * 0.8;

    // Small vertical bob while walking.
    const bob = Math.abs(Math.sin(this.phase)) * 0.05 * target;
    this.rig.root.position.y = bob;
    this.rig.torso.rotation.x = this.lean;
  }

  /** True when the avatar is moving fast enough to play the running cycle. */
  get isRunning(): boolean {
    return Math.abs(this.rig.leftLeg.rotation.x) > 0.45;
  }
}
