"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { TypeText } from "../motion"
import type { DemoBeat, DemoScript } from "../types"
import { AppIcon } from "./your-week-story"

/**
 * "The referees", rebuilt 2026-08-19 to the realism standard (mock-ui.tsx
 * R1–R8) over the 2026-08-16 gold-standard cut.
 *
 * WHAT THE 08-16 CUT GOT RIGHT AND KEPT: the shape of the story. A league
 * books a DAY rather than a game, broadcasts it to a pool at a stated
 * per-game rate, and the first referee to answer is assigned every game
 * inside the window. Then the camera turns to his phone, and the last
 * chapter is the league's side of the money. None of that moved.
 *
 * WHAT CHANGED IS FIDELITY. The 08-16 cut drew the league desk out of the
 * demo kit's own primitives (`scene-kit.tsx` Panel / Btn / Chip /
 * ConsoleTabs) rather than out of the real console, split the one Referees
 * tab into two invented screens, and finished the referee's phone on a line
 * the product never writes. Every screen below is now the real component's
 * markup, the tab is ONE page filmed in its real scroll positions, and every
 * flow runs to the state the product really lands on.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited):
 *   · the console shell is `manage/leagues/[id]/seasons/[seasonId]/manage/
 *     page.tsx`: SmartBack, the condensed uppercase h1 carrying the SEASON
 *     label, the league name under it, the status Badge, then the flat
 *     nine-tab row (`-mb-px`, play-600 underline on the selected one);
 *   · the desk is `manage/components/referees-tab.tsx`, ALL FOUR of its
 *     panels on one page in their real order: "Book a referee for a session
 *     day" with its own sentence and its `SHIFT_PRESETS`, "Offers", "League
 *     referee pool" with its count pill and its add-a-referee search, and
 *     the "Referee settlements" card. `panelClass` and `inputClass` come from
 *     `manage/components/types.ts`, `PanelHeader` and `Badge` from
 *     `components/ui`;
 *   · the two comboboxes are `components/ui/brand-listbox.tsx` (44px trigger,
 *     chevron that rotates, the portal panel with its 44px options, the
 *     amber check on the selected one, and the upward flip the component
 *     performs when there is under 280px below it). Their option LABELS are
 *     the real ones: `referees-tab.tsx` line 299 writes the referee's fee and
 *     that day's availability into the option text;
 *   · the time fields are `components/ui/date-time-picker.tsx` in `mode="time"`;
 *   · the post-send confirmation is the route's own sentence, `referees-tab.tsx`
 *     line 191: "Offer broadcast to N referees, first to accept gets the day";
 *   · the push is `api/leagues/[id]/referee-requests/route.ts` lines 172 to 176
 *     word for word, delivered as an iOS banner with the approved app mark (R8);
 *   · the referee's inbox is `app/(platform)/referee/requests/page.tsx`, down
 *     to the "first accept wins" pill, the quoted message, the pay sentence,
 *     the court-tinted confirmation with its "Open My games" link, and the
 *     "Your booked shifts" section the accept really produces;
 *   · his schedule is `app/(platform)/referee/page.tsx` in BOTH states: the
 *     real empty state before the booking ("No games on your schedule yet")
 *     and "Coming up (8)" with the real game rows after it;
 *   · his calendar is `app/(platform)/calendar/page.tsx` + `my-calendar.tsx`
 *     in the agenda view, through `components/calendar/agenda-list.tsx`
 *     (sticky month header, 60px date tile) with `KIND_CARD` / `KIND_EDGE`
 *     on the cards, and `components/calendar/add-to-phone.tsx` for the
 *     subscribe control and its "Opening Apple Calendar…" panel;
 *   · the ICS titles are `api/calendar/[token]/route.ts` line 165;
 *   · the bottom bar is `components/nav/bottom-tabs.tsx`: icon over label,
 *     the active tab in its energy capsule, and "My Games" as the referee's
 *     context tab (`contextTab`, line 88).
 *
 * DELIBERATE DEPARTURES, ALL DECLARED:
 *   · EM DASHES BECOME MIDDOTS. The product writes "Weekend 10 — Sat, Aug 8",
 *     "accepted — Mike Ferreira", "Offer broadcast to N referees — first to",
 *     "Officiating — X vs Y" and "Paid per game officiated — accepting means".
 *     The house copy rule bans em-dashes on screen, so each is a middot here.
 *     The EN dashes are kept exactly as the product writes them: the shift
 *     presets really read "Morning 6h (9–3)" and a window really reads
 *     "09:00–15:00".
 *   · COMPOSITION, NOT INVENTION. The pane is 1160x600 (900 while the phone
 *     is on stage) and the real Referees tab is about 1000px tall, so it
 *     scrolls inside the pane exactly as it does in a browser rather than
 *     being squeezed. The session-day list shows three of the season's days
 *     and the settlements card four of its six rows.
 *   · The requests page's right-hand link pair ("My games", "My profile →")
 *     is dropped on the handset: the real header is `flex items-center
 *     justify-between` with no wrap, and at 390 it crushes the title. The
 *     path to My games is taken the way the product offers it after an
 *     accept, through the confirmation's own "Open My games" link.
 *   · THE INVENTED SUMMARY STRIP IS GONE. The 08-16 cut ended the desk on a
 *     "The day just booked / 8 games / $400 / 0 by hand" band. The product
 *     raises no such panel; the arithmetic belongs on the end card.
 *   · No toasts anywhere. Every action in this story has real product
 *     feedback (the note banner, the offer Badge, the confirmation, the
 *     Confirmed pill), and a toast on top of one is demo chrome.
 *
 * INVENTED-CONTENT LEDGER (everything not read from the seeded world, which
 * `docs/roadmap/the-referees-numbers.md` documents row by row):
 *   · the two neighbouring session days in the day list (Aug 1 and Aug 15)
 *     follow the season's weekly cadence; only Weekend 10 · Sat, Aug 8 is
 *     the row this demo books;
 *   · the iOS Calendar takeover is OS chrome, hand-authored, not product UI.
 *
 * FOUR THINGS THE PRODUCT CANNOT HONESTLY SHOW, AND THEY ARE NOT STAGED
 * (numbers sheet section F): no money moves on a settlement, availability is
 * positive windows only with no blackout, the native referee screen carries
 * no rate, and officiating rides the one personal calendar feed rather than
 * a referee-only one. The demo claims none of the four.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const LEAGUE = "NPH Summer League"
const SEASON = "Summer 2026"
/** `DB` Season.status IN_PROGRESS. `PRODUCT` `manage/page.tsx` STATUS_LABELS. */
const SEASON_STATUS = "In Progress"
const CTX = `${LEAGUE} · ${SEASON} · Referees`

