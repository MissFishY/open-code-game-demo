/**
 * Deterministic pseudo random number generation.
 *
 * The world must be identical every time the game boots, otherwise harvested
 * resources could not be restored correctly from a save file. Everything here
 * is therefore seeded and free of `Math.random`.
 */

/** mulberry32 — small, fast, good enough for world generation. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with an empty array');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** True with the given probability (0..1). */
  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /** Roughly gaussian value in [-1, 1] (sum of 3 uniforms, centred). */
  signed(): number {
    return (this.next() + this.next() + this.next()) / 1.5 - 1;
  }
}

/** Stable 32-bit hash of a string, used to derive per-system seeds. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
