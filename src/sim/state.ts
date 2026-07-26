import type { Rng } from './rng';

export type TileType =
  | 'dense'
  | 'sparse'
  | 'grass'
  | 'water'
  | 'road'
  | 'house'
  | 'firebreak'
  | 'rock';

export type CellState = 'unburnt' | 'burning' | 'burnt';

export interface Cell {
  type: TileType;
  state: CellState;
  /** Remaining burn duration in ticks while burning. */
  fuel: number;
  /** 0 when not burning; 1–intensityCap while burning. */
  intensity: number;
  /** While > 0 the cell is wet: ignition rolls are multiplied by wetFactor. */
  wetTimer: number;
  /** House tiles only. */
  occupants: number;
  /** Ticks since ignition (drives detection). */
  igniteAge: number;
  /** A burning cell renders only once detected. */
  detected: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Truck {
  id: number;
  x: number;
  y: number;
  water: number;
  /** Remaining path to walk, front = next tile. */
  path: Point[];
  /** Fractional movement accumulator. */
  movePoints: number;
  /** Ordered destination while en route; null when idle/arrived. */
  target: Point | null;
  /** Tiles traversed during the last tick (first = start, last = current) — the renderer interpolates along it. */
  trail: Point[];
}

export interface Wind {
  /** Radians; direction the wind blows TOWARD. */
  dir: number;
  str: number;
}

export interface Stats {
  hectaresBurnt: number;
  animalsKilled: number;
  housesLost: number;
  firefightersLost: number;
  civiliansLost: number;
}

export interface ScriptedIgnition {
  tick: number;
  x: number;
  y: number;
  done: boolean;
}

export interface ScriptedWindShift {
  tick: number;
  /** Radians added to wind.dir. */
  delta: number;
  done: boolean;
}

export interface ScriptedRain {
  tick: number;
  done: boolean;
}

export interface SeasonScript {
  ignitions: ScriptedIgnition[];
  windShifts: ScriptedWindShift[];
  reliefRains: ScriptedRain[];
}

export interface GameState {
  seed: number;
  seasonYear: number;
  tick: number;
  w: number;
  h: number;
  grid: Cell[];
  wind: Wind;
  dryness: number;
  /** Per-season brake on spread probability (1 = neutral). */
  spreadMult: number;
  windStrBase: number;
  seasonLen: number;
  randomIgnitionRate: number;
  /** Ticks of visible rainfall remaining (presentation window; mechanics apply separately). */
  rainTicks: number;
  station: Point;
  trucks: Truck[];
  stats: Stats;
  script: SeasonScript;
  rng: Rng;
  ended: boolean;
}

/**
 * Player orders are measures aimed at the map, not unit micro: `dispatch`
 * without a truckId sends the closest available engine; with one, that engine.
 */
export type Command = { type: 'dispatch'; x: number; y: number; truckId?: number };

export type GameEvent =
  | { type: 'fireDetected'; x: number; y: number }
  | { type: 'engineDispatched'; truckId: number; x: number; y: number }
  | { type: 'reliefRain' }
  | { type: 'windShift' }
  | { type: 'seasonEnded'; report: Stats };

export function idx(s: { w: number }, x: number, y: number): number {
  return y * s.w + x;
}

export function inBounds(s: { w: number; h: number }, x: number, y: number): boolean {
  return x >= 0 && x < s.w && y >= 0 && y < s.h;
}

export function cellAt(s: GameState, x: number, y: number): Cell {
  const c = s.grid[idx(s, x, y)];
  if (!c) throw new Error(`cell out of bounds: ${x},${y}`);
  return c;
}
