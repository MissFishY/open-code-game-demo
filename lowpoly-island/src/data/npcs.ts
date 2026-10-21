/**
 * NPC definitions and the dialogue builder.
 *
 * Dialogue is assembled from layers:
 *
 *   greet    — how they greet you right now
 *   quest    — what they want (or what they say when it is done)
 *   reactive — a line about your current state
 *   chatter  — idle talk, unlocked as you get to know them
 *
 * Every layer is filtered by conditions and by what has already been said
 * today, so the same villager never says the same thing twice in a row.
 */

import type { QuestId, QuestStatus } from '../systems/QuestSystem';
import { QUESTS } from '../systems/QuestSystem';
import type { DayPhase, Weather } from '../systems/TimeSystem';
import type { ExpansionId } from '../data/interior';
import { VOICES, type DialogueCondition, type DialogueLine, type NpcVoice } from '../data/dialogue';
import { getItem } from './items';

export type NpcId = 'tallis' | 'nell' | 'maren';

export interface NpcDef {
  id: NpcId;
  name: string;
  role: string;
  /** Main body colour of the low-poly model. */
  color: number;
  /** Trousers / accent colour. */
  accentColor: number;
  /** Skin tone. */
  skinColor: number;
  /** The quests this NPC gives, in order. The first unfinished one is active. */
  quests: QuestId[];
  /** Where the NPC stands (Y is resolved from the terrain). */
  spawn: { x: number; z: number };
  /** Said the very first time the player talks to them. */
  greeting: string;
  /** Said when the player's hut has become cosy enough to notice. */
  hutPraise: string;
  /** Shown once their quests are finished. */
  farewell: string;
  /** Their layered voice. */
  voice: NpcVoice;
}

export const NPCS: readonly NpcDef[] = [
  {
    id: 'tallis',
    name: 'Tallis',
    role: '护林员',
    color: 0x4a7c59,
    accentColor: 0x6b4a2f,
    skinColor: 0xd9a066,
    quests: ['firewood', 'homestead', 'beacon'],
    spawn: { x: 7, z: 7 },
    greeting: '你从沙滩那条路上来的。现在还愿意走的人不多了。',
    hutPraise: '我看见你屋子的烟了。那才叫一个家。',
    farewell: '灯塔现在每晚都亮着。风平的时候，你听得到。',
    voice: VOICES.tallis,
  },
  {
    id: 'nell',
    name: 'Nell',
    role: '采集者',
    color: 0xb5643c,
    accentColor: 0x3d3b52,
    skinColor: 0x8d5a3b,
    quests: ['supplies', 'raft'],
    spawn: { x: -13, z: 27 },
    greeting: '小心芦苇——好货都长在浅水边上！',
    hutPraise: '你那儿看着比我的暖和。改天傍晚我过去坐坐。',
    farewell: '木筏终于能下海了。说不定我真能看见另一片海岸。',
    voice: VOICES.nell,
  },
  {
    id: 'maren',
    name: 'Maren',
    role: '读石者',
    color: 0x5b4b8a,
    accentColor: 0x2f2a45,
    skinColor: 0xc98f5f,
    quests: ['heart', 'sister'],
    spawn: { x: 24, z: -17 },
    greeting: '小声点。岛屿的脊背在听。',
    hutPraise: '有家的石头，嗡得不一样。你给了它们一个可以倚靠的地方。',
    farewell: '一路顺风，守护者。岛交到你手上了。',
    voice: VOICES.maren,
  },
];

export function getNpc(id: string): NpcDef | undefined {
  return NPCS.find((npc) => npc.id === id);
}

export interface DialogueChoice {
  label: string;
  /** What the game should do when the player picks this line. */
  action: 'turnIn' | 'accept' | 'shop' | 'chatter' | 'close';
}

export interface DialogueNode {
  id: string;
  speaker: string;
  role: string;
  text: string;
  choices: DialogueChoice[];
  /** True when this node is a "quest turned in" resolution. */
  isResolution: boolean;
  /** The line ids that were used, so the game can remember them. */
  usedLines: string[];
}

export interface DialogueContext {
  /** The quest this conversation is about. */
  questId: QuestId;
  questStatus: QuestStatus;
  /** How many of each required item the player currently carries. */
  have: Record<string, number>;
  /** Whether the player has spoken to this NPC before. */
  talkedBefore: boolean;
  /** How cosy the player's hut is. */
  coziness: number;
  /** Trust with this villager (0..4). */
  trust: number;
  /** The phase of the day. */
  phase: DayPhase;
  /** The weather. */
  weather: Weather;
  /** The player is nearly out of stamina. */
  tired: boolean;
  /** The backpack is nearly full. */
  full: boolean;
  /** The hut has been built. */
  hutBuilt: boolean;
  /** Which expansions of the hut exist. */
  expansions: readonly ExpansionId[];
  /** Item ids the player is carrying. */
  hasItem: readonly string[];
  /** How many fish the player is carrying. */
  fishCount: number;
  /** The first conversation of the day. */
  firstToday: boolean;
  /** The personal storyline of this villager is finished. */
  storyDone: boolean;
  /** Ids of lines already used today. */
  used: readonly string[];
}

