"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Badge, toneForStatus } from "@/components/ui"
import type { DemoBeat, DemoScript } from "../types"
import { AppIcon } from "./your-week-story"

/**
 * "A game moves, and everyone knows", rebuilt 2026-08-16 to the gold standard
 * and completed 2026-08-19 to the REALISM standard (mock-ui.tsx R1–R8): every
 * screen to the real component's anatomy, every flow to its real end state,
 * the OS drawn as the OS, and the balloons cut to the ones that say something
 * a screen cannot.
 *
 * WHAT THE 08-16 CUT HAD, AND WHY THIS ONE DOES NOT:
 *   · a "Whole season / Weekend 11" scope toggle over the games list. That
 *     control LEFT the product on 2026-08-08 (schedule-tab.tsx line 640:
 *     "The mode chooser and session picker left this page"), so the demo was
 *     pressing a screen the league no longer has. The list is now the season's
 *     committed games, which is the only list the tab draws;
 *   · scene-kit console furniture (ConsoleTabs, Panel, Chip, StatusChip, Btn)
 *     standing in for the real tab strip, the real `panelClass` card, the real
 *     `PanelHeader` and the real `Badge`. Those four are imported or copied
 *     from the product now, and the game row is the product's row, class for
 *     class, down to the 12px type the console really uses;
 *   · a product-styled modal standing in for a NATIVE `window.confirm`. The
 *     cancel guard is a browser dialog and is drawn as browser chrome (R8);
 *   · two invented toasts ("Moved · …", "Cancelled · …"). The product shows no
 *     confirmation on either action: the row re-rendering IS the feedback, and
 *     that is what is filmed;
 *   · a hand-drawn white notice card for the push, and an invented "Also in
 *     her inbox" panel for the email. The push is an iOS banner now (R8, the
 *     approved app icon inlined) and the email is read in an OS Mail view;
 *   · a family calendar drawn as day headings and plain white rows. It is
 *     `/calendar` now: lens chips, "📅 Add to phone", the sticky month header,
 *     the 60px date tiles and the energy-tinted game cards with their RSVP
 *     controls.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited):
 *   · the console is `manage/leagues/[id]/seasons/[seasonId]/manage/page.tsx`
 *     (the flat tab row, `-mb-px px-3 py-2.5 text-sm font-semibold`, the
 *     play-600 underline `inset-x-2 -bottom-px h-0.5`) and, inside it,
 *     `manage/components/schedule-tab.tsx` `GamesTable`: the `panelClass` card,
 *     `PanelHeader` with the List / Board pair and the count pill, and rows
 *     that are the product's disclosure rows verbatim — `px-3 py-2 text-xs`,
 *     the time in `EEE MMM d · h:mm a`, the matchup with its quiet "vs", venue
 *     and court, the real `Badge` at `toneForStatus(status)`, the caret;
 *   · the expansion is the product's whole button strip in its own order (Box
 *     score, Pin in place, Find alternates, Forfeit: home, Forfeit: away,
 *     Cancel game) at its own sizes, and "Suggested alternate slots" with the
 *     `same day` chip the endpoint's `sameDay` flag draws and the brand-filled
 *     `Button size="sm"` reading "Move here";
 *   · the cancel guard is `window.confirm("Cancel this game? It will be
 *     excluded from standings.")`, drawn as the browser sheet it is;
 *   · the family calendar is `app/(platform)/calendar/page.tsx` +
 *     `my-calendar.tsx` in the AGENDA projection a phone is forced into (line
 *     169): the lens chips with `LENS_COLORS`, `AddToPhone`, the sticky month
 *     header and 60px date tile from `components/calendar/agenda-list.tsx`,
 *     `KIND_CARD`/`KIND_EDGE` on the card, `timeRange()`, `eventLabel()`, the
 *     `[location, teamName]` line, and `RsvpControl` on every upcoming
 *     scheduled row;
 *   · the bell is `app/(platform)/notifications/page.tsx`: the Inbox eyebrow
 *     chip, the display-face heading with its unread count, "Mark all as read",
 *     and rows carrying read state and the dismiss ×;
 *   · the two notifications and the two emails are `api/games/[id]/route.ts`,
 *     word for word, including the en-CA `fmtWhen` face ("Aug 22, 2026, 12:00
 *     p.m."), the blue "View game details" button and `transactionalFooter`.
 *
 * TWO PRODUCT CORRECTIONS THE CONVERSION CAUGHT (both were wrong before):
 *   1. THE CANCELLATION EMAIL'S LINE. The league's Cancel game button calls
 *      `DELETE /api/games/[id]`, whose email says "This game will not be
 *      played — please do not travel to the venue." (line 427). The old cut
 *      quoted the PATCH branch's variant, "will not be played AS SCHEDULED"
 *      (line 313), which no button in the product reaches. The DELETE line is
 *      what is on screen now.
 *   2. THE CALENDAR'S PLACE LINE. `lib/calendar/my-calendar.ts` line 326 sets
 *      a game's `location` to the VENUE NAME ONLY; the court never reaches the
 *      calendar. The old cut wrote "The Playground, Court 1 · Toronto Lords
 *      Grade 9". It reads "The Playground · Toronto Lords Grade 9" now, which
 *      is also why the notification naming the court matters to her.
 *
 * THREE THINGS THE PRODUCT CANNOT HONESTLY SHOW, AND THEY ARE NOT STAGED
 * (`docs/roadmap/schedule-change-numbers.md` section E):
 *   1. NO CANCELLATION REASON UI. `Game.statusReason` exists and both message
 *      templates append it, but nothing in the repo ever sends it. This demo
 *      cancels the way the product cancels, with no reason.
 *   2. NO SURFACE NAMES THE AUDIENCE. "Move here" fires the PATCH immediately
 *      and the confirm says nothing about who hears. The fan-out chapter is
 *      therefore an explicit NARRATION card, in navy, with no console chrome
 *      on it and no context strip over it, so it can never be mistaken for a
 *      screen the product has.
 *   3. A MOVED ROW IS NOT MARKED. A cancelled row gets the badge, the dim, the
 *      strike and the pill; a moved one just re-renders at its new time.
 *
 * COMPOSITION TRIMS (what a 900 by 564 region and a 390 by ~455 handset could
 * not hold), all declared rather than hidden: the console region drops the
 * page's own h1 and status badge (the scene's context strip carries them), and
 * the Schedule tab's generation controls, division card, TeamCheck and
 * fairness verdict that sit ABOVE this list — the list is filmed where the
 * league works, with the weekend it has to change on screen and the rest of
 * the 45 committed games scrolling above and below it. On the phone, the
 * calendar page drops its one-line subtitle and the RSVP control under each
 * upcoming row (see `AgendaGame`), the bell page's heading is `text-2xl`
 * rather than `text-3xl` so "Mark all as read" keeps its line, and the agenda
 * is at its own default scroll position (the anchor day is the first upcoming
 * one, so the weekend is the top of the list and the week's practices are the
 * history above it).
 *
 * INVENTED-CONTENT LEDGER (everything not read out of the database):
 *   · the two older bell rows, which carry real product titles on this world's
 *     own events: "Practice moved · Toronto Lords Grade 9" is the practices
 *     PATCH route's own title on the practice the everyone-in-the-loop demo
 *     moves, and "Practice schedule · Toronto Lords Grade 9" is the announce
 *     route's, on that team's real two slots;
 *   · the clock faces on the OS chrome (4:12 PM, 4:18 PM) and the Mail app's
 *     nav bar. OS, not product.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const LEAGUE = "NPH Summer League"
const SEASON = "Summer 2026"
const CTX = `${LEAGUE} · ${SEASON} · Schedule`

/** `DB` every SCHEDULED game in this season, and all 45 are published. */
const SEASON_GAMES = 45

