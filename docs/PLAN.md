# Global Fire — Master Plan

*Founding document. Everything in `docs/design/` elaborates a section of this plan; where any detail disagrees, the **Canon** section below wins.*

---

## 1. Vision

An interactive JavaScript mini game that creates awareness about global warming and forest fires — not by telling the player the climate is changing, but by making them the person responsible for a valley while it does.

**One paragraph:** The player commands the fire service of a single forested valley with a few villages. The campaign runs ten fire seasons, 2026–2035, each 3–5 minutes. 2026 is easy — one slow fire, two trucks. Each year, climate-driven parameters (fuel dryness, wind, ignition count, season length) ratchet up; every second year a named spike event lands ("The Long Drought", "The Heat Dome", "The Firestorm"). The player progressively unlocks firefighting tools — evacuation orders, a water bomber, watch towers, fire crews and controlled burns — and the interface progressively reveals the cost: burnt hectares, then animals killed, houses lost, firefighters dead, and finally civilian lives. There is no game over and no score screen; there is a persistent map that scars, a budget that tightens, and an ending that compares the player's decade to a simulation of doing nothing.

### Design pillars

1. **The simulation is the argument.** Real climate trends, compressed ~3× for playability, drive one master difficulty lever. Facts annotate what the player just lived; they never lecture.
2. **Unlock in calm, test in crisis.** Every tool is taught in an ordinary year and examined by the next spike year.
3. **The interface is the narrative.** The HUD grows heavier over the campaign; each new loss counter is a story beat, staged with care (auto-pause, silence, one plain sentence).
4. **Dread, responsibly.** No gore, no depicted suffering, no spectacle for destruction. Numbers and absence. Destruction gets zero juice; player agency gets all of it.
5. **Agency, not doom.** The player never beats the trend — they demonstrably beat inaction. The ending is a mirror, not a verdict.
6. **Mini game discipline.** One screen, one persistent map, ~30–50 minutes of campaign, buildable by one developer in ~13–15 weeks.

---

## 2. Canon — the binding cross-document decisions

These resolve every contradiction found in design review. Each design doc restates the subset it depends on in a "Canon note" header.

### 2.1 Structure

- Campaign: **10 years, 2026–2035**. Year = one level, 3–5 minutes (finale ~6–8).
- **One persistent map** for the whole campaign (48×32 tiles, 1 tile = 1 ha, curated seed). Years are ignition/weather scripts over the same map. Burn scars persist and regrow slowly; some high-severity burns convert permanently to shrubland.
- Simulation: probabilistic cellular automaton, square grid, Moore 8-neighbourhood, double-buffered, **fixed 2 Hz ticks** (500 ms), seeded PRNG, pure `step(state) → state` core. Real-time render at 60 fps; tactical pause + 2× fast-forward only.
- All tunables live in a single `balance.ts`; every fact lives in a sourced `facts.json`.

### 2.2 The year table (canonical)

| Year | Type | New tool (granted free) | Metric revealed | Signature beat |
|---|---|---|---|---|
| 2026 | Tutorial | Fire trucks ×2 | **Burnt hectares** | Fire called in ≤5 s of season start; no prep phase; one scripted wind shift |
| 2027 | Ordinary | Evacuation orders | **Animals killed** | A fire drifts toward an outlying hamlet — first evacuation decision |
| 2028 | **SPIKE — The Long Drought** | Water bomber ×1 | **Houses lost** | Two simultaneous fires; wildlife concentrated at shrinking waterholes |
| 2029 | Ordinary | Watch towers | — | An undetected ignition grows for 7 s as a distant smoke column |
| 2030 | **SPIKE — The Heat Dome** | — | **Firefighters lost** (revealed at zero, scripted near-miss) | Ember spotting + crew danger rule activate |
| 2031 | Ordinary | Fire crews / controlled burns | **Population lost** | WUI map change: new houses built inside the forest edge |
| 2032 | **SPIKE — The Early Season** | 2nd water bomber purchasable | — | Season opens with 2 fires already burning; first night windows |
| 2033 | Ordinary (elevated) | — | — | Mid-season relief rains disappear from the forecast for good |
| 2034 | **SPIKE — The Interface** | — | — | Ember storm into the WUI; convoy evacuation set piece |
| 2035 | **Finale — The Firestorm** | — | Retrospective dashboard | Pyrocumulonimbus event, wind reversal, everything at once |

