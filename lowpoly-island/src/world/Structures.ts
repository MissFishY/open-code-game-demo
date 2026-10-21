/**
 * Player-built structures.
 *
 * Unlike the scattered props (which are instanced), these are one-off
 * objects placed in the world, so they are built as small groups of boxes.
 */

import * as THREE from 'three';

function box(
  width: number,
  height: number,
  depth: number,
  color: number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const WOOD = 0x9a7350;
const WOOD_DARK = 0x6b563f;
const ROOF = 0x8a4b3c;
const ROOF_DARK = 0x73392e;
const POST = 0x5d4630;
const STONE = 0x8d8d8d;
const STONE_DARK = 0x6e6e6e;

/**
 * A small hut: plank walls, a pitched roof, a door and a lit window.
 * The origin is the centre of the floor.
 *
 * The roof is a separate child group named `hut-roof` so the game can hide it
 * while the player is inside.
 */
export function createHut(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'hut';

  // Floor and a step up to the door.
  group.add(box(4.6, 0.22, 4.0, WOOD_DARK, 0, 0.11, 0));
  group.add(box(1.4, 0.16, 0.7, STONE_DARK, 0, 0.08, 2.3));

  // Walls, with a gap in the front for the doorway.
  group.add(box(4.0, 2.2, 0.22, WOOD, 0, 1.32, -1.7));
  group.add(box(1.2, 2.2, 0.22, WOOD, -1.4, 1.32, 1.7));
  group.add(box(1.2, 2.2, 0.22, WOOD, 1.4, 1.32, 1.7));
  group.add(box(0.22, 2.2, 3.4, WOOD, -2.0, 1.32, 0));
  group.add(box(0.22, 2.2, 3.4, WOOD, 2.0, 1.32, 0));
  // Lintel above the door.
  group.add(box(1.6, 0.5, 0.22, WOOD, 0, 2.17, 1.7));

  // Corner posts.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(box(0.22, 2.4, 0.22, POST, sx * 1.95, 1.3, sz * 1.65));
    }
  }

  // --- Roof (hidden while the player is inside) --------------------------
  const roof = new THREE.Group();
  roof.name = 'hut-roof';

  const roofLeft = box(2.7, 0.18, 4.0, ROOF, -1.05, 2.85, 0);
  roofLeft.rotation.z = 0.52;
  roof.add(roofLeft);

  const roofRight = box(2.7, 0.18, 4.0, ROOF_DARK, 1.05, 2.85, 0);
  roofRight.rotation.z = -0.52;
  roof.add(roofRight);

  const gable = box(4.1, 0.9, 0.16, ROOF_DARK, 0, 2.75, -1.7);
  roof.add(gable);
  roof.add(box(4.1, 0.9, 0.16, ROOF, 0, 2.75, 1.7));

  // Small stone chimney.
  roof.add(box(0.5, 1.1, 0.5, STONE, -1.1, 3.3, -0.6));

  group.add(roof);

  // The door stands open against the wall.
  const door = box(0.95, 1.65, 0.12, 0x4a3524, -0.48, 0.82, 1.62);
  door.rotation.y = -1.35;
  group.add(door);
  group.add(box(0.12, 0.12, 0.1, 0xd9c07a, -0.78, 0.9, 1.5));

  // Window — slightly emissive so it reads as lit from inside.
  const windowMaterial = new THREE.MeshLambertMaterial({
    color: 0xffe9a8,
    emissive: new THREE.Color(0x6b5420),
    emissiveIntensity: 0.7,
  });
  const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.12), windowMaterial);
  windowMesh.position.set(1.2, 1.6, 1.78);
  group.add(windowMesh);

  return group;
}

/**
 * The marked-out foundation the player builds on, shown until the hut is
 * finished.
 */
export function createFoundation(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'foundation';

  // A ring of stones marking the footprint.
  const stones = 14;
  for (let i = 0; i < stones; i++) {
    const angle = (i / stones) * Math.PI * 2;
    const radius = 2.5;
    const stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.28, 0),
      new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? STONE : STONE_DARK }),
    );
    stone.position.set(Math.cos(angle) * radius, 0.14, Math.sin(angle) * radius);
    stone.rotation.set(angle, angle * 1.7, 0);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  // Four corner posts showing where the walls will go.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(box(0.16, 0.7, 0.16, POST, sx * 1.95, 0.35, sz * 1.65));
    }
  }

  // A sign board on the front post.
  group.add(box(0.9, 0.5, 0.08, WOOD, 0, 0.62, 1.75));

  return group;
}

