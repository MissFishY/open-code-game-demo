/**
 * An NPC: a low-poly villager with an idle animation and a floating
 * quest marker.
 */

import * as THREE from 'three';
import { createCharacterRig, type CharacterRig } from './CharacterModel';
import type { NpcDef } from '../data/npcs';

export class NpcAvatar {
  readonly root = new THREE.Group();
  readonly def: NpcDef;
  private readonly rig: CharacterRig;
  private readonly marker: THREE.Group;
  private readonly markerBody: THREE.Mesh;
  private phase = 0;

  constructor(def: NpcDef) {
    this.def = def;
    this.rig = createCharacterRig({
      skin: def.skinColor,
      shirt: def.color,
      pants: def.accentColor,
      hair: 0x2b2118,
    });
    this.root.add(this.rig.root);
    this.root.name = `npc-${def.id}`;

    // Quest marker: a small diamond that bobs above the head.
    this.marker = new THREE.Group();
    this.marker.position.y = 2.25;

    const geometry = new THREE.OctahedronGeometry(0.22, 0);
    const material = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    this.markerBody = new THREE.Mesh(geometry, material);
    this.marker.add(this.markerBody);
    this.root.add(this.marker);
  }

  setPosition(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
  }

  /** Turns the NPC towards a point (used when they start talking). */
  faceTowards(x: number, z: number): void {
    const angle = Math.atan2(x - this.root.position.x, z - this.root.position.z);
    this.root.rotation.y = angle;
  }

  /** Shows or hides the floating quest marker. */
  setMarkerVisible(visible: boolean): void {
    this.marker.visible = visible;
  }

  update(dt: number, elapsed: number): void {
    this.phase += dt;

    // Gentle breathing / swaying idle.
    const sway = Math.sin(this.phase * 1.3) * 0.05;
    this.rig.torso.rotation.z = sway;
    this.rig.leftArm.rotation.x = Math.sin(this.phase * 1.1) * 0.12 - 0.05;
    this.rig.rightArm.rotation.x = Math.sin(this.phase * 1.1 + 0.6) * 0.12 - 0.05;
    this.rig.head.rotation.y = Math.sin(this.phase * 0.4) * 0.25;

    if (this.marker.visible) {
      this.marker.position.y = 2.25 + Math.sin(elapsed * 2.4) * 0.12;
      this.marker.rotation.y = elapsed * 1.6;
      this.markerBody.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.08);
    }
  }
}
