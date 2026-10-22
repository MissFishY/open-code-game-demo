/**
 * The chest at home.
 *
 * The backpack is meant to be small, so there has to be somewhere to put the
 * things you have gathered but do not need right now. The chest is that
 * somewhere: it lives in your hut, it holds more than the backpack does, and
 * nothing in it is ever lost.
 *
 * Pure logic, unit tested.
 */

import { INVENTORY } from '../config';

export interface StorageEntry {
  id: string;
  count: number;
}

export class StorageSystem {
  private items = new Map<string, number>();

  constructor(
    readonly maxSlots: number = 24,
    private readonly maxStack: number = INVENTORY.maxStack,
  ) {}

  /** How many of `id` are in the chest. */
  count(id: string): number {
    return this.items.get(id) ?? 0;
  }

  /** True when the chest holds at least `qty` of `id`. */
  has(id: string, qty = 1): boolean {
    return this.count(id) >= qty;
  }

  /** True when a *new* kind of item would still fit. */
  get hasRoomForNewItems(): boolean {
    return this.slotsUsed < this.maxSlots;
  }

  /** True when the chest can take `qty` more of `id`. */
  canAccept(id: string, qty = 1): boolean {
    const current = this.count(id);
    if (current > 0) return current + qty <= this.maxStack;
    return this.hasRoomForNewItems && qty <= this.maxStack;
  }

  /**
   * Puts items into the chest.
   * @returns how many were actually taken.
   */
  add(id: string, qty = 1): number {
    if (qty <= 0) return 0;
    const current = this.count(id);
    if (current === 0 && !this.hasRoomForNewItems) return 0;
    const room = this.maxStack - current;
    const taken = Math.min(room, qty);
    if (taken <= 0) return 0;
    this.items.set(id, current + taken);
    return taken;
  }

  /**
   * Takes items out of the chest.
   * @returns how many were actually removed.
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

  /** Total number of items in the chest. */
  get total(): number {
    let sum = 0;
    for (const count of this.items.values()) sum += count;
    return sum;
  }

  /** How many different kinds of item the chest holds. */
  get slotsUsed(): number {
    let slots = 0;
    for (const count of this.items.values()) if (count > 0) slots++;
    return slots;
  }

  get isEmpty(): boolean {
    return this.total === 0;
  }

  /** Everything in the chest, sorted by item id. */
  entries(): StorageEntry[] {
    return [...this.items.entries()]
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  toJSON(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, count] of this.items) {
      if (count > 0) out[id] = count;
    }
    return out;
  }

  load(data: unknown): void {
    this.items.clear();
    if (!data || typeof data !== 'object') return;
    for (const [id, value] of Object.entries(data as Record<string, unknown>)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const count = Math.max(0, Math.min(this.maxStack, Math.floor(value)));
      if (count > 0) this.items.set(id, count);
    }
  }
}
