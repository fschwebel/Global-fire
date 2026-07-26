/**
 * One sourced climate fact per season briefing (docs/design/progression.md §1.3).
 * Sources are tracked in data/facts.json; re-verification is an M4 release gate.
 */
export const briefingFacts: Record<number, string> = {
  2026: 'The global fire-weather season lengthened ~19% between 1979 and 2013. — Jolly et al., Nature Communications, 2015',
  2030: 'The UN projects extreme fire events to increase by up to 14% by 2030. — UNEP, Spreading like Wildfire, 2022',
  2035: 'In 2022, drought-stricken Europe suffered its second-worst fire season on record: ~837,000 hectares burnt in the EU. — EFFIS/JRC',
  2040: 'Average annual area burned in the US roughly doubled between the 1990s and the 2010s. — NIFC',
  2045: 'During the 2021 Pacific Northwest heat dome, Lytton, BC reached 49.6 °C — and burned to the ground the next day.',
  2050: 'The UN projects extreme fire events to increase by up to 30% by 2050, even under strong emissions cuts. — UNEP, 2022',
  2055: "Canada's record 2023 season burned more than 15 million hectares — over double the previous record — and began unusually early, in May.",
  2060: 'After high-severity fire in a hotter climate, some forests fail to regenerate at all, converting permanently to shrubland.',
  2065: 'The 2018 Camp Fire destroyed ~18,800 structures and killed 85 people in Paradise, California.',
  2070: 'Australia’s Black Summer generated dozens of fire-triggered thunderstorms — fires so large they made their own weather.',
};

/** "New this season" briefing line — each means arrives free, reassigned to the sector. */
export const unlockNotes: Record<number, string> = {
  2030: 'New this season: a water bomber, flying in from beyond the valley. Arm 🛩, click where the retardant line starts, then a second cell to aim it.',
  2035: 'New this season: evacuation orders. Arm 📢 and click a village — clearing it takes time, so order early.',
  2040: 'New this season: two watch towers. Arm 🗼 and place them where nobody would call a fire in — a tower reports smoke almost instantly.',
  2045: 'From this season the fire can overrun a crew: if a rig is surrounded with no way out, you lose them. When the radio calls for pull-out, act.',
  2050: 'New this season: a fire crew. Arm ⛏ and click vegetation tiles — the crew walks out and cuts them into a firebreak line. Click any clear tile to move them out of danger.',
  2055: 'New this season: a second water bomber joins the sector.',
};

/**
 * Global-mean warming vs pre-industrial per season (°C): central estimates for
 * a middle-of-the-road pathway (IPCC AR6, ≈SSP2-4.5) — progression doc §2.1.
 */
export const warming: Record<number, number> = {
  2026: 1.3,
  2030: 1.4,
  2035: 1.5,
  2040: 1.6,
  2045: 1.75,
  2050: 1.9,
  2055: 2.0,
  2060: 2.1,
  2065: 2.25,
  2070: 2.35,
};

/**
 * Hot extremes over many land regions warm at roughly 1.5–2× the global-mean
 * rate (IPCC AR6 WG1: at +2 °C global, a 1-in-10-year heat event runs ≈ +2.6 °C).
 * The in-game peak-day estimate uses the low end of that range.
 */
export const hotDayFactor = 1.5;

/** Peak-day warming estimate for a season year, °C to one decimal. */
export function hotDayAt(year: number): number {
  return Math.round((warming[year] ?? 0) * hotDayFactor * 10) / 10;
}

/**
 * Frequency multipliers vs 1850–1900 for once-per-decade events, by global
 * warming level (IPCC AR6 SPM, Fig. SPM.6): agricultural/ecological drought
 * in drying regions, and heat events over land.
 */
const freqAnchors: Record<'drought' | 'heat', [number, number][]> = {
  drought: [
    [1.0, 1.7],
    [1.5, 2.0],
    [2.0, 2.4],
    [4.0, 4.1],
  ],
  heat: [
    [1.0, 2.8],
    [1.5, 4.1],
    [2.0, 5.6],
    [4.0, 9.4],
  ],
};

function interpolate(points: [number, number][], x: number): number {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]!;
    const [x2, y2] = points[i]!;
    if (x <= x2) return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
  }
  return last[1];
}

/**
 * How often a once-a-decade event returns at this season's warming level,
 * in years rounded to the nearest half — the plain-language form of the
 * AR6 frequency multipliers.
 */
export function returnPeriodYears(kind: 'drought' | 'heat', year: number): number {
  const mult = interpolate(freqAnchors[kind], warming[year] ?? 1);
  return Math.round((10 / mult) * 2) / 2;
}

/** Season year each loss counter joins the stat bar (canon: progression doc §1.3). */
export const reveals = {
  animals: 2030,
  houses: 2035,
  /** Revealed at zero — the counter itself is the warning. */
  firefighters: 2045,
  civilians: 2050,
};
