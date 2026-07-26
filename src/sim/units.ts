import { bomber as B, crewUnit as CU, danger as D, truck as T } from './balance';
import type { Crew, GameEvent, GameState, Point, Truck } from './state';
import { cellAt, idx, inActive } from './state';

function moveCost(s: GameState, x: number, y: number): number {
  const cell = cellAt(s, x, y);
  const speed = T.moveSpeed[cell.type];
  if (speed <= 0) return Number.POSITIVE_INFINITY;
  // Rigs don't drive through flame walls unless there is no other way.
  return cell.state === 'burning' ? 25 / speed : 1 / speed;
}

/** A* over the move-cost grid. Returns the path excluding start, or [] if unreachable. */
export function findPath(s: GameState, from: Point, to: Point): Point[] {
  if (!inActive(s, to.x, to.y) || moveCost(s, to.x, to.y) === Number.POSITIVE_INFINITY) return [];
  const n = s.w * s.h;
  const g = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const start = idx(s, from.x, from.y);
  const goal = idx(s, to.x, to.y);
  g[start] = 0;
  // Simple open list — the grid is 1,536 cells; no heap needed.
  const open: number[] = [start];
  const h = (i: number) => {
    const x = i % s.w;
    const y = Math.floor(i / s.w);
    return (Math.abs(x - to.x) + Math.abs(y - to.y)) * 0.25;
  };
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++)
      if (g[open[i]!]! + h(open[i]!) < g[open[bi]!]! + h(open[bi]!)) bi = i;
    const cur = open.splice(bi, 1)[0]!;
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % s.w;
    const cy = Math.floor(cur / s.w);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (!inActive(s, nx, ny)) continue;
        const ni = idx(s, nx, ny);
        if (closed[ni]) continue;
        const stepCost = moveCost(s, nx, ny) * (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
        if (!Number.isFinite(stepCost)) continue;
        const ng = g[cur]! + stepCost;
        if (ng < g[ni]!) {
          g[ni] = ng;
          prev[ni] = cur;
          open.push(ni);
        }
      }
  }
  if (prev[goal] === -1 && goal !== start) return [];
  const path: Point[] = [];
  let cur = goal;
  while (cur !== start && cur !== -1) {
    path.push({ x: cur % s.w, y: Math.floor(cur / s.w) });
    cur = prev[cur]!;
  }
  path.reverse();
  return path;
}

/** Best path to a Moore neighbour of (x,y), preferring non-burning stands. */
function pathAdjacentTo(s: GameState, from: Point, x: number, y: number): Point[] {
  let best: Point[] = [];
  let bestBurning = true;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inActive(s, nx, ny)) continue;
      if (from.x === nx && from.y === ny) return []; // already adjacent
      const burning = cellAt(s, nx, ny).state === 'burning';
      const p = findPath(s, from, { x: nx, y: ny });
      if (p.length === 0) continue;
      const better =
        best.length === 0 ||
        (bestBurning && !burning) ||
        (burning === bestBurning && p.length < best.length);
      if (better) {
        best = p;
        bestBurning = burning;
      }
    }
  return best;
}

/**
 * Reachable path to (x,y). A burning target routes to its edge — engines fight
 * fire from adjacent tiles, they don't park in it. Unreachable targets (water)
 * fall back to the best-reachable neighbour.
 */
function pathToOrNear(s: GameState, from: Point, x: number, y: number): Point[] {
  if (cellAt(s, x, y).state === 'burning') return pathAdjacentTo(s, from, x, y);
  const direct = findPath(s, from, { x, y });
  if (direct.length > 0 || (from.x === x && from.y === y)) return direct;
  return pathAdjacentTo(s, from, x, y);
}

/**
 * Dispatch an engine to (x,y). Without truckId, the closest available engine
 * responds: lowest path length, heavily penalized if its tank is empty, lightly
 * if already en route. Deterministic (fixed iteration order, lowest id wins ties).
 * Returns the dispatched engine's id, or null if nothing can reach the target.
 */
