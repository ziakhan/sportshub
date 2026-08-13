"use client"

import { useState } from "react"

/**
 * Home-page welcome (owner rulings 2026-08-13): server-rendered open so it
 * paints with the first HTML; BIGGER; "this fall" loud; one line for
 * everybody; and the role picker is STEP TWO of the same modal (no drawer
 * hop) with the registration ask stated plainly. "Demo" is downplayed in
 * visitor copy — this is "experience the live season".
 */

/**
 * The six promises (2026-08-13). Was a 30-item checkmark wall; research —
 * the "feature-rich showcase" pattern (4-6 cards, one message each), modal
 * cognitive-load findings, and the category leaders (TeamSnap shows 3,
 * SportsEngine 5, both benefit-led) — all say a first-visit modal converts
 * on a short outcome list, not a spec sheet. The exhaustive list belongs on
 * a feature page. Labels lead with the terms families and operators actually
 * search (live scores, calendar, registration, payments, scheduling,
 * standings, playoffs) so the copy earns its SEO keep too.
 */
const PROMISES: { title: string; proof: string; icon: JSX.Element }[] = [
  {
    title: "Live scores & stats",
    proof: "Box scores, play-by-play, stat leaders",
    icon: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  },
  {
    title: "One family calendar",
    proof: "RSVPs, practices, instant alerts",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10.5h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    title: "Registration & payments",
    proof: "Tryouts, offers, waivers, installments",
    icon: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
        <path d="M2.5 10.5h19" />
      </>
    ),
  },
  {
    title: "Team chat",
    proof: "Coaches and parents, one thread",
    icon: <path d="M20 11.5a7 7 0 0 1-7 7H8l-4 3v-6.2a7 7 0 0 1 7-9.3h2a7 7 0 0 1 7 5.5Z" />,
  },
  {
    title: "Automatic scheduling",
    proof: "A whole season in one click",
    icon: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  },
  {
    title: "Standings & playoffs",
    proof: "Divisions, brackets, a champion",
    icon: (
      <>
        <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4Z" />
        <path d="M7.5 6H5a2.5 2.5 0 0 0 2.5 3M16.5 6H19a2.5 2.5 0 0 1-2.5 3" />
        <path d="M12 13.5V17M9 20h6" />
      </>
    ),
  },
]

/**
 * The breadth layer (tester call 2026-08-13): the six promises alone dropped
 * twelve real capabilities. Progressive disclosure rather than a wall — the
 * outcomes lead, these quiet chips prove the rest of the surface area for the
 * operator who IS shopping on breadth. Everything here is deliberately NOT in
 * a promise line above; together they cover the original thirty.
 */
const ALSO_INCLUDED = [
  "Game recaps",
  "Player pages",
  "Club pages",
  "Rosters",
  "Referee assignments",
  "Announcements",
  "Follows",
  "E-transfers",
]

const ROLES: { key: string; title: string; blurb: string; soon?: boolean }[] = [
  { key: "parent", title: "Parent", blurb: "Your kids, one calendar, live games." },
  { key: "player", title: "Player", blurb: "Your team, your stats, your season." },
  { key: "coach", title: "Coach", blurb: "Roster, RSVPs, chat, game day." },
  { key: "club", title: "Club owner", blurb: "Teams, tryouts, offers, payments." },
  { key: "league", title: "League", blurb: "Schedule, standings, playoffs." },
  { key: "referee", title: "Referee", blurb: "Shifts and sign-offs.", soon: true },
  { key: "trainer", title: "Trainer", blurb: "Listings and bookings.", soon: true },
  { key: "media", title: "Photo & video", blurb: "Shoot and tag the games.", soon: true },
]

