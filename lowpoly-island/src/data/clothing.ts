/**
 * Wardrobe.
 *
 * Clothing is bought with fish money and worn to get passive bonuses. The three
 * villagers each sell a different kind of thing, which is what gives the
 * economy its shape:
 *
 *   Nell  — practical things you need to survive on the water
 *   Tallis — sturdy things that keep you going on land
 *   Maren — small strange things that make the island kinder to you
 */

export type SellerId = 'nell' | 'tallis' | 'maren';

export interface ClothingBonus {
  /** Flat increase of the maximum stamina. */
  staminaMax?: number;
  /** Extra stamina recovered per second. */
  staminaRegen?: number;
  /** Percentage reduction of the swimming drain. */
  swimDrain?: number;
  /** Percentage reduction of the underwater drain. */
  diveDrain?: number;
  /** Percentage added to the chance of a fish biting. */
  fishLuck?: number;
  /** Widens the catch window of the fishing mini-game (0..1). */
  rodPower?: number;
  /** Cozysiness the outfit adds to your hut. */
  cozy?: number;
  /** Rain no longer drains stamina. */
  rainImmune?: boolean;
  /** Lets you swim in water that is too deep to wade. */
  swimsuit?: boolean;
  /** Shown on the character model. */
  visual?: 'hat' | 'cloak' | 'necklace' | 'boots' | 'swimsuit';
}

export interface ClothingDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Price in coins. */
  cost: number;
  /** Which villager sells it. */
  seller: SellerId;
  bonuses: ClothingBonus;
}

export const CLOTHING: readonly ClothingDef[] = [
  {
    id: 'swimsuit',
    name: '游泳衣',
    icon: '🩱',
    description: 'Nell 用海藻编的。有了它，你就能游到浅水区以外。',
    cost: 12,
    seller: 'nell',
    bonuses: { swimsuit: true, swimDrain: 25, diveDrain: 30, visual: 'swimsuit' },
  },
  {
    id: 'fisherhat',
    name: '渔夫帽',
    icon: '🎩',
    description: '能遮阳，鱼好像也抵抗不了它。',
    cost: 18,
    seller: 'nell',
    bonuses: { fishLuck: 20, rodPower: 0.08, visual: 'hat' },
  },
  {
    id: 'seaweedcloak',
    name: '海藻斗篷',
    icon: '🧥',
    description: '湿漉漉的，可它保暖的方式跟热一点关系都没有。',
    cost: 30,
    seller: 'nell',
    bonuses: { staminaMax: 20, staminaRegen: 1.5, visual: 'cloak' },
  },
  {
    id: 'waders',
    name: '涉水靴',
    icon: '🥾',
    description: 'Tallis 用帆布做的。穿着它，你能干一整天的活。',
    cost: 24,
    seller: 'tallis',
    bonuses: { staminaRegen: 2.5, swimDrain: 15, visual: 'boots' },
  },
  {
    id: 'workcoat',
    name: '工作外套',
    icon: '🧥',
    description: '厚实、打着补丁，海风横着打过来的时候最舒服。',
    cost: 26,
    seller: 'tallis',
    bonuses: { staminaMax: 15, rainImmune: true, visual: 'cloak' },
  },
  {
    id: 'shellnecklace',
    name: '贝壳项链',
    icon: '📿',
    description: 'Maren 把它们串起来，走路时会响。岛屿在听。',
    cost: 22,
    seller: 'maren',
    bonuses: { cozy: 2, fishLuck: 10, visual: 'necklace' },
  },
  {
    id: 'charm',
    name: '以太护符',
    icon: '🔮',
    description: '皮绳上系着一片水晶。你累的时候它会嗡。',
    cost: 40,
    seller: 'maren',
    bonuses: { staminaRegen: 1.2, diveDrain: 15, cozy: 1, visual: 'necklace' },
  },
];

export function getClothing(id: string): ClothingDef | undefined {
  return CLOTHING.find((item) => item.id === id);
}

/** Everything a piece of clothing gives, added together. */
export function totalBonuses(owned: readonly string[]): ClothingBonus {
  const total: ClothingBonus = {
    staminaMax: 0,
    staminaRegen: 0,
    swimDrain: 0,
    diveDrain: 0,
    fishLuck: 0,
    rodPower: 0,
    cozy: 0,
  };
  let rainImmune = false;
  let swimsuit = false;

  for (const id of owned) {
    const item = getClothing(id);
    if (!item) continue;
    const bonus = item.bonuses;
    total.staminaMax = (total.staminaMax ?? 0) + (bonus.staminaMax ?? 0);
    total.staminaRegen = (total.staminaRegen ?? 0) + (bonus.staminaRegen ?? 0);
    total.swimDrain = (total.swimDrain ?? 0) + (bonus.swimDrain ?? 0);
    total.diveDrain = (total.diveDrain ?? 0) + (bonus.diveDrain ?? 0);
    total.fishLuck = (total.fishLuck ?? 0) + (bonus.fishLuck ?? 0);
    total.rodPower = (total.rodPower ?? 0) + (bonus.rodPower ?? 0);
    total.cozy = (total.cozy ?? 0) + (bonus.cozy ?? 0);
    rainImmune = rainImmune || bonus.rainImmune === true;
    swimsuit = swimsuit || bonus.swimsuit === true;
  }

  total.rainImmune = rainImmune;
  total.swimsuit = swimsuit;
  return total;
}
