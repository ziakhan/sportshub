"use client"

/**
 * Static draft of the pre-launch homepage (owner "go preview", 2026-08-17).
 *
 * Approved plan: hero with rotating slogans + "Coming this fall" + email
 * capture with an identity picker, the replaces story, a real-screenshots band,
 * demo cards reading the /demos registry, a Claim Your Club section, the quiet
 * "everybody does their part" line, and a footer sign-in. No public signup
 * anywhere. Nothing is wired.
 *
 * Copy law (owner, verbatim): nothing may read as AI-generated. No drama, no
 * assumptions about the reader. Straight to the audience. No em-dashes.
 *
 * The slogans are the approved set from the marketing creatives; every one of
 * them lives somewhere on this page.
 */

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { CourtBackdrop } from "@/components/ui"
import { NotifyForm } from "@/components/launch/notify-form"
import { BrandWordmark } from "@/components/brand/wordmark"
import { DEMOS, type DemoAudience } from "@/app/demos/registry"

/* Rotating hero slogans in the owner's priority order (2026-08-17), each with
   its own accent the way the product home page colours "All of it." in gold.
   Clickable: arrows and dots move through them, and a manual move stops the
   auto-advance so a reader is never yanked off a line. */
/* Owner's order (2026-08-17): thesis, discovery, then the join block
   (tryouts, payments), the organize block (calendar, moves), the game block
   (live, stats, news), then the league block. Each line carries a support
   sentence naming what is automatic or instant about it. */
const SLOGANS: { key: string; node: React.ReactNode; sub: React.ReactNode }[] = [
  {
    key: "one-app",
    node: (
      <>
        Youth basketball. <span className="text-gold-400">All of it.</span> <OneBox /> app.
      </>
    ),
    sub: (
      <>
        Registration to final buzzer, <span className="text-gold-400 font-semibold">one login</span>.
      </>
    ),
  },
  {
    key: "discover",
    node: (
      <>
        Discover the <span className="text-gold-400">clubs and programs</span> around you.
      </>
    ),
    sub: (
      <>
        1,325 Canadian clubs <span className="text-gold-400 font-semibold">already listed</span>, with their programs and cities.
      </>
    ),
  },
  {
    key: "rosters",
    node: (
      <>
        Tryouts become <span className="text-court-400">signed, paid rosters</span>.
      </>
    ),
    sub: (
      <>
        Jersey sizes, numbers and payment collected <span className="text-gold-400 font-semibold">the moment a family accepts</span>.
      </>
    ),
  },
  {
    key: "payments",
    node: (
      <>
        Payment plans <span className="text-gold-400">run themselves</span>.
      </>
    ),
    sub: (
      <>
        The deposit at signup, the installments <span className="text-gold-400 font-semibold">on their own dates, automatically</span>.
      </>
    ),
  },
  {
    key: "chat-calendar",
    node: (
      <>
        Team chat, polls, and <span className="text-play-300">one family calendar</span>.
      </>
    ),
    sub: (
      <>
        Both kids, every practice and game, <span className="text-gold-400 font-semibold">one phone</span>.
      </>
    ),
  },
  {
    key: "game-moved",
    node: (
      <>
        <span className="text-hoop-400">Game moved?</span> Everyone already knows.
      </>
    ),
    sub: (
      <>
        Every calendar and phone updates <span className="text-gold-400 font-semibold">instantly</span>. Nobody makes calls.
      </>
    ),
  },
  {
    key: "watch-live",
    node: (
      <>
        Watch every game <span className="text-live-500">live</span>.
      </>
    ),
    sub: (
      <>
        Score, box score, play by play. <span className="text-gold-400 font-semibold">No refresh, it just moves</span>.
      </>
    ),
  },
  {
    key: "potg",
    node: (
      <>
        Full stats, and a <span className="text-gold-400">Player of the Game</span>.
      </>
    ),
    sub: (
      <>
        Every tap at the scorer&apos;s table folds into the box score <span className="text-gold-400 font-semibold">instantly</span>.
      </>
    ),
  },
  {
    key: "in-the-news",
    node: (
      <>
        <span className="text-play-300">Your name</span> in the news.
      </>
    ),
    sub: (
      <>
        Recaps <span className="text-gold-400 font-semibold">write themselves</span> from the official scoring record.
      </>
    ),
  },
  {
    key: "plan-season",
    node: (
      <>
        Plan the season. <span className="text-court-400">Schedule it in one click.</span>
      </>
    ),
    sub: (
      <>
        A whole season generated <span className="text-gold-400 font-semibold">in seconds</span>, conflicts already handled.
      </>
    ),
  },
  {
    key: "already-built",
    node: (
      <>
        Registration to final buzzer, <span className="text-gold-400">already built</span>.
      </>
    ),
    sub: (
      <>
        Team entry, approvals, rosters and fees, <span className="text-gold-400 font-semibold">ready the day you sign in</span>.
      </>
    ),
  },
  {
    key: "standings",
    node: (
      <>
        Standings <span className="text-court-400">settle themselves</span>.
      </>
    ),
    sub: (
      <>
        Updated <span className="text-gold-400 font-semibold">the moment a final goes in</span>, tiebreakers included.
      </>
    ),
  },
  {
    key: "waivers",
    node: (
      <>
        Waivers <span className="text-play-300">chase themselves</span>.
      </>
    ),
    sub: (
      <>
        Reminders go out <span className="text-gold-400 font-semibold">automatically</span> until every signature is in.
      </>
    ),
  },
]