export function dispatchEngine(
  s: GameState,
  x: number,
  y: number,
  truckId?: number,
): number | null {
  if (truckId != null) {
    const t = s.trucks.find((tr) => tr.id === truckId);
    if (!t) return null;
    const path = pathToOrNear(s, { x: t.x, y: t.y }, x, y);
    if (path.length === 0 && !(t.x === x && t.y === y)) return null;
    t.path = path;
    t.target = path.length > 0 ? { x, y } : null;
    return t.id;
  }
  let best: { t: Truck; path: Point[]; cost: number } | null = null;
  for (const t of s.trucks) {
    const path = pathToOrNear(s, { x: t.x, y: t.y }, x, y);
    if (path.length === 0 && !(t.x === x && t.y === y)) continue;
    const cost = path.length + (t.water === 0 ? 1000 : 0) + (t.path.length > 0 ? 8 : 0);
    if (best === null || cost < best.cost) best = { t, path, cost };
  }
  if (best === null) return null;
  best.t.path = best.path;
  best.t.target = best.path.length > 0 ? { x, y } : null;
  return best.t.id;
}

function adjacentBurning(s: GameState, t: Truck): { x: number; y: number } | null {
  let best: { x: number; y: number; i: number } | null = null;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (!inActive(s, nx, ny)) continue;
      const c = cellAt(s, nx, ny);
      if (c.state === 'burning' && (best === null || c.intensity > best.i))
        best = { x: nx, y: ny, i: c.intensity };
    }
  return best;
}

function adjacentToWater(s: GameState, t: Truck): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (inActive(s, nx, ny) && cellAt(s, nx, ny).type === 'water') return true;
    }
  return false;
}

/** One tick of truck behaviour: move along ordered path, else fight adjacent fire, else refill. */
export function updateTrucks(s: GameState): void {
  for (const t of s.trucks) {
    t.trail = [{ x: t.x, y: t.y }];
    if (t.path.length > 0) {
      const speed = T.moveSpeed[cellAt(s, t.x, t.y).type] || 0.75;
      t.movePoints += speed;
      while (t.movePoints >= 1 && t.path.length > 0) {
        const next = t.path.shift()!;
        t.x = next.x;
        t.y = next.y;
        t.trail.push({ x: next.x, y: next.y });
        t.movePoints -= 1;
      }
      if (t.path.length === 0) t.target = null;
      continue;
    }
    t.movePoints = 0;
    t.target = null;

    // An engine standing in fire fights its own tile first.
    const own = cellAt(s, t.x, t.y);
    if (own.state === 'burning' && t.water > 0) {
      own.intensity -= T.extinguishPerTick;
      t.water -= 1;
      if (own.intensity <= 0) {
        own.state = 'unburnt';
        own.intensity = 0;
        own.wetTimer = T.wetTimerOnExtinguish;
        own.detected = false;
        own.igniteAge = 0;
      }
      continue;
    }

    const target = t.water > 0 ? adjacentBurning(s, t) : null;
    if (target) {
      const c = cellAt(s, target.x, target.y);
      c.intensity -= T.extinguishPerTick;
      t.water -= 1;
      if (c.intensity <= 0) {
        c.state = 'unburnt';
        c.intensity = 0;
        c.wetTimer = T.wetTimerOnExtinguish;
        c.detected = false;
        c.igniteAge = 0;
      }
      continue;
    }

    if (t.water < T.waterCapacity && adjacentToWater(s, t)) {
      t.water = Math.min(T.waterCapacity, t.water + T.refillPerTick);
    }
  }
}

// --- Water bombers -----------------------------------------------------------

/**
 * The cells of a retardant line: `length` distinct cells rasterized from
 * `from` toward `aim`. Shared by the sim and the aiming preview so what the
 * player sees is exactly what the bomber lays.
 */
