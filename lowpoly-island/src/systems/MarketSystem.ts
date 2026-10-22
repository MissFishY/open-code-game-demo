/**
 * Buying and selling.
 *
 * Coins are the island's currency: you get them by selling fish, and you
 * spend them in the villagers' shops, on tool upgrades, food, clothes and
 * hints. Pure logic.
 */

import { Inventory } from './InventorySystem';
import { ECONOMY } from '../config';
import { getFish } from '../data/fish';
import { getClothing } from '../data/clothing';
import {
  DAILY_FISH_LIMIT,
  TOOL_LEVELS,
  fishPrice,
  getShopEntry,
  type BuyerProfile,
  type ShopEntry,
} from '../data/shop';
import type { NpcId } from './TrustSystem';

export type ToolId = 'axe' | 'pickaxe' | 'rod';

export interface SellResult {
  ok: boolean;
  /** How many fish were sold. */
  qty: number;
  /** How many coins they paid. */
  coins: number;
}

export interface BuyResult {
  ok: boolean;
  spent: number;
  reason?: 'too-expensive' | 'missing-materials' | 'already-owned' | 'unknown';
}

export class MarketSystem {
  private _coins: number;
  private toolLevels: Record<ToolId, number> = { axe: 0, pickaxe: 0, rod: 0 };
  /** Remaining uses before each tool breaks. */
  private toolWear: Record<ToolId, number> = { axe: 0, pickaxe: 0, rod: 0 };
  private bought = new Set<string>();

  constructor(private readonly startingCoins: number = ECONOMY.startingCoins) {
    this._coins = startingCoins;
  }

  /** Puts the wallet and the tools back to their starting state. */
  reset(): void {
    this._coins = this.startingCoins;
    this.toolLevels = { axe: 0, pickaxe: 0, rod: 0 };
    this.toolWear = { axe: 0, pickaxe: 0, rod: 0 };
    this.bought.clear();
  }

  get coins(): number {
    return this._coins;
  }

  /** Adds coins (quest payouts, selling). */
  addCoins(amount: number): void {
    if (!Number.isFinite(amount)) return;
    this._coins = Math.max(0, this._coins + Math.floor(amount));
  }

  /** Spends coins. Returns false when there are not enough. */
  spend(amount: number): boolean {
    if (amount > this._coins) return false;
    this._coins -= amount;
    return true;
  }

  // --- Selling ------------------------------------------------------------

  /** How much a villager would pay for one of this fish right now. */
  priceOf(fishId: string, buyer: BuyerProfile): number {
    const fish = getFish(fishId);
    if (!fish) return 0;
    return fishPrice(fishId, buyer, fish.value);
  }

  /** Sells fish from the backpack. */
  sellFish(
    fishId: string,
    qty: number,
    inventory: Inventory,
    buyer: BuyerProfile,
  ): SellResult {
    const have = inventory.count(fishId);
    const left = this.fishLeftToday(buyer.npc);
    const amount = Math.min(have, Math.max(0, qty), left);
    if (amount <= 0) return { ok: false, qty: 0, coins: 0 };

    const price = this.priceOf(fishId, buyer);
    inventory.remove(fishId, amount);
    this.soldToday[buyer.npc] = (this.soldToday[buyer.npc] ?? 0) + amount;
    const coins = price * amount;
    this.addCoins(coins);
    return { ok: true, qty: amount, coins };
  }

  /**
   * The day the market last reset. Villagers only take so many fish a day,
   * so a big haul has to wait for tomorrow.
   */
  private day = 1;
  private soldToday: Record<string, number> = {};

  /** Tells the market which day it is, so the counters can reset. */
  setDay(day: number): void {
    if (day === this.day) return;
    this.day = day;
    this.soldToday = {};
  }

  /** How many more fish this villager will buy today. */
  fishLeftToday(npc: NpcId): number {
    return Math.max(0, DAILY_FISH_LIMIT - (this.soldToday[npc] ?? 0));
  }

  // --- Buying -------------------------------------------------------------

  /** True when the player can afford the entry. */
  canBuy(entry: ShopEntry, inventory: Inventory): boolean {
    if (this.bought.has(entry.id) && !entry.repeatable) return false;
    if (this._coins < entry.cost) return false;
    const materials = entry.materials ?? [];
    return materials.every((material) => inventory.has(material.item, material.qty));
  }

  /**
   * Buys a shop entry.
   * @returns what was bought, so the game can apply it (own the clothing,
   *          raise the tool level, reveal the hint, ...).
   */
  buy(entry: ShopEntry, inventory: Inventory): BuyResult {
    if (this.bought.has(entry.id) && !entry.repeatable) {
      return { ok: false, spent: 0, reason: 'already-owned' };
    }
    if (this._coins < entry.cost) return { ok: false, spent: 0, reason: 'too-expensive' };

    const materials = entry.materials ?? [];
    if (!materials.every((material) => inventory.has(material.item, material.qty))) {
      return { ok: false, spent: 0, reason: 'missing-materials' };
    }

    for (const material of materials) {
      inventory.remove(material.item, material.qty);
    }
    this.spend(entry.cost);
    if (!entry.repeatable) this.bought.add(entry.id);
    return { ok: true, spent: entry.cost };
  }

  /** True when the player already bought this entry. */
  hasBought(entryId: string): boolean {
    return this.bought.has(entryId);
  }

  // --- Tools --------------------------------------------------------------

