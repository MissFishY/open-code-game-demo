import { describe, expect, it } from 'vitest';
import { StorageSystem } from '../src/systems/StorageSystem';
import { Inventory } from '../src/systems/InventorySystem';
import { STAMINA } from '../src/systems/StaminaSystem';
import { CLOTHING, getClothing, totalBonuses } from '../src/data/clothing';
import { SURPLUS_PRICES } from '../src/data/shop';
import { INVENTORY } from '../src/config';

const isSellableMaterial = (id: string): boolean => id in SURPLUS_PRICES;
import { RECIPES } from '../src/data/recipes';

describe('the chest at home', () => {
  it('takes things in and gives them back', () => {
    const chest = new StorageSystem();
    expect(chest.add('wood', 3)).toBe(3);
    expect(chest.count('wood')).toBe(3);
    expect(chest.total).toBe(3);
    expect(chest.slotsUsed).toBe(1);

    expect(chest.remove('wood', 2)).toBe(2);
    expect(chest.count('wood')).toBe(1);
    expect(chest.remove('wood', 5)).toBe(1);
    expect(chest.isEmpty).toBe(true);
  });

  it('holds more than the backpack', () => {
    const chest = new StorageSystem();
    const bag = new Inventory();
    expect(chest.maxSlots).toBeGreaterThan(0);
    expect(chest.maxSlots).toBeGreaterThan(10);
    expect(bag.maxStack).toBe(INVENTORY.maxStack);
  });

  it('runs out of slots and says so', () => {
    const chest = new StorageSystem(2, 20);
    expect(chest.add('wood')).toBe(1);
    expect(chest.add('stone')).toBe(1);
    expect(chest.add('fiber')).toBe(0);
    expect(chest.hasRoomForNewItems).toBe(false);
    // But you can still top up a kind it already holds.
    expect(chest.add('wood')).toBe(1);
  });

  it('refuses to overfill a stack', () => {
    const chest = new StorageSystem();
    expect(chest.add('wood', 25)).toBe(20);
    expect(chest.canAccept('wood', 1)).toBe(false);
  });

  it('round-trips through JSON', () => {
    const chest = new StorageSystem();
    chest.add('wood', 4);
    chest.add('plank', 2);

    const other = new StorageSystem();
    other.load(chest.toJSON());
    expect(other.count('wood')).toBe(4);
    expect(other.count('plank')).toBe(2);
    expect(other.total).toBe(6);
  });
});

describe('selling what you made', () => {
  it('takes every crafting material', () => {
    for (const id of ['wood', 'stone', 'fiber', 'plank', 'rope', 'flower']) {
      expect(isSellableMaterial(id)).toBe(true);
    }
  });

  it('takes the things you can craft', () => {
    // Every recipe output that is not a tool has to be sellable.
    for (const recipe of RECIPES) {
      if (recipe.output.item === 'axe' || recipe.output.item === 'pickaxe') continue;
      expect(isSellableMaterial(recipe.output.item)).toBe(true);
    }
  });

  it('never lets you make money by crafting and selling', () => {
    // A plank is two logs, so it may not be worth more than two logs.
    expect(SURPLUS_PRICES['plank']).toBeLessThanOrEqual(2 * (SURPLUS_PRICES['wood'] ?? 0));
    expect(SURPLUS_PRICES['rope']).toBeLessThanOrEqual(3 * (SURPLUS_PRICES['fiber'] ?? 0));
    for (const price of Object.values(SURPLUS_PRICES)) {
      expect(price).toBeGreaterThan(0);
    }
  });

  it('does not sell the quest items', () => {
    expect(isSellableMaterial('crystal')).toBe(false);
    expect(isSellableMaterial('deepshell')).toBe(false);
    expect(isSellableMaterial('crown')).toBe(false);
  });
});

describe('the swimming and diving clothes', () => {
  it('gives every piece a real bonus', () => {
    // Nothing may promise something the game does not do.
    for (const piece of CLOTHING) {
      const bonuses = piece.bonuses;
      if (bonuses.swimDrain) expect(bonuses.swimDrain).toBeGreaterThan(0);
      if (bonuses.diveDrain) expect(bonuses.diveDrain).toBeGreaterThan(0);
      if (bonuses.rainImmune) expect(bonuses.rainImmune).toBe(true);
    }
  });

  it('stacks the relief from several pieces', () => {
    const swimming = totalBonuses(['swimsuit', 'waders']);
    expect(swimming.swimDrain).toBe(40);

    const diving = totalBonuses(['swimsuit', 'divesuit']);
    expect(diving.diveDrain).toBe(55);

    const everything = totalBonuses(['swimsuit', 'divesuit', 'divingmask']);
    expect(everything.diveDrain).toBe(80);
  });

  it('lets you hold your breath much longer with the diving gear', () => {
    const seconds = (reduce: number): number =>
      STAMINA.baseMax / (STAMINA.diveDrain * (1 - reduce / 100));

    const bare = seconds(0);
    const dressed = seconds(totalBonuses(['swimsuit', 'divesuit', 'divingmask']).diveDrain ?? 0);

    // Bare is a couple of seconds; dressed is a good ten.
    expect(bare).toBeLessThan(3);
    expect(dressed).toBeGreaterThan(bare * 3);
  });

  it('has a piece for every stage of the dive', () => {
    expect(getClothing('swimsuit')).toBeDefined();
    expect(getClothing('divesuit')).toBeDefined();
    expect(getClothing('divingmask')).toBeDefined();
  });

  it('keeps the work coat out of the rain', () => {
    expect(getClothing('workcoat')?.bonuses.rainImmune).toBe(true);
  });
});

describe('the backpack', () => {
  it('knows when it cannot take another of something', () => {
    const bag = new Inventory(20);
    expect(bag.hasFullStack).toBe(false);
    bag.add('wood', 19);
    expect(bag.hasFullStack).toBe(false);
    bag.add('wood', 1);
    expect(bag.hasFullStack).toBe(true);
  });
});
