import { bomber as B, crewUnit as CU, danger as DR, truck as T, unlocks } from '../sim/balance';
import type { Bomber, Crew, GameEvent, GameState, Stats, Truck } from '../sim/state';
import { cellAt, inActive } from '../sim/state';
import { briefingFacts, hotDayAt, returnPeriodYears, reveals, unlockNotes, warming } from './facts';
import { L, fmt } from './i18n';

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
  const parts = [L.haShort(stats.hectaresBurnt)];
  if (year >= reveals.animals) parts.push(L.animalsShort(stats.animalsKilled));
  if (year >= reveals.houses) parts.push(L.homesShort(stats.housesLost));
  if (year >= reveals.firefighters) parts.push(L.firefightersShort(stats.firefightersLost));
  if (year >= reveals.civilians) parts.push(L.peopleShort(stats.civiliansLost));
  return parts.join(' · ');
}

function engineStatus(s: GameState, t: Truck): string {
  if (t.dangerTicks > 0) return L.statusDanger;
  if (t.path.length > 0) return L.statusEnRoute;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (inActive(s, nx, ny) && cellAt(s, nx, ny).state === 'burning') return L.statusFighting;
    }
  if (t.water < T.waterCapacity) {
    let nearWater = false;
    for (let dy = -1; dy <= 1 && !nearWater; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (inActive(s, t.x + dx, t.y + dy) && cellAt(s, t.x + dx, t.y + dy).type === 'water') {
          nearWater = true;
          break;
        }
    if (nearWater) return L.statusRefilling;
  }
  return L.statusStandingBy;
}

function bomberStatus(b: Bomber): string {
  switch (b.state) {
    case 'ready':
      return L.bomberReady;
    case 'outbound':
      return L.bomberOutbound;
    case 'dropping':
      return L.bomberDropping;
    case 'returning':
      return L.bomberReturning;
    case 'reloading':
      return L.bomberReloading;
  }
}

function bomberLoad(b: Bomber): number {
  if (b.state === 'ready' || b.state === 'outbound' || b.state === 'dropping') return 1;
  if (b.state === 'reloading') return 1 - b.phaseTicks / B.reloadTicks;
  return 0;
}

function crewStatus(c: Crew): string {
  if (c.dangerTicks > 0) return L.statusDanger;
  if (c.path.length > 0) return L.statusEnRoute;
  if (c.jobs.length > 0) return L.statusCutting;
  return L.statusStandingBy;
}

