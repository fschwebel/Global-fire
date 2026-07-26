# Gameplay Systems

> **Canon note** (binding, from [`../PLAN.md`](../PLAN.md) §2): campaign of **ten seasons — 2026, 2030, then every five years to 2070** (`t = seasonIndex`, 0–9); 4–5 real years pass between consecutive seasons · one persistent 60×40 world, 1 tile = 1 ha, played as a centered sector the department widens every two seasons (44×30 → 60×40) · 800 ms fixed ticks, square grid, Moore-8, double-buffered, seeded PRNG · no game-over/stars/grades; internal Stewardship Score only · deterministic firefighter deaths · warning-time evacuation mortality · unlock-season tools granted free · every number below is a **v0 value to playtest**, living in `balance.ts` — tuning never touches sim code.

---

## 1. Core gameplay loop

### 1.1 Timing model: fixed-tick sim, real-time presentation, pausable

**A discrete tick-based simulation (800 ms ticks) rendered in real time, with tactical pause.**

| Option | Verdict |
|---|---|
| Pure turn-based | Rejected. Kills the dread that carries the message — fire must visibly *outrun* you. |
| Continuous per-frame physics | Rejected. Non-deterministic across frame rates, hard to balance, overkill. |
| **Fixed ticks + real-time render + pause** | **Chosen.** Deterministic and unit-testable (`step(state) → state` is pure), trivially cheap (≤2,400 cells at 1.25 Hz), decoupled from 60 fps rendering, and pause gives accessibility without removing tension — the fire resumes the moment you do. |

- Tick length **800 ms**. All rates below are per tick unless stated.
- Orders may be issued while paused (tactical pause, à la *RimWorld* crises). Auto-pause on: new fire detected, unit lost, village ignited, metric reveal — each doubles as a camera beat.
- Time controls are pause/play only — no fast-forward (consequence moments must not be skippable); a quiet valley instead pulls the next scheduled ignition forward.

### 1.2 Three nested loops

**Moment-to-moment (seconds):** watch the front → select tool → target → watch it resolve → re-prioritize. The core tension is *triage*: never enough units for every front, so every order is implicitly a decision about what you are willing to lose.

**Per-season loop (one level ≈ 3–5 minutes):**

1. **Briefing (~15 s):** season card, "the years between" interstitial lines (progression doc §1.2), forecast (dryness, wind regime, expected ignitions), one sourced climate fact, unlock panel if any.
2. **Prep phase (untimed; from 2030):** spend budget — buy/repair trucks, place towers, position units. **2026 skips this phase entirely** — the tutorial fire is called in within 5 seconds of the season starting.
3. **Fire season (real-time, 300–420 ticks):** scripted + random ignitions; the player fights with the current toolkit until the autumn rains arrive (§6.1).
4. **Debrief (~20 s):** losses tally one counter at a time; quiet narrative line; budget for the next season computed; next unlock teased. No stars, no grades.

**Campaign loop (10 seasons: 2026, 2030, 2035 … 2070):** between consecutive seasons 4–5 years pass — climate parameters ratchet one step per season (§7.1) at the pace of mid-range projections, scars regrow, development creeps. One new mechanic *or* one new loss counter per season, so the player always learns exactly one thing while conditions worsen underneath them. 2060–2070 deliberately add no new tools — the toolkit is complete and increasingly insufficient. That beat *is* the message.

---

## 2. Fire simulation model

### 2.1 Probabilistic cellular automaton on a square grid

Square grid, Moore 8-neighbourhood, double-buffered update (compute `next` from `current`, then swap — order-independent, deterministic). Square beats hex: simpler math and rendering, maps directly to tilemaps, and its directional bias is fully masked by the probabilistic spread + wind model. This is the standard Drossel–Schwabl / FARSITE-lite family — well understood, fast to tune.

### 2.2 Cell state machine

```
UNBURNT ──ignite──▶ BURNING ──fuel exhausted──▶ BURNT (persists across years; regrows per §3.4)
   │  ▲                 │
   │  └── WET expires   └──intensity driven to 0──▶ WET (suppressed, fuel remains)
   └──────────────────────────────────────────────▶ (WET blocks ignition ×0.1)
```

Per-cell fields: `type`, `state`, `fuel`, `intensity` (1–10), `wetTimer`, `elevation` (0/1/2, optional stretch), `occupants` (house tiles).

`WET → UNBURNT` when the wet timer expires **with fuel intact** — extinguished-but-not-burnt cells can reignite. This one rule produces the "it flared up again behind us" drama for free.

