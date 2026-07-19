/**
 * ONE SEASON: the end-to-end story told in order, with the baton passing
 * between roles. Powers /how-it-works (role filter comes free from the
 * player). Composed from journey + feature scenes; no scene lives here.
 */
import type { DemoScene } from "./demo-player"
import { PARENT_SCENES } from "./scenes-parent"
import { CLUB_SCENES } from "./scenes-club"
import { LEAGUE_SCENES } from "./scenes-league"
import * as F from "./scenes-features"
import { OFFER_FLOW } from "./scenes-offer-flow"

const as = (scene: DemoScene, role: DemoScene["role"]): DemoScene => ({ ...scene, role })

export const SEASON_SCENES: DemoScene[] = [
  // Tryout season
  as(CLUB_SCENES[0], "CLUB"),
  as(CLUB_SCENES[3], "CLUB"),
  as(CLUB_SCENES[4], "CLUB"),
  as(PARENT_SCENES[0], "PARENT"),
  as(PARENT_SCENES[3], "PARENT"),
  as(CLUB_SCENES[6], "COACH"),
  // Team building
  as(CLUB_SCENES[7], "CLUB"),
  ...OFFER_FLOW,
  as(CLUB_SCENES[10], "CLUB"),
  // League entry
  as(LEAGUE_SCENES[0], "LEAGUE"),
  as(LEAGUE_SCENES[4], "CLUB"),
  as(LEAGUE_SCENES[5], "LEAGUE"),
  // The long season
  as(F.PRACTICES, "COACH"),
  as(F.ANNOUNCEMENT, "COACH"),
  as(F.LEDGER, "CLUB"),
  as(F.POSTPONE, "EVERYONE"),
  // Game night
  as(F.GUEST_SCOREKEEPER, "SCOREKEEPER"),
  as(F.SPLIT_LIVE, "SCOREKEEPER"),
  as(F.PHONE_LIVE, "PARENT"),
  as(F.BOX_SCORE, "EVERYONE"),
  as(F.RECAP_NEWS, "EVERYONE"),
  // The finish
  as(LEAGUE_SCENES[6], "LEAGUE"),
  as(F.PLAYOFFS, "LEAGUE"),
  as(F.KID_STATS, "PARENT"),
  as(F.REVIEWS, "PARENT"),
]