/** The day being booked. `DB` SeasonSessionDay 073ce624, Sat 8 August 2026. */
const DAY = "Sat, Aug 8"
const SESSION = "Weekend 10"
/** `PRODUCT` `referees-tab.tsx` line 86: `${session.label} — ${EEE, MMM d}`. */
const DAY_OPTION = `${SESSION} · ${DAY}`
/** `PRODUCT` the offer list's own window format, `${startTime}–${endTime}`. */
const WINDOW = "09:00–15:00"
/** `PRODUCT` `SHIFT_PRESETS`, verbatim, en dashes and all. */
const PRESETS = ["Full day (9–6)", "Morning 6h (9–3)", "Afternoon (12–6)"]
const PRESET = PRESETS[1]
const RATE = 50

/** The referee whose phone this is. `DB` summer-ref-mike@sportshub.demo. */
const REF = "Mike Ferreira"

/**
 * The league's pool. `DB` three `LeagueReferee` rows, each with a
 * `RefereeProfile`. The row text is the product's own order (`referees-tab.tsx`
 * lines 400 to 407): certification, "Self-declared" when no document is on
 * file, games refereed, rate. All three hold a sign-off PIN, so none carries
 * the "no sign-off PIN" flag the product would otherwise append, and none has
 * uploaded a certificate, so none carries a Verified badge.
 */
const POOL = [
  { id: "pool-mike", name: REF, cert: "Level 3", games: 40, fee: RATE, avail: "available" },
  { id: "pool-sarah", name: "Sarah Whitlock", cert: "Level 2", games: 57, fee: RATE, avail: "available" },
  {
    id: "pool-james",
    name: "James Okonkwo",
    cert: "Level 3",
    games: 74,
    fee: RATE,
    avail: "no availability set",
  },
] as const

/**
 * The offer's message. `DB` verbatim from the seeded `RefereeSessionRequest`;
 * the row carries an em-dash and the house copy rule turns it into a middot.
 */
const MESSAGE = "Saturday morning block · three courts running at the Playground."

/**
 * The games the accept assigns. `DB` eight published games on that session
 * day, seven tipping at 9:00 and one at 10:30, so all eight fall inside the
 * 09:00 to 15:00 window `inShiftWindow` tests. Four are drawn; the product's
 * own "Coming up (8)" header carries the true count and the list scrolls.
 */
const GAMES = [
  {
    at: "9:00 AM",
    home: "Toronto Lords Grade 9",
    away: "West United Prep Grade 9",
    venue: "The Playground",
    court: "Court 1",
  },
  {
    at: "9:00 AM",
    home: "CKATT Basketball Grade 9",
    away: "Oakville Panthers Grade 9",
    venue: "The Playground",
    court: "Court 2",
  },
  {
    at: "9:00 AM",
    home: "Kings Court Basketball Grade 9",
    away: "Mississauga Monarchs Grade 9",
    venue: "The Playground",
    court: "Court 3",
  },
  {
    at: "9:00 AM",
    home: "Burlington Force Grade 9",
    away: "North Toronto Huskies Grade 9",
    venue: "Haber Recreation Centre",
    court: "Court 1",
  },
]
/** `DB` the eighth game on that day, the only one that tips after nine. */
const LATE_GAME = {
  at: "10:30 AM",
  home: "Burlington Force Grade 10",
  away: "North Toronto Huskies Grade 10",
  venue: "The Playground",
  court: "Court 1",
}
/** `DB` the full count on that day. */
const GAME_COUNT = 8
/** `ARITH` eight games at the agreed rate. */
const DAY_PAY = GAME_COUNT * RATE

/** `PRODUCT` `referees-tab.tsx` line 191, em-dash to middot. */
const SENT_NOTE = `Offer broadcast to ${POOL.length} referees · first to accept gets the day.`
/** `PRODUCT` `referee/requests/page.tsx` lines 76 to 80, the assigned branch. */
const ACCEPTED_NOTE = `You're booked: assigned to ${GAME_COUNT} games that day. See them in My games.`
/* The same lines carry a SECOND branch, and this demo does not take it:
   "You're booked. The league hasn't published that day's schedule yet, so your
   games will appear in My games when it goes out." It fires when
   `gamesAssigned` is 0. `DB` all eight of that day's games are published, so
   the counted branch above is the honest one, and the `drafts` beat says out
   loud why the other branch exists. */
/** `PRODUCT` `referee/requests/page.tsx` lines 202 to 204, em-dash to middot. */
const PAY_TERMS =
  "Paid per game officiated · accepting means agreeing to this rate. Games are tallied after the session and confirmed by the league before settlement."

/** `PRODUCT` `api/leagues/[id]/referee-requests/route.ts` lines 172 to 176. */
const PUSH_TITLE = `${LEAGUE} needs a referee`
const PUSH_BODY = `${DAY} (${SESSION}), ${WINDOW}. First to accept gets the day. "${MESSAGE}"`

/** `PRODUCT` `api/calendar/[token]/route.ts` line 165, em-dash to middot. */
const ICS_TITLE = (g: (typeof GAMES)[number]) => `Officiating · ${g.home} vs ${g.away}`
/** `DB` Venue c805d634. `PRODUCT` the feed joins venue name and address. */
const ICS_WHERE = "The Playground, 952 Century Dr, Burlington"

/**
 * The settlements. `DB` six `RefereeSettlement` rows on this league, three per
 * session date, four games each at $50. The 11 July set is CONFIRMED and the
 * 25 July set is PENDING_CONFIRM, which is exactly the pair of states the
 * card is built to show. Four of the six fit the 600 logical box; the two left
 * off are Sarah's and James's confirmed 11 July rows.
 */
const SETTLEMENTS = [
  { name: REF, date: "Jul 25", games: 4, rate: RATE, total: 200, confirmed: false },
  { name: "Sarah Whitlock", date: "Jul 25", games: 4, rate: RATE, total: 200, confirmed: false },
  { name: "James Okonkwo", date: "Jul 25", games: 4, rate: RATE, total: 200, confirmed: false },
  { name: REF, date: "Jul 11", games: 4, rate: RATE, total: 200, confirmed: true },
]

