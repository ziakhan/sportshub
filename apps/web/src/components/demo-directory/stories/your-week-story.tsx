"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { StatusChip } from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Your week", rebuilt 2026-08-16 to the gold standard, and completed
 * 2026-08-19 to the realism standard (mock-ui.tsx R1–R6) on the owner's
 * ruling: EVERY screen to real anatomy, every interaction to its end state.
 * The 08-18 cut converted the agenda and stopped; the game page, venue page,
 * home, payments and signing were still flat placeholder panels. No screen in
 * this file is a placeholder now.
 *
 * ONE LIFE-SIZE HANDSET. `OWNER` the brief: "life-size phone". A single 390
 * logical handset; nothing else is on the stage.
 *
 * THE WEEK IS REAL, EVERY ROW OF IT. `DB` Jordan Reyes has two children at
 * Toronto Lords: Darius (#37, Grade 9) and Danielle (#20, Grade 10 Girls).
 * Their week of 17 to 23 August 2026 in this database is:
 *
 *   Mon 17, 6:00 p.m.  Danielle's practice, The Playground   CANCELLED
 *   Tue 18, 6:30 p.m.  Darius's practice, The Playground
 *   Wed 19, 6:30 p.m.  Danielle's practice, The Playground
 *   Thu 20, 7:00 p.m.  Darius's practice, The Playground
 *   Sat 22, 9:00 a.m.  Oakville Panthers vs Toronto Lords Grade 9, Court 1
 *
 * Not one of those was invented, including the cancelled Monday. Tuesday's
 * practice is the SAME practice the everyone-in-the-loop demo moves.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited):
 *   · the week is `app/(platform)/calendar/my-calendar.tsx` AGENDA view;
 *     the tap-a-row popover is `components/calendar/item-popover.tsx`
 *     (fixed inset-0 bg-black/30, white rounded-2xl p-4 shadow-xl card,
 *     "Open game page →" as the bordered block button, verbatim);
 *   · the game page is `app/(public)/live/[gameId]/components/score-hero.tsx`
 *     in its PRE-GAME phone composition: navy stage gradient, league line
 *     with the gold link, the tipoff strip where LIVE would sit, one
 *     full-width row per team (crest `components/ui/crest.tsx` dark surface
 *     = bg-white/10 ring-white/15, font-condensed 42px tabular score, 0–0
 *     before tip-off), venue as the muted small-caps link. Below it,
 *     `pregame-rosters.tsx` (live-view.tsx:250 renders it pre-game);
 *   · the venue page is `app/(public)/venues/[venueId]/page.tsx`: SmartBack,
 *     font-condensed uppercase h1, address, "Get directions →" in play-600,
 *     the map card, the Courts card with court-500 dots. The map tile and the
 *     maps-app takeover are hand-authored SVG standing in for the Google
 *     embed and the OS maps app — OS chrome, not product UI;
 *   · home is `app/(public)/page.tsx` signed-in: the navy greeting card
 *     ("Your hub" gold eyebrow, "Welcome back"), then
 *     `home-personal-band.tsx`: "Needs your attention" with the payments
 *     card in its REAL gold tone (border-gold-200 bg-gold-50 text-gold-800,
 *     line 41), then the "Your week" white card with day-group headers;
 *   · payments is `app/(platform)/payments/page.tsx`: play-chip eyebrow,
 *     font-condensed "My payments", the open-items line, the "Payment plan"
 *     panel with divide-y rows and Paid/Upcoming badges (STATUS_LABEL);
 *   · the waiver reminder is `lib/waivers/reminders.ts` copy, delivered as
 *     an iOS-style push banner over the payments screen (owner 2026-08-19:
 *     "simulate a notification coming from the top like a real phone");
 *   · signing is `app/(public)/waivers/sign/[token]/page.tsx` + sign-form.tsx:
 *     org eyebrow, title, "For {player} · renews yearly", the ink-50 document
 *     strip, name field, relationship chips, the signature pad
 *     ("Draw with your finger or mouse"), the confirm checkbox, the play-600
 *     "Sign and submit" button, and the REAL success state — court-50 check
 *     circle, "Signed and recorded", the on-file line. The demo does not end
 *     until that success state is on screen.
 *
 * INVENTED-CONTENT LEDGER (everything not read from the DB):
 *   · Darius's two roster-mates and their modest stat lines: the seed names
 *     teammates from its BOY_NAMES/LAST_NAMES pools per reset, so "Kai
 *     Thompson" and "Marcus Osei" are pool names, not fixtures;
 *   · the maps takeover's "12 min drive" — OS chrome, not product data;
 *   · the waiver excerpt paraphrases Rowan's Law requirements in three lines.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const PARENT = "Jordan Reyes"
/** `DB` Player a18c732d, #37, Toronto Lords Grade 9. */
const SON = "Darius"
const SON_TEAM = "Toronto Lords Grade 9"
/** `DB` Player 729b0d07, #20, Toronto Lords Grade 10 Girls. */
const DAUGHTER = "Danielle"
const DAU_TEAM = "Toronto Lords Grade 10 Girls"

const GYM = "The Playground"
/** `DB` Venue c805d634: 952 Century Dr, Burlington. */
const GYM_ADDRESS = "952 Century Dr, Burlington"

