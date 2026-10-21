/**
 * The shops of the three villagers.
 *
 * Each one has a different trade:
 *
 *   Tallis — tools and sturdy gear. He lends you his old tools for free and
 *            is the only one who can improve them.
 *   Nell   — food and practical clothes, including the swimsuit.
 *   Maren  — hints about the island, and a few strange little charms.
 *
 * They also buy fish, but at different rates and each of them is after one
 * particular species.
 */

import type { NpcId } from '../systems/TrustSystem';
import { CLOTHING } from './clothing';
import { HINTS } from './dialogue';

export type ShopKind = 'clothing' | 'food' | 'hint' | 'tool';

export interface ShopEntry {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Price in coins. */
  cost: number;
  kind: ShopKind;
  /** Which villager's tab this appears under. */
  seller: NpcId;
  /** For tool upgrades. */
  toolId?: 'axe' | 'pickaxe' | 'rod';
  /** The level this upgrade reaches. */
  level?: number;
  /** Materials needed on top of the coins. */
  materials?: { item: string; qty: number }[];
  /** A gift — the shopkeeper lends it to you for nothing. */
  gift?: boolean;
}

export interface ToolLevel {
  level: number;
  label: string;
  /** Extra resource gained per swing (on top of the base 1). */
  bonus: number;
  /** How many swings before the tool breaks. */
  durability: number;
  /** Coins you get back if you sell the tool. */
  refund: number;
  cost: number;
  materials: { item: string; qty: number }[];
}

const TOOL_NAMES: Record<'axe' | 'pickaxe' | 'rod', string> = {
  axe: '斧',
  pickaxe: '镐',
  rod: '鱼竿',
};

/** The upgrade path of each tool. Level 1 is the plain tool. */
export const TOOL_LEVELS: Record<'axe' | 'pickaxe' | 'rod', ToolLevel[]> = {
  axe: [
    { level: 1, label: '石斧', bonus: 2, durability: 30, refund: 4, cost: 0, materials: [] },
    { level: 2, label: '磨石斧', bonus: 5, durability: 80, refund: 14, cost: 20, materials: [{ item: 'plank', qty: 2 }] },
    { level: 3, label: '护林员之斧', bonus: 9, durability: 200, refund: 36, cost: 48, materials: [{ item: 'plank', qty: 4 }, { item: 'rope', qty: 2 }] },
  ],
  pickaxe: [
    { level: 1, label: '石镐', bonus: 2, durability: 30, refund: 4, cost: 0, materials: [] },
    { level: 2, label: '重石镐', bonus: 5, durability: 80, refund: 14, cost: 20, materials: [{ item: 'plank', qty: 2 }] },
    { level: 3, label: '矿工之镐', bonus: 9, durability: 200, refund: 36, cost: 48, materials: [{ item: 'plank', qty: 4 }, { item: 'rope', qty: 2 }] },
  ],
  rod: [
    { level: 1, label: '竹鱼竿', bonus: 0, durability: 25, refund: 6, cost: 0, materials: [] },
    { level: 2, label: '韧鱼竿', bonus: 0, durability: 70, refund: 18, cost: 30, materials: [{ item: 'plank', qty: 3 }, { item: 'rope', qty: 2 }] },
    { level: 3, label: '月见鱼竿', bonus: 1, durability: 150, refund: 42, cost: 65, materials: [{ item: 'plank', qty: 5 }, { item: 'rope', qty: 3 }] },
  ],
};

function clothingEntries(seller: NpcId): ShopEntry[] {
  return CLOTHING.filter((item) => item.seller === seller).map((item) => ({
    id: `clothing.${item.id}`,
    name: item.name,
    icon: item.icon,
    description: item.description,
    cost: item.cost,
    kind: 'clothing' as const,
    seller,
  }));
}

