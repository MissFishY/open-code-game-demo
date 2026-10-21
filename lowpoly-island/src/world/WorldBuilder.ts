/**
 * Assembles the playable world: terrain, water, props, NPCs and lighting.
 */

import * as THREE from 'three';
import { WORLD, WORLD_LAYOUT } from '../config';
import { buildTerrainMesh } from './TerrainMesh';
import { buildWater, type WaterResult } from './Water';
import { ResourceField, planPlacements } from './ResourceField';
import { NpcAvatar } from '../entities/NpcAvatar';
import { NPCS } from '../data/npcs';
import { heightAt } from './terrain';
import { SpatialHash, type CircleCollider } from '../systems/CollisionSystem';
import { createFoundation, createHut, createWorkbench, createDecoration, createFurniture, createFishingSpot } from './Structures';
import { getSlot } from '../data/decorations';
import { getFurniture } from '../data/interior';
import { Rng } from '../utils/rng';
import { waterDepthAt } from './terrain';

const SKY_VERTEX = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uBottomColor;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition).y;
    vec3 color = mix(uHorizonColor, uTopColor, smoothstep(0.0, 0.55, h));
    color = mix(uBottomColor, color, smoothstep(-0.25, 0.02, h));
    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface WorldOptions {
  /** Radius of the shadow-casting area that follows the player. */
  shadowExtent?: number;
}

export class World {
  readonly group = new THREE.Group();
  readonly resources: ResourceField;
  readonly npcs = new Map<string, NpcAvatar>();
  readonly colliders: CircleCollider[] = [];
  /** Spatial hash of `colliders`, used for fast collision queries. */
  readonly colliderHash = new SpatialHash(8);

  /** The marked-out foundation the hut is raised on. */
  readonly buildSite = new THREE.Group();
  /** The crafting bench. */
  readonly workbench = new THREE.Group();
  /** The finished hut (hidden until it is built). */
  readonly hut = new THREE.Group();
  /** Decorations standing around the hut (child of the hut group). */
  readonly decorations = new THREE.Group();
  /** Furniture inside the hut (child of the hut group). */
  readonly interior = new THREE.Group();
  /** The hut's roof, hidden while the player is inside. */
  readonly hutRoof = new THREE.Group();

  /** Where you can fish. */
  readonly fishingSpots: {
    x: number;
    y: number;
    z: number;
    habitat: 'lake' | 'sea';
    model: THREE.Group;
  }[] = [];

  /** World position of the build site. */
  readonly buildSitePosition = new THREE.Vector3();
  /** World position of the workbench. */
  readonly workbenchPosition = new THREE.Vector3();

  private readonly water: WaterResult;
  readonly sun: THREE.DirectionalLight;
  private readonly sunTarget = new THREE.Object3D();
  private readonly sky: THREE.Mesh;
  private readonly shadowExtent: number;
  /** The wall colliders of the hut — only active while it stands. */
  private hutColliders: CircleCollider[] = [];
  /** The marker at the build site — removed once the hut is raised. */
  private buildSiteCollider?: CircleCollider;

  constructor(scene: THREE.Scene, options: WorldOptions = {}) {
    this.shadowExtent = options.shadowExtent ?? 46;
    this.group.name = 'world';

    // --- Sky dome ---------------------------------------------------------
    const skyGeometry = new THREE.SphereGeometry(500, 24, 16);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color(0x3f7fd0) },
        uHorizonColor: { value: new THREE.Color(0xa9d8ef) },
        uBottomColor: { value: new THREE.Color(0xd8e8c8) },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.name = 'sky';
    scene.add(this.sky);

    scene.fog = new THREE.Fog(0xa9d8ef, 100, 300);

