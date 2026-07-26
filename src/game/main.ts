import { Renderer, TILE } from '../render/canvas';
import { createSeason } from '../sim/scenario';
import type { Cell, GameState, Stats } from '../sim/state';
import { Hud } from '../ui/hud';
import { MapViewport } from '../ui/viewport';
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
        // Burnt houses lost their occupants before the save was written.
        if (cell.type === 'house' && scar.b !== 'house') cell.occupants = 0;
      }
      return createSeason(CAMPAIGN_SEED, seasonIndex, pristine.grid);
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

function togglePin(truckId: number): void {
  pinnedTruckId = pinnedTruckId === truckId ? null : truckId;
}

const canvas = document.getElementById('map') as HTMLCanvasElement;
const renderer = new Renderer(canvas, state);
const hud = new Hud(state, togglePin);
const viewport = new MapViewport(
  document.getElementById('mapwrap') as HTMLElement,
  canvas,
  canvas.width,
  canvas.height,
);

const loop = new GameLoop(
  state,
  (events) => {
    hud.handle(events);
    const end = events.find((e) => e.type === 'seasonEnded');
    if (end && end.type === 'seasonEnded') onSeasonEnd(end.report);
  },
  (alpha) => {
    renderer.draw(pinnedTruckId, alpha);
    hud.update(pinnedTruckId);
  },
);

function sectorGrew(idx: number): boolean {
  return idx > 0 && Math.floor(idx / 2) > Math.floor((idx - 1) / 2);
}

function startSeason(idx: number, carryGrid?: Cell[]): void {
  seasonIndex = idx;
  state = createSeason(CAMPAIGN_SEED, idx, carryGrid);
  pinnedTruckId = null;
  renderer.setState(state);
  hud.setState(state);
  loop.setState(state);
  viewport.setBase(canvas.width, canvas.height);
  setSpeed(0);
  hud.showBriefing(sectorGrew(idx));
}

function onSeasonEnd(report: Stats): void {
  campaign = addStats(campaign, report);
  debriefIsFinal = seasonIndex >= LAST_SEASON;
  // The final save is cleared only when the player leaves the final screen —
  // a refresh at the 2070 debrief resumes the finale instead of losing the run.
  if (!debriefIsFinal) saveCampaign(CAMPAIGN_SEED, seasonIndex + 1, campaign, state.grid);
  hud.showDebrief(report, campaign, state.seasonYear, debriefIsFinal);
}

// --- Input -----------------------------------------------------------------

/** Set when an overlay closes; nearby clicks are ignored so double-clicks can't fall through. */
let overlayClosedAt = 0;

function overlayJustClosed(): boolean {
  return performance.now() - overlayClosedAt < 350;
}

canvas.addEventListener('click', (ev) => {
  if (viewport.consumeDragged()) return; // a pan/pinch, not an order
  if (hud.overlayVisible() || overlayJustClosed()) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = state.bounds.x0 + Math.floor(((ev.clientX - rect.left) * scaleX) / TILE);
  const y = state.bounds.y0 + Math.floor(((ev.clientY - rect.top) * scaleY) / TILE);
  if (x < state.bounds.x0 || y < state.bounds.y0 || x >= state.bounds.x1 || y >= state.bounds.y1)
    return;

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
  loop.enqueue({ type: 'dispatch', x, y, truckId: pinnedTruckId ?? undefined });
});

canvas.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  pinnedTruckId = null;
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
  } else if (ev.key === 'Escape') pinnedTruckId = null;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setSpeed(0);
});

// --- Season flow -----------------------------------------------------------

(document.getElementById('btn-begin') as HTMLButtonElement).addEventListener('click', () => {
  if (overlayJustClosed()) return;
  hud.hideBriefing();
  overlayClosedAt = performance.now();
  setSpeed(1);
});

(document.getElementById('btn-restart') as HTMLButtonElement).addEventListener('click', () => {
  if (overlayJustClosed()) return;
  overlayClosedAt = performance.now();
  if (debriefIsFinal) {
    clearCampaign();
    campaign = zeroStats();
    debriefIsFinal = false;
    startSeason(0);
  } else {
    startSeason(seasonIndex + 1, state.grid);
  }
});

window.__gf = { getState: () => state };

const version = document.getElementById('version');
if (version) version.textContent = `v${__BUILD__}`;

// First screen of a session is always the briefing, paused.
setSpeed(0);
hud.showBriefing(sectorGrew(seasonIndex));

loop.start();
