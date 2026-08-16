"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Btn, Chip, ConsoleTabs, Panel, StatusChip } from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "The referees" (scenario audit C3, and the homepage demo's lost referees
 * scene, which A0 named as the reason to build this).
 *
 * Referees are a league's second biggest cost centre after gyms, and the only
 * one nobody has ever shown them software for. This demo runs the whole loop
 * on real rows: the league keeps a pool, books a DAY rather than a game,
 * broadcasts it to the pool at a per-game rate, and the first referee to
 * accept is assigned to every game inside the window automatically. Then it
 * turns the camera around to his phone, which is where his schedule, his
 * rate and his own calendar live.
 *
 * Built to the gold standard set by `season-story.tsx`,
 * `schedule-change-story.tsx` and `waivers-story.tsx` on 2026-08-16, to the
 * same three laws:
 *
 *   1. PRESENTATION (audit D2). Focused working REGIONS composed at 1160
 *      logical, rendered at scale 1.0, no browser chrome and no site header.
 *      When the phone joins the console is composed NARROWER (900) rather
 *      than scaled down, and the handset arrives life size at 390 logical.
 *      `scripts/demo/readability-audit.mjs` is the gate: nothing under 14px.
 *   2. PACING. Stop, explain, act. Every dwell is computed from the balloon's
 *      own word count, and a beat carrying a balloon silences the caption bar.
 *   3. EVERY NUMBER DERIVED. The pool, the certifications, the rates, the
 *      declared availability, the shift, its window, the eight games it
 *      covers and the settlement rows are read out of the local seeded
 *      database, and every one is written down with its source in
 *      `docs/roadmap/the-referees-numbers.md`.
 *
 * THE PHONE IS NOT A FABRICATION, AND THAT MATTERS HERE. The audit's D table
 * allows fabricating a handset composition of a desktop screen, but this demo
 * does not need the allowance: `/referee` and `/referee/requests` are
 * responsive web pages that a referee reaches from the app's own MOBILE
 * bottom tab bar (`components/nav/bottom-tabs.tsx` line 88 puts "My Games" ->
 * `/referee` in the bar whenever `shape.isRefereeing`), and the native app
 * ships the same screen at `apps/mobile/src/app/(tabs)/referee.tsx`. The
 * referee's half of this story is a phone surface the product already has.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN:
 *   · the league desk is `manage/components/referees-tab.tsx`: the
 *     book-a-day panel with its three shift presets, the broadcast option
 *     "All league referees (first accept wins)", the $/game field, the pool
 *     rows with certification, games refereed, rate and availability badge,
 *     and the settlements panel with its own sentence;
 *   · the referee's inbox is `/referee/requests`, down to the "first accept
 *     wins" pill and the sentence under a priced offer;
 *   · the accept confirmation is the product's own, both branches;
 *   · "My games" is `/referee/page.tsx`: "Coming up (N)", the date line, the
 *     matchup, the venue and court, and the rate in green;
 *   · the calendar feed line is `api/calendar/[token]/route.ts` line 165.
 *
 * FOUR THINGS THE PRODUCT CANNOT HONESTLY SHOW, AND THEY ARE NOT STAGED.
 * All four are punch items in the numbers sheet, section F:
 *   1. NO MONEY MOVES. A settlement is a confirm flag, not a payout. The
 *      demo says so on the settlement card rather than implying a transfer.
 *   2. NO BLACKOUTS. Availability is positive windows only, so a referee
 *      cannot say when he is NOT free.
 *   3. THE NATIVE APP HIDES THE RATE. Its referee screen carries no $/game,
 *      which the web pages do. The demo films the web phone surface and the
 *      gap is written down.
 *   4. NO REFEREE-ONLY CALENDAR FEED. Officiating events ride the one
 *      personal feed, so the demo shows exactly that and claims nothing more.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const LEAGUE = "NPH Summer League"
const SEASON = "Summer 2026"
const CTX_DESK = `${LEAGUE} · ${SEASON} · Referees`

