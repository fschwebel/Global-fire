import { describe, expect, it } from 'vitest';
import { detection, evac, seasons } from '../src/sim/balance';
import { createSeason } from '../src/sim/scenario';
import type { Cell, Command, GameState } from '../src/sim/state';
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
    expect(s.stats.hectaresBurnt).toBeGreaterThan(60);
    expect(s.stats.hectaresBurnt).toBeLessThan(1200);
  });

  it('unfought 2026 fires rarely die on their own before mattering (multi-seed)', () => {
    // "Rarely", not "never": a lucky quiet year is honest variance.
    for (const seed of [7, 1234, 31337]) {
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

  it('extinguishing all fires pulls the next scheduled ignition forward', () => {
    const s = createSeason(42, 0);
    const first = s.script.ignitions[0]!;
    for (let i = 0; i <= first.tick + 2; i++) step(s);
    // Simulate a clean extinguish of everything burning.
    for (const c of s.grid) {
      if (c.state === 'burning') {
        c.state = 'unburnt';
        c.intensity = 0;
        c.detected = false;
        c.igniteAge = 0;
      }
    }
    const before = s.tick;
    let reignited = -1;
    for (let i = 0; i < 30 && reignited === -1; i++) {
      step(s);
      if (s.grid.some((c) => c.state === 'burning')) reignited = s.tick - before;
    }
    // Next fire arrives within the quiet gap (plus a tick of slack), not ~90 ticks later.
    expect(reignited).toBeGreaterThan(0);
    expect(reignited).toBeLessThanOrEqual(10);
  });

  it('a quiet valley winds the season down even when random ignitions exist (2040 bug)', () => {
    const s = createSeason(42, 3); // 2040: randomIgnitionRate > 0
    expect(s.randomIgnitionRate).toBeGreaterThan(0);
    // Mark the whole schedule as delivered, then extinguish everything.
    for (const ig of s.script.ignitions) ig.done = true;
    for (const c of s.grid) {
      if (c.state === 'burning') {
        c.state = 'unburnt';
        c.intensity = 0;
        c.detected = false;
      }
    }
    s.tick = Math.max(s.tick, 41);
    let windingDown = false;
    let endedAfter = -1;
    for (let i = 0; i < 60 && endedAfter === -1; i++) {
      const events = step(s);
      if (events.some((e) => e.type === 'seasonWindingDown')) windingDown = true;
      if (s.ended) endedAfter = i;
    }
    expect(windingDown).toBe(true);
    expect(endedAfter).toBeGreaterThanOrEqual(0);
    expect(endedAfter).toBeLessThan(40); // ~12s grace, not the full season timer
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

    for (const seed of [42, 7, 1234]) {
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

describe('map realism', () => {
  it('trunk roads leave the world at all four edges', () => {
    for (const seed of [42, 7, 99]) {
      const s = createSeason(seed, 9); // full world sector
      const isRoad = (x: number, y: number) => s.grid[y * s.w + x]!.type === 'road';
      expect([...Array(s.h).keys()].some((y) => isRoad(0, y))).toBe(true);
      expect([...Array(s.h).keys()].some((y) => isRoad(s.w - 1, y))).toBe(true);
      expect([...Array(s.w).keys()].some((x) => isRoad(x, 0))).toBe(true);
      expect([...Array(s.w).keys()].some((x) => isRoad(x, s.h - 1))).toBe(true);
    }
  });

  it('roads run through towns: houses cluster around a road cell', () => {
    for (const seed of [42, 7, 99]) {
      const s = createSeason(seed, 9);
      let villages = 0;
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) {
          if (s.grid[y * s.w + x]!.type !== 'road') continue;
          let houses = 0;
          for (let dy = -3; dy <= 3; dy++)
            for (let dx = -3; dx <= 3; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h)
                if (s.grid[ny * s.w + nx]!.type === 'house') houses++;
            }
          if (houses >= 6) villages++;
        }
      expect(villages).toBeGreaterThan(0);
    }
  });

  it('every piece of land is reachable from the station (bridges where needed)', () => {
    for (const seed of [42, 7, 99, 1234, 555]) {
      const s = createSeason(seed, 9);
      const reached = new Uint8Array(s.w * s.h);
      const start = s.station.y * s.w + s.station.x;
      reached[start] = 1;
      const queue = [start];
      while (queue.length > 0) {
        const cur = queue.pop()!;
        const px = cur % s.w;
        const py = Math.floor(cur / s.w);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
          const ni = ny * s.w + nx;
          if (!reached[ni] && s.grid[ni]!.type !== 'water') {
            reached[ni] = 1;
            queue.push(ni);
          }
        }
      }
      let unreachable = 0;
      for (let i = 0; i < s.w * s.h; i++)
        if (!reached[i] && s.grid[i]!.type !== 'water') unreachable++;
      // Tiny slivers (<6 cells) may remain by design; nothing meaningful is cut off.
      expect(unreachable).toBeLessThan(6);
    }
  });
});

describe('campaign', () => {
  it('the sector grows every two seasons, reaching the full world by 2065', () => {
    let prevArea = 0;
    for (let idx = 0; idx <= 9; idx++) {
      const s = createSeason(42, idx);
      const area = (s.bounds.x1 - s.bounds.x0) * (s.bounds.y1 - s.bounds.y0);
      if (idx === 0) expect(area).toBeLessThan(s.w * s.h);
      else if (idx % 2 === 0) expect(area).toBeGreaterThan(prevArea);
      else expect(area).toBe(prevArea);
      prevArea = area;
    }
    const last = createSeason(42, 9);
    expect(last.bounds.x1 - last.bounds.x0).toBe(last.w);
    expect(last.bounds.y1 - last.bounds.y0).toBe(last.h);
  });

  it('fire never crosses the sector edge', () => {
    const s = createSeason(42, 0);
    for (let i = 0; i < seasons[0]!.seasonLen + 200 && !s.ended; i++) step(s);
    expect(s.stats.hectaresBurnt).toBeGreaterThan(0);
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const outside = x < s.bounds.x0 || x >= s.bounds.x1 || y < s.bounds.y0 || y >= s.bounds.y1;
        if (outside) expect(s.grid[y * s.w + x]!.state).toBe('unburnt');
      }
  });

  it('scars carry over, regrow to grass, and fully recover after 12+ years', () => {
    const a = createSeason(42, 0);
    for (let i = 0; i < seasons[0]!.seasonLen + 200 && !a.ended; i++) step(a);
    const burntIdx: number[] = [];
    a.grid.forEach((c, i) => {
      if (c.state === 'burnt') burntIdx.push(i);
    });
    expect(burntIdx.length).toBeGreaterThan(0);

    const b = createSeason(42, 1, a.grid); // 2030: 4 years later → scarred grass
    for (const i of burntIdx) {
      const c = b.grid[i]!;
      expect(c.state).toBe('unburnt');
      expect(c.burntYear).toBe(2026);
      const vegetation =
        c.baseType === 'dense' || c.baseType === 'sparse' || c.baseType === 'grass';
      // Vegetation and rebuild-marked home lots return as scarred grass;
      // infrastructure (roads, firebreaks) is repaired by the next season.
      if (vegetation || c.baseType === 'house') expect(c.type).toBe('grass');
      else expect(c.type).toBe(c.baseType);
    }

    const d = createSeason(42, 3, b.grid); // 2040: 14 years later → base type restored
    for (const i of burntIdx) {
      const c = d.grid[i]!;
      expect(c.type).toBe(c.baseType);
    }
  });

  it('all ten seasons create and run, carrying the world forward', () => {
    let grid: Cell[] | undefined;
    for (let idx = 0; idx <= 9; idx++) {
      const s = createSeason(42, idx, grid);
      expect(s.seasonYear).toBe(seasons[idx]!.year);
      expect(s.script.ignitions.length).toBe(seasons[idx]!.scriptedIgnitions);
      for (let i = 0; i < 120 && !s.ended; i++) step(s);
      grid = s.grid;
    }
  });

  it('every scripted ignition site lies inside its season sector', () => {
    for (let idx = 0; idx <= 9; idx++) {
      const s = createSeason(42, idx);
      for (const ig of s.script.ignitions) {
        expect(ig.x).toBeGreaterThanOrEqual(s.bounds.x0);
        expect(ig.x).toBeLessThan(s.bounds.x1);
        expect(ig.y).toBeGreaterThanOrEqual(s.bounds.y0);
        expect(ig.y).toBeLessThan(s.bounds.y1);
      }
    }
  });

  it('the sector always contains the station and at least one village', () => {
    for (let idx = 0; idx <= 9; idx++) {
      const s = createSeason(42, idx);
      expect(
        s.station.x >= s.bounds.x0 &&
          s.station.x < s.bounds.x1 &&
          s.station.y >= s.bounds.y0 &&
          s.station.y < s.bounds.y1,
      ).toBe(true);
      let housesInside = 0;
      for (let y = s.bounds.y0; y < s.bounds.y1; y++)
        for (let x = s.bounds.x0; x < s.bounds.x1; x++)
          if (s.grid[y * s.w + x]!.type === 'house') housesInside++;
      expect(housesInside).toBeGreaterThanOrEqual(6);
    }
  });

  it('dispatch refuses targets outside the active sector', () => {
    const s = createSeason(42, 0);
    // The 2026 sector is a strict crop, so a world corner is outside it.
    expect(s.bounds.x0).toBeGreaterThan(0);
    const events = step(s, [{ type: 'dispatch', x: 0, y: 0 }]);
    expect(events.some((e) => e.type === 'engineDispatched')).toBe(false);
  });

  it('regrowth staging: grass at 4 years, sparse at 9, restored at 14', () => {
    const base = createSeason(42, 0);
    // Hand-stamp a dense cell inside every sector as burnt in 2026.
    const target = base.grid.findIndex(
      (c, i) =>
        c.type === 'dense' &&
        i % base.w >= base.bounds.x0 &&
        i % base.w < base.bounds.x1 &&
        Math.floor(i / base.w) >= base.bounds.y0 &&
        Math.floor(i / base.w) < base.bounds.y1,
    );
    expect(target).toBeGreaterThanOrEqual(0);
    base.grid[target]!.state = 'burnt';
    base.grid[target]!.burntYear = 2026;

    const y2030 = createSeason(42, 1, base.grid);
    expect(y2030.grid[target]!.type).toBe('grass');
    const y2035 = createSeason(42, 2, y2030.grid);
    expect(y2035.grid[target]!.type).toBe('sparse');
    const y2040 = createSeason(42, 3, y2035.grid);
    expect(y2040.grid[target]!.type).toBe('dense');
  });

  it('a home not marked for rebuilding stays lost for good', () => {
    const base = createSeason(42, 0);
    const houseIdx = base.grid.findIndex((c) => c.type === 'house');
    expect(houseIdx).toBeGreaterThanOrEqual(0);
    const cell = base.grid[houseIdx]!;
    cell.state = 'burnt';
    cell.burntYear = 2026;
    cell.baseType = 'grass'; // burnout roll failed: the village shrinks
    cell.occupants = 0;
    const later = createSeason(42, 5, base.grid); // 2050, 24 years on
    expect(later.grid[houseIdx]!.type).toBe('grass');
    expect(later.grid[houseIdx]!.occupants).toBe(0);
  });

  it('a home marked for rebuilding returns after 5 years with a new family', () => {
    const base = createSeason(42, 0);
    const houseIdx = base.grid.findIndex((c) => c.type === 'house');
    expect(houseIdx).toBeGreaterThanOrEqual(0);
    const cell = base.grid[houseIdx]!;
    cell.state = 'burnt';
    cell.burntYear = 2026;
    cell.baseType = 'house'; // burnout roll passed: marked for rebuilding
    cell.occupants = 0;
    const y2030 = createSeason(42, 1, base.grid); // 4 years on: still an empty lot
    expect(y2030.grid[houseIdx]!.type).toBe('grass');
    expect(y2030.grid[houseIdx]!.occupants).toBe(0);
    const y2035 = createSeason(42, 2, y2030.grid); // 9 years on: rebuilt
    expect(y2035.grid[houseIdx]!.type).toBe('house');
    expect(y2035.grid[houseIdx]!.occupants).toBeGreaterThan(0);
  });

  it('climate escalation: 2070 unfought burns far more than 2026 (same seed)', () => {
    const early = createSeason(42, 0);
    for (let i = 0; i < seasons[0]!.seasonLen + 200 && !early.ended; i++) step(early);
    const late = createSeason(42, 9);
    for (let i = 0; i < seasons[9]!.seasonLen + 200 && !late.ended; i++) step(late);
    expect(late.stats.hectaresBurnt).toBeGreaterThan(early.stats.hectaresBurnt);
  });
});

describe('stat reveals', () => {
  it('campaign totals never leak a counter before its reveal season', async () => {
    const { statLine } = await import('../src/ui/hud');
    const stats = {
      hectaresBurnt: 120,
      animalsKilled: 300,
      housesLost: 4,
      firefightersLost: 0,
      civiliansLost: 0,
    };
    expect(statLine(stats, 2026)).toBe('120 ha');
    expect(statLine(stats, 2030)).toBe('120 ha · ~300 animals');
    expect(statLine(stats, 2035)).toBe('120 ha · ~300 animals · 4 homes');
    expect(statLine(stats, 2040)).toBe('120 ha · ~300 animals · 4 homes');
    // The firefighter counter is revealed at zero — the counter is the warning.
    expect(statLine(stats, 2045)).toBe('120 ha · ~300 animals · 4 homes · 0 firefighters');
    expect(statLine(stats, 2050)).toBe(
      '120 ha · ~300 animals · 4 homes · 0 firefighters · 0 people',
    );
    expect(statLine(stats, 2070)).toContain('4 homes');
  });
});

describe('campaign save', () => {
  it('round-trips seed, progress, totals, and burn history', async () => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
    const { saveCampaign, loadCampaign, clearCampaign } = await import('../src/game/save');

    const s = createSeason(42, 0);
    for (let i = 0; i < seasons[0]!.seasonLen + 200 && !s.ended; i++) step(s);
    const scarsBefore = s.grid.filter((c) => c.burntYear > 0).length;
    expect(scarsBefore).toBeGreaterThan(0);

    saveCampaign(42, 1, s.stats, s.grid, [{ x: 10, y: 10 }]);
    const loaded = loadCampaign();
    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe(42);
    expect(loaded!.seasonIndex).toBe(1);
    expect(loaded!.campaign).toEqual(s.stats);
    expect(loaded!.scars.length).toBe(scarsBefore);
    expect(loaded!.towers).toEqual([{ x: 10, y: 10 }]);

    clearCampaign();
    expect(loadCampaign()).toBeNull();
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
    // Separate the engines: engine 2 far away in the sector corner.
    t2.x = s.bounds.x0 + 1;
    t2.y = s.bounds.y0 + 1;
    const target = { x: Math.min(s.bounds.x1 - 2, s.trucks[0]!.x + 4), y: s.trucks[0]!.y };
    expect(dispatchedId(s, { type: 'dispatch', x: target.x, y: target.y })).toBe(1);
  });

  it('a pinned dispatch overrides proximity', () => {
    const s = createSeason(42, 0);
    const t2 = s.trucks[1]!;
    t2.x = s.bounds.x0 + 1;
    t2.y = s.bounds.y0 + 1;
    const target = { x: Math.min(s.bounds.x1 - 2, s.trucks[0]!.x + 4), y: s.trucks[0]!.y };
    expect(dispatchedId(s, { type: 'dispatch', x: target.x, y: target.y, truckId: 2 })).toBe(2);
  });

  it('an empty-tank engine yields to a full one at similar distance', () => {
    const s = createSeason(42, 0);
    s.trucks[0]!.water = 0;
    const target = { x: Math.min(s.w - 2, s.trucks[0]!.x + 5), y: s.trucks[0]!.y };
    expect(dispatchedId(s, { type: 'dispatch', x: target.x, y: target.y })).toBe(2);
  });
});

describe('unlockable means', () => {
  /** A house tile of the given village, with residents. */
  function villageHouse(s: GameState, villageId: number): { cell: Cell; x: number; y: number } {
    const v = s.villages.find((vv) => vv.id === villageId)!;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = v.x + dx;
        const y = v.y + dy;
        const cell = s.grid[y * s.w + x];
        if (cell && cell.type === 'house' && cell.occupants > 0) return { cell, x, y };
      }
    throw new Error(`village ${villageId} has no populated houses`);
  }

  it('means arrive on the canon schedule: 2035 bomber, 2040 towers, 2050 crew, 2055 bomber 2', () => {
    expect(createSeason(42, 0).bombers.length).toBe(0);
    expect(createSeason(42, 0).crews.length).toBe(0);
    expect(createSeason(42, 0).towersAvailable).toBe(0);
    expect(createSeason(42, 2).bombers.length).toBe(1);
    expect(createSeason(42, 3).towersAvailable).toBe(2);
    expect(createSeason(42, 5).crews.length).toBe(1);
    expect(createSeason(42, 6).bombers.length).toBe(2);
  });

  it('evacuation orders are refused before their unlock season', () => {
    const s = createSeason(42, 0); // 2026
    const events = step(s, [{ type: 'evacuate', villageId: 1 }]);
    expect(events.some((e) => e.type === 'evacuationStarted')).toBe(false);
    expect(s.villages[0]!.evac).toBe('none');
  });

  it('an evacuated village loses no residents when its homes burn', () => {
    const s = createSeason(42, 1); // 2030
    const events = step(s, [{ type: 'evacuate', villageId: 1 }]);
    expect(events.some((e) => e.type === 'evacuationStarted')).toBe(true);
    expect(s.villages[0]!.evac).toBe('inProgress');
    let done = false;
    for (let i = 0; i < evac.durationTicks + 5 && !done; i++)
      done = step(s).some((e) => e.type === 'evacuationComplete');
    expect(done).toBe(true);
    expect(s.villages[0]!.evac).toBe('done');

    const before = s.stats.civiliansLost;
    const h = villageHouse(s, 1);
    h.cell.state = 'burning';
    h.cell.fuel = 1;
    h.cell.intensity = 5;
    step(s);
    expect(h.cell.state).toBe('burnt');
    expect(s.stats.civiliansLost).toBe(before);
  });

  it('an unevacuated burning home costs lives', () => {
    const s = createSeason(42, 1); // 2030
    const h = villageHouse(s, 1);
    const expected = Math.round(h.cell.occupants * evac.mortalityNone);
    expect(expected).toBeGreaterThan(0);
    h.cell.state = 'burning';
    h.cell.fuel = 1;
    h.cell.intensity = 5;
    const events = step(s);
    expect(h.cell.state).toBe('burnt');
    expect(s.stats.civiliansLost).toBe(expected);
    expect(events.some((e) => e.type === 'civilianDeaths' && e.count === expected)).toBe(true);
  });

  it('a water bomber flies out, drops on target, and cycles back to ready', () => {
    const s = createSeason(42, 2); // 2035
    // A burning patch away from the station.
    const tx = s.bounds.x0 + 8;
    const ty = s.bounds.y0 + 8;
    let target: { x: number; y: number } | null = null;
    outer: for (let dy = 0; dy < 10; dy++)
      for (let dx = 0; dx < 10; dx++) {
        const c = s.grid[(ty + dy) * s.w + (tx + dx)]!;
        if (c.type === 'grass' || c.type === 'sparse' || c.type === 'dense') {
          target = { x: tx + dx, y: ty + dy };
          break outer;
        }
      }
    expect(target).not.toBeNull();
    const cell = s.grid[target!.y * s.w + target!.x]!;
    cell.state = 'burning';
    cell.intensity = 6;
    cell.fuel = 60;

    // Anchor on the fire, aim due east: the line runs target.x .. target.x+5.
    const events = step(s, [
      { type: 'bomberDrop', x: target!.x, y: target!.y, x2: target!.x + 3, y2: target!.y },
    ]);
    expect(events.some((e) => e.type === 'bomberDispatched')).toBe(true);
    let dropped = false;
    for (let i = 0; i < 60 && !dropped; i++) dropped = step(s).some((e) => e.type === 'bomberDrop');
    expect(dropped).toBe(true);
    expect(cell.state).not.toBe('burning');
    expect(cell.wetTimer).toBeGreaterThan(0);
    // The retardant line extends toward the aim cell and holds.
    let wetAlong = 0;
    for (let i = 1; i < 6; i++) {
      const cx = target!.x + i;
      if (cx >= s.bounds.x1) break;
      if (s.grid[target!.y * s.w + cx]!.wetTimer > 0) wetAlong++;
    }
    expect(wetAlong).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < 80 && s.bombers[0]!.state !== 'ready'; i++) step(s);
    expect(s.bombers[0]!.state).toBe('ready');
  });

  it('the drop line rasterizer yields the requested cells from anchor toward aim', async () => {
    const { dropLineCells } = await import('../src/sim/units');
    const east = dropLineCells({ x: 10, y: 10 }, { x: 13, y: 10 }, 6);
    expect(east).toEqual([10, 11, 12, 13, 14, 15].map((x) => ({ x, y: 10 })));
    const diag = dropLineCells({ x: 10, y: 10 }, { x: 12, y: 12 }, 6);
    expect(diag.length).toBe(6);
    expect(diag[0]).toEqual({ x: 10, y: 10 });
    expect(diag[5]!.x).toBeGreaterThan(12);
    const degenerate = dropLineCells({ x: 5, y: 5 }, { x: 5, y: 5 }, 6);
    expect(degenerate).toEqual([{ x: 5, y: 5 }]);
  });

  it('a watch tower reports fires in its radius almost instantly', () => {
    const s = createSeason(42, 3); // 2040
    // A fuel tile no road, house, or engine would call in.
    let remote: { x: number; y: number } | null = null;
    const r = detection.CALL_IN_RADIUS;
    outer: for (let y = s.bounds.y0 + 2; y < s.bounds.y1 - 2; y++)
      for (let x = s.bounds.x0 + 2; x < s.bounds.x1 - 2; x++) {
        const c = s.grid[y * s.w + x]!;
        if (c.type !== 'grass' && c.type !== 'sparse' && c.type !== 'dense') continue;
        let calledIn = false;
        for (let dy = -r; dy <= r && !calledIn; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const n = s.grid[(y + dy) * s.w + (x + dx)];
            if (n && (n.type === 'road' || n.type === 'house')) {
              calledIn = true;
              break;
            }
          }
        for (const t of s.trucks)
          if (Math.abs(t.x - x) <= r && Math.abs(t.y - y) <= r) calledIn = true;
        if (!calledIn) {
          remote = { x, y };
          break outer;
        }
      }
    expect(remote).not.toBeNull();

    // Without a tower: a young fire there goes unreported.
    const cell = s.grid[remote!.y * s.w + remote!.x]!;
    cell.state = 'burning';
    cell.intensity = 2;
    cell.fuel = 60;
    cell.detected = false;
    step(s);
    expect(cell.detected).toBe(false);

    // With a tower beside it: reported on the next tick.
    const placed = step(s, [{ type: 'placeTower', x: remote!.x + 1, y: remote!.y }]);
    expect(placed.some((e) => e.type === 'towerPlaced')).toBe(true);
    expect(s.towers.length).toBe(1);
    expect(s.towersAvailable).toBe(1);
    step(s);
    expect(cell.detected).toBe(true);
  });

  it('a fire crew walks out and cuts clicked tiles into a firebreak', () => {
    const s = createSeason(42, 5); // 2050
    let target: { x: number; y: number } | null = null;
    outer: for (let ring = 2; ring < 10 && !target; ring++)
      for (let dy = -ring; dy <= ring; dy++)
        for (let dx = -ring; dx <= ring; dx++) {
          const x = s.station.x + dx;
          const y = s.station.y + dy;
          if (x < s.bounds.x0 || y < s.bounds.y0 || x >= s.bounds.x1 || y >= s.bounds.y1) continue;
          const c = s.grid[y * s.w + x]!;
          if (c.type === 'grass' || c.type === 'sparse') {
            target = { x, y };
            break outer;
          }
        }
    expect(target).not.toBeNull();

    const events = step(s, [{ type: 'crewCut', x: target!.x, y: target!.y }]);
    expect(events.some((e) => e.type === 'crewDispatched')).toBe(true);
    for (let i = 0; i < 60 && s.grid[target!.y * s.w + target!.x]!.type !== 'firebreak'; i++)
      step(s);
    expect(s.grid[target!.y * s.w + target!.x]!.type).toBe('firebreak');
    expect(s.terrainVersion).toBeGreaterThan(0); // the renderer repaints the ground
  });
});

