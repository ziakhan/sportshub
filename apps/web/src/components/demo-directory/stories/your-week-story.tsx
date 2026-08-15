"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import {
  PhoneAction,
  PhoneCardRow,
  PhoneMoneyRow,
  PhonePushBanner,
  PhoneSheet,
  PhoneShell,
  PhoneSuccess,
} from "../mock-ui"
import type { DemoScript } from "../types"

/**
 * Chapter 6: "Your week" (owner-signed script, 2026-08-15).
 *
 * THE ARGUMENT. A parent with two kids on two teams is running two schedules
 * out of two group chats, and the question they ask on a Tuesday morning is
 * small and constant: what is happening this week, where is it, and is there
 * anything I owe. This chapter answers all three on one screen and then breaks
 * the week on purpose, because the honest version of a family calendar is not
 * the one where nothing changes.
 *
 * THE PAINFUL DETAIL (owner's law, named for this chapter): WHEN THE GYM
 * MOVES, THE ANSWER SHE ALREADY GAVE HAS TO SURVIVE IT. Anybody can redraw a
 * row. The reason a family stops trusting a calendar is being asked the same
 * question twice, so the change lands ON the row she already answered, the row
 * pulses where it changed, and her Going stays exactly where she put it.
 *
 * TRUTH TO THE PRODUCT. Every surface mirrors one that ships today:
 *   · the screen — app/(platform)/calendar/page.tsx and my-calendar.tsx: the
 *     "My Calendar" header, one lens chip per kid labelled "First · Team" from
 *     lib/calendar/my-calendar.ts, the Agenda and Grid switch (a phone is
 *     forced to Agenda, which is why this one never offers it), and the "Add
 *     to phone" subscription button;
 *   · the agenda — components/calendar/agenda-list.tsx: the sticky uppercase
 *     month header, the date tile with the day number over the weekday, today
 *     filled in brand colour, and the day's items stacked beside it;
 *   · the item cards — my-calendar.tsx KIND_CARD and KIND_EDGE: a game is
 *     energy-soft with an orange left edge, a practice is white with an indigo
 *     edge, an event is highlight-soft with a gold one. Titles are the
 *     product's own: a practice is "Practice", a game is "vs {opponent}", and
 *     the meta line is "location · team";
 *   · the RSVP — components/calendar/rsvp-control.tsx: three pills, "✓ Going"
 *     in court green, "? Maybe" in amber, "✕ Can't go" in red, one row per kid
 *     with the kid's first name beside it because there is more than one;
 *   · the directions — the venue page's "Get directions →", which is a
 *     maps.google.com query built from the venue's coordinates;
 *   · the notification — api/games/[id]/route.ts: type "game_rescheduled",
 *     title "Game Rescheduled", and the message written exactly as the product
 *     writes it, matchup then new time then gym then court.
 *
 * ONE HONEST NOTE. The fee and the waiver sitting inside the week are the one
 * thing here that the product does not surface on the calendar yet: today they
 * arrive as their own email and their own push. The owner's brief puts them in
 * the week because that is where a parent is when they can act on them, and
 * they are drawn in the product's own badge language rather than a new one.
 *
 * MOTION. Nothing pans, zooms or scrolls: the phone is the only frame, and it
 * holds the whole week at once. The sheet rises from the bottom edge the way
 * the product's own sheets do, the changed row pulses amber in place, and the
 * two outstanding cards go green where they stand.
 */

/* ── Cast ────────────────────────────────────────────────────────────────── */

const PARENT = "Bello family"
const AMARA = "Amara · U11 Girls Rep"
const NOAH = "Noah · U13 Boys Rep"

const GYM_OLD = "Riverside CC, Court 2"
const GYM_NEW = "Northside HS, Court 1"
const OPPONENT = "Lakeshore Lightning"