export function WelcomePopup() {
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<1 | 2>(1)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="Welcome">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[32px] bg-white shadow-2xl">
        {/* Court hero — shared by both steps */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#101c36] via-[#1b2a4a] to-[#0d1526] px-8 pb-8 pt-9 text-white sm:px-10">
          <svg
            className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 opacity-25"
            viewBox="0 0 200 200"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            aria-hidden
          >
            <circle cx="100" cy="100" r="96" />
            <circle cx="100" cy="100" r="58" />
            <circle cx="100" cy="100" r="14" fill="#f59e0b" stroke="none" opacity="0.9" />
            <path d="M4 100h192" />
          </svg>
          <p className="relative inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-black uppercase tracking-[0.14em] text-amber-950 shadow">
            Launching this fall
          </p>
          {step === 1 ? (
            <>
              <h2 className="relative mt-4 text-4xl font-black leading-tight sm:text-5xl">
                A whole season,
                <br />
                <span className="text-amber-400">already live.</span>
              </h2>
              <p className="relative mt-4 max-w-md text-[15px] leading-7 text-white/85">
                A full youth basketball season — live scores, schedules, standings and
                stories. Step in and see exactly what yours will feel like.
              </p>
            </>
          ) : (
            <>
              <h2 className="relative mt-4 text-3xl font-black leading-tight sm:text-4xl">
                Pick your seat <span className="text-amber-400">in the gym.</span>
              </h2>
              <p className="relative mt-3 max-w-md text-[15px] leading-7 text-white/85">
                Choose a role and step into the live season. You&apos;ll create a free account
                first. It takes a minute, and it&apos;s ready when the real season starts.
              </p>
            </>
          )}
        </div>

        {step === 1 ? (
          <div className="p-7 sm:p-8">
            <p className="text-ink-400 font-condensed mb-4 text-[12px] font-bold uppercase tracking-[0.18em]">
              Everything a season needs
            </p>
            <div className="mb-6 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              {PROMISES.map((f) => (
                <div key={f.title} className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200/70">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      {f.icon}
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="text-ink-900 block text-[16px] font-bold leading-5">
                      {f.title}
                    </span>
                    <span className="text-ink-500 mt-1 block text-[13.5px] leading-5">
                      {f.proof}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            {/* Breadth, quietly: the outcomes sell, these prove the surface area. */}
            <div className="border-ink-100 mb-6 border-t pt-4">
              <p className="text-ink-400 font-condensed mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.18em]">
                Also included
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALSO_INCLUDED.map((x) => (
                  <span
                    key={x}
                    className="bg-ink-50 text-ink-600 ring-ink-100 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset"
                  >
                    {x}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-2xl bg-amber-500 px-6 py-4 text-[17px] font-bold text-amber-950 shadow-md transition hover:bg-amber-400"
              >
                Experience the live season →
              </button>
              <button
                onClick={() => setOpen(false)}
                className="border-ink-200 text-ink-700 hover:border-ink-400 rounded-2xl border px-6 py-4 text-[17px] font-semibold transition"
              >
                Look around first
              </button>
            </div>
            <p className="text-ink-400 mt-4 text-center text-[13px]">
              Looking around is open to everyone, no account needed.
            </p>
          </div>
        ) : (
          <div className="p-7 sm:p-8">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {ROLES.map((r) =>
                r.soon ? (
                  <div
                    key={r.key}
                    className="border-ink-100 rounded-2xl border bg-white p-3.5 opacity-60"
                  >
                    <span className="text-ink-900 block text-[15px] font-bold">{r.title}</span>
                    <span className="text-ink-500 mt-0.5 block text-xs leading-4">{r.blurb}</span>
                    <span className="text-ink-500 mt-2 inline-block rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                      Coming soon
                    </span>
                  </div>
                ) : (
                  <a
                    key={r.key}
                    href={`/demo/start?persona=${r.key}`}
                    className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
                  >
                    <span className="text-ink-950 block text-[15px] font-bold">{r.title}</span>
                    <span className="text-ink-600 mt-0.5 block text-xs leading-4">{r.blurb}</span>
                    <span className="mt-2 inline-block text-[12px] font-bold text-amber-700">
                      Start free →
                    </span>
                  </a>
                )
              )}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-ink-500 hover:text-ink-800 text-sm font-semibold"
              >
                ← Back
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-500 hover:text-ink-800 text-sm font-semibold"
              >
                Just look around
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
