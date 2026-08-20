"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { DemoPlayer } from "@/components/demo-directory/player"
import { gameDayStory } from "@/components/demo-directory/stories/game-day-story"
import type { DemoScript } from "@/components/demo-directory/types"

/**
 * The league pitch deck (owner 2026-08-20).
 *
 * A presentation, not a scrolling page: one slide per screen, arrow keys or a
 * tap to advance, a contents overlay to jump. It is sent as a link to a named
 * commissioner, so it opens on the title slide and never autoplays itself.
 *
 * ── THE TYPE SCALE IS THE WHOLE DESIGN ───────────────────────────────────
 *
 * The first cut of this deck was built on page typography: 13px card bodies,
 * 14px leads, and six-card grids. The owner's note was "staring you in the
 * face, not having to squint", and the ui-ux-pro-max consult for a projected
 * deck says the same thing in its own words: pattern "Minimal Single Column",
 * large type (32px+), 48px+ section gaps, THREE bullets maximum, and
 * "text-heavy pages" listed as an anti-pattern.
 *
 * So `T` below is the one modular scale every slide draws from, sized for
 * someone reading a laptop across a desk rather than a phone in their hand.
 * Two standing rules that follow from it:
 *
 *   1. THREE CARDS MAXIMUM on any slide. If a fourth wants in, it belongs on
 *      its own slide or it is not important enough to say. Fairness and money
 *      each carried six; both are cut to three.
 *   2. A SLIDE WITH A SCREENSHOT CARRIES NO CARDS. A headline, one line, and
 *      the image at the biggest size the viewport allows. Cards under a
 *      screenshot shrink the only thing on the slide worth looking at.
 *
 * ── TWO OTHER RULES ──────────────────────────────────────────────────────
 *
 * NO LEAGUE SIZE IS PRINTED ANYWHERE (owner ruling). An earlier deck showed
 * "146 teams / 725 games" as proof the scheduler scales. A commissioner
 * running several thousand games reads that as a ceiling, not a floor.
 *
 * THE LIVE GAME IS PLAYED, NOT DESCRIBED. Slide `live` mounts the real
 * game-day demo, the same split-stage script the public demo directory runs.
 */

/* ── the scale ─────────────────────────────────────────────────────────── */

const T = {
  eyebrow: "text-[clamp(0.72rem,0.95vw,0.88rem)] tracking-[0.2em]",
  h1: "text-[clamp(2.5rem,6.2vw,5rem)] leading-[1.02] tracking-[-0.035em]",
  h2: "text-[clamp(1.9rem,4.4vw,3.5rem)] leading-[1.06] tracking-[-0.032em]",
  lead: "text-[clamp(1.05rem,1.85vw,1.55rem)] leading-[1.45]",
  cardTitle: "text-[clamp(1.02rem,1.5vw,1.35rem)] leading-[1.2] tracking-[-0.018em]",
  cardBody: "text-[clamp(1rem,1.25vw,1.18rem)] leading-[1.5]",
  statN: "text-[clamp(2.6rem,6vw,4.6rem)] leading-none tracking-[-0.04em]",
  statL: "text-[clamp(0.78rem,0.9vw,0.9rem)] tracking-[0.14em]",
  bar: "text-[clamp(0.75rem,0.9vw,0.85rem)]",
} as const

/* 48px+ between a slide's blocks, per the consult. */
const BLOCK = "mt-7 sm:mt-9 lg:mt-12"
const CARDS = "grid gap-3 sm:gap-4 lg:gap-5 sm:grid-cols-3"

/* ── assets ────────────────────────────────────────────────────────────── */

type Shot = { src: string; w: number; h: number; alt: string }