Reveal rule: each metric is *scheduled* to its year and *triggered* by the first qualifying event, which the scenario guarantees. If the loss somehow occurs earlier (requires ignoring the game), the reveal simply happens early — the schedule is a guarantee, not a gate. No metric ever affects budget or endings before it has been revealed.

### 2.3 Failure & endings

- **No game over, no replay prompt, no stars, no letter grades — ever.** A season always ends when the autumn rains arrive (later each year: the season timer *is* the rains). Whatever still burns at rain-fall takes what it can in a fast-forward montage.
- Losses carry forward: map scars (less habitat, but also less fuel — reality's partial self-correction), budget penalties (with a guaranteed minimum-viable floor so the campaign is never mathematically lost), and a hidden 15 % damping of the next spike after a catastrophic year (fiction: "a mild La Niña year").
- A **Stewardship Score** is computed internally per year (see gameplay doc §6) — it drives the budget bonus and the ending's narrative variants. It is never shown as a score.
- Endings: **"The Long Defense"** (campaign completed — zoom-out over the scarred map, cumulative tallies, birdsong only over what stayed green) and **"The Year the Line Broke"** (every village lost — early ending, failure written as history, no "GAME OVER" text). Both include the **do-nothing comparison**: the same decade re-simulated with no player input — "Your actions saved 4,120 ha, 213 homes, 61 lives" (real numbers from the player's seeds).
- Final awareness screen: *"This forest is invented. The trend is not."* → Learn / Prepare / Act columns with real external resources, plus every fact's citation. Then the title screen, restored to green 2026.

### 2.4 Mechanics rulings (from adversarial review)

- **Firefighter deaths are deterministic, never dice.** A threatened truck/crew auto-retreats after a 3-tick radio-warning grace period; it is lost only if no safe path exists. The destruction clause is disabled before 2030 (pre-spotting fire intensities can't produce entrapment).
- **Evacuation mortality scales with warning time** (from ~35 % of un-evacuated occupants at zero warning down to ~5 % with a full evacuation window; 0 % once cleared) — never a flat rate. Watch-tower detection extends warning time; that is the tower's human payoff.
- **Over-evacuation costs preparedness, not points:** a village evacuated without ever being threatened lowers a single hidden preparedness scalar (future evacuations run slower). It recovers over years. No "crying wolf" score penalty.
- **Unlock-year tools arrive free** ("reassigned to your sector"); budget buys extras, repairs and placements. The 2026 trucks are free the same way.
- Truck numbers are derived so the tuning invariant *one truck ≈ one grass front, visibly less than one forest front* actually holds (see gameplay doc §4.2).
- 2026 has **no prep phase** and an immediate fire; prep phases begin in 2027 with the budget's first appearance.
- "Night" is a scripted 60-tick modifier window (spread barely calms, detection halves), not a diurnal cycle. The 2034 convoy is a reskinned evacuation timer on existing road cells, not a new entity type.
- Pre-authored firebreaks exist on the map from the start; *cutting* firebreaks requires the 2031 fire-crew unlock.

### 2.5 Cut to post-1.0 (recorded, not designed further)

Public-trust system · community programs · smoke-health stat · full diurnal cycle · 2036–2040 campaign extension (community adaptation year, regeneration-failure year) · three-tier ending texts · interactive 2040→2100 emissions slider (v1 ships a static two-panel comparison on the awareness screen) · daily-challenge seed mode · year-select replay · additional locales · PWA/offline.

### 2.6 Tech stack (summary; full rationale in tech-stack doc)

**PixiJS v8** (terrain baked to a RenderTexture; particle fire/smoke) · **TypeScript strict** · **Vite** · **Biome** · **Vitest** for the sim core plus **headless bot-policy balance tests** · vanilla-TS HTML/CSS overlay for HUD, dialogs, reports · **Howler.js** with one global ambience crossfade driven by burnt-map fraction (plus a mute over scar tiles) · Kenney CC0 art tracked in an `ASSETS.md` license manifest · versioned localStorage saves · **GitHub Pages via GitHub Actions** · zero analytics at 1.0 · MIT license. UI says **"water bomber"** ("Canadair" is a trademark; the word appears only as informal flavour, if at all).

---

## 3. Milestones

Sized for a solo developer / tiny team; every milestone ends with a playable build on a public URL. ~13–15 weeks to 1.0.

**M0 — Foundations (1 week).** Repo scaffolding, Vite + TS strict + Biome + Vitest, CI → GitHub Pages, seeded PRNG, grid/`GameState` types, `balance.ts` skeleton, fixed-tick `step()` loop, headless Node sim runner, flat-colour quad renderer (no Pixi yet), command queue + event bus stubs, `ASSETS.md` + `facts.json` files created.
*DoD:* golden-master determinism test green in CI; a seeded fire visibly spreads in the browser; deploy pipeline produces a public URL.

**M1 — Playable toy (2 weeks).** Full spread model (wind, dryness, fuel types, wet state), the persistent authored-seed map with villages/roads/water, fire truck (move, extinguish, water, refill, pre-wet), pause/1×/2×, hectares counter, season timer ending in rains, minimal year-end tally. Pixi introduced; terrain baked.
*DoD:* a complete 3-minute "2026" playable start to finish; every number tunable from `balance.ts` without code edits; one outsider contains the fire unaided; bot-invariant harness runs (do-nothing loses the valley, naive play saves it).

**M2 — Vertical slice: 2026–2028 (3 weeks).** Budget + prep phase (from 2027), briefing/debrief screens, evacuation orders with warning-time casualty rules, water bomber, reveal moments for animals + houses (auto-pause, slot fill, first-time tooltip), localStorage save/continue, campaign timeline screen, first audio pass (ambient loop + ~6 SFX), Kenney art pass, touch controls.
*DoD:* the 3-year slice completable on desktop and the reference Android phone; first structured external playtest (5 players) done and written up; all strings externalized; `ASSETS.md` complete.

**M3 — Full campaign (3–4 weeks).** Watch towers + detection, ember spotting, crew danger rule + memorial cards, fire crews/controlled burns, night-window modifier, all 10 years of the balance table + scripted spike events, era palette + smoke-haze progression, endings + do-nothing comparison + awareness screen, facts wired from `facts.json`.
*DoD:* full 2026–2035 campaign completable; all four tuning invariants (gameplay doc §7.2) pass as automated headless tests across 20 seeds; CVD screenshot pass done; reduced-motion and keyboard play verified; all content passes the dread-rules checklist (ux doc §3.5).

**M4 — Balance, polish, verification (2–3 weeks).** 2–3 rounds of external playtests (5–8 players) driving `balance.ts`-only tuning; juice pass ("agency gets all of it"); accessibility checklist closed; fact-verification pass (every fact re-checked against its source, access dates recorded); performance pass on the Tier-1 browser matrix; assist-mode decision executed; save-migration test.
*DoD:* ≥ 80 % of first-time testers complete 2026–2028 unaided; median campaign playtime 30–50 min; 60 fps on the reference phone; zero unverified facts; accessibility checklist 100 %.

**M5 — Release (1 week).** v1.0 tag, GitHub Pages (+ optional itch.io mirror), in-game privacy note (none needed if analytics stay at zero), press/awareness kit (3 screenshots, 1 GIF, 100-word blurb), credits + sources page, final license sweep, post-1.0 backlog file.
*DoD:* public URL live on all Tier-1 browsers; README documents build & deploy.

---

## 4. Playtesting & balancing process

1. **Automated, headless, in CI.** The sim is pure and deterministic, so balance is testable: run N seeds × scripted bot policies (do-nothing / naive / competent) per year and assert the tuning invariants as executable tests (e.g. "2026 do-nothing loses the valley; 2026 naive bot saves it", "a tower-covered ignition burns ≤ 55 % of an uncovered one"). This is the antidote to tuning hell.
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