/** The day being booked. `DB` SeasonSessionDay 073ce624, Sat 8 August 2026. */
const DAY = "Sat, Aug 8"
const SESSION = "Weekend 10 · Aug 8"
/** `PRODUCT` the middle shift preset, `referees-tab.tsx` SHIFT_PRESETS. */
const SHIFT = "09:00 – 15:00"
const PRESET = "Morning 6h (9–3)"
const RATE = 50

/**
 * The league's pool. `DB` three `LeagueReferee` rows on this league, each with
 * a `RefereeProfile`. The row text is the product's own format: certification,
 * then "Self-declared" when no document is on file, then games refereed, then
 * the rate. All three hold a sign-off PIN, so none carries the "no sign-off
 * PIN" flag the product would otherwise add.
 */
const POOL = [
  { name: "Mike Ferreira", cert: "Level 3", games: 40, fee: RATE, availability: "available" },
  { name: "Sarah Whitlock", cert: "Level 2", games: 57, fee: RATE, availability: "available" },
  {
    name: "James Okonkwo",
    cert: "Level 3",
    games: 74,
    fee: RATE,
    availability: "no availability set",
  },
] as const

/** The referee whose phone this is. `DB` summer-ref-mike@sportshub.demo. */
const REF = "Mike Ferreira"

/**
 * The offer's message. `DB` verbatim from the seeded `RefereeSessionRequest`;
 * the row carries an em-dash and the house copy rule turns it into a middot.
 */
const MESSAGE = "Saturday morning block · three courts running at the Playground."

/**
 * The games the accept assigns. `DB` eight games on that session day, every
 * one published, seven tipping at 9:00 and one at 10:30, so all eight fall
 * inside the 09:00 to 15:00 window `inShiftWindow` tests.
 */
const GAMES = [
  { at: "9:00 AM", home: "Toronto Lords Grade 9", away: "West United Prep Grade 9", where: "The Playground · Court 1" },
  { at: "9:00 AM", home: "CKATT Basketball Grade 9", away: "Oakville Panthers Grade 9", where: "The Playground · Court 2" },
  { at: "9:00 AM", home: "Kings Court Basketball Grade 9", away: "Mississauga Monarchs Grade 9", where: "The Playground · Court 3" },
  { at: "10:30 AM", home: "Burlington Force Grade 10", away: "North Toronto Huskies Grade 10", where: "The Playground · Court 1" },
]
/**
 * How many of the eight the handset draws. The real list scrolls; the scene
 * does not, so the screen shows three and says how many are behind them, with
 * the product's own "Coming up (8)" header carrying the true count.
 */
const GAMES_SHOWN = 3
/** `DB` the full count on that day. The list scrolls; the header says eight. */
const GAME_COUNT = 8
/** `ARITH` eight games at the agreed rate. */
const DAY_PAY = GAME_COUNT * RATE

/** `PRODUCT` `referee/requests/page.tsx` lines 74 to 80, the accept branch. */
const ACCEPTED_NOTE = `You're booked: assigned to ${GAME_COUNT} games that day. See them in My games.`
/** `PRODUCT` the same lines, the branch this demo does NOT take, and why. */
const UNPUBLISHED_NOTE =
  "You're booked. The league hasn't published that day's schedule yet, so your games will appear in My games when it goes out."
/** `PRODUCT` `referee/requests/page.tsx` lines 197 to 200. */
const PAY_TERMS =
  "Paid per game officiated · accepting means agreeing to this rate. Games are tallied after the session and confirmed by the league before settlement."

/** `PRODUCT` `api/calendar/[token]/route.ts` line 165, em-dash to middot. */
const ICS_TITLE = (g: (typeof GAMES)[number]) => `Officiating · ${g.home} vs ${g.away}`

/**
 * The settlements. `DB` six `RefereeSettlement` rows on this league, three per
 * session date, four games each at $50. The 11 July set is CONFIRMED and the
 * 25 July set is PENDING_CONFIRM, which is exactly the pair of states the
 * panel is built to show.
 */
