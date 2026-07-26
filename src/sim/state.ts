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
  /** What this ground regrows toward (burnt houses and converted dense forest change it permanently). */
  baseType: TileType;
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
  /** Season year this cell last burnt out (0 = never) — drives regrowth and scar tint. */
  burntYear: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Active sector rectangle within the world grid; x1/y1 exclusive. */
export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
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
  /** Consecutive ticks in danger (burning tile / heavy fire beside) — the danger rule counts these. */
  dangerTicks: number;
}

export interface Village {
  id: number;
  x: number;
  y: number;
  /** Evacuation status this season; residents return between seasons. */
  evac: 'none' | 'inProgress' | 'done';
  evacStartTick: number;
}

export type BomberState = 'ready' | 'outbound' | 'dropping' | 'returning' | 'reloading';

export interface Bomber {
  id: number;
  /** World-tile coordinates; fractional while in flight. */
  x: number;
  y: number;
  /** Previous-tick position — the renderer interpolates the flight. */
  px: number;
  py: number;
  state: BomberState;
  /** Flight destination: the first cell of the retardant line. */
  target: Point | null;
  /** The retardant line being laid, anchor first. */
  line: Point[];
  /** Cells of the line already flown and dropped. */
  dropProgress: number;
  /** Ticks remaining in the reloading phase. */
  phaseTicks: number;
}

export interface Crew {
  id: number;
  x: number;
  y: number;
  path: Point[];
  movePoints: number;
  /** Ordered tiles to cut into firebreak; front = current job. */
  jobs: Point[];
  /** Cutting progress (ticks) on the current tile. */
  cutProgress: number;
  trail: Point[];
  /** Consecutive ticks in danger — see Truck.dangerTicks. */
  dangerTicks: number;
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
  /** 0–9 (2026 … 2070). */
  seasonIndex: number;
  tick: number;
  w: number;
  h: number;
  grid: Cell[];
  /** The playable sector this season — grows every two seasons. */
  bounds: Bounds;
  wind: Wind;
  dryness: number;
  /** Per-season brake on spread probability (1 = neutral). */
  spreadMult: number;
  windStrBase: number;
  seasonLen: number;
  randomIgnitionRate: number;
  /** Ticks of visible rainfall remaining (presentation window; mechanics apply separately). */
  rainTicks: number;
  /** Consecutive quiet ticks (no fire, schedule done) — the season winds down when it accumulates. */
  quietTicks: number;
  station: Point;
  trucks: Truck[];
  villages: Village[];
  bombers: Bomber[];
  crews: Crew[];
  /** Placed watch towers — structures that persist across seasons. */
  towers: Point[];
  /** Towers granted but not yet placed. */
  towersAvailable: number;
  stats: Stats;
  script: SeasonScript;
  rng: Rng;
  ended: boolean;
  /** Bumped when ground types change mid-season (crew cuts) — the renderer rebakes terrain. */
  terrainVersion: number;
}

/**
 * Player orders are measures aimed at the map, not unit micro: `dispatch`
 * without a truckId sends the closest available engine; with one, that engine.
 */
export type Command =
  | { type: 'dispatch'; x: number; y: number; truckId?: number }
  | { type: 'evacuate'; villageId: number }
  /** Lay a retardant line: anchored at (x,y), running toward (x2,y2). */
  | { type: 'bomberDrop'; x: number; y: number; x2: number; y2: number }
  | { type: 'crewCut'; x: number; y: number; crewId?: number }
  | { type: 'placeTower'; x: number; y: number };

export type GameEvent =
  | { type: 'fireDetected'; x: number; y: number }
  | { type: 'engineDispatched'; truckId: number; x: number; y: number }
  | { type: 'evacuationStarted'; villageId: number }
  | { type: 'evacuationComplete'; villageId: number }
  | { type: 'bomberDispatched'; bomberId: number }
  | { type: 'bomberDrop'; x: number; y: number }
  | { type: 'crewDispatched'; crewId: number }
  | { type: 'towerPlaced'; x: number; y: number }
  | { type: 'civilianDeaths'; count: number }
  /** The radio warning: a unit has been in danger past the grace ticks. */
  | { type: 'crewDanger'; unit: 'engine' | 'crew'; unitId: number }
  /** A trapped unit was overrun — firefighters died and the unit is gone this season. */
  | { type: 'unitLost'; unit: 'engine' | 'crew'; unitId: number; firefighters: number }
  | { type: 'reliefRain' }
  | { type: 'windShift' }
  | { type: 'seasonWindingDown' }
  | { type: 'seasonEnded'; report: Stats };

export function idx(s: { w: number }, x: number, y: number): number {
  return y * s.w + x;
}

export function inBounds(s: { w: number; h: number }, x: number, y: number): boolean {
  return x >= 0 && x < s.w && y >= 0 && y < s.h;
}

/** Inside this season's active sector — fire, orders, and detection stop at its edge. */
export function inActive(s: { bounds: Bounds }, x: number, y: number): boolean {
  return x >= s.bounds.x0 && x < s.bounds.x1 && y >= s.bounds.y0 && y < s.bounds.y1;
}

export function cellAt(s: GameState, x: number, y: number): Cell {
  const c = s.grid[idx(s, x, y)];
  if (!c) throw new Error(`cell out of bounds: ${x},${y}`);
  return c;
}
