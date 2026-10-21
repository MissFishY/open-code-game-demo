import { describe, expect, it } from 'vitest';
import { Inventory } from '../src/systems/InventorySystem';
import { QUESTS, QuestSystem, QUEST_ORDER } from '../src/systems/QuestSystem';
import { NPCS, buildDialogue, getNpc } from '../src/data/npcs';
import type { DialogueContext } from '../src/data/npcs';

describe('QuestSystem', () => {
  it('starts with only the first quest unlocked', () => {
    const quests = new QuestSystem();
    expect(quests.status('firewood', new Inventory())).toBe('available');
    expect(quests.status('homestead', new Inventory())).toBe('locked');
    expect(quests.status('supplies', new Inventory())).toBe('locked');
    expect(quests.status('heart', new Inventory())).toBe('locked');
    expect(quests.currentObjective()).toBe('firewood');
  });

  it('does not allow turning in a quest without the requirements', () => {
    const quests = new QuestSystem();
    const inventory = new Inventory();
    const result = quests.turnIn('firewood', inventory);
    expect(result.ok).toBe(false);
    expect(quests.isCompleted('firewood')).toBe(false);
  });

  it('turns in a quest and consumes the items', () => {
    const quests = new QuestSystem();
    const inventory = new Inventory();
    inventory.add('wood', 3);

    const result = quests.turnIn('firewood', inventory);
    expect(result.ok).toBe(true);
    expect(inventory.count('wood')).toBe(0);
    expect(quests.isCompleted('firewood')).toBe(true);
    expect(result.granted.length).toBeGreaterThan(0);
  });

  it('unlocks the next quest in the chain', () => {
    const quests = new QuestSystem();
    const inventory = new Inventory();
    inventory.add('wood', 3);
    quests.turnIn('firewood', inventory);

    expect(quests.status('homestead', inventory)).toBe('available');
    expect(quests.currentObjective()).toBe('homestead');
  });

  it('completes the whole chain', () => {
    const quests = new QuestSystem();
    const inventory = new Inventory();

    inventory.add('wood', 3);
    quests.turnIn('firewood', inventory);

    // The hut has to stand before Tallis will sign the quest off.
    const flags = { 'hut:built': true };
    expect(quests.turnIn('homestead', inventory, flags).ok).toBe(true);

    inventory.add('fiber', 4);
    inventory.add('berry', 3);
    quests.turnIn('supplies', inventory);

    inventory.add('crystal', 3);
    quests.turnIn('heart', inventory);

    expect(quests.isComplete).toBe(true);
    expect(quests.completedCount).toBe(QUEST_ORDER.length);
    expect(quests.currentObjective()).toBeNull();
    expect(inventory.count('crown')).toBe(1);
  });

  it('reports "ready" only when the requirements are met', () => {
    const quests = new QuestSystem();
    const inventory = new Inventory();
    inventory.add('wood', 2);
    expect(quests.status('firewood', inventory)).toBe('available');
    inventory.add('wood', 1);
    expect(quests.status('firewood', inventory)).toBe('ready');
  });

  it('does not allow a quest to be turned in twice', () => {
    const quests = new QuestSystem();
    const inventory = new Inventory();
    inventory.add('wood', 3);
    quests.turnIn('firewood', inventory);
    const second = quests.turnIn('firewood', inventory);
    expect(second.ok).toBe(false);
  });

  it('round-trips through JSON', () => {
    const quests = new QuestSystem();
    const inventory = new Inventory();
    inventory.add('wood', 3);
    quests.turnIn('firewood', inventory);

    const restored = new QuestSystem();
    restored.load(quests.toJSON());
    expect(restored.isCompleted('firewood')).toBe(true);
    expect(restored.isUnlocked('homestead')).toBe(true);
  });

  it('ignores corrupt quest data', () => {
    const quests = new QuestSystem();
    quests.load({ completed: ['nope', 42, null] });
    expect(quests.completedCount).toBe(0);
    quests.load(null);
    expect(quests.completedCount).toBe(0);
  });
});

