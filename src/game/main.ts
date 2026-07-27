import { Renderer, TILE } from '../render/canvas';
import { bomber as bomberBal } from '../sim/balance';
import { createSeason } from '../sim/scenario';
import type { Cell, GameState, Stats } from '../sim/state';
import { dropLineCells } from '../sim/units';
import { Hud, type Tool } from '../ui/hud';
import { L, applyStaticText } from '../ui/i18n';
import { MapViewport } from '../ui/viewport';
import {
  trackCampaignFinished,
  trackCampaignRestarted,
  trackDrought,
  trackLearnMore,
  trackSeasonCompleted,
  trackSeasonStarted,
  trackUnitLost,
} from './analytics';
import { simulateUnfoughtCampaign } from './counterfactual';
import { GameLoop } from './loop';
import { clearCampaign, loadCampaign, saveCampaign } from './save';

declare global {
  interface Window {
    /** Dev/test handle onto the live sim state (browser smoke tests). */
    __gf?: { getState: () => GameState };
  }
}

// Chosen from tuning probes: lively unfought fires, strongly containable when fought.
const CAMPAIGN_SEED = 42;
const LAST_SEASON = 9;

function zeroStats(): Stats {
  return {
    hectaresBurnt: 0,
    animalsKilled: 0,
    housesLost: 0,
    firefightersLost: 0,
    civiliansLost: 0,
  };
}

function addStats(a: Stats, b: Stats): Stats {
  return {
    hectaresBurnt: a.hectaresBurnt + b.hectaresBurnt,
    animalsKilled: a.animalsKilled + b.animalsKilled,
    housesLost: a.housesLost + b.housesLost,
    firefightersLost: a.firefightersLost + b.firefightersLost,
    civiliansLost: a.civiliansLost + b.civiliansLost,
  };
}

// --- Campaign boot (resume a saved run if one exists) -----------------------

let seasonIndex = 0;
let campaign = zeroStats();
let debriefIsFinal = false;
/** True when this boot picked up a saved campaign — tagged on the next season_started. */
let bootResumed = false;

function bootState(): GameState {
  const saved = loadCampaign();
  if (
    saved &&
    saved.seed === CAMPAIGN_SEED &&
    Number.isInteger(saved.seasonIndex) &&
    saved.seasonIndex > 0 &&
    saved.seasonIndex <= LAST_SEASON
  ) {
    try {
      seasonIndex = saved.seasonIndex;
      campaign = { ...zeroStats(), ...(saved.campaign ?? {}) };
      // Rebuild the carry world: pristine generation + recorded burn history,
      // then createSeason applies the regrowth clock.
      const pristine = createSeason(CAMPAIGN_SEED, 0);
      for (const scar of saved.scars) {
        const cell = pristine.grid[scar.i];
        if (!cell) continue;
        cell.burntYear = scar.y;
        cell.baseType = scar.b;
        // Burnt houses lost their occupants before the save was written; the
        // regrowth clock re-populates any lot that has since been rebuilt.
        if (cell.type === 'house') cell.occupants = 0;
      }
      bootResumed = true;
      return createSeason(CAMPAIGN_SEED, seasonIndex, pristine.grid, saved.towers);
    } catch {
      clearCampaign(); // a damaged save must never brick the boot
    }
  }
  seasonIndex = 0;
  campaign = zeroStats();
  return createSeason(CAMPAIGN_SEED, 0);
}

let state = bootState();
let pinnedTruckId: number | null = null;

/** The armed measure: what the next map click means. */
let armedTool: Tool = 'engine';

function setTool(tool: Tool): void {
  if (armedTool === 'bomber' && tool !== 'bomber') clearBomberAnchor();
  armedTool = tool;
  if (tool !== 'engine') pinnedTruckId = null;
  renderer.setHighlightTowers(tool === 'tower');
  if (tool !== 'tower') renderer.setTowerCursor(null);
  hud.setTool(tool);
}

