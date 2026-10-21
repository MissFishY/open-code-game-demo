/** Item definitions for the backpack. */

export interface ItemDef {
  id: string;
  name: string;
  /** Single unicode glyph used as a compact icon in the HUD. */
  icon: string;
  description: string;
  /** Colour used for the 3D pickup / UI swatch. */
  color: number;
}

export const ITEMS: Record<string, ItemDef> = {
  wood: {
    id: 'wood',
    name: '木材',
    icon: '🪵',
    description: '从岛上砍下来的结实木料。',
    color: 0x8d6e63,
  },
  stone: {
    id: 'stone',
    name: '石块',
    icon: '🪨',
    description: '能敲开、也盖得住墙的粗石。',
    color: 0x9e9e9e,
  },
  fiber: {
    id: 'fiber',
    name: '芦苇',
    icon: '🌾',
    description: '水边长的韧性芦草，拧成绳正好。',
    color: 0xd8c86a,
  },
  berry: {
    id: 'berry',
    name: '浆果',
    icon: '🫐',
    description: '岛上野生的小浆果，甜得很。',
    color: 0x7b4fa8,
  },
  flower: {
    id: 'flower',
    name: '野花',
    icon: '🌸',
    description: '从草甸上摘的一朵，岛上到处都有。',
    color: 0xf48fb1,
  },
  crystal: {
    id: 'crystal',
    name: '以太水晶',
    icon: '💎',
    description: '从岛屿脊背上劈下来的、会在低声嗡鸣的水晶。',
    color: 0x53e0e6,
  },
  plank: {
    id: 'plank',
    name: '木板',
    icon: '🟫',
    description: '锯出来的平木板，任何像样的小屋都少不了它。',
    color: 0xb08355,
  },
  rope: {
    id: 'rope',
    name: '绳索',
    icon: '🪢',
    description: '芦苇拧成的粗绳，能把东西绑在一起。',
    color: 0xd8c98a,
  },
  axe: {
    id: 'axe',
    name: '石斧',
    icon: '🪓',
    description: '自己打的石斧。砍树一次能得两份木材。',
    color: 0x9aa3ad,
  },
  pickaxe: {
    id: 'pickaxe',
    name: '石镐',
    icon: '⛏️',
    description: '自己打的石镐。挖矿一次能多得一块石头。',
    color: 0x8e99a6,
  },
  shell: {
    id: 'shell',
    name: '海贝',
    icon: '🐚',
    description: '潮线上捡到的贝壳，是海留下的。',
    color: 0xf0d9c0,
  },
  deepshell: {
    id: 'deepshell',
    name: '深海螺',
    icon: '🐚',
    description: '湖底或海底的螺壳，离开水的时候还是湿的。',
    color: 0x9ad7d0,
  },
  hotmeal: {
    id: 'hotmeal',
    name: '热饭',
    icon: '🍲',
    description: '在炉子上热好的鱼汤，能把人从里暖到外。',
    color: 0xe08a4a,
  },
  campfire: {
    id: 'campfire',
    name: '火堆',
    icon: '🔥',
    description: '一堆几乎不灭的火。',
    color: 0xff8a3d,
  },
  lantern: {
    id: 'lantern',
    name: '灯笼',
    icon: '🏮',
    description: '把黑夜挡在一臂之外。',
    color: 0xffd166,
  },
  banner: {
    id: 'banner',
    name: '彩旗',
    icon: '🚩',
    description: '挂在屋脊上的一条染布。',
    color: 0xd76a8a,
  },
  flowerpot: {
    id: 'flowerpot',
    name: '花盆',
    icon: '🪴',
    description: '裂了口的陶盆，里面种着不肯死的绿东西。',
    color: 0xc97a4e,
  },
  stool: {
    id: 'stool',
    name: '木凳',
    icon: '🪑',
    description: '三条腿，一个凳面，坐到天荒地老。',
    color: 0xa9773f,
  },
  crown: {
    id: 'crown',
    name: '岛屿王冠',
    icon: '👑',
    description: '一位真正守护者的证明。',
    color: 0xffcf4d,
  },
};

export type ItemId = keyof typeof ITEMS;

export function getItem(id: string): ItemDef {
  return (
    ITEMS[id] ?? {
      id,
      name: id,
      icon: '❔',
      description: '不知道是什么东西。',
      color: 0xffffff,
    }
  );
}
