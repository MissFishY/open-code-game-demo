import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/world/WorldBuilder';
import { WORLD_LAYOUT } from '../src/config';

describe('the hut', () => {
  it('lets the player walk in once it is built', () => {
    const scene = new THREE.Scene();
    const world = new World(scene);

    // Before the hut is built the build marker blocks the middle.
    const before = world.colliders.find((collider) => collider.tag === 'build-site');
    expect(before).toBeDefined();

    world.setHutBuilt(true);

    // The marker must be gone, otherwise it blocks the doorway.
    const after = world.colliders.find((collider) => collider.tag === 'build-site');
    expect(after).toBeUndefined();

    // The walls are there instead, with a gap in the middle of the front.
    const walls = world.colliders.filter((collider) => collider.tag === 'hut-wall');
    expect(walls.length).toBeGreaterThan(10);

    const front = walls.filter(
      (wall) => Math.abs(wall.z - (WORLD_LAYOUT.buildSite.z + 1.7)) < 0.01,
    );
    // The doorway: no wall closer than 0.73 to the centre of the opening.
    const blocksDoorway = front.some(
      (wall) => Math.abs(wall.x - WORLD_LAYOUT.buildSite.x) < 0.73,
    );
    expect(blocksDoorway).toBe(false);

    world.setHutBuilt(false);
    // Putting it back restores the marker.
    expect(world.colliders.find((collider) => collider.tag === 'build-site')).toBeDefined();
  });

  it('puts decorations in the world where the slot says', () => {
    const scene = new THREE.Scene();
    const world = new World(scene);
    world.setHutBuilt(true);

    const slot = 'side-a';
    const placed = world.placeDecoration(slot, 'lantern');
    expect(placed).toBe(true);
    expect(world.decorations.children).toHaveLength(1);

    const model = world.decorations.children[0];
    expect(model).toBeDefined();
    // The slot offset is relative to the hut.
    expect(model?.position.x).toBeCloseTo(-3.3, 3);
    expect(model?.position.z).toBeCloseTo(1.1, 3);

    world.removeDecoration(slot);
    expect(world.decorations.children).toHaveLength(0);
  });

  it('puts furniture inside the hut', () => {
    const scene = new THREE.Scene();
    const world = new World(scene);
    world.setHutBuilt(true);

    expect(world.placeFurniture('bed', 'floor-a')).toBe(true);
    expect(world.interior.children).toHaveLength(1);
    expect(world.interior.children[0]?.position.x).toBeCloseTo(-1.2, 3);

    world.clearInterior();
    expect(world.interior.children).toHaveLength(0);
  });

  it('hides the roof when the player steps inside', () => {
    const scene = new THREE.Scene();
    const world = new World(scene);
    world.setHutBuilt(true);

    const inside = world.buildSitePosition;
    expect(world.isInsideHut(inside.x, inside.z)).toBe(true);
    expect(world.isInsideHut(inside.x + 6, inside.z)).toBe(false);

    world.setRoofVisible(false);
    expect(world.hutRoof.visible).toBe(false);
    world.setRoofVisible(true);
    expect(world.hutRoof.visible).toBe(true);
  });

  it('has fishing spots in both the lake and the sea', () => {
    const scene = new THREE.Scene();
    const world = new World(scene);
    expect(world.fishingSpots.length).toBeGreaterThan(8);
    expect(world.fishingSpots.some((spot) => spot.habitat === 'lake')).toBe(true);
    expect(world.fishingSpots.some((spot) => spot.habitat === 'sea')).toBe(true);
  });
});
