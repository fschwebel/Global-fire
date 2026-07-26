import {
  droughtEvent as DE,
  development as DEV,
  ignitionSchedule as IG,
  map as M,
  regrowth as RG,
  truck as T,
  seasons,
  sectorSizes,
  tower,
  unlocks,
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
export function generateMap(seed: number): { grid: Cell[]; center: Point; villages: Point[] } {
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
  //    meeting near the centre. Water crossings become bridges (paved).
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

  // 4. The central crossroads (nearest road cell to the centre).
  let center: Point = { x: cx0, y: cy0 };
  let bestD = Number.POSITIVE_INFINITY;
  for (const p of [...ewRoad, ...nsRoad]) {
    const d = Math.abs(p.x - cx0) + Math.abs(p.y - cy0);
    if (d < bestD) {
      bestD = d;
      center = p;
    }
  }
  setBase(grid[center.y * M.W + center.x]!, 'road');

  // 5. Villages grow along the roads — the road runs through the town, as on a
  //    real map. Sites sit on the trunk network, spaced apart; the first stays
  //    close to the crossroads so the smallest sector has stakes.
  const villages: Point[] = [];
  const roadCells = [...ewRoad, ...nsRoad].filter(
    (p) => p.x > 2 && p.x < M.W - 3 && p.y > 2 && p.y < M.H - 3,
  );
  let guard = 0;
  while (villages.length < M.villageCount && guard++ < 900) {
    const at = roadCells[Math.floor(rng() * roadCells.length)]!;
    const first = villages.length === 0;
    const distCenter = Math.max(Math.abs(at.x - center.x), Math.abs(at.y - center.y));
    if (first && distCenter > M.firstVillageMaxDist) continue;
    if (distCenter < 6) continue;
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

  // 6. Reachability: every piece of land must be reachable from the crossroads
  //    (trucks cross water only on bridges). Carve road spurs — bridging the
  //    river where needed — until no meaningful land pocket is cut off.
  const passable = (t: TileType) => t !== 'water';
  for (let round = 0; round < 6; round++) {
    const reached = new Uint8Array(M.W * M.H);
    const queue = [center.y * M.W + center.x];
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
    let from: Point = center;
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

  return { grid, center, villages };
}

function setBase(cell: Cell, type: TileType): void {
  cell.type = type;
  cell.baseType = type;
}

/** The active sector for a season: sized per pair, centered on the crossroads, clamped to the world. */
export function boundsForSeason(seasonIndex: number, center: Point): Bounds {
  const pair = Math.min(Math.floor(seasonIndex / 2), sectorSizes.length - 1);
  const [bw, bh] = sectorSizes[pair]!;
  const x0 = Math.min(Math.max(0, Math.round(center.x - bw / 2)), M.W - bw);
  const y0 = Math.min(Math.max(0, Math.round(center.y - bh / 2)), M.H - bh);
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
  if (cell.baseType === 'house') {
    // A lot marked for rebuilding (burnout roll) lies as scarred grass until
    // the house goes up again and a new family moves in.
    if (age >= RG.houseRebuildAfter) {
      cell.type = 'house';
      if (cell.occupants === 0) cell.occupants = M.occupantsMin;
    } else if (age >= RG.grassAfter) cell.type = 'grass';
    return;
  }
  const vegetation =
    cell.baseType === 'dense' || cell.baseType === 'sparse' || cell.baseType === 'grass';
  if (age >= RG.fullAfter) cell.type = cell.baseType;
  else if (age >= RG.sparseAfter) cell.type = cell.baseType === 'dense' ? 'sparse' : cell.baseType;
  else if (age >= RG.grassAfter)
    // Only vegetation passes through the scarred-grass stage; roads, firebreaks
    // and other infrastructure are simply restored (repaired) by the next season.
    cell.type = vegetation ? 'grass' : cell.baseType;
}

/** Housing stock vs the 2026 baseline for a season year (balance: development). */
export function developmentFactor(year: number): number {
  if (year <= 2026) return 1;
  if (year <= DEV.peakYear)
    return 1 + (DEV.peakFactor - 1) * ((year - 2026) / (DEV.peakYear - 2026));
  if (year >= DEV.endYear) return DEV.endFactor;
  return (
    DEV.peakFactor +
    (DEV.endFactor - DEV.peakFactor) * ((year - DEV.peakYear) / (DEV.endYear - DEV.peakYear))
  );
}

/**
 * Between seasons, each village's housing stock is adjusted toward its era
 * target: growth builds outward in stable ring order (deterministic — a
 * reloaded campaign redevelops the same lots); retreat abandons the farthest
 * homes first, lots reverting to grass with no loss counted — people leave
 * before the fire chooses.
 */
function applyDevelopment(grid: Cell[], fresh: Cell[], villages: Point[], year: number): void {
  const factor = developmentFactor(year);
  const buildable = (t: TileType) => t === 'grass' || t === 'sparse' || t === 'dense';
  for (const v of villages) {
    let baseline = 0;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const nx = v.x + dx;
        const ny = v.y + dy;
        if (inBounds({ w: M.W, h: M.H }, nx, ny) && fresh[ny * M.W + nx]!.type === 'house')
          baseline++;
      }
    const target = Math.round(baseline * factor);

    const houses: { i: number; d: number }[] = [];
    for (let dy = -DEV.maxRing; dy <= DEV.maxRing; dy++)
      for (let dx = -DEV.maxRing; dx <= DEV.maxRing; dx++) {
        const nx = v.x + dx;
        const ny = v.y + dy;
        if (!inBounds({ w: M.W, h: M.H }, nx, ny)) continue;
        if (grid[ny * M.W + nx]!.type === 'house')
          houses.push({ i: ny * M.W + nx, d: Math.max(Math.abs(dx), Math.abs(dy)) });
      }
    let current = houses.length;

    if (current < target) {
      for (let ring = 1; ring <= DEV.maxRing && current < target; ring++)
        for (let dy = -ring; dy <= ring && current < target; dy++)
          for (let dx = -ring; dx <= ring && current < target; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const nx = v.x + dx;
            const ny = v.y + dy;
            if (!inBounds({ w: M.W, h: M.H }, nx, ny)) continue;
            const cell = grid[ny * M.W + nx]!;
            if (!buildable(cell.type)) continue;
            cell.type = 'house';
            cell.baseType = 'house';
            cell.occupants =
              M.occupantsMin +
              Math.floor(hash2(nx, ny, 0xd37e) * (M.occupantsMax - M.occupantsMin + 1));
            current++;
          }
    } else if (current > target) {
      houses.sort((a, b) => b.d - a.d || a.i - b.i);
      for (let k = 0; k < current - target; k++) {
        const cell = grid[houses[k]!.i]!;
        cell.type = 'grass';
        cell.baseType = 'grass';
        cell.occupants = 0;
      }
    }
  }
}

/**
 * When the sector grows, the revealed ring must not meet the old edge as a
 * ruler line: where fire burnt against the old boundary, a short, decaying
 * spillover of burn history is stamped onto the new ring — the fire never
 * respected the sector line, the player just couldn't see past it.
 * An rng roll is drawn for every ring cell so a reloaded campaign stamps
 * exactly the same cells as a played-through one.
 */
function blendSectorSeam(grid: Cell[], seed: number, seasonIndex: number, center: Point): void {
  const oldB = boundsForSeason(seasonIndex - 1, center);
  const newB = boundsForSeason(seasonIndex, center);
  if (oldB.x0 === newB.x0 && oldB.y0 === newB.y0 && oldB.x1 === newB.x1 && oldB.y1 === newB.y1)
    return;
  const rng = mulberry32(seed ^ (0x5eaa + seasonIndex * 131));
  const inOld = (x: number, y: number) =>
    x >= oldB.x0 && x < oldB.x1 && y >= oldB.y0 && y < oldB.y1;
  for (let y = newB.y0; y < newB.y1; y++)
    for (let x = newB.x0; x < newB.x1; x++) {
      if (inOld(x, y)) continue;
      const roll = rng();
      // Nearest cell just inside the old sector, and how far past the edge we are.
      const cx = Math.min(Math.max(x, oldB.x0), oldB.x1 - 1);
      const cy = Math.min(Math.max(y, oldB.y0), oldB.y1 - 1);
      const dist = Math.max(Math.abs(x - cx), Math.abs(y - cy));
      if (dist > 3) continue;
      const source = grid[cy * M.W + cx]!;
      if (source.burntYear <= 0) continue;
      const cell = grid[y * M.W + x]!;
      const vegetation = cell.type === 'grass' || cell.type === 'sparse' || cell.type === 'dense';
      if (!vegetation || cell.burntYear > 0) continue;
      if (roll < 0.95 - dist * 0.28) cell.burntYear = source.burntYear;
    }
}

/** Authored season script: staggered ignitions in viable fuel, one wind shift, relief rain per curve. */
function buildScript(s: GameState, seasonIndex: number, villages: Point[]): SeasonScript {
  const rng = mulberry32(s.seed ^ (0xbeef + seasonIndex));
  const params = seasons[seasonIndex]!;
  const script: SeasonScript = { ignitions: [], windShifts: [], reliefRains: [], drought: null };
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

  // Ignition sites: fuel tiles near a road, away from villages and the crossroads,
  // in continuous fuel connected to a real fuel mass — all within the sector.
  const candidates: Point[] = [];
  for (let y = b.y0 + 1; y < b.y1 - 1; y++)
    for (let x = b.x0 + 1; x < b.x1 - 1; x++) {
      const c = s.grid[idx(s, x, y)]!;
      if (c.type !== 'grass' && c.type !== 'sparse') continue;
      const farFromVillages = villages.every((v) => Math.abs(v.x - x) + Math.abs(v.y - y) >= 8);
      if (!farFromVillages) continue;
      // Not on the staging crossroads' doorstep — the parked engines would kill it in one tick.
      if (Math.abs(s.center.x - x) + Math.abs(s.center.y - y) < 10) continue;
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

  // Extreme drought: possible from 2045, certain (and earlier) from 2060 —
  // the river runs dry shortly before the season's late fires.
  if (params.year >= DE.from && (params.year >= DE.alwaysFrom || rng() < DE.chance)) {
    const fromEnd = params.year >= DE.alwaysFrom ? DE.ignitionsFromEndEarly : 1;
    const targetIndex = Math.max(0, script.ignitions.length - fromEnd);
    const target = script.ignitions[targetIndex];
    if (target)
      script.drought = { tick: Math.max(1, target.tick - DE.leadTicks), targetIndex, done: false };
  }

  return script;
}

/**
 * Create a season. seasonIndex 0 = 2026 … 9 = 2070. Pass the previous season's
 * grid as `carryGrid` to inherit the persistent world: scars regrow on a
 * real-years clock, permanent conversions stay, transient fire state resets.
 * `carryTowers` keeps watch towers standing — they are structures, not units.
 */
export function createSeason(
  seed: number,
  seasonIndex = 0,
  carryGrid?: Cell[],
  carryTowers?: Point[],
): GameState {
  const params = seasons[seasonIndex];
  if (!params) throw new Error(`no season ${seasonIndex}`);
  const { grid: freshGrid, center, villages } = generateMap(seed);
  const rng = mulberry32(seed ^ (0xf17e + seasonIndex * 101));

  let grid = freshGrid;
  if (carryGrid) {
    if (carryGrid.length !== freshGrid.length)
      throw new Error('carry grid does not match world size');
    grid = carryGrid.map((c) => ({
      ...c,
      // The winter rains refill a drought-dried river between seasons.
      type: c.type === 'dryriver' ? ('water' as const) : c.type,
      state: c.state === 'burning' ? ('burnt' as const) : c.state,
      fuel: 0,
      intensity: 0,
      wetTimer: 0,
      igniteAge: 0,
      detected: false,
    }));
  }
  if (carryGrid && seasonIndex > 0) blendSectorSeam(grid, seed, seasonIndex, center);
  for (const cell of grid) applyRegrowth(cell, params.year);
  applyDevelopment(grid, freshGrid, villages, params.year);

  const state: GameState = {
    seed,
    seasonYear: params.year,
    seasonIndex,
    tick: 0,
    w: M.W,
    h: M.H,
    grid,
    bounds: boundsForSeason(seasonIndex, center),
    wind: { dir: rng() * Math.PI * 2, str: params.windStr },
    dryness: params.dryness,
    spreadMult: params.spreadMult ?? 1,
    windStrBase: params.windStr,
    seasonLen: params.seasonLen,
    randomIgnitionRate: params.randomIgnitionRate,
    rainTicks: 0,
    quietTicks: 0,
    center,
    trucks: [1, 2].map((id) => ({
      id,
      x: center.x,
      y: center.y,
      water: T.waterCapacity,
      path: [],
      movePoints: 0,
      target: null,
      trail: [{ x: center.x, y: center.y }],
      dangerTicks: 0,
    })),
    villages: villages.map((v, i) => ({
      id: i + 1,
      x: v.x,
      y: v.y,
      evac: 'none' as const,
      evacStartTick: 0,
    })),
    bombers: (params.year >= unlocks.bomber2
      ? [1, 2]
      : params.year >= unlocks.bomber
        ? [1]
        : []
    ).map((id) => ({
      id,
      x: center.x,
      y: center.y,
      px: center.x,
      py: center.y,
      state: 'ready' as const,
      target: null,
      line: [],
      dropProgress: 0,
      phaseTicks: 0,
    })),
    crews:
      params.year >= unlocks.crew
        ? [
            {
              id: 1,
              x: center.x,
              y: center.y,
              path: [],
              movePoints: 0,
              jobs: [],
              cutProgress: 0,
              trail: [{ x: center.x, y: center.y }],
              dangerTicks: 0,
            },
          ]
        : [],
    towers: (carryTowers ?? []).map((t) => ({ ...t })),
    towersAvailable: Math.max(
      0,
      (params.year >= unlocks.towers ? tower.count : 0) - (carryTowers?.length ?? 0),
    ),
    stats: {
      hectaresBurnt: 0,
      animalsKilled: 0,
      housesLost: 0,
      firefightersLost: 0,
      civiliansLost: 0,
    },
    script: { ignitions: [], windShifts: [], reliefRains: [], drought: null },
    rng,
    ended: false,
    terrainVersion: 0,
  };
  state.script = buildScript(state, seasonIndex, villages);
  return state;
}
