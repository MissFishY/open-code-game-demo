import { describe, expect, it } from 'vitest';
import { CraftingSystem } from '../src/systems/CraftingSystem';
import { BuildingSystem } from '../src/systems/BuildingSystem';
import { Inventory } from '../src/systems/InventorySystem';
import { BLUEPRINTS, RECIPES } from '../src/data/recipes';

describe('CraftingSystem', () => {
  it('knows the basic recipes', () => {
    const crafting = new CraftingSystem();
    expect(crafting.recipes.length).toBeGreaterThan(0);
    expect(crafting.getRecipe('plank')).toBeDefined();
    expect(crafting.getRecipe('rope')).toBeDefined();
    expect(crafting.getRecipe('nope')).toBeUndefined();
  });

  it('refuses to craft without the materials', () => {
    const crafting = new CraftingSystem();
    const inventory = new Inventory();
    const recipe = crafting.getRecipe('plank');
    if (!recipe) throw new Error('missing recipe');

    expect(crafting.canCraft(recipe, inventory)).toBe(false);
    const result = crafting.craft(recipe, inventory);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing-materials');
    expect(inventory.count('plank')).toBe(0);
  });

  it('consumes the inputs and produces the output', () => {
    const crafting = new CraftingSystem();
    const inventory = new Inventory();
    inventory.add('wood', 2);

    const recipe = crafting.getRecipe('plank');
    if (!recipe) throw new Error('missing recipe');

    const result = crafting.craft(recipe, inventory);
    expect(result.ok).toBe(true);
    expect(inventory.count('wood')).toBe(0);
    expect(inventory.count('plank')).toBe(1);
    expect(result.consumed).toEqual([{ item: 'wood', qty: 2 }]);
    expect(result.produced).toEqual([{ item: 'plank', qty: 1 }]);
  });

  it('only consumes what it can produce room for', () => {
    const crafting = new CraftingSystem();
    const inventory = new Inventory(20);
    inventory.add('wood', 4);
    inventory.add('plank', 20); // stack is full

    const recipe = crafting.getRecipe('plank');
    if (!recipe) throw new Error('missing recipe');

    const result = crafting.craft(recipe, inventory);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('inventory-full');
    // The materials must not be eaten when the craft fails.
    expect(inventory.count('wood')).toBe(4);
  });

  it('reports requirement progress for the UI', () => {
    const crafting = new CraftingSystem();
    const inventory = new Inventory();
    inventory.add('wood', 1);

    const recipe = crafting.getRecipe('craft_campfire');
    if (!recipe) throw new Error('missing recipe');

    const progress = crafting.progress(recipe, inventory);
    expect(progress).toHaveLength(2);
    expect(progress[0]?.item).toBe('wood');
    expect(progress[0]?.have).toBe(1);
    expect(progress[0]?.qty).toBe(3);
    expect(progress[0]?.satisfied).toBe(false);
    expect(progress[1]?.satisfied).toBe(false);
  });

  it('can craft several times in a row', () => {
    const crafting = new CraftingSystem();
    const inventory = new Inventory();
    const recipe = crafting.getRecipe('rope');
    if (!recipe) throw new Error('missing recipe');

    inventory.add('fiber', 9);
    expect(crafting.craft(recipe, inventory).ok).toBe(true);
    expect(crafting.craft(recipe, inventory).ok).toBe(true);
    expect(crafting.craft(recipe, inventory).ok).toBe(true);
    expect(inventory.count('rope')).toBe(3);
    expect(inventory.count('fiber')).toBe(0);
  });

  it('has recipes that only use resources the island provides', () => {
    const known = new Set(['wood', 'stone', 'fiber', 'berry', 'flower', 'crystal', 'plank', 'rope']);
    for (const recipe of RECIPES) {
      for (const input of recipe.inputs) {
        expect(known.has(input.item)).toBe(true);
      }
    }
  });
});

describe('BuildingSystem', () => {
  const blueprint = BLUEPRINTS['hut'];
  if (!blueprint) throw new Error('missing hut blueprint');

  it('refuses to build without the parts', () => {
    const building = new BuildingSystem();
    const inventory = new Inventory();

    expect(building.canBuild(blueprint, inventory)).toBe(false);
    const result = building.build(blueprint, inventory);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing-materials');
    expect(building.isBuilt('hut')).toBe(false);
  });

  it('consumes the parts and marks the structure as built', () => {
    const building = new BuildingSystem();
    const inventory = new Inventory();
    inventory.add('plank', 4);
    inventory.add('rope', 2);
    inventory.add('stone', 2);

    expect(building.canBuild(blueprint, inventory)).toBe(true);
    const result = building.build(blueprint, inventory);

    expect(result.ok).toBe(true);
    expect(building.isBuilt('hut')).toBe(true);
    expect(inventory.count('plank')).toBe(0);
    expect(inventory.count('rope')).toBe(0);
    expect(inventory.count('stone')).toBe(0);
  });

  it('cannot build the same structure twice', () => {
    const building = new BuildingSystem();
    const inventory = new Inventory();
    inventory.add('plank', 4);
    inventory.add('rope', 2);
    inventory.add('stone', 2);

    building.build(blueprint, inventory);
    const second = building.build(blueprint, inventory);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('already-built');
  });

  it('reports requirement progress for the UI', () => {
    const building = new BuildingSystem();
    const inventory = new Inventory();
    inventory.add('plank', 2);

    const progress = building.progress(blueprint, inventory);
    expect(progress).toHaveLength(blueprint.inputs.length);
    expect(progress[0]?.satisfied).toBe(false);
    expect(progress[0]?.have).toBe(2);
  });

  it('round-trips through JSON', () => {
    const building = new BuildingSystem();
    const inventory = new Inventory();
    inventory.add('plank', 4);
    inventory.add('rope', 2);
    inventory.add('stone', 2);
    building.build(blueprint, inventory);

    const restored = new BuildingSystem();
    restored.load(building.toJSON());
    expect(restored.isBuilt('hut')).toBe(true);
    expect(restored.builtIds).toEqual(['hut']);
  });

  it('ignores corrupt build data', () => {
    const building = new BuildingSystem();
    building.load({ built: ['not-a-building', 42, null] });
    expect(building.isBuilt('not-a-building')).toBe(false);
    expect(building.builtIds).toHaveLength(0);
    building.load(null);
    expect(building.builtIds).toHaveLength(0);
  });

  it('can be built from crafted materials', () => {
    // The intended path: gather -> craft -> build.
    const crafting = new CraftingSystem();
    const building = new BuildingSystem();
    const inventory = new Inventory();

    inventory.add('wood', 8);
    inventory.add('fiber', 6);
    inventory.add('stone', 2);

    const plank = crafting.getRecipe('plank');
    const rope = crafting.getRecipe('rope');
    if (!plank || !rope) throw new Error('missing recipes');

    for (let i = 0; i < 4; i++) crafting.craft(plank, inventory);
    for (let i = 0; i < 2; i++) crafting.craft(rope, inventory);

    expect(inventory.count('plank')).toBe(4);
    expect(inventory.count('rope')).toBe(2);
    expect(building.canBuild(blueprint, inventory)).toBe(true);
    expect(building.build(blueprint, inventory).ok).toBe(true);
  });
});