    // --- Lighting ---------------------------------------------------------
    const hemi = new THREE.HemisphereLight(0xbfe4ff, 0x5a6b43, 0.6);
    scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.22);
    scene.add(ambient);

    this.sun = new THREE.DirectionalLight(0xfff2d0, 1.05);
    this.sun.position.set(48, 72, 32);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.bias = -0.0009;
    this.sun.shadow.normalBias = 0.035;

    const extent = this.shadowExtent;
    this.sun.shadow.camera.left = -extent;
    this.sun.shadow.camera.right = extent;
    this.sun.shadow.camera.top = extent;
    this.sun.shadow.camera.bottom = -extent;
    this.sun.shadow.camera.updateProjectionMatrix();

    scene.add(this.sun);
    scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;

    // --- Terrain ----------------------------------------------------------
    const terrain = buildTerrainMesh();
    this.group.add(terrain.mesh);

    // --- Water ------------------------------------------------------------
    this.water = buildWater();
    this.group.add(this.water.mesh);

    // --- Props ------------------------------------------------------------
    this.resources = new ResourceField(planPlacements());
    this.group.add(this.resources.group);
    ResourceField.addGrass(this.group);
    this.colliders.push(...this.resources.colliders);

    // --- Structures -------------------------------------------------------
    const buildSpot = WORLD_LAYOUT.buildSite;
    this.buildSitePosition.set(buildSpot.x, heightAt(buildSpot.x, buildSpot.z), buildSpot.z);
    this.buildSite.add(createFoundation());
    this.buildSite.position.copy(this.buildSitePosition);
    this.group.add(this.buildSite);
    this.buildSiteCollider = {
      x: buildSpot.x,
      z: buildSpot.z,
      radius: 1.2,
      tag: 'build-site',
    };
    this.colliders.push(this.buildSiteCollider);

    const benchSpot = WORLD_LAYOUT.workbench;
    this.workbenchPosition.set(benchSpot.x, heightAt(benchSpot.x, benchSpot.z), benchSpot.z);
    this.workbench.add(createWorkbench());
    this.workbench.position.copy(this.workbenchPosition);
    this.group.add(this.workbench);
    this.colliders.push({ x: benchSpot.x, z: benchSpot.z, radius: 1.0, tag: 'workbench' });

    this.hut.add(createHut());
    this.hut.position.copy(this.buildSitePosition);
    this.hut.visible = false;

    // The roof is a separate group so it can be hidden from the inside.
    const hutModel = this.hut.children[0] as THREE.Group | undefined;
    const roof = hutModel?.getObjectByName('hut-roof');
    if (roof) this.hutRoof = roof as THREE.Group;

    this.decorations.name = 'decorations';
    this.hut.add(this.decorations);
    this.interior.name = 'interior';
    this.hut.add(this.interior);
    this.group.add(this.hut);

    // The hut is walkable, so its walls are made of small circle colliders
    // with a gap for the door.
    this.hutColliders = this.hutWallColliders();

    // --- NPCs -------------------------------------------------------------
    for (const def of NPCS) {
      const avatar = new NpcAvatar(def);
      const y = heightAt(def.spawn.x, def.spawn.z);
      avatar.setPosition(def.spawn.x, y, def.spawn.z);
      avatar.faceTowards(WORLD_LAYOUT.spawn.x, WORLD_LAYOUT.spawn.z);
      this.npcs.set(def.id, avatar);
      this.group.add(avatar.root);
      this.colliders.push({ x: def.spawn.x, z: def.spawn.z, radius: 0.55, tag: `npc:${def.id}` });
    }

    scene.add(this.group);

    // --- Fishing spots ----------------------------------------------------
    this.placeFishingSpots();

    // Build the broad-phase structure once all colliders are known.
    for (const collider of this.colliders) {
      this.colliderHash.insert(collider);
    }
  }

  /**
   * The hut walls, as small circle colliders with a gap for the doorway.
   * Local coordinates are relative to the centre of the hut floor.
   */
  private hutWallColliders(): CircleCollider[] {
    const origin = this.buildSitePosition;
    const out: CircleCollider[] = [];
    const add = (x: number, z: number): void => {
      out.push({
        x: origin.x + x,
        z: origin.z + z,
        radius: 0.28,
        tag: 'hut-wall',
      });
    };

    // Front wall, with the doorway between x = -0.8 and x = 0.8.
    for (const x of [-2.0, -1.4, -0.8, 0.8, 1.4, 2.0]) add(x, 1.7);
    // Back wall.
    for (const x of [-1.7, -1.1, -0.5, 0.1, 0.7, 1.3, 1.9]) add(x, -1.7);
    // Side walls.
    for (const z of [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5]) {
      add(-2.0, z);
      add(2.0, z);
    }
    return out;
  }

  /** Scatters fishing spots in the shallows of the lake and the sea. */
  private placeFishingSpots(): void {
    const rng = new Rng(WORLD.seed + 991);
    const lake = WORLD.lake;

    const tryPlace = (habitat: 'lake' | 'sea'): void => {
      for (let attempt = 0; attempt < 500; attempt++) {
        const angle = rng.float(0, Math.PI * 2);
        const radius = rng.float(0, 1);
        let x: number;
        let z: number;
        if (habitat === 'lake') {
          const r = lake.radius * (0.75 + radius * 0.45);
          x = lake.x + Math.cos(angle) * r;
          z = lake.z + Math.sin(angle) * r;
        } else {
          const r = WORLD.islandRadius * (0.95 + radius * 0.16);
          x = Math.cos(angle) * r;
          z = Math.sin(angle) * r;
        }

        const depth = waterDepthAt(x, z);
        if (depth < 0.35 || depth > 1.6) continue;

        // Keep them apart so the spots feel findable.
        let tooClose = false;
        for (const spot of this.fishingSpots) {
          if (Math.hypot(spot.x - x, spot.z - z) < 9) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        const model = createFishingSpot();
        model.position.set(x, WORLD.waterLevel, z);
        this.group.add(model);
        this.fishingSpots.push({ x, y: WORLD.waterLevel, z, habitat, model });
        return;
      }
    };

    for (let i = 0; i < 7; i++) tryPlace('lake');
    for (let i = 0; i < 9; i++) tryPlace('sea');
  }

  /** Per-frame world animation (water, crystals, NPCs, shadow camera). */
  update(dt: number, elapsed: number, focus: THREE.Vector3): void {
    this.water.update(elapsed);
    this.resources.update(elapsed);

    for (const npc of this.npcs.values()) {
      npc.update(dt, elapsed);
    }

    // Keep the shadow frustum centred on the player.
    this.sky.position.set(focus.x, 0, focus.z);
    this.sunTarget.position.set(focus.x, 0, focus.z);
    this.sun.position.set(focus.x + 48, 72, focus.z + 32);
    this.sunTarget.updateMatrixWorld();
  }

  /** World position of an NPC. */
  npcPosition(id: string): THREE.Vector3 | null {
    const npc = this.npcs.get(id);
    if (!npc) return null;
    return npc.root.position;
  }

  /**
   * Swaps the foundation for the finished hut (or back again).
   * The hut is solid, so its colliders only exist while it is standing.
   */
  setHutBuilt(built: boolean): void {
    this.hut.visible = built;
    this.buildSite.visible = !built;

    const hasColliders = this.colliders.includes(this.hutColliders[0] as CircleCollider);
    if (built && !hasColliders) {
      for (const collider of this.hutColliders) {
        this.colliders.push(collider);
        this.colliderHash.insert(collider);
      }
      // The build marker has to go, or it blocks the doorway.
      if (this.buildSiteCollider) {
        const index = this.colliders.indexOf(this.buildSiteCollider);
        if (index >= 0) this.colliders.splice(index, 1);
        this.colliderHash.remove(this.buildSiteCollider);
        this.buildSiteCollider = undefined;
      }
    } else if (!built && hasColliders) {
      for (const collider of this.hutColliders) {
        const index = this.colliders.indexOf(collider);
        if (index >= 0) this.colliders.splice(index, 1);
        this.colliderHash.remove(collider);
      }
      if (!this.buildSiteCollider) {
        this.buildSiteCollider = {
          x: this.buildSitePosition.x,
          z: this.buildSitePosition.z,
          radius: 1.2,
          tag: 'build-site',
        };
        this.colliders.push(this.buildSiteCollider);
        this.colliderHash.insert(this.buildSiteCollider);
      }
    }
  }

  /** True when the hut is standing. */
  get isHutBuilt(): boolean {
    return this.hut.visible;
  }

  /**
   * Puts a decoration model into a slot around the hut.
   * @returns false when the slot or the decoration type is unknown.
   */
  placeDecoration(slotId: string, type: string): boolean {
    const slot = getSlot(slotId);
    const model = createDecoration(type);
    if (!slot || !model) return false;

    model.position.set(slot.offset.x, slot.offset.y, slot.offset.z);
    // Face the middle of the hut so nothing looks randomly turned.
    model.rotation.y = Math.atan2(-slot.offset.x, -slot.offset.z);
    this.decorations.add(model);
    return true;
  }

  /** Removes every decoration from around the hut. */
  clearDecorations(): void {
    this.decorations.clear();
  }

  /** Removes one decoration by its slot. */
  removeDecoration(slotId: string): void {
    for (const child of [...this.decorations.children]) {
      const slot = getSlot(slotId);
      if (!slot) continue;
      if (
        Math.abs(child.position.x - slot.offset.x) < 1e-6 &&
        Math.abs(child.position.y - slot.offset.y) < 1e-6 &&
        Math.abs(child.position.z - slot.offset.z) < 1e-6
      ) {
        this.decorations.remove(child);
      }
    }
  }

  // --- Interior ------------------------------------------------------------

  /** Puts a piece of furniture into the hut. */
  placeFurniture(furnitureId: string, slot: string): boolean {
    const definition = getFurniture(furnitureId);
    if (!definition) return false;
    const model = createFurniture(furnitureId);
    if (!model) return false;

    model.position.set(definition.offset.x, definition.offset.y, definition.offset.z);
    if (definition.facesCentre) {
      model.rotation.y = Math.atan2(-definition.offset.x, -definition.offset.z);
    }
    model.userData['slot'] = slot;
    this.interior.add(model);
    return true;
  }

  /** Removes every piece of furniture. */
  clearInterior(): void {
    this.interior.clear();
  }

  /** Removes the furniture standing in a slot. */
  removeFurniture(slot: string): void {
    for (const child of [...this.interior.children]) {
      if (child.userData['slot'] === slot) this.interior.remove(child);
    }
  }

  /** Hides the roof so the player can see inside. */
  setRoofVisible(visible: boolean): void {
    this.hutRoof.visible = visible;
  }

  /** True when the given world position is inside the hut's walls. */
  isInsideHut(x: number, z: number): boolean {
    const dx = x - this.buildSitePosition.x;
    const dz = z - this.buildSitePosition.z;
    return Math.abs(dx) < 1.85 && Math.abs(dz) < 1.55;
  }

  dispose(): void {
    this.water.dispose();
    this.group.clear();
  }
}
