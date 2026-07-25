import { truck as T } from '../sim/balance';
import type { GameEvent, GameState, Truck } from '../sim/state';
import { cellAt, inBounds } from '../sim/state';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

const FACT_2026 =
  'The global fire-weather season lengthened ~19% between 1979 and 2013. — Jolly et al., Nature Communications, 2015';

function engineStatus(s: GameState, t: Truck): string {
  if (t.path.length > 0) return 'En route';
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (inBounds(s, nx, ny) && cellAt(s, nx, ny).state === 'burning') return 'Fighting fire';
    }
  if (t.water < T.waterCapacity) {
    const nearStation = Math.abs(t.x - s.station.x) <= 1 && Math.abs(t.y - s.station.y) <= 1;
    let nearWater = nearStation;
    for (let dy = -1; dy <= 1 && !nearWater; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (inBounds(s, t.x + dx, t.y + dy) && cellAt(s, t.x + dx, t.y + dy).type === 'water') {
          nearWater = true;
          break;
        }
    if (nearWater) return 'Refilling';
  }
  return 'Standing by';
}

/** DOM overlay: stat bar, weather cluster, engine cards, alerts feed, time controls, debrief. */
export class Hud {
  private hectares = el<HTMLSpanElement>('hectares');
  private year = el<HTMLDivElement>('year');
  private windarrow = el<HTMLSpanElement>('windarrow');
  private windspeed = el<HTMLSpanElement>('windspeed');
  private dryness = el<HTMLSpanElement>('dryness');
  private alerts = el<HTMLDivElement>('alerts');
  private seasonfill = el<HTMLDivElement>('seasonfill');
  private selection = el<HTMLDivElement>('selection');
  private debrief = el<HTMLDivElement>('debrief');
  private report = el<HTMLDivElement>('report');
  private fact = el<HTMLParagraphElement>('fact');
  private engines = el<HTMLDivElement>('engines');
  private cards = new Map<number, HTMLButtonElement>();

  constructor(
    private state: GameState,
    private onPinToggle: (truckId: number) => void,
  ) {
    this.year.textContent = String(state.seasonYear);
    this.dryness.textContent = `dryness ${Math.round(state.dryness * 100)}%`;
    this.fact.textContent = FACT_2026;
    this.buildCards();
  }

  setState(state: GameState): void {
    this.state = state;
    this.year.textContent = String(state.seasonYear);
    this.debrief.hidden = true;
    this.alerts.replaceChildren();
    this.buildCards();
  }

  private buildCards(): void {
    this.engines.replaceChildren();
    this.cards.clear();
    for (const t of this.state.trucks) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'engine-card';
      card.innerHTML = `<strong>Engine ${t.id}</strong><span class="status"></span><div class="waterbar"><div></div></div>`;
      card.addEventListener('click', () => this.onPinToggle(t.id));
      this.engines.append(card);
      this.cards.set(t.id, card);
    }
  }

  update(pinnedTruckId: number | null): void {
    const s = this.state;
    this.hectares.textContent = `${s.stats.hectaresBurnt} ha burnt`;
    this.windarrow.style.transform = `rotate(${s.wind.dir}rad)`;
    this.windspeed.textContent = `${Math.round(s.wind.str * 30)} km/h`;
    this.seasonfill.style.width = `${Math.min(100, (s.tick / s.seasonLen) * 100)}%`;

    for (const t of s.trucks) {
      const card = this.cards.get(t.id);
      if (!card) continue;
      card.classList.toggle('pinned', t.id === pinnedTruckId);
      const status = card.querySelector<HTMLSpanElement>('.status');
      if (status) status.textContent = engineStatus(s, t);
      const bar = card.querySelector<HTMLDivElement>('.waterbar > div');
      if (bar) bar.style.width = `${(t.water / T.waterCapacity) * 100}%`;
    }

    this.selection.textContent =
      pinnedTruckId !== null
        ? `Controlling Engine ${pinnedTruckId} — click the map to send it. Esc to release.`
        : 'Click the map — the nearest engine responds. Click an engine card to take direct control.';
  }

  handle(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'fireDetected':
          this.pushAlert(
            `Fire reported — grid ${String.fromCharCode(65 + Math.floor(ev.x / 6))}${Math.floor(ev.y / 4) + 1}`,
          );
          break;
        case 'engineDispatched': {
          const card = this.cards.get(ev.truckId);
          if (card) {
            card.classList.remove('flash');
            void card.offsetWidth; // restart the animation
            card.classList.add('flash');
          }
          break;
        }
        case 'windShift':
          this.pushAlert('Wind shift — fronts will turn.');
          break;
        case 'reliefRain':
          this.pushAlert('Rain moves through the valley.');
          break;
        case 'seasonEnded':
          this.showDebrief(ev.report.hectaresBurnt, ev.report.housesLost);
          break;
      }
    }
  }

  private pushAlert(text: string): void {
    const div = document.createElement('div');
    div.className = 'alert';
    div.textContent = text;
    this.alerts.prepend(div);
    while (this.alerts.children.length > 4) this.alerts.lastChild?.remove();
    setTimeout(() => div.remove(), 12000);
  }

  private showDebrief(hectares: number, houses: number): void {
    const lines = [`${hectares} hectares burnt`];
    if (houses > 0) lines.push(`${houses} homes lost`);
    this.report.textContent = lines.join(' · ');
    this.debrief.hidden = false;
  }
}
