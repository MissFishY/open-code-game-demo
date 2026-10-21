import { describe, expect, it } from 'vitest';
import { TimeSystem } from '../src/systems/TimeSystem';
import { StaminaSystem } from '../src/systems/StaminaSystem';
import { FishingSystem } from '../src/systems/FishingSystem';
import { MarketSystem } from '../src/systems/MarketSystem';
import { TrustSystem } from '../src/systems/TrustSystem';
import { WardrobeSystem } from '../src/systems/WardrobeSystem';
import { InteriorSystem } from '../src/systems/InteriorSystem';
import { Inventory } from '../src/systems/InventorySystem';
import { BUYERS, TOOL_LEVELS, getShopEntry } from '../src/data/shop';
import { getFish } from '../src/data/fish';
import { getExpansion } from '../src/data/interior';
import { totalBonuses } from '../src/data/clothing';

describe('TimeSystem', () => {
  it('starts on the first morning', () => {
    const time = new TimeSystem(10);
    expect(time.day).toBe(1);
    expect(time.phase).toBe('morning');
    expect(time.isDaytime).toBe(true);
    expect(time.isNight).toBe(false);
  });

  it('moves through the four phases and rolls into a new day', () => {
    const time = new TimeSystem(10);
    expect(time.update(11)).toBe('day');
    expect(time.update(11)).toBe('evening');
    expect(time.update(11)).toBe('night');
    expect(time.isNight).toBe(true);
    expect(time.update(11)).toBe('morning');
    expect(time.day).toBe(2);
  });

  it('resting skips to the next morning', () => {
    const time = new TimeSystem(10);
    time.rest();
    expect(time.day).toBe(2);
    expect(time.phase).toBe('morning');
  });

  it('gives the same weather for the same day every time', () => {
    const a = new TimeSystem(10);
    const b = new TimeSystem(10);
    a.rest();
    b.rest();
    expect(a.weather).toBe(b.weather);
  });

  it('round-trips through JSON', () => {
    const time = new TimeSystem(10);
    time.update(11);
    const snapshot = time.toJSON();
    const other = new TimeSystem(10);
    other.load(snapshot);
    expect(other.day).toBe(time.day);
    expect(other.phase).toBe(time.phase);
    expect(other.weather).toBe(time.weather);
  });
});

describe('StaminaSystem', () => {
  it('starts full', () => {
    const stamina = new StaminaSystem();
    expect(stamina.current).toBe(stamina.max);
    expect(stamina.ratio).toBe(1);
    expect(stamina.isExhausted).toBe(false);
  });

  it('drains and regenerates', () => {
    const stamina = new StaminaSystem(100);
    stamina.drain(30);
    expect(stamina.current).toBe(70);
    stamina.regen(1, false);
    expect(stamina.current).toBeGreaterThan(70);
  });

  it('never goes below zero or above the maximum', () => {
    const stamina = new StaminaSystem(100);
    stamina.drain(500);
    expect(stamina.current).toBe(0);
    expect(stamina.isExhausted).toBe(true);
    stamina.restore(500);
    expect(stamina.current).toBe(100);
  });

  it('raises the maximum for clothing', () => {
    const stamina = new StaminaSystem(100);
    stamina.setMax(120);
    expect(stamina.max).toBe(120);
    stamina.refill();
    expect(stamina.current).toBe(120);
  });

  it('will not let the player sprint when it is nearly empty', () => {
    const stamina = new StaminaSystem(100);
    expect(stamina.canSprint).toBe(true);
    stamina.drain(95);
    expect(stamina.canSprint).toBe(false);
  });

  it('round-trips through JSON', () => {
    const stamina = new StaminaSystem(100);
    stamina.drain(40);
    const other = new StaminaSystem(100);
    other.load(stamina.toJSON());
    expect(other.current).toBe(60);
  });
});