/**
 * Where the pane sits for each part of the tab. The real page is about a
 * thousand logical pixels tall and the stage gives it under four hundred, so
 * it scrolls the way a browser scrolls it. The narrow figure is the same
 * landmark once the phone is on stage and the region is composed at 900.
 */
const SCROLL = { top: 0, pool: 424, offersNarrow: 336, settle: 790 }

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  /* Human pace (owner 2026-08-19): people click, then click again. Long
     reads only where a balloon earns one. Copied from your-week-story. */
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const theRefereesStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/manage/leagues/nph-summer/seasons/summer-2026/manage?tab=referees",
  context: CTX,
  initialStage: "desktop",
  roles: {
    desktop: { label: "League", tone: "league" },
    phone: { label: "Referee", tone: "referee" },
  },
  chapters: [
    { id: "book", title: "The league books a day" },
    { id: "accept", title: "First accept wins" },
    { id: "his", title: "His games, his calendar" },
    { id: "pay", title: "What the day pays" },
  ],

  /* ENGINE LAW, obeyed everywhere below: a beat's `set` applies at its START,
     so a press whose own patch removes its target deletes the thing the cursor
     is flying at. Every press is its own beat; the landing is the next one. */
  beats: [
    /* ── 1. The league books a day ────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "book",
      caption: "Referees have their own tab in the league console.",
      emphasize: "book-panel",
    }),
    paced({
      id: "day",
      chapter: "book",
      caption: "The league books a DAY, not a game.",
      cursor: "book-day",
      press: true,
    }),
    paced({
      id: "day-open",
      chapter: "book",
      caption: "Every day the season runs.",
      set: { dayOpen: true },
    }),
    paced({
      id: "day-pick",
      chapter: "book",
      caption: "The second Saturday in August.",
      cursor: "day-opt",
      press: true,
    }),
    paced({
      id: "day-land",
      chapter: "book",
      caption: "One day chosen, and the pool answers it.",
      set: { dayPicked: true, dayOpen: false },
    }),
    paced({
      id: "pool",
      chapter: "book",
      caption: "The pool is a list the league keeps, and every row carries a rate.",
      set: { scroll: SCROLL.pool },
      emphasize: "pool-rows",
    }),
    paced({
      id: "avail",
      chapter: "book",
      caption: "Two have said they can work it. One has never said anything.",
      emphasize: "pool-james",
      callout: "He has not answered, and the product refuses to read a blank as a no.",
    }),
    paced({
      id: "shift",
      chapter: "book",
      caption: "The shift is one press.",
      set: { scroll: SCROLL.top },
      cursor: "preset-morning",
      press: true,
    }),
    paced({
      id: "shift-land",
      chapter: "book",
      caption: "Nine to three.",
      set: { shiftSet: true },
      emphasize: "shift-field",
      callout: "Every game that tips inside that window is what the accept will assign.",
    }),
    paced({
      id: "sendto",
      chapter: "book",
      caption: "It does not have to go to one person.",
      cursor: "send-to",
      press: true,
    }),
    paced({
      id: "sendto-open",
      chapter: "book",
      caption: "Every referee in the pool, with that day's answer beside the name.",
      set: { targetOpen: true },
      emphasize: "target-list",
      callout: "The other two see the offer close the moment somebody takes it.",
    }),
    paced({
      id: "sendto-pick",
      chapter: "book",
      caption: "So it goes to all three.",
      cursor: "target-all",
      press: true,
    }),
    paced({
      id: "rate",
      chapter: "book",
      caption: "The rate goes on the offer.",
      set: { targetOpen: false },
      cursor: "rate-field",
      type: { key: "rateTyped", text: `${RATE}` },
      callout: "Accepting is agreeing to the rate, so the price is settled before anyone arrives.",
    }),
    paced({
      id: "message",
      chapter: "book",
      caption: "And a line about the morning.",
      cursor: "msg-field",
      type: { key: "msgTyped", text: MESSAGE },
      hold: 4200,
    }),
    paced({
      id: "send",
      chapter: "book",
      caption: "Send it.",
      cursor: "send-offer",
      press: true,
    }),
    paced({
      id: "sent",
      chapter: "book",
      caption: "One offer, three phones, and no follow-up to make.",
      set: { sent: true },
      emphasize: "sent-note",
    }),

    /* ── 2. First accept wins ─────────────────────────────────────────── */
    paced({
      id: "phone-in",
      actor: "phone", // the offer lands with the referee
      chapter: "accept",
      caption: `On ${REF}'s phone, his schedule is still empty.`,
      stage: "split",
      set: { phoneView: "games" },
      emphasize: "phone-empty",
    }),
    paced({
      id: "push",
      chapter: "accept",
      caption: "The offer arrives the way a phone delivers things.",
      set: { banner: true },
      hold: 3000,
    }),
    paced({
      id: "push-tap",
      chapter: "accept",
      caption: "He opens it.",
      cursor: "push-open",
      press: true,
    }),
    paced({
      id: "push-land",
      chapter: "accept",
      caption: "His own shift inbox.",
      set: { phoneView: "requests", banner: false },
    }),
    paced({
      id: "offer",
      chapter: "accept",
      caption: "The league, the day, the hours, the money and the terms are all on the card.",
      emphasize: "offer-card",
    }),
    paced({
      id: "accept",
      chapter: "accept",
      caption: "He takes it.",
      cursor: "accept-btn",
      press: true,
    }),
    paced({
      id: "booked",
      chapter: "accept",
      caption: "Booked, and the offer becomes a shift.",
      set: { accepted: true },
      emphasize: "accept-note",
      callout: `Accepting assigned him to all ${GAME_COUNT} games inside the window. He picked none of them.`,
    }),
    paced({
      id: "league-side",
      actor: "desktop", // the league finds out
      chapter: "accept",
      caption: "The league finds out without being asked.",
      set: { scroll: SCROLL.offersNarrow },
      emphasize: "offer-row",
      callout: "Nobody phoned the league, and the other two referees' offer closed in the same moment.",
    }),

    /* ── 3. His games, his calendar ───────────────────────────────────── */
    paced({
      id: "open-games",
      actor: "phone", // his schedule, his games
      chapter: "his",
      caption: "The confirmation offers the way to the schedule it just made.",
      cursor: "open-mygames",
      press: true,
    }),
    paced({
      id: "mygames",
      chapter: "his",
      caption: "Eight games, next one first.",
      set: { phoneView: "games", scroll: SCROLL.top },
      emphasize: "phone-games",
    }),
    paced({
      id: "card",
      chapter: "his",
      caption: "Each card says the day, the floor, the matchup and what it pays.",
      emphasize: "game-1",
    }),
    paced({
      id: "drafts",
      chapter: "his",
      caption: "Only games the league has actually published are ever on this list.",
      emphasize: "phone-games",
      callout: "A draft game is the league's private copy, so it never reaches a referee.",
    }),
    paced({
      id: "cal-tap",
      chapter: "his",
      caption: "Then his own calendar.",
      cursor: "tab-calendar",
      press: true,
    }),
    paced({
      id: "cal-land",
      chapter: "his",
      caption: "The officiating is on it already.",
      set: { phoneView: "calendar" },
      emphasize: "cal-agenda",
    }),
    paced({
      id: "add",
      chapter: "his",
      caption: "One control puts it in the calendar app he already uses.",
      cursor: "add-phone",
      press: true,
    }),
    paced({
      id: "add-land",
      chapter: "his",
      caption: "Subscribe once.",
      set: { addOpen: true },
      emphasize: "add-panel",
    }),
    paced({
      id: "os",
      chapter: "his",
      caption: "And his Saturday fills itself in.",
      set: { osCal: true },
      hold: 3600,
      callout: "It is a live feed, so a cancelled or moved game corrects itself.",
    }),

    /* ── 4. What the day pays ─────────────────────────────────────────── */
    paced({
      id: "settle",
      chapter: "pay",
      caption: "After the session, the league already knows what it owes.",
      stage: "desktop",
      set: { scroll: SCROLL.settle, osCal: false, addOpen: false },
      emphasize: "settle-panel",
    }),
    paced({
      id: "confirm",
      chapter: "pay",
      caption: "The league checks the tally and confirms it.",
      cursor: "settle-confirm",
      press: true,
    }),
    paced({
      id: "confirmed",
      chapter: "pay",
      caption: "Confirmed, at the rate on the offer he accepted.",
      set: { confirmed: true },
      emphasize: "settle-row",
      callout: "Confirming stores the number, so nobody recounts games in October.",
    }),
    paced({
      id: "end",
      chapter: "pay",
      caption:
        "One day booked, one referee, eight games assigned from that accept, and the day's total on the record.",
      hold: 4400,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const desktop = (
      /* `globals.css` body: white, lit by two faint corner radials. */
      <div
        className="relative flex h-full flex-col bg-white"
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, rgba(99, 102, 241, 0.05), transparent 22%), radial-gradient(circle at top right, rgba(242, 78, 30, 0.04), transparent 18%)",
        }}
      >
        <Console>
          <Pane offset={get("scroll", 0)}>
            <RefereesTab
              dayOpen={get("dayOpen", false)}
              dayPicked={get("dayPicked", false)}
              shiftSet={get("shiftSet", false)}
              targetOpen={get("targetOpen", false)}
              rateTyped={get<string>("rateTyped", "")}
              msgTyped={get<string>("msgTyped", "")}
              typingKey={typingKey}
              sent={get("sent", false)}
              accepted={get("accepted", false)}
              confirmed={get("confirmed", false)}
            />
          </Pane>
        </Console>
        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = (
      <Phone
        view={get<string>("phoneView", "games")}
        accepted={get("accepted", false)}
        banner={get("banner", false)}
        addOpen={get("addOpen", false)}
        osCal={get("osCal", false)}
      />
    )

    return { desktop, phone }
  },
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SHARED PRIMITIVES, copied from the product's own kit
 * ═══════════════════════════════════════════════════════════════════════════ */

