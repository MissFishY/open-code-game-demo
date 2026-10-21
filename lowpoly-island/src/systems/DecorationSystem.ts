/**
 * Decoration state — which decoration stands in which slot, how cosy the
 * place is, and which coziness tiers have already been claimed.
 *
 * Pure logic, no Three.js and no DOM.
 */

import {
  COZINESS_TIERS,
  DECORATION_SLOTS,
  getDecoration,
  getSlot,
  type CozinessTier,
} from '../data/decorations';
import { Inventory } from './InventorySystem';
import type { ItemAmount } from '../data/recipes';

export interface DecorationPlacement {
  slot: string;
  type: string;
}

/** A coziness tier whose gift was just handed out. */
export interface ClaimedTier {
  tier: CozinessTier;
  items: { item: string; qty: number }[];
}

export class DecorationSystem {
  private placements = new Map<string, DecorationPlacement>();
  /** Tiers whose gift has already been handed out. */
  private claimed = new Set<number>();

  /** The decoration standing in a slot, if any. */
  get(slotId: string): DecorationPlacement | undefined {
    return this.placements.get(slotId);
  }

  /** All placed decorations. */
  list(): DecorationPlacement[] {
    return [...this.placements.values()];
  }

  get count(): number {
    return this.placements.size;
  }

  /** Total coziness of everything that is placed. */
  get coziness(): number {
    let total = 0;
    for (const placement of this.placements.values()) {
      total += getDecoration(placement.type)?.coziness ?? 0;
    }
    return total;
  }

  /** The highest coziness tier the player has reached. */
  get tier(): number {
    const value = this.coziness;
    let reached = 0;
    for (const tier of COZINESS_TIERS) {
      if (value >= tier.at) reached = tier.at;
    }
    return reached;
  }

  /** The next tier that has not been reached yet. */
  get nextTier(): CozinessTier | null {
    const value = this.coziness;
    return COZINESS_TIERS.find((tier) => value < tier.at) ?? null;
  }

  /** The title earned at the current tier. */
  get title(): string {
    const value = this.tier;
    return COZINESS_TIERS.find((tier) => tier.at === value)?.title ?? '属于你自己的地方';
  }

  /** True when the slot exists, is free and accepts this decoration type. */
  canPlace(slotId: string, typeId: string): boolean {
    const slot = getSlot(slotId);
    if (!slot) return false;
    if (this.placements.has(slotId)) return false;
    if (!slot.accepts.includes(typeId)) return false;
    return getDecoration(typeId) !== undefined;
  }

  /** The first free slot that accepts this decoration type. */
  findSlotFor(typeId: string): string | null {
    for (const slot of DECORATION_SLOTS) {
      if (this.canPlace(slot.id, typeId)) return slot.id;
    }
    return null;
  }

  /**
   * Places a decoration, taking the item out of the backpack.
   * @returns false when the slot is taken, the type does not fit or the
   *          player does not own the item.
   */
  place(slotId: string, typeId: string, inventory: Inventory): boolean {
    if (!this.canPlace(slotId, typeId)) return false;
    const decoration = getDecoration(typeId);
    if (!decoration) return false;
    if (!inventory.has(decoration.itemId, 1)) return false;

    inventory.remove(decoration.itemId, 1);
    this.placements.set(slotId, { slot: slotId, type: typeId });
    return true;
  }

  /**
   * Takes a decoration back, returning the item to the backpack.
   */
  remove(slotId: string, inventory: Inventory): boolean {
    const placement = this.placements.get(slotId);
    if (!placement) return false;
    const decoration = getDecoration(placement.type);
    if (!decoration) return false;

    this.placements.delete(slotId);
    inventory.add(decoration.itemId, 1);
    return true;
  }

  /**
   * Hands out the gift for every tier the player has newly reached.
   * A tier can only be claimed once.
   */
  claimNewTiers(inventory: Inventory): ClaimedTier[] {
    const claimed: ClaimedTier[] = [];
    for (const tier of COZINESS_TIERS) {
      if (this.coziness < tier.at) continue;
      if (this.claimed.has(tier.at)) continue;
      this.claimed.add(tier.at);

      const items: ItemAmount[] = [];
      for (const gift of tier.gift) {
        const given = inventory.add(gift.item, gift.qty);
        if (given > 0) items.push({ item: gift.item, qty: given });
      }
      claimed.push({ tier, items });
    }
    return claimed;
  }

  /** True when the gift for this tier has already been claimed. */
  isTierClaimed(tierAt: number): boolean {
    return this.claimed.has(tierAt);
  }

  /** Marks a tier as claimed. */
  markTierClaimed(tierAt: number): void {
    this.claimed.add(tierAt);
  }

  toJSON(): { placements: DecorationPlacement[]; claimed: number[] } {
    return {
      placements: [...this.placements.values()],
      claimed: [...this.claimed],
    };
  }

  load(data: unknown): void {
    this.placements.clear();
    this.claimed.clear();
    if (!data || typeof data !== 'object') return;

    const placements = (data as { placements?: unknown }).placements;
    if (Array.isArray(placements)) {
      for (const entry of placements) {
        if (!entry || typeof entry !== 'object') continue;
        const slot = (entry as { slot?: unknown }).slot;
        const type = (entry as { type?: unknown }).type;
        if (typeof slot !== 'string' || typeof type !== 'string') continue;
        if (!getSlot(slot) || !getDecoration(type)) continue;
        if (!getSlot(slot)?.accepts.includes(type)) continue;
        this.placements.set(slot, { slot, type });
      }
    }

    const claimed = (data as { claimed?: unknown }).claimed;
    if (Array.isArray(claimed)) {
      for (const value of claimed) {
        if (typeof value === 'number') this.claimed.add(value);
      }
    }
  }
}