function toolEntries(seller: NpcId, tool: 'axe' | 'pickaxe' | 'rod'): ShopEntry[] {
  // Level 1 is either crafted (axe, pickaxe) or lent for free (rod), so the
  // shop only offers the upgrades.
  return TOOL_LEVELS[tool].slice(1).map((level) => ({
    id: `tool.${tool}.${level.level}`,
    name: level.label,
    icon: tool === 'axe' ? '🪓' : tool === 'pickaxe' ? '⛏️' : '🎣',
    description: `把你的${TOOL_NAMES[tool]}升到 ${level.level} 级。`,
    cost: level.cost,
    kind: 'tool' as const,
    seller,
    toolId: tool,
    level: level.level,
    materials: level.materials,
    gift: level.cost === 0,
  }));
}

export const SHOP_ENTRIES: readonly ShopEntry[] = [
  // --- Tallis: tools and sturdy gear -------------------------------------
  ...toolEntries('tallis', 'axe'),
  ...toolEntries('tallis', 'pickaxe'),
  ...toolEntries('tallis', 'rod'),
  // Tallis lends you his old rod. An axe you have to make yourself.
  {
    id: 'tool.rod.1',
    name: '竹鱼竿',
    icon: '🎣',
    description: 'Tallis 借给你的旧鱼竿。拿去用，不要钱。',
    cost: 0,
    kind: 'tool',
    seller: 'tallis',
    toolId: 'rod',
    level: 1,
    gift: true,
  },
  ...clothingEntries('tallis'),

  // --- Nell: food and practical clothes ---------------------------------
  ...clothingEntries('nell'),
  {
    id: 'food.hotmeal',
    name: '热饭',
    icon: '🍲',
    description: '在炉子上热好的鱼汤，能把体力完全灌回来。',
    cost: 6,
    kind: 'food',
    seller: 'nell',
  },
  {
    id: 'food.ration',
    name: '干粮',
    icon: '🍞',
    description: '寡淡，但顶饿。回复一点体力。',
    cost: 3,
    kind: 'food',
    seller: 'nell',
  },

  // --- Maren: hints and strange charms ----------------------------------
  ...clothingEntries('maren'),
  ...HINTS.map((hint) => ({
    id: `hint.${hint.id}`,
    name: hint.title,
    icon: '🔮',
    description: hint.text,
    cost: hint.cost,
    kind: 'hint' as const,
    seller: 'maren' as const,
  })),
];

export function getShopEntry(id: string): ShopEntry | undefined {
  return SHOP_ENTRIES.find((entry) => entry.id === id);
}

/** The entries a given villager offers. */
export function shopFor(seller: NpcId): ShopEntry[] {
  return SHOP_ENTRIES.filter((entry) => entry.seller === seller);
}

/** What a villager pays for fish, and which fish they are after. */
export interface BuyerProfile {
  npc: NpcId;
  /** Fraction of the fish's value they pay. */
  rate: number;
  /** The species they are specifically after — paid at double the rate. */
  wants: string | null;
  /** What they say when they buy something. */
  lines: string[];
}

export const BUYERS: Record<NpcId, BuyerProfile> = {
  tallis: {
    npc: 'tallis',
    rate: 0.6,
    wants: 'perch',
    lines: [
      '鲈鱼。不错——灯塔的灯油烧起来更亮。',
      '行。我给不了多少，但我给得诚实。',
      '鱼。凑合吧。岛不要钱，岛也不需要钱。',
    ],
  },
  nell: {
    npc: 'nell',
    rate: 0.7,
    wants: 'carp',
    lines: [
      '鲤鱼！这个我运到大陆能卖三倍的价。',
      '好分量，好油。今晚木筏能吃顿好的。',
      '我收下。我总是收下——这就是做买卖的样子。',
    ],
  },
  maren: {
    npc: 'maren',
    rate: 0.8,
    wants: 'moonfish',
    lines: [
      '有意思。湖在说话，而你居然没听见。谢谢你替我带上来。',
      '它还是凉的。谢谢你把它带上来。',
      '我付的比这值的多。别问为什么。',
    ],
  },
};

/** The coin value of one fish when sold to a given villager. */
export function fishPrice(
  fishId: string,
  buyer: BuyerProfile,
  baseValue: number,
): number {
  const rate = buyer.wants === fishId ? buyer.rate * 2 : buyer.rate;
  return Math.max(1, Math.round(baseValue * rate));
}
