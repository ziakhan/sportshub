"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { DemoPlayer } from "@/components/demo-directory/player"
import { makeGameDayStory } from "@/components/demo-directory/stories/game-day-story"
import type { DemoScript } from "@/components/demo-directory/types"

/**
 * The league pitch deck (owner 2026-08-20).
 *
 * One presentation, two brands. `/deck/nph` shows the seeded NPH league and is
 * addressed to North Pole Hoops; `/deck/leagues` is the one that gets sent to
 * anybody else and must not mention NPH anywhere, because a deck full of a
 * rival league's name is not a deck you send to a commissioner. Both draw from
 * the same slides; only `brand` differs.
 *
 * ── HOW TO WRITE FOR IT ──────────────────────────────────────────────────
 *
 * Owner, three times and finally as a standing rule: plain and direct, never
 * dramatic or abstract, never anything the reader has to decode. Specific bans
 * that came out of reviewing this deck:
 *
 *   - No money word for something that is not money. "Requests you can price"
 *     read as dollars. It is not dollars.
 *   - Never sell the absence of a bug. "Zero double-booked courts" is banned
 *     everywhere: a double-booked court is a defect, not an achievement, and
 *     saying it out loud implies shipping it was on the table.
 *   - Never headline the fifteen-second scheduler run. The button is fifteen
 *     seconds; the work is the weeks of planning before it.
 *   - Fairness is measured per TEAM, not per player. Not "fair to every kid".
 *   - No team or game count is printed anywhere. A bigger league reads a
 *     number as a ceiling.
 *
 * ── HOW IT IS BUILT ──────────────────────────────────────────────────────
 *
 * `T` is the one type scale, sized for a laptop across a desk. Three cards
 * maximum on a slide, and a slide carrying a screenshot carries no cards at
 * all, so the image gets the whole frame.
 *
 * ⚠️ `DemoPlayer`'s `autoStart` is initial state only, so the live slide mounts
 * the player only while it is showing, keyed on a visit counter so it replays.
 */

export interface DeckBrand {
  /** Folder under /public holding this variant's screenshots. */
  shots: string
  /** League name the embedded game-day demo should show. */
  league: string
  /** Shown under the title, e.g. "Prepared for North Pole Hoops". */
  addressedTo?: string
}

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

const BLOCK = "mt-6 sm:mt-8 lg:mt-10"
const CARDS = "grid gap-3 sm:gap-4 lg:gap-5 sm:grid-cols-3"

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
    <h2 className={cn("font-display max-w-[19ch] text-balance font-extrabold", T.h2, className)}>
      {children}
    </h2>
  )
}

function Lead({ children, dark = true }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={cn("mt-4 max-w-[56ch]", T.lead, dark ? "text-white/72" : "text-[#46506a]")}>
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

/** One plain line with a bold opener. Used where a list beats cards. */
function Line({ head, rest, dark = true }: { head: string; rest: string; dark?: boolean }) {
  return (
    <li className={cn("flex gap-3.5", T.lead)}>
      <span className={cn("mt-[0.62em] h-2 w-2 shrink-0 rounded-sm", dark ? "bg-[#f24e1e]" : "bg-[#c2410c]")} />
      <span>
        <b className={cn("font-bold", dark ? "text-white" : "text-[#0f1728]")}>{head}</b>{" "}
        <span className={dark ? "text-white/68" : "text-[#46506a]"}>{rest}</span>
      </span>
    </li>
  )
}

type Shot = { file: string; w: number; h: number; alt: string }

function Browser({ shot, url, base, dark = true }: { shot: Shot; url: string; base: string; dark?: boolean }) {
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
        src={`${base}/${shot.file}`}
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
  eyebrow, title, lead, shot, url, base, dark = false,
}: {
  eyebrow: string; title: ReactNode; lead: string
  shot: Shot; url: string; base: string; dark?: boolean
}) {
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
        <Browser shot={shot} url={url} base={base} dark={dark} />
      </div>
    </div>
  )
}

const SHOTS = {
  overview: { file: "overview.webp", w: 1900, h: 1224, alt: "The season console showing clubs entered, teams approved, what is waiting, and the season checklist" },
  plan: { file: "plan.webp", w: 1900, h: 636, alt: "The five step season planner: teams, your buildings, your calendar, publish, schedule" },
  schedule: { file: "schedule.webp", w: 1900, h: 1224, alt: "The scheduling tab with a check confirming every team has its full game count" },
  standings: { file: "standings.webp", w: 1900, h: 1224, alt: "Standings built from finalized games" },
  playoffs: { file: "playoffs.webp", w: 1900, h: 1003, alt: "The playoff plan, checked against championship weekend" },
  referees: { file: "referees.webp", w: 1900, h: 1224, alt: "Booking a referee for a session day and the league referee pool" },
  waivers: { file: "waivers.webp", w: 1900, h: 1224, alt: "The waiver signing grid for the season" },
  hub: { file: "hub.webp", w: 1900, h: 1224, alt: "The public league page with scores, schedule and scoring leaders" },
} satisfies Record<string, Shot>

