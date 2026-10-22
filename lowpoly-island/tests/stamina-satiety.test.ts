import { describe, expect, it } from 'vitest';
import { SatietySystem, SATIETY } from '../src/systems/SatietySystem';
import { StaminaSystem, STAMINA, staminaCeiling } from '../src/systems/StaminaSystem';
import { TimeSystem, PHASE_SECONDS } from '../src/systems/TimeSystem';
import { MarketSystem } from '../src/systems/MarketSystem';
import { TOOL_LEVELS } from '../src/data/shop';
import { getItem } from '../src/data/items';
import { getShopEntry } from '../src/data/shop';

describe('satiety', () => {
  it('starts full and runs down on its own', () => {
    const satiety = new SatietySystem();
    expect(satiety.current).toBe(satiety.max);
    expect(satiety.isStarving).toBe(false);

    satiety.update(10);
    expect(satiety.current).toBeLessThan(satiety.max);
    expect(satiety.current).toBeGreaterThan(0);
  });

  it('runs down faster when you work hard', () => {
    const idle = new SatietySystem();
    const busy = new SatietySystem();
    idle.update(10);
    busy.update(10, { sprinting: true, swimming: true });
    expect(busy.current).toBeLessThan(idle.current);
  });

  it('lasts roughly one in-game day', () => {
    const satiety = new SatietySystem();
    // A whole day is 600 seconds of play.
    const day = PHASE_SECONDS.morning + PHASE_SECONDS.day + PHASE_SECONDS.evening + PHASE_SECONDS.night;
    satiety.update(day);
    // Running the whole day without eating empties the bar.
    expect(satiety.current).toBeLessThan(SATIETY.baseMax * 0.2);
  });

  it('warns when it gets low and flags the empty state', () => {
    const satiety = new SatietySystem();
    satiety.drain(SATIETY.baseMax - SATIETY.hungryAt + 1);
    expect(satiety.isHungry).toBe(true);
    expect(satiety.isStarving).toBe(false);

    satiety.drain(100);
    expect(satiety.isStarving).toBe(true);
  });

  it('round-trips through JSON', () => {
    const satiety = new SatietySystem();
    satiety.drain(40);
    const other = new SatietySystem();
    other.load(satiety.toJSON());
    expect(other.current).toBe(satiety.current);
  });
});

describe('the stamina ceiling', () => {
  it('starts at the base value', () => {
    expect(staminaCeiling(STAMINA.baseMax, 0, 0, 1)).toBe(60);
  });

  it('loses five points for every night spent awake', () => {
    expect(staminaCeiling(STAMINA.baseMax, 0, 1, 1)).toBe(55);
    expect(staminaCeiling(STAMINA.baseMax, 0, 2, 1)).toBe(50);
    expect(staminaCeiling(STAMINA.baseMax, 0, 3, 1)).toBe(45);
  });

  it('is halved by an empty stomach', () => {
    expect(staminaCeiling(STAMINA.baseMax, 0, 0, 0.5)).toBe(30);
  });

  it('never falls below the floor', () => {
    expect(staminaCeiling(STAMINA.baseMax, 0, 6, 0.5)).toBe(STAMINA.minMax);
  });

  it('counts the clothing bonus', () => {
    expect(staminaCeiling(STAMINA.baseMax, 20, 0, 1)).toBe(80);
    expect(staminaCeiling(STAMINA.baseMax, 20, 1, 1)).toBe(75);
  });
});

describe('the stamina costs', () => {
  it('makes working cost something', () => {
    expect(STAMINA.chopCost).toBeGreaterThan(0);
    expect(STAMINA.mineCost).toBeGreaterThan(0);
    expect(STAMINA.fishCost).toBeGreaterThan(0);
    expect(STAMINA.forageCost).toBeGreaterThan(0);
  });

  it('is a real chunk of the bar', () => {
    // Six chops empty the bar from the top.
    expect(STAMINA.baseMax / STAMINA.chopCost).toBeLessThanOrEqual(7);
  });

  it('recovers slowly', () => {
    const stamina = new StaminaSystem();
    stamina.drain(30);
    stamina.regen(1, false);
    // A second of standing still is not a refill.
    expect(stamina.current).toBeLessThan(40);
  });

  it('recovers even slower while walking', () => {
    const still = new StaminaSystem();
    const walking = new StaminaSystem();
    still.drain(30);
    walking.drain(30);
    still.regen(5, false);
    walking.regen(5, true);
    expect(walking.current).toBeLessThan(still.current);
  });
});

