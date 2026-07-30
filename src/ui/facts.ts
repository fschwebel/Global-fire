import { locale } from './i18n';

/**
 * One sourced climate fact per season briefing (docs/design/progression.md §1.3).
 * Sources are tracked in data/facts.json; re-verification is an M4 release gate.
 * Translations must keep the figures and attributions exactly.
 */
const briefingFactsEn: Record<number, string> = {
  2026: 'The global fire-weather season lengthened ~19% between 1979 and 2013. — Jolly et al., Nature Communications, 2015',
  2030: 'The UN projects extreme fire events to increase by up to 14% by 2030. — UNEP, Spreading like Wildfire, 2022',
  2035: 'In 2022, drought-stricken Europe suffered its second-worst fire season on record: ~837,000 hectares burnt in the EU. — EFFIS/JRC',
  2040: 'Average annual area burned in the US roughly doubled between the 1990s and the 2010s. — NIFC',
  2045: 'During the 2021 Pacific Northwest heat dome, Lytton, BC reached 49.6 °C — and burned to the ground the next day.',
  2050: 'The UN projects extreme fire events to increase by up to 30% by 2050, even under strong emissions cuts. — UNEP, 2022',
  2055: "Canada's record 2023 season burned more than 15 million hectares — over double the previous record — and began unusually early, in May.",
  2060: 'After high-severity fire in a hotter climate, some forests fail to regenerate at all, converting permanently to shrubland.',
  2065: 'The 2018 Camp Fire destroyed ~18,800 structures and killed 85 people in Paradise, California.',
  2070: 'Australia’s Black Summer generated dozens of fire-triggered thunderstorms — fires so large they made their own weather.',
};

const briefingFactsFr: Record<number, string> = {
  2026: 'La saison mondiale de temps propice aux feux s’est allongée d’environ 19 % entre 1979 et 2013. — Jolly et al., Nature Communications, 2015',
  2030: 'L’ONU projette une hausse des feux extrêmes pouvant atteindre 14 % d’ici 2030. — PNUE, Spreading like Wildfire, 2022',
  2035: 'En 2022, une Europe frappée par la sécheresse a subi sa deuxième pire saison de feux jamais enregistrée : ~837 000 hectares brûlés dans l’UE. — EFFIS/JRC',
  2040: 'La surface brûlée annuelle moyenne aux États-Unis a environ doublé entre les années 1990 et les années 2010. — NIFC',
  2045: 'Pendant le dôme de chaleur du Pacifique Nord-Ouest en 2021, Lytton (Colombie-Britannique) a atteint 49,6 °C — et a brûlé entièrement le lendemain.',
  2050: 'L’ONU projette une hausse des feux extrêmes pouvant atteindre 30 % d’ici 2050, même avec de fortes baisses d’émissions. — PNUE, 2022',
  2055: 'La saison record du Canada en 2023 a brûlé plus de 15 millions d’hectares — plus du double du record précédent — et a commencé anormalement tôt, en mai.',
  2060: 'Après un feu de haute sévérité dans un climat plus chaud, certaines forêts ne se régénèrent plus du tout et basculent définitivement en broussailles.',
  2065: 'Le Camp Fire de 2018 a détruit ~18 800 bâtiments et tué 85 personnes à Paradise, en Californie.',
  2070: 'Le Black Summer australien a déclenché des dizaines d’orages générés par les feux — des incendies si vastes qu’ils fabriquaient leur propre météo.',
};

const briefingFactsEs: Record<number, string> = {
  2026: 'La temporada mundial de condiciones meteorológicas propicias al fuego se alargó ~19 % entre 1979 y 2013. — Jolly et al., Nature Communications, 2015',
  2030: 'La ONU proyecta un aumento de los incendios extremos de hasta el 14 % para 2030. — PNUMA, Spreading like Wildfire, 2022',
  2035: 'En 2022, una Europa castigada por la sequía sufrió su segunda peor temporada de incendios registrada: ~837 000 hectáreas quemadas en la UE. — EFFIS/JRC',
  2040: 'La superficie quemada media anual en EE. UU. se duplicó aproximadamente entre los años noventa y la década de 2010. — NIFC',
  2045: 'Durante el domo de calor del Pacífico Noroeste de 2021, Lytton (Columbia Británica) alcanzó 49,6 °C — y ardió por completo al día siguiente.',
  2050: 'La ONU proyecta un aumento de los incendios extremos de hasta el 30 % para 2050, incluso con fuertes recortes de emisiones. — PNUMA, 2022',
  2055: 'La temporada récord de Canadá en 2023 quemó más de 15 millones de hectáreas — más del doble del récord anterior — y empezó inusualmente pronto, en mayo.',
  2060: 'Tras un fuego de alta severidad en un clima más cálido, algunos bosques ya no se regeneran y se convierten para siempre en matorral.',
  2065: 'El Camp Fire de 2018 destruyó ~18 800 edificaciones y mató a 85 personas en Paradise, California.',
  2070: 'El Black Summer australiano generó decenas de tormentas provocadas por el fuego — incendios tan vastos que generaban su propia meteorología.',
};

export const briefingFacts: Record<number, string> = {
  en: briefingFactsEn,
  fr: briefingFactsFr,
  es: briefingFactsEs,
}[locale];