### 2.3 Burning-cell update

Each tick, a BURNING cell: `intensity = min(intensityCap[type], intensity + 1)`; `fuel -= 1`; at `fuel ≤ 0` → BURNT.

| Tile type | fuel (ticks) v0 | intensityCap v0 |
|---|---|---|
| Dense forest | 8 | 9 |
| Sparse forest | 6 | 6 |
| Grassland | 3 | 4 |
| House | 6 | 7 |

Grassland: fast-moving, weak, easy to stop. Dense forest: slow, ferocious, truck-resistant. That asymmetry produces most of the tactical decisions.

### 2.4 Spread rule (the core formula)

Each tick, for every UNBURNT flammable cell `C`, for each BURNING neighbour `B` (roll independently; first success ignites `C` at intensity 1):

```
P(ignite C from B) = P_BASE
                   × fuelFactor[C.type]
                   × moistureFactor(dryness)
                   × windFactor(dir(B→C), wind)
                   × intensityFactor(B)
                   × diagFactor(B, C)
                   × wetFactor(C)
                   [× slopeFactor(B, C)]        // optional stretch; first scope cut
```

| Term | v0 formula / value | Notes |
|---|---|---|
| `P_BASE` | **0.22** per neighbour per tick | Master spread-speed knob |
| `fuelFactor` | dense 1.3 · sparse 1.0 · grass 1.5 · house 1.1 · road/firebreak 0.05 · water/burnt 0 | Roads slow fire but don't fully stop it |
| `moistureFactor` | `0.35 + 1.05 × dryness`, dryness ∈ [0,1] | Dryness is *the* climate lever, set per season (§7.1) |
| `windFactor` | `clamp(1 + windStr × cos θ, 0.15, 1 + windStr)`; θ = angle wind vs. B→C; `windStr` 0.2 (2026) → 1.4 (2070) | Downwind up to ~2.4×; upwind floor keeps fronts alive |
| `intensityFactor` | `clamp(B.intensity / 6, 0.55, 1.4)` | Floor high enough that young fires creep rather than gutter out |
| `diagFactor` | 0.7 diagonal, 1.0 cardinal | ≈ 1/√2 distance correction |
| `wetFactor` | 0.1 while `C.wetTimer > 0`, else 1.0 | Pre-wetting and water drops |
| `slopeFactor` | uphill 1.3 · flat 1.0 · downhill 0.7 | Only if the elevation stretch ships |

**Sanity check (v0):** dense forest, dryness 0.5, no wind, cardinal, intensity 6: `0.22 × 1.3 × 0.875 × 1 × 1 = 0.25/tick` → ignition in ~2 s; front speed ≈ 1 tile / 1.5–2 s.

### 2.5 Ember spotting (from 2045)

```
each tick, each BURNING cell with intensity ≥ 7:
  if rng() < P_SPOT × windStr:            // P_SPOT = 0.008 v0
    target = cell 3–7 tiles downwind (±30° cone)
    if flammable(target) and not WET: ignite at intensity 1
```

Spotting is why firebreaks and rivers stop being absolute safety in later seasons — a direct, legible "the rules you learned no longer hold" climate metaphor. Disabled before 2045.

### 2.6 Ignition sources

Per season: an authored script (staggered ~90 ticks apart in the tutorial, compressing as seasons harden; a quiet valley pulls the next ignition forward) plus a background rate (`P_RANDOM_IGNITION` per tick anywhere flammable in the sector). 2026: 3 scripted, no random. 2070: 6 scripted + 0.004/tick. Early seasons also carry a `spreadMult` brake (0.72 / 0.85 / 0.95 for 2026 / 2030 / 2035).

### 2.7 Detection

A new fire is **simulated but not shown**. It is *reported* (alarm + camera pan + rendered) at the first of:

- `age ≥ DETECT_DELAY` (v0 **10 ticks** = 8 s), or
- it enters a watch tower's radius → reported at age ≤ 2 ticks (1–2 cells), or
- it comes within 6 tiles of any truck, house, or road (people call it in).

Until reported, it renders only as a faint smoke column — the player knows *something* burns, not where. Towers become viscerally valuable with no fog-of-war system. Detection age also sets each village's **warning time**, which drives evacuation mortality (§4.3).

### 2.8 Full tick (pseudocode)