/** The moved game. `DB` Game 7e467b44, published, SCHEDULED. */
const MOVE = {
  when: "Sat Aug 22 · 9:00 AM",
  home: "Oakville Panthers Grade 9",
  away: "Toronto Lords Grade 9",
  venue: "The Playground",
  court: "Court 1",
}
/** The slot it moves to: the first free one on that court, that day. */
const MOVED_TO = "Sat Aug 22 · 12:00 PM"

/** The cancelled game. `DB` Game e8b48b34, published, SCHEDULED. */
const CANCEL = {
  when: "Sun Aug 23 · 9:00 AM",
  home: "Toronto Lords Grade 10 Girls",
  away: "West United Prep Grade 10 Girls",
  venue: "The Playground",
  court: "Court 1",
}

/**
 * The weekend inside the season's committed list: all eleven games on Sat 22
 * and Sun 23 August, every one a real `Game` row, in the order the tab sorts
 * them (chronological, then venue, then court).
 *
 * `PRODUCT` the list is the whole season, 45 rows, and the count pill says so.
 * The region is the league's own scroll position: the weekend it came here to
 * change. When a row is OPENED the list narrows to that row and its
 * neighbours, because the expansion carries six controls and a slot picker and
 * the scene never scrolls.
 */
const ROWS: {
  id?: string
  when: string
  home: string
  away: string
  venue: string
  court: string
}[] = [
  { id: "row-move", ...MOVE },
  {
    when: "Sat Aug 22 · 9:00 AM",
    home: "Mississauga Monarchs Grade 9",
    away: "West United Prep Grade 9",
    venue: "The Playground",
    court: "Court 2",
  },
  {
    when: "Sat Aug 22 · 9:00 AM",
    home: "North Toronto Huskies Grade 9",
    away: "CKATT Basketball Grade 9",
    venue: "The Playground",
    court: "Court 3",
  },
  {
    when: "Sat Aug 22 · 9:00 AM",
    home: "Burlington Force Grade 9",
    away: "Kings Court Basketball Grade 9",
    venue: "Haber Recreation Centre",
    court: "Court 1",
  },
  {
    when: "Sat Aug 22 · 9:00 AM",
    home: "Oakville Panthers Grade 10",
    away: "Toronto Lords Grade 10",
    venue: "Haber Recreation Centre",
    court: "Court 2",
  },
  {
    when: "Sat Aug 22 · 9:00 AM",
    home: "Mississauga Monarchs Grade 10",
    away: "West United Prep Grade 10",
    venue: "Haber Recreation Centre",
    court: "Court 3",
  },
  {
    when: "Sat Aug 22 · 9:00 AM",
    home: "North Toronto Huskies Grade 10",
    away: "CKATT Basketball Grade 10",
    venue: "Haber Recreation Centre",
    court: "Court 4",
  },
  {
    when: "Sat Aug 22 · 10:30 AM",
    home: "Burlington Force Grade 10",
    away: "Kings Court Basketball Grade 10",
    venue: "The Playground",
    court: "Court 1",
  },
  { id: "row-cancel", ...CANCEL },
  {
    when: "Sun Aug 23 · 9:00 AM",
    home: "Burlington Force Grade 10 Girls",
    away: "Oakville Panthers Grade 10 Girls",
    venue: "The Playground",
    court: "Court 2",
  },
  {
    when: "Sun Aug 23 · 9:00 AM",
    home: "North Toronto Huskies Grade 10 Girls",
    away: "Mississauga Monarchs Grade 10 Girls",
    venue: "The Playground",
    court: "Court 3",
  },
]

/**
 * The alternates, as `POST /api/games/[id]/reschedule-suggestions` ranks them:
 * same session day first, then chronological closeness. These are the free
 * slots on that court that day, on the session's own 9:00 to 20:00 window at
 * the season's 90 minute slot length.
 */
