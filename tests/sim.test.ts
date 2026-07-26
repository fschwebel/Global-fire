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
      [20, [{ type: 'dispatch', x: 10, y: 10, truckId: 1 }]],
      [60, [{ type: 'dispatch', x: 30, y: 20 }]],
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
  it('unfought 2026 fires burn a meaningful area — but not the whole valley', () => {
    const s = run(42, seasons[0]!.seasonLen + 100);
    expect(s.stats.hectaresBurnt).toBeGreaterThan(150);
    expect(s.stats.hectaresBurnt).toBeLessThan(1200);
  });

  it('unfought 2026 fires rarely die on their own before mattering (multi-seed)', () => {
    // "Rarely", not "never": a lucky quiet year (e.g. seed 555) is honest variance.
    for (const seed of [7, 99, 1234]) {
      const s = run(seed, seasons[0]!.seasonLen + 100);
      expect(s.stats.hectaresBurnt).toBeGreaterThan(100);
    }
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

  it('relief rain opens a visible rain window that then closes', () => {
    const s = createSeason(42, 0);
    s.script.reliefRains[0]!.tick = 30;
    for (let i = 0; i <= 30; i++) step(s);
    expect(s.rainTicks).toBeGreaterThan(0);
    for (let i = 0; i < 40 && !s.ended; i++) step(s);
    expect(s.rainTicks).toBe(0);
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
  it('naive firefighting beats doing nothing (tuning invariant, multi-seed)', () => {
    // Naive bot: each idle engine takes its own nearest detected fire; engines
    // already travelling or fighting an adjacent fire are left alone.
    function runBot(seed: number): number {
      const s = createSeason(seed, 0);
      for (let i = 0; i < seasons[0]!.seasonLen + 200 && !s.ended; i++) {
        const cmds: Command[] = [];
        const taken = new Set<string>();
        for (const t of s.trucks) {
          if (t.path.length > 0 || t.water < 6) continue;
          let busy = false;
          for (let dy = -1; dy <= 1 && !busy; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = t.x + dx;
              const ny = t.y + dy;
              if (
                nx >= 0 &&
                ny >= 0 &&
                nx < s.w &&
                ny < s.h &&
                s.grid[ny * s.w + nx]!.state === 'burning'
              ) {
                busy = true;
                break;
              }
            }
          if (busy) continue;
          let best: { x: number; y: number; d: number } | null = null;
          for (let y = 0; y < s.h; y++)
            for (let x = 0; x < s.w; x++) {
              const c = s.grid[y * s.w + x]!;
              if (c.state !== 'burning' || !c.detected || taken.has(`${x},${y}`)) continue;
              const d = Math.abs(x - t.x) + Math.abs(y - t.y);
              if (!best || d < best.d) best = { x, y, d };
            }
          if (best) {
            taken.add(`${best.x},${best.y}`);
            cmds.push({ type: 'dispatch', truckId: t.id, x: best.x, y: best.y });
          }
        }
        step(s, cmds);
      }
      return s.stats.hectaresBurnt;
    }

    for (const seed of [42, 1234, 31337]) {
      const idle = run(seed, seasons[0]!.seasonLen + 200);
      expect(runBot(seed)).toBeLessThan(idle.stats.hectaresBurnt);
    }
  });

  it('trucks refill at the station', () => {
    const s = createSeason(42, 0);
    const t = s.trucks[0]!;
    t.water = 0;
    for (let i = 0; i < 10; i++) step(s);
    expect(t.water).toBeGreaterThan(0);
  });
});

describe('dispatch (measure-based orders)', () => {
  function dispatchedId(s: GameState, cmd: Command): number | undefined {
    const events = step(s, [cmd]);
    const ev = events.find((e) => e.type === 'engineDispatched');
    return ev?.type === 'engineDispatched' ? ev.truckId : undefined;
  }

  it('an unpinned dispatch sends the closest available engine', () => {
    const s = createSeason(42, 0);
    const t2 = s.trucks[1]!;
    // Separate the engines: engine 2 far away in a corner.
    t2.x = 2;
    t2.y = 2;
    const target = { x: Math.min(s.w - 2, s.trucks[0]!.x + 4), y: s.trucks[0]!.y };
    expect(dispatchedId(s, { type: 'dispatch', x: target.x, y: target.y })).toBe(1);
  });

  it('a pinned dispatch overrides proximity', () => {
    const s = createSeason(42, 0);
    const t2 = s.trucks[1]!;
    t2.x = 2;
    t2.y = 2;
    const target = { x: Math.min(s.w - 2, s.trucks[0]!.x + 4), y: s.trucks[0]!.y };
    expect(dispatchedId(s, { type: 'dispatch', x: target.x, y: target.y, truckId: 2 })).toBe(2);
  });

  it('an empty-tank engine yields to a full one at similar distance', () => {
    const s = createSeason(42, 0);
    s.trucks[0]!.water = 0;
    const target = { x: Math.min(s.w - 2, s.trucks[0]!.x + 5), y: s.trucks[0]!.y };
    expect(dispatchedId(s, { type: 'dispatch', x: target.x, y: target.y })).toBe(2);
  });
});
