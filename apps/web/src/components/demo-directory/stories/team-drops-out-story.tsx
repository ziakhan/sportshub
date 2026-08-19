"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "A team drops out" (scenario audit C2), rebuilt to the realism standard
 * (mock-ui.tsx R1–R8) on 2026-08-19 over the gold-standard cut of 2026-08-16.
 *
 * WHAT THE 08-16 CUT GOT RIGHT AND KEEPS: every number is read out of the
 * seeded world and written down with its source in
 * `docs/roadmap/team-drops-out-numbers.md`. The story is the same story: a club
 * asks out of a season that is already drawn, the league signs it off, the
 * cascade runs by itself, the schedule says who is now short, and the fix ADDS
 * ONLY THE MISSING GAMES.
 *
 * WHAT CHANGED: FIDELITY, AND THE ENDING OF EVERY FLOW.
 * The 08-16 cut drew these screens on `scene-kit.tsx`, a kit authored before
 * R1, and it invented four panels the product does not have: a season stats
 * strip, an "after" state for the withdrawal panel, a "The fix, previewed"
 * card with four counters, and a green "Every team has its 10 games" banner.
 * All four are gone. Every screen below is the REAL component's markup at the
 * product's own sizes, and the two things the cut never showed — the ten games
 * actually going CANCELLED, and the notification actually landing — are now on
 * screen, on the product's own pages.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited).
 * Console paths are under `app/(platform)/manage/leagues/[id]/seasons/[seasonId]`:
 *
 *   · the console shell is `manage/page.tsx`: the SmartBack line, the floated
 *     "Waiver signing status →", the condensed uppercase h1 carrying the SEASON
 *     label, the league name under it, the status Badge through
 *     `toneForStatus`, the "Season checklist" button that shows on every tab
 *     but Overview, and the flat nine-tab row with the play-600 underline.
 *     Same shell the season and playoffs stories film;
 *   · the withdrawal queue is `components/withdrawal-requests-panel.tsx`,
 *     mounted at `teams-tab.tsx` line 59: the rounded-[28px] amber card, the
 *     PanelHeader carrying its warning Badge count, its standing sentence
 *     "These clubs are asking to leave the season. Approving cancels their
 *     upcoming games and notifies opponents.", the `ul`/`li` row with the
 *     quoted reason, and Approve beside a subtle Decline. Its last line is the
 *     one the old cut missed: `if (requests.length === 0) return null`, so
 *     approving does not grey the panel out, it DELETES it;
 *   · the registered list is `manage/components/teams-tab.tsx`: the two rows of
 *     filter chips with their real counts, the court-tinted row, the club and
 *     division spans, the status Badge (`toneForStatus("WITHDRAWN")` is
 *     NEUTRAL, not red) beside the payment Badge, and "Details →";
 *   · the team page is `teams/[submissionId]/page.tsx`: the SmartBack, the
 *     xl/2xl title with its status and payment Badges, the ink-500 line under
 *     it, `submission-actions.tsx` as a withdrawn submission really renders it
 *     (no Approve, no Withdraw, the weekend-preference ChipGroup, the schedule
 *     requests checkbox, Mark paid and Waive fee), the "Roster (N)" panel with
 *     the real "No roster submitted yet" line, and the Games panel: one
 *     `text-ink-700 mb-1 text-sm` line per game, `{date} · {home} vs {away} ·
 *     {status}`, ten of them, every one reading cancelled;
 *   · the notification is `app/(platform)/notifications/page.tsx`: the Inbox
 *     eyebrow, the display h1 with its "(1 unread)", "Mark all as read", and
 *     the unread row in its real read-state (border-play-200 bg-play-50/30 +
 *     the play-500 dot), carrying the message `lib/withdrawals/requests.ts`
 *     lines 337 to 339 writes, verbatim including "game(s)";
 *   · the schedule tab is `manage/components/schedule-tab.tsx`: the "Generate
 *     the schedule" panel, `plan-door.tsx` JourneyStrip, the "Built on plan
 *     … · change" line, the three generation buttons, the amber guarantee
 *     callout (lines 680 to 709) with the product's own truncation to four
 *     names and "+5 more", the gold draft strip (lines 711 to 721) carrying
 *     `draftCount`, the play-50 preview panel (lines 733 to 806) with its
 *     "Preview: N games" line, its no-trade-offs sentence, its slots line and
 *     its When/Home/Away table, and `team-check.tsx` nested inside it with its
 *     "N of M teams fully scheduled" header, its "Click a team…" line, its
 *     two-column grid and its preview banner;
 *   · the commit confirmation is the product's own `confirm()` sentence,
 *     `schedule-tab.tsx` line 429, drawn as a dialog because the scene has no
 *     browser chrome to hang a native sheet on.
 *
 * DELIBERATE DEPARTURES, ALL DECLARED:
 *   · THE SEASON IS FILMED AS FINALIZED. The seed leaves it in REGISTRATION,
 *     and in that state `schedule-tab.tsx` line 365 (`canCommit`) DISABLES
 *     "Add ONLY the missing games". The 08-16 cut showed an "Open for
 *     registration" chip and pressed the button anyway. A season with 725
 *     games drawn and a club walking out is FINALIZED in the product's own
 *     state machine, so that is the badge on the h1 and the state the fix is
 *     pressed in. Nothing else in the numbers sheet moves: every game is still
 *     future and unpublished;
 *   · THE DRAFT STRIP COUNTS EVERY UNPUBLISHED GAME, and in this world that is
 *     all of them. `draftCount` is `scheduleGames.filter(g => !g.publishedAt)`,
 *     so the strip reads 715 before the fix and 720 after it, not "5 new
 *     drafts" as the old cut wrote. That is the truer ending anyway: the five
 *     land in a season the league has still not published to anybody;
 *   · THE GAP LIST IS NOT EXPANDABLE. The product truncates to four names and
 *     "+5 more" and offers no way to see the rest, so the old cut's expanding
 *     list is gone. Per-team counts are read where the product really shows
 *     them, in Team check, which is where Vanguard North Prep's 8 is seen;
 *   · NO "REST OF THE LEAGUE" STRIP. That panel does not exist. The 135
 *     untouched teams are stated in a balloon, which is what balloons are for;
 *   · NO TOASTS. The product raises none here. The queue emptying and the row
 *     flipping to withdrawn are the confirmation, exactly as they are on the
 *     real screen;
 *   · COMPOSITION, not invention, and each one costs height only: Team check
 *     is filmed over Division D rather than all 145 approved teams (its
 *     header counts the ten it shows); the registered list shows four of its
 *     146 rows; the team page's Entry fee, Blackout and Contacts panels and
 *     the tab's roster-requests panel and ScheduleReadiness band are not
 *     drawn, and no beat acts on them; long pages scroll inside the 1160x600
 *     pane exactly as a browser scrolls them.
 *
 * INVENTED-CONTENT LEDGER (everything not read from the world or the code):
 *   · WHICH SIDE WAS HOME in the ten cancelled games. The numbers sheet
 *     records each game's date, opponent, court and status; home and away are
 *     not in it, so the ten rows alternate;
 *   · THE FIVE PREVIEWED FIXTURES. The commit was never run against a
 *     database, so the preview table's dates and courts are placed in the
 *     season's real weekends at its real venue. The PAIRINGS are arithmetic,
 *     not a guess: eight teams are short by one and Vanguard North Prep by
 *     two, which is exactly five games. The count, the slots and the outcome
 *     are the sheet's; the placement is composed, and section G of the sheet
 *     records that it would otherwise be a guess;
 *   · the payment Badges and the "Unpaid (146)" filter print the schema's
 *     default: the sheet records no payment rows against these submissions;
 *   · the notification's timestamp, and the club column left empty on the
 *     registered rows (the sheet does not carry the clubs' tenant names).
 *
 * THREE THINGS THE PRODUCT CANNOT HONESTLY SHOW, STILL NOT STAGED (sheet F):
 *   1. NO FAMILY FAN-OUT. The cascade notifies the opponents' CLUB OFFICES and
 *      nobody else: no families, no coaches, no email. The demo counts club
 *      offices and says so on camera;
 *   2. NO REASON ON THE CANCELLED GAMES. `Game.statusReason` is never written,
 *      so the ten rows read "cancelled" and nothing more;
 *   3. NO CASCADE RECEIPT. Nothing shows the operator the four writes, so that
 *      beat is drawn as an explicit NARRATION card, navy, with no console
 *      chrome on it and a context strip that names no screen.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const LEAGUE = "NPH Showcase League"
const SEASON = "Fall/Winter 2026-27"
const CTX_TEAMS = `${LEAGUE} · ${SEASON} · Teams`
const CTX_TEAM = `${LEAGUE} · ${SEASON} · Orillia Lakers`
const CTX_CASCADE = `${LEAGUE} · ${SEASON}`
const CTX_NOTIF = "An opposing club office · Notifications"
const CTX_SCHEDULE = `${LEAGUE} · ${SEASON} · Schedule`

/** The season as it stands before anybody leaves. `DB` season 160b2f09. */
const SUBS_IN = 146
const TEAMS_IN = 145
const GAMES_IN = 725
const GUARANTEE = 10
const DIVISIONS = 16

/** The withdrawal. `DB` WithdrawalRequest 0f2e947b, CLUB_FROM_LEAGUE, PENDING. */
const TEAM = "Orillia Lakers"
const DIVISION = "Grade 10 Boys · Division D"
/**
 * The reason, verbatim from the row. The product stores it with an em-dash;
 * the house copy rule turns that into a middot, exactly as the season story
 * does with the auditor's sentence.
 */
const REASON = "Not enough committed players to travel this winter · we have to pull out."
const ASKED_ON = "Aug 2"

/** What the approval cancels. `DB` ten future SCHEDULED games, nine opponents. */
const CANCELLED = 10
const OPPONENT_CLUBS = 9

/**
 * The ten games, `DB` numbers sheet section C, in the order the schedule holds
 * them. All at The Playground, all unpublished. Which side was recorded home is
 * not in the sheet (ledger item 1), so the rows alternate.
 */
const LAKERS_GAMES: Array<{ date: string; opponent: string; home: boolean }> = [
  { date: "Oct 24, 2026", opponent: "Retro Elite", home: true },
  { date: "Oct 25, 2026", opponent: "Toronto Top Tier East", home: false },
  { date: "Nov 14, 2026", opponent: "FEIA (Fort Erie)", home: true },
  { date: "Nov 14, 2026", opponent: "Vanguard North Prep", home: false },
  { date: "Dec 12, 2026", opponent: "Vaughan Panthers", home: true },
  { date: "Dec 12, 2026", opponent: "Malton Sting Basketball", home: false },
  { date: "Jan 10, 2027", opponent: "Dragons de Gatineau (DMV CHILL)", home: true },
  { date: "Jan 10, 2027", opponent: "Alpha Elite", home: false },
  { date: "Feb 6, 2027", opponent: "Vanguard North Prep", home: true },
  { date: "Feb 6, 2027", opponent: "EM Elite", home: false },
]

/**
 * The cascade, in the order `lib/withdrawals/requests.ts` runs it inside one
 * transaction. NARRATION: nothing in the product shows an operator this.
 */
const CASCADE = [
  {
    n: "1",
    label: "The entry goes to WITHDRAWN",
    note: "The team leaves the registered list, and stays in the season's history.",
  },
  {
    n: "2",
    label: "An unpaid entry fee is cancelled with it",
    note: "A fee already paid is left alone, because refunding is the league's call.",
  },
  {
    n: "3",
    label: "Their open schedule requests are closed",
    note: "Reason recorded: Team withdrew from the season.",
  },
  {
    n: `${CANCELLED}`,
    label: "future games cancelled, in the same transaction",
    note: "Games already played are untouched, so the table keeps its history.",
  },
]

/** The notification, verbatim from `lib/withdrawals/requests.ts` lines 337 to 339. */
const NOTICE = {
  title: "Games Cancelled · Opponent Withdrew",
  body: `${TEAM} has withdrawn from ${LEAGUE}. ${CANCELLED} upcoming game(s) against them have been cancelled.`,
  when: "Aug 16, 9:12 AM",
}

/**
 * The guarantee callout, `schedule-tab.tsx` lines 680 to 709. The count, the
 * target and every name and number are `DB`: the whole of Division D minus the
 * club that left, with Vanguard North Prep on 8 because they were drawn against
 * the Lakers twice.
 */
const SHORT_TEAMS = [
  { name: "FEIA (Fort Erie)", count: 9 },
  { name: "Alpha Elite", count: 9 },
  { name: "Retro Elite", count: 9 },
  { name: "Vaughan Panthers", count: 9 },
  { name: "EM Elite", count: 9 },
  { name: "Malton Sting Basketball", count: 9 },
  { name: "Vanguard North Prep", count: 8 },
  { name: "Toronto Top Tier East", count: 9 },
  { name: "Dragons de Gatineau (DMV CHILL)", count: 9 },
]
const SHORT_COUNT = SHORT_TEAMS.length
/** `ARITH` the shortfall in team-slots, and the games that closes it. */
const SLOTS_SHORT = SHORT_TEAMS.reduce((a, t) => a + (GUARANTEE - t.count), 0)
const NEW_GAMES = SLOTS_SHORT / 2
/** `ARITH` every approved team that is NOT short, and therefore not moving. */
const UNTOUCHED = TEAMS_IN - 1 - SHORT_COUNT

/**
 * Team check rows: Division D as it stands after the withdrawal. The nine short
 * teams at their real counts plus Burloak Elite, who were never drawn against
 * the Lakers and are therefore the one team in the division that still has its
 * ten. `DB`, all ten counts read from the games table.
 */
const CHECK_ROWS = [...SHORT_TEAMS, { name: "Burloak Elite (PRIME)", count: GUARANTEE }]

/** `ARITH` unpublished games before and after the fix. Every game in this
 *  season has `publishedAt` null, and `draftCount` counts exactly those. */
const GAMES_AFTER_CANCEL = GAMES_IN - CANCELLED
const DRAFTS_AFTER = GAMES_AFTER_CANCEL + NEW_GAMES

/**
 * The five games the gap fill would add. Ledger item 2: the pairings close the
 * ten missing slots exactly, the placement is composed at the season's real
 * venue and weekends.
 */
const PREVIEW_GAMES = [
  { when: "Sat Jan 9 · 12:45 PM", home: "FEIA (Fort Erie)", away: "Alpha Elite" },
  { when: "Sat Jan 9 · 4:30 PM", home: "Retro Elite", away: "Vaughan Panthers" },
  { when: "Sun Jan 10 · 11:15 AM", home: "EM Elite", away: "Vanguard North Prep" },
  { when: "Sat Feb 6 · 10:00 AM", home: "Malton Sting Basketball", away: "Toronto Top Tier East" },
  { when: "Sat Feb 6 · 2:30 PM", home: "Vanguard North Prep", away: "Dragons de Gatineau (DMV CHILL)" },
]

/** The commit confirmation, verbatim from `schedule-tab.tsx` line 429. */
const COMMIT_CONFIRM =
  "Add ONLY the missing games? Nobody's existing schedule changes · the new games are saved as drafts until you publish."

/* ── Pacing ──────────────────────────────────────────────────────────────── */

/**
 * Human pace (owner 2026-08-19), the same function `your-week-story.tsx` uses:
 * people click, then click again. Long reads only where a balloon earns one.
 */
function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const teamDropsOutStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/manage/leagues/nph-showcase/seasons/fall-winter-2026-27/manage?tab=teams",
  context: CTX_TEAMS,
  initialStage: "desktop",
  chapters: [
    { id: "ask", title: "The club asks out" },
    { id: "approve", title: "What approving does" },
    { id: "short", title: "Who is now short" },
    { id: "fix", title: "Only the missing games" },
  ],

  beats: [
    /* ── 1. The club asks out ─────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "ask",
      caption: "The season is finalized and the whole thing is already drawn.",
      emphasize: "season-head",
      callout: `${TEAMS_IN} teams approved, ${GAMES_IN} games drawn, ${DIVISIONS} divisions.`,
    }),
    paced({
      id: "queue",
      chapter: "ask",
      caption: "One club is asking to leave.",
      emphasize: "wd-panel",
      callout: "A club that is already approved cannot just walk. The league has to sign it off.",
    }),
    paced({
      id: "reason",
      chapter: "ask",
      caption: "The club had to write down why.",
      emphasize: "wd-reason",
      callout: "The reason is required, so a league is never guessing what happened.",
    }),
    paced({
      id: "warning",
      chapter: "ask",
      caption: "The screen names what Approve will do before it is pressed.",
      emphasize: "wd-warn",
      callout: `What it cannot know is the size: ${CANCELLED} games, and ${OPPONENT_CLUBS} clubs to tell.`,
    }),
    paced({
      id: "approve",
      chapter: "ask",
      caption: "Approved.",
      cursor: "wd-approve",
      press: true,
    }),
    paced({
      id: "approve-land",
      chapter: "ask",
      caption: "The queue empties itself, and the row says withdrawn.",
      set: { approved: true },
      emphasize: "row-lakers",
      callout: "Everything after that press ran on its own, in one transaction.",
    }),

    /* ── 2. What approving does ───────────────────────────────────────── */
    paced({
      id: "details",
      chapter: "approve",
      caption: "The team keeps its page.",
      cursor: "details-lakers",
      press: true,
    }),
    paced({
      id: "details-land",
      chapter: "approve",
      caption: "Withdrawn, and everything the league holds about them is still here.",
      context: CTX_TEAM,
      set: { screen: "team", scroll: 0 },
      emphasize: "team-status",
    }),
    paced({
      id: "games",
      chapter: "approve",
      caption: `Their ${CANCELLED} games, every one of them cancelled.`,
      set: { scroll: 150 },
      emphasize: "team-games",
      callout: "Nobody opened a single one of these. The approval did it.",
    }),
    paced({
      id: "cascade",
      chapter: "approve",
      caption: "Four writes, and all four are one transaction.",
      context: CTX_CASCADE,
      set: { screen: "cascade" },
      emphasize: "cascade-card",
      callout: "If any one of the four had failed, none of them happened.",
    }),
    paced({
      id: "told",
      chapter: "approve",
      caption: `The ${OPPONENT_CLUBS} clubs they were due to play are told.`,
      context: CTX_NOTIF,
      set: { screen: "notif" },
      emphasize: "notif-row",
      callout: "Nobody assembled this list. The cancelled fixtures are the list.",
    }),
    paced({
      id: "told-honest",
      chapter: "approve",
      caption: "Club offices, on the bell and on their phones.",
      emphasize: "notif-row",
      callout:
        "Club offices only. This schedule was never published, so no family calendar carried these games.",
    }),

    /* ── 3. Who is now short ──────────────────────────────────────────── */
    paced({
      id: "schedule",
      chapter: "short",
      caption: `${CANCELLED} games came off a season that was already drawn.`,
      context: CTX_SCHEDULE,
      set: { screen: "schedule", scroll: 0 },
      emphasize: "gap-callout",
      callout: "The guarantee the league sold is the first thing a dropout breaks.",
    }),
    paced({
      id: "count",
      chapter: "short",
      caption: `${SHORT_COUNT} teams are under the ${GUARANTEE} game guarantee, and it names them.`,
      emphasize: "gap-list",
      callout: `Nine, each with its real count. The other ${UNTOUCHED} teams still have their ten.`,
    }),
    paced({
      id: "check",
      chapter: "short",
      caption: "Team check counts every team on its own.",
      set: { scroll: 330 },
      emphasize: "check-vanguard",
      callout: "Vanguard North Prep is on eight. The draw had them against the Lakers twice.",
    }),

    /* ── 4. Only the missing games ────────────────────────────────────── */
    paced({
      id: "preview",
      chapter: "fix",
      caption: "The fix is checked before it is run.",
      set: { scroll: 0 },
      cursor: "gap-preview",
      press: true,
    }),
    paced({
      id: "preview-land",
      chapter: "fix",
      caption: `${NEW_GAMES} games, and no trade-offs.`,
      set: { previewed: true, scroll: 280 },
      emphasize: "preview-panel",
      callout: `Ten missing team-slots is ${NEW_GAMES} games. Nothing is saved yet.`,
    }),
    paced({
      id: "preview-check",
      chapter: "fix",
      caption: "Team check reads the schedule the commit would leave.",
      set: { scroll: 620 },
      emphasize: "check-banner",
      callout:
        "Every game already on the board is booked as busy time before one new game is placed.",
    }),
    paced({
      id: "add",
      chapter: "fix",
      caption: "Add ONLY the missing games.",
      set: { scroll: 0 },
      cursor: "gap-add",
      press: true,
    }),
    paced({
      id: "add-dialog",
      chapter: "fix",
      caption: "The product says it in its own words.",
      set: { dialog: true },
      hold: 3200,
    }),
    paced({
      id: "confirm",
      chapter: "fix",
      caption: "Confirmed.",
      cursor: "confirm-add",
      press: true,
    }),
    paced({
      id: "committed",
      chapter: "fix",
      caption: "The warning is gone.",
      set: { dialog: false, committed: true },
      emphasize: "draft-strip",
      callout: `${NEW_GAMES} games appended. The season was never regenerated, and the ${GAMES_AFTER_CANCEL} already drawn kept their court and their time.`,
    }),
    paced({
      id: "proof",
      chapter: "fix",
      caption: "Every team in the division has its ten games back.",
      set: { scroll: 230 },
      emphasize: "check-head",
    }),
    paced({
      id: "end",
      chapter: "fix",
      caption:
        "A club left, ten games came off, nine teams were made whole, and nobody else's weekend moved.",
      hold: 5200,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get }) => {
    const screen = get<string>("screen", "teams")
    const scroll = get("scroll", 0)

    const desktop = (
      /* `globals.css` body: white, lit by two faint corner radials. */
      <div
        className="relative flex h-full flex-col bg-white"
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, rgba(99, 102, 241, 0.05), transparent 22%), radial-gradient(circle at top right, rgba(242, 78, 30, 0.04), transparent 18%)",
        }}
      >
        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {screen === "teams" && <TeamsScreen approved={get("approved", false)} />}
          {screen === "team" && <TeamPageScreen offset={scroll} />}
          {screen === "cascade" && <CascadeCard />}
          {screen === "notif" && <NotificationsScreen />}
          {screen === "schedule" && (
            <ScheduleScreen
              offset={scroll}
              previewed={get("previewed", false)}
              committed={get("committed", false)}
            />
          )}
        </div>

        {/* `schedule-tab.tsx` guards the gap commit with window.confirm; the
            scene has no browser chrome to hang a native sheet on, so it is
            drawn as a dialog carrying the confirm's exact sentence. */}
        <ConfirmDialog open={get("dialog", false)} title={COMMIT_CONFIRM} confirmId="confirm-add" />

        {get("endCard", false) && <EndCard />}
      </div>
    )

    return { desktop }
  },
}

