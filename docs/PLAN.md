# Global Fire — Master Plan

*Founding document. Everything in `docs/design/` elaborates a section of this plan; where any detail disagrees, the **Canon** section below wins.*

> **Reality check (July 2026).** The game shipped, and diverged from this plan in places.
> Where this document and the code disagree, **the code and the root `README.md` are the
> truth**. The confirmed divergences:
>
> - **No budget, no prep phase, no Stewardship Score.** Every means arrives free at its
>   unlock season; seasons go briefing → play; nothing is bought, repaired, or scored.
> - **No named spike levels** ("The Long Drought", "The Heat Dome", …). Escalation is
>   systemic; the authored crisis is the extreme-drought event (50% per season from 2045,
>   certain from 2060 — the river runs dry, bombers ground).
> - **No auto-retreat — the opposite.** The shipped danger rule warns and then loses a
>   genuinely trapped unit; pulling out is the player's job. Deaths remain deterministic.
> - **Evacuation mortality is tiered, not warning-time-scaled:** 30% unevacuated / 10%
>   mid-evacuation / 0% cleared. No preparedness scalar.
> - **No ember spotting, night windows, convoy set piece, pyroCb, or early "Line Broke"
>   ending.** The campaign always runs to 2070.
> - **Reveals are year-based** (counters unhide at season start), not event-triggered.
> - **Pause/play only** — the 2× speed was cut. First fire lands ~8 s in, detection delay
>   is 8 s (10 ticks at 800 ms).
> - **Stack:** plain Canvas 2D with zero runtime dependencies — no PixiJS, no Howler, no
>   audio at all. Facts live in `src/ui/facts.ts` (en/fr/es), not `facts.json`. GA4 analytics
>   were added at the owner's request in 2026 (pageviews + progression events).
> - **Development is boom-and-retreat:** housing grows to ×1.5 by 2060, then managed
>   retreat to ×0.75 by 2070 — the WUI is not "complete by 2050".
> - **Late-game impossibility is explicit design canon** — see "Losing is the point" in
>   the README.

---

## 1. Vision

An interactive JavaScript mini game that creates awareness about global warming and forest fires — not by telling the player the climate is changing, but by making them the person responsible for a valley while it does.

**One paragraph:** The player commands the fire service of a single forested valley with a few villages. The campaign samples ten fire seasons across 44 years — **2026, 2030, then every five years to 2070** — each 3–5 minutes; between seasons, real years pass. 2026 is easy — one slow fire, two trucks. Each season the climate-driven parameters (fuel dryness, wind, ignition count, season length) have ratcheted by another half-decade along mid-range projections; every other season a named spike event lands ("The Long Drought", "The Heat Dome", "The Firestorm"). The player progressively unlocks firefighting tools — evacuation orders, a water bomber, watch towers, fire crews and controlled burns — and the interface progressively reveals the cost: burnt hectares, then animals killed, houses lost, firefighters dead, and finally civilian lives. There is no game over and no score screen; there is a persistent map that scars and regrows across the gaps, a budget that tightens, and an ending that compares the player's 44 years to a simulation of doing nothing.

### Design pillars

1. **The simulation is the argument.** Real climate projections at their real pace: consecutive levels are half a decade apart, anchored to mid-range warming projections. The felt difficulty amplifies those trends for legibility — each level plays its window's worst season — and the in-game honesty note says exactly that. Facts annotate what the player just lived; they never lecture.
2. **Unlock in calm, test in crisis.** Every tool is taught in an ordinary season and examined by the next spike season.
3. **The interface is the narrative.** The HUD grows heavier over the campaign; each new loss counter is a story beat, staged with care (auto-pause, silence, one plain sentence).
4. **Dread, responsibly.** No gore, no depicted suffering, no spectacle for destruction. Numbers and absence. Destruction gets zero juice; player agency gets all of it.
5. **Agency, not doom.** The player never beats the trend — they demonstrably beat inaction. The ending is a mirror, not a verdict.
6. **Mini game discipline.** One screen, one persistent map, ~30–50 minutes of campaign, buildable by one developer in ~13–15 weeks.

---

## 2. Canon — the binding cross-document decisions

These resolve every contradiction found in design review. Each design doc restates the subset it depends on in a "Canon note" header.

### 2.1 Structure

