/**
 * Quest definitions and progression logic.
 *
 * The island has two threads of story:
 *
 *   main    firewood → homestead → supplies → heart      (the pact)
 *   personal beacon (Tallis) · raft (Nell) · sister (Maren)
 *
 * The personal quests are the "each has their own trouble" part: they never
 * block the main chain, but they change how each villager treats you and
 * what they will give you.
 *
 * Requirements may name a *category* instead of a single item — "fish" means
 * any of the island's fish.
 */

import { Inventory } from './InventorySystem';
import { FISH } from '../data/fish';

export type QuestId =
  | 'firewood'
  | 'homestead'
  | 'supplies'
  | 'heart'
  | 'beacon'
  | 'raft'
  | 'sister';

export type QuestChapter = 'main' | 'tallis' | 'nell' | 'maren';

export interface ItemRequirement {
  item: string;
  qty: number;
}

export type QuestKind = 'items' | 'flag';

/** Requirement groups: any of these ids counts towards the requirement. */
export const REQUIREMENT_CATEGORIES: Record<string, readonly string[]> = {
  fish: FISH.map((fish) => fish.id),
};

export interface QuestDef {
  id: QuestId;
  title: string;
  /** NPC id of the quest giver. */
  giver: string;
  /** Which story thread this belongs to. */
  chapter: QuestChapter;
  /**
   * `items` quests are handed in by delivering materials.
   * `flag` quests are handed in by doing something in the world.
   */
  kind: QuestKind;
  /** For `flag` quests: the world flag that must be set. */
  flag?: string;
  requirements: ItemRequirement[];
  rewards: ItemRequirement[];
  /** Quest that must be completed before this one becomes available. */
  requires: QuestId | null;
  intro: string;
  completeText: string;
  summary: string;
  /** Coins paid out when the quest is handed in. */
  coins?: number;
}

