import { describe, expect, it } from 'vitest';
import {
  MemoryStorage,
  SaveSystem,
  createDefaultSave,
  sanitizeSave,
  type SaveData,
} from '../src/systems/SaveSystem';

function sampleSave(): SaveData {
  const save = createDefaultSave();
  save.player.position = [12.5, 3.25, -8];
  save.player.yaw = 1.25;
  save.player.pitch = -0.2;
  save.inventory = { wood: 4, fiber: 2, crystal: 1 };
  save.quests.completed = ['firewood'];
  save.harvested = ['node-wood-1-100', 'node-stone-2-200'];
  save.build = { built: ['hut'] };
  save.flags = { 'talked:tallis': true };
  save.playTime = 42.5;
  return save;
}

describe('SaveSystem', () => {
  it('round-trips a save through storage', () => {
    const storage = new MemoryStorage();
    const system = new SaveSystem(storage);

    expect(system.load()).toBeNull();
    expect(system.hasAnySave()).toBe(false);

    expect(system.save(sampleSave())).toBe(true);
    expect(system.hasAnySave()).toBe(true);

    const loaded = system.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.player.position).toEqual([12.5, 3.25, -8]);
    expect(loaded?.inventory).toEqual({ wood: 4, fiber: 2, crystal: 1 });
    expect(loaded?.quests.completed).toEqual(['firewood']);
    expect(loaded?.harvested).toEqual(['node-wood-1-100', 'node-stone-2-200']);
    expect(loaded?.build.built).toEqual(['hut']);
    expect(loaded?.flags['talked:tallis']).toBe(true);
    expect(loaded?.playTime).toBeCloseTo(42.5);
  });

  it('clears a save', () => {
    const storage = new MemoryStorage();
    const system = new SaveSystem(storage);
    system.save(sampleSave());
    system.clear();
    expect(system.hasAnySave()).toBe(false);
    expect(system.load()).toBeNull();
  });

  it('returns null for corrupt JSON instead of throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem('lowpoly-island.save.v1', '{not json');
    const system = new SaveSystem(storage);
    expect(system.load()).toBeNull();
  });

  it('returns null when storage throws', () => {
    const broken = {
      getItem() {
        throw new Error('nope');
      },
      setItem() {
        throw new Error('nope');
      },
      removeItem() {
        throw new Error('nope');
      },
    };
    const system = new SaveSystem(broken);
    expect(system.load()).toBeNull();
    expect(system.save(sampleSave())).toBe(false);
    expect(system.hasAnySave()).toBe(false);
    expect(() => system.clear()).not.toThrow();
  });
});

describe('sanitizeSave', () => {
  it('rejects non-objects', () => {
    expect(sanitizeSave(null)).toBeNull();
    expect(sanitizeSave('hello')).toBeNull();
    expect(sanitizeSave(42)).toBeNull();
  });

  it('rejects saves from a newer version', () => {
    const future = { ...sampleSave(), version: 999 };
    expect(sanitizeSave(future)).toBeNull();
  });

  it('repairs a partially broken save', () => {
    const repaired = sanitizeSave({
      version: 1,
      player: { position: ['a', 2, 3], yaw: 'x' },
      inventory: { wood: 'many', stone: 3 },
      quests: { completed: ['firewood', 'not-a-quest', 7] },
      harvested: ['ok', 42, null],
      build: { built: ['hut', 7] },
      flags: { a: true, b: 'yes' },
      playTime: 'long',
    });

    expect(repaired).not.toBeNull();
    expect(repaired?.player.position).toEqual([0, 0, 0]);
    expect(repaired?.player.yaw).toBe(0);
    expect(repaired?.inventory).toEqual({ stone: 3 });
    expect(repaired?.quests.completed).toEqual(['firewood']);
    expect(repaired?.harvested).toEqual(['ok']);
    expect(repaired?.build.built).toEqual(['hut']);
    expect(repaired?.flags).toEqual({ a: true });
    expect(repaired?.playTime).toBe(0);
  });

  it('always produces a usable position', () => {
    const repaired = sanitizeSave({ version: 1 });
    expect(repaired?.player.position).toHaveLength(3);
    repaired?.player.position.forEach((value) => expect(Number.isFinite(value)).toBe(true));
  });
});