const SHOTS = {
  overview: {
    src: "/deck/overview.webp", w: 1900, h: 1224,
    alt: "The season console: clubs entered, teams approved, applications pending, waivers outstanding, and the season checklist",
  },
  plan: {
    src: "/deck/plan.webp", w: 1900, h: 636,
    alt: "The five-step season planner: teams, your buildings, your calendar, publish, schedule",
  },
  schedule: {
    src: "/deck/schedule.webp", w: 1900, h: 1224,
    alt: "The scheduling tab: plan, divisions, generate, publish, with a per-team check confirming every team has its full game count",
  },
  standings: {
    src: "/deck/standings.webp", w: 1900, h: 1224,
    alt: "Standings computed from finalized games",
  },
  playoffs: {
    src: "/deck/playoffs.webp", w: 1900, h: 1003,
    alt: "The playoff plan: one championship or a bracket per division, checked against championship weekend",
  },
  referees: {
    src: "/deck/referees.webp", w: 1900, h: 1224,
    alt: "Booking a referee for a session day, broadcasting to the league pool, with pending offers and the referee pool",
  },
  waivers: {
    src: "/deck/waivers.webp", w: 1900, h: 1224,
    alt: "The waiver signing grid for the season",
  },
  hub: {
    src: "/deck/hub.webp", w: 1900, h: 1224,
    alt: "The public league page: branded header, what is included, scores and schedule, and scoring leaders",
  },
} satisfies Record<string, Shot>

/** Play a subset of a script's chapters. */
function chaptersOf(script: DemoScript, ids: string[]): DemoScript {
  return {
    ...script,
    chapters: script.chapters.filter((c) => ids.includes(c.id)),
    beats: script.beats.filter((b) => ids.includes(b.chapter)),
  }
}

/* ⚠️ "tipoff" is in the cut and must stay. `chaptersOf` drops beats rather than
 * replaying their patches, and console state accumulates from them. Cutting to
 * ["scoring", "family"] left the table on the game-day checklist while the
 * caption read "Two taps a play". A chapter cut is only safe when its opening
 * beat sets its own stage. */
const LIVE_CUT = chaptersOf(gameDayStory, ["tipoff", "scoring", "family"])

/* ── primitives ────────────────────────────────────────────────────────── */

function Eyebrow({ children, dark = true }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={cn(
        "mb-4 flex items-center gap-3 font-mono font-semibold uppercase sm:mb-5",
        T.eyebrow,
        dark ? "text-[#f24e1e]" : "text-[#c2410c]",
      )}
    >
      <span className={cn("h-[3px] w-7 rounded-sm", dark ? "bg-[#f24e1e]" : "bg-[#c2410c]")} />
      {children}
    </p>
  )
}

function H({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("font-display max-w-[18ch] text-balance font-extrabold", T.h2, className)}>
      {children}
    </h2>
  )
}

/** Line length capped at ~60ch: the consult's 65-75 character rule. */
function Lead({ children, dark = true }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={cn("mt-4 max-w-[52ch]", T.lead, dark ? "text-white/72" : "text-[#46506a]")}>
      {children}
    </p>
  )
}

function Card({
  title, body, tone = "hoop", dark = true,
}: { title: string; body: string; tone?: "hoop" | "play" | "gold" | "green"; dark?: boolean }) {
  const dot = { hoop: "bg-[#f24e1e]", play: "bg-[#7c74f5]", gold: "bg-[#f6b73c]", green: "bg-[#16a34a]" }[tone]
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6 lg:p-7",
        dark ? "border-white/12 bg-[#16253f]" : "border-[#dde3ee] bg-white shadow-sm",
      )}
    >
      <span className={cn("mb-4 block h-2.5 w-2.5 rounded-sm", dot)} />
      <b className={cn("block font-bold", T.cardTitle)}>{title}</b>
      <span className={cn("mt-2.5 block", T.cardBody, dark ? "text-white/62" : "text-[#4a5468]")}>
        {body}
      </span>
    </div>
  )
}

/** A screenshot in browser chrome, given every pixel the slide can spare. */
function Browser({ shot, url, dark = true }: { shot: Shot; url: string; dark?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border",
        dark
          ? "border-white/12 bg-[#0d1a2e] shadow-[0_30px_70px_-40px_rgba(0,0,0,0.85)]"
          : "border-[#dde3ee] bg-white shadow-[0_30px_70px_-42px_rgba(15,23,40,0.5)]",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-b px-4 py-2.5",
          dark ? "border-white/12 bg-[#12203a]" : "border-[#dde3ee] bg-[#eef1f7]",
        )}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-2.5 w-2.5 rounded-full", dark ? "bg-white/20" : "bg-[#c3cbdb]")} />
        ))}
        <span
          className={cn(
            "ml-2 truncate rounded px-3 py-1 font-mono text-[clamp(0.7rem,0.85vw,0.82rem)]",
            dark ? "bg-white/5 text-white/45" : "bg-white text-[#79839a]",
          )}
        >
          {url}
        </span>
      </div>
      <img
        src={shot.src}
        width={shot.w}
        height={shot.h}
        alt={shot.alt}
        className="min-h-0 w-full flex-1 object-contain object-top"
      />
    </div>
  )
}

