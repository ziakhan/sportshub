"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import {
  Btn,
  Chip,
  ConsoleTabs,
  Dialog,
  Panel,
  PhoneNotice,
  PhoneScreen,
  StatusChip,
} from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "A game moves, and everyone knows" (owner ruling, scenario audit C1).
 *
 * The league moves one game and cancels another, and the system tells every
 * person attached to both of them. The beat the demo exists for is the
 * FAN-OUT: the recipient breakdown by role, on camera, with counts queried
 * out of the seeded database rather than asserted.
 *
 * Built to the gold standard set by `season-story.tsx` on 2026-08-16, and to
 * the same three laws:
 *
 *   1. PRESENTATION (audit D2). Focused working REGIONS composed at 1160
 *      logical, rendered at scale 1.0, no browser chrome and no site header,
 *      one slim context strip. When the phone joins in chapter 2 the console
 *      is composed NARROWER (900) rather than scaled down, and the handset
 *      arrives life size. `scripts/demo/readability-audit.mjs` is the gate:
 *      nothing here is authored under 14px.
 *   2. PACING. Stop, explain, act. Every dwell is computed from the balloon's
 *      own word count, and a beat that carries a balloon silences the caption
 *      bar so the viewer is never read to twice.
 *   3. EVERY NUMBER DERIVED. The league, the weekend, the two games, both
 *      rosters, the guardian accounts, the coaches and the club owners are
 *      read out of the local seeded world, and every one of them is written
 *      down with its source in `docs/roadmap/schedule-change-numbers.md`.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN. The season console's Schedule tab
 * is the only surface in the product that edits a scheduled game, and this
 * mirrors it exactly (`manage/components/schedule-tab.tsx`):
 *   · the game row: "Sat Aug 22 · 9:00 AM", the matchup with a quiet "vs",
 *     the venue and court, the status badge, the disclosure caret;
 *   · the expanded row's whole button strip, in its real order: Box score,
 *     Pin in place, Find alternates, Forfeit: home, Forfeit: away, Cancel
 *     game, with Cancel game wearing the product's own hoop-red outline;
 *   · "Suggested alternate slots", its rows in `EEE MMM d · h:mm a`, the
 *     "same day" chip the endpoint's `sameDay` flag draws, and "Move here";
 *   · the cancel confirmation's exact sentence, "Cancel this game? It will be
 *     excluded from standings.";
 *   · the two notifications, verbatim from `api/games/[id]/route.ts`, down to
 *     the en-CA date format `fmtWhen` produces ("Aug 22, 2026, 12:00 p.m.");
 *   · the family calendar row from `calendar/my-calendar.tsx`: the time range,
 *     the "vs OPPONENT" label, and a cancelled row dimmed to 60 percent with
 *     its time struck through and a red CANCELLED pill beside it.
 *
 * THREE THINGS THE PRODUCT CANNOT HONESTLY SHOW, AND THEY ARE NOT STAGED.
 * All three are punch items in the numbers sheet, section E:
 *
 *   1. NO CANCELLATION REASON UI. `Game.statusReason` exists, `PATCH
 *      /api/games/[id]` accepts it, and the notification body really does
 *      append "Reason: <text>." when it is set. But NOTHING in the repo ever
 *      sends it: the league's Cancel game button calls `DELETE`, which has no
 *      body. So this demo cancels the way the product cancels, with no reason,
 *      and the owner's cancel-with-a-reason beat waits for the picker to be
 *      built. What carries the weight instead is the product's own email
 *      sentence, which is real and is the line that stops a family driving.
 *   2. NO CONFIRM STATES WHO WILL BE TOLD. There is no confirmation on a move
 *      at all: "Move here" fires the PATCH immediately. No surface anywhere
 *      names the audience or its size. The fan-out chapter is therefore drawn
 *      as an explicit NARRATION card, in navy, with no console chrome on it,
 *      so it can never be mistaken for a screen the product has.
 *   3. A MOVED ROW IS NOT MARKED. A cancelled row gets the dim, the strike and
 *      the pill; a rescheduled one simply re-renders at its new time with
 *      nothing saying it changed. The demo shows exactly that, and the
 *      notification is what carries the news.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const LEAGUE = "NPH Summer League"