const SETTLEMENTS = [
  { name: "Mike Ferreira", date: "Jul 25", games: 4, rate: RATE, total: 200, confirmed: false },
  { name: "Sarah Whitlock", date: "Jul 25", games: 4, rate: RATE, total: 200, confirmed: false },
  { name: "James Okonkwo", date: "Jul 25", games: 4, rate: RATE, total: 200, confirmed: false },
  { name: "Mike Ferreira", date: "Jul 11", games: 4, rate: RATE, total: 200, confirmed: true },
]
/* The sixth and seventh rows (Sarah and James on 11 July, both CONFIRMED) are
   real and left off: the scene is a 600 logical box, and one confirmed row is
   enough to show the state the pending ones are heading for. */

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 500
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 180 + 900 : 2400
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const theRefereesStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/manage/leagues/nph-summer/seasons/summer-2026/manage?tab=referees",
  context: CTX_DESK,
  initialStage: "desktop",
  chapters: [
    { id: "book", title: "The league books a day" },
    { id: "accept", title: "First accept wins" },
    { id: "his", title: "His games, his calendar" },
    { id: "pay", title: "What the day pays" },
  ],

  beats: [
    /* ── 1. The league books a day ────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "book",
      caption: "Referees have their own tab in the league console.",
      emphasize: "pool-panel",
      callout: "The pool is a list the league keeps, with a rate against each name.",
    }),
    paced({
      id: "pool",
      chapter: "book",
      caption: "Every row carries what a booker needs.",
      emphasize: "pool-rows",
      callout:
        "Certification, whether it is self-declared, how many games they have worked, and their own rate.",
    }),
    paced({
      id: "day",
      chapter: "book",
      caption: "The league books a DAY, not a game.",
      cursor: "book-day",
      press: true,
      set: { dayPicked: true },
      callout:
        "Pick the session day and the pool answers with who is free, from availability they declared themselves.",
    }),
    paced({
      id: "avail",
      chapter: "book",
      caption: "Two have said they can work it. One has never said anything.",
      emphasize: "pool-rows",
      callout: "The third shows as silent rather than unavailable, because he has not answered.",
    }),
    paced({
      id: "shift",
      chapter: "book",
      caption: "The shift is one press.",
      cursor: "preset-morning",
      press: true,
      set: { shiftSet: true },
      callout: "Nine to three. Every game that tips inside that window becomes theirs.",
    }),
    paced({
      id: "broadcast",
      chapter: "book",
      caption: "It does not have to go to one person.",
      cursor: "send-to",
      press: true,
      set: { broadcast: true },
      callout: "Send it to the whole pool and let the first one who says yes have the day.",
    }),
    paced({
      id: "rate",
      chapter: "book",
      caption: "The rate is on the offer, so accepting is agreeing to it.",
      cursor: "rate-field",
      type: { key: "rateTyped", text: `${RATE}` },
      set: { rateShown: true },
      callout: "The rate is part of the offer, so accepting it settles the price.",
    }),
    paced({
      id: "send",
      chapter: "book",
      caption: "Sent.",
      cursor: "send-offer",
      press: true,
      toast: `Offer sent · ${DAY} · ${SHIFT} · $${RATE}/game`,
      set: { sent: true },
      callout: "One offer, three phones, and no follow-up to make.",
    }),

    /* ── 2. First accept wins ─────────────────────────────────────────── */
    paced({
      id: "phone-in",
      chapter: "accept",
      caption: `It lands on ${REF}'s phone, where he keeps his shifts.`,
      stage: "split",
      emphasize: "phone-offers",
      callout: "This is his own screen in the app, where his shifts live.",
      set: { phoneView: "offers" },
    }),
    paced({
      id: "offer",
      chapter: "accept",
      caption: "The offer says the league, the day, the hours and the money.",
      emphasize: "offer-card",
      callout: "The league, the day, the hours and the money are all on the card.",
    }),
    paced({
      id: "wins",
      chapter: "accept",
      caption: "The card says the offer is open to the pool.",
      emphasize: "offer-wins",
      callout: "First accept wins, and the other two see the offer close.",
    }),
    paced({
      id: "terms",
      chapter: "accept",
      caption: "The rate comes with the terms attached.",
      emphasize: "offer-terms",
      callout:
        "Paid per game officiated, tallied after the session, confirmed before settlement.",
    }),
    paced({
      id: "accept",
      chapter: "accept",
      caption: "He takes it.",
      cursor: "accept-btn",
      press: true,
      set: { accepted: true, phoneView: "booked" },
      callout: `Accepting assigns him to all ${GAME_COUNT} games in the window. He picks none of them by hand.`,
    }),
    paced({
      id: "league-side",
      chapter: "accept",
      caption: "The league finds out without being asked.",
      emphasize: "offer-row",
      callout: "The offer row answers itself: accepted, and by whom.",
    }),

    /* ── 3. His games, his calendar ───────────────────────────────────── */
    paced({
      id: "mygames",
      chapter: "his",
      caption: "The booking becomes a schedule.",
      set: { phoneView: "games" },
      emphasize: "phone-games",
      callout: "Eight games, next one first, on his own My games tab.",
    }),
    paced({
      id: "card",
      chapter: "his",
      caption: "Each one says the day, the floor and what it pays.",
      emphasize: "game-1",
      callout: "The court is on the card, not just the building.",
    }),
    paced({
      id: "drafts",
      chapter: "his",
      caption: "Only games the league has actually published are ever on this list.",
      emphasize: "phone-games",
      callout: "A draft game is the operator's private copy, so it never reaches a referee.",
    }),
    paced({
      id: "calendar",
      chapter: "his",
      caption: "Then the calendar subscription.",
      set: { phoneView: "calendar" },
      cursor: "add-phone",
      press: true,
      callout: "One subscription, and his officiating goes into the calendar he already uses.",
    }),
    paced({
      id: "ics",
      chapter: "his",
      caption: "Every assignment, in his own calendar app, updating itself.",
      emphasize: "ics-list",
      callout: "It is a live feed, so a cancelled or moved game corrects itself.",
      set: { subscribed: true },
    }),

    /* ── 4. What the day pays ─────────────────────────────────────────── */
    paced({
      id: "settle",
      chapter: "pay",
      caption: "After the session, the league already knows what it owes.",
      stage: "desktop",
      context: `${LEAGUE} · ${SEASON} · Referees`,
      set: { settleView: true },
      emphasize: "settle-panel",
      callout:
        "Tallied per referee per session day, at the rate they agreed to on accepting.",
    }),
    paced({
      id: "confirm",
      chapter: "pay",
      caption: "The league checks the tally and confirms it.",
      cursor: "settle-confirm",
      press: true,
      toast: `Settled · ${REF} · Jul 25 · $200`,
      set: { confirmed: true },
      callout: "Confirming stores the number, so nobody recounts games in October.",
    }),
    paced({
      id: "end",
      chapter: "pay",
      caption:
        "One day booked, one referee, eight games assigned from that accept, and the day's total on the record.",
      hold: 4200,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const settleView = get("settleView", false)

    const desktop = (
      <div className="relative flex h-full flex-col">
        <div
          key={settleView ? "settle" : "desk"}
          className="demo-fade-in flex min-h-0 flex-1 flex-col"
        >
          {settleView ? (
            <SettlementsScreen confirmed={get("confirmed", false)} />
          ) : (
            <RefereeDesk
              dayPicked={get("dayPicked", false)}
              shiftSet={get("shiftSet", false)}
              broadcast={get("broadcast", false)}
              rateShown={get("rateShown", false)}
              rateTyped={get<string>("rateTyped", "")}
              typing={typingKey === "rateTyped"}
              sent={get("sent", false)}
              accepted={get("accepted", false)}
              narrow={get<string>("phoneView", "") !== ""}
            />
          )}
        </div>
        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = (
      <RefPhone
        view={get<string>("phoneView", "offers")}
        accepted={get("accepted", false)}
        subscribed={get("subscribed", false)}
      />
    )

    return { desktop, phone }
  },
}

/* ── The league's referee desk ───────────────────────────────────────────── */

function RefereeDesk({
  dayPicked,
  shiftSet,
  broadcast,
  rateShown,
  rateTyped,
  typing,
  sent,
  accepted,
  narrow,
}: {
  dayPicked: boolean
  shiftSet: boolean
  broadcast: boolean
  rateShown: boolean
  rateTyped: string
  typing: boolean
  sent: boolean
  accepted: boolean
  /** True from the beat the phone joins: the region is 900 logical, not 1160. */
  narrow: boolean
}) {
  return (
    <>
      <ConsoleTabs active="Referees" />
      <div className="bg-ink-50/70 min-h-0 flex-1 px-5 py-3">
        {/* BOOK A REFEREE FOR A SESSION DAY, with the real panel's own
            explanatory sentence. */}
        <Panel title="Book a referee for a session day">
          <div className="px-4 py-2.5">
            <p className="text-ink-600 text-[15px] font-medium leading-snug">
              Pick a day and shift, then target a referee you know, or broadcast to your whole pool
              and let the first taker have it. Accepting auto-assigns them to every game in the
              window.
            </p>

            <div className="mt-2.5 flex flex-wrap items-end gap-3">
              <Field label="Session day">
                <span
                  data-demo-target="book-day"
                  className={cn(
                    "border-ink-300 inline-flex w-[192px] items-center justify-between rounded-lg border bg-white px-3 py-1.5 text-[15px] font-semibold",
                    dayPicked ? "text-ink-900" : "text-ink-400"
                  )}
                >
                  {dayPicked ? SESSION : "Choose day…"}
                  <span className="text-ink-400 text-[14px]">▾</span>
                </span>
              </Field>
              <Field label="Shift">
                <span className="flex items-center gap-1.5">
                  <span className="border-ink-300 text-ink-900 rounded-lg border bg-white px-3 py-1.5 text-[15px] font-semibold tabular-nums">
                    09:00
                  </span>
                  <span className="text-ink-400 text-[14px]">–</span>
                  <span
                    className={cn(
                      "border-ink-300 text-ink-900 rounded-lg border bg-white px-3 py-1.5 text-[15px] font-semibold tabular-nums",
                      shiftSet && "live-pop"
                    )}
                  >
                    {shiftSet ? "15:00" : "18:00"}
                  </span>
                </span>
              </Field>
              <span className="flex gap-1.5 pb-1">
                {["Full day (9–6)", PRESET, "Afternoon (12–6)"].map((p) => (
                  <span
                    key={p}
                    data-demo-target={p === PRESET ? "preset-morning" : undefined}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[14px] font-semibold",
                      shiftSet && p === PRESET
                        ? "bg-play-600 text-white"
                        : "bg-ink-100 text-ink-600"
                    )}
                  >
                    {p}
                  </span>
                ))}
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-end gap-3">
              <Field label="Send to" className="min-w-0 flex-1">
                <span
                  data-demo-target="send-to"
                  className={cn(
                    "border-ink-300 text-ink-900 flex items-center justify-between rounded-lg border bg-white px-3 py-1.5 text-[15px] font-semibold",
                    broadcast && "border-play-500"
                  )}
                >
                  <span className="truncate">
                    <span aria-hidden="true">📢 </span>
                    All league referees (first accept wins)
                  </span>
                  <span className="text-ink-400 text-[14px]">▾</span>
                </span>
              </Field>
              <span
                data-demo-target="rate-field"
                className={cn(
                  "border-ink-300 w-[104px] shrink-0 rounded-lg border bg-white px-3 py-1.5 text-[15px] font-semibold tabular-nums",
                  rateShown ? "text-ink-900" : "text-ink-400"
                )}
              >
                {rateShown ? (
                  <>
                    ${rateTyped}
                    {typing && <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />}
                  </>
                ) : (
                  "$/game"
                )}
              </span>
              <span className="border-ink-300 text-ink-500 min-w-0 flex-1 shrink rounded-lg border bg-white px-3 py-1.5 text-[15px] font-medium">
                <span className="text-ink-800">{MESSAGE}</span>
              </span>
              <Btn id="send-offer" size="sm">
                Send offer
              </Btn>
            </div>
          </div>
        </Panel>

        <div className={cn("mt-2.5 grid gap-2.5", narrow ? "grid-cols-1" : "grid-cols-[0.85fr_1.15fr]")}>
        {/* OFFERS */}
        <Panel title="Offers">
          <div className="px-4 py-2">
            {sent ? (
              <div
                data-demo-target="offer-row"
                className={cn(
                  "border-ink-100 live-pop flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2",
                  accepted && "border-court-200 bg-court-50/60"
                )}
              >
                <span className="text-ink-900 text-[15px] font-semibold">
                  {DAY} · {SHIFT}{" "}
                  <span className="text-ink-400 font-medium">
                    · {SESSION} · all league referees
                  </span>
                </span>
                <StatusChip tone={accepted ? "court" : "gold"}>
                  {accepted ? `accepted · ${REF}` : "pending"}
                </StatusChip>
              </div>
            ) : (
              <p className="text-ink-500 text-[15px] font-semibold">No offers sent yet.</p>
            )}
          </div>
        </Panel>

        {/* LEAGUE REFEREE POOL. It steps aside when the phone arrives: the
            region is composed at 900 rather than 1160 from that beat on, and
            two panels abreast do not fit at that width. No beat after
            chapter 1 targets it. */}
        {!narrow && (
        <Panel
          id="pool-panel"
          title="League referee pool"
          action={
            <Chip tone="neutral" strong>
              {POOL.length}
            </Chip>
          }
        >
          <div data-demo-target="pool-rows" className="space-y-1 px-4 py-2">
            {POOL.map((r) => (
              <div
                key={r.name}
                className="border-ink-100 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2"
              >
                <span className="min-w-0">
                  <span className="text-ink-900 text-[15px] font-bold">{r.name}</span>
                  <span className="text-ink-500 ml-2.5 text-[14px] font-medium">
                    {r.cert} · Self-declared · {r.games} games · ${r.fee}/game
                  </span>
                </span>
                {dayPicked && (
                  <span className="live-pop shrink-0">
                    <Chip tone={r.availability === "available" ? "court" : "neutral"}>
                      {r.availability}
                    </Chip>
                  </span>
                )}
              </div>
            ))}
          </div>
        </Panel>
        )}
        </div>
      </div>
    </>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn("block", className)}>
      <span className="text-ink-600 mb-1 block text-[14px] font-semibold">{label}</span>
      {children}
    </span>
  )
}

