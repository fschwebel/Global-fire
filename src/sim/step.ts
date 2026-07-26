import { detection, habitatPerTile, rain, windDriftPerTick } from './balance';
import { flammable, ignite, intensityCap, spreadProb } from './fire';
import type { Command, GameEvent, GameState } from './state';
import { cellAt, idx, inBounds } from './state';
import { dispatchEngine, updateTrucks } from './units';

function applyCommands(s: GameState, commands: Command[], events: GameEvent[]): void {
  for (const cmd of commands) {
    if (cmd.type === 'dispatch') {
      const id = dispatchEngine(s, cmd.x, cmd.y, cmd.truckId);
      if (id !== null) events.push({ type: 'engineDispatched', truckId: id, x: cmd.x, y: cmd.y });
    }
  }
}

function applyRainTick(s: GameState): void {
  for (const c of s.grid) {
    if (c.state === 'burning') {
      c.intensity -= rain.intensityDrop;
      if (c.intensity <= 0) {
        c.state = 'unburnt';
        c.intensity = 0;
        c.igniteAge = 0;
        c.detected = false;
      }
    }
    c.wetTimer = Math.max(c.wetTimer, rain.globalWetTicks);
  }
}

function nearRoadHouseOrTruck(s: GameState, x: number, y: number): boolean {
  const r = detection.CALL_IN_RADIUS;
  for (const t of s.trucks) if (Math.abs(t.x - x) <= r && Math.abs(t.y - y) <= r) return true;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(s, nx, ny)) continue;
      const type = s.grid[idx(s, nx, ny)]!.type;
      if (type === 'road' || type === 'house') return true;
    }
  return false;
}

/**
 * Advance the simulation by one tick (2 Hz). Deterministic: same seed + same
 * command history ⇒ identical state. Mutates `s` and returns the tick's events.
 */
export function step(s: GameState, commands: Command[] = []): GameEvent[] {
  if (s.ended) return [];
  const events: GameEvent[] = [];
  applyCommands(s, commands, events);

  // Wind: slow drift, plus any scripted shift.
  s.wind.dir += (s.rng() * 2 - 1) * windDriftPerTick;
  for (const shift of s.script.windShifts) {
    if (!shift.done && s.tick >= shift.tick) {
      s.wind.dir += shift.delta;
      shift.done = true;
      events.push({ type: 'windShift' });
    }
  }

  // Scripted relief rain, and the season-ending rains once the timer runs out.
  for (const r of s.script.reliefRains) {
    if (!r.done && s.tick >= r.tick) {
      applyRainTick(s);
      r.done = true;
      s.rainTicks = Math.max(s.rainTicks, rain.globalWetTicks);
      events.push({ type: 'reliefRain' });
    }
  }
  const rainsArrived = s.tick >= s.seasonLen;
  if (rainsArrived) {
    applyRainTick(s);
    s.rainTicks = Math.max(s.rainTicks, 2);
  }

  // Ignitions: scripted schedule + random background rate.
  if (!rainsArrived) {
    for (const ig of s.script.ignitions) {
      if (!ig.done && s.tick >= ig.tick) {
        const c = cellAt(s, ig.x, ig.y);
        if (flammable(c)) ignite(s, c, false);
        ig.done = true;
      }
    }
    if (s.randomIgnitionRate > 0 && s.rng() < s.randomIgnitionRate) {
      const x = Math.floor(s.rng() * s.w);
      const y = Math.floor(s.rng() * s.h);
      const c = cellAt(s, x, y);
      if (flammable(c)) ignite(s, c, false);
    }
  }

  // Spread: roll from current burning state (order-independent), apply after.
  const ignitions: { x: number; y: number; detected: boolean }[] = [];
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const c = s.grid[idx(s, x, y)]!;
      if (!flammable(c)) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const bx = x - dx;
          const by = y - dy;
          if (!inBounds(s, bx, by)) continue;
          const b = s.grid[idx(s, bx, by)]!;
          if (b.state !== 'burning') continue;
          if (s.rng() < spreadProb(s, b, c, dx, dy)) {
            ignitions.push({ x, y, detected: b.detected });
            dx = 2;
            break; // first success ignites; stop rolling this cell
          }
        }
    }

  // Burning cells: intensity builds, fuel depletes → burnt (+ stats).
  for (const c of s.grid) {
    if (c.state !== 'burning') continue;
    c.intensity = Math.min(intensityCap(c), c.intensity + 1);
    c.fuel -= 1;
    c.igniteAge += 1;
    if (c.fuel <= 0) {
      c.state = 'burnt';
      c.intensity = 0;
      s.stats.hectaresBurnt += 1;
      s.stats.animalsKilled += habitatPerTile[c.type] ?? 0;
      if (c.type === 'house') s.stats.housesLost += 1;
    }
  }

  for (const ig of ignitions) {
    const c = cellAt(s, ig.x, ig.y);
    if (flammable(c)) ignite(s, c, ig.detected);
  }

  // Timers.
  for (const c of s.grid) if (c.wetTimer > 0) c.wetTimer -= 1;
  if (s.rainTicks > 0) s.rainTicks -= 1;

  updateTrucks(s);

  // Detection: a fire is reported by age, by proximity call-in, or by spreading
  // from an already-detected cell (handled at ignition).
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const c = s.grid[idx(s, x, y)]!;
      if (c.state !== 'burning' || c.detected) continue;
      if (c.igniteAge >= detection.DETECT_DELAY || nearRoadHouseOrTruck(s, x, y)) {
        c.detected = true;
        let neighbourAlreadyDetected = false;
        for (let dy = -1; dy <= 1 && !neighbourAlreadyDetected; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (
              (dx !== 0 || dy !== 0) &&
              inBounds(s, nx, ny) &&
              s.grid[idx(s, nx, ny)]!.state === 'burning' &&
              s.grid[idx(s, nx, ny)]!.detected &&
              !(nx === x && ny === y)
            ) {
              neighbourAlreadyDetected = true;
              break;
            }
          }
        if (!neighbourAlreadyDetected) events.push({ type: 'fireDetected', x, y });
      }
    }

  s.tick += 1;

  // Season end: after the rains have killed the last fire, or early when the
  // schedule is exhausted and the valley is quiet.
  const anyBurning = s.grid.some((c) => c.state === 'burning');
  const scheduleDone = s.script.ignitions.every((i) => i.done);
  if (
    (rainsArrived && !anyBurning) ||
    (!anyBurning && scheduleDone && s.tick > 40 && s.randomIgnitionRate === 0)
  ) {
    s.ended = true;
    events.push({ type: 'seasonEnded', report: { ...s.stats } });
  }

  return events;
}
