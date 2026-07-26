# Campaign Progression & Climate Model

> **Canon note** (binding, from [`../PLAN.md`](../PLAN.md) §2): campaign of **ten seasons — 2026, 2030, then every five years to 2070** · one persistent map; 4–5 real years pass between consecutive seasons · metric reveals: hectares 2026, animals 2030, houses 2035, firefighters 2045 (at zero), population 2050 · unlocks: trucks 2026, evac 2030, water bomber 2035, towers 2040, crews/burns 2050 (each granted free in its season) · no game-over; two endings + do-nothing comparison · all sim constants live in `balance.ts` — this document defines *when* values apply and *why*, never redefines formulas (those live in [`gameplay.md`](gameplay.md)).

---

## 1. Campaign structure

### 1.1 The season ladder: 2026 · 2030 · 2035 · 2040 · 2045 · 2050 · 2055 · 2060 · 2065 · 2070

The player does not command every year — they return to the valley for **one season per half-decade**, ten seasons across 44 years:

- **The calendar is real-pace, not compressed.** Between two consecutive played seasons, 4–5 years of projected climate change accrue, and the warming anchors (§2.1) follow mid-range projections at face value. The *felt* difficulty amplifies those trends for legibility — a playable fire must escalate faster than a fire-weather index — and every played season is its window's worst (§1.2). The honesty note discloses exactly that, and nothing else.
- **Each played season is the *worst* season of its window.** The interstitial card (§1.2) notes the quieter years between. This is honest to how climate change is experienced: as record-breaking years, not as averages — you play the seasons that made the news.
- **2070 is a lived horizon.** A player who is 25 in 2026 is 69 in 2070. The campaign spans one working lifetime — *your* lifetime — which is the awareness message stated in years.
- **Ten levels fits the mini-game budget:** 3–5 minutes per season, ~30–50 minutes per campaign.

### 1.2 Pacing rhythm

The ladder alternates two level types, preserving the brief's "harsher situations every couple of levels":

- **Ordinary seasons** (2026, 2030, 2040, 2050, 2060) — baseline difficulty at that year's projected climate. New tools unlock here and are practiced in relative calm. Breathing room is deliberate: dread needs contrast.
- **Spike seasons** (2035, 2045, 2055, 2065, 2070) — an authored, named climate event stacks scripted modifiers on the baseline. Each spike is built around **one real fire-weather phenomenon** and is the exam for the tool unlocked the season before.

**The years between (interstitial card).** Each briefing opens with two quiet lines summarizing the elided years, generated from sim state and script — *"2031–2034: four seasons, two large fires held by the autumn rains. The Aldervale scar greens over. Twelve new homes permitted at the forest edge."* The card is where regrowth, creeping development, and the slow ratchet become visible without being played.

An honesty note (options screen / end card): *"Each level is one fire season — the worst of its half-decade; between levels, years pass. The climate trajectory follows mid-range projections (an SSP2-4.5-like pathway); the fires themselves are dramatized. The trends are real — sources listed at the end."*

### 1.3 Season-by-season table (canonical narrative layer)

Mechanical values live in the reference difficulty curve ([`gameplay.md`](gameplay.md) §7.1); spike overrides in §2.2 below.

