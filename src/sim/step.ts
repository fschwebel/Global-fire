import {
  detection,
  development,
  droughtEvent,
  evac,
  habitatPerTile,
  ignitionSchedule,
  rain,
  regrowth,
  tower,
  unlocks,
  windDriftPerTick,
} from './balance';
import { flammable, ignite, intensityCap, spreadProb } from './fire';
import type { Command, GameEvent, GameState, Village } from './state';
import { cellAt, idx, inActive } from './state';
import {
  applyDangerRule,
  dispatchBomber,
  dispatchCrew,
  dispatchEngine,
  updateBombers,
  updateCrews,
  updateTrucks,
} from './units';

function applyCommands(s: GameState, commands: Command[], events: GameEvent[]): void {
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'dispatch': {
        const id = dispatchEngine(s, cmd.x, cmd.y, cmd.truckId);
        if (id !== null) events.push({ type: 'engineDispatched', truckId: id, x: cmd.x, y: cmd.y });
        break;
      }
      case 'evacuate': {
        if (s.seasonYear < unlocks.evacuate) break;
        const v = s.villages.find((vv) => vv.id === cmd.villageId);
        if (v && v.evac === 'none') {
          v.evac = 'inProgress';
          v.evacStartTick = s.tick;
          s.terrainVersion += 1; // the village's houses repaint as leaving
          events.push({ type: 'evacuationStarted', villageId: v.id });
        }
        break;
      }
      case 'bomberDrop': {
        const id = dispatchBomber(s, cmd.x, cmd.y, cmd.x2, cmd.y2);
        if (id !== null) events.push({ type: 'bomberDispatched', bomberId: id });
        break;
      }
      case 'crewCut': {
        const id = dispatchCrew(s, cmd.x, cmd.y, cmd.crewId);
        if (id !== null) events.push({ type: 'crewDispatched', crewId: id });
        break;
      }
      case 'placeTower': {
        if (
          s.towersAvailable > 0 &&
          inActive(s, cmd.x, cmd.y) &&
          cellAt(s, cmd.x, cmd.y).type !== 'water' &&
          cellAt(s, cmd.x, cmd.y).state !== 'burning'
        ) {
          s.towers.push({ x: cmd.x, y: cmd.y });
          s.towersAvailable -= 1;
          events.push({ type: 'towerPlaced', x: cmd.x, y: cmd.y });
        }
        break;
      }
    }
  }
}

/** The village a house tile belongs to (development builds up to maxRing out). */
function villageAt(s: GameState, x: number, y: number): Village | null {
  for (const v of s.villages)
    if (Math.max(Math.abs(v.x - x), Math.abs(v.y - y)) <= development.maxRing) return v;
  return null;
}

function nearTower(s: GameState, x: number, y: number): boolean {
  for (const t of s.towers)
    if (Math.abs(t.x - x) <= tower.radius && Math.abs(t.y - y) <= tower.radius) return true;
  return false;
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
      if (!inActive(s, nx, ny)) continue;
      const type = s.grid[idx(s, nx, ny)]!.type;
      if (type === 'road' || type === 'house') return true;
    }
  return false;
}