```
function step(state):
  advanceWind(state)                    // slow drift ±30°/30 ticks; gusts in late years
  applyScriptedEvents(state)            // heatwaves, night windows, ember storms, rains
  spawnIgnitions(state)
  for C in grid: next[C] = C
  for C where C.state == BURNING:
      burnDown(next[C])                 // intensity up, fuel down, → BURNT
      trySpot(C, next)                  // §2.5, from 2045
  for C where C.state == UNBURNT and flammable(C):
      for B in mooreNeighbours(C) where B.state == BURNING:
          if rng() < spreadProb(B, C, state.weather):
              next[C] = BURNING(1); break
  tickTimers(next)                      // wetTimer, evac timers, cooldowns
  updateUnits(next)                     // movement, extinguishing, refills, danger rule
  resolveCasualties(next)               // house ignitions → §4.3 mortality
  updateDetection(next)
  swap(state, next)
```

Cost: up to 2,400 cells (only the active sector is stepped) × ≤ 8 neighbour checks at 1.25 Hz — microseconds. Rendering is the only real performance concern (see tech-stack doc §6).

---

## 3. Map model

### 3.1 One persistent map

- **60 × 40 = 2,400 tiles, 1 tile = 1 ha** (100 m × 100 m) → a 6 × 4 km world. Each season plays a centered **sector**: 44×30 in 2026, widened every two seasons to the full world by 2065. The active sector always fits one screen (pan/zoom on mobile) — the whole crisis stays legible; land beyond the sector is simply not yours yet.
- **One curated procedural seed for the entire campaign.** Seasons are ignition/weather scripts on the same map. Burn scars, regrowth across the 4–5-year gaps, and the creeping WUI development (fully arrived by 2050) all accumulate on it — the map is the campaign's diary (see ux doc §1.6).

### 3.2 Tile types

| Type | Burns? | Role | Share (v0) |
|---|---|---|---|
| Dense forest | slow, intense | Main fuel mass; habitat ×3 | 30 % |
| Sparse forest | yes | Buffers; habitat ×2 | 25 % |
| Grassland | fast, weak | Fire highways between forest blocks; habitat ×1 | 20 % |
| Water (lake/river) | no | Hard barrier + truck refill — until an extreme drought dries the river (progression doc §2.2) | 8 % |
| Road | ~no (0.05) | Truck network (4× speed); weak break | 5 % |
| House/village | yes | The stakes: occupants, homes | 3 % (2–4 villages) |
| Firebreak (bare earth) | ~no (0.05) | Pre-authored from the start; player-cut from 2050 | 1 % |
| Rock/bare (optional) | no | Natural breaks, visual variety | ~8 % |

### 3.3 Generation & placement rules (applied once, to the campaign seed)

1. Layered value noise → forest-density field → thresholded into dense/sparse/grass.
2. 1–2 rivers as edge-to-edge polylines; 0–1 lake.
3. **Villages: 2–4 clusters of 6–20 house tiles** in grass/sparse clearings with a 1–2 tile buffer from dense forest. Each house tile: **4–10 occupants** → valley population ~250–600. Development follows a **boom-and-retreat curve** (`balance.ts: development`): housing stock grows roughly linearly to **×1.5 of the 2026 baseline by 2060** — new homes ring outward from each village, pushing into the wildland-urban interface — then managed retreat halves the peak to **×0.75 by 2070**, farthest homes abandoned first. Abandonment is not a fire loss: lots revert to grass, no counter moves — people leave before the fire chooses.
4. Roads: minimum-spanning tree connecting villages + fire station + two map-edge exits; A* along low-density cells.
5. **Fire station** (truck spawn/refill) on a road, roughly central.
6. Validation pass: every village road-reachable; every region truck-reachable; a water source within 12 tiles of each village; at least one pre-authored firebreak line.

### 3.4 Scars and regrowth (applied across the gap between seasons)

Burnt vegetation regrows on a real-years clock, advanced by the 4–5 years that pass between seasons: ash → scarred grassland (+2 yr; the ash tint stays visible ~9 yr) → sparse (+6 yr, dense base only) → original type (+12 yr). Infrastructure (roads, firebreaks) is repaired to its base type by the next season. Dense forest that burns out rolls **25 % permanent conversion** to grassland. A burnt home's lot reverts to grass; whether anything returns is the development curve's call (§3.3) — between seasons each village's stock is adjusted toward its era target, so pre-2060 the towns rebuild and grow, and after 2060 they thin out. A scarred map carries less fuel, which keeps bad seasons from snowballing. When the sector widens, burn history bleeds a few tiles past the old boundary (decaying spillover, stamped deterministically at reveal) so the new ring meets an organic fire edge rather than a ruler line.