/** A workbench with a saw and a hammer lying on it. */
export function createWorkbench(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'workbench';

  // Top.
  group.add(box(1.9, 0.14, 1.0, WOOD, 0, 0.92, 0));
  group.add(box(1.9, 0.08, 0.12, WOOD_DARK, 0, 0.78, 0.46));

  // Legs.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(box(0.14, 0.9, 0.14, POST, sx * 0.82, 0.45, sz * 0.38));
    }
  }

  // A saw leaning on the bench and a hammer on top.
  const saw = box(0.9, 0.1, 0.16, 0xb9c0c7, 0.3, 1.05, 0.1);
  saw.rotation.y = 0.5;
  group.add(saw);
  group.add(box(0.36, 0.1, 0.1, 0x8d6e63, -0.5, 1.04, -0.15));

  return group;
}

/** A small sea shell, used both as a beach pickup and as a decoration. */
export function createShell(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'shell';

  const material = new THREE.MeshLambertMaterial({ color: 0xf0d9c0 });
  const spiral = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.07, 5, 9, Math.PI * 1.6), material);
  spiral.rotation.x = Math.PI / 2;
  spiral.position.y = 0.08;
  spiral.castShadow = true;
  group.add(spiral);

  const lip = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.22, 7), material);
  lip.position.set(0.2, 0.11, 0);
  lip.rotation.z = -1.2;
  lip.castShadow = true;
  group.add(lip);

  return group;
}

/**
 * Builds the model for a decoration type.
 * Returns `null` for an unknown type.
 */
export function createDecoration(type: string): THREE.Group | null {  switch (type) {
    case 'campfire': {
      const group = new THREE.Group();
      group.name = 'decoration-campfire';

      // A ring of stones.
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const stone = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.14, 0),
          new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0x8d8d8d : 0x6e6e6e }),
        );
        stone.position.set(Math.cos(angle) * 0.42, 0.09, Math.sin(angle) * 0.42);
        stone.rotation.set(angle, angle * 1.3, 0);
        stone.castShadow = true;
        stone.receiveShadow = true;
        group.add(stone);
      }

      // Crossed logs.
      for (const angle of [0.5, -0.5]) {
        const log = box(0.9, 0.11, 0.11, 0x6b4a2f, 0, 0.16, 0);
        log.rotation.y = angle;
        group.add(log);
      }

      // The flame.
      const flameMaterial = new THREE.MeshLambertMaterial({
        color: 0xff9a3c,
        emissive: new THREE.Color(0xff6a00),
        emissiveIntensity: 1.4,
      });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), flameMaterial);
      flame.position.y = 0.44;
      group.add(flame);

      const glow = new THREE.PointLight(0xffa64d, 1.6, 6, 2);
      glow.position.y = 0.6;
      group.add(glow);

      return group;
    }

    case 'lantern': {
      const group = new THREE.Group();
      group.name = 'decoration-lantern';
      group.add(box(0.12, 1.5, 0.12, POST, 0, 0.75, 0));
      group.add(box(0.5, 0.09, 0.09, POST, 0.2, 1.46, 0));

      const lampMaterial = new THREE.MeshLambertMaterial({
        color: 0xffd98a,
        emissive: new THREE.Color(0xffb44d),
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0.92,
      });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.3), lampMaterial);
      lamp.position.set(0.38, 1.2, 0);
      group.add(lamp);

      const light = new THREE.PointLight(0xffca7a, 1.1, 5, 2);
      light.position.set(0.38, 1.2, 0);
      group.add(light);

      return group;
    }

    case 'banner': {
      const group = new THREE.Group();
      group.name = 'decoration-banner';
      group.add(box(0.08, 0.9, 0.08, POST, 0, 0.45, 0));

      const clothMaterial = new THREE.MeshLambertMaterial({
        color: 0xd76a8a,
        side: THREE.DoubleSide,
      });
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.95, 1, 2), clothMaterial);
      cloth.position.set(0.31, 0.55, 0);
      cloth.castShadow = true;
      group.add(cloth);

      // A wavy bottom edge, made from a second darker strip.
      const trim = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.18),
        new THREE.MeshLambertMaterial({ color: 0x8f4560, side: THREE.DoubleSide }),
      );
      trim.position.set(0.31, 0.12, 0.01);
      group.add(trim);

      return group;
    }

    case 'flowerpot': {
      const group = new THREE.Group();
      group.name = 'decoration-flowerpot';
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.19, 0.34, 8),
        new THREE.MeshLambertMaterial({ color: 0xc97a4e }),
      );
      pot.position.y = 0.17;
      pot.castShadow = true;
      pot.receiveShadow = true;
      group.add(pot);

      const plant = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.24, 0),
        new THREE.MeshLambertMaterial({ color: 0x4f8f33 }),
      );
      plant.position.y = 0.44;
      plant.scale.set(1, 0.8, 1);
      plant.castShadow = true;
      group.add(plant);

      const bloom = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12, 0),
        new THREE.MeshLambertMaterial({ color: 0xf48fb1 }),
      );
      bloom.position.y = 0.66;
      group.add(bloom);

      return group;
    }

    case 'stool': {
      const group = new THREE.Group();
      group.name = 'decoration-stool';
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const leg = box(0.09, 0.44, 0.09, POST, Math.cos(angle) * 0.16, 0.22, Math.sin(angle) * 0.16);
        leg.rotation.z = Math.cos(angle) * 0.16;
        leg.rotation.x = -Math.sin(angle) * 0.16;
        group.add(leg);
      }
      group.add(box(0.52, 0.1, 0.52, WOOD, 0, 0.48, 0));
      return group;
    }

    case 'shell':
      return createShell();

    default:
      return null;
  }
}

