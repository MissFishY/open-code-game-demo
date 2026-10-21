/**
 * Interaction target selection.
 *
 * Pure logic: given a list of interactables and the player's state, decide
 * what the player is looking at. The renderer only has to draw the result.
 */

export type InteractableKind =
  | 'npc'
  | 'resource'
  | 'landmark'
  | 'build'
  | 'workbench'
  | 'home'
  | 'fishing';

export interface Interactable {
  id: string;
  kind: InteractableKind;
  /** World position of the target. */
  x: number;
  y: number;
  z: number;
  /** Extra reach around the target's centre. */
  radius: number;
  /** Prompt text, e.g. "Talk to Tallis". */
  label: string;
  /** False when the target cannot be used right now. */
  available: boolean;
  /**
   * Set for targets you reach by swimming or diving — you cannot really
   * "look at" something directly underneath you.
   */
  ignoreFacing?: boolean;
}

export interface InteractionContext {
  playerX: number;
  playerY: number;
  playerZ: number;
  /** Normalised forward direction of the player / camera. */
  forwardX: number;
  forwardY: number;
  forwardZ: number;
  range: number;
  facingDot: number;
}

function distance3(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Finds the interactable the player is currently aiming at.
 *
 * A target qualifies when it is within range and roughly in front of the
 * player. Among the qualifying targets the closest one wins, with a small
 * bonus for being directly in the centre of the view.
 */
export function findInteractionTarget(
  candidates: readonly Interactable[],
  ctx: InteractionContext,
): Interactable | null {
  let best: Interactable | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate.available) continue;

    const dx = candidate.x - ctx.playerX;
    const dy = candidate.y - ctx.playerY;
    const dz = candidate.z - ctx.playerZ;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const reach = ctx.range + candidate.radius;
    if (distance > reach) continue;

    const invDistance = distance > 1e-5 ? 1 / distance : 0;
    const dot =
      (dx * invDistance) * ctx.forwardX +
      (dy * invDistance) * ctx.forwardY +
      (dz * invDistance) * ctx.forwardZ;

    if (!candidate.ignoreFacing && dot < ctx.facingDot) continue;

    // Prefer close targets, and among those the ones more centred on screen.
    const score = distance - dot * 1.5;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

/** Straight-line distance between a player and a target (helper for UI). */
export function distanceToTarget(target: Interactable, px: number, py: number, pz: number): number {
  return distance3(px, py, pz, target.x, target.y, target.z);
}
