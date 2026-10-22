import { describe, expect, it } from 'vitest';
import { FishingSystem } from '../src/systems/FishingSystem';
import { availableFish, getFish } from '../src/data/fish';

/** Plays a whole night of lake fishing and counts what came up. */
function fishTheLake(
  phase: 'morning' | 'day' | 'evening' | 'night',
  weather: 'clear' | 'rain' | 'wind',
  maxCasts = 400,
): { casts: number; catches: number; tally: Record<string, number> } {
  const fishing = new FishingSystem(20261022);
  let casts = 0;
  let catches = 0;
  const tally: Record<string, number> = {};

  while (casts < maxCasts) {
    fishing.cast({ habitat: 'lake', phase, weather });
    casts++;

    // Wait for the bite, then stop the marker perfectly in the green band.
    let guard = 0;
    while (fishing.stage !== 'bite' && guard++ < 200) fishing.update(0.25);
    if (fishing.stage !== 'bite') break;

    fishing.reel(0);
    fishing.marker = fishing.target;
    const result = fishing.reel(0);
    if (result.ok && result.fish) {
      catches++;
      tally[result.fish.id] = (tally[result.fish.id] ?? 0) + 1;
    }
    fishing.stage = 'idle';
    fishing.hooked = null;
  }

  return { casts, catches, tally };
}

describe('the moonfish', () => {
  it('exists and is a rare lake fish', () => {
    const moonfish = getFish('moonfish');
    expect(moonfish).toBeDefined();
    expect(moonfish?.habitat).toBe('lake');
    expect(moonfish?.rarity).toBe('rare');
    expect(moonfish?.value).toBeGreaterThan(10);
  });

  it('only surfaces on a calm night', () => {
    expect(availableFish('lake', 'night', 'clear').map((f) => f.id)).toContain('moonfish');
    expect(availableFish('lake', 'night', 'rain').map((f) => f.id)).not.toContain('moonfish');
    expect(availableFish('lake', 'night', 'wind').map((f) => f.id)).not.toContain('moonfish');
    expect(availableFish('lake', 'day', 'clear').map((f) => f.id)).not.toContain('moonfish');
    expect(availableFish('lake', 'morning', 'clear').map((f) => f.id)).not.toContain('moonfish');
    expect(availableFish('lake', 'evening', 'clear').map((f) => f.id)).not.toContain('moonfish');
    expect(availableFish('sea', 'night', 'clear').map((f) => f.id)).not.toContain('moonfish');
  });

  it('is rare but still findable on a clear night', () => {
    const night = fishTheLake('night', 'clear');
    const moon = night.tally['moonfish'] ?? 0;

    // It shows up, but it is genuinely rare — well under half the catches.
    expect(moon).toBeGreaterThan(0);
    expect(moon / night.catches).toBeLessThan(0.15);

    // One moonfish should not take forever: a few dozen casts at most.
    expect(night.casts / moon).toBeLessThan(40);
  });

  it('never shows up during the day', () => {
    const day = fishTheLake('day', 'clear');
    expect(day.tally['moonfish']).toBeUndefined();
  });
});