/** A piece of furniture for the inside of the hut. */
export function createFurniture(type: string): THREE.Group | null {
  switch (type) {
    case 'bed': {
      const group = new THREE.Group();
      group.name = 'furniture-bed';
      group.add(box(1.3, 0.22, 1.9, 0x8d6e63, 0, 0.28, 0));
      group.add(box(1.2, 0.22, 1.7, 0xd8c9a0, 0, 0.48, 0));
      group.add(box(1.3, 0.6, 0.14, 0x6b4a2f, 0, 0.5, -0.9));
      return group;
    }
    case 'table': {
      const group = new THREE.Group();
      group.name = 'furniture-table';
      group.add(box(1.4, 0.1, 0.9, 0x9a7350, 0, 0.72, 0));
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          group.add(box(0.1, 0.68, 0.1, 0x6b4a2f, sx * 0.58, 0.34, sz * 0.34));
        }
      }
      return group;
    }
    case 'rug': {
      const group = new THREE.Group();
      group.name = 'furniture-rug';
      const rug = box(1.8, 0.04, 1.3, 0xb5643c, 0, 0.02, 0);
      group.add(rug);
      group.add(box(1.5, 0.045, 1.0, 0xd8c9a0, 0, 0.03, 0));
      group.add(box(1.1, 0.05, 0.7, 0x5b4b8a, 0, 0.04, 0));
      return group;
    }
    case 'shelf': {
      const group = new THREE.Group();
      group.name = 'furniture-shelf';
      group.add(box(1.2, 0.08, 0.32, 0x9a7350, 0, 0, 0));
      group.add(box(1.2, 0.08, 0.32, 0x9a7350, 0, 0.42, 0));
      group.add(box(0.08, 0.9, 0.32, 0x6b4a2f, -0.56, -0.42, 0));
      group.add(box(0.08, 0.9, 0.32, 0x6b4a2f, 0.56, -0.42, 0));
      return group;
    }
    case 'lamp': {
      const group = new THREE.Group();
      group.name = 'furniture-lamp';
      const material = new THREE.MeshLambertMaterial({
        color: 0xffe0a0,
        emissive: new THREE.Color(0xffb44d),
        emissiveIntensity: 1.2,
      });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26), material);
      group.add(glass);
      group.add(box(0.3, 0.05, 0.3, 0x6b4a2f, 0, -0.18, 0));
      const light = new THREE.PointLight(0xffca7a, 1.2, 5, 2);
      group.add(light);
      return group;
    }
    case 'hearth': {
      const group = new THREE.Group();
      group.name = 'furniture-hearth';
      group.add(box(1.4, 0.7, 0.9, 0x8d8d8d, 0, 0.35, 0));
      group.add(box(0.9, 0.14, 0.6, 0x2a2320, 0, 0.66, 0));
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.5, 6),
        new THREE.MeshLambertMaterial({
          color: 0xff9a3c,
          emissive: new THREE.Color(0xff6a00),
          emissiveIntensity: 1.4,
        }),
      );
      flame.position.y = 0.92;
      group.add(flame);
      const light = new THREE.PointLight(0xffa64d, 1.5, 6, 2);
      light.position.y = 1.0;
      group.add(light);
      return group;
    }
    case 'bench': {
      const group = new THREE.Group();
      group.name = 'furniture-bench';
      group.add(box(1.2, 0.1, 0.42, 0x9a7350, 0, 0.42, 0));
      group.add(box(1.2, 0.42, 0.08, 0x9a7350, 0, 0.62, -0.17));
      for (const sx of [-1, 1]) {
        group.add(box(0.1, 0.42, 0.38, 0x6b4a2f, sx * 0.5, 0.21, 0));
      }
      return group;
    }
    default:
      return null;
  }
}

/** A fishing spot: a stake in the water with a float on top. */
export function createFishingSpot(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'fishing-spot';

  const stake = box(0.1, 1.2, 0.1, 0x6b4a2f, 0, 0.4, 0);
  group.add(stake);

  const float = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xe05a4a }),
  );
  float.position.set(0.3, 0.9, 0);
  float.name = 'float';
  group.add(float);

  return group;
}
