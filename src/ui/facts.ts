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

/** Season year each loss counter joins the stat bar (canon: PLAN.md §2.2). */
export const reveals = {
  animals: 2030,
  houses: 2035,
};
