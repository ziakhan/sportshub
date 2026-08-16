"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Btn, StatusChip } from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Your week", rebuilt 2026-08-16 to the gold standard set by the season
 * story, the schedule-change demo, the waivers demo, game day, the referees
 * demo, the roster story, the money picture and the loop story.
 *
 * ONE LIFE-SIZE HANDSET. `OWNER` the brief: "life-size phone". So the stage is
 * a single 390 logical handset at scale 1.0 on a computer, and the whole
 * handset inside the viewport on a phone. Nothing else is on the stage,
 * because nothing else is in this story.
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
 * Not one of those was invented, including the cancelled Monday. And Tuesday's
 * practice is the SAME practice the everyone-in-the-loop demo moves, which is
 * why the change chapter here shows it arriving on her phone: the two demos
 * are two ends of one event.
 *
 * THE INVENTED PLACEMENT IS PUNCHED, NOT STAGED. The 2026-08-15 cut put a fee
 * installment and an unsigned waiver INSIDE the week list, as rows between the
 * practices. That placement was flagged to the owner and never ruled, and the
 * product does not do it: `MyCalendarItem` has no waiver or fee field, and
 * `my-contexts.ts`'s `actionsDue` (offers, payments, RSVPs, chats, referee
 * offers) has no waiver field at all. So this cut stages the REAL surfaces a
 * fee and a waiver reach a guardian on. Punch 1 in
 * `docs/roadmap/your-week-numbers.md`.
 *
 * NO CONFESSIONS ON CAMERA (sweep, 2026-08-16). The 08-16 cut ended the last
 * chapter on a `punch` beat that told the viewer, in a balloon, that neither
 * the fee nor the waiver is in the week list and that putting them there is a
 * change the product has not made. It also called the three taps to a map
 * "further away than it should be", and five mock panels carried a narrator's
 * line rather than product copy. All of it is gone. What the product does is
 * shown; what it does not do stays in this file and the numbers sheet, which is
 * where the product backlog reads it.
 *
 * TWO MORE THINGS THE PREVIOUS CUT INVENTED AND THIS ONE DOES NOT:
 *   · a gold "Moved" badge and an amber pulse on a changed row. The real
 *     agenda just re-renders the same row with the new time on its next poll.
 *   · "Get directions" on the RSVP sheet. Directions live on the VENUE page,
 *     which is three taps from the row, and the demo walks those three taps
 *     instead of pretending there is one.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN:
 *   · the week is `app/(platform)/calendar/my-calendar.tsx` in its AGENDA
 *     view, which a phone is forced into, with `components/calendar/agenda-list.tsx`
 *     drawing the month header and the date rail;
 *   · the RSVP pills are `components/calendar/rsvp-control.tsx`, verbatim;
 *   · the venue page and its directions link are `app/(public)/venues/[venueId]/page.tsx`;
 *   · the fee card is `app/(public)/home-personal-band.tsx`, "Needs your attention";
 *   · the plan is `app/(platform)/payments/page.tsx`, "Payment plan";
 *   · the waiver notification is `lib/waivers/reminders.ts` and the signing
 *     page is `app/(public)/waivers/sign/[token]/page.tsx`.
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

/**
 * `PRODUCT` `my-calendar.tsx` lines 47 to 51. The page's subtitle, "Every game,
 * practice and event across all your teams · answer Going or Can't go right
 * here", is real and is NOT drawn: at 390 it takes three lines of the handset's
 * 508, and the demo would rather spend them on the week itself.
 */
const CAL_TITLE = "My Calendar"
/** `PRODUCT` `home-personal-band.tsx` lines 36 to 42 and 87 to 89. */
const BAND_HEADING = "Needs your attention"
const BAND_TITLE = "1 payment due"
const BAND_DETAIL = "View and pay"
/** `PRODUCT` `payments/page.tsx` lines 66 to 69 and 72 to 115. */
const PAY_HEAD = `1 open item · $${OWING.toFixed(2)} outstanding.`
/** `PRODUCT` `lib/waivers/reminders.ts` lines 164 to 166. */
const WAIVER_TITLE = "Waiver still unsigned"
const WAIVER_MSG = `${LEAGUE}: ${DAUGHTER} can't play until you sign "${WAIVER}". Tap to sign, it takes a minute.`

