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
import { DEMOS, type DemoAudience } from "@/app/demos/registry"

/* Rotating hero slogans. All from the approved creative set. */
const SLOGANS = [
  "Youth basketball. All of it. One app.",
  "Registration to final buzzer, already built.",
  "Tryouts become signed, paid rosters.",
  "Game moved? Everyone already knows.",
  "Watch every game live.",
  "Your name in the news.",
]

const IDENTITIES = ["Parent", "Club", "League", "Referee", "Player"] as const
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

/* The pile the product replaces, from the approved creatives. */
const THE_PILE = [
  "RAMP or a registration spreadsheet",
  "TeamSnap or Spond",
  "A separate scoring app",
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
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced.current) return
    const id = window.setInterval(() => setActive((a) => (a + 1) % count), 4200)
    return () => window.clearInterval(id)
  }, [count])

  return active
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
  const active = useSloganRotation(SLOGANS.length)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [submitted, setSubmitted] = useState(false)

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
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-gold-400 ring-1 ring-white/15">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" aria-hidden="true" />
          Coming this fall
    </p>

        <h1 className="mt-7 grid w-full text-balance text-[44px] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
          {SLOGANS.map((s, i) => (
            <span
              key={s}
              aria-hidden={i !== active}
              className={`col-start-1 row-start-1 transition-opacity ${
                i === active
                  ? "opacity-100 duration-500"
                  : "pointer-events-none opacity-0 duration-300"
              }`}
            >
              {s}
            </span>
          ))}
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
          The season in one place: registration and payments, schedules, live scoring, standings
          and team chat.
        </p>

        <form
          className="mt-10 w-full max-w-xl"
          onSubmit={(e) => {
            e.preventDefault()
            setSubmitted(true)
          }}
        >
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

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <label className="sr-only" htmlFor="hp-email">
              Email
            </label>
            <input
              id="hp-email"
              type="email"
              required
              placeholder="you@example.com"
              className="min-w-0 flex-1 rounded-xl border-0 bg-white px-5 py-3.5 text-base text-ink-950 shadow-lg ring-1 ring-white/30 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-xl bg-gold-500 px-7 py-3.5 text-base font-bold text-ink-950 shadow-lg transition-colors hover:bg-gold-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Keep me posted
            </button>
          </div>

          <p className="mt-3 text-[13px] text-white/55">
            We&apos;ll email you about the launch and nothing else. Unsubscribe anytime.
          </p>

          {submitted && (
            <p className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-[14px] text-white/85">
              This is the preview. Nothing was sent.
            </p>
          )}

          {identity === "Club" && (
            <p className="mt-3 rounded-lg bg-gold-500/15 px-4 py-2.5 text-[14px] text-gold-100 ring-1 ring-gold-400/30">
              Run a club? It may already be listed here.{" "}
              <a href="#claim" className="font-semibold text-gold-400 underline underline-offset-2">
                Find it below
              </a>
            </p>
          )}
        </form>

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
            src="/home-preview/live-game-phone.png"
            alt="A live game on a phone: score 54 to 26 in the third quarter, quarter scores and game leaders below"
            caption="A live game on a parent's phone. Score, box score, play by play. No refresh, it just moves."
            className="lg:mt-10"
          />

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
                src="/home-preview/league-desktop.png"
                alt="A league page on desktop: final scores and standings tables with records, streaks and games back"
                width={1440}
                height={900}
                loading="eager"
                className="h-auto w-full"
              />
            </div>
            <figcaption className="text-center text-[14px] leading-relaxed text-white/70">
              Standings settle themselves as finals come in.
            </figcaption>
          </figure>

          <PhoneFrame
            src="/home-preview/news-recap-phone.png"
            alt="A game recap article on a phone: Toronto Lords Grade 10 Girls beat Burlington Force 54 to 33"
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
              Your club may already be listed.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-700">
              We imported 1,325 Canadian club listings so families can find them. If one of them
              is yours, claiming it is free: you get the page, the brand and the tools.
            </p>
            <Link
              href="/club"
              className="mt-8 inline-block cursor-pointer rounded-xl bg-ink-950 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-ink-800"
            >
              Find your club
            </Link>
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
            <span className="font-semibold">Email or phone capture:</span> the earlier ruling said
            phone, the latest word said email, so the form above uses email. The phone version of
            the same field:
            <span className="mt-2 flex max-w-sm gap-2">
              <input
                type="tel"
                readOnly
                value="(416) 555-0134"
                className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-4 py-2 text-[15px] text-ink-950"
                aria-label="Phone capture variant"
              />
              <span className="rounded-lg bg-ink-950 px-4 py-2 text-[15px] font-bold text-white">
                Text me at launch
              </span>
            </span>
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
      <ReplacesStory />
      <EverybodyConnects />
      <Screenshots />
      <DemoCards />
      <ClaimYourClub />
      <Footer />
      <PreviewNotes />
    </main>
  )
}