describe('sector seam', () => {
  /** A 2030 world with a burnt strip pressed against the east sector edge. */
  function burntEdgeWorld(): GameState {
    const s = createSeason(42, 1);
    const b = s.bounds;
    for (let y = b.y0 + 5; y < b.y1 - 5; y++)
      for (let x = b.x1 - 3; x < b.x1; x++) {
        const c = s.grid[y * s.w + x]!;
        if (c.type === 'grass' || c.type === 'sparse' || c.type === 'dense') {
          c.state = 'burnt';
          c.burntYear = 2030;
        }
      }
    return s;
  }

  it('growth reveals a ragged fire edge, not a ruler line', () => {
    const before = burntEdgeWorld();
    const oldX1 = before.bounds.x1;
    const grown = createSeason(42, 2, before.grid); // 2035: the sector widens
    expect(grown.bounds.x1).toBeGreaterThan(oldX1);

    let spill = 0;
    let deep = 0;
    for (let y = grown.bounds.y0; y < grown.bounds.y1; y++)
      for (let x = oldX1; x < grown.bounds.x1; x++) {
        if (grown.grid[y * grown.w + x]!.burntYear > 0) {
          if (x - oldX1 < 3) spill++;
          else deep++;
        }
      }
    expect(spill).toBeGreaterThan(0); // the scar bleeds past the old boundary
    expect(deep).toBe(0); // but only a few tiles deep
  });

  it('seam spillover is deterministic: a reloaded campaign stamps the same cells', () => {
    const a = createSeason(42, 2, burntEdgeWorld().grid);
    const b = createSeason(42, 2, burntEdgeWorld().grid);
    expect(a.grid.map((c) => c.burntYear).join()).toBe(b.grid.map((c) => c.burntYear).join());
  });
});

