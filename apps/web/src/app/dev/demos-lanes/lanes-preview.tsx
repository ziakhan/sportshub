"use client"

import Link from "next/link"
import { useState } from "react"
import { cn } from "@/components/ui"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import { BrandWordmark } from "@/components/brand/wordmark"
import { DEMOS, type DemoAudience, type DemoEntry } from "../../demos/registry"

/**
 * The lanes preview (see page.tsx). Visual language matches the shipped
 * gallery (demos/gallery.tsx): daylight court header band, white cards on
 * ink-50, gold hover ring, play glyph. What is NEW here:
 *
 *   1. The DOORS replace the top chip row: three large audience cards in the
 *      main panel. One tap opens that audience's lane.
 *   2. A lane is a numbered PATH, not a grid: four or five demos in a
 *      deliberate order, "Start here" on the first, a plain one-line
 *      "what you'll watch" under every title (the subtitles live in
 *      WATCH_LINES below until the ruling moves them into the registry).
 *   3. The rest of that audience's demos sit folded under "More for …".
 *
 * Doors carry the gallery's audience tones: clubs hoop, leagues court,
 * families play. Icons are hand-authored SVG per the asset law.
 */

/** One plain line per demo: what you will actually watch. */
const WATCH_LINES: Record<string, string> = {
  "claim-your-club":
    "Find your club's page, prove it's yours with one email, and make it wear your colours.",
  "roster-story":
    "Post a tryout, send five offers in one press, and watch the roster fill itself with sizes and numbers.",
  "money-picture":
    "Every dollar owed on one table, and cash taken at the door recorded in one press.",
  "game-day":
    "A scorekeeper's taps landing on a parent's phone while the game runs, tip-off to signed final.",
  "season-planned-to-published":
    "A whole season planned on one board and published to every family's phone at once.",
  "schedule-change":
    "One game moves, and every phone, inbox and calendar finds out in seconds.",
  "standings-to-playoffs":
    "Standings that settle themselves and a playoff bracket the product draws for you.",
  "the-referees":
    "A day of games offered to your whole pool, first accept wins, and the pay adds itself up.",
  "your-week":
    "Two kids, one list, and the fee and the waiver handled on the same phone.",
  "players-season":
    "A page for your kid: the game log, the averages, and a card worth sharing.",
  "everyone-in-the-loop":
    "One message from the coach reaches every phone, and a poll settles the tournament in the open.",
  waivers:
    "One document sent to every family, signed on a phone in a minute, tracked on one board.",
  "team-drops-out":
    "A team leaves mid-season and the schedule heals itself, adding only the missing games.",
}

interface Lane {
  audience: DemoAudience
  door: string
  doorSub: string
  /** "More for clubs" / "More for leagues" / "More for families". */
  moreLabel: string
  /** Ordered path slugs, the curated "start here" run. */
  path: string[]
  /** Folded below the path. */
  more: string[]
  tone: {
    text: string
    bg: string
    ring: string
    chip: string
  }
}

const LANES: Lane[] = [
  {
    audience: "clubs",
    door: "I run a club",
    doorSub: "Your page, tryouts, rosters and the money.",
    moreLabel: "More for clubs",
    path: ["claim-your-club", "roster-story", "money-picture", "game-day"],
    more: ["everyone-in-the-loop", "waivers", "team-drops-out"],
    tone: {
      text: "text-hoop-700",
      bg: "bg-hoop-50",
      ring: "ring-hoop-200",
      chip: "bg-hoop-600",
    },
  },
  {
    audience: "leagues",
    door: "I run a league",
    doorSub: "Seasons, schedules, standings and referees.",
    moreLabel: "More for leagues",
    path: [
      "season-planned-to-published",
      "schedule-change",
      "standings-to-playoffs",
      "the-referees",
      "game-day",
    ],
    more: ["waivers", "team-drops-out"],
    tone: {
      text: "text-court-700",
      bg: "bg-court-50",
      ring: "ring-court-200",
      chip: "bg-court-600",
    },
  },
  {
    audience: "parents",
    door: "I'm a parent or player",
    doorSub: "The week, the games and your kid's page.",
    moreLabel: "More for families",
    path: ["your-week", "game-day", "players-season"],
    more: ["everyone-in-the-loop", "money-picture", "waivers"],
    tone: {
      text: "text-play-700",
      bg: "bg-play-50",
      ring: "ring-play-200",
      chip: "bg-play-600",
    },
  },
]

const bySlug = new Map(DEMOS.map((d) => [d.slug, d]))
const demoOf = (slug: string): DemoEntry => {
  const d = bySlug.get(slug)
  if (!d) throw new Error(`lanes preview: unknown slug ${slug}`)
  return d
}