/** "New this season" briefing line — each means arrives free, reassigned to the sector. */
const unlockNotesEn: Record<number, string> = {
  2030: 'New this season: a water bomber, flying in from beyond the valley. Arm 🛩, click where the retardant line starts, then a second cell to aim it.',
  2035: 'New this season: evacuation orders. Arm 📢 and click a village — services move one village at a time, so choose who goes first.',
  2040: 'New this season: two watch towers. Arm 🗼 and place them where nobody would call a fire in — a tower reports smoke almost instantly.',
  2045: 'From this season the fire can overrun a crew: if a rig is surrounded with no way out, you lose them. When the radio calls for pull-out, act.',
  2050: 'New this season: a fire crew (arm ⛏ and click vegetation to cut a firebreak line; any clear tile moves them out of danger) — and a third watch tower.',
  2055: 'New this season: a second water bomber joins the sector.',
  2060: 'A fourth watch tower arrives — the sector has grown, and your eyes must grow with it.',
  2070: 'A fifth watch tower arrives, for whatever it can still see.',
};

const unlockNotesFr: Record<number, string> = {
  2030: 'Nouveau cette saison : un bombardier d’eau, venu d’au-delà de la vallée. Armez 🛩, cliquez là où la ligne de retardant commence, puis une seconde case pour la diriger.',
  2035: 'Nouveau cette saison : les ordres d’évacuation. Armez 📢 et cliquez sur un village — les secours déplacent un village à la fois, choisissez qui part en premier.',
  2040: 'Nouveau cette saison : deux tours de guet. Armez 🗼 et placez-les là où personne ne signalerait un feu — une tour signale la fumée presque instantanément.',
  2045: 'À partir de cette saison, le feu peut submerger une unité : si un véhicule est encerclé sans issue, vous le perdez. Quand la radio demande le repli, agissez.',
  2050: 'Nouveau cette saison : une équipe forestière (armez ⛏ et cliquez sur la végétation pour tailler un pare-feu ; toute case dégagée la met hors de danger) — et une troisième tour de guet.',
  2055: 'Nouveau cette saison : un second bombardier d’eau rejoint le secteur.',
  2060: 'Une quatrième tour de guet arrive — le secteur a grandi, vos yeux doivent grandir avec.',
  2070: 'Une cinquième tour de guet arrive, pour ce qu’elle peut encore voir.',
};

const unlockNotesEs: Record<number, string> = {
  2030: 'Nuevo esta temporada: un avión cisterna que llega de más allá del valle. Arma 🛩, haz clic donde empieza la línea de retardante y luego en una segunda casilla para orientarla.',
  2035: 'Nuevo esta temporada: las órdenes de evacuación. Arma 📢 y haz clic en un pueblo — los servicios mueven un pueblo a la vez, elige quién sale primero.',
  2040: 'Nuevo esta temporada: dos torres de vigilancia. Arma 🗼 y colócalas donde nadie daría el aviso — una torre detecta el humo casi al instante.',
  2045: 'Desde esta temporada el fuego puede atrapar a una unidad: si un vehículo queda rodeado sin salida, lo pierdes. Cuando la radio pida retirada, actúa.',
  2050: 'Nuevo esta temporada: una cuadrilla forestal (arma ⛏ y haz clic en la vegetación para abrir un cortafuegos; cualquier casilla despejada la pone a salvo) — y una tercera torre de vigilancia.',
  2055: 'Nuevo esta temporada: un segundo avión cisterna se une al sector.',
  2060: 'Llega una cuarta torre de vigilancia — el sector ha crecido y tus ojos deben crecer con él.',
  2070: 'Llega una quinta torre de vigilancia, para lo que aún pueda ver.',
};

export const unlockNotes: Record<number, string> = {
  en: unlockNotesEn,
  fr: unlockNotesFr,
  es: unlockNotesEs,
}[locale];

/**
 * Global-mean warming vs pre-industrial per season (°C): central estimates for
 * a middle-of-the-road pathway (IPCC AR6, ≈SSP2-4.5) — progression doc §2.1.
 */
export const warming: Record<number, number> = {
  2026: 1.3,
  2030: 1.4,
  2035: 1.5,
  2040: 1.6,
  2045: 1.75,
  2050: 1.9,
  2055: 2.0,
  2060: 2.1,
  2065: 2.25,
  2070: 2.35,
};

/**
 * Hot extremes over many land regions warm at roughly 1.5–2× the global-mean
 * rate (IPCC AR6 WG1: at +2 °C global, a 1-in-10-year heat event runs ≈ +2.6 °C).
 * The in-game peak-day estimate uses the low end of that range.
 */
export const hotDayFactor = 1.5;

/** Peak-day warming estimate for a season year, °C to one decimal. */
export function hotDayAt(year: number): number {
  return Math.round((warming[year] ?? 0) * hotDayFactor * 10) / 10;
}

/**
 * Frequency multipliers vs 1850–1900 for once-per-decade events, by global
 * warming level (IPCC AR6 SPM, Fig. SPM.6): agricultural/ecological drought
 * in drying regions, and heat events over land.
 */
const freqAnchors: Record<'drought' | 'heat', [number, number][]> = {
  drought: [
    [1.0, 1.7],
    [1.5, 2.0],
    [2.0, 2.4],
    [4.0, 4.1],
  ],
  heat: [
    [1.0, 2.8],
    [1.5, 4.1],
    [2.0, 5.6],
    [4.0, 9.4],
  ],
};

function interpolate(points: [number, number][], x: number): number {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]!;
    const [x2, y2] = points[i]!;
    if (x <= x2) return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
  }
  return last[1];
}

/**
 * How often a once-a-decade event returns at this season's warming level,
 * in years rounded to the nearest half — the plain-language form of the
 * AR6 frequency multipliers.
 */
export function returnPeriodYears(kind: 'drought' | 'heat', year: number): number {
  const mult = interpolate(freqAnchors[kind], warming[year] ?? 1);
  return Math.round((10 / mult) * 2) / 2;
}

/** Season year each loss counter joins the stat bar (canon: progression doc §1.3). */
export const reveals = {
  animals: 2030,
  houses: 2035,
  /** Revealed at zero — the counter itself is the warning. */
  firefighters: 2045,
  civilians: 2050,
};
