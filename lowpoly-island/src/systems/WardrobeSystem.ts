/**
 * The wardrobe: clothing the player owns, and the bonuses it gives.
 *
 * Pure logic. Buying happens in the shop (handled by the game), this class
 * only keeps track of what is owned and works out the totals.
 */

import { CLOTHING, getClothing, totalBonuses, type ClothingBonus } from '../data/clothing';

export class WardrobeSystem {
  private owned = new Set<string>();

  owns(id: string): boolean {
    return this.owned.has(id);
  }

  /** Ids of everything owned, in a stable order. */
  list(): string[] {
    return CLOTHING.filter((item) => this.owned.has(item.id)).map((item) => item.id);
  }

  /** Everything the player owns, with its definition. */
  items(): typeof CLOTHING[number][] {
    return CLOTHING.filter((item) => this.owned.has(item.id));
  }

  /** Adds a piece of clothing. */
  own(id: string): boolean {
    if (!getClothing(id)) return false;
    this.owned.add(id);
    return true;
  }

  /** True when the player owns a swimsuit (or another swimming garment). */
  get canSwim(): boolean {
    return totalBonuses(this.list()).swimsuit === true;
  }

  /** The combined bonuses of everything owned. */
  bonuses(): ClothingBonus {
    return totalBonuses(this.list());
  }

  /** The cozy bonus of everything owned. */
  get cozy(): number {
    return this.bonuses().cozy ?? 0;
  }

  toJSON(): { owned: string[] } {
    return { owned: this.list() };
  }

  load(data: unknown): void {
    this.owned.clear();
    if (!data || typeof data !== 'object') return;
    const owned = (data as { owned?: unknown }).owned;
    if (!Array.isArray(owned)) return;
    for (const id of owned) {
      if (typeof id === 'string' && getClothing(id)) this.owned.add(id);
    }
  }
}