/* ── Real components, copied ─────────────────────────────────────────────── */

/** `components/ui/badge.tsx` TONES. */
const BADGE_TONES = {
  neutral: "bg-ink-50 text-ink-600 ring-ink-200",
  play: "bg-play-50 text-play-700 ring-play-100",
  hoop: "bg-hoop-50 text-hoop-600 ring-hoop-100",
  court: "bg-court-50 text-court-700 ring-court-100",
  gold: "bg-gold-50 text-gold-600 ring-gold-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
} as const

function Badge({
  children,
  tone = "neutral",
  dot,
  className,
}: {
  children: ReactNode
  tone?: keyof typeof BADGE_TONES
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ring-1 ring-inset",
        BADGE_TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** `components/ui/panel-header.tsx`: brand accent bar, condensed uppercase. */
function PanelHeader({
  title,
  action,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1",
        className ?? "mb-4",
        Boolean(action) && "justify-between"
      )}
    >
      <span className="flex items-center gap-2.5">
        <span className="h-5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
        <span className="font-condensed text-ink-950 text-lg font-bold uppercase leading-none tracking-wide">
          {title}
        </span>
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  )
}

/** `manage/components/types.ts` panelClass. */
const PANEL =
  "rounded-3xl border border-ink-100 bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
/** `teams/[submissionId]/page.tsx` line 250. */
const PAGE_PANEL = "border-ink-100 shadow-soft rounded-2xl border bg-white p-5"