const SEASON = "Summer 2026"
const SESSION = "Weekend 11 · Aug 22"
const CTX = `${LEAGUE} · ${SEASON} · Schedule`

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
 * The Schedule tab's game list: ALL ELEVEN games this session holds, every one
 * of them a real `Game` row on session 5864c08e, in the order the tab sorts
 * them (chronological, then venue, then court).
 *
 * The 2026-08-16 cut drew three of the eleven under a "3 of 11" chip while the
 * opening caption said eleven games were already on family calendars. The
 * sweep's full-screens rule does not allow a list to claim a scale it does not
 * draw, so the list is the whole weekend now. When a row is OPENED, the list
 * narrows to that row and its neighbours, because the expansion carries six
 * controls and a slot picker and the scene never scrolls.
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

/** The two notifications, verbatim from `api/games/[id]/route.ts`. */
const MOVE_NOTICE = {
  title: "Game Rescheduled",
  body: `${MOVE.home} vs ${MOVE.away} has moved to Aug 22, 2026, 12:00 p.m. at ${MOVE.venue} (${MOVE.court}).`,
}
const CANCEL_NOTICE = {
  title: "Game Cancelled",
  body: `${CANCEL.home} vs ${CANCEL.away} on Aug 23, 2026, 9:00 a.m. has been cancelled by the league.`,
}

/** The confirmation the product really shows, and all of it. */
const CANCEL_CONFIRM = "Cancel this game? It will be excluded from standings."

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

/** The family on the phone. `DB` summer-parent-lords@, two players. */
const PARENT = "Jordan Reyes"
const KIDS = "Darius #37 and Danielle #20 · Toronto Lords"

/** Her two rows this weekend, as `my-calendar.tsx` renders them. */
const SAT_ROW = {
  day: "Saturday, August 22",
  time: "9:00 – 10:30 AM",
  movedTime: "12:00 – 1:30 PM",
  label: "vs Oakville Panthers Grade 9",
  place: "The Playground, Court 1 · Toronto Lords Grade 9",
}
const SUN_ROW = {
  day: "Sunday, August 23",
  time: "9:00 – 10:30 AM",
  label: "vs West United Prep Grade 10 Girls",
  place: "The Playground, Court 1 · Toronto Lords Grade 10 Girls",
}

/**
 * The email's own sentence, `api/games/[id]/route.ts` line 314. The product
 * writes it with an em-dash; the house copy rule turns that into a middot.
 */
const EMAIL_LINE =
  "This game will not be played as scheduled · please do not travel to the venue."
const EMAIL_SUBJECT = `Game cancelled: ${CANCEL.home} vs ${CANCEL.away}`

/* ── Pacing ──────────────────────────────────────────────────────────────── */

/**
 * Stop, explain, act (owner ruling 2026-08-16: "slow is the point"). The hand
 * takes CURSOR_ARRIVE_MS to reach its target and the balloon lands with it, so
 * a beat holds for the travel, plus long enough to READ the balloon at about
 * 180ms a word with a 900ms buffer for the eye to find it, plus a settle so
 * the next thing does not fire on the last syllable.
 */