/* ── Settlements ─────────────────────────────────────────────────────────── */

function SettlementsScreen({ confirmed }: { confirmed: boolean }) {
  return (
    <>
      <ConsoleTabs active="Referees" />
      <div className="bg-ink-50/70 min-h-0 flex-1 px-6 py-3">
        <div
          data-demo-target="settle-panel"
          className="border-ink-200 rounded-2xl border bg-white px-5 py-4"
        >
          <div className="flex items-center gap-2.5">
            <span className="bg-play-600 h-4 w-[3px] shrink-0 rounded-full" />
            <h3 className="font-display text-ink-900 text-[17px] font-extrabold uppercase tracking-[0.02em]">
              Referee settlements
            </h3>
          </div>
          <p className="text-ink-600 mt-1.5 text-[15px] font-medium leading-snug">
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
                  className={cn(
                    "border-ink-100 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2 transition-colors duration-300 motion-reduce:transition-none",
                    done && "border-court-200 bg-court-50/50"
                  )}
                >
                  <span className="min-w-0">
                    <span className="text-ink-900 text-[15px] font-bold">{s.name}</span>
                    <span className="text-ink-500 ml-2.5 text-[14px] font-medium tabular-nums">
                      {s.date} · {s.games} games × ${s.rate} = ${s.total}
                    </span>
                  </span>
                  {done ? (
                    <span className={cn("shrink-0", confirmed && i === 0 && "live-pop")}>
                      <StatusChip tone="court">Confirmed</StatusChip>
                    </span>
                  ) : (
                    <Btn id={i === 0 ? "settle-confirm" : undefined} tone="ghost" size="sm">
                      Confirm
                    </Btn>
                  )}
                </div>
              )
            })}
          </div>
          <p
            data-demo-target="settle-foot"
            className="border-ink-100 text-ink-500 mt-3 border-t pt-2.5 text-[14px] font-medium leading-snug"
          >
            A confirmed settlement is the number both sides agreed: the games worked on that
            session day, at the rate on the offer the referee accepted.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2 rounded-2xl border border-ink-200 bg-white px-5 py-3">
          <span className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.08em]">
            The day just booked
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-court-700 text-[26px] font-extrabold leading-none tabular-nums">
              {GAME_COUNT}
            </span>
            <span className="text-ink-700 text-[15px] font-semibold">games assigned</span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-court-700 text-[26px] font-extrabold leading-none tabular-nums">
              ${DAY_PAY}
            </span>
            <span className="text-ink-700 text-[15px] font-semibold">
              owed at the agreed ${RATE} a game
            </span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-court-700 text-[26px] font-extrabold leading-none tabular-nums">
              0
            </span>
            <span className="text-ink-700 text-[15px] font-semibold">games assigned by hand</span>
          </span>
        </div>
      </div>
    </>
  )
}