---

## 4. Player units and actions

### 4.1 Economy: annual budget + per-unit cooldowns (no action points)

- **Budget** is spent in prep (buy/place) and sparingly mid-season (emergency deploys at +25 %). It carries the message honestly — *fighting climate-driven fire is an escalating cost* — and the debrief can show damage cost vs. prevention budget.
- **Cooldowns** pace the real-time layer (bomber sorties, evac orders). Action points rejected (turn-based artifact); cooldowns-only rejected (no strategic layer, no season-over-season consequence).
- **Budget:** `budget(s) = 80 + 12·t + 0.25 × unspent(s−1) + perfBonus(s−1)`, where `t = seasonIndex` (0–9) and `perfBonus = round(score/50)` (0–20, from the internal score §6.2). Clamped to a floor `minViable(s) = 90 + 6·t` that always affords the minimum effective loadout — the campaign is never mathematically lost.
- Purchases persist across seasons (trucks survive unless destroyed; towers are permanent) — losing a truck hurts half a decade later too.
- **Unlock-season grants are free** ("reassigned to your sector"): 2 trucks (2026), the evacuation capability (2030), water bomber #1 (2035), towers ×2 (2040), fire crew #1 (2050), water bomber #2 (2055). Until the budget system ships (post-1.0), every grant arrives free; budget will buy extras, repairs, replacements, and additional placements.

### 4.2 Fire truck (2026)

| Stat | v0 |
|---|---|
| Cost | 40 (mid-season emergency 50); 2 granted free in 2026 |
| Move | road 5.5 tiles/tick · grass/sparse 2.2 · dense 1.1 · never water |
| Extinguish | 1 adjacent burning cell (range 1, own tile first if standing in fire); **−4 intensity/tick** (net −3); at intensity 0 → WET (wetTimer 40 — fought ground holds) |
| Water | capacity **30**; 1 unit per extinguish-tick; refill **6/tick** adjacent to water or station |
| Pre-wet | 2 water → adjacent unburnt cell WET (wetTimer 30) — defensive lines |
| Crew | 4 firefighters (danger rule below) |

**Derivation of the tuning invariant** *(one truck ≈ one grass front, < one forest front)*: a grass cell at cap (4) dies in ~2 ticks and ~2 water; a windless mid-campaign grass front advances ~1 tile/5 ticks, so one truck holds a front ~2 cells wide with tank margin (~12 grass cells per tank). A dense-forest cell at cap (9) needs ~4.5 ticks and ~5 water while the front moves faster under wind — one truck visibly cannot hold it. Re-verify this derivation whenever `P_BASE`, caps, or truck stats change; it is also a headless CI test (PLAN §4).

**Firefighter danger rule (active from 2045, with the metric reveal):** if a unit's tile is BURNING, or it is adjacent to ≥ 3 cells (crews on foot: ≥ 2) of intensity ≥ 5 — sparse forest and up; grass tops out below the bar — a danger clock runs; after 3 consecutive ticks it broadcasts a radio warning ("Engine 2 requesting pull-out"). **There is no auto-retreat — pulling the crew out is the player's job** (an engine takes a normal move order; a crew moved to any clear tile drops its cut queue). The unit is destroyed — its firefighters lost — only while the warning stands **and no safe tile is reachable without crossing fire** (BFS over passable, non-burning ground; a safe tile has no burning neighbour, and an escape may not squeeze through a corridor flanked by heavy fire on both sides — such a gap is not a way out). Deterministic, never dice: every death traces to a player choice — a position held too long, an escape route allowed to close, a warning ignored. Escape pathfinding weights burning tiles ×25, so ordered retreats route around flame walls. A lost unit's card stays greyed for the season as a memorial; with no budget system, the department rebuilds the unit for the following season. Before 2045 the destruction clause is disabled; pre-spotting fire intensities cannot produce entrapment.

### 4.3 Evacuation order (2030)

| Stat | v0 |
|---|---|
| Target | one village (click/tap) |
| Cost | 8 budget + 30-tick per-village cooldown |
| Duration | `evacBase × (2 − preparedness)` ticks, `evacBase = 12 + 1 per house tile`; houses empty progressively along the road, farthest-from-road last |
| Cleared tiles | 0 % mortality (homes can still be lost) |

**Mortality scales with warning time.** When fire ignites a not-yet-cleared house tile, the lost fraction of its occupants is:

