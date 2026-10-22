/**
 * NPC voices.
 *
 * The old system had three lines per villager and one fixed set of buttons,
 * so every conversation felt the same. This file replaces that with layered
 * dialogue:
 *
 *   greet    — how they greet you (depends on trust, progress, time)
 *   reactive — a line about *right now*: the weather, your mood, your house
 *   chatter  — idle talk, unlocked as you get to know them
 *
 * A line is only used when every condition in `when` holds, and lines marked
 * `once` are not repeated until the day rolls over.
 */

import type { QuestStatus } from '../systems/QuestSystem';
import type { DayPhase, Weather } from '../systems/TimeSystem';
import type { ExpansionId } from './interior';

export interface DialogueCondition {
  /** Minimum trust with this villager (0..4). */
  trust?: number;
  /** The trust must be *below* this value. */
  trustBelow?: number;
  /** The quest being talked about must be in this state. */
  quest?: QuestStatus;
  /** The hut has been built. */
  hut?: boolean;
  /** An expansion of the hut has been built. */
  expansion?: ExpansionId;
  /** Minimum coziness of the hut. */
  cozy?: number;
  /** The player must be carrying this item. */
  has?: string;
  /** Minimum number of fish carried. */
  fish?: number;
  /** Current phase of the day. */
  phase?: DayPhase;
  /** Current weather. */
  weather?: Weather;
  /** The player is nearly out of stamina. */
  tired?: boolean;
  /** The backpack is nearly full. */
  full?: boolean;
  /** The player has just woken up (first talk of the day). */
  firstToday?: boolean;
  /** A personal storyline of this villager is finished. */
  storyDone?: boolean;
}

export interface DialogueLine {
  id: string;
  text: string;
  /** Only usable when every condition holds. */
  when?: DialogueCondition;
  /** Higher wins when several lines match. */
  weight?: number;
  /** Do not say it twice on the same day. */
  once?: boolean;
}

export interface NpcVoice {
  greet: DialogueLine[];
  reactive: DialogueLine[];
  chatter: DialogueLine[];
}

