"use client"

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

type Pitch = { headline: string; accent: string; proof: [string, string, string] }

const PITCHES: Record<string, Pitch> = {
  parent: {
    headline: "Every game, every kid,",
    accent: "one place.",
    proof: [
      "Live scores when you can't be courtside",
      "RSVP for every kid in one tap",
      "Registration, waivers and fees, sorted",
    ],
  },
  player: {
    headline: "Your season,",
    accent: "in your pocket.",
    proof: [
      "Your stat line after every game",
      "Team chat, schedule and RSVPs",
      "A player page worth sharing",
    ],
  },
  coach: {
    headline: "Your team,",
    accent: "sorted.",
    proof: [
      "Who's in and who's out before you plan",
      "Roster, chat and game day in one place",
      "Practices the parents actually see",
    ],
  },
  club: {
    headline: "Run the club,",
    accent: "not the paperwork.",
    proof: [
      "Tryouts, offers and rosters end to end",
      "Payments, installments and receipts",
      "One club page every family bookmarks",
    ],
  },
  league: {
    headline: "A whole season,",
    accent: "built in one click.",
    proof: [
      "Schedules that respect every gym",
      "Standings, divisions and playoffs",
      "Referees assigned and settled",
    ],
  },
}

const DEFAULT_PITCH: Pitch = {
  headline: "Every game, every kid,",
  accent: "one place.",
  proof: [
    "Live scores, box scores and recaps",
    "One calendar for every kid and team",
    "Registration, waivers and payments in one place",
  ],
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
  const pitch = (persona && PITCHES[persona]) || DEFAULT_PITCH

  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#4338ca] via-[#2f2d78] to-[#1b1a3d] p-10 text-white lg:flex lg:flex-col xl:p-14">
      {/* Abstract shape accent — overlapping soft discs and a thin ring.
          (Court diagrams read as clip art here; tester 2026-08-13.) */}
      <div className="bg-hoop-500/30 pointer-events-none absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full blur-3xl" />
      <div className="bg-play-400/25 pointer-events-none absolute -left-28 top-1/3 h-80 w-80 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-10 h-[30rem] w-[30rem] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-16 right-24 h-72 w-72 rounded-full border border-white/[0.07]" />
      <div className="bg-hoop-500/80 pointer-events-none absolute right-16 top-1/2 h-3 w-3 rounded-full" />

      <div className="relative z-10">
        <BrandWordmark size="lg" variant="reverse" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <h2 className="font-display max-w-[27rem] text-[2.9rem] font-black leading-[1.05] xl:text-[3.35rem]">
          {pitch.headline}
          <br />
          <span className="text-hoop-400">{pitch.accent}</span>
        </h2>
        <ul className="mt-10 space-y-4">
          {pitch.proof.map((p) => (
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