function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 500
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 180 + 900 : 2400
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

  beats: [
    /* ── 1. The move ──────────────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "move",
      caption: `${SESSION} is published, so eleven games are already on every family calendar.`,
      emphasize: "session-strip",
      callout: "Published means these eleven games are already on family calendars.",
    }),
    paced({
      id: "row",
      chapter: "move",
      caption: "Saturday's nine o'clock game at The Playground needs to move.",
      cursor: "row-move",
      press: true,
      callout: "The controls live on the game, so nothing else on the weekend is touched.",
      set: { open: "move" },
    }),
    paced({
      id: "alternates",
      chapter: "move",
      caption: "The league asks for alternates rather than picking a time out of the air.",
      cursor: "find-alternates",
      press: true,
      callout:
        "It only offers slots where the court is free and neither team is already playing.",
      set: { alts: true },
    }),
    paced({
      id: "slots",
      chapter: "move",
      caption: "Three of them are the same day, so nobody re-plans a weekend.",
      emphasize: "alt-slots",
      callout: "Same-day slots are ranked first, then the closest ones after that.",
    }),
    paced({
      id: "move",
      chapter: "move",
      caption: "Noon it is.",
      cursor: "alt-first",
      press: true,
      toast: `Moved · ${MOVED_TO} · ${MOVE.venue}, ${MOVE.court}`,
      callout: "That press is the whole job. Everything after it is automatic.",
      set: { moved: true, alts: false, open: "" },
    }),
    paced({
      id: "done",
      chapter: "move",
      caption: `The row now reads ${MOVED_TO}.`,
      emphasize: "row-move",
      callout: "Nothing was written by hand, and the game keeps its court.",
    }),

    /* ── 2. Everyone knows ────────────────────────────────────────────── */
    paced({
      id: "phone-in",
      chapter: "knows",
      caption: `${PARENT} has two children in this league, and both play this weekend.`,
      stage: "split",
      emphasize: "phone-cal",
      callout: "His weekend still reads the old time, because nothing has reached him yet.",
    }),
    paced({
      id: "bell",
      chapter: "knows",
      caption: "The notification lands by itself.",
      emphasize: "phone-notice",
      callout: "The gym and the court are in the notification, not just the new time.",
      set: { notice: "moved" },
    }),
    paced({
      id: "cal",
      chapter: "knows",
      caption: "And Saturday's row moves to noon where it stands.",
      emphasize: "sat-row",
      callout: "Same row, new time, so a subscribed phone calendar has nothing to delete.",
      set: { notice: "", calMoved: true },
    }),
    paced({
      id: "who",
      chapter: "knows",
      caption: "The same change reached everybody attached to that game.",
      /* The strip stops naming a product screen, because this card is not
         one: `getGameAudienceUserIds` runs on the server and no surface in
         the product shows its answer. Punch item 2. */
      context: undefined,
      set: { ledger: true, fan: 0 },
      callout: "The list comes off the two rosters and the two clubs, worked out per game.",
      emphasize: "fanout",
    }),
    paced({
      id: "fan-1",
      chapter: "knows",
      caption: "Both rosters' families, twenty of them.",
      set: { fan: 1 },
      hold: 2600,
    }),
    paced({
      id: "fan-2",
      chapter: "knows",
      caption: "Both benches, head coach and assistant.",
      set: { fan: 2 },
      hold: 2400,
    }),
    paced({
      id: "fan-3",
      chapter: "knows",
      caption: "And both club front offices.",
      set: { fan: 3 },
      hold: 2400,
    }),
    paced({
      id: "fan-4",
      chapter: "knows",
      caption: "Twenty six people, from one press.",
      set: { fan: 4 },
      hold: 3000,
    }),
    paced({
      id: "email",
      chapter: "knows",
      caption: "Every one of them by notification and by email, off the same list.",
      emphasize: "fanout-foot",
      callout: "One audience query feeds both the bell and the email.",
    }),

    /* ── 3. The cancellation ──────────────────────────────────────────── */
    paced({
      id: "sunday",
      chapter: "cancel",
      caption: "Sunday's game is not being played at all.",
      context: CTX,
      cursor: "row-cancel",
      press: true,
      callout: "This one cannot be moved, so it comes off the schedule instead.",
      set: { ledger: false, open: "cancel" },
    }),
    paced({
      id: "cancel-press",
      chapter: "cancel",
      caption: "The confirmation is one sentence.",
      cursor: "cancel-game",
      press: true,
      callout: "A cancelled game stops counting in the table. That is the whole warning.",
      set: { dialog: "cancel" },
    }),
    paced({
      id: "cancel-ok",
      chapter: "cancel",
      caption: "Confirmed.",
      cursor: "confirm-cancel",
      press: true,
      toast: `Cancelled · ${CANCEL.home} vs ${CANCEL.away}`,
      set: { dialog: "", cancelled: true, open: "" },
    }),
    paced({
      id: "phone-cancel",
      chapter: "cancel",
      caption: "The same fan-out runs again, for the other daughter's team.",
      emphasize: "phone-notice",
      callout: "Twenty six again, and a different twenty six: the other team, the other club.",
      set: { notice: "cancelled" },
    }),
    paced({
      id: "phone-row",
      chapter: "cancel",
      caption: "Sunday goes quiet on her calendar, and stays visible.",
      emphasize: "sun-row",
      callout: "It is struck through where it sits rather than removed from the list.",
      set: { notice: "", calCancelled: true },
    }),
    paced({
      id: "email-line",
      chapter: "cancel",
      caption: "The email carries the same sentence.",
      emphasize: "email-card",
      callout: "The app and the inbox get the same words, from the same send.",
      set: { emailCard: true },
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
            <ScheduleScreen
              open={get<string>("open", "")}
              alts={get("alts", false)}
              moved={get("moved", false)}
              cancelled={get("cancelled", false)}
            />
          )}
        </div>

        {/* The product's confirmation, and ALL of it. It is a native
            `window.confirm` carrying one sentence: no reason field, no
            audience, no count. Nothing is added here. */}
        <Dialog
          open={get<string>("dialog", "") === "cancel"}
          title={CANCEL_CONFIRM}
          footer={
            <>
              <Btn tone="quiet" size="sm">
                Cancel
              </Btn>
              <Btn id="confirm-cancel" size="sm">
                OK
              </Btn>
            </>
          }
        />

        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = (
      <div className="relative h-full">
        <PhoneScreen title={PARENT} subtitle={KIDS} tab="Calendar">
          <FamilyCalendar
            moved={get("calMoved", false)}
            cancelled={get("calCancelled", false)}
            emailCard={get("emailCard", false)}
          />
        </PhoneScreen>
        {get<string>("notice", "") === "moved" && (
          <PhoneNotice id="phone-notice" title={MOVE_NOTICE.title} body={MOVE_NOTICE.body} />
        )}
        {get<string>("notice", "") === "cancelled" && (
          <PhoneNotice id="phone-notice" title={CANCEL_NOTICE.title} body={CANCEL_NOTICE.body} />
        )}
      </div>
    )

    return { desktop, phone }
  },
}