const ALTERNATES = [
  { label: "Sat Aug 22 · 12:00 PM", sameDay: true, id: "alt-first" },
  { label: "Sat Aug 22 · 1:30 PM", sameDay: true },
  { label: "Sat Aug 22 · 3:00 PM", sameDay: true },
]

/** `PRODUCT` `schedule-tab.tsx` line 324, the native confirm, and all of it. */
const CANCEL_CONFIRM = "Cancel this game? It will be excluded from standings."

/** The two notifications, verbatim from `api/games/[id]/route.ts`. */
const MOVE_NOTICE = {
  title: "Game Rescheduled",
  body: `${MOVE.home} vs ${MOVE.away} has moved to Aug 22, 2026, 12:00 p.m. at ${MOVE.venue} (${MOVE.court}).`,
  when: "Aug 21, 4:12 PM",
}
const CANCEL_NOTICE = {
  title: "Game Cancelled",
  body: `${CANCEL.home} vs ${CANCEL.away} on Aug 23, 2026, 9:00 a.m. has been cancelled by the league.`,
  when: "Aug 21, 4:18 PM",
}

/**
 * The two emails, from the same route. The reschedule branch is the PATCH's
 * (lines 359 to 368); the cancellation is the DELETE's (lines 422 to 430),
 * because Cancel game calls DELETE. Both em-dashes become the house middot.
 */
const MOVE_MAIL = {
  subject: `Game rescheduled: ${MOVE.home} vs ${MOVE.away}`,
  heading: "Game Rescheduled",
  at: "4:12 PM",
}
const CANCEL_MAIL = {
  subject: `Game cancelled: ${CANCEL.home} vs ${CANCEL.away}`,
  heading: "Game Cancelled",
  at: "4:18 PM",
}
const CANCEL_MAIL_LINE =
  "This game will not be played · please do not travel to the venue."

/**
 * THE FAN-OUT, queried. `lib/game-audience.ts` `getGameAudienceUserIds` is the
 * product's own resolver, and these are its three groups counted against the
 * moved game: both rosters' guardian accounts, every team-scoped role on both
 * teams, and both clubs' front office. Working in
 * `docs/roadmap/schedule-change-numbers.md` section C.
 */
const FANOUT_TOTAL = 26
const FANOUT = [
  {
    n: "20",
    label: "guardian accounts",
    note: "Both rosters, 10 players each, one guardian of record apiece.",
  },
  {
    n: "4",
    label: "coaches",
    note: "Head coach and assistant, on both teams.",
  },
  {
    n: "2",
    label: "club owners",
    note: "Oakville Panthers and Toronto Lords, both front offices.",
  },
  {
    n: "0",
    label: "lists anybody built",
    note: "The audience is derived from the game, per game.",
  },
]

/* ── The family, and her calendar ────────────────────────────────────────── */

/** `DB` summer-parent-lords@, two players on two Toronto Lords teams. */
const PARENT = "Jordan Reyes"
/** `DB` Player a18c732d, #37, Grade 9; Player 729b0d07, #20, Grade 10 Girls. */
const SON = "Darius"
const DAUGHTER = "Danielle"
const SON_TEAM = "Toronto Lords Grade 9"
const DAU_TEAM = "Toronto Lords Grade 10 Girls"
const GYM = "The Playground"

/**
 * `PRODUCT` `my-calendar.ts` line 237: a family lens is
 * "{player first name} · {team}", and lenses sort alphabetically, so Danielle
 * takes `LENS_COLORS[0]` (play) and Darius takes `LENS_COLORS[1]` (court).
 */
const LENSES = [
  { label: `${DAUGHTER} · ${DAU_TEAM}`, dot: "bg-play-600", chip: "border-play-300 bg-play-50 text-play-800" },
  { label: `${SON} · ${SON_TEAM}`, dot: "bg-court-600", chip: "border-court-300 bg-court-50 text-court-800" },
]

/**
 * Her two weekend rows. `PRODUCT` `timeRange()` writes the range with the
 * meridiem dropped from the start when both halves match, `eventLabel()`
 * writes "vs {opponent}", and the line under it is
 * `[location, teamName].join(" · ")` with the venue name only.
 */
