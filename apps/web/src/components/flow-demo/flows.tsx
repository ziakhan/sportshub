"use client"

/**
 * Assembles the scene library into flows: the full season walkthrough
 * (/how-it-works) and the three audience slices (/for-leagues, /for-clubs,
 * /for-parents). Scenes are defined once and shared.
 */

import { Button } from "@/components/ui/button"
import { Advance } from "./advance"
import { DemoPlayer } from "./player"
import type { ChapterDef, FlowDef, Persona, SceneDef } from "./types"
import {
  SceneCreateLeague,
  SceneCreateSeason,
  SceneDivisions,
  SceneOpenRegistration,
  SceneReferees,
  SceneScheduling,
  SceneSessions,
  SceneTiebreakers,
  SceneVenues,
} from "./scenes/league-setup"
import {
  SceneClaimCode,
  SceneClaimComplete,
  SceneClaimOptions,
  SceneClaimVerified,
  SceneClubSearch,
  SceneCreateTeam,
  SceneTeamCreated,
} from "./scenes/club-setup"
import {
  SceneCheckIn,
  SceneCreateTryout,
  SceneEvents,
  ScenePayTryoutFee,
  SceneSignupRegistered,
  SceneSignupsTable,
  SceneStripeTryout,
  SceneTryoutCreated,
  SceneTryoutDetails,
  SceneTryoutSignup,
  SceneTryoutsList,
} from "./scenes/tryouts"
import {
  SceneAcceptOffer,
  SceneBulkOffer,
  SceneClubOffers,
  SceneFinalizeModal,
  SceneOfferTemplates,
  SceneParentOffer,
  SceneRosterFinalized,
  SceneRosterPending,
} from "./scenes/offers"
import {
  SceneCapacityPlanner,
  SceneFinalizeSeason,
  SceneLeaguePayments,
  SceneRecordPayment,
  SceneRosterChangeRequest,
  SceneRosterLocked,
  SceneRosterVersion,
  SceneSchedulePreview,
  SceneStripeTeamFee,
  SceneTeamFeeDue,
  SceneTeamsTab,
} from "./scenes/league-entry"
import {
  SceneBoxScore,
  SceneBracket,
  SceneChampRecap,
  SceneChat,
  SceneLiveDuo,
  SceneLiveDuoAfter,
  ScenePlayoffWizard,
  ScenePolls,
  SceneRecap,
  SceneReviewFinalize,
  SceneScores,
  SceneStandings,
} from "./scenes/season"

/* ── Chapter dividers ──────────────────────────────────────────────────── */

function Interstitial({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="border-ink-100 rounded-2xl border bg-white px-8 py-16 text-center shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]">
      <h2 className="font-condensed text-ink-950 mt-2 text-4xl font-bold uppercase tracking-wide">
        {title}
      </h2>
      <p className="text-ink-500 mx-auto mt-3 max-w-lg text-sm leading-relaxed">{blurb}</p>
      <div className="mt-7">
        <Advance>
          <Button size="lg">Continue</Button>
        </Advance>
      </div>
    </div>
  )
}

const divider = (_n: number, title: string, blurb: string) =>
  function Divider() {
    return <Interstitial title={title} blurb={blurb} />
  }

/* ── The scene library ─────────────────────────────────────────────────── */

interface LibScene {
  id: string
  chapter: string
  persona: Persona
  personaLabel: string
  frame: SceneDef["frame"]
  url?: string
  caption: string
  screen: SceneDef["screen"]
}

const MANAGE_URL = "/manage/leagues/nph-summer-league/seasons/summer-2026/manage"
const LEAGUE_LABEL = "League office"
const CLUB_LABEL = "Burlington Force (club)"
const PARENT_LABEL = "Maria (parent)"

