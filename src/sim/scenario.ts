import {
  ignitionSchedule as IG,
  map as M,
  regrowth as RG,
  truck as T,
  seasons,
  sectorSizes,
} from './balance';
import { hash2, mulberry32 } from './rng';
import type { Bounds, Cell, GameState, Point, SeasonScript, TileType } from './state';
import { idx, inActive, inBounds } from './state';

/** Smooth value noise in [0,1] from a lattice of hashed corners. */
function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x0 + 1, y0, seed);
  const n01 = hash2(x0, y0 + 1, seed);
  const n11 = hash2(x0 + 1, y0 + 1, seed);
  const top = n00 + (n10 - n00) * sx;
  const bot = n01 + (n11 - n01) * sx;
  return top + (bot - top) * sy;
}

function blankCell(type: TileType): Cell {
  return {
    type,
    baseType: type,
    state: 'unburnt',
    fuel: 0,
    intensity: 0,
    wetTimer: 0,
    occupants: 0,
    igniteAge: 0,
    detected: false,
    burntYear: 0,
  };
}

/**
 * Deterministic world generation from the campaign seed (gameplay doc §3.3).
 * One persistent world; each season plays a centered crop of it (sector).
 */
export function generateMap(seed: number): { grid: Cell[]; station: Point; villages: Point[] } {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const grid: Cell[] = [];

  // 1. Forest-density field → dense / sparse / grass.
  for (let y = 0; y < M.H; y++) {
    for (let x = 0; x < M.W; x++) {
      const n =
        0.6 * valueNoise(x, y, 12, seed) +
        0.3 * valueNoise(x, y, 5, seed ^ 0x55) +
        0.1 * valueNoise(x, y, 2, seed ^ 0xaa);
      let type: TileType;
      if (n > 0.62) type = 'dense';
      else if (n > 0.48) type = 'sparse';
      else if (n > 0.3) type = 'grass';
      else type = n > 0.26 ? 'rock' : 'grass';
      grid.push(blankCell(type));
    }
  }

  // 2. One river, west → east, as a biased random walk (hard barrier + refill).
  let ry = Math.floor(M.H * (0.3 + rng() * 0.4));
  for (let x = 0; x < M.W; x++) {
    for (let w = 0; w < 2; w++) {
      const yy = ry + w;
      if (yy >= 0 && yy < M.H) setBase(grid[yy * M.W + x]!, 'water');
    }
    const r = rng();
    if (r < 0.3 && ry > 2) ry--;
    else if (r > 0.7 && ry < M.H - 3) ry++;
  }

  // 3. Trunk roads: an east–west and a north–south road cross the whole world
  //    (leaving it at four edges, as real regional roads do), meeting at the
  //    fire station near the centre. Water crossings become bridges (paved).
  const pave = (x: number, y: number) => {
    const cell = grid[y * M.W + x]!;
    if (cell.type !== 'house') setBase(cell, 'road');
  };
  const cx0 = Math.floor(M.W / 2);
  const cy0 = Math.floor(M.H / 2);
  let ty = cy0;
  const ewRoad: Point[] = [];
  for (let x = 0; x < M.W; x++) {
    pave(x, ty);
    ewRoad.push({ x, y: ty });
    // Gentle drift that steers back toward the centre line.
    const r = rng();
    if (x < M.W - 1) {
      if (r < 0.22 && ty > 3 && ty >= cy0 - 4) ty--;
      else if (r > 0.78 && ty < M.H - 4 && ty <= cy0 + 4) ty++;
      if (ty !== ewRoad[ewRoad.length - 1]!.y) pave(x, ty); // keep the road 8-connected → diagonal-free
    }
  }
  let tx = cx0;
  const nsRoad: Point[] = [];
  for (let y = 0; y < M.H; y++) {
    pave(tx, y);
    nsRoad.push({ x: tx, y });
    const r = rng();
    if (y < M.H - 1) {
      if (r < 0.22 && tx > 3 && tx >= cx0 - 4) tx--;
      else if (r > 0.78 && tx < M.W - 4 && tx <= cx0 + 4) tx++;
      if (tx !== nsRoad[nsRoad.length - 1]!.x) pave(tx, y);
    }
  }

  // 4. Fire station at the crossroads (nearest road cell to the centre).
  let station: Point = { x: cx0, y: cy0 };
  let bestD = Number.POSITIVE_INFINITY;
  for (const p of [...ewRoad, ...nsRoad]) {
    const d = Math.abs(p.x - cx0) + Math.abs(p.y - cy0);
    if (d < bestD) {
      bestD = d;
      station = p;
    }
  }
  setBase(grid[station.y * M.W + station.x]!, 'road');

  // 5. Villages grow along the roads — the road runs through the town, as on a
  //    real map. Sites sit on the trunk network, spaced apart; the first stays
  //    close to the station so the smallest sector has stakes.
  const villages: Point[] = [];
  const roadCells = [...ewRoad, ...nsRoad].filter(
    (p) => p.x > 2 && p.x < M.W - 3 && p.y > 2 && p.y < M.H - 3,
  );
  let guard = 0;
  while (villages.length < M.villageCount && guard++ < 900) {
    const at = roadCells[Math.floor(rng() * roadCells.length)]!;
    const first = villages.length === 0;
    const distStation = Math.max(Math.abs(at.x - station.x), Math.abs(at.y - station.y));
    if (first && distStation > M.firstVillageMaxDist) continue;
    if (distStation < 6) continue;
    if (villages.some((v) => Math.abs(v.x - at.x) + Math.abs(v.y - at.y) < 12)) continue;

    const houses =
      M.villageMinHouses + Math.floor(rng() * (M.villageMaxHouses - M.villageMinHouses + 1));
    let placed = 0;
    let ring = 1;
    while (placed < houses && ring < 4) {
      for (let dy = -ring; dy <= ring && placed < houses; dy++)
        for (let dx = -ring; dx <= ring && placed < houses; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const nx = at.x + dx;
          const ny = at.y + dy;
          if (!inBounds({ w: M.W, h: M.H }, nx, ny)) continue;
          const cell = grid[ny * M.W + nx]!;
          if (cell.type === 'grass' || cell.type === 'sparse' || cell.type === 'dense') {
            setBase(cell, 'house');
            cell.occupants =
              M.occupantsMin + Math.floor(rng() * (M.occupantsMax - M.occupantsMin + 1));
            placed++;
          }
        }
      ring++;
    }
    if (placed >= M.villageMinHouses) villages.push({ x: at.x, y: at.y });
    else {
      // Roll back a site that couldn't grow (e.g. mid-river bridge).
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const nx = at.x + dx;
          const ny = at.y + dy;
          if (!inBounds({ w: M.W, h: M.H }, nx, ny)) continue;
          const cell = grid[ny * M.W + nx]!;
          if (cell.type === 'house') {
            setBase(cell, 'grass');
            cell.occupants = 0;
          }
        }
    }
  }

  // 6. Reachability: every piece of land must be reachable from the station
  //    (trucks cross water only on bridges). Carve road spurs — bridging the
  //    river where needed — until no meaningful land pocket is cut off.
  const passable = (t: TileType) => t !== 'water';
  for (let round = 0; round < 6; round++) {
    const reached = new Uint8Array(M.W * M.H);
    const queue = [station.y * M.W + station.x];
    reached[queue[0]!] = 1;
    while (queue.length > 0) {
      const cur = queue.pop()!;
      const px = cur % M.W;
      const py = Math.floor(cur / M.W);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = px + dx;
        const ny = py + dy;
        if (!inBounds({ w: M.W, h: M.H }, nx, ny)) continue;
        const ni = ny * M.W + nx;
        if (!reached[ni] && passable(grid[ni]!.type)) {
          reached[ni] = 1;
          queue.push(ni);
        }
      }
    }
    // Largest unreachable land pocket, if any of meaningful size.
    let pocket: Point | null = null;
    let pocketSize = 0;
    const seen = new Uint8Array(M.W * M.H);
    for (let i = 0; i < M.W * M.H; i++) {
      if (reached[i] || seen[i] || !passable(grid[i]!.type)) continue;
      let size = 0;
      const stack = [i];
      seen[i] = 1;
      const sample = { x: i % M.W, y: Math.floor(i / M.W) };
      while (stack.length > 0) {
        const cur = stack.pop()!;
        size++;
        const px = cur % M.W;
        const py = Math.floor(cur / M.W);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = px + dx;
          const ny = py + dy;
          if (!inBounds({ w: M.W, h: M.H }, nx, ny)) continue;
          const ni = ny * M.W + nx;
          if (!seen[ni] && !reached[ni] && passable(grid[ni]!.type)) {
            seen[ni] = 1;
            stack.push(ni);
          }
        }
      }
      if (size > pocketSize) {
        pocketSize = size;
        pocket = sample;
      }
    }
    if (!pocket || pocketSize < 6) break;
    // Bridge from the nearest reached road cell to the pocket with an L-path.
    let from: Point = station;
    let fromD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < M.W * M.H; i++) {
      if (!reached[i] || grid[i]!.type !== 'road') continue;
      const px = i % M.W;
      const py = Math.floor(i / M.W);
      const d = Math.abs(px - pocket.x) + Math.abs(py - pocket.y);
      if (d < fromD) {
        fromD = d;
        from = { x: px, y: py };
      }
    }
    let bx = from.x;
    let by = from.y;
    while (bx !== pocket.x) {
      pave(bx, by);
      bx += bx < pocket.x ? 1 : -1;
    }
    while (by !== pocket.y) {
      pave(bx, by);
      by += by < pocket.y ? 1 : -1;
    }
    pave(bx, by);
  }

  // 7. One pre-authored firebreak line near the north dense block.
  const fy = Math.floor(M.H * 0.25);
  for (let x = 4; x < 13; x++) {
    const cell = grid[fy * M.W + x]!;
    if (cell.type === 'dense' || cell.type === 'sparse' || cell.type === 'grass')
      setBase(cell, 'firebreak');
  }

  return { grid, station, villages };
}