export const yourWeekStory: DemoScript = {
  desktopUrl: "/calendar",
  initialStage: "phone",
  soloPhone: true,
  chapters: [
    { id: "two", title: "Two kids, one calendar" },
    { id: "rsvp", title: "RSVP and directions" },
    { id: "change", title: "Plans change, calmly" },
  ],

  beats: [
    /* ── 1. Two kids, one calendar ────────────────────────────────────── */
    {
      id: "open",
      chapter: "two",
      caption:
        "Tuesday, ten past eight. Two kids, two teams, two coaches, and one screen that already knows all of it.",
      hold: 3200,
      stage: "phone",
      set: { screen: "week" },
    },
    {
      id: "lenses",
      chapter: "two",
      caption:
        "Each kid is their own calendar, named and coloured, and either one can be switched off when you only want to look at one of them.",
      hold: 3000,
      cursor: "lens-noah",
      hover: "lens-noah",
    },
    {
      id: "week",
      chapter: "two",
      caption:
        "Practice tonight, Noah's practice tomorrow, a game Saturday. Every line carries the gym, because the gym is the thing families get wrong.",
      hold: 3200,
    },
    {
      id: "subscribe",
      chapter: "two",
      caption:
        "It can also live in the phone's own calendar app, subscribed, so it keeps up on its own without anybody re-adding anything.",
      hold: 2800,
      cursor: "add-to-phone",
      hover: "add-to-phone",
    },

    /* ── 2. RSVP and directions ───────────────────────────────────────── */
    {
      id: "tap-game",
      chapter: "rsvp",
      caption: "Saturday is the one she has to answer.",
      hold: 2200,
      cursor: "row-sat",
      press: true,
    },
    {
      id: "sheet",
      chapter: "rsvp",
      caption:
        "Opening it gives the whole thing: the matchup, the time, how long it runs, the gym and the court.",
      hold: 2800,
      set: { sheet: "game" },
    },
    {
      id: "going",
      chapter: "rsvp",
      caption: "Going, Maybe, or Can't go. One tap.",
      hold: 2600,
      cursor: "rsvp-going",
      press: true,
      set: { rsvp: "GOING" },
      toast: "Amara is going",
    },
    {
      id: "per-kid",
      chapter: "rsvp",
      caption:
        "And because there are two kids in this house, the answer has a name on it. Nobody has to work out which child was just marked in.",
      hold: 2800,
    },
    {
      id: "directions-press",
      chapter: "rsvp",
      caption: "The gym she has never driven to is one tap from directions.",
      hold: 2400,
      cursor: "directions",
      press: true,
    },
    {
      id: "maps",
      chapter: "rsvp",
      caption:
        "Address, court and the map handoff, from the row itself. No screenshot of a message from August.",
      hold: 2800,
      set: { sheet: "maps" },
    },

    /* ── 3. Plans change, calmly ──────────────────────────────────────── */
    {
      id: "push",
      chapter: "change",
      caption: "Then Thursday happens, the way it always does.",
      hold: 3000,
      set: { sheet: "", push: true },
    },
    {
      id: "row-moves",
      chapter: "change",
      caption:
        "The row she already looked at changes where it stands. Same game, new gym, and the line that moved is the line that flashes.",
      hold: 3400,
      set: { push: false, moved: true },
    },
    {
      id: "rsvp-holds",
      chapter: "change",
      caption:
        "Her answer rides along. She is not asked a second time whether Amara is playing, because she already said so and a building changing is not her problem to re-solve.",
      hold: 3400,
    },
    {
      id: "fee-press",
      chapter: "change",
      caption:
        "The other two things in this week are the ones that usually arrive as email nobody opens.",
      hold: 2600,
      cursor: "fee-pay",
      press: true,
    },
    {
      id: "fee-sheet",
      chapter: "change",
      caption:
        "The installment is written out before anything is charged: which one it is, what is left, and the card already on file.",
      hold: 3000,
      set: { sheet: "fee" },
    },
    {
      id: "fee-paid",
      chapter: "change",
      caption: "Paid, from the week, in about four seconds.",
      hold: 2400,
      cursor: "fee-confirm",
      press: true,
    },
    {
      id: "fee-receipt",
      chapter: "change",
      caption:
        "The receipt is the confirmation: what was charged, what is left on the plan, and when the next one goes.",
      hold: 2800,
      set: { feePaid: true },
      toast: "Paid $85.00",
    },
    {
      id: "waiver-press",
      chapter: "change",
      caption: "The row it came from is green, and the last thing in the week is the one document Noah cannot play without.",
      hold: 2800,
      cursor: "waiver-sign",
      press: true,
      set: { sheet: "" },
    },
    {
      id: "waiver-signed",
      chapter: "change",
      caption:
        "Signed on the same screen, recorded against the season, and off the list.",
      hold: 2800,
      set: { waiverSigned: true },
      toast: "Signed and recorded",
    },
    {
      id: "clear",
      chapter: "change",
      caption:
        "Tuesday morning to Thursday night: two kids, one gym change, a fee and a waiver, and nothing left owing anybody.",
      hold: 3800,
    },
    {
      id: "end-card",
      chapter: "change",
      caption: "The week, answered.",
      hold: 3800,
      set: { endCard: true },
    },
  ],

  render: ({ get }) => {
    const sheet = get<string>("sheet", "")
    const rsvp = get<string>("rsvp", "")
    const moved = get("moved", false)
    const feePaid = get("feePaid", false)
    const waiverSigned = get("waiverSigned", false)
    const endCard = get("endCard", false)

    const phone = (
      <div className="relative h-full">
        <PhoneShell title="My Calendar" subtitle={PARENT} activeTab="Calendar">
          <WeekScreen
            rsvp={rsvp}
            moved={moved}
            feePaid={feePaid}
            waiverSigned={waiverSigned}
          />
        </PhoneShell>

        <PhoneSheet
          open={sheet === "game"}
          title={`Game · Ravens vs ${OPPONENT}`}
          subtitle={`Sat Oct 18, 9:00 AM · 90 min · ${moved ? GYM_NEW : GYM_OLD}`}
        >
          <GameSheet rsvp={rsvp} />
        </PhoneSheet>

        <PhoneSheet open={sheet === "maps"} title={moved ? "Northside HS" : "Riverside CC"} subtitle="Court 2 · 12 min away">
          <MapsSheet />
        </PhoneSheet>

        <PhoneSheet open={sheet === "fee"} title="Fall 2026 season fee" subtitle="Amara Bello · U11 Girls Rep">
          <FeeSheet paid={feePaid} />
        </PhoneSheet>

        {get("push", false) && (
          <PhonePushBanner
            title="Game Rescheduled"
            body={`Riverside Ravens vs ${OPPONENT} has moved to Sat Oct 18, 9:00 AM at Northside HS (Court 1).`}
          />
        )}

        {endCard && <PhoneEndCard />}
      </div>
    )

    /* Phone-only: the stage drops the browser window entirely rather than
       parking a dimmed empty one beside the handset. */
    return { desktop: null, phone }
  },
}

