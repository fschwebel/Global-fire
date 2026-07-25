import type { GameEvent, GameState } from '../sim/state';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

const FACT_2026 =
  'The global fire-weather season lengthened ~19% between 1979 and 2013. — Jolly et al., Nature Communications, 2015';

/** DOM overlay: stat bar, weather cluster, alerts feed, time controls, debrief. */
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

  constructor(private state: GameState) {
    this.year.textContent = String(state.seasonYear);
    this.dryness.textContent = `dryness ${Math.round(state.dryness * 100)}%`;
    this.fact.textContent = FACT_2026;
  }

  setState(state: GameState): void {
    this.state = state;
    this.year.textContent = String(state.seasonYear);
    this.debrief.hidden = true;
    this.alerts.replaceChildren();
  }

  update(selectedTruckId: number | null): void {
    const s = this.state;
    this.hectares.textContent = `${s.stats.hectaresBurnt} ha burnt`;
    this.windarrow.style.transform = `rotate(${s.wind.dir}rad)`;
    this.windspeed.textContent = `${Math.round(s.wind.str * 30)} km/h`;
    this.seasonfill.style.width = `${Math.min(100, (s.tick / s.seasonLen) * 100)}%`;
    const truck = s.trucks.find((t) => t.id === selectedTruckId);
    this.selection.textContent = truck
      ? `Engine ${truck.id} — water ${truck.water}/24${truck.path.length ? ' · en route' : ''}`
      : 'Click an engine to select, then click the map to send it.';
  }

  handle(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'fireDetected':
          this.pushAlert(
            `Fire reported — grid ${String.fromCharCode(65 + Math.floor(ev.x / 6))}${Math.floor(ev.y / 4) + 1}`,
          );
          break;
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
