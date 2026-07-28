# UI/UX & Emotional Design

> **Canon note** (binding, from [`../PLAN.md`](../PLAN.md) §2): campaign of ten seasons — 2026, 2030, then every five years to 2070; 4–5 real years pass between seasons · metric reveals: hectares 2026, animals 2030, houses 2035, firefighters 2045 (at zero), population 2050 · no stars, grades, or score displays anywhere · two endings ("The Long Defense", "The Year the Line Broke") + do-nothing comparison · audio budget: one global ambience crossfade + scar-tile mute (per tech-stack scope) · UI says **"water bomber"**, never "Canadair".
> **Reality check (July 2026, shipped game):** see the divergence list at the top of
> [`../PLAN.md`](../PLAN.md). Notably: no audio shipped at all, there is a single ending
> ("The Long Defense" finale), no auto-pause camera beats, and the game added a splash
> screen, an About-the-game modal, and full French localization. Where this document and the code
> disagree, the code and the root `README.md` win.

**Design thesis: the interface itself is the narrative.** The player never reads a story — they watch their own HUD grow heavier season after season. Every decision below serves one arc: **from stewardship to triage**. In 2026 the screen is calm, green, and mostly empty. By 2070 the same screen is crowded with counters the player wishes didn't exist. The game persuades by making climate escalation *felt through the interface*, not told.

---

## 1. Screen inventory & layout

### 1.1 Screen flow

```
Title → Campaign Timeline → Year Briefing → In-Game (one fire season) → Year-End Report → Campaign Timeline → … → Ending → Awareness/Credits
```

Every screen is one tap/click from its predecessor. No nested menus. A mini game earns its "minutes per level" promise with zero navigation friction.

### 1.2 Title screen

- Full-bleed illustration of the map in its **2026 state**: lush, morning light, drifting birdsong. One column: title, `Play`, `Continue` (if a save exists), `Options`, `About the fires` (awareness page).
- Subtle tell: on the far horizon, a single thin smoke column — the only moving element. This is the whole game in one image.
- No fire imagery, no drama. The title screen is the "before" photograph the player will mentally return to.

### 1.3 Year Briefing (~15 seconds of reading)

Framed as an in-fiction document — **"Regional Fire Authority · Season Briefing"**, dated. Top to bottom:

1. **The year**, in very large type (§3.4).
2. **The years between** — two quiet interstitial lines summarizing the elided seasons since the player's last one ("2031–2034: four seasons, two large fires held by the autumn rains. The Aldervale scar greens over. Twelve new homes permitted at the forest edge."), generated from sim state and script (progression doc §1.2).
3. Season forecast: danger outlook, wind regime, dryness — teaches the player what to fear this season. (From 2060 the relief-rain line reads: *none expected* — and never returns.)
4. **New this season** — unlock panel: the tool's blueprint slides in with one line of fiction ("Two engines reassigned to your sector") and one line of mechanics (hopeful register, §2.3).
5. One real climate fact, one sentence, tied to this season's mechanical change (§5).
6. `Begin season`.

The briefing is where hope lives. Its visual style degrades with the era: crisp white memo in 2026, coffee-stained and terse by mid-century, emergency-red letterhead by the finale. Same template, decaying — the bureaucracy itself is stressed.

### 1.4 In-game HUD

The map viewport is full-screen; HUD elements are translucent overlays pinned to edges. **The center of the screen is always map.** Desktop reference layout (mobile in §4.5):

```
┌──────────────────────────────────────────────────────────────────┐
│ [YEAR·month]  [STAT BAR: ha burnt · animals · houses · …]  [WEATHER CLUSTER: │
│  top-left      top-center, grows left→right over campaign   danger dial,     │
│                                                             wind, dryness]   │
│                                                          ┌──────────┐        │
│                                                          │ ALERTS   │        │
│                    MAP VIEWPORT                          │ FEED     │        │
│              (pan/zoom, center never obstructed)         │ (right,  │        │
│                                                          │ collapsible)      │
│                                                          └──────────┘        │
│ [TOOL PALETTE: trucks · evac · bomber · tower …]   [TIME: ⏸ 1x 2x +          │
│  bottom-left→center, slots fill over campaign       season progress bar]     │
└──────────────────────────────────────────────────────────────────┘
```

