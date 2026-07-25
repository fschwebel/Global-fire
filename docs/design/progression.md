# Campaign Progression & Climate Model

> **Canon note** (binding, from [`../PLAN.md`](../PLAN.md) §2): campaign **2026–2035** (10 years) · one persistent map · metric reveals: hectares 2026, animals 2027, houses 2028, firefighters 2030 (at zero), population 2031 · unlocks: trucks 2026, evac 2027, water bomber 2028, towers 2029, crews/burns 2031 (each granted free in its year) · no game-over; two endings + do-nothing comparison · all sim constants live in `balance.ts` — this document defines *when* values apply and *why*, never redefines formulas (those live in [`gameplay.md`](gameplay.md)).

---

## 1. Campaign structure

### 1.1 Why 10 years, 2026–2035

- **A decade reads as a trend, not weather.** Ten data points of one ratcheting lever are enough for the player to *feel* the direction without any text saying it.
- **Mini-game budget:** at 3–5 minutes per year the full campaign is **~30–50 minutes** — one evening or several short sessions. (A 15-year variant reaching 2040 was considered and cut; its extra content — community adaptation, regeneration failure, epilogue slider — is preserved in the post-1.0 backlog, PLAN §2.5.)
- **The brief's "harsher situations every couple of years"** maps to a strict rhythm: spike years 2028, 2030, 2032, 2034, and the 2035 finale, with ordinary escalation years between.

### 1.2 Pacing rhythm: unlock in calm, test in crisis

- **Ordinary years** — baseline difficulty rises via the climate model (§2). New tools unlock here and are practiced in relative calm. Breathing room is deliberate: dread needs contrast.
- **Spike years** — an authored, named climate event stacks scripted modifiers on the baseline. Each spike is built around **one real fire-weather phenomenon** and is the exam for the tool unlocked the year before.

An in-game honesty note (options screen and end card): *"Dates and rates are compressed roughly 3× for playability. The trends are real — sources listed at the end."*

### 1.3 Year-by-year table (canonical narrative layer)

Mechanical values for each year live in the reference difficulty curve ([`gameplay.md`](gameplay.md) §7.1); spike overrides in §2.2 below.

