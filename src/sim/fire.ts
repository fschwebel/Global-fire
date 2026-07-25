import { burn, spread } from './balance';
import type { Cell, GameState } from './state';

export function flammable(cell: Cell): boolean {
  return cell.state === 'unburnt' && (spread.fuelFactor[cell.type] ?? 0) > 0;
}

export function intensityCap(cell: Cell): number {
  return burn.intensityCap[cell.type] ?? 4;
}

export function initialFuel(cell: Cell): number {
  return burn.fuel[cell.type] ?? 2;
}

/**
 * P(ignite C from burning neighbour B) — the core formula (gameplay doc §2.4).
 * dx,dy is the offset B→C.
 */
export function spreadProb(s: GameState, b: Cell, c: Cell, dx: number, dy: number): number {
  const fuel = spread.fuelFactor[c.type] ?? 0;
  if (fuel === 0) return 0;

  const moisture = spread.moistureBase + spread.moistureSlope * s.dryness;

  const toward = Math.atan2(dy, dx);
  const cos = Math.cos(toward - s.wind.dir);
  const wind = Math.min(Math.max(1 + s.wind.str * cos, spread.windClampMin), 1 + s.wind.str);

  const intensity = Math.min(
    Math.max(b.intensity / spread.intensityDiv, spread.intensityMin),
    spread.intensityMax,
  );

  const diag = dx !== 0 && dy !== 0 ? spread.diagFactor : 1;
  const wet = c.wetTimer > 0 ? spread.wetFactor : 1;

  return spread.P_BASE * fuel * moisture * wind * intensity * diag * wet;
}

export function ignite(cell: Cell, detected: boolean): void {
  cell.state = 'burning';
  cell.intensity = 1;
  cell.fuel = initialFuel(cell);
  cell.igniteAge = 0;
  cell.detected = detected;
}
