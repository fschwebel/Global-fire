import type { Cell, Stats, TileType } from '../sim/state';

const KEY = 'global-fire-save';

export interface CampaignSave {
  version: 1;
  seed: number;
  /** The season about to be played (0–9). */
  seasonIndex: number;
  campaign: Stats;
  /** Burn history: cell index, burn year, and what the ground regrows toward. */
  scars: { i: number; y: number; b: TileType }[];
}

export function saveCampaign(
  seed: number,
  seasonIndex: number,
  campaign: Stats,
  grid: Cell[],
): void {
  const scars: CampaignSave['scars'] = [];
  grid.forEach((c, i) => {
    if (c.burntYear > 0) scars.push({ i, y: c.burntYear, b: c.baseType });
  });
  const data: CampaignSave = { version: 1, seed, seasonIndex, campaign, scars };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode, quota) — the campaign just won't persist.
  }
}

export function loadCampaign(): CampaignSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CampaignSave;
    if (data.version !== 1 || typeof data.seasonIndex !== 'number' || !Array.isArray(data.scars))
      return null;
    return data;
  } catch {
    return null;
  }
}

export function clearCampaign(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