const LIB: LibScene[] = [
  /* Chapter 1 — League setup */
  {
    id: "int-league",
    chapter: "league-setup",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "interstitial",
    caption: "A season, from the first form to the trophies. Go at your own pace.",
    screen: divider(
      1,
      "The league sets up the season",
      "The league office builds Summer 2026 once: divisions, venues, weekend sessions, referees, and the rules the scheduler has to respect."
    ),
  },
  {
    id: "create-league",
    chapter: "league-setup",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: "/manage/leagues/create",
    caption: "The league starts as one form. Seasons, divisions and scheduling come next.",
    screen: SceneCreateLeague,
  },
  {
    id: "create-season",
    chapter: "league-setup",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: "/manage/leagues/nph-summer-league",
    caption: "Summer 2026 gets its dates, registration deadline, team fee and guaranteed games.",
    screen: SceneCreateSeason,
  },
  {
    id: "divisions",
    chapter: "league-setup",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption: "Divisions by grade, each a single birth year. The fourth one is about to join.",
    screen: SceneDivisions,
  },
  {
    id: "sessions",
    chapter: "league-setup",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption: "Five weekend sessions define exactly when games can be played.",
    screen: SceneSessions,
  },
  {
    id: "venues",
    chapter: "league-setup",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption: "Real gyms with real courts. Court counts and hours feed straight into the scheduler.",
    screen: SceneVenues,
  },
  {
    id: "referees",
    chapter: "league-setup",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption:
      "One offer covers a whole day of games. Broadcast it and the first referee to accept is assigned to every game in the window.",
    screen: SceneReferees,
  },
  {
    id: "scheduling",
    chapter: "league-setup",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption:
      "The rules the scheduler must respect: max games per season, games per session, game format and slot length.",
    screen: SceneScheduling,
  },
  {
    id: "tiebreakers",
    chapter: "league-setup",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption: "Standings ties resolve in this order, automatically. The order locks when the season finalizes.",
    screen: SceneTiebreakers,
  },
  {
    id: "open-registration",
    chapter: "league-setup",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption:
      "The season is ready. Opening registration notifies every club that has played this league before.",
    screen: SceneOpenRegistration,
  },

  /* Chapter 2 — Club setup */
  {
    id: "int-club",
    chapter: "club-setup",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "interstitial",
    caption: "Registration is open. Now the clubs come in.",
    screen: divider(
      2,
      "The club claims its page",
      "Over a thousand Canadian clubs are already mapped. Burlington Force claims its existing page, keeps its history, then builds its team and staff."
    ),
  },
  {
    id: "club-search",
    chapter: "club-setup",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/create",
    caption: "Search before creating: the club's page already exists, so claiming it keeps everything attached to it.",
    screen: SceneClubSearch,
  },
  {
    id: "claim-options",
    chapter: "club-setup",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/claim/burlington-force-elite",
    caption: "Ownership is proven with a code sent to the contact info already on file. No account needed yet.",
    screen: SceneClaimOptions,
  },
  {
    id: "claim-code",
    chapter: "club-setup",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/claim/burlington-force-elite",
    caption: "The code arrives by email and expires in 30 minutes.",
    screen: SceneClaimCode,
  },
  {
    id: "claim-verified",
    chapter: "club-setup",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/claim/burlington-force-elite",
    caption: "Verified. The club is reserved for 14 days and binds to whichever account takes ownership.",
    screen: SceneClaimVerified,
  },
  {
    id: "claim-complete",
    chapter: "club-setup",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/claim/complete",
    caption: "The public page, teams and history now belong to this owner.",
    screen: SceneClaimComplete,
  },
  {
    id: "create-team",
    chapter: "club-setup",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/teams/create",
    caption:
      "One form creates the team: age group, practice days, and the staff, with a head coach, an assistant, and a manager invited by email.",
    screen: SceneCreateTeam,
  },
  {
    id: "team-created",
    chapter: "club-setup",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/teams/create",
    caption: "Coaches assigned on the spot; the team manager gets an email invite and joins on acceptance.",
    screen: SceneTeamCreated,
  },

  /* Chapter 3 — Tryouts to a roster */
  {
    id: "int-tryouts",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "interstitial",
    caption: "The team exists. Now it needs players.",
    screen: divider(
      3,
      "Tryouts to a finalized roster",
      "Post the tryout, take signups and payment, run check-in, send offers with payment plans, and finalize the roster with jersey numbers. Both sides of every step."
    ),
  },
  {
    id: "create-tryout",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/tryouts/create",
    caption: "Date, gym, fee and capacity. Age group and gender come from the team itself.",
    screen: SceneCreateTryout,
  },
  {
    id: "tryout-created",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/tryouts/create",
    caption: "Saved as a draft. Nothing is public until the club says so.",
    screen: SceneTryoutCreated,
  },
  {
    id: "tryouts-list",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/tryouts",
    caption: "One click publishes it to the marketplace where parents browse.",
    screen: SceneTryoutsList,
  },
  {
    id: "events",
    chapter: "tryouts",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption:
      "Maria is looking for a Grade 10 team for Jayden, born 2010. The tryout shows up with the fee and spots remaining.",
    screen: SceneEvents,
  },
  {
    id: "tryout-details",
    chapter: "tryouts",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "Everything a parent needs before committing: date, gym, age group, spots and fee.",
    screen: SceneTryoutDetails,
  },
  {
    id: "tryout-signup",
    chapter: "tryouts",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "She picks which of her kids is trying out and signs up in a few taps.",
    screen: SceneTryoutSignup,
  },
  {
    id: "signup-registered",
    chapter: "tryouts",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "Jayden is registered, and the tryout fee shows up as an open item on her payments page.",
    screen: SceneSignupRegistered,
  },
  {
    id: "pay-tryout-fee",
    chapter: "tryouts",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "Every fee she owes, in one place, with the club named on each.",
    screen: ScenePayTryoutFee,
  },
  {
    id: "stripe-tryout",
    chapter: "tryouts",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "Paid online. The card is saved securely by Stripe for the season fees ahead.",
    screen: SceneStripeTryout,
  },
  {
    id: "check-in",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/tryouts/spring-g10/check-in",
    caption: "Tryout night. One tap checks each player in; who showed up is visible instantly.",
    screen: SceneCheckIn,
  },
  {
    id: "signups-table",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/tryouts/spring-g10/signups",
    caption: "Every signup, check-in and offer state in one table. Time to send offers.",
    screen: SceneSignupsTable,
  },
  {
    id: "offer-templates",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/offer-templates",
    caption: "Packages are set up once and shared by every team: fee, installments, included gear.",
    screen: SceneOfferTemplates,
  },
  {
    id: "bulk-offer",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/tryouts/spring-g10/signups",
    caption:
      "Compose the packages once, tick everyone who made the cut, and send. Each family picks one package when they accept.",
    screen: SceneBulkOffer,
  },
  {
    id: "parent-offer",
    chapter: "tryouts",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "The offer lands on Maria's phone with both packages, the coach's message and an expiry date.",
    screen: SceneParentOffer,
  },
  {
    id: "accept-offer",
    chapter: "tryouts",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption:
      "Package, uniform size, jersey preferences, payment plan. The deposit is charged on accept and the rest auto-charges monthly.",
    screen: SceneAcceptOffer,
  },
  {
    id: "club-offers",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/offers",
    caption: "Acceptances flow back with sizes and jersey preferences attached. No forms, no spreadsheets.",
    screen: SceneClubOffers,
  },
  {
    id: "roster-pending",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/teams/g10/roster",
    caption: "Twelve players accepted. Finalizing assigns jersey numbers from their preferences.",
    screen: SceneRosterPending,
  },
  {
    id: "finalize-modal",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/teams/g10/roster",
    caption: "One confirmation. Any offers still pending expire so nobody is left hanging.",
    screen: SceneFinalizeModal,
  },
  {
    id: "roster-finalized",
    chapter: "tryouts",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/teams/g10/roster",
    caption: "Numbers assigned, roster set. Jayden got #23, his first choice.",
    screen: SceneRosterFinalized,
  },

  /* Chapter 4 — League entry */
  {
    id: "int-entry",
    chapter: "league-entry",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "interstitial",
    caption: "The roster is set. Time to enter the league.",
    screen: divider(
      4,
      "Into the league",
      "The club submits its roster version and pays the team fee. The league reviews payments, approves changes, finalizes on the deadline, and generates the whole schedule."
    ),
  },
  {
    id: "roster-version",
    chapter: "league-entry",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/teams/g10/league-rosters",
    caption: "The club picks which players make this league's version. The club roster stays its own.",
    screen: SceneRosterVersion,
  },
  {
    id: "team-fee-due",
    chapter: "league-entry",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/payments",
    caption: "Submitting the team creates the fee: $3,990, owed to the league.",
    screen: SceneTeamFeeDue,
  },
  {
    id: "stripe-team-fee",
    chapter: "league-entry",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/payments",
    caption: "Paid online. The league's books update instantly.",
    screen: SceneStripeTeamFee,
  },
  {
    id: "roster-locked",
    chapter: "league-entry",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/teams/g10/league-rosters",
    caption: "The deadline passed and the roster locked. Changes now go through the league.",
    screen: SceneRosterLocked,
  },
  {
    id: "roster-change-request",
    chapter: "league-entry",
    persona: "club",
    personaLabel: CLUB_LABEL,
    frame: "desktop",
    url: "/clubs/burlington-force/teams/g10/league-rosters",
    caption: "An injury call-up: the club requests one add against the locked roster, with a note.",
    screen: SceneRosterChangeRequest,
  },
  {
    id: "league-payments",
    chapter: "league-entry",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: "/manage/leagues/nph-summer-league/payments",
    caption:
      "The league sees every team fee: collected, outstanding, waived. Cards, e-transfers, cheques and cash all land in the same ledger.",
    screen: SceneLeaguePayments,
  },
  {
    id: "record-payment",
    chapter: "league-entry",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: "/manage/leagues/nph-summer-league/payments",
    caption: "An e-transfer takes ten seconds to record against the right team.",
    screen: SceneRecordPayment,
  },
  {
    id: "teams-tab",
    chapter: "league-entry",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption:
      "Eight teams registered and paid. The roster change request gets approved and applies to the locked roster immediately.",
    screen: SceneTeamsTab,
  },
  {
    id: "finalize-season",
    chapter: "league-entry",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption: "The preflight checklist is green. Finalizing locks every roster and the tiebreaker order.",
    screen: SceneFinalizeSeason,
  },
  {
    id: "capacity-planner",
    chapter: "league-entry",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption:
      "Before generating, the planner shows what every session can hold against what the divisions need.",
    screen: SceneCapacityPlanner,
  },
  {
    id: "schedule-preview",
    chapter: "league-entry",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption: "One button proposes all 150 games inside the rules. Committing makes them real.",
    screen: SceneSchedulePreview,
  },

  /* Chapter 5 — The season */
  {
    id: "int-season",
    chapter: "season",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "interstitial",
    caption: "May 30. Tip-off.",
    screen: divider(
      5,
      "The season, live",
      "Live scoring pushed to every phone, box scores, standings, automatic recaps, team chat and polls, then playoffs through to the championship."
    ),
  },
  {
    id: "live-duo",
    chapter: "season",
    persona: "club",
    personaLabel: "Scorer's table",
    frame: "duo",
    caption:
      "Game day, week 4. The left screen is the scorer's table; the right is the public game page every family has open. Tap the +2.",
    screen: SceneLiveDuo,
  },
  {
    id: "live-duo-after",
    chapter: "season",
    persona: "club",
    personaLabel: "Scorer's table",
    frame: "duo",
    caption:
      "Jayden's basket is on every phone before the teams are back down the floor. Pushed live, no refreshing.",
    screen: SceneLiveDuoAfter,
  },
  {
    id: "review-finalize",
    chapter: "season",
    persona: "club",
    personaLabel: "Scorer's table",
    frame: "desktop",
    url: "/games/g10-w4-force-huskies/score",
    caption: "The horn sounds. The referee signs off with their PIN and the result becomes official.",
    screen: SceneReviewFinalize,
  },
  {
    id: "scores",
    chapter: "season",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "Maria's view: her kids' games pinned on top, live games and finals below, across every league.",
    screen: SceneScores,
  },
  {
    id: "box-score",
    chapter: "season",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "The full box score with leaders, linescore and play-by-play, straight from the scorer's table.",
    screen: SceneBoxScore,
  },
  {
    id: "standings",
    chapter: "season",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "Standings compute themselves from finals, with ties broken by the league's configured rules.",
    screen: SceneStandings,
  },
  {
    id: "recap",
    chapter: "season",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "Every scored game gets a story, written automatically from the official scoring record.",
    screen: SceneRecap,
  },
  {
    id: "chat",
    chapter: "season",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "Team chat with pinned notes and quick polls. Maria votes on the team dinner right in the thread.",
    screen: SceneChat,
  },
  {
    id: "polls",
    chapter: "season",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "Bigger questions run as polls with live results the whole team can see.",
    screen: ScenePolls,
  },
  {
    id: "playoff-wizard",
    chapter: "season",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption:
      "Playoff time. Pick the division and how many teams qualify; only formats that fit are offered, seeded from the standings.",
    screen: ScenePlayoffWizard,
  },
  {
    id: "bracket",
    chapter: "season",
    persona: "league",
    personaLabel: LEAGUE_LABEL,
    frame: "desktop",
    url: MANAGE_URL,
    caption: "Semifinal winners advanced into the final automatically as results were finalized.",
    screen: SceneBracket,
  },
  {
    id: "champ-recap",
    chapter: "season",
    persona: "parent",
    personaLabel: PARENT_LABEL,
    frame: "phone",
    caption: "July 5. The Force take the title, and the whole season lives here: every score, story and stat.",
    screen: SceneChampRecap,
  },
]