Placement rationale:

- **Stat bar, top-center.** In reading order, consequences are the first thing read on every glance. The bar is the game's conscience and must be unavoidable — but passive: it never animates for attention except at reveal moments.
- **Weather cluster, top-right.** Threat intelligence lives together: danger dial, wind arrow + speed, dryness meter. The scan pattern becomes *"what have I lost (left) → what's coming (right)"* — mirroring the game's emotional loop.
- **Tool palette, bottom.** Nearest to hands (mouse rest position, thumbs on touch). Large square buttons: icon + hotkey + cooldown ring. Empty future slots are present but dark (§2.1).
- **Alerts feed, right edge.** Newest on top, max 4 visible, older entries fade. One line each + a "jump to" tap that pans the camera. Dispatcher voice (§5.2). Collapsible on small screens.
- **Time controls + season bar, bottom-right.** Pause / 1× / 2× and a thin **season progress bar** (June → October → the rains). The bar visibly lengthens in later years as seasons extend — a tension device and the climate signal in miniature.

### 1.5 Year-End Report

Full-screen, quiet. Numbers **count up one at a time**, in stat-bar order — the count-up forces the player to sit with each figure for a beat. Then: comparison arrows vs. last year, one narrative line written around what *survived* ("Aldervale stands. 4,100 hectares do not."), memorial cards if applicable (§3.5), one real-world footnote (§5), `Continue`.

**No letter grades, no score, no fanfare, no confetti — ever.** The report is an accounting, not a reward screen. Skill is acknowledged through the narrative line and the comparison arrows, never celebration.

### 1.6 Campaign Timeline

A horizontal band, 2026 → 2070, with visible gaps between the season nodes — the spacing *is* the years passing. Each completed season is a node showing a **thumbnail of the map as the player left it — cumulative burn scars included** (trivial with the persistent map). The timeline becomes a filmstrip of degradation the player authored, scrollable at will. Future seasons are dark, unlabeled nodes. This screen doubles as the save/continue hub.

### 1.7 Ending screens

- **"The Long Defense"** (campaign completed): slow zoom-out over the full scarred map; cumulative tallies fade in over it; no music at first — birdsong returns *only over the areas that remain green*. The closing narrative line varies with cumulative performance ([`progression.md`](progression.md) §5.3).
- **"The Year the Line Broke"** (every village lost — early ending): cut to black, the year in large type, the final tallies, then the same zoom-out. No "GAME OVER" text — failure is written as history, not as a game verdict.

Both flow into the do-nothing comparison, then the **Awareness screen** (§5.4).

---

## 2. Progressive disclosure system

Two vocabularies, deliberately opposite in tone:

| | **Unlocks** (capability) | **Reveals** (consequence) |
|---|---|---|
| What | Tools: bomber, towers, crews | Counters: animals, houses, firefighters, population |
| Where | Year Briefing — planned, announced | Mid-game, at the first triggering event |
| Tone | Hopeful, warm; blueprint slides into palette | Sombre, quiet; the game pauses itself |
| Sound | Short bright motif | Single low piano note, or nothing |

### 2.1 The stat bar grows

At campaign start the bar shows one counter (`hectares burnt`) — and, crucially, **several faint unlit slots** beside it. No labels, no tooltips, just shaped shadows. The player notices the bar is longer than its content. This is quiet foreboding: the UI knows something the player doesn't.

Counters activate per the canonical schedule (2026 → 2030 → 2035 → 2045 → 2050). The UX contract: **each activation is event-triggered within its scheduled season** — the counter appears the first time the thing actually happens, and the scenario guarantees it happens ([`progression.md`](progression.md) §4).