- Campaign: **ten seasons — 2026, 2030, 2035, 2040, 2045, 2050, 2055, 2060, 2065, 2070**. Season = one level, 3–5 minutes (finale ~6–8). Between consecutive seasons, 4–5 real years pass; a brief interstitial card ("the years between") summarizes them. Each played season is framed as the *worst* season of its half-decade — records, not averages, which is how climate change is actually experienced.
- **One persistent world** for the whole campaign (60×40 tiles, 1 tile = 1 ha, curated seed). Each season is played on a centered **sector** of it — 44×30 in 2026, widened by the department every two seasons until the full 60×40 is yours by 2065. Seasons are ignition/weather scripts over the same world; scars accumulate on it regardless of the current sector — the map stays the campaign's diary. Burn scars regrow across the multi-year gaps; some high-severity dense burns convert permanently to grassland, plainly visible by 2060.
- Simulation: probabilistic cellular automaton, square grid, Moore 8-neighbourhood, double-buffered, **fixed 800 ms ticks** (1.25 Hz), seeded PRNG, pure `step(state) → state` core. Real-time render at 60 fps; tactical pause + 2× fast-forward only.
- All tunables live in a single `balance.ts`; every fact lives in a sourced `facts.json`.

### 2.2 The season table (canonical)

| Season | Type | New tool (granted free) | Metric revealed | Signature beat |
|---|---|---|---|---|
| 2026 | Tutorial | Fire trucks ×2 | **Burnt hectares** | Fire called in ≤5 s of season start; no prep phase; one scripted wind shift |
| 2030 | Ordinary | Water bomber ×1 | **Animals killed** | Air power arrives from beyond the valley |
| 2035 | **SPIKE — The Long Drought** | Evacuation orders | **Houses lost** | Homes join the counter; the first evacuation decision |
| 2040 | Ordinary | Watch towers | — | An undetected ignition grows for 7 s as a distant smoke column |
| 2045 | **SPIKE — The Heat Dome** | — | **Firefighters lost** (revealed at zero, scripted near-miss) | Ember spotting + crew danger rule activate |
| 2050 | Ordinary | Fire crews / controlled burns | **Population lost** | The WUI district is complete: decades of new houses inside the forest edge |
| 2055 | **SPIKE — The Early Season** | 2nd water bomber | — | Season opens with 2 fires already burning; first night windows |
| 2060 | Ordinary (elevated) | — | — | Mid-season relief rains disappear from the forecast for good; permanent conversion visible |
| 2065 | **SPIKE — The Interface** | — | — | Ember storm into the WUI; convoy evacuation set piece |
| 2070 | **Finale — The Firestorm** | — | Retrospective dashboard | Pyrocumulonimbus event, wind reversal, everything at once |

Reveal rule: each metric is *scheduled* to its season and *triggered* by the first qualifying event, which the scenario guarantees. If the loss somehow occurs earlier (requires ignoring the game), the reveal simply happens early — the schedule is a guarantee, not a gate. No metric ever affects budget or endings before it has been revealed.

### 2.3 Failure & endings

