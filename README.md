# Global Fire

**A browser mini game about forest fires in a warming world.**

You run the fire service of one forested valley. In 2026 the job is manageable: one fire, two trucks, a quiet summer. Then you return for one season every half-decade — 2030, 2035, and every five years to 2070 — and each time the climate has turned the dial by another half-decade of projected warming: drier fuel, harder wind, longer seasons, more ignitions. You unlock better tools (evacuation orders, water bombers, watch towers, fire crews), and they are never quite enough. The interface grows heavier with you: first you count burnt hectares, then animals, then houses — and eventually firefighters and people.

You cannot stop the trend. You decide what it costs.

## Status

**Planning.** This repository currently contains the founding design plan — no code yet. The plan formalizes the gameplay systems, the campaign and climate model, the UI/UX and emotional design, and the tech stack, and was produced through a multi-perspective design and critique process.

## The plan

| Document | Contents |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | **Start here.** Vision & pillars, canonical design decisions, milestones (M0–M5), playtesting process, risk register, scope cutlines |
| [`docs/design/gameplay.md`](docs/design/gameplay.md) | Formalized gameplay systems: fire simulation model, map, units, economy, scoring |
| [`docs/design/progression.md`](docs/design/progression.md) | The 2026–2070 season ladder, climate difficulty model, unlock & metric-reveal schedule, endings |
| [`docs/design/ux.md`](docs/design/ux.md) | UI/UX, progressive disclosure, emotional arc, art & audio direction, accessibility, awareness messaging |
| [`docs/design/tech-stack.md`](docs/design/tech-stack.md) | Tech stack proposal and architecture: PixiJS + TypeScript + Vite, deterministic sim core, CI/deploy |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Open questions log |

## The pitch in five design sentences

1. **The simulation is the argument.** A deterministic cellular-automaton fire sim played one season per half-decade, 2026–2070 — the climate ratchets between levels along mid-range projections, and the player *feels* the trend before any text states it.
2. **Unlock in calm, test in crisis.** New tools arrive in ordinary seasons; every other season a named spike event ("The Long Drought", "The Heat Dome", "The Firestorm") is the exam.
3. **The interface is the narrative.** The stat bar starts with one counter and faint empty slots; each new dread metric slides into a slot the player always knew was waiting.
4. **No game over, no grades.** A season always ends when the autumn rains come — later each half-decade. Losses are not a fail screen; they carry forward on a persistent map that scars and slowly regrows between seasons.
5. **Agency, not doom.** The ending compares the player's 44 years against a "do-nothing" simulation of the same seeds: you never beat the climate — you change what it could take.

## Planned stack (summary)

TypeScript (strict) · Vite · PixiJS v8 · vanilla HTML/CSS HUD overlay · Howler.js · Vitest (deterministic sim core + headless balance bots) · Biome · localStorage saves · GitHub Pages via GitHub Actions · no backend, no analytics · CC0 art (Kenney) · MIT license.

Full rationale in [`docs/design/tech-stack.md`](docs/design/tech-stack.md).