/* ── The week ─────────────────────────────────────────────────────────────── */

function WeekScreen({
  rsvp,
  moved,
  feePaid,
  waiverSigned,
}: {
  rsvp: string
  moved: boolean
  feePaid: boolean
  waiverSigned: boolean
}) {
  const handled = feePaid && waiverSigned
  return (
    <div className="flex h-full flex-col">
      {/* Lens chips: one calendar per kid, exactly as the product labels them. */}
      <div className="flex shrink-0 items-center gap-1">
        <LensChip id="lens-amara" label={AMARA} dot="bg-play-500" />
        <LensChip id="lens-noah" label={NOAH} dot="bg-court-500" />
      </div>

      <div className="mt-2 flex shrink-0 items-center gap-2">
        <p className="text-ink-400 text-[9.5px] font-bold uppercase tracking-[0.16em]">
          October 2026
        </p>
        <span
          data-demo-target="add-to-phone"
          className="border-ink-200 text-ink-600 ml-auto shrink-0 rounded-full border bg-white px-2 py-[3px] text-[9.5px] font-bold transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:text-play-700"
        >
          Add to phone
        </span>
      </div>

      <div className="mt-1 min-h-0 flex-1 space-y-1.5">
        <DayGroup day="14" weekday="Tue" today>
          <ItemCard
            kind="practice"
            time="6:00 – 7:30 PM"
            title="Practice"
            meta={`Riverside CC, Court 1 · ${"U11 Girls Rep"}`}
            lens="bg-play-500"
          />
        </DayGroup>

        <DayGroup day="15" weekday="Wed">
          <ItemCard
            kind="practice"
            time="7:30 – 9:00 PM"
            title="Practice"
            meta="Northside HS · U13 Boys Rep"
            lens="bg-court-500"
          />
        </DayGroup>

        <DayGroup day="18" weekday="Sat">
          <ItemCard
            id="row-sat"
            kind="game"
            time="9:00 – 10:30 AM"
            title={`vs ${OPPONENT}`}
            meta={`${moved ? GYM_NEW : GYM_OLD} · U11 Girls Rep`}
            metaPulse={moved}
            lens="bg-play-500"
            badge={
              moved ? (
                <span className="bg-gold-400 rounded-full px-1.5 py-[1px] text-[9px] font-black uppercase tracking-wide text-[#0b1628]">
                  Moved
                </span>
              ) : undefined
            }
            footer={
              rsvp ? (
                <div className="border-ink-100 mt-1.5 flex items-center gap-1.5 border-t pt-1.5">
                  <span className="text-ink-500 text-[9.5px] font-bold uppercase tracking-[0.1em]">
                    Amara
                  </span>
                  <span className="bg-court-600 rounded-full px-2 py-[2px] text-[10px] font-bold text-white">
                    ✓ Going
                  </span>
                  <span className="text-ink-400 ml-auto text-[9.5px]">Answered Tuesday</span>
                </div>
              ) : undefined
            }
          />
        </DayGroup>
      </div>

      <div className="mt-1.5 shrink-0">
        <p className="text-ink-400 mb-1 text-[9.5px] font-bold uppercase tracking-[0.16em]">
          {handled ? "Nothing outstanding" : "Needs you this week"}
        </p>
        <div className="space-y-1.5">
          <ActionCard
            id="fee-pay"
            done={feePaid}
            title="Season fee, installment 2 of 4"
            meta="Amara · due Friday 17 Oct"
            action="Pay $85"
            doneLabel="Paid"
          />
          <ActionCard
            id="waiver-sign"
            done={waiverSigned}
            title="Concussion Code of Conduct"
            meta="Noah · before the first game"
            action="Sign"
            doneLabel="Signed"
          />
        </div>
      </div>
    </div>
  )
}