describe('FishingSystem', () => {
  it('starts idle', () => {
    const fishing = new FishingSystem(1);
    expect(fishing.stage).toBe('idle');
    expect(fishing.isActive).toBe(false);
  });

  it('refuses to cast where there are no fish', () => {
    const fishing = new FishingSystem(1);
    // The moonfish is the only night fish, so the lake in the day still has
    // other species — use an impossible habitat instead.
    const ok = fishing.cast({ habitat: 'sea', phase: 'morning', weather: 'clear' });
    expect(ok).toBe(true);
  });

  it('keeps waiting until something bites', () => {
    const fishing = new FishingSystem(7);
    fishing.cast({ habitat: 'lake', phase: 'day', weather: 'clear' });
    for (let i = 0; i < 5000 && fishing.stage === 'waiting'; i++) {
      fishing.update(0.1);
    }
    expect(fishing.stage).toBe('bite');
    expect(fishing.hooked).not.toBeNull();
  });

  it('lands the fish when the marker is in the band', () => {
    const fishing = new FishingSystem(11);
    fishing.cast({ habitat: 'lake', phase: 'day', weather: 'clear' });
    for (let i = 0; i < 5000 && fishing.stage === 'waiting'; i++) fishing.update(0.1);
    expect(fishing.stage).toBe('bite');

    // The first press sets the hook.
    const early = fishing.reel(0);
    expect(early.ok).toBe(false);
    expect(fishing.stage).toBe('reeling');

    // The second press, with the marker on target, lands it.
    fishing.marker = fishing.target;
    const landed = fishing.reel(0);
    expect(landed.ok).toBe(true);
    expect(landed.fish).toBeDefined();
  });

  it('loses the fish when the marker is outside the band', () => {
    const fishing = new FishingSystem(13);
    fishing.cast({ habitat: 'lake', phase: 'day', weather: 'clear' });
    for (let i = 0; i < 5000 && fishing.stage === 'waiting'; i++) fishing.update(0.1);
    fishing.reel(0);
    fishing.marker = fishing.target > 0.5 ? 0 : 1;
    expect(fishing.reel(0).ok).toBe(false);
    expect(fishing.stage).toBe('lost');
  });
});

describe('MarketSystem', () => {
  it('starts with a small purse so the player can buy something', () => {
    const market = new MarketSystem();
    expect(market.coins).toBeGreaterThan(0);
  });

  it('can be reset back to the starting state', () => {
    const market = new MarketSystem();
    const start = market.coins;
    market.addCoins(500);
    market.upgradeTool('rod', 2);
    market.reset();
    expect(market.coins).toBe(start);
    expect(market.toolLevel('rod')).toBe(0);
  });

  it('sells fish and pays the buyer rate', () => {
    const market = new MarketSystem(0);
    const inventory = new Inventory();
    inventory.add('perch', 2);
    const perch = getFish('perch');
    expect(perch).toBeDefined();
    if (!perch) return;

    const result = market.sellFish('perch', 2, inventory, BUYERS.nell);
    expect(result.ok).toBe(true);
    expect(result.qty).toBe(2);
    // Nell pays 0.7 of the value.
    expect(result.coins).toBe(Math.round(perch.value * 0.7) * 2);
    expect(inventory.count('perch')).toBe(0);
  });

  it('pays double for the fish a buyer is after', () => {
    const market = new MarketSystem(0);
    const inventory = new Inventory();
    inventory.add('moonfish', 1);
    const moonfish = getFish('moonfish');
    if (!moonfish) return;

    const normal = market.priceOf('moonfish', BUYERS.nell);
    const wanted = market.priceOf('moonfish', BUYERS.maren);
    expect(wanted).toBeGreaterThan(normal);
  });

  it('refuses to buy without the coins', () => {
    const market = new MarketSystem(0);
    const inventory = new Inventory();
    const entry = getShopEntry('clothing.swimsuit');
    expect(entry).toBeDefined();
    if (!entry) return;

    expect(market.canBuy(entry, inventory)).toBe(false);
    const result = market.buy(entry, inventory);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('too-expensive');
  });

  it('buys once and refuses to buy twice', () => {
    const market = new MarketSystem(0);
    const inventory = new Inventory();
    market.addCoins(100);
    const entry = getShopEntry('clothing.swimsuit');
    if (!entry) return;

    expect(market.buy(entry, inventory).ok).toBe(true);
    expect(market.coins).toBe(100 - entry.cost);
    expect(market.buy(entry, inventory).ok).toBe(false);
  });

  it('upgrades tools and remembers the level', () => {
    const market = new MarketSystem();
    expect(market.toolLevel('axe')).toBe(0);
    market.upgradeTool('axe', 2);
    expect(market.toolLevel('axe')).toBe(2);
    expect(market.toolBonus('axe')).toBe(TOOL_LEVELS.axe[1]?.bonus);
  });

  it('round-trips through JSON', () => {
    const market = new MarketSystem(0);
    market.addCoins(77);
    market.upgradeTool('rod', 2);
    const other = new MarketSystem(0);
    other.load(market.toJSON());
    expect(other.coins).toBe(77);
    expect(other.toolLevel('rod')).toBe(2);
  });
});

