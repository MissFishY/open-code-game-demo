/**
 * Local save system.
 *
 * The whole game state is serialised to JSON in `localStorage`. There are
 * three manual slots; the autosave writes to whichever slot is currently
 * selected, so a player can keep one "main" run and experiment in another.
 *
 * The storage backend is abstracted behind `StorageLike` so the system can be
 * unit tested with an in-memory fake.
 */

import { SAVE } from '../config';
import type { QuestId } from '../systems/QuestSystem';
import { QUESTS } from '../systems/QuestSystem';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveData {
  version: number;
  savedAt: number;
  player: {
    position: [number, number, number];
    yaw: number;
    pitch: number;
  };
  inventory: Record<string, number>;
  quests: { completed: QuestId[] };
  /** Ids of resource nodes that have already been harvested. */
  harvested: string[];
  /** Ids of structures the player has finished building. */
  build: { built: string[] };
  /** Decorations standing around the hut. */
  decorations: { placements: { slot: string; type: string }[]; claimed: number[] };
  /** Furniture and expansions inside the hut. */
  interior: { furniture: { slot: string; id: string }[]; expansions: string[] };
  /** Clothing the player owns. */
  wardrobe: { owned: string[] };
  /** Coins, tool levels and things already bought. */
  market: { coins: number; tools: Record<string, number>; wear: Record<string, number>; bought: string[] };
  /** Friendship with each villager. */
  trust: Record<string, number>;
  /** The clock and the weather. */
  time: { day: number; phase: string; weather: string };
  /** How much stamina the player has left. */
  stamina: { current: number; max: number };
  flags: Record<string, boolean>;
  playTime: number;
  seenIntro: boolean;
}

/** How many save slots the player gets. */
export const SLOT_COUNT = 3;

/** A short summary of one slot, for the save panel. */
export interface SlotSummary {
  slot: number;
  exists: boolean;
  day?: number;
  phase?: string;
  weather?: string;
  playTime?: number;
  questsCompleted?: number;
  savedAt?: number;
}

export function createDefaultSave(): SaveData {
  return {
    version: SAVE.version,
    savedAt: Date.now(),
    player: { position: [0, 0, 0], yaw: 0, pitch: 0 },
    inventory: {},
    quests: { completed: [] },
    harvested: [],
    build: { built: [] },
    decorations: { placements: [], claimed: [] },
    interior: { furniture: [], expansions: [] },
    wardrobe: { owned: [] },
    market: { coins: 0, tools: { axe: 0, pickaxe: 0, rod: 0 }, wear: { axe: 0, pickaxe: 0, rod: 0 }, bought: [] },
    trust: { tallis: 0, nell: 0, maren: 0 },
    time: { day: 1, phase: 'morning', weather: 'clear' },
    stamina: { current: 100, max: 100 },
    flags: {},
    playTime: 0,
    seenIntro: false,
  };
}

/** In-memory storage, used in tests and as a fallback when localStorage fails. */
export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates and repairs an arbitrary parsed object into a `SaveData`.
 * Never throws: broken saves are downgraded to a fresh game rather than
 * crashing the game loop.
 */
