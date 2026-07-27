/**
 * GA4 game events, sent through the gtag stub defined inline in index.html.
 * Fire-and-forget: when gtag.js is blocked (ad blockers) or absent (tests),
 * calls queue harmlessly or no-op — gameplay must never depend on analytics.
 *
 * The event set answers one question: how far into the campaign do players
 * get, and what does each season cost them?
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type Params = Record<string, string | number>;

function track(event: string, params?: Params): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', event, params);
}

/** A briefing was dismissed and a season began (fresh boot counts too). */
export function trackSeasonStarted(year: number, seasonIndex: number, resumed: boolean): void {
  track('season_started', { year, season_index: seasonIndex, resumed: String(resumed) });
}

/** The rains arrived: one season's bill. */
export function trackSeasonCompleted(
  year: number,
  seasonIndex: number,
  report: {
    hectaresBurnt: number;
    housesLost: number;
    firefightersLost: number;
    civiliansLost: number;
  },
): void {
  track('season_completed', {
    year,
    season_index: seasonIndex,
    ha_burnt: report.hectaresBurnt,
    homes_lost: report.housesLost,
    firefighters_lost: report.firefightersLost,
    people_lost: report.civiliansLost,
  });
}

/** The 2070 finale was reached — the campaign's full ledger. */
export function trackCampaignFinished(campaign: {
  hectaresBurnt: number;
  housesLost: number;
  firefightersLost: number;
  civiliansLost: number;
}): void {
  track('campaign_finished', {
    ha_burnt: campaign.hectaresBurnt,
    homes_lost: campaign.housesLost,
    firefighters_lost: campaign.firefightersLost,
    people_lost: campaign.civiliansLost,
  });
}

/** The player chose to start over from the finale screen. */
export function trackCampaignRestarted(): void {
  track('campaign_restarted');
}

/** A crew or engine was overrun — the game's hardest beat. */
export function trackUnitLost(unit: string, year: number): void {
  track('unit_lost', { unit, year });
}

/** The extreme-drought event dried the river this season. */
export function trackDrought(year: number): void {
  track('drought_event', { year });
}

/** The About modal was opened — play led to curiosity. Source: 'hud' or 'debrief'. */
export function trackAboutOpened(year: number, source: string): void {
  track('about_opened', { year, source });
}