/** `components/ui/button.tsx` at the sizes and tones these screens use. */
function Button({
  children,
  id,
  tone = "brand",
  variant = "primary",
  className,
}: {
  children: ReactNode
  id?: string
  tone?: "brand" | "court" | "hoop" | "play"
  variant?: "primary" | "secondary" | "subtle"
  className?: string
}) {
  const primary =
    tone === "court"
      ? "bg-court-600 text-white"
      : tone === "hoop"
        ? "bg-hoop-600 text-white"
        : tone === "play"
          ? "bg-play-600 text-white"
          : "text-white"
  const secondary =
    tone === "court"
      ? "bg-court-50 text-court-700"
      : tone === "hoop"
        ? "bg-hoop-50 text-hoop-700"
        : "bg-play-50 text-play-700"
  return (
    <span
      data-demo-target={id}
      style={variant === "primary" && tone === "brand" ? { backgroundColor: "var(--brand)" } : undefined}
      className={cn(
        "inline-flex shrink-0 cursor-default items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-shadow duration-150 data-[demo-press=true]:shadow-inner data-[demo-press=true]:brightness-95 motion-reduce:transition-none",
        variant === "primary" && primary,
        variant === "secondary" && secondary,
        variant === "subtle" && "border-ink-200 text-ink-700 border bg-white",
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * A real page is taller than the 600 the stage gives it, so the pane scrolls
 * exactly as a browser would. Nothing is hidden; the column moves.
 */
function Pane({ offset, children }: { offset: number; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <div
        className="transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(${-offset}px)` }}
      >
        {children}
      </div>
    </div>
  )
}

/* ── The season console shell (`manage/page.tsx`) ────────────────────────── */

const TABS: Array<{ label: string; id?: string }> = [
  { label: "Overview" },
  { label: "Clubs" },
  { label: "Teams", id: "tab-teams" },
  { label: "Plan Your Season" },
  { label: "Schedule", id: "tab-schedule" },
  { label: "Standings" },
  { label: "Playoffs" },
  { label: "Referees" },
  { label: "⚙ Settings" },
]

function Console({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col px-6 py-3">
      <div className="flex shrink-0 items-baseline justify-between">
        <p className="text-ink-500 text-sm font-medium">&larr; {LEAGUE}</p>
        <p className="text-play-700 text-sm font-medium">Waiver signing status &rarr;</p>
      </div>
      <div data-demo-target="season-head" className="mt-1 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase leading-none tracking-wide">
            {SEASON}
          </h1>
          <p className="text-ink-500 mt-1 text-sm">{LEAGUE}</p>
          {/* `toneForStatus("FINALIZED")` is neutral. */}
          <Badge className="mt-2" tone="neutral">
            Finalized
          </Badge>
        </div>
        <Button variant="subtle">Season checklist</Button>
      </div>
      <div className="border-ink-100 mt-3 flex shrink-0 flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <span
            key={t.label}
            data-demo-target={t.id}
            className={cn(
              "relative -mb-px whitespace-nowrap px-3 py-2.5 text-sm font-semibold",
              t.label === tab ? "text-play-600" : "text-ink-500",
              "data-[demo-hover=true]:text-ink-800"
            )}
          >
            {t.label}
            {t.label === tab && (
              <span className="bg-play-600 absolute inset-x-2 -bottom-px h-0.5 rounded-full" />
            )}
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1 pt-4">{children}</div>
    </div>
  )
}

/* ── Teams tab ───────────────────────────────────────────────────────────── */

/** The four rows the pane draws of the registered list. Division D, `DB`. */
const REG_ROWS = [
  { name: "Alpha Elite", id: undefined as string | undefined },
  { name: TEAM, id: "row-lakers" },
  { name: "Burloak Elite (PRIME)", id: undefined },
  { name: "Vanguard North Prep", id: undefined },
]

function TeamsScreen({ approved }: { approved: boolean }) {
  return (
    <Console tab="Teams">
      <Pane offset={0}>
        {/* `teams-tab.tsx` line 57: grid gap-6. The roster-requests panel that
            sits between these two is not drawn (composition). */}
        <div className="grid gap-6">
          {/* `components/withdrawal-requests-panel.tsx`. It returns NULL when
              the queue is empty, so approving deletes it outright. */}
          {!approved && (
            <div
              data-demo-target="wd-panel"
              className="shadow-soft rounded-[28px] border border-amber-200 bg-amber-50/50 p-6"
            >
              <PanelHeader
                className="mb-1"
                title={
                  <span className="flex items-center gap-2">
                    Withdrawal requests
                    <Badge tone="warning">1</Badge>
                  </span>
                }
              />
              <p data-demo-target="wd-warn" className="text-ink-500 mb-4 text-xs">
                These clubs are asking to leave the season. Approving cancels their upcoming games
                and notifies opponents.
              </p>
              <ul className="space-y-3">
                <li className="border-ink-100 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3">
                  <div className="min-w-0">
                    <p className="text-ink-900 text-sm font-semibold">
                      {TEAM} · withdraw from {SEASON}
                    </p>
                    {/* The real line carries the requester's name; the seed
                        attributes this request to the league owner, so the demo
                        prints the reason and the date and nothing else
                        (numbers sheet G). */}
                    <p data-demo-target="wd-reason" className="text-ink-500 mt-0.5 text-xs">
                      &ldquo;{REASON}&rdquo; · {ASKED_ON}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button id="wd-approve">Approve</Button>
                    <Button variant="subtle">Decline</Button>
                  </div>
                </li>
              </ul>
            </div>
          )}

          {/* `teams-tab.tsx` "Registered teams": two rows of filter chips, then
              one row per submission. Four of the 146 rows are drawn. */}
          <div className={PANEL}>
            <PanelHeader
              title="Registered teams"
              action={
                <span className="flex flex-col items-end gap-1">
                  <span className="flex flex-wrap items-center justify-end gap-1">
                    {[
                      { label: `All (${SUBS_IN})`, on: true },
                      { label: "Pending (0)", on: false },
                      { label: `Approved (${approved ? TEAMS_IN - 1 : TEAMS_IN})`, on: false },
                      { label: "Rejected (1)", on: false },
                    ].map((o) => (
                      <span
                        key={o.label}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-medium",
                          o.on ? "bg-play-100 text-play-700" : "bg-ink-50 text-ink-500"
                        )}
                      >
                        {o.label}
                      </span>
                    ))}
                  </span>
                  <span className="flex flex-wrap items-center justify-end gap-1">
                    {[
                      { label: "Any payment", on: true },
                      { label: `Unpaid (${SUBS_IN})`, on: false },
                      { label: "Paid (0)", on: false },
                    ].map((o) => (
                      <span
                        key={o.label}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-medium",
                          o.on ? "bg-hoop-100 text-hoop-700" : "bg-ink-50 text-ink-500"
                        )}
                      >
                        {o.label}
                      </span>
                    ))}
                  </span>
                </span>
              }
            />
            {REG_ROWS.map((r) => {
              const gone = r.name === TEAM && approved
              return (
                <div
                  key={r.name}
                  data-demo-target={r.id}
                  className="border-court-100 bg-court-50 mb-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <span className="text-ink-900 font-medium">{r.name}</span>
                    <span className="text-play-700 ml-2 text-xs">{DIVISION}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={gone ? "neutral" : "court"} className={gone ? "live-pop" : ""}>
                      {gone ? "withdrawn" : "approved"}
                    </Badge>
                    <Badge tone="warning">unpaid</Badge>
                    <span
                      data-demo-target={r.name === TEAM ? "details-lakers" : undefined}
                      className="text-play-600 whitespace-nowrap text-xs font-semibold"
                    >
                      Details &rarr;
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Pane>
    </Console>
  )
}

/* ── The team page (`teams/[submissionId]/page.tsx`) ─────────────────────── */

function TeamPageScreen({ offset }: { offset: number }) {
  return (
    <Pane offset={offset}>
      <div className="mx-auto w-full max-w-5xl space-y-5 p-4">
        <div>
          <p className="text-ink-500 text-sm font-medium">
            &larr; {LEAGUE} · {SEASON}
          </p>
          <div data-demo-target="team-status" className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-ink-900 text-2xl font-bold">{TEAM}</h1>
            <Badge tone="neutral">withdrawn</Badge>
            <Badge tone="warning">unpaid</Badge>
          </div>
          <p className="text-ink-500 mt-1 text-sm">
            {DIVISION} ·{" "}
            <span className="text-play-600">public page &rarr;</span>
          </p>
        </div>

        {/* `submission-actions.tsx` as a WITHDRAWN submission renders it: no
            Approve, no Reject, no Withdraw. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-600 flex items-center gap-1.5 text-xs">
            Weekend preference
            <span className="border-ink-200 flex overflow-hidden rounded-lg border">
              <span className="bg-ink-950 px-2.5 py-1 text-[11px] font-semibold text-white">
                League default
              </span>
              <span className="text-ink-600 bg-white px-2.5 py-1 text-[11px] font-semibold">
                One trip (both games same day)
              </span>
              <span className="text-ink-600 bg-white px-2.5 py-1 text-[11px] font-semibold">
                Split days (Sat + Sun)
              </span>
            </span>
          </span>
          <span className="text-ink-600 flex items-center gap-1.5 text-xs">
            <span className="border-ink-300 h-3.5 w-3.5 rounded border bg-white" />
            Schedule requests
            <span className="text-ink-400">
              (club can ask for windows/blackouts, approval required, best effort)
            </span>
          </span>
          <Button variant="secondary" tone="court">
            Mark paid
          </Button>
          <Button variant="subtle">Waive fee</Button>
        </div>

        <div className={PAGE_PANEL}>
          <h2 className="text-ink-900 mb-1 text-sm font-bold uppercase tracking-wide">Roster (0)</h2>
          <p className="text-ink-500 mb-3 text-xs">
            No roster submitted yet · showing the club&apos;s current roster.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-400 border-ink-100 border-b text-left text-xs uppercase">
                <th className="py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Player</th>
                <th className="py-1.5 pr-2">Age</th>
                <th className="py-1.5 pr-2">Position</th>
                <th className="py-1.5 pr-2">GP</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* The Games panel, the reason this page is in the story. */}
        <div data-demo-target="team-games" className={PAGE_PANEL}>
          <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">
            Games ({CANCELLED})
          </h2>
          {LAKERS_GAMES.map((g) => (
            <p key={`${g.date}-${g.opponent}`} className="text-ink-700 mb-1 text-sm">
              {g.date} · {g.home ? TEAM : g.opponent} vs {g.home ? g.opponent : TEAM} · cancelled
            </p>
          ))}
        </div>
      </div>
    </Pane>
  )
}

/* ── The cascade card ────────────────────────────────────────────────────── */

/**
 * NARRATION, NOT A SCREEN.
 *
 * `decideWithdrawalRequest` runs its four writes inside one transaction and
 * shows the operator nothing at all afterwards, so this card is drawn in navy
 * with no console chrome anywhere near it. Punch item 3 in the numbers sheet;
 * the fix is a receipt panel on the Teams tab.
 */
function CascadeCard() {
  return (
    <div
      data-demo-target="cascade-card"
      className="flex min-h-0 flex-1 flex-col justify-center bg-[#0b1628] px-12 py-6 text-white"
    >
      <p className="font-display text-[30px] font-extrabold leading-none">
        One transaction, four writes
      </p>
      <p className="mt-1.5 text-[16px] font-semibold text-white/70">
        {TEAM} · {DIVISION}
      </p>

      <div className="mt-5 space-y-2.5">
        {CASCADE.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline gap-4 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3"
          >
            <span className="text-gold-400 w-[46px] shrink-0 text-[24px] font-extrabold leading-none tabular-nums">
              {r.n}
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-bold">{r.label}</span>
              <span className="mt-0.5 block text-[15px] font-medium leading-snug text-white/60">
                {r.note}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── The opponents' inbox (`(platform)/notifications/page.tsx`) ──────────── */

function NotificationsScreen() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
      <p className="text-ink-500 text-sm font-medium">&larr; Account</p>
      <div
        data-demo-target="notif-head"
        className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
      >
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Inbox
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-ink-950 text-3xl font-bold">
            Notifications
            <span className="text-ink-500 ml-2 text-sm font-normal">(1 unread)</span>
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-play-600 text-sm font-semibold">Mark all as read</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div
          data-demo-target="notif-row"
          className="border-play-200 bg-play-50/30 shadow-soft live-pop rounded-2xl border p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-ink-900 text-sm font-semibold">{NOTICE.title}</h3>
                <span className="bg-play-500 h-2 w-2 rounded-full" />
              </div>
              <p className="text-ink-600 mt-1 text-sm">{NOTICE.body}</p>
              <p className="text-ink-400 mt-1 text-xs">{NOTICE.when}</p>
            </div>
            <span className="text-ink-300 ml-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm">
              &#x2715;
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── The Schedule tab (`manage/components/schedule-tab.tsx`) ─────────────── */

function ScheduleScreen({
  offset,
  previewed,
  committed,
}: {
  offset: number
  previewed: boolean
  committed: boolean
}) {
  const drafts = committed ? DRAFTS_AFTER : GAMES_AFTER_CANCEL
  return (
    <Console tab="Schedule">
      <Pane offset={offset}>
        <div className={PANEL}>
          <PanelHeader title="Generate the schedule" />

          {/* `plan-door.tsx` JourneyStrip at stage 3. */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            {["Plan", "Divisions", "Generate", "Publish"].map((label, i) => (
              <span key={label} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-ink-300">&rarr;</span>}
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5",
                    i < 3
                      ? "border-court-200 bg-court-50 text-court-700"
                      : "border-play-600 bg-play-600 text-white"
                  )}
                >
                  {i < 3 ? "✓ " : ""}
                  {label}
                </span>
              </span>
            ))}
          </div>

          <p className="text-ink-500 -mt-2 mb-3 text-xs">
            Built on plan <span className="text-ink-800 font-semibold">Showcase 2026-27</span>
            {" · "}
            <span className="text-play-600 font-semibold">change</span>
          </p>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button>Preview whole season</Button>
            <Button tone="court">Commit whole season</Button>
            <Button variant="secondary" tone="hoop">
              Delete all
            </Button>
          </div>

          {/* The guarantee callout, lines 680 to 709. It stops rendering the
              moment `gapTeams` is empty, which is the whole payoff. */}
          {!committed && (
            <div
              data-demo-target="gap-callout"
              className="border-amber-200 bg-amber-50 mb-4 rounded-xl border px-3 py-2.5"
            >
              <p className="text-amber-900 text-xs font-semibold">
                {SHORT_COUNT} teams are below the {GUARANTEE}-game guarantee
                {" · "}
                <span className="font-normal">
                  usually a dropout, a late-added team, or a new make-up session.
                </span>
              </p>
              <p data-demo-target="gap-list" className="text-amber-800 mt-0.5 text-[11px]">
                {SHORT_TEAMS.slice(0, 4)
                  .map((t) => `${t.name} (${t.count})`)
                  .join(" · ")}
                {` · +${SHORT_TEAMS.length - 4} more`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button id="gap-preview">Preview the fix</Button>
                <Button id="gap-add" tone="court">
                  Add ONLY the missing games
                </Button>
                <span className="text-amber-700 text-[11px]">
                  Nobody&apos;s existing games move.
                </span>
              </div>
            </div>
          )}

          {/* The draft strip, lines 711 to 721. `draftCount` counts every
              unpublished game, and in this season that is all of them. */}
          <div
            data-demo-target="draft-strip"
            className={cn(
              "border-gold-200 bg-gold-50 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2",
              committed && "live-pop"
            )}
          >
            <p className="text-gold-700 text-xs font-semibold">
              {drafts} draft games · visible only to you until you publish. Review below, re-run
              sessions freely, then publish once.
            </p>
            <Button>Publish schedule · {drafts} new</Button>
          </div>

          {/* The preview panel, lines 733 to 806. */}
          {previewed && !committed && (
            <div
              data-demo-target="preview-panel"
              className="border-play-200 bg-play-50 live-pop mb-6 rounded-2xl border p-4"
            >
              <p className="text-play-800 mb-2 text-sm font-semibold">
                Preview: {NEW_GAMES} games
              </p>
              <p className="text-court-700 mb-3 text-xs font-semibold">
                ✓ No trade-offs · every rule held: shares, rest days, rematch spacing, court
                rotation.
              </p>
              <p className="text-ink-500 mb-3 text-xs">
                Slots used: {NEW_GAMES} / 38
              </p>
              <div className="overflow-hidden rounded-xl bg-white">
                <table className="text-ink-700 w-full text-xs">
                  <thead className="bg-ink-50 text-ink-500 text-[10px] uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-1.5 text-left">When</th>
                      <th className="px-3 py-1.5 text-left">Home</th>
                      <th className="px-3 py-1.5 text-left">Away</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PREVIEW_GAMES.map((g) => (
                      <tr key={g.when + g.home} className="border-ink-100 border-t">
                        <td className="px-3 py-1.5">{g.when}</td>
                        <td className="px-3 py-1.5">{g.home}</td>
                        <td className="px-3 py-1.5">{g.away}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* `team-check.tsx`, nested in this panel exactly as the tab nests
              it. Filmed over Division D (composition). */}
          <div className="mb-4">
            <TeamCheck previewing={previewed && !committed} committed={committed} />
          </div>
        </div>
      </Pane>
    </Console>
  )
}

/** `manage/components/team-check.tsx` lines 62 to 130. */
function TeamCheck({ previewing, committed }: { previewing: boolean; committed: boolean }) {
  const allGood = previewing || committed
  const fully = allGood ? CHECK_ROWS.length : 1
  return (
    <div className={PANEL}>
      <PanelHeader
        title="Team check"
        action={
          allGood ? (
            <span data-demo-target="check-head">
              <Badge tone="court" dot>
                Every team has {GUARANTEE} games
              </Badge>
            </span>
          ) : (
            <span data-demo-target="check-head" className="text-ink-500 text-xs font-semibold">
              {fully} of {CHECK_ROWS.length} teams fully scheduled
            </span>
          )
        }
      />
      {previewing && (
        <div
          data-demo-target="check-banner"
          className="border-play-200 bg-play-50 -mt-1 mb-3 rounded-xl border px-3 py-1.5"
        >
          <p className="text-play-700 text-xs font-semibold">
            Showing the preview · nothing is saved yet. Commit to keep this plan.
          </p>
        </div>
      )}
      <p className="text-ink-500 -mt-2 mb-3 text-xs">
        Click a team to see its schedule · when they play, who they play, and where.
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {CHECK_ROWS.map((t) => {
          const n = allGood ? GUARANTEE : t.count
          const done = n >= GUARANTEE
          return (
            <div
              key={t.name}
              data-demo-target={t.name.startsWith("Vanguard") ? "check-vanguard" : undefined}
              className={cn(
                "rounded-xl border transition-colors duration-500 motion-reduce:transition-none",
                done ? "border-court-200 bg-court-50/60" : "border-amber-200 bg-amber-50/50"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                      done ? "bg-court-600 text-white" : "bg-amber-400 text-white"
                    )}
                  >
                    {done ? "✓" : n}
                  </span>
                  <span className="text-ink-900 truncate text-sm font-medium">{t.name}</span>
                  <span className="text-ink-400 hidden truncate text-xs sm:inline">{DIVISION}</span>
                </span>
                <span className="text-ink-600 shrink-0 text-xs font-semibold">
                  {n} / {GUARANTEE} games
                  <span className="text-ink-300 ml-1.5">▾</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── The confirm, and the end ────────────────────────────────────────────── */

function ConfirmDialog({
  open,
  title,
  confirmId,
}: {
  open: boolean
  title: string
  confirmId: string
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1628]/45 px-8">
      <div className="live-pop w-full max-w-[560px] rounded-2xl bg-white p-5 shadow-[0_40px_90px_-40px_rgba(15,23,42,0.7)]">
        <h4 className="text-ink-950 text-base font-semibold leading-snug">{title}</h4>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="subtle">Cancel</Button>
          <Button id={confirmId} tone="court">
            OK
          </Button>
        </div>
      </div>
    </div>
  )
}

function EndCard() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b1628] px-10 text-white">
      <div className="live-pop max-w-[620px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A league chapter
        </p>
        <h3 className="font-display mt-2 text-[30px] font-extrabold leading-tight">
          A team drops out
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          One approval withdrew the club, cancelled {CANCELLED} games, told {OPPONENT_CLUBS}{" "}
          opposing clubs and left the season&apos;s history intact. The schedule named the{" "}
          {SHORT_COUNT} teams it had shortchanged, and {NEW_GAMES} added games made them whole
          without moving one of the {GAMES_AFTER_CANCEL} games already drawn.
        </p>
        <p className="mt-4 text-[14px] font-semibold text-white/50">Next: the referees</p>
      </div>
    </div>
  )
}