export function sanitizeSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const version = isFiniteNumber(data.version) ? Math.floor(data.version) : 0;
  if (version > SAVE.version) {
    // Save from a newer build — we cannot read it safely.
    return null;
  }

  const fallback = createDefaultSave();
  const out: SaveData = {
    version: SAVE.version,
    savedAt: isFiniteNumber(data.savedAt) ? data.savedAt : Date.now(),
    player: { position: [0, 0, 0], yaw: 0, pitch: 0 },
    inventory: {},
    quests: { completed: [] },
    harvested: [],
    build: { built: [] },
    decorations: { placements: [], claimed: [] },
    interior: { furniture: [], expansions: [] },
    wardrobe: { owned: [] },
    market: {
      coins: 0,
      tools: { axe: 0, pickaxe: 0, rod: 0 },
      wear: { axe: 0, pickaxe: 0, rod: 0 },
      bought: [],
    },
    trust: { tallis: 0, nell: 0, maren: 0 },
    time: { day: 1, phase: 'morning', weather: 'clear' },
    stamina: { current: 100, max: 100 },
    flags: {},
    playTime: 0,
    seenIntro: false,
  };

  const player = data.player as Record<string, unknown> | undefined;
  if (player) {
    const position = player.position;
    if (Array.isArray(position) && position.length === 3 && position.every(isFiniteNumber)) {
      out.player.position = [position[0] as number, position[1] as number, position[2] as number];
    }
    if (isFiniteNumber(player.yaw)) out.player.yaw = player.yaw;
    if (isFiniteNumber(player.pitch)) out.player.pitch = player.pitch;
  }

  if (data.inventory && typeof data.inventory === 'object') {
    for (const [id, value] of Object.entries(data.inventory as Record<string, unknown>)) {
      if (isFiniteNumber(value) && value > 0) out.inventory[id] = Math.floor(value);
    }
  }

  const quests = data.quests as Record<string, unknown> | undefined;
  if (quests && Array.isArray(quests.completed)) {
    for (const id of quests.completed) {
      if (typeof id === 'string' && id in QUESTS) out.quests.completed.push(id as QuestId);
    }
  }

  if (Array.isArray(data.harvested)) {
    for (const id of data.harvested) {
      if (typeof id === 'string') out.harvested.push(id);
    }
  }

  const build = data.build as Record<string, unknown> | undefined;
  if (build && Array.isArray(build.built)) {
    for (const id of build.built) {
      if (typeof id === 'string') out.build.built.push(id);
    }
  }

  const decorations = data.decorations as Record<string, unknown> | undefined;
  if (decorations) {
    if (Array.isArray(decorations.placements)) {
      for (const entry of decorations.placements) {
        if (!entry || typeof entry !== 'object') continue;
        const slot = (entry as { slot?: unknown }).slot;
        const type = (entry as { type?: unknown }).type;
        if (typeof slot === 'string' && typeof type === 'string') {
          out.decorations.placements.push({ slot, type });
        }
      }
    }
    if (Array.isArray(decorations.claimed)) {
      for (const value of decorations.claimed) {
        if (typeof value === 'number') out.decorations.claimed.push(value);
      }
    }
  }

  const interior = data.interior as Record<string, unknown> | undefined;
  if (interior) {
    if (Array.isArray(interior.furniture)) {
      for (const entry of interior.furniture) {
        if (!entry || typeof entry !== 'object') continue;
        const slot = (entry as { slot?: unknown }).slot;
        const id = (entry as { id?: unknown }).id;
        if (typeof slot === 'string' && typeof id === 'string') {
          out.interior.furniture.push({ slot, id });
        }
      }
    }
    if (Array.isArray(interior.expansions)) {
      for (const id of interior.expansions) {
        if (typeof id === 'string') out.interior.expansions.push(id);
      }
    }
  }

  const wardrobe = data.wardrobe as Record<string, unknown> | undefined;
  if (wardrobe && Array.isArray(wardrobe.owned)) {
    for (const id of wardrobe.owned) {
      if (typeof id === 'string') out.wardrobe.owned.push(id);
    }
  }

  const market = data.market as Record<string, unknown> | undefined;
  if (market) {
    if (isFiniteNumber(market.coins)) out.market.coins = Math.max(0, Math.floor(market.coins));
    const tools = market.tools as Record<string, unknown> | undefined;
    if (tools && typeof tools === 'object') {
      for (const tool of ['axe', 'pickaxe', 'rod']) {
        const value = tools[tool];
        if (isFiniteNumber(value)) out.market.tools[tool] = Math.max(0, Math.min(3, Math.floor(value)));
      }
    }
    const wear = market.wear as Record<string, unknown> | undefined;
    if (wear && typeof wear === 'object') {
      for (const tool of ['axe', 'pickaxe', 'rod']) {
        const value = wear[tool];
        if (isFiniteNumber(value)) out.market.wear[tool] = Math.max(0, Math.floor(value));
      }
    }
    if (Array.isArray(market.bought)) {
      for (const id of market.bought) {
        if (typeof id === 'string') out.market.bought.push(id);
      }
    }
  }

  const trust = data.trust as Record<string, unknown> | undefined;
  if (trust && typeof trust === 'object') {
    for (const npc of ['tallis', 'nell', 'maren']) {
      const value = trust[npc];
      if (isFiniteNumber(value)) out.trust[npc] = Math.max(0, Math.min(4, Math.floor(value)));
    }
  }

  const time = data.time as Record<string, unknown> | undefined;
  if (time && typeof time === 'object') {
    if (isFiniteNumber(time.day)) out.time.day = Math.max(1, Math.floor(time.day));
    if (typeof time.phase === 'string') out.time.phase = time.phase;
    if (typeof time.weather === 'string') out.time.weather = time.weather;
  }

  const stamina = data.stamina as Record<string, unknown> | undefined;
  if (stamina && typeof stamina === 'object') {
    if (isFiniteNumber(stamina.max)) out.stamina.max = Math.max(1, Math.floor(stamina.max));
    if (isFiniteNumber(stamina.current)) {
      out.stamina.current = Math.max(0, Math.min(out.stamina.max, Math.floor(stamina.current)));
    }
  }

  if (data.flags && typeof data.flags === 'object') {
    for (const [key, value] of Object.entries(data.flags as Record<string, unknown>)) {
      if (typeof value === 'boolean') out.flags[key] = value;
    }
  }

  if (isFiniteNumber(data.playTime) && data.playTime > 0) out.playTime = data.playTime;
  out.seenIntro = data.seenIntro === true;

  // A save with no position is useless — fall back to the spawn point.
  if (
    out.player.position[0] === 0 &&
    out.player.position[1] === 0 &&
    out.player.position[2] === 0
  ) {
    out.player.position = [...fallback.player.position] as [number, number, number];
  }

  return out;
}

