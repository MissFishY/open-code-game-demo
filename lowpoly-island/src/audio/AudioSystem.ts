/**
 * Sound.
 *
 * Everything is synthesised with the Web Audio API — no audio files, so the
 * single-file build stays small and the music never loops audibly.
 *
 * Two buses:
 *
 *   - **Music** — a slow generative loop in the style of a cosy farming
 *     game: a soft pad, a plucked melody and a bass line that follow a
 *     four-bar progression. There is a different mood for the day, the
 *     night and indoors.
 *   - **Sound effects** — short synthesised noises for chopping, mining,
 *     fishing, picking things up, eating, crafting and so on.
 *
 * The audio context can only be started from a user gesture, so
 * {@link AudioSystem.ensureStarted} is called when the player presses a
 * button. Every method is safe to call when there is no audio at all.
 */

export type MusicMood = 'day' | 'night' | 'indoor';

export type SfxName =
  | 'chop'
  | 'mine'
  | 'pickup'
  | 'bite'
  | 'catch'
  | 'click'
  | 'eat'
  | 'craft'
  | 'quest'
  | 'coin'
  | 'deny'
  | 'place'
  | 'phase'
  | 'splash';

interface Chord {
  /** Semitones above the key root. */
  root: number;
  /** Major or minor. */
  minor: boolean;
}

interface Track {
  bpm: number;
  /** Steps per bar. */
  steps: number;
  /** The four-bar progression. */
  progression: Chord[];
  /** Lead melody: an index into the chord tones, -1 for a rest. */
  lead: number[];
  /** The lead wave. */
  wave: OscillatorType;
  padGain: number;
  leadGain: number;
  bassGain: number;
  /** Low-pass cutoff for the whole track. */
  cutoff: number;
}

const MAJOR = [0, 4, 7];
const MINOR = [0, 3, 7];

function chordTones(chord: Chord): number[] {
  const third = chord.minor ? MINOR : MAJOR;
  return [chord.root, chord.root + (third[1] as number), chord.root + (third[2] as number), chord.root + 12];
}

const TRACKS: Record<MusicMood, Track> = {
  day: {
    bpm: 92,
    steps: 8,
    progression: [
      { root: 0, minor: false },
      { root: 9, minor: true },
      { root: 5, minor: false },
      { root: 7, minor: false },
    ],
    lead: [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 0, -1, -1, -1],
    wave: 'triangle',
    padGain: 0.05,
    leadGain: 0.1,
    bassGain: 0.07,
    cutoff: 2600,
  },
  night: {
    bpm: 66,
    steps: 8,
    progression: [
      { root: 9, minor: true },
      { root: 5, minor: false },
      { root: 2, minor: true },
      { root: 7, minor: false },
    ],
    lead: [0, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1, -1, -1, 3, -1],
    wave: 'sine',
    padGain: 0.06,
    leadGain: 0.075,
    bassGain: 0.06,
    cutoff: 1500,
  },
  indoor: {
    bpm: 58,
    steps: 8,
    progression: [
      { root: 0, minor: false },
      { root: 5, minor: false },
      { root: 9, minor: true },
      { root: 7, minor: false },
    ],
    lead: [0, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1],
    wave: 'sine',
    padGain: 0.05,
    leadGain: 0.06,
    bassGain: 0.05,
    cutoff: 1200,
  },
};

