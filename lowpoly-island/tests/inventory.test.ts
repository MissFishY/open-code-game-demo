import { describe, expect, it } from 'vitest';
import { Inventory } from '../src/systems/InventorySystem';

describe('Inventory', () => {
  it('starts empty', () => {
    const inventory = new Inventory();
    expect(inventory.isEmpty).toBe(true);
    expect(inventory.total).toBe(0);
    expect(inventory.slotsUsed).toBe(0);
    expect(inventory.count('wood')).toBe(0);
  });

  it('adds and removes items', () => {
    const inventory = new Inventory();
    expect(inventory.add('wood', 3)).toBe(3);
    expect(inventory.count('wood')).toBe(3);
    expect(inventory.remove('wood', 2)).toBe(2);
    expect(inventory.count('wood')).toBe(1);
  });

  it('never removes more than it holds', () => {
    const inventory = new Inventory();
    inventory.add('stone', 2);
    expect(inventory.remove('stone', 10)).toBe(2);
    expect(inventory.count('stone')).toBe(0);
    expect(inventory.isEmpty).toBe(true);
  });

  it('respects the stack limit', () => {
    const inventory = new Inventory(5);
    expect(inventory.add('berry', 4)).toBe(4);
    expect(inventory.add('berry', 4)).toBe(1);
    expect(inventory.count('berry')).toBe(5);
  });

  it('reports how many items were accepted', () => {
    const inventory = new Inventory(3);
    expect(inventory.add('fiber', 10)).toBe(3);
    expect(inventory.add('fiber', 1)).toBe(0);
  });

  it('ignores non-positive amounts', () => {
    const inventory = new Inventory();
    expect(inventory.add('wood', 0)).toBe(0);
    expect(inventory.add('wood', -5)).toBe(0);
    expect(inventory.remove('wood', 0)).toBe(0);
  });

  it('consumes items only when there are enough', () => {
    const inventory = new Inventory();
    inventory.add('wood', 1);
    expect(inventory.tryConsume('wood', 2)).toBe(false);
    expect(inventory.count('wood')).toBe(1);
    expect(inventory.tryConsume('wood', 1)).toBe(true);
    expect(inventory.count('wood')).toBe(0);
  });

  it('round-trips through JSON', () => {
    const inventory = new Inventory();
    inventory.add('wood', 3);
    inventory.add('crystal', 1);

    const restored = new Inventory();
    restored.load(inventory.toJSON());

    expect(restored.count('wood')).toBe(3);
    expect(restored.count('crystal')).toBe(1);
    expect(restored.entries()).toEqual(inventory.entries());
  });

  it('ignores malformed save data', () => {
    const inventory = new Inventory();
    inventory.load({ wood: 'abc', stone: -3, fiber: 4.7, berry: null });
    expect(inventory.count('wood')).toBe(0);
    expect(inventory.count('stone')).toBe(0);
    expect(inventory.count('fiber')).toBe(4);
    expect(inventory.count('berry')).toBe(0);
  });

  it('handles a completely invalid payload', () => {
    const inventory = new Inventory();
    inventory.load(null);
    expect(inventory.isEmpty).toBe(true);
    inventory.load('nonsense' as unknown);
    expect(inventory.isEmpty).toBe(true);
  });

  it('tracks the number of used slots', () => {
    const inventory = new Inventory();
    inventory.add('wood', 1);
    inventory.add('stone', 1);
    inventory.add('fiber', 1);
    expect(inventory.slotsUsed).toBe(3);
    expect(inventory.total).toBe(3);
  });
});