| Year | Type | Scenario | Unlock | Metric revealed | Real fact surfaced (briefing; sourced in `facts.json`) |
|---|---|---|---|---|---|
| **2026** | Tutorial | A single slow grass-edge ignition near the forest road, called in within 5 s. Guided containment; one scripted wind shift forces the first repositioning. | **Fire trucks** ×2 | **Burnt hectares** | The global fire-weather season lengthened ~19 % between 1979 and 2013 (Jolly et al., *Nature Communications*, 2015). |
| **2027** | Ordinary | A fire drifts toward an outlying hamlet — the first evacuation decision, with a comfortable warning window. | **Evacuation orders** | **Animals killed** (with a retroactive "since 2026" line) | Australia's 2019–20 Black Summer fires killed or displaced an estimated 3 billion animals (WWF). |
| **2028** | **SPIKE — "The Long Drought"** | Mega-drought year: dryness jumps; two simultaneous fires spread through areas that "never burn." Wildlife concentrated at shrinking waterholes burns with the forest; embers take the first homes. | **Water bomber** ×1 | **Houses lost** | In 2022, drought-stricken Europe suffered one of its worst fire seasons on record: ~900,000 ha burnt in the EU (Copernicus/EFFIS). |
| **2029** | Ordinary | An ignition grows undetected for its full 7-second detection delay — the player watches a distant smoke column, helpless — before crews engage a fire already several fronts wide. | **Watch towers** | — | Average annual area burned in the US has roughly doubled since the 1990s (NIFC). |
| **2030** | **SPIKE — "The Heat Dome"** | Mid-season scripted heat event with doubled winds and a guaranteed 90° wind shift. Ember spotting begins: fire jumps a containment line for the first time. A scripted near-entrapment — a crew's escape route nearly closes — reveals the firefighter counter **at zero**. | — (bomber mastery test) | **Firefighters lost** (at 0) | During the 2021 Pacific Northwest heat dome, Lytton, BC reached 49.6 °C — and burned to the ground the next day. *(Year-end footnote: in 2013, 19 members of the Granite Mountain Hotshots died in an entrapment at Yarnell Hill, Arizona.)* |
| **2031** | Ordinary | Development pushes into the forest edge: new house tiles appear inside the wildland-urban interface. The population counter arrives with the people who now live where fire lives. | **Fire crews / controlled burns** | **Population lost** | About one in three US homes now sits in the wildland-urban interface — the fastest-growing land-use type in the US. |
| **2032** | **SPIKE — "The Early Season"** | The season opens with **two fires already burning** and a longer year. First night windows: the fire no longer calms after dark, and detection halves. A 2nd water bomber becomes purchasable. | — (detection mastery test) | — | Canada's record 2023 season burned more than 15 million hectares — over double the previous record — and began unusually early, in May. |
| **2033** | Ordinary (elevated) | A dry, oppressive year. The forecast box where relief rain used to appear now reads: none expected. It never appears again. | — | — | Nighttime fire intensity rose ~7 % globally from 2003–2020; warmer nights mean fires no longer lie down after dark (Balch et al., *Nature*, 2022). |
| **2034** | **SPIKE — "The Interface"** | An ember storm drives fire into the WUI. The convoy set piece: an evacuation must escape along the valley road while the front races to cut it. | — (evac + firebreak mastery test) | — | The 2018 Camp Fire destroyed ~18,800 structures and killed 85 people in Paradise, California. *(Year-end footnote: in Pedrógão Grande, Portugal, 2017, most of the 66 dead were caught on roads while fleeing.)* |
| **2035** | **Finale — "The Firestorm"** | Everything at once: drought + heat + wind + four ignitions + a mid-level **pyrocumulonimbus** event that spawns lightning ignitions and reverses the wind. Designed so even a perfect player takes losses. Ends in the retrospective dashboard and the ending. | — (full-kit exam) | **Retrospective dashboard** (all metrics, all years) | Australia's Black Summer generated dozens of fire-triggered thunderstorms — fires so large they made their own weather. |

---

## 2. Formal difficulty model

### 2.1 Climate drivers

One master lever `t = year − 2026` (0…9) moves everything. The per-year values are canonical in the reference curve table ([`gameplay.md`](gameplay.md) §7.1); the curves they follow, and the real observed trend each compresses (~3×):

```
dryness(t)     ≈ 0.30 + 0.06·t          // fuel dryness, the master knob
windStr(t)     ≈ 0.20 + 0.13·t          // wind strength driving spread anisotropy & spotting
seasonLen(t)   ≈ 300 + 13·t ticks       // the rains arrive later every year
ignitions(t)   : scripted 1→4 + random 0→0.004/tick
emberSpotting  : off before 2030; P_SPOT × windStr thereafter
reliefRains    : guaranteed ≤2028, 50 % 2029–2032, none from 2033
nightWindows   : from 2032 (60-tick windows: spread ×0.9, detection delay ×2)
```

| Driver | Real trend it compresses |
|---|---|
| `dryness` | Rising vapour-pressure deficit and "hot drought" frequency; the 2022 EU drought was called the worst in ~500 years |
| `windStr` / gusts | Increasing frequency of extreme fire-weather (high-FWI) days across the Mediterranean, western US, Australia |
| `seasonLen` | Fire-weather season +19 % globally 1979–2013; the western US season runs ~2–3 months longer than in the 1970s |
| `ignitions` | More flammable days × constant human ignition pressure (humans cause ~85–95 % of ignitions) + rising dry lightning |
| ember spotting | Higher-intensity fires spot farther; megafire frequency rising on every fire-prone continent |
| night windows | Nights warming faster than days; flammable night hours up ~36 % in the western US (Balch et al. 2022) |
| relief rains | Longer intra-seasonal dry spells; season-ending rains arriving later |

