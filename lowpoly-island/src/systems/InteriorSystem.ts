/**
 * The inside of the hut: expansions and furniture.
 *
 * Pure logic — the game moves the models, this class decides what goes where.
 */

import {
  EXPANSIONS,
  FURNITURE,
  availableSlots,
  getExpansion,
  getFurniture,
  type ExpansionDef,
  type FurnitureDef,
  type FurnitureSlot,
} from '../data/interior';
import { Inventory } from './InventorySystem';

export class InteriorSystem {
  /** slot -> furniture id */
  private furniture = new Map<FurnitureSlot, string>();
  private expansions = new Set<ExpansionId>();

  // --- Expansions ---------------------------------------------------------

  isExpanded(id: string): boolean {
    return this.expansions.has(id as ExpansionId);
  }

  get expandedIds(): string[] {
    return [...this.expansions];
  }

  /** True when the player has enough for the expansion. */
  canExpand(
    definition: ExpansionDef,
    inventory: Inventory,
    coins: number,
  ): boolean {
    if (this.isExpanded(definition.id)) return false;
    if (coins < definition.cost) return false;
    return definition.materials.every(
      (material) => inventory.has(material.item, material.qty),
    );
  }

  /** Raises the expansion, taking the materials and the coins. */
  expand(
    definition: ExpansionDef,
    inventory: Inventory,
    coins: number,
  ): { ok: boolean; spent: number } {
    if (!this.canExpand(definition, inventory, coins)) return { ok: false, spent: 0 };
    for (const material of definition.materials) {
      inventory.remove(material.item, material.qty);
    }
    this.expansions.add(definition.id);
    return { ok: true, spent: definition.cost };
  }

  // --- Furniture ----------------------------------------------------------

  /** The slots the player has open. */
  slots(): FurnitureSlot[] {
    return availableSlots(this.expandedIds);
  }

  /** The furniture standing in a slot. */
  get(slot: FurnitureSlot): string | undefined {
    return this.furniture.get(slot);
  }

  /** Everything placed, as slot -> furniture id. */
  list(): { slot: FurnitureSlot; id: string }[] {
    return [...this.furniture.entries()].map(([slot, id]) => ({ slot, id }));
  }

  /** True when the furniture fits in the slot and the slot is free. */
  canPlace(slot: FurnitureSlot, furnitureId: string): boolean {
    const definition = getFurniture(furnitureId);
    if (!definition) return false;
    if (!this.slots().includes(slot)) return false;
    if (this.furniture.has(slot)) return false;
    return definition.slots.includes(slot);
  }

  /** Places a piece of furniture. */
  place(slot: FurnitureSlot, furnitureId: string): boolean {
    if (!this.canPlace(slot, furnitureId)) return false;
    this.furniture.set(slot, furnitureId);
    return true;
  }

  /** Takes a piece of furniture back. */
  remove(slot: FurnitureSlot): string | undefined {
    const id = this.furniture.get(slot);
    if (!id) return undefined;
    this.furniture.delete(slot);
    return id;
  }

  /** The first free slot a piece of furniture fits in. */
  findSlotFor(furnitureId: string): FurnitureSlot | null {
    const definition = getFurniture(furnitureId);
    if (!definition) return null;
    for (const slot of this.slots()) {
      if (definition.slots.includes(slot) && !this.furniture.has(slot)) return slot;
    }
    return null;
  }

  // --- Cozysiness ---------------------------------------------------------

  /** Cozysiness from the expansions and the furniture. */
  get cozy(): number {
    let total = 0;
    for (const id of this.expansions) {
      total += getExpansion(id)?.cozy ?? 0;
    }
    for (const id of this.furniture.values()) {
      total += getFurniture(id)?.cozy ?? 0;
    }
    return total;
  }

  /** Everything that could still be bought. */
  get availableFurniture(): readonly FurnitureDef[] {
    return FURNITURE;
  }

  get availableExpansions(): readonly ExpansionDef[] {
    return EXPANSIONS;
  }

  toJSON(): { furniture: { slot: FurnitureSlot; id: string }[]; expansions: string[] } {
    return {
      furniture: this.list(),
      expansions: this.expandedIds,
    };
  }

  load(data: unknown): void {
    this.furniture.clear();
    this.expansions.clear();
    if (!data || typeof data !== 'object') return;

    const expansions = (data as { expansions?: unknown }).expansions;
    if (Array.isArray(expansions)) {
      for (const id of expansions) {
        if (typeof id === 'string' && getExpansion(id)) {
          this.expansions.add(id as ExpansionId);
        }
      }
    }

    const furniture = (data as { furniture?: unknown }).furniture;
    if (Array.isArray(furniture)) {
      for (const entry of furniture) {
        if (!entry || typeof entry !== 'object') continue;
        const slot = (entry as { slot?: unknown }).slot;
        const id = (entry as { id?: unknown }).id;
        if (typeof slot !== 'string' || typeof id !== 'string') continue;
        const definition = getFurniture(id);
        if (!definition) continue;
        if (!definition.slots.includes(slot as FurnitureSlot)) continue;
        if (!this.slots().includes(slot as FurnitureSlot)) continue;
        this.furniture.set(slot as FurnitureSlot, id);
      }
    }
  }
}

type ExpansionId = (typeof EXPANSIONS)[number]['id'];
