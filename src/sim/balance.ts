import type { TileType } from './state';

/**
 * Every tunable lives here (docs/design/gameplay.md). Values are v0 — to playtest.
 * Tuning edits this file only, never sim code.
 */
export const balanceVersion = 1;

export const TICK_MS = 800; // 1.25 Hz — an unhurried pace; balance is tick-based and unaffected

export const spread = {
  P_BASE: 0.22,
  fuelFactor: {
    dense: 1.3,
    sparse: 1.0,
    grass: 1.5,
    house: 1.1,
    road: 0.05,
    firebreak: 0.05,
    water: 0,
    rock: 0,
  } satisfies Record<TileType, number>,
  /** moistureFactor(dryness) = 0.35 + 1.05 × dryness */
  moistureBase: 0.35,
  moistureSlope: 1.05,
  windClampMin: 0.15,
  intensityDiv: 6,
  // Floor high enough that young fires creep rather than gutter out —
  // unfought fires should rarely die on their own.
  intensityMin: 0.55,
  intensityMax: 1.4,
  diagFactor: 0.7,
  wetFactor: 0.1,
};

export const burn = {
  // Grass/sparse burn a little long for realism so young fires linger and
  // creep instead of guttering out — the player must act, fires rarely die alone.
  fuel: { dense: 8, sparse: 6, grass: 3, house: 6 } as Partial<Record<TileType, number>>,
  intensityCap: { dense: 9, sparse: 6, grass: 4, house: 7 } as Partial<Record<TileType, number>>,
  // Moist fuels could burn slower via clamp(base − slope × dryness, 1, base);
  // disabled after playtesting (base 1) — longer-lived cells distract engines
  // to the fire's rear and weaken containment. Wall-clock burn length is
  // governed by TICK_MS instead.
  fuelMoisture: { base: 1.0, slope: 0.7 },
};

export const ignitionSchedule = {
  firstTick: 10,
  /** Ticks between scripted ignitions: wide in the tutorial (sequential crises), compressing as seasons harden. */
  staggerBase: 90,
  staggerPerSeason: 6,
  staggerMin: 40,
  /** When the valley is quiet and more fires are scheduled, pull the next one to at most this many ticks away. */
  quietGap: 6,
  /** Quiet ticks (schedule done, nothing burning) before the season winds down and ends. */
  windDownTicks: 15,
};

export const detection = {
  DETECT_DELAY: 10, // ticks until a fire is reported on its own
  CALL_IN_RADIUS: 6, // tiles from truck/house/road → people call it in
};

export const truck = {
  cost: 40,
  moveSpeed: {
    road: 5.5,
    grass: 2.2,
    sparse: 2.2,
    dense: 1.1,
    house: 2.2,
    firebreak: 2.2,
    rock: 1.1,
    water: 0,
  } satisfies Record<TileType, number>,
  extinguishPerTick: 4, // intensity removed per tick (cell regrows +1 → net −3)
  waterCapacity: 30,
  refillPerTick: 6,
  wetTimerOnExtinguish: 40, // fought ground holds — player work must visibly stick
  crew: 4,
};

export const rain = {
  intensityDrop: 3,
  globalWetTicks: 20,
};

/** Season year each means arrives — free, "reassigned to your sector" (progression doc §3). */
export const unlocks = {
  evacuate: 2030,
  bomber: 2035,
  towers: 2040,
  crew: 2050,
  bomber2: 2055,
};

export const evac = {
  /** Ticks for an ordered village to clear. */
  durationTicks: 40,
  /** Share of a burning home's occupants lost, by the village's evacuation state. */
  mortalityNone: 0.3,
  mortalityEvacuating: 0.1,
};

export const bomber = {
  /** Tiles per tick, straight-line flight over any terrain. */
  flySpeed: 1.8,
  /** Cells in the retardant line, laid from the anchor cell toward the aim cell. */
  lineLength: 6,
  intensityDrop: 12,
  /** Retardant holds noticeably longer than truck water — the line is a laid barrier. */
  dropWetTicks: 90,
  /** Orthogonal splash beside the line: wet, but half the hold. */
  splashWetTicks: 45,
  reloadTicks: 25,
};

export const tower = {
  /** Towers granted at the unlock season; placement is the player's call. */
  count: 2,
  /** Chebyshev detection radius: fires inside are reported almost instantly. */
  radius: 8,
};

export const crewUnit = {
  /** Crews travel on foot: fraction of engine speed. */
  speedFactor: 0.7,
  /** Ticks to cut one vegetation tile into a firebreak. */
  cutTicks: 3,
};

