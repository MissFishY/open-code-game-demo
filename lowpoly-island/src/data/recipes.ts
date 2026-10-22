/**
 * Recipes and blueprints.
 *
 * Everything is data — the crafting / building systems in `src/systems/` are
 * pure logic on top of this file.
 */

export interface ItemAmount {
  item: string;
  qty: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  /** Materials consumed. */
  inputs: ItemAmount[];
  /** Item produced. */
  output: ItemAmount;
  /** Short hint shown in the crafting panel. */
  hint: string;
}

export const RECIPES: readonly Recipe[] = [
  {
    id: 'plank',
    name: '木板',
    description: '把一根原木锯成平整的板子。',
    inputs: [{ item: 'wood', qty: 2 }],
    output: { item: 'plank', qty: 1 },
    hint: '最基础的建材。',
  },
  {
    id: 'rope',
    name: '绳索',
    description: '把芦苇拧成结实的绳子。',
    inputs: [{ item: 'fiber', qty: 3 }],
    output: { item: 'rope', qty: 1 },
    hint: '把小屋绑结实。',
  },
  {
    id: 'axe',
    name: '石斧',
    description: '燧石刃，用绳子绑在木柄上。',
    inputs: [
      { item: 'stone', qty: 2 },
      { item: 'fiber', qty: 1 },
    ],
    output: { item: 'axe', qty: 1 },
    hint: '每棵树能砍下 3 木材，体力消耗也低得多。升级后更多。',
  },
  {
    id: 'pickaxe',
    name: '石镐',
    description: '沉甸甸的石锤头，短木柄。',
    inputs: [
      { item: 'stone', qty: 2 },
      { item: 'plank', qty: 1 },
    ],
    output: { item: 'pickaxe', qty: 1 },
    hint: '每次能挖到 3 块石头，体力消耗也低得多。升级后更多。',
  },
  // --- Decorations -------------------------------------------------------
  {
    id: 'craft_campfire',
    name: '火堆',
    description: '一圈石头，围着中间一堆火。',
    inputs: [
      { item: 'wood', qty: 3 },
      { item: 'fiber', qty: 2 },
    ],
    output: { item: 'campfire', qty: 1 },
    hint: '放在火坑里。温馨度 +3。',
  },
  {
    id: 'craft_lantern',
    name: '灯笼',
    description: '立在一根柱子上的小灯。',
    inputs: [
      { item: 'wood', qty: 1 },
      { item: 'rope', qty: 1 },
    ],
    output: { item: 'lantern', qty: 1 },
    hint: '放在门边。温馨度 +2。',
  },
  {
    id: 'craft_banner',
    name: '彩旗',
    description: '给屋脊准备的染布条。',
    inputs: [
      { item: 'fiber', qty: 2 },
      { item: 'flower', qty: 1 },
    ],
    output: { item: 'banner', qty: 1 },
    hint: '挂在屋顶。温馨度 +2。',
  },
  {
    id: 'craft_flowerpot',
    name: '花盆',
    description: '一个里面种着东西的盆。',
    inputs: [
      { item: 'stone', qty: 1 },
      { item: 'fiber', qty: 1 },
    ],
    output: { item: 'flowerpot', qty: 1 },
    hint: '放在屋外。温馨度 +1。',
  },
  {
    id: 'craft_stool',
    name: '木凳',
    description: '可以坐的东西。',
    inputs: [{ item: 'plank', qty: 1 }],
    output: { item: 'stool', qty: 1 },
    hint: '放在屋外。温馨度 +1。',
  },
];

/** A structure the player can raise once they have gathered enough. */
export interface Blueprint {
  id: string;
  name: string;
  description: string;
  inputs: ItemAmount[];
  /** Text shown once the structure is finished. */
  completeText: string;
}

export const BLUEPRINTS: Record<string, Blueprint> = {
  hut: {
    id: 'hut',
    name: '小屋',
    description:
      '四根柱子、一面木板屋顶，还有一扇只挡风的门。岛上属于你自己的一个地方。',
    inputs: [
      { item: 'plank', qty: 4 },
      { item: 'rope', qty: 2 },
      { item: 'stone', qty: 2 },
    ],
    completeText: '你的小屋盖好了。闻起来是松木和湿土的味道。',
  },
};

export function getBlueprint(id: string): Blueprint | undefined {
  return BLUEPRINTS[id];
}
