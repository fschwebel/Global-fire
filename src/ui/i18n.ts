/**
 * Internationalization: every user-facing string, per locale.
 *
 * The locale is picked once at boot from the browser's language preferences —
 * French when any preferred language is `fr*`, English otherwise. Catalog
 * entries are plain strings or functions of their parameters; `fr` is typed
 * against `en` so a missing translation is a compile error.
 *
 * French strings use U+00A0 (no-break space) before tall punctuation and
 * units, per French typography.
 */

export type Locale = 'en' | 'fr';

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of prefs) {
    const lower = (lang ?? '').toLowerCase();
    if (lower.startsWith('fr')) return 'fr';
    if (lower.startsWith('en')) return 'en';
  }
  return 'en';
}

export const locale: Locale = detectLocale();

/** BCP-47 tag for number formatting (decimal comma in French). */
export const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US';

/** Locale-aware number rendering: 1.3 → "1.3" / "1,3"; 12800 → "12,800" / "12 800". */
export function fmt(n: number): string {
  return n.toLocaleString(numberLocale);
}

const en = {
  // --- Unit cards ------------------------------------------------------------
  cardEngine: (id: number) => `Engine ${id}`,
  cardBomber: (id: number) => `Bomber ${id}`,
  cardCrew: (id: number) => `Crew ${id}`,
  statusDanger: 'IN DANGER — pull out!',
  statusEnRoute: 'En route',
  statusFighting: 'Fighting fire',
  statusRefilling: 'Refilling',
  statusStandingBy: 'Standing by',
  statusCutting: 'Cutting',
  bomberReady: 'Ready',
  bomberOutbound: 'Outbound',
  bomberDropping: 'Dropping',
  bomberReturning: 'Returning',
  bomberReloading: 'Reloading',
  statusGroundedDrought: 'Grounded — drought',
  exhaustedSuffix: ' · exhausted',
  cutsQueued: (n: number) => ` · ${n} cuts queued`,
  lostFirefighters: (n: number) => `${n} firefighters lost`,

  // --- Top bar ---------------------------------------------------------------
  haBurnt: (n: number) => `${fmt(n)} ha burnt`,
  animalsTop: (n: number) => `~${fmt(n)} animals`,
  homesLostTop: (n: number) => `${fmt(n)} homes lost`,
  firefightersTop: (n: number) => `${fmt(n)} firefighters`,
  peopleTop: (n: number) => `${fmt(n)} people`,
  dryness: (pct: number) => `dryness ${pct}%`,
  windKmh: (n: number) => `${n} km/h`,

  // --- Campaign stat line (respects the reveal schedule) -----------------------
  haShort: (n: number) => `${fmt(n)} ha`,
  animalsShort: (n: number) => `~${fmt(n)} animals`,
  homesShort: (n: number) => `${fmt(n)} homes`,
  firefightersShort: (n: number) => `${fmt(n)} firefighters`,
  peopleShort: (n: number) => `${fmt(n)} people`,

  // --- Selection help line -----------------------------------------------------
  selEngine:
    'Click the map — the nearest engine responds. Click an engine card to take direct control.',
  selEvac: 'Evacuation: click a village to order it out. Clearing takes time — order early.',
  selBomber: 'Water bomber: click where the retardant line should start.',
  selTower: 'Watch tower: click the map to raise it. It reports fires around it almost instantly.',
  selCrew: 'Fire crew: click vegetation tiles to cut them into a firebreak line. Esc when done.',
  selControlling: (id: number) =>
    `Controlling Engine ${id} — click the map to send it. Esc to release.`,
  selBomberAim: 'Now click a second cell — the line runs from the anchor toward it. Esc to cancel.',

  // --- Tool tooltips -------------------------------------------------------------
  ttEngine: 'Dispatch engine — click the map, the nearest engine responds',
  ttEvac: 'Evacuation order — click a village to move its people out',
  ttBomber: 'Water bomber — click the map to call a drop',
  ttTower: 'Watch tower — place it to detect fires early',
  ttCrew: 'Fire crew — click vegetation to cut a firebreak line',
  ttUnlocks: (year: number) => `Unlocks in ${year}`,
  ttEvacBusy: 'Emergency services are mid-evacuation — one village at a time',
  ttEvacRegroup: 'Emergency services are regrouping',
  ttBomberGrounded: 'Grounded — the drought left no water to drop',
  ttTowersDone: 'All towers placed',
  ttCrewGone: 'The crew is gone this season',

  // --- Alerts ----------------------------------------------------------------------
  alertResidents: (n: number) =>
    n === 1 ? '1 resident did not escape.' : `${n} residents did not escape.`,
  alertFire: (ref: string) => `Fire reported — grid ${ref}`,
  alertEvacStarted: 'Evacuation ordered — the village is on the move.',
  alertEvacComplete: 'Village clear — everyone is out.',
  alertDrop: 'Water drop on target.',
  alertTower: 'Watch tower raised.',
  alertDangerEngine: (id: number) => `Engine ${id} requesting pull-out — get them clear!`,
  alertDangerCrew: 'Fire crew requesting pull-out — get them clear!',
  alertMaydayEngine: (id: number, n: number) =>
    `MAYDAY — Engine ${id} overrun. ${n} firefighters lost.`,
  alertMaydayCrew: (n: number) => `MAYDAY — the fire crew was overrun. ${n} firefighters lost.`,
  alertWindShift: 'Wind shift — fronts will turn.',
  alertRain: 'Rain moves through the valley.',
  alertRiverDry:
    'Extreme drought — the river has run dry. No refills, the bombers are grounded, and fire may cross the bed.',
  alertWinddown: 'All fires are out — the season winds down.',

  // --- Client-side notifications (invalid orders) -------------------------------------
  nfEvacBusy: 'Emergency services are mid-evacuation — one village at a time.',
  nfEvacRegroup: 'Emergency services are regrouping — the next order must wait.',
  nfBomberGrounded: 'The drought has grounded the bombers — there is no water to drop.',
  nfNoBomberReady: 'No bomber ready — rearming beyond the valley.',
  nfNoTowers: 'No towers left to place.',
  nfBadTowerGround: "That ground won't take a tower.",
  nfCrewGone: 'The crew is gone this season.',

  // --- Briefing --------------------------------------------------------------------
  degNum: (avg: number) => `≈ +${fmt(avg)} °C`,
  returnEvery: (yrs: number) => `now every ~${fmt(yrs)} yrs`,
  peakPlus: (deg: number) => `≈ +${fmt(deg)} °C`,
  climateTooltip:
    'Central estimate vs pre-industrial for a middle-of-the-road emissions pathway (IPCC AR6, ≈SSP2-4.5). Return periods interpolate the AR6 SPM frequency increases for once-per-decade droughts (drying regions) and heat events over land. Hot extremes rise roughly 1.5–2× faster than the global mean — the peak-day figure uses the low end of that range.',

  // --- Debrief / finale ---------------------------------------------------------------
  debriefFinalTitle: 'The Long Defense — 2070',
  debriefSeasonTitle: 'Season over — the rains arrive',
  btnNewCampaign: 'Start a new campaign',
  btnContinue: 'Continue',
  campaignSoFar: (line: string) => `Campaign so far: ${line}`,
  reportHa: (n: number) => `${fmt(n)} hectares burnt`,
  reportAnimals: (n: number) => `~${fmt(n)} animals killed`,
  reportHomes: (n: number) => `${fmt(n)} homes lost`,
  reportFirefighters: (n: number) => `${fmt(n)} firefighters lost`,
  reportPeople: (n: number) => `${fmt(n)} people lost`,
  savedLine: (ha: number, homes: number, lives: number) =>
    `Your defense saved ≈ ${fmt(ha)} hectares, ${fmt(homes)} homes and ${fmt(lives)} lives.`,
  costLine: (n: number) => `It cost ${n} firefighters. They held lines that could not all be held.`,

  // --- Static page text (applied over index.html at boot, keyed by element id) --------
  epitaph1: 'This forest is invented. The trend is not.',
  epitaph2: 'The decades you just defended are the ones we are living in.',
  staticDom: {
    'b-climate-head': 'The climate this season',
    'b-deg-label': 'global average, above pre-industrial',
    'b-drought-label': 'Once-a-decade drought',
    'b-heat-label': 'Once-a-decade heatwave',
    'b-peak-label': 'Hottest summer days here',
    'b-climate-note':
      'A global average understates a fire season — land warms faster, extremes faster still.',
    'b-climate-src':
      'Source: IPCC Sixth Assessment Report (AR6) — central estimates, middle-of-the-road pathway (≈SSP2-4.5)',
    'b-growth':
      'The department has widened your sector — more forest, more people, yours to protect.',
    'btn-begin': 'Begin season',
    'd-title': 'Season over — the rains arrive',
    'd-verdict': 'You never stopped the fire. You decided what survived it.',
    'c-head-you': 'Your 44 years',
    'c-head-not': 'Left unfought',
    'c-row-ha': 'Forest burnt',
    'c-row-an': 'Animals killed',
    'c-row-ho': 'Homes lost',
    'c-row-pe': 'People lost',
    'd-links-head': 'To go deeper — real reports and resources, outside the game:',
    'link-science-label': 'Understand the science',
    'link-un-label': 'The UN wildfire report',
    'link-home-label': 'Prepare your home',
    'btn-restart': 'Continue',
  } as Record<string, string>,
  staticTitles: {
    'tool-engine': 'Dispatch engine — click the map, the nearest engine responds',
    'link-science': 'Opens ipcc.ch in a new tab',
    'link-un': 'Opens unep.org in a new tab',
    'link-home': 'Opens nfpa.org in a new tab',
  } as Record<string, string>,
};