```
warning  = ticks between the igniting fire's detection and the ignition
mortality(warning) = lerp(0.35 → 0.05 over warning 0 → 60 ticks)   // v0
                     × 0.6 if an evacuation of this village is in progress
```

So: undetected fast fire onto a sleeping village ≈ 35 % — a full half-minute of warning plus an evac under way ≈ 3 %. Watch towers extend warning time (§4.5); that is their human payoff. Nothing here is a flat rate, and both acting late and never acting carry real, felt risk.

**Preparedness (hidden scalar, 0.6–1.0, starts 1.0):** a village evacuated but never threatened (no fire within 10 tiles all season) → −0.1 ("evacuation fatigue"; future evacuations run slower). Recovers +0.05 per season played. This replaces any score penalty for over-evacuating — the cost of crying wolf is operational, not moral bookkeeping.

### 4.4 Water bomber (2035; UI never says "Canadair" — trademark)

| Stat | v0 |
|---|---|
| Fleet | #1 free in 2035; #2 free in 2055 (purchase at 150 once the budget system ships) |
| Sortie | two clicks: anchor cell, then aim cell — the line runs from the anchor toward the aim; a live preview shows the exact cells |
| Flight | 1.8 tiles/tick from the station; the plane lays the line cell by cell as it flies the run — the fire keeps moving; lead your target |
| Drop | **1 × 6 tile retardant line**: burning → −12 intensity (extinguished) · line cells WET 90 · orthogonal splash WET 45 |
| Cooldown | reload 25 ticks at the station after the return leg |

The big red button: dramatic, powerful, never sufficient alone — one line every ~12 s against a multi-front fire.

### 4.5 Watch tower (2040)

| Stat | v0 |
|---|---|
| Cost | 30, prep phase only, permanent; #1 free in 2040; cap 4 |
| Radius | 8 tiles |
| Effect | in-radius fires reported at age ≤ 2 ticks (vs. 14) → smaller at engagement **and** longer warning times for downwind villages (§4.3) |

Tuning target to preserve: a tower-covered ignition costs ~½ the burnt area of an uncovered one. *Prevention beating reaction is a core message — the numbers must actually say it.*

### 4.6 Fire crew & controlled burns (2050)

| Stat | v0 |
|---|---|
| Fire crew (bulldozer) | 25; #1 free in 2050; cuts firebreak 1 tile / 3 ticks, lines up to 8 tiles; crew of 2, subject to the danger rule |
| Controlled burn | crew ignites 1 tile deliberately: burns at capped intensity 3, spread rolls ×0.5. **Escape risk:** if `windStr > 0.8` or `dryness > 0.7` the caps are voided — it becomes a real fire |

Controlled burns consume fuel ahead of a front — high skill ceiling, real-world authentic (prescribed burning / Indigenous stewardship practice), and self-balancing: late-campaign weather makes them genuinely dangerous. Pre-authored firebreaks exist on the map from 2026; *cutting new ones* requires the crew (2050).

---

## 5. Unlock & reveal schedule

Canonical table in [`../PLAN.md`](../PLAN.md) §2.2; teaching rationale in [`progression.md`](progression.md) §3. One new thing per season, never a tool tutorial and a dread reveal in the same moment (ux doc §2.2).

---

## 6. Season end, consequences, and the internal score

### 6.1 A year always ends — with the rains

The season timer **is** the autumn rains: at `seasonLen(t)` ticks they arrive and end every fire (a somber fast-forward montage shows anything still burning take what it can first). `seasonLen` grows every season — the rains come later each half-decade, which is both the difficulty curve and the visible climate signal on the HUD's season bar. If all fires are out and no scripted ignitions remain, the season winds down: an alert announces it and the season ends after a short grace (~12 s) — the player is never left waiting on a random ignition that may not come. **There is no fail screen and no replay prompt.** One exception: if every village is lost, the campaign cuts to the early ending "The Year the Line Broke" (ux doc §1.7).

Mid-season **relief rains** (all fires −3 intensity, global wet 20 ticks) are guaranteed through 2035, 50 % likely 2040–2055, and **never occur from 2060** — the 2060 briefing says so, pointedly.

### 6.2 Stewardship Score (internal only — never shown)

```
score(s) = 1000
         − 2   × hectaresBurnt
         − 5   × animalsKilled
         − 40  × housesLost
         − 200 × firefightersLost
         − 400 × civiliansLost
         + 0.5 × budgetRemaining
         + 100 × villagesFullySaved          (floor at 0)
```