export const VOICES: Record<'tallis' | 'nell' | 'maren', NpcVoice> = {
  // ------------------------------------------------------------------ Tallis
  // 冷淡、话少、只说实务。慢热，而且主要靠行动表示。
  tallis: {
    greet: [
      {
        id: 'tallis.greet.first',
        text: '你从沙滩那条路上来的。现在还愿意走的人不多了。',
        when: { trust: 0, trustBelow: 1 },
        weight: 10,
      },
      {
        id: 'tallis.greet.back',
        text: '又见面了。很好。',
        when: { trust: 1 },
      },
      {
        id: 'tallis.greet.friend',
        text: '啊，是你。没有你的这几天，岛上安静得不像话。',
        when: { trust: 3 },
      },
      {
        id: 'tallis.greet.morning',
        text: '起得早。我喜欢这样。',
        when: { phase: 'morning' },
        weight: 4,
        once: true,
      },
      {
        id: 'tallis.greet.night',
        text: '晚了。黑暗不凶，它只是诚实。',
        when: { phase: 'night' },
        weight: 4,
        once: true,
      },
      {
        id: 'tallis.greet.rain',
        text: '下雨。它把老实人留在屋里。',
        when: { weather: 'rain' },
        weight: 4,
        once: true,
      },
      {
        id: 'tallis.greet.wind',
        text: '这风今天有牙。让风落在你背后。',
        when: { weather: 'wind' },
        weight: 4,
        once: true,
      },
      { id: 'tallis.greet.default', text: '什么事。', weight: 0 },
    ],
    reactive: [
      {
        id: 'tallis.react.tired',
        text: '你眼底下发灰。先坐下，别先倒下。',
        when: { tired: true },
        weight: 10,
      },
      {
        id: 'tallis.react.full',
        text: '你的包快撑爆了。回小屋把东西放进箱子里吧。',
        when: { full: true },
        weight: 8,
        once: true,
      },
      {
        id: 'tallis.react.hut',
        text: '小屋盖起来了。我在山脊上听见的钉锤声。那屋顶不错。',
        when: { hut: true, cozy: 4 },
        weight: 7,
      },
      {
        id: 'tallis.react.expansion',
        text: '你加盖了一间。我父亲会认可的，他很难被认可。',
        when: { expansion: 'upper' },
        weight: 8,
      },
      {
        id: 'tallis.react.fish',
        text: '你带着鱼。好——灯油比火还吃鱼。',
        when: { fish: 1 },
        weight: 5,
      },
      {
        id: 'tallis.react.cold',
        text: '站近点，风在把你身上的热都拿走了。',
        when: { weather: 'rain' },
        weight: 5,
      },
    ],
    chatter: [
      {
        id: 'tallis.chatter.0',
        text: '岛有自己的主意，但它并不凶。',
        when: { trust: 0, trustBelow: 1 },
      },
      {
        id: 'tallis.chatter.1',
        text: '留意水边的芦苇。它们比风先弯。',
        when: { trust: 0, trustBelow: 1 },
      },
      {
        id: 'tallis.chatter.2',
        text: '有个自己的屋顶，会让一个地方完全变样。',
        when: { trust: 1 },
      },
      {
        id: 'tallis.chatter.3',
        text: '水上的光没有两次是一样的。大家都以为一样，其实不是。',
        when: { trust: 2 },
      },
      {
        id: 'tallis.chatter.4',
        text: '灯塔的石料是我父亲垒的。我一直以为最后会是我看着它塌。',
        when: { trust: 3 },
      },
      {
        id: 'tallis.chatter.5',
        text: '等塔重新立起来、点着火，我就不用再天天盯着它了。',
        when: { trust: 4 },
      },
    ],
  },

  // -------------------------------------------------------------------- Nell
  // 热情、话多、满脑子买卖。嘴甜心热。
  nell: {
    greet: [
      {
        id: 'nell.greet.first',
        text: '小心芦苇——好货都长在浅水边上！快进来，快进来。',
        when: { trust: 0, trustBelow: 1 },
        weight: 10,
      },
      {
        id: 'nell.greet.back',
        text: '是你！我刚才还在想你。正想着呢。',
        when: { trust: 1 },
      },
      {
        id: 'nell.greet.friend',
        text: '我最喜欢的客人！好吧——我唯一的客人。但还是！',
        when: { trust: 3 },
      },
      {
        id: 'nell.greet.morning',
        text: '早上好！鱼饿着，我也饿着。来杯咖啡就好了，鱼也行。',
        when: { phase: 'morning' },
        weight: 4,
        once: true,
      },
      {
        id: 'nell.greet.night',
        text: '这么晚！我正在给木箱盖布。今晚海吵得很。',
        when: { phase: 'night' },
        weight: 4,
        once: true,
      },
      {
        id: 'nell.greet.rain',
        text: '下雨下雨下雨。芦苇高兴，我的木筏不高兴。',
        when: { weather: 'rain' },
        weight: 4,
        once: true,
      },
      {
        id: 'nell.greet.wind',
        text: '这风！一半的收获在礁石上，另一半在网里。',
        when: { weather: 'wind' },
        weight: 4,
        once: true,
      },
      { id: 'nell.greet.default', text: '你好你好！要什么？', weight: 0 },
    ],
    reactive: [
      {
        id: 'nell.react.tired',
        text: '坐，坐！你看着像一只被拖上岸的锚。吃过了吗？没有吧。',
        when: { tired: true },
        weight: 10,
      },
      {
        id: 'nell.react.full',
        text: '这包要撑爆线了。给我看看。唉……回小屋把东西放进箱子里去吧。',
        when: { full: true },
        weight: 8,
        once: true,
      },
      {
        id: 'nell.react.hut',
        text: '你有房子了！哎，我一定要进去坐坐。你有锅吗？锅是第一样。',
        when: { hut: true, cozy: 4 },
        weight: 7,
      },
      {
        id: 'nell.react.kitchen',
        text: '有炉子啦！那就能正经做饭了。来找我，我教你怎么做好吃的。',
        when: { expansion: 'kitchen' },
        weight: 9,
      },
      {
        id: 'nell.react.fish',
        text: '鱼！你知道我抓一条鱼要多久吗？你知道吗？不知道。我不告诉你。',
        when: { fish: 1 },
        weight: 5,
      },
      {
        id: 'nell.react.cozy',
        text: '你那儿越来越有家的样子了。我不嫉妒。我有一点点嫉妒。',
        when: { cozy: 9 },
        weight: 6,
      },
    ],
    chatter: [
      {
        id: 'nell.chatter.0',
        text: '这岛上能吃的东西都长在水边。跟着绿色走就对了。',
        when: { trust: 0, trustBelow: 1 },
      },
      {
        id: 'nell.chatter.1',
        text: '靠近了，以太水晶会嗡。有人说它在回你。我说它先嗡的。',
        when: { trust: 0, trustBelow: 1 },
      },
      {
        id: 'nell.chatter.2',
        text: '木筏快好了。快了！每天都差一点，每天晚上我都睡不好。',
        when: { trust: 1 },
      },
      {
        id: 'nell.chatter.3',
        text: '大家都以为我要走。是要走。但「离开」和「走」是两个词，你知道吧。',
        when: { trust: 2 },
      },
      {
        id: 'nell.chatter.4',
        text: '我六岁起就在这块石头上。我只想有一次，看见一扇不是这扇的门。',
        when: { trust: 3 },
      },
      {
        id: 'nell.chatter.5',
        text: '你大概想问我快不快乐。我不快。但我很忙，忙也差不了太多。',
        when: { trust: 4 },
      },
    ],
  },

  // ------------------------------------------------------------------- Maren
  // 说话像谜语，答非所问。知道的比说的多。
  maren: {
    greet: [
      {
        id: 'maren.greet.first',
        text: '小声点。岛屿的脊背在听。',
        when: { trust: 0, trustBelow: 1 },
        weight: 10,
      },
      {
        id: 'maren.greet.back',
        text: '又是你。水说你会回来。水说的话很多。',
        when: { trust: 1 },
      },
      {
        id: 'maren.greet.friend',
        text: '啊。坐。我给你留了一样东西，它已经留不住自己了。',
        when: { trust: 3 },
      },
      {
        id: 'maren.greet.morning',
        text: '早晨是岛最诚实的时辰。它还没装完。',
        when: { phase: 'morning' },
        weight: 4,
        once: true,
      },
      {
        id: 'maren.greet.night',
        text: '夜里。只有这个时辰，水晶的嗡声大过海。',
        when: { phase: 'night' },
        weight: 5,
        once: true,
      },
      {
        id: 'maren.greet.rain',
        text: '下雨。湖在说一种我听不懂的话。',
        when: { weather: 'rain' },
        weight: 4,
        once: true,
      },
      {
        id: 'maren.greet.wind',
        text: '风在转。深处的什么东西也跟着在转。',
        when: { weather: 'wind' },
        weight: 4,
        once: true,
      },
      { id: 'maren.greet.default', text: '你来了。大多数人绕着走。', weight: 0 },
    ],
    reactive: [
      {
        id: 'maren.react.tired',
        text: '你在耗尽某种东西。不是气——是更老的那种。休息吧，岛会驮着你。',
        when: { tired: true },
        weight: 10,
      },
      {
        id: 'maren.react.full',
        text: '你装满了东西，却空了地方。回小屋把不急的放进箱子里吧。',
        when: { full: true },
        weight: 8,
        once: true,
      },
      {
        id: 'maren.react.hut',
        text: '你在这块石头上盖了房子。现在这些石头有地方可以倚靠了。',
        when: { hut: true, cozy: 4 },
        weight: 7,
      },
      {
        id: 'maren.react.cozy',
        text: '你那个小地方在响。不是难听的响。',
        when: { cozy: 9 },
        weight: 7,
      },
      {
        id: 'maren.react.fish',
        text: '你带着鱼。湖把它们给了你，也就是说湖跟你还没说完。',
        when: { fish: 1 },
        weight: 6,
      },
      {
        id: 'maren.react.crystal',
        text: '你包里装着那声嗡。小心它——它比看上去重。',
        when: { has: 'crystal' },
        weight: 7,
      },
    ],
    chatter: [
      {
        id: 'maren.chatter.0',
        text: '三处嗡鸣。洞穴一处，水边一处，远处的山脊一处。',
        when: { trust: 0, trustBelow: 1 },
      },
      {
        id: 'maren.chatter.1',
        text: '岛是一个长音。我们只是泛音。',
        when: { trust: 0, trustBelow: 1 },
      },
      {
        id: 'maren.chatter.2',
        text: '一个问题：月鱼梦到什么？我问过它。它不肯说。',
        when: { trust: 1 },
      },
      {
        id: 'maren.chatter.3',
        text: '我妹妹掉进湖里，没有上来。我读了三十年这座岛，它从没说过她的名字。',
        when: { trust: 2 },
      },
      {
        id: 'maren.chatter.4',
        text: '有一阵子我不读岛了。它很体贴，没有我就继续读下去。',
        when: { trust: 3 },
      },
      {
        id: 'maren.chatter.5',
        text: '她在湖底，一直举着一盏灯，等我去看她。我这就去接她。',
        when: { trust: 4 },
      },
    ],
  },
};

/** A hint Maren will sell — it points the player at something real. */
export interface HintDef {
  id: string;
  title: string;
  text: string;
  cost: number;
}

export const HINTS: readonly HintDef[] = [
  {
    id: 'hint.moonfish',
    title: '关于月鱼',
    text: '月鱼只在无风的夜里浮上来，而且只浮在湖最深的那个位置。浅水区从来没有。',
    cost: 20,
  },
  {
    id: 'hint.deepshell',
    title: '关于深海的贝壳',
    text: '湖底和海底都有贝壳，水太深够不着。除非你能游——你大概需要一件专门用来游泳的东西。',
    cost: 15,
  },
  {
    id: 'hint.crystal',
    title: '关于水晶',
    text: '一处嗡鸣在浅水边的芦苇丛里。一处躺在远山脊下。还有一处，在最老的石头中间。',
    cost: 15,
  },
  {
    id: 'hint.sister',
    title: '关于那个沉下去的人',
    text: '她掉落的东西还在下面。岛不丢东西，旅人——它只是把东西挪了个地方。',
    cost: 30,
  },
];
