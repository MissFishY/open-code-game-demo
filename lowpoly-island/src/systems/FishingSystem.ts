/**
 * Fishing.
 *
 * A small timing game: cast, wait for a bite, then stop a moving marker
 * inside the green band. The band is narrower for rarer fish and wider with
 * a better rod.
 *
 * Pure logic — the renderer only draws the bar.
 */

import { Rng } from '../utils/rng';
import { FISH, type FishDef } from '../data/fish';
import type { DayPhase, Weather } from './TimeSystem';

export type FishingStage =
  | 'idle'
  | 'casting'
  | 'waiting'
  | 'bite'
  | 'reeling'
  | 'caught'
  | 'lost';

export interface FishingOptions {
  habitat: 'lake' | 'sea';
  phase: DayPhase;
  weather: Weather;
  /** Percentage added to the chance of a bite (clothing bonus). */
  luck?: number;
  /** Widens the green band (clothing bonus). */
  rodPower?: number;
}

export interface FishingResult {
  ok: boolean;
  fish?: FishDef;
  reason?: 'no-bite' | 'missed' | 'too-early' | 'wrong-habitat';
}

export class FishingSystem {
  stage: FishingStage = 'idle';
  /** Position of the marker on the bar, 0..1. */
  marker = 0;
  /** Centre of the green band, 0..1. */
  target = 0.5;
  /** Width of the green band, 0..1. */
  bandWidth = 0.3;
  /** Seconds until the next stage change. */
  timer = 0;
  /** How many casts in a row. */
  casts = 0;
  /** How long the player has to react to a bite, in seconds. */
  biteWindow = 3.2;
  /** The fish that is on the line. */
  hooked: FishDef | null = null;
  /** Shown in the HUD while reeling. */
  lastResult: string = '';

  private readonly rng: Rng;
  private markerSpeed = 0.55;
  private direction: 1 | -1 = 1;
  private rodPower = 0;
  private pendingChance = 0;
  /** The options of the current cast, used when re-rolling the bite. */
  private lastOptions: FishingOptions | null = null;

  constructor(seed = 1) {
    this.rng = new Rng(seed);
  }

  /** Throws the line. */
  cast(options: FishingOptions): boolean {
    const candidates = this.candidatesFor(options);

    if (candidates.length === 0) {
      this.stage = 'lost';
      this.lastResult = '这里现在没有鱼。';
      return false;
    }

    this.casts += 1;
    this.rodPower = options.rodPower ?? 0;
    this.direction = 1;

    // The longer you fish without a catch, the more likely the next bite is.
    this.pendingChance = this.biteChance(options);
    this.lastOptions = options;
    this.hooked = null;
    this.stage = 'waiting';
    this.timer = this.rng.float(0.8, 2.6);
    this.lastResult = '等待鱼上钩……';
    return true;
  }

  /** The chance that the next wait ends in a bite. */
  private biteChance(options: FishingOptions): number {
    let appetite = 1;
    if (options.weather === 'rain') appetite -= 0.35;
    if (options.weather === 'wind') appetite -= 0.15;
    appetite += (options.luck ?? 0) / 100;
    const patience = Math.min(0.4, (this.casts - 1) * 0.15);
    return Math.min(0.97, 0.62 * appetite + patience);
  }

  private pickFish(candidates: readonly FishDef[]): FishDef {
    const total = candidates.reduce((sum, fish) => sum + fish.weight, 0);
    let roll = this.rng.next() * total;
    for (const fish of candidates) {
      roll -= fish.weight;
      if (roll <= 0) return fish;
    }
    return candidates[candidates.length - 1] as FishDef;
  }

  /** The fish that could be caught with the given options. */
  private candidatesFor(options: FishingOptions): FishDef[] {
    return FISH.filter((fish) => {
      if (fish.habitat !== options.habitat) return false;
      if (fish.phases && !fish.phases.includes(options.phase)) return false;
      if (fish.weather && !fish.weather.includes(options.weather)) return false;
      return true;
    });
  }

  /** Advances the mini-game. */
  update(dt: number): void {
    switch (this.stage) {
      case 'waiting': {
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.hooked) {
            this.stage = 'bite';
            this.timer = this.biteWindow;
            this.marker = 0;
            this.target = this.rng.float(0.25, 0.75);
            const rarity = this.hooked.rarity;
            const base = rarity === 'rare' ? 0.2 : rarity === 'uncommon' ? 0.28 : 0.36;
            this.bandWidth = Math.min(0.65, base + this.rodPower);
            this.markerSpeed = rarity === 'rare' ? 0.8 : 0.58;
            this.lastResult = '咬钩了！按 E 收线';
          } else {
            // Nothing yet — keep waiting, the fish are not in a hurry.
            if (this.lastOptions && this.rng.next() < this.pendingChance) {
              this.hooked = this.pickFish(this.candidatesFor(this.lastOptions));
            }
            this.pendingChance = this.lastOptions
              ? this.biteChance(this.lastOptions)
              : this.pendingChance;
            this.timer = this.rng.float(0.8, 2.2);
            this.lastResult = '没有动静……';
          }
        }
        break;
      }
      case 'bite': {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.stage = 'lost';
          this.lastResult = '跑掉了……';
          this.hooked = null;
        }
        break;
      }
      case 'reeling': {
        this.marker += this.markerSpeed * dt * this.direction;
        if (this.marker > 1) {
          this.marker = 1;
          this.direction = -1;
        } else if (this.marker < 0) {
          this.marker = 0;
          this.direction = 1;
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * The player tries to land the fish.
   * @param rodPower widens the band slightly
   */
  reel(rodPower = 0): FishingResult {
    if (this.stage === 'bite') {
      // Too early — the fish is not on yet.
      this.stage = 'reeling';
      this.timer = 0;
      this.lastResult = '上钩了！把标记停在绿区里';
      return { ok: false, reason: 'too-early' };
    }

    if (this.stage !== 'reeling') {
      if (this.stage === 'waiting') this.lastResult = '还没动静……再等等。';
      return { ok: false, reason: 'no-bite' };
    }

    const width = Math.min(0.6, this.bandWidth + rodPower);
    const distance = Math.abs(this.marker - this.target);
    if (distance <= width / 2) {
      const fish = this.hooked;
      this.stage = 'caught';
      this.hooked = null;
      this.casts = 0;
      this.lastResult = fish ? `钓到了 ${fish.name}！` : '钓到了！';
      return { ok: true, fish: fish ?? undefined };
    }

    this.stage = 'lost';
    this.hooked = null;
    this.lastResult = '挣脱了……';
    return { ok: false, reason: 'missed' };
  }

  /** Abandons the current attempt. */
  cancel(): void {
    this.stage = 'idle';
    this.hooked = null;
    this.timer = 0;
  }

  /** What the player should be doing right now. */
  get hint(): string {
    switch (this.stage) {
      case 'waiting':
        return '等着，鱼会咬钩的。';
      case 'bite':
        return '咬钩了！快按 E 收线！';
      case 'reeling':
        return '把标记停在绿区里，再按一次 E！';
      case 'caught':
        return '上钩了。';
      case 'lost':
        return '跑了……再抛一次？';
      default:
        return '按 E 抛竿。';
    }
  }

  /** True while the player is in the middle of a cast. */
  get isActive(): boolean {
    return this.stage === 'waiting' || this.stage === 'bite' || this.stage === 'reeling';
  }
}
