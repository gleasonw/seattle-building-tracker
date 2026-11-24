/**
 * The fixed rules and defaults behind the app's labels (SPEC §2, open questions 2–6). Each is
 * stated wherever its label appears, so change it here and the explanations follow.
 */

/** Stalled: in review at least this long (SPEC open question 4). */
export const STALLED_REVIEW_YEARS = 3;
/** Stalled: issued at least this long ago and not completed (SPEC open question 4). */
export const STALLED_ISSUED_YEARS = 4;
/** Expiring soon: an issued permit that expires within this many months. */
export const EXPIRING_SOON_MONTHS = 6;

/**
 * Days past its expiration date before an issued, uncompleted permit counts as "permit
 * expired" even though the City still lists it as issued (SPEC open question 5). Zero: the
 * expiry date is the rule. Renewals do show up later (76 past-due expirations were pushed back
 * in the first seven weeks of recording), and then the project simply returns to "issued".
 */
export const EXPIRED_GRACE_DAYS = 0;

/**
 * Deaths with no City date (cancelled, withdrawn, denied) are dated by when the sync first
 * noticed them, so they only appear in movement from when recording began in October 2026
 * (SPEC open question 6). Applications that expired before issue carry the City's expiration
 * date and appear whenever they happened. Set this to true to also show earlier undated deaths,
 * dated approximately by the permit's last milestone and labelled as such.
 */
export const DATE_OLD_DEATHS_BY_LAST_MILESTONE = false;

/** Proposals are mentioned under the pipeline table and listed on request (SPEC open question 2). */
export const SHOW_PROPOSALS = true;

/** Front-page movement feed: projects of at least this many units, over this many days. */
export const FEED_MIN_UNITS = 10;
export const FEED_DAYS = 30;

/** Place-report movement periods. */
export const MOVEMENT_PERIODS = { "30d": 30, "6m": 183, "1y": 365 } as const;
export type MovementPeriod = keyof typeof MOVEMENT_PERIODS;
export const MOVEMENT_PERIOD_LABELS: Record<MovementPeriod, string> = { "30d": "30 days", "6m": "6 months", "1y": "1 year" };

/**
 * Email updates (SPEC P6): a digest lists movement dated within this many days that the
 * subscriber hasn't been sent, so changes the City records a little late still arrive once.
 */
export const DIGEST_LOOKBACK_DAYS = 30;
/** Movements listed in one email; the rest are counted and the report linked. */
export const DIGEST_MAX_ITEMS = 40;

/** Radius options for "near an address" (SPEC §2). */
export const RADIUS_MILES = [0.25, 0.5, 1] as const;
export const DEFAULT_RADIUS_MILES = 0.5;
export const radiusLabel = (miles: number) =>
  miles === 0.25 ? "¼ mile" : miles === 0.5 ? "½ mile" : miles === 1 ? "1 mile" : `${miles} miles`;

/** First year of the long view. */
export const LONG_VIEW_START = 2010;

/** In January the front page shows the previous year in review by default (SPEC §2 "This year"). */
export const REVIEW_PREVIOUS_YEAR_MONTHS = [1];

/** How many pipeline projects a place report shows before "Show all". */
export const PIPELINE_TABLE_ROWS = 15;
