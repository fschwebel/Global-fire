import { describe, expect, it } from 'vitest';
import { seasons } from '../src/sim/balance';
import { createSeason } from '../src/sim/scenario';
import type { Command, GameState } from '../src/sim/state';
import { step } from '../src/sim/step';

function hashState(s: GameState): string {
  let h = 2166136261;
  const mix = (n: number) => {
    h ^= n | 0;
    h = Math.imul(h, 16777619);
  };
  mix(s.tick);
  for (const c of s.grid) {
    mix(c.state === 'burning' ? 1 : c.state === 'burnt' ? 2 : 0);
    mix(c.intensity);
    mix(c.wetTimer);
  }
  for (const t of s.trucks) {
    mix(t.x);
    mix(t.y);
    mix(t.water);
  }
  mix(s.stats.hectaresBurnt);
  return (h >>> 0).toString(16);
}

function run(seed: number, ticks: number, commands: Map<number, Command[]> = new Map()): GameState {
  const s = createSeason(seed, 0);
  for (let i = 0; i < ticks && !s.ended; i++) step(s, commands.get(i) ?? []);
  return s;
}

describe('determinism', () => {
  it('same seed + same commands ⇒ identical end state (golden master)', () => {
    const cmds = new Map<number, Command[]>([
      [20, [{ type: 'moveTruck', truckId: 1, x: 10, y: 10 }]],
      [60, [{ type: 'moveTruck', truckId: 2, x: 30, y: 20 }]],
    ]);
    const a = run(42, 200, cmds);
    const b = run(42, 200, cmds);
    expect(hashState(a)).toBe(hashState(b));
    expect(a.stats).toEqual(b.stats);
  });

  it('different seeds diverge', () => {
    const a = run(1, 150);
    const b = run(2, 150);
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('map generation is reproducible', () => {
    const a = createSeason(7, 0);
    const b = createSeason(7, 0);
    expect(a.grid.map((c) => c.type).join()).toBe(b.grid.map((c) => c.type).join());
    expect(a.script).toEqual(b.script);
  });
});

describe('fire behaviour', () => {
  it('an unfought 2026 fire burns a meaningful area', () => {
    const s = run(42, seasons[0]!.seasonLen + 100);
    expect(s.stats.hectaresBurnt).toBeGreaterThan(10);
  });

  it('dryness is the master lever: drier seasons burn more (same seed, do-nothing)', () => {
    const dry = createSeason(42, 0);
    dry.dryness = 0.85;
    const wet = createSeason(42, 0);
    wet.dryness = 0.15;
    for (let i = 0; i < 260 && !dry.ended; i++) step(dry);
    for (let i = 0; i < 260 && !wet.ended; i++) step(wet);
    expect(dry.stats.hectaresBurnt).toBeGreaterThan(wet.stats.hectaresBurnt);
  });

  it('water and rock never burn', () => {
    const s = run(42, seasons[0]!.seasonLen + 100);
    for (const c of s.grid) {
      if (c.type === 'water' || c.type === 'rock') expect(c.state).toBe('unburnt');
    }
  });
});

describe('season lifecycle', () => {
  it('the season always ends: rains kill the last fire', () => {
    const s = createSeason(42, 0);
    const len = seasons[0]!.seasonLen;
    let events: ReturnType<typeof step> = [];
    for (let i = 0; i < len + 200 && !s.ended; i++) events = step(s);
    expect(s.ended).toBe(true);
    expect(events.some((e) => e.type === 'seasonEnded')).toBe(true);
    expect(s.grid.every((c) => c.state !== 'burning')).toBe(true);
  });

  it('2026 fire is detected quickly (called in near a road)', () => {
    const s = createSeason(42, 0);
    let detectedAt = -1;
    for (let i = 0; i < 60; i++) {
      const events = step(s);
      if (detectedAt === -1 && events.some((e) => e.type === 'fireDetected')) detectedAt = i;
    }
    expect(detectedAt).toBeGreaterThanOrEqual(0);
    expect(detectedAt).toBeLessThan(40);
  });
});

describe('trucks', () => {
  it('an ordered truck moves and fights the fire, reducing burnt area vs. do-nothing', () => {
    const idle = run(42, seasons[0]!.seasonLen + 100);

    const fought = createSeason(42, 0);
    for (let i = 0; i < seasons[0]!.seasonLen + 100 && !fought.ended; i++) {
      const cmds: Command[] = [];
      if (i % 10 === 0) {
        // Naive bot: send both trucks toward the nearest burning cell.
        for (const t of fought.trucks) {
          if (t.path.length > 0) continue;
          let best: { x: number; y: number; d: number } | null = null;
          for (let y = 0; y < fought.h; y++)
            for (let x = 0; x < fought.w; x++) {
              const c = fought.grid[y * fought.w + x]!;
              if (c.state !== 'burning') continue;
              const d = Math.abs(x - t.x) + Math.abs(y - t.y);
              if (!best || d < best.d) best = { x, y, d };
            }
          if (best && best.d > 1) {
            const tx = best.x + (t.x < best.x ? -1 : 1);
            cmds.push({ type: 'moveTruck', truckId: t.id, x: tx, y: best.y });
          }
        }
      }
      step(fought, cmds);
    }
    expect(fought.stats.hectaresBurnt).toBeLessThan(idle.stats.hectaresBurnt);
  });

  it('trucks refill at the station', () => {
    const s = createSeason(42, 0);
    const t = s.trucks[0]!;
    t.water = 0;
    for (let i = 0; i < 10; i++) step(s);
    expect(t.water).toBeGreaterThan(0);
  });
});
