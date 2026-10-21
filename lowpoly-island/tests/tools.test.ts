import { describe, expect, it } from 'vitest';
import { CraftingSystem } from '../src/systems/CraftingSystem';
import { MarketSystem } from '../src/systems/MarketSystem';
import { Inventory } from '../src/systems/InventorySystem';
import { shopFor, TOOL_LEVELS } from '../src/data/shop';
import { getItem } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';

describe('tools', () => {
  it('are not free: only the rod is lent by Tallis', () => {
    const entries = shopFor('tallis');
    const gifts = entries.filter((entry) => entry.gift);
    // Exactly one gift: the rod. An axe and a pickaxe you have to make.
    expect(gifts).toHaveLength(1);
    expect(gifts[0]?.toolId).toBe('rod');
    expect(gifts[0]?.cost).toBe(0);
  });

  it('are only sold as upgrades, apart from the gifted rod', () => {
    for (const entry of shopFor('tallis')) {
      if (entry.kind !== 'tool') continue;
      if (entry.level === 1) {
        // The one level-1 tool in the shop is the rod he lends you.
        expect(entry.gift).toBe(true);
        expect(entry.toolId).toBe('rod');
      } else {
        expect(entry.level).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('can be crafted from what the island gives you', () => {
    const crafting = new CraftingSystem();
    const inventory = new Inventory();

    // The axe: 2 stone + 1 rope.
    const axe = crafting.getRecipe('axe');
    expect(axe).toBeDefined();
    if (!axe) return;
    expect(axe.inputs.map((input) => input.item)).toEqual(['stone', 'fiber']);

    // Bare hands can get you there: one rock gives two stones, three reeds
    // give one rope.
    inventory.add('stone', 2);
    inventory.add('fiber', 3);
    expect(crafting.canCraft(axe, inventory)).toBe(true);

    const result = crafting.craft(axe, inventory);
    expect(result.ok).toBe(true);
    expect(inventory.count('axe')).toBe(1);
    expect(inventory.count('stone')).toBe(0);
  });

  it('make the tools worth having', () => {
    const market = new MarketSystem(0);
    // Without a tool.
    expect(market.toolBonus('axe')).toBe(0);
    // With one: clearly better than bare hands.
    market.upgradeTool('axe', 1);
    expect(market.toolBonus('axe')).toBe(TOOL_LEVELS.axe[0]?.bonus);
    expect(market.toolBonus('axe')).toBeGreaterThanOrEqual(2);
    // And upgraded.
    market.upgradeTool('axe', 3);
    expect(market.toolBonus('axe')).toBe(TOOL_LEVELS.axe[2]?.bonus);
    expect(market.toolBonus('axe')).toBeGreaterThan(TOOL_LEVELS.axe[0]?.bonus ?? 0);
  });

  it('are described honestly in the item list', () => {
    expect(getItem('axe').description).toContain('两份');
    expect(getItem('pickaxe').description).toContain('石头');
  });

  it('keep the crafting menu meaningful', () => {
    const ids = RECIPES.map((recipe) => recipe.id);
    expect(ids).toContain('axe');
    expect(ids).toContain('pickaxe');
    expect(ids).toContain('plank');
    expect(ids).toContain('rope');
  });
});
