# Tech Stack Proposal & Architecture

> **Canon note** (binding, from [`../PLAN.md`](../PLAN.md) §2): sim runs at **800 ms fixed ticks** (1.25 Hz) on a **60×40** world (only the season's centered sector is active) — the sim is cheap by construction; rendering is the only performance concern · balance lives in `balance.ts`, facts in `facts.json` · audio scope is one global ambience crossfade + scar-tile mute · zero analytics at 1.0 · MIT license, CC0 assets tracked in `ASSETS.md`.

> **Reality check (July 2026, shipped game):** the renderer is **plain Canvas 2D with
> zero runtime dependencies** — PixiJS was never needed at this scale, and Howler/audio
> was cut entirely. Strings (including the sourced facts) live in `src/ui/i18n.ts` and
> `src/ui/facts.ts` as typed en/fr catalogs rather than `facts.json`. "Zero analytics"
> was superseded at the owner's request: the site loads GA4 (gtag.js) for pageviews and
> a small set of progression events wired in `src/game/analytics.ts`. The architecture
> section's deterministic sim/command/event contract shipped as specified.

## Recommended stack at a glance

| Concern | Choice |
|---|---|
| Rendering | **PixiJS v8** (WebGL/WebGPU canvas world layer) |
| Language | **TypeScript** (`strict: true`) |
| Build | **Vite** |
| Lint/format | **Biome** (single tool) |
| Tests | **Vitest** — simulation core + headless balance bots |
| Sim architecture | Pure deterministic core, fixed timestep, seeded RNG, command queue in / event bus out |
| UI overlays | **HTML/CSS over the canvas, vanilla TS** (Preact acceptable if preferred) |
| Art | **Kenney CC0 tilesets** + procedural fire/smoke particles |
| Audio | **Howler.js**, CC0 SFX |
| Persistence | **localStorage**, versioned JSON |
| Hosting/CI | **GitHub Pages via GitHub Actions**, no backend |

---

## 1. Rendering

Needs: a 60×40 tile world (rendered as the season's sector), an animated fire front with smoke/glow, a modest number of moving sprites (trucks, the water bomber, towers), and screen-space UI. All options can technically do this; the differences are effort, "juice," and lock-in.

| Option | Fit | Notes |
|---|---|---|
| DOM/SVG | Poor | Thousands of animated nodes jank, especially on mobile. Fine for the HUD, wrong for the world. |
| Plain Canvas 2D | Good | Sufficient for this grid if terrain is baked offscreen and only burning cells redraw. Zero dependencies. Weakness: additive blending, tinting, and glow get hand-rolled and fiddly. |
| **PixiJS v8** | **Best fit** | A renderer, not a framework: sprite batching, tinting, additive blending, particle containers, render textures — exactly the tools for fire glow, smoke, and heat shimmer. Imposes nothing on architecture, so the sim/render split stays clean. ~100–150 KB gzipped. |
| Phaser 3/4 | Workable but heavy | Batteries included, but its GameObject/scene lifecycle fights the pure-sim-core architecture, and we need no physics. |
| Kaplay | Not recommended | Fun API, younger project with churn history (kaboom → kaplay); risky as a founding dependency. |

**Recommendation: PixiJS v8.** The game's emotional payload — dread, spreading fire, smoke over villages — lives in visual effects; Pixi makes them cheap to build and cheap to run while staying a library, not a framework.

**When to deviate:** if the aesthetic is cut to flat-colour minimalism (coloured squares, no particles), drop to plain Canvas 2D and delete the dependency — the architecture below doesn't change at all, which is deliberate. If the sole developer already knows Phaser well, it is acceptable; keep the sim core outside Phaser's scene objects regardless.

---

## 2. Language & tooling

- **TypeScript, `strict: true`.** Grid indices, cell states, and per-season difficulty params are exactly the code where a type system pays for itself immediately. The `GameState` and event payload types double as the de facto contract between sim and UI.
- **Vite.** Instant dev server, trivial static build, zero config worth mentioning.
- **Biome** for lint + format — one fast tool, one config file.
- **Vitest.** **Test the simulation, not the game:**
  - *Unit-test:* spread rules (wind, dryness, fuel types), determinism (same seed ⇒ identical end state), per-season difficulty application, inter-season regrowth, stat accumulation (hectares, animals, houses, casualties), evacuation warning-time mortality, suppression effects, save migration.
  - *Bot-policy balance tests:* headless runs of scripted policies (do-nothing / naive / competent) across N seeds, asserting the tuning invariants ([`gameplay.md`](gameplay.md) §7.2) — this is the antidote to tuning hell and runs in CI.
  - *Do not over-test:* rendering, particles, tweens, DOM overlays, audio. Verified by playing; canvas snapshots are a maintenance tax with near-zero defect yield here.
  - Determinism makes golden-master tests trivial: run seed `X` for `N` ticks with a scripted command list, assert on the final stats object.

---

## 3. Architecture

**Core principle: the simulation is a pure, deterministic, renderer-agnostic TypeScript module.** It never imports Pixi, never touches the DOM, never calls `Math.random()` or `Date.now()`.

- **Fixed timestep.** Sim ticks at 800 ms (canon); the render loop runs at display rate and interpolates sprite positions between ticks. Classic accumulator loop.
- **Seeded RNG.** One small PRNG (mulberry32-class, ~10 lines), seeded per campaign. Same seed + same player commands ⇒ same outcome: reproducible bug reports, testable balance, the do-nothing comparison sim for free — and a "daily challenge" mode later, if ever wanted.
- **Input as commands, output as events.**
  - *UI → sim:* player actions (`DeployTruck{cell}`, `EvacuateVillage{id}`, `DispatchBomber{line}`) push onto a **command queue**, applied only at tick boundaries — determinism preserved, click handling decoupled from sim timing.
  - *Sim → presentation:* the sim emits **typed events** on a tiny event bus (~30 lines, no library): `FireIgnited`, `FireDetected`, `CellBurnt`, `HouseLost`, `AnimalCasualties`, `CrewWarning`, `CrewLost`, `YearEnded{report}`. Renderer, HUD, and audio subscribe independently. This makes the progressive-disclosure requirement clean: the sim always tracks everything; the HUD simply starts listening/rendering a stat at its reveal.
  - Direct calls are fine *within* a layer; the bus exists only at the sim/presentation boundary. No message-passing religion.
- **State:** one plain `GameState` owned by the sim (grid, entities, weather, stats, year). The renderer reads it read-only each frame. No Redux/MobX/Zustand — a single authoritative sim loop needs discipline about who writes state (only `step()`), not a state library.
- **Persistence:** localStorage, one versioned JSON blob (`{ version, year, mapState, ownedUnits, stats, settings }`), written on year-end and `visibilitychange`. A 20-line migration switch on `version` from day one — cheaper than regret. No accounts, no backend.

**Module tree:**

```
src/
  sim/                  # pure, deterministic, zero deps — the tested core
    state.ts            # GameState, Cell, Entity types
    step.ts             # fixed-timestep update: spread, units, stats
    fire.ts             # ignition & spread model (wind, dryness, fuel)
    units.ts            # trucks, bombers, towers, crews, evacuation logic
    scenario.ts         # per-season scripts: ignitions, spikes, events, interstitials
    balance.ts          # every tunable (versioned)
    rng.ts              # seeded PRNG
    commands.ts         # command types + queue
    events.ts           # typed event definitions + emitter
  render/               # Pixi only; reads state, listens to events
    app.ts              # bootstrap, layers, resize
    terrain.ts          # baked tile layer + dirty-cell updates
    firefx.ts           # fire/smoke/glow particles
    entities.ts         # unit sprites + interpolation
  ui/                   # DOM overlay: HUD, dialogs, reports
    hud.ts
    briefing.ts
    report.ts
    unlocks.ts          # progressive reveal of stats/tools
  audio/
    sound.ts            # Howler wrapper, event-driven
  game/
    loop.ts             # accumulator loop wiring sim ↔ render
    save.ts             # persistence + migration
    main.ts
assets/                 # tracked in /ASSETS.md manifest
data/
  facts.json            # sourced climate facts
  strings.json          # all user-facing text (localization-ready)
tests/                  # Vitest: src/sim only + bot harness
```

---

## 4. UI layer

**Hybrid, with a hard boundary: world-space = canvas, screen-space = HTML/CSS.**

- **Canvas (Pixi):** map, fire, smoke, unit sprites, in-world markers (evacuation outlines, tower radii, spread cones). Anything that pans/zooms with the map.
- **HTML/CSS overlay:** stat counters and their reveal animations, the tool palette, tooltips, pause/settings, and especially the **year-end report and briefings** — text-heavy screens that want real typography, wrapping, CSS transitions, and accessibility. The slow, grim roll-up of a year's losses is a typography moment; CSS does it better and cheaper than any canvas text solution.

**Framework: vanilla TS, recommended.** The overlay is a handful of counters and three dialog templates; a 20-line `el()` helper plus event-bus subscriptions covers it. **Deviate to Preact (~4 KB)** only if report screens grow branching content and the developer is faster in JSX — confined strictly to `src/ui/`. **No React** (weight and ceremony unjustified), and no framework adopted "for later."

---

## 5. Assets

Producible by a small team with no dedicated artist:

- **Tiles & sprites: Kenney CC0 packs** — proven, coherent, license-clean (map/town-style tiles for forest, fields, roads, houses; vehicle sprites recoloured for trucks and the bomber; particle packs for effects). Recolour in Aseprite/Piskel to unify the palette. Alternatives: other CC0 packs on itch.io/OpenGameArt (verify license per pack). Every asset recorded in `ASSETS.md` (file, source URL, license, author, date) — a release gate.
- **Fire and smoke: procedural, not sprite sheets.** Tinted soft-circle particles with additive blending (fire) and alpha-faded grey puffs (smoke) look better than any free animated sheet, scale with intensity, and cost zero art time. Burnt cells are a tile tint/swap.
- **Audio: Howler.js** over raw WebAudio — mobile unlock, SFX sprites, pooling, and volume groups in 7 KB. SFX from CC0 packs + jsfxr one-offs; ambience is **one cross-faded loop pair** driven by burnt-map fraction, plus the scar-tile mute (ux doc §3.3). Total audio < 2 MB.
- **Fonts:** two self-hosted families via `@fontsource` (OFL; recorded in `ASSETS.md`): one clean UI face for HUD/reports, one display face for title/year cards. Self-hosting matters: the deployment must make zero third-party runtime requests.

---

## 6. Performance

Target: **60 fps render on a mid-range phone**; the 1.25 Hz sim over ≤2,400 cells is trivial. The only ways to lose 60 fps are self-inflicted:

- **Bake the terrain.** Render all static tiles once per season into a `RenderTexture` (one draw call thereafter); update only burning/burnt cells (the fire front is a small subset). The single most important optimization.
- **Batch particles.** Fire/smoke via `ParticleContainer` with a pooled array — hundreds of particles, one draw call. Cap the budget (~500) and degrade count, never frame rate.
- **No per-frame allocation** in the loop: pool particles and event objects, reuse vectors; update DOM counters only when a stat changes (the event bus gives this for free).
- **Cheap:** tile tints, sprite movement, alpha fades, the whole sim tick. **Expensive:** full-map redraws, Pixi filters (use one subtle glow at most, or none), canvas-rendered text, uncapped `devicePixelRatio` (cap at 2).
- **Mobile: designed-for, not ported-to.** The verbs (tap a cell, tap a village) are inherently touch-friendly. Pointer Events only; 44 px hit targets; pinch/drag pan-zoom; `visibilitychange` pauses the sim. Test on the reference Android weekly, not at the end.

---

## 7. Deployment

- **Static hosting, no backend** — HTML/JS/assets plus localStorage. Nothing to run, secure, or pay for.
- **GitHub Pages** deployed by **GitHub Actions**: push to `main` → `npm ci` → `vitest run` (sim + bot invariants gate the deploy) → `vite build` → `upload-pages-artifact` → `deploy-pages`. Vite `base` set to the repo path. ~30-line workflow.
- **Netlify/Cloudflare Pages as alternative** if PR preview deploys prove valuable for playtesting balance branches (their one concrete advantage here — and the playtesting process in PLAN §4 wants them).
- Vite's content-hashed filenames handle cache-busting; long-cache assets, no-cache `index.html`.
- **Analytics: none** (PLAN §6).

**Explicitly out of scope:** backend, accounts, leaderboards (a seed-based daily challenge with local best is the no-backend substitute if ever wanted), service workers/PWA in v1.
