import { describe, expect, it } from 'vitest';
import { DecorationSystem } from '../src/systems/DecorationSystem';
import { Inventory } from '../src/systems/InventorySystem';
import {
  COZINESS_TIERS,
  DECORATIONS,
  DECORATION_SLOTS,
  MAX_COZINESS,
  getDecoration,
  getSlot,
} from '../src/data/decorations';

describe('decoration data', () => {
  it('defines decorations with a coziness value and an icon', () => {
    expect(DECORATIONS.length).toBeGreaterThan(0);
    for (const decoration of DECORATIONS) {
      expect(decoration.coziness).toBeGreaterThan(0);
      expect(decoration.icon.length).toBeGreaterThan(0);
      expect(getDecoration(decoration.id)).toBe(decoration);
    }
  });

  it('gives every slot at least one decoration that fits it', () => {
    for (const slot of DECORATION_SLOTS) {
      expect(slot.accepts.length).toBeGreaterThan(0);
      for (const type of slot.accepts) {
        expect(getDecoration(type)).toBeDefined();
      }
    }
  });

  it('has a slot for every decoration type', () => {
    for (const decoration of DECORATIONS) {
      const fits = DECORATION_SLOTS.some((slot) => slot.accepts.includes(decoration.id));
      expect(fits).toBe(true);
    }
  });

  it('can reach every coziness tier', () => {
    for (const tier of COZINESS_TIERS) {
      expect(tier.at).toBeLessThanOrEqual(MAX_COZINESS);
      expect(tier.gift.length).toBeGreaterThan(0);
    }
  });
});

describe('DecorationSystem', () => {
  it('starts empty', () => {
    const decorations = new DecorationSystem();
    expect(decorations.count).toBe(0);
    expect(decorations.coziness).toBe(0);
    expect(decorations.list()).toHaveLength(0);
  });

  it('places a decoration and takes the item from the backpack', () => {
    const decorations = new DecorationSystem();
    const inventory = new Inventory();
    inventory.add('campfire', 1);

    const slot = decorations.findSlotFor('campfire');
    expect(slot).not.toBeNull();
    if (!slot) return;

    expect(decorations.place(slot, 'campfire', inventory)).toBe(true);
    expect(decorations.count).toBe(1);
    expect(inventory.count('campfire')).toBe(0);
    expect(decorations.coziness).toBe(3);
  });

  it('refuses to place without the item', () => {
    const decorations = new DecorationSystem();
    const inventory = new Inventory();
    expect(decorations.place('firepit', 'campfire', inventory)).toBe(false);
    expect(decorations.count).toBe(0);
  });

  it('refuses to put a decoration in a slot that does not fit it', () => {
    const decorations = new DecorationSystem();
    const inventory = new Inventory();
    inventory.add('banner', 1);
    // The fire pit only accepts a campfire.
    expect(decorations.place('firepit', 'banner', inventory)).toBe(false);
    expect(decorations.place('side-a', 'banner', inventory)).toBe(false);
  });

  it('refuses to fill a slot twice', () => {
    const decorations = new DecorationSystem();
    const inventory = new Inventory();
    inventory.add('campfire', 2);
    expect(decorations.place('firepit', 'campfire', inventory)).toBe(true);
    expect(decorations.place('firepit', 'campfire', inventory)).toBe(false);
    expect(decorations.count).toBe(1);
  });

  it('takes a decoration back and returns the item', () => {
    const decorations = new DecorationSystem();
    const inventory = new Inventory();
    inventory.add('lantern', 1);

    decorations.place('side-a', 'lantern', inventory);
    expect(inventory.count('lantern')).toBe(0);

    expect(decorations.remove('side-a', inventory)).toBe(true);
    expect(inventory.count('lantern')).toBe(1);
    expect(decorations.count).toBe(0);
    expect(decorations.coziness).toBe(0);
  });

  it('finds a free slot for each decoration type', () => {
    const decorations = new DecorationSystem();
    const inventory = new Inventory();
    for (const decoration of DECORATIONS) {
      inventory.add(decoration.itemId, 1);
    }
    for (const decoration of DECORATIONS) {
      const slot = decorations.findSlotFor(decoration.id);
      expect(slot).not.toBeNull();
      if (!slot) continue;
      expect(decorations.place(slot, decoration.id, inventory)).toBe(true);
    }
    expect(decorations.count).toBe(DECORATIONS.length);
  });

  it('reports the reached tier and the next one', () => {
    const decorations = new DecorationSystem();
    const inventory = new Inventory();
    expect(decorations.tier).toBe(0);
    expect(decorations.nextTier?.at).toBe(COZINESS_TIERS[0]?.at);

    inventory.add('campfire', 1);
    decorations.place('firepit', 'campfire', inventory);
    expect(decorations.coziness).toBe(3);
    expect(decorations.tier).toBe(0);

    inventory.add('lantern', 1);
    decorations.place('side-a', 'lantern', inventory);
    expect(decorations.coziness).toBe(5);
    expect(decorations.tier).toBe(COZINESS_TIERS[0]?.at);
  });

  it('hands out a tier gift only once', () => {
    const decorations = new DecorationSystem();
    const inventory = new Inventory();
    inventory.add('campfire', 1);
    inventory.add('lantern', 1);
    decorations.place('firepit', 'campfire', inventory);
    decorations.place('side-a', 'lantern', inventory);

    const first = decorations.claimNewTiers(inventory);
    expect(first).toHaveLength(1);
    expect(first[0]?.tier.at).toBe(COZINESS_TIERS[0]?.at);
    expect(inventory.count('flower')).toBe(2);

    const second = decorations.claimNewTiers(inventory);
    expect(second).toHaveLength(0);
    expect(inventory.count('flower')).toBe(2);
  });

  it('round-trips through JSON', () => {
    const decorations = new DecorationSystem();
    const inventory = new Inventory();
    inventory.add('campfire', 1);
    inventory.add('lantern', 1);
    decorations.place('firepit', 'campfire', inventory);
    decorations.place('side-a', 'lantern', inventory);
    decorations.claimNewTiers(inventory);

    const restored = new DecorationSystem();
    restored.load(decorations.toJSON());

    expect(restored.count).toBe(2);
    expect(restored.coziness).toBe(5);
    expect(restored.get('firepit')?.type).toBe('campfire');
    expect(restored.isTierClaimed(COZINESS_TIERS[0]?.at ?? 0)).toBe(true);
  });

  it('ignores corrupt decoration data', () => {
    const decorations = new DecorationSystem();
    decorations.load({ placements: 'nope', claimed: 'nope' });
    expect(decorations.count).toBe(0);

    decorations.load({
      placements: [
        { slot: 'not-a-slot', type: 'campfire' },
        { slot: 'firepit', type: 'not-a-type' },
        { slot: 'firepit', type: 'banner' }, // wrong type for this slot
        null,
        'nope',
      ],
      claimed: [1, 'x', null],
    });
    expect(decorations.count).toBe(0);
    expect(decorations.isTierClaimed(1)).toBe(true);
  });

  it('does not place decorations in slots that no longer exist', () => {
    const decorations = new DecorationSystem();
    const inventory = new Inventory();
    expect(getSlot('not-a-slot')).toBeUndefined();
    expect(decorations.place('not-a-slot', 'campfire', inventory)).toBe(false);
  });
});