const money = (n: number) => `$${n.toFixed(2)}`

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 500
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 180 + 900 : 2400
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
      callout: "The gym is on the row because it changes more often than the time.",
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
      callout: "Three buttons on the row, so answering costs no navigation.",
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
      callout: "The answer is per child, so one press cannot cover both.",
    }),

    /* ── 3. Where the gym is ──────────────────────────────────────────── */
    paced({
      id: "tap",
      chapter: "gym",
      caption: "The street address is not on the row. This is the path to it.",
      cursor: "row-sat",
      press: true,
      set: { view: "popover" },
      callout: "Tapping a row opens its details rather than jumping straight out of the week.",
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
      callout: "The venue page is where the street address lives.",
    }),
    paced({
      id: "directions",
      chapter: "gym",
      caption: "Directions, in the maps app she already uses.",
      cursor: "directions",
      press: true,
      set: { directions: true },
      callout: "Three taps from the week to the map, and every one of them exists today.",
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
      caption: "Two things are owed this week, and both arrive on their own surface.",
      set: { view: "home" },
      emphasize: "band",
      callout: "The fee is a card on her home screen, counted rather than itemised.",
    }),
    paced({
      id: "pay",
      chapter: "owed",
      caption: "Opening it shows the plan behind the number.",
      cursor: "band-card",
      press: true,
      set: { view: "payments" },
      callout: `The deposit and the first installment are in. Two of ${money(PER)} are not.`,
    }),
    paced({
      id: "waiver-notif",
      chapter: "owed",
      caption: "The waiver arrives as a push of its own.",
      set: { view: "waiver" },
      emphasize: "w-notif",
      callout: `It names ${DAUGHTER}, names the document, and says she cannot play until it is signed.`,
    }),
    paced({
      id: "sign",
      chapter: "owed",
      caption: "Signing it is a minute on the same phone.",
      cursor: "w-open",
      press: true,
      set: { view: "sign" },
      callout: "The link opens the document itself. No app to install, no password to find.",
    }),
    paced({
      id: "end",
      chapter: "owed",
      caption:
        "Two children, one week, one screen, an answer that survives a change, and the two things she owes on the surfaces they arrive on.",
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
}: {
  view: string
  rsvp: string
  moved: boolean
  directions: boolean
}) {
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2.5 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">{PARENT}</p>
        <p className="text-[14px] font-medium text-white/60">Parent · two players</p>
      </div>

      <div key={view} className="demo-fade-in min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        {view === "week" && <Week rsvp={rsvp} moved={moved} />}
        {view === "popover" && <Popover />}
        {view === "game" && <GamePage />}
        {view === "venue" && <VenuePage directions={directions} />}
        {view === "home" && <HomeBand />}
        {view === "payments" && <Payments />}
        {view === "waiver" && <WaiverNotice />}
        {view === "sign" && <SignPage />}
      </div>

      <TabBar
        active={
          view === "home" ? "Home" : view === "payments" || view === "sign" ? "Home" : "Calendar"
        }
      />
    </div>
  )
}

