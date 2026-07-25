import { Renderer, TILE } from '../render/canvas';
import { createSeason } from '../sim/scenario';
import { Hud } from '../ui/hud';
import { GameLoop } from './loop';

const CAMPAIGN_SEED = 20260614;

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
  () => {
    renderer.draw(pinnedTruckId);
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
const btn1x = document.getElementById('btn-1x') as HTMLButtonElement;
const btn2x = document.getElementById('btn-2x') as HTMLButtonElement;

function setSpeed(speed: number): void {
  loop.speed = speed;
  btnPause.classList.toggle('active', speed === 0);
  btn1x.classList.toggle('active', speed === 1);
  btn2x.classList.toggle('active', speed === 2);
}

btnPause.addEventListener('click', () => setSpeed(0));
btn1x.addEventListener('click', () => setSpeed(1));
btn2x.addEventListener('click', () => setSpeed(2));

document.addEventListener('keydown', (ev) => {
  if (ev.key === ' ') {
    ev.preventDefault();
    setSpeed(loop.speed === 0 ? 1 : 0);
  } else if (ev.key === '1') setSpeed(1);
  else if (ev.key === '2') setSpeed(2);
  else if (ev.key === 'Escape') pinnedTruckId = null;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setSpeed(0);
});

(document.getElementById('btn-restart') as HTMLButtonElement).addEventListener('click', restart);

loop.start();