const IDENTITIES = ["Player", "Parent", "Club", "League", "Referee", "Trainer", "Media"] as const
type Identity = (typeof IDENTITIES)[number]

/* Audience pill tones on light cards: parents indigo, clubs orange, leagues green. */
const PILL_TONES: Record<DemoAudience, string> = {
  parents: "bg-play-50 text-play-700 ring-1 ring-play-200",
  clubs: "bg-hoop-50 text-hoop-700 ring-1 ring-hoop-200",
  leagues: "bg-court-50 text-court-700 ring-1 ring-court-200",
}

const AUDIENCE_LABEL: Record<DemoAudience, string> = {
  parents: "Parents",
  clubs: "Clubs",
  leagues: "Leagues",
}

/* The pile the product replaces. Named in full (owner 2026-08-17: "I'm gonna
   name them all"), each one a tool real Canadian clubs run some piece of the
   season on today. */
const THE_PILE = [
  "TeamSnap",
  "TeamLinkt",
  "RAMP",
  "LeagueApps",
  "GameChanger",
  "Exposure Events",
  "JerseyWatch",
  "Spond",
  "SportsEngine",
  "A registration spreadsheet",
  "E-transfer chasing",
  "Paper gamesheets",
  "Email chains",
]

const THE_CHECKLIST = [
  "Registration and payments",
  "Schedules and calendar sync",
  "Live scoring and box scores",
  "Team chat and RSVPs",
  "Standings and playoffs",
  "Referee assignment",
  "Waivers and forms",
]

/* The comparison table (owner 2026-08-17: "name them all... green check marks
   and red X's... we have to be very sure"). Every verdict verified against
   each platform's published feature and pricing pages in the August 2026
   research round (sources in docs/research/tool-feature-matrix-2026-07.md
   and its addendum), taken conservatively: partial covers paid add-ons,
   separate products and shallow versions, and the competitor gets the
   benefit of any doubt. */
type CompareCell = "y" | "p" | "n" | "-"

const COMPARE_COLUMNS = [
  "TeamSnap",
  "TeamLinkt",
  "RAMP",
  "SportsEngine",
  "LeagueApps",
  "GameChanger",
  "Exposure Events",
  "JerseyWatch",
  "Spond",
]

/** cells[0] is always us; the rest follow COMPARE_COLUMNS order. */
const COMPARE_ROWS: { label: string; cells: CompareCell[] }[] = [
  { label: "Registration and payments", cells: ["y", "y", "y", "y", "y", "y", "n", "y", "y", "y"] },
  { label: "Payment plans", cells: ["y", "y", "y", "y", "y", "y", "n", "p", "y", "y"] },
  { label: "Auto scheduling", cells: ["y", "y", "y", "y", "y", "p", "n", "y", "y", "n"] },
  { label: "Standings and playoffs", cells: ["y", "y", "y", "y", "p", "y", "p", "y", "p", "n"] },
  { label: "Referee assignment", cells: ["y", "p", "y", "y", "p", "p", "n", "p", "n", "n"] },
  { label: "Live scoring and box scores", cells: ["y", "p", "p", "y", "p", "n", "y", "p", "n", "n"] },
  { label: "Chat and polls", cells: ["y", "y", "y", "y", "p", "p", "p", "p", "p", "y"] },
  { label: "Family calendar", cells: ["y", "y", "y", "y", "y", "y", "y", "n", "p", "y"] },
  { label: "Waivers", cells: ["y", "p", "y", "y", "y", "y", "n", "y", "y", "y"] },
  { label: "Auto game recaps", cells: ["y", "n", "p", "n", "n", "n", "p", "n", "n", "n"] },
  { label: "Player pages", cells: ["y", "n", "p", "p", "n", "n", "p", "p", "-", "-"] },
  { label: "Club and league pages", cells: ["y", "y", "y", "y", "y", "p", "n", "p", "y", "y"] },
  { label: "Free to start", cells: ["y", "p", "y", "n", "n", "p", "y", "p", "p", "y"] },
]

/* The quiet theme: each role does its own share, the app connects them. */
const PARTS = [
  { role: "League", does: "posts the schedule" },
  { role: "Club", does: "fills its roster" },
  { role: "Referee", does: "takes the assignment" },
  { role: "Scorekeeper", does: "taps the game in" },
  { role: "Parents", does: "just open the app" },
]

type ClaimHit = {
  id: string
  name: string
  city: string | null
  state: string | null
  status: string
}

/**
 * The claim search is real (owner 2026-08-17): results come from the public
 * clubs API and each unclaimed row links straight into the claim flow for
 * that club. No detour through the directory or a details page.
 */