export const habitatPerTile = { dense: 3, sparse: 2, grass: 1 } as Partial<
  Record<TileType, number>
>;

export const map = {
  /** World size — the largest sector (2065/2070). Earlier seasons play a centered crop. */
  W: 60,
  H: 40,
  villageCount: 4,
  /** First village stays close to the station so the smallest sector has stakes. */
  firstVillageMaxDist: 11,
  villageMinHouses: 6,
  villageMaxHouses: 12,
  occupantsMin: 4,
  occupantsMax: 10,
};

/** Active sector size per season pair (grows every 2 seasons, centered on the station). */
export const sectorSizes: [number, number][] = [
  [44, 30], // 2026, 2030
  [48, 32], // 2035, 2040
  [52, 35], // 2045, 2050
  [56, 37], // 2055, 2060
  [60, 40], // 2065, 2070
];

export const regrowth = {
  /** Years after a burn: scar → grass → sparse → original type. */
  grassAfter: 2,
  sparseAfter: 6,
  fullAfter: 12,
  /** High-severity dense burns convert permanently to grassland. */
  denseConversionChance: 0.25,
  /** A burnt home has this chance of being rebuilt; the rest are gone for good. */
  houseRebuildChance: 0.5,
  /** Years before a rebuilt home stands again (the lot lies as scarred grass until then). */
  houseRebuildAfter: 5,
  /** Ash tint stays visible on regrown ground for this many years. */
  scarVisibleYears: 9,
};

/** Wind direction drifts up to ±1°/tick (±30°/30 ticks). */
export const windDriftPerTick = Math.PI / 180;

export interface SeasonParams {
  year: number;
  t: number; // season index 0–9
  dryness: number;
  windStr: number;
  /** Extra brake on spread probability for the calm early seasons (default 1). */
  spreadMult?: number;
  scriptedIgnitions: number;
  randomIgnitionRate: number;
  seasonLen: number;
  reliefRain: 'guaranteed' | 'half' | 'none';
}

/** Reference difficulty curve (gameplay doc §7.1). One row per played season. */
export const seasons: SeasonParams[] = [
  {
    year: 2026,
    t: 0,
    dryness: 0.32,
    windStr: 0.2,
    spreadMult: 0.72,
    scriptedIgnitions: 3,
    randomIgnitionRate: 0,
    seasonLen: 300,
    reliefRain: 'guaranteed',
  },
  {
    year: 2030,
    t: 1,
    dryness: 0.38,
    windStr: 0.3,
    spreadMult: 0.85,
    scriptedIgnitions: 3,
    randomIgnitionRate: 0,
    seasonLen: 300,
    reliefRain: 'guaranteed',
  },
  {
    year: 2035,
    t: 2,
    dryness: 0.44,
    windStr: 0.4,
    spreadMult: 0.95,
    scriptedIgnitions: 4,
    randomIgnitionRate: 0,
    seasonLen: 320,
    reliefRain: 'guaranteed',
  },
  {
    year: 2040,
    t: 3,
    dryness: 0.5,
    windStr: 0.5,
    scriptedIgnitions: 4,
    randomIgnitionRate: 0.001,
    seasonLen: 320,
    reliefRain: 'half',
  },
  {
    year: 2045,
    t: 4,
    dryness: 0.56,
    windStr: 0.7,
    scriptedIgnitions: 4,
    randomIgnitionRate: 0.002,
    seasonLen: 340,
    reliefRain: 'half',
  },
  {
    year: 2050,
    t: 5,
    dryness: 0.62,
    windStr: 0.8,
    scriptedIgnitions: 5,
    randomIgnitionRate: 0.002,
    seasonLen: 360,
    reliefRain: 'half',
  },
  {
    year: 2055,
    t: 6,
    dryness: 0.68,
    windStr: 0.9,
    scriptedIgnitions: 5,
    randomIgnitionRate: 0.003,
    seasonLen: 380,
    reliefRain: 'half',
  },
  {
    year: 2060,
    t: 7,
    dryness: 0.74,
    windStr: 1.1,
    scriptedIgnitions: 5,
    randomIgnitionRate: 0.003,
    seasonLen: 400,
    reliefRain: 'none',
  },
  {
    year: 2065,
    t: 8,
    dryness: 0.79,
    windStr: 1.2,
    scriptedIgnitions: 5,
    randomIgnitionRate: 0.004,
    seasonLen: 400,
    reliefRain: 'none',
  },
  {
    year: 2070,
    t: 9,
    dryness: 0.85,
    windStr: 1.4,
    scriptedIgnitions: 6,
    randomIgnitionRate: 0.004,
    seasonLen: 420,
    reliefRain: 'none',
  },
];