/** "1 min 45 sec" → seconds, for the lane's total. */
function seconds(label: string): number {
  const m = /(\d+)\s*min(?:\s*(\d+)\s*sec)?/.exec(label)
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0)
  const s = /(\d+)\s*sec/.exec(label)
  return s ? Number(s[1]) : 0
}

function laneMinutes(lane: Lane): number {
  const total = lane.path.reduce((sum, slug) => sum + seconds(demoOf(slug).durationLabel), 0)
  return Math.round(total / 60)
}

function shortDuration(label: string): string {
  const m = /(\d+)\s*min(?:\s*(\d+)\s*sec)?/.exec(label)
  if (!m) return label
  return `${m[1]}:${(m[2] ?? "0").padStart(2, "0")}`
}

/** Hand-authored door marks: crest, bracket, phone. Stroke style, themable. */
function DoorMark({ audience, className }: { audience: DemoAudience; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  }
  if (audience === "clubs") {
    return (
      <svg {...common}>
        <path d="M12 3 5 5.5v6c0 4.4 3 7.6 7 9.5 4-1.9 7-5.1 7-9.5v-6L12 3z" />
        <circle cx="12" cy="11" r="3.2" />
        <path d="M9.4 9.6c1.6 1 3.6 1 5.2 0M9.4 12.4c1.6-1 3.6-1 5.2 0" strokeWidth="1.2" />
      </svg>
    )
  }
  if (audience === "leagues") {
    return (
      <svg {...common}>
        <path d="M4 5h5v4H4zM4 15h5v4H4zM15 10h5v4h-5z" />
        <path d="M9 7h2.5v10H9M11.5 12H15" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <circle cx="12" cy="11" r="3" />
      <path d="M9.8 9.8c1.4.8 3 .8 4.4 0M9.8 12.2c1.4-.8 3-.8 4.4 0" strokeWidth="1.1" />
      <path d="M10.5 18.5h3" />
    </svg>
  )
}

export function DemoLanesPreview() {
  const [laneKey, setLaneKey] = useState<DemoAudience | null>(null)
  const lane = LANES.find((l) => l.audience === laneKey) ?? null

  return (
    <div className="min-h-[100dvh] bg-ink-50 text-ink-950">
      {/* ── Header band: same daylight court as the shipped gallery ──────── */}
      <header className="relative isolate overflow-hidden border-b border-ink-100 bg-white">
        <CourtBackdropLayer variant="daylight" intensity="band" />
        <div className="relative z-10 mx-auto w-full max-w-[1120px] px-4 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold-500/70"
            aria-label="SportsHub One home"
          >
            <BrandWordmark size="sm" />
          </Link>
          <p className="mt-5 text-[14px] font-bold uppercase tracking-[0.2em] text-hoop-600">
            See it work
          </p>
          <h1 className="font-display mt-2 text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-[42px]">
            Product demos
          </h1>
          <p className="mt-2.5 max-w-xl text-[16px] leading-relaxed text-ink-600">
            Short walkthroughs of the real screens. Nothing to install, nothing to sign
            up for.
          </p>
        </div>
      </header>

      <main className="relative isolate">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-7 sm:py-10">
          {!lane ? <Doors onPick={setLaneKey} /> : <LaneView lane={lane} onBack={() => setLaneKey(null)} />}

          <p className="mt-12 border-t border-ink-200 pt-5 text-[14px] leading-relaxed text-ink-400">
            Every demo runs on a sample club and league. Real accounts, rosters and
            payments are never shown, and nothing here needs a sign in.
          </p>
        </div>
      </main>
    </div>
  )
}

/* ── The doors ───────────────────────────────────────────────────────────── */

function Doors({ onPick }: { onPick: (a: DemoAudience) => void }) {
  return (
    <div>
      <h2 className="font-display text-[22px] font-extrabold tracking-tight sm:text-[26px]">
        Who&apos;s watching?
      </h2>
      <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-ink-500">
        Pick your seat and we&apos;ll line up the demos worth your next ten minutes, in
        order.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {LANES.map((lane) => (
          <button
            key={lane.audience}
            type="button"
            onClick={() => onPick(lane.audience)}
            className={cn(
              "group flex cursor-pointer flex-col items-start rounded-3xl bg-white p-6 text-left ring-1 ring-ink-100",
              "shadow-sm outline-none transition-all duration-200",
              "hover:-translate-y-0.5 hover:shadow-lg hover:ring-gold-500/60",
              "focus-visible:ring-2 focus-visible:ring-gold-500",
              "motion-reduce:transform-none motion-reduce:transition-none"
            )}
          >
            <span
              className={cn(
                "grid h-12 w-12 place-items-center rounded-2xl ring-1",
                lane.tone.bg,
                lane.tone.ring,
                lane.tone.text
              )}
            >
              <DoorMark audience={lane.audience} className="h-6 w-6" />
            </span>
            <span className="font-display mt-4 text-[21px] font-extrabold leading-tight sm:text-[23px]">
              {lane.door}
            </span>
            <span className="mt-1 text-[14.5px] leading-relaxed text-ink-500">
              {lane.doorSub}
            </span>
            <span className="mt-4 text-[12.5px] font-bold uppercase tracking-[0.14em] text-ink-400">
              {lane.path.length} demos · about {laneMinutes(lane)} minutes
            </span>
            <span
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold transition-colors",
                lane.tone.text
              )}
            >
              Start watching
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      <p className="mt-6 text-[14.5px] text-ink-500">
        Just browsing?{" "}
        <Link
          href="/demos"
          className="font-semibold text-play-700 underline-offset-2 hover:underline"
        >
          See all thirteen demos
        </Link>
      </p>
    </div>
  )
}

/* ── One lane: the numbered path, then the folded rest ───────────────────── */

function LaneView({ lane, onBack }: { lane: Lane; onBack: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-[14px] font-semibold text-ink-500 outline-none transition-colors hover:text-ink-800 focus-visible:ring-2 focus-visible:ring-gold-500"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Who&apos;s watching
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={cn(
            "grid h-11 w-11 place-items-center rounded-2xl ring-1",
            lane.tone.bg,
            lane.tone.ring,
            lane.tone.text
          )}
        >
          <DoorMark audience={lane.audience} className="h-5.5 w-5.5" />
        </span>
        <div>
          <h2 className="font-display text-[24px] font-extrabold tracking-tight sm:text-[28px]">
            {lane.door}
          </h2>
          <p className="text-[14.5px] text-ink-500">
            {lane.path.length} demos in order · about {laneMinutes(lane)} minutes
            all the way through
          </p>
        </div>
      </div>

      <ol className="mt-6 space-y-3">
        {lane.path.map((slug, i) => (
          <PathCard key={slug} demo={demoOf(slug)} index={i} lane={lane} />
        ))}
      </ol>

      {lane.more.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg text-[15px] font-bold text-ink-700 outline-none transition-colors hover:text-ink-950 focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                moreOpen && "rotate-90",
                "motion-reduce:transition-none"
              )}
              aria-hidden="true"
            >
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {lane.moreLabel}
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink-400">
              {lane.more.length} more
            </span>
          </button>
          {moreOpen && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lane.more.map((slug) => (
                <MoreCard key={slug} demo={demoOf(slug)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PathCard({ demo, index, lane }: { demo: DemoEntry; index: number; lane: Lane }) {
  const first = index === 0
  return (
    <li>
      <Link
        href={`/demos/${demo.slug}`}
        className={cn(
          "group flex items-start gap-4 rounded-2xl bg-white p-5 ring-1 ring-ink-100 sm:gap-5 sm:p-6",
          "shadow-sm outline-none transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-lg hover:ring-gold-500/60",
          "focus-visible:ring-2 focus-visible:ring-gold-500",
          "motion-reduce:transform-none motion-reduce:transition-none"
        )}
      >
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-extrabold text-white",
            lane.tone.chip
          )}
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-ink-400">
              {shortDuration(demo.durationLabel)}
            </span>
            {first && (
              <span className="rounded-full bg-gold-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-950">
                Start here
              </span>
            )}
          </span>
          <span className="font-display mt-1 block text-[20px] font-bold leading-tight transition-colors group-hover:text-play-700 sm:text-[22px]">
            {demo.title}
          </span>
          <span className="mt-1 block text-[14.5px] leading-relaxed text-ink-500">
            {WATCH_LINES[demo.slug]}
          </span>
        </span>
        <span
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink-950 transition-colors group-hover:bg-gold-400"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </Link>
    </li>
  )
}

function MoreCard({ demo }: { demo: DemoEntry }) {
  return (
    <Link
      href={`/demos/${demo.slug}`}
      className={cn(
        "group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-ink-100",
        "shadow-sm outline-none transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg hover:ring-gold-500/60",
        "focus-visible:ring-2 focus-visible:ring-gold-500",
        "motion-reduce:transform-none motion-reduce:transition-none"
      )}
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-ink-400">
        {shortDuration(demo.durationLabel)}
      </p>
      <h3 className="font-display mt-1.5 text-[18px] font-bold leading-tight transition-colors group-hover:text-play-700">
        {demo.title}
      </h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-500">
        {WATCH_LINES[demo.slug]}
      </p>
    </Link>
  )
}
