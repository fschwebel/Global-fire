# Global Fire

**A browser strategy mini-game about fighting forest fires on a warming planet — and about why that fight cannot be won.**

**Play it: <https://fschwebel.github.io/Global-fire/>** — free, no account, ~30 minutes for a full campaign. The interface is in English or French, following your browser's language.

You run the fire service of one forested valley. In 2026 the job is manageable: a couple of fires, two engines, a quiet summer. You return for one season every five years — 2030, 2035, … 2070 — and each time the climate has turned the dial by another half-decade of projected warming: drier fuel, harder wind, longer seasons, more ignitions. You unlock better tools, and they are never quite enough. The interface grows heavier with you: first you count burnt hectares, then animals, then homes — eventually firefighters, and people.

## Losing is the point

**The late game is impossible by design.** This is the game's central statement, not a balance bug: each season follows the IPCC's central warming projections (AR6, middle-of-the-road pathway ≈SSP2-4.5), and each season the fire outgrows the means sent against it. Real firefighting is the same — once a megafire is running, crews mostly choose what burns last. What works happens before the first spark: tended forests, firebreaks, early detection, and above all limiting the warming itself.

The ending makes the other half of the argument. Your 44 years are compared against a simulation of the same valley, same seeds, left entirely unfought: you never beat the climate, but you decided what it could take. *"You never stopped the fire. You decided what survived it."*

## A campaign, season by season

Every season follows the same arc:

1. **Briefing.** The year, a climate card — global warming level, how often the once-a-decade drought and heatwave now return, the peak-day estimate, all from IPCC AR6 central estimates — plus one sourced real-world fire fact, and whatever new means arrived.
2. **The season.** Real-time with tactical pause. Fires are scripted per season (plus random ignitions from 2040, biased upwind so they get the valley as runway) and burn until fought or until the closing rains. Detection is honest: a fire nobody can see does not exist for you yet.
3. **Debrief.** The season's bill, the campaign so far, and — from 2045 — whether the river ran dry, and who did not come back.

The valley persists across the whole campaign. Burn scars stay visible for years and regrow on a slow clock (grass after 2 years, sparse forest after 6, full canopy after 12); a quarter of severely burnt dense forest converts permanently to shrubland. Housing follows a boom-and-retreat curve — villages grow to 150% of their 2026 stock by 2060, then a managed retreat shrinks them to 75% by 2070, abandoning the farthest homes first. Your patch of responsibility grows too: the active sector widens every two seasons, from 44×30 tiles in 2026 to the full 60×40 valley by 2065.

## The means, and when they arrive

Everything arrives free — "reassigned to your sector" — and stops arriving while the climate keeps going.

| Year | New means |
|---|---|
| 2026 | Two fire engines (16-unit tanks, refill at the river) |
| 2030 | A water bomber: lays a 6-cell retardant line, aimed with two clicks |
| 2035 | Evacuation orders — one village at a time, then services regroup |
| 2040 | Two watch towers (detection radius 8), +1 per decade after |
| 2050 | A fire crew on foot: cuts firebreak lines · third tower |
| 2055 | A second water bomber |

The ledger grows on its own schedule — a counter you haven't been introduced to never leaks, but the losses are recorded from day one:

| Year | Revealed |
|---|---|
| 2026 | Hectares burnt |
| 2030 | Animals killed |
| 2035 | Homes lost |
| 2045 | Firefighters lost — revealed at zero; the counter itself is the warning |
| 2050 | People lost |

## The climate is the antagonist

- **The dial:** dryness, wind strength, ignition count, and season length all ratchet season over season; mid-season relief rains are guaranteed early, a coin flip from 2040, and gone from 2060.
- **Extreme drought events:** from 2045, a 50% chance per season — certain from 2060 — that the river itself runs dry before the season's last fire (last two, from 2060). No more refills, the bombers are grounded, and fire can cross the riverbed. Winter refills it; the next summer doesn't care.
- **Firefighter danger (from 2045):** deterministic, never dice. A unit beside heavy fire gets a radio warning after a short grace, then is lost only if genuinely trapped — the escape search respects an honest rule: no squeezing between flame walls. Engines erode faster than crews on foot (1.3× beside heavy fire, 1.7× standing in flames), dry tanks and exhaustion shave the margin, and fatigue lingers across a season. There is no auto-retreat: the warning is the cue, pulling out is your job. Lost units are rebuilt the following season — the game refuses to make grief a resource-management problem.
- **Evacuation stakes:** when a home burns, mortality depends on the order you gave — 30% of occupants if no order came, 10% mid-evacuation, zero once the village is clear.

## How it's built

- **Deterministic simulation core** (`src/sim/`): a pure `step(state, commands) → events` function on a fixed 800 ms tick, seeded PRNG throughout (no `Math.random`, no wall-clock), commands in, typed events out. Same seed + same orders = the same campaign, which is what makes the unfought-valley ending an honest comparison.
- **Probabilistic cellular automaton** for fire spread (Moore neighborhood; fuel type × moisture × wind × intensity × wetness), with per-tile fuel and intensity caps, detection delays, call-in radii, and wet timers for fought ground.
- **Zero runtime dependencies:** plain Canvas 2D rendering, hand-rolled UI, TypeScript strict, Vite, Biome, Vitest. The test suite is mostly *balance invariants* — "unfought fires must matter", "a naive bot must beat doing nothing", "drier seasons burn more" — so retuning is safe.
- **Persistence:** the campaign saves to localStorage (burn history + towers only; everything else regenerates from the seed). Refresh mid-campaign and the season restarts; refresh at the finale and the finale is still there.
- **i18n:** every user-facing string lives in `src/ui/i18n.ts` as a typed en/fr catalog — a missing French translation is a compile error.
- **Analytics:** GA4 pageviews plus a handful of progression events (`season_started`, `season_completed`, `campaign_finished`, `unit_lost`, `drought_event`, `about_opened`) to see how far players get. No accounts, nothing else collected.
- **Deploy:** GitHub Actions builds `main` and publishes to GitHub Pages; the build number in the corner is the commit count.

```bash
npm install
npm run dev    # play at localhost:5173
npm test       # deterministic sim tests + balance invariants
npm run build  # production build in dist/
```

## Facts and honesty

The climate numbers on the briefing cards are central estimates from the IPCC Sixth Assessment Report for a middle-of-the-road pathway; the per-season fire facts carry their sources inline (Jolly et al. 2015, UNEP 2022, EFFIS/JRC, NIFC, the Camp Fire record, and others). The valley, the seasons, and the pacing are compressed for playability — the forest is invented; the trend is not.

## Documentation map

The `docs/` tree holds the founding design documents. They shaped the game and remain the best statement of intent, but the shipped game diverged from them in places (no budget system, no named spike levels, no ember spotting, Canvas 2D instead of PixiJS, and the danger rule replaced auto-retreat — see the reality-check notes at the top of each doc). **Where a doc and the code disagree, the code and this README are the truth.**

| Document | Contents |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Founding plan: vision & pillars, milestones, risk register — with a reality-check section on what shipped differently |
| [`docs/design/gameplay.md`](docs/design/gameplay.md) | Gameplay systems: fire model, map, units, scoring |
| [`docs/design/progression.md`](docs/design/progression.md) | The 2026–2070 season ladder, unlock & reveal schedule, endings |
| [`docs/design/ux.md`](docs/design/ux.md) | UI/UX, progressive disclosure, emotional arc, accessibility |
| [`docs/design/tech-stack.md`](docs/design/tech-stack.md) | Original stack proposal and architecture |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decisions log |
