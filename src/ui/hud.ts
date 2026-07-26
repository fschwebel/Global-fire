import { bomber as B, crewUnit as CU, truck as T, unlocks } from '../sim/balance';
import type { Bomber, Crew, GameEvent, GameState, Stats, Truck } from '../sim/state';
import { cellAt, inActive } from '../sim/state';
import { briefingFacts, hotDayAt, reveals, unlockNotes, warming } from './facts';

export type Tool = 'engine' | 'evac' | 'bomber' | 'tower' | 'crew';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

/**
 * One-line loss summary that respects the reveal schedule: a counter the
 * player hasn't been introduced to must never leak through campaign totals.
 */
export function statLine(stats: Stats, year: number): string {
  const parts = [`${stats.hectaresBurnt} ha`];
  if (year >= reveals.animals) parts.push(`~${stats.animalsKilled} animals`);
  if (year >= reveals.houses) parts.push(`${stats.housesLost} homes`);
  if (year >= reveals.firefighters) parts.push(`${stats.firefightersLost} firefighters`);
  if (year >= reveals.civilians) parts.push(`${stats.civiliansLost} people`);
  return parts.join(' · ');
}

function engineStatus(s: GameState, t: Truck): string {
  if (t.dangerTicks > 0) return 'IN DANGER — pull out!';
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

function bomberStatus(b: Bomber): string {
  switch (b.state) {
    case 'ready':
      return 'Ready';
    case 'outbound':
      return 'Outbound';
    case 'dropping':
      return 'Dropping';
    case 'returning':
      return 'Returning';
    case 'reloading':
      return 'Reloading';
  }
}

function bomberLoad(b: Bomber): number {
  if (b.state === 'ready' || b.state === 'outbound' || b.state === 'dropping') return 1;
  if (b.state === 'reloading') return 1 - b.phaseTicks / B.reloadTicks;
  return 0;
}

function crewStatus(c: Crew): string {
  if (c.dangerTicks > 0) return 'IN DANGER — pull out!';
  if (c.path.length > 0) return 'En route';
  if (c.jobs.length > 0) return 'Cutting';
  return 'Standing by';
}

const SELECTION_TEXT: Record<Tool, string> = {
  engine:
    'Click the map — the nearest engine responds. Click an engine card to take direct control.',
  evac: 'Evacuation: click a village to order it out. Clearing takes time — order early.',
  bomber: 'Water bomber: click where the retardant line should start.',
  tower: 'Watch tower: click the map to raise it. It reports fires around it almost instantly.',
  crew: 'Fire crew: click vegetation tiles to cut them into a firebreak line. Esc when done.',
};

/**
 * DOM overlay: the growing stat bar (counters join at their reveal season),
 * the measures palette (tools light up at their unlock season), unit cards,
 * weather cluster, alerts feed, briefing and debrief screens.
 */
export class Hud {
  private hectares = el<HTMLSpanElement>('hectares');
  private animals = el<HTMLSpanElement>('animals');
  private houses = el<HTMLSpanElement>('houses');
  private ffs = el<HTMLSpanElement>('ffs');
  private civs = el<HTMLSpanElement>('civs');
  private year = el<HTMLDivElement>('year');
  private bTemp = el<HTMLParagraphElement>('b-temp');
  private bTempAvg = el<HTMLSpanElement>('b-temp-avg');
  private bTempMax = el<HTMLSpanElement>('b-temp-max');
  private windarrow = el<HTMLSpanElement>('windarrow');
  private windspeed = el<HTMLSpanElement>('windspeed');
  private dryness = el<HTMLSpanElement>('dryness');
  private alerts = el<HTMLDivElement>('alerts');
  private seasonfill = el<HTMLDivElement>('seasonfill');
  private selection = el<HTMLDivElement>('selection');
  private briefing = el<HTMLDivElement>('briefing');
  private bYear = el<HTMLHeadingElement>('b-year');
  private bGrowth = el<HTMLParagraphElement>('b-growth');
  private bUnlock = el<HTMLParagraphElement>('b-unlock');
  private bFact = el<HTMLParagraphElement>('b-fact');
  private debrief = el<HTMLDivElement>('debrief');
  private dTitle = el<HTMLHeadingElement>('d-title');
  private report = el<HTMLDivElement>('report');
  private dCampaign = el<HTMLParagraphElement>('d-campaign');
  private restartBtn = el<HTMLButtonElement>('btn-restart');
  private engines = el<HTMLDivElement>('engines');
  private towerCount = el<HTMLSpanElement>('tower-count');
  private toolButtons: Record<Tool, HTMLButtonElement> = {
    engine: el<HTMLButtonElement>('tool-engine'),
    evac: el<HTMLButtonElement>('tool-evac'),
    bomber: el<HTMLButtonElement>('tool-bomber'),
    tower: el<HTMLButtonElement>('tool-tower'),
    crew: el<HTMLButtonElement>('tool-crew'),
  };
  private cards = new Map<number, HTMLButtonElement>();
  private bomberCards = new Map<number, HTMLButtonElement>();
  private crewCards = new Map<number, HTMLButtonElement>();
  private tool: Tool = 'engine';
  private bomberAnchorSet = false;

  constructor(
    private state: GameState,
    private onPinToggle: (truckId: number) => void,
    private onToolSelect: (tool: Tool) => void,
  ) {
    for (const [tool, btn] of Object.entries(this.toolButtons) as [Tool, HTMLButtonElement][]) {
      btn.addEventListener('click', () => {
        if (!btn.classList.contains('locked')) this.onToolSelect(tool);
      });
    }
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

  setTool(tool: Tool): void {
    this.tool = tool;
    for (const [name, btn] of Object.entries(this.toolButtons) as [Tool, HTMLButtonElement][])
      btn.classList.toggle('active', name === tool);
  }

  /** The bomber order is mid-aim: the first cell is placed, the direction is next. */
  setBomberAnchor(set: boolean): void {
    this.bomberAnchorSet = set;
  }

  private applySeason(): void {
    const s = this.state;
    this.year.textContent = String(s.seasonYear);
    this.dryness.textContent = `dryness ${Math.round(s.dryness * 100)}%`;
    this.animals.hidden = s.seasonYear < reveals.animals;
    this.houses.hidden = s.seasonYear < reveals.houses;
    this.ffs.hidden = s.seasonYear < reveals.firefighters;
    this.civs.hidden = s.seasonYear < reveals.civilians;

    const lock = (tool: Tool, unlockYear: number, title: string) => {
      const btn = this.toolButtons[tool];
      const locked = s.seasonYear < unlockYear;
      btn.classList.toggle('locked', locked);
      btn.title = locked ? `Unlocks in ${unlockYear}` : title;
    };
    lock('evac', unlocks.evacuate, 'Evacuation order — click a village to move its people out');
    lock('bomber', unlocks.bomber, 'Water bomber — click the map to call a drop');
    lock('tower', unlocks.towers, 'Watch tower — place it to detect fires early');
    lock('crew', unlocks.crew, 'Fire crew — click vegetation to cut a firebreak line');
  }

  private buildCards(): void {
    this.engines.replaceChildren();
    this.cards.clear();
    this.bomberCards.clear();
    this.crewCards.clear();
    for (const t of this.state.trucks) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'engine-card';
      card.innerHTML = `<strong>Engine ${t.id}</strong><span class="status"></span><div class="waterbar"><div></div></div>`;
      card.addEventListener('click', () => this.onPinToggle(t.id));
      this.engines.append(card);
      this.cards.set(t.id, card);
    }
    for (const b of this.state.bombers) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'engine-card';
      card.innerHTML = `<strong>Bomber ${b.id}</strong><span class="status"></span><div class="waterbar"><div></div></div>`;
      card.addEventListener('click', () => this.onToolSelect('bomber'));
      this.engines.append(card);
      this.bomberCards.set(b.id, card);
    }
    for (const c of this.state.crews) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'engine-card';
      card.innerHTML = `<strong>Crew ${c.id}</strong><span class="status"></span>`;
      card.addEventListener('click', () => this.onToolSelect('crew'));
      this.engines.append(card);
      this.crewCards.set(c.id, card);
    }
  }

  update(pinnedTruckId: number | null): void {
    const s = this.state;
    this.hectares.textContent = `${s.stats.hectaresBurnt} ha burnt`;
    if (!this.animals.hidden) this.animals.textContent = `~${s.stats.animalsKilled} animals`;
    if (!this.houses.hidden) this.houses.textContent = `${s.stats.housesLost} homes lost`;
    if (!this.ffs.hidden) this.ffs.textContent = `${s.stats.firefightersLost} firefighters`;
    if (!this.civs.hidden) this.civs.textContent = `${s.stats.civiliansLost} people`;
    this.windarrow.style.transform = `rotate(${s.wind.dir}rad)`;
    this.windspeed.textContent = `${Math.round(s.wind.str * 30)} km/h`;
    this.seasonfill.style.width = `${Math.min(100, (s.tick / s.seasonLen) * 100)}%`;

    this.towerCount.hidden = s.towersAvailable <= 0;
    this.towerCount.textContent = `×${s.towersAvailable}`;

    for (const [id, card] of this.cards) {
      const t = s.trucks.find((tr) => tr.id === id);
      if (!t) {
        // Overrun this season — the card stays as a memorial.
        this.markLost(card, `${T.crew} firefighters lost`);
        continue;
      }
      card.classList.toggle('pinned', t.id === pinnedTruckId);
      card.classList.toggle('danger', t.dangerTicks > 0);
      const status = card.querySelector<HTMLSpanElement>('.status');
      if (status) status.textContent = engineStatus(s, t);
      const bar = card.querySelector<HTMLDivElement>('.waterbar > div');
      if (bar) bar.style.width = `${(t.water / T.waterCapacity) * 100}%`;
    }
    for (const b of s.bombers) {
      const card = this.bomberCards.get(b.id);
      if (!card) continue;
      const status = card.querySelector<HTMLSpanElement>('.status');
      if (status) status.textContent = bomberStatus(b);
      const bar = card.querySelector<HTMLDivElement>('.waterbar > div');
      if (bar) bar.style.width = `${bomberLoad(b) * 100}%`;
    }
    for (const [id, card] of this.crewCards) {
      const c = s.crews.find((cr) => cr.id === id);
      if (!c) {
        this.markLost(card, `${CU.crew} firefighters lost`);
        continue;
      }
      card.classList.toggle('danger', c.dangerTicks > 0);
      const status = card.querySelector<HTMLSpanElement>('.status');
      if (status)
        status.textContent =
          crewStatus(c) + (c.jobs.length > 1 ? ` · ${c.jobs.length} cuts queued` : '');
    }

    this.selection.textContent =
      this.tool === 'engine' && pinnedTruckId !== null
        ? `Controlling Engine ${pinnedTruckId} — click the map to send it. Esc to release.`
        : this.tool === 'bomber' && this.bomberAnchorSet
          ? 'Now click a second cell — the line runs from the anchor toward it. Esc to cancel.'
          : SELECTION_TEXT[this.tool];
  }

  handle(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'fireDetected':
          this.pushAlert(
            `Fire reported — grid ${String.fromCharCode(65 + Math.floor((ev.x - this.state.bounds.x0) / 6))}${Math.floor((ev.y - this.state.bounds.y0) / 4) + 1}`,
          );
          break;
        case 'engineDispatched':
          this.flashCard(this.cards.get(ev.truckId));
          break;
        case 'bomberDispatched':
          this.flashCard(this.bomberCards.get(ev.bomberId));
          break;
        case 'crewDispatched':
          this.flashCard(this.crewCards.get(ev.crewId));
          break;
        case 'evacuationStarted':
          this.pushAlert('Evacuation ordered — the village is on the move.');
          break;
        case 'evacuationComplete':
          this.pushAlert('Village clear — everyone is out.');
          break;
        case 'bomberDrop':
          this.pushAlert('Water drop on target.');
          break;
        case 'towerPlaced':
          this.pushAlert('Watch tower raised.');
          break;
        case 'civilianDeaths':
          this.pushAlert(
            ev.count === 1 ? '1 resident did not escape.' : `${ev.count} residents did not escape.`,
          );
          break;
        case 'crewDanger':
          this.pushAlert(
            ev.unit === 'engine'
              ? `Engine ${ev.unitId} requesting pull-out — get them clear!`
              : 'Fire crew requesting pull-out — get them clear!',
          );
          break;
        case 'unitLost':
          this.pushAlert(
            ev.unit === 'engine'
              ? `MAYDAY — Engine ${ev.unitId} overrun. ${ev.firefighters} firefighters lost.`
              : `MAYDAY — the fire crew was overrun. ${ev.firefighters} firefighters lost.`,
          );
          break;
        case 'windShift':
          this.pushAlert('Wind shift — fronts will turn.');
          break;
        case 'reliefRain':
          this.pushAlert('Rain moves through the valley.');
          break;
        case 'seasonWindingDown':
          this.pushAlert('All fires are out — the season winds down.');
          break;
        case 'seasonEnded':
          break; // campaign flow (main.ts) owns the debrief
      }
    }
  }

  private flashCard(card: HTMLButtonElement | undefined): void {
    if (!card) return;
    card.classList.remove('flash');
    void card.offsetWidth; // restart the animation
    card.classList.add('flash');
  }

  private markLost(card: HTMLButtonElement, text: string): void {
    if (card.classList.contains('lost')) return;
    card.classList.add('lost');
    card.classList.remove('danger', 'pinned');
    card.disabled = true;
    const status = card.querySelector<HTMLSpanElement>('.status');
    if (status) status.textContent = text;
    const bar = card.querySelector<HTMLDivElement>('.waterbar > div');
    if (bar) bar.style.width = '0%';
  }

  /** True while a full-screen overlay (briefing or debrief) covers the game. */
  overlayVisible(): boolean {
    return !this.briefing.hidden || !this.debrief.hidden;
  }

  showBriefing(grew: boolean): void {
    const s = this.state;
    this.bYear.textContent = String(s.seasonYear);
    const avg = warming[s.seasonYear];
    this.bTemp.hidden = avg === undefined;
    if (avg !== undefined) {
      this.bTempAvg.textContent = `≈ +${avg} °C above pre-industrial — the global average (IPCC AR6, middle-of-the-road pathway)`;
      this.bTempMax.textContent = `Averages hide the peaks: summer's hottest days here run ≈ +${hotDayAt(s.seasonYear)} °C.`;
      this.bTemp.title =
        'Central estimate vs pre-industrial for a middle-of-the-road emissions pathway (IPCC AR6, ≈SSP2-4.5). A global average understates a fire season: land warms faster than the mean, and hot extremes rise roughly 1.5–2× faster (IPCC AR6 WG1) — the peak-day figure uses the low end of that range.';
    }
    this.bGrowth.hidden = !grew;
    const unlock = unlockNotes[s.seasonYear];
    this.bUnlock.hidden = !unlock;
    this.bUnlock.textContent = unlock ?? '';
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
    if (year >= reveals.firefighters && season.firefightersLost > 0)
      lines.push(`${season.firefightersLost} firefighters lost`);
    if (year >= reveals.civilians && season.civiliansLost > 0)
      lines.push(`${season.civiliansLost} people lost`);
    this.report.textContent = lines.join(' · ');

    if (isFinal) {
      this.dTitle.textContent = 'The Long Defense — 2070';
      const people =
        campaign.civiliansLost > 0
          ? ` and ${campaign.civiliansLost} of the people you protected`
          : '';
      this.dCampaign.textContent = `Across 44 years you lost ${campaign.hectaresBurnt} hectares, ~${campaign.animalsKilled} animals, ${campaign.housesLost} homes${people}. This forest is invented. The trend is not.`;
      this.restartBtn.textContent = 'Start a new campaign';
    } else {
      this.dTitle.textContent = 'Season over — the rains arrive';
      this.dCampaign.textContent =
        year > 2026 ? `Campaign so far: ${statLine(campaign, year)}` : '';
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