export const QUESTS: Record<QuestId, QuestDef> = {
  firewood: {
    id: 'firewood',
    title: '给灯塔送柴',
    giver: 'tallis',
    chapter: 'main',
    kind: 'items',
    requirements: [{ item: 'wood', qty: 3 }],
    rewards: [
      { item: 'fiber', qty: 2 },
      { item: 'berry', qty: 1 },
    ],
    requires: null,
    intro:
      '旅人，山脊上的灯塔灭了。给我三根原木，我重新点着它——整条海岸都能看见这个信号。',
    completeText:
      '三根好木头。灯亮了！这些拿着——我库房里的芦苇和浆果。你在湖边还会用得上 Nell 的东西。',
    summary: '给 Tallis 送 3 木材。',
  },
  homestead: {
    id: 'homestead',
    title: '属于你自己的屋顶',
    giver: 'tallis',
    chapter: 'main',
    kind: 'flag',
    flag: 'hut:built',
    requirements: [],
    rewards: [
      { item: 'plank', qty: 3 },
      { item: 'rope', qty: 2 },
    ],
    requires: 'firewood',
    intro:
      '灯亮着，那就说点暖和的。村口划出了一块地基——四根柱子和一张图样。锯几块木板，拧几根绳，再给我搬些石头，在岛上盖一间你自己的小屋。',
    completeText:
      '你盖起来了！我在山脊上都能看见那个烟囱。拿着——这些木板和绳子，给你想盖的下一样东西。',
    summary: '在村口盖起小屋，然后回去告诉 Tallis。',
  },
  supplies: {
    id: 'supplies',
    title: '采集者的请求',
    giver: 'nell',
    chapter: 'main',
    kind: 'items',
    requirements: [
      { item: 'fiber', qty: 4 },
      { item: 'berry', qty: 3 },
    ],
    rewards: [
      { item: 'crystal', qty: 1 },
      { item: 'flower', qty: 2 },
    ],
    requires: 'homestead',
    intro:
      '已经有屋顶了？那这座岛对你可不薄。我要芦苇和浆果来填木筏。还有，山脊上的人说，以太水晶在岛上有三处会嗡——我给你包了一块。',
    completeText:
      '够了，木筏的材料齐了！给你，一块我在洞穴芦苇里找到的以太水晶。脊背上的 Maren 知道另外两处在哪。去找吧。',
    summary: '给 Nell 送 4 芦苇和 3 浆果。',
  },
  heart: {
    id: 'heart',
    title: '岛屿之心',
    giver: 'maren',
    chapter: 'main',
    kind: 'items',
    requirements: [{ item: 'crystal', qty: 3 }],
    rewards: [{ item: 'crown', qty: 1 }],
    requires: 'supplies',
    intro:
      '你带着那声嗡。三颗水晶，岛的心就重新完整了。脊背还在唱——你听见了吗？拿给我，旧的契约就封上了。',
    completeText:
      '那么就完成了。旅人，岛记住你了。把王冠戴上——从现在起，你是它的守护者。',
    summary: '给 Maren 送 3 颗以太水晶。',
  },

  // --- Personal storylines ------------------------------------------------
  beacon: {
    id: 'beacon',
    title: '熄灭的那盏灯',
    giver: 'tallis',
    chapter: 'tallis',
    kind: 'items',
    requirements: [
      { item: 'fish', qty: 10 },
      { item: 'wood', qty: 8 },
      { item: 'stone', qty: 6 },
    ],
    rewards: [{ item: 'axe', qty: 1 }],
    requires: 'firewood',
    intro:
      '山脊上的灯亮着，但它底下的塔没有。两年前的暴风雨把它掀倒了，没有人——也没有足够的木头——愿意再把它立起来。十条鱼换灯油，八根原木换框架，六块石头换地基。剩下的我来。',
    completeText:
      '看它。看它烧着。我父亲垒的这些石头，我一直以为最后会是我看着它塌。你在这儿的时候，我把你那把斧子好好磨一磨——像样地磨，不是以前那种磨法。',
    summary: '帮 Tallis 重建灯塔：10 鱼、8 木材、6 石块。',
    coins: 25,
  },
  raft: {
    id: 'raft',
    title: '木筏',
    giver: 'nell',
    chapter: 'nell',
    kind: 'items',
    requirements: [
      { item: 'fish', qty: 8 },
      { item: 'fiber', qty: 6 },
      { item: 'plank', qty: 4 },
    ],
    rewards: [{ item: 'flower', qty: 3 }],
    requires: 'supplies',
    intro:
      '所有人都以为我是在造筏子好离开。没错。大陆在东边三天路，我六岁起就在这块石头上。八条鱼够路上吃，六根绳绑住它，四块木板做甲板。然后我就走，而你是我第一个告诉的人。',
    completeText:
      '它浮了。它真的浮了——我推出去又划回来，因为我还没那么勇敢，但它浮了。拿着这些，还有我剩下的钱。买点暖和的东西。',
    summary: '帮 Nell 造完木筏：8 鱼、6 芦苇、4 木板。',
    coins: 40,
  },
  sister: {
    id: 'sister',
    title: '沉下去的那个人',
    giver: 'maren',
    chapter: 'maren',
    kind: 'items',
    requirements: [
      { item: 'crystal', qty: 2 },
      { item: 'deepshell', qty: 1 },
      { item: 'moonfish', qty: 1 },
    ],
    rewards: [],
    requires: 'homestead',
    intro:
      '水晶唱歌的那一夜，我妹妹进了湖里，没有上来。我读了三十年这座岛，它从没说过她的名字。替我带三样东西：两颗水晶、一枚她沉下去那处冷水底的贝壳，还有只在无风之夜浮上来的月鱼。把它们带来，我就向水问一个它没法拒绝的问题。',
    completeText:
      '……她在湖底，一直举着一盏灯，等我去看她。我这就去接她。水晶在我不孤单的时候，嗡得不一样。你走吧——岛对你一直很好。轮到我了。',
    summary: '找到 Maren 妹妹留下的东西：2 颗水晶、1 枚深海螺、1 条月鱼。',
    coins: 60,
  },
};

export const QUEST_ORDER: readonly QuestId[] = ['firewood', 'homestead', 'supplies', 'heart'];

/** The personal storylines, in the order they unlock. */
export const STORY_ORDER: readonly QuestId[] = ['beacon', 'raft', 'sister'];

export const ALL_QUEST_IDS: readonly QuestId[] = [...QUEST_ORDER, ...STORY_ORDER];

export type QuestStatus = 'locked' | 'available' | 'ready' | 'done';

export interface QuestCompletionResult {
  ok: boolean;
  /** Items that were consumed. */
  consumed: ItemRequirement[];
  /** Items that were granted. */
  granted: ItemRequirement[];
  /** Items that could not be taken because the backpack was full. */
  dropped: ItemRequirement[];
  /** Coins paid out. */
  coins: number;
}

/** World flags a quest can depend on. */
export type QuestFlags = Readonly<Record<string, boolean>>;

/** How many of `item` the player has — handles requirement categories. */
export function countFor(inventory: Inventory, item: string): number {
  const category = REQUIREMENT_CATEGORIES[item];
  if (category) return inventory.countCategory(category);
  return inventory.count(item);
}

/** True when the player has at least `qty` of `item`. */
export function hasFor(inventory: Inventory, item: string, qty: number): boolean {
  return countFor(inventory, item) >= qty;
}

/** Removes `qty` of `item`, spreading the removal across a category. */
export function removeFor(inventory: Inventory, item: string, qty: number): number {
  const category = REQUIREMENT_CATEGORIES[item];
  if (!category) return inventory.remove(item, qty);

  let removed = 0;
  let left = qty;
  // Take from the least valuable first so the good fish survive.
  for (const id of category) {
    if (left <= 0) break;
    const have = inventory.count(id);
    if (have <= 0) continue;
    const take = Math.min(have, left);
    inventory.remove(id, take);
    removed += take;
    left -= take;
  }
  return removed;
}