describe('firefighter danger rule', () => {
  /** Ring the unit with heavy fire out to the given radius (skipping unburnable tiles). */
  function encircle(s: GameState, x: number, y: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < s.bounds.x0 || ny < s.bounds.y0 || nx >= s.bounds.x1 || ny >= s.bounds.y1)
          continue;
        const c = s.grid[ny * s.w + nx]!;
        if (c.type === 'water' || c.type === 'rock') continue;
        c.state = 'burning';
        c.intensity = 8;
        c.fuel = 80;
      }
  }

  /** A spot away from the sector edge so the fire ring fits around it. */
  function stage(s: GameState): { x: number; y: number } {
    return { x: s.bounds.x0 + 12, y: s.bounds.y0 + 12 };
  }

  it('a trapped engine is overrun after the grace: firefighters die, the engine is gone', () => {
    const s = createSeason(42, 4); // 2045 — the rule activates
    const at = stage(s);
    const t = s.trucks[0]!;
    t.x = at.x;
    t.y = at.y;
    t.water = 0; // no fighting back — this is an entrapment
    encircle(s, at.x, at.y, 3);

    let warned = false;
    let lostEvent: { firefighters: number } | null = null;
    for (let i = 0; i < 10 && !lostEvent; i++) {
      for (const ev of step(s)) {
        if (ev.type === 'crewDanger' && ev.unit === 'engine') warned = true;
        if (ev.type === 'unitLost' && ev.unit === 'engine')
          lostEvent = { firefighters: ev.firefighters };
      }
    }
    expect(warned).toBe(true);
    expect(lostEvent).not.toBeNull();
    expect(lostEvent!.firefighters).toBe(4);
    expect(s.stats.firefightersLost).toBe(4);
    expect(s.trucks.find((tr) => tr.id === t.id)).toBeUndefined();

    // The department rebuilds the unit for the following season.
    const next = createSeason(42, 5, s.grid, s.towers);
    expect(next.trucks.length).toBe(2);
  });

  it('an engine in danger with an open escape survives (warning only)', () => {
    const s = createSeason(42, 4); // 2045
    const at = stage(s);
    const t = s.trucks[0]!;
    t.x = at.x;
    t.y = at.y;
    t.water = 0;
    // Heavy fire on one side only — the other side stays open.
    const arc = new Set<number>();
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
    ] as const) {
      const c = s.grid[(at.y + dy) * s.w + (at.x + dx)]!;
      if (c.type === 'water' || c.type === 'rock') continue;
      c.state = 'burning';
      c.intensity = 8;
      c.fuel = 80;
      arc.add((at.y + dy) * s.w + (at.x + dx));
    }
    let warned = false;
    let lost = false;
    for (let i = 0; i < 8; i++) {
      for (const ev of step(s)) {
        if (ev.type === 'crewDanger') warned = true;
        if (ev.type === 'unitLost') lost = true;
      }
      // Freeze the scenario: the arc keeps burning, spread is snuffed — the
      // escape route genuinely stays open for the whole test.
      s.grid.forEach((c, ci) => {
        if (arc.has(ci)) {
          c.state = 'burning';
          c.intensity = 8;
          c.fuel = 80;
        } else if (c.state === 'burning') {
          c.state = 'unburnt';
          c.intensity = 0;
          c.igniteAge = 0;
          c.detected = false;
        }
      });
    }
    expect(warned).toBe(true);
    expect(lost).toBe(false);
    expect(s.trucks.length).toBe(2);
  });

  it('before 2045 the destruction clause is off: no deaths, ever', () => {
    const s = createSeason(42, 2); // 2035
    const at = stage(s);
    const t = s.trucks[0]!;
    t.x = at.x;
    t.y = at.y;
    t.water = 0;
    encircle(s, at.x, at.y, 3);
    for (let i = 0; i < 10; i++) {
      for (const ev of step(s)) {
        expect(ev.type).not.toBe('crewDanger');
        expect(ev.type).not.toBe('unitLost');
      }
    }
    expect(s.stats.firefightersLost).toBe(0);
    expect(s.trucks.length).toBe(2);
  });

  it('a crew ordered to a clear tile drops its cuts and moves (the manual pull-out)', () => {
    const s = createSeason(42, 5); // 2050
    const crew = s.crews[0]!;
    // Queue a cut first, then order the crew onto a road tile.
    let veg: { x: number; y: number } | null = null;
    outer: for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        const c = s.grid[(s.station.y + dy) * s.w + (s.station.x + dx)]!;
        if (c.type === 'grass' || c.type === 'sparse') {
          veg = { x: s.station.x + dx, y: s.station.y + dy };
          break outer;
        }
      }
    expect(veg).not.toBeNull();
    step(s, [{ type: 'crewCut', x: veg!.x, y: veg!.y }]);
    expect(crew.jobs.length).toBe(1);

    const road = s.station; // the station tile is a road
    step(s, [{ type: 'crewCut', x: road.x, y: road.y }]);
    expect(crew.jobs.length).toBe(0);
    for (let i = 0; i < 30 && !(crew.x === road.x && crew.y === road.y); i++) step(s);
    expect(crew.x).toBe(road.x);
    expect(crew.y).toBe(road.y);
  });
});

describe('warming display data', () => {
  it('every season year has a central warming estimate, monotonically rising', async () => {
    const { warming, hotDayAt, hotDayFactor } = await import('../src/ui/facts');
    let prev = 0;
    for (const season of seasons) {
      const w = warming[season.year];
      expect(w, `warming for ${season.year}`).toBeDefined();
      expect(w!).toBeGreaterThan(prev);
      prev = w!;
      // Peak-day estimate: 1.5× the mean, one decimal.
      expect(hotDayAt(season.year)).toBeCloseTo(Math.round(w! * hotDayFactor * 10) / 10, 5);
      expect(hotDayAt(season.year)).toBeGreaterThan(w!);
    }
  });
});