describe('TrustSystem', () => {
  it('starts at zero and is capped', () => {
    const trust = new TrustSystem();
    expect(trust.level('nell')).toBe(0);
    for (let i = 0; i < 10; i++) trust.gain('nell');
    expect(trust.level('nell')).toBe(4);
  });

  it('labels the levels', () => {
    const trust = new TrustSystem();
    expect(trust.label('nell')).toBe('陌生');
    trust.gain('nell', 2);
    expect(trust.label('nell')).toBe('熟人');
  });

  it('round-trips through JSON', () => {
    const trust = new TrustSystem();
    trust.gain('maren', 3);
    const other = new TrustSystem();
    other.load(trust.toJSON());
    expect(other.level('maren')).toBe(3);
  });
});

describe('WardrobeSystem', () => {
  it('starts empty', () => {
    const wardrobe = new WardrobeSystem();
    expect(wardrobe.list()).toHaveLength(0);
    expect(wardrobe.canSwim).toBe(false);
  });

  it('grants the swimming ability with the swimsuit', () => {
    const wardrobe = new WardrobeSystem();
    wardrobe.own('swimsuit');
    expect(wardrobe.canSwim).toBe(true);
  });

  it('adds the bonuses together', () => {
    const wardrobe = new WardrobeSystem();
    wardrobe.own('seaweedcloak');
    wardrobe.own('waders');
    const bonus = wardrobe.bonuses();
    expect(bonus.staminaMax).toBe(20);
    expect(bonus.staminaRegen).toBeGreaterThan(0);
  });

  it('ignores unknown items', () => {
    const wardrobe = new WardrobeSystem();
    expect(wardrobe.own('not-a-thing')).toBe(false);
    expect(wardrobe.list()).toHaveLength(0);
  });
});

describe('InteriorSystem', () => {
  const porch = getExpansion('porch');
  if (!porch) throw new Error('missing porch expansion');

  it('starts with only the base slots', () => {
    const interior = new InteriorSystem();
    expect(interior.slots()).toContain('floor-a');
    expect(interior.slots()).not.toContain('porch');
  });

  it('expands the hut and opens new slots', () => {
    const interior = new InteriorSystem();
    const inventory = new Inventory();
    inventory.add('plank', 3);
    inventory.add('rope', 2);

    expect(interior.canExpand(porch, inventory, 20)).toBe(true);
    const result = interior.expand(porch, inventory, 20);
    expect(result.ok).toBe(true);
    expect(interior.isExpanded('porch')).toBe(true);
    expect(interior.slots()).toContain('porch');
    expect(inventory.count('plank')).toBe(0);
  });

  it('refuses to expand without the materials or the coins', () => {
    const interior = new InteriorSystem();
    const inventory = new Inventory();
    expect(interior.canExpand(porch, inventory, 100)).toBe(false);
    inventory.add('plank', 3);
    inventory.add('rope', 2);
    expect(interior.canExpand(porch, inventory, 1)).toBe(false);
  });

  it('places and removes furniture', () => {
    const interior = new InteriorSystem();
    expect(interior.place('floor-a', 'bed')).toBe(true);
    expect(interior.get('floor-a')).toBe('bed');
    expect(interior.cozy).toBeGreaterThan(0);
    expect(interior.remove('floor-a')).toBe('bed');
    expect(interior.cozy).toBe(0);
  });

  it('will not put a bed on the wall', () => {
    const interior = new InteriorSystem();
    expect(interior.place('wall-a', 'bed')).toBe(false);
  });

  it('round-trips through JSON', () => {
    const interior = new InteriorSystem();
    interior.place('floor-a', 'bed');
    const other = new InteriorSystem();
    other.load(interior.toJSON());
    expect(other.get('floor-a')).toBe('bed');
  });
});

describe('clothing bonuses', () => {
  it('adds up every owned item', () => {
    const total = totalBonuses(['swimsuit', 'waders']);
    expect(total.swimsuit).toBe(true);
    expect(total.staminaRegen).toBeGreaterThan(0);
  });

  it('is empty for no items', () => {
    const total = totalBonuses([]);
    expect(total.staminaMax).toBe(0);
    expect(total.swimsuit).toBe(false);
  });
});