const SELECTION_TEXT: Record<Tool, string> = {
  engine: L.selEngine,
  evac: L.selEvac,
  bomber: L.selBomber,
  tower: L.selTower,
  crew: L.selCrew,
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
  private bClimate = el<HTMLElement>('b-climate');
  private bClimateSrc = el<HTMLParagraphElement>('b-climate-src');
  private bDegNum = el<HTMLSpanElement>('b-deg-num');
  private bDrought = el<HTMLElement>('b-drought');
  private bHeat = el<HTMLElement>('b-heat');
  private bPeak = el<HTMLElement>('b-peak');
  private windarrow = el<HTMLSpanElement>('windarrow');
  private windspeed = el<HTMLSpanElement>('windspeed');
  private dryness = el<HTMLSpanElement>('dryness');
  private alerts = el<HTMLDivElement>('alerts');
  private seasonfill = el<HTMLDivElement>('seasonfill');
  private selection = el<HTMLDivElement>('selection');
  private splash = el<HTMLDivElement>('splash');
  private briefing = el<HTMLDivElement>('briefing');
  private bYear = el<HTMLHeadingElement>('b-year');
  private bGrowth = el<HTMLParagraphElement>('b-growth');
  private bUnlock = el<HTMLParagraphElement>('b-unlock');
  private bFact = el<HTMLParagraphElement>('b-fact');
  private about = el<HTMLDivElement>('about');
  private debrief = el<HTMLDivElement>('debrief');
  private dTitle = el<HTMLHeadingElement>('d-title');
  private report = el<HTMLDivElement>('report');
  private dCampaign = el<HTMLParagraphElement>('d-campaign');
  private dFinal = el<HTMLDivElement>('d-final');
  private dSaved = el<HTMLDivElement>('d-saved');
  private dCost = el<HTMLDivElement>('d-cost');
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
  /** Live alerts age on GAME time — they hold while paused. Kind tags let events retire them. */
  private liveAlerts: { div: HTMLDivElement; ms: number; kind: string }[] = [];
  private lastUpdateAt = performance.now();

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
    this.liveAlerts = [];
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
    this.dryness.textContent = L.dryness(Math.round(s.dryness * 100));
    this.animals.hidden = s.seasonYear < reveals.animals;
    this.houses.hidden = s.seasonYear < reveals.houses;
    this.ffs.hidden = s.seasonYear < reveals.firefighters;
    this.civs.hidden = s.seasonYear < reveals.civilians;

    const lock = (tool: Tool, unlockYear: number, title: string) => {
      const btn = this.toolButtons[tool];
      const locked = s.seasonYear < unlockYear;
      btn.classList.toggle('locked', locked);
      btn.title = locked ? L.ttUnlocks(unlockYear) : title;
    };
    lock('evac', unlocks.evacuate, L.ttEvac);
    lock('bomber', unlocks.bomber, L.ttBomber);
    lock('tower', unlocks.towers, L.ttTower);
    lock('crew', unlocks.crew, L.ttCrew);
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
      card.innerHTML = `<strong>${L.cardEngine(t.id)}</strong><span class="status"></span><div class="waterbar"><div></div></div>`;
      card.addEventListener('click', () => this.onPinToggle(t.id));
      this.engines.append(card);
      this.cards.set(t.id, card);
    }
    for (const b of this.state.bombers) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'engine-card';
      card.innerHTML = `<strong>${L.cardBomber(b.id)}</strong><span class="status"></span><div class="waterbar"><div></div></div>`;
      card.addEventListener('click', () => this.onToolSelect('bomber'));
      this.engines.append(card);
      this.bomberCards.set(b.id, card);
    }
    for (const c of this.state.crews) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'engine-card';
      card.innerHTML = `<strong>${L.cardCrew(c.id)}</strong><span class="status"></span>`;
      card.addEventListener('click', () => this.onToolSelect('crew'));
      this.engines.append(card);
      this.crewCards.set(c.id, card);
    }
  }

  update(pinnedTruckId: number | null, running = true): void {
    const s = this.state;
    const now = performance.now();
    const dt = Math.min(now - this.lastUpdateAt, 100);
    this.lastUpdateAt = now;
    if (running) this.ageAlerts(dt);

    // A depleted resource reads as locked, with an honest tooltip.
    if (s.seasonYear >= unlocks.evacuate) {
      const busy = s.villages.some((v) => v.evac === 'inProgress');
      const regrouping = !busy && s.tick < s.evacReadyAtTick;
      this.toolButtons.evac.classList.toggle('locked', busy || regrouping);
      this.toolButtons.evac.title = busy ? L.ttEvacBusy : regrouping ? L.ttEvacRegroup : L.ttEvac;
    }
    if (s.seasonYear >= unlocks.bomber) {
      const grounded = s.script.drought?.done === true;
      this.toolButtons.bomber.classList.toggle('locked', grounded);
      this.toolButtons.bomber.title = grounded ? L.ttBomberGrounded : L.ttBomber;
    }
    if (s.seasonYear >= unlocks.towers) {
      const depleted = s.towersAvailable <= 0;
      this.toolButtons.tower.classList.toggle('locked', depleted);
      this.toolButtons.tower.title = depleted ? L.ttTowersDone : L.ttTower;
    }
    if (s.seasonYear >= unlocks.crew) {
      const gone = s.crews.length === 0;
      this.toolButtons.crew.classList.toggle('locked', gone);
      this.toolButtons.crew.title = gone ? L.ttCrewGone : L.ttCrew;
    }

    this.hectares.textContent = L.haBurnt(s.stats.hectaresBurnt);
    if (!this.animals.hidden) this.animals.textContent = L.animalsTop(s.stats.animalsKilled);
    if (!this.houses.hidden) this.houses.textContent = L.homesLostTop(s.stats.housesLost);
    if (!this.ffs.hidden) this.ffs.textContent = L.firefightersTop(s.stats.firefightersLost);
    if (!this.civs.hidden) this.civs.textContent = L.peopleTop(s.stats.civiliansLost);
    this.windarrow.style.transform = `rotate(${s.wind.dir}rad)`;
    this.windspeed.textContent = L.windKmh(Math.round(s.wind.str * 30));
    this.seasonfill.style.width = `${Math.min(100, (s.tick / s.seasonLen) * 100)}%`;

    this.towerCount.hidden = s.towersAvailable <= 0;
    this.towerCount.textContent = `×${s.towersAvailable}`;

    for (const [id, card] of this.cards) {
      const t = s.trucks.find((tr) => tr.id === id);
      if (!t) {
        // Overrun this season — the card stays as a memorial.
        this.markLost(card, L.lostFirefighters(T.crew));
        continue;
      }
      card.classList.toggle('pinned', t.id === pinnedTruckId);
      card.classList.toggle('danger', t.dangerTicks > 0);
      const status = card.querySelector<HTMLSpanElement>('.status');
      if (status)
        status.textContent =
          engineStatus(s, t) + (t.fatigue >= DR.fatigueGraceEvery ? L.exhaustedSuffix : '');
      const bar = card.querySelector<HTMLDivElement>('.waterbar > div');
      if (bar) bar.style.width = `${(t.water / T.waterCapacity) * 100}%`;
    }
    for (const b of s.bombers) {
      const card = this.bomberCards.get(b.id);
      if (!card) continue;
      const status = card.querySelector<HTMLSpanElement>('.status');
      if (status)
        status.textContent =
          s.script.drought?.done && b.state === 'ready' ? L.statusGroundedDrought : bomberStatus(b);
      const bar = card.querySelector<HTMLDivElement>('.waterbar > div');
      // Grounded by drought: the tank reads empty — there is no water to carry.
      const grounded =
        s.script.drought?.done === true && (b.state === 'ready' || b.state === 'reloading');
      if (bar) bar.style.width = grounded ? '0%' : `${bomberLoad(b) * 100}%`;
    }
    for (const [id, card] of this.crewCards) {
      const c = s.crews.find((cr) => cr.id === id);
      if (!c) {
        this.markLost(card, L.lostFirefighters(CU.crew));
        continue;
      }
      card.classList.toggle('danger', c.dangerTicks > 0);
      const status = card.querySelector<HTMLSpanElement>('.status');
      if (status)
        status.textContent =
          crewStatus(c) +
          (c.jobs.length > 1 ? L.cutsQueued(c.jobs.length) : '') +
          (c.fatigue >= DR.fatigueGraceEvery ? L.exhaustedSuffix : '');
    }

    this.selection.textContent =
      this.tool === 'engine' && pinnedTruckId !== null
        ? L.selControlling(pinnedTruckId)
        : this.tool === 'bomber' && this.bomberAnchorSet
          ? L.selBomberAim
          : SELECTION_TEXT[this.tool];
  }

  handle(events: GameEvent[]): void {
    // A village collapsing in one tick must not flood the stack: one line, summed.
    // Silent before the people counter's reveal season — the loss is recorded,
    // but the game only speaks of it once the counter exists.
    const deaths = events.reduce((n, e) => (e.type === 'civilianDeaths' ? n + e.count : n), 0);
    if (deaths > 0 && this.state.seasonYear >= reveals.civilians)
      this.pushAlert(L.alertResidents(deaths));
    for (const ev of events) {
      switch (ev.type) {
        case 'fireDetected':
          // A new fire cancels any standing wind-down notice — it is no longer true.
          this.dropAlerts((kind) => kind === 'winddown');
          this.pushAlert(
            L.alertFire(
              `${String.fromCharCode(65 + Math.floor((ev.x - this.state.bounds.x0) / 6))}${Math.floor((ev.y - this.state.bounds.y0) / 4) + 1}`,
            ),
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
          this.pushAlert(L.alertEvacStarted);
          break;
        case 'evacuationComplete':
          this.pushAlert(L.alertEvacComplete);
          break;
        case 'bomberDrop':
          this.pushAlert(L.alertDrop);
          break;
        case 'towerPlaced':
          this.pushAlert(L.alertTower);
          break;
        case 'civilianDeaths':
          break; // coalesced above
        case 'crewDanger':
          this.pushAlert(
            ev.unit === 'engine' ? L.alertDangerEngine(ev.unitId) : L.alertDangerCrew,
            `danger-${ev.unit}-${ev.unitId}`,
          );
          break;
        case 'unitLost':
          // The pull-out call is over; the MAYDAY replaces it.
          this.dropAlerts((kind) => kind === `danger-${ev.unit}-${ev.unitId}`);
          this.pushAlert(
            ev.unit === 'engine'
              ? L.alertMaydayEngine(ev.unitId, ev.firefighters)
              : L.alertMaydayCrew(ev.firefighters),
          );
          break;
        case 'windShift':
          this.pushAlert(L.alertWindShift);
          break;
        case 'reliefRain':
          this.pushAlert(L.alertRain);
          break;
        case 'riverDry':
          this.pushAlert(L.alertRiverDry);
          break;
        case 'seasonWindingDown':
          this.pushAlert(L.alertWinddown, 'winddown');
          break;
        case 'seasonEnded':
          this.dropAlerts(() => true); // the debrief takes over
          break;
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

  /** True while a full-screen overlay (splash, briefing, debrief or About) covers the game. */
  overlayVisible(): boolean {
    return (
      !this.splash.hidden || !this.briefing.hidden || !this.debrief.hidden || !this.about.hidden
    );
  }

  aboutVisible(): boolean {
    return !this.about.hidden;
  }

  showAbout(): void {
    this.about.hidden = false;
  }

  hideAbout(): void {
    this.about.hidden = true;
  }

  /** First-contact splash for brand-new players; sits above the briefing. */
  showSplash(): void {
    this.splash.hidden = false;
  }

  hideSplash(): void {
    this.splash.hidden = true;
  }

  showBriefing(grew: boolean): void {
    const s = this.state;
    this.bYear.textContent = String(s.seasonYear);
    const avg = warming[s.seasonYear];
    this.bClimate.hidden = avg === undefined;
    this.bClimateSrc.hidden = avg === undefined;
    if (avg !== undefined) {
      this.bDegNum.textContent = L.degNum(avg);
      this.bDrought.textContent = L.returnEvery(returnPeriodYears('drought', s.seasonYear));
      this.bHeat.textContent = L.returnEvery(returnPeriodYears('heat', s.seasonYear));
      this.bPeak.textContent = L.peakPlus(hotDayAt(s.seasonYear));
      this.bClimate.title = L.climateTooltip;
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

  showDebrief(
    season: Stats,
    campaign: Stats,
    year: number,
    isFinal: boolean,
    unfought: Stats | null = null,
  ): void {
    const lines = [L.reportHa(season.hectaresBurnt)];
    if (year >= reveals.animals) lines.push(L.reportAnimals(season.animalsKilled));
    if (year >= reveals.houses && season.housesLost > 0)
      lines.push(L.reportHomes(season.housesLost));
    if (year >= reveals.firefighters && season.firefightersLost > 0)
      lines.push(L.reportFirefighters(season.firefightersLost));
    if (year >= reveals.civilians && season.civiliansLost > 0)
      lines.push(L.reportPeople(season.civiliansLost));
    this.report.textContent = lines.join(' · ');

    if (isFinal) {
      this.dTitle.textContent = L.debriefFinalTitle;
      this.dFinal.hidden = false;
      this.dCampaign.hidden = true;
      this.fillFinale(campaign, unfought);
      this.restartBtn.textContent = L.btnNewCampaign;
    } else {
      this.dTitle.textContent = L.debriefSeasonTitle;
      this.dFinal.hidden = true;
      this.dCampaign.hidden = false;
      this.dCampaign.textContent = year > 2026 ? L.campaignSoFar(statLine(campaign, year)) : '';
      this.restartBtn.textContent = L.btnContinue;
    }
    this.debrief.hidden = false;
  }

  /** The retrospective: your 44 years against the same valley left unfought. */
  private fillFinale(campaign: Stats, unfought: Stats | null): void {
    const num = (n: number) => fmt(n);
    const cell = (id: string, text: string) => {
      el<HTMLTableCellElement>(id).textContent = text;
    };
    const hasComparison = unfought !== null;
    el<HTMLTableElement>('d-compare').hidden = !hasComparison;
    this.dSaved.hidden = !hasComparison;
    if (unfought) {
      cell('c-ha-you', L.haShort(campaign.hectaresBurnt));
      cell('c-ha-not', L.haShort(unfought.hectaresBurnt));
      cell('c-an-you', `~${num(campaign.animalsKilled)}`);
      cell('c-an-not', `~${num(unfought.animalsKilled)}`);
      cell('c-ho-you', num(campaign.housesLost));
      cell('c-ho-not', num(unfought.housesLost));
      cell('c-pe-you', num(campaign.civiliansLost));
      cell('c-pe-not', num(unfought.civiliansLost));
      const ha = Math.max(0, unfought.hectaresBurnt - campaign.hectaresBurnt);
      const homes = Math.max(0, unfought.housesLost - campaign.housesLost);
      const lives = Math.max(0, unfought.civiliansLost - campaign.civiliansLost);
      this.dSaved.textContent = L.savedLine(ha, homes, lives);
    }
    this.dCost.hidden = campaign.firefightersLost === 0;
    if (campaign.firefightersLost > 0)
      this.dCost.textContent = L.costLine(campaign.firefightersLost);
  }

  /** Client-side feedback (invalid order, nothing available) — same channel as sim alerts. */
  notify(text: string): void {
    this.pushAlert(text);
  }

  private pushAlert(text: string, kind = 'info'): void {
    const div = document.createElement('div');
    div.className = 'alert';
    div.textContent = text;
    this.alerts.prepend(div);
    this.liveAlerts.unshift({ div, ms: 8000, kind });
    while (this.liveAlerts.length > 4) this.liveAlerts.pop()?.div.remove();
  }

  /** Age alerts on game time only — paused reading costs nothing — with a soft fade-out. */
  private ageAlerts(dtMs: number): void {
    for (const a of this.liveAlerts) {
      a.ms -= dtMs;
      if (a.ms <= 500) a.div.classList.add('fadeout');
    }
    this.liveAlerts = this.liveAlerts.filter((a) => {
      if (a.ms <= 0) {
        a.div.remove();
        return false;
      }
      return true;
    });
  }

  private dropAlerts(match: (kind: string) => boolean): void {
    this.liveAlerts = this.liveAlerts.filter((a) => {
      if (match(a.kind)) {
        a.div.remove();
        return false;
      }
      return true;
    });
  }
}