/* ── Flow assembly ─────────────────────────────────────────────────────── */

const CHAPTERS: Record<string, ChapterDef> = {
  "league-setup": { id: "league-setup", title: "League setup", blurb: "" },
  "club-setup": { id: "club-setup", title: "Club setup", blurb: "" },
  tryouts: { id: "tryouts", title: "Tryouts & offers", blurb: "" },
  "league-entry": { id: "league-entry", title: "League entry", blurb: "" },
  season: { id: "season", title: "The season", blurb: "" },
}

function buildFlow(id: string, title: string, ids: string[]): FlowDef {
  const scenes: SceneDef[] = ids.map((sid) => {
    const s = LIB.find((l) => l.id === sid)
    if (!s) throw new Error(`Unknown demo scene: ${sid}`)
    return s
  })
  const chapterIds = Array.from(new Set(scenes.map((s) => s.chapter)))
  return { id, title, chapters: chapterIds.map((c) => CHAPTERS[c]), scenes }
}

const FULL = LIB.map((s) => s.id)

const LEAGUE_SLICE = [
  "int-league",
  "create-league",
  "create-season",
  "divisions",
  "sessions",
  "venues",
  "referees",
  "scheduling",
  "tiebreakers",
  "open-registration",
  "league-payments",
  "record-payment",
  "teams-tab",
  "finalize-season",
  "capacity-planner",
  "schedule-preview",
  "int-season",
  "live-duo",
  "live-duo-after",
  "review-finalize",
  "standings",
  "recap",
  "playoff-wizard",
  "bracket",
  "champ-recap",
]