### 2.2 Anatomy of a reveal moment

1. The triggering event occurs (a front overruns a farmstead for the first time).
2. **Time auto-pauses.** No input accepted for ~1.5 s.
3. Camera eases to the site. The player sees aftermath-adjacent, never the act: a hatched black footprint where the icon was.
4. The new counter **slides into its pre-existing dark slot** and ticks from `—` to its first value. (The animals reveal also shows its retroactive line: *"since 2026: ~340"*.)
5. One first-time tooltip, one plain sentence, no exclamation mark: *"Homes lost. Evacuated houses can burn; occupied ones must not."* Dismissed by any input; never shown again; retrievable from Help.
6. Time stays paused until the player unpauses. The game hands control back; it does not rush the moment.

Rule: **a reveal never coincides with a tool tutorial.** Grief and learning are separated by at least a few seconds of play.

### 2.3 Anatomy of an unlock

At the Year Briefing: blueprint card, one line of fiction, one line of mechanics; the palette slot lights when the season starts — a single pulse, then stillness. First use is guided by a ghost-hint (a faint outline showing a valid drop/placement), never a modal tutorial.

---

## 3. Emotional arc & art direction

### 3.1 Era palette progression

| Era | Years | Land | Sky/light | On-map weather |
|---|---|---|---|---|
| **Stewardship** | 2026–2040 | Saturated greens, blue lakes | Clear, warm morning light | Occasional wind |
| **Strain** | 2045–2060 | Olive and straw yellow creeping in; lakes visibly smaller | Pale, hazy white | Heat shimmer; longer season bar |
| **Triage** | 2065–2070 | Ochre, grey-brown; cumulative black scars dominate | Orange-grey haze; sun a dim disc | Persistent smoke layer; ember wind |

The shift is gradual — each season a shade drier-looking than the last, the half-decade gaps absorbing the steps — so the player never sees the change happen, only realizes it has. Scrolling the Campaign Timeline thumbnails delivers that realization on purpose.

### 3.2 Smoke as UI weather

A screen-space haze layer whose baseline opacity rises with the era — in late years the air is no longer clean even before anything ignites. During large fires it thickens locally and desaturates the map beneath. (Reduced-motion mode freezes its drift; opacity information is preserved.)

### 3.3 Soundscape arc (within the one-crossfade budget)

One global ambience crossfade driven by the burnt fraction of the map, plus a simple mute when the camera rests over scar tiles:

- **2026:** layered birdsong, insects, light wind. Music: a sparse warm acoustic motif, mostly silence.
- **Mid-century:** birdsong thins; dry wind becomes the bed; radio chatter during fires; sustained low strings, used sparingly.
- **Late campaign:** wind and radio static dominate; sirens are heard before fires are seen; music nearly absent — its absence *is* the score.
- **The absence principle:** pan the camera over an old scar and the ambience mutes. Silence is the game's memorial — diegetic, one afternoon of work, devastating.

### 3.4 The year counter as dramatic device

One typeface, three sizes, everywhere: huge on briefings, medium on reports, small and persistent top-left in the HUD. The season transition **rolls through the skipped years** — `2041, 2042, 2043, 2044…` accelerating, then landing hard on `2045` — held on black for a full second, the only pure black in the game. Four years of someone else's summers pass in half a breath; the player arrives at the one that matters. Late-era numerals pick up a faint ash-grain texture. The player learns to feel a small dread at the roll itself: *where will it stop — and what will it reveal?* That conditioned response is the climate message in miniature.

### 3.5 Dread, responsibly (hard rules — applied as a checklist to every content PR)