const SAT_ROW = {
  day: "22",
  weekday: "Sat",
  time: "9:00 – 10:30 AM",
  movedTime: "12:00 – 1:30 PM",
  label: `vs ${MOVE.home}`,
  place: `${GYM} · ${SON_TEAM}`,
  dot: LENSES[1].dot,
}
const SUN_ROW = {
  day: "23",
  weekday: "Sun",
  time: "9:00 – 10:30 AM",
  label: `vs ${CANCEL.away}`,
  place: `${GYM} · ${DAU_TEAM}`,
  dot: LENSES[0].dot,
}

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  /* Human pace (owner 2026-08-19): people click, then click again. Long reads
     only where a balloon earns one. */
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const scheduleChangeStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/manage/leagues/nph-summer/seasons/summer-2026/manage?tab=schedule",
  context: CTX,
  initialStage: "desktop",
  chapters: [
    { id: "move", title: "The move" },
    { id: "knows", title: "Everyone knows" },
    { id: "cancel", title: "The cancellation" },
  ],

  /* ENGINE LAW: a beat's `set` is applied the moment the beat STARTS, so a
     beat must never delete or move its own cursor target. Every press that
     swaps a screen presses on one beat and lands on the next, which is also
     how a press reads to a person. */
  beats: [
    /* ── 1. The move ──────────────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "move",
      caption: "The season's committed schedule, at the weekend that has to change.",
      emphasize: "games-panel",
      callout: "Published, so every game on this list is already on a family calendar.",
    }),
    paced({
      id: "row-press",
      chapter: "move",
      caption: "Saturday's nine o'clock game at The Playground needs to move.",
      cursor: "row-move",
      press: true,
    }),
    paced({
      id: "row-open",
      chapter: "move",
      caption: "Every control for that game is on the game.",
      set: { at: "move", open: "move" },
    }),
    paced({
      id: "alts-press",
      chapter: "move",
      caption: "The league asks for alternates rather than picking a time out of the air.",
      cursor: "find-alternates",
      press: true,
    }),
    paced({
      id: "alts-open",
      chapter: "move",
      caption: "Three of them, and all three are the same day.",
      set: { alts: true },
      emphasize: "alt-slots",
      callout:
        "It only offers slots where the court is free and neither team is already playing.",
    }),
    paced({
      id: "move-press",
      chapter: "move",
      caption: "Noon it is.",
      cursor: "alt-first",
      press: true,
    }),
    paced({
      id: "moved",
      chapter: "move",
      caption: `The row now reads ${MOVED_TO}, on the same court.`,
      set: { moved: true, alts: false, open: "", at: "" },
      emphasize: "row-move",
      callout: "That press is the whole job. Everything after it is automatic.",
    }),

    /* ── 2. Everyone knows ────────────────────────────────────────────── */
    paced({
      id: "phone-in",
      chapter: "knows",
      caption: `${PARENT} has two children in this league, and both play this weekend.`,
      stage: "split",
      emphasize: "sat-row",
    }),
    paced({
      id: "push",
      chapter: "knows",
      caption: "The notification lands the way a phone delivers things.",
      set: { banner: "moved" },
      hold: 3000,
    }),
    paced({
      id: "bell",
      chapter: "knows",
      caption: "The same change is waiting in her bell, unread.",
      set: { banner: "", phone: "bell" },
      emphasize: "p-notif",
      callout:
        "One function writes the push, this row and the email, so the three cannot disagree.",
    }),
    paced({
      id: "cal",
      chapter: "knows",
      caption: "And Saturday's row moves to noon where it stands.",
      set: { phone: "cal", calMoved: true },
      emphasize: "sat-row",
      callout: "Same row, new time, so a subscribed phone calendar has nothing to delete.",
    }),
    paced({
      id: "who",
      chapter: "knows",
      caption: "The same change reached everybody attached to that game.",
      /* The strip stops naming a product screen, because this card is not
         one: `getGameAudienceUserIds` runs on the server and no surface in
         the product shows its answer. */
      context: undefined,
      set: { ledger: true, fan: 0 },
      emphasize: "fanout-head",
      callout: "The list comes off the two rosters and the two clubs, worked out per game.",
    }),
    paced({
      id: "fan-1",
      chapter: "knows",
      caption: "Both rosters' families, twenty of them.",
      set: { fan: 1 },
      hold: 2200,
    }),
    paced({
      id: "fan-2",
      chapter: "knows",
      caption: "Both benches, head coach and assistant.",
      set: { fan: 2 },
      hold: 2000,
    }),
    paced({
      id: "fan-3",
      chapter: "knows",
      caption: "And both club front offices.",
      set: { fan: 3 },
      hold: 2000,
    }),
    paced({
      id: "fan-4",
      chapter: "knows",
      caption: "Twenty six people, from one press.",
      set: { fan: 4 },
      hold: 2600,
    }),
    paced({
      id: "email",
      chapter: "knows",
      caption: "Every one of them in the app and in their mail, off the same list.",
      set: { phone: "mail" },
      emphasize: "p-mail-body",
      hold: 3400,
    }),

    /* ── 3. The cancellation ──────────────────────────────────────────── */
    paced({
      id: "sunday-press",
      chapter: "cancel",
      caption: "Sunday's game is not being played at all.",
      context: CTX,
      set: { ledger: false, phone: "cal", at: "cancel" },
      cursor: "row-cancel",
      press: true,
    }),
    paced({
      id: "sunday-open",
      chapter: "cancel",
      caption: "The same six controls, one row down the weekend.",
      set: { open: "cancel" },
    }),
    paced({
      id: "cancel-press",
      chapter: "cancel",
      caption: "This one cannot be moved, so it comes off the schedule.",
      cursor: "cancel-game",
      press: true,
    }),
    paced({
      id: "confirm",
      chapter: "cancel",
      caption: "The confirmation is one sentence.",
      set: { dialog: true },
      emphasize: "confirm-box",
      callout: "A cancelled game stops counting in the standings. That is the whole warning.",
    }),
    paced({
      id: "confirm-ok",
      chapter: "cancel",
      caption: "Confirmed.",
      cursor: "confirm-ok",
      press: true,
    }),
    paced({
      id: "cancelled",
      chapter: "cancel",
      caption: "The row goes quiet and drops out of the table.",
      set: { dialog: false, cancelled: true, open: "" },
      emphasize: "row-cancel",
    }),
    paced({
      id: "phone-cancel",
      chapter: "cancel",
      caption: "The same fan-out runs again, for her daughter's team.",
      set: { banner: "cancelled" },
      emphasize: "p-push",
      callout: "Twenty six again, and a different twenty six: the other team, the other club.",
    }),
    paced({
      id: "sun-row",
      chapter: "cancel",
      caption: "Sunday goes quiet on her calendar, and stays visible.",
      set: { banner: "", calCancelled: true },
      emphasize: "sun-row",
    }),
    paced({
      id: "cancel-mail",
      chapter: "cancel",
      caption: "And the email carries the line that keeps a family off the road.",
      set: { phone: "mail" },
      emphasize: "p-mail-line",
      hold: 3600,
    }),
    paced({
      id: "end",
      chapter: "cancel",
      caption:
        "One game moved, one game cancelled, and fifty two people told from two presses.",
      hold: 5200,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get }) => {
    const ledger = get("ledger", false)

    const desktop = (
      <div className="relative flex h-full flex-col">
        <div
          key={ledger ? "ledger" : "console"}
          className="demo-fade-in flex min-h-0 flex-1 flex-col"
        >
          {ledger ? (
            <FanOutLedger shown={get("fan", 0)} />
          ) : (
            <ScheduleTabScreen
              at={get<string>("at", "")}
              open={get<string>("open", "")}
              alts={get("alts", false)}
              moved={get("moved", false)}
              cancelled={get("cancelled", false)}
            />
          )}
        </div>

        {/* The product's guard is a NATIVE window.confirm, so it is drawn as
            browser chrome rather than as a product dialog (R8). */}
        {get("dialog", false) && <BrowserConfirm />}

        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = (
      <Phone
        view={get<string>("phone", "cal")}
        banner={get<string>("banner", "")}
        calMoved={get("calMoved", false)}
        calCancelled={get("calCancelled", false)}
      />
    )

    return { desktop, phone }
  },
}

/* ── The season console ──────────────────────────────────────────────────── */

/** `manage/.../manage/components/types.ts` `panelClass`, verbatim. */
const PANEL_CLASS =
  "rounded-3xl border border-ink-100 bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"

/** `manage/.../manage/page.tsx` lines 250 to 285: the flat tab row. */
function ConsoleTabRow({ active }: { active: string }) {
  const tabs = [
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
  return (
    <div className="border-ink-100 flex shrink-0 flex-wrap gap-1 border-b px-5">
      {tabs.map((t) => {
        const on = t === active
        return (
          <span
            key={t}
            className={cn(
              "relative -mb-px whitespace-nowrap px-3 py-2.5 text-sm font-semibold",
              on ? "text-play-600" : "text-ink-500"
            )}
          >
            {t}
            {on && (
              <span
                aria-hidden="true"
                className="bg-play-600 absolute inset-x-2 -bottom-px h-0.5 rounded-full"
              />
            )}
          </span>
        )
      })}
    </div>
  )
}

/** `components/ui/panel-header.tsx`, with the games table's own action pair. */
function GamesPanelHeader() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1">
      <span className="flex items-center gap-2.5">
        <span className="h-5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
        <span className="font-condensed text-ink-950 text-lg font-bold uppercase leading-none tracking-wide">
          Committed games
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="border-ink-200 flex overflow-hidden rounded-lg border">
          <span className="bg-ink-950 px-2.5 py-1 text-[11px] font-semibold text-white">List</span>
          <span className="text-ink-600 bg-white px-2.5 py-1 text-[11px] font-semibold">Board</span>
        </span>
        <span className="bg-ink-100 text-ink-600 rounded-full px-2.5 py-0.5 text-xs font-semibold">
          {SEASON_GAMES}
        </span>
      </span>
    </div>
  )
}