function LensChip({ id, label, dot }: { id: string; label: string; dot: string }) {
  return (
    <span
      data-demo-target={id}
      className="border-ink-200 flex min-w-0 items-center gap-1 rounded-full border bg-white px-2 py-[3px] transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      <span className="text-ink-700 truncate text-[9.5px] font-bold">{label}</span>
    </span>
  )
}

/** The date tile and the day's items beside it, as the agenda stacks them. */
function DayGroup({
  day,
  weekday,
  today,
  children,
}: {
  day: string
  weekday: string
  today?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span
        className={cn(
          "flex h-[38px] w-[34px] shrink-0 flex-col items-center justify-center rounded-lg",
          today ? "bg-play-600 text-white" : "bg-ink-100/70 text-ink-700"
        )}
      >
        <span className="text-[13px] font-bold leading-none tabular-nums">{day}</span>
        <span className="mt-[2px] text-[8px] font-bold uppercase tracking-wide opacity-80">
          {weekday}
        </span>
      </span>
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  )
}

/** One item. The left edge and the fill are the product's own kind colours. */
function ItemCard({
  id,
  kind,
  time,
  title,
  meta,
  metaPulse,
  lens,
  badge,
  footer,
}: {
  id?: string
  kind: "game" | "practice" | "event"
  time: string
  title: string
  meta: string
  /** The line that just changed flashes where it changed, and only it. */
  metaPulse?: boolean
  lens: string
  badge?: ReactNode
  footer?: ReactNode
}) {
  const fill = {
    game: "bg-energy-soft/60",
    practice: "bg-white",
    event: "bg-highlight-soft/60",
  }[kind]
  const edge = {
    game: "var(--energy)",
    practice: "var(--brand)",
    event: "var(--highlight)",
  }[kind]

  return (
    <div
      data-demo-target={id}
      className={cn(
        "border-ink-100 relative overflow-hidden rounded-xl border py-1.5 pl-2.5 pr-2 transition-all duration-200 motion-reduce:transition-none",
        fill,
        "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:shadow-sm",
        "data-[demo-press=true]:scale-[0.99]"
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: edge }}
      />
      <div className="flex items-center gap-1.5">
        <span className="text-ink-500 text-[9.5px] font-bold tabular-nums">{time}</span>
        {badge && <span className="live-pop ml-auto">{badge}</span>}
      </div>
      <div className="mt-[1px] flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", lens)} />
        <span className="text-ink-900 min-w-0 truncate text-[12px] font-bold">{title}</span>
      </div>
      <p
        key={meta}
        className={cn(
          "text-ink-500 truncate text-[10px]",
          metaPulse && "demo-pulse-amber"
        )}
      >
        {meta}
      </p>
      {footer}
    </div>
  )
}