- **No game over, no replay prompt, no stars, no letter grades — ever.** A season always ends when the autumn rains arrive (later each half-decade: the season timer *is* the rains). Whatever still burns at rain-fall takes what it can in a fast-forward montage.
- Losses carry forward across the gaps: map scars (less habitat, but also less fuel — reality's partial self-correction; scars regrow over several seasons), budget penalties (with a guaranteed minimum-viable floor so the campaign is never mathematically lost), and a hidden 15 % damping of the next spike after a catastrophic season (fiction: "a mild La Niña year").
- A **Stewardship Score** is computed internally per season (see gameplay doc §6) — it drives the budget bonus and the ending's narrative variants. It is never shown as a score.
- Endings: **"The Long Defense"** (campaign completed — zoom-out over the scarred map, cumulative tallies, birdsong only over what stayed green) and **"The Year the Line Broke"** (every village lost — early ending, failure written as history, no "GAME OVER" text). Both include the **do-nothing comparison**: the same 44 years re-simulated with no player input — "Your actions saved 4,120 ha, 213 homes, 61 lives" (real numbers from the player's seeds).
- Final awareness screen: *"This forest is invented. The trend is not."* → Learn / Prepare / Act columns with real external resources, plus every fact's citation. Then the title screen, restored to green 2026.

### 2.4 Mechanics rulings (from adversarial review)

- **Firefighter deaths are deterministic, never dice.** A threatened truck/crew auto-retreats after a 3-tick radio-warning grace period; it is lost only if no safe path exists. The destruction clause is disabled before 2045 (pre-spotting fire intensities can't produce entrapment).
- **Evacuation mortality scales with warning time** (from ~35 % of un-evacuated occupants at zero warning down to ~5 % with a full evacuation window; 0 % once cleared) — never a flat rate. Watch-tower detection extends warning time; that is the tower's human payoff.
- **Over-evacuation costs preparedness, not points:** a village evacuated without ever being threatened lowers a single hidden preparedness scalar (future evacuations run slower). It recovers over years. No "crying wolf" score penalty.
- **Unlock-season tools arrive free** ("reassigned to your sector"); budget buys extras, repairs and placements. The 2026 trucks are free the same way.
- Truck numbers are derived so the tuning invariant *one truck ≈ one grass front, visibly less than one forest front* actually holds (see gameplay doc §4.2).
- 2026 has **no prep phase** and an immediate fire; prep phases begin in 2030 with the budget's first appearance.
- "Night" is a scripted 60-tick modifier window (spread barely calms, detection halves), not a diurnal cycle. The 2065 convoy is a reskinned evacuation timer on existing road cells, not a new entity type.
- Pre-authored firebreaks exist on the map from the start; *cutting* firebreaks requires the 2050 fire-crew unlock.

### 2.5 Cut to post-1.0 (recorded, not designed further)

Public-trust system · community programs · smoke-health stat · full diurnal cycle · additional late-century seasons (community adaptation, regeneration failure) · three-tier ending texts · interactive 2070→2100 emissions slider (v1 ships a static two-panel comparison on the awareness screen) · daily-challenge seed mode · season-select replay · additional locales · PWA/offline.

### 2.6 Tech stack (summary; full rationale in tech-stack doc)

**PixiJS v8** (terrain baked to a RenderTexture; particle fire/smoke) · **TypeScript strict** · **Vite** · **Biome** · **Vitest** for the sim core plus **headless bot-policy balance tests** · vanilla-TS HTML/CSS overlay for HUD, dialogs, reports · **Howler.js** with one global ambience crossfade driven by burnt-map fraction (plus a mute over scar tiles) · Kenney CC0 art tracked in an `ASSETS.md` license manifest · versioned localStorage saves · **GitHub Pages via GitHub Actions** · zero analytics at 1.0 · MIT license. UI says **"water bomber"** ("Canadair" is a trademark; the word appears only as informal flavour, if at all).

---

## 3. Milestones

Sized for a solo developer / tiny team; every milestone ends with a playable build on a public URL. ~13–15 weeks to 1.0.

**M0 — Foundations (1 week).** Repo scaffolding, Vite + TS strict + Biome + Vitest, CI → GitHub Pages, seeded PRNG, grid/`GameState` types, `balance.ts` skeleton, fixed-tick `step()` loop, headless Node sim runner, flat-colour quad renderer (no Pixi yet), command queue + event bus stubs, `ASSETS.md` + `facts.json` files created.
*DoD:* golden-master determinism test green in CI; a seeded fire visibly spreads in the browser; deploy pipeline produces a public URL.

**M1 — Playable toy (2 weeks).** Full spread model (wind, dryness, fuel types, wet state), the persistent authored-seed map with villages/roads/water, fire truck (move, extinguish, water, refill, pre-wet), pause/1×/2×, hectares counter, season timer ending in rains, minimal year-end tally. Pixi introduced; terrain baked.
*DoD:* a complete 3-minute "2026" playable start to finish; every number tunable from `balance.ts` without code edits; one outsider contains the fire unaided; bot-invariant harness runs (do-nothing loses the valley, naive play saves it).

**M2 — Vertical slice: seasons 2026–2035 (3 weeks).** Budget + prep phase (from 2030), briefing/debrief screens with "the years between" interstitials, evacuation orders with warning-time casualty rules, water bomber, reveal moments for animals + houses (auto-pause, slot fill, first-time tooltip), inter-season regrowth, localStorage save/continue, campaign timeline screen, first audio pass (ambient loop + ~6 SFX), Kenney art pass, touch controls.
*DoD:* the three-season slice completable on desktop and the reference Android phone; first structured external playtest (5 players) done and written up; all strings externalized; `ASSETS.md` complete.

**M3 — Full campaign (3–4 weeks).** Watch towers + detection, ember spotting, crew danger rule + memorial cards, fire crews/controlled burns, night-window modifier, all ten seasons of the balance table + scripted spike events, era palette + smoke-haze progression, endings + do-nothing comparison + awareness screen, facts wired from `facts.json`.
*DoD:* full 2026–2070 campaign completable; all four tuning invariants (gameplay doc §7.2) pass as automated headless tests across 20 seeds; CVD screenshot pass done; reduced-motion and keyboard play verified; all content passes the dread-rules checklist (ux doc §3.5).

**M4 — Balance, polish, verification (2–3 weeks).** 2–3 rounds of external playtests (5–8 players) driving `balance.ts`-only tuning; juice pass ("agency gets all of it"); accessibility checklist closed; fact-verification pass (every fact re-checked against its source, access dates recorded); performance pass on the Tier-1 browser matrix; assist-mode decision executed; save-migration test.
*DoD:* ≥ 80 % of first-time testers complete the first three seasons (2026–2035) unaided; median campaign playtime 30–50 min; 60 fps on the reference phone; zero unverified facts; accessibility checklist 100 %.

**M5 — Release (1 week).** v1.0 tag, GitHub Pages (+ optional itch.io mirror), in-game privacy note (none needed if analytics stay at zero), press/awareness kit (3 screenshots, 1 GIF, 100-word blurb), credits + sources page, final license sweep, post-1.0 backlog file.
*DoD:* public URL live on all Tier-1 browsers; README documents build & deploy.

---

## 4. Playtesting & balancing process

1. **Automated, headless, in CI.** The sim is pure and deterministic, so balance is testable: run N seeds × scripted bot policies (do-nothing / naive / competent) per season and assert the tuning invariants as executable tests (e.g. "2026 do-nothing loses the valley; 2026 naive bot saves it", "a tower-covered ignition burns ≤ 55 % of an uncovered one"). This is the antidote to tuning hell.
2. **Weekly human playtests from M2.** 3–5 external players, 30 min, think-aloud, standard sheet (confusion points, boredom points, per-year losses, quit point). PR preview URLs (Netlify/Cloudflare) make every balance branch playable via link.
3. **Balance changes touch only `balance.ts`**, which carries a `balanceVersion`; every build shows `(mapSeed, balanceVersion)` in its corner so reports reproduce.

---

## 5. Risk register

| Risk | Mitigation |
|---|---|
| **Sim tuning hell** (highest) | Headless bot-invariant tests in CI; one master difficulty lever (`t`); hard rule that tuning edits `balance.ts` only, never sim code |
| **Scope creep** | Written post-1.0 backlog (§2.5) so cuts feel deferred, not killed; slope factor and night visuals are pre-declared first cuts |
| **Mobile performance** | Baked terrain, particle cap, DPR cap from M1; weekly test on the reference device, not at the end |
| **Emotional content lands wrong** (preachy or exploitative) | Dread rules + anti-preachiness guardrails (ux doc §3.5, §5.3) applied as a checklist to every content PR; one outside sensitivity read of memorial/civilian-loss content before release |
| **Fact errors in an awareness game** | Every fact in `facts.json` with source URL + access date; a dedicated re-verification pass is an M4 release gate |
| **Determinism drift** | Seeded PRNG only, no `Date.now()`/`Math.random()` in sim; golden-master test in CI on Node + one browser run |
| **Solo-dev burnout / bus factor** | Milestones ≤ 4 weeks, each ending in a playable public build |

---

## 6. Delivery standards

- **Localization:** English-only at 1.0, localization-ready from day one — all strings in one keyed file, no text baked into art, `Intl` number formatting. FR/ES are the first post-1.0 candidates (Mediterranean fire-prone audiences); each locale is a content project (facts re-verified per locale), not a translation file.
- **Licensing:** repo MIT. Every asset recorded in `ASSETS.md` (file, source URL, license, author, date). Fonts self-hosted via `@fontsource` (OFL). "Water bomber" in UI (trademark caution); no real agency logos/liveries; real disasters (Paradise, Lytton, Yarnell) appear only in sourced fact cards, never as playable content.
- **Analytics:** none at 1.0. If awareness-campaign metrics are ever needed: cookieless (Plausible/GoatCounter), ≤ 6 events, no per-player identifiers, documented in-game.
- **Browser matrix:** Tier 1 (tested weekly): latest Chrome desktop, latest iOS Safari, Chrome on a mid-range ~2-year-old Android (the perf reference device). Tier 2 (tested at milestones): Firefox, Edge, Safari macOS, iPadOS. Minimum viewport 360×640. Friendly fallback card for unsupported browsers.
- **Saves:** versioned localStorage blob with a migration switch from day one; saves migrate forward across all 1.x.
- **Versioning:** tagged releases; `balanceVersion` bumps with any tuning change; changelog in-repo.

---

## 7. Document map

| Doc | Owns |
|---|---|
| [`design/gameplay.md`](design/gameplay.md) | Sim model & formulas, map model, units & actions, economy, internal scoring, balance levers, tuning invariants |
| [`design/progression.md`](design/progression.md) | Year-by-year campaign, climate difficulty model & real-world grounding, unlock rationale, metric derivations, consequence & ending model, facts table |
| [`design/ux.md`](design/ux.md) | Screens & HUD, progressive disclosure, art/audio direction, dread rules, readability & accessibility, awareness messaging |
| [`design/tech-stack.md`](design/tech-stack.md) | Stack choices & rationale, architecture & module tree, performance rules, CI/deploy |
| [`DECISIONS.md`](DECISIONS.md) | Open questions awaiting a decision |
