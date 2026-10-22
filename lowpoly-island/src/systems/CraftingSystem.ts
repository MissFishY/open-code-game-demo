/**
 * Crafting logic.
 *
 * Pure — no Three.js, no DOM — so the whole recipe system is unit tested.
 */

import type { ItemAmount, Recipe } from '../data/recipes';
import { RECIPES } from '../data/recipes';
import { Inventory } from './InventorySystem';

export interface RequirementProgress {
  item: string;
  /** How many are needed. */
  qty: number;
  /** How many the player currently carries. */
  have: number;
  /** True when `have >= qty`. */
  satisfied: boolean;
}

export interface CraftResult {
  ok: boolean;
  /** Items that were consumed. */
  consumed: ItemAmount[];
  /** Items that were produced. */
  produced: ItemAmount[];
  /** Set when the craft failed because something was missing. */
  reason?: 'missing-materials' | 'inventory-full' | 'unknown-recipe' | 'already-owned';
}

export class CraftingSystem {
  /** All recipes the player knows. */
  readonly recipes: readonly Recipe[] = RECIPES;

  getRecipe(id: string): Recipe | undefined {
    return this.recipes.find((recipe) => recipe.id === id);
  }

  /** Requirement progress for a recipe, used to render the UI. */
  progress(recipe: Recipe, inventory: Inventory): RequirementProgress[] {
    return recipe.inputs.map((input) => {
      const have = inventory.count(input.item);
      return {
        item: input.item,
        qty: input.qty,
        have,
        satisfied: have >= input.qty,
      };
    });
  }

  /** True when the player has every input for the recipe. */
  canCraft(recipe: Recipe, inventory: Inventory): boolean {
    return recipe.inputs.every((input) => inventory.has(input.item, input.qty));
  }

  /**
   * Crafts a recipe, consuming the inputs and producing the output.
   * Nothing happens when the materials are missing.
   *
   * @param ownedTool true when the recipe makes a tool the traveller already
   *   has. A second axe would quietly repair the first one, so it is refused.
   */
  craft(recipe: Recipe, inventory: Inventory, ownedTool = false): CraftResult {
    const result: CraftResult = { ok: false, consumed: [], produced: [] };

    if (ownedTool) {
      result.reason = 'already-owned';
      return result;
    }

    if (!this.canCraft(recipe, inventory)) {
      result.reason = 'missing-materials';
      return result;
    }

    // Check there is room before consuming anything.
    if (inventory.count(recipe.output.item) >= inventory.maxStack) {
      result.reason = 'inventory-full';
      return result;
    }

    for (const input of recipe.inputs) {
      const taken = inventory.remove(input.item, input.qty);
      result.consumed.push({ item: input.item, qty: taken });
    }

    const made = inventory.add(recipe.output.item, recipe.output.qty);
    result.produced.push({ item: recipe.output.item, qty: made });
    result.ok = made > 0;
    if (!result.ok) result.reason = 'inventory-full';
    return result;
  }
}
