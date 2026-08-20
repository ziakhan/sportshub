"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { cn } from "@/components/ui"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import { BrandWordmark } from "@/components/brand/wordmark"
import { DEMOS, type DemoAudience, type DemoEntry } from "./registry"

/**
 * The demo gallery, lanes edition (owner approval 2026-08-19: "deploy this on
 * production") — promoted verbatim from the /dev/demos-lanes preview after
 * two owner review rounds.
 *
 * Shape: no gate, everything on one page. The flagship is one navy band for
 * everyone; each audience is a CLEARLY BOUNDED tinted section holding its
 * numbered path (Start here on the first card, a plain "what you'll watch"
 * line under every title); each demo appears exactly ONCE, so thirteen reads
 * as thirteen. The role picker is the loud element at the top of the main
 * panel: large iconed chips beside search, with a bobbing "Pick your seat"
 * cue (demo-nudge-x, reduced-motion safe) that retires on first pick.
 *
 * Deep links for outreach: /demos/clubs, /demos/leagues and /demos/families
 * redirect here with ?for=<role> ([slug]/page.tsx aliases), which arrives as
 * `initialRole` so a sent link opens already focused on that audience.
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
  "league-rulebook":
    "The tiebreaker ladder written once, and a player ruled on in writing.",
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
  title: string
  sub: string
  /** Numbered, in the recommended watching order. */
  path: string[]
  /** Unnumbered row inside the same boundary. */
  also: string[]
  tone: {
    text: string
    iconBg: string
    ring: string
    chip: string
    /** The section boundary's tinted ground. */
    ground: string
  }
}

/** Every demo exactly once; game-day lives in the flagship band above. */
const LANES: Lane[] = [
  {
    audience: "clubs",
    title: "For clubs",
    sub: "Your page, tryouts, rosters and the money.",
    path: ["claim-your-club", "roster-story", "everyone-in-the-loop", "money-picture"],
    also: [],
    tone: {
      text: "text-hoop-700",
      iconBg: "bg-hoop-50",
      ring: "ring-hoop-200",
      chip: "bg-hoop-600",
      ground: "bg-hoop-50/40",
    },
  },
  {
    audience: "leagues",
    title: "For leagues",
    sub: "Seasons, schedules, standings and referees.",
    path: [
      "season-planned-to-published",
      "schedule-change",
      "standings-to-playoffs",
      "the-referees",
    ],
    also: ["team-drops-out", "waivers", "league-rulebook"],
    tone: {
      text: "text-court-700",
      iconBg: "bg-court-50",
      ring: "ring-court-200",
      chip: "bg-court-600",
      ground: "bg-court-50/40",
    },
  },
  {
    audience: "parents",
    title: "For parents and players",
    sub: "The week, the games and your kid's page.",
    path: ["your-week", "players-season"],
    also: [],
    tone: {
      text: "text-play-700",
      iconBg: "bg-play-50",
      ring: "ring-play-200",
      chip: "bg-play-600",
      ground: "bg-play-50/40",
    },
  },
]

const FLAGSHIP_SLUG = "game-day"

const bySlug = new Map(DEMOS.map((d) => [d.slug, d]))
const demoOf = (slug: string): DemoEntry => {
  const d = bySlug.get(slug)
  if (!d) throw new Error(`lanes preview: unknown slug ${slug}`)
  return d
}

function seconds(label: string): number {
  const m = /(\d+)\s*min(?:\s*(\d+)\s*sec)?/.exec(label)
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0)
  const s = /(\d+)\s*sec/.exec(label)
  return s ? Number(s[1]) : 0
}

function laneMinutes(lane: Lane): number {
  const total = [...lane.path, ...lane.also].reduce(
    (sum, slug) => sum + seconds(demoOf(slug).durationLabel),
    0
  )
  return Math.max(1, Math.round(total / 60))
}

function shortDuration(label: string): string {
  const m = /(\d+)\s*min(?:\s*(\d+)\s*sec)?/.exec(label)
  if (!m) return label
  return `${m[1]}:${(m[2] ?? "0").padStart(2, "0")}`
}

function matches(demo: DemoEntry, q: string): boolean {
  if (!q) return true
  return `${demo.title} ${WATCH_LINES[demo.slug] ?? ""} ${demo.promise}`
    .toLowerCase()
    .includes(q)
}

/** Hand-authored role marks: crest, bracket, phone. */
function RoleMark({ audience, className }: { audience: DemoAudience; className?: string }) {
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

const ROLE_FILTERS: { value: DemoAudience | "all"; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "clubs", label: "I run a club" },
  { value: "leagues", label: "I run a league" },
  { value: "parents", label: "Parent or player" },
]