/** A thing the week is waiting on, and the same card once it is not. */
function ActionCard({
  id,
  done,
  title,
  meta,
  action,
  doneLabel,
}: {
  id: string
  done: boolean
  title: string
  meta: string
  action: string
  doneLabel: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors duration-500 motion-reduce:transition-none",
        done ? "border-court-200 bg-court-50" : "border-amber-200 bg-amber-50"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white",
          done ? "bg-court-600" : "bg-amber-500"
        )}
      >
        {done ? "✓" : "!"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink-900 block truncate text-[11px] font-bold">{title}</span>
        <span className="text-ink-500 block truncate text-[9.5px]">{meta}</span>
      </span>
      {done ? (
        <span className="bg-court-600 live-pop shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold text-white">
          {doneLabel}
        </span>
      ) : (
        <span
          data-demo-target={id}
          className="bg-[color:var(--brand,#1a73e8)] shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold text-white transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:brightness-110 data-[demo-hover=true]:shadow-md data-[demo-press=true]:scale-[0.96]"
        >
          {action}
        </span>
      )}
    </div>
  )
}

/**
 * The end card at phone size. The shared MockEndCard is laid out for a 1120px
 * frame, and a demo that never leaves the handset has to close inside it.
 */
function PhoneEndCard() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-[#0b1628]">
      <CourtBackdropLayer variant="navy" intensity="immersive" />
      <div className="live-pop relative z-10 px-6 text-center">
        <p className="text-gold-400 text-[9.5px] font-bold uppercase tracking-[0.2em]">
          Chapter 6 of 10
        </p>
        <h2 className="font-display mt-1.5 text-[24px] font-extrabold leading-[1.06] tracking-tight text-white">
          Your week
        </h2>
        <p className="mt-2 text-[11.5px] leading-relaxed text-white/65">
          Both kids, every gym, the answer you already gave, and the two things you owed, on one
          screen on a Tuesday morning.
        </p>
        <span className="bg-gold-400 mt-4 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-bold text-[#0b1628]">
          <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch the next: Waivers, start to finish
        </span>
      </div>
    </div>
  )
}

/* ── Sheets ───────────────────────────────────────────────────────────────── */

function GameSheet({ rsvp }: { rsvp: string }) {
  return (
    <div>
      <div className="border-ink-100 rounded-xl border px-2.5 py-2">
        <p className="text-ink-500 text-[10px] font-bold uppercase tracking-[0.12em]">
          Who is going
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-ink-700 w-[42px] shrink-0 truncate text-[11px] font-bold">
            Amara
          </span>
          <RsvpPill id="rsvp-going" mark="✓" label="Going" tone="going" on={rsvp === "GOING"} />
          <RsvpPill mark="?" label="Maybe" tone="maybe" on={rsvp === "MAYBE"} />
          <RsvpPill mark="✕" label="Can't go" tone="out" on={rsvp === "NOT_GOING"} />
        </div>
      </div>

      <div className="mt-2">
        <span
          data-demo-target="directions"
          className="border-ink-200 flex items-center gap-2 rounded-xl border bg-white px-2.5 py-2 transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2 data-[demo-press=true]:scale-[0.99]"
        >
          <span className="bg-play-50 text-play-700 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px]">
            ➤
          </span>
          <span className="text-ink-800 min-w-0 flex-1 text-[11.5px] font-bold">
            Get directions →
          </span>
          <span className="text-ink-400 text-[10px]">12 min</span>
        </span>
      </div>

      <div className="mt-2">
        <PhoneAction tone="quiet">Open game page →</PhoneAction>
      </div>
    </div>
  )
}