function setBase(cell: Cell, type: TileType): void {
  cell.type = type;
  cell.baseType = type;
}

/** The active sector for a season: sized per pair, centered on the station, clamped to the world. */
export function boundsForSeason(seasonIndex: number, station: Point): Bounds {
  const pair = Math.min(Math.floor(seasonIndex / 2), sectorSizes.length - 1);
  const [bw, bh] = sectorSizes[pair]!;
  const x0 = Math.min(Math.max(0, Math.round(station.x - bw / 2)), M.W - bw);
  const y0 = Math.min(Math.max(0, Math.round(station.y - bh / 2)), M.H - bh);
  return { x0, y0, x1: x0 + bw, y1: y0 + bh };
}

/**
 * Regrowth between seasons (gameplay doc §3.4): burnt ground returns as
 * scarred grass, then sparse, then its base type, on a real-years clock.
 * Pure function of burn age, so it is idempotent across season loads.
 */
function applyRegrowth(cell: Cell, year: number): void {
  if (cell.burntYear <= 0) return;
  const age = year - cell.burntYear;
  if (cell.state === 'burnt') cell.state = 'unburnt';
  const vegetation =
    cell.baseType === 'dense' || cell.baseType === 'sparse' || cell.baseType === 'grass';
  if (age >= RG.fullAfter) cell.type = cell.baseType;
  else if (age >= RG.sparseAfter) cell.type = cell.baseType === 'dense' ? 'sparse' : cell.baseType;
  else if (age >= RG.grassAfter)
    // Only vegetation passes through the scarred-grass stage; roads, firebreaks
    // and other infrastructure are simply restored (repaired) by the next season.
    cell.type = vegetation ? 'grass' : cell.baseType;
}