/** True when every condition of the line holds. */
export function lineMatches(line: DialogueLine, ctx: DialogueContext): boolean {
  const when: DialogueCondition | undefined = line.when;
  if (!when) return true;

  if (when.trust !== undefined && ctx.trust < when.trust) return false;
  if (when.trustBelow !== undefined && ctx.trust >= when.trustBelow) return false;
  if (when.quest !== undefined && ctx.questStatus !== when.quest) return false;
  if (when.hut !== undefined && ctx.hutBuilt !== when.hut) return false;
  if (when.expansion !== undefined && !ctx.expansions.includes(when.expansion)) return false;
  if (when.cozy !== undefined && ctx.coziness < when.cozy) return false;
  if (when.has !== undefined && !ctx.hasItem.includes(when.has)) return false;
  if (when.fish !== undefined && ctx.fishCount < when.fish) return false;
  if (when.phase !== undefined && ctx.phase !== when.phase) return false;
  if (when.weather !== undefined && ctx.weather !== when.weather) return false;
  if (when.tired !== undefined && ctx.tired !== when.tired) return false;
  if (when.full !== undefined && ctx.full !== when.full) return false;
  if (when.firstToday !== undefined && ctx.firstToday !== when.firstToday) return false;
  if (when.storyDone !== undefined && ctx.storyDone !== when.storyDone) return false;
  return true;
}

/**
 * Picks the best line for a layer: the highest weighted one that has not been
 * used today. Falls back to the best match when everything has been said.
 */
export function pickLine(
  lines: readonly DialogueLine[],
  ctx: DialogueContext,
  random: () => number = Math.random,
): DialogueLine | null {
  const matching = lines.filter((line) => lineMatches(line, ctx));
  if (matching.length === 0) return null;

  const unused = matching.filter((line) => !ctx.used.includes(line.id));
  const pool = unused.length > 0 ? unused : matching;

  // Among the unused lines, prefer the heaviest, but let the light ones show
  // up sometimes so a villager does not feel like a machine.
  const heavy = pool.filter((line) => (line.weight ?? 0) > 0);
  if (heavy.length > 0) {
    const best = heavy.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
    // 70% of the time take the heaviest, otherwise pick a random one.
    if (random() < 0.7) return best;
  }
  return pool[Math.floor(random() * pool.length)] ?? null;
}

/** Human readable requirement progress, e.g. "Wood 1/3". */
export function requirementProgress(questId: QuestId, have: Record<string, number>): string {
  const def = QUESTS[questId];
  if (def.kind === 'flag') return 'done';
  return def.requirements
    .map((req) => `${getItem(req.item).name} ${Math.min(have[req.item] ?? 0, req.qty)}/${req.qty}`)
    .join(', ');
}

/** The choices offered for the current state. */
function buildChoices(ctx: DialogueContext): DialogueChoice[] {
  const choices: DialogueChoice[] = [];

  if (ctx.questStatus === 'ready') {
    choices.push({ label: '交付', action: 'turnIn' });
    choices.push({ label: '还不到时候', action: 'close' });
    return choices;
  }

  if (ctx.questStatus === 'available') {
    choices.push({ label: '我去做', action: 'accept' });
  }
  if (ctx.questStatus === 'locked') {
    choices.push({ label: '明白了', action: 'close' });
    return choices;
  }

  choices.push({ label: '看看你的东西', action: 'shop' });
  choices.push({ label: '再聊聊', action: 'chatter' });
  choices.push({ label: '再见', action: 'close' });
  return choices;
}

/** Builds the dialogue node that should be shown for an NPC right now. */
export function buildDialogue(
  npc: NpcDef,
  ctx: DialogueContext,
  random: () => number = Math.random,
): DialogueNode {
  const def = QUESTS[ctx.questId];
  const usedLines: string[] = [];
  const parts: string[] = [];

  const push = (line: DialogueLine | null): void => {
    if (!line) return;
    parts.push(line.text);
    usedLines.push(line.id);
  };

  // 1. How they greet you.
  push(pickLine(npc.voice.greet, ctx, random));

  // 2. What they want.
  if (ctx.questStatus === 'ready') {
    parts.push(def.completeText);
  } else if (ctx.questStatus === 'available') {
    const progress = requirementProgress(ctx.questId, ctx.have);
    const progressLine = progress === 'done' ? '' : `\n\n还需要：${progress}。`;
    parts.push(
      ctx.talkedBefore
        ? `${def.intro}${progressLine}`
        : `${npc.greeting} ${def.intro}${progressLine}`,
    );
  } else if (ctx.questStatus === 'locked') {
    parts.push('这件事你该先去找另一个人。跟着岛走，别跟着地图走。');
  } else {
    parts.push(npc.farewell);
  }

  // 3. Something about right now.
  push(pickLine(npc.voice.reactive, ctx, random));

  // 4. Idle talk.
  push(pickLine(npc.voice.chatter, ctx, random));

  // 5. If the hut is cosy, they mention it.
  if (ctx.coziness >= 4 && ctx.hutBuilt && ctx.trust >= 1) {
    parts.push(npc.hutPraise);
  }

  return {
    id: `${npc.id}-${ctx.questId}-${ctx.questStatus}`,
    speaker: npc.name,
    role: npc.role,
    text: parts.join('\n\n'),
    choices: buildChoices(ctx),
    isResolution: ctx.questStatus === 'ready',
    usedLines,
  };
}

/** A short reply when the player just wants to chat. */
export function buildChatter(
  npc: NpcDef,
  ctx: DialogueContext,
  random: () => number = Math.random,
): DialogueNode {
  const line = pickLine(npc.voice.chatter, ctx, random);
  return {
    id: `${npc.id}-chatter`,
    speaker: npc.name,
    role: npc.role,
    text: line?.text ?? '...',
    choices: [{ label: '回去', action: 'close' }],
    isResolution: false,
    usedLines: line ? [line.id] : [],
  };
}
