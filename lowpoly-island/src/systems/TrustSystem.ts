/**
 * Trust between the player and each villager.
 *
 * Trust grows when you show up, finish their work and give them things.
 * It decides which layer of dialogue you hear and what they will open up
 * to you.
 *
 * Pure logic.
 */

export type NpcId = 'tallis' | 'nell' | 'maren';

export const TRUST_MAX = 4;

export class TrustSystem {
  private levels: Record<NpcId, number> = { tallis: 0, nell: 0, maren: 0 };

  /** How much the player trusts this villager (0..TRUST_MAX). */
  level(npc: NpcId): number {
    return this.levels[npc];
  }

  /** True when the trust is at least `level`. */
  has(npc: NpcId, level: number): boolean {
    return this.levels[npc] >= level;
  }

  /** Raises the trust, never above the cap. Returns the new level. */
  gain(npc: NpcId, amount = 1): number {
    const next = Math.min(TRUST_MAX, this.levels[npc] + amount);
    this.levels[npc] = next;
    return next;
  }

  /** The label for the current trust level, shown in the journal. */
  label(npc: NpcId): string {
    return ['陌生', '面熟', '熟人', '交厚', '知己'][this.levels[npc]] ?? '陌生';
  }

  toJSON(): Record<NpcId, number> {
    return { ...this.levels };
  }

  load(data: unknown): void {
    this.levels = { tallis: 0, nell: 0, maren: 0 };
    if (!data || typeof data !== 'object') return;
    const raw = data as Record<string, unknown>;
    for (const npc of ['tallis', 'nell', 'maren'] as NpcId[]) {
      const value = raw[npc];
      if (typeof value === 'number' && Number.isFinite(value)) {
        this.levels[npc] = Math.max(0, Math.min(TRUST_MAX, Math.floor(value)));
      }
    }
  }
}