| Season | Type | Scenario | Unlock | Metric revealed | Real fact surfaced (briefing; sourced in `facts.json`) |
|---|---|---|---|---|---|
| **2026** | Tutorial | A single slow grass-edge ignition near the forest road, called in within 5 s. Guided containment; one scripted wind shift forces the first repositioning. | **Fire trucks** ×2 | **Burnt hectares** | The global fire-weather season lengthened ~19 % between 1979 and 2013 (Jolly et al., *Nature Communications*, 2015). |
| **2030** | Ordinary | A fire drifts toward an outlying hamlet — the first evacuation decision, with a comfortable warning window. | **Evacuation orders** | **Animals killed** (with a retroactive "since 2026" line) | The UN projects extreme fire events to increase by **up to 14 % by 2030** (UNEP, *Spreading like Wildfire*, 2022). *(Year-end footnote: Australia's 2019–20 Black Summer fires killed or displaced an estimated 3 billion animals — WWF.)* |
| **2035** | **SPIKE — "The Long Drought"** | Multi-year drought peaks: dryness jumps; two simultaneous fires spread through areas that "never burn." Wildlife concentrated at shrinking waterholes burns with the forest; embers take the first homes. | **Water bomber** ×1 | **Houses lost** | In 2022, drought-stricken Europe suffered its second-worst fire season on record: ~837,000 ha burnt in the EU (EFFIS/JRC annual report). *(Year-end footnote: about one in three US homes sits in the wildland-urban interface.)* |
| **2040** | Ordinary | An ignition grows undetected for its full 7-second detection delay — the player watches a distant smoke column, helpless — before crews engage a fire already several fronts wide. | **Watch towers** | — | Average annual area burned in the US roughly doubled between the 1990s and the 2010s (NIFC). |
| **2045** | **SPIKE — "The Heat Dome"** | Mid-season scripted heat event with doubled winds and a guaranteed 90° wind shift. Ember spotting begins: fire jumps a containment line for the first time. A scripted near-entrapment — a crew's escape route nearly closes — reveals the firefighter counter **at zero**. | — (bomber mastery test) | **Firefighters lost** (at 0) | During the 2021 Pacific Northwest heat dome, Lytton, BC reached 49.6 °C — and burned to the ground the next day. *(Year-end footnote: in 2013, 19 members of the Granite Mountain Hotshots died in an entrapment at Yarnell Hill, Arizona.)* |
| **2050** | Ordinary | Decades of development have pushed into the forest edge: the interstitials' "new homes permitted" are now a district inside the wildland-urban interface. The population counter arrives with the people who live where fire lives. | **Fire crews / controlled burns** | **Population lost** | The UN projects extreme fire events to increase by **up to 30 % by 2050**, even under strong emissions cuts (UNEP, 2022). *(Year-end footnote: Indigenous fire stewardship kept fire-adapted landscapes healthy for millennia; prescribed burning is again core policy in Australia, California, and the Mediterranean.)* |
| **2055** | **SPIKE — "The Early Season"** | The season opens with **two fires already burning** and a longer year. First night windows: the fire no longer calms after dark, and detection halves. A 2nd water bomber joins the sector. | — (detection mastery test) | — | Canada's record 2023 season burned more than 15 million hectares — over double the previous record — and began unusually early, in May. *(Year-end footnote: nighttime fire intensity rose ~7 % globally from 2003–2020 — Balch et al.,* Nature*, 2022.)* |
| **2060** | Ordinary (elevated) | A dry, oppressive season. The forecast box where relief rain used to appear now reads: none expected. It never appears again. Parts of the oldest scars have not come back — permanent conversion is now visible on the map. | — | — | After high-severity fire in a hotter climate, some forests fail to regenerate at all, converting permanently to shrubland. |
| **2065** | **SPIKE — "The Interface"** | An ember storm drives fire into the WUI district. The convoy set piece: an evacuation must escape along the valley road while the front races to cut it. | — (evac + firebreak mastery test) | — | The 2018 Camp Fire destroyed ~18,800 structures and killed 85 people in Paradise, California. *(Year-end footnote: in Pedrógão Grande, Portugal, 2017, most of the 66 dead were caught on roads while fleeing.)* |
| **2070** | **Finale — "The Firestorm"** | Everything at once: drought + heat + wind + four ignitions + a mid-level **pyrocumulonimbus** event that spawns lightning ignitions and reverses the wind. Designed so even a perfect player takes losses. Ends in the retrospective dashboard and the ending. | — (full-kit exam) | **Retrospective dashboard** (all metrics, all seasons) | Australia's Black Summer generated dozens of fire-triggered thunderstorms — fires so large they made their own weather. |

---

## 2. Formal difficulty model

### 2.1 Climate anchoring: one lever, real projections

One master lever `t = seasonIndex` (0…9) moves everything; each season index is pinned to a calendar year and a projected warming level under a middle-of-the-road pathway (SSP2-4.5-like central estimates, IPCC AR6 — approximate by design, surfaced with "≈" in-game):

| Season | 2026 | 2030 | 2035 | 2040 | 2045 | 2050 | 2055 | 2060 | 2065 | 2070 |
|---|---|---|---|---|---|---|---|---|---|---|
| `t` | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| ≈ °C above preindustrial | 1.3 | 1.4 | 1.5 | 1.6 | 1.75 | 1.9 | 2.0 | 2.1 | 2.25 | 2.35 |

The sim drivers scale with `t`; canonical per-season values live in [`gameplay.md`](gameplay.md) §7.1:

```
dryness(t)     ≈ 0.30 + 0.06·t          // fuel dryness, the master knob
windStr(t)     ≈ 0.20 + 0.13·t          // wind strength driving spread anisotropy & spotting
seasonLen(t)   ≈ 300 + 13·t ticks       // the rains arrive later each half-decade
ignitions(t)   : scripted 1→4 + random 0→0.004/tick
emberSpotting  : off before 2045; P_SPOT × windStr thereafter
reliefRains    : guaranteed through 2035, 50 % 2040–2055, none from 2060
nightWindows   : from 2055 (60-tick windows: spread ×0.9, detection delay ×2)
```

The anchor row is surfaced in-game under the year display: the season's central estimate ("≈ +1.75 °C — the global average") with a second line estimating peak summer days at **1.5× the mean** — the low end of AR6 WG1's finding that hot extremes over many land regions warm at roughly 1.5–2× the global-mean rate (at +2 °C global, a 1-in-10-year heat event runs ≈ +2.6 °C). Both lines carry the "≈" honesty marker; the tooltip names the pathway and the source.

Because consecutive seasons are 4–5 years apart, each one-step increase in `t` represents half a decade of projected change. The anchors are real-pace; the sim drivers *amplify* the anchored trends for legibility (a playable fire must escalate faster than a fire-weather index does), and each played season is the worst of its window — the drama is authored on top of the trend, never instead of it.

| Driver | Real trend it tracks |
|---|---|
| `dryness` | Rising vapour-pressure deficit and "hot drought" frequency with warming; the 2022 EU drought was called the worst in ~500 years |
| `windStr` / gusts | Increasing frequency of extreme fire-weather (high-FWI) days across the Mediterranean, western US, Australia |
| `seasonLen` | Fire-weather season +19 % globally 1979–2013 and still lengthening; the western US season runs ~2–3 months longer than in the 1970s |
| `ignitions` | More flammable days × constant human ignition pressure (humans cause ~85–95 % of ignitions) + rising dry lightning |
| ember spotting | Higher-intensity fires spot farther; megafire frequency rising on every fire-prone continent |
| night windows | Nights warming faster than days; flammable night hours up ~36 % across global burnable lands, 1979–2020 (Balch et al. 2022) |
| relief rains | Longer intra-seasonal dry spells; season-ending rains arriving later |

### 2.2 Spike-season overrides (additive scripted modifiers, not a second difficulty system)

| Season | Overrides on the base curve |
|---|---|
| **2035** The Long Drought | dryness +0.12; wildlife density ×3 on waterhole-adjacent tiles (raises the animal stakes); both scripted ignitions land in the first half of the season |
| **2045** The Heat Dome | ticks 120–200: dryness +0.15, windStr ×2, one guaranteed 90° wind shift; scripted near-entrapment beat |
| **2055** The Early Season | 2 fires active at tick 0; two night windows |
| **2065** The Interface | ember storm: P_SPOT ×4 for 60 ticks, cone directed at the WUI district; convoy set piece (a scripted evacuation timer along the valley road that the front threatens to cut — built on the existing evac system, no new entity type) |
| **2070** The Firestorm | Heat-dome modifiers + ember storm + one night window + mid-level pyroCb event: 3 simultaneous lightning ignitions and a full wind reversal in one tick |

Guarantee: no parameter ever exceeds its 2070 value — the finale is the tuned ceiling of the game.

---

## 3. Unlock schedule and teaching rationale

| Season | Unlock | What it teaches | Why this order |
|---|---|---|---|
| 2026 | Fire trucks | Direct attack; fire has a front; positioning matters | The simplest verb: point resource at fire. |
| 2030 | Evacuation | You cannot save everything — triage lives vs. land | Introduced the moment a settlement is first threatened, so it is learned emotionally, not as a menu item. |
| 2035 | Water bomber | Powerful but scarce burst suppression; refill cycles; leading a moving target | Arrives exactly when trucks first *fail* (the Drought's simultaneous fires) — air power reads as earned relief, and 2045 promptly shows its limits. |
| 2040 | Watch towers | **Detection beats suppression** — minutes of early warning are worth more than another truck | Taught right after the player has lost time to a late-detected fire. Mirrors real doctrine: the cheapest hectare is the one that never ignites big. |
| 2050 | Fire crews / controlled burns | Pre-emption: firebreaks and good fire prevent bad fire; short-term risk for long-term safety | The pedagogical pivot from reactive to proactive, saved for a player mature enough to trust it. Models prescribed-burn / Indigenous stewardship practice. Late-campaign weather makes burns genuinely risky — self-balancing. |
| 2055 | 2nd water bomber (free until the budget system ships) | Capacity planning under a tightening budget | The last new capability. From 2060: **no new tools — only the climate escalates.** The complete toolkit's growing insufficiency is the message. |

Progression arc in one line: **react → triage → strike → see → shape.**

---

## 4. Metric & dread disclosure schedule

Metrics appear one at a time, each attached to the season where the player first causes or witnesses that loss. Counters, once revealed, persist forever, including a cumulative campaign ledger on the year-end report. Reveal staging (auto-pause, slot fill, single tooltip) is specified in [`ux.md`](ux.md) §2.2.

| Season | Metric | Derivation from sim state | Presentation |
|---|---|---|---|
| 2026 | **Burnt hectares** | `burntCells × 1 ha` | Neutral, almost administrative. The baseline stat. |
| 2030 | **Animals killed** | `Σ over burnt tiles: habitat(type) × speedMortality`; habitat/tile: dense 3, sparse 2, grass 1; `speedMortality` 0.5 (slow, creeping front — animals flee) → 1.5 (fast wind-driven front) | Displayed fuzzed ("~340 animals") — an estimate, which is scientifically honest. Reveal includes the retroactive "since 2026" total. |
| 2035 | **Houses lost** | House tiles burnt (1 home per tile) | Ticks *during* play with a small icon per home — losses are watched, not summarized. |
| 2045 | **Firefighters lost** | Deterministic entrapment only ([`gameplay.md`](gameplay.md) §4.2): 4 per truck, 2 per crew; every loss preceded by a radio warning and traceable to a player choice | Revealed **at zero** after the scripted near-miss — the dread of the empty counter precedes any death. |
| 2050 | **Population lost** | Warning-time mortality on un-evacuated occupants ([`gameplay.md`](gameplay.md) §4.3); the 2065 convoy risk uses the same rule on the road | The heaviest number. Full-stop end-of-year card when > 0. Never individualized (ux doc §3.5). |
| 2070 | **Retrospective dashboard** | Cumulative ledger, every metric, every season, over the map timeline | The campaign's mirror; feeds the ending. |

**Sequencing guarantee (from design review):** scenarios are authored so each metric's first possible occurrence coincides with its reveal season — the 2026 fire starts far from villages, 2030–2040 fires give generous warning windows, and the crew-destruction clause is disabled before 2045. If a loss somehow occurs earlier anyway, the reveal fires early; the schedule is a guarantee, not a gate. No metric affects budget or endings before it is revealed.

**Disclosure principle:** each new metric reframes the previous ones. Hectares feel abstract until animals die in them; houses feel material until people do. The HUD in 2070 carries five counters that 2026 didn't have — the interface itself has grown heavier, and the player felt every addition.

---

## 5. Failure, consequence & ending model

### 5.1 Within a season: no game over

Canonical rules in [`gameplay.md`](gameplay.md) §6.1: the season always ends with the (ever-later) autumn rains; unchecked fire takes what it can in a somber montage. Failure is measured in losses carried forward, never in a retry screen — the game never lets you undo a season.

### 5.2 Between seasons: bounded consequences across the years that pass

Canonical table in [`gameplay.md`](gameplay.md) §6.3 — map scars & regrowth (which now advance 4–5 years per gap: last season's burn returns as grass with a visible scar tint; full forest takes several gaps; converted cells never return), budget floor, hidden post-catastrophe damping, evacuation preparedness. **Authored dread floor:** the scripted beats (2045 near-miss, 2065 convoy, 2070 pyroCb) fire regardless of performance — skilled players still feel the escalation even if their counters stay low. Dread is authored; losses are earned.

### 5.3 Endings: agency, not doom

Two endings ([`ux.md`](ux.md) §1.7), both flowing into the awareness screen:

- **"The Long Defense"** — the campaign completed. The closing narrative line varies with the cumulative internal Stewardship Score, three variants: high — *"You didn't stop the fire. You changed what it could take."*; middle — the town stands, scarred; a rebuilt street beside a memorial (most players land here, and it should feel like real life); low — part of the valley is abandoned, shrubland where forest was; but the final shot is seedlings in the burn scar and a watch tower going up. Even the low variant refuses pure doom.
- **"The Year the Line Broke"** — every village lost, campaign ends early. Cut to black, the year in large type, the tallies, the same slow zoom-out. Failure written as history, not as a game verdict.

**The do-nothing comparison (both endings):** the same 44 years re-simulated headlessly with zero player commands, shown side by side: *"Your actions saved 4,120 hectares, 213 homes, 61 lives."* The player never beat the climate trend — they demonstrably beat inaction. That asymmetry **is** the message.

**Awareness screen** (both endings): *"This forest is invented. The trend is not."* — Learn / Prepare / Act resource columns, full source list for every fact, and a static two-panel image of the valley in 2100 under low- vs. high-emissions pathways (the interactive slider version is post-1.0; 2100 is thirty more years — six more gaps like the ones the player just lived through, and the screen invites that arithmetic). Final card: *"Adaptation decided what this valley lost. Mitigation decides what every valley faces. Both are choices."* Then the title screen — restored to green 2026, which now reads differently.

---

## 6. Facts pipeline

Every fact in the season table ships in `facts.json`: `{ id, season, surface, text, source, sourceUrl, accessedDate }`. Rules: no invented statistics, ever; one fact per surface per season (briefing + optional year-end footnote); every fact tied to something the player just experienced; projection facts (UNEP 2030/2050) surface in the seasons they name. Full citations in the credits. Re-verification of every entry against its source is an M4 release gate (PLAN §5).
