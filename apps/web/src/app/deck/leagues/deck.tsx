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
 * TWO RULES THAT SHAPED IT
 *
 * 1. NO LEAGUE SIZE IS PRINTED ANYWHERE (owner ruling). An earlier deck showed
 *    "146 teams / 725 games" as proof the scheduler scales. A commissioner
 *    running several thousand games reads that as a ceiling, not a floor. The
 *    stat row therefore carries the time and the zeros and no denominator.
 *
 * 2. THE LIVE GAME IS PLAYED, NOT DESCRIBED. Slide `live` mounts the real
 *    game-day demo, the same split-stage script the public demo directory
 *    runs, trimmed to the two chapters that show both sides at once: the table
 *    tapping a play in and the father's phone receiving it.
 *
 *    ⚠️ `DemoPlayer`'s `autoStart` is initial state only, so flipping the prop
 *    on an already-mounted player does nothing. The player is therefore mounted
 *    only while its slide is active and keyed on the visit count, which forces
 *    a fresh mount (and a fresh play) every time the viewer lands on it.
 */

/* Screenshots are real captures of the league console, written to
   public/deck by the capture pass. Dimensions are declared so the slide never
   reflows while one decodes. */
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

/** Play a subset of a script's chapters. Mirrors the helper in the demo
 *  directory's runner; each half must open on a beat that sets its own stage. */
function chaptersOf(script: DemoScript, ids: string[]): DemoScript {
  return {
    ...script,
    chapters: script.chapters.filter((c) => ids.includes(c.id)),
    beats: script.beats.filter((b) => ids.includes(b.chapter)),
  }
}

/* Both surfaces on screen together, stopping at the whistle: "buzzer" and
 * "story" are the sign-off and the recap, which the deck covers elsewhere.
 *
 * ⚠️ "tipoff" is in the cut and must stay. `chaptersOf` drops beats entirely
 * rather than replaying their patches, and the console state is accumulated
 * from them. Cutting to ["scoring", "family"] alone left the table sitting on
 * the game-day checklist while the caption read "Two taps a play", because the
 * beats that walk it through roll call and the starting fives had been removed.
 * A chapter cut is only safe when its opening beat sets its own stage. */
const LIVE_CUT = chaptersOf(gameDayStory, ["tipoff", "scoring", "family"])

/* ── slide primitives ──────────────────────────────────────────────────── */

function Eyebrow({ children, dark = true }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={cn(
        "mb-4 flex items-center gap-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em]",
        dark ? "text-[#f24e1e]" : "text-[#c2410c]",
      )}
    >
      <span className={cn("h-[3px] w-6 rounded-sm", dark ? "bg-[#f24e1e]" : "bg-[#c2410c]")} />
      {children}
    </p>
  )
}

function H({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "font-display max-w-[20ch] text-balance text-[clamp(1.6rem,3.4vw,2.7rem)] font-extrabold leading-[1.06] tracking-[-0.03em]",
        className,
      )}
    >
      {children}
    </h2>
  )
}

function Lead({ children, dark = true }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={cn(
        "mt-2 max-w-[60ch] text-[clamp(0.9rem,1.35vw,1.13rem)] leading-[1.45] sm:mt-3 sm:leading-[1.5]",
        dark ? "text-white/70" : "text-[#4a5468]",
      )}
    >
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
        "rounded-2xl border p-3 sm:p-5",
        dark ? "border-white/12 bg-[#16253f]" : "border-[#dde3ee] bg-white shadow-sm",
      )}
    >
      <span className={cn("mb-3 block h-2 w-2 rounded-sm", dot)} />
      <b className="block text-[clamp(0.92rem,1.15vw,1.02rem)] font-bold leading-tight tracking-[-0.015em]">
        {title}
      </b>
      <span
        className={cn(
          "mt-1.5 block text-[clamp(0.82rem,1vw,0.93rem)] leading-[1.5]",
          dark ? "text-white/65" : "text-[#4a5468]",
        )}
      >
        {body}
      </span>
    </div>
  )
}