describe('flag quests', () => {
  it('is only ready once the world flag is set', () => {
    const quests = new QuestSystem();
    const inventory = new Inventory();
    inventory.add('wood', 3);
    quests.turnIn('firewood', inventory);

    expect(quests.status('homestead', inventory)).toBe('available');
    expect(quests.status('homestead', inventory, { 'hut:built': true })).toBe('ready');
  });

  it('cannot be turned in before the flag is set', () => {
    const quests = new QuestSystem();
    const inventory = new Inventory();
    inventory.add('wood', 3);
    quests.turnIn('firewood', inventory);

    const result = quests.turnIn('homestead', inventory);
    expect(result.ok).toBe(false);
    expect(quests.isCompleted('homestead')).toBe(false);
  });

  it('consumes nothing and grants the rewards when handed in', () => {
    const quests = new QuestSystem();
    const inventory = new Inventory();
    inventory.add('wood', 3);
    quests.turnIn('firewood', inventory);

    const before = inventory.toJSON();
    const result = quests.turnIn('homestead', inventory, { 'hut:built': true });

    expect(result.ok).toBe(true);
    expect(result.consumed).toHaveLength(0);
    expect(result.granted.length).toBeGreaterThan(0);
    expect(inventory.count('plank')).toBeGreaterThan(0);
    expect(inventory.count('wood')).toBe(before['wood'] ?? 0);
  });
});

/** A dialogue context with sensible defaults. */
function ctx(overrides: Partial<DialogueContext> = {}): DialogueContext {
  return {
    questId: 'firewood',
    questStatus: 'available',
    have: {},
    talkedBefore: false,
    coziness: 0,
    trust: 0,
    phase: 'morning',
    weather: 'clear',
    tired: false,
    full: false,
    hutBuilt: false,
    expansions: [],
    hasItem: [],
    fishCount: 0,
    firstToday: false,
    storyDone: false,
    used: [],
    ...overrides,
  };
}

describe('NPC definitions', () => {
  it('defines exactly three NPCs', () => {
    expect(NPCS).toHaveLength(3);
  });

  it('gives every quest exactly one giver', () => {
    for (const quest of Object.values(QUESTS)) {
      const givers = NPCS.filter((npc) => npc.quests.includes(quest.id));
      expect(givers).toHaveLength(1);
      expect(givers[0]?.id).toBe(quest.giver);
    }
  });

  it('gives every NPC at least one quest', () => {
    for (const npc of NPCS) {
      expect(npc.quests.length).toBeGreaterThan(0);
      for (const id of npc.quests) {
        expect(id in QUESTS).toBe(true);
      }
    }
  });

  it('builds different dialogue for each quest state', () => {
    const npc = getNpc('tallis');
    expect(npc).toBeDefined();
    if (!npc) return;

    const available = buildDialogue(npc, ctx({ questId: 'firewood', questStatus: 'available', have: {  wood: 0  }, talkedBefore: false }));
    expect(available.choices.some((choice) => choice.action === 'accept')).toBe(true);
    expect(available.text).toContain(npc.greeting);

    const ready = buildDialogue(npc, ctx({ questId: 'firewood', questStatus: 'ready', have: {  wood: 3  }, talkedBefore: true }));
    expect(ready.choices.some((choice) => choice.action === 'turnIn')).toBe(true);
    expect(ready.isResolution).toBe(true);

    const done = buildDialogue(npc, ctx({ questId: 'firewood', questStatus: 'done', have: {  wood: 0  }, talkedBefore: true }));
    // The farewell is part of the composed text, not the whole of it.
    expect(done.text).toContain(npc.farewell);
    expect(done.choices.length).toBeGreaterThan(0);
  });

  it('shows requirement progress in the dialogue', () => {
    const npc = getNpc('nell');
    if (!npc) return;
    const node = buildDialogue(npc, ctx({ questId: 'supplies', questStatus: 'available', have: {  fiber: 1, berry: 0  }, talkedBefore: true }));
    expect(node.text).toContain('芦苇 1/4');
    expect(node.text).toContain('浆果 0/3');
  });

  it('does not list item requirements for a flag quest', () => {
    const npc = getNpc('tallis');
    if (!npc) return;
    const node = buildDialogue(npc, ctx({ questId: 'homestead', questStatus: 'available', have: {  }, talkedBefore: true }));
    expect(node.text).not.toContain('Still needed');
  });

  it('does not ask for items when handing in a flag quest', () => {
    const npc = getNpc('tallis');
    if (!npc) return;
    const node = buildDialogue(npc, ctx({ questId: 'homestead', questStatus: 'ready', have: {  }, talkedBefore: true }));
    const turnIn = node.choices.find((choice) => choice.action === 'turnIn');
    expect(turnIn).toBeDefined();
    // A flag quest has nothing to hand over, only something to report.
    expect(node.text).not.toContain('Hand over');
  });
});