function togglePin(truckId: number): void {
  pinnedTruckId = pinnedTruckId === truckId ? null : truckId;
  if (pinnedTruckId !== null) setTool('engine');
}

// Static page text goes to the browser's language before anything renders.
applyStaticText();

const canvas = document.getElementById('map') as HTMLCanvasElement;
const renderer = new Renderer(canvas, state);
const hud = new Hud(state, togglePin, setTool);
const viewport = new MapViewport(
  document.getElementById('mapwrap') as HTMLElement,
  canvas,
  canvas.width,
  canvas.height,
);

const loop = new GameLoop(
  state,
  (events) => {
    // The tick ran: whatever was queued has been consumed.
    pendingOrders = [];
    renderer.setPendingOrders(null);
    hud.handle(events);
    for (const ev of events) {
      if (ev.type === 'unitLost') {
        trackUnitLost(ev.unit, state.seasonYear);
        if (ev.unit === 'engine' && ev.unitId === pinnedTruckId) pinnedTruckId = null;
      } else if (ev.type === 'riverDry') trackDrought(state.seasonYear);
    }
    const end = events.find((e) => e.type === 'seasonEnded');
    if (end && end.type === 'seasonEnded') onSeasonEnd(end.report);
  },
  (alpha) => {
    renderer.draw(pinnedTruckId, alpha, loop.speed > 0);
    hud.update(pinnedTruckId, loop.speed > 0);
  },
);

function sectorGrew(idx: number): boolean {
  return idx > 0 && Math.floor(idx / 2) > Math.floor((idx - 1) / 2);
}

function startSeason(idx: number, carryGrid?: Cell[], carryTowers?: typeof state.towers): void {
  seasonIndex = idx;
  state = createSeason(CAMPAIGN_SEED, idx, carryGrid, carryTowers);
  pinnedTruckId = null;
  clearBomberAnchor();
  pendingOrders = [];
  renderer.setState(state);
  hud.setState(state);
  loop.setState(state);
  viewport.setBase(canvas.width, canvas.height);
  setTool('engine');
  setSpeed(0);
  hud.showBriefing(sectorGrew(idx));
}

function onSeasonEnd(report: Stats): void {
  setSpeed(0); // nothing should animate or burn CPU behind the debrief
  campaign = addStats(campaign, report);
  debriefIsFinal = seasonIndex >= LAST_SEASON;
  trackSeasonCompleted(state.seasonYear, seasonIndex, report);
  if (debriefIsFinal) trackCampaignFinished(campaign);
  // The final save is cleared only when the player leaves the final screen —
  // a refresh at the 2070 debrief resumes the finale instead of losing the run.
  if (!debriefIsFinal)
    saveCampaign(CAMPAIGN_SEED, seasonIndex + 1, campaign, state.grid, state.towers);
  // The ending measures the campaign against the same valley left unfought.
  let unfought: Stats | null = null;
  if (debriefIsFinal) {
    try {
      unfought = simulateUnfoughtCampaign(CAMPAIGN_SEED, LAST_SEASON);
    } catch {
      unfought = null; // the finale still shows without the comparison
    }
  }
  hud.showDebrief(report, campaign, state.seasonYear, debriefIsFinal, unfought);
}

// --- Input -----------------------------------------------------------------

/** Set when an overlay closes; nearby clicks are ignored so double-clicks can't fall through. */
let overlayClosedAt = 0;

function overlayJustClosed(): boolean {
  return performance.now() - overlayClosedAt < 350;
}

/** Orders clicked but not yet consumed by a sim tick — drawn as rings so a paused click never looks dead. */
let pendingOrders: { x: number; y: number }[] = [];

function enqueueOrder(cmd: Parameters<typeof loop.enqueue>[0], x: number, y: number): void {
  loop.enqueue(cmd);
  pendingOrders.push({ x, y });
  renderer.setPendingOrders(pendingOrders);
}

/** First click of a retardant-line order; the second click sets the direction. */
let bomberAnchor: { x: number; y: number } | null = null;

