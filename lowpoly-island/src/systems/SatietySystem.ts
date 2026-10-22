/**
 * Satiety.
 *
 * A second bar next to the stamina: how well fed the traveller is. It runs
 * down on its own and much faster while you are working hard.
 *
 * The bar is graded rather than on/off. Being well fed makes everything
 * work *better*; being empty makes the body give out. The only rule that
 * cannot be talked around is the lowest one — at that point you are too weak
 * to work, and have to find something to eat.
 *
 * Pure logic, unit tested.
 */

export type SatietyState = 'full' | 'peckish' | 'hungry' | 'weak';

export interface SatietyEffect {
  /** At or above this value of the bar the state applies. */
  at: number;
  /** Shown in the HUD. */
  label: string;
  /** Multiplier on the stamina recovery. */
  regen: number;
  /** Multiplier on the walking speed. */
  speed: number;
  /** Whether the traveller can still sprint. */
  canSprint: boolean;
  /** Whether the traveller can still work (chop, mine, fish). */
  canWork: boolean;
  /** Multiplier on the stamina ceiling. */
  maxFactor: number;
}

export const SATIETY = {
  baseMax: 100,
  /** Drained per second of active play. A full day is 600 seconds, so one
   *  bar runs out slightly before the day does. */
  drainPerSecond: 0.18,
  /** Extra drain per second while sprinting. */
  sprintDrain: 0.35,
  /** Extra drain per second while swimming or diving. */
  swimDrain: 0.5,
  /** Extra drain per chop / mining strike / cast. */
  workDrain: 1.2,
  /** Below this the traveller starts to feel hungry. */
  hungryAt: 30,
} as const;

/** What each stage of hunger does to you, from the top down. */
export const SATIETY_EFFECTS: Record<SatietyState, SatietyEffect> = {
  full: {
    at: 60,
    label: '精神饱满',
    regen: 1.25,
    speed: 1,
    canSprint: true,
    canWork: true,
    maxFactor: 1,
  },
  peckish: {
    at: 30,
    label: '有点饿',
    regen: 1,
    speed: 0.92,
    canSprint: true,
    canWork: true,
    maxFactor: 1,
  },
  hungry: {
    at: 10,
    label: '很饿',
    regen: 0.5,
    speed: 0.85,
    canSprint: false,
    canWork: true,
    maxFactor: 1,
  },
  weak: {
    at: 0,
    label: '虚弱',
    regen: 0.35,
    speed: 0.7,
    canSprint: false,
    canWork: false,
    maxFactor: 0.5,
  },
};

/** The states, from the best to the worst. */
export const SATIETY_ORDER: readonly SatietyState[] = ['full', 'peckish', 'hungry', 'weak'];

export interface SatietyOptions {
  sprinting?: boolean;
  swimming?: boolean;
}

export class SatietySystem {
  private _current: number;
  private _max: number;

  constructor(max: number = SATIETY.baseMax) {
    this._max = max;
    this._current = max;
  }

  get current(): number {
    return this._current;
  }

  get max(): number {
    return this._max;
  }

  /** 0..1 */
  get ratio(): number {
    return this._max > 0 ? this._current / this._max : 0;
  }

  /** True when there is nothing left in the stomach. */
  get isStarving(): boolean {
    return this._current <= 0.01;
  }

  /** True when the traveller should eat something soon. */
  get isHungry(): boolean {
    return this._current < SATIETY.hungryAt;
  }

  /** Which stage of hunger the traveller is in. */
  get state(): SatietyState {
    for (const name of SATIETY_ORDER) {
      const effect = SATIETY_EFFECTS[name];
      if (this._current >= effect.at) return name;
    }
    return 'weak';
  }

  /** What the current state does to the traveller. */
  get effect(): SatietyEffect {
    return SATIETY_EFFECTS[this.state];
  }

  /** Spends satiety. Returns how much was actually spent. */
  drain(amount: number): number {
    if (amount <= 0) return 0;
    const spent = Math.min(this._current, amount);
    this._current -= spent;
    return spent;
  }

  /** Feeds the traveller. */
  restore(amount: number): void {
    if (amount <= 0) return;
    this._current = Math.min(this._max, this._current + amount);
  }

  /** A full stomach. */
  refill(): void {
    this._current = this._max;
  }

  /** Per-frame drain. */
  update(dt: number, options: SatietyOptions = {}): void {
    let amount = SATIETY.drainPerSecond * dt;
    if (options.sprinting) amount += SATIETY.sprintDrain * dt;
    if (options.swimming) amount += SATIETY.swimDrain * dt;
    this.drain(amount);
  }

  toJSON(): { current: number; max: number } {
    return { current: this._current, max: this._max };
  }

  load(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const raw = data as Record<string, unknown>;
    if (typeof raw.max === 'number' && Number.isFinite(raw.max) && raw.max > 0) {
      this._max = raw.max;
    }
    if (typeof raw.current === 'number' && Number.isFinite(raw.current)) {
      this._current = Math.min(Math.max(0, raw.current), this._max);
    }
  }
}