/** `components/ui/badge.tsx`, tones and shape verbatim. */
const BADGE_TONES = {
  neutral: "bg-ink-50 text-ink-600 ring-ink-200",
  play: "bg-play-50 text-play-700 ring-play-100",
  hoop: "bg-hoop-50 text-hoop-600 ring-hoop-100",
  court: "bg-court-50 text-court-700 ring-court-100",
  gold: "bg-gold-50 text-gold-600 ring-gold-100",
} as const

function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode
  tone?: keyof typeof BADGE_TONES
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
      {children}
    </span>
  )
}

/** `components/ui/panel-header.tsx`: brand accent bar, condensed uppercase. */
function PanelHeader({
  title,
  action,
  id,
}: {
  title: string
  action?: ReactNode
  id?: string
}) {
  return (
    <div
      data-demo-target={id}
      className={cn("mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1", Boolean(action) && "justify-between")}
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

/** `manage/components/types.ts` panelClass and inputClass, verbatim. */
const PANEL =
  "rounded-3xl border border-ink-100 bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
const INPUT =
  "rounded-xl border border-ink-200 px-2 py-1.5 text-sm text-ink-900"

/** `components/ui/button.tsx`, primary + brand at size md. */
function Button({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span
      data-demo-target={id}
      style={{ backgroundColor: "var(--brand)" }}
      className="inline-flex shrink-0 cursor-default items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[color:var(--brand-on)] shadow-[0_10px_24px_-12px_rgba(15,23,42,0.5)] transition-all duration-150 data-[demo-press=true]:brightness-95 motion-reduce:transition-none"
    >
      {children}
    </span>
  )
}

/**
 * A real page is taller than the box the stage gives it, so the pane scrolls
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

/** `components/ui/brand-listbox.tsx`: the 44px trigger and its chevron. */
function ListboxTrigger({
  id,
  label,
  placeholder,
  open,
  className,
}: {
  id: string
  label?: string
  placeholder?: string
  open: boolean
  className?: string
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "border-ink-200 text-ink-900 flex min-h-[44px] w-full cursor-default items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2.5 text-left text-sm shadow-sm transition duration-200 data-[demo-press=true]:brightness-95",
        className
      )}
    >
      <span className={cn("truncate", !label && "text-ink-500")}>{label ?? placeholder}</span>
      <svg
        className={cn(
          "text-ink-400 h-4 w-4 shrink-0 transition-transform duration-200",
          open && "rotate-180"
        )}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/**
 * The listbox panel. `BrandListbox` rides a body portal and flips ABOVE the
 * trigger whenever there is under 280px under it, which is exactly the case
 * for the "Send to" field inside a 600 logical stage, so that one opens
 * upward and the session-day list opens down.
 */
function ListboxPanel({
  options,
  selected,
  id,
  above,
}: {
  options: Array<{ label: string; id?: string }>
  selected: string
  id?: string
  above?: boolean
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "border-ink-200 absolute left-0 right-0 z-30 max-h-64 overflow-hidden rounded-xl border bg-white p-1 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.4)]",
        above ? "bottom-full mb-1" : "top-full mt-1"
      )}
    >
      {options.map((o) => (
        <span
          key={o.label}
          data-demo-target={o.id}
          className={cn(
            "flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm",
            o.label === selected ? "text-ink-950 bg-play-50 font-semibold" : "text-ink-800"
          )}
        >
          <span className="truncate">{o.label}</span>
          {o.label === selected && (
            <svg
              className="h-4 w-4 shrink-0 text-[#f59e0b]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          )}
        </span>
      ))}
    </span>
  )
}

/** `components/ui/date-time-picker.tsx`, mode="time", the trigger. */
function TimeField({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "border-ink-200 text-ink-900 flex min-h-[44px] w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm shadow-sm",
        className
      )}
    >
      <span className="tabular-nums">{value}</span>
      <svg
        className="text-ink-400 h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    </span>
  )
}