### 2.2 Spike-year overrides (additive scripted modifiers, not a second difficulty system)

| Year | Overrides on the base curve |
|---|---|
| **2028** The Long Drought | dryness +0.12; wildlife density ×3 on waterhole-adjacent tiles (raises the animal stakes); both scripted ignitions land in the first half of the season |
| **2030** The Heat Dome | ticks 120–200: dryness +0.15, windStr ×2, one guaranteed 90° wind shift; scripted near-entrapment beat |
| **2032** The Early Season | 2 fires active at tick 0; two night windows |
| **2034** The Interface | ember storm: P_SPOT ×4 for 60 ticks, cone directed at the WUI; convoy set piece (a scripted evacuation timer along the valley road that the front threatens to cut — built on the existing evac system, no new entity type) |
| **2035** The Firestorm | Heat-dome modifiers + ember storm + one night window + mid-level pyroCb event: 3 simultaneous lightning ignitions and a full wind reversal in one tick |

Guarantee: no parameter ever exceeds its 2035 value — the finale is the tuned ceiling of the game.

---

## 3. Unlock schedule and teaching rationale

| Year | Unlock | What it teaches | Why this order |
|---|---|---|---|
| 2026 | Fire trucks | Direct attack; fire has a front; positioning matters | The simplest verb: point resource at fire. |
| 2027 | Evacuation | You cannot save everything — triage lives vs. land | Introduced the moment a settlement is first threatened, so it is learned emotionally, not as a menu item. |
| 2028 | Water bomber | Powerful but scarce burst suppression; refill cycles; leading a moving target | Arrives exactly when trucks first *fail* (the Drought's simultaneous fires) — air power reads as earned relief, and 2030 promptly shows its limits. |
| 2029 | Watch towers | **Detection beats suppression** — minutes of early warning are worth more than another truck | Taught right after the player has lost time to a late-detected fire. Mirrors real doctrine: the cheapest hectare is the one that never ignites big. |
| 2031 | Fire crews / controlled burns | Pre-emption: firebreaks and good fire prevent bad fire; short-term risk for long-term safety | The pedagogical pivot from reactive to proactive, saved for a player mature enough to trust it. Models prescribed-burn / Indigenous stewardship practice. Late-game weather makes burns genuinely risky — self-balancing. |
| 2032 | 2nd water bomber (purchase) | Capacity planning under a tightening budget | The last new capability. From 2033: **no new tools — only the climate escalates.** The complete toolkit's growing insufficiency is the message. |

Progression arc in one line: **react → triage → strike → see → shape.**

---

## 4. Metric & dread disclosure schedule

Metrics appear one at a time, each attached to the year where the player first causes or witnesses that loss. Counters, once revealed, persist forever, including a cumulative campaign ledger on the year-end report. Reveal staging (auto-pause, slot fill, single tooltip) is specified in [`ux.md`](ux.md) §2.2.

| Year | Metric | Derivation from sim state | Presentation |
|---|---|---|---|
| 2026 | **Burnt hectares** | `burntCells × 1 ha` | Neutral, almost administrative. The baseline stat. |
| 2027 | **Animals killed** | `Σ over burnt tiles: habitat(type) × speedMortality`; habitat/tile: dense 3, sparse 2, grass 1; `speedMortality` 0.5 (slow, creeping front — animals flee) → 1.5 (fast wind-driven front) | Displayed fuzzed ("~340 animals") — an estimate, which is scientifically honest. Reveal includes the retroactive "since 2026" total. |
| 2028 | **Houses lost** | House tiles burnt (1 home per tile) | Ticks *during* play with a small icon per home — losses are watched, not summarized. |
| 2030 | **Firefighters lost** | Deterministic entrapment only ([`gameplay.md`](gameplay.md) §4.2): 4 per truck, 2 per crew; every loss preceded by a radio warning and traceable to a player choice | Revealed **at zero** after the scripted near-miss — the dread of the empty counter precedes any death. |
| 2031 | **Population lost** | Warning-time mortality on un-evacuated occupants ([`gameplay.md`](gameplay.md) §4.3); 2034 convoy risk uses the same rule on the road | The heaviest number. Full-stop end-of-year card when > 0. Never individualized (ux doc §3.5). |
| 2035 | **Retrospective dashboard** | Cumulative ledger, every metric, every year, over the map timeline | The campaign's mirror; feeds the ending. |

**Sequencing guarantee (from design review):** scenarios are authored so each metric's first possible occurrence coincides with its reveal year — 2026–2027 fires start far from villages with generous warning windows, and the crew-destruction clause is disabled before 2030. If a loss somehow occurs earlier anyway, the reveal fires early; the schedule is a guarantee, not a gate. No metric affects budget or endings before it is revealed.

**Disclosure principle:** each new metric reframes the previous ones. Hectares feel abstract until animals die in them; houses feel material until people do. The HUD in 2035 carries five counters that 2026 didn't have — the interface itself has grown heavier, and the player felt every addition.

---

## 5. Failure, consequence & ending model

### 5.1 Within a year: no game over

Canonical rules in [`gameplay.md`](gameplay.md) §6.1: the season always ends with the (ever-later) autumn rains; unchecked fire takes what it can in a somber montage. Failure is measured in losses carried forward, never in a retry screen — the game never lets you undo a year.

### 5.2 Between years: bounded consequences

Canonical table in [`gameplay.md`](gameplay.md) §6.3 — map scars & regrowth, budget floor, hidden post-catastrophe damping, evacuation preparedness. **Authored dread floor:** the scripted beats (2030 near-miss, 2034 convoy, 2035 pyroCb) fire regardless of performance — skilled players still feel the escalation even if their counters stay low. Dread is authored; losses are earned.

### 5.3 Endings: agency, not doom

Two endings ([`ux.md`](ux.md) §1.7), both flowing into the awareness screen:

- **"The Long Defense"** — the campaign completed. The closing narrative line varies with the cumulative internal Stewardship Score, three variants: high — *"You didn't stop the fire. You changed what it could take."*; middle — the town stands, scarred; a rebuilt street beside a memorial (most players land here, and it should feel like real life); low — part of the valley is abandoned, shrubland where forest was; but the final shot is seedlings in the burn scar and a watch tower going up. Even the low variant refuses pure doom.
- **"The Year the Line Broke"** — every village lost, campaign ends early. Cut to black, the year in large type, the tallies, the same slow zoom-out. Failure written as history, not as a game verdict.

**The do-nothing comparison (both endings):** the same decade re-simulated headlessly with zero player commands, shown side by side: *"Your actions saved 4,120 hectares, 213 homes, 61 lives."* The player never beat the climate trend — they demonstrably beat inaction. That asymmetry **is** the message.

**Awareness screen** (both endings): *"This forest is invented. The trend is not."* — Learn / Prepare / Act resource columns, full source list for every fact, and a static two-panel image of the valley in 2100 under low- vs. high-emissions pathways (the interactive slider version is post-1.0). Final card: *"Adaptation decided what this valley lost. Mitigation decides what every valley faces. Both are choices."* Then the title screen — restored to green 2026, which now reads differently.

---

## 6. Facts pipeline

Every fact in the year table ships in `facts.json`: `{ id, year, surface, text, source, sourceUrl, accessedDate }`. Rules: no invented statistics, ever; one fact per surface per year (briefing + optional year-end footnote); every fact tied to something the player just experienced; full citations in the credits. Re-verification of every entry against its source is an M4 release gate (PLAN §5).