const CLUB_SLICE = [
  "int-club",
  "club-search",
  "claim-options",
  "claim-code",
  "claim-verified",
  "claim-complete",
  "create-team",
  "team-created",
  "int-tryouts",
  "create-tryout",
  "tryout-created",
  "tryouts-list",
  "check-in",
  "signups-table",
  "offer-templates",
  "bulk-offer",
  "parent-offer",
  "accept-offer",
  "club-offers",
  "roster-pending",
  "finalize-modal",
  "roster-finalized",
  "int-entry",
  "roster-version",
  "team-fee-due",
  "stripe-team-fee",
  "roster-locked",
  "roster-change-request",
  "int-season",
  "live-duo",
  "live-duo-after",
  "review-finalize",
  "standings",
  "recap",
  "chat",
  "polls",
  "champ-recap",
]

const PARENT_SLICE = [
  "events",
  "tryout-details",
  "tryout-signup",
  "signup-registered",
  "pay-tryout-fee",
  "stripe-tryout",
  "parent-offer",
  "accept-offer",
  "int-season",
  "live-duo",
  "live-duo-after",
  "scores",
  "box-score",
  "standings",
  "recap",
  "chat",
  "polls",
  "champ-recap",
]

export function HowItWorksDemo() {
  return <DemoPlayer flow={buildFlow("full", "How a season runs", FULL)} />
}
export function LeagueDemo() {
  return <DemoPlayer flow={buildFlow("league", "Run your league", LEAGUE_SLICE)} />
}
export function ClubDemo() {
  return <DemoPlayer flow={buildFlow("club", "Run your club", CLUB_SLICE)} />
}
export function ParentDemo() {
  return <DemoPlayer flow={buildFlow("parent", "Follow your player", PARENT_SLICE)} />
}
