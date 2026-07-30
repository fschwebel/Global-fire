# Open Decisions Log

Questions the plan deliberately leaves open, with the current recommendation where one exists. Decide each before (or during) the milestone noted. Once decided, record the decision and date here — this file is the project's memory.

| # | Decision | Options / notes | Recommendation | Decide by |
|---|---|---|---|---|
| 1 | **Game title** | "Global Fire" (repo name) vs. something evocative ("The Long Defense", "Fire Season", "2026–2070") | Keep *Global Fire* as working title; revisit at M4 with playtesters | M4 |
| 2 | **Fixed vs. dynamic start year** | Brief says start in 2026. If released in/after 2027, a dynamic "current year" start keeps the near-future framing; but fixed 2026 keeps facts/scripts aligned | Fixed 2026 — the authored facts and curve depend on it | M0 (settled unless argued) |
| 3 | **Assist mode** | A "story mode" toggle (spread ×0.8, mortality display unchanged) for accessibility and classroom use | **Yes** — cheap, aligns with the accessibility stance | M4 |
| 4 | **itch.io mirror** | GitHub Pages is primary; itch.io adds discoverability for an awareness title | Yes at M5 if free effort allows | M5 |
| 5 | **Year-select replay after completion** | Cheap longevity hook; risks diluting the "you can't undo a year" thesis on a first playthrough | Post-campaign unlock only (never mid-campaign) — currently in the post-1.0 backlog | M3 |
| 6 | **Elevation/slope system** | `slopeFactor` is specified but optional; adds terrain reading depth and art cost | Ship without it; it is the pre-declared first scope cut | M1 |
| 7 | **"Canadair" wording** | Trademark (De Havilland Canada). UI must say "water bomber"; may flavour text say "canadair" colloquially? | Avoid entirely; "water bomber" everywhere | M2 |
| 8 | **Second locale (FR/ES)** | Mediterranean audiences are a natural fit; each locale re-verifies facts | Post-1.0; keep strings/facts externalized from M0 | Post-1.0 |
| 9 | **Sensitivity reader** | One outside read of memorial/civilian-loss content before release | Yes — budget half a day at M4 | M4 |
| 10 | **Analytics** | Zero at 1.0 per plan. Revisit only if an awareness campaign partner needs reach numbers | Keep zero | Post-1.0 |
| 11 | **Press/awareness kit contents** | 3 screenshots, 1 GIF, 100-word blurb, teacher one-pager? | Include the teacher one-pager — classrooms are the highest-leverage audience | M5 |

## Decided (July 2026)

| # | Decision | Outcome |
|---|---|---|
| 8 | **Second locale (FR, then ES)** | **Shipped.** Full French and Spanish translations, auto-selected from the browser's language; strings live in a typed en/fr/es catalog (`src/ui/i18n.ts`, `src/ui/facts.ts`) where a missing translation is a compile error. Spanish reviewed by an independent localization pass (entrapment terminology, weather-vs-climate accuracy in the sourced facts). |
| 10 | **Analytics** | **Reversed by owner request.** GA4 (gtag.js, direct — the interim GTM container was retired) with pageviews plus progression events (`src/game/analytics.ts`): season funnel, campaign completion, unit losses, drought events, About-modal opens. |
| — | **Late-game difficulty** | **Canon: the late game is unwinnable by design** — the game's thesis, stated in-game (About modal, finale) and in the README ("Losing is the point"). Balance work may tune *how* it is lost, never whether. |
| — | **Renderer** | Plain Canvas 2D, zero runtime dependencies (PixiJS and Howler/audio cut — see tech-stack.md reality check). |