/* ── The season console shell (`manage/page.tsx`) ────────────────────────── */

const TABS = [
  "Overview",
  "Clubs",
  "Teams",
  "Plan Your Season",
  "Schedule",
  "Standings",
  "Playoffs",
  "Referees",
  "⚙ Settings",
]

function Console({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col px-6 py-3">
      <p className="text-ink-500 shrink-0 text-sm font-medium">&larr; {LEAGUE}</p>
      <div className="mt-1 shrink-0">
        <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase leading-none tracking-wide">
          {SEASON}
        </h1>
        <p className="text-ink-500 mt-1 text-sm">{LEAGUE}</p>
        <Badge className="mt-2" tone="play">
          {SEASON_STATUS}
        </Badge>
      </div>
      <div className="border-ink-100 mt-3 flex shrink-0 flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <span
            key={t}
            className={cn(
              "relative -mb-px whitespace-nowrap px-3 py-2.5 text-sm font-semibold",
              t === "Referees" ? "text-play-600" : "text-ink-500"
            )}
          >
            {t}
            {t === "Referees" && (
              <span className="bg-play-600 absolute inset-x-2 -bottom-px h-0.5 rounded-full" />
            )}
          </span>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col pt-4">{children}</div>
    </div>
  )
}

/* ── The Referees tab (`manage/components/referees-tab.tsx`) ─────────────── */

/** `referees-tab.tsx` AVAILABILITY_BADGE, lines 39 to 43. */
const AVAIL_TONE: Record<string, keyof typeof BADGE_TONES> = {
  available: "court",
  "no availability set": "neutral",
}