/* ── a team's Saturday, drawn ──────────────────────────────────────────────
   Hand-authored SVG per the design law: product graphics are code, so they
   stay crisp and themable. This is the fairness slide's whole argument in one
   picture, which beats another paragraph about it. */
function WeekendShapes() {
  const Row = ({ label, blocks, good }: { label: string; blocks: [number, number][]; good: boolean }) => (
    <div className="flex items-center gap-3 sm:gap-5">
      <span className={cn("w-[8.5rem] shrink-0 text-right font-semibold sm:w-[11rem]", T.cardBody, good ? "text-[#0f1728]" : "text-[#9aa3b5]")}>
        {label}
      </span>
      <svg viewBox="0 0 340 24" className="h-6 min-w-0 flex-1" role="img" aria-label={label}>
        <rect x="0" y="9" width="340" height="6" rx="3" fill="#dde3ee" />
        {blocks.map(([x, w], i) => (
          <rect key={i} x={x} y="0" width={w} height="24" rx="5" fill={good ? "#16a34a" : "#d1d5e0"} />
        ))}
      </svg>
      <span className={cn("w-16 shrink-0 font-mono", T.statL, good ? "text-[#16a34a]" : "text-[#9aa3b5]")}>
        {good ? "GOOD" : "NO"}
      </span>
    </div>
  )
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <Row label="A gap between games" blocks={[[0, 58], [150, 58]]} good />
      <Row label="Back to back" blocks={[[0, 58], [62, 58]]} good={false} />
      <Row label="Waiting all day" blocks={[[0, 58], [282, 58]]} good={false} />
    </div>
  )
}

/* ── slides ────────────────────────────────────────────────────────────── */

type Ctx = { active: boolean; visits: number; brand: DeckBrand; script: DemoScript }
type SlideDef = { id: string; chapter: string; light?: boolean; render: (c: Ctx) => ReactNode }

