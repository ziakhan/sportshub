/**
 * Per-section clips: each feature section on a persona page gets its own
 * short walkthrough (owner ruling 2026-07-18: broken down per section, not
 * one big presentation). Composed from the journey scenes + feature scenes.
 */
import type { DemoScene } from "./demo-player"
import { PARENT_SCENES } from "./scenes-parent"
import { CLUB_SCENES } from "./scenes-club"
import { LEAGUE_SCENES } from "./scenes-league"
import * as F from "./scenes-features"
import { OFFER_FLOW, OFFER_ARRIVES, OFFER_PACKAGE, OFFER_SIZES, OFFER_PAID } from "./scenes-offer-flow"

/* ---- clubs page ---- */
export const CLUB_CLIPS: Record<string, DemoScene[]> = {
  tryouts: [CLUB_SCENES[3], CLUB_SCENES[4], CLUB_SCENES[5], CLUB_SCENES[6]],
  offers: OFFER_FLOW,
  payments: [F.LEDGER, F.AUTOCHARGE],
  scoring: [F.GUEST_SCOREKEEPER, F.SPLIT_LIVE, F.BOX_SCORE],
  publicFace: [F.CLUB_PAGE_PUBLIC, F.RECAP_NEWS, F.REVIEWS],
  comms: [CLUB_SCENES[2], F.ANNOUNCEMENT, F.POLL_COACH, F.PRACTICES],
  league: [CLUB_SCENES[10], LEAGUE_SCENES[5], LEAGUE_SCENES[6]],
  setup: [CLUB_SCENES[0], CLUB_SCENES[1], CLUB_SCENES[2]],
}

/* ---- parents page ---- */
export const PARENT_CLIPS: Record<string, DemoScene[]> = {
  find: [PARENT_SCENES[0], PARENT_SCENES[1]],
  pay: [PARENT_SCENES[2], PARENT_SCENES[3], OFFER_ARRIVES, OFFER_PACKAGE, OFFER_SIZES, OFFER_PAID],
  calendar: [PARENT_SCENES[4], F.POSTPONE],
  live: [F.PHONE_LIVE, F.BOX_SCORE],
  stats: [F.KID_STATS, F.MY_KIDS],
  chat: [F.PARENT_CHAT_PHONE, F.POLL_COACH],
}

/* ---- leagues page ---- */
export const LEAGUE_CLIPS: Record<string, DemoScene[]> = {
  registration: [LEAGUE_SCENES[0], LEAGUE_SCENES[3], LEAGUE_SCENES[4]],
  scheduling: [LEAGUE_SCENES[1], LEAGUE_SCENES[5], F.POSTPONE],
  scoring: [F.GUEST_SCOREKEEPER, F.SPLIT_LIVE, F.REF_VIEW],
  standings: [LEAGUE_SCENES[6], F.STAT_LEADERS, F.PLAYOFFS],
  recaps: [F.RECAP_NEWS, F.BOX_SCORE],
  fees: [LEAGUE_SCENES[4], F.LEDGER],
}
