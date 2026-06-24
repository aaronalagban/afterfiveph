/**
 * TEMPORARY — Fête de la Musique PH 2026 campaign.
 *
 * Single source of truth for the campaign window. Every Fête-specific UI
 * check (user-facing FETE GUIDE tab, the June 26 yellow highlight, the entry
 * modal, the admin CMS toggle) must import from here instead of hardcoding
 * dates. That way the whole feature turns itself off automatically once
 * FETE_GUIDE_EXPIRES_AT passes, and removal after the campaign is a matter of
 * deleting this file + its call sites.
 *
 * TODO(fete-2026): delete this file and all `fete.config` references after
 * 2026-06-30 (Asia/Manila). See scripts/fete-2026-cleanup.sql for the DB side.
 */

/** Campaign key, in case events ever need to be tagged for more than one drop. */
export const FETE_CAMPAIGN_KEY = "fete_2026" as const;

/** Public Instagram for "More from Fête PH". */
export const FETE_INSTAGRAM_URL = "https://www.instagram.com/fetedelamusiqueph/";

// All instants below are written with an explicit +08:00 (Asia/Manila) offset
// so the comparison is correct regardless of the server/browser's local TZ.

/** Feature goes live. */
const FETE_GUIDE_START_AT = "2026-06-24T00:00:00+08:00";

/** Feature is treated as expired at/after this instant (2026-06-30 00:00 PHT). */
export const FETE_GUIDE_EXPIRES_AT = "2026-06-30T00:00:00+08:00";

/** Calendar dates (Asia/Manila) of the event itself — drive the yellow highlight. */
export const FETE_DAYS = ["2026-06-26", "2026-06-27"];

/** True while `at` falls inside the active campaign window. */
export function isFeteGuideActive(at: Date = new Date()): boolean {
  const t = at.getTime();
  return t >= new Date(FETE_GUIDE_START_AT).getTime() && t < new Date(FETE_GUIDE_EXPIRES_AT).getTime();
}

/** True if the given event_date (YYYY-MM-DD or ISO string) is a Fête day. */
export function isFeteDay(eventDateStr: string | null | undefined): boolean {
  if (!eventDateStr) return false;
  return FETE_DAYS.includes(eventDateStr.substring(0, 10));
}

/** Milliseconds from `from` until the campaign expires (negative if already expired). */
export function msUntilFeteExpiry(from: Date = new Date()): number {
  return new Date(FETE_GUIDE_EXPIRES_AT).getTime() - from.getTime();
}