export function dropLineCells(from: Point, aim: Point, length: number): Point[] {
  const dx = aim.x - from.x;
  const dy = aim.y - from.y;
  const n = Math.hypot(dx, dy);
  if (n === 0) return [{ x: from.x, y: from.y }];
  const cells: Point[] = [];
  for (let t = 0; cells.length < length && t <= length * 1.5 + 0.001; t += 0.5) {
    const cx = Math.round(from.x + (dx / n) * t);
    const cy = Math.round(from.y + (dy / n) * t);
    const last = cells[cells.length - 1];
    if (!last || last.x !== cx || last.y !== cy) cells.push({ x: cx, y: cy });
  }
  return cells;
}

/** The nearest point on the active sector's edge — bombers fly in from off-map. */
function nearestEdgePoint(s: GameState, p: Point): Point {
  const candidates: Point[] = [
    { x: p.x, y: s.bounds.y0 },
    { x: p.x, y: s.bounds.y1 - 1 },
    { x: s.bounds.x0, y: p.y },
    { x: s.bounds.x1 - 1, y: p.y },
  ];
  let best = candidates[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * Send the first ready bomber to lay a retardant line anchored at (x,y),
 * running toward (x2,y2). It enters over the nearest map border — the
 * airbase is beyond the valley. Returns its id, or null.
 */
export function dispatchBomber(
  s: GameState,
  x: number,
  y: number,
  x2: number,
  y2: number,
): number | null {
  if (!inActive(s, x, y) || (x === x2 && y === y2)) return null;
  // An extreme drought grounds the fleet: there is no water to drop.
  if (s.script.drought?.done) return null;
  const b = s.bombers.find((bb) => bb.state === 'ready');
  if (!b) return null;
  const entry = nearestEdgePoint(s, { x, y });
  b.x = entry.x;
  b.y = entry.y;
  b.px = entry.x;
  b.py = entry.y;
  b.state = 'outbound';
  b.line = dropLineCells({ x, y }, { x: x2, y: y2 }, B.lineLength);
  b.target = { x, y };
  b.dropProgress = 0;
  return b.id;
}

/** Straight-line flight toward (tx,ty); true once arrived. */
function fly(b: { x: number; y: number }, tx: number, ty: number): boolean {
  const dx = tx - b.x;
  const dy = ty - b.y;
  const d = Math.hypot(dx, dy);
  if (d <= B.flySpeed) {
    b.x = tx;
    b.y = ty;
    return true;
  }
  b.x += (dx / d) * B.flySpeed;
  b.y += (dy / d) * B.flySpeed;
  return false;
}

/** Retardant on one line cell: kill the fire, soak the ground, splash the sides. */
function applyRetardant(s: GameState, at: Point): void {
  if (!inActive(s, at.x, at.y)) return;
  const c = cellAt(s, at.x, at.y);
  if (c.state === 'burning') {
    c.intensity -= B.intensityDrop;
    if (c.intensity <= 0) {
      c.state = 'unburnt';
      c.intensity = 0;
      c.igniteAge = 0;
      c.detected = false;
    }
  }
  c.wetTimer = Math.max(c.wetTimer, B.dropWetTicks);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    if (!inActive(s, at.x + dx, at.y + dy)) continue;
    const n = cellAt(s, at.x + dx, at.y + dy);
    n.wetTimer = Math.max(n.wetTimer, B.splashWetTicks);
  }
}

/** One tick of bomber behaviour: fly out, run the line dropping as it passes, fly home, reload. */
export function updateBombers(s: GameState, events: GameEvent[]): void {
  for (const b of s.bombers) {
    b.px = b.x;
    b.py = b.y;
    switch (b.state) {
      case 'outbound':
        if (b.target && fly(b, b.target.x, b.target.y)) {
          b.state = 'dropping';
          b.dropProgress = 0;
        }
        break;
      case 'dropping': {
        const prev = b.dropProgress;
        b.dropProgress += B.flySpeed;
        const upto = Math.min(Math.floor(b.dropProgress), b.line.length);
        for (let i = Math.floor(prev); i < upto; i++) applyRetardant(s, b.line[i]!);
        const at = b.line[Math.min(upto, b.line.length) - 1] ?? b.target;
        if (at) {
          b.x = at.x;
          b.y = at.y;
        }
        if (b.dropProgress >= b.line.length) {
          const start = b.line[0]!;
          events.push({ type: 'bomberDrop', x: start.x, y: start.y });
          b.line = [];
          b.target = nearestEdgePoint(s, { x: Math.round(b.x), y: Math.round(b.y) });
          b.state = 'returning';
        }
        break;
      }
      case 'returning':
        // Out over the border, then rearm off-map.
        if (!b.target || fly(b, b.target.x, b.target.y)) {
          b.target = null;
          b.state = 'reloading';
          b.phaseTicks = B.reloadTicks;
        }
        break;
      case 'reloading':
        b.phaseTicks -= 1;
        if (b.phaseTicks <= 0) b.state = 'ready';
        break;
      case 'ready':
        break;
    }
  }
}

// --- Fire crews --------------------------------------------------------------

function cuttable(s: GameState, x: number, y: number): boolean {
  const t = cellAt(s, x, y).type;
  return t === 'grass' || t === 'sparse' || t === 'dense';
}

/**
 * Queue a firebreak cut at (x,y) on a crew. A non-vegetation but passable
 * target is a move order instead — it clears the queue and walks the crew
 * there (the way to pull a crew out of danger). Returns the crew's id, or null.
 */
export function dispatchCrew(s: GameState, x: number, y: number, crewId?: number): number | null {
  if (!inActive(s, x, y)) return null;
  const crew = crewId != null ? s.crews.find((c) => c.id === crewId) : s.crews[0];
  if (!crew) return null;
  if (!cuttable(s, x, y)) {
    const speed = T.moveSpeed[cellAt(s, x, y).type];
    if (speed <= 0) return null;
    const path = findPath(s, { x: crew.x, y: crew.y }, { x, y });
    if (path.length === 0 && !(crew.x === x && crew.y === y)) return null;
    crew.jobs = [];
    crew.cutProgress = 0;
    crew.path = path;
    return crew.id;
  }
  if (crew.jobs.some((j) => j.x === x && j.y === y)) return crew.id;
  crew.jobs.push({ x, y });
  return crew.id;
}

/** One tick of crew behaviour: walk to the next queued tile, cut it into a firebreak. */
export function updateCrews(s: GameState): void {
  for (const crew of s.crews) {
    crew.trail = [{ x: crew.x, y: crew.y }];
    if (crew.path.length > 0) {
      const speed = (T.moveSpeed[cellAt(s, crew.x, crew.y).type] || 0.75) * CU.speedFactor;
      crew.movePoints += speed;
      while (crew.movePoints >= 1 && crew.path.length > 0) {
        const next = crew.path.shift()!;
        crew.x = next.x;
        crew.y = next.y;
        crew.trail.push({ x: next.x, y: next.y });
        crew.movePoints -= 1;
      }
      continue;
    }
    crew.movePoints = 0;

    // Drop jobs the fire has already claimed (or that stopped being vegetation).
    while (crew.jobs.length > 0) {
      const job = crew.jobs[0]!;
      if (cuttable(s, job.x, job.y) && cellAt(s, job.x, job.y).state === 'unburnt') break;
      crew.jobs.shift();
      crew.cutProgress = 0;
    }
    const job = crew.jobs[0];
    if (!job) continue;

    if (crew.x === job.x && crew.y === job.y) {
      crew.cutProgress += 1;
      if (crew.cutProgress >= CU.cutTicks) {
        cellAt(s, job.x, job.y).type = 'firebreak'; // baseType keeps the old ground
        s.terrainVersion += 1; // the baked terrain layer must repaint
        crew.jobs.shift();
        crew.cutProgress = 0;
      }
    } else {
      crew.cutProgress = 0;
      const path = findPath(s, { x: crew.x, y: crew.y }, job);
      if (path.length === 0)
        crew.jobs.shift(); // unreachable — skip it
      else crew.path = path;
    }
  }
}

// --- Firefighter danger rule -------------------------------------------------

/** Burning Moore neighbours at or above the heavy-fire threshold. */
function heavyNeighbors(s: GameState, x: number, y: number): number {
  let heavy = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inActive(s, nx, ny)) continue;
      const c = cellAt(s, nx, ny);
      if (c.state === 'burning' && c.intensity >= D.intensityThreshold) heavy++;
    }
  return heavy;
}

