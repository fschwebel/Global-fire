import { ignitionSchedule as IG, map as M, truck as T, seasons } from './balance';
import { hash2, mulberry32 } from './rng';
import type { Cell, GameState, Point, SeasonScript, TileType } from './state';
import { idx, inBounds } from './state';

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
    state: 'unburnt',
    fuel: 0,
    intensity: 0,
    wetTimer: 0,
    occupants: 0,
    igniteAge: 0,
    detected: false,
  };
}

/**
 * Deterministic map generation from the campaign seed (gameplay doc §3.3).
 * One persistent map for the whole campaign.
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
      if (yy >= 0 && yy < M.H) grid[yy * M.W + x]!.type = 'water';
    }
    const r = rng();
    if (r < 0.3 && ry > 2) ry--;
    else if (r > 0.7 && ry < M.H - 3) ry++;
  }

  // 3. Fire station: roughly central, not on water.
  const station: Point = { x: Math.floor(M.W / 2), y: Math.floor(M.H / 2) };
  while (grid[station.y * M.W + station.x]!.type === 'water') station.y++;
  grid[station.y * M.W + station.x]!.type = 'road';

  // 4. Villages: clusters in grass/sparse clearings, buffered from dense forest.
  const villages: Point[] = [];
  let guard = 0;
  while (villages.length < M.villageCount && guard++ < 500) {
    const cx = 4 + Math.floor(rng() * (M.W - 8));
    const cy = 3 + Math.floor(rng() * (M.H - 6));
    const c = grid[cy * M.W + cx]!;
    if (c.type !== 'grass' && c.type !== 'sparse') continue;
    if (Math.abs(cx - station.x) + Math.abs(cy - station.y) < 6) continue;
    if (villages.some((v) => Math.abs(v.x - cx) + Math.abs(v.y - cy) < 10)) continue;
    let nearDense = false;
    for (let dy = -2; dy <= 2 && !nearDense; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (inBounds({ w: M.W, h: M.H }, nx, ny) && grid[ny * M.W + nx]!.type === 'dense') {
          nearDense = true;
          break;
        }
      }
    if (nearDense) continue;

    const houses =
      M.villageMinHouses + Math.floor(rng() * (M.villageMaxHouses - M.villageMinHouses + 1));
    let placed = 0;
    let ring = 0;
    while (placed < houses && ring < 4) {
      for (let dy = -ring; dy <= ring && placed < houses; dy++)
        for (let dx = -ring; dx <= ring && placed < houses; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (!inBounds({ w: M.W, h: M.H }, nx, ny)) continue;
          const cell = grid[ny * M.W + nx]!;
          if (cell.type === 'grass' || cell.type === 'sparse') {
            cell.type = 'house';
            cell.occupants =
              M.occupantsMin + Math.floor(rng() * (M.occupantsMax - M.occupantsMin + 1));
            placed++;
          }
        }
      ring++;
    }
    if (placed >= M.villageMinHouses) villages.push({ x: cx, y: cy });
  }

  // 5. Roads: L-shaped connections village → station (bridges cross the river).
  for (const v of villages) {
    let x = v.x;
    let y = v.y;
    const step = () => {
      const cell = grid[y * M.W + x]!;
      if (cell.type !== 'house' && cell.type !== 'water') cell.type = 'road';
      if (cell.type === 'water') cell.type = 'road'; // bridge
    };
    while (x !== station.x) {
      step();
      x += x < station.x ? 1 : -1;
    }
    while (y !== station.y) {
      step();
      y += y < station.y ? 1 : -1;
    }
  }
  grid[station.y * M.W + station.x]!.type = 'road';

  // 6. One pre-authored firebreak line near the largest dense block edge.
  const fy = Math.floor(M.H * 0.25);
  for (let x = 2; x < 10; x++) {
    const cell = grid[fy * M.W + x]!;
    if (cell.type === 'dense' || cell.type === 'sparse' || cell.type === 'grass')
      cell.type = 'firebreak';
  }

  return { grid, station, villages };
}

/** Authored 2026 tutorial script (progression doc §1.3): near-road grass ignition, one wind shift, one relief rain. */
function buildScript(s: GameState, seasonIndex: number, villages: Point[]): SeasonScript {
  const rng = mulberry32(s.seed ^ (0xbeef + seasonIndex));
  const params = seasons[seasonIndex]!;
  const script: SeasonScript = { ignitions: [], windShifts: [], reliefRains: [] };

  // Connected flammable components (grass/sparse/dense): a fire only matters
  // if its site can reach a real fuel mass, not a pocket boxed in by barriers.
  const comp = new Int32Array(s.w * s.h).fill(-1);
  const compSize: number[] = [];
  for (let start = 0; start < s.w * s.h; start++) {
    const cell = s.grid[start]!;
    if (
      comp[start] !== -1 ||
      (cell.type !== 'grass' && cell.type !== 'sparse' && cell.type !== 'dense')
    )
      continue;
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
        if (!inBounds(s, nx, ny)) continue;
        const ni = ny * s.w + nx;
        const nc = s.grid[ni]!;
        if (
          comp[ni] === -1 &&
          (nc.type === 'grass' || nc.type === 'sparse' || nc.type === 'dense')
        ) {
          comp[ni] = id;
          stack.push(ni);
        }
      }
    }
    compSize.push(size);
  }

  // Ignition sites: grass/sparse tiles near a road, ≥ 8 tiles from any village.
  const candidates: Point[] = [];
  for (let y = 1; y < s.h - 1; y++)
    for (let x = 1; x < s.w - 1; x++) {
      const c = s.grid[idx(s, x, y)]!;
      if (c.type !== 'grass' && c.type !== 'sparse') continue;
      const farFromVillages = villages.every((v) => Math.abs(v.x - x) + Math.abs(v.y - y) >= 8);
      if (!farFromVillages) continue;
      // Not on the station's doorstep — the parked engines would kill it in one tick.
      if (Math.abs(s.station.x - x) + Math.abs(s.station.y - y) < 10) continue;
      // Continuous fuel around the site, so young fires creep instead of
      // guttering out in scraps of grass between rock and water.
      let fuelAround = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inBounds(s, nx, ny)) continue;
          const type = s.grid[idx(s, nx, ny)]!.type;
          if (type === 'grass' || type === 'sparse' || type === 'dense') fuelAround++;
        }
      if (fuelAround < 17) continue;
      // The site's fuel mass must be large enough for the fire to matter.
      if ((compSize[comp[idx(s, x, y)]!] ?? 0) < 150) continue;
      let nearRoad = false;
      for (let dy = -3; dy <= 3 && !nearRoad; dy++)
        for (let dx = -3; dx <= 3; dx++)
          if (inBounds(s, x + dx, y + dy) && s.grid[idx(s, x + dx, y + dy)]!.type === 'road') {
            nearRoad = true;
            break;
          }
      if (nearRoad) candidates.push({ x, y });
    }

  // Staggered ignitions in separate regions — several small fires the player
  // must divide attention between, not one blaze. First is called in at once.
  // Spacing relaxes gradually (12 → 8 → 4 → any) rather than being abandoned.
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
  while (chosen.length < params.scriptedIgnitions) chosen.push({ x: 5, y: 5 });
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

/** Create a fresh season. seasonIndex 0 = 2026. */
export function createSeason(seed: number, seasonIndex = 0): GameState {
  const params = seasons[seasonIndex];
  if (!params) throw new Error(`no season ${seasonIndex}`);
  const { grid, station, villages } = generateMap(seed);
  const rng = mulberry32(seed ^ (0xf17e + seasonIndex * 101));

  const state: GameState = {
    seed,
    seasonYear: params.year,
    tick: 0,
    w: M.W,
    h: M.H,
    grid,
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