/** `/calendar` in the agenda view a phone is forced into. */
function Week({ rsvp, moved }: { rsvp: string; moved: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <p className="text-ink-900 shrink-0 text-[17px] font-extrabold">{CAL_TITLE}</p>

      {/* Composition: the agenda's "AUGUST 2026" month header is real and is
          not drawn here. The week is one month long and the handset's 508
          would rather spend those pixels on the Saturday game's RSVP row.
          Declared in section H of the numbers sheet. */}
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
  const edge = row.kind === "game" ? "#e0821e" : "var(--brand, #1a73e8)"
  return (
    <div
      data-demo-target={row.cancelled ? "row-cancelled" : row.id}
      className={cn(
        "flex gap-2 rounded-xl border bg-white px-2 py-0.5 transition-colors duration-300 motion-reduce:transition-none",
        row.cancelled ? "border-ink-200" : "border-ink-200"
      )}
      style={{ borderLeft: `4px solid ${row.cancelled ? "#c9ced6" : edge}` }}
    >
      <span className="w-[34px] shrink-0 text-center">
        <span className="text-ink-900 block text-[17px] font-extrabold leading-none tabular-nums">
          {row.day}
        </span>
        <span className="text-ink-400 block text-[14px] font-bold uppercase leading-tight">
          {row.weekday}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-[14px] font-bold leading-tight tabular-nums",
              row.cancelled ? "text-ink-400 line-through" : "text-ink-700"
            )}
          >
            {time}
          </span>
          {row.cancelled && <StatusChip tone="hoop">Cancelled</StatusChip>}
        </span>
        <span
          className={cn(
            "block truncate text-[15px] font-bold leading-tight",
            row.cancelled ? "text-ink-400 line-through" : "text-ink-900"
          )}
        >
          {row.title}
        </span>
        <span className="text-ink-500 block truncate text-[14px] font-medium leading-tight">
          {row.where}
        </span>

        {row.id === "row-sat" && (
          <span
            data-demo-target="rsvp"
            className="border-ink-100 mt-0.5 flex items-center gap-1.5 border-t pt-0.5"
          >
            <span className="text-ink-400 shrink-0 text-[14px] font-semibold">{SON}</span>
            <span className="flex gap-1">
              <Pill id="rsvp-going" label="✓ Going" on={rsvp === "going"} tone="court" />
              <Pill label="? Maybe" on={false} tone="gold" />
              <Pill label="✕ Can't go" on={false} tone="hoop" />
            </span>
          </span>
        )}
      </span>
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
        ? "border-amber-500 bg-amber-500 text-white"
        : "border-red-600 bg-red-600 text-white"
  return (
    <span
      data-demo-target={id}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[14px] font-bold",
        on ? active : "border-ink-300 text-ink-600 bg-white"
      )}
    >
      {label}
    </span>
  )
}

/** `my-calendar.tsx`'s item popover. */
function Popover() {
  const row = WEEK[4]
  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold leading-tight">
        Game · {row.title}
      </p>
      <div className="border-ink-200 rounded-2xl border bg-white px-3 py-2.5">
        <p className="text-ink-900 text-[15px] font-bold tabular-nums">
          Sat, Aug 22 · {row.time}
        </p>
        <p className="text-ink-500 mt-0.5 text-[14px] font-medium">{row.where}</p>
        <p className="text-ink-400 mt-1.5 text-[14px] font-semibold">{SON} · Going</p>
        <span data-demo-target="open-game" className="text-play-700 mt-2 block text-[15px] font-bold">
          Open game page →
        </span>
      </div>
    </div>
  )
}

/** `/live/[gameId]`, the public game page. */
function GamePage() {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-[#0b1628] px-3 py-3 text-white">
        <p className="text-[14px] font-bold uppercase tracking-[0.1em] text-white/60">
          {LEAGUE} · Sat, Aug 22
        </p>
        <p className="mt-1 text-[17px] font-extrabold leading-tight">Oakville Panthers Grade 9</p>
        <p className="text-[17px] font-extrabold leading-tight">{SON_TEAM}</p>
        <p className="mt-1.5 text-[14px] font-semibold text-white/70">9:00 AM</p>
        <p className="mt-1.5 text-[15px] font-bold">
          <span data-demo-target="venue-link" className="text-gold-400 underline">
            {GYM}
          </span>
          <span className="text-white/60"> · Court 1</span>
        </p>
      </div>
    </div>
  )
}

/** `/venues/[venueId]`. */
function VenuePage({ directions }: { directions: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold">{GYM}</p>
      <div className="border-ink-200 rounded-2xl border bg-white px-3 py-2.5">
        <p className="text-ink-800 text-[15px] font-semibold">{GYM_ADDRESS}</p>
        <span data-demo-target="directions" className="text-play-700 mt-2 block text-[15px] font-bold">
          Get directions →
        </span>
      </div>
      {directions && (
        <div className="border-court-200 bg-court-50 live-pop rounded-2xl border px-3 py-2.5">
          <p className="text-court-800 text-[15px] font-bold">Maps</p>
          <p className="text-court-700 mt-0.5 text-[14px] font-semibold leading-snug">
            {GYM_ADDRESS}
          </p>
        </div>
      )}
    </div>
  )
}

