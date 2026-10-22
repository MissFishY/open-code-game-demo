/**
 * Time and weather.
 *
 * The island keeps a simple rhythm: four phases per day, and the weather is
 * rolled fresh every morning. Everything here is pure logic so it can be unit
 * tested, and the world reacts through the `TimeSystem` events.
 *
 * Weather is deterministic for a given day number, so reloading a save
 * always gives the same morning.
 *
 * The day is deliberately short — ten minutes — so that one session is one
 * "chapter" of island life. The night is the longest phase because the
 * moonfish only surfaces on a calm night.
 */

export type DayPhase = 'morning' | 'day' | 'evening' | 'night';
export type Weather = 'clear' | 'rain' | 'wind';

export const PHASE_ORDER: readonly DayPhase[] = ['morning', 'day', 'evening', 'night'];

/** How long each phase lasts in real seconds. */
export const PHASE_SECONDS: Record<DayPhase, number> = {
  morning: 120,
  day: 120,
  evening: 120,
  night: 240,
};

export const PHASE_LABELS: Record<DayPhase, string> = {
  morning: '清晨',
  day: '白天',
  evening: '傍晚',
  night: '夜晚',
};

export const WEATHER_LABELS: Record<Weather, string> = {
  clear: '晴',
  rain: '雨',
  wind: '风',
};

export interface TimeSnapshot {
  day: number;
  phase: DayPhase;
  weather: Weather;
}

/** Stable hash so a given day always has the same weather. */
function hashDay(day: number): number {
  let h = Math.imul(day, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class TimeSystem {
  private _day = 1;
  private _phase: DayPhase = 'morning';
  private _weather: Weather = 'clear';
  private elapsed = 0;

  /**
   * @param overrideSeconds makes every phase this long — used by the tests
   *   to move the clock quickly.
   */
  constructor(private readonly overrideSeconds?: number) {}

  get day(): number {
    return this._day;
  }

  get phase(): DayPhase {
    return this._phase;
  }

  get weather(): Weather {
    return this._weather;
  }

  get isNight(): boolean {
    return this._phase === 'night';
  }

  get isDaytime(): boolean {
    return this._phase === 'morning' || this._phase === 'day';
  }

  /** How long the current phase lasts, in seconds. */
  get phaseLength(): number {
    return this.overrideSeconds ?? PHASE_SECONDS[this._phase];
  }

  /** How long a whole day lasts, in seconds. */
  get dayLength(): number {
    if (this.overrideSeconds !== undefined) return this.overrideSeconds * PHASE_ORDER.length;
    return PHASE_ORDER.reduce((sum, phase) => sum + PHASE_SECONDS[phase], 0);
  }

  /** How far through the current phase the player is, 0..1. */
  get phaseProgress(): number {
    const length = this.phaseLength;
    return length > 0 ? Math.min(1, this.elapsed / length) : 0;
  }

  /** 0 at midnight, 1 at noon — used to drive the sun position. */
  get dayProgress(): number {
    const index = PHASE_ORDER.indexOf(this._phase);
    return (index + 0.5) / PHASE_ORDER.length;
  }

  get phaseLabel(): string {
    return PHASE_LABELS[this._phase];
  }

  get weatherLabel(): string {
    return WEATHER_LABELS[this._weather];
  }

  /**
   * Advances the clock.
   * @returns the new phase when it changed, otherwise null.
   */
  update(dt: number): DayPhase | null {
    this.elapsed += dt;
    if (this.elapsed < this.phaseLength) return null;
    this.elapsed -= this.phaseLength;
    return this.advancePhase();
  }

  /** Moves to the next phase, rolling over into a new day at night. */
  advancePhase(): DayPhase {
    const index = PHASE_ORDER.indexOf(this._phase);
    const nextIndex = index + 1;
    if (nextIndex >= PHASE_ORDER.length) {
      this._day += 1;
      this._phase = PHASE_ORDER[0] as DayPhase;
      this._weather = this.rollWeather();
    } else {
      this._phase = PHASE_ORDER[nextIndex] as DayPhase;
    }
    this.elapsed = 0;
    return this._phase;
  }

  /**
   * Rests until the next morning: the night is skipped and the weather is
   * rolled for the new day.
   */
  rest(): void {
    this._day += 1;
    this._phase = PHASE_ORDER[0] as DayPhase;
    this._weather = this.rollWeather();
    this.elapsed = 0;
  }

  /** Deterministic weather for a day number. */
  private rollWeather(): Weather {
    const roll = hashDay(this._day);
    if (roll < 0.34) return 'clear';
    if (roll < 0.67) return 'rain';
    return 'wind';
  }

  snapshot(): TimeSnapshot {
    return { day: this._day, phase: this._phase, weather: this._weather };
  }

  toJSON(): TimeSnapshot {
    return this.snapshot();
  }

  load(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const raw = data as Record<string, unknown>;
    if (typeof raw.day === 'number' && Number.isFinite(raw.day) && raw.day >= 1) {
      this._day = Math.floor(raw.day);
    }
    if (typeof raw.phase === 'string' && PHASE_ORDER.includes(raw.phase as DayPhase)) {
      this._phase = raw.phase as DayPhase;
    }
    if (typeof raw.weather === 'string' && raw.weather in WEATHER_LABELS) {
      this._weather = raw.weather as Weather;
    }
    this.elapsed = 0;
  }
}