/**
 * The week. Every row `DB`. `PRODUCT` the agenda's own shapes: a practice's
 * title is the word "Practice", a game's is "vs {opponent}", and the line
 * under it is `[location, teamName].join(" · ")` with no court on it.
 */
interface Row {
  day: string
  weekday: string
  time: string
  title: string
  where: string
  kind: "practice" | "game"
  who: "son" | "daughter"
  cancelled?: boolean
  id?: string
}
const WEEK: Row[] = [
  {
    day: "17",
    weekday: "Mon",
    time: "6:00 – 7:30 PM",
    title: "Practice",
    where: `${GYM} · ${DAU_TEAM}`,
    kind: "practice",
    who: "daughter",
    cancelled: true,
  },
  {
    day: "18",
    weekday: "Tue",
    time: "6:30 – 8:00 PM",
    title: "Practice",
    where: `${GYM} · ${SON_TEAM}`,
    kind: "practice",
    who: "son",
    id: "row-tue",
  },
  {
    day: "19",
    weekday: "Wed",
    time: "6:30 – 8:00 PM",
    title: "Practice",
    where: `${GYM} · ${DAU_TEAM}`,
    kind: "practice",
    who: "daughter",
  },
  {
    day: "20",
    weekday: "Thu",
    time: "7:00 – 8:30 PM",
    title: "Practice",
    where: `${GYM} · ${SON_TEAM}`,
    kind: "practice",
    who: "son",
  },
  {
    day: "22",
    weekday: "Sat",
    time: "9:00 – 10:30 AM",
    title: "vs Oakville Panthers Grade 9",
    where: `${GYM} · ${SON_TEAM}`,
    kind: "game",
    who: "son",
    id: "row-sat",
  },
]
/** The four the 390 by 508 handset draws; Thursday is counted under them. */
const SHOWN = WEEK.filter((r) => r.weekday !== "Thu")

/** `DB` the Tuesday practice moved by the everyone-in-the-loop demo. */
const MOVED_TIME = "8:00 – 9:30 PM"

/**
 * `DB` PaymentObligation e2f5e46b: $895 for Danielle's summer season, $447.50
 * paid in two real offline payments, $447.50 still open across installments
 * 2/3 and 3/3, 137 days past its 2026-04-01 date.
 */
const PER = 223.75
const OWING = 447.5

/**
 * `DB` WaiverSignRequest ffa1aaa7: the league's Rowan's Law waiver, emailed to
 * this guardian on 17 July for Danielle, expiring 5 October, `consumedAt` NULL.
 * Darius's twin request (a5436e45) was consumed the next day. So one of her two
 * children is signed and one is not, and that is the real state.
 */
const WAIVER = "Concussion Code of Conduct (Rowan's Law)"
const LEAGUE = "NPH Summer League"

/** `PRODUCT` `my-calendar.tsx` page title. */
const CAL_TITLE = "My Calendar"
/** `PRODUCT` `home-personal-band.tsx` lines 39 to 41 and 87 to 89. */
const BAND_HEADING = "Needs your attention"
const BAND_TITLE = "1 payment due"
const BAND_DETAIL = "View and pay"
/** `PRODUCT` `payments/page.tsx` line 68: `${open.length} open items, …`. */
const PAY_HEAD = `2 open items, $${OWING.toFixed(2)} outstanding.`
/** `PRODUCT` `lib/waivers/reminders.ts` lines 164 to 166. */
const WAIVER_TITLE = "Waiver still unsigned"
const WAIVER_MSG = `${LEAGUE}: ${DAUGHTER} can't play until you sign "${WAIVER}". Tap to sign, it takes a minute.`

const money = (n: number) => `$${n.toFixed(2)}`

