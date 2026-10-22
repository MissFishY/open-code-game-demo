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
  /** For food: the item you receive when you buy it. */
  item?: string;
  /** Food can be bought over and over; clothes and tools cannot. */
  repeatable?: boolean;
}

export interface ToolLevel {
  level: number;
  label: string;
  /** Extra resource gained per swing (on top of the base 1). */
  bonus: number;
  /** Stamina one swing costs while this tool is in hand. */
  staminaCost: number;
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
    { level: 1, label: '石斧', bonus: 2, staminaCost: 14, durability: 30, refund: 4, cost: 0, materials: [] },
    { level: 2, label: '磨石斧', bonus: 5, staminaCost: 11, durability: 80, refund: 14, cost: 20, materials: [{ item: 'plank', qty: 2 }] },
    { level: 3, label: '护林员之斧', bonus: 9, staminaCost: 8, durability: 200, refund: 36, cost: 48, materials: [{ item: 'plank', qty: 4 }, { item: 'rope', qty: 2 }] },
  ],
  pickaxe: [
    { level: 1, label: '石镐', bonus: 2, staminaCost: 12, durability: 30, refund: 4, cost: 0, materials: [] },
    { level: 2, label: '重石镐', bonus: 5, staminaCost: 10, durability: 80, refund: 14, cost: 20, materials: [{ item: 'plank', qty: 2 }] },
    { level: 3, label: '矿工之镐', bonus: 9, staminaCost: 7, durability: 200, refund: 36, cost: 48, materials: [{ item: 'plank', qty: 4 }, { item: 'rope', qty: 2 }] },
  ],
  rod: [
    { level: 1, label: '竹鱼竿', bonus: 0, staminaCost: 7, durability: 25, refund: 6, cost: 0, materials: [] },
    { level: 2, label: '韧鱼竿', bonus: 0, staminaCost: 6, durability: 70, refund: 18, cost: 30, materials: [{ item: 'plank', qty: 3 }, { item: 'rope', qty: 2 }] },
    { level: 3, label: '月见鱼竿', bonus: 1, staminaCost: 5, durability: 150, refund: 42, cost: 65, materials: [{ item: 'plank', qty: 5 }, { item: 'rope', qty: 3 }] },
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
    description: '在炉子上热好的鱼汤。吃得饱，也回体力。',
    cost: 6,
    kind: 'food',
    seller: 'nell',
    item: 'hotmeal',
    repeatable: true,
  },
  {
    id: 'food.ration',
    name: '干粮',
    icon: '🍞',
    description: '寡淡，但顶饿。',
    cost: 3,
    kind: 'food',
    seller: 'nell',
    item: 'ration',
    repeatable: true,
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

/** True when the item id names one of the three tools. */
export function isToolId(id: string): id is 'axe' | 'pickaxe' | 'rod' {
  return id === 'axe' || id === 'pickaxe' || id === 'rod';
}

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
  const rate = buyer.wants === fishId ? buyer.rate * WANTED_BONUS : buyer.rate;
  return Math.max(1, Math.round(baseValue * rate));
}

/** How much more a villager pays for the species they are after. */
export const WANTED_BONUS = 1.5;

/** How many fish one villager will buy in a day. */
export const DAILY_FISH_LIMIT = 12;

/**
 * What a villager does for you once you know them well enough.
 *
 * Trust used to be nothing but a different greeting, so it felt like a
 * number that did not matter. Now it buys something real.
 */
export interface TrustReward {
  npc: NpcId;
  /** The trust level needed. */
  level: number;
  kind: 'repair' | 'discount';
  /** For a discount: the fraction of the price you pay. */
  factor?: number;
  /** Which kinds of shop entry the reward applies to. */
  appliesTo: ShopKind[];
  label: string;
  description: string;
}

export const TRUST_REWARDS: readonly TrustReward[] = [
  {
    npc: 'tallis',
    level: 2,
    kind: 'repair',
    appliesTo: ['tool'],
    label: '免费修理工具',
    description: 'Tallis 愿意免费把你的工具修到满耐久。',
  },
  {
    npc: 'nell',
    level: 3,
    kind: 'discount',
    factor: 0.8,
    appliesTo: ['food'],
    label: '熟客价 8 折',
    description: '你常来买东西，Nell 给你便宜一点。',
  },
  {
    npc: 'maren',
    level: 4,
    kind: 'discount',
    factor: 0.7,
    appliesTo: ['hint'],
    label: '老相识价 7 折',
    description: 'Maren 愿意便宜一点卖给你线索。',
  },
];

/** The discount a villager gives you on a kind of goods, or 1 for none. */
export function trustDiscount(
  npc: NpcId,
  kind: ShopKind,
  trustLevel: number,
): number {
  for (const reward of TRUST_REWARDS) {
    if (reward.npc !== npc) continue;
    if (reward.kind !== 'discount') continue;
    if (!reward.appliesTo.includes(kind)) continue;
    if (trustLevel < reward.level) continue;
    return reward.factor ?? 1;
  }
  return 1;
}

/** The reward a villager has unlocked for you, if any. */
export function trustRewardFor(npc: NpcId, trustLevel: number): TrustReward | undefined {
  return TRUST_REWARDS.find(
    (reward) => reward.npc === npc && trustLevel >= reward.level,
  );
}

/**
 * What the villagers pay for the things you have made more of than you
 * need — planks, rope and the decorations you crafted.
 *
 * Every price is below what the materials went into it, so selling is a way
 * to free up your backpack, never a way to get rich.
 */
export const SURPLUS_PRICES: Record<string, number> = {
  wood: 1,
  stone: 1,
  fiber: 1,
  plank: 2,
  rope: 2,
  flower: 1,
  campfire: 3,
  lantern: 3,
  banner: 3,
  flowerpot: 2,
  stool: 2,
};

/** What a plain sea shell is worth. */
export const SHELL_VALUE = 2;
/** What a deep shell is worth — it needs a swimmer to reach it. */
export const DEEPSHELL_VALUE = 4;

/** The shells a villager will buy, and what they pay for them. */
export function shellPrice(itemId: string, buyer: BuyerProfile): number {
  const base = itemId === 'deepshell' ? DEEPSHELL_VALUE : SHELL_VALUE;
  return Math.max(1, Math.round(base * buyer.rate));
}
