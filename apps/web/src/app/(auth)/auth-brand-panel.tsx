"use client"

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
      </div>

      <p className="relative z-10 text-[13px] text-white/45">
        The complete platform for youth basketball clubs, leagues, and families.
      </p>
    </aside>
  )
}