export class QuestSystem {
  private completed = new Set<QuestId>();
  private unlocked = new Set<QuestId>();

  constructor() {
    this.unlocked.add('firewood');
  }

  isCompleted(id: QuestId): boolean {
    return this.completed.has(id);
  }

  isUnlocked(id: QuestId): boolean {
    return this.unlocked.has(id);
  }

  /** Recomputes which quests are unlocked. */
  private refreshUnlocks(): void {
    for (const id of ALL_QUEST_IDS) {
      const def = QUESTS[id];
      if (def.requires && this.completed.has(def.requires)) {
        this.unlocked.add(id);
      }
    }
  }

  /**
   * Current status of a quest.
   *
   * @param inventory what the player is carrying
   * @param flags     world flags, needed for `flag` quests
   */
  status(id: QuestId, inventory: Inventory, flags: QuestFlags = {}): QuestStatus {
    if (this.completed.has(id)) return 'done';
    if (!this.unlocked.has(id)) return 'locked';

    const def = QUESTS[id];
    if (def.kind === 'flag') {
      return def.flag && flags[def.flag] ? 'ready' : 'available';
    }
    const ready = def.requirements.every((req) => hasFor(inventory, req.item, req.qty));
    return ready ? 'ready' : 'available';
  }

  /** True when the player can hand the requirements over to the giver. */
  canTurnIn(id: QuestId, inventory: Inventory, flags: QuestFlags = {}): boolean {
    return this.status(id, inventory, flags) === 'ready';
  }

  /**
   * Consumes the requirements and grants the rewards.
   * Does nothing when the requirements are not met.
   */
  turnIn(
    id: QuestId,
    inventory: Inventory,
    flags: QuestFlags = {},
  ): QuestCompletionResult {
    const result: QuestCompletionResult = {
      ok: false,
      consumed: [],
      granted: [],
      dropped: [],
      coins: 0,
    };
    const def = QUESTS[id];
    if (!def) return result;
    if (this.completed.has(id)) return result;
    if (!this.unlocked.has(id)) return result;

    if (def.kind === 'flag') {
      if (!def.flag || !flags[def.flag]) return result;
    } else if (!def.requirements.every((req) => hasFor(inventory, req.item, req.qty))) {
      return result;
    }

    for (const req of def.requirements) {
      const taken = removeFor(inventory, req.item, req.qty);
      result.consumed.push({ item: req.item, qty: taken });
    }

    for (const reward of def.rewards) {
      const given = inventory.add(reward.item, reward.qty);
      if (given > 0) result.granted.push({ item: reward.item, qty: given });
      if (given < reward.qty) result.dropped.push({ item: reward.item, qty: reward.qty - given });
    }

    result.coins = def.coins ?? 0;
    this.completed.add(id);
    this.refreshUnlocks();
    result.ok = true;
    return result;
  }

  /** All quests that are finished. */
  get completedCount(): number {
    return this.completed.size;
  }

  /** The first main-chain quest that is unlocked but not finished. */
  currentObjective(): QuestId | null {
    for (const id of QUEST_ORDER) {
      if (this.unlocked.has(id) && !this.completed.has(id)) return id;
    }
    return null;
  }

  /** Every quest the player can currently work on. */
  activeQuests(inventory: Inventory, flags: QuestFlags = {}): QuestId[] {
    return ALL_QUEST_IDS.filter((id) => {
      const status = this.status(id, inventory, flags);
      return status === 'available' || status === 'ready';
    });
  }

  /** The personal storylines the player is working on. */
  activeStorylines(inventory: Inventory, flags: QuestFlags = {}): QuestId[] {
    return STORY_ORDER.filter((id) => {
      const status = this.status(id, inventory, flags);
      return status === 'available' || status === 'ready';
    });
  }

  /** True when the main chain is finished. */
  get isComplete(): boolean {
    return QUEST_ORDER.every((id) => this.completed.has(id));
  }

  /** True when every personal storyline is finished too. */
  get isFullyComplete(): boolean {
    return ALL_QUEST_IDS.every((id) => this.completed.has(id));
  }

  toJSON(): { completed: QuestId[] } {
    return { completed: ALL_QUEST_IDS.filter((id) => this.completed.has(id)) };
  }

  load(data: unknown): void {
    this.completed.clear();
    this.unlocked.clear();
    this.unlocked.add('firewood');
    if (data && typeof data === 'object' && Array.isArray((data as { completed?: unknown }).completed)) {
      for (const id of (data as { completed: unknown[] }).completed) {
        if (typeof id === 'string' && id in QUESTS) this.completed.add(id as QuestId);
      }
    }
    this.refreshUnlocks();
  }
}
