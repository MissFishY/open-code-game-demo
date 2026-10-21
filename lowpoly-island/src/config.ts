/**
 * Central tuning values for the whole game.
 * Keeping them in one place makes balance tweaks cheap and keeps magic numbers
 * out of the gameplay modules.
 */

export const WORLD = {
  /** Master seed. The entire world is generated from this, so it is stable
   *  across sessions and machines (required for save/load to make sense). */
  seed: 20260921,

  /** Radius of the island's landmass (in world units / metres). */
  islandRadius: 64,
  /** Y level of the water surface. Everything below this is underwater. */
  waterLevel: 0,
  /** Half-extent of the generated terrain mesh. Must exceed islandRadius so
   *  the underwater shelf continues past the shoreline. */
  terrainExtent: 82,
  /** Resolution of the terrain grid (quads per side). */
  terrainSegments: 132,

  /** Inland lake (a depression carved into the terrain). */
  lake: { x: -26, z: 22, radius: 15, depth: 4.2 },
} as const;

export const PLAYER = {
  walkSpeed: 6.4,
  sprintMultiplier: 1.75,
  /** Collision radius of the player's capsule (horizontal circle). */
  radius: 0.45,
  height: 1.8,
  eyeHeight: 1.5,
  /** Maximum terrain slope (radians of incline) the player can walk up. */
  maxSlope: 0.72,
  /** How deep the player may wade before being pushed back. */
  maxWadeDepth: 1.1,
  /** Acceleration/deceleration smoothing (units per second squared). */
  acceleration: 42,
  deceleration: 30,
  /** Jump impulse (world units per second). */
  jumpSpeed: 7.2,
  gravity: 24,
} as const;

export const CAMERA = {
  fov: 62,
  near: 0.1,
  far: 600,
  distance: 7.2,
  minDistance: 2.4,
  height: 1.75,
  /** Mouse sensitivity in radians per pixel. */
  sensitivity: 0.0023,
  pitchMin: -0.5,
  pitchMax: 1.15,
  /** How quickly the camera follows the player (higher = snappier). */
  followLerp: 14,
} as const;

export const INTERACTION = {
  /** Maximum distance to interact with something. */
  range: 3.4,
  /** Minimum dot product between the player's forward vector and the direction
   *  to a target for it to be considered "looked at". */
  facingDot: 0.2,
} as const;

export const ECONOMY = {
  /** The small purse the traveller arrives with. */
  startingCoins: 30,
} as const;

export const INVENTORY = {
  /** Maximum number of a single item type that can be carried. */
  maxStack: 20,
} as const;

export const SAVE = {
  key: 'lowpoly-island.save.v1',
  version: 1,
  /** How often the game autosaves (ms). */
  autosaveIntervalMs: 10_000,
} as const;

export const WORLD_LAYOUT = {
  /** Village / spawn point. Kept clear of trees. */
  spawn: { x: 0, z: 0 },
  villageClearRadius: 9,
  /** Where the player can raise the hut. */
  buildSite: { x: -8, z: -7 },
  /** The crafting bench, out in front of the village. */
  workbench: { x: 7, z: -7 },
  /** NPC home positions. Y is resolved from the terrain at build time. */
  npcSpots: {
    tallis: { x: 7, z: 7 },
    nell: { x: -13, z: 27 },
    maren: { x: 24, z: -17 },
  },
} as const;