function RsvpPill({
  id,
  mark,
  label,
  tone,
  on,
}: {
  id?: string
  mark: string
  label: string
  tone: "going" | "maybe" | "out"
  on: boolean
}) {
  const filled = {
    going: "border-court-600 bg-court-600 text-white",
    maybe: "border-amber-500 bg-amber-500 text-white",
    out: "border-red-600 bg-red-600 text-white",
  }[tone]
  return (
    <span
      data-demo-target={id}
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border px-1.5 py-1 text-[10px] font-bold transition-all duration-200 motion-reduce:transition-none",
        on ? filled : "border-ink-200 text-ink-600 bg-white",
        "data-[demo-hover=true]:border-court-400",
        "data-[demo-press=true]:scale-[0.95]"
      )}
    >
      <span>{mark}</span>
      <span className="truncate">{label}</span>
    </span>
  )
}

function MapsSheet() {
  return (
    <div>
      {/* The map preview the venue page embeds, standing in at phone size. */}
      <div className="border-ink-100 relative h-[92px] overflow-hidden rounded-xl border bg-[#e8eef4]">
        <span aria-hidden="true" className="absolute inset-x-0 top-[26px] h-[7px] bg-[#cfdae6]" />
        <span aria-hidden="true" className="absolute inset-x-0 top-[62px] h-[5px] bg-[#cfdae6]" />
        <span aria-hidden="true" className="absolute inset-y-0 left-[74px] w-[7px] bg-[#cfdae6]" />
        <span aria-hidden="true" className="absolute inset-y-0 left-[188px] w-[5px] bg-[#cfdae6]" />
        <span className="bg-energy live-pop absolute left-[112px] top-[34px] flex h-6 w-6 items-center justify-center rounded-full text-[11px] text-white shadow-md">
          ●
        </span>
      </div>
      <p className="text-ink-900 mt-2 text-[12px] font-bold">Northside HS, Court 1</p>
      <p className="text-ink-500 text-[11px]">1441 Lakeshore Blvd W, Toronto, ON M6K 3C1</p>
      <div className="mt-2.5">
        <PhoneAction>Open in Maps</PhoneAction>
      </div>
    </div>
  )
}

function FeeSheet({ paid }: { paid: boolean }) {
  if (paid) {
    return (
      <PhoneSuccess
        title="Paid $85.00"
        body="Installment 2 of 4 is settled. The receipt is in your email and on the club's books."
        rows={[
          { label: "Paid today", value: "$85.00" },
          { label: "Left on the plan", value: "$170.00" },
          { label: "Next charge", value: "17 Nov" },
        ]}
      />
    )
  }
  return (
    <div>
      <div className="border-ink-100 rounded-xl border px-2.5 py-1.5">
        <PhoneMoneyRow label="Season fee" value="$340.00" />
        <PhoneMoneyRow label="Already paid, installment 1" value="$85.00" />
        <PhoneMoneyRow label="Due today, installment 2 of 4" value="$85.00" strong />
        <p className="text-ink-400 text-[10px]">
          Two more of $85.00, on 17 November and 17 December.
        </p>
      </div>
      <div className="mt-2">
        <PhoneCardRow brand="Visa" last4="4242" />
      </div>
      <div className="mt-2.5">
        <PhoneAction id="fee-confirm">Pay $85.00</PhoneAction>
      </div>
      <p className="text-ink-400 mt-1.5 text-center text-[10px]">
        Nothing is charged until you press it.
      </p>
    </div>
  )
}