Uses: `perfBonus` for the next season's budget (§4.1) and selection of ending narrative variants (progression doc §5). Metrics not yet revealed contribute 0 until their reveal season (scenarios guarantee they are 0 anyway — PLAN §2.2). The cumulative score is never surfaced as a number; the player sees only counters, comparisons, and consequences.

### 6.3 Carry-forward (bounded, so dread never becomes a death spiral)

| System | Rule | Bound |
|---|---|---|
| Map scars | Persist + regrow per §3.4 | Recent burns carry less fuel — partially self-correcting |
| Budget | perfBonus shrinks after bad seasons | `minViable` floor guarantees a fieldable force |
| Rubber-band (hidden) | After a catastrophic season (score < 250), the next spike's modifiers damp 15 % | Invisible; fiction: "a mild La Niña year" |
| Preparedness | §4.3 | Floor 0.6, recovers each season |

---

## 7. Balance levers

Everything is data in `balance.ts`; the difficulty system is a table of these values.

**Climate/weather:** `dryness` (master lever) · `windStr` · wind drift rate · gust events · heatwave events (dryness +Δ for N ticks, telegraphed 10 ticks ahead) · relief-rain schedule · night windows (60 ticks: spread ×0.9 — the fire barely calms — detection delay ×2) · season length.
**Fire model:** `P_BASE` · `fuelFactor[]` · `fuel[]` · `intensityCap[]` · intensity growth · `P_SPOT` + range/cone · `diagFactor` · `wetFactor` + wet durations · (slope factors).
**Ignitions & detection:** scripted count/ticks/regions · `P_RANDOM_IGNITION` · `DETECT_DELAY` · tower radius · call-in radius.
**Map:** biome shares · village count/size/buffer · occupants/house · water & road density · pre-authored firebreaks · regrowth rates · conversion chance.
**Units & economy:** all costs & grants · budget base/growth/carryover/bonus/floor · truck stats · evac durations/cooldown/mortality curve/preparedness deltas · bomber flight/AoE/threshold/cooldown/fleet cap · tower radius/cap · crew cut speed/burn caps/escape thresholds · danger-rule thresholds.
**Structure & scoring:** season lengths · score weights · unlock/reveal schedule.

### 7.1 Reference difficulty curve (v0 — the playtest starting point)

Base curve, one row per played season (`t` = season index); spike-season overrides stack on top (progression doc §2.2). The climate anchoring of each season year to projected warming is in progression doc §2.1.

| Season | t | dryness | windStr | Ignitions (scripted + random/tick) | Season (ticks) | Relief rain | Notes |
|---|---|---|---|---|---|---|---|
| 2026 | 0 | 0.30 | 0.2 | 1 + 0 | 300 | ✔ | Tutorial; scripted wind shift |
| 2030 | 1 | 0.38 | 0.3 | 1 + 0 | 300 | ✔ | Hamlet threat → evac lesson |
| 2035 | 2 | 0.44 | 0.4 | 2 + 0 | 320 | ✔ | + Long Drought overrides |
| 2040 | 3 | 0.50 | 0.5 | 2 + 0.001 | 320 | 50 % | Undetected-ignition lesson |
| 2045 | 4 | 0.56 | 0.7 | 2 + 0.002 | 340 | 50 % | + Heat Dome; spotting begins |
| 2050 | 5 | 0.62 | 0.8 | 3 + 0.002 | 360 | 50 % | WUI district complete |
| 2055 | 6 | 0.68 | 0.9 | 3 + 0.003 | 380 | 50 % | + Early Season; night windows |
| 2060 | 7 | 0.74 | 1.1 | 3 + 0.003 | 400 | ✘ | Relief rains gone for good |
| 2065 | 8 | 0.79 | 1.2 | 4 + 0.004 | 400 | ✘ | + The Interface (ember storm, convoy) |
| 2070 | 9 | 0.85 | 1.4 | 4 + 0.004 | 420 | ✘ | + The Firestorm (pyroCb, wind reversal) |

### 7.2 Tuning invariants (held as automated headless tests)

1. 2026 is losable only by ignoring the fire entirely; a naive bot saves the valley.
2. From 2045 on, the player must lose *something* every season — the design goal is triage, not perfection.
3. A watch-tower-covered ignition costs ~half the burnt area of an uncovered one.
4. One truck ≈ one grass front, and visibly < one dense-forest front in wind (re-derive §4.2 whenever related numbers change).