/** The key everything is built on: C. */
const KEY_ROOT = 60;

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextStepTime = 0;
  private step = 0;
  private mood: MusicMood = 'day';

  private muted = false;
  private musicVolume = 0.4;
  private sfxVolume = 0.6;

  /** True once the context is running. */
  get isRunning(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get currentMood(): MusicMood {
    return this.mood;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get musicVolumeValue(): number {
    return this.muted ? 0 : this.musicVolume;
  }

  get sfxVolumeValue(): number {
    return this.muted ? 0 : this.sfxVolume;
  }

  /**
   * Creates (or resumes) the audio context.
   * Must be called from a user gesture the first time.
   */
  ensureStarted(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      typeof window !== 'undefined'
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : undefined;
    if (!Ctor) return;

    try {
      const ctx = new Ctor();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);

      const music = ctx.createGain();
      music.gain.value = this.musicVolume;
      music.connect(master);
      this.musicBus = music;

      const sfx = ctx.createGain();
      sfx.gain.value = this.sfxVolume;
      sfx.connect(master);
      this.sfxBus = sfx;

      // A little white noise for the percussive sounds.
      const length = Math.floor(ctx.sampleRate * 0.6);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;

      void ctx.resume();
      this.nextStepTime = ctx.currentTime + 0.1;
      this.startScheduler();
    } catch {
      this.ctx = null;
    }
  }

  /** Stops everything (used when the tab is hidden). */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  /** Resumes the sound after the tab comes back. */
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ------------------------------------------------------------- music

  setMood(mood: MusicMood): void {
    if (this.mood === mood) return;
    this.mood = mood;
  }

  private startScheduler(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => this.schedule(), 60);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const track = TRACKS[this.mood];
    const stepDuration = 60 / track.bpm / 2; // eighth notes

    while (this.nextStepTime < ctx.currentTime + 0.4) {
      this.playStep(track, this.step, this.nextStepTime);
      this.nextStepTime += stepDuration;
      this.step = (this.step + 1) % (track.steps * track.progression.length);
    }

    this.timer = setTimeout(() => this.schedule(), 60);
  }

  private playStep(track: Track, step: number, time: number): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;

    const bar = Math.floor(step / track.steps) % track.progression.length;
    const chord = track.progression[bar] as Chord;
    const tones = chordTones(chord);
    const inBar = step % track.steps;

    // The pad: the whole chord, swelling slowly.
    if (inBar === 0) {
      for (let i = 0; i < 3; i++) {
        this.tone({
          freq: midiToFreq(KEY_ROOT + (tones[i] as number)),
          type: 'sine',
          start: time,
          duration: (60 / track.bpm) * track.steps * 0.95,
          attack: 0.5,
          release: 0.8,
          gain: track.padGain,
          bus,
          cutoff: track.cutoff,
        });
      }
      // The bass: the root of the chord.
      this.tone({
        freq: midiToFreq(KEY_ROOT + (tones[0] as number) - 12),
        type: 'sine',
        start: time,
        duration: (60 / track.bpm) * track.steps * 0.9,
        attack: 0.02,
        release: 0.3,
        gain: track.bassGain,
        bus,
        cutoff: track.cutoff,
      });
    }

    // The lead: a plucked note from the chord.
    const pattern = track.lead;
    const degree = pattern[step % pattern.length] ?? -1;
    if (degree >= 0) {
      const tone = tones[degree % tones.length] as number;
      const octave = degree >= tones.length ? 12 : 0;
      this.tone({
        freq: midiToFreq(KEY_ROOT + tone + octave),
        type: track.wave,
        start: time,
        duration: 0.9,
        attack: 0.01,
        release: 0.45,
        gain: track.leadGain,
        bus,
        cutoff: track.cutoff,
      });
    }
  }

  // -------------------------------------------------------------- sfx

  /** Plays a short sound effect. Safe to call without audio. */
  play(name: SfxName): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    switch (name) {
      case 'chop':
        this.noise({ start: now, duration: 0.16, gain: 0.28, freq: 380, q: 1.1, bus });
        this.tone({
          freq: 150,
          type: 'sine',
          start: now,
          duration: 0.18,
          attack: 0.005,
          release: 0.12,
          gain: 0.3,
          slideTo: 70,
          bus,
        });
        break;
      case 'mine':
        this.tone({
          freq: 1400,
          type: 'square',
          start: now,
          duration: 0.07,
          attack: 0.002,
          release: 0.05,
          gain: 0.09,
          bus,
        });
        this.noise({ start: now, duration: 0.09, gain: 0.16, freq: 2600, q: 2.4, bus });
        break;
      case 'pickup':
        this.tone({
          freq: 660,
          type: 'triangle',
          start: now,
          duration: 0.1,
          attack: 0.004,
          release: 0.08,
          gain: 0.14,
          bus,
        });
        this.tone({
          freq: 880,
          type: 'triangle',
          start: now + 0.07,
          duration: 0.12,
          attack: 0.004,
          release: 0.1,
          gain: 0.13,
          bus,
        });
        break;
      case 'bite':
        this.noise({ start: now, duration: 0.3, gain: 0.22, freq: 500, q: 0.8, sweepTo: 2200, bus });
        break;
      case 'splash':
        this.noise({ start: now, duration: 0.42, gain: 0.2, freq: 900, q: 0.7, sweepTo: 260, bus });
        break;
      case 'catch':
        this.tone({
          freq: 523,
          type: 'triangle',
          start: now,
          duration: 0.14,
          attack: 0.004,
          release: 0.12,
          gain: 0.16,
          bus,
        });
        this.tone({
          freq: 784,
          type: 'triangle',
          start: now + 0.1,
          duration: 0.22,
          attack: 0.004,
          release: 0.18,
          gain: 0.15,
          bus,
        });
        break;
      case 'click':
        this.tone({
          freq: 1150,
          type: 'triangle',
          start: now,
          duration: 0.045,
          attack: 0.001,
          release: 0.035,
          gain: 0.07,
          bus,
        });
        break;
      case 'eat':
        this.noise({ start: now, duration: 0.18, gain: 0.16, freq: 700, q: 0.6, sweepTo: 320, bus });
        break;
      case 'craft':
        [523, 659, 784].forEach((freq, i) => {
          this.tone({
            freq,
            type: 'triangle',
            start: now + i * 0.07,
            duration: 0.18,
            attack: 0.004,
            release: 0.14,
            gain: 0.13,
            bus,
          });
        });
        break;
      case 'quest':
        [523, 659, 784, 1047].forEach((freq, i) => {
          this.tone({
            freq,
            type: 'triangle',
            start: now + i * 0.11,
            duration: 0.35,
            attack: 0.006,
            release: 0.3,
            gain: 0.15,
            bus,
          });
        });
        break;
      case 'coin':
        this.tone({
          freq: 1319,
          type: 'square',
          start: now,
          duration: 0.06,
          attack: 0.001,
          release: 0.05,
          gain: 0.07,
          bus,
        });
        this.tone({
          freq: 1760,
          type: 'square',
          start: now + 0.05,
          duration: 0.1,
          attack: 0.001,
          release: 0.09,
          gain: 0.06,
          bus,
        });
        break;
      case 'deny':
        this.tone({
          freq: 190,
          type: 'square',
          start: now,
          duration: 0.16,
          attack: 0.004,
          release: 0.14,
          gain: 0.1,
          slideTo: 120,
          bus,
        });
        break;
      case 'place':
        this.tone({
          freq: 110,
          type: 'sine',
          start: now,
          duration: 0.2,
          attack: 0.004,
          release: 0.16,
          gain: 0.22,
          slideTo: 70,
          bus,
        });
        break;
      case 'phase':
        this.tone({
          freq: 659,
          type: 'sine',
          start: now,
          duration: 1.1,
          attack: 0.01,
          release: 1,
          gain: 0.12,
          bus,
        });
        this.tone({
          freq: 988,
          type: 'sine',
          start: now + 0.12,
          duration: 1.2,
          attack: 0.01,
          release: 1.1,
          gain: 0.07,
          bus,
        });
        break;
    }
  }

  // ---------------------------------------------------------- helpers

  private tone(options: {
    freq: number;
    type: OscillatorType;
    start: number;
    duration: number;
    attack: number;
    release: number;
    gain: number;
    bus: AudioNode;
    slideTo?: number;
    cutoff?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = options.type;
      osc.frequency.setValueAtTime(options.freq, options.start);
      if (options.slideTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, options.slideTo),
          options.start + options.duration,
        );
      }

      const gain = ctx.createGain();
      const peak = Math.max(0.0001, options.gain);
      gain.gain.setValueAtTime(0.0001, options.start);
      gain.gain.exponentialRampToValueAtTime(peak, options.start + options.attack);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        options.start + Math.max(options.attack, options.duration),
      );

      let node: AudioNode = osc;
      if (options.cutoff) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = options.cutoff;
        osc.connect(filter);
        node = filter;
      }
      node.connect(gain);
      gain.connect(options.bus);

      osc.start(options.start);
      osc.stop(options.start + options.duration + 0.05);
    } catch {
      /* audio is a luxury, never a crash */
    }
  }

  private noise(options: {
    start: number;
    duration: number;
    gain: number;
    freq: number;
    q: number;
    sweepTo?: number;
    bus: AudioNode;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(options.freq, options.start);
      filter.Q.value = options.q;
      if (options.sweepTo !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(40, options.sweepTo),
          options.start + options.duration,
        );
      }

      const gain = ctx.createGain();
      const peak = Math.max(0.0001, options.gain);
      gain.gain.setValueAtTime(peak, options.start);
      gain.gain.exponentialRampToValueAtTime(0.0001, options.start + options.duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(options.bus);

      source.start(options.start);
      source.stop(options.start + options.duration + 0.02);
    } catch {
      /* ignore */
    }
  }

  // ---------------------------------------------------------- volume

  setMusicVolume(value: number): void {
    this.musicVolume = Math.max(0, Math.min(1, value));
    if (this.musicBus) {
      this.musicBus.gain.value = this.muted ? 0 : this.musicVolume;
    }
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, value));
    if (this.sfxBus) {
      this.sfxBus.gain.value = this.muted ? 0 : this.sfxVolume;
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.musicBus) {
      this.musicBus.gain.value = this.muted ? 0 : this.musicVolume;
    }
    if (this.sfxBus) {
      this.sfxBus.gain.value = this.muted ? 0 : this.sfxVolume;
    }
    return this.muted;
  }
}

/** The one audio system the game uses. */
export const audio = new AudioSystem();