/** Headline, one line, and the image as big as the slide allows. No cards. */
function ShotSlide({
  eyebrow, title, lead, shot, url, dark = false,
}: { eyebrow: string; title: ReactNode; lead: string; shot: Shot; url: string; dark?: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
        <H>{title}</H>
        <p className={cn("mt-3 max-w-[62ch]", T.lead, dark ? "text-white/72" : "text-[#46506a]")}>
          {lead}
        </p>
      </div>
      <div className="mt-5 flex min-h-0 flex-1 flex-col sm:mt-7">
        <Browser shot={shot} url={url} dark={dark} />
      </div>
    </div>
  )
}

function Stat({ n, label, gold = false }: { n: string; label: string; gold?: boolean }) {
  return (
    <div>
      <div
        className={cn(
          "font-display font-extrabold tabular-nums",
          T.statN,
          gold ? "text-[#f6b73c]" : "text-[#f24e1e]",
        )}
      >
        {n}
      </div>
      <div className={cn("mt-3 font-mono font-semibold uppercase text-white/45", T.statL)}>
        {label}
      </div>
    </div>
  )
}

/* ── slides ────────────────────────────────────────────────────────────── */

type SlideDef = {
  id: string
  chapter: string
  light?: boolean
  render: (ctx: { active: boolean; visits: number }) => ReactNode
}

