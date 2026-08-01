/**
 * Internationalization: every user-facing string, per locale.
 *
 * The locale is picked once at boot from the browser's language preferences —
 * the first preference matching French, Spanish or English wins; anything else
 * falls back to English. Catalog entries are plain strings or functions of
 * their parameters; `fr` and `es` are typed against `en` so a missing
 * translation is a compile error.
 *
 * French strings use U+00A0 (no-break space) before tall punctuation and
 * units, per French typography. Spanish uses inverted marks where due.
 */

export type Locale = 'en' | 'fr' | 'es';

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of prefs) {
    const lower = (lang ?? '').toLowerCase();
    if (lower.startsWith('fr')) return 'fr';
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('en')) return 'en';
  }
  return 'en';
}

export const locale: Locale = detectLocale();

/** BCP-47 tag for number formatting (decimal comma in French and Spanish). */
export const numberLocale = locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US';

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
  statusTankEmpty: 'Tank empty — refill at the river',
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
    's-cmd': 'Valley Fire Command — Summer 2026',
    's-welcome':
      'Welcome, recruit — glad to have you on board. Things are getting tense this season.',
    'btn-splash': 'Report for duty',
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
    'btn-about': 'About the game',
    'a-title': 'About the game',
    'a-p1':
      'You are not meant to win. Each season follows the IPCC’s central warming projections, and each season the fire outgrows the means sent against it. That is not bad balance — it is the point.',
    'a-p2':
      'Real firefighting is the same: once a big fire is running, crews mostly choose what burns last. What works happens before the first spark — tended forests, firebreaks, early detection, and above all limiting the warming itself.',
    'a-links-head': 'To go further, outside the game:',
    'alink-science-label': 'Understand the science',
    'alink-un-label': 'The UN wildfire report',
    'alink-home-label': 'Prepare your home',
    'btn-about-close': 'Close',
    'btn-toohard': 'Too hard?',
    'btn-restart': 'Continue',
  } as Record<string, string>,
  staticTitles: {
    'tool-engine': 'Dispatch engine — click the map, the nearest engine responds',
    'link-science': 'Opens ipcc.ch in a new tab',
    'link-un': 'Opens unep.org in a new tab',
    'link-home': 'Opens nfpa.org in a new tab',
    'alink-science': 'Opens ipcc.ch in a new tab',
    'alink-un': 'Opens unep.org in a new tab',
    'alink-home': 'Opens nfpa.org in a new tab',
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
  statusTankEmpty: 'Réservoir vide — remplissez à la rivière',
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
    's-cmd': 'PC Feux de la Vallée — Été 2026',
    's-welcome':
      'Bienvenue, recrue — heureux de vous compter parmi nous. La saison s’annonce tendue.',
    'btn-splash': 'Prendre mon poste',
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
    'btn-about': 'À propos du jeu',
    'a-title': 'À propos du jeu',
    'a-p1':
      'Vous n’êtes pas censé gagner. Chaque saison suit les projections centrales de réchauffement du GIEC, et chaque saison le feu dépasse les moyens envoyés contre lui. Ce n’est pas un défaut d’équilibrage — c’est le propos.',
    'a-p2':
      'La lutte réelle est pareille : quand un grand feu court, les équipes choisissent surtout ce qui brûlera en dernier. Ce qui marche se joue avant la première étincelle — forêts entretenues, pare-feu, détection précoce, et surtout limiter le réchauffement lui-même.',
    'a-links-head': 'Pour aller plus loin, hors du jeu :',
    'alink-science-label': 'Comprendre la science',
    'alink-un-label': 'Le rapport de l’ONU sur les incendies',
    'alink-home-label': 'Protéger votre maison',
    'btn-about-close': 'Fermer',
    'btn-toohard': 'Trop dur ?',
    'btn-restart': 'Continuer',
  },
  staticTitles: {
    'tool-engine': 'Envoyer un camion — cliquez sur la carte, le plus proche répond',
    'link-science': 'Ouvre ipcc.ch dans un nouvel onglet',
    'link-un': 'Ouvre unep.org dans un nouvel onglet',
    'link-home': 'Ouvre nfpa.org dans un nouvel onglet',
    'alink-science': 'Ouvre ipcc.ch dans un nouvel onglet',
    'alink-un': 'Ouvre unep.org dans un nouvel onglet',
    'alink-home': 'Ouvre nfpa.org dans un nouvel onglet',
  },
};