function clearBomberAnchor(): void {
  bomberAnchor = null;
  hud.setBomberAnchor(false);
  renderer.setDropPreview(null);
}

/** Map-cell under a pointer event, or null outside the sector. */
function cellFromEvent(ev: { clientX: number; clientY: number }): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = state.bounds.x0 + Math.floor(((ev.clientX - rect.left) * scaleX) / TILE);
  const y = state.bounds.y0 + Math.floor(((ev.clientY - rect.top) * scaleY) / TILE);
  if (x < state.bounds.x0 || y < state.bounds.y0 || x >= state.bounds.x1 || y >= state.bounds.y1)
    return null;
  return { x, y };
}

// Click orders listen on the container: the viewport's pointer capture makes
// Chrome retarget clicks to #mapwrap, so a canvas listener would never fire.
const mapwrap = document.getElementById('mapwrap') as HTMLElement;
mapwrap.addEventListener('click', (ev) => {
  if (viewport.consumeDragged()) return; // a pan/pinch, not an order
  if (hud.overlayVisible() || overlayJustClosed()) return;
  const cell = cellFromEvent(ev);
  if (!cell) return;
  const { x, y } = cell;

  switch (armedTool) {
    case 'engine': {
      // Clicking an engine on the map pins it — same as its sidebar card. The
      // hit-test includes the tiles the engine just drove through, because the
      // sprite renders interpolated along that trail.
      const truck = state.trucks.find(
        (t) => (t.x === x && t.y === y) || t.trail.some((p) => p.x === x && p.y === y),
      );
      if (truck) {
        togglePin(truck.id);
        return;
      }
      enqueueOrder({ type: 'dispatch', x, y, truckId: pinnedTruckId ?? undefined }, x, y);
      break;
    }
    case 'evac': {
      if (state.villages.some((v) => v.evac === 'inProgress')) {
        hud.notify(L.nfEvacBusy);
        break;
      }
      if (state.tick < state.evacReadyAtTick) {
        hud.notify(L.nfEvacRegroup);
        break;
      }
      // The click names a village, not a tile.
      let best: { id: number; d: number } | null = null;
      for (const v of state.villages) {
        const d = Math.max(Math.abs(v.x - x), Math.abs(v.y - y));
        if (d <= 6 && (best === null || d < best.d)) best = { id: v.id, d };
      }
      if (best) {
        enqueueOrder({ type: 'evacuate', villageId: best.id }, x, y);
        setTool('engine');
      }
      break;
    }
    case 'bomber':
      if (state.script.drought?.done) {
        hud.notify(L.nfBomberGrounded);
        break;
      }
      // Nothing ready must not swallow a two-click order in silence.
      if (!state.bombers.some((b) => b.state === 'ready')) {
        hud.notify(L.nfNoBomberReady);
        break;
      }
      // Two-click order: anchor the line, then aim it.
      if (!bomberAnchor) {
        bomberAnchor = { x, y };
        hud.setBomberAnchor(true);
        renderer.setDropPreview([{ x, y }]);
      } else if (x !== bomberAnchor.x || y !== bomberAnchor.y) {
        enqueueOrder(
          { type: 'bomberDrop', x: bomberAnchor.x, y: bomberAnchor.y, x2: x, y2: y },
          bomberAnchor.x,
          bomberAnchor.y,
        );
        clearBomberAnchor();
      }
      break;
    case 'tower': {
      if (state.towersAvailable <= 0) {
        hud.notify(L.nfNoTowers);
        setTool('engine');
        break;
      }
      const cell = state.grid[y * state.w + x];
      if (!cell || cell.type === 'water' || cell.state === 'burning') {
        hud.notify(L.nfBadTowerGround);
        break;
      }
      enqueueOrder({ type: 'placeTower', x, y }, x, y);
      if (state.towersAvailable <= 1) setTool('engine');
      break;
    }
    case 'crew':
      if (state.crews.length === 0) {
        hud.notify(L.nfCrewGone);
        break;
      }
      enqueueOrder({ type: 'crewCut', x, y }, x, y);
      break;
  }
});