- **No gore, no bodies, no screams, no depicted suffering — human or animal. Ever.**
- **Numbers and absence over depiction.** Loss is counters, silence, unlit windows, hatched footprints, empty map.
- **Animals:** in early years silhouettes visibly *escape* ahead of fronts (hope, and a mechanic tell). When a front moves too fast, the escape animation simply doesn't play — that absence is the event. Burnt zones have no birdsong.
- **Firefighter deaths:** conveyed through radio. Escalating alerts; if lost, the unit icon greys and stops, the feed shows a final line, then static. At Year-End, a **memorial card**: engine number, a name, a place, a date — nothing else. Black on white, held until dismissed. Names and places are fictional but *consistent across the campaign* — Engine 7 is the same Engine 7 the player has deployed since 2026; losing it must cost something.
- **Population loss:** never individualized, never shown. The counter reads `lives lost`; the map shows only a district whose windows never relight. The Year-End line references the community by name ("Sant Roc buried its own this winter.") and stops there.
- **Named fictional communities** (Aldervale, Sant Roc, Karri Flats, …): evocative, geographically varied, invented — no real community's tragedy is borrowed. Real disasters appear only in sourced fact cards.
- **Never punish with spectacle.** The worst outcomes get the *least* audiovisual production. Restraint signals respect; production value spent on death reads as exploitation.

---

## 4. Feedback & readability

### 4.1 Reading danger

- **Danger dial** (top-right): 5 segments modeled on real fire-danger rating scales — number (1–5), label (Low → Catastrophic), distinct icon, luminance step. Readable by position and label alone.
- **Wind indicator:** arrow + km/h numeral. Selecting any active fire overlays a **spread cone** — the projected front under current wind (hover-preview on mouse, select-preview on touch). The cone is the single most important teaching tool in the game: it turns wind from trivia into fear.
- **Dryness meter:** a moisture bar (wet → tinder) whose icon shifts from droplet to cracked-earth glyph. Its year-over-year baseline decline is the climate mechanic made visible.

### 4.2 Fire states

Three redundant channels, never color alone: size/animation (smoulder = small flicker; active = tall flame; crowning = fast + ember particles), a glyph badge on selection, and ground texture (burning = bright edge line; burnt = static dark cross-hatch). The fire ramp runs dark red → orange → pale yellow — a **luminance** ramp, legible under all common color-vision deficiencies.

### 4.3 Unit and evacuation states

- **Units:** state ring — hollow (idle), animated dashed (en route), filled + spray (working), droplet pip (low water), chevron (withdrawing), static grey (lost). Selection adds a text label; nothing is icon-only.
- **Evacuation zones:** outline language — solid (inhabited), pulsing dashed **with a countdown numeral** (evacuating), hollow + check (cleared), dark hatch (lost). The numeral, not the pulse, is the load-bearing signal.

### 4.4 Color-vision safety

- Color is never the sole channel; every state pairs it with shape, pattern, animation, or text.
- No red/green opposition anywhere: "safe" is blue-white + check glyph; "danger" is the yellow-red luminance ramp + numerals.
- A CVD-simulated screenshot pass (deuteranopia/protanopia/tritanopia) is a QA checklist item, not a settings toggle — safe by default beats a mode.

### 4.5 Touch vs. mouse

- Identical grammar on both: **tap/click to select, tap/click to order.** No drag-only or hover-only interactions anywhere.
- Mouse adds conveniences (hover cones, right-click cancel); touch gets a persistent cancel button and select-to-preview.
- 44 px minimum hit targets; palette buttons larger. Pinch zoom, one/two-finger pan. On phones the alerts feed collapses to a badge and the weather cluster condenses to dial + wind numeral.

---

## 5. Awareness messaging

Principle: **the simulation is the argument; facts annotate it.** Every fact appears when the player has just *lived* what it describes. Never interrupt play with messaging. Never blame the player. Never present doom without an action attached.

### 5.1 Placement map

| Surface | Content | Frequency |
|---|---|---|
| Year Briefing | One fact tied to this season's mechanical change | 1/season, 1 sentence |
| Loading tips | Rotating short facts + practical fire-safety notes | 1 per load |
| Year-End footnote | One real-world comparison scaled against the player's own numbers | 1/year |
| Ending / Awareness screen | The campaign summarized, then real organizations and resources | Once |

