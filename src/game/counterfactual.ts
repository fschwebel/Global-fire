import { createSeason } from '../sim/scenario';
import type { Cell, Stats } from '../sim/state';
import { step } from '../sim/step';

/**
 * The do-nothing campaign: the same valley, the same seed, every season left
 * entirely unfought. The ending measures the player against this — you win
 * relative to inaction, never against the trend.
 */
export function simulateUnfoughtCampaign(seed: number, lastSeason: number): Stats {
  const total: Stats = {
    hectaresBurnt: 0,
    animalsKilled: 0,
    housesLost: 0,
    firefightersLost: 0,
    civiliansLost: 0,
  };
  let grid: Cell[] | undefined;
  for (let idx = 0; idx <= lastSeason; idx++) {
    const s = createSeason(seed, idx, grid);
    const cap = s.seasonLen + 600;
    for (let i = 0; i < cap && !s.ended; i++) step(s);
    total.hectaresBurnt += s.stats.hectaresBurnt;
    total.animalsKilled += s.stats.animalsKilled;
    total.housesLost += s.stats.housesLost;
    total.firefightersLost += s.stats.firefightersLost;
    total.civiliansLost += s.stats.civiliansLost;
    grid = s.grid;
  }
  return total;
}
