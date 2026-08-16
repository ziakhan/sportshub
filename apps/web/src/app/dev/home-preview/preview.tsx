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
import { DEMOS, type DemoAudience } from "@/app/demos/registry"

/* Rotating hero slogans in the owner's priority order (2026-08-17), each with
   its own accent the way the product home page colours "All of it." in gold.
   Clickable: arrows and dots move through them, and a manual move stops the
   auto-advance so a reader is never yanked off a line. */
const SLOGANS: { key: string; node: React.ReactNode }[] = [
  {
    key: "one-app",
    node: (
      <>
        Youth basketball. <span className="text-gold-400">All of it.</span> One app.
      </>
    ),
  },
  {
    key: "already-built",
    node: (
      <>
        Registration to final buzzer, <span className="text-court-400">already built</span>.
      </>
    ),
  },
  {
    key: "rosters",
    node: (
      <>
        Tryouts become <span className="text-gold-400">signed, paid rosters</span>.
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
  },
  {
    key: "potg",
    node: (
      <>
        Full stats, and a <span className="text-gold-400">Player of the Game</span>.
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
  },
  {
    key: "game-moved",
    node: (
      <>
        <span className="text-hoop-400">Game moved?</span> Everyone already knows.
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
  },
  {
    key: "standings",
    node: (
      <>
        Standings <span className="text-court-400">settle themselves</span>.
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
  },
  {
    key: "chat-calendar",
    node: (
      <>
        Team chat, polls, and <span className="text-hoop-400">one family calendar</span>.
      </>
    ),
  },
  {
    key: "discover",
    node: (
      <>
        Discover the <span className="text-gold-400">clubs around you</span>.
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
  { label: "Installment payment plans", cells: ["y", "y", "y", "y", "y", "y", "n", "p", "y", "y"] },
  { label: "Season scheduling with constraints", cells: ["y", "y", "y", "y", "y", "p", "n", "y", "y", "n"] },
  { label: "Standings and playoff brackets", cells: ["y", "y", "y", "y", "p", "y", "p", "y", "p", "n"] },
  { label: "Referee assignment and sign-off", cells: ["y", "p", "y", "y", "p", "p", "n", "p", "n", "n"] },
  { label: "Live scoring with full box scores, basketball", cells: ["y", "p", "p", "y", "p", "n", "y", "p", "n", "n"] },
  { label: "Team chat with polls", cells: ["y", "y", "y", "y", "p", "p", "p", "p", "p", "y"] },
  { label: "Family calendar with RSVP", cells: ["y", "y", "y", "y", "y", "y", "y", "n", "p", "y"] },
  { label: "Waivers and e-signatures", cells: ["y", "p", "y", "y", "y", "y", "n", "y", "y", "y"] },
  { label: "Automatic game recaps and news", cells: ["y", "n", "p", "n", "n", "n", "p", "n", "n", "n"] },
  { label: "Public player pages with season stats", cells: ["y", "n", "p", "p", "n", "n", "p", "p", "-", "-"] },
  { label: "Public club and league pages", cells: ["y", "y", "y", "y", "y", "p", "n", "p", "y", "y"] },
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

/* Real unclaimed listings from the directory, for the search mock. */
const CLAIM_ROWS = [
  { name: "Mississauga Minor Basketball Association", where: "Mississauga, ON" },
  { name: "Norfolk Youth Basketball Association", where: "Simcoe, ON" },
  { name: "Vanguard North", where: "Vaughan, ON" },
]

function useSloganRotation(count: number) {
  const [active, setActive] = useState(0)
  const [interacted, setInteracted] = useState(false)

  useEffect(() => {
    if (interacted) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(() => setActive((a) => (a + 1) % count), 4200)
    return () => window.clearInterval(id)
  }, [count, interacted])

  const goTo = (index: number) => {
    setInteracted(true)
    setActive(((index % count) + count) % count)
  }

  return { active, goTo }
}

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`text-xl font-bold tracking-tight ${dark ? "text-ink-950" : "text-white"}`}>
        SportsHub
      </span>
      <span className="rounded bg-gold-500 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-950">
        One
      </span>
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

  return (
    <CourtBackdrop variant="navy" floor="planks" intensity="immersive" className="min-h-[92vh]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6">
        <Wordmark />
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

      <div className="hp-rise mx-auto flex w-full max-w-4xl flex-col items-center px-5 pb-24 pt-20 text-center sm:pt-28">
        <p className="flex items-center gap-3 text-2xl font-bold uppercase tracking-[0.18em] text-gold-400 sm:text-3xl">
          <span className="h-2.5 w-2.5 rounded-full bg-gold-400 motion-safe:animate-pulse" aria-hidden="true" />
          Launching this fall
        </p>

        <div className="relative mt-7 w-full">
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            aria-label="Previous line"
            className="absolute -left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:flex lg:-left-14"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="h-6 w-6">
              <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
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
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label="Next line"
            className="absolute -right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:flex lg:-right-14"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="h-6 w-6">
              <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
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

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
          The season in one place: registration and payments, schedules, live scoring, standings
          and team chat.
        </p>

        <div id="notify" className="mt-10 w-full max-w-xl">
          <fieldset>
            <legend className="mb-3 text-[15px] font-semibold text-white/70">
              I&apos;m here as a
            </legend>
            <div className="flex flex-wrap justify-center gap-2">
              {IDENTITIES.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={identity === id}
                  onClick={() => setIdentity(identity === id ? null : id)}
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
          className="mt-9 text-[15px] font-semibold text-white/70 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white"
        >
          Or watch it work right now
        </Link>
      </div>
    </CourtBackdrop>
  )
}

/* ── The replaces story ──────────────────────────────────────────────────── */

function ReplacesStory() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-12 px-5 lg:grid-cols-2">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-hoop-600">Today</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">
            One app replaces the pile.
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
            <h3 className="text-2xl font-bold text-white">One app</h3>
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
    return (
      <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-live-50">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3 w-3 text-live-600">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  return <span className="text-ink-300 mx-auto block text-center text-sm">–</span>
}

function CompareTable() {
  return (
    <section className="border-y border-ink-100 bg-ink-50 py-20 sm:py-24">
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
                  <span className="rounded-full bg-ink-950 px-3 py-1 text-[13px] font-bold text-white">
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
                  <td className="px-5 py-3.5 text-[15px] font-semibold text-ink-800">
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
    <section className="border-y border-ink-100 bg-ink-50 py-14">
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

function PhoneFrame({
  src,
  alt,
  caption,
  className,
}: {
  src: string
  alt: string
  caption: string
  className?: string
}) {
  return (
    <figure className={`flex w-full max-w-[280px] flex-col items-center gap-4 ${className ?? ""}`}>
      <div className="w-full rounded-[2.2rem] bg-ink-900 p-2.5 shadow-2xl ring-1 ring-white/10">
        <div className="overflow-hidden rounded-[1.7rem]">
          <Image
            src={src}
            alt={alt}
            width={390}
            height={844}
            loading="eager"
            className="h-auto w-full"
          />
        </div>
      </div>
      <figcaption className="max-w-[260px] text-center text-[14px] leading-relaxed text-white/70">
        {caption}
      </figcaption>
    </figure>
  )
}

function BrowserFrame({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="flex w-full max-w-2xl flex-col gap-4">
      <div className="overflow-hidden rounded-xl bg-ink-900 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center gap-2 bg-ink-800 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="ml-3 rounded-md bg-ink-950/60 px-3 py-1 text-[12px] text-white/50">
            ysportshub.com
          </span>
        </div>
        <Image
          src={src}
          alt={alt}
          width={1440}
          height={900}
          loading="eager"
          className="h-auto w-full"
        />
      </div>
      <figcaption className="text-center text-[14px] leading-relaxed text-white/70">
        {caption}
      </figcaption>
    </figure>
  )
}

function Screenshots() {
  return (
    <CourtBackdrop variant="ink" floor="planks" intensity="immersive">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
        <div className="text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-gold-400">
            Straight from the app
          </p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            What it looks like.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
            These are screenshots, not mockups.
          </p>
        </div>

        <div className="mt-14 flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center">
          <PhoneFrame
            src="/home-preview/shots/parent-calendar-phone.png"
            alt="A family calendar on a phone: practices and games for two kids with Going, Maybe and Can't go buttons on each row"
            caption="The family week. Practices, games, and the RSVP right on the row."
            className="lg:mt-10"
          />

          <BrowserFrame
            src="/home-preview/shots/news-cards-desktop.png"
            alt="A news grid on desktop: game recap cards with team crests and scores, milestone cards and a club announcement"
            caption="Finals become recaps and milestone cards on their own."
          />

          <PhoneFrame
            src="/home-preview/shots/parent-team-chat-phone.png"
            alt="A team chat on a phone: coach messages, a carpool note from a parent, and a poll with live results"
            caption="Team chat with polls. One thread, every parent."
            className="lg:mt-10"
          />
        </div>

        <div className="mt-12 flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center">
          <PhoneFrame
            src="/home-preview/shots/game-live-boxscore-phone.png"
            alt="Live team stats on a phone: field goals, three pointers, free throws, rebounds, assists, steals and blocks as bars"
            caption="A live game on a parent's phone. Full team stats, no refresh, it just moves."
            className="lg:mt-10"
          />

          <BrowserFrame
            src="/home-preview/league-desktop.png"
            alt="A league page on desktop: final scores and standings tables with records, streaks and games back"
            caption="Standings settle themselves as finals come in."
          />

          <PhoneFrame
            src="/home-preview/news-recap-phone.png"
            alt="A game recap article on a phone: Toronto Lords Grade 10 Girls beat Burlington Force 54 to 33, Player of the Game named"
            caption="Every game gets a recap. Your name in the news."
            className="lg:mt-10"
          />
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
    <section className="bg-white py-20 sm:py-24">
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
      <section id="claim" className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
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
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/club"
                className="inline-block cursor-pointer rounded-xl bg-ink-950 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-ink-800"
              >
                Find your club
              </Link>
            </div>
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

          <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-ink-100">
            <label htmlFor="hp-club-search" className="sr-only">
              Search clubs
            </label>
            <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-4 py-3.5 ring-1 ring-ink-200">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5 text-ink-400">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                id="hp-club-search"
                type="text"
                readOnly
                value="basketball association"
                className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink-950 focus:outline-none"
              />
            </div>
            <ul className="mt-3 divide-y divide-ink-100">
              {CLAIM_ROWS.map((row, i) => (
                <li
                  key={row.name}
                  className={`flex items-center justify-between gap-4 px-2 py-3.5 ${
                    i === 0 ? "rounded-lg bg-gold-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink-950">{row.name}</p>
                    <p className="text-[13px] text-ink-500">{row.where}</p>
                  </div>
                  {i === 0 ? (
                    <span className="shrink-0 rounded-full bg-gold-500 px-3.5 py-1.5 text-[13px] font-bold text-ink-950">
                      Claim it
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-ink-100 px-3 py-1 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                      Unclaimed
                    </span>
                  )}
                </li>
              ))}
              <li className="px-2 py-3 text-[13px] text-ink-400">and 1,322 more</li>
            </ul>
          </div>
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
          <Wordmark />
          <p className="mt-3 text-base text-white/60">Youth basketball. All of it. One app.</p>
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
            Nothing is wired: the form does not send, the search does not search, the claim chip
            does not claim.
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
      `}</style>
      <Hero />
      <ClaimYourClub />
      <ReplacesStory />
      <CompareTable />
      <EverybodyConnects />
      <Screenshots />
      <DemoCards />
      <Footer />
      <PreviewNotes />
    </main>
  )
}