export class SaveSystem {
  /** The slot the autosave writes to. */
  private slot = 1;

  constructor(
    private readonly storage: StorageLike,
    private readonly key: string = SAVE.key,
  ) {}

  get currentSlot(): number {
    return this.slot;
  }

  set currentSlot(slot: number) {
    this.slot = Math.max(1, Math.min(SLOT_COUNT, Math.floor(slot)));
  }

  private slotKey(slot: number): string {
    return `${this.key}.slot${slot}`;
  }

  /** Writes a save into a slot. */
  saveTo(slot: number, data: SaveData): boolean {
    try {
      const payload: SaveData = { ...data, version: SAVE.version, savedAt: Date.now() };
      this.storage.setItem(this.slotKey(slot), JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  /** Reads a save from a slot. */
  loadFrom(slot: number): SaveData | null {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.slotKey(slot));
      // A save from before the slot system lived in the plain key.
      if (raw === null && slot === 1) raw = this.storage.getItem(this.key);
    } catch {
      return null;
    }
    if (!raw) return null;

    try {
      return sanitizeSave(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  /** Removes a slot. */
  deleteSlot(slot: number): void {
    try {
      this.storage.removeItem(this.slotKey(slot));
      if (slot === 1) this.storage.removeItem(this.key);
    } catch {
      /* nothing we can do */
    }
  }

  /** A short summary of every slot, for the save panel. */
  listSlots(): SlotSummary[] {
    const slots: SlotSummary[] = [];
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      const data = this.loadFrom(slot);
      if (!data) {
        slots.push({ slot, exists: false });
        continue;
      }
      slots.push({
        slot,
        exists: true,
        day: data.time.day,
        phase: data.time.phase,
        weather: data.time.weather,
        playTime: data.playTime,
        questsCompleted: data.quests.completed.length,
        savedAt: data.savedAt,
      });
    }
    return slots;
  }

  /** The most recent save across all slots. */
  loadMostRecent(): SaveData | null {
    let best: SaveData | null = null;
    for (const slot of this.listSlots()) {
      if (!slot.exists) continue;
      const data = this.loadFrom(slot.slot);
      if (!data) continue;
      if (!best || data.savedAt >= best.savedAt) best = data;
    }
    return best;
  }

  /** True when a save exists in any slot. */
  hasAnySave(): boolean {
    return this.listSlots().some((slot) => slot.exists);
  }

  /** Writes to the current slot. */
  save(data: SaveData): boolean {
    return this.saveTo(this.slot, data);
  }

  /** Reads from the current slot. */
  load(): SaveData | null {
    return this.loadFrom(this.slot);
  }

  /** Removes the current slot. */
  clear(): void {
    this.deleteSlot(this.slot);
  }
}

/** Wraps the browser's localStorage, falling back to memory when unavailable
 *  (private browsing mode, disabled storage, ...). */
export function createBrowserStorage(): StorageLike {
  try {
    const probe = '__island_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStorage();
  }
}