/** `/`, the signed-in home band. */
function HomeBand() {
  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold">Home</p>
      <p data-demo-target="band" className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.08em]">
        {BAND_HEADING}
      </p>
      <div
        data-demo-target="band-card"
        className="border-hoop-300 bg-hoop-50/60 rounded-2xl border px-3 py-2.5"
      >
        <p className="text-hoop-800 text-[17px] font-extrabold">{BAND_TITLE}</p>
        <p className="text-hoop-700 mt-0.5 text-[15px] font-bold">{BAND_DETAIL}</p>
      </div>
    </div>
  )
}

/** `/payments`, "My payments". */
function Payments() {
  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold">My payments</p>
      <p className="text-ink-600 text-[15px] font-semibold">{PAY_HEAD}</p>
      <p className="text-ink-400 text-[14px] font-bold uppercase tracking-[0.08em]">Payment plan</p>
      <div className="space-y-1">
        <PayRow label="Deposit" when="Paid at signup" amount={PER} status="Paid" />
        <PayRow label="Installment 1" when="Apr 13" amount={PER} status="Paid" />
        <PayRow label="Installment 2" when="May 1" amount={PER} status="Upcoming" />
        <PayRow label="Installment 3" when="Jun 1" amount={PER} status="Upcoming" />
      </div>
      <p className="text-ink-500 text-[14px] font-medium leading-snug">
        Summer 2026 season fee · {DAU_TEAM}
      </p>
    </div>
  )
}

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
  const paid = status === "Paid"
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-white px-2.5 py-1.5",
        paid ? "border-court-200 bg-court-50/50" : "border-ink-200"
      )}
    >
      <span className="min-w-0">
        <span className="text-ink-900 block text-[15px] font-bold">{label}</span>
        <span className="text-ink-500 block text-[14px] font-medium">{when}</span>
      </span>
      <span className="text-ink-900 ml-auto shrink-0 text-[15px] font-bold tabular-nums">
        {money(amount)}
      </span>
      <StatusChip tone={paid ? "court" : "neutral"}>{status}</StatusChip>
    </div>
  )
}

/** The waiver reminder, `lib/waivers/reminders.ts`. */
function WaiverNotice() {
  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold">Notifications</p>
      <div
        data-demo-target="w-notif"
        className="border-hoop-300 live-pop rounded-2xl border bg-white px-3 py-2.5"
      >
        <p className="text-hoop-800 text-[15px] font-bold">{WAIVER_TITLE}</p>
        <p className="text-ink-700 mt-1 text-[14px] font-medium leading-snug">{WAIVER_MSG}</p>
        <span data-demo-target="w-open" className="text-play-700 mt-2 block text-[15px] font-bold">
          Tap to sign →
        </span>
      </div>
    </div>
  )
}

/** `/waivers/sign/[token]`, a public token page. */
function SignPage() {
  return (
    <div className="space-y-2">
      <p className="text-ink-400 text-[14px] font-bold uppercase tracking-[0.1em]">{LEAGUE}</p>
      <p className="text-ink-900 text-[17px] font-extrabold leading-tight">{WAIVER}</p>
      <div className="border-ink-200 rounded-2xl border bg-white px-3 py-2.5">
        <p className="text-ink-600 text-[14px] font-medium leading-snug">
          Required · renews every year · version 1
        </p>
        <p className="text-ink-800 mt-1.5 text-[14px] font-medium leading-snug">
          I acknowledge that I have reviewed the concussion code of conduct with {DAUGHTER}.
        </p>
        <div className="border-ink-300 mt-2 h-[54px] rounded-xl border border-dashed bg-white" />
        <p className="text-ink-400 mt-1 text-[14px] font-medium">Sign with your finger</p>
      </div>
      <Btn tone="court" size="sm">
        Sign and finish
      </Btn>
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
          A real week for two real children: four practices, one of them already cancelled, a
          Saturday game answered in one tap, an address three taps away, and a practice that moved
          without asking her the same question twice.
        </p>
        <p className="mt-4 text-[14px] font-semibold text-white/50">Next: claim your club</p>
      </div>
    </div>
  )
}
