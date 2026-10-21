/**
 * Building logic — raising structures the player has gathered the parts for.
 *
 * Like the crafting system this is pure logic; the renderer only reacts to
 * the state that lives here.
 */

import type { Blueprint, ItemAmount } from '../data/recipes';
import { BLUEPRINTS } from '../data/recipes';
import { Inventory } from './InventorySystem';

export interface BuildProgress extends ItemAmount {
  have: number;
  satisfied: boolean;
}

export interface BuildResult {
  ok: boolean;
  consumed: ItemAmount[];
  reason?: 'missing-materials' | 'already-built' | 'unknown-blueprint';
}

export class BuildingSystem {
  private built = new Set<string>();

  getBlueprint(id: string): Blueprint | undefined {
    return BLUEPRINTS[id];
  }

  isBuilt(id: string): boolean {
    return this.built.has(id);
  }

  /** Ids of everything the player has finished building. */
  get builtIds(): string[] {
    return [...this.built];
  }

  /** Requirement progress for a blueprint, used to render the UI. */
  progress(blueprint: Blueprint, inventory: Inventory): BuildProgress[] {
    return blueprint.inputs.map((input) => {
      const have = inventory.count(input.item);
      return {
        item: input.item,
        qty: input.qty,
        have,
        satisfied: have >= input.qty,
      };
    });
  }

  /** True when the player has every part for the blueprint. */
  canBuild(blueprint: Blueprint, inventory: Inventory): boolean {
    if (this.built.has(blueprint.id)) return false;
    return blueprint.inputs.every((input) => inventory.has(input.item, input.qty));
  }

  /**
   * Raises a structure, consuming the parts.
   * Nothing happens when something is missing.
   */
  build(blueprint: Blueprint, inventory: Inventory): BuildResult {
    const result: BuildResult = { ok: false, consumed: [] };

    if (this.built.has(blueprint.id)) {
      result.reason = 'already-built';
      return result;
    }
    if (!blueprint.inputs.every((input) => inventory.has(input.item, input.qty))) {
      result.reason = 'missing-materials';
      return result;
    }

    for (const input of blueprint.inputs) {
      const taken = inventory.remove(input.item, input.qty);
      result.consumed.push({ item: input.item, qty: taken });
    }

    this.built.add(blueprint.id);
    result.ok = true;
    return result;
  }

  toJSON(): { built: string[] } {
    return { built: [...this.built] };
  }

  load(data: unknown): void {
    this.built.clear();
    if (!data || typeof data !== 'object') return;
    const built = (data as { built?: unknown }).built;
    if (!Array.isArray(built)) return;
    for (const id of built) {
      if (typeof id === 'string' && id in BLUEPRINTS) this.built.add(id);
    }
  }
}