type Catalog = typeof en;

const fr: Catalog = {
  // --- Cartes d'unités ---------------------------------------------------------
  cardEngine: (id: number) => `Camion ${id}`,
  cardBomber: (id: number) => `Bombardier ${id}`,
  cardCrew: (id: number) => `Équipe ${id}`,
  statusDanger: 'EN DANGER — repli !',
  statusEnRoute: 'En route',
  statusFighting: 'Combat le feu',
  statusRefilling: 'Remplissage',
  statusStandingBy: 'En attente',
  statusCutting: 'Coupe en cours',
  bomberReady: 'Prêt',
  bomberOutbound: 'En approche',
  bomberDropping: 'Largage',
  bomberReturning: 'Retour base',
  bomberReloading: 'Rechargement',
  statusGroundedDrought: 'Cloué au sol — sécheresse',
  exhaustedSuffix: ' · épuisés',
  cutsQueued: (n: number) => ` · ${n} coupes en attente`,
  lostFirefighters: (n: number) => `${n} pompiers perdus`,

  // --- Barre du haut -------------------------------------------------------------
  haBurnt: (n: number) => `${fmt(n)} ha brûlés`,
  animalsTop: (n: number) => `~${fmt(n)} animaux`,
  homesLostTop: (n: number) => `${fmt(n)} maisons perdues`,
  firefightersTop: (n: number) => `${fmt(n)} pompiers`,
  peopleTop: (n: number) => `${fmt(n)} habitants`,
  dryness: (pct: number) => `sécheresse ${pct} %`,
  windKmh: (n: number) => `${n} km/h`,

  // --- Ligne de bilan de campagne ---------------------------------------------------
  haShort: (n: number) => `${fmt(n)} ha`,
  animalsShort: (n: number) => `~${fmt(n)} animaux`,
  homesShort: (n: number) => `${fmt(n)} maisons`,
  firefightersShort: (n: number) => `${fmt(n)} pompiers`,
  peopleShort: (n: number) => `${fmt(n)} habitants`,

  // --- Ligne d'aide de sélection ------------------------------------------------------
  selEngine:
    'Cliquez sur la carte — le camion le plus proche répond. Cliquez sur une carte de camion pour en prendre le contrôle.',
  selEvac:
    "Évacuation : cliquez sur un village pour ordonner son départ. Évacuer prend du temps — donnez l'ordre tôt.",
  selBomber: "Bombardier d'eau : cliquez là où la ligne de retardant doit commencer.",
  selTower:
    'Tour de guet : cliquez sur la carte pour l’ériger. Elle signale presque instantanément les feux alentour.',
  selCrew:
    'Équipe forestière : cliquez des cases de végétation pour tailler un pare-feu. Échap pour terminer.',
  selControlling: (id: number) =>
    `Contrôle du Camion ${id} — cliquez sur la carte pour l’envoyer. Échap pour relâcher.`,
  selBomberAim:
    'Cliquez maintenant une seconde case — la ligne part de l’ancrage vers elle. Échap pour annuler.',

  // --- Info-bulles des mesures ----------------------------------------------------------
  ttEngine: 'Envoyer un camion — cliquez sur la carte, le plus proche répond',
  ttEvac: "Ordre d'évacuation — cliquez sur un village pour faire partir ses habitants",
  ttBomber: "Bombardier d'eau — cliquez sur la carte pour demander un largage",
  ttTower: 'Tour de guet — placez-la pour détecter les feux tôt',
  ttCrew: 'Équipe forestière — cliquez sur la végétation pour tailler un pare-feu',
  ttUnlocks: (year: number) => `Disponible en ${year}`,
  ttEvacBusy: 'Les secours sont en pleine évacuation — un village à la fois',
  ttEvacRegroup: 'Les secours se regroupent',
  ttBomberGrounded: "Cloués au sol — la sécheresse n'a laissé aucune eau à larguer",
  ttTowersDone: 'Toutes les tours sont placées',
  ttCrewGone: 'L’équipe est perdue pour cette saison',

  // --- Alertes ---------------------------------------------------------------------------
  alertResidents: (n: number) =>
    n === 1 ? '1 habitant n’a pas pu fuir.' : `${n} habitants n’ont pas pu fuir.`,
  alertFire: (ref: string) => `Feu signalé — zone ${ref}`,
  alertEvacStarted: 'Évacuation ordonnée — le village se met en route.',
  alertEvacComplete: 'Village évacué — tout le monde est sorti.',
  alertDrop: 'Largage sur objectif.',
  alertTower: 'Tour de guet érigée.',
  alertDangerEngine: (id: number) => `Le Camion ${id} demande le repli — dégagez-le !`,
  alertDangerCrew: 'L’équipe forestière demande le repli — dégagez-la !',
  alertMaydayEngine: (id: number, n: number) =>
    `MAYDAY — Camion ${id} submergé par le feu. ${n} pompiers perdus.`,
  alertMaydayCrew: (n: number) =>
    `MAYDAY — l’équipe forestière a été submergée. ${n} pompiers perdus.`,
  alertWindShift: 'Le vent tourne — les fronts vont pivoter.',
  alertRain: 'La pluie traverse la vallée.',
  alertRiverDry:
    'Sécheresse extrême — la rivière est à sec. Plus de remplissage, bombardiers cloués au sol, et le feu peut traverser le lit.',
  alertWinddown: 'Tous les feux sont éteints — la saison touche à sa fin.',

  // --- Notifications côté client -----------------------------------------------------------
  nfEvacBusy: 'Les secours sont en pleine évacuation — un village à la fois.',
  nfEvacRegroup: 'Les secours se regroupent — le prochain ordre devra attendre.',
  nfBomberGrounded: 'La sécheresse a cloué les bombardiers au sol — plus d’eau à larguer.',
  nfNoBomberReady: 'Aucun bombardier prêt — réarmement au-delà de la vallée.',
  nfNoTowers: 'Plus aucune tour à placer.',
  nfBadTowerGround: 'Ce terrain ne peut pas recevoir de tour.',
  nfCrewGone: 'L’équipe est perdue pour cette saison.',

  // --- Briefing ------------------------------------------------------------------------------
  degNum: (avg: number) => `≈ +${fmt(avg)} °C`,
  returnEvery: (yrs: number) => `désormais tous les ~${fmt(yrs)} ans`,
  peakPlus: (deg: number) => `≈ +${fmt(deg)} °C`,
  climateTooltip:
    'Estimation centrale par rapport au préindustriel, pour une trajectoire d’émissions intermédiaire (GIEC AR6, ≈SSP2-4.5). Les périodes de retour interpolent les hausses de fréquence du résumé AR6 pour les sécheresses décennales (régions en assèchement) et les épisodes de chaleur sur les terres. Les extrêmes chauds augmentent environ 1,5 à 2 fois plus vite que la moyenne mondiale — l’estimation des jours de pointe retient le bas de cette fourchette.',

  // --- Débriefing / finale ----------------------------------------------------------------------
  debriefFinalTitle: 'La Longue Défense — 2070',
  debriefSeasonTitle: 'Fin de saison — les pluies arrivent',
  btnNewCampaign: 'Nouvelle campagne',
  btnContinue: 'Continuer',
  campaignSoFar: (line: string) => `Campagne à ce jour : ${line}`,
  reportHa: (n: number) => `${fmt(n)} hectares brûlés`,
  reportAnimals: (n: number) => `~${fmt(n)} animaux tués`,
  reportHomes: (n: number) => `${fmt(n)} maisons perdues`,
  reportFirefighters: (n: number) => `${fmt(n)} pompiers perdus`,
  reportPeople: (n: number) => `${fmt(n)} habitants perdus`,
  savedLine: (ha: number, homes: number, lives: number) =>
    `Votre défense a sauvé ≈ ${fmt(ha)} hectares, ${fmt(homes)} maisons et ${fmt(lives)} vies.`,
  costLine: (n: number) =>
    `Elle a coûté ${n} pompiers. Ils ont tenu des lignes qui ne pouvaient pas toutes être tenues.`,

  // --- Texte statique de la page --------------------------------------------------------------------
  epitaph1: 'Cette forêt est inventée. La tendance, non.',
  epitaph2: 'Les décennies que vous venez de défendre sont celles que nous vivons.',
  staticDom: {
    'b-climate-head': 'Le climat cette saison',
    'b-deg-label': 'moyenne mondiale, au-dessus du préindustriel',
    'b-drought-label': 'Sécheresse décennale',
    'b-heat-label': 'Canicule décennale',
    'b-peak-label': 'Jours d’été les plus chauds ici',
    'b-climate-note':
      'Une moyenne mondiale sous-estime une saison des feux — les terres se réchauffent plus vite, les extrêmes plus vite encore.',
    'b-climate-src':
      'Source : GIEC, sixième rapport d’évaluation (AR6) — estimations centrales, trajectoire intermédiaire (≈SSP2-4.5)',
    'b-growth':
      'Le département a élargi votre secteur — plus de forêt, plus d’habitants, à vous de les protéger.',
    'btn-begin': 'Commencer la saison',
    'd-title': 'Fin de saison — les pluies arrivent',
    'd-verdict': 'Vous n’avez jamais arrêté le feu. Vous avez décidé de ce qui lui survivrait.',
    'c-head-you': 'Vos 44 ans',
    'c-head-not': 'Sans intervention',
    'c-row-ha': 'Forêt brûlée',
    'c-row-an': 'Animaux tués',
    'c-row-ho': 'Maisons perdues',
    'c-row-pe': 'Habitants perdus',
    'd-links-head': 'Pour aller plus loin — rapports et ressources réels, hors du jeu :',
    'link-science-label': 'Comprendre la science',
    'link-un-label': 'Le rapport de l’ONU sur les incendies',
    'link-home-label': 'Protéger votre maison',
    'btn-restart': 'Continuer',
  },
  staticTitles: {
    'tool-engine': 'Envoyer un camion — cliquez sur la carte, le plus proche répond',
    'link-science': 'Ouvre ipcc.ch dans un nouvel onglet',
    'link-un': 'Ouvre unep.org dans un nouvel onglet',
    'link-home': 'Ouvre nfpa.org dans un nouvel onglet',
  },
};

/** The active string catalog. */
export const L: Catalog = locale === 'fr' ? fr : en;

/**
 * Overwrite index.html's static English text with the active catalog — applied
 * for both locales so the catalog stays the single source of truth (the HTML
 * text remains as a no-JS fallback only).
 */
export function applyStaticText(): void {
  document.documentElement.lang = locale;
  for (const [id, text] of Object.entries(L.staticDom)) {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  }
  for (const [id, title] of Object.entries(L.staticTitles)) {
    const node = document.getElementById(id);
    if (node) node.title = title;
  }
  const epitaph = document.getElementById('d-epitaph');
  if (epitaph) {
    epitaph.replaceChildren(
      document.createTextNode(L.epitaph1),
      document.createElement('br'),
      document.createTextNode(L.epitaph2),
    );
  }
}
