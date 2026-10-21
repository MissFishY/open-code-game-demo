/**
 * The inside of the hut: expansions that make the building bigger, and
 * furniture that goes inside it.
 *
 * Expansions are paid for with building materials. Furniture is bought with
 * coins (from selling fish) and placed in interior slots.
 */

export type ExpansionId = 'porch' | 'upper' | 'kitchen';

export interface ExpansionDef {
  id: ExpansionId;
  name: string;
  description: string;
  /** Materials needed to raise it. */
  materials: { item: string; qty: number }[];
  /** Coins needed as well. */
  cost: number;
  /** Cozysiness the expansion adds to the hut. */
  cozy: number;
  /** How many extra interior slots it opens. */
  slots: number;
}

export const EXPANSIONS: readonly ExpansionDef[] = [
  {
    id: 'porch',
    name: '门廊',
    description: '一小段有顶的台阶和一道栏杆。可以坐着看天色暗下去。',
    materials: [
      { item: 'plank', qty: 3 },
      { item: 'rope', qty: 2 },
    ],
    cost: 15,
    cozy: 2,
    slots: 1,
  },
  {
    id: 'upper',
    name: '二层',
    description: '一架梯子、一层木板，还有屋顶下面一间低矮的房。闻起来是灰尘和老木头。',
    materials: [
      { item: 'plank', qty: 6 },
      { item: 'stone', qty: 4 },
      { item: 'rope', qty: 2 },
    ],
    cost: 40,
    cozy: 3,
    slots: 2,
  },
  {
    id: 'kitchen',
    name: '厨房角',
    description: '一座石灶、一层架子、一口锅。东西在这里放得久些，夜晚也待得久些。',
    materials: [
      { item: 'plank', qty: 4 },
      { item: 'stone', qty: 6 },
      { item: 'fiber', qty: 2 },
    ],
    cost: 35,
    cozy: 3,
    slots: 2,
  },
];

export function getExpansion(id: string): ExpansionDef | undefined {
  return EXPANSIONS.find((expansion) => expansion.id === id);
}

export type FurnitureSlot = 'floor-a' | 'floor-b' | 'wall-a' | 'wall-b' | 'hearth' | 'porch';

export interface FurnitureDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Price in coins. */
  cost: number;
  /** Which slots it fits in. */
  slots: FurnitureSlot[];
  cozy: number;
  /** Local position inside the hut. */
  offset: { x: number; y: number; z: number };
  /** Turns it to face the middle of the room. */
  facesCentre?: boolean;
}

/** The slots available inside a bare hut. */
export const BASE_INTERIOR_SLOTS: readonly FurnitureSlot[] = ['floor-a', 'wall-a'];

export const FURNITURE: readonly FurnitureDef[] = [
  {
    id: 'bed',
    name: '床',
    icon: '🛏️',
    description: '干草、一条毯子，还有岛上第一张真正属于你的床。',
    cost: 20,
    slots: ['floor-a', 'floor-b'],
    cozy: 3,
    offset: { x: -1.2, y: 0, z: -0.9 },
  },
  {
    id: 'table',
    name: '桌子',
    icon: '🪑',
    description: '一张平桌面，和三条微微不平的腿。',
    cost: 14,
    slots: ['floor-a', 'floor-b'],
    cozy: 2,
    offset: { x: 1.1, y: 0, z: -0.6 },
    facesCentre: true,
  },
  {
    id: 'rug',
    name: '地毯',
    icon: '🧶',
    description: '芦苇编的，用芦苇不太想要的颜色染过。',
    cost: 18,
    slots: ['floor-a', 'floor-b'],
    cozy: 2,
    offset: { x: 0, y: 0.02, z: 0.4 },
  },
  {
    id: 'shelf',
    name: '架子',
    icon: '🗄️',
    description: '放那些你打算哪天再看一眼的东西。',
    cost: 12,
    slots: ['wall-a', 'wall-b'],
    cozy: 1,
    offset: { x: -1.85, y: 1.2, z: 0 },
  },
  {
    id: 'lamp',
    name: '油灯',
    icon: '🕯️',
    description: '烧得很慢，闻起来有股油味。',
    cost: 10,
    slots: ['wall-a', 'wall-b'],
    cozy: 1,
    offset: { x: 1.85, y: 1.2, z: 0 },
  },
  {
    id: 'hearth',
    name: '壁炉',
    icon: '🔥',
    description: '你自己生的火，在你自己盖的屋子里。',
    cost: 28,
    slots: ['hearth'],
    cozy: 3,
    offset: { x: 0, y: 0, z: -1.5 },
  },
  {
    id: 'bench',
    name: '长凳',
    icon: '🪵',
    description: '一个人坐刚好，两个人坐也行——如果你够客气。',
    cost: 9,
    slots: ['porch'],
    cozy: 1,
    offset: { x: 0, y: 0, z: 2.6 },
  },
];

export function getFurniture(id: string): FurnitureDef | undefined {
  return FURNITURE.find((item) => item.id === id);
}

/** All interior slots the player has unlocked. */
export function availableSlots(expansions: readonly string[]): FurnitureSlot[] {
  const slots = new Set<FurnitureSlot>(BASE_INTERIOR_SLOTS);
  for (const id of expansions) {
    const expansion = getExpansion(id);
    if (!expansion) continue;
    if (expansion.id === 'porch') slots.add('porch');
    if (expansion.id === 'upper') {
      slots.add('floor-b');
      slots.add('wall-b');
    }
    if (expansion.id === 'kitchen') slots.add('hearth');
  }
  return [...slots];
}