/** `PRODUCT` score-hero.tsx line 105: the navy stage, lit from above. */
const STAGE_BG = {
  backgroundImage:
    "radial-gradient(120% 150% at 50% -20%, rgba(255,255,255,0.10) 0%, transparent 60%), linear-gradient(135deg, #16233a, #0b1628)",
}

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  /* Human pace (owner 2026-08-19): people click, then click again. Long
     reads only where a balloon earns one. */
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const yourWeekStory: DemoScript = {
  presentation: "scene",
  scenePhones: true,
  desktopUrl: "/calendar",
  initialStage: "desktop",
  chapters: [
    { id: "week", title: "Two kids, one week" },
    { id: "answer", title: "Answer it here" },
    { id: "gym", title: "Where the gym is" },
    { id: "change", title: "Plans change" },
    { id: "owed", title: "Fee and waiver" },
  ],

  beats: [
    /* ── 1. Two kids, one week ────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "week",
      caption: "One phone, two children on two teams, and the week in order.",
      emphasize: "agenda",
      callout: "One list for the household, rather than one calendar per team.",
    }),
    paced({
      id: "lenses",
      chapter: "week",
      caption: "Both children are on the same list, and it says which is which.",
      emphasize: "lenses",
      callout: `A calendar per child per team. Tap ${DAUGHTER}'s off and her half goes quiet.`,
    }),
    paced({
      id: "where",
      chapter: "week",
      caption: "Every line carries the gym and the team.",
      emphasize: "row-tue",
    }),
    paced({
      id: "cancelled",
      chapter: "week",
      caption: "Monday is already cancelled, and it stays on the list struck through.",
      emphasize: "row-cancelled",
      callout: "A row that disappears is a row nobody can check against their memory.",
    }),

    /* ── 2. Answer it here ────────────────────────────────────────────── */
    paced({
      id: "rsvp",
      chapter: "answer",
      caption: "Saturday needs an answer, and it is asked on the row itself.",
      emphasize: "rsvp",
    }),
    paced({
      id: "going",
      chapter: "answer",
      caption: "Going.",
      cursor: "rsvp-going",
      press: true,
      set: { rsvp: "going" },
      callout: "The coach's roll call has her before Saturday.",
    }),
    paced({
      id: "twokids",
      chapter: "answer",
      caption: "When two of her children are on the same event, each gets their own row of buttons.",
      emphasize: "rsvp",
    }),

    /* ── 3. Where the gym is ──────────────────────────────────────────── */
    paced({
      id: "tap",
      chapter: "gym",
      caption: "The street address is not on the row. This is the path to it.",
      cursor: "row-sat",
      press: true,
      set: { view: "popover" },
    }),
    paced({
      id: "gamepage",
      chapter: "gym",
      caption: "From there, the game page.",
      cursor: "open-game",
      press: true,
      set: { view: "game" },
      callout: "The same page goes live when the game starts, so she can watch from here.",
    }),
    paced({
      id: "venue",
      chapter: "gym",
      caption: "The gym name is a link.",
      cursor: "venue-link",
      press: true,
      set: { view: "venue" },
    }),
    paced({
      id: "directions",
      chapter: "gym",
      caption: "Directions, in the maps app she already uses.",
      cursor: "directions",
      press: true,
      set: { directions: true },
      hold: 2600,
    }),

    /* ── 4. Plans change ──────────────────────────────────────────────── */
    paced({
      id: "moved",
      chapter: "change",
      caption: "The coach moves Tuesday's practice to eight.",
      set: { view: "week", moved: true },
      emphasize: "row-tue",
      callout: "The row she already had now says eight. It is the same row.",
    }),
    paced({
      id: "inplace",
      chapter: "change",
      caption: "Nothing was added and nothing vanished.",
      emphasize: "agenda",
      callout: "A subscribed phone calendar gets the same edit, so there is no duplicate.",
    }),
    paced({
      id: "survives",
      chapter: "change",
      caption: "The answer she already gave is still on the game.",
      emphasize: "rsvp",
      callout: "An RSVP is tied to the game rather than to its time, so nobody asks twice.",
    }),

    /* ── 5. Fee and waiver ────────────────────────────────────────────── */
    paced({
      id: "home",
      chapter: "owed",
      caption: "Two things are owed this week. The first is waiting on the home screen.",
      set: { view: "home" },
      emphasize: "band-card",
    }),
    paced({
      id: "pay",
      chapter: "owed",
      caption: "Opening it shows the plan behind the number.",
      cursor: "band-card",
      press: true,
      set: { view: "payments" },
    }),
    paced({
      id: "plan",
      chapter: "owed",
      caption: "Half paid, two installments open. The same page her card pays from.",
      emphasize: "pay-plan",
    }),
    paced({
      id: "waiver-notif",
      chapter: "owed",
      caption: "The second arrives the way phones deliver urgent things.",
      set: { banner: true },
      hold: 2800,
    }),
    paced({
      id: "sign-open",
      chapter: "owed",
      caption: "Tapping it opens the signing page.",
      cursor: "w-open",
      press: true,
      set: { view: "sign", banner: false },
    }),
    paced({
      id: "sign-fill",
      chapter: "owed",
      caption: "Her name, her relationship to Danielle.",
      set: { signFill: true },
    }),
    paced({
      id: "sign-draw",
      chapter: "owed",
      caption: "And a signature, drawn with a finger.",
      set: { signDraw: true },
      hold: 2400,
    }),
    paced({
      id: "submit",
      chapter: "owed",
      caption: "Sign and submit.",
      cursor: "sign-submit",
      press: true,
      set: { signed: true },
    }),
    paced({
      id: "signed",
      chapter: "owed",
      caption: "Recorded, timestamped, on file with the league before the weekend.",
      hold: 3000,
    }),
    paced({
      id: "end",
      chapter: "owed",
      caption:
        "Two children, one week, one screen, an answer that survives a change, and both debts settled where they arrived.",
      hold: 4400,
      set: { view: "week", moved: true, endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get }) => {
    const view = get<string>("view", "week")
    return {
      desktop: (
        <div className="relative flex h-full flex-col">
          <Phone
            view={view}
            rsvp={get<string>("rsvp", "")}
            moved={get("moved", false)}
            directions={get("directions", false)}
            banner={get("banner", false)}
            signFill={get("signFill", false)}
            signDraw={get("signDraw", false)}
            signed={get("signed", false)}
          />
          {get("endCard", false) && <EndCard />}
        </div>
      ),
      frameLabels: { left: `${PARENT} · /calendar`, right: "" },
    }
  },
}

/* ── The handset ─────────────────────────────────────────────────────────── */

function Phone({
  view,
  rsvp,
  moved,
  directions,
  banner,
  signFill,
  signDraw,
  signed,
}: {
  view: string
  rsvp: string
  moved: boolean
  directions: boolean
  banner: boolean
  signFill: boolean
  signDraw: boolean
  signed: boolean
}) {
  return (
    <div className="relative flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2.5 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">{PARENT}</p>
        <p className="text-[14px] font-medium text-white/60">Parent · two players</p>
      </div>

      <div key={view} className="demo-fade-in relative min-h-0 flex-1 overflow-hidden">
        {(view === "week" || view === "popover") && <Week rsvp={rsvp} moved={moved} />}
        {view === "game" && <GamePage />}
        {view === "venue" && <VenuePage />}
        {view === "home" && <HomeScreen />}
        {view === "payments" && <Payments />}
        {view === "sign" && <SignPage fill={signFill} drawn={signDraw} signed={signed} />}
      </div>

      {/* Overlays sit at handset level: the real item popover and the OS maps
          app cover the whole screen (item-popover.tsx is fixed inset-0). */}
      {view === "popover" && <PopoverOverlay rsvp={rsvp} />}
      {view === "venue" && directions && <MapsTakeover />}
      {banner && <PushBanner />}

      <TabBar
        active={view === "home" || view === "payments" || view === "sign" ? "Home" : "Calendar"}
      />
    </div>
  )
}

/** `/calendar` in the agenda view a phone is forced into. */
function Week({ rsvp, moved }: { rsvp: string; moved: boolean }) {
  return (
    <div className="flex h-full flex-col px-3 py-2.5">
      <p className="text-ink-900 shrink-0 text-[17px] font-extrabold">{CAL_TITLE}</p>

      {/* Composition: the agenda's "AUGUST 2026" month header is real and is
          not drawn here. The week is one month long and the handset's 508
          would rather spend those pixels on the Saturday game's RSVP row. */}
      <div data-demo-target="lenses" className="mt-1 flex shrink-0 flex-wrap gap-1">
        <Lens color="var(--brand, #1a73e8)" label={`${SON} · Grade 9`} />
        <Lens color="#e0821e" label={`${DAUGHTER} · Grade 10 Girls`} />
      </div>

      <div data-demo-target="agenda" className="mt-1 min-h-0 flex-1 space-y-1 overflow-hidden">
        {SHOWN.map((r) => (
          <AgendaRow
            key={`${r.day}-${r.title}`}
            row={r}
            time={moved && r.id === "row-tue" ? MOVED_TIME : r.time}
            rsvp={r.id === "row-sat" ? rsvp : ""}
          />
        ))}
        <p className="text-ink-400 px-1 text-[14px] font-semibold">
          and Thursday&apos;s practice, 7:00 PM, same gym
        </p>
      </div>
    </div>
  )
}

function Lens({ color, label }: { color: string; label: string }) {
  return (
    <span className="border-ink-200 text-ink-700 inline-flex items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-[14px] font-semibold">
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function AgendaRow({ row, time, rsvp }: { row: Row; time: string; rsvp: string }) {
  /* `PRODUCT` my-calendar.tsx KIND_CARD/KIND_EDGE + agenda-list.tsx date
     tile, at handset scale. Games carry the energy tint, practices stay
     white, cancelled rows dim exactly like the real agenda. */
  const card = row.kind === "game" ? "bg-energy-soft/60 border-ink-100" : "bg-white border-ink-100"
  const edge = row.kind === "game" ? "var(--energy)" : "var(--brand)"
  const kidDot = row.who === "son" ? "var(--brand, #4f46e5)" : "#e0821e"
  return (
    <div data-demo-target={row.cancelled ? "row-cancelled" : row.id} className="flex items-start gap-2">
      <span className="bg-ink-100/70 text-ink-700 flex h-[42px] w-[42px] shrink-0 flex-col items-center justify-center rounded-xl">
        <span className="text-[18px] font-extrabold leading-none tabular-nums">{row.day}</span>
        <span className="text-ink-400 mt-0.5 text-[9px] font-semibold uppercase leading-none">
          {row.weekday}
        </span>
      </span>
      <div
        className={cn(
          "min-w-0 flex-1 rounded-xl border border-l-4 px-2.5 py-1.5 transition-colors duration-300 motion-reduce:transition-none",
          card,
          row.cancelled && "opacity-60"
        )}
        style={{ borderLeftColor: row.cancelled ? "#c9ced6" : edge }}
      >
        <p className="text-ink-950 text-[14px] font-extrabold leading-tight tabular-nums">
          <span className={cn(row.cancelled && "line-through")}>{time}</span>
          {row.cancelled && (
            <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 align-[1px] text-[9px] font-bold uppercase text-red-600">
              Cancelled
            </span>
          )}
        </p>
        <p
          className={cn(
            "truncate text-[14px] font-bold leading-tight",
            row.cancelled ? "text-ink-400" : "text-ink-900"
          )}
        >
          <span
            aria-hidden="true"
            className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-[2px]"
            style={{ background: kidDot }}
          />
          {row.title}
        </p>
        <p className="text-ink-600 truncate text-[12.5px] leading-tight">{row.where}</p>

        {row.id === "row-sat" && (
          <span
            data-demo-target="rsvp"
            className="border-ink-100 mt-1 flex items-center gap-1.5 border-t pt-1"
          >
            <span className="text-ink-400 shrink-0 text-[12.5px] font-semibold">{SON}</span>
            <span className="flex gap-1">
              <Pill id="rsvp-going" label="✓ Going" on={rsvp === "going"} tone="court" />
              <Pill label="? Maybe" on={false} tone="gold" />
              <Pill label="✕ Can't go" on={false} tone="hoop" />
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

function Pill({
  label,
  on,
  tone,
  id,
}: {
  label: string
  on: boolean
  tone: "court" | "gold" | "hoop"
  id?: string
}) {
  const active =
    tone === "court"
      ? "border-court-600 bg-court-600 text-white"
      : tone === "gold"
        ? "border-gold-500 bg-gold-500 text-white"
        : "border-red-600 bg-red-600 text-white"
  return (
    <span
      data-demo-target={id}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[12.5px] font-semibold",
        on ? active : "border-ink-200 bg-white text-ink-500"
      )}
    >
      {label}
    </span>
  )
}

/** `components/calendar/item-popover.tsx` over the dimmed agenda, verbatim. */
function PopoverOverlay({ rsvp }: { rsvp: string }) {
  const row = WEEK[4]
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="live-pop w-full rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink-900 text-[14px] font-bold">Game — {row.title}</p>
            <p className="text-ink-500 mt-0.5 text-[12px]">
              Sat Aug 22, 9:00 AM · {SON_TEAM} · {GYM}
            </p>
          </div>
          <span aria-hidden="true" className="text-ink-400 -mr-1 -mt-1 px-1 text-lg leading-none">
            ×
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-ink-400 shrink-0 text-[12.5px] font-semibold">{SON}</span>
          <span className="flex gap-1">
            <Pill label="✓ Going" on={rsvp === "going"} tone="court" />
            <Pill label="? Maybe" on={false} tone="gold" />
            <Pill label="✕ Can't go" on={false} tone="hoop" />
          </span>
        </div>
        <div className="mt-3">
          <span
            data-demo-target="open-game"
            className="border-ink-200 text-ink-800 block rounded-xl border px-3 py-2 text-center text-[13.5px] font-bold"
          >
            Open game page →
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── The game page, pre-game ─────────────────────────────────────────────── */

/** `score-hero.tsx` phone rows + `crest.tsx` dark surface. */
function HeroCrest({ mono }: { mono: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[13px] font-bold text-white/80 shadow-lg ring-1 ring-inset ring-white/15">
      {mono}
    </span>
  )
}

function HeroTeamRow({ mono, name }: { mono: string; name: string }) {
  return (
    <div className="flex items-center gap-3">
      <HeroCrest mono={mono} />
      <p className="min-w-0 flex-1 truncate text-[14.5px] font-semibold leading-tight text-white">
        {name}
      </p>
      <p className="font-condensed min-w-[40px] text-right text-[34px] font-semibold leading-none tracking-[-0.01em] text-white tabular-nums">
        0
      </p>
    </div>
  )
}

function RosterRow({ n, name, gp, ppg, rpg }: { n: number; name: string; gp: number; ppg: string; rpg: string }) {
  return (
    <tr className="border-ink-50 border-t">
      <td className="text-ink-900 whitespace-nowrap py-1.5 pl-3 pr-2 text-[13px] font-semibold">
        <span className="text-ink-500 mr-1.5 font-normal tabular-nums">#{n}</span>
        {name}
      </td>
      <td className="text-ink-700 px-1 text-right text-[13px] tabular-nums">{gp}</td>
      <td className="text-ink-700 px-1 text-right text-[13px] tabular-nums">{ppg}</td>
      <td className="text-ink-700 px-1 pr-3 text-right text-[13px] tabular-nums">{rpg}</td>
    </tr>
  )
}

/** `/live/[gameId]` before tip-off: tipoff strip, 0–0, rosters below. */
function GamePage() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-3 pb-3 pt-2.5 text-white" style={STAGE_BG}>
        <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
          <span className="text-gold-400">{LEAGUE}</span> · Summer 2026
        </p>
        <p className="mt-2 text-center text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/55">
          Sat, Aug 22, 9:00 AM
        </p>
        <div className="mt-2 space-y-1.5">
          <HeroTeamRow mono="OP" name="Oakville Panthers Grade 9" />
          <HeroTeamRow mono="TL" name={SON_TEAM} />
        </div>
        <p className="mt-2 text-center text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/55">
          <span data-demo-target="venue-link" className="underline decoration-white/40 underline-offset-2">
            {GYM}
          </span>
          <span> · Court 1</span>
        </p>
      </div>

      {/* `pregame-rosters.tsx`: the panel + stat table the page shows pre-game. */}
      <div className="min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        <section className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
          <div className="border-ink-100 border-b px-3 py-2">
            <h3 className="text-ink-800 text-[10px] font-bold uppercase tracking-[0.18em]">
              {SON_TEAM}
            </h3>
          </div>
          <table className="w-full text-left">
            <thead className="text-ink-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="py-1.5 pl-3 pr-2 font-bold">Player</th>
                <th className="px-1 text-right font-bold">GP</th>
                <th className="px-1 text-right font-bold">PPG</th>
                <th className="px-1 pr-3 text-right font-bold">RPG</th>
              </tr>
            </thead>
            <tbody>
              <RosterRow n={4} name="Kai Thompson" gp={4} ppg="12.3" rpg="3.8" />
              <RosterRow n={23} name="Marcus Osei" gp={4} ppg="10.8" rpg="5.1" />
              <RosterRow n={37} name={`${SON} Reyes`} gp={4} ppg="9.5" rpg="4.2" />
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

/* ── The venue page ──────────────────────────────────────────────────────── */

/** Hand-authored map tile: stands in for the page's Google embed. */
function MapArt({ className, pin = true }: { className?: string; pin?: boolean }) {
  return (
    <svg viewBox="0 0 390 240" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="390" height="240" fill="#e9ecef" />
      <rect x="-10" y="-10" width="150" height="96" rx="10" fill="#dce8d8" />
      <rect x="292" y="152" width="110" height="98" rx="10" fill="#dce8d8" />
      <rect x="188" y="52" width="40" height="26" rx="3" fill="#dcdfe4" />
      <rect x="236" y="58" width="30" height="20" rx="3" fill="#dcdfe4" />
      <rect x="86" y="150" width="44" height="28" rx="3" fill="#dcdfe4" />
      <rect x="210" y="160" width="34" height="24" rx="3" fill="#dcdfe4" />
      <path d="M0 118 H390" stroke="#ffffff" strokeWidth="13" />
      <path d="M0 36 H390" stroke="#ffffff" strokeWidth="6" />
      <path d="M168 0 V240" stroke="#ffffff" strokeWidth="9" />
      <path d="M302 0 V240" stroke="#ffffff" strokeWidth="6" />
      <path d="M58 118 V240" stroke="#ffffff" strokeWidth="6" />
      <text x="12" y="111" fontSize="10.5" fill="#8a919b" fontFamily="ui-sans-serif, system-ui">
        Century Dr
      </text>
      {pin && (
        <g>
          <ellipse cx="195" cy="134" rx="10" ry="3.5" fill="rgba(0,0,0,0.14)" />
          <path
            d="M195 100c-9.4 0-17 7.6-17 17 0 12.4 17 27 17 27s17-14.6 17-27c0-9.4-7.6-17-17-17z"
            fill="#e5493d"
          />
          <circle cx="195" cy="117" r="5.5" fill="#ffffff" />
        </g>
      )}
    </svg>
  )
}

/** `/venues/[venueId]`: back link, condensed h1, address, map, courts. */
function VenuePage() {
  return (
    <div className="h-full overflow-hidden px-3 py-2.5">
      <p className="text-ink-500 text-[12px] font-semibold">← All venues</p>
      <h1 className="font-condensed text-ink-950 mt-1.5 text-[24px] font-bold uppercase leading-none tracking-wide">
        {GYM}
      </h1>
      <p className="text-ink-600 mt-1 text-[13px]">{GYM_ADDRESS}</p>
      <span
        data-demo-target="directions"
        className="text-play-600 mt-1.5 inline-block text-[13.5px] font-semibold"
      >
        Get directions →
      </span>
      <div className="border-ink-100 mt-2 overflow-hidden rounded-2xl border">
        <MapArt className="block h-[136px] w-full" />
      </div>
      <div className="border-ink-100 shadow-soft mt-2.5 rounded-2xl border bg-white p-3">
        <h2 className="text-ink-900 text-[11px] font-semibold uppercase tracking-wide">Courts</h2>
        <ul className="mt-1.5 space-y-1">
          <li className="text-ink-800 flex items-center gap-2 text-[13px]">
            <span className="bg-court-500 h-1.5 w-1.5 rounded-full" />
            Court 1
          </li>
        </ul>
      </div>
    </div>
  )
}

/** The OS maps app taking the screen — chrome, not product UI. */
function MapsTakeover() {
  return (
    <div className="demo-fade-in absolute inset-0 z-20 flex flex-col bg-[#e9ecef]">
      <MapArt className="min-h-0 w-full flex-1" />
      <div className="shrink-0 rounded-t-[18px] bg-white px-4 pb-4 pt-2.5 shadow-[0_-8px_24px_rgba(11,22,40,0.16)]">
        <div className="bg-ink-200 mx-auto h-1 w-9 rounded-full" />
        <p className="text-ink-950 mt-2.5 text-[16px] font-bold">{GYM}</p>
        <p className="text-ink-500 mt-0.5 text-[13px]">{GYM_ADDRESS} · 12 min drive</p>
        <span className="mt-2.5 inline-flex items-center rounded-full bg-[#2f7cf6] px-4 py-2 text-[13.5px] font-bold text-white">
          Directions
        </span>
      </div>
    </div>
  )
}

/* ── Home, signed in ─────────────────────────────────────────────────────── */

function HomeDay({ label }: { label: string }) {
  return (
    <div className="bg-ink-50/60 text-ink-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">
      {label}
    </div>
  )
}

function HomeRow({ time, title, meta }: { time: string; title: string; meta: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <span className="text-ink-950 w-[52px] shrink-0 text-[13px] font-semibold tabular-nums">
        {time}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink-900 block truncate text-[13px] font-medium">{title}</span>
        <span className="text-ink-600 block truncate text-[12px]">{meta}</span>
      </span>
    </div>
  )
}

/** `/` signed in: greeting card, the attention band, the week card. */
function HomeScreen() {
  return (
    <div className="h-full overflow-hidden bg-[#faf8f4] px-3 py-2.5">
      <div className="shadow-soft relative overflow-hidden rounded-[20px] p-4 text-white" style={STAGE_BG}>
        <p className="text-gold-400 text-[9.5px] font-black uppercase tracking-[0.22em]">Your hub</p>
        <h1 className="font-display mt-1 text-[19px] font-black tracking-[-0.02em]">
          Welcome back, Jordan
        </h1>
        <p className="text-ink-200 mt-0.5 text-[12px]">
          Your week, your teams and the scores that matter to you.
        </p>
      </div>

      <p className="text-ink-600 mt-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]">
        {BAND_HEADING}
      </p>
      {/* `home-personal-band.tsx` line 41: payments card, gold tone. */}
      <div
        data-demo-target="band-card"
        className="border-gold-200 bg-gold-50 text-gold-800 mt-1.5 rounded-2xl border p-3.5"
      >
        <p className="text-[13.5px] font-semibold">{BAND_TITLE}</p>
        <p className="mt-0.5 text-[12px] opacity-90">{BAND_DETAIL}</p>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-ink-600 text-[10.5px] font-semibold uppercase tracking-[0.16em]">
          Your week
        </p>
        <span className="text-play-700 text-[11px] font-semibold">Full calendar →</span>
      </div>
      <div className="border-ink-100 divide-ink-50 shadow-soft mt-1.5 divide-y overflow-hidden rounded-2xl border bg-white">
        <HomeDay label="Tomorrow" />
        <HomeRow time="8:00pm" title="Practice" meta={`${SON} · ${SON_TEAM} · ${GYM}`} />
        <HomeDay label="Wednesday, Aug 19" />
        <HomeRow time="6:30pm" title="Practice" meta={`${DAUGHTER} · ${DAU_TEAM} · ${GYM}`} />
        <HomeDay label="Saturday, Aug 22" />
        <HomeRow
          time="9:00am"
          title="vs Oakville Panthers Grade 9"
          meta={`${SON} · ${SON_TEAM} · ${GYM}`}
        />
      </div>
    </div>
  )
}

/* ── Payments ────────────────────────────────────────────────────────────── */

function PayRow({
  label,
  when,
  amount,
  status,
}: {
  label: string
  when: string
  amount: number
  status: "Paid" | "Upcoming"
}) {
  return (
    <li className="flex items-center justify-between gap-2 py-1">
      <div className="min-w-0">
        <p className="text-ink-800 truncate text-[13px] font-medium">{label}</p>
        <p className="text-ink-400 text-[11px]">{when}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-ink-800 text-[13px] font-semibold tabular-nums">{money(amount)}</span>
        <StatusChip tone={status === "Paid" ? "court" : "neutral"}>{status}</StatusChip>
      </div>
    </li>
  )
}

/** `/payments`: eyebrow chip, condensed h1, the plan panel with its rows. */
function Payments() {
  return (
    <div className="h-full space-y-2 overflow-hidden bg-[#faf8f4] px-3 py-2">
      <p className="text-ink-500 text-[12px] font-semibold">← Account</p>
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-3">
        <span className="border-play-100 bg-play-50 text-play-600 inline-flex rounded-full border px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.18em]">
          Payments
        </span>
        <h1 className="font-condensed text-ink-950 mt-1 text-[20px] font-bold uppercase leading-none tracking-wide">
          My payments
        </h1>
        <p className="text-ink-500 mt-1 text-[12px]">{PAY_HEAD}</p>
      </div>

      <div data-demo-target="pay-plan" className="border-ink-100 shadow-soft rounded-2xl border bg-white p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-ink-800 text-[11px] font-bold uppercase tracking-[0.18em]">
            Payment plan
          </h2>
          <span className="text-play-600 text-[11px] font-semibold">Manage cards →</span>
        </div>
        <p className="text-ink-400 text-[10.5px]">
          Summer 2026 season fee · {DAUGHTER} · {DAU_TEAM}
        </p>
        <ul className="divide-ink-100 mt-0.5 divide-y">
          <PayRow label="Deposit" when="Paid at signup" amount={PER} status="Paid" />
          <PayRow label="Installment 1" when="Apr 13, 2026" amount={PER} status="Paid" />
          <PayRow label="Installment 2" when="May 1, 2026" amount={PER} status="Upcoming" />
          <PayRow label="Installment 3" when="Jun 1, 2026" amount={PER} status="Upcoming" />
        </ul>
        <p className="text-ink-400 mt-1 text-[10px] leading-snug">
          Scheduled payments charge automatically to your default card.
        </p>
      </div>
    </div>
  )
}

/* ── The push, the signing, the receipt ──────────────────────────────────── */

/** The APPROVED app icon (public/brand/icon-n3.svg), inlined verbatim —
 *  never a redrawn stand-in (owner 2026-08-19). */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="yw-app-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e2d4d" />
          <stop offset="1" stopColor="#0b1628" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#yw-app-bg)" />
      <text
        x="29"
        y="47"
        fontFamily="-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
        fontWeight="800"
        fontSize="40"
        fill="#ffffff"
        textAnchor="middle"
      >
        S
      </text>
      <rect x="41" y="7" width="17" height="17" rx="4" fill="#f24e1e" />
      <text
        x="49.5"
        y="20.5"
        fontFamily="-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
        fontWeight="800"
        fontSize="13"
        fill="#ffffff"
        textAnchor="middle"
      >
        1
      </text>
    </svg>
  )
}

/** An iOS-style push dropping from the top of the handset. */
function PushBanner() {
  return (
    <div data-demo-target="w-notif" className="demo-banner-in absolute left-1.5 right-1.5 top-1.5 z-30">
      <div
        data-demo-target="w-open"
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
            <p className="text-ink-950 text-[13px] font-semibold leading-tight">{WAIVER_TITLE}</p>
            <p className="text-ink-600 line-clamp-2 text-[12px] leading-snug">{WAIVER_MSG}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** `/waivers/sign/[token]` + sign-form.tsx, through to its success state. */
function SignPage({ fill, drawn, signed }: { fill: boolean; drawn: boolean; signed: boolean }) {
  if (signed) {
    /* sign-form.tsx lines 60 to 84, the real "done" render. */
    return (
      <div className="flex h-full items-center bg-[#faf8f4] px-3 py-2.5">
        <div className="border-ink-100 w-full rounded-[20px] border bg-white p-6 text-center shadow-xl">
          <div className="bg-court-50 text-court-600 live-pop mx-auto grid h-14 w-14 place-items-center rounded-2xl">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-ink-950 mt-3 text-[17px] font-bold">Signed and recorded</h2>
          <p className="text-ink-600 mt-2 text-[13px] leading-relaxed">
            Thank you. {LEAGUE} now has your signed copy on file for {DAUGHTER}. You can close this
            page.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full overflow-hidden bg-[#faf8f4] px-3 py-2">
      <div className="border-ink-100 overflow-hidden rounded-[20px] border bg-white shadow-xl">
        <div className="border-ink-100 border-b px-3.5 py-2">
          <p className="text-play-600 text-[9.5px] font-bold uppercase tracking-[2px]">{LEAGUE}</p>
          <h1 className="text-ink-950 mt-0.5 text-[15px] font-bold leading-tight">{WAIVER}</h1>
          <p className="text-ink-500 mt-0.5 text-[11.5px]">
            For <span className="text-ink-700 font-semibold">{DAUGHTER} Reyes</span> · renews yearly
          </p>
        </div>
        <div className="border-ink-100 bg-ink-50 border-b px-3.5 py-1.5">
          <p className="text-ink-700 line-clamp-2 text-[11px] leading-relaxed">
            Rowan&apos;s Law requires every athlete and a parent or guardian to review Ontario&apos;s
            concussion awareness resources and this league&apos;s Concussion Code of Conduct before
            play. By signing, you confirm you have reviewed both with your athlete…
          </p>
        </div>
        <div className="space-y-1.5 px-3.5 py-2">
          <div>
            <p className="text-ink-700 text-[11.5px] font-semibold">Your full name</p>
            <div
              className={cn(
                "border-ink-200 mt-0.5 rounded-xl border px-2.5 py-1 text-[13px]",
                fill ? "text-ink-950" : "text-ink-400"
              )}
            >
              {fill ? PARENT : "First and last name"}
            </div>
          </div>
          <div>
            <p className="text-ink-700 text-[11.5px] font-semibold">Relationship to player</p>
            <div className="mt-0.5 flex gap-1.5">
              {["Parent", "Guardian", "Other"].map((r) => (
                <span
                  key={r}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold",
                    fill && r === "Parent"
                      ? "border-play-500 bg-play-50 text-play-700"
                      : "border-ink-200 bg-white text-ink-500"
                  )}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-ink-700 text-[11.5px] font-semibold">Signature</p>
              <p className="text-ink-400 text-[9.5px]">Draw with your finger or mouse</p>
            </div>
            <div className="border-ink-200 mt-0.5 h-[46px] overflow-hidden rounded-xl border bg-white">
              {drawn && (
                <svg viewBox="0 0 300 54" className="h-full w-full" aria-hidden="true">
                  <path
                    className="demo-sign-draw"
                    d="M22 40 C30 16 40 12 42 24 C44 36 36 42 50 34 C64 26 60 18 74 28 C82 34 92 22 100 30 C112 42 118 18 132 28 C140 34 150 26 162 32 C180 40 196 24 214 32 C230 38 246 28 262 34"
                    fill="none"
                    stroke="#1b2a4a"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          </div>
          <div className="text-ink-700 flex items-start gap-2 text-[10.5px] leading-snug">
            <span
              className={cn(
                "mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded border text-[9px] font-bold",
                drawn ? "border-play-600 bg-play-600 text-white" : "border-ink-300 bg-white"
              )}
            >
              {drawn ? "✓" : ""}
            </span>
            <p>
              I have read and understood this document, and I confirm that I am authorized to sign
              it for {DAUGHTER}.
            </p>
          </div>
          <span
            data-demo-target="sign-submit"
            className={cn(
              "block w-full rounded-xl bg-play-600 px-4 py-2 text-center text-[13px] font-bold text-white",
              !drawn && "opacity-40"
            )}
          >
            Sign and submit
          </span>
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

function EndCard(): ReactNode {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1628] px-8 text-white">
      <div className="live-pop max-w-[340px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A parent chapter
        </p>
        <h3 className="font-display mt-2 text-[26px] font-extrabold leading-tight">Your week</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          A real week for two real children: four practices, one already cancelled, a Saturday game
          answered in one tap, an address three taps away, a practice that moved without asking her
          twice, and a waiver signed before the weekend.
        </p>
        <p className="mt-4 text-[14px] font-semibold text-white/50">Next: claim your club</p>
      </div>
    </div>
  )
}
