import type { Cell, Point, Stats, TileType } from '../sim/state';

const KEY = 'global-fire-save';

export interface CampaignSave {
  version: 2;
  seed: number;
  /** The season about to be played (0–9). */
  seasonIndex: number;
  campaign: Stats;
  /** Burn history: cell index, burn year, and what the ground regrows toward. */
  scars: { i: number; y: number; b: TileType }[];
  /** Watch towers standing at season end. */
  towers: Point[];
}

export function saveCampaign(
  seed: number,
  seasonIndex: number,
  campaign: Stats,
  grid: Cell[],
  towers: Point[],
): void {
  const scars: CampaignSave['scars'] = [];
  grid.forEach((c, i) => {
    if (c.burntYear > 0) scars.push({ i, y: c.burntYear, b: c.baseType });
  });
  const data: CampaignSave = {
    version: 2,
    seed,
    seasonIndex,
    campaign,
    scars,
    towers: towers.map((t) => ({ x: t.x, y: t.y })),
  };
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
    const data = JSON.parse(raw) as Partial<Omit<CampaignSave, 'version'>> & { version?: number };
    if (typeof data.seasonIndex !== 'number' || !Array.isArray(data.scars)) return null;
    if (data.version !== 1 && data.version !== 2) return null;
    // v1 saves predate watch towers; they simply resume without any placed.
    return {
      ...data,
      version: 2,
      towers: Array.isArray(data.towers) ? data.towers : [],
    } as CampaignSave;
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
