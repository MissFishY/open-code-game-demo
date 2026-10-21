/**
 * Stamina.
 *
 * Sprinting, swimming and working drain it; standing still recovers it.
 * At zero you cannot sprint and swimming starts costing health-free
 * "exhaustion" — the player has to get to land.
 */

export const STAMINA = {
  baseMax: 100,
  /** Recovered per second while standing still. */
  idleRegen: 15,
  /** Recovered per second while walking. */
  walkRegen: 5,
  /** Spent per second while sprinting. */
  sprintDrain: 26,
  /** Spent per second while swimming. */
  swimDrain: 14,
  /** Spent per second while swimming under water. */
  diveDrain: 20,
  /** Spent per chop. */
  chopCost: 9,
  /** Spent per mining strike. */
  mineCost: 8,
  /** Spent per fishing cast. */
  fishCost: 5,
  /** Below this you cannot sprint. */
  sprintThreshold: 15,
} as const;

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

  /** Per-frame recovery. */
  regen(dt: number, moving: boolean): void {
    const rate = moving ? STAMINA.walkRegen : STAMINA.idleRegen;
    this.restore(rate * dt);
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