/** Any burning Moore neighbour at all, regardless of intensity. */
function anyBurningNeighbor(s: GameState, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inActive(s, nx, ny) && cellAt(s, nx, ny).state === 'burning') return true;
    }
  return false;
}

function inDanger(
  s: GameState,
  u: { x: number; y: number },
  neighbors: number,
  tankEmpty: boolean,
): boolean {
  if (cellAt(s, u.x, u.y).state === 'burning') return true;
  // No water, no defense: a dry-tank engine is in danger beside any fire at all.
  if (tankEmpty && anyBurningNeighbor(s, u.x, u.y)) return true;
  return heavyNeighbors(s, u.x, u.y) >= neighbors;
}

/** A tile is safe when it is not burning and no Moore neighbour burns. */
function isSafeTile(s: GameState, x: number, y: number): boolean {
  if (cellAt(s, x, y).state === 'burning') return false;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inActive(s, nx, ny) && cellAt(s, nx, ny).state === 'burning') return false;
    }
  return true;
}

/**
 * True when no safe tile is reachable without crossing fire — a BFS over
 * passable, non-burning ground within the escape radius. The unit's own tile
 * is exempt from the non-burning requirement (they can run off it).
 */
function trapped(s: GameState, u: { x: number; y: number }): boolean {
  const seen = new Set<number>();
  const queue: Point[] = [{ x: u.x, y: u.y }];
  seen.add(idx(s, u.x, u.y));
  while (queue.length > 0) {
    const p = queue.shift()!;
    if (isSafeTile(s, p.x, p.y)) return false;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (!inActive(s, nx, ny)) continue;
        if (Math.max(Math.abs(nx - u.x), Math.abs(ny - u.y)) > D.escapeRadius) continue;
        const i = idx(s, nx, ny);
        if (seen.has(i)) continue;
        const c = cellAt(s, nx, ny);
        if (c.state === 'burning' || T.moveSpeed[c.type] <= 0) continue;
        // An honest escape: no squeezing through corridors flanked by heavy fire.
        if (heavyNeighbors(s, nx, ny) >= D.corridorFlanks) continue;
        seen.add(i);
        queue.push({ x: nx, y: ny });
      }
  }
  return true;
}

