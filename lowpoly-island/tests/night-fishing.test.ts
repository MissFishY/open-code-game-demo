import { describe, expect, it } from 'vitest';
import { FishingSystem } from '../src/systems/FishingSystem';
import { PHASE_SECONDS } from '../src/systems/TimeSystem';

/**
 * Plays one night of lake fishing the way a person would: waiting for the
 * bite (half a second of reaction time) and stopping the marker in the band.
 * Reports how many moonfish come up inside the night phase.
 */
function fishOneNight(seconds: number, reactionTime = 0.5): { moonfish: number; casts: number; caught: number } {
  const fishing = new FishingSystem(20261022);
  let time = 0;
  let casts = 0;
  let caught = 0;
  let moonfish = 0;
  const step = 1 / 30;

  while (time < seconds) {
    if (fishing.stage === 'idle') {
      fishing.cast({ habitat: 'lake', phase: 'night', weather: 'clear' });
      casts++;
    }
    fishing.update(step);
    time += step;

    if (fishing.stage === 'bite') {
      // The player needs a moment to press the button.
      const reactUntil = time + reactionTime;
      while (time < reactUntil) {
        fishing.update(step);
        time += step;
        if (fishing.stage !== 'bite') break;
      }
      if (fishing.stage === 'bite') {
        fishing.reel(0);
        fishing.marker = fishing.target;
        const result = fishing.reel(0);
        if (result.ok && result.fish) {
          caught++;
          if (result.fish.id === 'moonfish') moonfish++;
        }
      }
    }
    if (fishing.stage === 'caught' || fishing.stage === 'lost') {
      fishing.stage = 'idle';
      fishing.hooked = null;
    }
  }

  return { moonfish, casts, caught };
}

describe('fishing a whole night', () => {
  it('reliably produces moonfish on a clear night', () => {
    const night = PHASE_SECONDS.night;
    const result = fishOneNight(night);

    // A clear night has to be enough to land at least one moonfish — it is a
    // required item for Maren's quest.
    expect(result.casts).toBeGreaterThan(20);
    expect(result.moonfish).toBeGreaterThanOrEqual(1);
  });

  it('would still produce moonfish if the night were a little shorter', () => {
    // A safety margin: even at three quarters of the night there is a fish.
    const result = fishOneNight(Math.floor(PHASE_SECONDS.night * 0.75));
    expect(result.moonfish).toBeGreaterThanOrEqual(1);
  });
});