All facts carry a short attribution in place ("— Copernicus/EFFIS") and a full citation in the credits, sourced from `facts.json` ([`progression.md`](progression.md) §6).

### 5.2 Tone guidelines

- **Briefings:** institutional but human. Plain declarative sentences, present tense. No exclamation marks anywhere in the game.
- **Alerts:** operational dispatcher voice — short, concrete, place-named. Urgency from content, not punctuation.
- **Memorials/reports:** quiet, factual, at most one image of language.
- Forbidden registers: jokes about destruction; score-speak around loss ("new record!"); second-person blame ("you let Aldervale burn"); apocalyptic hyperbole. The fires are dramatic enough.

Example strings:

> *Briefing, 2060:* "Winter rainfall came in 40 percent below average for the fourth consecutive year. The forest enters summer already dry."
>
> *Alert:* "Wind shift — NW 45 km/h. The Aldervale front reaches the valley road in minutes."
>
> *Year-End footnote:* "You lost 1,180 hectares this season. In 2023, fires in Canada burned over 15 million. — Natural Resources Canada"

### 5.3 Anti-preachiness guardrails

One fact per surface, maximum. If a fact can't be tied to something the player just experienced, cut it. The player should finish feeling they *discovered* the escalation, and find the facts confirming — not instructing.

### 5.4 Final Awareness screen

After the ending: *"This forest is invented. The trend is not."* → three action columns — **Learn** (IPCC summaries, NASA Climate, Copernicus/EFFIS), **Prepare** (national civil-protection / wildfire-readiness resources), **Act** (volunteer fire services, reputable reforestation and climate organizations) — plus the static two-panel 2100 comparison ([`progression.md`](progression.md) §5.3). External links only; no in-game donation flows; no dark patterns. Then credits, then the title screen — restored to green 2026, which now reads differently.

---

## 6. Accessibility & juice

### Accessibility (ship requirements, not stretch goals)

- [ ] Pause available at any moment, including during alerts; auto-pause on reveals and tab blur
- [ ] Speeds: pause / play only — never enough speed to skip past consequence moments; a quiet valley pulls the next fire forward instead
- [ ] Reduced-motion mode: haze drift frozen, ember particles minimized, camera cuts instead of eases; all information preserved
- [ ] Text size: 3 steps, HUD reflows; minimum body size 16 px equivalent
- [ ] Audio: separate music / SFX / ambience sliders; **captioned audio cues** ("[radio static]", "[wind rising]") — the soundscape carries meaning, so it must have a visual twin
- [ ] Color-vision-safe by default (§4.4), verified by CVD screenshot pass
- [ ] Fully keyboard-playable: number keys for tools, space for pause, WASD/arrows pan, Esc cancels
- [ ] Every hover interaction has a select/tap equivalent
- [ ] No flashing above photosensitivity thresholds (fire flicker rates capped)

### Juice — the stance

**Destruction gets zero juice. Agency gets all of it.**

- **No screen shake, ever** — not on ignition, not on a lost house, not on the firestorm. Shake spends spectacle on catastrophe and teaches the player that fire is exciting. The only concession to overwhelming force: a low-frequency audio rumble during the 2070 pyroCb (audio-only, caption-covered, absent in reduced-motion sessions where the caption carries it).
- Player actions are tactile: buttons depress with a soft click; truck deployment lands with a decisive thunk and a siren chirp; a water-bomber drop gets the full treatment — engine doppler, water sheet, steam hiss, a brief bright-green tint where the drop saved unburnt forest; a completed evacuation ends on one soft, warm chime.
- Destruction gets **subtraction**: local desaturation, ambience dropping out, a counter ticking without fanfare. The kinesthetic message: *acting feels good; losing feels like less.*
- The micro-feedback budget is small by design — a dozen sounds, a handful of tweens. Polish the ten interactions the player performs two hundred times; leave the catastrophe unadorned.