/** Authored season script: staggered ignitions in viable fuel, one wind shift, relief rain per curve. */
function buildScript(s: GameState, seasonIndex: number, villages: Point[]): SeasonScript {
  const rng = mulberry32(s.seed ^ (0xbeef + seasonIndex));
  const params = seasons[seasonIndex]!;
  const script: SeasonScript = { ignitions: [], windShifts: [], reliefRains: [] };
  const b = s.bounds;

  // Connected flammable components within the sector: a fire only matters if
  // its site can reach a real fuel mass, not a pocket boxed in by barriers.
  const comp = new Int32Array(s.w * s.h).fill(-1);
  const compSize: number[] = [];
  const fuelType = (t: TileType) => t === 'grass' || t === 'sparse' || t === 'dense';
  for (let sy = b.y0; sy < b.y1; sy++)
    for (let sx = b.x0; sx < b.x1; sx++) {
      const start = sy * s.w + sx;
      if (comp[start] !== -1 || !fuelType(s.grid[start]!.type)) continue;
      const id = compSize.length;
      let size = 0;
      const stack = [start];
      comp[start] = id;
      while (stack.length > 0) {
        const cur = stack.pop()!;
        size++;
        const cx = cur % s.w;
        const cy = Math.floor(cur / s.w);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!inActive(s, nx, ny)) continue;
          const ni = ny * s.w + nx;
          if (comp[ni] === -1 && fuelType(s.grid[ni]!.type)) {
            comp[ni] = id;
            stack.push(ni);
          }
        }
      }
      compSize.push(size);
    }

  // Ignition sites: fuel tiles near a road, away from villages and the station,
  // in continuous fuel connected to a real fuel mass — all within the sector.
  const candidates: Point[] = [];
  for (let y = b.y0 + 1; y < b.y1 - 1; y++)
    for (let x = b.x0 + 1; x < b.x1 - 1; x++) {
      const c = s.grid[idx(s, x, y)]!;
      if (c.type !== 'grass' && c.type !== 'sparse') continue;
      const farFromVillages = villages.every((v) => Math.abs(v.x - x) + Math.abs(v.y - y) >= 8);
      if (!farFromVillages) continue;
      // Not on the station's doorstep — the parked engines would kill it in one tick.
      if (Math.abs(s.station.x - x) + Math.abs(s.station.y - y) < 10) continue;
      let fuelAround = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (inActive(s, nx, ny) && fuelType(s.grid[idx(s, nx, ny)]!.type)) fuelAround++;
        }
      if (fuelAround < 17) continue;
      if ((compSize[comp[idx(s, x, y)]!] ?? 0) < 150) continue;
      let nearRoad = false;
      for (let dy = -3; dy <= 3 && !nearRoad; dy++)
        for (let dx = -3; dx <= 3; dx++)
          if (inActive(s, x + dx, y + dy) && s.grid[idx(s, x + dx, y + dy)]!.type === 'road') {
            nearRoad = true;
            break;
          }
      if (nearRoad) candidates.push({ x, y });
    }

  // Staggered ignitions in separate regions — several fires the player must
  // divide attention between. Spacing relaxes gradually (12 → 8 → 4 → any).
  const chosen: Point[] = [];
  for (const minDist of [12, 8, 4, 0]) {
    let attempts = 0;
    while (chosen.length < params.scriptedIgnitions && attempts++ < 80 && candidates.length > 0) {
      const at = candidates[Math.floor(rng() * candidates.length)]!;
      if (chosen.every((p) => Math.abs(p.x - at.x) + Math.abs(p.y - at.y) >= minDist))
        chosen.push(at);
    }
    if (chosen.length >= params.scriptedIgnitions) break;
  }
  while (chosen.length < params.scriptedIgnitions) chosen.push({ x: b.x0 + 5, y: b.y0 + 5 });
  const stagger = Math.max(IG.staggerMin, IG.staggerBase - params.t * IG.staggerPerSeason);
  chosen.forEach((at, i) => {
    script.ignitions.push({ tick: IG.firstTick + i * stagger, x: at.x, y: at.y, done: false });
  });

  script.windShifts.push({
    tick: Math.floor(params.seasonLen * 0.45),
    delta: Math.PI / 2,
    done: false,
  });

  if (params.reliefRain === 'guaranteed' || (params.reliefRain === 'half' && rng() < 0.5)) {
    script.reliefRains.push({ tick: Math.floor(params.seasonLen * 0.65), done: false });
  }

  return script;
}