  /** The level of a tool (0 = not owned). */
  toolLevel(tool: ToolId): number {
    return this.toolLevels[tool];
  }

  /** The extra resource a tool gives per swing. */
  toolBonus(tool: ToolId): number {
    const level = this.toolLevels[tool];
    if (level <= 0) return 0;
    const definition = TOOL_LEVELS[tool][level - 1];
    return definition?.bonus ?? 0;
  }

  /**
   * Raises a tool to a level and gives it a fresh set of uses.
   *
   * A tool that is already better than the one you are given keeps its wear —
   * otherwise handing in a quest that rewards a level 1 axe would quietly
   * repair a level 3 one for free.
   */
  upgradeTool(tool: ToolId, level: number): void {
    if (level <= this.toolLevels[tool]) return;
    this.toolLevels[tool] = level;
    this.toolWear[tool] = this.toolDurability(tool);
  }

  /** How many uses a tool of its current level has left. */
  toolRemaining(tool: ToolId): number {
    return this.toolWear[tool];
  }

  /** How many uses a tool of its current level starts with. */
  toolDurability(tool: ToolId): number {
    const level = this.toolLevels[tool];
    if (level <= 0) return 0;
    const definition = TOOL_LEVELS[tool][level - 1];
    return definition?.durability ?? 0;
  }

  /**
   * Uses the tool once. Wears it down; when it runs out the tool breaks and
   * the player is back to bare hands.
   * @returns false when the tool just broke.
   */
  useTool(tool: ToolId): boolean {
    if (this.toolLevels[tool] <= 0) return true;
    this.toolWear[tool] = Math.max(0, this.toolWear[tool] - 1);
    if (this.toolWear[tool] > 0) return true;

    // The tool snapped.
    this.toolLevels[tool] = 0;
    this.toolWear[tool] = 0;
    return false;
  }

  /**
   * The stamina one swing costs.
   * @param bareCost what the swing costs with bare hands.
   */
  toolSwingCost(tool: ToolId, bareCost: number): number {
    const level = this.toolLevels[tool];
    if (level <= 0) return bareCost;
    return TOOL_LEVELS[tool][level - 1]?.staminaCost ?? bareCost;
  }

  /** Wears a tool back to full. */
  repairTool(tool: ToolId): void {
    if (this.toolLevels[tool] <= 0) return;
    this.toolWear[tool] = this.toolDurability(tool);
  }

  /** Coins you get back for selling the tool. */
  toolRefund(tool: ToolId): number {
    const level = this.toolLevels[tool];
    if (level <= 0) return 0;
    return TOOL_LEVELS[tool][level - 1]?.refund ?? 0;
  }

  /** Sells a tool and returns the coins it was worth. */
  sellTool(tool: ToolId): number {
    const refund = this.toolRefund(tool);
    if (refund <= 0) return 0;
    this.toolLevels[tool] = 0;
    this.toolWear[tool] = 0;
    this.addCoins(refund);
    return refund;
  }

  /** The shop entry that upgrades a tool to its next level. */
  nextUpgrade(tool: ToolId): ShopEntry | undefined {
    const current = this.toolLevels[tool];
    const next = TOOL_LEVELS[tool][current];
    if (!next || current === 0) {
      // Not owned yet — the base tool is bought as a plain item.
      return undefined;
    }
    return getShopEntry(`tool.${tool}.${next.level}`);
  }

  toJSON(): {
    coins: number;
    tools: Record<ToolId, number>;
    wear: Record<ToolId, number>;
    bought: string[];
  } {
    return {
      coins: this._coins,
      tools: { ...this.toolLevels },
      wear: { ...this.toolWear },
      bought: [...this.bought],
    };
  }

  load(data: unknown): void {
    this.reset();
    if (!data || typeof data !== 'object') return;
    const raw = data as Record<string, unknown>;

    if (typeof raw.coins === 'number' && Number.isFinite(raw.coins)) {
      this._coins = Math.max(0, Math.floor(raw.coins));
    }

    const tools = raw.tools as Record<string, unknown> | undefined;
    if (tools && typeof tools === 'object') {
      for (const tool of ['axe', 'pickaxe', 'rod'] as ToolId[]) {
        const value = tools[tool];
        if (typeof value === 'number' && Number.isFinite(value)) {
          this.toolLevels[tool] = Math.max(0, Math.min(3, Math.floor(value)));
        }
      }
    }

    const wear = raw.wear as Record<string, unknown> | undefined;
    if (wear && typeof wear === 'object') {
      for (const tool of ['axe', 'pickaxe', 'rod'] as ToolId[]) {
        const value = wear[tool];
        if (typeof value === 'number' && Number.isFinite(value)) {
          this.toolWear[tool] = Math.max(0, Math.floor(value));
        }
      }
    }
    // An old save without wear data gets a full set of uses.
    for (const tool of ['axe', 'pickaxe', 'rod'] as ToolId[]) {
      if (this.toolLevels[tool] > 0 && this.toolWear[tool] === 0) {
        this.toolWear[tool] = this.toolDurability(tool);
      }
    }

    const bought = raw.bought;
    if (Array.isArray(bought)) {
      for (const id of bought) {
        if (typeof id === 'string') this.bought.add(id);
      }
    }
  }

  /** True when the player has bought this clothing item. */
  ownsClothing(id: string): boolean {
    return this.bought.has(`clothing.${id}`) || getClothing(id) !== undefined;
  }
}