/**
 * `schedule-tab.tsx` `GamesTable`, the league's own screen for editing one
 * scheduled game. The rows are the season's 45 committed games; the region is
 * the scroll position the league is working at.
 */
function ScheduleTabScreen({
  at,
  open,
  alts,
  moved,
  cancelled,
}: {
  /** "" (the weekend), "move" or "cancel": which row the list is scrolled to. */
  at: string
  open: string
  alts: boolean
  moved: boolean
  cancelled: boolean
}) {
  const anchor = at || open
  const anchorIndex = anchor
    ? ROWS.findIndex(
        (r) =>
          (anchor === "move" && r.id === "row-move") ||
          (anchor === "cancel" && r.id === "row-cancel")
      )
    : -1
  /* Scrolled, not filtered. The window is always eight rows and always runs
     past the fold, because the real list is 45 games long and a panel that
     stops early leaves a lie-shaped hole under it. An OPEN row sits third
     from the top so its six controls and its slot picker have the room they
     need; a row merely scrolled to sits in the middle of the window. */
  const start = Math.max(0, anchorIndex - (open ? 2 : 5))
  const visible = anchorIndex < 0 ? ROWS : ROWS.slice(start, start + 8)
  return (
    <div className="bg-ink-50 flex h-full flex-col">
      <ConsoleTabRow active="Schedule" />
      <div className="min-h-0 flex-1 overflow-hidden px-5 py-3">
        <div data-demo-target="games-panel" className={cn(PANEL_CLASS, "p-4")}>
          <GamesPanelHeader />
          <div className="space-y-2">
            {visible.map((r) => (
              <GameRow
                key={`${r.home}-${r.when}`}
                id={r.id}
                when={r.id === "row-move" && moved ? MOVED_TO : r.when}
                home={r.home}
                away={r.away}
                venue={r.venue}
                court={r.court}
                status={r.id === "row-cancel" && cancelled ? "CANCELLED" : "SCHEDULED"}
                changed={r.id === "row-move" && moved}
                open={
                  (open === "move" && r.id === "row-move") ||
                  (open === "cancel" && r.id === "row-cancel")
                }
                alts={alts && open === "move" && r.id === "row-move"}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** `schedule-tab.tsx` lines 1074 to 1140: one control in the strip. */
function RowButton({
  id,
  tone,
  children,
}: {
  id?: string
  tone: "quiet" | "play" | "amber" | "hoop"
  children: ReactNode
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "rounded-lg border px-2 py-1 text-[11px] font-semibold data-[demo-press=true]:brightness-95",
        tone === "quiet" && "border-ink-200 text-ink-700",
        tone === "play" && "border-play-300 text-play-700",
        tone === "amber" && "border-amber-300 text-amber-700",
        tone === "hoop" && "border-hoop-300 text-hoop-700"
      )}
    >
      {children}
    </span>
  )
}

/**
 * One row of the games list and its expansion, `schedule-tab.tsx` lines 1037
 * to 1181, class for class: the disclosure line carrying the time, the matchup
 * with its quiet "vs", the venue and court, the status badge and the caret.
 */
function GameRow({
  id,
  when,
  home,
  away,
  venue,
  court,
  status,
  open,
  alts,
  changed,
}: {
  id?: string
  when: string
  home: string
  away: string
  venue: string
  court: string
  status: "SCHEDULED" | "CANCELLED"
  open: boolean
  alts: boolean
  changed: boolean
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "border-ink-100 rounded-xl border bg-white transition-colors duration-300 motion-reduce:transition-none",
        open && "border-ink-300"
      )}
    >
      <div className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* A moved row carries NO lasting mark in the product, so it carries
              none here either. The one-shot pop is the demo's own "watch
              this", not a badge the league would find on the row tomorrow. */}
          <span
            className={cn(
              "text-ink-700 whitespace-nowrap tabular-nums",
              changed && "live-pop font-semibold"
            )}
          >
            {when}
          </span>
          <span className="text-ink-900 font-medium">
            {home} <span className="text-ink-400">vs</span> {away}
          </span>
          <span className="text-ink-500">
            {venue} · {court}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={toneForStatus(status)}>{status}</Badge>
          <span className="text-ink-400 text-[10px]">{open ? "▴" : "▾"}</span>
        </div>
      </div>

      {open && (
        <div className="border-ink-100 border-t px-3 py-3 text-xs">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <RowButton tone="quiet">Box score ↗</RowButton>
            <RowButton tone="quiet">Pin in place</RowButton>
            <RowButton id="find-alternates" tone="play">
              {alts ? "Hide alternates" : "Find alternates"}
            </RowButton>
            <RowButton tone="amber">Forfeit: home</RowButton>
            <RowButton tone="amber">Forfeit: away</RowButton>
            <RowButton id="cancel-game" tone="hoop">
              Cancel game
            </RowButton>
          </div>

          {alts && (
            <div data-demo-target="alt-slots" className="bg-ink-50 live-pop rounded-xl p-2">
              <p className="text-ink-700 mb-2 text-[11px] font-semibold">
                Suggested alternate slots
              </p>
              <ul className="space-y-1">
                {ALTERNATES.map((s) => (
                  <li
                    key={s.label}
                    className="border-ink-100 flex items-center justify-between gap-2 rounded-lg border bg-white px-2 py-1"
                  >
                    <div>
                      <span className="text-ink-900 font-medium tabular-nums">{s.label}</span>
                      {s.sameDay && (
                        <span className="bg-play-100 text-play-700 ml-2 rounded-full px-1.5 py-0.5 text-[9px]">
                          same day
                        </span>
                      )}
                    </div>
                    {/* `components/ui/button.tsx` size="sm", primary + brand. */}
                    <span
                      data-demo-target={s.id}
                      style={{ backgroundColor: "var(--brand)" }}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[color:var(--brand-on)] data-[demo-press=true]:brightness-95"
                    >
                      Move here
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The browser's own confirm sheet (R8: OS chrome drawn as chrome).
 *
 * `cancelGame` calls `window.confirm(...)`, so what the league sees is a
 * Chrome dialog carrying the page's origin and one sentence: no reason field,
 * no audience, no count. Nothing is added here.
 */
function BrowserConfirm() {
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-[#0b1628]/25 px-8">
      <div
        data-demo-target="confirm-box"
        className="demo-banner-in w-full max-w-[520px] overflow-hidden rounded-b-xl bg-[#fbfbfb] shadow-[0_24px_60px_-20px_rgba(15,23,42,0.5)] ring-1 ring-black/10"
      >
        <div className="px-5 pb-4 pt-4">
          <p className="text-[13px] font-semibold text-[#3c4043]">sportshubone.com says</p>
          <p className="mt-2 text-[14px] leading-snug text-[#202124]">{CANCEL_CONFIRM}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <span className="rounded border border-[#dadce0] bg-white px-4 py-1.5 text-[13px] font-medium text-[#3c4043]">
            Cancel
          </span>
          <span
            data-demo-target="confirm-ok"
            className="rounded bg-[#1a73e8] px-5 py-1.5 text-[13px] font-medium text-white data-[demo-press=true]:brightness-95"
          >
            OK
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── The fan-out ledger ──────────────────────────────────────────────────── */

/**
 * NARRATION, NOT A SCREEN.
 *
 * The product has no recipients panel: `getGameAudienceUserIds` computes this
 * list on the server and nothing ever shows it to the league. So this card is
 * drawn in navy with no console chrome anywhere near it, which is the honest
 * way to put a server-side truth on camera.
 */
function FanOutLedger({ shown }: { shown: number }) {
  return (
    <div
      data-demo-target="fanout"
      className="flex min-h-0 flex-1 flex-col justify-center bg-[#0b1628] px-10 py-7 text-white"
    >
      <div data-demo-target="fanout-head">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.16em]">
          Who the change reached
        </p>
        <p className="font-display mt-1.5 text-[38px] font-extrabold leading-none tabular-nums">
          {FANOUT_TOTAL} people
        </p>
        <p className="mt-1.5 text-[16px] font-semibold text-white/70">
          {MOVE.home} vs {MOVE.away} · two clubs, two rosters
        </p>
      </div>

      <div className="mt-5 space-y-2">
        {FANOUT.map((r, i) => (
          <div
            key={r.label}
            className={cn(
              "flex items-baseline gap-4 rounded-2xl border px-4 py-2.5 transition-opacity duration-500 motion-reduce:transition-none",
              i < shown ? "border-white/15 bg-white/[0.07] opacity-100" : "border-white/5 opacity-20"
            )}
          >
            <span className="text-gold-400 w-[52px] shrink-0 text-[24px] font-extrabold leading-none tabular-nums">
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

      <p className="mt-4 border-t border-white/10 pt-3 text-[15px] font-medium text-white/55">
        One audience list, used twice: the notification in the app and the email to the same
        people.
      </p>
    </div>
  )
}

/* ── The handset ─────────────────────────────────────────────────────────── */

function Phone({
  view,
  banner,
  calMoved,
  calCancelled,
}: {
  view: string
  banner: string
  calMoved: boolean
  calCancelled: boolean
}) {
  const under = view === "mail" ? "cal" : view
  return (
    <div className="relative flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2 pt-1.5 text-white">
        <p className="text-[14px] font-bold leading-tight">{PARENT}</p>
        <p className="text-[12px] font-medium text-white/60">
          Parent · {SON} and {DAUGHTER}
        </p>
      </div>

      <div key={under} className="demo-fade-in relative min-h-0 flex-1 overflow-hidden">
        {under === "cal" && <MyCalendarScreen moved={calMoved} cancelled={calCancelled} />}
        {under === "bell" && <Bell />}
      </div>

      {/* OS chrome sits over the whole handset, tab bar included. */}
      {view === "mail" && <MailTakeover cancelled={calCancelled} />}
      {banner && (
        <PushBanner
          title={banner === "cancelled" ? CANCEL_NOTICE.title : MOVE_NOTICE.title}
          body={banner === "cancelled" ? CANCEL_NOTICE.body : MOVE_NOTICE.body}
        />
      )}

      <TabBar active={under === "bell" ? "Home" : "Calendar"} />
    </div>
  )
}

/** `/calendar` in the agenda view a phone is forced into (my-calendar.tsx:169). */
function MyCalendarScreen({ moved, cancelled }: { moved: boolean; cancelled: boolean }) {
  return (
    <div className="h-full overflow-hidden px-4 pb-1 pt-2.5">
      <h1 className="text-ink-950 font-display text-2xl font-bold">My Calendar</h1>

      <div className="mt-3 space-y-4">
        {/* Your calendars: one chip per kid per team, click to show or hide. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {LENSES.map((l) => (
            <span
              key={l.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                l.chip
              )}
            >
              <span className={cn("inline-block h-2 w-2 rounded-full", l.dot)} />
              <span>{l.label}</span>
            </span>
          ))}
        </div>

        {/* The Agenda / Grid toggle is `hidden sm:inline-flex`, so a phone gets
            this row with Add to phone alone in it. */}
        <div className="flex items-center justify-end gap-2">
          <span className="border-ink-200 text-ink-700 rounded-xl border px-3 py-1.5 text-xs font-semibold">
            📅 Add to phone
          </span>
        </div>

        <div>
          {/* `agenda-list.tsx` lines 81 to 85: the sticky month header. */}
          <div className="bg-ink-50/95 -mx-1 px-1 py-1.5">
            <p className="text-ink-500 text-xs font-bold uppercase tracking-widest">August 2026</p>
          </div>
          <div className="space-y-3 py-2">
            <AgendaDay day={SAT_ROW.day} weekday={SAT_ROW.weekday}>
              <AgendaGame
                id="sat-row"
                time={moved ? SAT_ROW.movedTime : SAT_ROW.time}
                label={SAT_ROW.label}
                place={SAT_ROW.place}
                dot={SAT_ROW.dot}
                fresh={moved}
              />
            </AgendaDay>
            <AgendaDay day={SUN_ROW.day} weekday={SUN_ROW.weekday}>
              <AgendaGame
                id="sun-row"
                time={SUN_ROW.time}
                label={SUN_ROW.label}
                place={SUN_ROW.place}
                dot={SUN_ROW.dot}
                cancelled={cancelled}
              />
            </AgendaDay>
          </div>
        </div>
      </div>
    </div>
  )
}

/** `agenda-list.tsx` lines 96 to 117: the 60px date tile and the day's items. */
function AgendaDay({
  day,
  weekday,
  children,
}: {
  day: string
  weekday: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-ink-100/70 text-ink-700 flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-2xl">
        <span className="text-2xl font-extrabold leading-none">{day}</span>
        <span className="text-ink-400 mt-0.5 text-[10px] font-semibold uppercase">{weekday}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
    </div>
  )
}

/**
 * One game on My Calendar, `my-calendar.tsx` `renderItem` lines 545 to 600:
 * KIND_CARD's energy tint, KIND_EDGE's bold left edge, the time range, the
 * lens dot and "vs {opponent}", and the `[location, teamName]` line.
 *
 * The RSVP control the page renders under an upcoming scheduled row is the
 * one trim on this screen: `DB` these two games hold zero `EventRsvp` rows,
 * answering is the your-week demo's own chapter, and three buttons wrap onto
 * two lines at 390 and cost the Sunday row its place on the handset.
 */
function AgendaGame({
  id,
  time,
  label,
  place,
  dot,
  fresh,
  cancelled,
}: {
  id: string
  time: string
  label: string
  place: string
  dot: string
  fresh?: boolean
  cancelled?: boolean
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "bg-energy-soft/60 border-ink-100 flex gap-3 rounded-xl border border-l-4 px-4 py-3",
        cancelled && "opacity-60",
        fresh && "live-row-in"
      )}
      style={{ borderLeftColor: "var(--energy)" }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink-950 text-[16px] font-extrabold tabular-nums">
            <span className={cn(cancelled && "line-through")}>{time}</span>
            {cancelled && (
              <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 align-[2px] text-[10px] font-bold uppercase text-red-600">
                Cancelled
              </span>
            )}
          </p>
        </div>
        <p className="text-ink-900 mt-0.5 text-[15px] font-bold">
          <span
            aria-hidden="true"
            className={cn("mr-1.5 inline-block h-2 w-2 rounded-full align-middle", dot)}
          />
          {label}
        </p>
        <p className="text-ink-600 mt-0.5 text-[13px]">{place}</p>
      </div>
    </div>
  )
}

/** An iOS-style push dropping from the top of the handset (R8). */
function PushBanner({ title, body }: { title: string; body: string }) {
  return (
    <div className="demo-banner-in absolute left-1.5 right-1.5 top-1.5 z-30">
      <div
        data-demo-target="p-push"
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
            <p className="text-ink-950 text-[13px] font-semibold leading-tight">{title}</p>
            <p className="text-ink-600 text-[12px] leading-snug">{body}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** `/notifications` — the bell page, with its read-state tints. */
function Bell() {
  return (
    <div className="h-full space-y-4 overflow-hidden px-4 py-3">
      <p className="text-ink-500 text-xs font-semibold">← Account</p>

      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-4">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Inbox
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-ink-950 text-2xl font-bold">
            Notifications
            <span className="text-ink-500 ml-2 text-sm font-normal">(1 unread)</span>
          </h1>
          <span className="text-play-600 shrink-0 text-sm font-semibold">Mark all as read</span>
        </div>
      </div>

      <div className="space-y-2">
        <NotifRow
          id="p-notif"
          title={MOVE_NOTICE.title}
          message={MOVE_NOTICE.body}
          when={MOVE_NOTICE.when}
          unread
        />
        <NotifRow
          title={`Practice moved · ${SON_TEAM}`}
          message="Tue, Aug 18, 6:30 p.m. → Tue, Aug 18, 8:00 p.m."
          when="Aug 17, 5:12 PM"
        />
        <NotifRow
          title={`Practice schedule · ${SON_TEAM}`}
          message="Tuesdays 6:30 PM · Thursdays 7:00 PM"
          when="Aug 3, 9:04 AM"
        />
      </div>
    </div>
  )
}

/** `notifications/page.tsx` lines 195 to 260, one row. */
function NotifRow({
  id,
  title,
  message,
  when,
  unread,
}: {
  id?: string
  title: string
  message: string
  when: string
  unread?: boolean
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        /* PRODUCT CORRECTION: the shipped row writes `bg-white` and then
           `bg-play-50/30` in the same class list, so the unread tint R2 asks
           for never wins and every row renders white. The demo renders what
           the page means. */
        "shadow-soft rounded-2xl border p-4",
        unread ? "border-play-200 bg-play-50/40" : "border-ink-100 bg-white"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn("text-sm font-semibold", unread ? "text-ink-900" : "text-ink-700")}>
              {title}
            </h3>
            {unread && <span className="bg-play-500 h-2 w-2 shrink-0 rounded-full" />}
          </div>
          <p className="text-ink-600 mt-1 text-sm">{message}</p>
          <p className="text-ink-400 mt-1 text-xs">{when}</p>
        </div>
        <span className="text-ink-300 ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm">
          ✕
        </span>
      </div>
    </div>
  )
}

/**
 * The Mail app taking the screen (R8): OS chrome around the route's own
 * `emailHtml`, rendered the way an unstyled transactional email really
 * renders, down to the blue "View game details" button and the transactional
 * footer `lib/email.ts` puts under every send.
 */
function MailTakeover({ cancelled }: { cancelled: boolean }) {
  const mail = cancelled ? CANCEL_MAIL : MOVE_MAIL
  return (
    <div className="demo-fade-in absolute inset-0 z-30 flex flex-col bg-white">
      <div className="border-ink-100 flex shrink-0 items-center justify-between border-b bg-[#f7f7f9] px-3 py-2.5">
        <span className="text-[15px] font-medium text-[#0b5fd7]">‹ Inbox</span>
        <span className="flex items-center gap-4 text-[#0b5fd7]" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" />
          </svg>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 14 4 9l5-5M4 9h9a7 7 0 0 1 7 7v3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
        <p className="text-ink-950 text-[17px] font-bold leading-tight">{mail.subject}</p>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
            <AppIcon className="h-9 w-9" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-ink-950 text-[14px] font-semibold">SportsHub One</p>
            <p className="text-ink-500 truncate text-[12.5px]">To: {PARENT}</p>
          </div>
          <p className="text-ink-400 shrink-0 text-[12.5px]">{mail.at}</p>
        </div>

        <div
          data-demo-target="p-mail-body"
          className="border-ink-100 text-ink-900 mt-3 border-t pt-3 text-[15px] leading-relaxed"
        >
          <p className="text-[19px] font-bold leading-tight">{mail.heading}</p>
          {cancelled ? (
            <>
              <p className="mt-2.5">
                <strong>
                  {CANCEL.home} vs {CANCEL.away}
                </strong>
                , scheduled for <strong>Aug 23, 2026, 9:00 a.m.</strong>, has been cancelled by the
                league.
              </p>
              <p data-demo-target="p-mail-line" className="mt-2.5">
                {CANCEL_MAIL_LINE}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2.5">
                <strong>
                  {MOVE.home} vs {MOVE.away}
                </strong>{" "}
                has been rescheduled.
              </p>
              <p className="mt-2.5">
                Previously: Aug 22, 2026, 9:00 a.m.
                <br />
                New time: <strong>Aug 22, 2026, 12:00 p.m.</strong> at {MOVE.venue} ({MOVE.court})
              </p>
            </>
          )}
          <span className="mt-3 inline-flex rounded-md bg-[#2563eb] px-5 py-2.5 text-[14px] font-semibold text-white">
            View game details
          </span>
          <p className="border-ink-100 text-ink-400 mt-3 border-t pt-2 text-[12px] leading-snug">
            Sent by {LEAGUE} via SportsHub (Youth Basketball Hub). You received this because of an
            account, registration, or invitation associated with this address.
          </p>
        </div>
      </div>
    </div>
  )
}

function TabBar({ active }: { active: string }) {
  return (
    <div className="border-ink-200 flex shrink-0 items-center justify-around border-t bg-white px-1.5 pb-4 pt-2">
      {["Home", "Chat", "Calendar", "My Kids", "Social"].map((t) => (
        <span
          key={t}
          className={cn("text-[14px] font-bold", t === active ? "text-play-700" : "text-ink-400")}
        >
          {t}
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
          A game moves, and everyone knows
        </h3>
        <p className="mt-3 text-[17px] leading-relaxed text-white/75">
          One game moved to noon and one Sunday game called off, two audiences of twenty six
          worked out by the system, notified in the app and by email, with the cancelled row left
          on the calendar struck through so nobody drives to an empty gym.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">
          Next: standings to playoffs
        </p>
      </div>
    </div>
  )
}
