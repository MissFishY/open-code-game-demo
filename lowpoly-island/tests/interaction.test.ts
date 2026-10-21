import { describe, expect, it } from 'vitest';
import { findInteractionTarget, type Interactable } from '../src/systems/InteractionSystem';

const context = {
  playerX: 0,
  playerY: 0,
  playerZ: 0,
  forwardX: 0,
  forwardY: 0,
  forwardZ: -1,
  range: 3,
  facingDot: 0.2,
};

function target(overrides: Partial<Interactable> = {}): Interactable {
  return {
    id: 'npc:a',
    kind: 'npc',
    x: 0,
    y: 0,
    z: -2,
    radius: 0.5,
    label: 'Talk',
    available: true,
    ...overrides,
  };
}

describe('findInteractionTarget', () => {
  it('finds a target directly in front of the player', () => {
    const found = findInteractionTarget([target()], context);
    expect(found).not.toBeNull();
    expect(found?.id).toBe('npc:a');
  });

  it('ignores targets behind the player', () => {
    const behind = target({ z: 2 });
    expect(findInteractionTarget([behind], context)).toBeNull();
  });

  it('ignores targets that are too far away', () => {
    const far = target({ z: -10 });
    expect(findInteractionTarget([far], context)).toBeNull();
  });

  it('ignores unavailable targets', () => {
    const disabled = target({ available: false });
    expect(findInteractionTarget([disabled], context)).toBeNull();
  });

  it('picks the closest target when several are in range', () => {
    const near = target({ id: 'npc:near', z: -1.2 });
    const far = target({ id: 'npc:far', z: -2.5 });
    const found = findInteractionTarget([far, near], context);
    expect(found?.id).toBe('npc:near');
  });

  it('prefers a target that is more centred over one slightly closer', () => {
    const closeButOffCentre = target({ id: 'off', x: 1.1, z: -1.6 });
    const centred = target({ id: 'centre', x: 0, z: -2.0 });
    const found = findInteractionTarget([closeButOffCentre, centred], context);
    expect(found?.id).toBe('centre');
  });

  it('respects the target radius when checking the range', () => {
    const big = target({ radius: 5, z: -6 });
    const found = findInteractionTarget([big], context);
    expect(found).not.toBeNull();
  });

  it('returns null when there are no candidates', () => {
    expect(findInteractionTarget([], context)).toBeNull();
  });

  it('ignores targets that are far off to the side', () => {
    const side = target({ x: 5, z: -0.5 });
    expect(findInteractionTarget([side], context)).toBeNull();
  });
});