/** A screenshot in browser chrome. `contain` keeps the whole shot on screen. */
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
          "flex shrink-0 items-center gap-1.5 border-b px-3 py-2",
          dark ? "border-white/12 bg-[#12203a]" : "border-[#dde3ee] bg-[#eef1f7]",
        )}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-2 w-2 rounded-full", dark ? "bg-white/20" : "bg-[#c3cbdb]")} />
        ))}
        <span
          className={cn(
            "ml-2 truncate rounded px-2.5 py-0.5 font-mono text-[10px]",
            dark ? "bg-white/5 text-white/45" : "bg-white text-[#79839a]",
          )}
        >
          {url}
        </span>
      </div>
      {/* object-contain + object-top: the whole capture stays on the slide at
          any viewport instead of being cropped to fit a fixed box. */}
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

function Stat({ n, label, gold = false }: { n: string; label: string; gold?: boolean }) {
  return (
    <div>
      <div
        className={cn(
          "font-display text-[clamp(1.9rem,4.2vw,3.1rem)] font-extrabold leading-none tracking-[-0.04em] tabular-nums",
          gold ? "text-[#f6b73c]" : "text-[#f24e1e]",
        )}
      >
        {n}
      </div>
      <div className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
      </div>
    </div>
  )
}

const GRID_2 = "mt-4 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3"
const GRID_3 = "mt-4 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3"