export function DemoLanesGallery({
  initialRole = "all",
}: {
  initialRole?: DemoAudience | "all"
}) {
  const [role, setRole] = useState<DemoAudience | "all">(initialRole)
  const [picked, setPicked] = useState(initialRole !== "all")
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()

  const flagship = demoOf(FLAGSHIP_SLUG)
  const showFlagship = matches(flagship, q)
  const lanes = useMemo(
    () =>
      LANES.filter((lane) => role === "all" || lane.audience === role)
        .map((lane) => ({
          lane,
          path: lane.path.filter((slug) => matches(demoOf(slug), q)),
          also: lane.also.filter((slug) => matches(demoOf(slug), q)),
        }))
        .filter(({ path, also }) => path.length + also.length > 0),
    [role, q]
  )

  const nothing = !showFlagship && lanes.length === 0

  return (
    <div className="min-h-[100dvh] bg-ink-50 text-ink-950">
      {/* ── Header band ─────────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden border-b border-ink-100 bg-white">
        <CourtBackdropLayer variant="daylight" intensity="band" />
        <div className="relative z-10 mx-auto w-full max-w-[1120px] px-4 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
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
            Thirteen short walkthroughs of the real screens. Nothing to install,
            nothing to sign up for.
          </p>
        </div>
      </header>

      <main className="relative isolate">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-7 sm:py-8">
          {/* ── The picker row: loud, with its moving cue ────────────────── */}
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink-100 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
                {!picked && (
                  <span
                    className="flex shrink-0 items-center gap-1.5 text-[14px] font-bold text-gold-600"
                    aria-hidden="true"
                  >
                    Pick your seat
                    <span className="rotate-90 sm:rotate-0">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        className="demo-nudge-x h-5 w-5"
                      >
                        <path
                          d="M4 12h15M14 6l6 6-6 6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </span>
                )}
                <div
                  role="group"
                  aria-label="Show demos for"
                  className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {ROLE_FILTERS.map((f) => {
                    const active = role === f.value
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => {
                          setRole(f.value)
                          setPicked(true)
                        }}
                        className={cn(
                          "inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 text-[14px] font-bold outline-none transition-colors sm:h-11 sm:text-[14.5px]",
                          "focus-visible:ring-2 focus-visible:ring-gold-500",
                          active
                            ? "bg-ink-950 text-white"
                            : "bg-ink-50 text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100 hover:text-ink-900"
                        )}
                        aria-pressed={active}
                      >
                        {f.value !== "all" && (
                          <RoleMark audience={f.value} className="h-4 w-4" />
                        )}
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <SearchField value={query} onChange={setQuery} />
            </div>
          </div>

          {nothing ? (
            <div className="mt-6 rounded-3xl border border-ink-200 bg-white px-6 py-12 text-center">
              <p className="text-[17px] font-bold">Nothing matches that</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink-500">
                Clear the search to see every walkthrough again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setRole("all")
                }}
                className="mt-6 inline-flex cursor-pointer items-center rounded-xl bg-gold-500 px-5 py-3 text-sm font-bold text-ink-950 outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ink-950/40 motion-reduce:transform-none"
              >
                Show everything
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {/* ── The flagship, once, for everyone ─────────────────────── */}
              {showFlagship && <FlagshipSection demo={flagship} />}

              {/* ── The bounded lanes ────────────────────────────────────── */}
              {lanes.map(({ lane, path, also }) => (
                <LaneSection key={lane.audience} lane={lane} path={path} also={also} />
              ))}
            </div>
          )}

          <p className="mt-12 border-t border-ink-200 pt-5 text-[14px] leading-relaxed text-ink-400">
            Every demo runs on a sample club and league. Real accounts, rosters and
            payments are never shown, and nothing here needs a sign in.
          </p>
        </div>
      </main>
    </div>
  )
}

function SearchField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative w-full lg:w-[250px]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search demos"
        aria-label="Search demos"
        className="h-11 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition-colors placeholder:text-ink-400 focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/25"
      />
    </div>
  )
}

/** A hand-authored basketball mark for the everyone section's tile. */
function BallMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5v17" strokeWidth="1.3" />
      <path d="M6 6c3.3 3.3 8.7 3.3 12 0M6 18c3.3-3.3 8.7-3.3 12 0" strokeWidth="1.3" />
    </svg>
  )
}

/**
 * The flagship, in the SAME grammar as everything else (owner 2026-08-19:
 * the navy band read as a page header, not a demo). A bounded gold-tinted
 * section like the audience sections, holding one ordinary white demo card
 * whose leading tile is a gold play button in the slot where the numbered
 * cards carry their number.
 */
