/**
 * Decorations for the player's hut.
 *
 * A decoration is a physical object that stands in a slot around the hut.
 * Placing one consumes the matching item from the backpack, taking it back
 * returns it. Every decoration adds *coziness*, and crossing a coziness
 * tier unlocks a small gift from the island.
 *
 * Pure data — the systems and renderer live elsewhere.
 */

export type DecorationSlotKind = 'firepit' | 'around' | 'roof' | 'wall';

export interface DecorationSlot {
  id: string;
  kind: DecorationSlotKind;
  /** Human readable name, shown in the decoration panel. */
  label: string;
  /** Local offset from the centre of the hut floor. */
  offset: { x: number; y: number; z: number };
  /** Decoration types that may be placed here. */
  accepts: string[];
}

/** The slots around the hut, in world-local coordinates. */
export const DECORATION_SLOTS: readonly DecorationSlot[] = [
  { id: 'firepit', kind: 'firepit', label: '火坑', offset: { x: 0, y: 0, z: 3.6 }, accepts: ['campfire'] },
  { id: 'side-a', kind: 'around', label: '门前', offset: { x: -3.3, y: 0, z: 1.1 }, accepts: ['lantern', 'flowerpot', 'stool', 'shell'] },
  { id: 'side-b', kind: 'around', label: '门右', offset: { x: 3.3, y: 0, z: 1.1 }, accepts: ['lantern', 'flowerpot', 'stool', 'shell'] },
  { id: 'side-c', kind: 'around', label: '屋后', offset: { x: -3.3, y: 0, z: -1.3 }, accepts: ['lantern', 'flowerpot', 'stool', 'shell'] },
  { id: 'side-d', kind: 'around', label: '屋角', offset: { x: 3.3, y: 0, z: -1.3 }, accepts: ['lantern', 'flowerpot', 'stool', 'shell'] },
  { id: 'roof-a', kind: 'roof', label: '屋脊', offset: { x: -0.85, y: 3.5, z: 0 }, accepts: ['banner'] },
  { id: 'roof-b', kind: 'roof', label: '屋脊', offset: { x: 0.85, y: 3.5, z: 0 }, accepts: ['banner'] },
  { id: 'wall-a', kind: 'wall', label: '后墙', offset: { x: -1.3, y: 1.5, z: -1.78 }, accepts: ['shell'] },
  { id: 'wall-b', kind: 'wall', label: '后墙', offset: { x: 1.3, y: 1.5, z: -1.78 }, accepts: ['shell'] },
];

export interface DecorationDef {
  id: string;
  /** The inventory item this decoration is made from. */
  itemId: string;
  name: string;
  description: string;
  icon: string;
  /** How much coziness it adds. */
  coziness: number;
  /** The crafting recipe id, if it can be made. */
  recipeId?: string;
  /** Where it can be found, if it is not crafted. */
  found?: string;
}

/** All decorations the player can own. */
export const DECORATIONS: readonly DecorationDef[] = [
  {
    id: 'campfire',
    itemId: 'campfire',
    name: '火堆',
    description: '一圈石头，围着中间一堆怎么也不肯熄的火。',
    icon: '🔥',
    coziness: 3,
    recipeId: 'craft_campfire',
  },
  {
    id: 'lantern',
    itemId: 'lantern',
    name: '灯笼',
    description: '挂在门边，把黑夜挡在一臂之外。',
    icon: '🏮',
    coziness: 2,
    recipeId: 'craft_lantern',
  },
  {
    id: 'banner',
    itemId: 'banner',
    name: '彩旗',
    description: '屋脊上挂的一条染布。',
    icon: '🚩',
    coziness: 2,
    recipeId: 'craft_banner',
  },
  {
    id: 'flowerpot',
    itemId: 'flowerpot',
    name: '花盆',
    description: '裂了口的陶盆，里面种着一样不肯死的绿东西。',
    icon: '🪴',
    coziness: 1,
    recipeId: 'craft_flowerpot',
  },
  {
    id: 'stool',
    itemId: 'stool',
    name: '木凳',
    description: '三条腿，一个凳面，坐到天荒地老。',
    icon: '🪑',
    coziness: 1,
    recipeId: 'craft_stool',
  },
  {
    id: 'shell',
    itemId: 'shell',
    name: '海贝',
    description: '一个螺旋形的贝壳——是海把它留下的。',
    icon: '🐚',
    coziness: 1,
    found: '在潮线上捡到的',
  },
];

export function getDecoration(id: string): DecorationDef | undefined {
  return DECORATIONS.find((decoration) => decoration.id === id);
}

export function getSlot(id: string): DecorationSlot | undefined {
  return DECORATION_SLOTS.find((slot) => slot.id === id);
}

/** A coziness threshold and the gift the island gives when it is reached. */
export interface CozinessTier {
  /** Minimum coziness needed. */
  at: number;
  /** Title shown in the HUD once the tier is reached. */
  title: string;
  /** Items granted once when the tier is first reached. */
  gift: { item: string; qty: number }[];
  /** Message shown when the tier is reached. */
  message: string;
}

export const COZINESS_TIERS: readonly CozinessTier[] = [
  {
    at: 4,
    title: '这里开始像个有人住的地方了',
    gift: [{ item: 'flower', qty: 2 }],
    message: '岛屿注意到了，送来几朵花。',
  },
  {
    at: 9,
    title: '一个像样的小家',
    gift: [{ item: 'crystal', qty: 1 }],
    message: '岛屿很高兴，一片以太碎片漂到了你门口。',
  },
  {
    at: 14,
    title: '整座岛上最暖的一个角落',
    gift: [{ item: 'berry', qty: 3 }],
    message: '这里再没有空落落的地方了。',
  },
];

/** The coziness needed for the highest tier. */
export const MAX_COZINESS = DECORATION_SLOTS.reduce(
  (best, slot) => {
    const bestDef = slot.accepts
      .map((id) => getDecoration(id))
      .filter((decoration): decoration is DecorationDef => decoration !== undefined)
      .sort((a, b) => b.coziness - a.coziness)[0];
    return best + (bestDef?.coziness ?? 0);
  },
  0,
);
