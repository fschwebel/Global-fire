import { Renderer, TILE } from '../render/canvas';
import { createSeason } from '../sim/scenario';
import { Hud } from '../ui/hud';
import { GameLoop } from './loop';

const CAMPAIGN_SEED = 20260614;

let state = createSeason(CAMPAIGN_SEED, 0);
let selectedTruckId: number | null = null;

const canvas = document.getElementById('map') as HTMLCanvasElement;
const renderer = new Renderer(canvas, state);
const hud = new Hud(state);

const loop = new GameLoop(
  state,
  (events) => hud.handle(events),
  () => {
    renderer.draw(selectedTruckId);
    hud.update(selectedTruckId);
  },
);

function restart(): void {
  state = createSeason(CAMPAIGN_SEED, 0);
  selectedTruckId = null;
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

  const truck = state.trucks.find((t) => Math.abs(t.x - x) <= 0 && Math.abs(t.y - y) <= 0);
  if (truck) {
    selectedTruckId = truck.id;
    return;
  }
  if (selectedTruckId !== null) {
    loop.enqueue({ type: 'moveTruck', truckId: selectedTruckId, x, y });
  }
});

canvas.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  selectedTruckId = null;
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
  else if (ev.key === 'Escape') selectedTruckId = null;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setSpeed(0);
});

(document.getElementById('btn-restart') as HTMLButtonElement).addEventListener('click', restart);

loop.start();
