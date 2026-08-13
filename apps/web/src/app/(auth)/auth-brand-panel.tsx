"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BrandWordmark } from "@/components/brand/wordmark"

/**
 * The auth page's brand panel, TARGETED (2026-08-13).
 *
 * Someone arriving from the demo has already told us who they are — they
 * picked a persona, and the demo hands us `?callbackUrl=/demo/start?persona=X`
 * on the way to signup. Selling a coach "one calendar for every kid" wastes
 * the one moment we know exactly what they came for. Organic visitors, who
 * have told us nothing, get the general pitch.
 *
 * Client component because Next.js App Router layouts don't receive
 * searchParams — only pages do — and this needs the query string.
 */

/** The headline is the BRAND promise — constant for everyone, so the panel
 *  always says the same thing about SportsHub. Only the proof points below
 *  it retarget to whoever is arriving (tester ruling 2026-08-13). */
const HEADLINE = { lead: "Every game, every kid,", accent: "one place." }

const PROOF_BY_PERSONA: Record<string, [string, string, string]> = {
  parent: [
    "Live scores when you can't be courtside",
    "RSVP for every kid in one tap",
    "Registration, waivers and fees, sorted",
  ],
  player: [
    "Your stat line after every game",
    "Team chat, schedule and RSVPs",
    "A player page worth sharing",
  ],
  coach: [
    "Who's in and who's out before you plan",
    "Roster, chat and game day in one place",
    "Practices the parents actually see",
  ],
  club: [
    "Tryouts, offers and rosters end to end",
    "Payments, installments and receipts",
    "One club page every family bookmarks",
  ],
  league: [
    "Schedules that respect every gym",
    "Standings, divisions and playoffs",
    "Referees assigned and settled",
  ],
}

const DEFAULT_PROOF: [string, string, string] = [
  "Live scores, box scores and recaps",
  "One calendar for every kid and team",
  "Registration, waivers and payments in one place",
]

/**
 * The panel's centrepiece: a sample of the product's OWN card language,
 * rendered in HTML rather than shipped as a screenshot — so it stays razor
 * sharp at any size (the blurred phone shot is exactly what this replaces)
 * and it retargets with the persona. Illustrative sample data, drawn from
 * the fictional Maple Court demo world; never presented as live numbers.
 */