/* ── The Schedule tab ────────────────────────────────────────────────────── */

function ScheduleScreen({
  open,
  alts,
  moved,
  cancelled,
}: {
  open: string
  alts: boolean
  moved: boolean
  cancelled: boolean
}) {
  /* Opened, the list narrows to the row and its neighbours: the expansion
     carries six controls and a slot picker, and the scene never scrolls. */
  const openIndex = ROWS.findIndex(
    (r) => (open === "move" && r.id === "row-move") || (open === "cancel" && r.id === "row-cancel")
  )
  const visible =
    openIndex < 0
      ? ROWS
      : ROWS.slice(Math.max(0, openIndex - 2), Math.max(0, openIndex - 2) + 4)
  return (
    <>
      <ConsoleTabs active="Schedule" />
      <div className="bg-ink-50/70 min-h-0 flex-1 px-5 py-3">
        {/* The tab's own scope strip: whole season, or one session. */}
        <div data-demo-target="session-strip" className="mb-2 flex items-center gap-2">
          <span className="border-ink-200 flex shrink-0 overflow-hidden rounded-lg border bg-white text-[14px] font-bold">
            <span className="text-ink-500 px-2.5 py-1">Whole season</span>
            <span className="bg-play-600 px-2.5 py-1 text-white">{SESSION}</span>
          </span>
          <Chip tone="court" strong>
            Published
          </Chip>
          <span className="text-ink-500 truncate text-[14px] font-semibold">
            Sat 22 and Sun 23 August
          </span>
        </div>

        <Panel
          title={`Games in ${SESSION}`}
          action={
            <span className="flex items-center gap-2">
              <span className="border-ink-200 flex overflow-hidden rounded-lg border text-[14px] font-bold">
                <span className="bg-ink-950 px-2.5 py-1 text-white">List</span>
                <span className="text-ink-600 bg-white px-2.5 py-1">Board</span>
              </span>
              <Chip tone="neutral" strong>
                {visible.length} of {ROWS.length}
              </Chip>
            </span>
          }
        >
          <div className="space-y-0.5 px-3 py-1">
            {visible.map((r, i) => (
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
                index={i}
              />
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}

/**
 * One row of the Schedule tab's games list, and its expansion.
 *
 * The real row is a disclosure button carrying the time, the matchup with a
 * quiet "vs" between the clubs, the venue and court, the status badge and a
 * caret. Opening it reveals the action strip, in the product's own order.
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
  index,
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
  index: number
}) {
  const dead = status === "CANCELLED"
  return (
    <div
      data-demo-target={id}
      className={cn(
        "rounded-xl border bg-white transition-colors duration-300 motion-reduce:transition-none",
        open ? "border-ink-300" : "border-ink-100",
        dead && "bg-hoop-50/40 border-hoop-200"
      )}
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
    >
      {/* The real row is ONE wrapping flex line: time, matchup with a quiet
          "vs", venue and court, then the status badge and the caret. */}
      <div className="flex w-full items-center justify-between gap-3 px-3.5 py-0.5">
        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
          {/* PUNCH ITEM 3, honoured: a moved row carries NO lasting mark in
              the product, so it carries none here either. The one-shot pop is
              the demo's own "watch this", not a badge the operator would find
              on the row tomorrow. */}
          <span
            className={cn(
              "text-ink-700 shrink-0 whitespace-nowrap text-[15px] font-bold tabular-nums",
              changed && "live-pop",
              dead && "text-ink-400 line-through"
            )}
          >
            {when}
          </span>
          <span className="text-ink-900 text-[15px] font-semibold">
            {home} <span className="text-ink-400 font-medium">vs</span> {away}
          </span>
          <span className="text-ink-500 text-[14px] font-medium">
            {venue} · {court}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusChip tone={dead ? "hoop" : "court"}>{status}</StatusChip>
          <span className="text-ink-400 text-[14px]">{open ? "▴" : "▾"}</span>
        </div>
      </div>

      {open && (
        <div className="border-ink-100 border-t px-3.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Btn tone="quiet" size="sm">
              Box score ↗
            </Btn>
            <Btn tone="quiet" size="sm">
              Pin in place
            </Btn>
            <span
              data-demo-target="find-alternates"
              className="border-play-300 text-play-700 inline-flex shrink-0 items-center rounded-xl border bg-white px-3.5 py-1.5 text-[14px] font-bold"
            >
              {alts ? "Hide alternates" : "Find alternates"}
            </span>
            <span className="border-gold-400 text-gold-600 inline-flex shrink-0 items-center rounded-xl border bg-white px-3.5 py-1.5 text-[14px] font-bold">
              Forfeit: home
            </span>
            <span className="border-gold-400 text-gold-600 inline-flex shrink-0 items-center rounded-xl border bg-white px-3.5 py-1.5 text-[14px] font-bold">
              Forfeit: away
            </span>
            <span
              data-demo-target="cancel-game"
              className="border-hoop-300 text-hoop-700 inline-flex shrink-0 items-center rounded-xl border bg-white px-3.5 py-1.5 text-[14px] font-bold"
            >
              Cancel game
            </span>
          </div>

          {alts && (
            <div
              data-demo-target="alt-slots"
              className="bg-ink-50 live-pop mt-1.5 rounded-xl px-2.5 py-1.5"
            >
              <p className="text-ink-700 mb-1.5 text-[14px] font-bold">Suggested alternate slots</p>
              <ul className="space-y-1">
                {ALTERNATES.map((s) => (
                  <li
                    key={s.label}
                    className="border-ink-100 flex items-center justify-between gap-2 rounded-lg border bg-white px-2.5 py-1"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-ink-900 text-[15px] font-semibold tabular-nums">
                        {s.label}
                      </span>
                      {s.sameDay && (
                        <span className="bg-play-100 text-play-700 rounded-full px-2 py-0.5 text-[14px] font-semibold">
                          same day
                        </span>
                      )}
                    </span>
                    <Btn id={s.id} size="sm">
                      Move here
                    </Btn>
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

/* ── The fan-out ledger ──────────────────────────────────────────────────── */

/**
 * NARRATION, NOT A SCREEN.
 *
 * The product has no recipients panel: `getGameAudienceUserIds` computes this
 * list on the server and nothing ever shows it to the league. So this card is
 * drawn in navy with no console chrome anywhere near it, which is the honest
 * way to put a server-side truth on camera. It is punch item 2 in the numbers
 * sheet, and the fix is a real "who was told" panel on the game row.
 */
function FanOutLedger({ shown }: { shown: number }) {
  return (
    <div
      data-demo-target="fanout"
      className="flex min-h-0 flex-1 flex-col justify-center bg-[#0b1628] px-10 py-7 text-white"
    >
      <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.16em]">
        Who the change reached
      </p>
      <p className="font-display mt-1.5 text-[38px] font-extrabold leading-none tabular-nums">
        {FANOUT_TOTAL} people
      </p>
      <p className="mt-1.5 text-[16px] font-semibold text-white/70">
        {MOVE.home} vs {MOVE.away} · two clubs, two rosters
      </p>

      <div className="mt-5 space-y-2">
        {FANOUT.map((r, i) => (
          <div
            key={r.label}
            className={cn(
              "flex items-baseline gap-4 rounded-2xl border px-4 py-2.5 transition-opacity duration-500 motion-reduce:transition-none",
              i < shown ? "border-white/15 bg-white/[0.07] opacity-100" : "border-white/5 opacity-20"
            )}
          >
            <span className="w-[52px] shrink-0 text-[24px] font-extrabold leading-none tabular-nums text-gold-400">
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

      <p
        data-demo-target="fanout-foot"
        className="mt-4 border-t border-white/10 pt-3 text-[15px] font-medium text-white/55"
      >
        One audience list, used twice: the notification in the app and the email to the same
        people.
      </p>
    </div>
  )
}

/* ── The family calendar ─────────────────────────────────────────────────── */

function FamilyCalendar({
  moved,
  cancelled,
  emailCard,
}: {
  moved: boolean
  cancelled: boolean
  emailCard: boolean
}) {
  return (
    <div data-demo-target="phone-cal" className="space-y-2.5">
      <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.08em]">
        This weekend
      </p>

      <CalendarRow
        id="sat-row"
        day={SAT_ROW.day}
        time={moved ? SAT_ROW.movedTime : SAT_ROW.time}
        label={SAT_ROW.label}
        place={SAT_ROW.place}
        changed={moved}
      />
      <CalendarRow
        id="sun-row"
        day={SUN_ROW.day}
        time={SUN_ROW.time}
        label={SUN_ROW.label}
        place={SUN_ROW.place}
        cancelled={cancelled}
      />

      {emailCard && (
        <div
          data-demo-target="email-card"
          className="border-hoop-200 bg-hoop-50 live-pop rounded-2xl border px-3 py-2.5"
        >
          <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.06em]">
            Also in her inbox
          </p>
          <p className="text-ink-900 mt-1 text-[15px] font-bold leading-snug">{EMAIL_SUBJECT}</p>
          <p className="text-hoop-800 mt-1 text-[14px] font-semibold leading-snug">{EMAIL_LINE}</p>
        </div>
      )}
    </div>
  )
}

/**
 * One agenda row, exactly as `calendar/my-calendar.tsx` draws it: the time
 * range first and in bold, the "vs OPPONENT" line under it, then the gym and
 * the team. A cancelled row keeps its place at 60 percent opacity with the
 * time struck through and the red CANCELLED pill beside it.
 */
function CalendarRow({
  id,
  day,
  time,
  label,
  place,
  changed,
  cancelled,
}: {
  id: string
  day: string
  time: string
  label: string
  place: string
  changed?: boolean
  cancelled?: boolean
}) {
  return (
    <div>
      <p className="text-ink-500 mb-1 text-[14px] font-bold">{day}</p>
      <div
        data-demo-target={id}
        className={cn(
          "border-ink-200 border-l-4 border-l-court-500 rounded-xl border bg-white px-3 py-2.5 transition-opacity duration-500 motion-reduce:transition-none",
          cancelled && "opacity-60",
          changed && "live-pop"
        )}
      >
        <p className="text-ink-950 text-[16px] font-extrabold tabular-nums">
          <span className={cancelled ? "line-through" : ""}>{time}</span>
          {cancelled && (
            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[14px] font-bold uppercase text-red-600">
              Cancelled
            </span>
          )}
        </p>
        <p className="text-ink-900 mt-0.5 text-[15px] font-bold">{label}</p>
        <p className="text-ink-600 mt-0.5 text-[14px] font-medium leading-snug">{place}</p>
      </div>
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