function ClaimSearch() {
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<ClaimHit[]>([])
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const query = q.trim()
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/clubs/public?limit=${query ? 6 : 3}${query ? `&q=${encodeURIComponent(query)}` : ""}`
        )
        if (!res.ok) return
        const data = await res.json()
        setHits(data.clubs ?? [])
        setSearched(!!query)
      } catch {
        /* quiet: the card keeps its last results */
      }
    }, 250)
    return () => window.clearTimeout(handle)
  }, [q])

  return (
    <div className="min-w-0 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-ink-100">
      <label htmlFor="hp-club-search" className="sr-only">
        Search clubs
      </label>
      <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-4 py-3.5 ring-1 ring-ink-200 focus-within:ring-2 focus-within:ring-gold-500/60">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-400">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="hp-club-search"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your club&apos;s name or city"
          className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink-950 placeholder:text-ink-400 focus:outline-none"
        />
      </div>
      <ul className="mt-3 divide-y divide-ink-100">
        {hits.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-4 px-2 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink-950">{row.name}</p>
              <p className="text-[13px] text-ink-500">
                {[row.city, row.state].filter(Boolean).join(", ")}
              </p>
            </div>
            {row.status === "UNCLAIMED" ? (
              <Link
                href={`/claim-club/${row.id}`}
                className="shrink-0 cursor-pointer rounded-full bg-gold-500 px-3.5 py-1.5 text-[13px] font-bold text-ink-950 transition-colors hover:bg-gold-400"
              >
                Claim it
              </Link>
            ) : (
              <span className="shrink-0 rounded-full bg-ink-100 px-3 py-1 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                Claimed
              </span>
            )}
          </li>
        ))}
        {hits.length === 0 && searched && (
          <li className="px-2 py-3 text-[14px] text-ink-500">
            No listing matched. Leave your email or phone and we&apos;ll help you get set up.
          </li>
        )}
        {!searched && <li className="px-2 py-3 text-[13px] text-ink-400">and 1,322 more</li>}
      </ul>
    </div>
  )
}

/** Arrow keys drive whichever carousel is on screen, no focus needed. */
function useArrowNav(
  ref: React.RefObject<HTMLDivElement | null>,
  onPrev: () => void,
  onNext: () => void
) {
  const latest = useRef({ onPrev, onNext })
  latest.current = { onPrev, onNext }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let active = false
    const io = new IntersectionObserver(
      ([e]) => {
        active = e.isIntersecting && e.intersectionRatio > 0.4
      },
      { threshold: [0, 0.4, 1] }
    )
    io.observe(el)
    const onKey = (e: KeyboardEvent) => {
      if (!active) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        latest.current.onPrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        latest.current.onNext()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      io.disconnect()
      window.removeEventListener("keydown", onKey)
    }
  }, [ref])
}

function useSloganRotation(count: number, intervalMs = 4200) {
  const [active, setActive] = useState(0)
  const [interacted, setInteracted] = useState(false)

  useEffect(() => {
    if (interacted) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(() => setActive((a) => (a + 1) % count), intervalMs)
    return () => window.clearInterval(id)
  }, [count, interacted])

  const goTo = (index: number) => {
    setInteracted(true)
    setActive(((index % count) + count) % count)
  }

  return { active, goTo }
}

/** "One" drawn like the logo badge (owner 2026-08-17): the wordmark's orange
 *  box with rounded corners, at whatever text size it sits in. */
function OneBox() {
  return (
    <span className="inline-block rounded-[0.22em] bg-hoop-500 px-[0.24em] align-baseline text-[0.82em] leading-[1.15] text-white">
      One
    </span>
  )
}


function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 10.5l4 4 8-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  const { active, goTo } = useSloganRotation(SLOGANS.length)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [identityWarn, setIdentityWarn] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  useArrowNav(
    heroRef,
    () => goTo(active - 1),
    () => goTo(active + 1)
  )

  return (
    <CourtBackdrop variant="navy" floor="planks" intensity="immersive" className="flex min-h-[100dvh] flex-col" contentClassName="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6">
        <BrandWordmark size="xl" variant="reverse" />
        <nav className="flex items-center gap-6">
          <Link
            href="/demos"
            className="text-[15px] font-semibold text-white/80 transition-colors hover:text-white"
          >
            Watch the demos
          </Link>
          <Link
            href="/sign-in"
            className="text-[15px] font-semibold text-white/60 transition-colors hover:text-white"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <div ref={heroRef}
        className="hp-rise relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <p className="flex items-center gap-3 text-2xl font-bold uppercase tracking-[0.18em] text-gold-400 sm:text-3xl">
          <span className="h-2.5 w-2.5 rounded-full bg-gold-400 motion-safe:animate-pulse" aria-hidden="true" />
          Launching this fall
        </p>

        <button
          type="button"
          onClick={() => goTo(active - 1)}
          aria-label="Previous line"
          className="absolute inset-y-0 left-0 z-20 flex w-10 cursor-pointer items-center justify-center text-white/40 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:w-14 lg:w-16"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-9 w-9 lg:h-12 lg:w-12">
            <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => goTo(active + 1)}
          aria-label="Next line"
          className="absolute inset-y-0 right-0 z-20 flex w-10 cursor-pointer items-center justify-center text-white/40 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:w-14 lg:w-16"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-9 w-9 lg:h-12 lg:w-12">
            <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="relative mt-7 w-full">

          <h1 className="grid w-full text-balance text-[44px] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            {SLOGANS.map((s, i) => (
              <span
                key={s.key}
                aria-hidden={i !== active}
                className={`col-start-1 row-start-1 transition-opacity ${
                  i === active
                    ? "opacity-100 duration-500"
                    : "pointer-events-none opacity-0 duration-300"
                }`}
              >
                {s.node}
              </span>
            ))}
          </h1>

        </div>

        <div className="mt-5 flex items-center gap-2" role="tablist" aria-label="Slogans">
          {SLOGANS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Line ${i + 1}`}
              aria-current={i === active}
              className={`h-2.5 cursor-pointer rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                i === active ? "w-7 bg-gold-400" : "w-2.5 bg-white/25 hover:bg-white/45"
              }`}
            />
          ))}
        </div>

        <p className="mt-7 grid w-full max-w-4xl text-[22px] font-medium leading-relaxed text-white/95 sm:text-[26px]">
          {SLOGANS.map((s, i) => (
            <span
              key={s.key}
              aria-hidden={i !== active}
              className={`col-start-1 row-start-1 transition-opacity ${
                i === active
                  ? "opacity-100 duration-500"
                  : "pointer-events-none opacity-0 duration-300"
              }`}
            >
              {s.sub}
            </span>
          ))}
        </p>

        <div id="notify" className="mt-10 w-full max-w-xl">
          <fieldset className="relative">
            <legend className="mb-3 w-full text-center text-[15px] font-semibold text-white/70">
              I&apos;m here as a <span className="font-normal text-white/45">(pick one)</span>
            </legend>
            {identityWarn && !identity && (
              <span className="absolute -top-2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-full flex-col items-center">
                <span className="whitespace-nowrap rounded-xl bg-gold-500 px-3.5 py-1.5 text-[14px] font-bold text-ink-950 shadow-lg">
                  Please select one.
                </span>
                <span className="h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-gold-500" />
              </span>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {IDENTITIES.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={identity === id}
                  onClick={() => {
                    setIdentity(identity === id ? null : id)
                    setIdentityWarn(false)
                  }}
                  className={`cursor-pointer rounded-full px-4 py-2 text-[15px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    identity === id
                      ? "bg-gold-500 text-ink-950"
                      : "bg-white/10 text-white/85 ring-1 ring-white/20 hover:bg-white/15"
                  }`}
                >
                  {id}
                </button>
              ))}
            </div>
          </fieldset>

          <NotifyForm
            source="landing"
            identity={identity ?? undefined}
            tone="dark"
            className="mt-4"
            blocked={!identity}
            onBlocked={() => setIdentityWarn(true)}
          />

          <p className="mt-3 text-[13px] text-white/55">
            We&apos;ll reach you about the launch and nothing else. Unsubscribe anytime.
          </p>

          {identity === "Club" && (
            <p className="mt-3 rounded-lg bg-gold-500/15 px-4 py-2.5 text-[14px] text-gold-100 ring-1 ring-gold-400/30">
              Run a club? It may already be listed here.{" "}
              <a href="#claim" className="font-semibold text-gold-400 underline underline-offset-2">
                Find it below
              </a>
            </p>
          )}
        </div>

        <Link
          href="/demos"
          className="mt-9 inline-flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-white/25 bg-white/10 px-10 py-4 text-xl font-bold text-white transition-colors hover:border-white/40 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-ink-950" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          Watch the demo now
        </Link>
      </div>
    </CourtBackdrop>
  )
}

