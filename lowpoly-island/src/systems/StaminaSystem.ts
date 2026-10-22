/**
 * Stamina.
 *
 * Sprinting, swimming and working drain it; standing still recovers it.
 * At zero you cannot sprint and swimming starts costing health-free
 * "exhaustion" — the player has to get to land.
 *
 * The ceiling is small on purpose: stamina is a resource you spend, not a
 * number that is always full. It is lowered by an empty stomach and by
 * staying up all night (see `Game.sleepDebt`).
 */

export const STAMINA = {
  baseMax: 60,
  /** Recovered per second while standing still. */
  idleRegen: 4,
  /** Recovered per second while walking. */
  walkRegen: 1.5,
  /** Spent per second while sprinting. */
  sprintDrain: 18,
  /** Spent per second while swimming. */
  swimDrain: 14,
  /** Spent per second while swimming under water. */
  diveDrain: 26,
  /** Spent per chop with bare hands. A tool costs much less. */
  chopCost: 25,
  /** Spent per mining strike with bare hands. A tool costs much less. */
  mineCost: 22,
  /** Spent per fishing cast. */
  fishCost: 7,
  /** Spent per light gathering (reeds, berries, flowers). */
  forageCost: 4,
  /** Spent per dive for a deep shell. */
  shellCost: 8,
  /** Below this you cannot sprint. */
  sprintThreshold: 10,
  /** The ceiling never drops below this, however tired you are. */
  minMax: 30,
  /** The ceiling lost for every night spent without sleeping. */
  sleepPenalty: 5,
  /** Seconds you can stay under water with nothing left before Nell pulls
   *  you out. */
  drownLimit: 10,
} as const;

/**
 * Works out how much stamina the traveller can hold.
 *
 * An empty stomach scales the natural ceiling down; every night spent awake
 * then takes a flat bite out of it. The result never falls below `minMax`.
 */
export function staminaCeiling(
  base: number,
  bonus: number,
  sleepDebt: number,
  starvingFactor: number,
): number {
  const raw = (base + bonus) * starvingFactor - sleepDebt * STAMINA.sleepPenalty;
  return Math.max(STAMINA.minMax, Math.round(raw));
}

export class StaminaSystem {
  private _current: number;
  private _max: number;

  constructor(max: number = STAMINA.baseMax) {
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

  /** True when there is not enough left to keep going. */
  get isExhausted(): boolean {
    return this._current <= 0.01;
  }

  /** True when there is just enough left to start sprinting. */
  get canSprint(): boolean {
    return this._current > STAMINA.sprintThreshold;
  }

  /** Raises the maximum (clothing bonuses) and keeps the current amount. */
  setMax(max: number): void {
    this._max = Math.max(1, max);
    this._current = Math.min(this._current, this._max);
  }

  /** Spends stamina. Returns how much was actually spent. */
  drain(amount: number): number {
    if (amount <= 0) return 0;
    const spent = Math.min(this._current, amount);
    this._current -= spent;
    return spent;
  }

  /** Recovers stamina. */
  restore(amount: number): void {
    if (amount <= 0) return;
    this._current = Math.min(this._max, this._current + amount);
  }

  /** Refills completely (resting). */
  refill(): void {
    this._current = this._max;
  }

  /**
   * Per-frame recovery.
   * @param factor scales the recovery — an empty stomach halves it.
   */
  regen(dt: number, moving: boolean, factor = 1): void {
    const rate = moving ? STAMINA.walkRegen : STAMINA.idleRegen;
    this.restore(rate * factor * dt);
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