/* ── the slides ────────────────────────────────────────────────────────── */

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
          className="mb-8 h-8 w-auto sm:h-10"
        />
        <Eyebrow>For league operators</Eyebrow>
        <h1 className="font-display text-balance text-[clamp(2.1rem,5.6vw,4.2rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">
          Run the whole season
          <br />
          <span className="text-[#f24e1e]">in one place.</span>
        </h1>
        <Lead>
          Registration, divisions, the schedule, game day, standings, playoffs, referees, waivers
          and fees. One console for the league. One calendar for every family. One public page the
          whole city can read without an account.
        </Lead>
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
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
        <H>
          Nobody is fighting the sport.
          <br />
          They are fighting <span className="text-[#f24e1e]">the admin.</span>
        </H>
        <div className={GRID_2}>
          <Card title="The schedule goes out late" body="Gyms get confirmed in pieces, so the calendar lands weeks after families have already booked their lives around nothing." />
          <Card title="Then it changes" body="One flooded gym on a Saturday morning turns into forty phone calls and a reprinted sheet nobody reads." />
          <Card title="Everything gets re-typed" body="The same players, the same contacts, entered again into every form the league sends out." />
          <Card title="Parents dig" body="Game time, gym address, jersey colour. Buried somewhere in a three-hundred-message group chat." />
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
        <Lead>
          The console walks the league through every step and keeps a checklist of what is done and
          what still needs you.
        </Lead>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Plan", "gyms booked early"],
            ["Register", "clubs enter teams"],
            ["Approve", "one queue, fees attach"],
            ["Divisions", "drag and drop"],
            ["Schedule", "a season in seconds"],
            ["Publish", "locked before tip-off"],
            ["Play", "live scoring, sign-off"],
            ["Standings", "update themselves"],
            ["Playoffs", "brackets from results"],
            ["Renew", "next season, one click"],
          ].map(([t, s], i) => (
            <div key={t} className="rounded-xl border border-white/12 bg-[#16253f] p-3">
              <div className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#f24e1e]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <b className="mt-1.5 block text-[0.95rem] font-bold tracking-[-0.01em]">{t}</b>
              <em className="mt-0.5 block text-[0.8rem] not-italic leading-snug text-white/45">{s}</em>
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
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <Eyebrow dark={false}>The league console</Eyebrow>
          <H>
            One queue, <span className="text-[#c2410c]">not an inbox.</span>
          </H>
          <Lead dark={false}>
            Clubs apply to your season and register their own teams under that entry. Your
            application questions travel with it, your fees attach at entry, and a checklist tells
            you what is still waiting.
          </Lead>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <Browser shot={SHOTS.overview} url="sportshubone.com/manage/leagues/summer-2026" dark={false} />
        </div>
      </div>
    ),
  },
  {
    id: "plan",
    chapter: "Planning",
    light: true,
    render: () => (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <Eyebrow dark={false}>Pre-season planning</Eyebrow>
          <H>
            Plan the season <span className="text-[#c2410c]">before it exists.</span>
          </H>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <Browser shot={SHOTS.plan} url="/seasons/summer-2026/plan" dark={false} />
        </div>
        <div className={cn(GRID_2, "shrink-0 lg:grid-cols-4")}>
          <Card dark={false} tone="play" title="Your buildings on a board" body="Home gyms and rented gyms on a drag-and-drop season calendar." />
          <Card dark={false} tone="play" title="Fits or it does not, live" body="Every weekend shows games needed against slots booked." />
          <Card dark={false} tone="play" title="What you still need to book" body="The exact court hours you are short, totalled month by month." />
          <Card dark={false} tone="play" title="Plan B without risk" body="Several plans side by side. Drafts never touch the live season." />
        </div>
      </div>
    ),
  },
  {
    id: "schedule",
    chapter: "Scheduling",
    render: () => (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <Eyebrow>Scheduling</Eyebrow>
          <H className="max-w-[26ch]">
            A full season, scheduled in about <span className="text-[#f24e1e]">fifteen seconds.</span>
          </H>
          <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
            <Stat n="~15s" label="To build a season" />
            <Stat n="0" label="Double-booked courts" gold />
            <Stat n="0" label="Back-to-back games" gold />
            <Stat n="0" label="Repeat weekend matchups" gold />
          </div>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
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
          The scheduler keeps a running tally of what each team has been asked to put up with, and
          it costs itself more every time it loads one more thing onto a team that has already had a
          rough run. Misery never stacks on the same families.
        </Lead>
        <div className={GRID_3}>
          <Card tone="green" title="Never back to back" body="No team plays two games in a row. Not once, across the whole season." />
          <Card tone="green" title="No all-day waits" body="A short breather between games is fine. Long dead gaps count against the schedule." />
          <Card tone="green" title="Early and late, shared" body="First tip-offs and last finishes spread evenly instead of landing on the same team." />
          <Card tone="green" title="One building per grade" body="A grade lives in one gym per weekend, all its divisions together, so a family learns one drive." />
          <Card tone="green" title="No two-gym days" body="A team never bounces between buildings in a day. Carpools and siblings arrive together." />
          <Card tone="green" title="No repeat weekends" body="The same two teams never meet twice inside one weekend." />
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
        <H>
          Schedules change.
          <br />
          <span className="text-[#f24e1e]">Phone trees are optional now.</span>
        </H>
        <div className={GRID_2}>
          <Card tone="play" title="Move, cancel, reschedule" body="One change in the console. Every affected family is notified and every synced calendar corrects itself." />
          <Card tone="play" title="Late teams and early exits" body="A team joins in week three or drops out, and the schedule adapts with minimal churn. Most games do not move." />
          <Card tone="play" title="Travelling teams, handled" body="A far team asks for early Sunday games. You see what granting it costs everyone else, then decide." />
          <Card tone="play" title="Before publishing, changes are free" body="More teams than planned? Update and regenerate. Families only ever see the published version." />
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
            slide's header is deliberately the tightest in the deck: a single
            line under the title. Anything more and the caption bar clips. */}
        <div className="shrink-0">
          <Eyebrow dark={false}>Game day, both sides at once</Eyebrow>
          <h2 className="font-display text-balance text-[clamp(1.4rem,2.8vw,2.2rem)] font-extrabold leading-[1.06] tracking-[-0.03em]">
            The table taps it in.{" "}
            <span className="text-[#c2410c]">His phone already knows.</span>
          </h2>
          <p className="mt-1.5 text-[clamp(0.85rem,1.15vw,1rem)] leading-snug text-[#4a5468]">
            On the left, the scorer&apos;s table. On the right, a father forty minutes away.
          </p>
        </div>
        <div className="mt-2.5 flex min-h-0 flex-1 flex-col">
          {/* Mounted only while this slide is showing: the player autoplays on
              mount, and `autoStart` cannot be flipped after the fact. The key
              forces a fresh run each time the viewer comes back to the slide. */}
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
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <Eyebrow dark={false}>Standings</Eyebrow>
          <H>
            Standings <span className="text-[#c2410c]">nobody has to compute.</span>
          </H>
          <Lead dark={false}>
            Wins, losses and points flow straight from signed-off scoresheets, with your tiebreakers
            applied. The weekend ends and the tables are already right.
          </Lead>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <Browser shot={SHOTS.standings} url="/seasons/summer-2026/standings" dark={false} />
        </div>
      </div>
    ),
  },
  {
    id: "playoffs",
    chapter: "Playoffs",
    render: () => (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <Eyebrow>Playoffs</Eyebrow>
          <H className="max-w-[24ch]">
            Brackets that respect <span className="text-[#f24e1e]">how you built the season.</span>
          </H>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <Browser shot={SHOTS.playoffs} url="/seasons/summer-2026/playoffs" />
        </div>
        <div className={cn(GRID_3, "shrink-0")}>
          <Card title="Seeded from real results" body="The moment the regular season closes, from games the table actually signed off." />
          <Card title="Nobody's season ends at 9am" body="Consolation rounds guarantee every team more than one playoff game." />
          <Card title="Scheduled before it is seeded" body="The bracket sits on real weekends in real gyms early. Team names fill in as results land." />
        </div>
      </div>
    ),
  },
  {
    id: "referees",
    chapter: "Referees",
    light: true,
    render: () => (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <Eyebrow dark={false}>Referees</Eyebrow>
          <H>
            A referee pool, <span className="text-[#c2410c]">not a group text.</span>
          </H>
          <Lead dark={false}>
            Referees mark their own availability, so you see the real pool. Broadcast a shift to
            everyone or target one person you trust, and the first accept wins it.
          </Lead>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <Browser shot={SHOTS.referees} url="/seasons/summer-2026/referees" dark={false} />
        </div>
      </div>
    ),
  },
  {
    id: "waivers",
    chapter: "Waivers",
    light: true,
    render: () => (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <Eyebrow dark={false}>Waivers</Eyebrow>
          <H>
            Signed <span className="text-[#c2410c]">before the first whistle.</span>
          </H>
          <Lead dark={false}>
            Your documents, whatever your league requires. Ontario&apos;s Rowan&apos;s Law
            concussion acknowledgement is included. On approval they email every rostered parent,
            and reminders chase the rest.
          </Lead>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <Browser shot={SHOTS.waivers} url="/seasons/summer-2026/waivers" dark={false} />
        </div>
      </div>
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
        <div className={GRID_2}>
          <Card tone="play" title="Obligations per club" body="Every team fee owed, by club, with status at a glance. Waives and refunds live in the ledger, not in someone's memory." />
          <Card tone="play" title="E-transfer and card" body="Record and reconcile e-transfers, or take cards through Stripe. This is Canada, so both." />
          <Card tone="play" title="Reports that export" body="Transactions, revenue per program, aging on what is overdue, and CSV for QuickBooks or Xero." />
          <Card tone="play" title="Reach everyone in one click" body="The whole league, one club, one grade or one team. Payment and waiver reminders send themselves." />
          <Card tone="gold" title="Know your league by the numbers" body="Registration funnel, schedule health, court hours booked against used, and division parity with re-tiering evidence for next season." />
          <Card tone="gold" title="A fairness report card" body="Every team's early games, late games and waits, straight from the scheduler. Show it to the club that complains." />
        </div>
      </div>
    ),
  },
  {
    id: "hub",
    chapter: "Public page",
    render: () => (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <Eyebrow>The public hub</Eyebrow>
          <H>
            Your league&apos;s <span className="text-[#f24e1e]">front door.</span>
          </H>
          <Lead>
            A branded page families, grandparents and recruiters read without making an account.
            Live scores, standings, leaders, news as cards, and next season taking registrations
            while this one is still running.
          </Lead>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <Browser shot={SHOTS.hub} url="sportshubone.com/league/summer-2026" />
        </div>
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
          Everyone sees <span className="text-[#c2410c]">their slice</span> of the same season.
        </H>
        <Lead dark={false}>
          One data source underneath all of it. When the league moves a game, the club sees it, the
          coach sees it, and every family&apos;s calendar corrects itself. The website and the apps
          never disagree, because there is nothing to keep in sync.
        </Lead>
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#dde3ee] bg-[#dde3ee] lg:grid-cols-4">
          {[
            ["Clubs", "A real home page", "Branded club site on its own address, teams and staff, tryouts, camps, registration and fees."],
            ["Coaches", "Their team, nothing else", "Roster, team chat, RSVPs, practices, and the scoring console at the table. Not your books."],
            ["Parents", "One calendar", "Every kid's games and practices in one place, one tap to RSVP, waivers signed and fees paid online."],
            ["Players", "A page of their own", "Season stats that build game by game. The kind of page a senior actually sends to a recruiter."],
            ["Referees", "Availability and shifts", "Set when they can work, accept offers, carry their own calendar, sign the scoresheet."],
            ["Trainers", "Their own listing", "Public profile, bookings and payments, instead of running a business out of Instagram DMs."],
            ["Scorekeepers", "A game-scoped login", "For the volunteer at the table. That one game, and nothing else in the system."],
            ["The public", "No account at all", "Scores, standings, club pages and recaps are open. Grandparents welcome."],
          ].map(([role, title, body]) => (
            <div key={role} className="bg-white p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#4f46e5]">{role}</div>
              <b className="mt-2 block text-[0.98rem] font-bold tracking-[-0.015em] text-[#0f1728]">{title}</b>
              <span className="mt-1 block text-[0.85rem] leading-[1.5] text-[#4a5468]">{body}</span>
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
          Every one of these is a click-through walkthrough of the real product. No login, no form,
          nothing to install.
        </Lead>
        <div className={GRID_3}>
          {[
            ["season-planned-to-published", "A season, planned to published", "Gyms, divisions, generate, publish. The whole build in one pass."],
            ["schedule-change", "A game moves on Friday night", "One edit, and the notification that keeps a family off the road."],
            ["team-drops-out", "A team drops out in week three", "Repairing a live season without moving everything."],
            ["standings-to-playoffs", "Standings into playoff brackets", "Seeding from real results onto booked weekends."],
            ["the-referees", "Booking the referee pool", "Availability, a broadcast shift, first accept wins."],
            ["money-picture", "Where the money is", "What each club owes, what landed, what exports."],
          ].map(([slug, title, body]) => (
            <a
              key={slug}
              href={`https://sportshubone.com/demos/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-white/12 bg-[#16253f] p-3 transition sm:p-4 hover:-translate-y-0.5 hover:border-[#f24e1e] hover:bg-[#1a2b48]"
            >
              <div className="flex items-center justify-between gap-3">
                <b className="text-[0.95rem] font-bold leading-tight tracking-[-0.012em]">{title}</b>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 stroke-[#f24e1e] opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>
              <span className="mt-1.5 block text-[0.85rem] leading-[1.5] text-white/50">{body}</span>
            </a>
          ))}
        </div>
        <p className="mt-5 text-[0.95rem] text-white/60">
          More at{" "}
          <a href="https://sportshubone.com/demos" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#f24e1e]">
            sportshubone.com/demos
          </a>
          , including the club and family side.
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
        <h2 className="font-display max-w-[18ch] text-balance text-[clamp(1.9rem,4.4vw,3.3rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
          One league. One season.
          <br />
          <span className="text-[#f24e1e]">Run live, with us on the hook.</span>
        </h2>
        <Lead>
          We are Canadian, we are built for basketball, and we would rather earn a league than pitch
          one. Give us a season and we will do the setup, the migration and the hand-holding. You
          tell us what is wrong with it while it runs.
        </Lead>
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href="https://sportshubone.com/demos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#f24e1e] px-6 py-3.5 text-[0.95rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#ff6136]"
          >
            Watch a demo
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/25 px-6 py-3.5 text-[0.95rem] font-bold transition hover:border-white/60"
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
  /* Bumped every time a slide is entered, so a remounted demo replays. */
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
      {/* progress */}
      <div className={cn("absolute inset-x-0 top-0 z-30 h-[3px]", light ? "bg-black/8" : "bg-white/10")}>
        <div
          className="h-full bg-gradient-to-r from-[#7c74f5] to-[#f24e1e] transition-[width] duration-300"
          style={{ width: `${((i + 1) / SLIDES.length) * 100}%` }}
        />
      </div>

      {/* the slide */}
      <div className="relative min-h-0 flex-1">
        {SLIDES.map((s, n) => (
          <section
            key={s.id}
            aria-hidden={n !== i}
            className={cn(
              "absolute inset-0 overflow-y-auto px-5 pb-4 pt-9 sm:px-10 sm:pt-12 lg:px-16",
              n === i ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0",
              n === i && "motion-safe:animate-[deckIn_.42s_cubic-bezier(.2,.7,.2,1)]",
            )}
          >
            <div className="mx-auto h-full w-full max-w-[1180px]">
              {s.render({ active: n === i, visits })}
            </div>
          </section>
        ))}
      </div>

      {/* tap zones, behind the bar so buttons still work */}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => go(i - 1)}
        className="absolute left-0 top-0 z-20 h-[calc(100%-56px)] w-[9%] cursor-w-resize opacity-0"
      />
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => go(i + 1)}
        className="absolute right-0 top-0 z-20 h-[calc(100%-56px)] w-[9%] cursor-e-resize opacity-0"
      />

      {/* bottom bar */}
      <div
        className={cn(
          "relative z-30 flex h-14 shrink-0 items-center gap-3 border-t px-4 sm:px-6",
          light ? "border-[#dde3ee] bg-white/85" : "border-white/12 bg-[#0b1628]/90",
        )}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[#f24e1e]" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-mono text-[11px] font-semibold uppercase tracking-[0.13em]",
            light ? "text-[#79839a]" : "text-white/45",
          )}
        >
          {slide.chapter}
        </span>
        <span className={cn("shrink-0 font-mono text-[12px] tabular-nums", light ? "text-[#79839a]" : "text-white/45")}>
          {i + 1} / {SLIDES.length}
        </span>
        {[
          { label: "Contents", onClick: () => setMenu(true) },
          { label: "Back", onClick: () => go(i - 1), disabled: i === 0 },
          { label: "Next", onClick: () => go(i + 1), disabled: i === SLIDES.length - 1 },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.onClick}
            disabled={b.disabled}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-35",
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

      {/* contents */}
      {menu ? (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-[#0b1628]/98 px-6 py-14 text-white sm:px-14">
          <div className="mx-auto max-w-[1000px]">
            <div className="mb-8 flex items-baseline justify-between gap-4">
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em]">Contents</h2>
              <button
                type="button"
                onClick={() => setMenu(false)}
                className="rounded-lg border border-white/15 px-3.5 py-1.5 text-[13px] font-bold transition hover:border-[#f24e1e] hover:text-[#f24e1e]"
              >
                Close
              </button>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {SLIDES.map((s, n) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => { go(n); setMenu(false) }}
                    className={cn(
                      "flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/8",
                      n === i && "bg-white/10",
                    )}
                  >
                    <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums text-white/35">
                      {String(n + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[15px] font-semibold">{s.chapter}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes deckIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}
