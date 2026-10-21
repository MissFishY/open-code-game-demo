import { describe, expect, it } from 'vitest';
import { FishingSystem } from '../src/systems/FishingSystem';
import { Player } from '../src/entities/Player';
import { SpatialHash, canMoveTo } from '../src/systems/CollisionSystem';
import { findInteractionTarget, type Interactable } from '../src/systems/InteractionSystem';
import { WORLD } from '../src/config';
import { heightAt, waterDepthAt } from '../src/world/terrain';
import { planPlacements } from '../src/world/ResourceField';

describe('the fishing mini-game', () => {
  it('gives the player a bite within a few seconds', () => {
    const fishing = new FishingSystem(42);
    fishing.cast({ habitat: 'lake', phase: 'day', weather: 'clear' });

    let elapsed = 0;
    while (fishing.stage === 'waiting' && elapsed < 30) {
      fishing.update(0.1);
      elapsed += 0.1;
    }
    expect(fishing.stage).toBe('bite');
    expect(elapsed).toBeLessThan(15);
  });

  it('leaves a long enough window to press E', () => {
    const fishing = new FishingSystem(7);
    fishing.cast({ habitat: 'lake', phase: 'day', weather: 'clear' });
    for (let i = 0; i < 3000 && fishing.stage === 'waiting'; i++) fishing.update(0.1);

    expect(fishing.stage).toBe('bite');
    // The player has to be able to notice it and press the key.
    expect(fishing.biteWindow).toBeGreaterThanOrEqual(2.5);
  });

  it('keeps the fish on the line for the whole window', () => {
    const fishing = new FishingSystem(9);
    fishing.cast({ habitat: 'lake', phase: 'day', weather: 'clear' });
    for (let i = 0; i < 3000 && fishing.stage === 'waiting'; i++) fishing.update(0.1);

    expect(fishing.stage).toBe('bite');
    for (let i = 0; i < 20; i++) fishing.update(0.1);
    expect(fishing.stage).toBe('bite');
  });

  it('says something when the player reels too early', () => {
    const fishing = new FishingSystem(11);
    fishing.cast({ habitat: 'lake', phase: 'day', weather: 'clear' });
    const result = fishing.reel(0);
    expect(result.ok).toBe(false);
    expect(fishing.lastResult).toContain('还没动静');
  });

  it('tells the player what to do at each stage', () => {
    const fishing = new FishingSystem(13);
    fishing.cast({ habitat: 'lake', phase: 'day', weather: 'clear' });
    expect(fishing.hint).toContain('等');
    for (let i = 0; i < 3000 && fishing.stage === 'waiting'; i++) fishing.update(0.1);
    expect(fishing.hint).toContain('E');
  });

  it('only sells moonfish on a clear night', () => {
    const day = new FishingSystem(1);
    day.cast({ habitat: 'lake', phase: 'day', weather: 'clear' });
    for (let i = 0; i < 3000 && day.stage === 'waiting'; i++) day.update(0.1);
    expect(day.hooked?.id).not.toBe('moonfish');
  });
});

describe('diving for deep shells', () => {
  const deepShells = planPlacements().filter((p) => p.kind === 'deepshell');

  it('scatters deep shells in water you cannot wade into', () => {
    expect(deepShells.length).toBeGreaterThan(8);
    for (const shell of deepShells) {
      expect(waterDepthAt(shell.x, shell.z)).toBeGreaterThan(2);
    }
  });

  it('puts them in the lake or just off the beach', () => {
    for (const shell of deepShells) {
      const inLake = Math.hypot(shell.x - WORLD.lake.x, shell.z - WORLD.lake.z) < WORLD.lake.radius;
      const nearIsland = Math.hypot(shell.x, shell.z) < WORLD.islandRadius * 1.25;
      expect(inLake || nearIsland).toBe(true);
    }
  });

  it('can be picked up from the surface while swimming', () => {
    const shell = deepShells[0];
    expect(shell).toBeDefined();
    if (!shell) return;

    const candidate: Interactable = {
      id: `resource:deepshell-${shell.x}-${shell.z}`,
      kind: 'resource',
      x: shell.x,
      // The shell is on the bottom, so it is reached from the surface.
      y: WORLD.waterLevel,
      z: shell.z,
      radius: 1.4,
      label: '潜水捡深海螺',
      available: true,
      ignoreFacing: true,
    };

    // The swimmer floats on the surface, right above it.
    const player = new Player(shell.x, shell.z);
    player.canSwim = true;
    const hash = new SpatialHash();
    for (let i = 0; i < 180; i++) player.update(1 / 60, { x: 0, z: 0 }, false, false, hash);

    expect(player.swimming).toBe(true);

    const found = findInteractionTarget([candidate], {
      playerX: player.position.x,
      playerY: player.position.y,
      playerZ: player.position.z,
      forwardX: 0,
      forwardY: -1,
      forwardZ: 0,
      range: 3.4,
      facingDot: 0.2,
    });
    expect(found?.id).toBe(candidate.id);
  });
});

describe('the beach', () => {
  it('has a wide, gently sloping wadeable band', () => {
    // Walk outwards from the shoreline along +X and measure how far you can
    // wade before the water is too deep.
    const shoreX = WORLD.islandRadius * 1.02;
    const shoreZ = 0;
    let wadeable = 0;
    for (let step = 0; step < 40; step++) {
      const x = shoreX + step * 0.5;
      if (waterDepthAt(x, shoreZ) > 1.1) break;
      wadeable = step * 0.5;
    }
    // At least a few metres of shallow water to walk in and out of.
    expect(wadeable).toBeGreaterThanOrEqual(3);
  });

  it('never leaves the player stuck: shallow water is always walkable', () => {
    for (let step = 0; step < 30; step++) {
      const x = WORLD.islandRadius * 1.0 + step * 0.5;
      const z = 0;
      const depth = waterDepthAt(x, z);
      if (depth <= 0) continue;
      const options = {
        currentDepth: depth,
        currentGround: heightAt(x, z),
        maxWadeDepth: 1.1,
        maxSlope: 0.72,
        canSwim: false,
        swimming: false,
      };
      // Standing at this spot, the player may always step towards the shore.
      const towardsShore = canMoveTo(x - 0.5, z, options);
      expect(towardsShore).toBe(true);
    }
  });

  it('keeps the sea floor from plunging straight down', () => {
    // The slope just past the waterline should be gentle.
    const x0 = WORLD.islandRadius * 1.02;
    const drop = heightAt(x0, 0) - heightAt(x0 + 2, 0);
    const slope = Math.atan2(drop, 2);
    expect(slope).toBeLessThan(0.45); // under ~26 degrees
  });
});
