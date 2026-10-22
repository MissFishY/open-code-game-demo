import { describe, expect, it } from 'vitest';
import { MarketSystem } from '../src/systems/MarketSystem';
import { SaveSystem, MemoryStorage, SLOT_COUNT } from '../src/systems/SaveSystem';
import { TOOL_LEVELS } from '../src/data/shop';

describe('tool wear', () => {
  it('starts a fresh tool with a full set of uses', () => {
    const market = new MarketSystem(0);
    market.upgradeTool('axe', 1);
    expect(market.toolRemaining('axe')).toBe(TOOL_LEVELS.axe[0]?.durability);
  });

  it('wears the tool down as it is used', () => {
    const market = new MarketSystem(0);
    market.upgradeTool('axe', 1);
    const before = market.toolRemaining('axe');
    market.useTool('axe');
    expect(market.toolRemaining('axe')).toBe(before - 1);
  });

  it('breaks the tool and leaves you with bare hands', () => {
    const market = new MarketSystem(0);
    market.upgradeTool('axe', 1);
    const uses = market.toolDurability('axe');
    for (let i = 0; i < uses - 1; i++) expect(market.useTool('axe')).toBe(true);
    // The last swing breaks it.
    expect(market.useTool('axe')).toBe(false);
    expect(market.toolLevel('axe')).toBe(0);
    expect(market.toolRemaining('axe')).toBe(0);
    expect(market.toolBonus('axe')).toBe(0);
  });

  it('makes the tools worth much more than bare hands', () => {
    const market = new MarketSystem(0);
    // Bare hands: one extra unit at most.
    expect(market.toolBonus('axe')).toBe(0);
    market.upgradeTool('axe', 1);
    expect(market.toolBonus('axe')).toBeGreaterThanOrEqual(2);
    market.upgradeTool('axe', 3);
    expect(market.toolBonus('axe')).toBeGreaterThanOrEqual(9);
  });

  it('keeps the wear in the save file', () => {
    const market = new MarketSystem(0);
    market.upgradeTool('pickaxe', 2);
    market.useTool('pickaxe');
    market.useTool('pickaxe');

    const restored = new MarketSystem(0);
    restored.load(market.toJSON());
    expect(restored.toolLevel('pickaxe')).toBe(2);
    expect(restored.toolRemaining('pickaxe')).toBe(market.toolRemaining('pickaxe'));
  });
});

describe('selling tools', () => {
  it('gives some money back', () => {
    const market = new MarketSystem(0);
    market.upgradeTool('axe', 2);
    const refund = market.toolRefund('axe');
    expect(refund).toBeGreaterThan(0);

    const coins = market.sellTool('axe');
    expect(coins).toBe(refund);
    expect(market.coins).toBe(refund);
    expect(market.toolLevel('axe')).toBe(0);
  });

  it('refuses to sell a tool you do not have', () => {
    const market = new MarketSystem(0);
    expect(market.sellTool('rod')).toBe(0);
    expect(market.coins).toBe(0);
  });
});

describe('save slots', () => {
  it('has three slots', () => {
    expect(SLOT_COUNT).toBe(3);
  });

  it('saves and loads each slot independently', () => {
    const storage = new MemoryStorage();
    const system = new SaveSystem(storage);

    const first = system.loadFrom(1);
    expect(first).toBeNull();

    system.saveTo(1, { ...emptySave(), time: { day: 5, phase: 'morning', weather: 'clear' } });
    system.saveTo(3, { ...emptySave(), time: { day: 9, phase: 'morning', weather: 'clear' } });

    expect(system.loadFrom(1)?.time.day).toBe(5);
    expect(system.loadFrom(2)).toBeNull();
    expect(system.loadFrom(3)?.time.day).toBe(9);
  });

  it('deletes a slot', () => {
    const storage = new MemoryStorage();
    const system = new SaveSystem(storage);
    system.saveTo(2, emptySave());
    expect(system.loadFrom(2)).not.toBeNull();
    system.deleteSlot(2);
    expect(system.loadFrom(2)).toBeNull();
  });

  it('writes the autosave to the current slot', () => {
    const storage = new MemoryStorage();
    const system = new SaveSystem(storage);
    system.currentSlot = 3;
    system.save({ ...emptySave(), time: { day: 7, phase: 'night', weather: 'rain' } });
    expect(system.loadFrom(3)?.time.day).toBe(7);
    expect(system.loadFrom(1)).toBeNull();
  });

  it('lists a summary of every slot', () => {
    const storage = new MemoryStorage();
    const system = new SaveSystem(storage);
    system.saveTo(1, { ...emptySave(), time: { day: 4, phase: 'morning', weather: 'clear' } });

    const slots = system.listSlots();
    expect(slots).toHaveLength(SLOT_COUNT);
    expect(slots[0]?.exists).toBe(true);
    expect(slots[0]?.day).toBe(4);
    expect(slots[1]?.exists).toBe(false);
  });

  it('finds the most recent save across all slots', async () => {
    const storage = new MemoryStorage();
    const system = new SaveSystem(storage);
    system.saveTo(1, emptySave());
    await new Promise((resolve) => setTimeout(resolve, 5));
    system.saveTo(2, emptySave());
    await new Promise((resolve) => setTimeout(resolve, 5));
    system.saveTo(3, emptySave());

    // Slot 3 was written last, so it is the most recent one.
    expect(system.loadMostRecent()?.savedAt).toBe(
      system.loadFrom(3)?.savedAt,
    );
  });

  it('reads an old save that lived in the plain key', () => {
    const storage = new MemoryStorage();
    storage.setItem('lowpoly-island.save.v1', JSON.stringify({ ...emptySave(), time: { day: 3, phase: 'morning', weather: 'clear' } }));
    const system = new SaveSystem(storage);
    expect(system.loadFrom(1)?.time.day).toBe(3);
  });
});

function emptySave() {
  return {
    version: 1,
    savedAt: 0,
    player: { position: [0, 0, 0] as [number, number, number], yaw: 0, pitch: 0 },
    inventory: {},
    quests: { completed: [] as never[] },
    harvested: [],
    build: { built: [] },
    decorations: { placements: [], claimed: [] },
    interior: { furniture: [], expansions: [] },
    wardrobe: { owned: [] },
    market: {
      coins: 0,
      tools: { axe: 0, pickaxe: 0, rod: 0 },
      wear: { axe: 0, pickaxe: 0, rod: 0 },
      bought: [],
    },
    trust: { tallis: 0, nell: 0, maren: 0 },
    time: { day: 1, phase: 'morning', weather: 'clear' },
    stamina: { current: 100, max: 100, debt: 0 },
    satiety: { current: 100, max: 100 },
    storage: {},
    flags: {},
    playTime: 0,
    seenIntro: false,
  };
}