/**
 * Advance the simulation by one tick (1.25 Hz). Deterministic: same seed + same
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

  // Extreme drought: the river runs dry ahead of the season's late fires
  // (also triggers if its target ignition was pulled forward to this tick).
  const drought = s.script.drought;
  if (drought && !drought.done) {
    const target = s.script.ignitions[drought.targetIndex];
    if (s.tick >= drought.tick || (target && !target.done && s.tick >= target.tick)) {
      drought.done = true;
      for (const c of s.grid) if (c.type === 'water') c.type = 'dryriver';
      s.dryness = Math.min(0.95, s.dryness + droughtEvent.drynessBonus);
      for (const r of s.script.reliefRains) r.done = true; // no rain is coming
      s.terrainVersion += 1;
      events.push({ type: 'riverDry' });
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
      const x = s.bounds.x0 + Math.floor(s.rng() * (s.bounds.x1 - s.bounds.x0));
      const y = s.bounds.y0 + Math.floor(s.rng() * (s.bounds.y1 - s.bounds.y0));
      const c = cellAt(s, x, y);
      if (flammable(c)) ignite(s, c, false);
    }
  }

  // Spread: roll from current burning state (order-independent), apply after.
  // Fire exists only inside the active sector; its edge is a hard boundary.
  const ignitions: { x: number; y: number; detected: boolean }[] = [];
  for (let y = s.bounds.y0; y < s.bounds.y1; y++)
    for (let x = s.bounds.x0; x < s.bounds.x1; x++) {
      const c = s.grid[idx(s, x, y)]!;
      if (!flammable(c)) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const bx = x - dx;
          const by = y - dy;
          if (!inActive(s, bx, by)) continue;
          const b = s.grid[idx(s, bx, by)]!;
          if (b.state !== 'burning') continue;
          if (s.rng() < spreadProb(s, b, c, dx, dy)) {
            ignitions.push({ x, y, detected: b.detected });
            dx = 2;
            break; // first success ignites; stop rolling this cell
          }
        }
    }

  // Burning cells: intensity builds, fuel depletes → burnt (+ stats, history).
  for (let i = 0; i < s.grid.length; i++) {
    const c = s.grid[i]!;
    if (c.state !== 'burning') continue;
    c.intensity = Math.min(intensityCap(c), c.intensity + 1);
    c.fuel -= 1;
    c.igniteAge += 1;
    if (c.fuel <= 0) {
      c.state = 'burnt';
      c.intensity = 0;
      c.burntYear = s.seasonYear;
      s.stats.hectaresBurnt += 1;
      s.stats.animalsKilled += habitatPerTile[c.type] ?? 0;
      if (c.type === 'house') {
        s.stats.housesLost += 1;
        // Residents' fate depends on how far the evacuation got.
        const v = villageAt(s, i % s.w, Math.floor(i / s.w));
        const mortality =
          v?.evac === 'done'
            ? 0
            : v?.evac === 'inProgress'
              ? evac.mortalityEvacuating
              : evac.mortalityNone;
        const deaths = Math.round(c.occupants * mortality);
        if (deaths > 0) {
          s.stats.civiliansLost += deaths;
          events.push({ type: 'civilianDeaths', count: deaths });
        }
        c.occupants = 0;
        // The lot reverts to grass; whether anything returns is the
        // development curve's call between seasons (scenario.ts).
        c.baseType = 'grass';
      } else if (c.type === 'dense' && s.rng() < regrowth.denseConversionChance) {
        c.baseType = 'grass'; // high-severity burn: permanent conversion
      }
    }
  }

  for (const ig of ignitions) {
    const c = cellAt(s, ig.x, ig.y);
    if (flammable(c)) ignite(s, c, ig.detected);
  }

  // Timers.
  for (const c of s.grid) if (c.wetTimer > 0) c.wetTimer -= 1;
  if (s.rainTicks > 0) s.rainTicks -= 1;

  // Evacuations run their course.
  for (const v of s.villages) {
    if (v.evac === 'inProgress' && s.tick - v.evacStartTick >= evac.durationTicks) {
      v.evac = 'done';
      s.terrainVersion += 1; // the houses repaint as cleared and shuttered
      events.push({ type: 'evacuationComplete', villageId: v.id });
    }
  }

  updateTrucks(s);
  updateBombers(s, events);
  updateCrews(s);
  applyDangerRule(s, events);

  // Detection: a fire is reported by age, by proximity call-in, by a watch
  // tower, or by spreading from an already-detected cell (handled at ignition).
  for (let y = s.bounds.y0; y < s.bounds.y1; y++)
    for (let x = s.bounds.x0; x < s.bounds.x1; x++) {
      const c = s.grid[idx(s, x, y)]!;
      if (c.state !== 'burning' || c.detected) continue;
      if (
        c.igniteAge >= detection.DETECT_DELAY ||
        nearRoadHouseOrTruck(s, x, y) ||
        nearTower(s, x, y)
      ) {
        c.detected = true;
        let neighbourAlreadyDetected = false;
        for (let dy = -1; dy <= 1 && !neighbourAlreadyDetected; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (
              (dx !== 0 || dy !== 0) &&
              inActive(s, nx, ny) &&
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

  const anyBurning = s.grid.some((c) => c.state === 'burning');
  const scheduleDone = s.script.ignitions.every((i) => i.done);

  // A quiet valley shouldn't mean a long wait: once the first fire has come
  // and gone, pull the next scheduled ignition to at most a few seconds away.
  if (!anyBurning && !scheduleDone && !rainsArrived && s.script.ignitions.some((i) => i.done)) {
    const next = s.script.ignitions.reduce<(typeof s.script.ignitions)[number] | null>(
      (best, ig) => (ig.done ? best : best === null || ig.tick < best.tick ? ig : best),
      null,
    );
    if (next && next.tick > s.tick + ignitionSchedule.quietGap)
      next.tick = s.tick + ignitionSchedule.quietGap;
  }

  // A quiet valley with a finished schedule winds the season down — announced,
  // then ended after a short grace, so the player is never left waiting for a
  // random ignition that may never come.
  if (!anyBurning && scheduleDone && !rainsArrived && s.tick > 40) {
    if (s.quietTicks === 0) events.push({ type: 'seasonWindingDown' });
    s.quietTicks += 1;
  } else if (anyBurning) {
    s.quietTicks = 0;
  }

  // Season end: after the rains have killed the last fire, or early once the
  // wind-down grace has passed with the valley still quiet.
  if (
    (rainsArrived && !anyBurning) ||
    (!anyBurning && scheduleDone && s.tick > 40 && s.quietTicks >= ignitionSchedule.windDownTicks)
  ) {
    s.ended = true;
    events.push({ type: 'seasonEnded', report: { ...s.stats } });
  }

  return events;
}
