/**
 * Fish species.
 *
 * Each species lives in a habitat (lake or sea), has a bite rate and a
 * value. Rarer fish are harder to come by — the moonfish only surfaces on a
 * calm night, for example.
 */

export type FishHabitat = 'lake' | 'sea';
export type FishRarity = 'common' | 'uncommon' | 'rare';

export interface FishDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  habitat: FishHabitat;
  rarity: FishRarity;
  /** Worth this many coins when sold. */
  value: number;
  /** Relative chance of being caught. */
  weight: number;
  /** Only bites during these phases of the day. */
  phases?: readonly ('morning' | 'day' | 'evening' | 'night')[];
  /** Only bites in this weather. */
  weather?: readonly ('clear' | 'rain' | 'wind')[];
}

export const FISH: readonly FishDef[] = [
  {
    id: 'sardine',
    name: '沙丁鱼',
    icon: '🐟',
    description: '小小的、银闪闪的，多得数不清。',
    habitat: 'sea',
    rarity: 'common',
    value: 3,
    weight: 34,
  },
  {
    id: 'perch',
    name: '鲈鱼',
    icon: '🐠',
    description: '有条纹，脾气还倔。湖里全是它。',
    habitat: 'lake',
    rarity: 'common',
    value: 4,
    weight: 30,
  },
  {
    id: 'mackerel',
    name: '鲭鱼',
    icon: '🐡',
    description: '银光一闪，就只剩水面上一圈涟漪。',
    habitat: 'sea',
    rarity: 'uncommon',
    value: 9,
    weight: 14,
  },
  {
    id: 'carp',
    name: '鲤鱼',
    icon: '🎣',
    description: '又肥又慢，但值得你等。',
    habitat: 'lake',
    rarity: 'uncommon',
    value: 12,
    weight: 12,
  },
  {
    id: 'moonfish',
    name: '月鱼',
    icon: '🌙',
    description: '只在无风的静夜浮上来，而且会发光。',
    habitat: 'lake',
    rarity: 'rare',
    value: 30,
    weight: 3,
    phases: ['night'],
    weather: ['clear'],
  },
];

export function getFish(id: string): FishDef | undefined {
  return FISH.find((fish) => fish.id === id);
}

/** The fish that could be caught right now. */
export function availableFish(
  habitat: FishHabitat,
  phase: 'morning' | 'day' | 'evening' | 'night',
  weather: 'clear' | 'rain' | 'wind',
): FishDef[] {
  return FISH.filter((fish) => {
    if (fish.habitat !== habitat) return false;
    if (fish.phases && !fish.phases.includes(phase)) return false;
    if (fish.weather && !fish.weather.includes(weather)) return false;
    return true;
  });
}
