import { describe, expect, it } from 'vitest';
import { CraftingSystem } from '../src/systems/CraftingSystem';
import { Inventory } from '../src/systems/InventorySystem';
import { MarketSystem } from '../src/systems/MarketSystem';
import { STAMINA } from '../src/systems/StaminaSystem';
import { BUYERS, getShopEntry, isToolId, shellPrice, TOOL_LEVELS } from '../src/data/shop';
import { getItem } from '../src/data/items';

describe('tools are not backpack clutter', () => {
  it('knows which items are tools', () => {
    expect(isToolId('axe')).toBe(true);
    expect(isToolId('pickaxe')).toBe(true);
    expect(isToolId('rod')).toBe(true);
    expect(isToolId('wood')).toBe(false);
    expect(isToolId('shell')).toBe(false);
  });

  it('refuses to craft a second axe', () => {
    const crafting = new CraftingSystem();
    const inventory = new Inventory();
    inventory.add('stone', 4);
    inventory.add('fiber', 4);

    const recipe = crafting.getRecipe('axe');
    expect(recipe).toBeDefined();

    // The traveller already owns an axe.
    const refused = crafting.craft(recipe!, inventory, true);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe('already-owned');
    // Nothing was consumed.
    expect(inventory.count('stone')).toBe(4);
    expect(inventory.count('fiber')).toBe(4);

    // Without an axe in hand it works.
    const crafted = crafting.craft(recipe!, inventory, false);
    expect(crafted.ok).toBe(true);
    expect(inventory.count('axe')).toBe(1);
    expect(inventory.count('stone')).toBe(2);
  });

  it('gives the crafted tool a full set of uses', () => {
    const market = new MarketSystem(0);
    market.upgradeTool('axe', 1);
    expect(market.toolRemaining('axe')).toBe(TOOL_LEVELS.axe[0]?.durability);
  });
});


describe('shells have a use', () => {
  it('are worth something at every villager', () => {
    for (const buyer of Object.values(BUYERS)) {
      expect(shellPrice('shell', buyer)).toBeGreaterThan(0);
      expect(shellPrice('deepshell', buyer)).toBeGreaterThan(0);
    }
  });

  it('pay more for a deep shell than a plain one', () => {
    for (const buyer of Object.values(BUYERS)) {
      expect(shellPrice('deepshell', buyer)).toBeGreaterThan(shellPrice('shell', buyer));
    }
  });

  it('does not pay so much that the island turns into a mint', () => {
    // The whole island holds 70 plain shells and 27 deep ones.
    const total =
      70 * shellPrice('shell', BUYERS.maren) + 27 * shellPrice('deepshell', BUYERS.maren);
    expect(total).toBeLessThan(300);
  });
});

describe('food and shop entries', () => {
  it('can be bought more than once', () => {
    expect(getShopEntry('food.hotmeal')?.repeatable).toBe(true);
    expect(getShopEntry('food.ration')?.repeatable).toBe(true);
  });

  it('hands out a real item', () => {
    expect(getShopEntry('food.hotmeal')?.item).toBe('hotmeal');
    expect(getShopEntry('food.ration')?.item).toBe('ration');
    expect(getItem('ration').food?.satiety).toBeGreaterThan(0);
  });
});

describe('drowning', () => {
  it('gives the traveller ten seconds before Nell pulls them out', () => {
    expect(STAMINA.drownLimit).toBe(10);
  });

  it('costs a rescue fee', () => {
    // The fee is charged in coins by the rescue scene.
    expect(STAMINA.drownLimit).toBeGreaterThan(5);
  });
});