const SLIDES: SlideDef[] = [
  {
    id: "title",
    chapter: "Open",
    render: ({ brand }) => (
      <div className="flex h-full flex-col justify-center">
        {/* The PNG, never the SVG. wordmark-one-reverse.svg sets "SportsHub"
            and the ONE badge as live <text> in a SYSTEM font stack, so the
            badge lands in a different place on every machine. The PNG is the
            canonical mark. See memory: project-logo-spec-do-not-redraw. */}
        <img
          src="/brand/wordmark-one-reverse.png"
          alt="SportsHub One"
          width={723}
          height={204}
          className="mb-10 h-9 w-auto self-start sm:h-12"
        />
        <Eyebrow>For league operators</Eyebrow>
        <h1 className={cn("font-display text-balance font-extrabold", T.h1)}>
          Run the whole season
          <br />
          <span className="text-[#f24e1e]">in one place.</span>
        </h1>
        <Lead>
          Clubs register their own teams. You set the rules: your game guarantee, your tiebreakers,
          your playoff format. Everything after that runs inside them.
        </Lead>
        {brand.addressedTo ? (
          <p className={cn("mt-9 font-mono uppercase text-white/45", T.eyebrow)}>{brand.addressedTo}</p>
        ) : (
          <p className={cn("mt-9 font-mono uppercase text-white/40", T.eyebrow)}>
            Use the arrow keys, or tap the sides
          </p>
        )}
      </div>
    ),
  },
  {
    id: "gauntlet",
    chapter: "The problem",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>Why we built it</Eyebrow>
        <H className="max-w-[24ch]">
          Everything between registration
          <br />
          and <span className="text-[#f24e1e]">a schedule anyone can trust.</span>
        </H>
        <ul className={cn("flex flex-col gap-3.5 sm:gap-4", BLOCK)}>
          <Line head="Team entries." rest="Chased by email, one club at a time." />
          <Line head="Rosters." rest="Late, incomplete, and changed after you thought they were final." />
          <Line head="Blackout dates." rest="Buried in replies you have to remember." />
          <Line head="Special requests." rest="A team that travels, a coach with two teams, a club that cannot play Sundays." />
          <Line head="Waivers." rest="Chased one parent at a time until the first whistle." />
        </ul>
        <p className={cn("mt-7 max-w-[56ch]", T.lead, "text-white/72")}>
          Then it all changes, and you do it again.
        </p>
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
        <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3", BLOCK)}>
          {[
            ["Plan", "Gyms booked early", "What you still need"],
            ["Register", "Clubs enter teams", "Your questions attached"],
            ["Approve", "One queue", "Fees attach at entry"],
            ["Divisions", "Drag and drop", "Split or merge any time"],
            ["Schedule", "Minutes, not weeks", "Preview before it commits"],
            ["Publish", "Locked before tip-off", "Families told once"],
            ["Play", "Scored from a phone", "Referee signs off"],
            ["Standings", "Your tiebreakers", "No Monday spreadsheet"],
            ["Playoffs", "Seeded from results", "Everyone plays twice"],
            ["Renew", "One click", "Teams keep their history"],
          ].map(([t, a, b], i) => (
            <div key={t} className="rounded-xl border border-white/12 bg-[#16253f] px-4 py-3.5 sm:px-4 sm:py-4">
              <div className="font-mono text-[clamp(0.68rem,0.8vw,0.78rem)] font-semibold tracking-[0.12em] text-[#f24e1e]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <b className="mt-1.5 block text-[clamp(0.98rem,1.25vw,1.15rem)] font-bold leading-tight tracking-[-0.015em]">{t}</b>
              <span className="mt-2 block text-[clamp(0.85rem,1vw,0.95rem)] leading-snug text-white/55">{a}</span>
              {/* ten boxes times two details does not fit a 390px screen; the
                  second line is the one that can go. */}
              <span className="mt-1 hidden text-[clamp(0.85rem,1vw,0.95rem)] leading-snug text-white/55 sm:block">{b}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "dashboard",
    chapter: "The console",
    light: true,
    render: ({ brand }) => (
      <ShotSlide
        base={brand.shots}
        eyebrow="The league console"
        title={<>Your whole league, <span className="text-[#c2410c]">on one screen.</span></>}
        lead="Clubs in, teams approved, what is still waiting on you, and a checklist that will not let you finalize with something missing."
        shot={SHOTS.overview}
        url="sportshubone.com/manage/leagues/summer-2026"
      />
    ),
  },
  {
    id: "plan",
    chapter: "Planning",
    light: true,
    render: ({ brand }) => (
      <ShotSlide
        base={brand.shots}
        eyebrow="Pre-season planning"
        title={<>Book the gyms <span className="text-[#c2410c]">before you know the teams.</span></>}
        lead="Estimate each grade with last season's count sitting right beside it. Drop in the dates and gyms you think you can get. It tells you whether that fits or how many more court hours you need, months before registration opens."
        shot={SHOTS.plan}
        url="/seasons/summer-2026/plan"
      />
    ),
  },
  {
    id: "schedule",
    chapter: "Scheduling",
    render: ({ brand }) => (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <Eyebrow>Scheduling</Eyebrow>
          <H className="max-w-[26ch]">
            Weeks of planning, <span className="text-[#f24e1e]">then minutes to build it.</span>
          </H>
          <p className={cn("mt-3 max-w-[64ch]", T.lead, "text-white/72")}>
            It only uses the gyms, courts and hours you actually have. Every team gets the games you
            promised. You read the whole season before anything commits, and what you read is what
            commits.
          </p>
        </div>
        <div className="mt-5 flex min-h-0 flex-1 flex-col sm:mt-7">
          <Browser shot={SHOTS.schedule} url="/seasons/summer-2026/schedule" base={brand.shots} />
        </div>
      </div>
    ),
  },
  {
    id: "fair",
    chapter: "A fair schedule",
    light: true,
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow dark={false}>A fair schedule</Eyebrow>
        <H>
          Fair to <span className="text-[#c2410c]">every team.</span>
        </H>
        <div className={cn("max-w-[720px]", BLOCK)}>
          <WeekendShapes />
        </div>
        <ul className="mt-7 flex flex-col gap-3 sm:gap-3.5">
          <Line dark={false} head="Early starts and late finishes get shared." rest="Not dumped on the same team every week." />
          <Line dark={false} head="One gym, not two." rest="Nobody drives across town twice in a day." />
          <Line dark={false} head="Games on one day where we can." rest="So the rest of the weekend is yours." />
        </ul>
      </div>
    ),
  },
  {
    id: "changes",
    chapter: "Changes",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>When things change</Eyebrow>
        <H className="max-w-[22ch]">
          Schedules change.
          <br />
          <span className="text-[#f24e1e]">You send one message, not forty.</span>
        </H>
        <div className={cn(CARDS, BLOCK)}>
          <Card tone="play" title="A game moves" body="Change it once. Every family in both teams is told, and their calendars update on their phones." />
          <Card tone="play" title="A team drops out" body="Most games stay where they are. Every team that is left keeps its full number of games." />
          <Card tone="play" title="A team asks for a later start" body="You see which other teams get a worse weekend if you say yes. Then you decide." />
        </div>
      </div>
    ),
  },
  {
    id: "live",
    chapter: "Game day",
    light: true,
    render: ({ active, visits, script }) => (
      <div className="flex h-full min-h-0 flex-col">
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
          {active ? (
            <DemoPlayer
              key={`live-${visits}`}
              script={script}
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
    render: ({ brand }) => (
      <ShotSlide
        base={brand.shots}
        eyebrow="Standings"
        title={<>Standings <span className="text-[#c2410c]">nobody has to work out.</span></>}
        lead="Wins, losses and points come straight from the scoresheets the referee signed, in the tiebreaker order you set. The weekend ends and the tables are already right."
        shot={SHOTS.standings}
        url="/seasons/summer-2026/standings"
      />
    ),
  },
  {
    id: "playoffs",
    chapter: "Playoffs",
    render: ({ brand }) => (
      <ShotSlide
        dark
        base={brand.shots}
        eyebrow="Playoffs"
        title={<>Brackets built from <span className="text-[#f24e1e]">what actually happened.</span></>}
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
    render: ({ brand }) => (
      <ShotSlide
        base={brand.shots}
        eyebrow="Referees"
        title={<>A referee pool, <span className="text-[#c2410c]">not a group text.</span></>}
        lead="Referees mark their own availability. Offer a shift to the whole pool or to one person you trust, and the first to accept gets it. They sign the scoresheet at the end."
        shot={SHOTS.referees}
        url="/seasons/summer-2026/referees"
      />
    ),
  },
  {
    id: "waivers",
    chapter: "Waivers",
    light: true,
    render: ({ brand }) => (
      <ShotSlide
        base={brand.shots}
        eyebrow="Waivers"
        title={<>Concussion forms and waivers, <span className="text-[#c2410c]">signed before the first game.</span></>}
        lead="They go out the day the schedule is published, so only teams that are actually playing get asked. Reminders chase whoever has not signed. You can send one yourself any time. On opening day you can see exactly who is still missing."
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
        <Eyebrow>Money</Eyebrow>
        <H>
          Every fee, <span className="text-[#f24e1e]">and who still owes it.</span>
        </H>
        <div className={cn(CARDS, BLOCK)}>
          <Card tone="play" title="Owed, by club" body="Every team fee and where it stands. E-transfers recorded beside card payments, because this is Canada." />
          <Card tone="play" title="Ready for your bookkeeper" body="Revenue by program, what is overdue and how long, and a CSV that opens in QuickBooks or Xero." />
          <Card tone="gold" title="Proof when a club complains" body="Every team's early games, late games and waits, in a report you can send them." />
        </div>
      </div>
    ),
  },
  {
    id: "website",
    chapter: "Your website",
    render: ({ brand }) => (
      <ShotSlide
        dark
        base={brand.shots}
        eyebrow="Your league's website"
        title={<>It writes itself <span className="text-[#f24e1e]">while you run the league.</span></>}
        lead="Every game that gets scored updates the scores, the standings and the leaders, then posts a recap naming the top performers. Your logo, your colours, your news. Next season takes registrations while this one is still playing, and nobody needs an account to read any of it."
        shot={SHOTS.hub}
        url="sportshubone.com/league/summer-2026"
      />
    ),
  },
  {
    id: "audience",
    chapter: "Your audience",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>Who is watching</Eyebrow>
        <H>
          Numbers you can take <span className="text-[#f24e1e]">to a sponsor.</span>
        </H>
        <div className={cn(CARDS, BLOCK)}>
          <Card tone="gold" title="Your audience" body="How many people follow the league, and how that grew since last season." />
          <Card tone="gold" title="Where they go" body="Views by game, by team and by player page. Which recaps got read." />
          <Card tone="gold" title="Live" body="How many watched the championship while it was happening." />
        </div>
        <p className={cn("mt-7 max-w-[60ch]", T.lead, "text-white/72")}>
          A league page that nobody measures is a cost. One you can measure is something you can sell.
        </p>
      </div>
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
          Everyone sees <span className="text-[#c2410c]">their own part</span> of the same season.
        </H>
        <p className={cn("mt-4 max-w-[62ch]", T.lead, "text-[#46506a]")}>
          Move a game and the club, the coach and every family&apos;s calendar all update. There is
          nothing to keep in sync.
        </p>
        <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4", BLOCK)}>
          {[
            ["Clubs", "Their own page, teams, tryouts and fees."],
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
    id: "summary",
    chapter: "Before and after",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <Eyebrow>The whole thing, in one place</Eyebrow>
        <H>What actually changes.</H>
        <div className={cn("grid gap-4 sm:grid-cols-2 sm:gap-6", BLOCK)}>
          <div className="rounded-2xl border border-white/10 bg-[#101d33] p-5 sm:p-7">
            <div className={cn("mb-4 font-mono font-semibold uppercase text-white/40", T.statL)}>Today</div>
            <ul className="flex flex-col gap-2.5">
              {["Team entries chased by email", "Rosters in a spreadsheet", "The schedule built by hand",
                "Changes by phone call", "Scores typed up on Sunday night", "Waivers chased one parent at a time",
                "A website somebody has to update"].map((t) => (
                <li key={t} className={cn("flex gap-3 text-white/45", T.cardBody)}>
                  <span className="mt-[0.55em] h-px w-3 shrink-0 bg-white/25" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#f24e1e]/35 bg-[#1a2b48] p-5 sm:p-7">
            <div className={cn("mb-4 font-mono font-semibold uppercase text-[#f24e1e]", T.statL)}>On SportsHub</div>
            <ul className="flex flex-col gap-2.5">
              {["Clubs enter their own teams", "Rosters locked and versioned", "The schedule built in minutes",
                "One change, everyone told", "Standings right at the buzzer", "Waivers collected and chased for you",
                "A website that writes itself"].map((t) => (
                <li key={t} className={cn("flex gap-3", T.cardBody)}>
                  <svg viewBox="0 0 16 16" className="mt-[0.3em] h-4 w-4 shrink-0 stroke-[#16a34a]" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 8.5l3.2 3.2L13 5" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
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
        <Lead>Walkthroughs of the real product. No login, no form, nothing to install.</Lead>
        <div className={cn(CARDS, BLOCK)}>
          {[
            ["season-planned-to-published", "A season, planned to published", "Gyms, divisions, build, publish."],
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
          We do the setup, we move your data across, and we sit with you through the first weekend.
          You tell us what is wrong with it while it runs.
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

export function LeagueDeck({ brand }: { brand: DeckBrand }) {
  const [i, setI] = useState(0)
  const [menu, setMenu] = useState(false)
  const [visits, setVisits] = useState(0)
  const touch = useRef<{ x: number; y: number } | null>(null)

  /* The story is rebuilt per brand so the deck sent to one league never shows
     another league's name. `tipoff` must stay in the cut: chapter filtering
     drops beats rather than replaying their state, so without it the table
     sits on the pre-game checklist while the caption talks about scoring. */
  const script = useRef<DemoScript | null>(null)
  if (!script.current) {
    const full = makeGameDayStory(brand.league)
    const ids = ["tipoff", "scoring", "family"]
    script.current = {
      ...full,
      chapters: full.chapters.filter((c) => ids.includes(c.id)),
      beats: full.beats.filter((b) => ids.includes(b.chapter)),
    }
  }

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
              n === i ? "z-10 translate-y-0 opacity-100" : "pointer-events-none z-0 translate-y-2 opacity-0",
            )}
          >
            <div className="mx-auto h-full w-full max-w-[1280px]">
              {s.render({ active: n === i, visits, brand, script: script.current as DemoScript })}
            </div>
          </section>
        ))}
      </div>

      <button type="button" aria-label="Previous slide" onClick={() => go(i - 1)}
        className="absolute left-0 top-0 z-20 h-[calc(100%-60px)] w-[8%] cursor-w-resize opacity-0" />
      <button type="button" aria-label="Next slide" onClick={() => go(i + 1)}
        className="absolute right-0 top-0 z-20 h-[calc(100%-60px)] w-[8%] cursor-e-resize opacity-0" />

      <div
        className={cn(
          "relative z-30 flex h-[60px] shrink-0 items-center gap-3 border-t px-4 sm:px-7",
          light ? "border-[#dde3ee] bg-white/85" : "border-white/12 bg-[#0b1628]/90",
        )}
      >
        <span className="h-3 w-3 shrink-0 rounded-sm bg-[#f24e1e]" />
        <span className={cn("min-w-0 flex-1 truncate font-mono font-semibold uppercase tracking-[0.13em]", T.bar, light ? "text-[#79839a]" : "text-white/45")}>
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