const es: Catalog = {
  // --- Tarjetas de unidades ------------------------------------------------------
  cardEngine: (id: number) => `Camión ${id}`,
  cardBomber: (id: number) => `Avión ${id}`,
  cardCrew: (id: number) => `Cuadrilla ${id}`,
  statusDanger: '¡EN PELIGRO — retirada!',
  statusEnRoute: 'En camino',
  statusFighting: 'Combatiendo el fuego',
  statusRefilling: 'Recargando agua',
  statusStandingBy: 'En espera',
  statusCutting: 'Cortando',
  bomberReady: 'Listo',
  bomberOutbound: 'En aproximación',
  bomberDropping: 'Descargando',
  bomberReturning: 'Regresando',
  bomberReloading: 'Recargando',
  statusTankEmpty: 'Depósito vacío — recarga en el río',
  statusGroundedDrought: 'En tierra — sequía',
  exhaustedSuffix: ' · agotados',
  cutsQueued: (n: number) => ` · ${n} cortes en cola`,
  lostFirefighters: (n: number) => `${n} bomberos perdidos`,

  // --- Barra superior --------------------------------------------------------------
  haBurnt: (n: number) => `${fmt(n)} ha quemadas`,
  animalsTop: (n: number) => `~${fmt(n)} animales`,
  homesLostTop: (n: number) => `${fmt(n)} casas perdidas`,
  firefightersTop: (n: number) => `${fmt(n)} bomberos`,
  peopleTop: (n: number) => `${fmt(n)} habitantes`,
  dryness: (pct: number) => `sequedad ${pct} %`,
  windKmh: (n: number) => `${n} km/h`,

  // --- Línea de balance de campaña ----------------------------------------------------
  haShort: (n: number) => `${fmt(n)} ha`,
  animalsShort: (n: number) => `~${fmt(n)} animales`,
  homesShort: (n: number) => `${fmt(n)} casas`,
  firefightersShort: (n: number) => `${fmt(n)} bomberos`,
  peopleShort: (n: number) => `${fmt(n)} habitantes`,

  // --- Línea de ayuda de selección ------------------------------------------------------
  selEngine:
    'Haz clic en el mapa — responde el camión más cercano. Haz clic en la tarjeta de un camión para tomar el control directo.',
  selEvac:
    'Evacuación: haz clic en un pueblo para ordenar su salida. Evacuar lleva tiempo — da la orden pronto.',
  selBomber: 'Avión cisterna: haz clic donde debe comenzar la línea de retardante.',
  selTower:
    'Torre de vigilancia: haz clic en el mapa para levantarla. Avisa casi al instante de los fuegos cercanos.',
  selCrew:
    'Cuadrilla forestal: haz clic en casillas de vegetación para abrir un cortafuegos. Esc para terminar.',
  selControlling: (id: number) =>
    `Controlando el Camión ${id} — haz clic en el mapa para enviarlo. Esc para soltarlo.`,
  selBomberAim:
    'Ahora haz clic en una segunda casilla — la línea irá del ancla hacia ella. Esc para cancelar.',

  // --- Descripciones de las medidas ------------------------------------------------------
  ttEngine: 'Enviar un camión — haz clic en el mapa y responde el más cercano',
  ttEvac: 'Orden de evacuación — haz clic en un pueblo para sacar a su gente',
  ttBomber: 'Avión cisterna — haz clic en el mapa para pedir una descarga',
  ttTower: 'Torre de vigilancia — colócala para detectar los fuegos pronto',
  ttCrew: 'Cuadrilla forestal — haz clic en la vegetación para abrir un cortafuegos',
  ttUnlocks: (year: number) => `Disponible en ${year}`,
  ttEvacBusy: 'Los servicios de emergencia están en plena evacuación — un pueblo a la vez',
  ttEvacRegroup: 'Los servicios de emergencia se están reagrupando',
  ttBomberGrounded: 'En tierra — la sequía no dejó agua que descargar',
  ttTowersDone: 'Todas las torres colocadas',
  ttCrewGone: 'La cuadrilla se perdió esta temporada',

  // --- Alertas ---------------------------------------------------------------------------
  alertResidents: (n: number) =>
    n === 1 ? '1 habitante no pudo escapar.' : `${n} habitantes no pudieron escapar.`,
  alertFire: (ref: string) => `Fuego avistado — zona ${ref}`,
  alertEvacStarted: 'Evacuación ordenada — el pueblo se pone en marcha.',
  alertEvacComplete: 'Pueblo evacuado — no queda nadie.',
  alertDrop: 'Descarga sobre el objetivo.',
  alertTower: 'Torre de vigilancia levantada.',
  alertDangerEngine: (id: number) => `¡El Camión ${id} pide retirada — sácalos de ahí!`,
  alertDangerCrew: '¡La cuadrilla pide retirada — sácalos de ahí!',
  alertMaydayEngine: (id: number, n: number) =>
    `MAYDAY — Camión ${id} atrapado por el fuego. ${n} bomberos perdidos.`,
  alertMaydayCrew: (n: number) =>
    `MAYDAY — la cuadrilla quedó atrapada por el fuego. ${n} bomberos perdidos.`,
  alertWindShift: 'Cambio de viento — los frentes girarán.',
  alertRain: 'La lluvia cruza el valle.',
  alertRiverDry:
    'Sequía extrema — el río se ha secado. Sin recargas, los aviones en tierra, y el fuego puede cruzar el cauce.',
  alertWinddown: 'Todos los fuegos están apagados — la temporada llega a su fin.',

  // --- Avisos del lado del cliente -----------------------------------------------------------
  nfEvacBusy: 'Los servicios de emergencia están en plena evacuación — un pueblo a la vez.',
  nfEvacRegroup: 'Los servicios de emergencia se reagrupan — la próxima orden debe esperar.',
  nfBomberGrounded: 'La sequía dejó los aviones en tierra — no hay agua que descargar.',
  nfNoBomberReady: 'Ningún avión listo — recargando más allá del valle.',
  nfNoTowers: 'No quedan torres por colocar.',
  nfBadTowerGround: 'Ese terreno no admite una torre.',
  nfCrewGone: 'La cuadrilla se perdió esta temporada.',

  // --- Sesión informativa ---------------------------------------------------------------------
  degNum: (avg: number) => `≈ +${fmt(avg)} °C`,
  returnEvery: (yrs: number) => `ahora cada ~${fmt(yrs)} años`,
  peakPlus: (deg: number) => `≈ +${fmt(deg)} °C`,
  climateTooltip:
    'Estimación central respecto al preindustrial para una trayectoria de emisiones intermedia (IPCC AR6, ≈SSP2-4.5). Los períodos de retorno interpolan los aumentos de frecuencia del resumen del AR6 para sequías decenales (regiones en desecación) y episodios de calor sobre tierra. Los extremos cálidos suben entre 1,5 y 2 veces más rápido que la media global — la estimación de los días más cálidos usa el extremo inferior de ese rango.',

  // --- Balance / final -------------------------------------------------------------------------
  debriefFinalTitle: 'La Larga Defensa — 2070',
  debriefSeasonTitle: 'Fin de temporada — llegan las lluvias',
  btnNewCampaign: 'Empezar una nueva campaña',
  btnContinue: 'Continuar',
  campaignSoFar: (line: string) => `Campaña hasta ahora: ${line}`,
  reportHa: (n: number) => `${fmt(n)} hectáreas quemadas`,
  reportAnimals: (n: number) => `~${fmt(n)} animales muertos`,
  reportHomes: (n: number) => `${fmt(n)} casas perdidas`,
  reportFirefighters: (n: number) => `${fmt(n)} bomberos perdidos`,
  reportPeople: (n: number) => `${fmt(n)} habitantes perdidos`,
  savedLine: (ha: number, homes: number, lives: number) =>
    `Tu defensa salvó ≈ ${fmt(ha)} hectáreas, ${fmt(homes)} casas y ${fmt(lives)} vidas.`,
  costLine: (n: number) =>
    `Costó ${n} bomberos. Sostuvieron líneas que no podían sostenerse todas.`,

  // --- Texto estático de la página --------------------------------------------------------------
  epitaph1: 'Este bosque es inventado. La tendencia, no.',
  epitaph2: 'Las décadas que acabas de defender son las que estamos viviendo.',
  staticDom: {
    's-cmd': 'Mando de Incendios del Valle — Verano 2026',
    's-welcome':
      'Te damos la bienvenida, recluta — nos alegra tenerte a bordo. La temporada se anuncia tensa.',
    'btn-splash': 'Presentarse al servicio',
    'b-climate-head': 'El clima esta temporada',
    'b-deg-label': 'media global, sobre el nivel preindustrial',
    'b-drought-label': 'Sequía decenal',
    'b-heat-label': 'Ola de calor decenal',
    'b-peak-label': 'Los días de verano más cálidos aquí',
    'b-climate-note':
      'Una media global subestima una temporada de incendios — las zonas terrestres se calientan más rápido, y los extremos aún más.',
    'b-climate-src':
      'Fuente: IPCC, Sexto Informe de Evaluación (AR6) — estimaciones centrales, trayectoria intermedia (≈SSP2-4.5)',
    'b-growth':
      'El departamento ha ampliado tu sector — más bosque, más gente, y te toca protegerlos.',
    'btn-begin': 'Comenzar la temporada',
    'd-title': 'Fin de temporada — llegan las lluvias',
    'd-verdict': 'Nunca detuviste el fuego. Decidiste qué le sobreviviría.',
    'c-head-you': 'Tus 44 años',
    'c-head-not': 'Sin intervención',
    'c-row-ha': 'Bosque quemado',
    'c-row-an': 'Animales muertos',
    'c-row-ho': 'Casas perdidas',
    'c-row-pe': 'Habitantes perdidos',
    'd-links-head': 'Para profundizar — informes y recursos reales, fuera del juego:',
    'link-science-label': 'Entender la ciencia',
    'link-un-label': 'El informe de la ONU sobre incendios',
    'link-home-label': 'Proteger tu casa',
    'btn-about': 'Acerca del juego',
    'a-title': 'Acerca del juego',
    'a-p1':
      'No se supone que ganes. Cada temporada sigue las proyecciones centrales de calentamiento del IPCC, y cada temporada el fuego supera los medios enviados contra él. No es un fallo de equilibrio — es el propósito.',
    'a-p2':
      'La lucha real es igual: cuando un gran incendio corre, las cuadrillas sobre todo eligen qué será lo último en arder. Lo que funciona ocurre antes de la primera chispa — bosques cuidados, cortafuegos, detección temprana y, sobre todo, limitar el propio calentamiento.',
    'a-links-head': 'Para ir más lejos, fuera del juego:',
    'alink-science-label': 'Entender la ciencia',
    'alink-un-label': 'El informe de la ONU sobre incendios',
    'alink-home-label': 'Proteger tu casa',
    'btn-about-close': 'Cerrar',
    'btn-toohard': '¿Demasiado difícil?',
    'btn-restart': 'Continuar',
  },
  staticTitles: {
    'tool-engine': 'Enviar un camión — haz clic en el mapa y responde el más cercano',
    'link-science': 'Abre ipcc.ch en una pestaña nueva',
    'link-un': 'Abre unep.org en una pestaña nueva',
    'link-home': 'Abre nfpa.org en una pestaña nueva',
    'alink-science': 'Abre ipcc.ch en una pestaña nueva',
    'alink-un': 'Abre unep.org en una pestaña nueva',
    'alink-home': 'Abre nfpa.org en una pestaña nueva',
  },
};

/** The active string catalog. */
export const L: Catalog = locale === 'fr' ? fr : locale === 'es' ? es : en;

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
