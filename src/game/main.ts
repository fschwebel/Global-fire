import { Renderer, TILE } from '../render/canvas';
import { createSeason } from '../sim/scenario';
import { Hud } from '../ui/hud';
import { GameLoop } from './loop';

// Chosen from tuning probes: lively unfought fires, strongly containable when fought.
const CAMPAIGN_SEED = 42;

let state = createSeason(CAMPAIGN_SEED, 0);
let pinnedTruckId: number | null = null;

function togglePin(truckId: number): void {
  pinnedTruckId = pinnedTruckId === truckId ? null : truckId;
}

const canvas = document.getElementById('map') as HTMLCanvasElement;
const renderer = new Renderer(canvas, state);
const hud = new Hud(state, togglePin);

const loop = new GameLoop(
  state,
  (events) => hud.handle(events),
  (alpha) => {
    renderer.draw(pinnedTruckId, alpha);
    hud.update(pinnedTruckId);
  },
);

function restart(): void {
  state = createSeason(CAMPAIGN_SEED, 0);
  pinnedTruckId = null;
  renderer.setState(state);
  hud.setState(state);
  loop.setState(state);
  setSpeed(1);
}

// --- Input -----------------------------------------------------------------

canvas.addEventListener('click', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor(((ev.clientX - rect.left) * scaleX) / TILE);
  const y = Math.floor(((ev.clientY - rect.top) * scaleY) / TILE);
  if (x < 0 || y < 0 || x >= state.w || y >= state.h) return;

  // Clicking an engine on the map pins it — same as its sidebar card.
  const truck = state.trucks.find((t) => t.x === x && t.y === y);
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
  if (ev.key === ' ') {
    ev.preventDefault();
    setSpeed(loop.speed === 0 ? 1 : 0);
  } else if (ev.key === 'Escape') pinnedTruckId = null;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setSpeed(0);
});

(document.getElementById('btn-restart') as HTMLButtonElement).addEventListener('click', restart);

loop.start();