function FlagshipSection({ demo }: { demo: DemoEntry }) {
  return (
    <section
      aria-labelledby="lane-everyone"
      className="rounded-[28px] bg-gold-50/50 p-4 ring-1 ring-gold-200 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-gold-600 ring-1 ring-gold-200">
          <BallMark className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2
            id="lane-everyone"
            className="font-display text-[22px] font-extrabold tracking-tight sm:text-[25px]"
          >
            For everyone
          </h2>
          <p className="text-[14px] text-ink-600">
            The one to watch whichever seat is yours.{" "}
            <span className="whitespace-nowrap font-bold uppercase tracking-[0.1em] text-ink-400">
              1 demo · {shortDuration(demo.durationLabel)}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Link
          href={`/demos/${demo.slug}`}
          className={cn(
            "group flex items-start gap-4 rounded-2xl bg-white p-4 ring-1 ring-ink-100 sm:gap-5 sm:p-5",
            "shadow-sm outline-none transition-all duration-200",
            "hover:-translate-y-0.5 hover:shadow-lg hover:ring-gold-500/60",
            "focus-visible:ring-2 focus-visible:ring-gold-500",
            "motion-reduce:transform-none motion-reduce:transition-none"
          )}
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-500 text-ink-950 transition-colors group-hover:bg-gold-400"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-ink-400">
                {shortDuration(demo.durationLabel)}
              </span>
              <span className="rounded-full bg-gold-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-950">
                The big one
              </span>
            </span>
            <span className="font-display mt-1 block text-[19px] font-bold leading-tight transition-colors group-hover:text-play-700 sm:text-[21px]">
              {demo.title}
            </span>
            <span className="mt-1 block text-[14px] leading-relaxed text-ink-500">
              {WATCH_LINES[demo.slug]}
            </span>
          </span>
        </Link>
      </div>
    </section>
  )
}

/** One clearly bounded audience section: tinted ground, numbered path inside. */
function LaneSection({
  lane,
  path,
  also,
}: {
  lane: Lane
  path: string[]
  also: string[]
}) {
  return (
    <section
      aria-labelledby={`lane-${lane.audience}`}
      className={cn("rounded-[28px] p-4 ring-1 sm:p-6", lane.tone.ground, lane.tone.ring)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={cn(
            "grid h-11 w-11 place-items-center rounded-2xl bg-white ring-1",
            lane.tone.ring,
            lane.tone.text
          )}
        >
          <RoleMark audience={lane.audience} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2
            id={`lane-${lane.audience}`}
            className="font-display text-[22px] font-extrabold tracking-tight sm:text-[25px]"
          >
            {lane.title}
          </h2>
          <p className="text-[14px] text-ink-600">
            {lane.sub}{" "}
            <span className="whitespace-nowrap font-bold uppercase tracking-[0.1em] text-ink-400">
              {path.length + also.length} demos · about {laneMinutes(lane)} min
            </span>
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-3">
        {path.map((slug, i) => (
          <PathCard key={slug} demo={demoOf(slug)} index={i} lane={lane} />
        ))}
      </ol>

      {also.length > 0 && (
        <div className="mt-4">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-ink-500">
            Also worth your time
          </p>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            {also.map((slug) => (
              <AlsoCard key={slug} demo={demoOf(slug)} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function PathCard({ demo, index, lane }: { demo: DemoEntry; index: number; lane: Lane }) {
  const first = index === 0
  return (
    <li>
      <Link
        href={`/demos/${demo.slug}`}
        className={cn(
          "group flex items-start gap-4 rounded-2xl bg-white p-4 ring-1 ring-ink-100 sm:gap-5 sm:p-5",
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
          <span className="font-display mt-1 block text-[19px] font-bold leading-tight transition-colors group-hover:text-play-700 sm:text-[21px]">
            {demo.title}
          </span>
          <span className="mt-1 block text-[14px] leading-relaxed text-ink-500">
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

function AlsoCard({ demo }: { demo: DemoEntry }) {
  return (
    <Link
      href={`/demos/${demo.slug}`}
      className={cn(
        "group flex flex-col rounded-2xl bg-white p-4 ring-1 ring-ink-100",
        "shadow-sm outline-none transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg hover:ring-gold-500/60",
        "focus-visible:ring-2 focus-visible:ring-gold-500",
        "motion-reduce:transform-none motion-reduce:transition-none"
      )}
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-ink-400">
        {shortDuration(demo.durationLabel)}
      </p>
      <h3 className="font-display mt-1 text-[17px] font-bold leading-tight transition-colors group-hover:text-play-700">
        {demo.title}
      </h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-500">
        {WATCH_LINES[demo.slug]}
      </p>
    </Link>
  )
}
