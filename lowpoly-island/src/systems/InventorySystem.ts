/**
 * Inventory / backpack.
 *
 * Deliberately free of Three.js and DOM references so it can be unit tested.
 * Stores a count per item id; each item type has its own stack limit.
 */

import { INVENTORY } from '../config';

export interface InventoryEntry {
  id: string;
  count: number;
}

export class Inventory {
  private items = new Map<string, number>();

  constructor(readonly maxStack: number = INVENTORY.maxStack) {}

  /** Number of `id` currently carried. */
  count(id: string): number {
    return this.items.get(id) ?? 0;
  }

  /**
   * Total number of items from a group of ids — used for requirements like
   * "12 fish of any kind".
   */
  countCategory(ids: readonly string[]): number {
    let total = 0;
    for (const id of ids) total += this.count(id);
    return total;
  }

  /** True when at least `qty` of `id` is carried. */
  has(id: string, qty = 1): boolean {
    return this.count(id) >= qty;
  }

  /** True when the backpack holds nothing at all. */
  get isEmpty(): boolean {
    for (const count of this.items.values()) {
      if (count > 0) return false;
    }
    return true;
  }

  /** Total number of items across all stacks. */
  get total(): number {
    let sum = 0;
    for (const count of this.items.values()) sum += count;
    return sum;
  }

  /** Number of distinct item types carried. */
  get slotsUsed(): number {
    let slots = 0;
    for (const count of this.items.values()) {
      if (count > 0) slots++;
    }
    return slots;
  }

  /**
   * Adds up to `qty` items.
   * @returns how many items were actually accepted (the rest were dropped
   *          because the stack was full).
   */
  add(id: string, qty = 1): number {
    if (qty <= 0) return 0;
    const current = this.count(id);
    const room = Math.max(0, this.maxStack - current);
    const taken = Math.min(room, qty);
    if (taken <= 0) return 0;
    this.items.set(id, current + taken);
    return taken;
  }

  /**
   * Removes up to `qty` items.
   * @returns how many items were actually removed.
   */
  remove(id: string, qty = 1): number {
    if (qty <= 0) return 0;
    const current = this.count(id);
    const taken = Math.min(current, qty);
    if (taken <= 0) return 0;
    const left = current - taken;
    if (left <= 0) this.items.delete(id);
    else this.items.set(id, left);
    return taken;
  }

  /** Removes items only if enough are present. */
  tryConsume(id: string, qty = 1): boolean {
    if (!this.has(id, qty)) return false;
    this.remove(id, qty);
    return true;
  }

  /** Clears the backpack. */
  clear(): void {
    this.items.clear();
  }

  /** Snapshot of the backpack contents, sorted by item id. */
  entries(): InventoryEntry[] {
    return [...this.items.entries()]
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Serializable representation. */
  toJSON(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, count] of this.items) {
      if (count > 0) out[id] = count;
    }
    return out;
  }

  /** Restores from a serialized representation, ignoring malformed values. */
  load(data: unknown): void {
    this.items.clear();
    if (!data || typeof data !== 'object') return;
    for (const [id, value] of Object.entries(data as Record<string, unknown>)) {
      const count = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
      if (count <= 0) continue;
      this.items.set(id, Math.min(count, this.maxStack));
    }
  }
}