function RefereesTab({
  dayOpen,
  dayPicked,
  shiftSet,
  targetOpen,
  rateTyped,
  msgTyped,
  typingKey,
  sent,
  accepted,
  confirmed,
}: {
  dayOpen: boolean
  dayPicked: boolean
  shiftSet: boolean
  targetOpen: boolean
  rateTyped: string
  msgTyped: string
  typingKey: string | null
  sent: boolean
  accepted: boolean
  confirmed: boolean
}) {
  return (
    <div className="grid gap-6">
      {/* Book a day */}
      <div data-demo-target="book-panel" className={PANEL}>
        <PanelHeader title="Book a referee for a session day" />
        <p className="text-ink-500 -mt-2 mb-4 text-xs">
          Pick a day and shift, then target a referee you know · or broadcast to your whole pool
          and let the first taker have it. Accepting auto-assigns them to every game in the window.
        </p>
        {sent && (
          <div
            data-demo-target="sent-note"
            className="border-court-200 bg-court-50 text-court-700 live-pop mb-3 rounded-xl border px-3 py-2 text-xs"
          >
            {SENT_NOTE}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {/* `BrandListbox` takes its width on the wrapper (`className`), which
              is how the Send-to field on this same page is sized. The day list
              is given one here so its labels are not truncated to "Weekend 9 ·
              …" inside the stage's narrower column. */}
          <div className="relative w-[248px]">
            <span className="text-ink-600 mb-1 block text-xs font-medium">Session day</span>
            <ListboxTrigger
              id="book-day"
              label={dayPicked ? DAY_OPTION : undefined}
              placeholder="Choose day…"
              open={dayOpen}
            />
            {dayOpen && (
              <ListboxPanel
                selected=""
                options={[
                  { label: "Weekend 9 · Sat, Aug 1" },
                  { label: DAY_OPTION, id: "day-opt" },
                  { label: "Weekend 11 · Sat, Aug 15" },
                ]}
              />
            )}
          </div>
          <div>
            <span className="text-ink-600 mb-1 block text-xs font-medium">Shift</span>
            <div data-demo-target="shift-field" className="flex items-center gap-1">
              <TimeField value="09:00" className="w-28" />
              <span className="text-ink-400 text-xs">–</span>
              <TimeField
                value={shiftSet ? "15:00" : "18:00"}
                className={cn("w-28", shiftSet && "live-pop")}
              />
            </div>
          </div>
          <div className="flex gap-1">
            {PRESETS.map((p) => (
              <span
                key={p}
                data-demo-target={p === PRESET ? "preset-morning" : undefined}
                className="bg-ink-100 text-ink-600 cursor-default rounded-full px-2 py-1 text-[11px] font-medium transition duration-150 data-[demo-press=true]:brightness-90"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="relative min-w-0 flex-1">
            <span className="text-ink-600 mb-1 block text-xs font-medium">Send to</span>
            <ListboxTrigger
              id="send-to"
              label="📢 All league referees (first accept wins)"
              open={targetOpen}
            />
            {targetOpen && (
              <ListboxPanel
                id="target-list"
                above
                selected="📢 All league referees (first accept wins)"
                options={[
                  { label: "📢 All league referees (first accept wins)", id: "target-all" },
                  ...POOL.map((r) => ({
                    label: `${r.name} · $${r.fee}/game${dayPicked ? ` · ${r.avail}` : ""}`,
                  })),
                ]}
              />
            )}
          </div>
          <span data-demo-target="rate-field" className={cn(INPUT, "w-24")}>
            <TypeText
              text={rateTyped ? `$${rateTyped}` : ""}
              typing={typingKey === "rateTyped"}
              placeholder="$/game"
            />
          </span>
          <span data-demo-target="msg-field" className={cn(INPUT, "min-w-0 flex-1 truncate")}>
            <TypeText
              text={msgTyped}
              typing={typingKey === "msgTyped"}
              placeholder="Message (optional)"
            />
          </span>
          <Button id="send-offer">Send offer</Button>
        </div>
      </div>

      {/* Offers */}
      <div className={PANEL}>
        <PanelHeader title="Offers" />
        {!sent ? (
          <p className="text-ink-500 text-sm">No offers sent yet.</p>
        ) : (
          <div className="space-y-2">
            <div
              data-demo-target="offer-row"
              className="border-court-100 bg-court-50 live-row-in flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="text-ink-900 font-medium">
                  {DAY} · {WINDOW}
                </span>
                <span className="text-ink-500 ml-2 text-xs">&rarr; All league referees</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={accepted ? "court" : "gold"}>
                  {accepted ? `accepted · ${REF}` : "pending"}
                </Badge>
                {!accepted && (
                  <span className="text-hoop-600 text-xs font-semibold">Cancel</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pool */}
      <div className={PANEL}>
        <PanelHeader
          title="League referee pool"
          action={
            <span className="bg-ink-50 text-ink-600 rounded-full px-2.5 py-0.5 text-xs font-bold">
              {POOL.length}
            </span>
          }
        />
        <div data-demo-target="pool-rows" className="mb-3 space-y-1">
          {POOL.map((r) => (
            <div
              key={r.name}
              data-demo-target={r.id}
              className="border-ink-100 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="text-ink-900 font-medium">{r.name}</span>
                <span className="text-ink-400 ml-2 text-xs">
                  {r.cert} · Self-declared · {r.games} games · ${r.fee}/game
                </span>
              </div>
              <div className="flex items-center gap-2">
                {dayPicked && (
                  <span className="live-pop">
                    <Badge tone={AVAIL_TONE[r.avail]}>{r.avail}</Badge>
                  </span>
                )}
                <span className="text-hoop-600 text-xs font-semibold">Remove</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <span className="text-ink-600 mb-1 block text-xs font-medium">
            Add a referee to your pool
          </span>
          <span className={cn(INPUT, "text-ink-400 block w-full")}>
            Search referees on the platform…
          </span>
        </div>
      </div>

      {/* Settlements */}
      <div
        data-demo-target="settle-panel"
        className="border-ink-100 mt-4 rounded-2xl border bg-white p-5"
      >
        <h3 className="text-ink-900 text-sm font-semibold">Referee settlements</h3>
        <p className="text-ink-500 mt-1 text-xs">
          Games are tallied per referee per session day. Double-check and confirm each row ·
          confirmation is the settlement of record at the agreed per-game rate.
        </p>
        <div className="mt-3 space-y-1.5">
          {SETTLEMENTS.map((s, i) => {
            const done = s.confirmed || (confirmed && i === 0)
            return (
              <div
                key={`${s.name}-${s.date}`}
                data-demo-target={i === 0 ? "settle-row" : undefined}
                className="border-ink-100 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="text-ink-900 font-medium">{s.name}</span>
                  <span className="text-ink-500 ml-2 text-xs tabular-nums">
                    {s.date} · {s.games} games × ${s.rate} = ${s.total}
                  </span>
                </span>
                {done ? (
                  <span
                    className={cn(
                      "bg-court-50 text-court-700 rounded-full px-2 py-0.5 text-xs font-semibold",
                      confirmed && i === 0 && "live-pop"
                    )}
                  >
                    Confirmed
                  </span>
                ) : (
                  <span
                    data-demo-target={i === 0 ? "settle-confirm" : undefined}
                    className="text-play-700 cursor-default text-xs font-semibold data-[demo-press=true]:opacity-70"
                  >
                    Confirm
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE REFEREE'S PHONE
 *
 * Not a fabrication: `/referee`, `/referee/requests` and `/calendar` are
 * responsive pages the app's own mobile bottom bar links to, and
 * `bottom-tabs.tsx` line 88 puts "My Games" → `/referee` in that bar whenever
 * `shape.isRefereeing`. The native app ships the same inbox and list at
 * `apps/mobile/src/app/(tabs)/referee.tsx`.
 * ═══════════════════════════════════════════════════════════════════════════ */

function Phone({
  view,
  accepted,
  banner,
  addOpen,
  osCal,
}: {
  view: string
  accepted: boolean
  banner: boolean
  addOpen: boolean
  osCal: boolean
}) {
  return (
    <div className="relative flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2 pt-1.5 text-white">
        <p className="text-[15px] font-bold leading-tight">{REF}</p>
        <p className="text-[14px] font-medium text-white/60">Referee · Level 3</p>
      </div>

      <div key={view} className="demo-fade-in relative min-h-0 flex-1 overflow-hidden">
        {view === "requests" && <RequestsScreen accepted={accepted} />}
        {view === "games" && <MyGamesScreen assigned={accepted} />}
        {view === "calendar" && <CalendarScreen addOpen={addOpen} />}
      </div>

      {banner && <PushBanner />}
      {osCal && <IosCalendar />}

      <TabBar active={view === "calendar" ? "Calendar" : "My Games"} />
    </div>
  )
}

/* ── /referee/requests ───────────────────────────────────────────────────── */

function RequestsScreen({ accepted }: { accepted: boolean }) {
  return (
    <div className="mx-auto h-full max-w-3xl space-y-6 overflow-hidden p-4">
      <p className="text-ink-500 text-sm font-semibold">&larr; Dashboard</p>
      <div>
        <h1 className="font-display text-ink-950 text-2xl font-bold">Shifts &amp; availability</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Leagues book you by the day · keep your availability current and answer offers here.
        </p>
      </div>

      {accepted && (
        <div
          data-demo-target="accept-note"
          className="border-court-200 bg-court-50 text-court-700 live-pop rounded-xl border px-4 py-2 text-sm"
        >
          {ACCEPTED_NOTE}
          <span data-demo-target="open-mygames" className="ml-2 font-semibold underline">
            Open My games
          </span>
        </div>
      )}

      {/* Offers */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5">
        <h2 className="text-ink-900 mb-3 font-semibold">Offers{accepted ? "" : " (1)"}</h2>
        {accepted ? (
          <p className="text-ink-500 text-sm">No open offers right now.</p>
        ) : (
          <div className="space-y-2">
            <div data-demo-target="offer-card" className="border-ink-100 rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-ink-900 text-sm font-semibold">
                    {LEAGUE} · {DAY} · {WINDOW}
                    <span className="text-court-700 ml-2 font-semibold">${RATE}/game</span>
                  </span>
                  <span className="text-ink-400 ml-2 text-xs">
                    {SEASON} · {SESSION}
                  </span>
                  <span className="bg-hoop-100 text-hoop-700 ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    first accept wins
                  </span>
                </div>
                <div className="flex gap-2">
                  <span
                    data-demo-target="accept-btn"
                    className="bg-court-600 cursor-default rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition duration-150 data-[demo-press=true]:brightness-90"
                  >
                    Accept
                  </span>
                  <span className="border-hoop-300 text-hoop-700 rounded-xl border px-3 py-1.5 text-xs font-semibold">
                    Decline
                  </span>
                </div>
              </div>
              <p className="text-ink-600 mt-1 text-sm">&ldquo;{MESSAGE}&rdquo;</p>
              <p className="text-ink-400 mt-1 text-xs">{PAY_TERMS}</p>
            </div>
          </div>
        )}

        {accepted && (
          <div className="border-ink-100 live-row-in mt-4 border-t pt-3">
            <p className="text-ink-500 mb-2 text-xs font-medium uppercase tracking-wide">
              Your booked shifts
            </p>
            <div className="text-ink-700 flex flex-wrap items-center gap-2 text-sm">
              <span className="bg-court-100 text-court-700 rounded-full px-2 py-0.5 text-xs font-medium">
                booked
              </span>
              {LEAGUE} · {DAY} · {WINDOW}
            </div>
          </div>
        )}
      </div>

      {/* Availability */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5">
        <h2 className="text-ink-900 mb-1 font-semibold">My availability</h2>
        <p className="text-ink-500 mb-3 text-xs">
          Days and hours you can work · leagues see this when they pick a referee.
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-700 tabular-nums">{DAY} · 09:00–18:00</span>
            <span className="text-hoop-600 text-xs font-semibold">Remove</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── /referee, My games ──────────────────────────────────────────────────── */

function IconWhistle() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="7" cy="14" r="4" />
      <path d="M11 14h5a4 4 0 0 0 0-8h-2" />
      <circle cx="16" cy="8" r="1" />
    </svg>
  )
}

function MyGamesScreen({ assigned }: { assigned: boolean }) {
  return (
    <div className="mx-auto h-full max-w-3xl space-y-6 overflow-hidden px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-ink-950 text-2xl font-bold">My games</h1>
          <p className="text-ink-500 mt-1 text-sm">
            Every game you&apos;re officiating, next one first. Games land here when a league
            books your shift and publishes that day&apos;s schedule.
          </p>
        </div>
      </div>

      {!assigned ? (
        /* `referee/page.tsx` lines 49 to 62: the real empty state, `past` empty. */
        <div
          data-demo-target="phone-empty"
          className="border-ink-100 shadow-soft rounded-[28px] border border-dashed bg-white p-6 text-center"
        >
          <h2 className="text-ink-900 font-semibold">No games on your schedule yet</h2>
          <p className="text-ink-500 mx-auto mt-2 max-w-md text-sm">
            Leagues book referees by the day. Add your availability and answer shift offers, and
            the games you get assigned appear here.
          </p>
          <div className="mt-5 flex justify-center">
            <span
              style={{ backgroundColor: "var(--brand)" }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[color:var(--brand-on)]"
            >
              <IconWhistle />
              Open shifts and availability
            </span>
          </div>
        </div>
      ) : (
        <section data-demo-target="phone-games" className="space-y-3">
          <h2 className="text-ink-400 text-xs font-semibold uppercase tracking-[0.12em]">
            Coming up ({GAME_COUNT})
          </h2>
          {GAMES.map((g, i) => (
            <div
              key={`${g.home}-${g.court}`}
              data-demo-target={i === 0 ? "game-1" : undefined}
              className="border-ink-100 shadow-soft live-row-in rounded-2xl border bg-white p-4"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-ink-900 text-sm font-semibold">
                  {DAY} · {g.at}
                </p>
                <span className="text-court-700 text-xs font-semibold">${RATE}/game</span>
              </div>
              <p className="text-ink-950 mt-1 font-semibold">
                {g.home} vs {g.away}
              </p>
              <p className="text-ink-500 mt-0.5 text-xs">
                {g.venue} · {g.court} · {LEAGUE} · {SEASON}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

/* ── /calendar, agenda ───────────────────────────────────────────────────── */

/**
 * `calendar/page.tsx` + `my-calendar.tsx` in the agenda projection.
 *
 * Two things the real page decides for this user and the mock honours: the
 * lens chip row is gated on `data.lenses.length > 1` and a referee with one
 * league has exactly one lens, so there is no chip row; and the agenda/grid
 * toggle is `hidden … sm:inline-flex`, so at 390 the only control on that row
 * is Add to phone.
 */
function CalendarScreen({ addOpen }: { addOpen: boolean }) {
  return (
    <div className="mx-auto h-full max-w-5xl space-y-4 overflow-hidden px-4 py-6">
      <div>
        <h1 className="text-ink-950 font-display text-2xl font-bold">My Calendar</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Every game, practice and event across all your teams · answer Going or Can&apos;t go
          right here.
        </p>
      </div>

      <div className="relative flex items-center justify-end gap-2">
        <span
          data-demo-target="add-phone"
          className="border-ink-200 text-ink-700 cursor-default rounded-xl border px-3 py-1.5 text-xs font-semibold data-[demo-press=true]:brightness-95"
        >
          📅 Add to phone
        </span>
        {addOpen && <AddToPhonePanel />}
      </div>

      <div data-demo-target="cal-agenda" className="relative">
        <div className="bg-ink-50/95 sticky top-0 z-10 -mx-1 px-1 py-1.5">
          <p className="text-ink-500 text-xs font-bold uppercase tracking-widest">August 2026</p>
        </div>
        <div className="flex items-start gap-3 py-2">
          <div className="bg-ink-100/70 text-ink-700 flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-2xl">
            <span className="text-2xl font-extrabold leading-none">8</span>
            <span className="text-ink-400 mt-0.5 text-[10px] font-semibold uppercase">Sat</span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {GAMES.map((g) => (
              <div
                key={`${g.home}-${g.court}`}
                /* `my-calendar.tsx` KIND_CARD.game + KIND_EDGE.game. */
                className="bg-energy-soft/60 border-ink-100 flex gap-3 rounded-xl border border-l-4 px-4 py-3"
                style={{ borderLeftColor: "var(--energy)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-ink-950 text-[16px] font-extrabold tabular-nums">
                    {g.at === "9:00 AM" ? "9:00 – 10:30 AM" : "10:30 AM – 12:00 PM"}
                  </p>
                  <p className="text-ink-900 mt-0.5 text-[15px] font-bold">
                    {g.home} vs {g.away}
                  </p>
                  <p className="text-ink-600 mt-0.5 text-[13px]">{g.venue}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** `components/calendar/add-to-phone.tsx`, the panel after the one press. */
function AddToPhonePanel() {
  return (
    <span
      data-demo-target="add-panel"
      className="border-ink-200 live-pop absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border bg-white p-4 shadow-lg"
    >
      <span className="block space-y-2 text-sm">
        <span className="text-ink-800 block font-semibold">Opening Apple Calendar…</span>
        <span className="text-ink-500 block text-xs">
          Confirm the subscription there and every practice, game and event stays in sync.
          Didn&apos;t open? Use the buttons below.
        </span>
        <span className="bg-play-600 block rounded-xl px-3 py-2 text-center text-xs font-semibold text-white">
          iPhone / Apple Calendar
        </span>
        <span className="border-ink-200 text-ink-700 block rounded-xl border px-3 py-2 text-center text-xs font-semibold">
          Google Calendar (Android)
        </span>
      </span>
    </span>
  )
}

/* ── OS chrome (R8) ──────────────────────────────────────────────────────── */

/** An iOS-style push dropping from the top of the handset. */
function PushBanner() {
  return (
    <div className="demo-banner-in absolute left-1.5 right-1.5 top-1.5 z-30">
      <div
        data-demo-target="push-open"
        className="rounded-[18px] border border-black/5 bg-white/95 p-2.5 shadow-[0_10px_30px_rgba(11,22,40,0.28)] backdrop-blur"
      >
        <div className="flex items-start gap-2.5">
          <AppIcon className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-ink-400 text-[10px] font-semibold uppercase tracking-[0.06em]">
                SportsHub One
              </p>
              <p className="text-ink-400 text-[10px]">now</p>
            </div>
            <p className="text-ink-950 text-[13px] font-semibold leading-tight">{PUSH_TITLE}</p>
            <p className="text-ink-600 line-clamp-2 text-[12px] leading-snug">{PUSH_BODY}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The phone's own calendar app taking the screen after the webcal:// hand-off.
 * OS chrome, hand-authored: no product UI is invented here, and the event
 * titles are the feed's own (`api/calendar/[token]/route.ts` line 165).
 */
function IosCalendar() {
  return (
    <div className="demo-fade-in absolute inset-0 z-30 flex flex-col bg-white">
      <div className="border-ink-100 shrink-0 border-b px-4 pb-2 pt-3">
        <p className="text-[13px] font-semibold text-[#e5493d]">&lsaquo; August</p>
        <p className="text-ink-950 mt-1 text-[22px] font-bold">Saturday 8 August</p>
        <p className="text-ink-400 mt-0.5 text-[12px]">SportsHub · Mike</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-4 py-2">
        <CalHour label="9 AM">
          {GAMES.slice(0, 3).map((g) => (
            <CalEvent key={g.court} title={ICS_TITLE(g)} when="9:00 – 10:30 AM" />
          ))}
        </CalHour>
        <CalHour label="10 AM">
          <CalEvent title={ICS_TITLE(LATE_GAME)} when="10:30 AM – 12:00 PM" />
        </CalHour>
        <CalHour label="11 AM">{null}</CalHour>
      </div>
    </div>
  )
}

/** One hour row of the OS day view: the gutter label and whatever sits in it. */
function CalHour({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-ink-100 flex gap-3 border-t border-dashed py-2 first:border-t-0">
      <span className="text-ink-400 w-[46px] shrink-0 pt-1 text-[11px] font-semibold tabular-nums">
        {label}
      </span>
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  )
}

function CalEvent({ title, when }: { title: string; when: string }) {
  return (
    <div
      className="min-w-0 rounded-lg border-l-[3px] bg-[#eef2fb] px-2.5 py-1.5"
      style={{ borderLeftColor: "#3a6df0" }}
    >
      <p className="text-ink-950 text-[12.5px] font-semibold leading-snug">{title}</p>
      <p className="text-ink-500 mt-0.5 text-[11.5px]">
        {when} · {ICS_WHERE}
      </p>
    </div>
  )
}

/* ── The bottom bar, from `components/nav/bottom-tabs.tsx` ───────────────── */

const TAB_ICONS: Record<string, ReactNode> = {
  Home: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10 12 3l9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  Chat: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Calendar: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  "My Games": (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="14" r="6" />
      <path d="M14.5 10.5 21 6l-2 6h-4" />
    </svg>
  ),
  Social: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2c0 5.5 2 8.5 10 10M12 22c0-5.5-2-8.5-10-10" />
    </svg>
  ),
}

/** The real bar: icon over label, and the active tab in its energy capsule. */
function TabBar({ active }: { active: string }) {
  return (
    <div className="border-ink-100 flex shrink-0 items-stretch justify-around border-t bg-white/95 px-1 pb-2 pt-1">
      {["Home", "Chat", "Calendar", "My Games", "Social"].map((t) => (
        <span
          key={t}
          data-demo-target={t === "Calendar" ? "tab-calendar" : undefined}
          className="flex min-w-[54px] flex-col items-center justify-center px-0.5 py-1"
        >
          <span
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2.5 py-0.5 text-[10px] font-bold",
              t === active ? "bg-energy text-energy-on" : "text-ink-600"
            )}
          >
            {TAB_ICONS[t]}
            {t}
          </span>
        </span>
      ))}
    </div>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1628] px-12 text-white">
      <div className="live-pop max-w-[760px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A league chapter
        </p>
        <h3 className="font-display mt-2 text-[34px] font-extrabold leading-tight">
          The referees
        </h3>
        <p className="mt-3 text-[17px] leading-relaxed text-white/75">
          One day offered to a pool of three at a rate stated up front, taken by the first referee
          to answer, and {GAME_COUNT} games assigned to him without anybody picking them. His
          schedule, his rate and his own calendar all came from that one accept, and the league
          ended the session knowing it owed ${DAY_PAY}.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">
          Next: a season, planned to published
        </p>
      </div>
    </div>
  )
}
