import { truck as T } from './balance';
import type { GameState, Point, Truck } from './state';
import { cellAt, idx, inBounds } from './state';

function moveCost(s: GameState, x: number, y: number): number {
  const speed = T.moveSpeed[cellAt(s, x, y).type];
  return speed > 0 ? 1 / speed : Number.POSITIVE_INFINITY;
}

/** A* over the move-cost grid. Returns the path excluding start, or [] if unreachable. */
export function findPath(s: GameState, from: Point, to: Point): Point[] {
  if (!inBounds(s, to.x, to.y) || moveCost(s, to.x, to.y) === Number.POSITIVE_INFINITY) return [];
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
        if (!inBounds(s, nx, ny)) continue;
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

export function orderTruck(s: GameState, truckId: number, x: number, y: number): void {
  const t = s.trucks.find((tr) => tr.id === truckId);
  if (!t) return;
  t.path = findPath(s, { x: t.x, y: t.y }, { x, y });
}

function adjacentBurning(s: GameState, t: Truck): { x: number; y: number } | null {
  let best: { x: number; y: number; i: number } | null = null;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (!inBounds(s, nx, ny)) continue;
      const c = cellAt(s, nx, ny);
      if (c.state === 'burning' && (best === null || c.intensity > best.i))
        best = { x: nx, y: ny, i: c.intensity };
    }
  return best;
}

function adjacentToWaterOrStation(s: GameState, t: Truck): boolean {
  if (Math.abs(t.x - s.station.x) <= 1 && Math.abs(t.y - s.station.y) <= 1) return true;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (inBounds(s, nx, ny) && cellAt(s, nx, ny).type === 'water') return true;
    }
  return false;
}

/** One tick of truck behaviour: move along ordered path, else fight adjacent fire, else refill. */
export function updateTrucks(s: GameState): void {
  for (const t of s.trucks) {
    if (t.path.length > 0) {
      const speed = T.moveSpeed[cellAt(s, t.x, t.y).type] || 0.75;
      t.movePoints += speed;
      while (t.movePoints >= 1 && t.path.length > 0) {
        const next = t.path.shift()!;
        t.x = next.x;
        t.y = next.y;
        t.movePoints -= 1;
      }
      continue;
    }
    t.movePoints = 0;

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

    if (t.water < T.waterCapacity && adjacentToWaterOrStation(s, t)) {
      t.water = Math.min(T.waterCapacity, t.water + T.refillPerTick);
    }
  }
}