/* ── The replaces story ──────────────────────────────────────────────────── */

function ReplacesStory() {
  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-12 px-5 lg:grid-cols-2">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-hoop-600">Today</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">
            <OneBox /> app replaces the pile.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-600">
            Most seasons run on a stack of tools that were never built to talk to each other.
          </p>
          <ul className="mt-6 flex max-w-lg flex-wrap gap-2.5">
            {THE_PILE.map((item) => (
              <li
                key={item}
                className="rounded-full bg-ink-100 px-4 py-2 text-[15px] font-medium text-ink-600 line-through decoration-ink-400/60"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-7 text-lg font-semibold text-ink-950">
            They each do a piece. Nobody does the whole thing.
          </p>
        </div>

        <div className="rounded-2xl bg-ink-950 p-8 shadow-xl sm:p-10">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-white"><OneBox /> app</h3>
            <span className="rounded-full bg-gold-500 px-3 py-1 text-[13px] font-bold uppercase tracking-wide text-ink-950">
              All of it
            </span>
          </div>
          <ul className="mt-6 space-y-3.5">
            {THE_CHECKLIST.map((item) => (
              <li key={item} className="flex items-center gap-3 text-base text-white/90">
                <CheckIcon className="h-5 w-5 shrink-0 text-gold-400" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-8 border-t border-white/10 pt-6 text-base text-white/60">
            &ldquo;Complete&rdquo; isn&apos;t a slogan here. It&apos;s a checklist.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ── The comparison table ────────────────────────────────────────────────── */

function CompareMark({ cell }: { cell: CompareCell }) {
  if (cell === "y") {
    return (
      <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-court-100">
        <CheckIcon className="h-3.5 w-3.5 text-court-700" />
      </span>
    )
  }
  if (cell === "p") {
    return (
      <span
        className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-gold-100"
        title="Partial: a paid add-on, a separate product, or a shallower version"
      >
        <span className="h-2.5 w-2.5 rounded-full border-2 border-gold-600" aria-label="Partial" />
      </span>
    )
  }
  if (cell === "n") {
    // A clear red line (owner 2026-08-17): reads as "not offered" at a
    // glance without shouting, and people who know can still see it.
    return (
      <span
        className="mx-auto block h-[7px] w-10 rounded-full bg-live-500 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]"
        role="img"
        aria-label="Not offered"
      />
    )
  }
  return <span className="text-ink-300 mx-auto block text-center text-sm">–</span>
}

function CompareTable() {
  /* Mobile drops the table (owner 2026-08-17): ten columns cannot read on a
     phone, and the pile section above already carries the replaces message. */
  return (
    <section className="hidden border-y border-ink-100 bg-ink-50 py-14 sm:py-16 md:block">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-court-700">
            Side by side
          </p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">
            How we compare.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">
            Based on each platform&apos;s published features, August 2026. A partial mark means a
            paid add-on, a separate product, or a shallower version.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto rounded-2xl bg-white shadow-xl ring-1 ring-ink-100">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="px-5 py-4 text-[14px] font-bold uppercase tracking-[0.1em] text-ink-400">
                  Feature
                </th>
                <th className="bg-gold-50 px-4 py-4 text-center">
                  <span className="whitespace-nowrap rounded-full bg-ink-950 px-3 py-1 text-[13px] font-bold text-white">
                    SportsHub One
                  </span>
                </th>
                {COMPARE_COLUMNS.map((name) => (
                  <th
                    key={name}
                    className="px-3 py-4 text-center text-[13px] font-bold text-ink-600"
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="whitespace-nowrap px-5 py-3.5 text-[16px] font-semibold text-ink-800">
                    {row.label}
                  </td>
                  {row.cells.map((cell, i) => (
                    <td
                      key={i}
                      className={`px-3 py-3.5 text-center ${i === 0 ? "bg-gold-50" : ""}`}
                    >
                      <CompareMark cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-[14px] text-ink-500">
          Checked against each platform&apos;s published feature and pricing pages, August 2026.
          SportsEngine&apos;s live scoring product excludes basketball; its basketball stats are
          manual entry. Spot something that changed? Tell us and we&apos;ll fix it.
        </p>
      </div>
    </section>
  )
}

/* ── The quiet theme: everybody does their part ──────────────────────────── */

function EverybodyConnects() {
  return (
    <section className="border-y border-ink-100 bg-ink-50 py-10">
      <div className="mx-auto w-full max-w-5xl px-5 text-center">
        <div className="relative mx-auto hidden max-w-4xl items-start justify-between sm:flex">
          <div
            aria-hidden="true"
            className="absolute left-[10%] right-[10%] top-[5px] h-px bg-ink-200"
          />
          {PARTS.map((p) => (
            <div key={p.role} className="relative flex w-1/5 flex-col items-center gap-2 px-2">
              <span className="h-2.5 w-2.5 rounded-full bg-gold-500 ring-4 ring-ink-50" />
              <span className="text-[15px] font-bold text-ink-950">{p.role}</span>
              <span className="text-[13px] leading-snug text-ink-500">{p.does}</span>
            </div>
          ))}
        </div>

        <ul className="mx-auto flex max-w-xs flex-col gap-3 text-left sm:hidden">
          {PARTS.map((p) => (
            <li key={p.role} className="flex items-baseline gap-3">
              <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full bg-gold-500" />
              <span className="text-[15px] font-bold text-ink-950">{p.role}</span>
              <span className="text-[14px] text-ink-500">{p.does}</span>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-ink-700">
          Nobody runs the whole season alone, and nobody has to. Everybody does their part, and
          everything connects.
        </p>
      </div>
    </section>
  )
}

/* ── Real screenshots ────────────────────────────────────────────────────── */

/**
 * The screen slides (owner 2026-08-17): one screen at a time, big, with a
 * hero-style title over each, sliding left and right.
 *
 * Priority order, owner's logic: the claim band and the comparison table
 * above already speak to clubs and leagues, so the slides lead with what
 * families and kids see (the live game, the plays, the recap, the kid's
 * page), then the week-to-week utility, then the league surfaces.
 */
const SCREEN_SLIDES: {
  key: string
  title: React.ReactNode
  caption: string
  src: string
  alt: string
  frame: "phone" | "desktop"
  /** Full-page captures the slide slow-scrolls through; multiple entries
   *  play as tab switches. start/travel are px in the capture's 390-wide
   *  space; start "end" opens at the bottom (the chat slide shows the phone
   *  menus first and drifts up). One-way scrolls, no return. */
  tour?: { src: string; start?: number | "end"; travel?: number; returnTo?: number }[]
  /** The phone's bottom tab bar, pinned by the player (never scrolls away). */
  pinBottom?: string
}[] = [
  {
    key: "discover",
    pinBottom: "/home-preview/tours/tabbar-public.jpg",
    tour: [{ src: "/home-preview/tours/discover.jpg", travel: 1500 }],
    title: (
      <>
        Discover the <span className="text-gold-400">clubs and programs</span> around you.
      </>
    ),
    caption: "Tryouts, camps, house leagues and training, near you.",
    src: "/home-preview/shots/discover-clubs-phone.png",
    alt: "The club directory on a phone: province chips with counts, a Greater Toronto row of cities, and club cards below",
    frame: "phone",
  },
  {
    key: "payments",
    pinBottom: "/home-preview/tours/tabbar.jpg",
    tour: [{ src: "/home-preview/tours/payments.jpg" }],
    title: (
      <>
        Payment plans <span className="text-gold-400">run themselves</span>.
      </>
    ),
    caption: "A deposit at signup, the rest on their own dates, every one receipted.",
    src: "/home-preview/shots/parent-payments-phone.png",
    alt: "A payments page on a phone: a payment plan with deposits and dated installments, each marked paid",
    frame: "phone",
  },
  {
    key: "week",
    pinBottom: "/home-preview/tours/tabbar.jpg",
    tour: [
      { src: "/home-preview/tours/calendar-1.jpg", travel: 900 },
      { src: "/home-preview/tours/calendar-2.jpg", travel: 600 },
    ],
    title: (
      <>
        The <span className="text-gold-400">family week</span>, on one phone.
      </>
    ),
    caption: "Practices, games, and the RSVP right on the row.",
    src: "/home-preview/shots/parent-calendar-phone.png",
    alt: "A family calendar on a phone: practices and games for two kids with RSVP buttons on each row",
    frame: "phone",
  },
  {
    key: "chat",
    pinBottom: "/home-preview/tours/tabbar.jpg",
    tour: [
      { src: "/home-preview/tours/chat-1.jpg", travel: 0 },
      { src: "/home-preview/tours/chat-2.jpg", travel: 0 },
      { src: "/home-preview/tours/chat-3.jpg", travel: 0 },
      { src: "/home-preview/tours/chat-4.jpg", travel: 0 },
    ],
    title: (
      <>
        Team chat, polls, <span className="text-hoop-400">one thread</span>.
      </>
    ),
    caption: "Coaches and parents in one place, and a poll settles Saturday's pizza.",
    src: "/home-preview/shots/parent-team-chat-phone.png",
    alt: "A team chat on a phone: coach messages, a carpool note, and a poll with live results",
    frame: "phone",
  },
  {
    key: "game",
    pinBottom: "/home-preview/tours/tabbar-public.jpg",
    tour: [
      { src: "/home-preview/tours/game-1-live.jpg", returnTo: 440 },
      { src: "/home-preview/tours/game-2-stats.jpg", start: 440, travel: 820 },
      { src: "/home-preview/tours/game-3-pbp.jpg", start: 440, travel: 820 },
    ],
    title: (
      <>
        Watch every game <span className="text-live-500">live</span>.
      </>
    ),
    caption: "One game, the whole page: the scorecard, the leaders, then Team stats and Play-by-play.",
    src: "/home-preview/shots/game-live-scorecard-phone.png",
    alt: "A live game on a phone: the main scorecard with both teams, quarter totals and the venue",
    frame: "phone",
  },
  {
    key: "recap",
    pinBottom: "/home-preview/tours/tabbar-public.jpg",
    tour: [{ src: "/home-preview/tours/recap.jpg", travel: 1400 }],
    title: (
      <>
        Every game gets a <span className="text-gold-400">recap</span>.
      </>
    ),
    caption: "Written from the official scoring record, with a Player of the Game.",
    src: "/home-preview/news-recap-phone.png",
    alt: "A game recap article on a phone: Toronto Lords Grade 10 Girls beat Burlington Force 54 to 33",
    frame: "phone",
  },
  {
    key: "feed",
    pinBottom: "/home-preview/tours/tabbar.jpg",
    tour: [{ src: "/home-preview/tours/feed.jpg" }],
    title: (
      <>
        The season has a <span className="text-play-300">feed</span>.
      </>
    ),
    caption: "Finals, milestones and Player of the Game cards, made to share.",
    src: "/home-preview/shots/social-feed-phone.png",
    alt: "A social feed on a phone: a final score card with likes, comments and reposts, and a Player of the Game card",
    frame: "phone",
  },
  {
    key: "player",
    pinBottom: "/home-preview/tours/tabbar-public.jpg",
    tour: [{ src: "/home-preview/tours/player.jpg" }],
    title: (
      <>
        Every player <span className="text-play-300">gets a page</span>.
      </>
    ),
    caption: "Every player gets a page: season stats, games, and their moments.",
    src: "/home-preview/shots/social-player-page-phone.png",
    alt: "A player's public page on a phone: jersey number 20 mug, Danielle R., Toronto Lords, stat tiles",
    frame: "phone",
  },
  {
    key: "standings",
    title: (
      <>
        Standings <span className="text-court-400">settle themselves</span>.
      </>
    ),
    caption: "Finals go in, the table moves on its own. The league side lives on the big screen.",
    src: "/home-preview/league-desktop.png",
    alt: "A league page on desktop: final scores and standings tables with records, streaks and games back",
    frame: "desktop",
  },
]

const sleepMs = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

/**
 * The scrolling screenshot (owner 2026-08-17): starts at the top of a real
 * full-page capture, slow-scrolls with pauses (pause, roll, pause), returns
 * to the top, then switches to the next segment the way tapping a tab would.
 * Runs only while its slide is active; reduced motion shows the top, still.
 */
function GuidedShot({
  segments,
  alt,
  active,
  pinBottom,
}: {
  segments: { src: string; start?: number | "end"; travel?: number; returnTo?: number }[]
  alt: string
  active: boolean
  pinBottom?: string
}) {
  const [seg, setSeg] = useState(0)
  const [y, setY] = useState(0)
  const yRef = useRef(0)
  const [prev, setPrev] = useState<{ src: string; y: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSeg(0)
    setY(0)
    setPrev(null)
    if (!active) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let cancelled = false

    const tween = (from: number, to: number, ms: number) =>
      new Promise<void>((resolve) => {
        const t0 = performance.now()
        const step = (t: number) => {
          if (cancelled) return resolve()
          const k = Math.min(1, (t - t0) / ms)
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
          const v = from + (to - from) * e
          yRef.current = v
          setY(v)
          if (k < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })

    const run = async () => {
      while (!cancelled) {
        for (let i = 0; i < segments.length && !cancelled; i++) {
          const conf = segments[i]
          setPrev((p) => p)
          setSeg(i)
          await sleepMs(650)
          const img = imgRef.current
          const frame = frameRef.current
          if (!img || !frame) {
            await sleepMs(1500)
            continue
          }
          const ratio = img.clientWidth / 390
          const max = Math.max(0, img.clientHeight - frame.clientHeight)
          const startY =
            conf.start === "end" ? max : Math.min(max, (conf.start ?? 0) * ratio)
          setY(startY)
          await sleepMs(450)
          setPrev(null)
          await sleepMs(1250)
          const travel =
            conf.travel !== undefined ? conf.travel * ratio : max - startY
          const target = Math.max(0, Math.min(max, startY + travel))
          const dist = Math.abs(target - startY)
          if (dist > 24) {
            // Slow roll (owner: "slow scrolls, pause"): ~160px/s, one way.
            await tween(startY, target, Math.max(1800, dist * 6.2))
          }
          await sleepMs(2000)
          if (conf.returnTo !== undefined && !cancelled) {
            // Ride back up to where the next tap happens, so the click is
            // seen before the screen changes (owner 2026-08-17).
            const backTo = Math.min(max, conf.returnTo * ratio)
            await tween(target, backTo, Math.max(1400, Math.abs(target - backTo) * 3))
            await sleepMs(1400)
          }
          if (!cancelled) {
            // Hand this frame to the crossfade layer before the next mounts.
            setPrev({ src: conf.src, y: yRef.current })
          }
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [active, segments])

  return (
    <div ref={frameRef} className="relative aspect-[390/844] w-full overflow-hidden rounded-[1.9rem] bg-white">
      {prev && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={prev.src}
          alt=""
          aria-hidden="true"
          className="absolute left-0 top-0 w-full"
          style={{ transform: `translateY(-${prev.y}px)` }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={segments[seg].src}
        alt={alt}
        className="hp-xfade relative w-full"
        style={{ transform: `translateY(-${y}px)` }}
      />
      {pinBottom && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pinBottom} alt="" aria-hidden="true" className="absolute bottom-0 left-0 w-full" />
      )}
    </div>
  )
}
function SlideImage({
  slide,
  active,
}: {
  slide: (typeof SCREEN_SLIDES)[number]
  active: boolean
}) {
  if (slide.frame === "phone" && slide.tour) {
    return (
      <div className="w-full max-w-[310px] rounded-[2.4rem] bg-ink-900 p-3 shadow-2xl ring-1 ring-white/10">
        <GuidedShot segments={slide.tour} alt={slide.alt} active={active} pinBottom={slide.pinBottom} />
      </div>
    )
  }
  return <SlideImageStatic slide={slide} />
}

function SlideImageStatic({ slide }: { slide: (typeof SCREEN_SLIDES)[number] }) {
  if (slide.frame === "phone") {
    return (
      <div className="w-full max-w-[390px] rounded-[2.4rem] bg-ink-900 p-3 shadow-2xl ring-1 ring-white/10">
        <div className="overflow-hidden rounded-[1.9rem]">
          <Image
            src={slide.src}
            alt={slide.alt}
            width={390}
            height={844}
            loading="eager"
            className="h-auto w-full"
          />
        </div>
      </div>
    )
  }
  return (
    <div className="w-full max-w-[1040px] overflow-hidden rounded-xl bg-ink-900 shadow-2xl ring-1 ring-white/10">
      <div className="flex items-center gap-2 bg-ink-800 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-3 rounded-md bg-ink-950/60 px-3 py-1 text-[12px] text-white/50">
          ysportshub.com
        </span>
      </div>
      <Image
        src={slide.src}
        alt={slide.alt}
        width={1440}
        height={900}
        loading="eager"
        className="h-auto w-full"
      />
    </div>
  )
}

function Screenshots() {
  const { active, goTo } = useSloganRotation(SCREEN_SLIDES.length, 30000)
  const sliderRef = useRef<HTMLDivElement>(null)
  useArrowNav(
    sliderRef,
    () => goTo(active - 1),
    () => goTo(active + 1)
  )

  return (
    <CourtBackdrop variant="navy" floor="planks" intensity="immersive">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-14">
        <div className="text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-gold-400">
            Straight from the app
          </p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            What it looks like.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
            These are screenshots, not mockups. Slide through.
          </p>
        </div>

        <div ref={sliderRef} className="relative mt-10">
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            aria-label="Previous screen"
            className="absolute inset-y-0 left-0 z-20 flex w-10 cursor-pointer items-center justify-center text-white/45 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:w-14 lg:w-20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-10 w-10 lg:h-14 lg:w-14">
              <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(-${active * 100}%)` }}
            >
              {SCREEN_SLIDES.map((slide, i) => (
                <div
                  key={slide.key}
                  aria-hidden={i !== active}
                  className="flex w-full shrink-0 flex-col items-center px-10 sm:px-14"
                >
                  <h3 className="text-balance text-center text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                    {slide.title}
                  </h3>
                  <p className="mt-3 max-w-lg text-center text-[18px] font-semibold leading-relaxed text-white/90">
                    {slide.caption}
                  </p>
                  <div className="mt-5 flex w-full flex-1 items-center justify-center">
                    <SlideImage slide={slide} active={i === active} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label="Next screen"
            className="absolute inset-y-0 right-0 z-20 flex w-10 cursor-pointer items-center justify-center text-white/45 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:w-14 lg:w-20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-10 w-10 lg:h-14 lg:w-14">
              <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2" role="tablist" aria-label="Screens">
          {SCREEN_SLIDES.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Screen ${i + 1}`}
              aria-current={i === active}
              className={`h-2.5 cursor-pointer rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                i === active ? "w-7 bg-gold-400" : "w-2.5 bg-white/25 hover:bg-white/45"
              }`}
            />
          ))}
        </div>
      </div>
    </CourtBackdrop>
  )
}

/* ── Demo cards ──────────────────────────────────────────────────────────── */

function DemoCards() {
  const stories = [...DEMOS.filter((d) => d.kind === "story")].sort(
    (a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))
  )

  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-play-600">
            See it work
          </p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">
            Watch the demos.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">
            {DEMOS.length} short recordings of the real screens doing real work, one to four
            minutes each. No account needed.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {stories.map((demo) => (
            <Link
              key={demo.slug}
              href={`/demos/${demo.slug}`}
              className="group flex cursor-pointer flex-col rounded-2xl border border-ink-100 bg-ink-50/50 p-7 transition-all hover:border-ink-200 hover:shadow-lg"
            >
              <div className="flex flex-wrap items-center gap-2">
                {demo.featured && (
                  <span className="rounded-full bg-gold-500 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-ink-950">
                    Start here
                  </span>
                )}
                {demo.audiences.map((a) => (
                  <span
                    key={a}
                    className={`rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide ${PILL_TONES[a]}`}
                  >
                    {AUDIENCE_LABEL[a]}
                  </span>
                ))}
              </div>
              <h3 className="mt-4 text-2xl font-bold tracking-tight text-ink-950 transition-colors group-hover:text-play-700">
                {demo.title}
              </h3>
              <p className="mt-2.5 line-clamp-2 text-base leading-relaxed text-ink-600">
                {demo.promise}
              </p>
              <p className="mt-auto pt-5 text-[14px] font-semibold text-ink-400">
                {demo.durationLabel} · {demo.chapterCount} chapters
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/demos"
            className="inline-block cursor-pointer rounded-xl bg-ink-950 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-ink-800"
          >
            All {DEMOS.length} demos
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ── Claim your club ─────────────────────────────────────────────────────── */

function ClaimYourClub() {
  return (
    <CourtBackdrop variant="daylight" floor="planks" intensity="band">
      <section id="claim" className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-14">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-hoop-600">
              For clubs
            </p>
            <h2 className="mt-2 text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">
              Claim your club before launch.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-700">
              We imported 1,325 Canadian club listings so families can find them. If one of them
              is yours, claiming it is free: you get the page, the brand and the tools.
            </p>
            <p className="mt-7 text-[15px] font-semibold text-ink-950">
              We&apos;re launching this fall. Be the first to know:
            </p>
            <NotifyForm
              source="landing-claim"
              identity="Club"
              buttonLabel="Tell me first"
              className="mt-3 max-w-lg"
            />
          </div>

          <ClaimSearch />
        </div>
      </section>
    </CourtBackdrop>
  )
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-ink-950 py-14">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-5 text-center">
        <div>
          <BrandWordmark size="xl" variant="reverse" />
          <p className="mt-3 text-base text-white/60">Youth basketball. All of it. <OneBox /> app.</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[15px] font-semibold text-white/70">
          <Link href="/demos" className="transition-colors hover:text-white">
            Watch the demos
          </Link>
          <Link href="/club" className="transition-colors hover:text-white">
            Find your club
          </Link>
          <Link href="/sign-in" className="transition-colors hover:text-white">
            Sign in
          </Link>
          <Link href="/legal/privacy" className="transition-colors hover:text-white">
            Privacy
          </Link>
          <Link href="/legal/terms" className="transition-colors hover:text-white">
            Terms
          </Link>
        </nav>
        <p className="text-[13px] text-white/40">© 2026 SportsHub One</p>
      </div>
    </footer>
  )
}

/* ── Preview-only notes (not part of the page) ───────────────────────────── */

function PreviewNotes() {
  return (
    <aside className="border-t-4 border-dashed border-gold-500 bg-gold-50 py-10">
      <div className="mx-auto w-full max-w-4xl px-5">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-gold-600">
          Preview notes · this strip is not part of the page
        </p>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-[15px] leading-relaxed text-ink-700">
          <li>
            <span className="font-semibold">The capture is live now:</span> every form on this
            page and the ask inside the demo player store real rows (email or phone, detected
            server side) with the honeypot and rate limit in front. Nothing else is wired.
          </li>
          <li>
            The screenshots are real captures from the running app. Signup buttons are hidden in
            them, the way the launch build will hide them. Easy to recapture any time with
            scripts/demo/capture-home-shots.mjs.
          </li>
          <li>
            The browser frame shows ysportshub.com and swaps to whatever domain you pick.
          </li>
          <li>
            Everything on this page is wired now: the forms store real rows, the claim search
            hits the live directory, and Claim it opens the real claim flow.
          </li>
        </ul>
      </div>
    </aside>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export function HomePreview() {
  return (
    <main className="bg-white">
      <style>{`
        .hp-rise { animation: hp-rise 640ms ease-out both; }
        @keyframes hp-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hp-rise { animation: none; }
        }
        html { scroll-snap-type: y proximity; }
        .hp-xfade { animation: hp-xfade 380ms ease-out both; }
        @keyframes hp-xfade { from { opacity: 0; } to { opacity: 1; } }
        main > * { scroll-snap-align: start; }
      `}</style>
      <Hero />
      <Screenshots />
      <ClaimYourClub />
      <ReplacesStory />
      <CompareTable />
      <EverybodyConnects />
      <DemoCards />
      <Footer />
      <PreviewNotes />
    </main>
  )
}
