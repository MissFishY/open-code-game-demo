/**
 * The island's palette.
 *
 * Every colour in the world comes from this one file: the ground, the trees,
 * the water, the sky, the lights and the final grade. It is the "thick
 * watercolour" look picked in the art lab — soft, desaturated, a little warm,
 * with paper grain over the top.
 *
 * Colours are written the way an artist would pick them (as sRGB hex). The
 * places that need linear values (the terrain writes its own vertex colours)
 * convert them; everything else hands the hex straight to Three.js.
 */

/** Ground colours. */
export const PALETTE = {
  wetSand: 0xd8c9a6,
  sand: 0xeee0bb,
  grassLow: 0x7fa877,
  grassHigh: 0xa3c48c,
  forest: 0x6d9a6b,
  rock: 0xaaa798,
  rockDark: 0x8f8d80,
} as const;

/** Living things. */
export const FOLIAGE = {
  conifer: 0x86b184,
  broadleaf: 0x9fc78a,
  bush: 0x86b878,
  grass: 0xa3c98c,
  flower: 0xe8a0ae,
  flowerStem: 0x9cbc8d,
  trunk: 0x8a6f52,
} as const;

/** Things that wash up on the beach. */
export const SHELL = {
  scallop: 0xf0dfc4,
  conch: 0xe6cdb4,
  deep: 0xbfdcd4,
} as const;

/** Props that are not part of the natural world. */
export const MADE = {
  reed: 0xb9b45a,
  crystal: 0x9fd8d0,
} as const;

/** Sky dome, back to front. */
export const SKY = {
  top: 0x9fc0d8,
  horizon: 0xe6ebe0,
  bottom: 0xf7f2e6,
} as const;

/** Distance haze. */
export const FOG = { color: 0xe9e6da, near: 65, far: 230 } as const;

/** The one key light. */
export const SUN = { color: 0xfff3e0, intensity: 1.0 } as const;

/** Sky bounce makes the shadows blue-grey, never black. */
export const HEMI = { sky: 0xeaf2f2, ground: 0x8a9a78, intensity: 1.0 } as const;

/** A little flat fill so nothing reads as a silhouette. */
export const AMBIENT = 0.42;

/** Water: warm grey-green rather than postcard turquoise. */
export const WATER = {
  shallow: 0xa8c6c4,
  deep: 0x6f9298,
  foam: 0xf2efe4,
} as const;

/** How much the painted facets may wander from the base colour. */
export const JITTER = 0.075;

/** The final pass: softly graded, with paper grain over everything. */
export const GRADE = {
  saturation: 0.88,
  brightness: 1.09,
  contrast: 0.93,
  grain: 0.05,
  vignette: 0.14,
} as const;

/** Amplitudes for the little bits of weather animation. */
export const WEATHER = {
  /** How far the grass and the trees lean in a gale, in radians. */
  sway: 0.05,
  /** Wind speed multiplier for the greenery. */
  windSpeed: 1.6,
} as const;