function dangerSweep(
  s: GameState,
  units: (Truck | Crew)[],
  kind: 'engine' | 'crew',
  crewSize: number,
  neighbors: number,
  events: GameEvent[],
): void {
  const lost: number[] = [];
  for (const u of units) {
    const tankEmpty = kind === 'engine' && (u as Truck).water <= 0;
    if (!inDanger(s, u, neighbors, tankEmpty)) {
      u.dangerTicks = 0;
      continue;
    }
    u.dangerTicks += 1;
    if (u.dangerTicks === D.graceTicks)
      events.push({ type: 'crewDanger', unit: kind, unitId: u.id });
    if (u.dangerTicks >= D.graceTicks && trapped(s, u)) {
      lost.push(u.id);
      s.stats.firefightersLost += crewSize;
      events.push({ type: 'unitLost', unit: kind, unitId: u.id, firefighters: crewSize });
    }
  }
  for (const id of lost) {
    const at = units.findIndex((u) => u.id === id);
    if (at >= 0) units.splice(at, 1);
  }
}

/**
 * The danger rule (gameplay doc §4.2), active from its reveal season. No
 * auto-retreat: the radio warning is the cue, and a crew is lost only when
 * genuinely trapped. Lost units are rebuilt the following season.
 */
export function applyDangerRule(s: GameState, events: GameEvent[]): void {
  if (s.seasonYear < D.from) return;
  dangerSweep(s, s.trucks, 'engine', T.crew, D.neighbors, events);
  dangerSweep(s, s.crews, 'crew', CU.crew, D.crewNeighbors, events);
}