/* ── The referee's phone ─────────────────────────────────────────────────── */

/**
 * A real phone surface, not a composition. `/referee` and `/referee/requests`
 * are responsive pages the app's own mobile bottom bar links to, so the tab
 * strip below carries the real referee bar: Home, Chat, Calendar, My Games,
 * Social (`components/nav/bottom-tabs.tsx`).
 */
function RefPhone({
  view,
  accepted,
  subscribed,
}: {
  view: string
  accepted: boolean
  subscribed: boolean
}) {
  const tab = view === "games" ? "My Games" : view === "calendar" ? "Calendar" : "My Games"
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2.5 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">{REF}</p>
        <p className="text-[14px] font-medium text-white/60">Referee · Level 3</p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        {view === "games" ? (
          <MyGames />
        ) : view === "calendar" ? (
          <RefCalendar subscribed={subscribed} />
        ) : (
          <Offers accepted={accepted || view === "booked"} />
        )}
      </div>

      <div className="border-ink-200 flex shrink-0 items-center justify-around border-t bg-white px-1.5 pb-4 pt-2">
        {["Home", "Chat", "Calendar", "My Games", "Social"].map((t) => (
          <span
            key={t}
            className={cn(
              "text-[14px] font-bold",
              t === tab ? "text-play-700" : "text-ink-400"
            )}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

/** `/referee/requests`, Shifts and availability. */
function Offers({ accepted }: { accepted: boolean }) {
  return (
    <div data-demo-target="phone-offers" className="space-y-2.5">
      <p className="text-ink-900 text-[17px] font-extrabold">Shifts &amp; availability</p>

      {accepted && (
        <div className="border-court-200 bg-court-50 text-court-700 live-pop rounded-xl border px-3 py-2 text-[14px] font-semibold leading-snug">
          {ACCEPTED_NOTE}
        </div>
      )}

      <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.08em]">
        Offers{accepted ? "" : " (1)"}
      </p>
      <div>
        <div
          data-demo-target="offer-card"
          className={cn(
            "border-ink-100 mt-2 rounded-xl border px-3 py-2.5",
            accepted && "border-court-200 bg-court-50/60"
          )}
        >
          <p className="text-ink-900 text-[15px] font-bold leading-snug">
            {LEAGUE} · {DAY} · {SHIFT}{" "}
            <span className="text-court-700">${RATE}/game</span>
          </p>
          <p className="text-ink-400 mt-0.5 text-[14px] font-medium">
            {SEASON} · {SESSION}
          </p>
          {!accepted && (
            <span
              data-demo-target="offer-wins"
              className="bg-hoop-100 text-hoop-700 mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[14px] font-bold"
            >
              first accept wins
            </span>
          )}
          <p className="text-ink-600 mt-1.5 text-[14px] font-medium leading-snug">
            &ldquo;{MESSAGE}&rdquo;
          </p>
          <p
            data-demo-target="offer-terms"
            className="text-ink-400 mt-1.5 text-[14px] font-medium leading-snug"
          >
            {PAY_TERMS}
          </p>
          {accepted ? (
            <p className="text-court-700 mt-2 text-[14px] font-bold">
              Booked · {GAME_COUNT} games on your schedule
            </p>
          ) : (
            <div className="mt-2 flex gap-2">
              <Btn id="accept-btn" tone="court" size="sm">
                Accept
              </Btn>
              <Btn tone="quiet" size="sm">
                Decline
              </Btn>
            </div>
          )}
        </div>
      </div>

      {/* His declared availability, which is what put "available" beside his
          name in the league's pool a moment ago. Compressed to one line, and
          it steps aside once the booked banner arrives: the handset is 390 by
          576 and nothing after the accept targets it. */}
      {!accepted && (
      <div className="border-ink-200 flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2">
        <span className="min-w-0">
          <span className="text-ink-500 block text-[14px] font-bold uppercase tracking-[0.06em]">
            My availability
          </span>
          <span className="text-ink-800 block text-[14px] font-semibold tabular-nums">
            {DAY} · 09:00 to 18:00
          </span>
        </span>
        <span className="text-hoop-600 shrink-0 text-[14px] font-bold">Remove</span>
      </div>
      )}
    </div>
  )
}

/** `/referee`, My games. */
function MyGames() {
  return (
    <div data-demo-target="phone-games" className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold">My games</p>
      <p className="text-ink-400 text-[14px] font-bold uppercase tracking-[0.1em]">
        Coming up ({GAME_COUNT})
      </p>
      {GAMES.slice(0, GAMES_SHOWN).map((g, i) => (
        <div
          key={`${g.home}-${g.at}-${g.where}`}
          data-demo-target={i === 0 ? "game-1" : undefined}
          className="border-ink-200 live-row-in rounded-2xl border bg-white px-3 py-2"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-900 text-[14px] font-bold">
              {DAY} · {g.at}
            </span>
            <span className="text-court-700 text-[14px] font-bold tabular-nums">${RATE}/game</span>
          </div>
          <p className="text-ink-950 mt-0.5 text-[15px] font-bold leading-tight">
            {g.home} vs {g.away}
          </p>
          <p className="text-ink-500 mt-0.5 text-[14px] font-medium">
            {g.where} · {LEAGUE}
          </p>
        </div>
      ))}
      <p className="text-ink-400 px-1 text-[14px] font-semibold">
        and {GAME_COUNT - GAMES_SHOWN} more that morning
      </p>
    </div>
  )
}

/** `/calendar` and its Add to phone control, then the subscribed feed. */
function RefCalendar({ subscribed }: { subscribed: boolean }) {
  return (
    <div className="space-y-2.5">
      <p className="text-ink-900 text-[17px] font-extrabold">My calendar</p>
      {!subscribed ? (
        <div className="border-ink-200 rounded-2xl border bg-white px-3 py-3">
          <p className="text-ink-900 text-[15px] font-bold">Add to your phone</p>
          <p className="text-ink-500 mt-1 text-[14px] font-medium leading-snug">
            Subscribe once and every game you are assigned to appears in the calendar app you
            already use, and keeps itself up to date.
          </p>
          <span className="mt-2 inline-flex">
            <Btn id="add-phone" size="sm">
              Add to Apple Calendar
            </Btn>
          </span>
        </div>
      ) : (
        <div data-demo-target="ics-list" className="space-y-2">
          <div className="border-court-200 bg-court-50 live-pop rounded-2xl border px-3 py-2">
            <p className="text-court-800 text-[14px] font-bold">
              Subscribed · {DAY} filled in by itself
            </p>
          </div>
          {GAMES.slice(0, 2).map((g, i) => (
            <div
              key={g.home}
              className="border-ink-200 border-l-4 border-l-court-500 live-row-in rounded-xl border bg-white px-3 py-2"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <p className="text-ink-950 text-[15px] font-extrabold tabular-nums">
                {g.at} – {g.at === "9:00 AM" ? "10:30 AM" : "12:00 PM"}
              </p>
              <p className="text-ink-900 mt-0.5 text-[14px] font-bold leading-snug">
                {ICS_TITLE(g)}
              </p>
              <p className="text-ink-500 mt-0.5 text-[14px] font-medium">{g.where}</p>
            </div>
          ))}
          <p className="text-ink-400 px-1 text-[14px] font-semibold leading-snug">
            and {GAME_COUNT - 2} more that morning, on one personal feed, so his kid&apos;s
            practices and his officiating sit in the same calendar.
          </p>
        </div>
      )}
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