describe('the cost of a swing', () => {
  it('makes bare hands expensive', () => {
    expect(STAMINA.chopCost).toBe(25);
    expect(STAMINA.mineCost).toBe(22);
    expect(STAMINA.forageCost).toBe(4);
  });

  it('makes a tool cheaper per swing', () => {
    const market = new MarketSystem(0);
    // Bare hands.
    expect(market.toolSwingCost('axe', STAMINA.chopCost)).toBe(25);
    expect(market.toolSwingCost('pickaxe', STAMINA.mineCost)).toBe(22);

    // With a tool in hand.
    market.upgradeTool('axe', 1);
    expect(market.toolSwingCost('axe', STAMINA.chopCost)).toBe(14);
    market.upgradeTool('axe', 2);
    expect(market.toolSwingCost('axe', STAMINA.chopCost)).toBe(11);
    market.upgradeTool('axe', 3);
    expect(market.toolSwingCost('axe', STAMINA.chopCost)).toBe(8);
  });

  it('makes every tool level worth its materials', () => {
    const market = new MarketSystem(0);
    const bare = STAMINA.chopCost / 1; // one wood with bare hands
    for (const level of [1, 2, 3]) {
      market.upgradeTool('axe', level);
      const definition = TOOL_LEVELS.axe[level - 1];
      expect(definition).toBeDefined();
      // One swing gives bonus + 1 wood for staminaCost.
      const perWood = definition!.staminaCost / (definition!.bonus + 1);
      expect(perWood).toBeLessThan(bare);
    }
  });

  it('makes a tool many times more efficient than bare hands', () => {
    const market = new MarketSystem(0);
    market.upgradeTool('axe', 1);
    const definition = TOOL_LEVELS.axe[0];
    const bare = STAMINA.chopCost / 1;
    const withTool = definition!.staminaCost / (definition!.bonus + 1);
    // At least four times better.
    expect(bare / withTool).toBeGreaterThan(4);
  });

  it('recovers slowly enough that waiting has a price', () => {
    // Standing still fills an empty bar in fifteen seconds, not five.
    expect(STAMINA.idleRegen).toBe(4);
    expect(STAMINA.baseMax / STAMINA.idleRegen).toBe(15);
    // Walking barely helps.
    expect(STAMINA.walkRegen).toBeLessThan(STAMINA.idleRegen);
  });
});

describe('the day cycle', () => {
  it('is ten minutes long', () => {
    const total =
      PHASE_SECONDS.morning + PHASE_SECONDS.day + PHASE_SECONDS.evening + PHASE_SECONDS.night;
    expect(total).toBe(600);
  });

  it('gives six minutes to the day and four to the night', () => {
    const dayPart = PHASE_SECONDS.morning + PHASE_SECONDS.day + PHASE_SECONDS.evening;
    expect(dayPart).toBe(360);
    expect(PHASE_SECONDS.night).toBe(240);
  });

  it('keeps the night long enough to fish a moonfish', () => {
    // The moonfish is a quest item — the night must not be cut short.
    expect(PHASE_SECONDS.night).toBeGreaterThanOrEqual(180);
  });

  it('moves through the phases in order', () => {
    const time = new TimeSystem(PHASE_SECONDS.morning);
    expect(time.update(PHASE_SECONDS.morning + 0.01)).toBe('day');
    expect(time.update(PHASE_SECONDS.day + 0.01)).toBe('evening');
    expect(time.update(PHASE_SECONDS.evening + 0.01)).toBe('night');
  });
});

describe('food', () => {
  it('makes the shop food real items', () => {
    const hotmeal = getShopEntry('food.hotmeal');
    expect(hotmeal?.item).toBe('hotmeal');
    expect(hotmeal?.repeatable).toBe(true);

    const ration = getShopEntry('food.ration');
    expect(ration?.item).toBe('ration');
  });

  it('gives the food a stomach and an energy value', () => {
    expect(getItem('berry').food?.satiety).toBeGreaterThan(0);
    expect(getItem('hotmeal').food?.satiety).toBeGreaterThan(0);
    expect(getItem('ration').food?.satiety).toBeGreaterThan(0);
    // A hot meal is worth more than a berry.
    expect(getItem('hotmeal').food!.satiety).toBeGreaterThan(getItem('berry').food!.satiety);
  });

  it('does not make the tools edible', () => {
    expect(getItem('axe').food).toBeUndefined();
    expect(getItem('wood').food).toBeUndefined();
  });
});