/**
 * Create a season. seasonIndex 0 = 2026 … 9 = 2070. Pass the previous season's
 * grid as `carryGrid` to inherit the persistent world: scars regrow on a
 * real-years clock, permanent conversions stay, transient fire state resets.
 */
export function createSeason(seed: number, seasonIndex = 0, carryGrid?: Cell[]): GameState {
  const params = seasons[seasonIndex];
  if (!params) throw new Error(`no season ${seasonIndex}`);
  const { grid: freshGrid, station, villages } = generateMap(seed);
  const rng = mulberry32(seed ^ (0xf17e + seasonIndex * 101));

  let grid = freshGrid;
  if (carryGrid) {
    if (carryGrid.length !== freshGrid.length)
      throw new Error('carry grid does not match world size');
    grid = carryGrid.map((c) => ({
      ...c,
      state: c.state === 'burning' ? ('burnt' as const) : c.state,
      fuel: 0,
      intensity: 0,
      wetTimer: 0,
      igniteAge: 0,
      detected: false,
    }));
  }
  for (const cell of grid) applyRegrowth(cell, params.year);

  const state: GameState = {
    seed,
    seasonYear: params.year,
    seasonIndex,
    tick: 0,
    w: M.W,
    h: M.H,
    grid,
    bounds: boundsForSeason(seasonIndex, station),
    wind: { dir: rng() * Math.PI * 2, str: params.windStr },
    dryness: params.dryness,
    spreadMult: params.spreadMult ?? 1,
    windStrBase: params.windStr,
    seasonLen: params.seasonLen,
    randomIgnitionRate: params.randomIgnitionRate,
    rainTicks: 0,
    station,
    trucks: [1, 2].map((id) => ({
      id,
      x: station.x,
      y: station.y,
      water: T.waterCapacity,
      path: [],
      movePoints: 0,
      target: null,
      trail: [{ x: station.x, y: station.y }],
    })),
    stats: {
      hectaresBurnt: 0,
      animalsKilled: 0,
      housesLost: 0,
      firefightersLost: 0,
      civiliansLost: 0,
    },
    script: { ignitions: [], windShifts: [], reliefRains: [] },
    rng,
    ended: false,
  };
  state.script = buildScript(state, seasonIndex, villages);
  return state;
}
