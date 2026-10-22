import { describe, expect, it } from 'vitest';
import { SatietySystem, SATIETY_EFFECTS } from '../src/systems/SatietySystem';
import { MarketSystem } from '../src/systems/MarketSystem';
import { Inventory } from '../src/systems/InventorySystem';
import {
  DAILY_FISH_LIMIT,
  TRUST_REWARDS,
  trustDiscount,
  trustRewardFor,
  fishPrice,
  BUYERS,
} from '../src/data/shop';
import { getFish } from '../src/data/fish';

describe('hunger', () => {
  it('has four stages', () => {
    const satiety = new SatietySystem();
    expect(satiety.state).toBe('full');
    satiety.drain(50);
    expect(satiety.state).toBe('peckish');
    satiety.drain(25);
    expect(satiety.state).toBe('hungry');
    satiety.drain(20);
    expect(satiety.state).toBe('weak');
  });

  it('rewards a full stomach', () => {
    expect(SATIETY_EFFECTS.full.regen).toBeGreaterThan(1);
  });

  it('slows the traveller down when hungry', () => {
    expect(SATIETY_EFFECTS.peckish.speed).toBeLessThan(1);
    expect(SATIETY_EFFECTS.hungry.speed).toBeLessThan(SATIETY_EFFECTS.peckish.speed);
    expect(SATIETY_EFFECTS.weak.speed).toBeLessThan(SATIETY_EFFECTS.hungry.speed);
  });

  it('stops the sprint and the work when empty', () => {
    expect(SATIETY_EFFECTS.hungry.canSprint).toBe(false);
    expect(SATIETY_EFFECTS.weak.canSprint).toBe(false);
    expect(SATIETY_EFFECTS.weak.canWork).toBe(false);
    // But you can still walk about and pick berries.
    expect(SATIETY_EFFECTS.weak.speed).toBeGreaterThan(0);
  });

  it('halves the stamina ceiling when empty', () => {
    expect(SATIETY_EFFECTS.weak.maxFactor).toBe(0.5);
    expect(SATIETY_EFFECTS.hungry.maxFactor).toBe(1);
  });
});

describe('the market', () => {
  it('only buys so many fish a day', () => {
    const market = new MarketSystem(0);
    const inventory = new Inventory();
    inventory.add('perch', 20);

    expect(market.fishLeftToday('tallis')).toBe(DAILY_FISH_LIMIT);

    market.sellFish('perch', 1, inventory, BUYERS.tallis);
    expect(market.fishLeftToday('tallis')).toBe(DAILY_FISH_LIMIT - 1);

    // Selling more than the limit only takes what fits.
    market.sellFish('perch', 20, inventory, BUYERS.tallis);
    expect(market.fishLeftToday('tallis')).toBe(0);
    // Only what the limit allowed was taken.
    expect(inventory.count('perch')).toBe(20 - DAILY_FISH_LIMIT);
  });

  it('forgets yesterday when a new day starts', () => {
    const market = new MarketSystem(0);
    const inventory = new Inventory();
    inventory.add('perch', 20);
    market.sellFish('perch', 20, inventory, BUYERS.tallis);
    expect(market.fishLeftToday('tallis')).toBe(0);

    market.setDay(2);
    expect(market.fishLeftToday('tallis')).toBe(DAILY_FISH_LIMIT);
  });

  it('does not repair a better tool for free', () => {
    const market = new MarketSystem(0);
    market.upgradeTool('axe', 2);
    for (let i = 0; i < 10; i++) market.useTool('axe');
    const worn = market.toolRemaining('axe');
    expect(worn).toBeLessThan(market.toolDurability('axe'));

    // A quest that rewards a level 1 axe must not mend the level 2 one.
    market.upgradeTool('axe', 1);
    expect(market.toolRemaining('axe')).toBe(worn);
  });

  it('can repair a tool on purpose', () => {
    const market = new MarketSystem(0);
    market.upgradeTool('axe', 1);
    for (let i = 0; i < 10; i++) market.useTool('axe');
    market.repairTool('axe');
    expect(market.toolRemaining('axe')).toBe(market.toolDurability('axe'));
  });
});

describe('trust', () => {
  it('gives a discount once you know them', () => {
    expect(trustDiscount('nell', 'food', 0)).toBe(1);
    expect(trustDiscount('nell', 'food', 2)).toBe(1);
    expect(trustDiscount('nell', 'food', 3)).toBeLessThan(1);
  });

  it('only discounts the right things', () => {
    // Nell's discount is on food, not on Maren's hints.
    expect(trustDiscount('nell', 'hint', 4)).toBe(1);
    expect(trustDiscount('maren', 'hint', 4)).toBeLessThan(1);
  });

  it('unlocks a reward per villager', () => {
    expect(trustRewardFor('tallis', 1)).toBeUndefined();
    const reward = trustRewardFor('tallis', 2);
    expect(reward?.kind).toBe('repair');
    expect(trustRewardFor('maren', 4)?.kind).toBe('discount');
  });

  it('has a reward for every villager', () => {
    for (const npc of ['tallis', 'nell', 'maren'] as const) {
      expect(TRUST_REWARDS.some((reward) => reward.npc === npc)).toBe(true);
    }
  });
});

describe('the fishing economy', () => {
  it('keeps a night of fishing worth less than the whole shop', () => {
    // A clear night at the lake: perch, carp and a few moonfish.
    const night = { perch: 32, carp: 13, moonfish: 3 };
    const value =
      night.perch * fishPrice('perch', BUYERS.tallis, getFish('perch')?.value ?? 0) +
      night.carp * fishPrice('carp', BUYERS.nell, getFish('carp')?.value ?? 0) +
      night.moonfish *
        fishPrice('moonfish', BUYERS.maren, getFish('moonfish')?.value ?? 0);
    // The whole game costs about 684 coins.
    expect(value).toBeLessThan(350);
    expect(value).toBeGreaterThan(120);
  });

  it('makes a moonfish worth having but not a fortune', () => {
    const moon = getFish('moonfish');
    expect(moon).toBeDefined();
    expect(moon!.value).toBeGreaterThan(8);
    expect(moon!.value).toBeLessThan(20);
  });

  it('pays more for the fish a villager is after', () => {
    const plain = fishPrice('perch', BUYERS.nell, getFish('perch')?.value ?? 0);
    const wanted = fishPrice('perch', BUYERS.tallis, getFish('perch')?.value ?? 0);
    expect(wanted).toBeGreaterThan(plain);
  });
});