const SLIDES: SlideDef[] = [
  {
    id: "title",
    chapter: "Open",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <img
          src="/brand/wordmark-one-reverse.svg"
          alt="SportsHub One"
          className="mb-10 h-9 w-auto sm:h-12"
        />
        <Eyebrow>For league operators</Eyebrow>
        <h1 className={cn("font-display text-balance font-extrabold", T.h1)}>
          Run the whole season
          <br />
          <span className="text-[#f24e1e]">in one place.</span>
        </h1>
        <Lead>
          Registration, divisions, the schedule, game day, standings, playoffs, referees, waivers
          and fees. One console for the league. One calendar for every family.
        </Lead>
        <p className={cn("mt-10 font-mono uppercase text-white/40", T.eyebrow)}>
          Use the arrow keys, or tap the sides
        </p>
      </div>
    ),
  },
  {
    id: "problem",
    chapter: "The problem",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>Why we built it</Eyebrow>
        <H className="max-w-[20ch]">
          Nobody is fighting the sport.
          <br />
          They are fighting <span className="text-[#f24e1e]">the admin.</span>
        </H>
        <div className={cn(CARDS, BLOCK)}>
          <Card title="The schedule goes out late" body="Gyms get confirmed in pieces, so the calendar lands weeks after families booked their lives around nothing." />
          <Card title="Then it changes" body="One flooded gym on a Saturday turns into forty phone calls and a reprinted sheet nobody reads." />
          <Card title="Parents dig" body="Game time, gym address, jersey colour. Buried in a three-hundred-message group chat." />
        </div>
      </div>
    ),
  },
  {
    id: "spine",
    chapter: "The spine",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>The spine</Eyebrow>
        <H>The season, end to end.</H>
        <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3.5", BLOCK)}>
          {["Plan", "Register", "Approve", "Divisions", "Schedule",
            "Publish", "Play", "Standings", "Playoffs", "Renew"].map((t, i) => (
            <div key={t} className="rounded-xl border border-white/12 bg-[#16253f] px-4 py-4 sm:px-5 sm:py-5">
              <div className="font-mono text-[clamp(0.7rem,0.85vw,0.8rem)] font-semibold tracking-[0.12em] text-[#f24e1e]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <b className={cn("mt-2 block font-bold", T.cardTitle)}>{t}</b>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "intake",
    chapter: "Intake",
    light: true,
    render: () => (
      <ShotSlide
        eyebrow="The league console"
        title={<>One queue, <span className="text-[#c2410c]">not an inbox.</span></>}
        lead="Clubs apply to your season and register their own teams. Your questions travel with the entry, your fees attach to it, and a checklist tells you what is still waiting."
        shot={SHOTS.overview}
        url="sportshubone.com/manage/leagues/summer-2026"
      />
    ),
  },
  {
    id: "plan",
    chapter: "Planning",
    light: true,
    render: () => (
      <ShotSlide
        eyebrow="Pre-season planning"
        title={<>Plan the season <span className="text-[#c2410c]">before it exists.</span></>}
        lead="Book gyms early and see exactly what fits. Every weekend shows games needed against slots booked, and it tells you the court hours you are still short."
        shot={SHOTS.plan}
        url="/seasons/summer-2026/plan"
      />
    ),
  },
  {
    id: "schedule",
    chapter: "Scheduling",
    render: () => (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <Eyebrow>Scheduling</Eyebrow>
          <H className="max-w-[24ch]">
            A full season, scheduled in about <span className="text-[#f24e1e]">fifteen seconds.</span>
          </H>
          <div className="mt-6 flex flex-wrap gap-x-12 gap-y-5 sm:mt-8">
            <Stat n="~15s" label="To build a season" />
            <Stat n="0" label="Double-booked courts" gold />
            <Stat n="0" label="Back-to-back games" gold />
          </div>
        </div>
        <div className="mt-6 flex min-h-0 flex-1 flex-col sm:mt-8">
          <Browser shot={SHOTS.schedule} url="/seasons/summer-2026/schedule" />
        </div>
      </div>
    ),
  },
  {
    id: "fair",
    chapter: "Fairness",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>Fairness</Eyebrow>
        <H>
          Fair to every kid, <span className="text-[#f24e1e]">by the numbers.</span>
        </H>
        <Lead>
          The scheduler tracks what each team has been asked to put up with, and charges itself more
          every time it loads one more thing onto a team that has already had a rough run.
        </Lead>
        <div className={cn(CARDS, BLOCK)}>
          <Card tone="green" title="Never back to back" body="No team plays two games in a row. Not once, all season." />
          <Card tone="green" title="One gym per grade" body="A grade stays in one building, all its divisions together, so a family learns one drive." />
          <Card tone="green" title="Early and late, shared" body="First tip-offs and last finishes spread evenly instead of landing on the same team every week." />
        </div>
      </div>
    ),
  },
  {
    id: "changes",
    chapter: "Changes",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>Change management</Eyebrow>
        <H className="max-w-[22ch]">
          Schedules change.
          <br />
          <span className="text-[#f24e1e]">Phone trees are optional now.</span>
        </H>
        <div className={cn(CARDS, BLOCK)}>
          <Card tone="play" title="One edit, everyone told" body="Move or cancel a game. Every affected family is notified and every synced calendar corrects itself." />
          <Card tone="play" title="A team drops out" body="The schedule adapts with minimal churn. Most games do not move, and every team stays whole." />
          <Card tone="play" title="Requests you can price" body="A travelling team asks for early Sunday games. You see what it costs everyone else, then decide." />
        </div>
      </div>
    ),
  },
  {
    id: "live",
    chapter: "Game day",
    light: true,
    render: ({ active, visits }) => (
      <div className="flex h-full min-h-0 flex-col">
        {/* The player carries its own transport row and caption bar, so this
            slide's header is the tightest in the deck. Anything more clips. */}
        <div className="shrink-0 [&>p]:mb-2 sm:[&>p]:mb-5">
          <span className="hidden sm:block">
            <Eyebrow dark={false}>Game day, both sides at once</Eyebrow>
          </span>
          <h2 className="font-display text-balance text-[clamp(1.25rem,3.2vw,2.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
            The table taps it in.{" "}
            <span className="text-[#c2410c]">His phone already knows.</span>
          </h2>
        </div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          {/* Mounted only while this slide is showing: the player autoplays on
              mount, and `autoStart` cannot be flipped after the fact. The key
              forces a fresh run each time the viewer returns to the slide. */}
          {active ? (
            <DemoPlayer
              key={`live-${visits}`}
              script={LIVE_CUT}
              role="Scorer's table"
              roleTone="referee"
              autoStart
              reserveBelow={128}
            />
          ) : null}
        </div>
      </div>
    ),
  },
  {
    id: "standings",
    chapter: "Standings",
    light: true,
    render: () => (
      <ShotSlide
        eyebrow="Standings"
        title={<>Standings <span className="text-[#c2410c]">nobody has to compute.</span></>}
        lead="Wins, losses and points flow straight from signed-off scoresheets, with your tiebreakers applied. The weekend ends and the tables are already right."
        shot={SHOTS.standings}
        url="/seasons/summer-2026/standings"
      />
    ),
  },
  {
    id: "playoffs",
    chapter: "Playoffs",
    render: () => (
      <ShotSlide
        dark
        eyebrow="Playoffs"
        title={<>Brackets seeded by <span className="text-[#f24e1e]">what actually happened.</span></>}
        lead="The bracket sits on real weekends in real gyms before it is seeded, and team names fill in as results land. Consolation rounds mean nobody's season ends at 9am."
        shot={SHOTS.playoffs}
        url="/seasons/summer-2026/playoffs"
      />
    ),
  },
  {
    id: "referees",
    chapter: "Referees",
    light: true,
    render: () => (
      <ShotSlide
        eyebrow="Referees"
        title={<>A referee pool, <span className="text-[#c2410c]">not a group text.</span></>}
        lead="Referees mark their own availability. Broadcast a shift to the pool or target one person you trust, and the first accept wins it."
        shot={SHOTS.referees}
        url="/seasons/summer-2026/referees"
      />
    ),
  },
  {
    id: "waivers",
    chapter: "Waivers",
    light: true,
    render: () => (
      <ShotSlide
        eyebrow="Waivers"
        title={<>Signed <span className="text-[#c2410c]">before the first whistle.</span></>}
        lead="On approval they email every rostered parent, reminders chase the rest, and a missing signature has nowhere to hide. Rowan's Law is included."
        shot={SHOTS.waivers}
        url="/seasons/summer-2026/waivers"
      />
    ),
  },
  {
    id: "money",
    chapter: "Money",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>Money and insight</Eyebrow>
        <H>
          Fees you can <span className="text-[#f24e1e]">actually track.</span>
        </H>
        <div className={cn(CARDS, BLOCK)}>
          <Card tone="play" title="Owed, by club" body="Every team fee with its status at a glance. E-transfers reconciled beside cards, because this is Canada." />
          <Card tone="play" title="Exports to the bookkeeper" body="Transactions, revenue per program, aging on what is overdue, and CSV for QuickBooks or Xero." />
          <Card tone="gold" title="A fairness report card" body="Every team's early games, late games and waits, straight from the scheduler. Show it to the club that complains." />
        </div>
      </div>
    ),
  },
  {
    id: "hub",
    chapter: "Public page",
    render: () => (
      <ShotSlide
        dark
        eyebrow="The public hub"
        title={<>Your league&apos;s <span className="text-[#f24e1e]">front door.</span></>}
        lead="A branded page families, grandparents and recruiters read without making an account. Live scores, standings and leaders, always current with the published season."
        shot={SHOTS.hub}
        url="sportshubone.com/league/summer-2026"
      />
    ),
  },
  {
    id: "everyone",
    chapter: "Everyone else",
    light: true,
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow dark={false}>One season, every seat in the gym</Eyebrow>
        <H>
          Everyone sees <span className="text-[#c2410c]">their slice</span> of the same season.
        </H>
        <p className={cn("mt-4 max-w-[62ch]", T.lead, "text-[#46506a]")}>
          One data source underneath. Move a game and the club, the coach and every family&apos;s
          calendar all correct themselves.
        </p>
        <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4", BLOCK)}>
          {[
            ["Clubs", "A branded club site, teams, tryouts and fees."],
            ["Coaches", "Roster, chat, RSVPs, and the console at the table."],
            ["Families", "One calendar, one place to pay, one place to sign."],
            ["Players", "A page of season stats a senior can send a recruiter."],
            ["Referees", "Availability, shifts, and the scoresheet signature."],
            ["The public", "Scores and standings with no account at all."],
          ].map(([role, body]) => (
            <div key={role} className="rounded-2xl border border-[#dde3ee] bg-white p-5 shadow-sm sm:p-6">
              <div className={cn("font-mono font-semibold uppercase text-[#4f46e5]", T.statL)}>{role}</div>
              <span className={cn("mt-2.5 block text-[#3d4657]", T.cardBody)}>{body}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "see",
    chapter: "See it working",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>Not slides</Eyebrow>
        <H>
          See it working, <span className="text-[#f24e1e]">right now.</span>
        </H>
        <Lead>
          Click-through walkthroughs of the real product. No login, no form, nothing to install.
        </Lead>
        <div className={cn(CARDS, BLOCK)}>
          {[
            ["season-planned-to-published", "A season, planned to published", "Gyms, divisions, generate, publish."],
            ["schedule-change", "A game moves on Friday night", "One edit, and the family stays off the road."],
            ["standings-to-playoffs", "Standings into brackets", "Seeding from real results onto booked weekends."],
          ].map(([slug, title, body]) => (
            <a
              key={slug}
              href={`https://sportshubone.com/demos/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group cursor-pointer rounded-2xl border border-white/12 bg-[#16253f] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#f24e1e] hover:bg-[#1a2b48] sm:p-6 lg:p-7"
            >
              <div className="flex items-start justify-between gap-3">
                <b className={cn("font-bold", T.cardTitle)}>{title}</b>
                <svg viewBox="0 0 24 24" className="mt-1 h-4 w-4 shrink-0 stroke-[#f24e1e] opacity-50 transition duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>
              <span className={cn("mt-2.5 block text-white/62", T.cardBody)}>{body}</span>
            </a>
          ))}
        </div>
        <p className={cn("mt-7 text-white/60", T.lead)}>
          All of them at{" "}
          <a href="https://sportshubone.com/demos" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#f24e1e]">
            sportshubone.com/demos
          </a>
        </p>
      </div>
    ),
  },
  {
    id: "close",
    chapter: "The ask",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>What we are asking for</Eyebrow>
        <h2 className={cn("font-display max-w-[16ch] text-balance font-extrabold", T.h2)}>
          One league. One season.
          <br />
          <span className="text-[#f24e1e]">Run live, with us on the hook.</span>
        </h2>
        <Lead>
          We will do the setup, the migration and the hand-holding. You tell us what is wrong with
          it while it runs.
        </Lead>
        <div className={cn("flex flex-wrap gap-4", BLOCK)}>
          <a
            href="https://sportshubone.com/demos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-[#f24e1e] px-8 py-4 text-[clamp(1rem,1.25vw,1.18rem)] font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#ff6136]"
          >
            Watch a demo
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center rounded-full border border-white/25 px-8 py-4 text-[clamp(1rem,1.25vw,1.18rem)] font-bold transition duration-200 hover:border-white/60"
          >
            sportshubone.com
          </Link>
        </div>
      </div>
    ),
  },
]

/* ── the deck ──────────────────────────────────────────────────────────── */

export function LeagueDeck() {
  const [i, setI] = useState(0)
  const [menu, setMenu] = useState(false)
  /* Bumped on every slide entry, so a remounted demo replays. */
  const [visits, setVisits] = useState(0)
  const touch = useRef<{ x: number; y: number } | null>(null)

  const go = useCallback((n: number) => {
    setI((cur) => {
      const next = Math.max(0, Math.min(SLIDES.length - 1, n))
      if (next !== cur) setVisits((v) => v + 1)
      return next
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key
      if (k === "Escape") { setMenu((m) => !m); e.preventDefault(); return }
      if (menu) return
      if (k === "ArrowRight" || k === "PageDown") { go(i + 1); e.preventDefault() }
      else if (k === "ArrowLeft" || k === "PageUp") { go(i - 1); e.preventDefault() }
      else if (k === "Home") { go(0); e.preventDefault() }
      else if (k === "End") { go(SLIDES.length - 1); e.preventDefault() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [i, go, menu])

  const slide = SLIDES[i]
  const light = Boolean(slide.light)

  return (
    <div
      className={cn(
        "relative flex h-[100dvh] w-full flex-col overflow-hidden transition-colors duration-500",
        light ? "bg-[#f4f6fa] text-[#0f1728]" : "bg-[#0b1628] text-white",
      )}
      onTouchStart={(e) => {
        const t = e.touches[0]
        touch.current = { x: t.clientX, y: t.clientY }
      }}
      onTouchEnd={(e) => {
        const s = touch.current
        if (!s) return
        touch.current = null
        const t = e.changedTouches[0]
        const dx = t.clientX - s.x
        /* Horizontal only: a vertical drag is someone reading a tall slide. */
        if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(t.clientY - s.y)) go(dx < 0 ? i + 1 : i - 1)
      }}
    >
      <div className={cn("absolute inset-x-0 top-0 z-30 h-[3px]", light ? "bg-black/8" : "bg-white/10")}>
        <div
          className="h-full bg-gradient-to-r from-[#7c74f5] to-[#f24e1e] transition-[width] duration-300"
          style={{ width: `${((i + 1) / SLIDES.length) * 100}%` }}
        />
      </div>

      <div className="relative min-h-0 flex-1">
        {SLIDES.map((s, n) => (
          <section
            key={s.id}
            aria-hidden={n !== i}
            className={cn(
              "absolute inset-0 overflow-y-auto px-6 pb-5 pt-10 sm:px-12 sm:pt-14 lg:px-20",
              "motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:ease-out",
              n === i
                ? "z-10 translate-y-0 opacity-100"
                : "pointer-events-none z-0 translate-y-2 opacity-0",
            )}
          >
            <div className="mx-auto h-full w-full max-w-[1280px]">
              {s.render({ active: n === i, visits })}
            </div>
          </section>
        ))}
      </div>

      {/* tap zones, clear of the bar so its buttons still work */}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => go(i - 1)}
        className="absolute left-0 top-0 z-20 h-[calc(100%-60px)] w-[8%] cursor-w-resize opacity-0"
      />
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => go(i + 1)}
        className="absolute right-0 top-0 z-20 h-[calc(100%-60px)] w-[8%] cursor-e-resize opacity-0"
      />

      <div
        className={cn(
          "relative z-30 flex h-[60px] shrink-0 items-center gap-3 border-t px-4 sm:px-7",
          light ? "border-[#dde3ee] bg-white/85" : "border-white/12 bg-[#0b1628]/90",
        )}
      >
        <span className="h-3 w-3 shrink-0 rounded-sm bg-[#f24e1e]" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-mono font-semibold uppercase tracking-[0.13em]",
            T.bar,
            light ? "text-[#79839a]" : "text-white/45",
          )}
        >
          {slide.chapter}
        </span>
        <span className={cn("shrink-0 font-mono tabular-nums", T.bar, light ? "text-[#79839a]" : "text-white/45")}>
          {i + 1} / {SLIDES.length}
        </span>
        {[
          { label: "Contents", onClick: () => setMenu(true), disabled: false },
          { label: "Back", onClick: () => go(i - 1), disabled: i === 0 },
          { label: "Next", onClick: () => go(i + 1), disabled: i === SLIDES.length - 1 },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.onClick}
            disabled={b.disabled}
            className={cn(
              "shrink-0 cursor-pointer rounded-lg border px-4 py-2 font-bold transition duration-200 disabled:cursor-not-allowed disabled:opacity-35",
              T.bar,
              b.label === "Contents" && "hidden sm:block",
              light
                ? "border-[#dde3ee] text-[#0f1728] enabled:hover:border-[#c2410c] enabled:hover:text-[#c2410c]"
                : "border-white/15 text-white enabled:hover:border-[#f24e1e] enabled:hover:text-[#f24e1e]",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      {menu ? (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-[#0b1628]/98 px-7 py-14 text-white sm:px-16">
          <div className="mx-auto max-w-[1000px]">
            <div className="mb-9 flex items-baseline justify-between gap-4">
              <h2 className={cn("font-display font-extrabold", T.h2)}>Contents</h2>
              <button
                type="button"
                onClick={() => setMenu(false)}
                className={cn("cursor-pointer rounded-lg border border-white/15 px-4 py-2 font-bold transition duration-200 hover:border-[#f24e1e] hover:text-[#f24e1e]", T.bar)}
              >
                Close
              </button>
            </div>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {SLIDES.map((s, n) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => { go(n); setMenu(false) }}
                    className={cn(
                      "flex w-full cursor-pointer items-baseline gap-4 rounded-lg px-4 py-2.5 text-left transition duration-200 hover:bg-white/8",
                      n === i && "bg-white/10",
                    )}
                  >
                    <span className="w-7 shrink-0 font-mono text-[0.85rem] tabular-nums text-white/35">
                      {String(n + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[clamp(1rem,1.3vw,1.2rem)] font-semibold">{s.chapter}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

    </div>
  )
}