function Monogram({ initials, tone }: { initials: string; tone: string }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-white ${tone}`}
    >
      {initials}
    </span>
  )
}

function SampleCard({ persona }: { persona: string | null }) {
  const shell =
    "w-[19.5rem] rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/5 rotate-[-2.5deg]"
  const eyebrow = "text-[10px] font-black uppercase tracking-[0.14em]"

  if (persona === "coach") {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between">
          <span className={`${eyebrow} text-play-600`}>Practice · Tue 6:00 PM</span>
          <span className="text-ink-400 text-[11px] font-semibold">Gr 8</span>
        </div>
        <p className="text-ink-900 mt-2 text-[15px] font-bold">Northgate Wolves</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="bg-court-50 text-court-700 rounded-full px-2.5 py-1 text-[11.5px] font-bold">
            9 going
          </span>
          <span className="bg-hoop-50 text-hoop-700 rounded-full px-2.5 py-1 text-[11.5px] font-bold">
            2 out
          </span>
          <span className="bg-ink-50 text-ink-500 rounded-full px-2.5 py-1 text-[11.5px] font-bold">
            1 no reply
          </span>
        </div>
      </div>
    )
  }

  if (persona === "league") {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between">
          <span className={`${eyebrow} text-play-600`}>Standings · Grade 10</span>
          <span className="text-ink-400 text-[11px] font-semibold">Week 6</span>
        </div>
        <div className="mt-2.5 space-y-1.5">
          {[
            ["1", "Ironwood Elite", "10-0", "bg-play-600"],
            ["2", "Harbour City Hoops", "8-2", "bg-hoop-500"],
            ["3", "Summit Select", "7-3", "bg-court-600"],
          ].map(([rank, name, rec, tone]) => (
            <div key={name} className="flex items-center gap-2.5">
              <span className="text-ink-400 w-3 text-[12px] font-bold">{rank}</span>
              <Monogram initials={name.slice(0, 2).toUpperCase()} tone={tone} />
              <span className="text-ink-800 flex-1 truncate text-[13px] font-semibold">{name}</span>
              <span className="font-condensed text-ink-900 text-[14px] font-black tabular-nums">
                {rec}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (persona === "club") {
    return (
      <div className={shell}>
        <span className={`${eyebrow} text-court-700`}>Offer accepted</span>
        <p className="text-ink-900 mt-2 text-[15px] font-bold">Elijah Carter · Gr 9</p>
        <div className="border-ink-100 mt-3 flex items-end justify-between border-t pt-3">
          <span className="text-ink-500 text-[12px] font-semibold">Paid in 3 · 1 of 3</span>
          <span className="font-condensed text-ink-950 text-[22px] font-black tabular-nums">
            $450
          </span>
        </div>
      </div>
    )
  }

  if (persona === "player") {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between">
          <span className={`${eyebrow} text-play-600`}>Your game · Sat</span>
          <span className="bg-court-50 text-court-700 rounded-full px-2 py-0.5 text-[10px] font-black uppercase">
            Won
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["18", "PTS"],
            ["6", "REB"],
            ["4", "AST"],
          ].map(([n, l]) => (
            <div key={l} className="bg-ink-50 rounded-xl py-2">
              <div className="font-condensed text-ink-950 text-[22px] font-black leading-none tabular-nums">
                {n}
              </div>
              <div className="text-ink-400 mt-1 text-[10px] font-bold tracking-wide">{l}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // parent + organic: the live game card
  return (
    <div className={shell}>
      <div className="flex items-center justify-between">
        <span className="text-live-600 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]">
          <span className="bg-live-500 h-1.5 w-1.5 rounded-full motion-safe:animate-pulse" />
          Live
        </span>
        <span className="text-ink-400 text-[11px] font-semibold">Q3 · 6:42</span>
      </div>
      <div className="mt-3 space-y-2">
        {[
          ["LS", "Lakeside Storm", "58", "bg-play-600"],
          ["NW", "Northgate Wolves", "52", "bg-hoop-500"],
        ].map(([ini, name, score, tone]) => (
          <div key={name} className="flex items-center gap-2.5">
            <Monogram initials={ini} tone={tone} />
            <span className="text-ink-800 flex-1 truncate text-[13.5px] font-semibold">{name}</span>
            <span className="font-condensed text-ink-950 text-[20px] font-black tabular-nums">
              {score}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ROTATION = ["parent", "player", "coach", "club", "league"] as const

/** matchMedia hook — auto-rotation must not run for reduced-motion users. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const on = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return reduced
}

/**
 * Organic visitors haven't told us who they are, so instead of guessing we
 * show all five — one card at a time, crossfading every ~4s. It previews the
 * breadth of the product without a wall of copy, and the dots let someone
 * take control (WCAG 2.2.2: auto-updating content needs a way to stop).
 * Hovering pauses; reduced-motion never starts it.
 */
function RotatingSample() {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduced || paused) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % ROTATION.length), 4000)
    return () => window.clearInterval(id)
  }, [reduced, paused])

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative h-[11.5rem]">
        {ROTATION.map((p, i) => (
          <div
            key={p}
            aria-hidden={i !== index}
            className={`absolute left-0 top-0 transition-all duration-700 ease-out ${
              i === index
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-3 opacity-0"
            }`}
          >
            <SampleCard persona={p} />
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-2">
        {ROTATION.map((p, i) => (
          <button
            key={p}
            onClick={() => setIndex(i)}
            aria-label={`Show the ${p} example`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "bg-hoop-400 w-6" : "w-1.5 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

/** Pull the demo persona back out of the callbackUrl we were handed. */
function personaFrom(callbackUrl: string | null): string | null {
  if (!callbackUrl) return null
  const match = /[?&]persona=([a-z]+)/i.exec(decodeURIComponent(callbackUrl))
  return match?.[1]?.toLowerCase() ?? null
}

export function AuthBrandPanel() {
  const params = useSearchParams()
  const persona = personaFrom(params?.get("callbackUrl") ?? null)
  const proof = (persona && PROOF_BY_PERSONA[persona]) || DEFAULT_PROOF

  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#4338ca] via-[#2f2d78] to-[#1b1a3d] p-10 text-white lg:flex lg:flex-col xl:p-14">
      {/* Light, not shapes (tester 2026-08-13). Every hard-edged motif tried
          here — bullseye, half court, outline rings, a stray dot — read as
          debris on a gradient. Soft glows just make the panel feel lit. */}
      <div className="bg-hoop-500/30 pointer-events-none absolute -right-32 -top-32 h-[32rem] w-[32rem] rounded-full blur-[100px]" />
      <div className="bg-play-400/25 pointer-events-none absolute -left-32 bottom-[-8rem] h-[30rem] w-[30rem] rounded-full blur-[110px]" />

      <div className="relative z-10">
        {/* The lockup is the way home from any auth page (tester 2026-08-13) */}
        <Link
          href="/"
          aria-label="SportsHub ONE — back to home"
          className="inline-block rounded-lg transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <BrandWordmark size="lg" variant="reverse" />
        </Link>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <h2 className="font-display max-w-[27rem] text-[2.9rem] font-black leading-[1.05] xl:text-[3.35rem]">
          {HEADLINE.lead}
          <br />
          <span className="text-hoop-400">{HEADLINE.accent}</span>
        </h2>
        <ul className="mt-10 space-y-4">
          {proof.map((p) => (
            <li key={p} className="flex items-start gap-3.5 text-[16.5px] leading-6 text-white/85">
              <span className="bg-hoop-500/20 text-hoop-300 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              </span>
              {p}
            </li>
          ))}
        </ul>

        {/* Known visitor → their card. Organic → all five, rotating. */}
        <div className="mt-10 hidden xl:block">
          {persona && PROOF_BY_PERSONA[persona] ? (
            <SampleCard persona={persona} />
          ) : (
            <RotatingSample />
          )}
        </div>
      </div>

      <p className="relative z-10 text-[13px] text-white/45">
        The complete platform for youth basketball clubs, leagues, and families.
      </p>
    </aside>
  )
}