// Aiming preview: with an anchor set, the exact line the bomber would lay
// follows the pointer.
mapwrap.addEventListener('pointermove', (ev) => {
  if (armedTool === 'tower') {
    renderer.setTowerCursor(cellFromEvent(ev));
    return;
  }
  if (armedTool !== 'bomber' || !bomberAnchor) return;
  const cell = cellFromEvent(ev);
  if (!cell || (cell.x === bomberAnchor.x && cell.y === bomberAnchor.y)) {
    renderer.setDropPreview([bomberAnchor]);
    return;
  }
  renderer.setDropPreview(dropLineCells(bomberAnchor, cell, bomberBal.lineLength));
});

mapwrap.addEventListener('pointerleave', () => {
  if (armedTool === 'bomber' && bomberAnchor) renderer.setDropPreview([bomberAnchor]);
  if (armedTool === 'tower') renderer.setTowerCursor(null);
});

mapwrap.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  pinnedTruckId = null;
  setTool('engine');
});

// --- Time controls ---------------------------------------------------------

const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;

function setSpeed(speed: number): void {
  loop.speed = speed;
  btnPause.classList.toggle('active', speed === 0);
  btnPlay.classList.toggle('active', speed === 1);
}

btnPause.addEventListener('click', () => setSpeed(0));
btnPlay.addEventListener('click', () => setSpeed(1));

document.addEventListener('keydown', (ev) => {
  if (hud.overlayVisible()) return; // never unpause behind the briefing/debrief
  if (ev.key === ' ') {
    ev.preventDefault();
    setSpeed(loop.speed === 0 ? 1 : 0);
  } else if (ev.key === 'Escape') {
    pinnedTruckId = null;
    clearBomberAnchor();
    setTool('engine');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setSpeed(0);
});

// --- Season flow -----------------------------------------------------------

// The splash shows once ever: dismissing it is remembered across sessions.
const INTRO_KEY = 'global-fire-intro-seen';

function introSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return true; // storage unavailable — never trap the player behind the splash
  }
}

(document.getElementById('btn-splash') as HTMLButtonElement).addEventListener('click', () => {
  try {
    localStorage.setItem(INTRO_KEY, '1');
  } catch {
    // best effort — the splash simply shows again next visit
  }
  hud.hideSplash();
  overlayClosedAt = performance.now(); // a double-tap must not fall through to Begin season
});

(document.getElementById('btn-learn') as HTMLButtonElement).addEventListener('click', () => {
  const links = document.getElementById('b-links') as HTMLElement;
  links.hidden = !links.hidden;
  if (!links.hidden) trackLearnMore(state.seasonYear);
});

(document.getElementById('btn-begin') as HTMLButtonElement).addEventListener('click', () => {
  if (overlayJustClosed()) return;
  hud.hideBriefing();
  overlayClosedAt = performance.now();
  trackSeasonStarted(state.seasonYear, seasonIndex, bootResumed);
  bootResumed = false;
  setSpeed(1);
});

(document.getElementById('btn-restart') as HTMLButtonElement).addEventListener('click', () => {
  if (overlayJustClosed()) return;
  overlayClosedAt = performance.now();
  if (debriefIsFinal) {
    trackCampaignRestarted();
    clearCampaign();
    campaign = zeroStats();
    debriefIsFinal = false;
    startSeason(0);
  } else {
    startSeason(seasonIndex + 1, state.grid, state.towers);
  }
});

window.__gf = { getState: () => state };

const version = document.getElementById('version');
if (version) version.textContent = `v${__BUILD__}`;

// First screen of a session is always the briefing, paused. A brand-new
// player gets the splash on top of it first.
setSpeed(0);
hud.showBriefing(sectorGrew(seasonIndex));
if (seasonIndex === 0 && !bootResumed && !introSeen()) hud.showSplash();

loop.start();
