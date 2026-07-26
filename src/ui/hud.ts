import { truck as T } from '../sim/balance';
import type { GameEvent, GameState, Stats, Truck } from '../sim/state';
import { cellAt, inActive } from '../sim/state';
import { briefingFacts, reveals } from './facts';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

function engineStatus(s: GameState, t: Truck): string {
  if (t.path.length > 0) return 'En route';
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (inActive(s, nx, ny) && cellAt(s, nx, ny).state === 'burning') return 'Fighting fire';
    }
  if (t.water < T.waterCapacity) {
    const nearStation = Math.abs(t.x - s.station.x) <= 1 && Math.abs(t.y - s.station.y) <= 1;
    let nearWater = nearStation;
    for (let dy = -1; dy <= 1 && !nearWater; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (inActive(s, t.x + dx, t.y + dy) && cellAt(s, t.x + dx, t.y + dy).type === 'water') {
          nearWater = true;
          break;
        }
    if (nearWater) return 'Refilling';
  }
  return 'Standing by';
}

/**
 * DOM overlay: the growing stat bar (counters join at their reveal season),
 * weather cluster, engine cards, alerts feed, briefing and debrief screens.
 */
export class Hud {
  private hectares = el<HTMLSpanElement>('hectares');
  private animals = el<HTMLSpanElement>('animals');
  private houses = el<HTMLSpanElement>('houses');
  private year = el<HTMLDivElement>('year');
  private windarrow = el<HTMLSpanElement>('windarrow');
  private windspeed = el<HTMLSpanElement>('windspeed');
  private dryness = el<HTMLSpanElement>('dryness');
  private alerts = el<HTMLDivElement>('alerts');
  private seasonfill = el<HTMLDivElement>('seasonfill');
  private selection = el<HTMLDivElement>('selection');
  private briefing = el<HTMLDivElement>('briefing');
  private bYear = el<HTMLHeadingElement>('b-year');
  private bGrowth = el<HTMLParagraphElement>('b-growth');
  private bFact = el<HTMLParagraphElement>('b-fact');
  private debrief = el<HTMLDivElement>('debrief');
  private dTitle = el<HTMLHeadingElement>('d-title');
  private report = el<HTMLDivElement>('report');
  private dCampaign = el<HTMLParagraphElement>('d-campaign');
  private restartBtn = el<HTMLButtonElement>('btn-restart');
  private engines = el<HTMLDivElement>('engines');
  private cards = new Map<number, HTMLButtonElement>();

  constructor(
    private state: GameState,
    private onPinToggle: (truckId: number) => void,
  ) {
    this.applySeason();
    this.buildCards();
  }

  setState(state: GameState): void {
    this.state = state;
    this.applySeason();
    this.debrief.hidden = true;
    this.alerts.replaceChildren();
    this.buildCards();
  }

  private applySeason(): void {
    const s = this.state;
    this.year.textContent = String(s.seasonYear);
    this.dryness.textContent = `dryness ${Math.round(s.dryness * 100)}%`;
    this.animals.hidden = s.seasonYear < reveals.animals;
    this.houses.hidden = s.seasonYear < reveals.houses;
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
    if (!this.animals.hidden) this.animals.textContent = `~${s.stats.animalsKilled} animals`;
    if (!this.houses.hidden) this.houses.textContent = `${s.stats.housesLost} homes lost`;
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
            `Fire reported — grid ${String.fromCharCode(65 + Math.floor((ev.x - this.state.bounds.x0) / 6))}${Math.floor((ev.y - this.state.bounds.y0) / 4) + 1}`,
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
          break; // campaign flow (main.ts) owns the debrief
      }
    }
  }

  /** True while a full-screen overlay (briefing or debrief) covers the game. */
  overlayVisible(): boolean {
    return !this.briefing.hidden || !this.debrief.hidden;
  }

  showBriefing(grew: boolean): void {
    const s = this.state;
    this.bYear.textContent = String(s.seasonYear);
    this.bGrowth.hidden = !grew;
    this.bFact.textContent = briefingFacts[s.seasonYear] ?? '';
    this.briefing.hidden = false;
  }

  hideBriefing(): void {
    this.briefing.hidden = true;
  }

  showDebrief(season: Stats, campaign: Stats, year: number, isFinal: boolean): void {
    const lines = [`${season.hectaresBurnt} hectares burnt`];
    if (year >= reveals.animals) lines.push(`~${season.animalsKilled} animals killed`);
    if (year >= reveals.houses && season.housesLost > 0)
      lines.push(`${season.housesLost} homes lost`);
    this.report.textContent = lines.join(' · ');

    if (isFinal) {
      this.dTitle.textContent = 'The Long Defense — 2070';
      this.dCampaign.textContent =
        `Across 44 years you lost ${campaign.hectaresBurnt} hectares, ` +
        `~${campaign.animalsKilled} animals and ${campaign.housesLost} homes. ` +
        'This forest is invented. The trend is not.';
      this.restartBtn.textContent = 'Start a new campaign';
    } else {
      this.dTitle.textContent = 'Season over — the rains arrive';
      this.dCampaign.textContent =
        year > 2026
          ? `Campaign so far: ${campaign.hectaresBurnt} ha · ~${campaign.animalsKilled} animals · ${campaign.housesLost} homes`
          : '';
      this.restartBtn.textContent = 'Continue';
    }
    this.debrief.hidden = false;
  }

  private pushAlert(text: string): void {
    const div = document.createElement('div');
    div.className = 'alert';
    div.textContent = text;
    this.alerts.prepend(div);
    while (this.alerts.children.length > 4) this.alerts.lastChild?.remove();
    setTimeout(() => div.remove(), 12000);
  }
}
